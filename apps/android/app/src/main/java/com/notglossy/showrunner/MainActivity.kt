package com.notglossy.showrunner

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.net.wifi.WifiManager
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.CookieManager
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.TextView
import androidx.webkit.WebViewCompat
import org.json.JSONObject
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.math.min

/**
 * The whole kiosk: loads config, registers with the server, shows `/device/:id` in a WebView,
 * sends heartbeats, and runs the watchdog. States: SETUP (no config), CONNECTING, SHOWING,
 * RECONNECTING (overlay + backoff retries).
 */
class MainActivity : android.app.Activity() {

    private enum class State { SETUP, CONNECTING, SHOWING, RECONNECTING }

    private val main = Handler(Looper.getMainLooper())
    private val io = Executors.newSingleThreadScheduledExecutor()
    private val startedAt = SystemClock.elapsedRealtime()

    private lateinit var webContainer: FrameLayout
    private lateinit var setupView: View
    private lateinit var setupBody: TextView
    private lateinit var overlay: View
    private lateinit var overlayBody: TextView
    private var webView: WebView? = null
    private var wifiLock: WifiManager.WifiLock? = null

    private var state = State.CONNECTING
    @Volatile private var kioskMode = KioskMode.Mode.IMMERSIVE
    @Volatile private var config: KioskConfig? = null
    @Volatile private var registration: ServerClient.Registration? = null
    private lateinit var deviceInfo: DeviceInfo

    /**
     * Incremented when the session restarts and on every successful registration, so callbacks and
     * heartbeat loops from an older session or token stop themselves.
     */
    @Volatile private var generation = 0
    private var retryAttempt = 0
    private var nextRetryAt = 0L
    private var lastError: String? = null
    private var lastAckAt = 0L
    private var eventsDownBeats = 0
    @Volatile private var heartbeatIntervalMs = DEFAULT_HEARTBEAT_MS

    @Volatile private var currentUrl: String? = null
    @Volatile private var currentScreenId: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        webContainer = findViewById(R.id.web_container)
        setupView = findViewById(R.id.setup)
        setupBody = findViewById(R.id.setup_body)
        overlay = findViewById(R.id.overlay)
        overlayBody = findViewById(R.id.overlay_body)
        deviceInfo = DeviceIdentity.info(this)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        ConfigStore.saveFromIntent(this, intent)
        startSession()
        main.post(tickRunnable)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (ConfigStore.saveFromIntent(this, intent)) startSession()
    }

    override fun onResume() {
        super.onResume()
        kioskMode = KioskMode.apply(this)
        acquireWifiLock()
        webView?.onResume()
    }

    override fun onPause() {
        wifiLock?.takeIf { it.isHeld }?.release()
        webView?.onPause()
        super.onPause()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) KioskMode.hideSystemBars(this)
    }

    @Deprecated("Kiosk: back does nothing")
    @SuppressLint("MissingSuperCall", "GestureBackNavigation")
    override fun onBackPressed() {
        // Swallow back so the kiosk can't be dismissed.
    }

    override fun onDestroy() {
        generation++
        main.removeCallbacksAndMessages(null)
        io.shutdownNow()
        webView?.destroy()
        super.onDestroy()
    }

    /** Keeps Wi-Fi out of power save while the kiosk is in the foreground. */
    private fun acquireWifiLock() {
        val lock = wifiLock ?: applicationContext.getSystemService(WifiManager::class.java)
            ?.createWifiLock(WifiManager.WIFI_MODE_FULL_LOW_LATENCY, "ShowRunner:kiosk")
            ?.apply { setReferenceCounted(false) }
            ?.also { wifiLock = it }
        if (lock != null && !lock.isHeld) runCatching { lock.acquire() }.onFailure { Log.w(TAG, "Wi-Fi lock failed", it) }
    }

    // ---- session -----------------------------------------------------------------

    private fun startSession() {
        generation++
        retryAttempt = 0
        registration = null
        when (val result = ConfigStore.load(this)) {
            is ConfigResult.Missing -> showSetup(result.problems)
            is ConfigResult.Ready -> {
                config = result.config
                setState(State.CONNECTING)
                register()
            }
        }
    }

    private fun register() {
        val cfg = config ?: return
        val gen = generation
        val info = deviceInfo
        if (io.isShutdown) return
        io.execute {
            try {
                val reg = ServerClient(cfg.serverUrl).register(cfg.sharedSecret, info)
                main.post { if (gen == generation) onRegistered(cfg, reg) }
            } catch (e: Exception) {
                Log.w(TAG, "Registration failed", e)
                main.post { if (gen == generation) scheduleRetry("Can't register: ${describe(e)}") }
            }
        }
    }

    private fun onRegistered(cfg: KioskConfig, reg: ServerClient.Registration) {
        Log.i(TAG, "Registered ${reg.deviceId} claimed=${reg.claimed}")
        generation++ // retires the previous heartbeat loop (it used the old token)
        registration = reg
        heartbeatIntervalMs = reg.heartbeatIntervalSeconds.coerceIn(5, 300) * 1000L
        lastAckAt = SystemClock.elapsedRealtime()
        eventsDownBeats = 0
        val cookies = CookieManager.getInstance()
        cookies.setAcceptCookie(true)
        cookies.setCookie(cfg.serverUrl, "${reg.cookieName}=${reg.cookieValue}; Path=/; SameSite=Lax") {
            cookies.flush()
            loadPage(cfg.serverUrl + reg.pageUrl)
        }
        scheduleHeartbeat(generation, 0)
    }

    private fun scheduleRetry(error: String) {
        lastError = error
        val delay = RETRY_BACKOFF_MS[min(retryAttempt, RETRY_BACKOFF_MS.lastIndex)]
        retryAttempt++
        nextRetryAt = SystemClock.elapsedRealtime() + delay
        setState(State.RECONNECTING)
        val gen = generation
        main.postDelayed({
            if (gen != generation) return@postDelayed
            registration = null
            register()
        }, delay)
    }

    // ---- heartbeat + watchdog --------------------------------------------------------

    private fun scheduleHeartbeat(gen: Int, delayMs: Long) {
        if (io.isShutdown) return
        runCatching { io.schedule({ heartbeat(gen) }, delayMs, TimeUnit.MILLISECONDS) }
    }

    private fun heartbeat(gen: Int) {
        if (gen != generation) return
        val cfg = config ?: return
        val reg = registration ?: return
        val uptime = (SystemClock.elapsedRealtime() - startedAt) / 1000
        try {
            val body = DeviceStatus.heartbeatBody(this, currentUrl, currentScreenId, uptime)
            val ack = ServerClient(cfg.serverUrl).heartbeat(reg.deviceId, reg.token, body)
            main.post { if (gen == generation) onHeartbeatAck(ack) }
        } catch (e: ServerClient.HttpException) {
            Log.w(TAG, "Heartbeat rejected: ${e.message}")
            if (e.status == 401 || e.status == 404) {
                // Token rotated or device deleted on the server: register again.
                main.post { if (gen == generation) scheduleRetry("Server no longer recognises this device (${e.status})") }
                return
            }
            main.post { if (gen == generation) onHeartbeatFailed(describe(e)) }
        } catch (e: Exception) {
            Log.w(TAG, "Heartbeat failed: ${e.message}")
            main.post { if (gen == generation) onHeartbeatFailed(describe(e)) }
        }
        scheduleHeartbeat(gen, heartbeatIntervalMs)
    }

    private fun onHeartbeatAck(ack: ServerClient.HeartbeatAck) {
        lastAckAt = SystemClock.elapsedRealtime()
        heartbeatIntervalMs = ack.heartbeatIntervalSeconds.coerceIn(5, 300) * 1000L
        if (state == State.RECONNECTING) {
            // Server is back after a heartbeat outage: reload the page and carry on.
            retryAttempt = 0
            setState(State.SHOWING)
            webView?.reload()
            return
        }
        // Page is up but its SSE stream isn't: after a few beats, reload to reconnect it.
        eventsDownBeats = if (state == State.SHOWING && !ack.eventsConnected) eventsDownBeats + 1 else 0
        if (eventsDownBeats >= EVENTS_DOWN_RELOAD_BEATS) {
            Log.w(TAG, "Page events stream down for $eventsDownBeats heartbeats; reloading")
            eventsDownBeats = 0
            webView?.reload()
        }
    }

    private fun onHeartbeatFailed(error: String) {
        lastError = error
        val silentFor = SystemClock.elapsedRealtime() - lastAckAt
        if (silentFor >= WATCHDOG_TIMEOUT_MS && state != State.RECONNECTING) {
            Log.w(TAG, "No heartbeat ack for ${silentFor / 1000}s; entering reconnecting state")
            retryAttempt = 0
            nextRetryAt = SystemClock.elapsedRealtime() + heartbeatIntervalMs
            setState(State.RECONNECTING)
        }
    }

    // ---- WebView -----------------------------------------------------------------------

    private fun loadPage(url: String) {
        val view = webView ?: createWebView().also { webView = it }
        if (state != State.RECONNECTING) setState(State.SHOWING)
        Log.i(TAG, "Loading $url")
        view.loadUrl(url)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun createWebView(): WebView {
        val view = WebView(this)
        view.setBackgroundColor(Color.BLACK)
        view.isLongClickable = false
        view.isHapticFeedbackEnabled = false
        view.setOnLongClickListener { true }
        view.isVerticalScrollBarEnabled = false
        view.isHorizontalScrollBarEnabled = false
        view.overScrollMode = View.OVER_SCROLL_NEVER
        with(view.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            // Screens are authored at 1280 CSS px wide (<meta name="viewport" content="width=1280">).
            useWideViewPort = true
            loadWithOverviewMode = true
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            textZoom = 100
            mediaPlaybackRequiresUserGesture = false
            cacheMode = WebSettings.LOAD_DEFAULT
            allowFileAccess = false
            allowContentAccess = false
        }
        view.addJavascriptInterface(NativeBridge(this, ::nativeInfo) { view.reload() }, "KioskNative")
        view.webViewClient = KioskWebViewClient()
        view.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(message: ConsoleMessage): Boolean {
                Log.d(WEB_TAG, "${message.messageLevel()} ${message.message()} (${message.sourceId()}:${message.lineNumber()})")
                return true
            }
        }
        webContainer.addView(view, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        return view
    }

    private inner class KioskWebViewClient : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val server = config?.serverUrl?.let(Uri::parse) ?: return true
            val target = request.url
            val sameOrigin = target.scheme == server.scheme && target.host == server.host && target.port == server.port
            if (!sameOrigin) Log.w(TAG, "Blocked navigation to $target")
            return !sameOrigin
        }

        override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
            currentUrl = url
        }

        override fun onPageFinished(view: WebView, url: String) {
            currentUrl = url
            view.evaluateJavascript("window.kiosk ? window.kiosk.screenId : null") { value ->
                currentScreenId = value?.takeUnless { it == "null" }?.removeSurrounding("\"")
            }
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (!request.isForMainFrame) return
            Log.w(TAG, "Page load failed: ${error.errorCode} ${error.description}")
            scheduleRetry("Can't load page: ${error.description}")
        }

        override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, response: WebResourceResponse) {
            if (!request.isForMainFrame) return
            Log.w(TAG, "Page HTTP ${response.statusCode}")
            scheduleRetry("Page returned HTTP ${response.statusCode}")
        }

        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
            Log.e(TAG, "WebView renderer gone (crash=${detail.didCrash()}); recreating")
            webContainer.removeView(view)
            view.destroy()
            if (webView === view) webView = null
            scheduleRetry("Display engine restarted")
            return true
        }
    }

    private fun nativeInfo(): JSONObject {
        val info = deviceInfo
        return JSONObject()
            .put("deviceId", info.deviceId)
            .put("model", info.model)
            .put("androidVersion", info.androidVersion)
            .put("appVersion", info.appVersion)
            .put("screenWidth", info.screenWidth)
            .put("screenHeight", info.screenHeight)
            .put("kioskMode", kioskMode.name.lowercase())
            .put("launcher", BuildConfig.LAUNCHER_ENABLED)
            .put("serverUrl", config?.serverUrl ?: JSONObject.NULL)
            .put("webViewVersion", WebViewCompat.getCurrentWebViewPackage(this)?.versionName ?: JSONObject.NULL)
    }

    // ---- UI states -------------------------------------------------------------------------

    private fun setState(next: State) {
        state = next
        setupView.visibility = if (next == State.SETUP) View.VISIBLE else View.GONE
        overlay.visibility = if (next == State.RECONNECTING) View.VISIBLE else View.GONE
        renderOverlay()
    }

    private fun showSetup(problems: List<String>) {
        setState(State.SETUP)
        val id = deviceInfo.deviceId
        val pkg = packageName
        setupBody.text = buildString {
            appendLine("This display needs a server URL and the device shared secret.")
            appendLine()
            appendLine("Device ID:  $id")
            appendLine("Kiosk mode: ${if (KioskMode.isDeviceOwner(this@MainActivity)) "device owner (locked)" else "immersive (not device owner)"}")
            appendLine()
            appendLine("Option 1: config file (recommended)")
            appendLine("  adb shell appops set $pkg MANAGE_EXTERNAL_STORAGE allow")
            appendLine("  adb shell mkdir -p /sdcard/showrunner")
            appendLine("  adb push config.json /sdcard/showrunner/config.json")
            appendLine("  config.json: {\"serverUrl\": \"http://192.168.1.10:3000\", \"sharedSecret\": \"…\"}")
            appendLine()
            appendLine("Option 2: intent extras")
            appendLine("  adb shell am start -n $pkg/.MainActivity \\")
            appendLine("    --es serverUrl http://192.168.1.10:3000 --es sharedSecret …")
            appendLine()
            appendLine("Checking again every 5 seconds.")
            if (problems.isNotEmpty()) {
                appendLine()
                problems.forEach { appendLine("• $it") }
            }
        }
        val gen = generation
        main.postDelayed({ if (gen == generation && state == State.SETUP) startSession() }, SETUP_POLL_MS)
    }

    private fun renderOverlay() {
        if (state != State.RECONNECTING) return
        val seconds = ((nextRetryAt - SystemClock.elapsedRealtime()) / 1000).coerceAtLeast(0)
        overlayBody.text = buildString {
            lastError?.let { appendLine(it) }
            appendLine()
            appendLine("Server  ${config?.serverUrl ?: "—"}")
            appendLine("Device  ${deviceInfo.deviceId}")
            append(if (seconds > 0) "Retrying in ${seconds}s (attempt ${retryAttempt})" else "Retrying…")
        }
    }

    private val tickRunnable = object : Runnable {
        override fun run() {
            renderOverlay()
            main.postDelayed(this, 1000)
        }
    }

    private fun describe(e: Exception): String = when (e) {
        is ServerClient.HttpException -> e.message ?: "HTTP ${e.status}"
        is java.net.UnknownHostException -> "unknown host"
        is java.net.ConnectException -> "connection refused"
        is java.net.SocketTimeoutException -> "timed out"
        else -> e.message ?: e.javaClass.simpleName
    }

    companion object {
        private const val TAG = "ShowRunner"
        private const val WEB_TAG = "ShowRunner.Web"
        private const val DEFAULT_HEARTBEAT_MS = 30_000L
        /** Show the reconnecting state after this long without a heartbeat ack. */
        private const val WATCHDOG_TIMEOUT_MS = 2 * 60_000L
        private const val EVENTS_DOWN_RELOAD_BEATS = 3
        private const val SETUP_POLL_MS = 5_000L
        private val RETRY_BACKOFF_MS = longArrayOf(5_000, 10_000, 20_000, 40_000, 60_000)
    }
}

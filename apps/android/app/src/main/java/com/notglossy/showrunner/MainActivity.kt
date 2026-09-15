package com.notglossy.showrunner

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.net.wifi.WifiManager
import android.net.ConnectivityManager
import android.net.Network
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.widget.Button
import android.widget.EditText
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
import java.lang.ref.WeakReference
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
    private lateinit var exitMenu: View
    private lateinit var exitStatus: TextView
    private lateinit var exitPinRow: View
    private lateinit var exitPin: EditText
    private lateinit var exitActions: View
    private lateinit var exitMessage: TextView
    private lateinit var exitLeaveStrict: Button
    private lateinit var exitChooseHome: Button
    private var leaveStrictArmed = false
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
        // A Home launch and an explicit launch (am start, boot/update receiver) create separate tasks. Keep only the
        // newest instance so there's never a second WebView and heartbeat loop. (Forwarding explicit launches to the
        // Home task doesn't work: it won't come to the front while another app, e.g. Settings, is on top.)
        activeInstance?.get()?.takeIf { it !== this && !it.isFinishing }?.let {
            Log.i(TAG, "Finishing previous kiosk instance")
            it.finish()
        }
        activeInstance = WeakReference(this)
        setContentView(R.layout.activity_main)
        webContainer = findViewById(R.id.web_container)
        setupView = findViewById(R.id.setup)
        setupBody = findViewById(R.id.setup_body)
        overlay = findViewById(R.id.overlay)
        overlayBody = findViewById(R.id.overlay_body)
        setupExitMenu()
        deviceInfo = DeviceIdentity.info(this)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        ConfigStore.saveFromIntent(this, intent)
        startSession()
        main.post(tickRunnable)
        registerNetworkCallback()
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

    @Deprecated("Kiosk: back closes the exit menu, otherwise does nothing")
    @SuppressLint("MissingSuperCall", "GestureBackNavigation")
    override fun onBackPressed() {
        if (exitMenu.visibility == View.VISIBLE) closeExitMenu()
    }

    override fun onDestroy() {
        if (activeInstance?.get() === this) activeInstance = null
        if (networkCallbackRegistered) runCatching { getSystemService(ConnectivityManager::class.java).unregisterNetworkCallback(networkCallback) }
        generation++
        main.removeCallbacksAndMessages(null)
        io.shutdownNow()
        webView?.destroy()
        super.onDestroy()
    }

    // ---- network recovery ------------------------------------------------------------------

    private var networkCallbackRegistered = false
    private var networkLostAt = 0L

    private val networkCallback = object : ConnectivityManager.NetworkCallback() {
        override fun onAvailable(network: Network) {
            main.post(::onNetworkAvailable)
        }

        override fun onLost(network: Network) {
            main.post(::onNetworkLost)
        }
    }

    private fun registerNetworkCallback() {
        runCatching {
            getSystemService(ConnectivityManager::class.java).registerDefaultNetworkCallback(networkCallback)
            networkCallbackRegistered = true
        }.onFailure { Log.w(TAG, "Couldn't watch network changes", it) }
    }

    private fun onNetworkLost() {
        if (networkLostAt == 0L) networkLostAt = SystemClock.elapsedRealtime()
        Log.w(TAG, "Network lost")
    }

    /**
     * Called when Android reports a usable default network: right after registering (ignored unless we're
     * still waiting to register), and whenever Wi-Fi comes back after a drop or roam.
     */
    private fun onNetworkAvailable() {
        val lostForMs = if (networkLostAt > 0) SystemClock.elapsedRealtime() - networkLostAt else 0L
        networkLostAt = 0L
        if (lostForMs == 0L && registration != null && state != State.RECONNECTING) return
        Log.i(TAG, "Network available${if (lostForMs > 0) " after ${lostForMs / 1000}s offline" else ""}; recovering")
        main.removeCallbacks(recoverAfterNetwork)
        // Give DHCP/DNS a moment after the link comes up.
        main.postDelayed(recoverAfterNetwork, NETWORK_SETTLE_MS)
    }

    private val recoverAfterNetwork = Runnable {
        if (config == null || state == State.SETUP) return@Runnable
        if (registration == null || state == State.RECONNECTING) {
            // Skip the remaining backoff: cancel pending retries and the old heartbeat loop, register now.
            generation++
            retryAttempt = 0
            registration = null
            register()
        } else {
            // The page kept showing cached content; reload it to refresh data and reopen its event stream.
            lastAckAt = SystemClock.elapsedRealtime()
            webView?.reload()
        }
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
        ExitPin.update(this, reg.kiosk)
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
            val body = DeviceStatus.heartbeatBody(this, currentUrl, currentScreenId, uptime, KioskMode.current(this))
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
        ExitPin.update(this, ack.kiosk)
        ack.commands.forEach(::runNativeCommand)
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
        if (state == State.RECONNECTING) nextRetryAt = SystemClock.elapsedRealtime() + heartbeatIntervalMs
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
            .put("kioskMode", kioskMode.wire)
            .put("isDefaultHome", KioskMode.isDefaultHome(this))
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
            appendLine("Kiosk mode: ${describeMode(KioskMode.current(this@MainActivity))}")
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
            append(if (seconds > 0) "Retrying in ${seconds}s" else "Retrying…")
        }
    }

    private val tickRunnable = object : Runnable {
        override fun run() {
            renderOverlay()
            main.postDelayed(this, 1000)
        }
    }

    // ---- Exit menu + native commands ----------------------------------------------------

    @SuppressLint("ClickableViewAccessibility")
    private fun setupExitMenu() {
        exitMenu = findViewById(R.id.exit_menu)
        exitStatus = findViewById(R.id.exit_status)
        exitPinRow = findViewById(R.id.exit_pin_row)
        exitPin = findViewById(R.id.exit_pin)
        exitActions = findViewById(R.id.exit_actions)
        exitMessage = findViewById(R.id.exit_message)
        exitLeaveStrict = findViewById(R.id.exit_leave_strict)
        exitChooseHome = findViewById(R.id.exit_choose_home)

        val openAfterHold = Runnable { openExitMenu(requirePin = true) }
        findViewById<View>(R.id.exit_hotspot).setOnTouchListener { _, event ->
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> main.postDelayed(openAfterHold, EXIT_HOLD_MS)
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> main.removeCallbacks(openAfterHold)
            }
            true
        }

        findViewById<Button>(R.id.exit_pin_ok).setOnClickListener { checkPin() }
        exitPin.setOnEditorActionListener { _, actionId, event ->
            // Soft keyboard ✓ sends IME_ACTION_DONE; a hardware/adb Enter arrives as a key event instead.
            val enter = event?.keyCode == KeyEvent.KEYCODE_ENTER && event.action == KeyEvent.ACTION_DOWN
            if (actionId == EditorInfo.IME_ACTION_DONE || enter) checkPin()
            true
        }
        exitChooseHome.setOnClickListener { runNativeCommand("chooseHome") }
        findViewById<Button>(R.id.exit_settings).setOnClickListener { runNativeCommand("openSettings") }
        exitLeaveStrict.setOnClickListener {
            if (!leaveStrictArmed) {
                leaveStrictArmed = true
                exitLeaveStrict.text = "Tap again to leave strict mode"
            } else {
                runNativeCommand("exitStrictMode")
            }
        }
        findViewById<Button>(R.id.exit_reload).setOnClickListener {
            closeExitMenu()
            startSession()
        }
        findViewById<Button>(R.id.exit_close).setOnClickListener { closeExitMenu() }
    }

    private fun openExitMenu(requirePin: Boolean) {
        val mode = KioskMode.current(this)
        val pinRequired = requirePin && ExitPin.stored(this) != null
        leaveStrictArmed = false
        exitLeaveStrict.text = getString(R.string.exit_leave_strict)
        exitLeaveStrict.visibility = if (mode == KioskMode.Mode.STRICT) View.VISIBLE else View.GONE
        exitChooseHome.isEnabled = mode != KioskMode.Mode.STRICT
        exitStatus.text = "${describeMode(mode)} · Home app: ${if (KioskMode.isDefaultHome(this)) "ShowRunner" else "another app"}"
        exitMessage.text = if (mode == KioskMode.Mode.STRICT) "Strict mode locks Home. Leave strict mode to choose another Home app." else ""
        exitPin.setText("")
        exitPinRow.visibility = if (pinRequired) View.VISIBLE else View.GONE
        exitActions.visibility = if (pinRequired) View.GONE else View.VISIBLE
        exitMenu.visibility = View.VISIBLE
        exitMenu.bringToFront()
        if (pinRequired) {
            exitPin.requestFocus()
            getSystemService(InputMethodManager::class.java).showSoftInput(exitPin, InputMethodManager.SHOW_IMPLICIT)
        }
        main.removeCallbacks(autoCloseExitMenu)
        main.postDelayed(autoCloseExitMenu, EXIT_MENU_IDLE_MS)
    }

    private val autoCloseExitMenu = Runnable { closeExitMenu() }

    private fun closeExitMenu() {
        main.removeCallbacks(autoCloseExitMenu)
        getSystemService(InputMethodManager::class.java).hideSoftInputFromWindow(exitPin.windowToken, 0)
        exitMenu.visibility = View.GONE
        KioskMode.hideSystemBars(this)
    }

    private fun checkPin() {
        val hash = ExitPin.stored(this)
        if (hash == null || ExitPin.matches(hash, exitPin.text.toString())) {
            getSystemService(InputMethodManager::class.java).hideSoftInputFromWindow(exitPin.windowToken, 0)
            exitPinRow.visibility = View.GONE
            exitActions.visibility = View.VISIBLE
            exitMessage.text = exitMessage.text.takeIf { KioskMode.current(this) == KioskMode.Mode.STRICT } ?: ""
        } else {
            exitPin.setText("")
            exitMessage.text = "Wrong PIN"
        }
        main.removeCallbacks(autoCloseExitMenu)
        main.postDelayed(autoCloseExitMenu, EXIT_MENU_IDLE_MS)
    }

    /** Native kiosk actions, from the exit menu or dashboard commands in the heartbeat ack. */
    private fun runNativeCommand(command: String) {
        Log.i(TAG, "Kiosk command: $command")
        when (command) {
            "openExitMenu" -> openExitMenu(requirePin = false)
            "openSettings" -> {
                closeExitMenu()
                KioskMode.pauseLockTask(this)
                startActivity(Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }
            "chooseHome" -> {
                closeExitMenu()
                startActivity(Intent(Settings.ACTION_HOME_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }
            "exitStrictMode" -> {
                val ok = KioskMode.leaveStrictMode(this)
                kioskMode = KioskMode.apply(this)
                if (exitMenu.visibility == View.VISIBLE) openExitMenu(requirePin = false)
                exitMessage.text = if (ok) "Left strict mode. ShowRunner is no longer device owner." else "Couldn't leave strict mode; see the device log."
            }
            else -> Log.w(TAG, "Unknown kiosk command: $command")
        }
    }

    private fun describeMode(mode: KioskMode.Mode) = when (mode) {
        KioskMode.Mode.STRICT -> "Strict (device owner lock)"
        KioskMode.Mode.LAUNCHER -> "Launcher (default Home app)"
        KioskMode.Mode.IMMERSIVE -> "Full-screen (not the Home app)"
    }

    private fun describe(e: Exception): String = when (e) {
        is ServerClient.HttpException -> e.message ?: "HTTP ${e.status}"
        is java.net.UnknownHostException -> "unknown host"
        is java.net.ConnectException -> "connection refused"
        is java.net.SocketTimeoutException -> "timed out"
        else -> e.message ?: e.javaClass.simpleName
    }

    companion object {
        /** The live kiosk activity; a newer instance finishes the older one. */
        @Volatile private var activeInstance: WeakReference<MainActivity>? = null
        private const val TAG = "ShowRunner"
        private const val WEB_TAG = "ShowRunner.Web"
        private const val DEFAULT_HEARTBEAT_MS = 30_000L
        /** Show the reconnecting state after this long without a heartbeat ack. */
        private const val WATCHDOG_TIMEOUT_MS = 2 * 60_000L
        private const val EVENTS_DOWN_RELOAD_BEATS = 3
        private const val SETUP_POLL_MS = 5_000L
        private const val NETWORK_SETTLE_MS = 1_500L
        private const val EXIT_HOLD_MS = 3_000L
        private const val EXIT_MENU_IDLE_MS = 60_000L
        private val RETRY_BACKOFF_MS = longArrayOf(5_000, 10_000, 20_000, 40_000, 60_000)
    }
}

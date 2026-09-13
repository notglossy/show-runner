package com.notglossy.showrunner

import android.app.Activity
import android.provider.Settings
import android.view.WindowManager
import android.webkit.JavascriptInterface
import org.json.JSONObject

/**
 * Exposed to pages as `window.KioskNative` (and `kiosk.native` via the runtime).
 * Keep this surface small: every method is callable by any screen template.
 * Methods run on a WebView background thread.
 */
class NativeBridge(
    private val activity: Activity,
    private val infoProvider: () -> JSONObject,
    private val onReload: () -> Unit,
) {
    @Volatile private var windowBrightness: Float = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE

    /** JSON string: deviceId, model, androidVersion, appVersion, screen size, kioskMode, serverUrl, webViewVersion. */
    @JavascriptInterface
    fun getDeviceInfo(): String = infoProvider().toString()

    /** Current brightness 0.0-1.0 (the app's override if set, otherwise the system setting). */
    @JavascriptInterface
    fun getBrightness(): Float {
        if (windowBrightness >= 0f) return windowBrightness
        val system = Settings.System.getInt(activity.contentResolver, Settings.System.SCREEN_BRIGHTNESS, 128)
        return (system / 255f).coerceIn(0f, 1f)
    }

    /** Sets screen brightness for this app, 0.0-1.0. Pass a negative value to return to the system setting. */
    @JavascriptInterface
    fun setBrightness(value: Float) {
        val target = if (value < 0f || value.isNaN()) WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE else value.coerceIn(0.01f, 1f)
        windowBrightness = target
        activity.runOnUiThread {
            activity.window.attributes = activity.window.attributes.apply { screenBrightness = target }
        }
    }

    /** Reloads the current page. */
    @JavascriptInterface
    fun reload() {
        activity.runOnUiThread(onReload)
    }
}

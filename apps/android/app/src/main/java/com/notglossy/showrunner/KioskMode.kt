package com.notglossy.showrunner

import android.app.Activity
import android.app.ActivityManager
import android.app.KeyguardManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.BatteryManager
import android.provider.Settings
import android.util.Log
import android.view.WindowManager
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

/**
 * How the kiosk holds the screen:
 *  - LAUNCHER: ShowRunner is the default Home app (the normal setup). Home and boot return to it; the
 *    system bars stay hidden but can be swiped in, and the user can switch Home apps in Settings.
 *  - STRICT: opt-in device owner + lock task. Bars, Home, Recents and other apps are blocked. Always
 *    leavable from the exit menu or dashboard ([leaveStrictMode]); never needs a factory reset.
 *  - IMMERSIVE: neither (e.g. launched manually). Full-screen only.
 */
object KioskMode {
    private const val TAG = "ShowRunner.Kiosk"

    enum class Mode(val wire: String) { STRICT("strict"), LAUNCHER("launcher"), IMMERSIVE("immersive") }

    fun adminComponent(context: Context) = ComponentName(context, KioskDeviceAdminReceiver::class.java)

    fun isDeviceOwner(context: Context): Boolean =
        context.getSystemService(DevicePolicyManager::class.java).isDeviceOwnerApp(context.packageName)

    fun isDefaultHome(context: Context): Boolean {
        val home = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        val resolved = context.packageManager.resolveActivity(home, PackageManager.MATCH_DEFAULT_ONLY)
        return resolved?.activityInfo?.packageName == context.packageName
    }

    fun current(context: Context): Mode = when {
        isDeviceOwner(context) -> Mode.STRICT
        isDefaultHome(context) -> Mode.LAUNCHER
        else -> Mode.IMMERSIVE
    }

    /** Call from onResume. Idempotent. */
    fun apply(activity: Activity): Mode {
        activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        activity.setShowWhenLocked(true)
        activity.setTurnScreenOn(true)
        hideSystemBars(activity)

        if (!isDeviceOwner(activity)) {
            // Dismiss a swipe keyguard so the kiosk is usable after the screen wakes (secure lock screens stay).
            val keyguard = activity.getSystemService(KeyguardManager::class.java)
            if (keyguard.isKeyguardLocked && !keyguard.isKeyguardSecure) keyguard.requestDismissKeyguard(activity, null)
            return current(activity)
        }

        val dpm = activity.getSystemService(DevicePolicyManager::class.java)
        val admin = adminComponent(activity)
        runCatching {
            dpm.setLockTaskPackages(admin, arrayOf(activity.packageName))
            dpm.setLockTaskFeatures(admin, DevicePolicyManager.LOCK_TASK_FEATURE_NONE)
            dpm.setKeyguardDisabled(admin, true)
            dpm.setStatusBarDisabled(admin, true)
            val plugged = BatteryManager.BATTERY_PLUGGED_AC or BatteryManager.BATTERY_PLUGGED_USB or
                BatteryManager.BATTERY_PLUGGED_WIRELESS
            dpm.setGlobalSetting(admin, Settings.Global.STAY_ON_WHILE_PLUGGED_IN, plugged.toString())
            dpm.addPersistentPreferredActivity(admin, homeFilter(), ComponentName(activity, MainActivity::class.java))
        }.onFailure { Log.w(TAG, "Device owner policy setup failed", it) }

        if (!isLockTaskActive(activity)) {
            runCatching { activity.startLockTask() }.onFailure { Log.w(TAG, "startLockTask failed", it) }
        }
        return Mode.STRICT
    }

    fun isLockTaskActive(context: Context): Boolean =
        context.getSystemService(ActivityManager::class.java).lockTaskModeState != ActivityManager.LOCK_TASK_MODE_NONE

    /** Stops lock task so another activity (Settings) can open. The next [apply] re-locks in strict mode. */
    fun pauseLockTask(activity: Activity) {
        if (isLockTaskActive(activity)) runCatching { activity.stopLockTask() }.onFailure { Log.w(TAG, "stopLockTask failed", it) }
    }

    /**
     * Leaves strict mode for good: undoes the device owner policies and gives up device ownership, so the
     * device can be managed normally again. No factory reset. ShowRunner stays installed (and stays Home if
     * it is still the default Home app).
     */
    @Suppress("DEPRECATION") // clearDeviceOwnerApp is deprecated but remains the only way for a DPC to relinquish itself.
    fun leaveStrictMode(activity: Activity): Boolean {
        if (!isDeviceOwner(activity)) return true
        val dpm = activity.getSystemService(DevicePolicyManager::class.java)
        val admin = adminComponent(activity)
        pauseLockTask(activity)
        return runCatching {
            dpm.setStatusBarDisabled(admin, false)
            dpm.setKeyguardDisabled(admin, false)
            dpm.clearPackagePersistentPreferredActivities(admin, activity.packageName)
            dpm.setLockTaskPackages(admin, emptyArray())
            dpm.clearDeviceOwnerApp(activity.packageName)
            Log.i(TAG, "Left strict mode (device owner cleared)")
            true
        }.getOrElse {
            Log.e(TAG, "Leaving strict mode failed", it)
            false
        }
    }

    fun hideSystemBars(activity: Activity) {
        WindowCompat.setDecorFitsSystemWindows(activity.window, false)
        WindowCompat.getInsetsController(activity.window, activity.window.decorView).apply {
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            hide(WindowInsetsCompat.Type.systemBars())
        }
    }

    private fun homeFilter() = IntentFilter(Intent.ACTION_MAIN).apply {
        addCategory(Intent.CATEGORY_HOME)
        addCategory(Intent.CATEGORY_DEFAULT)
    }
}

package com.notglossy.showrunner

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Brings the kiosk back after boot (strict mode) or after an app update (strict or launcher mode).
 * In launcher mode Android starts the Home app on boot by itself, and if the user switched to another
 * Home app we deliberately don't take the screen back. Background starts are allowed for device owners
 * or with the SYSTEM_ALERT_WINDOW app op.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val mode = KioskMode.current(context)
        val start = when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED -> mode == KioskMode.Mode.STRICT
            Intent.ACTION_MY_PACKAGE_REPLACED -> mode != KioskMode.Mode.IMMERSIVE
            else -> false
        }
        Log.i("ShowRunner.Boot", "${intent.action}: mode=${mode.wire} start=$start")
        if (!start) return
        context.startActivity(
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
        )
    }
}

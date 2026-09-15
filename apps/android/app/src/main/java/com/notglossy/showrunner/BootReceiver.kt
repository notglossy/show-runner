package com.notglossy.showrunner

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Brings the kiosk to the front after boot or an app update, in strict or launcher mode.
 * Launcher mode needs this too: during Direct Boot Android starts a direct-boot-aware launcher
 * (e.g. Launcher3) and doesn't switch to ShowRunner after unlock, even though it is the default Home app.
 * If the user picked a different Home app (mode IMMERSIVE) we deliberately leave the screen alone.
 * Background starts are allowed for device owners or with the SYSTEM_ALERT_WINDOW app op.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val mode = KioskMode.current(context)
        val start = (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == Intent.ACTION_MY_PACKAGE_REPLACED) &&
            mode != KioskMode.Mode.IMMERSIVE
        Log.i("ShowRunner.Boot", "${intent.action}: mode=${mode.wire} start=$start")
        if (!start) return
        context.startActivity(
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
        )
    }
}

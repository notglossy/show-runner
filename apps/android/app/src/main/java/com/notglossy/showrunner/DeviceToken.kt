package com.notglossy.showrunner

import android.content.Context
import androidx.core.content.edit

/**
 * The per-device token from the last successful registration, kept so a reboot re-registers as the
 * same claimed display: the server only lets a claimed device re-register with its token (or the
 * shared secret, when the server has one). Stored with the server it belongs to.
 */
object DeviceToken {
    private const val PREFS = "showrunner_session"

    fun save(context: Context, serverUrl: String, token: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit {
            putString("serverUrl", serverUrl)
            putString("token", token)
        }
    }

    /** The stored token, or null when none is stored or it belongs to a different server. */
    fun load(context: Context, serverUrl: String): String? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return KioskLogic.usableToken(prefs.getString("serverUrl", null), prefs.getString("token", null), serverUrl)
    }

    fun clear(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit { clear() }
    }
}

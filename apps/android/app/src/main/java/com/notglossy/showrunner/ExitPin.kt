package com.notglossy.showrunner

import android.content.Context
import androidx.core.content.edit
import org.json.JSONObject
import java.security.MessageDigest

/** Salted PIN hash from the server (Settings → Kiosk exit menu), cached so the menu works offline. */
object ExitPin {
    private const val PREFS = "showrunner_exit_pin"

    data class Hash(val salt: String, val sha256: String)

    /** Applies the `kiosk.exitPin` value from a register/heartbeat reply: an object sets it, JSON null clears it. */
    fun update(context: Context, kiosk: JSONObject?) {
        if (kiosk == null || !kiosk.has("exitPin")) return
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val pin = kiosk.optJSONObject("exitPin")
        prefs.edit {
            if (pin == null) clear()
            else putString("salt", pin.optString("salt")).putString("sha256", pin.optString("sha256"))
        }
    }

    fun stored(context: Context): Hash? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val salt = prefs.getString("salt", null) ?: return null
        val hash = prefs.getString("sha256", null) ?: return null
        return Hash(salt, hash)
    }

    fun matches(hash: Hash, pin: String): Boolean {
        val digest = MessageDigest.getInstance("SHA-256").digest("${hash.salt}:$pin".toByteArray())
        val hex = digest.joinToString("") { "%02x".format(it) }
        return MessageDigest.isEqual(hex.toByteArray(), hash.sha256.lowercase().toByteArray())
    }
}

package com.notglossy.showrunner

import android.content.Context
import android.content.Intent
import android.os.Environment
import android.util.Log
import androidx.core.content.edit
import org.json.JSONObject
import java.io.File
import java.net.URI

/** Where the app finds its server. Set via [ConfigStore.CONFIG_FILE] or `am start` extras. */
data class KioskConfig(
    /** Server origin without a trailing slash, e.g. `http://192.168.1.34:3000`. */
    val serverUrl: String,
    val sharedSecret: String,
    val source: Source,
) {
    enum class Source { FILE, INTENT }
}

sealed interface ConfigResult {
    data class Ready(val config: KioskConfig) : ConfigResult
    data class Missing(val problems: List<String>) : ConfigResult
}

/**
 * Config sources, most recently written wins:
 *  - `/sdcard/showrunner/config.json`: `{"serverUrl": "http://host:3000", "sharedSecret": "..."}`
 *  - intent extras `serverUrl` + `sharedSecret` (persisted to app preferences)
 */
object ConfigStore {
    private const val TAG = "ShowRunner.Config"
    private const val PREFS = "showrunner_config"
    const val EXTRA_SERVER_URL = "serverUrl"
    const val EXTRA_SHARED_SECRET = "sharedSecret"

    @Suppress("DEPRECATION") // getExternalStorageDirectory is the documented /sdcard path; access is via MANAGE_EXTERNAL_STORAGE.
    val CONFIG_FILE: File get() = File(Environment.getExternalStorageDirectory(), "showrunner/config.json")

    fun hasFileAccess(): Boolean = Environment.isExternalStorageManager()

    /** Saves config passed as intent extras. Returns true if the intent carried a valid config. */
    fun saveFromIntent(context: Context, intent: Intent?): Boolean {
        val url = intent?.getStringExtra(EXTRA_SERVER_URL) ?: return false
        val secret = intent.getStringExtra(EXTRA_SHARED_SECRET) ?: return false
        val normalized = normalizeUrl(url) ?: run {
            Log.w(TAG, "Ignoring intent config: invalid serverUrl '$url'")
            return false
        }
        if (secret.isBlank()) return false
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit {
            putString(EXTRA_SERVER_URL, normalized)
            putString(EXTRA_SHARED_SECRET, secret)
            putLong("updatedAt", System.currentTimeMillis())
        }
        Log.i(TAG, "Saved config from intent: $normalized")
        return true
    }

    fun load(context: Context): ConfigResult {
        val problems = mutableListOf<String>()
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val fromIntent = prefs.getString(EXTRA_SERVER_URL, null)?.let { url ->
            prefs.getString(EXTRA_SHARED_SECRET, null)?.let { KioskConfig(url, it, KioskConfig.Source.INTENT) }
        }
        val intentUpdatedAt = prefs.getLong("updatedAt", 0L)

        var fromFile: KioskConfig? = null
        val file = CONFIG_FILE
        if (!hasFileAccess()) {
            problems += "All-files access not granted, so ${file.path} can't be read."
        } else if (file.isFile) {
            try {
                fromFile = parse(file.readText())
                if (fromFile == null) problems += "${file.path} must contain serverUrl (http/https) and sharedSecret."
            } catch (e: Exception) {
                problems += "Couldn't read ${file.path}: ${e.message}"
            }
        } else {
            problems += "${file.path} not found."
        }

        val chosen = when {
            fromFile != null && fromIntent != null -> if (file.lastModified() >= intentUpdatedAt) fromFile else fromIntent
            else -> fromFile ?: fromIntent
        }
        return if (chosen != null) ConfigResult.Ready(chosen) else ConfigResult.Missing(problems)
    }

    fun parse(json: String): KioskConfig? {
        val obj = try {
            JSONObject(json)
        } catch (_: Exception) {
            return null
        }
        val url = normalizeUrl(obj.optString("serverUrl")) ?: return null
        val secret = obj.optString("sharedSecret").takeIf { it.isNotBlank() } ?: return null
        return KioskConfig(url, secret, KioskConfig.Source.FILE)
    }

    /** Accepts http(s)://host[:port][/], returns it without the trailing slash, or null. */
    fun normalizeUrl(raw: String): String? {
        val trimmed = raw.trim().trimEnd('/')
        return try {
            val uri = URI(trimmed)
            if ((uri.scheme == "http" || uri.scheme == "https") && !uri.host.isNullOrBlank()) trimmed else null
        } catch (_: Exception) {
            null
        }
    }
}

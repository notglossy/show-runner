package com.notglossy.showrunner

import android.app.Activity
import android.content.Context
import android.os.Build
import android.util.Log
import androidx.core.content.edit
import java.io.File
import java.util.UUID

data class DeviceInfo(
    val deviceId: String,
    val model: String,
    val androidVersion: String,
    val appVersion: String,
    val screenWidth: Int,
    val screenHeight: Int,
)

object DeviceIdentity {
    private const val PREFS = "showrunner_device"

    /** Copy of the ID next to config.json, so reinstalling the app (e.g. switching signing keys) keeps the device's identity. */
    private val backupFile: File get() = File(ConfigStore.CONFIG_FILE.parentFile, "device-id")

    /** Generated once on first run; restored from /sdcard/showrunner/device-id after a reinstall. */
    fun deviceId(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val id = prefs.getString("deviceId", null)
            ?: readBackup()?.also { Log.i("ShowRunner", "Restored device ID from ${backupFile.path}") }
            ?: UUID.randomUUID().toString()
        if (prefs.getString("deviceId", null) != id) prefs.edit { putString("deviceId", id) }
        writeBackup(id)
        return id
    }

    private fun readBackup(): String? = runCatching {
        if (!ConfigStore.hasFileAccess() || !backupFile.isFile) return null
        backupFile.readText().trim().takeIf { runCatching { UUID.fromString(it) }.isSuccess }
    }.getOrNull()

    private fun writeBackup(id: String) {
        if (!ConfigStore.hasFileAccess()) return
        runCatching {
            if (backupFile.isFile && backupFile.readText().trim() == id) return
            backupFile.parentFile?.mkdirs()
            backupFile.writeText(id)
        }.onFailure { Log.w("ShowRunner", "Couldn't write ${backupFile.path}", it) }
    }

    fun info(activity: Activity): DeviceInfo {
        val bounds = activity.windowManager.maximumWindowMetrics.bounds
        return DeviceInfo(
            deviceId = deviceId(activity),
            model = Build.MODEL.take(100),
            androidVersion = Build.VERSION.RELEASE.take(32),
            appVersion = BuildConfig.VERSION_NAME,
            screenWidth = maxOf(bounds.width(), bounds.height()),
            screenHeight = minOf(bounds.width(), bounds.height()),
        )
    }
}

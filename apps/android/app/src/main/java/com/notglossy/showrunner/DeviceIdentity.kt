package com.notglossy.showrunner

import android.app.Activity
import android.content.Context
import android.os.Build
import androidx.core.content.edit
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

    /** Generated once on first run and kept for the life of the install. */
    fun deviceId(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.getString("deviceId", null)?.let { return it }
        val id = UUID.randomUUID().toString()
        prefs.edit { putString("deviceId", id) }
        return id
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

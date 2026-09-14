package com.notglossy.showrunner

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.wifi.WifiManager
import android.os.BatteryManager
import org.json.JSONObject

/** Builds the heartbeat body (docs/api.md). */
object DeviceStatus {
    fun heartbeatBody(context: Context, currentUrl: String?, currentScreenId: String?, uptimeSeconds: Long, kioskMode: KioskMode.Mode): JSONObject {
        val body = JSONObject()
        body.put("battery", battery(context) ?: JSONObject.NULL)
        body.put("wifi", wifi(context) ?: JSONObject.NULL)
        body.put("currentUrl", currentUrl?.take(2048) ?: JSONObject.NULL)
        body.put("currentScreenId", currentScreenId?.take(100) ?: JSONObject.NULL)
        body.put("uptimeSeconds", uptimeSeconds)
        body.put("kioskMode", kioskMode.wire)
        body.put("isDefaultHome", KioskMode.isDefaultHome(context))
        return body
    }

    private fun battery(context: Context): JSONObject? {
        val intent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED)) ?: return null
        if (!intent.getBooleanExtra(BatteryManager.EXTRA_PRESENT, false)) return null
        val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
        val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, 100)
        if (level < 0 || scale <= 0) return null
        val status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, BatteryManager.BATTERY_STATUS_UNKNOWN)
        val charging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL
        return JSONObject().put("level", (level * 100 / scale).coerceIn(0, 100)).put("charging", charging)
    }

    @Suppress("DEPRECATION") // connectionInfo is the simplest way to read RSSI on API 30 without a network callback.
    private fun wifi(context: Context): JSONObject? {
        val wifi = context.applicationContext.getSystemService(WifiManager::class.java) ?: return null
        val info = wifi.connectionInfo ?: return null
        if (info.networkId == -1) return null
        val ssid = info.ssid?.removeSurrounding("\"")?.takeUnless { it == WifiManager.UNKNOWN_SSID || it.isBlank() }
        return JSONObject()
            .put("rssi", info.rssi.coerceIn(-127, 0))
            .put("ssid", ssid?.take(64) ?: JSONObject.NULL)
            .put("linkSpeedMbps", info.linkSpeed.coerceAtLeast(0))
    }
}

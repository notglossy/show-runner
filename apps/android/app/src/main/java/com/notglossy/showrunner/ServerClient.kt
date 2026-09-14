package com.notglossy.showrunner

import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/** Minimal JSON-over-HTTP client for the device-facing API (docs/api.md). Call off the main thread. */
class ServerClient(private val origin: String) {

    class HttpException(val status: Int, message: String) : IOException("HTTP $status: $message")

    data class Registration(
        val deviceId: String,
        val token: String,
        val cookieName: String,
        val cookieValue: String,
        val claimed: Boolean,
        val pairingCode: String?,
        val pageUrl: String,
        val heartbeatIntervalSeconds: Int,
        /** `kiosk` block: `exitPin` hash (or null). */
        val kiosk: JSONObject?,
    )

    data class HeartbeatAck(
        val claimed: Boolean,
        val currentScreenId: String?,
        val eventsConnected: Boolean,
        val heartbeatIntervalSeconds: Int,
        val kiosk: JSONObject?,
        /** Native kiosk commands queued in the dashboard: openExitMenu, openSettings, exitStrictMode. */
        val commands: List<String>,
    )

    fun register(sharedSecret: String, info: DeviceInfo): Registration {
        val body = JSONObject()
            .put("deviceId", info.deviceId)
            .put("model", info.model)
            .put("androidVersion", info.androidVersion)
            .put("appVersion", info.appVersion)
            .put("screenWidth", info.screenWidth)
            .put("screenHeight", info.screenHeight)
        val json = post("/api/devices/register", body, mapOf("X-Kiosk-Secret" to sharedSecret))
        val cookie = json.getJSONObject("cookie")
        return Registration(
            deviceId = json.getString("deviceId"),
            token = json.getString("token"),
            cookieName = cookie.getString("name"),
            cookieValue = cookie.getString("value"),
            claimed = json.getBoolean("claimed"),
            pairingCode = json.optStringOrNull("pairingCode"),
            pageUrl = json.getString("pageUrl"),
            heartbeatIntervalSeconds = json.optInt("heartbeatIntervalSeconds", 30),
            kiosk = json.optJSONObject("kiosk"),
        )
    }

    fun heartbeat(deviceId: String, token: String, body: JSONObject): HeartbeatAck {
        val json = post("/api/devices/$deviceId/heartbeat", body, mapOf("Authorization" to "Bearer $token"))
        return HeartbeatAck(
            claimed = json.optBoolean("claimed"),
            currentScreenId = json.optStringOrNull("currentScreenId"),
            eventsConnected = json.optBoolean("eventsConnected"),
            heartbeatIntervalSeconds = json.optInt("heartbeatIntervalSeconds", 30),
            kiosk = json.optJSONObject("kiosk"),
            commands = json.optJSONObject("kiosk")?.optJSONArray("commands")?.let { arr ->
                (0 until arr.length()).mapNotNull { arr.optString(it).takeIf(String::isNotBlank) }
            } ?: emptyList(),
        )
    }

    private fun post(path: String, body: JSONObject, headers: Map<String, String>): JSONObject {
        val conn = URL(origin + path).openConnection() as HttpURLConnection
        try {
            conn.requestMethod = "POST"
            conn.connectTimeout = 10_000
            conn.readTimeout = 15_000
            conn.doOutput = true
            conn.useCaches = false
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("Accept", "application/json")
            headers.forEach { (k, v) -> conn.setRequestProperty(k, v) }
            conn.outputStream.use { it.write(body.toString().toByteArray()) }
            val status = conn.responseCode
            val stream = if (status in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (status !in 200..299) {
                val message = runCatching { JSONObject(text).getJSONObject("error").getString("message") }.getOrNull()
                throw HttpException(status, message ?: text.take(200))
            }
            return JSONObject(text)
        } finally {
            conn.disconnect()
        }
    }
}

private fun JSONObject.optStringOrNull(key: String): String? = if (isNull(key)) null else optString(key)

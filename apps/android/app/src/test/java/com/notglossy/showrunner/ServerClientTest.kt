package com.notglossy.showrunner

import com.sun.net.httpserver.HttpServer
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test
import java.net.InetSocketAddress

/** Exercises ServerClient against an in-process HTTP server that mimics the ShowRunner device API. */
class ServerClientTest {
    private lateinit var server: HttpServer
    private lateinit var origin: String

    private data class Recorded(val method: String, val path: String, val headers: Map<String, String>, val body: String)

    private val requests = mutableListOf<Recorded>()
    private var respond: (path: String) -> Pair<Int, String> = { 404 to "{}" }

    @Before
    fun startServer() {
        server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/") { exchange ->
            val headers = exchange.requestHeaders.entries.associate { (k, v) -> k.lowercase() to v.first() }
            val body = exchange.requestBody.bufferedReader().readText()
            requests += Recorded(exchange.requestMethod, exchange.requestURI.path, headers, body)
            val (status, response) = respond(exchange.requestURI.path)
            val bytes = response.toByteArray()
            exchange.responseHeaders.add("Content-Type", "application/json")
            exchange.sendResponseHeaders(status, bytes.size.toLong())
            exchange.responseBody.use { it.write(bytes) }
        }
        server.start()
        origin = "http://127.0.0.1:${server.address.port}"
    }

    @After
    fun stopServer() = server.stop(0)

    private val info = DeviceInfo("b0fdf118-e71b-4c48-8d1f-3cfce530446c", "Echo Show 8", "11", "0.2.0", 1280, 800)

    @Test
    fun `register sends the shared secret and device info, and parses the reply`() {
        respond = {
            200 to """{"deviceId":"b0fdf118-e71b-4c48-8d1f-3cfce530446c","token":"tok","cookie":{"name":"showrunner_device","value":"b0fdf118-e71b-4c48-8d1f-3cfce530446c.tok"},
                "claimed":false,"name":null,"pairingCode":"BGAQ6G","pageUrl":"/device/b0fdf118-e71b-4c48-8d1f-3cfce530446c",
                "heartbeatIntervalSeconds":30,"kiosk":{"exitPin":null}}"""
        }
        val reg = ServerClient(origin).register("secret", info)

        val request = requests.single()
        assertEquals("POST", request.method)
        assertEquals("/api/devices/register", request.path)
        assertEquals("secret", request.headers["x-kiosk-secret"])
        val sent = JSONObject(request.body)
        assertEquals(info.deviceId, sent.getString("deviceId"))
        assertEquals(1280, sent.getInt("screenWidth"))

        assertEquals("tok", reg.token)
        assertEquals("showrunner_device", reg.cookieName)
        assertFalse(reg.claimed)
        assertEquals("BGAQ6G", reg.pairingCode)
        assertEquals("/device/${info.deviceId}", reg.pageUrl)
        assertTrue(reg.kiosk!!.isNull("exitPin"))
    }

    @Test
    fun `claimed registration has no pairing code`() {
        respond = {
            200 to """{"deviceId":"d","token":"t","cookie":{"name":"n","value":"v"},"claimed":true,"name":"Kitchen","pairingCode":null,"pageUrl":"/device/d"}"""
        }
        val reg = ServerClient(origin).register("secret", info)
        assertTrue(reg.claimed)
        assertNull(reg.pairingCode)
        assertEquals(30, reg.heartbeatIntervalSeconds)
    }

    @Test
    fun `heartbeat sends the bearer token and parses kiosk commands and PIN hash`() {
        respond = {
            200 to """{"ok":true,"serverTime":1,"claimed":true,"currentScreenId":"builtin-clock","eventsConnected":false,"heartbeatIntervalSeconds":45,
                "kiosk":{"exitPin":{"salt":"ab","sha256":"cd"},"commands":["openExitMenu","openSettings"]}}"""
        }
        val body = JSONObject().put("kioskMode", "launcher").put("isDefaultHome", true)
        val ack = ServerClient(origin).heartbeat("dev-1", "tok", body)

        val request = requests.single()
        assertEquals("/api/devices/dev-1/heartbeat", request.path)
        assertEquals("Bearer tok", request.headers["authorization"])
        assertEquals("launcher", JSONObject(request.body).getString("kioskMode"))

        assertEquals("builtin-clock", ack.currentScreenId)
        assertFalse(ack.eventsConnected)
        assertEquals(45, ack.heartbeatIntervalSeconds)
        assertEquals(listOf("openExitMenu", "openSettings"), ack.commands)
        assertEquals("ab", ack.kiosk!!.getJSONObject("exitPin").getString("salt"))
    }

    @Test
    fun `heartbeat from an older server without a kiosk block still parses`() {
        respond = { 200 to """{"ok":true,"claimed":true,"currentScreenId":null,"eventsConnected":true,"heartbeatIntervalSeconds":30}""" }
        val ack = ServerClient(origin).heartbeat("dev-1", "tok", JSONObject())
        assertNull(ack.currentScreenId)
        assertEquals(emptyList<String>(), ack.commands)
        assertNull(ack.kiosk)
    }

    @Test
    fun `API errors surface the status and the server's message`() {
        respond = { 401 to """{"error":{"code":"unauthorized","message":"Missing or invalid device token"}}""" }
        try {
            ServerClient(origin).heartbeat("dev-1", "stale", JSONObject())
            fail("expected HttpException")
        } catch (e: ServerClient.HttpException) {
            assertEquals(401, e.status)
            assertEquals("HTTP 401: Missing or invalid device token", e.message)
        }
    }

    @Test
    fun `non-JSON error bodies are still reported`() {
        respond = { 502 to "Bad Gateway" }
        try {
            ServerClient(origin).register("secret", info)
            fail("expected HttpException")
        } catch (e: ServerClient.HttpException) {
            assertEquals(502, e.status)
            assertTrue(e.message!!.contains("Bad Gateway"))
        }
    }
}

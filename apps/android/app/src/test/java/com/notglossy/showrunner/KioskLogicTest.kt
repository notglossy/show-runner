package com.notglossy.showrunner

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class KioskLogicTest {
    @Test
    fun `retry backoff doubles then caps at 60 seconds`() {
        assertEquals(listOf(5_000L, 10_000L, 20_000L, 40_000L, 60_000L, 60_000L, 60_000L), (0..6).map(KioskLogic::retryDelayMs))
        assertEquals(5_000L, KioskLogic.retryDelayMs(-3))
    }

    @Test
    fun `heartbeat interval is clamped to 5-300 seconds`() {
        assertEquals(30_000L, KioskLogic.heartbeatIntervalMs(30))
        assertEquals(5_000L, KioskLogic.heartbeatIntervalMs(0))
        assertEquals(300_000L, KioskLogic.heartbeatIntervalMs(86_400))
    }

    @Test
    fun `network callback right after registering the listener is ignored`() {
        assertFalse(KioskLogic.shouldRecoverOnNetwork(lostForMs = 0, registered = true, reconnecting = false))
    }

    @Test
    fun `recovers after a drop, while unregistered, or while reconnecting`() {
        assertTrue(KioskLogic.shouldRecoverOnNetwork(lostForMs = 12_000, registered = true, reconnecting = false))
        assertTrue(KioskLogic.shouldRecoverOnNetwork(lostForMs = 0, registered = false, reconnecting = false))
        assertTrue(KioskLogic.shouldRecoverOnNetwork(lostForMs = 0, registered = true, reconnecting = true))
    }

    @Test
    fun `boot and update bring the kiosk forward unless another Home app was chosen`() {
        for (action in listOf(KioskLogic.ACTION_BOOT_COMPLETED, KioskLogic.ACTION_MY_PACKAGE_REPLACED)) {
            assertTrue(KioskLogic.shouldStartOnBroadcast(action, KioskMode.Mode.LAUNCHER))
            assertTrue(KioskLogic.shouldStartOnBroadcast(action, KioskMode.Mode.STRICT))
            assertFalse(KioskLogic.shouldStartOnBroadcast(action, KioskMode.Mode.IMMERSIVE))
        }
        assertFalse(KioskLogic.shouldStartOnBroadcast("android.intent.action.SCREEN_ON", KioskMode.Mode.STRICT))
        assertFalse(KioskLogic.shouldStartOnBroadcast(null, KioskMode.Mode.LAUNCHER))
    }

    @Test
    fun `parses the screen id returned by evaluateJavascript`() {
        assertEquals("builtin-clock", KioskLogic.parseScreenId("\"builtin-clock\""))
        assertNull(KioskLogic.parseScreenId("null"))
        assertNull(KioskLogic.parseScreenId(null))
        assertNull(KioskLogic.parseScreenId("\"\""))
        assertNull(KioskLogic.parseScreenId(""))
    }
}

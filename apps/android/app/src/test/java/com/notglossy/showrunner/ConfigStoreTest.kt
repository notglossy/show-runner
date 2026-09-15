package com.notglossy.showrunner

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ConfigStoreTest {
    @Test
    fun `normalizes http and https server URLs`() {
        assertEquals("http://192.168.1.16:3000", ConfigStore.normalizeUrl("http://192.168.1.16:3000/"))
        assertEquals("https://kiosk.example.com", ConfigStore.normalizeUrl("  https://kiosk.example.com//  "))
        assertEquals("http://pendar.lahey.potter.haus:3000", ConfigStore.normalizeUrl("http://pendar.lahey.potter.haus:3000"))
    }

    @Test
    fun `rejects URLs the WebView can't use as a server origin`() {
        for (bad in listOf("", "192.168.1.16:3000", "ftp://host", "http://", "file:///sdcard/x", "not a url", "javascript:alert(1)")) {
            assertNull(bad, ConfigStore.normalizeUrl(bad))
        }
    }

    @Test
    fun `parses a valid config file`() {
        val config = ConfigStore.parse("""{ "serverUrl": "http://192.168.1.16:3000/", "sharedSecret": "s3cret" }""")!!
        assertEquals("http://192.168.1.16:3000", config.serverUrl)
        assertEquals("s3cret", config.sharedSecret)
        assertEquals(KioskConfig.Source.FILE, config.source)
    }

    @Test
    fun `rejects incomplete or malformed config files`() {
        assertNull(ConfigStore.parse("""{ "serverUrl": "http://host:3000" }"""))
        assertNull(ConfigStore.parse("""{ "serverUrl": "http://host:3000", "sharedSecret": "   " }"""))
        assertNull(ConfigStore.parse("""{ "serverUrl": "host:3000", "sharedSecret": "x" }"""))
        assertNull(ConfigStore.parse("""{ "sharedSecret": "x" }"""))
        assertNull(ConfigStore.parse("not json"))
        assertNull(ConfigStore.parse(""))
    }
}

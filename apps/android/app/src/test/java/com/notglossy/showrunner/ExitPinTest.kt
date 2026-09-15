package com.notglossy.showrunner

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ExitPinTest {
    // Produced by the server's formula (apps/server lib/settings/service.ts: sha256(`${salt}:${pin}`) as hex).
    private val serverHash = ExitPin.Hash(
        salt = "0123456789abcdef0123456789abcdef",
        sha256 = "22e125a4dd874b604e1caa86850f33ac792bad996a1fdbc1afea2e190ef18464",
    )

    @Test
    fun `accepts the PIN the server hashed`() {
        assertTrue(ExitPin.matches(serverHash, "2468"))
    }

    @Test
    fun `rejects other PINs`() {
        for (pin in listOf("", "246", "24680", "8642", "2469", " 2468")) assertFalse(pin, ExitPin.matches(serverHash, pin))
    }

    @Test
    fun `hash comparison ignores hex case and depends on the salt`() {
        assertTrue(ExitPin.matches(serverHash.copy(sha256 = serverHash.sha256.uppercase()), "2468"))
        assertFalse(ExitPin.matches(serverHash.copy(salt = "ffffffffffffffffffffffffffffffff"), "2468"))
    }
}

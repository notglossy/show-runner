package com.notglossy.showrunner

/** Pure decisions used by the activity and receivers, kept free of Android types so they're unit-testable. */
object KioskLogic {
    /** Delay before registration retry number `attempt` (0-based): 5, 10, 20, 40, then 60 s. */
    val RETRY_BACKOFF_MS = longArrayOf(5_000, 10_000, 20_000, 40_000, 60_000)

    fun retryDelayMs(attempt: Int): Long = RETRY_BACKOFF_MS[attempt.coerceIn(0, RETRY_BACKOFF_MS.lastIndex)]

    /** Server-provided heartbeat interval, clamped to 5-300 s, in milliseconds. */
    fun heartbeatIntervalMs(serverSeconds: Int): Long = serverSeconds.coerceIn(5, 300) * 1000L

    /**
     * Whether a "network available" callback should trigger recovery. The callback that fires right after
     * registering the listener (never lost, already registered, not reconnecting) is ignored.
     */
    fun shouldRecoverOnNetwork(lostForMs: Long, registered: Boolean, reconnecting: Boolean): Boolean =
        lostForMs > 0L || !registered || reconnecting

    /** Whether the boot/update receiver should bring the kiosk forward. Never when the user chose another Home app. */
    fun shouldStartOnBroadcast(action: String?, mode: KioskMode.Mode): Boolean =
        (action == ACTION_BOOT_COMPLETED || action == ACTION_MY_PACKAGE_REPLACED) && mode != KioskMode.Mode.IMMERSIVE

    /** Parses the JSON result of `evaluateJavascript("window.kiosk ? window.kiosk.screenId : null")`. */
    fun parseScreenId(jsResult: String?): String? =
        jsResult?.takeUnless { it == "null" || it.isBlank() }?.removeSurrounding("\"")?.takeIf { it.isNotEmpty() }

    const val ACTION_BOOT_COMPLETED = "android.intent.action.BOOT_COMPLETED"
    const val ACTION_MY_PACKAGE_REPLACED = "android.intent.action.MY_PACKAGE_REPLACED"
}

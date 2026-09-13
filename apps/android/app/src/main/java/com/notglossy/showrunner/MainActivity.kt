package com.notglossy.showrunner

import android.app.Activity
import android.os.Bundle
import android.view.Gravity
import android.widget.TextView

/** Phase 0 placeholder. The kiosk WebView shell lands in Phase 2. */
class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(
            TextView(this).apply {
                text = "ShowRunner ${BuildConfig.VERSION_NAME}"
                textSize = 48f
                gravity = Gravity.CENTER
            },
        )
    }
}

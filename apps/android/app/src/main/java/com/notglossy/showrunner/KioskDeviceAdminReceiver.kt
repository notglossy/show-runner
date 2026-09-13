package com.notglossy.showrunner

import android.app.admin.DeviceAdminReceiver

/**
 * Device admin component. Make the app device owner once with:
 *   adb shell dpm set-device-owner com.notglossy.showrunner/.KioskDeviceAdminReceiver
 * which enables lock task mode, keyguard suppression and keep-awake (see [KioskMode]).
 */
class KioskDeviceAdminReceiver : DeviceAdminReceiver()

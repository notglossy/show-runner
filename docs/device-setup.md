# Device setup — Echo Show 8 (2nd gen, "crown")

Everything that has to be done on or to the device lives here. If it isn't written down
here, it isn't part of the setup.

## Known device facts

Collected 2026-09-13 from the development unit.

| Item | Value | How to check |
|---|---|---|
| ROM | LineageOS 18.1 UNOFFICIAL `crown`, Android 11 (API 30), `userdebug` | `adb shell getprop ro.lineage.version` |
| Screen | 1280x800 physical, density 213 | `adb shell wm size; adb shell wm density` |
| WebView | `com.android.webview` **139.0.7258.143** (AOSP, not Google's) | `adb shell dumpsys webviewupdate` |
| Google Play Services | Not assumed / not used | — |
| Accounts | 0 (required for `dpm set-device-owner`) | `adb shell dumpsys account \| head` |
| Device owner | none | `adb shell dumpsys device_policy \| grep -i owner` |
| Root | No `su`; "Rooted debugging" (`adb root`) available in Developer options | `adb root` |
| Launchers installed | Nova (`com.teslacoilsw.launcher`), Launcher3 | `adb shell pm list packages \| grep launcher` |
| Screen timeout | 60s, stay-awake off | `adb shell settings get system screen_off_timeout` |

Notes:
- `dpm list-owners` does **not** exist on Android 11; use `dumpsys device_policy`.
- A lock screen (swipe keyguard, no PIN) appears after screen-off. The kiosk handles this
  in Phase 2. To dismiss manually: `adb shell input keyevent KEYCODE_WAKEUP && adb shell wm dismiss-keyguard`.
- Wi-Fi ping is 5–30 ms while awake, but was 100–2000 ms while the screen was off
  (Wi-Fi power save). Keep the screen on and use generous watchdog timeouts.

## 1. Enable adb over the network (one time)

1. Settings → About → tap **Build number** 7 times to unlock Developer options.
2. Settings → System → Developer options:
   - **USB debugging**: on.
   - **Rooted debugging**: on (needed once, for step 4).
3. Connect USB once and accept the **"Allow USB debugging?"** RSA prompt on the device
   (tick "Always allow from this computer").
4. Make adb listen on TCP 5555, persistently across reboots:
   ```sh
   adb root
   adb shell setprop persist.adb.tcp.port 5555
   adb unroot
   adb tcpip 5555
   ```
5. Unplug and connect over Wi-Fi (accept the RSA prompt again if shown):
   ```sh
   adb connect 192.168.1.203:5555
   adb devices -l
   ```

> Android 11's **Wireless debugging** toggle is a different mechanism (pairing code, random
> port, TLS). Don't use it for this project; scripts expect the fixed `:5555` port.

The development unit is at `192.168.1.203` (DHCP reservation recommended).
Scripts read the target from `ANDROID_SERIAL` (default `192.168.1.203:5555`).

If `adb` is not on your PATH it lives at `~/Library/Android/sdk/platform-tools/adb` on macOS.

## 2. Install the app

_Written in Phase 2 (`scripts/install.sh`)._

## 3. Configure the server URL and secret

_Written in Phase 2._ Planned: `/sdcard/showkiosk/config.json`, which requires granting
all-files access once:

```sh
adb shell appops set com.notglossy.showrunner MANAGE_EXTERNAL_STORAGE allow
```

## 4. Kiosk lock (device owner)

_Written in Phase 2._ Planned command (requires **zero accounts** on the device):

```sh
adb shell dpm set-device-owner com.notglossy.showrunner/.KioskDeviceAdminReceiver
```

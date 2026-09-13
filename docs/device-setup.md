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

## Verified on the device (Phase 2, 2026-09-13)

- **Viewport.** The WebView lays screens out at 1280×800 CSS px (scale 0.751), matching the desktop
  preview. This needs `useWideViewPort` + `loadWithOverviewMode` in the shell **and** a viewport meta
  of `width=1280` *without* `initial-scale` (with `initial-scale=1` it renders at 961×601 and overflows).
- **Fonts.** Roboto thin weights render; ShowRunner's self-hosted web fonts load from the LAN server.
- **Wi-Fi.** With the kiosk in the foreground (screen on, low-latency Wi-Fi lock held) pings from the
  LAN are ~5–20 ms. While the screen dozes they rise to 100–2000 ms.
- **adb over Wi-Fi is fragile for big transfers.** A stalled `adb install` over the network kept the
  adb server pushing data and made the Echo's HTTP connections take 5–20 s. Install APKs over
  **USB**, or `adb disconnect 192.168.1.203:5555` if a network transfer hangs.
- **Kiosk lock.** As device owner: Home, Recents and launching other apps are blocked (lock task),
  no keyguard after sleep/wake, and the app restarts locked after reboot (~45 s to screen).

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

From the repo root (builds a debug APK with Android Studio's JDK if `JAVA_HOME` isn't set):

```sh
# USB is more reliable for the 7 MB APK; find the serial with `adb devices`
scripts/install.sh --serial <usb-serial> \
  --server http://<server-lan-ip>:3000 --secret "$DEVICE_SHARED_SECRET" \
  --device-owner
```

What it does, step by step (run these by hand if you prefer):

```sh
PKG=com.notglossy.showrunner
cd apps/android && ./gradlew assembleDebug && cd -          # add -PshowrunnerLauncher=true for HOME
adb install -r -t apps/android/app/build/outputs/apk/debug/app-debug.apk   # -t: debug builds are testOnly
adb shell appops set $PKG MANAGE_EXTERNAL_STORAGE allow     # read /sdcard/showrunner/config.json
adb shell appops set $PKG SYSTEM_ALERT_WINDOW allow         # boot auto-start when not device owner
adb shell mkdir -p /sdcard/showrunner
adb push config.json /sdcard/showrunner/config.json         # step 3
adb shell dpm set-device-owner $PKG/.KioskDeviceAdminReceiver   # step 4
adb shell am start -n $PKG/.MainActivity
```

Logs: `adb logcat -s ShowRunner ShowRunner.Web ShowRunner.Kiosk ShowRunner.Config ShowRunner.Boot`

## 3. Configure the server URL and secret

Without config the app shows a setup screen (device ID, kiosk mode, both options below) and checks
again every 5 seconds, so pushing a config file is enough; no restart needed.

**Option 1: config file** (needs the `MANAGE_EXTERNAL_STORAGE` app op from step 2):

```json
{ "serverUrl": "http://192.168.1.34:3000", "sharedSecret": "<DEVICE_SHARED_SECRET>" }
```

```sh
adb shell mkdir -p /sdcard/showrunner
adb push config.json /sdcard/showrunner/config.json
```

**Option 2: intent extras** (stored in app preferences; works on a running app too):

```sh
adb shell am start -n com.notglossy.showrunner/.MainActivity \
  --es serverUrl http://192.168.1.34:3000 --es sharedSecret <DEVICE_SHARED_SECRET>
```

If both exist, whichever was written most recently wins. `serverUrl` must be `http://` or
`https://` (a trailing slash is ignored). Use HTTPS once the server is behind a TLS proxy; plain
HTTP is currently allowed by `res/xml/network_security_config.xml`.

## 4. Kiosk lock (device owner)

Requires **zero accounts** on the device (`adb shell dumpsys account | head` → `Accounts: 0`).

```sh
adb shell dpm set-device-owner com.notglossy.showrunner/.KioskDeviceAdminReceiver
adb shell am force-stop com.notglossy.showrunner && adb shell am start -n com.notglossy.showrunner/.MainActivity
```

As device owner the app, on every resume: allow-lists itself for lock task and calls
`startLockTask()` (status bar, navigation bar, Home and Recents suppressed), disables the keyguard
and status bar, and sets "stay awake while plugged in". With a `-PshowrunnerLauncher=true` build it
also registers itself as the persistent Home activity, so no manual Home selection is needed.
Without device owner it falls back to immersive full-screen with keep-screen-on (the nav bar can be
revealed by swiping).

Check: `adb shell dumpsys activity activities | grep mLockTaskModeState` → `LOCKED`.

**Undo** (only possible without a factory reset because debug builds are `testOnly`):

```sh
adb shell dpm remove-active-admin com.notglossy.showrunner/.KioskDeviceAdminReceiver
```

A non-testOnly (release) build installed as device owner can only be removed by a factory reset.

## 5. Troubleshooting

| Symptom | Check |
|---|---|
| Setup screen says all-files access not granted | `adb shell appops set com.notglossy.showrunner MANAGE_EXTERNAL_STORAGE allow` |
| "Reconnecting…" overlay | Shows after 2 min without a heartbeat ack or when the page fails to load. It lists the server URL and device ID and retries with 5–60 s backoff. Check the server is reachable from the device: `adb shell curl -s http://<server>:3000/api/health` |
| Page or heartbeat HTTP 401 | The app re-registers automatically. If it persists, check `DEVICE_SHARED_SECRET` matches the config. |
| Inspect the page | Debug builds enable WebView debugging: `adb forward tcp:9222 localabstract:$(adb shell cat /proc/net/unix \| grep -oE 'webview_devtools_remote_[0-9]+' \| head -1)` then open `chrome://inspect` (or `http://localhost:9222/json`). |
| Device went back to pairing | It was deleted on the server; claim it again. |
| Screen stays awake after uninstalling | `adb shell settings put global stay_on_while_plugged_in 0` |

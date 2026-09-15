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
- **Kiosk modes.** Launcher mode: Home returns to ShowRunner, the Home picker switches to Trebuchet /
  Nova / View Assist and ShowRunner doesn't take the screen back, and it comes back after reboot.
  Strict mode: Home, Recents and other apps are blocked and there's no keyguard; leaving it from the
  exit menu clears device owner without a reset (tested 2026-09-13).
- **Direct Boot.** After a reboot Android shows the direct-boot-aware Launcher3 first and doesn't switch
  to the default Home app on unlock; the boot receiver brings ShowRunner forward when it's the default Home.

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
  --home                # launcher kiosk mode (recommended); add --strict for strict mode
```

What it does, step by step (run these by hand if you prefer):

```sh
PKG=com.notglossy.showrunner
cd apps/android && ./gradlew assembleDebug && cd -
adb install -r -t apps/android/app/build/outputs/apk/debug/app-debug.apk   # -t: debug builds are testOnly
adb shell appops set $PKG MANAGE_EXTERNAL_STORAGE allow     # read /sdcard/showrunner/config.json
adb shell appops set $PKG SYSTEM_ALERT_WINDOW allow         # bring the kiosk forward after boot/update
adb shell mkdir -p /sdcard/showrunner
adb push config.json /sdcard/showrunner/config.json         # step 3
adb shell cmd role add-role-holder android.app.role.HOME $PKG 0   # step 4: default Home app
adb shell am start -n $PKG/.MainActivity
```

Logs: `adb logcat -s ShowRunner ShowRunner.Web ShowRunner.Kiosk ShowRunner.Config ShowRunner.Boot`

### Release builds (your own signing key)

Debug builds are signed with this machine's automatic debug key, so only this machine can build updates for them.
Release builds are signed with your key, aren't debuggable (no `run-as`, no WebView DevTools), and install from any
machine that has the key.

1. **Create the key once** (Android Studio's JDK has `keytool`; there's no system Java):
   ```sh
   mkdir -p ~/keys
   "/Applications/Android Studio.app/Contents/jbr/Contents/Home/bin/keytool" -genkeypair -v \
     -keystore ~/keys/showrunner-release.jks -alias showrunner \
     -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=ShowRunner"
   ```
   The `-dname` fields are embedded in every APK and readable by anyone. **Back up the `.jks` file and its password.**
   Without them you can never update the installed app again.
2. **Tell Gradle** in `~/.gradle/gradle.properties` (`chmod 600`; never the repo or `.env`):
   ```properties
   SHOWRUNNER_KEYSTORE=/Users/you/keys/showrunner-release.jks
   SHOWRUNNER_KEY_ALIAS=showrunner
   SHOWRUNNER_KEYSTORE_PASSWORD=...
   # SHOWRUNNER_KEY_PASSWORD=...   only if the key's password differs (not with keytool's default PKCS12)
   ```
   Environment variables with the same names also work (e.g. for CI). Without them, release builds fail with a clear error.
3. **Build and install:** `scripts/install.sh --release --home --serial <usb-serial>`.
   `versionCode` is the git commit count, so newer commits always install over older ones.
4. **Switching an installed device between debug and release** (different keys) needs one uninstall:
   `scripts/install.sh --release --reinstall --home --serial <usb-serial>`. The app keeps its device ID in
   `/sdcard/showrunner/device-id` and its config in `/sdcard/showrunner/config.json`, so it reconnects as the same
   claimed display. Intent-extras config and a strict-mode device owner don't survive the uninstall. Leave strict mode
   first, and re-send extras if you used them.

Check which key an APK uses: `apksigner verify --print-certs app-release.apk` (in `~/Library/Android/sdk/build-tools/*/`).

## 3. Configure the server URL and secret

Without config the app shows a setup screen (device ID, kiosk mode, both options below) and checks
again every 5 seconds, so pushing a config file is enough; no restart needed.

A **running** app (already showing a screen) only reads `config.json` when it starts. To point it at a
different server, use option 2, which applies immediately, or push the file and `adb reboot`.

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

Option 2 is the way to **change servers on a locked kiosk**: the running app saves the values,
re-registers, and loads the new server within a second, without leaving lock task mode. Keep the
secret out of your shell history, for example `--es sharedSecret "$(grep '^DEVICE_SHARED_SECRET=' .env | cut -d= -f2-)"`.

If both exist, whichever was written most recently wins. `serverUrl` must be `http://` or
`https://` (a trailing slash is ignored). Use HTTPS once the server is behind a TLS proxy; plain
HTTP is currently allowed by `res/xml/network_security_config.xml`.

## 4. Kiosk mode

ShowRunner reports its mode to the dashboard (device page → Kiosk mode). You never need a factory reset to leave it.

### Launcher mode (recommended)

ShowRunner is the device's **default Home app**, like the Home Assistant kiosk apps. Home, boot and app updates
bring it back; the system bars are hidden but can be swiped in, and you can switch Home apps at any time.

```sh
adb shell cmd role add-role-holder android.app.role.HOME com.notglossy.showrunner 0
```

Or on the device: Settings → Apps → Default apps → Home app → ShowRunner. (`cmd package set-home-activity` also
works until the next reboot; the HOME role is what persists.) The app shows over a swipe lock screen and dismisses
it; a PIN/password lock screen stays.

To switch away: exit menu → **Choose Home app…**, or the Settings path above. ShowRunner then stops taking the
screen after boots and updates.

### Strict mode (optional)

Device owner + lock task: status bar, navigation, Home, Recents and other apps are blocked and the keyguard is
disabled. Requires **zero accounts** (`adb shell dumpsys account | head` → `Accounts: 0`).

```sh
adb shell dpm set-device-owner com.notglossy.showrunner/.KioskDeviceAdminReceiver
adb reboot    # comes back locked (~45 s)
```

Check: `adb shell dumpsys activity activities | grep mLockTaskModeState` → `LOCKED`.

Leave strict mode (any build, no factory reset): exit menu → **Leave strict mode** (tap twice), or the device page
in the dashboard → **Leave strict mode**. The app undoes its policies and gives up device ownership; it stays
installed. Then choose a Home app. From adb (debug builds only, which are `testOnly`):
`adb shell dpm remove-active-admin com.notglossy.showrunner/.KioskDeviceAdminReceiver`.

While strict mode is on, `am force-stop` has no effect; reconfigure with intent extras (step 3) or `adb reboot`.

### Exit menu

**Press and hold the top-left corner for 3 seconds.** If a PIN is set (dashboard → Settings → Kiosk exit menu,
4-8 digits) the menu asks for it. The device keeps a salted hash, so this works while the server is down. It's a
convenience lock, not strong security. Options: Choose Home app (not in strict mode), Open Android settings,
Leave strict mode (strict only), Reload.

From the dashboard (device page → Commands): **Open exit menu** (no PIN), **Open Android settings**, **Leave strict
mode**. These are delivered with the device's next heartbeat reply, so they arrive within about 30 seconds, and
screens (JavaScript) can't trigger them.

## 5. Troubleshooting

| Symptom | Check |
|---|---|
| Setup screen says all-files access not granted | `adb shell appops set com.notglossy.showrunner MANAGE_EXTERNAL_STORAGE allow` |
| "Reconnecting…" overlay | Shows after 2 min without a heartbeat ack or when the page fails to load. It lists the server URL and device ID and retries with 5–60 s backoff. Check the server is reachable from the device: `adb shell curl -s http://<server>:3000/api/health` |
| Page or heartbeat HTTP 401 | The app re-registers automatically. If it persists, check `DEVICE_SHARED_SECRET` matches the config. |
| Inspect the page | Debug builds enable WebView debugging: `adb forward tcp:9222 localabstract:$(adb shell cat /proc/net/unix \| grep -oE 'webview_devtools_remote_[0-9]+' \| head -1)` then open `chrome://inspect` (or `http://localhost:9222/json`). |
| Device went back to pairing | It was deleted on the server, or now points at a different server; claim it there. |
| `am force-stop` does nothing / "intent has been delivered to currently running top-most instance" | Strict mode is on, or the app is already running. Reconfigure with intent extras (step 3) or `adb reboot`. |
| Launcher3 shows after a reboot | Check the Home role (`adb shell dumpsys role \| grep -A2 role.HOME`) and that the `SYSTEM_ALERT_WINDOW` app op is allowed (step 2); the boot receiver needs it to bring ShowRunner forward. |
| Can't get out of the kiosk | Hold the top-left corner 3 s. Forgot the PIN? Remove it in dashboard → Settings, or use the dashboard's Open exit menu command. |
| Moving to a new server | `adb shell am start -n com.notglossy.showrunner/.MainActivity --es serverUrl http://<new-server>:3000 --es sharedSecret <secret>`, then claim the new pairing code in that server's dashboard. Extras outrank an older `config.json`, but a config file pushed *later* wins, so update or delete the file too if you keep using it. |
| Screen stays awake after uninstalling | `adb shell settings put global stay_on_while_plugged_in 0` |

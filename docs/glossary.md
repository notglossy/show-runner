# Glossary

Terms used across the ShowKiosk server, Android shell, and docs.

## Binding

The `data-bind="path"` attribute (e.g. `data-bind="weather.temp"`) makes the runtime put a value from `kiosk.data` into an element's text.

## Claim

The admin action in the dashboard that names an unclaimed device and takes ownership of it after matching its pairing code.

## Command

A message the server pushes to a device over Server-Sent Events, one of `reload`, `navigate`, or `refreshData`, with `screenshot` coming later.

## Data payload

The JSON object exposed to screens as `window.kiosk.data`, covering time and timezone, weather, and device info, refreshed from `GET /api/devices/:id/data`.

## Delegation

Handing a narrow, fully specified, verifiable coding task to a cheaper model via `scripts/delegate.sh`, where the result is always reviewed before commit.

## Device

One kiosk unit, identified by a UUID the Android app generates on first run.

## Device owner

Android device-policy status granted once with `adb shell dpm set-device-owner` that lets the app use lock task mode, and it requires no accounts on the device.

## Device token

A per-device credential returned at registration and stored by the shell as a cookie so every WebView request is authenticated.

## Dwell

The number of seconds a screen stays up in a playlist before the server navigates to the next one.

## Heartbeat

A `POST /api/devices/:id/heartbeat` the Android shell sends every 30 seconds with battery, Wi-Fi signal, and current screen, which drives last-seen status.

## Immersive mode

The fallback full-screen mode that hides system bars when the app is not device owner.

## Kiosk runtime

The small script the server injects into every rendered screen, which provides `window.kiosk`, listens for commands, and reports errors to `POST /api/devices/:id/log`.

## Launcher flag

A build flag that, when enabled, declares the HOME/launcher intent filter so the Android shell can act as the device's launcher. With it enabled, the shell is chosen once as the default Home app on the device.

## Lock task mode

Android kiosk mode started with `startLockTask()` that suppresses the status bar, navigation bar, and recents.

## Pairing code

The large 6-character code an unclaimed device shows on screen so it can be matched in the dashboard.

## Playlist

An ordered list of screens, each with a dwell time, assigned to a device, which the server rotates by sending `navigate` commands.

## Provider

A server module, for example `time` or `weather`, with a `fetch()` method and a cache TTL that supplies part of the data payload.

## Screen

A database row holding an HTML/CSS/JS template that a device can display.

## Shared secret

The `DEVICE_SHARED_SECRET` value the Android shell sends in a header when registering and sending heartbeats.

## Shell

The thin full-screen Android WebView app in `apps/android` that loads `GET /device/:id` and displays whatever the server renders.

## Template

The HTML/CSS/JS source stored in a screen, which references live data through bindings and `kiosk.on('data', fn)`.

## Watchdog

Logic in the Android shell that retries with backoff when the WebView fails to load or no heartbeat acknowledgement has arrived for several minutes, and shows a full-screen "reconnecting" state that includes the server URL and device ID.

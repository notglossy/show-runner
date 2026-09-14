# ShowRunner

Self-hosted dashboard kiosk for a rooted Echo Show 8 running LineageOS. The Android app is a thin
full-screen WebView; a Next.js server on your LAN decides what every screen shows.

- `apps/server`: Next.js server + dashboard (Docker)
- `apps/android`: Kotlin kiosk shell
- `docs/`: [architecture](docs/architecture.md), [device setup](docs/device-setup.md), [API](docs/api.md),
  [screen authoring](docs/screen-authoring.md)

Features: device pairing and kiosk lock, server-driven screens and playlists, live time/weather data, a
dashboard with a live-preview screen editor, and AI screen generation through any OpenAI-compatible API.

Work in progress. See `CLAUDE.md` for how to run each part.

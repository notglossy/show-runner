# Architecture

ShowKiosk has two moving parts: a **dumb Android WebView shell** on the Echo Show 8 and a
**Next.js server** on the LAN that owns all state and decides what every device shows.

```
┌────────────── Echo Show 8 (Android 11, WebView 139) ──────────────┐
│  MainActivity (lock task / immersive)                             │
│   ├─ native: register, heartbeat (30s), watchdog, config.json     │
│   ├─ JS bridge `KioskNative`: brightness, reload, device info     │
│   └─ WebView ── loads /device/:id ──┐                             │
│        injected runtime `window.kiosk`                            │
│          ├─ polls  GET  /api/devices/:id/data                     │
│          ├─ listens GET /api/devices/:id/events  (SSE)            │
│          └─ posts  POST /api/devices/:id/log                      │
└───────────────────────────────────────┬───────────────────────────┘
                                        │ HTTP (LAN; TLS via reverse proxy later)
┌──────────────── Docker: Next.js server ────────────────────────────┐
│  /device/:id        renders assigned screen template + runtime     │
│  /api/devices/*     register, heartbeat, data, events, log         │
│  /api/screens, /api/playlists   CRUD (Zod-validated)               │
│  dashboard (/)      admin UI, password auth                        │
│  providers/         time, weather (Open-Meteo), … with cache TTL   │
│  playlist scheduler sends `navigate` over SSE                      │
│  SQLite (Drizzle) on /data volume                                  │
└────────────────────────────────────────────────────────────────────┘
```

## Request / event flow

```mermaid
sequenceDiagram
    participant App as Android shell
    participant WV as WebView + kiosk runtime
    participant S as Server
    participant D as Dashboard (admin)

    App->>S: POST /api/devices/register {deviceId, model, …} + shared secret
    S-->>App: registered (claimed? pairing code)
    App->>WV: load /device/:id
    WV->>S: GET /device/:id
    S-->>WV: screen HTML (template + injected runtime) or pairing screen
    WV->>S: GET /api/devices/:id/events (SSE, held open)
    loop every N seconds
        WV->>S: GET /api/devices/:id/data
        S-->>WV: {time, weather, device}
    end
    loop every 30s
        App->>S: POST /api/devices/:id/heartbeat {battery, wifi, screen}
        S-->>App: ack
    end
    D->>S: claim device / assign screen or playlist
    S-->>WV: SSE navigate {screenId} / reload / refreshData
    WV->>S: GET /device/:id (new screen)
    WV->>S: POST /api/devices/:id/log (JS errors)
```

## Key decisions

- **Server-driven rendering.** A screen is a DB row holding an HTML/CSS/JS template. The device
  never knows about screens or playlists; it just loads `/device/:id` and obeys SSE commands.
- **Playlists rotate on the server.** The server sends `navigate` when a dwell time expires.
- **Data binding.** Templates use `data-bind="weather.temp"` and `kiosk.on('data', fn)`.
  The full contract is in [`screen-authoring.md`](screen-authoring.md) (written in Phase 1), which also serves as
  the system prompt for AI screen generation (Phase 4).
- **Providers.** One file per provider (`fetch()` + TTL) plus one registry entry.
- **Auth.** One admin password (env var) for the dashboard; a shared device secret for
  device endpoints. How the WebView authenticates its own requests (it can't set headers on
  `EventSource`) is decided in Phase 1.
- **Config over rebuilds.** Server config is env vars. Device config is
  `/sdcard/showkiosk/config.json` or `am start` intent extras.

## Deployment

- Dev: `pnpm dev` on the Mac, or `docker compose up` (native arm64).
- Prod: the home server (amd64) builds the same `apps/server/Dockerfile` via Komodo.
  DB lives on the `showkiosk-data` named volume at `/data/showkiosk.db`.

# HTTP API

All request bodies are JSON and validated with Zod (`apps/server/src/lib/api/schemas.ts`, types in
`types.ts`). Every error response has the same shape:

```json
{ "error": { "code": "validation_failed", "message": "Request validation failed",
             "issues": [{ "path": "deviceId", "message": "Invalid UUID" }] } }
```

Codes: `bad_request` 400, `validation_failed` 400, `unauthorized` 401, `forbidden` 403,
`not_found` 404, `conflict` 409, `payload_too_large` 413, `internal_error` 500.

## Authentication

| Caller | How |
|---|---|
| **Admin** | `showkiosk_admin` session cookie from `POST /api/auth/login`, **or** `Authorization: Bearer <ADMIN_PASSWORD>`. |
| **Device, registration** | `X-Kiosk-Secret: <DEVICE_SHARED_SECRET>` header. |
| **Device, everything else** | The per-device token returned by registration, as `Authorization: Bearer <token>` (native calls) **or** the cookie `showkiosk_device=<deviceId>.<token>` set for the server origin (WebView page, data, SSE, log). Registering again rotates the token; the old one stops working immediately. |

Per-device read endpoints (`/device/:id`, `data`, `events`) also accept an admin so the owner can
preview a device in a browser. For non-admins an unknown device and a bad token both return 401.

## Device-facing

### `POST /api/devices/register`
Header `X-Kiosk-Secret`. Body:
```json
{ "deviceId": "3f2b7c1e-8a4d-4e6f-9b0a-1c2d3e4f5a6b", "model": "Echo_Show_8", "androidVersion": "11",
  "appVersion": "0.1.0", "screenWidth": 1280, "screenHeight": 800 }
```
200:
```json
{ "deviceId": "3f2b…", "token": "DhGT…", "cookie": { "name": "showkiosk_device", "value": "3f2b….DhGT…" },
  "claimed": false, "name": null, "pairingCode": "3382FP", "pageUrl": "/device/3f2b…",
  "heartbeatIntervalSeconds": 30 }
```
The shell should set `cookie` for the server origin, then load `pageUrl`. Unclaimed devices keep
their pairing code across re-registrations.

### `POST /api/devices/:id/heartbeat`
Device token only (admins get 403). Body (all optional):
```json
{ "battery": { "level": 100, "charging": true }, "wifi": { "rssi": -52, "ssid": "home", "linkSpeedMbps": 144 },
  "currentUrl": "http://…/device/3f2b…", "currentScreenId": "builtin-clock", "uptimeSeconds": 3600 }
```
200 (the watchdog's ack):
```json
{ "ok": true, "serverTime": 1789335035932, "claimed": true, "currentScreenId": "builtin-clock",
  "eventsConnected": true, "heartbeatIntervalSeconds": 30 }
```
`eventsConnected` says whether the device's page currently has its SSE stream open.

### `GET /device/:id`
HTML. Renders the pairing screen (unclaimed), a "no screen assigned" screen, or the current screen
template with the kiosk runtime. 401 page if the token is missing/invalid, 404 page for admins
viewing an unknown device.

### `GET /api/devices/:id/data`
The `kiosk.data` payload (see `docs/screen-authoring.md` §6; formatted `time.*` fields are added by
the runtime in the browser).

### `GET /api/devices/:id/events`
`text/event-stream`. Each message is `data: <json>`:
`{"type":"hello","screenId":…,"serverTime":…}` on connect, then `{"type":"reload"}`,
`{"type":"navigate","screenId":…}`, `{"type":"refreshData"}`. Comment pings every 25 s.

### `POST /api/devices/:id/log`
Device token only. Body `{ "level": "error", "message": "…", "source", "line", "column", "stack",
"url", "screenId" }`. 202 `{ "stored": true }`, or 429 `{ "stored": false }` when over 60 lines/min.
The last 1000 lines per device are kept.

## Admin

| Method & path | Body / query | Response |
|---|---|---|
| `POST /api/auth/login` | `{ "password" }` | `{ ok, expiresAt }` + session cookie (30 days) |
| `POST /api/auth/logout` | | clears cookie |
| `GET /api/devices` | | `{ devices: DeviceView[] }` |
| `POST /api/devices/claim` | `{ "pairingCode": "3382fp", "name": "Kitchen" }` | `{ device }`; assigns `builtin-clock` if unassigned |
| `GET /api/devices/:id` | | `{ device }` |
| `PATCH /api/devices/:id` | `{ "name"?, "assignment"?: {"type":"none"} \| {"type":"screen","screenId"} \| {"type":"playlist","playlistId"} }` | `{ device }`; device navigates immediately |
| `DELETE /api/devices/:id` | | 204 |
| `POST /api/devices/:id/commands` | `{"type":"reload"}` \| `{"type":"refreshData"}` \| `{"type":"navigate","screenId"}` | `{ delivered: <open connections> }` |
| `GET /api/devices/:id/logs` | `?limit=100&before=<id>` | `{ logs }` newest first |
| `GET /api/screens` | | `{ screens }` (without `html`, with `htmlBytes`) |
| `POST /api/screens` | `{ name, html, description?, dataRefreshSeconds?, source?: "user"\|"ai", generationPrompt? }` | 201 `{ screen }` |
| `GET /api/screens/:id` | | `{ screen }` |
| `PATCH /api/screens/:id` | any subset of the create fields | `{ screen }`; devices showing it reload |
| `DELETE /api/screens/:id` | | 204, or 409 while assigned to a device or used in a playlist |
| `GET /api/playlists` | | `{ playlists }` with `itemCount`, `totalSeconds` |
| `POST /api/playlists` | `{ name, items?: [{ screenId, dwellSeconds }] }` | 201 `{ playlist }` |
| `GET /api/playlists/:id` | | `{ playlist }` with ordered `items` |
| `PATCH /api/playlists/:id` | `{ name?, items? }` (`items` replaces the list) | `{ playlist }`; rotation re-syncs |
| `DELETE /api/playlists/:id` | | 204; devices using it become unassigned |

`DeviceView` fields: `id, name, claimed, claimedAt, pairingCode, model, androidVersion, appVersion,
screenWidth, screenHeight, assignment, currentScreenId, playlistPosition, online` (heartbeat within
90 s)`, connected` (device SSE open)`, lastSeenAt, lastIp, status, registeredAt, createdAt, updatedAt`.

## Playlist rotation

When a device's playlist item dwell expires, the server advances `playlistPosition`, sets
`currentScreenId`, and sends `navigate`. Position is stored on the device row, so a server restart
resumes rotation. A manual `navigate` command inside a playlist shows the chosen screen for one full
dwell, then rotation continues.

## curl quick reference

```sh
B=http://localhost:3000; A="Authorization: Bearer $ADMIN_PASSWORD"
curl -s $B/api/devices -H "$A"
curl -s -XPOST $B/api/devices/claim -H "$A" -d '{"pairingCode":"ABC234","name":"Kitchen"}'
curl -s -XPATCH $B/api/devices/<id> -H "$A" -d '{"assignment":{"type":"screen","screenId":"builtin-clock-weather"}}'
curl -s -XPOST $B/api/playlists -H "$A" -d '{"name":"Rotate","items":[{"screenId":"builtin-clock","dwellSeconds":30},{"screenId":"builtin-clock-weather","dwellSeconds":60}]}'
```

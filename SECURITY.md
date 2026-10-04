# Security Policy

ShowRunner is a single-user, self-hosted LAN dashboard. There is no hosted
service and no multi-user threat model: the whole admin surface is one
`ADMIN_PASSWORD`. A display registers either with `DEVICE_SHARED_SECRET` (when set) or
while the dashboard's registration window is open; after that it holds a per-device
token, and a claimed display can only be re-registered with that token (or the shared
secret, when one is set).

## Supported versions

The latest [release](https://github.com/notglossy/showrunner/releases) only: the
`ghcr.io/notglossy/showrunner` image and the APK it ships with. Fixes arrive as a new release;
update by changing `SHOWRUNNER_VERSION` and pulling. There are no release branches.

## Reporting a vulnerability

Open a GitHub Security Advisory (preferred) or an issue. Include:

- what an attacker on the LAN (or with dashboard access) can do,
- steps to reproduce against a default `docker compose` install,
- whether the Android shell, the server, or the kiosk runtime is affected.

Do not include secrets, device tokens, or pairing codes in reports.

## Scope notes

- Physical access to the Echo Show, your LAN, or the Docker host is out of
  scope: anyone there already owns the kiosk.
- AI screen generation proxies your configured provider with your key; key
  handling is between you and that provider.

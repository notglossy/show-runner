# Security Policy

ShowRunner is a single-user, self-hosted LAN dashboard. There is no hosted
service and no multi-user threat model: the whole admin surface is one
`ADMIN_PASSWORD`, and the device channel is one `DEVICE_SHARED_SECRET`.

## Supported versions

Latest `main` only. There are no release branches; update by pulling and
rebuilding the Docker image.

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

# Contributing

Solo-owner project, open to drive-by PRs. Small and boring wins.

## Workflow

- One branch + PR per change, **based on `main`** (no stacked PRs).
- Conventional Commits: `feat(server): …`, `fix(android): …`, `chore: …`, `docs: …`.
- Small, reviewable commits, one per meaningful step.

## Before pushing

```sh
pnpm check   # format + lint + typecheck + tests with coverage + build
```

Android, when touched:

```sh
cd apps/android && ./gradlew assembleDebug testDebugUnitTest
```

## Rules

- Every API route validates input with Zod and returns typed JSON errors.
- Server style: Prettier + sorted imports (enforced by `pnpm check`); `/** ... */`
  on exported lib functions; `docs/screen-authoring.md` stays in sync with data fields.
- Ask before adding dependencies beyond the stack in `CLAUDE.md`.
- Never commit secrets, `.env`, keystores, or signing passwords.
- Device quirks and adb steps go in `docs/device-setup.md` as soon as they're known.
- Never require a factory reset to leave the kiosk.

## Reporting bugs

Include: server (`docker compose`) or Android build, device model if relevant,
steps to reproduce, and what you expected. See `SECURITY.md` for vulnerabilities.

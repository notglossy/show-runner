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
cd apps/android && ./gradlew lintDebug assembleDebug testDebugUnitTest
```

## Rules

- Every API route validates input with Zod and returns typed JSON errors.
- Server style: Prettier + sorted imports (enforced by `pnpm check`); `/** ... */`
  on exported lib functions; `docs/screen-authoring.md` stays in sync with data fields.

### Android (Kotlin)

Google Android Kotlin style (https://developer.android.com/kotlin/style-guide); on
conflict with the Kotlin conventions it wins. Views codebase — no Compose.

- 4-space indent (`.editorconfig`), 100-col limit, trailing commas in multi-line lists.
- Imports: `android.*`, then `androidx.*`, then third-party, then `java.*`/`javax.*`,
  blank line between groups, alphabetical within.
- One top-level class per file, PascalCase, file named after the class. Pure logic lives
  in testable helpers (see `KioskLogic.kt`), not the activity.
- KDoc (`/** ... */`) on public/internal classes, functions, properties; `[Symbol]` links;
  `@param`/`@return` only when they add beyond the signature. Comments explain why
  (lifecycle, threading, API-level/OEM workarounds with the level cited), never restate code.
- Every `@Suppress`/`@SuppressLint` gets a trailing `//` saying why it is safe.
- `// TODO(name): description` only. No commented-out code, no file headers.
- Leave untouched lines alone; no whole-file reformats as a side effect.
- Ask before adding dependencies beyond the stack in `CLAUDE.md`.
- Never commit secrets, `.env`, keystores, or signing passwords.
- Device quirks and adb steps go in `docs/device-setup.md` as soon as they're known.
- Never require a factory reset to leave the kiosk.

## Reporting bugs

Include: server (`docker compose`) or Android build, device model if relevant,
steps to reproduce, and what you expected. See `SECURITY.md` for vulnerabilities.

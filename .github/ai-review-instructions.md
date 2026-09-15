# Review instructions for ShowRunner

## How to review

- Check every claim against the code before reporting it. Quote or name the exact function and condition you
  are relying on, and anchor the finding to the line that has the problem. If you cannot point at the code,
  do not report it.
- Do not repeat a point listed under "Settled decisions" unless the PR changes the code it describes so that
  the decision no longer holds. If it does, say what changed.

## Settled decisions

These were raised by earlier reviews, checked, and decided. They are not findings.

### AI review workflow (`.github/workflows/auto-pr-review.yaml`, `.github/scripts/ai_review.py`)

- **opencode subprocess environment.** `call_opencode()` passes only an allowlist of variables (`PATH`, `HOME`,
  `LANG`, `LC_ALL`, `TERM`, `AI_API_KEY`, `TMPDIR`, `XDG_*`). `GITHUB_TOKEN` is not passed. `AI_API_KEY` must stay:
  the generated opencode config reads it with `{env:AI_API_KEY}`. The agent runs with `edit`, `webfetch` and
  `websearch` denied and a read-only bash policy.
- **API key in logs or errors.** Request headers never reach an exception or log line. `ProviderError` holds the
  status and the response body; `http()` logs the URL, status and response text. The key comes from repository
  secrets, so Actions masks it in logs.
- **`GITHUB_TOKEN` on disk.** Both checkouts use `persist-credentials: false`, so the token is not in `.git/config`.
  Steps that need it get it as a step-level env var.
- **Event and fork guard.** The workflow uses `pull_request`, not `pull_request_target`, and runs only for
  same-repo, non-draft PRs. Fork PRs get no secrets.
- **Self-hosted runner.** The runner is intentional. The remaining risk (a fork PR editing the workflow to run
  code on the runner) is handled by the repository setting "Require approval for all external contributors"
  before the repo goes public. Do not ask for runner-hardening docs or workflow changes for this.
- **`AI_BASE_URL` / `AI_PONYTAIL_BASE_URL` may be plain HTTP.** They are repository variables set by the owner,
  not PR input, and a local OpenAI-compatible server (Ollama, LM Studio, llama.cpp) is usually
  `http://localhost:…/v1`. Do not ask for HTTPS-only or private-address validation.
- **Review history is best-effort.** `get_review_comments()` raises on failure; its caller catches that and
  reviews without history. `build_thread_digest()` respects `AI_MAX_THREAD_CHARS` by dropping the oldest threads
  and logs when it does.
- **Superseded runs.** When the PR head has moved, the run logs "PR head moved from X to Y" and exits without
  posting, so the newer run reviews the new head. This is not a silent exit.
- **Instructions file read from the PR head.** `load_instructions_file()` reads this file from the checked-out PR
  on purpose and refuses paths that resolve outside the checkout. Same-repo authors already control the script,
  so this adds no attack surface.

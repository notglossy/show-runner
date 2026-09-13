#!/usr/bin/env bash
# Run a narrow, fully specified coding task on a cheap model via OMP (Oh My Pi).
#
#   scripts/delegate.sh <task-file> [model]
#
# - Refuses to run unless the git working tree is clean (so the result is a reviewable diff).
# - Runs `omp` in print mode, thinking off, auto-approved tools, no saved session.
# - Prints only: the tail of OMP's reply, changed files + diff stat, and the tail of the
#   acceptance check output.
# - The acceptance check is the first line of the task file starting with `CHECK:`.
#   Without one, a default is picked from the changed paths.
# - Never commits or reverts. Reviewing and committing is the caller's job.
#
# Env overrides: DELEGATE_MODEL, DELEGATE_MAX_TIME (default 15m), DELEGATE_SUMMARY_LINES (default 8).
set -euo pipefail

usage() { echo "usage: $0 <task-file> [model]" >&2; exit 2; }
[[ $# -ge 1 && $# -le 2 ]] || usage

task_file=$1
[[ -f "$task_file" ]] || { echo "delegate: task file not found: $task_file" >&2; exit 2; }
task_file=$(cd "$(dirname "$task_file")" && pwd)/$(basename "$task_file")

model=${2:-${DELEGATE_MODEL:-openrouter/meta/muse-spark-1.3-contributor}}
max_time=${DELEGATE_MAX_TIME:-15m}
summary_lines=${DELEGATE_SUMMARY_LINES:-8}

repo_root=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
cd "$repo_root"

command -v omp >/dev/null || { echo "delegate: omp not found on PATH" >&2; exit 2; }

if [[ -n "$(git status --porcelain)" ]]; then
  echo "delegate: refusing to run, git working tree is not clean:" >&2
  git status --short >&2
  exit 3
fi

head_before=$(git rev-parse HEAD)
out=$(mktemp -t delegate-omp.XXXXXX)
check_out=$(mktemp -t delegate-check.XXXXXX)
trap 'rm -f "$check_out"' EXIT

prompt="$(cat "$task_file")

---
Rules for this task:
- Only create or modify the files named above. Do not touch anything else.
- Do not run git commands that change history or the index (no commit, add, reset, checkout, stash).
- When finished, reply with 2-5 short lines: what you changed and anything you were unsure about."

echo "delegate: model=$model task=$task_file"
set +e
omp -p \
  --model="$model" \
  --thinking=off \
  --no-session \
  --no-title \
  --auto-approve \
  --max-time="$max_time" \
  --cwd="$repo_root" \
  "$prompt" </dev/null >"$out" 2>&1   # stdin closed: omp otherwise blocks reading piped input
omp_status=$?
set -e

if [[ $omp_status -ne 0 ]]; then
  echo "delegate: omp failed (exit $omp_status). Last 40 lines:" >&2
  tail -n 40 "$out" >&2
  echo "delegate: full output kept at $out" >&2
  exit 1
fi

echo
echo "=== OMP reply (last $summary_lines lines) ==="
tail -n "$summary_lines" "$out"

if [[ "$(git rev-parse HEAD)" != "$head_before" ]]; then
  echo
  echo "!!! delegate: HEAD moved during the run ($head_before -> $(git rev-parse HEAD)). Review before doing anything else."
fi

echo
echo "=== Changed files ==="
git status --short
echo
echo "=== Diff stat (tracked) ==="
git diff --stat
untracked=$(git ls-files --others --exclude-standard)
if [[ -n "$untracked" ]]; then
  echo "untracked:"
  while IFS= read -r f; do printf '  %s (%s lines)\n' "$f" "$(wc -l <"$f" | tr -d ' ')"; done <<<"$untracked"
fi

# Acceptance check: explicit CHECK: line wins; otherwise infer from changed paths.
check=$(grep -m1 -E '^CHECK:' "$task_file" | sed -E 's/^CHECK:[[:space:]]*//' || true)
if [[ -z "$check" ]]; then
  changed=$( { git diff --name-only; git ls-files --others --exclude-standard; } )
  if grep -q '^apps/server/' <<<"$changed"; then
    check="pnpm --filter @showkiosk/server typecheck && pnpm --filter @showkiosk/server lint"
  elif grep -q '^apps/android/' <<<"$changed"; then
    check="cd apps/android && ./gradlew assembleDebug --console=plain"
  fi
fi

echo
if [[ -z "$check" ]]; then
  echo "=== Check: none (no CHECK: line and no app code changed) ==="
  check_status=0
else
  echo "=== Check: $check ==="
  set +e
  bash -c "$check" >"$check_out" 2>&1
  check_status=$?
  set -e
  tail -n 20 "$check_out"
  echo "check exit: $check_status"
fi

rm -f "$out"
exit $(( check_status == 0 ? 0 : 4 ))

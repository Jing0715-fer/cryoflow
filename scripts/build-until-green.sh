#!/usr/bin/env bash
# build-until-green.sh — t406: the production-build grinder.
#
# Doctrine inherited from three windows of autopsies:
#   t402: build workers die mid-compile (SIGKILL, often with no kernel record);
#         the webpack cache persists across reboots, so a killed build's
#         successor starts further ahead (incremental warmth).
#   t405: the kernel OOM killer executes next-server at ~2.9GB anon; the dev
#         regime cannot host the e2e family on this 4GB/no-swap box. The
#         production server (next build + next start) is the regime change:
#         zero compilation at steady state, no compile-shaped process for the
#         reaper to hunt.
#   t404: grinders that outlive their process (heal-until-green.sh) beat
#         one-shot attempts — a hard cap prevents true-failure infinite loops.
#
# Contract:
#   - Idempotent across tool-call invocations: if .next/BUILD_ID exists the
#     build already went green and the script exits 0 immediately.
#   - Each attempt is wrapped in `timeout 560` so a single Bash tool call
#     (600s ceiling) always returns with a verdict instead of being SIGKILLed
#     mid-attempt with no testimony.
#   - After every failed attempt the script cools down briefly and retries,
#     relying on .next/cache/webpack to carry progress forward.
#   - Hard cap on attempts (default 10) to avoid grinding on a true failure.
#   - Environment per t402's autopsies: node runtime (bun OOMs differently),
#     --webpack (Turbopack kernel-OOMs), heap cap 1792MB (896 mark-compacts).
#
# Usage: bash scripts/build-until-green.sh [max_attempts]
# Exit codes: 0 = BUILD_ID present (green); 1 = attempts exhausted without one.

set -u
cd "$(dirname "$0")/.."

MAX_ATTEMPTS="${1:-10}"
BUILD_ID=".next/BUILD_ID"
LOG=".qa-logs/build-t406.log"
mkdir -p .qa-logs

stamp() { date -u '+[%H:%M:%SZ]'; }

if [ -f "$BUILD_ID" ] && [ "${FRESH:-0}" != "1" ]; then
  echo "$(stamp) BUILD_ID present — build already green, nothing to grind."
  echo "        (source changed since? FRESH=1 forces a rebuild — the grinder"
  echo "         cannot cheaply diff the whole src tree, so it trusts the stamp)"
  exit 0
fi

echo "$(stamp) build-until-green: start (cap=$MAX_ATTEMPTS) — logging to $LOG"

attempt=0
while [ "$attempt" -lt "$MAX_ATTEMPTS" ]; do
  attempt=$((attempt + 1))
  echo "$(stamp) attempt $attempt/$MAX_ATTEMPTS" >> "$LOG"
  echo "$(stamp) attempt $attempt/$MAX_ATTEMPTS"

  NODE_OPTIONS="--max-old-space-size=1280" \
  timeout 560 node node_modules/next/dist/bin/next build --webpack \
    >> "$LOG" 2>&1
  rc=$?

  if [ $rc -eq 0 ] && [ -f "$BUILD_ID" ]; then
    echo "$(stamp) GREEN on attempt $attempt (BUILD_ID present)" >> "$LOG"
    echo "$(stamp) GREEN on attempt $attempt"
    exit 0
  fi

  if [ $rc -eq 124 ]; then
    echo "$(stamp) attempt $attempt hit the 560s ceiling (killed by timeout; cache carries progress)" >> "$LOG"
    echo "$(stamp) attempt $attempt: 560s ceiling — cache carries progress, retrying"
  else
    tail -4 "$LOG" | sed 's/^/    | /'
    echo "$(stamp) attempt $attempt failed rc=$rc — cooling 3s, the cache grows every attempt" >> "$LOG"
    echo "$(stamp) attempt $attempt failed rc=$rc"
  fi

  sleep 3
done

echo "$(stamp) EXHAUSTED after $MAX_ATTEMPTS attempts without BUILD_ID — read $LOG tail for the true failure" >> "$LOG"
echo "$(stamp) EXHAUSTED after $MAX_ATTEMPTS attempts. Inspect $LOG"
exit 1

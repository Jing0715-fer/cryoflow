#!/bin/bash
# dev-server-watchdog.sh — the t404 promotion of the t403 band-aid.
#
# /tmp/revive.sh (Task 403) kept the DEV server alive through the sandbox
# patrol's reaping sprees, but it lived in /tmp with a 90-minute window
# (360 x 15s) — it expired mid-window-404 and the server died with no
# guardian (witnessed: three ECONNREFUSED crashes in a row while the t313
# suite waited). This is the same doctrine, promoted: in-tree, no expiry.
#
#   - health check: bare curl on / (the dev server answers it even before
#     the route manifest is warm)
#   - the pgrep gate: a "next dev" process that exists but is not yet
#     answering is MID-BOOT (compiling) — never pkill it (the t403 lesson:
#     the reviver v1 became the patrol's accomplice by killing compilers)
#   - the hardened env matches scripts/dev-server.sh's escape hatches:
#     DEV_HEAP_MB=1792 (the webpack lane OOMs at 896) and DEV_NEXT_ARGS
#     "--webpack" (the Turbopack kernel-OOM escape)
#
# Run detached:  (nohup bash scripts/dev-server-watchdog.sh >> .qa-logs/dev-watchdog.log 2>&1 &)
# Stop with:     pkill -f dev-server-watchdog
cd "$(dirname "$0")/.." || exit 1
mkdir -p .qa-logs
while true; do
  if ! curl -s -o /dev/null --max-time 3 http://localhost:3000/; then
    if ! pgrep -f "next dev" > /dev/null; then
      echo "[$(date -u +%H:%M:%SZ)] server down, no next dev process — booting with hardened env" >> .qa-logs/dev-watchdog.log
      DEV_HEAP_MB=1792 DEV_NEXT_ARGS="--webpack" bash scripts/dev-server.sh >> .qa-logs/dev-server.log 2>&1
    fi
  fi
  sleep 15
done

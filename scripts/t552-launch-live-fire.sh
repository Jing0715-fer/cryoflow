#!/usr/bin/env bash
# t552 — orphaned launcher (t545 shape): start the live-fire detached and
# EXIT IMMEDIATELY so the tool-call reaper finds no lineage to reap.
set -u
cd "$(dirname "$0")/.."
LOG=".qa-logs/t552-live-fire-$(date +%H%M%S).log"
setsid node scripts/t552-keep-verdict-live-fire.mjs > "$LOG" 2>&1 < /dev/null &
echo "live-fire launched (pid $!), log: $LOG"

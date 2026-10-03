#!/usr/bin/env bash
# t553 — orphaned launcher (t545 shape): the CANONICAL t519 full run
# (caseA golden path + caseB fresh-session judges) detached, exits fast.
set -u
cd "$(dirname "$0")/.."
LOG=".qa-logs/t553-canonical-$(date +%H%M%S).log"
setsid node scripts/t519-real-agent-e2e.mjs > "$LOG" 2>&1 < /dev/null &
echo "canonical e2e launched (pid $!), log: $LOG"

#!/usr/bin/env bash
# t552b — orphaned launcher (t545 shape).
set -u
cd "$(dirname "$0")/.."
LOG=".qa-logs/t552b-fresh-$(date +%H%M%S).log"
setsid node scripts/t552b-fresh-judge-consistency.mjs > "$LOG" 2>&1 < /dev/null &
echo "fresh-judge launched (pid $!), log: $LOG"

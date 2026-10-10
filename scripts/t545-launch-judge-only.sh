#!/usr/bin/env bash
# t545 — the e2e launcher that survives the sandbox tool-call reaper.
#
# Same shape as services/mock-cluster/launch.sh: this script starts the
# REAL e2e detached and EXITS IMMEDIATELY, orphaning the e2e to init
# before the tool call ends — the reaper's lineage walk then finds
# nothing to reap. (Direct `setsid nohup cmd &` inside a tool call dies
# at the call boundary even with setsid+disown — verified by a control
# `setsid sleep 300` that did not survive the next tool call.)
set -u
cd "$(dirname "$0")/.."
LOG=".qa-logs/t545-judge-only-$(date +%H%M%S).log"
setsid node scripts/t519-real-agent-e2e.mjs --judge-only > "$LOG" 2>&1 < /dev/null &
echo "e2e launched (pid $!), log: $LOG"

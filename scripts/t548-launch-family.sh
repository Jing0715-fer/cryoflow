#!/usr/bin/env bash
# t548 — the full bench-family launcher (the t545 orphan-to-init shape).
# Direct `setsid nohup cmd &` inside a tool call dies at the call boundary;
# this script starts the run detached and EXITS IMMEDIATELY, orphaning the
# family run to init before the tool call ends.
set -u
cd "$(dirname "$0")/.."
LOG=".qa-logs/t548-family-$(date +%H%M%S).log"
setsid bash scripts/recent-family.sh > "$LOG" 2>&1 < /dev/null &
echo "family launched (pid $!), log: $LOG"

#!/bin/bash
# heal-t412-runner.sh — the reaper's WITNESS, kept as a diagnostic asset.
#
# Task 412's final doctrine: background node processes die silently in this
# sandbox (two nohup AND setsid launches died at ~7-8 min — no OOM testimony,
# no stderr; dmesg's only kill predates the window by 4.7h). The blessed path
# that actually healed the chain is FOREGROUND CHUNKS through the healer's
# new --from <type> flag (completed nodes keep their products on BOTH planes,
# so the next chunk continues). This runner is the fallback if a future
# window needs a fire-and-forget attempt: setsid detaches the process group
# and the loop re-runs the IDEMPOTENT healer until it exits 0 — a partial
# pass costs minutes, never correctness.
cd /home/z/my-project || exit 1
LOG=.qa-logs/heal-t412.log
MAX=8
for i in $(seq 1 "$MAX"); do
  echo "=== healer attempt $i starts $(date '+%H:%M:%S') ===" >> "$LOG"
  setsid node scripts/demo-chain-resurrect.mjs --rerun >> "$LOG" 2>&1
  rc=$?
  echo "=== attempt $i rc=$rc $(date '+%H:%M:%S') ===" >> "$LOG"
  if [ "$rc" -eq 0 ]; then
    echo "=== HEALED after $i attempt(s) ===" >> "$LOG"
    exit 0
  fi
  sleep 5
done
echo "=== RUNNER EXHAUSTED after $MAX attempts ===" >> "$LOG"
exit 1

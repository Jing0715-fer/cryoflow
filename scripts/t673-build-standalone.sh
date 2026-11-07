#!/usr/bin/env bash
# t673 — the real-lineage standalone build, riding Task 672's demonstrated keys:
#   (1) heap cap 2816 (672 built green at 3.28GB available with this ceiling)
#   (2) ORPHANED launch — ( setsid nohup ... & ) with the subshell exiting
#       immediately: the only reaper-immune posture (672's controlled experiment)
#   (3) log polling, not blocking — the 600s tool limit must never bisect a build
# No grinder to pause (checked), no prod to stop (ports verified FREE upstream).
set -u
cd /home/z/my-project || exit 1
mkdir -p /tmp/cryoflow-qa
LOG=/tmp/cryoflow-qa/t673-build.log
: > "$LOG"

CAP="${T673_HEAP_CAP:-2816}"
EXTRA_ARGS="${T673_BUILD_ARGS:-}"

echo "[t673] launching detached build: cap=$CAP args='$EXTRA_ARGS' at $(date '+%H:%M:%S')" | tee -a "$LOG"
( setsid nohup env NODE_OPTIONS="--max-old-space-size=$CAP" \
    npx next build $EXTRA_ARGS >> "$LOG" 2>&1 < /dev/null & )
echo "[t673] launched. tail the log: tail -f $LOG"

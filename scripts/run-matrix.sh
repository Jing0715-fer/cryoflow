#!/bin/bash
# Canonical full-regression matrix runner (Task 102+).
#
# WHY THIS EXISTS: scripts/run-matrix-t101.sh (now archived under
# diag-archive/legacy-suites/) claimed "34 suites" in its comment while
# carrying 66 — every agent-browser-generation suite (qa35–qa57) rode
# along. Running it triggered the Task 101 OOM incident (agent-browser
# retry storm killed next-server on a 4GB box). Lessons baked in here:
#   1. The suite LIST is explicit — deprecated/legacy suites are never
#      picked up by accident.
#   2. The TOTAL is COMPUTED (${#SUITES[@]}), never claimed in a comment —
#      a comment can drift, a count cannot.
#   3. Missing files fail loudly instead of silently shrinking the matrix.
#
# Official matrix: qa00 (data-view divergence sentinel) + qa58–qa84 +
# t85–tN. qa42–qa57 remain on disk but OUTSIDE this matrix — NOT because
# they are unverified (Task 107 rehomed 14/16, Task 108 closed the last
# two: qa54 mirror-sweep + row-scoped readers, qa57 template-cooking fix;
# all 16 green as of 2026-09-10) but because the explicit list keeps the
# OOM margin of Task 101: 16 extra agent-browser suites would grow the
# serial runtime ~40%. Run them individually after touching bookmark /
# import-dialog / dashboard-gallery code. qa35–qa41 are formally archived
# under diag-archive/legacy-suites/.
#
# Usage:
#   bash scripts/run-matrix.sh            # full matrix
#   bash scripts/run-matrix.sh 7 10       # suites #7..#10 only (1-based,
#                                         # inclusive, same sorted order —
#                                         # foreground chunking for the
#                                         # 10-min tool-call ceiling)
cd /home/z/my-project

SUITES=(
  scripts/qa00-data-view.mjs
  scripts/qa58-e2e.mjs
  scripts/qa59-e2e.mjs
  scripts/qa60-e2e.mjs
  scripts/qa61-e2e.mjs
  scripts/qa62-e2e.mjs
  scripts/qa63-smoke.mjs
  scripts/qa64-e2e.mjs
  scripts/qa66-e2e.mjs
  scripts/qa67-e2e.mjs
  scripts/qa68-e2e.mjs
  scripts/qa69-e2e.mjs
  scripts/qa70-e2e.mjs
  scripts/qa72-verify.mjs
  scripts/qa73-e2e.mjs
  scripts/qa75-e2e.mjs
  scripts/qa76-e2e.mjs
  scripts/qa77-e2e.mjs
  scripts/qa78-e2e.mjs
  scripts/qa79-e2e.mjs
  scripts/qa80-e2e.mjs
  scripts/qa81-e2e.mjs
  scripts/qa82-e2e.mjs
  scripts/qa83-e2e.mjs
  scripts/qa84-e2e.mjs
  scripts/t85-kpi-paper-probe.mjs
  scripts/t86-e2e.mjs
  scripts/t87-e2e.mjs
  scripts/t88-e2e.mjs
  scripts/t89-e2e.mjs
  scripts/t90-e2e.mjs
  scripts/t92-e2e.mjs
  scripts/t93-e2e.mjs
  scripts/t94-e2e.mjs
  scripts/t95-e2e.mjs
  scripts/t96-e2e.mjs
  scripts/t97-e2e.mjs
  scripts/t98-e2e.mjs
  scripts/t99-e2e.mjs
  scripts/t100-e2e.mjs
  # Append each new task suite here AND nowhere else. Keep list sorted.
)
# Auto-include the newest t-suite so "forgot to add t10X" can't happen:
for f in scripts/t1[0-9][0-9]-e2e.mjs; do
  [ -f "$f" ] || continue
  base=$(basename "$f")
  dup=0
  for s in "${SUITES[@]}"; do [ "$(basename "$s")" = "$base" ] && dup=1; done
  [ $dup -eq 0 ] && SUITES+=("$f")
done
SUITES=($(printf '%s\n' "${SUITES[@]}" | sort))

MISSING=0
for s in "${SUITES[@]}"; do
  [ -f "$s" ] || { echo "MISSING SUITE: $s"; MISSING=1; }
done
[ $MISSING -eq 1 ] && { echo "ABORT: matrix list references missing files"; exit 2; }

TOTAL=${#SUITES[@]}
FROM_IDX=${1:-1}
TO_IDX=${2:-$TOTAL}
if [ "$FROM_IDX" -lt 1 ] || [ "$TO_IDX" -gt "$TOTAL" ] || [ "$FROM_IDX" -gt "$TO_IDX" ]; then
  echo "ABORT: range $FROM_IDX..$TO_IDX outside 1..$TOTAL"
  exit 2
fi
echo "matrix: $TOTAL suites, serial (running $FROM_IDX..$TO_IDX)"

# ---- Task 122: server hygiene inside the runner ----------------------
# WHY: Task 119's full-matrix run died mid-flight — next-server grew to
# 2.5GB anon-rss (the 896MB heap cap in start-prod.sh bounds JS heap only;
# RSS also carries route caches, buffers and the Prisma engine) and the
# kernel OOM-killed it on a 3.9GB no-swap box. Everything after the kill
# failed in its own way (7-suite cascade of fake failures), and the
# forensics (dmesg autopsy, phantom hydration bug, 3 rebuilds) cost hours.
# The matrix keeps growing (58 suites as of Task 121), so the pressure is
# structural, not accidental.
#
# Design (evaluated + implemented Task 122):
#   FRESH_SERVER=1 (default) — restart the prod server at chunk start, so
#     every invocation begins from a known-good state (automates the
#     Task 86 stale-server lesson: fresh PROCESS beats stale memory).
#     Opt out with FRESH_SERVER=0.
#   RSS_RESTART_MB (default 1200) — before each suite: if server RSS is
#     over the threshold OR no server process exists (OOM already fired),
#     restart inline. The failure cascade stays bounded to one suite
#     instead of everything after a mid-matrix death.
#   Telemetry — per-suite RSS + wall-time are appended to
#     .next/matrix-memory.log (cols: time,suite,rss,restarted,wall) and
#     the chunk peak + slowest suite are printed at the end: future OOM
#     and slow-suite questions get data, not folklore.
FRESH_SERVER="${FRESH_SERVER:-1}"
RSS_RESTART_MB="${RSS_RESTART_MB:-1200}"
MEMLOG=".next/matrix-memory.log"

server_pids() { pgrep -f "standalone/server.js" 2>/dev/null; }
server_rss_mb() {
  local kb total=0 pid
  for pid in $(server_pids); do
    kb=$(ps -o rss= -p "$pid" 2>/dev/null | tr -d ' ')
    [ -n "$kb" ] && total=$((total + kb))
  done
  echo $((total / 1024))
}
fresh_server() {
  bash scripts/start-prod.sh
  local i code
  for i in $(seq 1 30); do
    code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null)
    [ "$code" = "200" ] && return 0
    sleep 1
  done
  echo "matrix: WARNING - server not ready 30s after restart"
  return 1
}

if [ "$FRESH_SERVER" = "1" ]; then
  echo "matrix: chunk-start fresh server (threshold ${RSS_RESTART_MB}MB) ..."
  fresh_server || true
fi
mkdir -p .next
echo "# $(date '+%F %T') chunk $FROM_IDX..$TO_IDX/$TOTAL fresh=$FRESH_SERVER thr=${RSS_RESTART_MB}MB cols=time,suite,rss,restarted,wall" >> "$MEMLOG"
FAILS=()
N=0
PEAK=0
PEAK_AT="-"
WALL_MAX=0
WALL_AT="-"
for s in "${SUITES[@]}"; do
  N=$((N+1))
  if [ "$N" -lt "$FROM_IDX" ] || [ "$N" -gt "$TO_IDX" ]; then continue; fi
  name=$(basename "$s")
  # server health gate BEFORE the suite (restarts between suites only —
  # no suite is ever running while the server bounces, and disk-backed
  # seed state survives a restart by construction)
  rss=$(server_rss_mb)
  restarted="no"
  if [ "$FRESH_SERVER" = "1" ]; then
    pids=$(server_pids)
    if [ -z "$pids" ] || [ "$rss" -ge "$RSS_RESTART_MB" ]; then
      if [ -z "$pids" ]; then reason="no server process"; else reason="rss ${rss}MB >= threshold ${RSS_RESTART_MB}MB"; fi
      echo "[$N/$TOTAL] server hygiene: $reason -> inline restart"
      fresh_server || true
      rss=$(server_rss_mb)
      restarted="yes"
    fi
  fi
  # the row's timestamp is the GATE time (when rss was sampled); the row
  # itself is written after the suite so wall-time is known (Task 125)
  gate_ts=$(date '+%H:%M:%S')
  if [ "$rss" -gt "$PEAK" ]; then PEAK=$rss; PEAK_AT=$name; fi
  t0=$(date +%s)
  out=$(node "$s" 2>&1)
  wall=$(( $(date +%s) - t0 ))
  if [ "$wall" -gt "$WALL_MAX" ]; then WALL_MAX=$wall; WALL_AT=$name; fi
  # Task 117 (prevention leg of the qa60/61 position-5 intermittent): the
  # browser is released AFTER every suite so suite N+1 relaunches Chromium
  # instead of inheriting suite N's renderer churn. Two same-slot failures
  # ("document undefined" transport deaths) were live-reproduced as a
  # renderer crash under memory pressure; a fresh browser per suite
  # removes the accumulation the failures fed on (~2s per relaunch).
  agent-browser close --all >/dev/null 2>&1 || true
  suffix=""
  [ "$restarted" = "yes" ] && suffix=", restarted"
  echo "$gate_ts,$name,${rss}MB,$restarted,${wall}s" >> "$MEMLOG"
  if echo "$out" | grep -qE "ALL PASS|GREEN|SMOKE GREEN|PROBE OK|PAPER PROBE"; then
    echo "[$N/$TOTAL] PASS $name (rss ${rss}MB, wall ${wall}s${suffix})"
  else
    echo "[$N/$TOTAL] FAIL $name (rss ${rss}MB, wall ${wall}s${suffix})"
    echo "$out" | tail -6
    FAILS+=("$name")
  fi
done
echo "=================================="
echo "TOTAL ${#FAILS[@]} failures / suites $FROM_IDX..$TO_IDX of $TOTAL"
echo "server memory: chunk peak ${PEAK}MB (before '$PEAK_AT'); slowest suite: ${WALL_AT} ${WALL_MAX}s; telemetry: $MEMLOG"
for f in "${FAILS[@]}"; do echo "  FAILED: $f"; done
[ ${#FAILS[@]} -eq 0 ]

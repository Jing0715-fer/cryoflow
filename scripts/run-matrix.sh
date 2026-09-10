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
echo "matrix: $TOTAL suites, serial, one server (running $FROM_IDX..$TO_IDX)"
FAILS=()
N=0
for s in "${SUITES[@]}"; do
  N=$((N+1))
  if [ "$N" -lt "$FROM_IDX" ] || [ "$N" -gt "$TO_IDX" ]; then continue; fi
  name=$(basename "$s")
  out=$(node "$s" 2>&1)
  if echo "$out" | grep -qE "ALL PASS|GREEN|SMOKE GREEN|PROBE OK|PAPER PROBE"; then
    echo "[$N/$TOTAL] PASS $name"
  else
    echo "[$N/$TOTAL] FAIL $name"
    echo "$out" | tail -6
    FAILS+=("$name")
  fi
done
echo "=================================="
echo "TOTAL ${#FAILS[@]} failures / suites $FROM_IDX..$TO_IDX of $TOTAL"
for f in "${FAILS[@]}"; do echo "  FAILED: $f"; done
[ ${#FAILS[@]} -eq 0 ]

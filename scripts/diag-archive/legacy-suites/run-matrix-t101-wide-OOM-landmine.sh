#!/bin/bash
# Task 101 full regression matrix — 34 suites, serial, one server.
cd /home/z/my-project
SUITES="scripts/qa00-data-view.mjs scripts/qa35-minimap-touch.mjs scripts/qa35-pinch-clamp.mjs scripts/qa37-open-viewer.mjs scripts/qa37-turntable-cancel.mjs scripts/qa37-turntable-observe.mjs scripts/qa38-e2e.mjs scripts/qa39-e2e.mjs scripts/qa40-e2e.mjs scripts/qa41-e2e.mjs scripts/qa42-e2e.mjs scripts/qa43-e2e.mjs scripts/qa44-e2e.mjs scripts/qa45-e2e.mjs scripts/qa46-e2e.mjs scripts/qa47-e2e.mjs scripts/qa48-e2e.mjs scripts/qa49-e2e.mjs scripts/qa50-e2e.mjs scripts/qa51-e2e.mjs scripts/qa52-e2e.mjs scripts/qa53-e2e.mjs scripts/qa54-e2e.mjs scripts/qa55-e2e.mjs scripts/qa56-e2e.mjs scripts/qa57-e2e.mjs scripts/qa58-e2e.mjs scripts/qa59-e2e.mjs scripts/qa60-e2e.mjs scripts/qa61-e2e.mjs scripts/qa62-e2e.mjs scripts/qa63-smoke.mjs scripts/qa64-e2e.mjs scripts/qa66-e2e.mjs scripts/qa67-e2e.mjs scripts/qa68-e2e.mjs scripts/qa69-e2e.mjs scripts/qa70-e2e.mjs scripts/qa72-verify.mjs scripts/qa73-e2e.mjs scripts/qa75-e2e.mjs scripts/qa76-e2e.mjs scripts/qa77-e2e.mjs scripts/qa78-e2e.mjs scripts/qa79-e2e.mjs scripts/qa80-e2e.mjs scripts/qa81-e2e.mjs scripts/qa82-e2e.mjs scripts/qa83-e2e.mjs scripts/qa84-e2e.mjs scripts/t85-kpi-paper-probe.mjs scripts/t86-e2e.mjs scripts/t87-e2e.mjs scripts/t88-e2e.mjs scripts/t89-e2e.mjs scripts/t90-e2e.mjs scripts/t92-e2e.mjs scripts/t93-e2e.mjs scripts/t94-e2e.mjs scripts/t95-e2e.mjs scripts/t96-e2e.mjs scripts/t97-e2e.mjs scripts/t98-e2e.mjs scripts/t99-e2e.mjs scripts/t100-e2e.mjs scripts/t101-e2e.mjs"
FAILS=()
N=0
for s in $SUITES; do
  N=$((N+1))
  name=$(basename "$s")
  out=$(node "$s" 2>&1)
  if echo "$out" | grep -qE "ALL PASS|GREEN|SMOKE GREEN|PROBE OK|PAPER PROBE"; then
    echo "[$N/67] PASS $name"
  else
    echo "[$N/67] FAIL $name"
    echo "$out" | tail -6
    FAILS+=("$name")
  fi
done
echo "=================================="
echo "TOTAL ${#FAILS[@]} failures / $N suites"
for f in "${FAILS[@]}"; do echo "  FAILED: $f"; done

#!/bin/bash
# t927 census runner — the 24 node instruments at their standing values.
# Law: unset DATABASE_URL per invocation; lib-import units via unit-runner (bare node dies on @/lib).
cd /home/z/my-project
export DATABASE_URL=""
EXPECTED=(22 23 25 38 33 28 28 25 20 20 16 17 11 8 14 18 13 23 10 17 33 16 13 29)
declare -a NAMES=(
  "t892-denoise-chip-unit"
  "t830-keymap-chips-unit"
  "t905-clip-interval-unit"
  "t906-voxel-voice-unit"
  "t907-oblique-voice-unit"
  "t908-oblique-keyboard-unit"
  "t904-minimap-echo-unit"
  "t904-pair-baseline-unit"
  "t904-particles-hotpath-unit"
  "t911-canvas-strip-unit"
  "t912-dialog-gutter-unit"
  "t914-import-visibility-unit"
  "t945-convention-unit"
  "t947-compare-x-unit"
  "t949-mint-preview-unit"
  "t954-hidden-gate-unit"
  "t956-mint-guard-cure-unit"
  "t956-remote-page-unit"
  "t957-syntax-landmine-unit"
  "t957-picks-statcache-unit"
  "t959-http-envelope-unit"
  "t960-server-error-unit"
  "t961-msg-quality-unit"
  "t966-peek-fold-unit"
)
declare -a RUNNERS=(1 0 1 1 1 1 2 2 0 0 0 0 1 0 0 0 0 1 0 1 1 1 1 0)
i=0
for name in "${NAMES[@]}"; do
  unset DATABASE_URL
  if [ "${RUNNERS[$i]}" = "1" ]; then
    OUT=$(node scripts/unit-runner.mjs "scripts/${name}.mjs" 2>&1)
  elif [ "${RUNNERS[$i]}" = "2" ]; then
    OUT=$(node --import ./scripts/ts-alias-register.mjs "scripts/${name}.mjs" 2>&1)
  else
    OUT=$(node "scripts/${name}.mjs" 2>&1)
  fi
  CODE=$?
  COUNT=$(echo "$OUT" | grep -oE "[0-9]+/[0-9]+ green" | grep -oE "^[0-9]+" | head -1)
  if [ -z "$COUNT" ]; then
    COUNT=$(echo "$OUT" | grep -oE "[0-9]+ passed" | grep -oE "^[0-9]+" | head -1)
  fi
  if [ -z "$COUNT" ]; then
    COUNT=$(echo "$OUT" | grep -oE "PASS [0-9]+" | grep -oE "[0-9]+" | head -1)
  fi
  if [ -z "$COUNT" ]; then
    COUNT=$(echo "$OUT" | grep -oE "\([0-9]+ ok" | grep -oE "[0-9]+" | head -1)
  fi
  if [ "$CODE" = "0" ] && [ "$COUNT" = "${EXPECTED[$i]}" ]; then
    echo "GREEN ${name}: ${COUNT}/${EXPECTED[$i]}"
  else
    echo "RED   ${name}: exit=${CODE} count=${COUNT:-?} expected=${EXPECTED[$i]}"
    echo "$OUT" | tail -6 | sed 's/^/    /'
  fi
  i=$((i+1))
done

#!/bin/bash
# t927 census runner — the 53 node instruments at their standing values (t1082 added the resume-receipt unit; t1083 grew it 23→29 and added the lane-chip unit, the 43rd seat; t1084 grew the pointer-wall-echo unit 22→30; t1087 added the paper-census unit, the 44th seat; t1088 added the fuel-family unit, the 45th seat; t1089 added the print-honesty unit, the 46th seat; t1090 added the lazy-host unit, the 47th seat; t1091 added the receipt-ledger unit, the 48th seat — the canvas paper's second voice; t1092 added the inspector-paper unit, the 49th seat — the job report face's second pass; t1093 added the params-paper unit, the 50th seat — the diff brain's standalone face; t1094 added the fsc-paper unit, the 51st seat — the FSC compare's print face; t1095 added the stray-verify unit, the 52nd seat — the audit's borderline shapes cured at the source; t1096 added the filmstrip unit, the 53rd seat — the oblique cut's walk; t1098 added the ortho-filmstrip unit, the 54th seat — the walk's siblings (the axis filmstrips); t1099 added the trace-drag unit, the 55th seat — the trace's hand (the drag math); t1100 added the trace-turn unit, the 56th seat — the trace's second DOF (the endpoint turn); t1101 added the particles-decode unit, the 57th seat — the #8 deep band's split (the pure decode rides the parse's cache slot); t1102 added the paper unit, the 58th seat — the print-face arc's full walk + the roster's orphan cure).
# Law: unset DATABASE_URL per invocation; lib-import units via unit-runner (bare node dies on @/lib).
cd /home/z/my-project
export DATABASE_URL=""
EXPECTED=(22 23 25 38 33 28 28 25 20 20 16 17 11 8 14 28 13 23 10 17 33 16 22 32 91 23 63 33 18 45 28 30 14 13 11 48 9 19 19 24 17 29 7 16 16 11 10 16 15 20 20 16 20 20 17 19 17 9) # +seat 56 = t1100-trace-turn-unit (19 pins); +seat 57 = t1101-particles-decode-unit (17 pins); +seat 58 = t1102-paper-unit (9 pins, the arc's full walk + the roster's orphan cure)
# the bash-word law: NO trailing commas inside this array — in bash,
# "x", is ONE word (x,) — the comma joins the element and the runner
# hunts a file that does not exist
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
  "t970-failed-face-unit"
  "t975-dialog-family-unit"
  "t982-aria-refusal-unit"
  "t991-keyboard-resize-unit"
  "t996-picker-error-unit"
  "t997-keyboard-valuetext-unit"
  "t998-workspace-rename-unit"
  "t999-pointer-wall-echo-unit"
  "t1000-create-clear-unit"
  "t1001-dirty-draft-unit"
  "t1002-rename-busy-unit"
  "t1016-pace-subchain-unit"
  "t1020-stop-walk-unit"
  "t1021-import-fuel-unit"
  "t1022-fuel-face-unit"
  "t1023-watchdog-guard-unit"
  "t1024-dialog-fuel-unit"
  "t1082-resumed-from-unit"
  "t1083-lane-chip-unit"
  "t1087-paper-census-unit"
  "t1088-fuel-family-unit"
  "t1089-print-honesty-unit"
  "t1090-lazy-host-unit"
  "t1091-receipt-ledger-unit"
  "t1092-inspector-paper-unit"
  "t1093-params-paper-unit"
  "t1094-fsc-paper-unit"
  "t1095-stray-verify-unit"
  "t1096-filmstrip-unit"
  "t1098-ortho-filmstrip-unit"
  "t1099-trace-drag-unit"
  "t1100-trace-turn-unit"
  "t1101-particles-decode-unit"
  "t1102-paper-unit"
)
declare -a RUNNERS=(1 0 1 1 1 1 2 2 0 0 0 0 1 0 0 0 0 1 0 1 1 1 1 0 1 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 2 2 2 2 2 0)
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

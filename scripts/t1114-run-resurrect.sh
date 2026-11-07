#!/usr/bin/env bash
# t1114-run-resurrect.sh — the chunked resurrection runner (one breath,
# four foreground chunks; the healer's own --from/--to chunk law, t412:
# the sandbox's patrol reaps background node processes after ~7-8 min, so
# the chain runs in foreground chunks and each chunk's completed nodes
# keep their products — a killed chunk resumes at its --from).
#
# Usage: bash scripts/t1114-run-resurrect.sh
#   (idempotent: filled nodes — done + exit 0 + outputs on disk — skip)
set -u
cd "$(dirname "$0")/.."
LOG=scripts/t1114-resurrect.log
: > "$LOG"

run_chunk () { # label, healer args...
  local label="$1"; shift
  echo "=== chunk $label: $* ===" | tee -a "$LOG"
  node scripts/demo-chain-resurrect.mjs "$@" 2>&1 | tee -a "$LOG"
  local rc=${PIPESTATUS[0]}
  if [ "$rc" -ne 0 ]; then
    echo "chunk $label exited $rc — resume with: node scripts/demo-chain-resurrect.mjs $*" | tee -a "$LOG"
    exit "$rc"
  fi
}

# chunk 1 — bootstrap (bundle/connection/nodes/edges/params) + the chain head
run_chunk "head" --to class2d
# chunk 2 — the long pole alone (class2d's own 503s this world)
run_chunk "class2d" --from class2d --to select2d
# chunk 3 — the 3D staircase (select → initialmodel → class3d → symexpand)
run_chunk "staircase" --from select2d --to rebalance
# chunk 4 — the tail + the payoff surfaces (FSC/Guinier/official number)
run_chunk "tail" --from rebalance

echo "RESURRECTION COMPLETE — see $LOG" | tee -a "$LOG"

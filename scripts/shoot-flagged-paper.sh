#!/bin/bash
# shoot-flagged-paper.sh — the flagged-paper SHOOTER (t1111): the t1110
# flag law, written into the toolbox as an instrument.
#
# The law it encodes (t1110's deepest lesson): the paper's SHAPE is the
# flag's decision. The plate's print verb sets body[data-plate-print]
# (globals.css' print family then hides everything but the plate doc —
# the job report face stands down, the plate stands up), headless
# window.print() is a no-op, and the flag stands only ~8s (the verb's
# own reset timer) — so the pdf must be shot INSIDE that window. A pdf
# shot WITHOUT the flag is not a regression: it is the unflagged paper
# (the t1110 5-page mirage — report pages + plate pages), and the flag
# window is the only honest way to ride it.
#
# Usage: shoot-flagged-paper.sh <output.pdf>
# Assumes an agent-browser session already stands on the plate's dialog
# (the Mol* dialog open, the ortho panel expanded, a map present — the
# plate doc mounts under those). The shooter raises the flag and shoots;
# it does NOT drive the dialog chain (the chain drivers stay in the
# window's own hands).
#
# Returns 0 and prints GREEN when the pdf landed inside the flag window.

set -euo pipefail
OUT="${1:?usage: shoot-flagged-paper.sh <output.pdf>}"
cd /home/z/my-project
mkdir -p "$(dirname "$OUT")"

# 1 — raise the flag: click the plate's print verb (it sets
#     body[data-plate-print] and schedules its own reset)
agent-browser click '[data-canvas-ui="ortho-plate-print"]' >/dev/null 2>&1 || {
  echo "RED: could not click the plate print verb (ortho-plate-print) — is the plate's dialog open?" >&2
  exit 1
}

# 2 — poll for the flag (the click's own render tick; ~10s budget)
FLAG="false"
for i in $(seq 1 40); do
  FLAG=$(agent-browser eval "document.body.hasAttribute('data-plate-print')" 2>/dev/null | tr -d '"' || echo "false")
  [ "$FLAG" = "true" ] && break
  sleep 0.25
done
if [ "$FLAG" != "true" ]; then
  echo "RED: the plate-print flag never stood — the plate doc must be mounted (panel expanded, map present)" >&2
  exit 1
fi

# 3 — shoot INSIDE the window (the verb's own reset is ~8s — the pdf
#     call rides the same window it polled)
agent-browser pdf "$OUT" >/dev/null 2>&1 || {
  echo "RED: the pdf shot failed inside the flag window" >&2
  exit 1
}

[ -s "$OUT" ] || { echo "RED: the pdf landed empty" >&2; exit 1; }
echo "GREEN: $OUT shot inside the flag window ($(du -h "$OUT" | cut -f1))"

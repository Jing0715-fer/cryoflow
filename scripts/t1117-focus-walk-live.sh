#!/bin/bash
# t1117 — the slice/clip family's focus-visible LIVE walk (the real-key Tab law).
# Rides the ortho panel family: samples every Tab stop's ring shape.
# Usage: bash scripts/t1117-focus-walk-live.sh <startEvalSelectorJS> <stops>
set -u
START_JS="$1"
STOPS="${2:-30}"
OUT="${3:-/tmp/tabwalk1117.txt}"

agent-browser eval "$START_JS" >/dev/null 2>&1
sleep 0.4
rm -f "$OUT"
for i in $(seq 1 "$STOPS"); do
  agent-browser press Tab >/dev/null 2>&1
  sleep 0.15
  agent-browser eval "(()=>{const a=document.activeElement;if(!a||a===document.body)return 'BODY';const cs=getComputedStyle(a);const lab=cs.boxShadow.indexOf('lab(');const ring=lab>=0?cs.boxShadow.slice(lab,lab+60):'NONE';const label=(a.getAttribute('aria-label')||a.textContent.trim()||a.tagName).slice(0,44);return label+' || ring='+ring+' || op='+cs.opacity+' || out='+cs.outlineStyle})()" >> "$OUT" 2>&1
  echo "" >> "$OUT"
done
echo "walk done: $STOPS stops -> $OUT"

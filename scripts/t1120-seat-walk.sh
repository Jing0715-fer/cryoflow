#!/usr/bin/env bash
# t1120 — the thirty seats' live verification walk (t1118 walker re-cast).
# Rides the Mol* overlay opened from a fresh mic; real-key Tab per stop;
# ring sampled via boxShadow.indexOf('lab(') — NEVER split.
# t1119 lessons honored: walk FAST (overlay self-closes across 30-60s gaps),
# identity readout now also carries aria-label + data-state so the thirty
# outer-dark seats (bookmarks/turntable/export-scale/import-source) can be
# matched against the t1119 knife ledger by name, not just by ring.
# eval three laws: set +H; ${i} expansion; output via $(... | tail -1).
set -u
set +H
N="${1:-16}"
OUT="${2:-/tmp/t1120-walk.jsonl}"
: > "$OUT"
# stop 0 — where focus sits the moment the overlay opens (no Tab yet)
line=$(agent-browser eval "(()=>{const a=document.activeElement;if(a===null||a===undefined)return 'NO ACTIVE';const cs=getComputedStyle(a);const ring=cs.boxShadow.indexOf('lab(')>=0;const al=a.getAttribute('aria-label')||'';const st=a.getAttribute('data-state')||'';const pr=a.getAttribute('aria-pressed');return JSON.stringify({stop:0,el:a.tagName.toLowerCase(),al:String(al).slice(0,50),st:st.slice(0,12),pr:pr===null?'':pr,ring,ow:cs.outlineWidth})})()" 2>&1 | tail -1)
echo "$line" >> "$OUT"
case "$line" in
  *NO\ ACTIVE*|*BLIND*) echo "ABORT at stop 0"; exit 1;;
esac
for i in $(seq 1 "$N"); do
  agent-browser press Tab >/dev/null 2>&1
  sleep 1
  line=$(agent-browser eval "(()=>{const a=document.activeElement;if(a===null||a===undefined)return 'NO ACTIVE';const cs=getComputedStyle(a);const ring=cs.boxShadow.indexOf('lab(')>=0;const al=a.getAttribute('aria-label')||'';const st=a.getAttribute('data-state')||'';const pr=a.getAttribute('aria-pressed');return JSON.stringify({stop:${i},el:a.tagName.toLowerCase(),al:String(al).slice(0,50),st:st.slice(0,12),pr:pr===null?'':pr,ring,ow:cs.outlineWidth})})()" 2>&1 | tail -1)
  echo "$line" >> "$OUT"
  case "$line" in
    *NO\ ACTIVE*|*BLIND*) echo "{\"stop\":$i,\"el\":\"ABORT\",\"why\":\"anchor lost\"}" >> "$OUT"; break;;
  esac
done
echo "--- walk done ($N stops) -> $OUT"

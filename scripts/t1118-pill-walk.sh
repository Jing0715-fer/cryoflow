#!/usr/bin/env bash
# t1118 — the contour pill & clip panel's real-key Tab walk.
# Per stop: read the active element's identity + focus-visible ring shape
# (the sampler dialect: boxShadow read via indexOf('lab(') — NEVER split).
# Walks up to N Tab presses; each stop echoes one JSON line.
# t1115/t1118 lesson: interactive history expansion eats `!` inside double
# quotes (`if(!a)` → "event not found" on stderr, silenced by 2>/dev/null).
# set +H kills it; the `!`s are ALSO written out of the eval string.
set -u
set +H
N="${1:-40}"
OUT="${2:-/tmp/t1118-walk.jsonl}"
: > "$OUT"
for i in $(seq 1 "$N"); do
  agent-browser press Tab >/dev/null 2>&1
  sleep 1
  line=$(agent-browser eval "(()=>{const a=document.activeElement;if(a===null||a===undefined)return 'NO ACTIVE';const cs=getComputedStyle(a);const ring=cs.boxShadow.indexOf('lab(')>=0;const ow=cs.outlineWidth;const pr=a.getAttribute('aria-pressed');const prTxt=pr===null?'':' pressed='+pr;const lab=prTxt||a.getAttribute('aria-label')||a.textContent.trim().slice(0,30)||a.tagName;return JSON.stringify({stop:${i},el:a.tagName.toLowerCase(),lab:String(lab).slice(0,60),ring,ow})})()" 2>&1 | tail -1)
  echo "$line" >> "$OUT"
  case "$line" in
    *NO\ ACTIVE*|*BLIND*) echo "{\"stop\":$i,\"el\":\"ABORT\",\"why\":\"anchor lost\"}" >> "$OUT"; break;;
  esac
done
echo "--- walk done ($N stops) -> $OUT"

#!/usr/bin/env bash
# t1123 — the bare-button patrol's real-key walk: Tab from the top of the
# canvas, and at each stop report WHO the activeElement is and whether it
# carries a focus ring (boxShadow sampled by indexOf('lab(') — never split).
# The honest test: programmatic focus() does not speak :focus-visible; only
# real keyboard rides do. bash eval three laws: set +H, ${i} expansion,
# `> file 2>&1` ordering.
set -u
set +H

STOPS="${1:-14}"

for i in $(seq 1 "$STOPS"); do
  agent-browser press Tab > /dev/null 2>&1
  sleep 0.6
  line=$(agent-browser eval "(()=>{const a=document.activeElement;if(a===null||a===undefined)return 'NO ACTIVE';const cs=getComputedStyle(a);const ring=cs.boxShadow.indexOf('lab(')>=0;const label=a.getAttribute('aria-label')||a.getAttribute('data-testid')||a.getAttribute('title')||a.textContent.trim().slice(0,24);return JSON.stringify({stop:${i},el:a.tagName.toLowerCase(),label:label,ring:ring})})()" 2>&1 | tail -1)
  echo "stop ${i}: ${line}"
  case "$line" in
    *NO\ ACTIVE*|*BLIND*) echo "ANCHOR LOST — abort"; exit 1 ;;
  esac
done
echo "WALK-DONE"

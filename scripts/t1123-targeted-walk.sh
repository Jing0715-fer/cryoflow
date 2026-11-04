#!/usr/bin/env bash
# t1123 — the targeted re-walk: reset focus, then Tab until the named
# seat is reached; at that stop report the FULL computed boxShadow, the
# :focus-visible match and the ring classes — the honest deep probe for
# the two stops the first walk read as ring:false.
set -u
set +H
TARGET="${1:-RELION environment status}"
MAX="${2:-40}"

agent-browser eval "(()=>{const b=document.querySelector('[data-canvas-root]')||document.body;b.click&&b.click();return 'reset'})()" > /dev/null 2>&1
sleep 0.8

for i in $(seq 1 "$MAX"); do
  agent-browser press Tab > /dev/null 2>&1
  sleep 0.5
  line=$(agent-browser eval "(()=>{const a=document.activeElement;if(a===null||a===undefined)return 'NO ACTIVE';const label=a.getAttribute('aria-label')||a.getAttribute('data-testid')||a.textContent.trim().slice(0,30);return JSON.stringify({stop:${i},label:label.slice(0,44)})})()" 2>&1 | tail -1)
  case "$line" in
    *"$TARGET"*)
      deep=$(agent-browser eval "(()=>{const a=document.activeElement;const cs=getComputedStyle(a);return JSON.stringify({label:(a.getAttribute('aria-label')||'').slice(0,40),fv:a.matches(':focus-visible'),bs:cs.boxShadow.slice(0,200),outline:cs.outlineStyle+' '+cs.outlineWidth+' '+cs.outlineColor.slice(0,40)})})()" 2>&1 | tail -1)
      echo "HIT at stop ${i}: ${deep}"
      exit 0
      ;;
    *NO\ ACTIVE*) echo "ANCHOR LOST"; exit 1 ;;
  esac
done
echo "TARGET NOT REACHED in ${MAX} stops"
exit 1

#!/bin/bash
# t1037 live ride v2 — the cross-map carry on camera.
# v2: state-verify after every act (retry once), single-line evals,
# reopen the inspector before the half-map leg, tolerant eval unwrapping.
set -u
cd /home/z/my-project
SHOTS=shots-qa
step() { echo; echo "== $1 =="; }
# eval with the raw output shown (debugging honesty)
ev() { echo "  eval: $1" >&2; agent-browser eval "$1" 2>&1; }
# the slider census (one line, tolerant)
census() { ev 'JSON.stringify(Array.from(document.querySelectorAll("[role=slider]")).map(el=>(el.getAttribute("aria-label")||"").match(/along the (\w) axis/)?el.getAttribute("aria-label").match(/along the (\w) axis/)[1]+":"+el.getAttribute("aria-valuenow"):"sigma:"+el.getAttribute("aria-valuenow")))'; }

step "1. open home"
agent-browser open http://localhost:3000/ >/dev/null 2>&1
sleep 4

step "2. open the inspector"
agent-browser find role button click --name "3D Refine (tutorial)" 2>&1 | tail -1
sleep 3
ev 'JSON.stringify({inspector: !!document.querySelector("[role=dialog]})")})' >/dev/null 2>&1 || true

step "3. Enlarge run_class001 (retry until the quick-look opens)"
for i in 1 2 3; do
  agent-browser find role button click --name "Enlarge run_class001" >/dev/null 2>&1
  sleep 3
  Q=$(ev 'JSON.stringify(!!Array.from(document.querySelectorAll("[role=dialog]")).find(d=>(d.getAttribute("aria-label")||"").includes("run_class001")))')
  echo "$Q" | grep -q true && break
  echo "  quick-look not open (try $i)"
done

step "4. View in 3D (retry until the embed's clip toggle exists)"
for i in 1 2 3; do
  agent-browser find role button click --name "View in 3D (Mol*)" >/dev/null 2>&1
  for w in $(seq 1 20); do
    sleep 2
    N=$(ev 'JSON.stringify(document.querySelectorAll("button[aria-label=\"Toggle box clipping\"]").length)' | tr -d '"')
    [ "$N" = "1" ] && break 2
  done
done
echo "  embed ready (try $i, wait $((w*2))s)"

step "5. clip ON (verify pressed, retry once)"
agent-browser click "button[aria-label='Toggle box clipping']" >/dev/null 2>&1
sleep 2
P=$(ev 'JSON.stringify(document.querySelector("button[aria-label=\"Toggle box clipping\"]")?.getAttribute("aria-pressed"))' | tr -d '"')
if [ "$P" != "true" ]; then
  echo "  clip not pressed — retry"
  agent-browser click "button[aria-label='Toggle box clipping']" >/dev/null 2>&1
  sleep 2
  P=$(ev 'JSON.stringify(document.querySelector("button[aria-label=\"Toggle box clipping\"]")?.getAttribute("aria-pressed"))' | tr -d '"')
fi
echo "  clip pressed=$P"
census

step "6. the X track: click at 40% (lo thumb walks to 0.4)"
TRACK_JS='JSON.stringify((()=>{const ls=Array.from(document.querySelectorAll("[role=slider]"));const t=ls.find(el=>(el.getAttribute("aria-label")||"").includes("along the X axis"));const r=t.parentElement.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}})())'
RAW=$(ev "$TRACK_JS" | tail -1)
echo "  raw: $RAW"
BOX=$(echo "$RAW" | python3 -c "
import json,sys
s=sys.stdin.read().strip()
try: d=json.loads(s)
except Exception: d=json.loads(json.loads(s))
print(json.dumps(d))")
echo "  box: $BOX"
CX=$(python3 -c "import json;b=json.loads('''$BOX''');print(f'{b[\"x\"]+b[\"w\"]*0.40:.0f}')")
CY=$(python3 -c "import json;b=json.loads('''$BOX''');print(f'{b[\"y\"]+b[\"h\"]/2:.0f}')")
agent-browser mouse move "$CX" "$CY" >/dev/null 2>&1
agent-browser mouse down >/dev/null 2>&1
agent-browser mouse up >/dev/null 2>&1
sleep 1
census

step "7. the Y track: click at 60% (hi thumb walks to 0.6)"
TRACK_JS='JSON.stringify((()=>{const ls=Array.from(document.querySelectorAll("[role=slider]"));const t=ls.find(el=>(el.getAttribute("aria-label")||"").includes("along the Y axis"));const r=t.parentElement.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}})())'
RAW=$(ev "$TRACK_JS" | tail -1)
BOX=$(echo "$RAW" | python3 -c "
import json,sys
s=sys.stdin.read().strip()
try: d=json.loads(s)
except Exception: d=json.loads(json.loads(s))
print(json.dumps(d))")
CX=$(python3 -c "import json;b=json.loads('''$BOX''');print(f'{b[\"x\"]+b[\"w\"]*0.60:.0f}')")
CY=$(python3 -c "import json;b=json.loads('''$BOX''');print(f'{b[\"y\"]+b[\"h\"]/2:.0f}')")
agent-browser mouse move "$CX" "$CY" >/dev/null 2>&1
agent-browser mouse down >/dev/null 2>&1
agent-browser mouse up >/dev/null 2>&1
sleep 1
census
agent-browser screenshot "$SHOTS/t1037-ride-2-slab-shaped.png" 2>&1 | tail -1

step "8. the lens chip + the interval readouts"
ev 'JSON.stringify({chip:!!document.querySelector("[data-testid=clip-lens-row]"),x:document.querySelector("[data-testid=clip-interval-x]")?.textContent,y:document.querySelector("[data-testid=clip-interval-y]")?.textContent})'

step "9. close the dialog layers (Esc until gone, then reopen the inspector)"
for i in 1 2 3 4; do
  D=$(ev 'JSON.stringify(!!document.querySelector("[role=dialog]"))' | tr -d '"')
  [ "$D" = "false" ] && break
  agent-browser press Escape >/dev/null 2>&1
  sleep 2
done
echo "  dialogs closed (rounds=$i)"

step "10. the half-map leg: inspector → Enlarge run_half1 → View in 3D"
agent-browser find role button click --name "3D Refine (tutorial)" 2>&1 | tail -1
sleep 3
for i in 1 2 3; do
  agent-browser find role button click --name "Enlarge run_half1_class001_unfil" >/dev/null 2>&1
  sleep 3
  Q=$(ev 'JSON.stringify(!!Array.from(document.querySelectorAll("[role=dialog]")).find(d=>(d.getAttribute("aria-label")||"").includes("run_half1_class001_unfil")))')
  echo "$Q" | grep -q true && break
  echo "  quick-look not open (try $i)"
done
for i in 1 2 3; do
  agent-browser find role button click --name "View in 3D (Mol*)" >/dev/null 2>&1
  for w in $(seq 1 20); do
    sleep 2
    N=$(ev 'JSON.stringify(document.querySelectorAll("button[aria-label=\"Toggle box clipping\"]").length)' | tr -d '"')
    [ "$N" = "1" ] && break 2
  done
done
echo "  embed ready (try $i, wait $((w*2))s)"

step "11. THE OFFER ROW"
ev 'JSON.stringify({offer:!!document.querySelector("[data-testid=clip-lens-offer]"),text:document.querySelector("[data-testid=clip-lens-offer] span span")?.textContent||null,apply:!!document.querySelector("[data-testid=clip-lens-offer-apply]")})'
agent-browser screenshot "$SHOTS/t1037-ride-3-offer.png" 2>&1 | tail -1

step "12. APPLY the carry"
agent-browser click "[data-testid=clip-lens-offer-apply]" 2>&1 | tail -1
sleep 2
ev 'JSON.stringify({toast:Array.from(document.querySelectorAll("[data-sonner-toast]")).map(t=>t.textContent),offerGone:!document.querySelector("[data-testid=clip-lens-offer]"),chip:!!document.querySelector("[data-testid=clip-lens-row]")})'
census
agent-browser screenshot "$SHOTS/t1037-ride-4-carried.png" 2>&1 | tail -1

step "ride complete"

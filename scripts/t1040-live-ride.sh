#!/bin/bash
# t1040 live ride — the import family's teaching faces on camera:
#   (1) the pull-list's cap note + the views-first sort (the t1039 v3
#       catch's cure: the cap hid a row and said nothing)
#   (2) the dialog's pre-tick word (the t1039 witness: the entry arrived
#       pre-ticked and the dialog said nothing)
# Craft (t1039 v4's lessons compounded): agent-browser click for the Radix
# faces (the pointer-sequence law), el.click() for the plain onClick
# buttons, the "Import views"-specific dialog detection (the inspector's
# own dialog swallows [role=dialog]), state-verify every act.
set -u
cd /home/z/my-project
SHOTS=shots-qa
REFINE="cmv8ogdv2000usy89pd12v096"
SRC="cmv8ogdtt000msy894hlcu1kk"  # Initial Model — inside the 8-job cap
step() { echo; echo "== $1 =="; }
ev() { echo "  eval: $1" >&2; agent-browser eval "$1" 2>&1; }
closeall() {
  for i in 1 2 3 4 5; do
    agent-browser press Escape >/dev/null 2>&1
    sleep 2
    D=$(ev 'JSON.stringify(!!document.querySelector("[role=dialog]"))' | tr -d '"')
    P=$(ev 'JSON.stringify(!!document.querySelector("[data-canvas-ui=camera-bookmarks]"))' | tr -d '"')
    [ "$D" = "false" ] && [ "$P" = "false" ] && return 0
  done
  return 1
}
wait_js() {
  local js="$1" timeout="${2:-30}"
  for w in $(seq 1 $((timeout / 2))); do
    N=$(ev "$js" | tr -d '"')
    [ "$N" = "true" ] && return 0
    sleep 2
  done
  return 1
}
embed_ready_js='JSON.stringify(!!document.querySelector("button[aria-label=\"Toggle box clipping\"]")&&!!document.querySelector("[aria-label=\"Isosurface contour level in sigma\"]"))'
open_bookmarks() {
  for i in 1 2 3 4; do
    ev 'JSON.stringify(!!document.querySelector("[data-canvas-ui=camera-bookmarks]"))' | tr -d '"' | grep -q true && return 0
    agent-browser click 'button[aria-label^="Camera view bookmarks"]' >/dev/null 2>&1
    sleep 2
  done
  ev 'JSON.stringify(!!document.querySelector("[data-canvas-ui=camera-bookmarks]"))' | tr -d '"' | grep -q true
}

step "1. the probe on Initial Model (inside the 8-job cap) + the local mirror clean"
NOW=$(python3 -c "import time;print(int(time.time()*1000))")
python3 - > /tmp/t1040-probe.json <<EOF
import json
body={"bookmarks":[{"id":"bm-t1040-teach-probe","name":"t1040 teach probe","ts":$NOW,"snapshot":{"position":[1,2,3],"up":[0,1,0],"target":[0,0,0],"radius":10,"radiusMax":100,"fov":0.876,"fog":0,"clipFar":0,"minNear":0,"minFar":0},"view":{"sigma":2,"sign":1,"slice":{"on":False,"axis":"Z","pos":0.5},"clip":{"on":True,"x":0.5,"y":1,"z":1,"invert":False}}}]}
print(json.dumps(body))
EOF
curl -s -X PUT -H "Origin: http://localhost:3000" -H "Content-Type: application/json" --max-time 10 -d @/tmp/t1040-probe.json "http://localhost:3000/api/jobs/$SRC/camera-bookmarks" | head -c 40; echo " <- probe PUT"
agent-browser open http://localhost:3000/ >/dev/null 2>&1
sleep 8
ev "localStorage.removeItem('cryoflow.mol-camera-bookmarks:$REFINE'); localStorage.removeItem('cryoflow.mol-camera-bookmarks:$SRC'); 'mirrors-cleaned'" >/dev/null 2>&1
ev 'JSON.stringify({jobs:(document.body.innerText.match(/\d+ jobs/)||[])[0]||null})'

step "2. build the stack on 3D Refine (the import's target)"
for r in 1 2 3 4; do
  if [ "$(ev "$embed_ready_js" | tr -d '"')" = "true" ]; then echo "  [round $r] embed standing"; break; fi
  if ! ev 'JSON.stringify(!!document.querySelector("[role=dialog]"))' | tr -d '"' | grep -q true; then
    agent-browser find role button click --name "3D Refine (tutorial)" >/dev/null 2>&1; sleep 3
  fi
  ev 'JSON.stringify(!!document.querySelector("[role=dialog]"))' | tr -d '"' | grep -q true || { closeall; continue; }
  if ! wait_js "JSON.stringify(Array.from(document.querySelectorAll('[role=dialog] button')).some(b=>/Enlarge run_class001/.test(b.getAttribute('aria-label')||'')))" 40; then closeall; continue; fi
  ev "Array.from(document.querySelectorAll('[role=dialog] button')).find(b=>/Enlarge run_class001/.test(b.getAttribute('aria-label')||''))?.click(); 'ok'" >/dev/null 2>&1
  sleep 2
  ev 'Array.from(document.querySelectorAll("[role=dialog] button")).find(b=>/View in 3D/.test(b.textContent||""))?.click(); "ok"' >/dev/null 2>&1
  wait_js "$embed_ready_js" 90 && { echo "  [round $r] embed ready"; break; }
  closeall
done
[ "$(ev "$embed_ready_js" | tr -d '"')" = "true" ] || { echo "FATAL: the stack never stood"; exit 1; }
sleep 2

step "3. the bookmark door → From job → THE CAP NOTE + THE SORT"
open_bookmarks || { echo "FATAL: the bookmark door never opened"; exit 1; }
ev 'document.querySelector("button[aria-label=\"Import view bookmarks from another job\"]")?.click(); "ok"' >/dev/null 2>&1
if ! wait_js 'JSON.stringify(!!document.querySelector("[data-canvas-ui=from-job-list]"))' 20; then
  echo "FATAL: the from-job list never rendered"; exit 1
fi
sleep 3
ev 'JSON.stringify({rows:Array.from(document.querySelectorAll("[data-canvas-ui=from-job-list] button")).slice(0,3).map(b=>(b.textContent||"").trim().slice(0,40)),capNote:document.querySelector("[data-testid=from-job-cap-note]")?.textContent||null})'
agent-browser screenshot "$SHOTS/t1040-ride-1-cap-note.png" 2>&1 | tail -1

step "4. the import dialog → THE PRE-TICK WORD"
ev 'Array.from(document.querySelectorAll("[data-canvas-ui=from-job-list] button")).find(b=>/Initial Model \(tutorial\)/.test(b.textContent||""))?.click(); "ok"' >/dev/null 2>&1
if ! wait_js 'JSON.stringify(Array.from(document.querySelectorAll("[role=dialog]")).some(d=>/Import views/.test(d.textContent||"")))' 25; then
  echo "FATAL: the import dialog never opened"; exit 1
fi
sleep 1
ev 'JSON.stringify({pretick:document.querySelector("[data-testid=import-pretick-note]")?.textContent||null,desc:(document.querySelector("[role=dialog] p")?.textContent||"").slice(0,140)})'
agent-browser screenshot "$SHOTS/t1040-ride-2-pretick-word.png" 2>&1 | tail -1

step "5. as-left: cancel (no import — the t1039 ride owns the full-import witness) + sweep"
ev 'Array.from(document.querySelectorAll("[role=dialog] button")).find(b=>/^Cancel$/.test((b.textContent||"").trim()))?.click(); "ok"' >/dev/null 2>&1
sleep 1
ev 'JSON.stringify({dialogGone:!Array.from(document.querySelectorAll("[role=dialog]")).some(d=>/Import views/.test(d.textContent||""))})'
curl -s -X PUT -H "Origin: http://localhost:3000" -H "Content-Type: application/json" --max-time 10 -d '{"bookmarks":[]}' "http://localhost:3000/api/jobs/$SRC/camera-bookmarks" | head -c 40; echo " <- swept"
sleep 1
curl -s -H "Origin: http://localhost:3000" --max-time 10 "http://localhost:3000/api/jobs/$SRC/camera-bookmarks" | python3 -c "import json,sys;print('  initialmodel rows:',len(json.load(sys.stdin).get('bookmarks',[])))"

step "6. console + DB + home QA"
agent-browser console 2>&1 | rg -i "error" | rg -iv "errorboundary|error-overlay|Download the React|ChunkLoadError" | head -3; echo "  (empty above = console clean)"
ls -la db/cryoflow.db | awk '{print "  DB: " $5 " bytes"}'
closeall
sleep 1
agent-browser screenshot "$SHOTS/t1040-home-qa.png" 2>&1 | tail -1

step "ride complete"

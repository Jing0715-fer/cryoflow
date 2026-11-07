#!/bin/bash
# t1039 live ride v4 — the feature half on camera: import from job → the
# toast NAMES the source → the row's provenance chip. The mirror-cure half
# already witnessed at the API door (PUT with box+oblique → GET returns
# both — pre-cure sanitizeView stripped them).
#
# v3's catches: (a) the wait_js '[role=dialog]' check was swallowed by the
# INSPECTOR's own dialog — the import dialog must be detected SPECIFICALLY
# (its 'Import views' title); (b) the local mirror residue from earlier
# aborted rides polluted the shelf ('1 saved') — the ride cleans BOTH
# mirrors first (the honest as-found); (c) the tick must verify its OWN
# state (data-state=checked) before the confirm.
#
# Craft: agent-browser click (the trusted pointer sequence) for every
# Radix face (trigger, checkbox) with state-verify retries; el.click()
# for the plain onClick buttons inside the open surfaces; state-verify
# after every act; the stack rebuilds itself (re-entrant).
set -u
cd /home/z/my-project
SHOTS=shots-qa
POST="cmv8ogdv2000usy89pd12v096"  # the import TARGET: 3D Refine (the known-good stack)
MASK="cmv8ogdvb000wsy89ovn1cqm7"  # the import SOURCE: Mask Create
step() { echo; echo "== $1 =="; }
ev() { echo "  eval: $1" >&2; agent-browser eval "$1" 2>&1; }
toasts() { ev 'JSON.stringify(Array.from(document.querySelectorAll("ol.fixed li")).map(t=>(t.textContent||"").slice(0,140)))' | tail -1; }
toasthunt() {
  local label="$1" needle="$2"
  local T=""
  for i in $(seq 1 15); do
    T=$(toasts)
    if echo "$T" | grep -qE "$needle"; then
      echo "  TOAST CAUGHT ($label, poll $i): $T"
      return 0
    fi
    sleep 0.35
  done
  echo "  toast missed ($label): $T"
  return 1
}
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
build_stack() {
  local round="$1" jobname="$2" enlargere="$3"
  if [ "$(ev "$embed_ready_js" | tr -d '"')" = "true" ]; then
    echo "  [round $round] the embed panel already standing"
    return 0
  fi
  if ! ev 'JSON.stringify(!!document.querySelector("[role=dialog]"))' | tr -d '"' | grep -q true; then
    agent-browser find role button click --name "$jobname" >/dev/null 2>&1
    sleep 3
  fi
  if ! ev 'JSON.stringify(!!document.querySelector("[role=dialog]"))' | tr -d '"' | grep -q true; then
    echo "  [round $round] the inspector would not open"
    return 1
  fi
  if ! wait_js "JSON.stringify(Array.from(document.querySelectorAll('[role=dialog] button')).some(b=>/${enlargere}/.test(b.getAttribute('aria-label')||'')))" 40; then
    echo "  [round $round] the Enlarge button never rendered"
    return 1
  fi
  ev "Array.from(document.querySelectorAll('[role=dialog] button')).find(b=>/${enlargere}/.test(b.getAttribute('aria-label')||''))?.click(); 'ok'" >/dev/null 2>&1
  sleep 2
  if ! ev 'JSON.stringify(Array.from(document.querySelectorAll("[role=dialog] button")).some(b=>/View in 3D/.test(b.textContent||"")))' | tr -d '"' | grep -q true; then
    echo "  [round $round] the quick-look did not open"
    return 1
  fi
  ev 'Array.from(document.querySelectorAll("[role=dialog] button")).find(b=>/View in 3D/.test(b.textContent||""))?.click(); "ok"' >/dev/null 2>&1
  if ! wait_js "$embed_ready_js" 90; then
    echo "  [round $round] the embed panel never became ready"
    return 1
  fi
  echo "  [round $round] the embed panel is ready"
  return 0
}
ensure_stack() {
  for r in 1 2 3 4; do
    build_stack "$r" "$1" "$2" && return 0
    closeall
    sleep 3
  done
  return 1
}
open_bookmarks() {
  for i in 1 2 3 4; do
    ev 'JSON.stringify(!!document.querySelector("[data-canvas-ui=camera-bookmarks]"))' | tr -d '"' | grep -q true && return 0
    agent-browser click 'button[aria-label^="Camera view bookmarks"]' >/dev/null 2>&1
    sleep 2
  done
  ev 'JSON.stringify(!!document.querySelector("[data-canvas-ui=camera-bookmarks]"))' | tr -d '"' | grep -q true
}

step "1. open home + settle"
agent-browser open http://localhost:3000/ >/dev/null 2>&1
sleep 8
ev 'JSON.stringify({jobs:(document.body.innerText.match(/\d+ jobs/)||[])[0]||null})'

step "1.5. clean the local mirrors (the honest as-found — the earlier rides' residue out)"
REFINE_ID="cmv8ogdv2000usy89pd12v096"
ev "localStorage.removeItem('cryoflow.mol-camera-bookmarks:$REFINE_ID'); localStorage.removeItem('cryoflow.mol-camera-bookmarks:$MASK'); 'cleaned'" >/dev/null 2>&1

step "2. build the stack on 3D Refine (the import's target)"
ensure_stack "3D Refine (tutorial)" "Enlarge run_class001" || { echo "FATAL: the post stack never stood"; exit 1; }
sleep 3

step "3. the bookmark door → From job → Mask Create's row"
open_bookmarks || { echo "FATAL: the bookmark door never opened"; exit 1; }
ev 'JSON.stringify({doorOpen:true,count:(document.querySelector("button[aria-label^=\"Camera view bookmarks\"]")?.getAttribute("aria-label")||"")})'
ev 'document.querySelector("button[aria-label=\"Import view bookmarks from another job\"]")?.click(); "ok"' >/dev/null 2>&1
if ! wait_js 'JSON.stringify(!!document.querySelector("[data-canvas-ui=from-job-list]"))' 20; then
  echo "FATAL: the from-job list never rendered"; exit 1
fi
sleep 3
ev 'JSON.stringify(rows:Array.from(document.querySelectorAll("[data-canvas-ui=from-job-list] button")).map(b=>(b.textContent||"").trim().slice(0,50)))' 2>/dev/null | tail -1
ev 'Array.from(document.querySelectorAll("[data-canvas-ui=from-job-list] button")).find(b=>/Mask Create \(tutorial\)/.test(b.textContent||""))?.click(); "ok"' >/dev/null 2>&1
IMPORT_DIALOG_JS='JSON.stringify(Array.from(document.querySelectorAll("[role=dialog]")).some(d=>/Import views/.test(d.textContent||"")))'
if ! wait_js "$IMPORT_DIALOG_JS" 25; then
  echo "FATAL: the import dialog never opened"; exit 1
fi
sleep 1
ev 'JSON.stringify({sourceNamed:!!Array.from(document.querySelectorAll("[role=dialog] *")).find(s=>s.textContent==="Mask Create (tutorial)"&&s.children.length===0),entry:!!document.querySelector("button[aria-label=\"Import \\\"t1039 mirror probe\\\"\"]")})'
agent-browser screenshot "$SHOTS/t1039-ride-2-dialog-source.png" 2>&1 | tail -1

step "4. tick the entry (state-verified) + confirm Import 1"
TICKED=0
for i in 1 2 3 4; do
  ev 'document.querySelector("button[aria-label=\"Import \\\"t1039 mirror probe\\\"\"]")?.click(); "ok"' >/dev/null 2>&1
  sleep 1
  S=$(ev 'JSON.stringify(document.querySelector("button[aria-label=\"Import \\\"t1039 mirror probe\\\"\"]")?.getAttribute("data-state"))' | tr -d '"')
  echo "  tick attempt $i: data-state=$S"
  [ "$S" = "checked" ] && { TICKED=1; break; }
done
[ "$TICKED" = "1" ] || echo "  WARN: the tick never verified — the confirm may refuse"
ev 'Array.from(document.querySelectorAll("[role=dialog] button")).find(b=>/^Import 1$/.test((b.textContent||"").trim()))?.click(); "ok"' >/dev/null 2>&1
sleep 1
toasthunt "import" "Imported 1 view from"

step "5. THE CHIP — the row remembers its source"
ev 'JSON.stringify({row:!!Array.from(document.querySelectorAll("[data-canvas-ui=camera-bookmarks] button")).find(b=>/t1039 mirror probe/.test(b.textContent||"")),CHIP:!!document.querySelector("[data-testid=bm-src-chip]"),chipText:document.querySelector("[data-testid=bm-src-chip]")?.textContent||null})'
agent-browser screenshot "$SHOTS/t1039-ride-3-toast-chip.png" 2>&1 | tail -1

step "6. THE SERVER's src — the door's pass, live"
sleep 1
curl -s -H "Origin: http://localhost:3000" --max-time 10 "http://localhost:3000/api/jobs/$POST/camera-bookmarks" | python3 -c "
import json,sys
d=json.load(sys.stdin)
bs=d.get('bookmarks',[])
print('  rows:',len(bs),'| src:',bs[0].get('src') if bs else None,'| VERDICT:','WITNESSED' if bs and bs[0].get('src')=='Mask Create (tutorial)' else 'RED')"

step "7. as-left: sweep the imported row via the UI + the mask probe via the API"
ev 'document.querySelector("button[aria-label=\"Delete bookmark t1039 mirror probe\"]")?.click(); "ok"' >/dev/null 2>&1
sleep 1.5
ev 'JSON.stringify({probeGone:!Array.from(document.querySelectorAll("[data-canvas-ui=camera-bookmarks] button")).find(b=>/t1039 mirror probe/.test(b.textContent||""))})'
curl -s -X PUT -H "Origin: http://localhost:3000" -H "Content-Type: application/json" --max-time 10 -d '{"bookmarks":[]}' "http://localhost:3000/api/jobs/$MASK/camera-bookmarks" | head -c 60; echo
sleep 1
curl -s -H "Origin: http://localhost:3000" --max-time 10 "http://localhost:3000/api/jobs/cmv8ogdv2000usy89pd12v096/camera-bookmarks" | python3 -c "import json,sys;print('  refine rows:',len(json.load(sys.stdin).get('bookmarks',[])))"
curl -s -H "Origin: http://localhost:3000" --max-time 10 "http://localhost:3000/api/jobs/$MASK/camera-bookmarks" | python3 -c "import json,sys;print('  mask rows:',len(json.load(sys.stdin).get('bookmarks',[])))"

step "8. console + DB honesty"
agent-browser console 2>&1 | rg -i "error" | rg -iv "errorboundary|error-overlay|Download the React" | head -3; echo "  (empty above = console clean)"
ls -la db/cryoflow.db | awk '{print "  DB: " $5 " bytes"}'

step "9. home QA"
closeall
sleep 1
agent-browser screenshot "$SHOTS/t1039-home-qa.png" 2>&1 | tail -1

step "ride complete"

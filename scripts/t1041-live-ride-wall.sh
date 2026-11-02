#!/bin/bash
set -u
cd /home/z/my-project
IM="cmv8ogdtt000msy894hlcu1kk"
REFINE="cmv8ogdv2000usy89pd12v096"
ev() { echo "  eval: $1" >&2; agent-browser eval "$1" 2>&1; }

TS=$(node -e 'console.log(Date.now())')
cat > /tmp/t1041-bm-a.json <<EOF
{"bookmarks":[{"id":"t1041-optics-probe","name":"t1041 optics probe","ts":${TS},
"snapshot":{"mode":"fullmap","fov":0.876,"position":[0,0,2.2],"up":[0,1,0],"target":[0,0,0]},
"view":{"sigma":3.2,"sign":1,"slice":{"on":false,"axis":"Z","pos":0.5},
"clip":{"on":true,"x":1,"y":1,"z":0.7,"invert":false,"box":{"lo":[0.25,0,0],"hi":[1,1,1]}},
"focus":{"x":0.5,"y":0.42,"z":0.5},
"oblique":{"on":true,"theta":60,"phi":45,"offset":0.25,"invert":false}}}]}
EOF
curl -s -o /dev/null -w '  PUT A → %{http_code}\n' -X PUT -H "Origin: http://localhost:3000" -H "Content-Type: application/json" --data @/tmp/t1041-bm-a.json "http://localhost:3000/api/jobs/${IM}/camera-bookmarks"
TS2=$(node -e 'console.log(Date.now())')
cat > /tmp/t1041-bm-b.json <<EOF
{"bookmarks":[{"id":"t1041-provenance-probe","name":"t1041 mirror probe","ts":${TS2},
"snapshot":{"mode":"fullmap","fov":0.876,"position":[0,0,2.2],"up":[0,1,0],"target":[0,0,0]},
"view":{"sigma":2,"sign":1,"slice":{"on":false,"axis":"Z","pos":0.5},"clip":{"on":false,"x":1,"y":1,"z":1,"invert":false}},
"src":"Initial Model (tutorial)"}]}
EOF
curl -s -o /dev/null -w '  PUT B → %{http_code}\n' -X PUT -H "Origin: http://localhost:3000" -H "Content-Type: application/json" --data @/tmp/t1041-bm-b.json "http://localhost:3000/api/jobs/${REFINE}/camera-bookmarks"

agent-browser open http://localhost:3000/ >/dev/null 2>&1
sleep 5
agent-browser click 'button[role="tab"][title="Project dashboard (Shift+D toggles)"]' 2>&1 | head -1
sleep 6
ev 'window.dispatchEvent(new Event("cryoflow:saved-views-changed")); "ok"' >/dev/null 2>&1
N=0
for i in $(seq 1 15); do
  N=$(ev 'JSON.stringify(document.querySelectorAll("[data-saved-view-card]").length)' | tr -d '"')
  [ "$N" != "0" ] && [ -n "$N" ] && break
  sleep 2
done
echo "  wall cards: ${N:-0}"
# scroll the wall into view and WAIT for the cards to be IN THE VIEWPORT
ev 'const c=document.querySelector("[data-saved-view-card]"); c?.scrollIntoView({block:"center"}); "scrolled"' >/dev/null 2>&1
sleep 2
VIS=$(ev 'JSON.stringify((()=>{const c=document.querySelector("[data-saved-view-card]"); if(!c) return false; const r=c.getBoundingClientRect(); return r.top>=0 && r.bottom<=window.innerHeight;})())' | tr -d '"')
echo "  card in viewport: ${VIS}"
agent-browser screenshot shots-qa/t1041-ride-1b-wall-chips.png 2>&1 | head -1
ev 'JSON.stringify({
  wallChip: document.querySelector("[data-testid=wall-src-chip]")?.textContent ?? null,
  opticsCard: Array.from(document.querySelectorAll("[data-saved-view-card]")).map(c=>c.textContent).find(t=>t.includes("optics probe"))?.slice(0,120) ?? null
})'
# SWEEP LAST — after the camera
curl -s -o /dev/null -w '  sweep A → %{http_code}\n' -X PUT -H "Origin: http://localhost:3000" -H "Content-Type: application/json" -d '{"bookmarks":[]}' "http://localhost:3000/api/jobs/${IM}/camera-bookmarks"
curl -s -o /dev/null -w '  sweep B → %{http_code}\n' -X PUT -H "Origin: http://localhost:3000" -H "Content-Type: application/json" -d '{"bookmarks":[]}' "http://localhost:3000/api/jobs/${REFINE}/camera-bookmarks"
sleep 1
curl -s -H "Origin: http://localhost:3000" "http://localhost:3000/api/views/gallery" | python3 -c "import json,sys; n=sum(len(v['bookmarks']) for v in json.load(sys.stdin).get('views',[])); print('  gallery:',n); assert n==0"
stat -c '  DB: %s bytes' /home/z/my-project/db/cryoflow.db
# LEG-4 LEDGER (the ride's own laws, in order of birth):
#   leg1: the palette chip landed (build d6e9b86) — the wall leg failed:
#     Shift+D is a TOGGLE (the pre-warm had already parked the dashboard —
#     the ride toggled BACK to the canvas), and an API-crafted bookmark
#     fires NO saved-views-changed event (the broadcast belongs to the UI
#     mutation mouths) — a wall mounted before the craft stays stale-empty.
#   leg3: the Dashboard TAB (button[role=tab][title*="Project dashboard"])
#     clicked directly — the pointer-sequence law; the event dispatched —
#     the cards landed (2), but the screenshot fired BEFORE the sweep and
#     was then OVERWRITTEN by a post-sweep re-shoot (the wall already
#     empty) — THE CAMERA LAW: the screenshot lands BEFORE the sweep, and
#     a re-shoot re-crafts first.
#   leg4 (this file): craft → tab-click (state verified) → event →
#     scroll-into-view → VIEWPORT-verified → screenshot → sweep LAST.

#!/bin/bash
# t1041 live ride — the provenance chip meets the aggregate doors, and the
# wall's chip row catches up (both faces on camera):
#   (1) the wall card's provenance chip (wall-src-chip) + the palette row's
#       chip (palette-src-chip) — the t1039 lineage no longer stops at the
#       viewer's own list
#   (2) the wall's five-chip family — σ / clip box / focus / cut on one
#       card, and the local save staying chipless (the honest absent face)
# Craft discipline (the t1039/t1040 law): the standing world's gallery is
# empty (the as-left sweeps), so the ride crafts its witnesses, photographs
# them, and SWEEPS them — the ride plane left clean, the DB high-water held.
set -u
cd /home/z/my-project
SHOTS=shots-qa
IM="cmv8ogdtt000msy894hlcu1kk"   # Initial Model (tutorial) — the optics probe (no src)
REFINE="cmv8ogdv2000usy89pd12v096" # 3D Refine (tutorial) — the provenance probe (src)
ORIGIN='-H "Origin: http://localhost:3000"'

step() { echo; echo "== $1 =="; }
ev() { echo "  eval: $1" >&2; agent-browser eval "$1" 2>&1; }

step "1 — craft the optics probe (Initial Model, NO src — the local-save face)"
TS=$(node -e 'console.log(Date.now())')
cat > /tmp/t1041-bm-a.json <<EOF
{"bookmarks":[{"id":"t1041-optics-probe","name":"t1041 optics probe","ts":${TS},
"snapshot":{"mode":"fullmap","fov":0.876,"position":[0,0,2.2],"up":[0,1,0],"target":[0,0,0]},
"view":{"sigma":3.2,"sign":1,"slice":{"on":false,"axis":"Z","pos":0.5},
"clip":{"on":true,"x":1,"y":1,"z":0.7,"invert":false,"box":{"lo":[0.25,0,0],"hi":[1,1,1]}},
"focus":{"x":0.5,"y":0.42,"z":0.5},
"oblique":{"on":true,"theta":60,"phi":45,"offset":0.25,"invert":false}}}]}
EOF
CODE=$(curl -s -o /tmp/t1041-put-a.json -w '%{http_code}' -X PUT -H "Origin: http://localhost:3000" -H "Content-Type: application/json" --data @/tmp/t1041-bm-a.json "http://localhost:3000/api/jobs/${IM}/camera-bookmarks")
echo "  PUT A → ${CODE}"; [ "$CODE" = "200" ] || { echo "FATAL: craft A failed"; cat /tmp/t1041-put-a.json; exit 1; }

step "2 — craft the provenance probe (3D Refine, src padded to witness the trim)"
TS2=$(node -e 'console.log(Date.now())')
cat > /tmp/t1041-bm-b.json <<EOF
{"bookmarks":[{"id":"t1041-provenance-probe","name":"t1041 mirror probe","ts":${TS2},
"snapshot":{"mode":"fullmap","fov":0.876,"position":[0,0,2.2],"up":[0,1,0],"target":[0,0,0]},
"view":{"sigma":2,"sign":1,"slice":{"on":false,"axis":"Z","pos":0.5},"clip":{"on":false,"x":1,"y":1,"z":1,"invert":false}},
"src":"  Initial Model (tutorial)  "}]}
EOF
CODE=$(curl -s -o /tmp/t1041-put-b.json -w '%{http_code}' -X PUT -H "Origin: http://localhost:3000" -H "Content-Type: application/json" --data @/tmp/t1041-bm-b.json "http://localhost:3000/api/jobs/${REFINE}/camera-bookmarks")
echo "  PUT B → ${CODE}"; [ "$CODE" = "200" ] || { echo "FATAL: craft B failed"; cat /tmp/t1041-put-b.json; exit 1; }

step "3 — the mirror cure witnessed at the API door (GET round-trips)"
sleep 1
curl -s -H "Origin: http://localhost:3000" "http://localhost:3000/api/jobs/${IM}/camera-bookmarks" | python3 -c "
import json,sys
d=json.load(sys.stdin); b=[x for x in d.get('bookmarks',[]) if x['id']=='t1041-optics-probe']
assert b, 'probe A missing'
v=b[0].get('view',{})
print('  A view keys:', sorted(v.keys()))
print('  A clip.box:', v.get('clip',{}).get('box'))
print('  A oblique:', v.get('oblique'))
print('  A focus:', v.get('focus'))
print('  A src:', b[0].get('src'), '(must be None — local save stays chipless)')
assert v.get('clip',{}).get('box') and v.get('oblique',{}).get('on') and v.get('focus') and b[0].get('src') is None
print('  MIRROR A OK')"
curl -s -H "Origin: http://localhost:3000" "http://localhost:3000/api/jobs/${REFINE}/camera-bookmarks" | python3 -c "
import json,sys
d=json.load(sys.stdin); b=[x for x in d.get('bookmarks',[]) if x['id']=='t1041-provenance-probe']
assert b, 'probe B missing'
print('  B src:', repr(b[0].get('src')))
assert b[0].get('src')=='Initial Model (tutorial)', 'the trim failed'
print('  MIRROR B OK — src passed the door trimmed')"

step "4 — the aggregate door carries both (GET /api/views/gallery)"
curl -s -H "Origin: http://localhost:3000" "http://localhost:3000/api/views/gallery" | python3 -c "
import json,sys
d=json.load(sys.stdin); vs=d.get('views',[])
rows={b['id']:(v,b) for v in vs for b in v['bookmarks']}
a=rows.get('t1041-optics-probe'); b=rows.get('t1041-provenance-probe')
assert a, 'A missing from the aggregate'
assert b, 'B missing from the aggregate'
print('  aggregate A: src=', a[1].get('src'), 'view oblique=', (a[1].get('view') or {}).get('oblique',{}).get('on'))
print('  aggregate B: src=', repr(b[1].get('src')))
assert a[1].get('src') is None and (a[1].get('view') or {}).get('oblique',{}).get('on') is True
assert b[1].get('src')=='Initial Model (tutorial)'
print('  AGGREGATE OK — the provenance + the optics travel')"

step "5 — the wall on camera (Shift+D → dashboard, wait for the cards)"
agent-browser open http://localhost:3000/ >/dev/null 2>&1
sleep 4
agent-browser press Shift+d >/dev/null 2>&1
sleep 3
for i in $(seq 1 15); do
  N=$(ev 'JSON.stringify(document.querySelectorAll("[data-saved-view-card]").length)' | tr -d '"')
  [ "$N" != "0" ] && [ -n "$N" ] && break
  sleep 2
done
echo "  wall cards: ${N:-0}"
agent-browser screenshot "$SHOTS/t1041-ride-1-wall-chips.png" 2>&1 | head -1

step "6 — the wall's faces verified in the DOM"
ev 'JSON.stringify({
  cards: document.querySelectorAll("[data-saved-view-card]").length,
  wallChip: document.querySelector("[data-testid=wall-src-chip]")?.textContent ?? null,
  wallChipTitle: document.querySelector("[data-testid=wall-src-chip]")?.getAttribute("title") ?? null,
  cardTexts: Array.from(document.querySelectorAll("[data-saved-view-card]")).map(c => c.textContent.slice(0,120))
})'

step "7 — the palette on camera (Ctrl+K → saved view rows)"
agent-browser press Control+k >/dev/null 2>&1
sleep 2
agent-browser keyboard type "saved view" >/dev/null 2>&1
sleep 2
for i in $(seq 1 10); do
  P=$(ev 'JSON.stringify(!!document.querySelector("[data-testid=palette-src-chip]"))' | tr -d '"')
  [ "$P" = "true" ] && break
  sleep 2
done
echo "  palette-src-chip present: ${P:-false}"
agent-browser screenshot "$SHOTS/t1041-ride-2-palette-chip.png" 2>&1 | head -1
ev 'JSON.stringify({
  chip: document.querySelector("[data-testid=palette-src-chip]")?.textContent ?? null,
  chipTitle: document.querySelector("[data-testid=palette-src-chip]")?.getAttribute("title") ?? null,
  row: document.querySelector("[data-palette-savedview-row]")?.textContent?.slice(0,120) ?? null
})'
agent-browser press Escape >/dev/null 2>&1; sleep 1

step "8 — SWEEP (the ride plane left clean)"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X PUT -H "Origin: http://localhost:3000" -H "Content-Type: application/json" -d '{"bookmarks":[]}' "http://localhost:3000/api/jobs/${IM}/camera-bookmarks")
echo "  sweep A → ${CODE}"
CODE=$(curl -s -o /dev/null -w '%{http_code}' -X PUT -H "Origin: http://localhost:3000" -H "Content-Type: application/json" -d '{"bookmarks":[]}' "http://localhost:3000/api/jobs/${REFINE}/camera-bookmarks")
echo "  sweep B → ${CODE}"
sleep 1
curl -s -H "Origin: http://localhost:3000" "http://localhost:3000/api/views/gallery" | python3 -c "
import json,sys
d=json.load(sys.stdin); n=sum(len(v['bookmarks']) for v in d.get('views',[]))
print('  gallery after sweep:', n, 'bookmarks')
assert n==0, 'the sweep failed'
print('  SWEEP OK')"

step "9 — the as-left checks (world + DB + console)"
curl -s -H "Origin: http://localhost:3000" "http://localhost:3000/api/projects" | python3 -c "
import json,sys
d=json.load(sys.stdin); p=d['projects'][0]
s=p['stats']; print('  world:', s['total'], 'jobs ·', s['completed'], 'completed ·', s['failed'], 'failed ·', s['total']-s['completed']-s['failed'], 'idle')
assert s['total']==22 and s['completed']==15 and s['failed']==4
print('  WORLD OK')"
stat -c '  DB: %s bytes' /home/z/my-project/db/cryoflow.db
agent-browser console 2>&1 | grep -iE 'error' | grep -viE 'Fast Refresh|ChunkLoadError|map download failed' | head -5
echo "  console scan done (dev-churn faces excluded)"
echo
echo "RIDE COMPLETE"

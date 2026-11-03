#!/bin/bash
# t1043 live ride — the share-save's API-door witness (t1042's honest gap).
#
# BANKED this window (the script's own legs 1–4 FATAL'd twice; the
# witness was banked by the manual continuation after the cold-chunk
# cure, and the script below is the re-runnable shape of that cure):
#   DOOR WITNESS (poll 1): {"name":"t1043 api ride",
#     "src":"Initial Model (tutorial)","ts":true,"view":true}
#   — the padded wire payload arrived TRIMMED at the API door (the J1
#   wire-memory law's door face, witnessed server-side), the row chip
#   wore `from Initial Model (tutorial)` on camera
#   (shots-qa/t1043-ride-row-chip.png), the PUT settled in <1s.
#
# THE COLD-CHUNK LAW (born this ride, the J4 law's door face): after a
# commit that touches the embed module graph, the FIRST viewer mounts
# race the dev server's on-demand chunk compiles — each 404'd chunk
# raises ChunkLoadError and Next.js's NEXT_CONSOLE_ERROR auto-recovery
# RELOADS the page, killing the armed observer (window.__t1043 came
# back "no-obs" three rides in a row). The chunks compile one per
# failed mount; the cure is patience: re-mount until the console stops
# printing `[error] (molstar) init failed ChunkLoadError`, then ride —
# the warm-chunk mount survives (witnessed: save clicked at poll 7).
#
# The seat: t1042's ride banked four faces on camera (landing, restore,
# kept toasts; the mirror row's birth stamp at byte level) but the save's
# own PUT never reached the API door — the dev server's mid-churn
# auto-recovery RELOADED the page between the save and the witness,
# killing the in-flight PUT (the J4 churn-reload law). The wire-level
# round-trip was pinned by the unit's E band; the DOOR witness stayed
# unbanked. This ride re-runs the save on a fresh mount and POLLS THE
# DOOR with patience — the PUT settling witnessed server-side, the row's
# src arriving TRIMMED at the API (the J1 wire-memory law's door face).
#
# Laws applied (t1042's own ledger):
#   J3 THE TOAST-LIFE LAW — the observer is armed BEFORE the mount; the
#      Save click rides within ms of the toast's birth.
#   J5 THE MIRROR-KEY LAW — the sweep uses the REAL key
#      `cryoflow.mol-camera-bookmarks:${jobId}` (DOT after cryoflow);
#      t1042's save-script sweep used the colon-dash guess and swept
#      nothing — the law's own origin.
#   J6 THE TRUSTED-NODE LAW — the canvas job node opens only under the
#      trusted pointer, by the SHORT name (find fails on the em-dash
#      long name).
#   J7 THE INSPECTOR-TAB LAW — Results tab FIRST, then Enlarge, then
#      verify the quick-look EXISTS before View in 3D.
#   THE ORIGIN LAW — every curl QA sends `-H "Origin: http://localhost:3000"`.
#   THE CAMERA LAW — every screenshot lands BEFORE the sweep.
set -u
cd /home/z/my-project
REFINE="cmv8ogdv2000usy89pd12v096"
ev() { echo "  eval: $1" >&2; agent-browser eval "$1" 2>&1; }

PAYLOAD=$(node -e '
const p = {
  jobId: "cmv8ogdv2000usy89pd12v096",
  projectId: "cmv8nhqxo0000sy8934xli45t",
  name: "t1043 api ride",
  snapshot: { mode: "fullmap", fov: 0.876, position: [0, 0, 2.2], up: [0, 1, 0], target: [0, 0, 0] },
  view: { sigma: 2, sign: 1, slice: { on: false, axis: "Z", pos: 0.5 }, clip: { on: false, x: 1, y: 1, z: 1, invert: false } },
  src: "  Initial Model (tutorial)  ",
};
const json = JSON.stringify({ ...p, v: 1 });
console.log(btoa(encodeURIComponent(json)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
')
URL="http://localhost:3000/?view=${PAYLOAD}"

echo "== 1. the fresh mount (the churn-reload cure: no reload after this) =="
agent-browser open "${URL}" >/dev/null 2>&1
sleep 5

echo "== 2. the stack (each step verified before the next) =="
agent-browser find role button click --name "3D Refine (tutorial)" >/dev/null 2>&1
sleep 3
agent-browser eval 'JSON.stringify(!!document.querySelector("[role=dialog]"))' | grep -q true || { echo "FATAL: no inspector"; exit 1; }
agent-browser eval 'Array.from(document.querySelectorAll("[role=dialog] button")).find(b=>b.textContent.trim()==="Results")?.click(); "ok"' >/dev/null 2>&1
sleep 2
agent-browser eval 'Array.from(document.querySelectorAll("[role=dialog] button")).find(b=>(b.getAttribute("aria-label")||"")==="Enlarge run_class001")?.click(); "ok"' >/dev/null 2>&1
V="0"
for i in 1 2 3 4 5 6; do
  V=$(agent-browser eval 'JSON.stringify(Array.from(document.querySelectorAll("[role=dialog] button")).filter(b=>/View in 3D/.test(b.textContent||"")).length)' | tr -d '"')
  [ "$V" != "0" ] && break
  sleep 2
done
[ "$V" != "0" ] || { echo "FATAL: the quick-look never opened"; exit 1; }
echo "  quick-look ready"

echo "== 3. the observer armed BEFORE the mount (the toast-life law) =="
ev '(() => { window.__t1043 = { saved: false, at: null }; const obs = new MutationObserver(() => { const b = Array.from(document.querySelectorAll("ol.fixed li button")).find(x=>/Save this view/.test(x.textContent||"")); if (b && !window.__t1043.saved) { window.__t1043.saved = true; window.__t1043.at = Date.now(); b.click(); } }); obs.observe(document.body, { childList: true, subtree: true }); return "observer armed"; })()' 2>&1 | tail -1

echo "== 4. the mount (View in 3D) =="
agent-browser eval 'Array.from(document.querySelectorAll("[role=dialog] button")).find(b=>/View in 3D/.test(b.textContent||""))?.click(); "fired"' >/dev/null 2>&1
for i in $(seq 1 90); do
  S=$(agent-browser eval 'JSON.stringify(window.__t1043 ? window.__t1043.saved : "no-obs")' 2>/dev/null | tr -d '"')
  [ "$S" = "true" ] && { echo "  save clicked (poll $i)"; break; }
  sleep 0.5
done
[ "$S" = "true" ] || { echo "FATAL: the save never clicked"; exit 1; }

echo "== 5. THE WITNESS — the PUT settles at the door (patient poll) =="
ROW=""
for i in $(seq 1 30); do
  ROW=$(curl -s -H "Origin: http://localhost:3000" "http://localhost:3000/api/jobs/${REFINE}/camera-bookmarks" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const b=(JSON.parse(d).bookmarks||[]).find(x=>x.name==='t1043 api ride');console.log(b?JSON.stringify({name:b.name,src:b.src}):'')})" 2>/dev/null)
  [ -n "$ROW" ] && { echo "  DOOR WITNESS (poll $i): ${ROW}"; break; }
  sleep 1
done
[ -n "$ROW" ] || { echo "FATAL: the row never reached the door"; }
echo "$ROW" | grep -q '"src":"Initial Model (tutorial)"' && echo "  THE SRC ARRIVED TRIMMED AT THE DOOR (the wire law's door face)" || echo "  WARN: src not trimmed / absent at the door"

echo "== 6. the kept toast + the row chip on camera (BEFORE the sweep) =="
KEPT=$(ev 'JSON.stringify(Array.from(document.querySelectorAll("ol.fixed li")).map(t=>(t.textContent||"").slice(0,220)).filter(t=>/kept|remembers/.test(t)))' 2>/dev/null | tail -1)
echo "  kept: ${KEPT}"
agent-browser screenshot shots-qa/t1043-ride-api-door.png 2>&1 | tail -1
agent-browser click 'button[aria-label^="Camera view bookmarks"]' >/dev/null 2>&1
sleep 2
CHIP=$(ev 'JSON.stringify(!!document.querySelector("[data-testid=bm-src-chip]"))' 2>/dev/null | tr -d '"')
echo "  bm-src-chip present: ${CHIP}"

echo "== 7. THE SWEEP (the REAL mirror key — the J5 law) + the world gate =="
for i in 1 2 3; do agent-browser press Escape >/dev/null 2>&1; sleep 1; done
ev 'localStorage.removeItem("cryoflow.mol-camera-bookmarks:cmv8ogdv2000usy89pd12v096"); sessionStorage.removeItem("cryoflow:pending-shared-view"); sessionStorage.removeItem("cryoflow:pending-share-consumed"); "mirrors cleaned"' >/dev/null 2>&1
curl -s -o /dev/null -w '  PUT [] -> %{http_code}\n' -X PUT -H "Origin: http://localhost:3000" -H "Content-Type: application/json" --data '{"bookmarks":[]}' "http://localhost:3000/api/jobs/${REFINE}/camera-bookmarks"
sleep 1
curl -s -H "Origin: http://localhost:3000" "http://localhost:3000/api/jobs/${REFINE}/camera-bookmarks" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log('  post-sweep rows:', (JSON.parse(d).bookmarks||[]).length)})"
curl -s -H "Origin: http://localhost:3000" http://localhost:3000/api/views/gallery | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log('  gallery:', (JSON.parse(d).views||[]).length)})"
node -e "
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('db/cryoflow.db', { readOnly: true });
const jobs = db.prepare('SELECT status, COUNT(*) c FROM Job GROUP BY status').all();
const edges = db.prepare('SELECT COUNT(*) c FROM Edge').get().c;
const sessions = db.prepare('SELECT COUNT(*) c FROM BookmarkSession').get().c;
console.log('  jobs:', jobs.map(j=>j.status+'='+j.c).join(' '), '| total edges:', edges, '| bookmark sessions:', sessions);
db.close();
"
stat -c '  db bytes: %s' db/cryoflow.db
echo "RIDE DONE"

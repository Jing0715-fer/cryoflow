#!/bin/bash
# t1042 live ride part 2 — the save face + the chip + the API witness + the sweep.
#
# The legs' lessons (in this header, per the standing discipline):
#   - the landing STAGES the pose; the CONSUME fires only when the map
#     viewer mounts (the t822 handshake — the landing toast itself says
#     "open the map in the 3D viewer"). Part 1 caught the landing toast;
#     this part opens the viewer (the t1039 pointer sequence: job node →
#     inspector → Enlarge run_class001 → View in 3D → embed ready) and
#     catches the restore toast.
#   - I7 THE CAMERA LAW — every screenshot lands BEFORE the sweep.
#   - THE ORIGIN LAW — every curl sends -H "Origin: http://localhost:3000".
#   - THE AS-FOUND DISCIPLINE — BookmarkSession 0 rows, gallery 0; the
#     sweep restores it (PUT []) and the world gate re-verifies 22 · 14.
set -u
cd /home/z/my-project
REFINE="cmv8ogdv2000usy89pd12v096"
ev() { echo "  eval: $1" >&2; agent-browser eval "$1" 2>&1; }
wait_js() {
  local js="$1" timeout="${2:-30}"
  for w in $(seq 1 $((timeout / 2))); do
    N=$(ev "$js" | tr -d '"')
    [ "$N" = "true" ] && return 0
    sleep 2
  done
  return 1
}
toasts() { ev 'JSON.stringify(Array.from(document.querySelectorAll("ol.fixed li")).map(t=>(t.textContent||"").slice(0,180)))' | tail -1; }

echo "== 1. the viewer stack (the t1039 pointer sequence) =="
agent-browser find role button click --name "3D Refine (tutorial)" >/dev/null 2>&1
sleep 3
if ! wait_js 'JSON.stringify(!!document.querySelector("[role=dialog]"))' 20; then echo "FATAL: the inspector never opened"; exit 1; fi
ev 'Array.from(document.querySelectorAll("[role=dialog] button")).find(b=>/Enlarge run_class001/.test(b.getAttribute("aria-label")||""))?.click(); "ok"' >/dev/null 2>&1
sleep 3
if ! ev 'JSON.stringify(Array.from(document.querySelectorAll("[role=dialog] button")).some(b=>/View in 3D/.test(b.textContent||"")))' | tr -d '"' | grep -q true; then echo "FATAL: the quick-look never opened"; exit 1; fi
ev 'Array.from(document.querySelectorAll("[role=dialog] button")).find(b=>/View in 3D/.test(b.textContent||""))?.click(); "ok"' >/dev/null 2>&1
if ! wait_js 'JSON.stringify(!!document.querySelector("button[aria-label=\"Toggle box clipping\"]")&&!!document.querySelector("[aria-label=\"Isosurface contour level in sigma\"]"))' 90; then echo "FATAL: the embed never became ready"; exit 1; fi
echo "  the embed panel is ready"
sleep 2

echo "== 2. the restore toast (the consume block fires on mount) =="
REST=""
for i in $(seq 1 15); do
  REST=$(toasts)
  if echo "$REST" | grep -q "Shared view restored"; then echo "  RESTORE TOAST CAUGHT (poll $i): $REST"; break; fi
  sleep 1
done
echo "$REST" | grep -q "Shared view restored" || { echo "FATAL: the restore toast never spoke: $REST"; exit 1; }
agent-browser screenshot shots-qa/t1042-ride-3-restore-toast.png 2>&1 | tail -1

echo "== 3. the save (the birth stamp) =="
ev 'Array.from(document.querySelectorAll("ol.fixed li button")).find(b=>/Save this view/.test(b.textContent||""))?.click(); "ok"' >/dev/null 2>&1
sleep 1
KEPT=""
for i in $(seq 1 10); do
  KEPT=$(toasts)
  if echo "$KEPT" | grep -q "Shared view kept"; then echo "  KEPT TOAST CAUGHT (poll $i): $KEPT"; break; fi
  sleep 1
done
echo "$KEPT" | grep -q "Shared view kept" || echo "  WARN: the kept toast not caught: $KEPT"
agent-browser screenshot shots-qa/t1042-ride-4-kept-toast.png 2>&1 | tail -1

echo "== 4. the API witness (the birth stamp at the door) =="
curl -s -H "Origin: http://localhost:3000" "http://localhost:3000/api/jobs/${REFINE}/camera-bookmarks" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);const b=j.bookmarks||[];console.log('  rows:',b.length,'| names:',b.map(x=>x.name).join(','),'| srcs:',b.map(x=>JSON.stringify(x.src)).join(','))})"

echo "== 5. the row chip on camera (the bookmark menu) =="
agent-browser click 'button[aria-label^="Camera view bookmarks"]' >/dev/null 2>&1
sleep 2
CHIP=$(ev 'JSON.stringify(!!document.querySelector("[data-testid=bm-src-chip]"))' | tr -d '"')
echo "  bm-src-chip present: ${CHIP}"
agent-browser screenshot shots-qa/t1042-ride-5-row-chip.png 2>&1 | tail -1

echo "== 6. THE SWEEP (restore the as-found) =="
for i in 1 2 3; do agent-browser press Escape >/dev/null 2>&1; sleep 1; done
ev 'localStorage.removeItem("cryoflow:camera-bookmarks-cmv8ogdv2000usy89pd12v096"); sessionStorage.removeItem("cryoflow:pending-shared-view"); "mirrors cleaned"' >/dev/null 2>&1
curl -s -o /dev/null -w '  PUT [] -> %{http_code}\n' -X PUT -H "Origin: http://localhost:3000" -H "Content-Type: application/json" --data '{"bookmarks":[]}' "http://localhost:3000/api/jobs/${REFINE}/camera-bookmarks"
sleep 1
curl -s -H "Origin: http://localhost:3000" "http://localhost:3000/api/jobs/${REFINE}/camera-bookmarks" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log('  post-sweep rows:', (JSON.parse(d).bookmarks||[]).length)})"
curl -s -H "Origin: http://localhost:3000" http://localhost:3000/api/views/gallery | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{console.log('  gallery:', (JSON.parse(d).views||[]).length)})"
echo "== 7. the world gate =="
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

#!/bin/bash
# t1045 live ride — the remote-monitor seat on camera (the t300 bind-and-restore).
#
# The seat's presence law: the project's OWN binding decides. This
# world's one project is LOCAL (projects.json remote: null — the live
# connection conn-mv8ogdoy exists in the registry but the project is
# not bound to it), so the seat's ABSENCE here is the law's honest
# face. The ride therefore binds through the product's OWN t300 door
# (the t930 witness precedent: PATCH /api/projects/[id] with
# remoteConnectionId), rides the seat end-to-end on camera, and
# UNBINDS in the tail — the as-left equals the as-found (the binding
# is the ride's only mutation, reverted before the sweep ends).
#
# Laws applied: J6 (the trusted pointer), THE ORIGIN LAW (every curl
# sends -H "Origin: http://localhost:3000"), THE CAMERA LAW (the
# screenshot lands BEFORE the sweep), THE ESCAPED-QUOTES LESSON (grep
# the unquoted fragment).
set -u
cd /home/z/my-project
PROJECT="cmv8nhqxo0000sy8934xli45t"
CONN="conn-mv8ogdoy"
ev() { echo "  eval: $1" >&2; agent-browser eval "$1" 2>&1; }

echo "== 0. the ground =="
agent-browser open http://localhost:3000/ >/dev/null 2>&1
sleep 5

echo "== 1. the absence face FIRST (a local project carries none — the law's honest face) =="
agent-browser find role button click --name "3D Refine (tutorial)" >/dev/null 2>&1
sleep 3
ABSENT=$(ev 'JSON.stringify({seat: !!document.querySelector("[data-testid=inspector-remote-monitor-seat]")})' 2>/dev/null | tail -1)
echo "  seat on a LOCAL project: ${ABSENT}"
echo "$ABSENT" | grep -q 'seat...false' || { echo "FATAL: the seat should be ABSENT on a local project (a lying seat!)"; exit 1; }
for i in 1 2 3; do agent-browser press Escape >/dev/null 2>&1; sleep 0.6; done

echo "== 2. the t300 bind (the product's own door — the t930 precedent) =="
curl -s -o /dev/null -w '  PATCH bind -> %{http_code}\n' -X PATCH -H "Origin: http://localhost:3000" -H "Content-Type: application/json" --data "{\"remoteConnectionId\":\"${CONN}\"}" "http://localhost:3000/api/projects/${PROJECT}"

echo "== 3. the reload (the store re-reads the binding) + the stack =="
agent-browser open http://localhost:3000/ >/dev/null 2>&1
sleep 5
agent-browser find role button click --name "3D Refine (tutorial)" >/dev/null 2>&1
sleep 3
agent-browser eval 'JSON.stringify(!!document.querySelector("[role=dialog]"))' | grep -q true || { echo "FATAL: no inspector after bind"; exit 1; }

echo "== 4. the seat present (the t300 binding speaks) =="
SEAT=$(ev 'JSON.stringify({seat: !!document.querySelector("[data-testid=inspector-remote-monitor-seat]"), label: document.querySelector("[data-testid=inspector-remote-monitor-seat]")?.getAttribute("aria-label") || null})' 2>/dev/null | tail -1)
echo "  seat: ${SEAT}"
echo "$SEAT" | grep -q 'seat...true' || { echo "FATAL: the seat is absent on a BOUND project"; exit 1; }

echo "== 5. the bell rings — the cluster dialog opens (the handshake end-to-end) =="
agent-browser click '[data-testid=inspector-remote-monitor-seat]' >/dev/null 2>&1
sleep 2
BELL=$(ev 'JSON.stringify({dialogs: document.querySelectorAll("[role=dialog]").length, clusterFace: document.body.innerText.includes("Remote clusters") || document.body.innerText.includes("connection")})' 2>/dev/null | tail -1)
echo "  bell: ${BELL}"
agent-browser screenshot shots-qa/t1045-ride-monitor-seat.png 2>&1 | tail -1

echo "== 6. the trio still words (dispatch / monitor / eraser) =="
for i in 1 2 3 4; do agent-browser press Escape >/dev/null 2>&1; sleep 0.7; done
DISPATCH=$(ev 'JSON.stringify({dispatch: !!document.querySelector("button[aria-label=\"Run on cluster (SSH)\"]"), monitor: !!document.querySelector("[data-testid=inspector-remote-monitor-seat]"), eraser: !!document.querySelector("button[aria-label=\"Clean intermediates (local + cluster)\"]")})' 2>/dev/null | tail -1)
echo "  trio: ${DISPATCH}"

echo "== 7. THE UNBIND (the as-left = the as-found) =="
curl -s -o /dev/null -w '  PATCH unbind -> %{http_code}\n' -X PATCH -H "Origin: http://localhost:3000" -H "Content-Type: application/json" --data '{"remoteConnectionId":null}' "http://localhost:3000/api/projects/${PROJECT}"
node -e "const f=require('/home/z/my-project/data/projects.json'); console.log('  projects.json remote after unbind:', JSON.stringify(f.projects[process.argv[1]].remote))" "${PROJECT}"

echo "== 8. the world gate =="
node -e "
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('db/cryoflow.db', { readOnly: true });
const jobs = db.prepare('SELECT status, COUNT(*) c FROM Job GROUP BY status').all();
console.log('  world:', jobs.map(j=>j.status+'='+j.c).join(' '), '| edges:', db.prepare('SELECT COUNT(*) c FROM Edge').get().c, '| sessions:', db.prepare('SELECT COUNT(*) c FROM BookmarkSession').get().c);
db.close();
"
stat -c '  db bytes: %s' db/cryoflow.db
echo "RIDE DONE"

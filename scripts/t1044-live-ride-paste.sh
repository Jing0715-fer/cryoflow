#!/bin/bash
# t1044 live ride — the paste door on camera.
#
# The seat: the palette's paste face (t1044) lands a colleague's shared
# view link from inside the palette — the select tries the clipboard
# first, the inline input catches what the clipboard cannot, and the
# LANDING's own handshake (stage → drive → toast) does the rest. This
# ride banks the face on camera: the input mouth (headless Chrome
# gates the clipboard read — the honest fallback IS the ride), the
# landed toast with the lineage tail, the job landing, and the guest
# law's negative pin at byte level (no row births).
#
# Laws applied:
#   J3 THE TOAST-LIFE LAW — the toast catch rides INTERLEAVED (0.4s
#      polls from the Enter press, before screenshot latency can die).
#   J6 THE TRUSTED-NODE LAW — cmdk rows take the CSS selector (the
#      trusted pointer), never find --name on a long value.
#   J8 THE COLD-CHUNK LAW — no viewer mount is needed for the landing
#      toast (the drive lands the job, the toast speaks); any inspector
#      opened is Escaped out BEFORE the sweep.
#   THE ORIGIN LAW — every curl QA sends `-H "Origin: http://localhost:3000"`.
#   THE CAMERA LAW — every screenshot lands BEFORE the sweep.
#
# BANKED this window (all polls 1 — instant): the input mouth (the
# clipboard gated headless — the honest fallback face), the landed toast
# with the TRIMMED lineage tail (shots-qa/t1044-ride-landed-toast.png),
# the job landing (Job inspector: 3D Refine (tutorial)), and the guest
# law at byte level (api rows 0, mirror false — the paste birthed no row).
#
# THE ESCAPED-QUOTES LESSON (the ride's own catch): agent-browser eval
# returns JSON-ENCODED strings — the inner quotes arrive backslash-
# escaped ("input":true becomes \"input\":true), so a grep pattern with
# literal quotes never matches. Grep the unquoted fragment (input...true)
# or JSON-decode before matching.
set -u
cd /home/z/my-project
REFINE="cmv8ogdv2000usy89pd12v096"
ev() { echo "  eval: $1" >&2; agent-browser eval "$1" 2>&1; }

PAYLOAD=$(node -e '
const p = {
  jobId: "cmv8ogdv2000usy89pd12v096",
  projectId: "cmv8nhqxo0000sy8934xli45t",
  name: "t1044 paste ride",
  snapshot: { mode: "fullmap", fov: 0.876, position: [0, 0, 2.2], up: [0, 1, 0], target: [0, 0, 0] },
  view: { sigma: 2, sign: 1, slice: { on: false, axis: "Z", pos: 0.5 }, clip: { on: false, x: 1, y: 1, z: 1, invert: false } },
  src: "  Initial Model (tutorial)  ",
};
const json = JSON.stringify({ ...p, v: 1 });
console.log(btoa(encodeURIComponent(json)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
')
LINK="http://localhost:3000/?view=${PAYLOAD}"

echo "== 0. the ground (home, settled) =="
agent-browser open http://localhost:3000/ >/dev/null 2>&1
sleep 5

echo "== 1. the palette opens (Ctrl+K) =="
agent-browser press "Control+k" >/dev/null 2>&1
sleep 2
agent-browser eval 'JSON.stringify(!!document.querySelector("[cmdk-root]"))' | grep -q true || { echo "FATAL: no palette"; exit 1; }
echo "  palette open"

echo "== 2. the paste row exists =="
ROW=$(ev 'JSON.stringify({row: !!document.querySelector("[data-testid=palette-paste-share]"), label: document.querySelector("[data-testid=palette-paste-share]")?.textContent?.trim().slice(0,40)})' 2>/dev/null | tail -1)
echo "  row: ${ROW}"

echo "== 3. the input mouth (clipboard gated headless — the honest fallback) =="
agent-browser click '[data-testid=palette-paste-share]' >/dev/null 2>&1
sleep 1.5
IN=$(ev 'JSON.stringify({input: !!document.querySelector("[data-testid=palette-paste-input]"), focused: document.activeElement?.getAttribute("data-testid") === "palette-paste-input"})' 2>/dev/null | tail -1)
echo "  input: ${IN}"
echo "$IN" | grep -q 'input...true' || { echo "FATAL: the input never grew"; exit 1; }

echo "== 4. the link pastes, Enter commits =="
agent-browser fill '[data-testid=palette-paste-input]' "${LINK}" >/dev/null 2>&1
agent-browser press Enter >/dev/null 2>&1
LANDED=""
for i in $(seq 1 40); do
  LANDED=$(ev 'JSON.stringify(Array.from(document.querySelectorAll("ol.fixed li")).map(t=>(t.textContent||"").slice(0,200)).filter(t=>/Shared view landed/.test(t)))' 2>/dev/null | tail -1)
  echo "$LANDED" | grep -q "Shared view landed" && { echo "  LANDED TOAST (poll $i)"; break; }
  sleep 0.4
done
[ -n "$LANDED" ] && echo "  toast: $(echo "$LANDED" | head -c 260)"
[ -n "$LANDED" ] || { echo "FATAL: no landed toast"; }
agent-browser screenshot shots-qa/t1044-ride-landed-toast.png 2>&1 | tail -1

echo "== 5. the job landed (the canvas speaks the payload's job) =="
sleep 2
agent-browser eval 'JSON.stringify({inspector: !!document.querySelector("[role=dialog]"), title: document.querySelector("[role=dialog] [data-canvas-ui=inspector-title], [role=dialog] h2, [role=dialog] header")?.textContent?.trim().slice(0,60) || null})' 2>/dev/null | tail -1

echo "== 6. the guest law at byte level (no row births) =="
curl -s -H "Origin: http://localhost:3000" "http://localhost:3000/api/jobs/${REFINE}/camera-bookmarks" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const b=JSON.parse(d).bookmarks||[];const hit=b.find(x=>/t1044/.test(x.name||''));console.log('  rows:',b.length,'| t1044 row:',hit?JSON.stringify(hit.name):'NONE (the guest law holds)')})"
MIRROR=$(ev 'JSON.stringify({mirror: !!localStorage.getItem("cryoflow.mol-camera-bookmarks:cmv8ogdv2000usy89pd12v096")})' 2>/dev/null | tail -1)
echo "  mirror row: ${MIRROR}"

echo "== 7. THE SWEEP (the as-left) =="
for i in 1 2 3 4; do agent-browser press Escape >/dev/null 2>&1; sleep 0.8; done
agent-browser press "Control+k" >/dev/null 2>&1; sleep 1
agent-browser press Escape >/dev/null 2>&1; sleep 0.5
ev 'sessionStorage.removeItem("cryoflow:pending-shared-view"); sessionStorage.removeItem("cryoflow:pending-share-consumed"); "staged keys cleaned"' 2>&1 | tail -1
node -e "
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('db/cryoflow.db', { readOnly: true });
const jobs = db.prepare('SELECT status, COUNT(*) c FROM Job GROUP BY status').all();
const sessions = db.prepare('SELECT COUNT(*) c FROM BookmarkSession').get().c;
console.log('  world:', jobs.map(j=>j.status+'='+j.c).join(' '), '| sessions:', sessions);
db.close();
"
stat -c '  db bytes: %s' db/cryoflow.db
echo "RIDE DONE"

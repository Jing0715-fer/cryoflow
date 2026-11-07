#!/bin/bash
# t1042 live ride — the provenance crosses the link, on camera.
#
# The legs' lessons (t1041's laws honored):
#   I5 THE STALE-AGGREGATE LAW — not needed this ride: no aggregate is
#      mounted before a craft; the link IS the craft.
#   I6 THE VIEW-STATE LAW — the URL landing drives its own state; no
#      toggle is pressed.
#   I7 THE CAMERA LAW — every screenshot lands BEFORE the sweep; a
#      re-shoot re-crafts first.
#   THE ORIGIN LAW — every curl sends -H "Origin: http://localhost:3000".
#   THE AS-FOUND DISCIPLINE — BookmarkSession 0 rows, gallery 0, world
#      22 jobs · 14 edges, DB 155648 bytes. The sweep restores ALL of it.
set -u
cd /home/z/my-project
REFINE="cmv8ogdv2000usy89pd12v096"
PROJ="cmv8nhqxo0000sy8934xli45t"
IM="cmv8ogdtt000msy894hlcu1kk"
ev() { echo "  eval: $1" >&2; agent-browser eval "$1" 2>&1; }

# ---- the crafted link: the payload carries a PADDED memory (the decode
# door's trim law witnessed on camera — the toast must speak the TRIMMED
# label) ----
PAYLOAD=$(node -e '
const p = {
  jobId: "cmv8ogdv2000usy89pd12v096",
  projectId: "cmv8nhqxo0000sy8934xli45t",
  name: "t1042 link ride",
  snapshot: { mode: "fullmap", fov: 0.876, position: [0, 0, 2.2], up: [0, 1, 0], target: [0, 0, 0] },
  view: { sigma: 2, sign: 1, slice: { on: false, axis: "Z", pos: 0.5 }, clip: { on: false, x: 1, y: 1, z: 1, invert: false } },
  src: "  Initial Model (tutorial)  ",
};
const json = JSON.stringify({ ...p, v: 1 });
console.log(btoa(encodeURIComponent(json)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""));
')
URL="http://localhost:3000/?view=${PAYLOAD}"
echo "== ride URL length: ${#URL}"

# ---- leg 1: the landing toast (the lineage speaks on arrival) ----
agent-browser open "${URL}" >/dev/null 2>&1
sleep 3
# clean the QA browser's mirror at the ride's head (the as-left discipline)
ev 'localStorage.removeItem("cryoflow:camera-bookmarks-cmv8ogdv2000usy89pd12v096"); "mirror cleaned"' >/dev/null 2>&1
LAND=""
for i in $(seq 1 12); do
  LAND=$(ev '(() => { const els=[...document.querySelectorAll("[data-sonner-toast], [role=status], li")]; const t=els.find(e=>e.textContent && e.textContent.includes("Shared view landed")); return t ? JSON.stringify(t.textContent.slice(0,160)) : "none"; })()' | tr -d '"')
  [ "$LAND" != "none" ] && [ -n "$LAND" ] && break
  sleep 2
done
echo "LEG1 landing toast: ${LAND}"
agent-browser screenshot shots-qa/t1042-ride-1-landing-toast.png 2>&1 | tail -1

# ---- leg 2: the restore toast (the viewer consumes the staged pose) ----
REST=""
for i in $(seq 1 20); do
  REST=$(ev '(() => { const els=[...document.querySelectorAll("[data-sonner-toast], [role=status], li")]; const t=els.find(e=>e.textContent && e.textContent.includes("Shared view restored")); return t ? JSON.stringify(t.textContent.slice(0,200)) : "none"; })()' | tr -d '"')
  [ "$REST" != "none" ] && [ -n "$REST" ] && break
  sleep 2
done
echo "LEG2 restore toast: ${REST}"
agent-browser screenshot shots-qa/t1042-ride-2-restore-toast.png 2>&1 | tail -1

echo "RIDE PART 1 DONE (toasts on camera) — part 2 (save + chip + sweep) rides separately"

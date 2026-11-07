#!/bin/bash
# t1042 live ride A (re-craft per the I7 camera law — a re-shoot re-crafts
# first): the full reload re-stages via the landing; the toast poll is
# INTERLEAVED with the embed-ready wait (1s cadence) so the restore toast
# is caught the moment it fires; the Save click rides within the toast's
# own life.
set -u
cd /home/z/my-project
REFINE="cmv8ogdv2000usy89pd12v096"
ev() { echo "  eval: $1" >&2; agent-browser eval "$1" 2>&1; }

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

echo "== re-craft: the full reload re-stages via the landing =="
agent-browser open "${URL}" >/dev/null 2>&1
sleep 5

echo "== the viewer stack (Results tab FIRST — the part-2 lesson) =="
agent-browser find role button click --name "3D Refine (tutorial)" >/dev/null 2>&1
sleep 3
agent-browser eval 'JSON.stringify(!!document.querySelector("[role=dialog]"))' | grep -q true || { echo "FATAL: no inspector"; exit 1; }
agent-browser eval 'Array.from(document.querySelectorAll("[role=dialog] button")).find(b=>b.textContent.trim()==="Results")?.click(); "ok"' >/dev/null 2>&1
sleep 2
agent-browser eval 'Array.from(document.querySelectorAll("[role=dialog] button")).find(b=>(b.getAttribute("aria-label")||"")==="Enlarge run_class001")?.click(); "ok"' >/dev/null 2>&1
sleep 2
agent-browser eval 'Array.from(document.querySelectorAll("[role=dialog] button")).find(b=>/View in 3D/.test(b.textContent||""))?.click(); "ok"' >/dev/null 2>&1
echo "  stack fired — the interleaved catch begins"

echo "== the interleaved catch: embed-ready AND the restore toast, 1s cadence =="
CAUGHT=""
for i in $(seq 1 60); do
  T=$(agent-browser eval 'JSON.stringify(Array.from(document.querySelectorAll("ol.fixed li")).map(t=>(t.textContent||"").slice(0,200)).filter(t=>/Shared view/.test(t)))' 2>/dev/null | tail -1)
  R=$(agent-browser eval 'JSON.stringify(!!document.querySelector("button[aria-label=\"Toggle box clipping\"]"))' 2>/dev/null | tr -d '"')
  if echo "$T" | grep -q "restored"; then CAUGHT="$T"; echo "  TOAST CAUGHT (poll $i, embed=$R): $CAUGHT"; break; fi
  [ "$R" = "true" ] && [ $i -gt 30 ] && break
  sleep 1
done
[ -n "$CAUGHT" ] || { echo "FATAL: the toast never caught"; exit 1; }
agent-browser screenshot shots-qa/t1042-ride-3-restore-toast.png 2>&1 | tail -1

echo "== the save rides NOW (within the toast's life) =="
ev 'Array.from(document.querySelectorAll("ol.fixed li button")).find(b=>/Save this view/.test(b.textContent||""))?.click(); "save clicked"' >/dev/null 2>&1
KEPT=""
for i in $(seq 1 8); do
  K=$(agent-browser eval 'JSON.stringify(Array.from(document.querySelectorAll("ol.fixed li")).map(t=>(t.textContent||"").slice(0,200)).filter(t=>/kept|remembers/.test(t)))' 2>/dev/null | tail -1)
  if echo "$K" | grep -q "kept"; then KEPT="$K"; echo "  KEPT TOAST (poll $i): $KEPT"; break; fi
  sleep 1
done
agent-browser screenshot shots-qa/t1042-ride-4-kept-toast.png 2>&1 | tail -1

echo "== the API witness =="
curl -s -H "Origin: http://localhost:3000" "http://localhost:3000/api/jobs/${REFINE}/camera-bookmarks" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);const b=j.bookmarks||[];console.log('  rows:',b.length,'| names:',b.map(x=>x.name).join(','),'| srcs:',b.map(x=>JSON.stringify(x.src)).join(','))})"
echo "RIDE A DONE"

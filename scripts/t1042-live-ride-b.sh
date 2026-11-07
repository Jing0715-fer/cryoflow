#!/bin/bash
# t1042 live ride B — the save face via the pre-installed observer.
#
# Ride A's lesson: the restore toast's life (~4s) is shorter than
# screenshot+eval latency — the Save button died before the hand could
# reach it. The cure: install the auto-save observer BEFORE the viewer
# mounts (the plain onClick button — el.click() is lawful per the t1039
# lesson); the observer clicks Save within ms of the toast's birth, and
# the kept-toast catch rides at 0.5s cadence.
#
# THE RIDE'S FINAL LEDGER (all four legs' lessons, for the next window):
#   - THE TOAST-LIFE LAW (born ride A): a ~4s toast cannot be caught by
#     screenshot+eval latency AFTER its trigger — catch it INTERLEAVED
#     (ride A's 1s poll banked the restore toast at poll 5) or arm an
#     observer BEFORE the trigger (ride B banked the kept toast at
#     poll 1, both toasts in one stack frame).
#   - THE CHURN-RELOAD HAZARD: the dev server's mid-churn auto-recovery
#     (the ChunkLoadError face) RELOADS the page mid-ride — a queued PUT
#     dies with the navigation (ride B's save: the mirror kept the row,
#     the server never saw it; window.__t1042 came back null). The API
#     witness of a save's own PUT must ride BEFORE any churn window, or
#     ride a fresh mount instead (the mirror row survives reloads —
#     localStorage outlives the tab's JS heap).
#   - THE MIRROR KEY LAW: the shelf's mirror key is
#     `cryoflow.mol-camera-bookmarks:${jobId}` (DOT after cryoflow) —
#     NOT the colon-dash guess; sweeping the wrong key sweeps nothing.
#   - THE RADIX POINTER LAW (re-confirmed): the canvas job node is a
#     div[role=button][title="Click to open the results inspector"] —
#     el.click() and dispatchEvent(MouseEvent) both BOUNCE (the dialog
#     never opens); only agent-browser click with the CSS selector (the
#     trusted pointer) opens it. agent-browser `find role button
#     click --name` fails on the em-dash long name — use the CSS path.
#   - THE INSPECTOR TAB LAW: the Enlarge buttons live on the RESULTS
#     tab — the inspector opens on the last-visited tab; click
#     `Results` FIRST, then `Enlarge run_class001`, then verify the
#     quick-look EXISTS before `View in 3D` (a blind click no-ops).
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

echo "== re-craft (the I7 law): the full reload re-stages =="
agent-browser open "${URL}" >/dev/null 2>&1
sleep 5

echo "== the stack (each step verified before the next) =="
agent-browser find role button click --name "3D Refine (tutorial) — 3D Auto-Refine, completed" >/dev/null 2>&1
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

echo "== the observer installed BEFORE the mount =="
ev '(() => { window.__t1042 = { saved: false, log: [] }; const obs = new MutationObserver(() => { const b = Array.from(document.querySelectorAll("ol.fixed li button")).find(x=>/Save this view/.test(x.textContent||"")); if (b && !window.__t1042.saved) { window.__t1042.saved = true; b.click(); window.__t1042.log.push("save-clicked@at:" + Date.now()); } }); obs.observe(document.body, { childList: true, subtree: true }); return "observer armed"; })()' 2>&1 | tail -1

echo "== the mount =="
agent-browser eval 'Array.from(document.querySelectorAll("[role=dialog] button")).find(b=>/View in 3D/.test(b.textContent||""))?.click(); "fired"' >/dev/null 2>&1
KEPT=""
for i in $(seq 1 90); do
  S=$(agent-browser eval 'JSON.stringify(window.__t1042 ? window.__t1042.saved : "no-obs")' 2>/dev/null | tr -d '"')
  K=$(agent-browser eval 'JSON.stringify(Array.from(document.querySelectorAll("ol.fixed li")).map(t=>(t.textContent||"").slice(0,220)).filter(t=>/kept|remembers|restored/.test(t)))' 2>/dev/null | tail -1)
  if echo "$K" | grep -q "kept"; then KEPT="$K"; echo "KEPT TOAST (poll $i, saved=$S): $KEPT"; break; fi
  [ "$S" = "true" ] && [ $i -gt 60 ] && { echo "saved=true but kept toast missed: $K"; break; }
  sleep 0.5
done
[ -n "$KEPT" ] && agent-browser screenshot shots-qa/t1042-ride-4-kept-toast.png 2>&1 | tail -1

echo "== the API witness (the birth stamp at the door) =="
curl -s -H "Origin: http://localhost:3000" "http://localhost:3000/api/jobs/${REFINE}/camera-bookmarks" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);const b=j.bookmarks||[];console.log('  rows:',b.length,'| names:',b.map(x=>x.name).join(','),'| srcs:',b.map(x=>JSON.stringify(x.src)).join(','))})"

echo "== the row chip on camera =="
agent-browser click 'button[aria-label^="Camera view bookmarks"]' >/dev/null 2>&1
sleep 2
CHIP=$(agent-browser eval 'JSON.stringify({present: !!document.querySelector("[data-testid=bm-src-chip]"), text: document.querySelector("[data-testid=bm-src-chip]")?.textContent || null})' 2>/dev/null | tail -1)
echo "  chip: ${CHIP}"
agent-browser screenshot shots-qa/t1042-ride-5-row-chip.png 2>&1 | tail -1
echo "RIDE B DONE"

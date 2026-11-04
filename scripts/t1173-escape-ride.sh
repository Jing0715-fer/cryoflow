#!/bin/bash
# t1173-escape-ride.sh — the reunion window's disease-cure proof, ONE call:
# node_modules is reaped by a platform cleaner between calls (the window's
# new finding), so install + boot + the t874 Escape walk must share ONE
# tool call. The cure: run-compare-dialog.tsx wears onEscapeClose (the
# parallel-line reunion's port onto the mainline's evolved dialog) — one
# Escape press must peel ONE layer (dialogs 2 → 1), never both (2 → 0).
set -u
cd "$(dirname "$0")/.."
ROOT="$PWD"
mkdir -p /tmp/cryoflow-qa shots-qa
say() { echo "[ride] $*"; }

say "installing node_modules"
timeout 200 bun install > /tmp/cryoflow-qa/t1173-ride-install.log 2>&1 || { say "INSTALL FAILED"; exit 1; }
say "node_modules: $(ls node_modules 2>/dev/null | wc -l) entries"

say "booting webpack dev lane"
(DEV_HEAP_MB=1792 DEV_NEXT_ARGS="--webpack" setsid bash scripts/dev-server.sh > /tmp/cryoflow-qa/t1173-ride-boot.log 2>&1 < /dev/null &)
UP=0
for i in $(seq 1 30); do
  sleep 5
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 10 -H "Origin: http://localhost:3000" http://localhost:3000/api/jobs 2>/dev/null)
  [ "$code" = "200" ] && UP=1 && say "lane up (~$((i*5))s)" && break
done
[ "$UP" != "1" ] && { say "BOOT FAILED"; tail -4 /tmp/cryoflow-qa/dev-server.log; exit 1; }

say "warming the canvas"
curl -s -o /dev/null -m 150 "http://localhost:3000/" 2>/dev/null
ab() { agent-browser "$@"; }
ab open http://localhost:3000 >/dev/null 2>&1
sleep 6
READY=0
for i in $(seq 1 25); do
  n=$(ab eval "(() => JSON.stringify({ cards: Array.from(document.querySelectorAll('div[role=button]')).filter(b => (b.getAttribute('aria-label')||'').startsWith('2D Classification (tutorial)')).length, dialogs: document.querySelectorAll('[role=dialog]').length }))()" 2>/dev/null | tail -1)
  if echo "$n" | grep -q '"cards":1'; then READY=1; say "canvas ready (~$((i*4))s)"; break; fi
  sleep 5
done
[ "$READY" != "1" ] && say "CANVAS NOT READY: $n"

# the canvas pan is persisted world state — drag the card into view if needed
STATE=$(ab eval "(() => { const c = Array.from(document.querySelectorAll('div[role=button]')).find(b => (b.getAttribute('aria-label')||'').startsWith('2D Classification (tutorial)')); if (!c) return JSON.stringify({ ok:false }); const r = c.getBoundingClientRect(); if (r.x >= 20 && r.x + r.width <= window.innerWidth - 20) return JSON.stringify({ ok:true, panned:false }); const dx = Math.round(480 - (r.x + r.width/2)); const cx = Math.round(window.innerWidth/2), cy = Math.round(window.innerHeight/2); return JSON.stringify({ ok:true, pan:{ cx, cy, dx } }); })()" 2>/dev/null | tail -1)
if echo "$STATE" | grep -q '"pan"'; then
  CX=$(echo "$STATE" | python3 -c "import json,sys; print(json.load(sys.stdin)['pan']['cx'])")
  CY=$(echo "$STATE" | python3 -c "import json,sys; print(json.load(sys.stdin)['pan']['cy'])")
  DX=$(echo "$STATE" | python3 -c "import json,sys; print(json.load(sys.stdin)['pan']['dx'])")
  ab mouse move "$CX" "$CY" >/dev/null 2>&1; sleep 0.5
  ab mouse down >/dev/null 2>&1; sleep 0.4
  ab mouse move $((CX + DX / 2)) "$CY" >/dev/null 2>&1; sleep 0.4
  ab mouse move $((CX + DX)) "$CY" >/dev/null 2>&1; sleep 0.4
  ab mouse up >/dev/null 2>&1; sleep 1.5
  say "panned by $DX"
fi

ab click "div[role=button][aria-label^='2D Classification (tutorial)']" >/dev/null 2>&1
INSP=0
for i in $(seq 1 15); do
  sleep 3
  h=$(ab eval "(() => JSON.stringify({ d: !!document.querySelector('[role=dialog] [data-slot=dialog-title]') }))()" 2>/dev/null | tail -1)
  if echo "$h" | grep -q '"d":true'; then INSP=1; say "inspector up"; break; fi
done
[ "$INSP" != "1" ] && say "INSPECTOR NEVER UP"

ab eval "(() => { const door = [...document.querySelectorAll('[role=dialog] button')].find(b => (b.getAttribute('aria-label')||'').includes('Class A/B')); if (!door) return 'NO_DOOR'; door.click(); return 'OPENED'; })()" >/dev/null 2>&1
CMP=0
for i in $(seq 1 15); do
  sleep 3
  c=$(ab eval "(() => JSON.stringify({ cmp: [...document.querySelectorAll('[role=dialog]')].some(x => (x.textContent||'').includes('A/B —'))) }))()" 2>/dev/null | tail -1)
  if echo "$c" | grep -q '"cmp":true'; then CMP=1; say "compare up"; break; fi
done
[ "$CMP" != "1" ] && say "COMPARE NEVER UP"

BEFORE=$(ab eval "(() => JSON.stringify({ n: document.querySelectorAll('[role=dialog]').length }))()" 2>/dev/null | tail -1)
say "dialogs before Escape: $BEFORE"
ab eval "(() => { const d = [...document.querySelectorAll('[role=dialog]')].find(x => (x.textContent||'').includes('A/B —')); if (!d) return 'NO_COMPARE'; const k = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }); (document.activeElement || d).dispatchEvent(k); d.dispatchEvent(k); return 'SENT'; })()" >/dev/null 2>&1
sleep 3
AFTER=$(ab eval "(() => JSON.stringify({ n: document.querySelectorAll('[role=dialog]').length, inspector: !!([...document.querySelectorAll('[role=dialog]')].find(x => (x.textContent||'').includes('job inspector'))) }))()" 2>/dev/null | tail -1)
say "dialogs after Escape: $AFTER"

ab screenshot shots-qa/t1173-escape-cure.png >/dev/null 2>&1 || true
ab console --clear >/dev/null 2>&1 || true

if echo "$AFTER" | grep -q '"n":1'; then V=THE_CURE_LANDS; elif echo "$AFTER" | grep -q '"n":0'; then V=DISEASE_STILL_ALIVE; else V=UNEXPECTED; fi
printf '{"verdict":"%s","before":%s,"after":%s,"world":"dev-webpack merged tree 834b28c3"}\n' "$V" "$BEFORE" "$AFTER" | tee shots-qa/t1173-escape-cure.json

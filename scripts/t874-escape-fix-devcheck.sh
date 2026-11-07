#!/bin/bash
# t874-escape-fix-devcheck.sh — the ONE-SHOT dev-lane verification of the
# run-compare Escape fix (the prod lane serves the OLD build; the reaper
# kills "next dev" cmdlines between Bash calls, so the whole check — boot,
# compile, walk the fix, restore prod — must live inside ONE call).
#
# The fix: run-compare-dialog.tsx wears the shared onEscapeClose consumer
# (preventDefault + stopPropagation + close) — without it, the t874 recon
# filmed BOTH Radix roots dismissing on one press (dialogs 2 → 0, the
# inspector behind dies with the compare dialog).
#
# Sequence: kill prod → boot dev (--webpack) → poll → the browser check →
# kill dev → relaunch prod standalone → poll. Prints a JSON verdict.
set -u
cd "$(dirname "$0")/.."
ROOT="$PWD"
LOG=/tmp/cryoflow-qa/t874-devcheck.log
mkdir -p /tmp/cryoflow-qa

say() { echo "[devcheck] $*"; }

# ---------- 1. stop the prod lane ----------
PROD_PID=$(pgrep -f "next-server" | head -1)
say "prod pid: ${PROD_PID:-none}"
[ -n "${PROD_PID:-}" ] && kill "$PROD_PID" 2>/dev/null
sleep 2

# ---------- 2. boot the dev lane ----------
(DEV_HEAP_MB=1280 setsid npx next dev --webpack > "$LOG" 2>&1 < /dev/null &)
DEV_UP=0
for i in $(seq 1 40); do
  sleep 5
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 20 -H "Origin: http://localhost:3000" "http://localhost:3000/api/projects" 2>/dev/null)
  if [ "$code" = "200" ]; then DEV_UP=1; say "dev lane up (~$((i*5))s)"; break; fi
done
if [ "$DEV_UP" != "1" ]; then
  say "DEV BOOT FAILED"; tail -5 "$LOG"
  # restore prod before bailing
  (setsid node "$ROOT/.next/standalone/server.js" >> /tmp/cryoflow-qa/prod-lane-t874.log 2>&1 < /dev/null &)
  echo '{"verdict":"BOOT_FAIL"}'; exit 1
fi

# ---------- 3. the browser check (the fix's own verdict) ----------
sleep 3
ab() { agent-browser "$@"; }
# pre-warm the page route itself (the dev lane's first compile is the long pole)
curl -s -o /dev/null -m 120 "http://localhost:3000/" 2>/dev/null
say "page route pre-warmed"
ab open http://localhost:3000 >/dev/null 2>&1
sleep 8
READY=0
for i in $(seq 1 30); do
  n=$(ab eval "(() => JSON.stringify({ cards: Array.from(document.querySelectorAll('div[role=button]')).filter(b => (b.getAttribute('aria-label')||'').startsWith('2D Classification (tutorial)')).length, dialogs: document.querySelectorAll('[role=dialog]').length }))()" 2>/dev/null | tail -1)
  if echo "$n" | grep -q '"cards":1'; then READY=1; say "canvas ready (~$((i*4))s): $n"; break; fi
  sleep 6
done
if [ "$READY" != "1" ]; then say "CANVAS NEVER READY: $n"; fi

PAN="(() => { const c = Array.from(document.querySelectorAll('div[role=button]')).find(b => (b.getAttribute('aria-label')||'').startsWith('2D Classification (tutorial)')); if (!c) return JSON.stringify({ ok: false }); const r = c.getBoundingClientRect(); if (r.x >= 20 && r.x + r.width <= window.innerWidth - 20) return JSON.stringify({ ok: true, panned: false }); const dx = Math.round(480 - (r.x + r.width/2)); const cx = Math.round(window.innerWidth/2), cy = Math.round(window.innerHeight/2); return JSON.stringify({ ok: true, pan: { cx: cx, cy: cy, dx: dx } }); })()"
STATE=$(ab eval "$PAN" 2>/dev/null | tail -1)
if echo "$STATE" | grep -q '"pan"'; then
  CX=$(echo "$STATE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['pan']['cx'])")
  CY=$(echo "$STATE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['pan']['cy'])")
  DX=$(echo "$STATE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['pan']['dx'])")
  ab mouse move "$CX" "$CY" >/dev/null 2>&1; sleep 0.5
  ab mouse down >/dev/null 2>&1; sleep 0.4
  ab mouse move $((CX + DX / 2)) "$CY" >/dev/null 2>&1; sleep 0.4
  ab mouse move $((CX + DX)) "$CY" >/dev/null 2>&1; sleep 0.4
  ab mouse up >/dev/null 2>&1; sleep 1.5
  say "canvas panned by $DX"
fi
ab click "div[role=button][aria-label^='2D Classification (tutorial)']" >/dev/null 2>&1
INSP=0
for i in $(seq 1 15); do
  sleep 3
  h=$(ab eval "(() => JSON.stringify({ d: !!document.querySelector('[role=dialog] [data-slot=dialog-title]') }))()" 2>/dev/null | tail -1)
  if echo "$h" | grep -q '"d":true'; then INSP=1; say "inspector up (~$((i*3))s)"; break; fi
done
[ "$INSP" != "1" ] && say "INSPECTOR NEVER UP"
ab eval "(() => { const door = [...document.querySelectorAll('[role=dialog] button')].find(b => (b.getAttribute('aria-label')||'').includes('Class A/B')); if (!door) return 'NO_DOOR'; door.click(); return 'OPENED'; })()" >/dev/null 2>&1
CMP=0
for i in $(seq 1 15); do
  sleep 3
  c=$(ab eval "(() => JSON.stringify({ cmp: [...document.querySelectorAll('[role=dialog]')].some(x => (x.textContent||'').includes('A/B —'))) }))()" 2>/dev/null | tail -1)
  if echo "$c" | grep -q '"cmp":true'; then CMP=1; say "compare up (~$((i*3))s)"; break; fi
done
[ "$CMP" != "1" ] && say "COMPARE NEVER UP"

BEFORE=$(ab eval "(() => JSON.stringify({ n: document.querySelectorAll('[role=dialog]').length }))()" 2>/dev/null | tail -1)
say "dialogs before Escape: $BEFORE"
ab eval "(() => { const d = [...document.querySelectorAll('[role=dialog]')].find(x => (x.textContent||'').includes('A/B —')); if (!d) return 'NO_COMPARE'; const k = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }); (document.activeElement || d).dispatchEvent(k); d.dispatchEvent(k); return 'SENT'; })()" >/dev/null 2>&1
sleep 3
AFTER=$(ab eval "(() => JSON.stringify({ n: document.querySelectorAll('[role=dialog]').length, inspector: !!([...document.querySelectorAll('[role=dialog]')].find(x => (x.textContent||'').includes('job inspector'))) }))()" 2>/dev/null | tail -1)
say "dialogs after Escape: $AFTER"

# ---------- 4. restore the prod lane ----------
DEV_PID=$(pgrep -f "next dev" | head -1)
DEV_PORT_PID=$(ss -tlnp 2>/dev/null | grep ":3000" | grep -oE "pid=[0-9]+" | head -1 | cut -d= -f2)
[ -n "${DEV_PORT_PID:-}" ] && kill "$DEV_PORT_PID" 2>/dev/null
[ -n "${DEV_PID:-}" ] && kill "$DEV_PID" 2>/dev/null
sleep 3
(setsid node "$ROOT/.next/standalone/server.js" >> /tmp/cryoflow-qa/prod-lane-t874.log 2>&1 < /dev/null &)
PROD_UP=0
for i in $(seq 1 12); do
  sleep 3
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 5 -H "Origin: http://localhost:3000" "http://localhost:3000/api/projects" 2>/dev/null)
  if [ "$code" = "200" ]; then PROD_UP=1; say "prod lane restored (~$((i*3))s)"; break; fi
done

if echo "$AFTER" | grep -q '"n":1'; then V=FIXED; elif echo "$AFTER" | grep -q '"n":0'; then V=STILL_DIES_BOTH; else V=UNEXPECTED; fi
echo "{\"verdict\": \"$V\", \"before\": $BEFORE, \"after\": $AFTER, \"prodRestored\": $PROD_UP}"

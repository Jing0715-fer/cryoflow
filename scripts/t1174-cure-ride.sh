#!/bin/bash
# t1174-cure-ride.sh — the disease-cure proof on the healed world: the
# t1173 merge ported onEscapeClose onto the mainline's evolved
# run-compare-dialog; one Escape press must peel ONE layer (dialogs 2→1,
# the inspector behind survives), never both (2→0, the t874 disease).
# Assumes the lane is UP (the world finished the chain this window).
set -u
cd "$(dirname "$0")/.."
mkdir -p shots-qa /tmp/cryoflow-qa
say() { echo "[cure-ride] $*"; }
ab() { agent-browser "$@"; }

code=$(curl -s -o /dev/null -w "%{http_code}" -m 10 -H "Origin: http://localhost:3000" http://localhost:3000/api/jobs 2>/dev/null)
if [ "$code" != "200" ]; then
  # the reaper law's counter: the hardlink store restores node_modules in ~1s
  if [ ! -d node_modules ] && [ -d .nm-store ]; then
    say "node_modules reaped — hardlink-restore from .nm-store"
    cp -al .nm-store node_modules
  fi
  if [ ! -d node_modules ]; then
    say "no store, installing"
    timeout 200 bun install > /tmp/cryoflow-qa/t1174-ride-install.log 2>&1 || { say "INSTALL FAILED"; exit 1; }
  fi
  say "lane still $code — the server needs a nudge; waiting 10s"
  sleep 10
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 10 -H "Origin: http://localhost:3000" http://localhost:3000/api/jobs 2>/dev/null)
  [ "$code" = "200" ] || { say "LANE STILL DOWN ($code)"; exit 1; }
fi
say "lane up"

# the zombie-tab law's cousin: a FRESH navigation, then the openAndDress law
ab open about:blank >/dev/null 2>&1; sleep 1
ab open http://localhost:3000 >/dev/null 2>&1
sleep 8
READY=0
for i in $(seq 1 24); do
  n=$(ab eval "(() => JSON.stringify({ cards: Array.from(document.querySelectorAll('div[role=button]')).filter(b => (b.getAttribute('aria-label')||'').startsWith('2D Classification (tutorial)')).length, ghost: document.body.innerText.includes('Loading CryoFlow') }))()" 2>/dev/null | tail -1)
  if echo "$n" | grep -q '"cards":1'; then READY=1; say "canvas ready (~$((i*4))s)"; break; fi
  if [ $((i % 6)) = 0 ]; then ab open http://localhost:3000 >/dev/null 2>&1; say "re-dressing the navigation"; fi
  sleep 5
done
[ "$READY" != "1" ] && { say "CANVAS NEVER READY: $n"; echo "{\"verdict\":\"CANVAS_NOT_READY\"}"; exit 1; }

# the pan (persisted world state — drag dynamically)
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

ab screenshot shots-qa/t1174-escape-cure.png >/dev/null 2>&1 || true
ab console --clear >/dev/null 2>&1 || true
CONSOLE=$(ab errors 2>/dev/null | tail -2 | head -c 200)

if echo "$AFTER" | grep -q '"n":1'; then V=THE_CURE_LANDS; elif echo "$AFTER" | grep -q '"n":0'; then V=DISEASE_STILL_ALIVE; else V=UNEXPECTED; fi
printf '{"verdict":"%s","before":%s,"after":%s,"world":"dev-webpack merged tree 117afb7d, the healed 15-leg world","console":%s}\n' "$V" "$BEFORE" "$AFTER" "\"$CONSOLE\"" | tee shots-qa/t1174-escape-cure.json

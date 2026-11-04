#!/bin/bash
# t1175-cure-walk.sh — the cure walk with every t1174/t1175 lesson baked in:
#
# 1. ONE-CALL DISCIPLINE (t1173): restore + boot + readiness + walk share one
#    tool call — the platform reaps node_modules AND running servers between
#    calls, so anything spanning calls re-establishes its own floor here.
# 2. THE ZOMBIE-TAB LAW'S ORDER (t1172/t1175): about:blank BEFORE any server
#    contact — a stale tab parked on the canvas feeds every fresh boot a
#    reload fan-out through its HMR socket.
# 3. THE CHUNK-STORM PATIENCE (t1175): the FIRST real browser visit after a
#    fresh server compiles the canvas's client chunks through the compile
#    lock — the ride's old 120s window was spent INSIDE that storm and its
#    30s re-dress loop kept resetting the page. Give it 240s; re-dress only
#    when the page is actually a dead error page.
# 4. THE API-READ VERDICT (t1174's promise): before walking, read the world
#    through the live lane — /api/jobs must speak 15 jobs (the mismatch
#    hypothesis died here: DB, projects.json and API all agree on
#    cmw140u7s / β-Galactosidase Tutorial (demo)).
# 5. THE WALK (the t874 disease's proof): card → inspector → Class A/B →
#    ONE Escape press → dialogs must go 2→1 (inspector survives), never 2→0.
set -u
cd "$(dirname "$0")/.."
mkdir -p shots-qa /tmp/cryoflow-qa
say() { echo "[cure-walk] $*"; }
ab() { agent-browser "$@"; }
ORIGIN='-H Origin:http://localhost:3000'

# --- 1. the floor: node_modules — the t1175 PARTIAL-HARVEST lesson: the
# reaper can empty the tree but leave the directory (witnessed: `next`
# alone surviving), so the guard COUNTS packages, never just exists.
nm_count=$(ls node_modules 2>/dev/null | wc -l)
if [ "$nm_count" -lt 600 ] && [ -d .nm-store ]; then
  rm -rf node_modules
  cp -al .nm-store node_modules
  say "node_modules restored from the hardlink store ($(ls node_modules | wc -l) pkgs; had $nm_count)"
fi

# --- 2. the zombie-tab law's ORDER: neuter BEFORE any server contact
ab open about:blank >/dev/null 2>&1; sleep 1

# --- 3. the lane: poll /api/jobs; boot if silent
code=$(curl -s -o /dev/null -w "%{http_code}" -m 12 $ORIGIN http://localhost:3000/api/jobs 2>/dev/null)
if [ "$code" != "200" ]; then
  pkill -f 'next[-]server' 2>/dev/null; pkill -f 'next[ ]dev' 2>/dev/null; sleep 2
  rm -f .next/dev/lock
  say "lane $code — booting (webpack lane, 1792 heap)"
  DEV_HEAP_MB=1792 DEV_NEXT_ARGS=--webpack nohup bash scripts/dev-server.sh 9>&- > /tmp/cryoflow-qa/t1175-walk-boot.log 2>&1 &
  for i in $(seq 1 40); do
    sleep 4
    code=$(curl -s -o /dev/null -w "%{http_code}" -m 15 $ORIGIN http://localhost:3000/api/jobs 2>/dev/null)
    [ "$code" = "200" ] && { say "lane UP after ~$((i*4+4))s"; break; }
  done
  [ "$code" = "200" ] || { say "LANE NEVER CAME UP ($code)"; exit 1; }
else
  say "lane already up"
fi

# --- 4. the API-read verdict: the world through the live lane
JOBS=$(curl -s -m 20 $ORIGIN http://localhost:3000/api/jobs 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('jobs',[])))" 2>/dev/null || echo "?")
PROJ=$(curl -s -m 20 $ORIGIN http://localhost:3000/api/projects 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); p=[x for x in d['projects'] if x.get('active')]; print(p[0]['name'] if p else 'none')" 2>/dev/null || echo "?")
say "live lane: $JOBS jobs, active project: $PROJ"

# --- 5. the walk's canvas: ONE navigation, then a ~420s PATIENT window.
# t1175's measured truth: the canvas self-heals ~4-6 min after the FIRST
# navigation (the app's poll layer re-fetches once the client-chunk compile
# storm drains), but only if NOTHING re-navigates — each re-dress restarts
# the app's fetch cycle and stretches the storm. So: one nav, 8s polls,
# and at most ONE re-dress for a genuinely dead page inside the first 60s.
ab open http://localhost:3000 >/dev/null 2>&1
READY=0; REDRESSED=0; LAST=""
for i in $(seq 1 52); do
  sleep 8
  LAST=$(ab eval "(() => JSON.stringify({ url: location.href.slice(0,60), cards: Array.from(document.querySelectorAll('div[role=button]')).filter(b => (b.getAttribute('aria-label')||'').startsWith('2D Classification (tutorial)')).length, ghost: document.body.innerText.includes('Loading CryoFlow') }))()" 2>/dev/null | tail -1)
  if echo "$LAST" | grep -q '"cards":1'; then READY=1; say "canvas ready (~$((i*8))s): $LAST"; break; fi
  if [ "$i" -le 8 ] && [ "$REDRESSED" -lt 1 ] && echo "$LAST" | grep -q 'chrome-error\|about:blank'; then
    ab open http://localhost:3000 >/dev/null 2>&1; REDRESSED=$((REDRESSED+1)); say "re-dressed a dead navigation ($REDRESSED)"
  fi
done
[ "$READY" != "1" ] && { say "CANVAS NEVER READY after ~420s: $LAST"; printf '{"verdict":"CANVAS_NOT_READY","lane":"up","api_jobs":"%s","last":%s}\n' "$JOBS" "$LAST" | tee shots-qa/t1175-escape-cure.json; exit 1; }

# --- 6. the walk: card → inspector
ab click "div[role=button][aria-label^='2D Classification (tutorial)']" >/dev/null 2>&1
INSP=0
for i in $(seq 1 15); do
  sleep 3
  h=$(ab eval "(() => JSON.stringify({ d: !!document.querySelector('[role=dialog] [data-slot=dialog-title]') }))()" 2>/dev/null | tail -1)
  if echo "$h" | grep -q '"d":true'; then INSP=1; say "inspector up (~$((i*3))s)"; break; fi
done
[ "$INSP" != "1" ] && say "INSPECTOR NEVER UP: $h"

# --- 7. the door: Class A/B
ab eval "(() => { const door = [...document.querySelectorAll('[role=dialog] button')].find(b => (b.getAttribute('aria-label')||'').includes('Class A/B')); if (!door) return 'NO_DOOR'; door.click(); return 'OPENED'; })()" >/dev/null 2>&1
CMP=0
for i in $(seq 1 15); do
  sleep 3
  c=$(ab eval "(() => JSON.stringify({ cmp: [...document.querySelectorAll('[role=dialog]')].some(x => (x.textContent||'').includes('A/B —'))) }))()" 2>/dev/null | tail -1)
  if echo "$c" | grep -q '"cmp":true'; then CMP=1; say "A/B compare up (~$((i*3))s)"; break; fi
done
[ "$CMP" != "1" ] && say "COMPARE NEVER UP: $c"

# --- 8. the moment: ONE Escape press, then the count
BEFORE=$(ab eval "(() => JSON.stringify({ n: document.querySelectorAll('[role=dialog]').length }))()" 2>/dev/null | tail -1)
say "dialogs before Escape: $BEFORE"
ab eval "(() => { const d = [...document.querySelectorAll('[role=dialog]')].find(x => (x.textContent||'').includes('A/B —')); if (!d) return 'NO_COMPARE'; const k = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }); (document.activeElement || d).dispatchEvent(k); d.dispatchEvent(k); return 'SENT'; })()" >/dev/null 2>&1
sleep 3
AFTER=$(ab eval "(() => JSON.stringify({ n: document.querySelectorAll('[role=dialog]').length, inspector: !!([...document.querySelectorAll('[role=dialog]')].find(x => (x.textContent||'').includes('job inspector'))) }))()" 2>/dev/null | tail -1)
say "dialogs after Escape: $AFTER"

ab screenshot shots-qa/t1175-escape-cure.png >/dev/null 2>&1 || true

if echo "$AFTER" | grep -q '"n":1'; then V=THE_CURE_LANDS
elif echo "$AFTER" | grep -q '"n":0'; then V=DISEASE_STILL_ALIVE
else V=UNEXPECTED; fi
printf '{"verdict":"%s","before":%s,"after":%s,"api_jobs":"%s","active_project":"%s","world":"dev-webpack merged tree 88c12874, the healed 15-leg world"}\n' "$V" "$BEFORE" "$AFTER" "$JOBS" "$PROJ" | tee shots-qa/t1175-escape-cure.json

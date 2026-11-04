#!/bin/bash
# t1175-whale-quiet-compile.sh — the loop's exit: compile the canvas whale
# while chrome is NOT resident.
#
# The t1175 loop-of-doom, witnessed 5+ times tonight: fresh server → first
# browser visit → GET / compiles the canvas graph (anon-rss spike 2.7-3.4GB)
# WHILE agent-browser's chrome holds ~0.5-1GB → global OOM kills the server
# mid-compile → the persistent cache is left torn → the next visit
# recompiles from scratch → repeat. The rounds that rendered all hit a FULL
# disk cache (GET / 200 in 40ms, compile: 3ms — no spike at all).
#
# The cure: the spike fits the box when chrome is absent (t1172's build day
# proved 3.2GB available suffices for a webpack compile). So: chrome dies,
# curl fetches / itself (the whale compiles for a browser that never
# arrives), the graph persists to .next/dev, chrome returns to a 40ms warm
# serve, and the walk runs on a server that no longer needs to inflate.
set -u
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"
mkdir -p shots-qa /tmp/cryoflow-qa
say() { echo "[quiet-compile] $*"; }
ab() { agent-browser "$@"; }
ORIGIN="-H Origin:http://localhost:3000"

# --- 1. floor: node_modules (count, never just exists — partial harvest)
nm_n=$(ls node_modules 2>/dev/null | wc -l)
if [ "$nm_n" -lt 600 ] && [ -d .nm-store ]; then
  rm -rf node_modules; cp -al .nm-store node_modules
  say "node_modules restored ($(ls node_modules | wc -l) pkgs; had $nm_n)"
fi

# --- 1b. THE FLOOR DAEMON (t1176): the reaper's period is minutes and the
# walk's is longer — a ride that restores its floor once at boot still dies
# mid-walk (witnessed: the canvas's own refetch hit the harvested tree, the
# cards left, the click had nothing to press). A hardlink restore is 1.2s;
# re-establishing the floor every 5s makes the data lane outlive the reaper
# for the WHOLE ride. The walking window carries its own ground.
( while true; do
    n=$(ls node_modules 2>/dev/null | wc -l)
    if [ "$n" -lt 600 ] && [ -d .nm-store ]; then
      rm -rf node_modules 2>/dev/null; cp -al .nm-store node_modules 2>/dev/null
    fi
    sleep 5
  done ) &
FLOORPID=$!
trap 'kill $FLOORPID 2>/dev/null' EXIT
say "floor daemon up (pid $FLOORPID, restores <600 of 643 every 5s)"

# --- 2. chrome leaves the building (the ~1GB that tips every compile)
pkill -f 'agent-browser-linux' 2>/dev/null   # the chrome the daemon drives
pkill -f 'chrome' 2>/dev/null
sleep 2
say "chrome dismissed; available=$(free -m | awk '/Mem:/{print $7}')MB"

# --- 3. the lane (API only, cheap)
code=$(curl -s -o /dev/null -w "%{http_code}" -m 12 $ORIGIN http://localhost:3000/api/jobs 2>/dev/null)
if [ "$code" != "200" ]; then
  pkill -f 'next[-]server' 2>/dev/null; sleep 1; rm -f .next/dev/lock
  say "lane $code — booting"
  DEV_HEAP_MB=1792 DEV_NEXT_ARGS=--webpack nohup bash scripts/dev-server.sh 9>&- > /tmp/cryoflow-qa/t1175-quiet-boot.log 2>&1 &
  for i in $(seq 1 40); do
    sleep 4
    code=$(curl -s -o /dev/null -w "%{http_code}" -m 15 $ORIGIN http://localhost:3000/api/jobs 2>/dev/null)
    [ "$code" = "200" ] && { say "lane UP (~$((i*4+4))s)"; break; }
  done
  [ "$code" = "200" ] || { say "LANE NEVER UP"; exit 1; }
fi

# --- 4. THE QUIET WHALE: curl fetches / itself; the compile spike owns the
# box alone. This curl BLOCKS until the compile finishes (or OOM — then the
# loop honestly reports and exits).
say "feeding the whale via curl (chrome absent)..."
t0=$(date +%s)
WCODE=$(curl -s -o /tmp/cryoflow-qa/t1175-quiet-root.html -w "%{http_code}" -m 260 $ORIGIN http://localhost:3000/ 2>/dev/null)
t1=$(date +%s)
say "GET / -> $WCODE in $((t1-t0))s"
if [ "$WCODE" != "200" ]; then
  say "THE QUIET WHALE DIED (code $WCODE) — checking dmesg"
  dmesg 2>/dev/null | grep "Out of memory" | tail -1
  printf '{"verdict":"QUIET_COMPILE_FAILED","get_root":"%s","secs":%s}\n' "$WCODE" "$((t1-t0))" | tee shots-qa/t1175-escape-cure.json
  exit 1
fi
grep -o 'src="[^"]*"' /tmp/cryoflow-qa/t1175-quiet-root.html | head -3 || true

# --- 4b. THE CHUNK FARM (chrome-less): every chunk the page references
# compiles NOW, while the box is still chrome-free — the browser arrives to
# a fully warm server (no storm, no spikes, no OOM window).
say "farming chunks chrome-less..."
cd /tmp/cryoflow-qa
rm -rf t1175-chunks && mkdir t1175-chunks && cd t1175-chunks
# level 1: what the HTML references
printf '%s\n' "http://localhost:3000" > base.txt
grep -o '/_next/static/[^"?]*' /tmp/cryoflow-qa/t1175-quiet-root.html | sort -u > l1.txt
N1=0
while read -r u; do
  [ -z "$u" ] && continue
  f=$(echo "$u" | tr '/' '_')
  curl -s -m 90 -H 'Origin: http://localhost:3000' "http://localhost:3000$u" -o "$f" && N1=$((N1+1))
done < l1.txt
say "level-1 farm: $N1 chunks"
# level 2: what those chunks reference (dynamic imports)
grep -rho '/_next/static/chunks/[^"?]*' . 2>/dev/null | sort -u > l2raw.txt
grep -vxF -f l1.txt l2raw.txt > l2.txt || true
N2=0
while read -r u; do
  [ -z "$u" ] && continue
  curl -s -o /dev/null -m 90 -H 'Origin: http://localhost:3000' "http://localhost:3000$u" && N2=$((N2+1))
done < l2.txt
say "level-2 farm: $N2 chunks"
# level 3 (t1176 — the night's diagnosis): the INTERACTION family. The
# witnessed killer was not the Escape disease at all: the card click makes
# the header's SessionReportDialog Lazy request its chunk, dev compiles it
# UNDER CHROME (the spike), the request dies, ChunkLoadError hits the root
# ErrorBoundaryHandler and the WHOLE APP unmounts — the empty canvas that
# read as "the card vanished". Compiled chrome-less here, every first-click
# chunk is a cache hit at interaction time.
say "farming the interaction family chrome-less..."
INT=0
for name in \
  _app-pages-browser_src_components_workflow_session-report-dialog_tsx.js \
  _app-pages-browser_src_components_workflow_results_run-compare-dialog_tsx.js \
  _app-pages-browser_src_components_workflow_results_class-convergence-dialog_tsx.js \
  _app-pages-browser_src_components_workflow_results_resolution-arc-dialog_tsx.js \
  _app-pages-browser_src_components_workflow_results_postprocess-verdict-dialog_tsx.js \
  _app-pages-browser_src_components_workflow_results_particle-funnel-dialog_tsx.js \
  _app-pages-browser_src_components_workflow_job-inspector_tsx.js ; do
  R=$(curl -s -o /dev/null -w '%{http_code}' -m 120 -H 'Origin: http://localhost:3000' "http://localhost:3000/_next/static/chunks/$name")
  say "  $name -> $R"
  [ "$R" = "200" ] && INT=$((INT+1))
done
say "interaction family: $INT chunks"
# level 3 (the surgical one — t1175's trimmed shape): the boot fan-out's API
# route modules pre-loaded into the server's require cache. NO grep-farm of
# every /api/ path — twenty route graphs at once re-inflate the server past
# the box (witnessed: the farm's own curls OOM'd the server mid-farm). The
# successful rounds' server profile was / + these eight routes, no more.
say "pre-loading boot API routes into the require cache..."
for u in /api/jobs /api/projects /api/workspaces /api/views /api/edges /api/remote/connections /api/system/relion-status /api/ai/settings; do
  R=$(curl -s -o /dev/null -w '%{http_code}' -m 60 -H 'Origin: http://localhost:3000' "http://localhost:3000$u")
  say "  $u -> $R"
done
cd "$REPO"

# --- 5. chrome returns to a warm world
# t1176 lessons: (a) close stale sessions first (a long-lived tab's HMR
# reconnect feeds phantom reloads into a settling lane); (b) LET THE SERVER
# SETTLE — the farm's last curls leave the RSS at its post-compile peak
# (2.87GB, the corpse's shape); the graph's workspaces drain over the next
# seconds and the settled server (~2.0GB) + chrome (~0.9GB) FITS the box,
# while peak + chrome is the coin flip that landed tails every time.
ab close --all >/dev/null 2>&1; sleep 2
say "server settling before chrome arrives (RSS: $(ps -o rss= -p "$(pgrep -f 'next[-]server' | head -1)" 2>/dev/null | awk '{print int($1/1024)"MB"}')...)"
sleep 10
ab open about:blank >/dev/null 2>&1; sleep 2
ab open http://localhost:3000 >/dev/null 2>&1
READY=0; LAST=""; DEADX=0; STABLE=0
for i in $(seq 1 50); do
  sleep 6
  LAST=$(ab eval "(() => JSON.stringify({ cards: Array.from(document.querySelectorAll('div[role=button]')).filter(b => (b.getAttribute('aria-label')||'').startsWith('2D Classification (tutorial)')).length, dead: document.body.innerText.includes('refused to connect'), ghost: document.body.innerText.includes('Loading CryoFlow') }))()" 2>/dev/null | tail -1)
  if echo "$LAST" | tr -d '\\' | grep -q '"cards":1'; then
    # t1176: cards:1 once is the SSR ghost — the client store hydrates EMPTY
    # and the canvas re-renders zero cards until its own fetch lands. The
    # real world is STABLE: cards:1 twice in a row, ~6s apart.
    STABLE=$((STABLE+1))
    if [ "$STABLE" -ge 2 ]; then READY=1; say "canvas ready + stable (~$((i*6))s): $LAST"; break; fi
  else
    STABLE=0
  fi
  # t1176: a dead page is NOT a verdict — the launcher respawns the server
  # warm (the whale persists in .next/dev), so re-arm the tab instead of
  # giving up. Three re-arms, then honest surrender.
  if echo "$LAST" | tr -d '\\' | grep -q '"dead":true'; then
    DEADX=$((DEADX+1))
    if [ "$DEADX" -le 3 ]; then
      say "dead page (x$DEADX) — re-arming (the launcher respawns warm)"
      sleep 8; ab open http://localhost:3000 >/dev/null 2>&1
      continue
    fi
    say "PAGE DEAD x3 (server died mid-render): $LAST"; break
  fi
done
[ "$READY" != "1" ] && { say "CANVAS NEVER READY: $LAST"; printf '{"verdict":"CANVAS_NOT_READY","last":%s}\n' "$LAST" | tee shots-qa/t1175-escape-cure.json; exit 1; }

# --- 6. the walk: card → inspector → Class A/B → ONE Escape → the count
# t1175 lessons: (a) the reaper may have eaten node_modules DURING the
# render — re-restore before the walk (1.2s insurance; loaded modules
# survive, but any lazy require the walk triggers needs the tree);
# (b) let hydration settle — a click fired before React attaches handlers
# is silently lost; (c) click with a full pointer-event sequence via JS
# (the overlay layers can eat ab's trusted click), and NEVER silence the
# red check — a null card is a verdict, not a shrug.
nm_w=$(ls node_modules 2>/dev/null | wc -l)
if [ "$nm_w" -lt 600 ] && [ -d .nm-store ]; then
  rm -rf node_modules; cp -al .nm-store node_modules
  say "walk-floor: node_modules re-restored ($nm_w -> $(ls node_modules | wc -l))"
fi
sleep 8  # hydration settle — cards can be SSR'd while handlers are NOT yet attached (t1176's lost click)
INSP=0; h='{"d":false}'
# t1176's rewrite: the old loop broke when the DISPATCH succeeded — a click
# fired pre-hydration is dispatched AND silently lost, and the loop never
# retried. The verdict signal is the DIALOG, not the dispatch; trusted ab
# click and JS dispatch alternate (whichever lands first wins).
for attempt in 1 2 3 4 5; do
  # wait for the card to EXIST first (the hydrated canvas flickers zero
  # cards while its own fetch lands — up to 18s)
  CARDHERE=0
  for i in $(seq 1 6); do
    CC=$(ab eval "(() => JSON.stringify({ n: Array.from(document.querySelectorAll('div[role=button]')).filter(b => (b.getAttribute('aria-label')||'').startsWith('2D Classification (tutorial)')).length }))()" 2>/dev/null | tail -1)
    if echo "$CC" | tr -d '\\' | grep -qE '"n":[1-9]'; then CARDHERE=1; break; fi
    sleep 3
  done
  [ "$CARDHERE" != "1" ] && { say "attempt $attempt: card absent for 30s (client still hydrating)"; continue; }
  if [ $((attempt % 2)) -eq 1 ]; then
    CLICK=$(ab click 'div[role=button][aria-label^="2D Classification (tutorial)"]' 2>&1 | tail -1)
    say "attempt $attempt (trusted ab click): $CLICK"
  else
    CLICK=$(ab eval "(() => { const c = [...document.querySelectorAll('div[role=button]')].find(b => (b.getAttribute('aria-label')||'').startsWith('2D Classification (tutorial)')); if (!c) return 'NO_CARD'; c.scrollIntoView({block:'center'}); const r = c.getBoundingClientRect(); const o = { bubbles: true, cancelable: true, clientX: Math.round(r.x + r.width/2), clientY: Math.round(r.y + r.height/2) }; c.dispatchEvent(new PointerEvent('pointerdown', o)); c.dispatchEvent(new MouseEvent('mousedown', o)); c.dispatchEvent(new PointerEvent('pointerup', o)); c.dispatchEvent(new MouseEvent('mouseup', o)); c.dispatchEvent(new MouseEvent('click', o)); return 'CLICKED'; })()" 2>&1 | tail -1)
    say "attempt $attempt (js dispatch): $CLICK"
  fi
  for i in $(seq 1 5); do
    sleep 3
    h=$(ab eval "(() => JSON.stringify({ n: document.querySelectorAll('[role=dialog]').length }))()" 2>/dev/null | tail -1)
    if echo "$h" | tr -d '\\' | grep -qE '"n":[1-9]'; then INSP=1; break; fi
  done
  # t1176: when the click lands and the world does NOT answer, read the
  # console — the witness that named the night's disease (a Lazy chunk's
  # ChunkLoadError unmounts the ROOT: the canvas empties and never
  # self-heals). Then reload: the failed click compiled its chunk (or the
  # farm already did); the next click meets a cached world.
  if [ "$INSP" != "1" ]; then
    CA=$(ab eval "(() => JSON.stringify({ c: Array.from(document.querySelectorAll('div[role=button]')).filter(b => (b.getAttribute('aria-label')||'').startsWith('2D Classification (tutorial)')).length }))()" 2>/dev/null | tail -1)
    if echo "$CA" | tr -d '\\' | grep -q '"c":0'; then
      say "attempt $attempt: canvas EMPTIED after click — console witness:"
      agent-browser console 2>&1 | grep -iE "error|chunk|failed" | head -4 | sed 's/^/[quiet-compile]   /'
      say "reloading — the next click gets a cached world"
      ab open http://localhost:3000 >/dev/null 2>&1
      ST=0
      for i in $(seq 1 12); do
        sleep 5
        CB=$(ab eval "(() => JSON.stringify({ c: Array.from(document.querySelectorAll('div[role=button]')).filter(b => (b.getAttribute('aria-label')||'').startsWith('2D Classification (tutorial)')).length }))()" 2>/dev/null | tail -1)
        if echo "$CB" | tr -d '\\' | grep -qE '"c":1'; then ST=$((ST+1)); [ "$ST" -ge 2 ] && { say "canvas stable again (~$((i*5))s)"; break; }; else ST=0; fi
      done
    fi
  fi
  [ "$INSP" = "1" ] && { say "inspector up after attempt $attempt (~$((i*3))s): $h"; break; }
done
[ "$INSP" != "1" ] && say "INSPECTOR NEVER UP after 6 attempts: $h"

DOORDUMP=$(ab eval "(() => JSON.stringify(Array.from(document.querySelectorAll('[role=dialog] button')).slice(0,24).map(b => ((b.getAttribute('aria-label')||b.textContent||'').trim()).slice(0,40))))()" 2>/dev/null | tail -1)
say "inspector doors: $DOORDUMP"
DOOR=$(ab eval "(() => { const door = [...document.querySelectorAll('[role=dialog] button')].find(b => ((b.getAttribute('aria-label')||'') + ' ' + (b.textContent||'')).includes('A/B')); if (!door) return 'NO_DOOR'; const o = { bubbles: true, cancelable: true }; door.dispatchEvent(new PointerEvent('pointerdown', o)); door.dispatchEvent(new MouseEvent('mousedown', o)); door.dispatchEvent(new PointerEvent('pointerup', o)); door.dispatchEvent(new MouseEvent('mouseup', o)); door.dispatchEvent(new MouseEvent('click', o)); return 'OPENED'; })()" 2>&1 | tail -1)
say "A/B door press: $DOOR"
CMP=0
for i in $(seq 1 15); do
  sleep 3
  c=$(ab eval "(() => JSON.stringify({ cmp: [...document.querySelectorAll('[role=dialog]')].some(x => (x.textContent||'').includes('A/B')), n: document.querySelectorAll('[role=dialog]').length }))()" 2>/dev/null | tail -1)
  if echo "$c" | tr -d '\\' | grep -q '"cmp":true'; then CMP=1; say "A/B compare up (~$((i*3))s): $c"; break; fi
done
[ "$CMP" != "1" ] && say "COMPARE NEVER UP: $c"
# t1176, the door-phase leg: the A/B dialog's OWN chunk is fetched at door
# press (the night's second witness: ChunkLoadError on
# run-compare-dialog_tsx at this exact moment). If the compare never came
# up and the canvas emptied, the world unmounted — reload, re-click,
# re-press: the failed fetch triggered the compile server-side, so the
# second press meets a cached chunk.
if [ "$CMP" != "1" ]; then
  say "door-phase recovery: console witness:"
  agent-browser console 2>&1 | grep -iE "error|chunk|failed" | head -3 | sed 's/^/[quiet-compile]   /'
  ab open http://localhost:3000 >/dev/null 2>&1
  ST2=0
  for i in $(seq 1 14); do
    sleep 5
    CB=$(ab eval "(() => JSON.stringify({ c: Array.from(document.querySelectorAll('div[role=button]')).filter(b => (b.getAttribute('aria-label')||'').startsWith('2D Classification (tutorial)')).length }))()" 2>/dev/null | tail -1)
    if echo "$CB" | tr -d '\\' | grep -qE '"c":1'; then ST2=$((ST2+1)); [ "$ST2" -ge 2 ] && { say "canvas stable again (~$((i*5))s)"; break; }; else ST2=0; fi
  done
  ab click 'div[role=button][aria-label^="2D Classification (tutorial)"]' 2>&1 | tail -1
  for i in $(seq 1 10); do
    sleep 3
    h=$(ab eval "(() => JSON.stringify({ n: document.querySelectorAll('[role=dialog]').length }))()" 2>/dev/null | tail -1)
    echo "$h" | tr -d '\\' | grep -qE '"n":[1-9]' && { say "inspector up again (~$((i*3))s)"; break; }
  done
  DOOR=$(ab eval "(() => { const door = [...document.querySelectorAll('[role=dialog] button')].find(b => ((b.getAttribute('aria-label')||'') + ' ' + (b.textContent||'')).includes('A/B')); if (!door) return 'NO_DOOR'; const o = { bubbles: true, cancelable: true }; door.dispatchEvent(new PointerEvent('pointerdown', o)); door.dispatchEvent(new MouseEvent('mousedown', o)); door.dispatchEvent(new PointerEvent('pointerup', o)); door.dispatchEvent(new MouseEvent('mouseup', o)); door.dispatchEvent(new MouseEvent('click', o)); return 'OPENED'; })()" 2>&1 | tail -1)
  say "A/B door re-press: $DOOR"
  for i in $(seq 1 15); do
    sleep 3
    c=$(ab eval "(() => JSON.stringify({ cmp: [...document.querySelectorAll('[role=dialog]')].some(x => (x.textContent||'').includes('A/B')), n: document.querySelectorAll('[role=dialog]').length }))()" 2>/dev/null | tail -1)
    if echo "$c" | tr -d '\\' | grep -q '"cmp":true'; then CMP=1; say "A/B compare up on the re-press (~$((i*3))s): $c"; break; fi
  done
  [ "$CMP" != "1" ] && say "COMPARE NEVER UP (re-press too): $c"
fi

BEFORE=$(ab eval "(() => JSON.stringify({ n: document.querySelectorAll('[role=dialog]').length }))()" 2>/dev/null | tail -1)
say "dialogs before Escape: $BEFORE"
ab eval "(() => { const d = [...document.querySelectorAll('[role=dialog]')].find(x => (x.textContent||'').includes('A/B —')); if (!d) return 'NO_COMPARE'; const k = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }); (document.activeElement || d).dispatchEvent(k); d.dispatchEvent(k); return 'SENT'; })()" >/dev/null 2>&1
sleep 3
AFTER=$(ab eval "(() => JSON.stringify({ n: document.querySelectorAll('[role=dialog]').length, inspector: !!([...document.querySelectorAll('[role=dialog]')].find(x => (x.textContent||'').includes('job inspector'))) }))()" 2>/dev/null | tail -1)
say "dialogs after Escape: $AFTER"

ab screenshot shots-qa/t1175-escape-cure.png >/dev/null 2>&1 || true
# t1176 honesty law: a verdict about the disease requires the disease's
# stage to have existed. If the compare never opened, the walk learned
# NOTHING about Escape — say DOOR_NEVER_OPENED, never DISEASE_STILL_ALIVE.
if [ "$CMP" != "1" ]; then V=DOOR_NEVER_OPENED
elif echo "$AFTER" | tr -d '\\' | grep -q '"n":1'; then V=THE_CURE_LANDS
elif echo "$AFTER" | tr -d '\\' | grep -q '"n":0'; then V=DISEASE_STILL_ALIVE
else V=UNEXPECTED; fi
printf '{"verdict":"%s","before":%s,"after":%s,"cmp_up":%s,"whale":"quiet-compiled chrome-less","world":"dev-webpack merged tree, the healed 15-leg world"}\n' "$V" "$BEFORE" "$AFTER" "$CMP" | tee shots-qa/t1175-escape-cure.json

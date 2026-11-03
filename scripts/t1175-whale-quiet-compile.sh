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
ab open about:blank >/dev/null 2>&1; sleep 2
ab open http://localhost:3000 >/dev/null 2>&1
READY=0; LAST=""
for i in $(seq 1 50); do
  sleep 6
  LAST=$(ab eval "(() => JSON.stringify({ cards: Array.from(document.querySelectorAll('div[role=button]')).filter(b => (b.getAttribute('aria-label')||'').startsWith('2D Classification (tutorial)')).length, dead: document.body.innerText.includes('refused to connect'), ghost: document.body.innerText.includes('Loading CryoFlow') }))()" 2>/dev/null | tail -1)
  if echo "$LAST" | tr -d '\\' | grep -q '"cards":1'; then READY=1; say "canvas ready (~$((i*6))s): $LAST"; break; fi
  if echo "$LAST" | tr -d '\\' | grep -q '"dead":true'; then say "PAGE DEAD (server died mid-render): $LAST"; break; fi
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
sleep 5
CLICK=""
for attempt in 1 2 3; do
  CLICK=$(ab eval "(() => { const c = [...document.querySelectorAll('div[role=button]')].find(b => (b.getAttribute('aria-label')||'').startsWith('2D Classification (tutorial)')); if (!c) return 'NO_CARD'; c.scrollIntoView({block:'center'}); const r = c.getBoundingClientRect(); const o = { bubbles: true, cancelable: true, clientX: Math.round(r.x + r.width/2), clientY: Math.round(r.y + r.height/2) }; c.dispatchEvent(new PointerEvent('pointerdown', o)); c.dispatchEvent(new MouseEvent('mousedown', o)); c.dispatchEvent(new PointerEvent('pointerup', o)); c.dispatchEvent(new MouseEvent('mouseup', o)); c.dispatchEvent(new MouseEvent('click', o)); return 'CLICKED'; })()" 2>&1 | tail -1)
  say "click attempt $attempt: $CLICK"
  echo "$CLICK" | grep -q 'CLICKED' && break
  sleep 3
done
INSP=0
for i in $(seq 1 15); do
  sleep 3
  h=$(ab eval "(() => JSON.stringify({ d: !!document.querySelector('[role=dialog] [data-slot=dialog-title]') }))()" 2>/dev/null | tail -1)
  if echo "$h" | tr -d '\\' | grep -q '"d":true'; then INSP=1; say "inspector up (~$((i*3))s)"; break; fi
done
[ "$INSP" != "1" ] && say "INSPECTOR NEVER UP: $h"

ab eval "(() => { const door = [...document.querySelectorAll('[role=dialog] button')].find(b => (b.getAttribute('aria-label')||'').includes('Class A/B')); if (!door) return 'NO_DOOR'; const o = { bubbles: true, cancelable: true }; door.dispatchEvent(new PointerEvent('pointerdown', o)); door.dispatchEvent(new MouseEvent('mousedown', o)); door.dispatchEvent(new PointerEvent('pointerup', o)); door.dispatchEvent(new MouseEvent('mouseup', o)); door.dispatchEvent(new MouseEvent('click', o)); return 'OPENED'; })()" 2>&1 | tail -1
CMP=0
for i in $(seq 1 15); do
  sleep 3
  c=$(ab eval "(() => JSON.stringify({ cmp: [...document.querySelectorAll('[role=dialog]')].some(x => (x.textContent||'').includes('A/B —'))) }))()" 2>/dev/null | tail -1)
  if echo "$c" | tr -d '\\' | grep -q '"cmp":true'; then CMP=1; say "A/B compare up (~$((i*3))s)"; break; fi
done
[ "$CMP" != "1" ] && say "COMPARE NEVER UP: $c"

BEFORE=$(ab eval "(() => JSON.stringify({ n: document.querySelectorAll('[role=dialog]').length }))()" 2>/dev/null | tail -1)
say "dialogs before Escape: $BEFORE"
ab eval "(() => { const d = [...document.querySelectorAll('[role=dialog]')].find(x => (x.textContent||'').includes('A/B —')); if (!d) return 'NO_COMPARE'; const k = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }); (document.activeElement || d).dispatchEvent(k); d.dispatchEvent(k); return 'SENT'; })()" >/dev/null 2>&1
sleep 3
AFTER=$(ab eval "(() => JSON.stringify({ n: document.querySelectorAll('[role=dialog]').length, inspector: !!([...document.querySelectorAll('[role=dialog]')].find(x => (x.textContent||'').includes('job inspector'))) }))()" 2>/dev/null | tail -1)
say "dialogs after Escape: $AFTER"

ab screenshot shots-qa/t1175-escape-cure.png >/dev/null 2>&1 || true
if echo "$AFTER" | tr -d '\\' | grep -q '"n":1'; then V=THE_CURE_LANDS
elif echo "$AFTER" | tr -d '\\' | grep -q '"n":0'; then V=DISEASE_STILL_ALIVE
else V=UNEXPECTED; fi
printf '{"verdict":"%s","before":%s,"after":%s,"whale":"quiet-compiled chrome-less","world":"dev-webpack merged tree 88c12874, the healed 15-leg world"}\n' "$V" "$BEFORE" "$AFTER" | tee shots-qa/t1175-escape-cure.json

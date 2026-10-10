#!/usr/bin/env bash
# t529 — the build-day orchestrator: rebuild the standalone WITH the t528
# grinder as a polite co-tenant, in ONE command.
#
# Why this exists: t528's recipe grinds the REAL RELION 5.0.0 for hours in a
# tree-external prefix. A src change (e.g. this window's env-chip feature)
# needs `next build`, and the t461/t524/t525 ledger says the build only fits
# the box in its t525 GO window — with the grinder (~600-700MB), the prod
# server (~200MB) and any chrome (~500MB) OUT of the way. Pausing the grinder
# is SAFE by construction (stamps + make resume: nothing done is re-done) —
# this script makes the pause/resume part of the build procedure instead of
# a memory decision a future window has to rediscover under pressure.
#
# The dance (each step hand-checked, explicit recovery on every failure):
#   1. SKIP — standalone fresh (BUILD_ID + standalone + provenance == HEAD)
#   2. pause the grinder (process-group TERM; stamps survive; make resume)
#   3. stop prod :3000 (ss listener pid, the prod-3001 law)
#   4. the guard's gate: MemAvailable >= 2600 && buff/cache >= 1450
#      (t525's self-consistent numbers) — NO-GO recovers and exits 2
#   5. the historically-green recipe: NODE_OPTIONS='--max-old-space-size=1344'
#      npx next build --webpack  (turbopack is a trap on this box, t524 x2)
#   6. provenance: .next/.built-at-commit = HEAD short sha
#   7. restart prod :3000 (PORT=3000 scripts/prod-3001.sh, orphan-launch)
#   8. resume the grinder (full detachment idiom — t528's reaper lesson)
#   9. wait :3000 200; report /api/system's build block (the live proof)
#
# Contract: the CALLER brings a quiet box (no chrome, no QA batch in flight);
# the script brings the grinder+prod pause, the gate, the build, the restart.
# Watchdog note: CRYOFLOW_NO_WATCHDOG semantics — the watchdog is not started
# here and the dev lane is never touched (t528: dev's stale cleanup would
# kill the prod listener).
set -u
cd /home/z/my-project || exit 1
QA=/tmp/cryoflow-qa
mkdir -p "$QA"
BLOG="$QA/t529-standalone-build.log"
RECIPE="scripts/t528-rebuild-relion.sh"
GRINDER_LOG="$QA/relion-rebuild.log"

buff()  { free -m | awk '/^Mem:/ {print $6}'; }
avail() { free -m | awk '/^Mem:/ {print $7}'; }
prod_listener() {
  ss -ltnp 2>/dev/null | awk -v p=":3000" '$4 ~ p"$" { if (match($0, /pid=[0-9]+/)) { print substr($0, RSTART+4, RLENGTH-4); exit } }'
}
grinder_pgids() {
  # every process group holding a recipe process (the setsid session plus
  # any stragglers) — killing by GROUP takes bash + make + cc1 in one sweep
  for p in $(pgrep -f "$RECIPE"); do ps -o pgid= -p "$p" 2>/dev/null | tr -d ' '; done | sort -u
}

start_prod() {
  echo "[build-day] starting prod :3000 (orphan-launch inside prod-3001.sh)…"
  PORT=3000 bash scripts/prod-3001.sh
}

resume_grinder() {
  if pgrep -f "$RECIPE" > /dev/null; then
    echo "[build-day] grinder already running — no resume needed"
    return 0
  fi
  # honest skip when there is nothing left to grind (all stamps + binary)
  if [ -f /home/z/relion-build/.stamps/mpich.done ] && [ -x /home/z/relion-build/bin/relion_refine ]; then
    echo "[build-day] grinder already finished (mpich stamp + relion_refine on disk) — nothing to resume"
    return 0
  fi
  echo "[build-day] resuming the grinder (stamps make resume exact)…"
  ( setsid nohup bash "$RECIPE" >> "$GRINDER_LOG" 2>&1 < /dev/null & )
}

# ---- 1. SKIP: the standalone is already fresh --------------------------
if [ -f .next/BUILD_ID ] && [ -f .next/standalone/server.js ]; then
  stamp="$(cat .next/.built-at-commit 2>/dev/null || echo '?')"
  head="$(git rev-parse --short HEAD 2>/dev/null || echo '?')"
  if [ "$stamp" = "$head" ]; then
    echo "SKIP — standalone on disk and provenance fresh ($stamp == HEAD). Nothing to build."
    echo "        Launch/refresh the lane: PORT=3000 scripts/prod-3001.sh (t332: always restart)."
    exit 0
  fi
  echo "provenance: build $stamp vs HEAD $head — a rebuild is needed. The dance begins."
fi

# ---- 2. pause the grinder ----------------------------------------------
pgids="$(grinder_pgids)"
if [ -n "$pgids" ]; then
  echo "[build-day] pausing the grinder (pgids: $(echo $pgids | tr '\n' ' ')) — stamps survive, resume is exact…"
  for g in $pgids; do kill -TERM -- "-$g" 2>/dev/null; done
  sleep 3
  pgids="$(grinder_pgids)"
  for g in $pgids; do kill -KILL -- "-$g" 2>/dev/null; done
  sleep 1
else
  echo "[build-day] grinder not running (already finished, or reaped at a window edge)"
fi

# ---- 3. stop prod -------------------------------------------------------
ppid="$(prod_listener)"
if [ -n "$ppid" ]; then
  echo "[build-day] stopping prod :3000 (listener pid $ppid)…"
  kill -9 "$ppid" 2>/dev/null
  sleep 2
else
  echo "[build-day] prod :3000 not running"
fi

# ---- 4. the guard's gate ------------------------------------------------
b="$(buff)"; a="$(avail)"
echo "[build-day] box profile after the pause: buff/cache=${b}MB available=${a}MB (gate: >=1450 / >=2600)"
if [ "${a:-0}" -lt 2600 ] || [ "${b:-0}" -lt 1450 ]; then
  echo "NO-GO — the box does not show the t525 warm-window profile."
  echo "        Recovery: restarting prod + resuming the grinder; free more (chrome?) and re-run."
  start_prod
  resume_grinder
  exit 2
fi

# ---- 5. the historically-green build ------------------------------------
echo "[build-day] GO — building (webpack recipe, 1344 cap; log: $BLOG)…"
if ! NODE_OPTIONS='--max-old-space-size=1344' npx next build --webpack > "$BLOG" 2>&1; then
  echo "BUILD FAILED — see $BLOG (tail below). This is the t461/t524 hole; do NOT blind-retry."
  tail -15 "$BLOG"
  resume_grinder
  echo "NO-GO recovery: grinder resumed. Prod stays DOWN (.next was wiped by the failed build) —"
  echo "                rerun this script once the box is warmer; the gate will refuse if it is not."
  exit 3
fi
echo "[build-day] BUILD GREEN (exit 0)"

# ---- 5.5 the static/public copy (t525 recipe step, live-caught missing) --
# next build regenerates .next/standalone WITHOUT the client assets — the
# server boots and serves HTML referencing chunk names that 404 (this
# window's own first boot hung on "Loading CryoFlow…" with every chunk 404).
# The standalone reads static from disk on demand, so healing the live tree
# is enough; a rebuild re-runs this step by construction.
echo "[build-day] copying static + public into the standalone…"
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/

# ---- 6. provenance -------------------------------------------------------
head="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo "$head" > .next/.built-at-commit
echo "[build-day] provenance: .next/.built-at-commit = $head"

# ---- 7+8. restart prod, resume the grinder -------------------------------
start_prod
resume_grinder

# ---- 9. wait + report ----------------------------------------------------
echo "[build-day] waiting for :3000…"
ok=""
for i in $(seq 1 30); do
  if curl -H "Origin: http://localhost:3000" -sf -o /dev/null --max-time 3 http://localhost:3000/api/jobs; then ok=1; break; fi
  sleep 2
done
if [ -z "$ok" ]; then
  echo "PROD DID NOT COME UP in 60s — check /home/z/my-project/prod-3001.log and $BLOG"
  exit 4
fi
echo "[build-day] prod :3000 is up (200)."
echo "[build-day] /api/system build block (the live proof):"
# t530 live-caught (twice): the bare curl 403s against the t259 same-origin
# door and the JSON parse speaks "(status parse failed)" — the proof step
# NEVER worked. The door is the product being right; the caller must knock.
curl -sf --max-time 10 -H "sec-fetch-site: same-origin" http://localhost:3000/api/system | node -e "
  let o=''; process.stdin.on('data', d => o+=d).on('end', () => {
    try { const s = JSON.parse(o); const b = s.build;
      if (!b) { console.log('  build block: ' + (s.found ? 'null (FOUND — relion resolved!)' : 'null')); return; }
      const done = b.stages.filter(x => x.state === 'done').length;
      console.log('  found=' + s.found + ' · build ' + done + '/' + b.stages.length + ' · root ' + b.root);
      for (const st of b.stages) console.log('   - [' + st.state.padEnd(7) + '] ' + st.label);
    } catch (e) { console.log('  (status parse failed: ' + e.message + ')'); }
  });
"
echo "DONE — the standalone is fresh, the lane is green, the grinder is back at work."

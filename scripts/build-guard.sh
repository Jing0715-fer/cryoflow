#!/usr/bin/env bash
# build-guard.sh — the t524 gate in front of `next build` on this 4GB box.
#
# WHY THIS EXISTS. The t461 window burned 21 build attempts against a wall
# that was never code: webpack heap demand >1700MB vs a kernel OOM line at
# ~3.02GB anon — "数学性无窗" when the environment's page cache collapses
# (buff/cache 2439MB -> 776MB turned yesterday's one-shot GREEN recipe into
# today's 21 consecutive kills). The t524 window added its own two corpses
# (bare turbopack build exit 137 at 1m34s; NODE_OPTIONS=1792 exit 137 at
# 3.03GB anon, dmesg task=MainThread) BEFORE reading the t461 ledger —
# every one of those was avoidable. This gate turns the ledger into a
# preflight: measure the box, refuse the doomed attempts, name the recipe
# that historically works.
#
# Verdicts:
#   NO-GO  — environment collapsed (buff/cache or available too low); a
#            build attempt now is a coin flip the ledger already lost.
#   GO     — the box shows the t461 "warm window" profile (buff/cache
#            healthy + available headroom); recipe: warm 1344 webpack.
#   SKIP   — a valid standalone is already on disk; just launch it
#            (prod-3001.sh), no build needed at all.
#
# Usage: bash scripts/build-guard.sh   (never runs the build itself)

cd "$(dirname "$0")/.." || exit 1

# ---- the standalone shortcut (SKIP beats every other verdict) ----
if [ -f .next/BUILD_ID ] && [ -f .next/standalone/server.js ]; then
  echo "SKIP — standalone is already on disk (.next/BUILD_ID + standalone/server.js)."
  echo "        Launch it: PORT=3000 scripts/prod-3001.sh   (t332 law: always restart, never reuse)."
  echo "        A build is only needed when src/ moved past the provenance stamp:"
  stamp=".next/.built-at-commit"
  [ -f "$stamp" ] && echo "        provenance: $(cat "$stamp" 2>/dev/null) vs HEAD: $(git rev-parse --short HEAD 2>/dev/null)"
  exit 0
fi

# ---- the environment profile (t461's collapse signature) ----
read -r buff avail <<EOF
$(free -m | awk '/^Mem:/ {print $6, $7}')
EOF
echo "box profile: buff/cache=${buff}MB available=${avail}MB (t461 collapse signature: buff/cache 776MB; healthy window: ~2400MB)"

# kernel wall measured at ~3.02-3.55GB anon this tree era (t461 dmesg,
# t524 dmesg); the build's MainThread wants ~3.0GB+ (t524 witness) — so
# available must cover the build appetite with room for the kernel slab.
if [ "${avail:-0}" -lt 2600 ]; then
  echo "NO-GO — available ${avail}MB < 2600MB. The build's MainThread hit the kernel wall at"
  echo "        ~3.0GB anon twice this era (t461 x21, t524 x2). Free the box first:"
  echo "        kill dev server + watchdog + chrome (CRYOFLOW_NO_WATCHDOG=1 while building),"
  echo "        then re-run this gate. History: a collapsed box never got greener mid-spree."
  exit 2
fi
if [ "${buff:-0}" -lt 1500 ]; then
  echo "NO-GO — buff/cache ${buff}MB < 1500MB (collapsed page cache — the t461 21-loss profile)."
  echo "        Even with free anonymous memory the cold compile re-reads node_modules (~1.4GB);"
  echo "        wait for the cache to warm (or cat node_modules -r > /dev/null once) and re-run."
  exit 2
fi

# ---- the historically-green recipe ----
echo "GO — warm-window profile. The ledger's one-shot recipes (t460/t461-era) were:"
echo "     NODE_OPTIONS='--max-old-space-size=1344' npx next build --webpack   (warm webpack cache)"
echo "     turbopack builds are a trap on this box (Next 16 default; V8 caps don't bound its"
echo "     native side; two t524 corpses + t461 x2 at rc=137)."
echo "     During the build: keep CRYOFLOW_NO_WATCHDOG=1 and the dev lane DOWN."
exit 0

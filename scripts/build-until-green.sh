#!/usr/bin/env bash
# build-until-green.sh — t406: the production-build grinder.
#
# Doctrine inherited from three windows of autopsies:
#   t402: build workers die mid-compile (SIGKILL, often with no kernel record);
#         the webpack cache persists across reboots, so a killed build's
#         successor starts further ahead (incremental warmth).
#   t405: the kernel OOM killer executes next-server at ~2.9GB anon; the dev
#         regime cannot host the e2e family on this 4GB/no-swap box. The
#         production server (next build + next start) is the regime change:
#         zero compilation at steady state, no compile-shaped process for the
#         reaper to hunt.
#   t404: grinders that outlive their process (heal-until-green.sh) beat
#         one-shot attempts — a hard cap prevents true-failure infinite loops.
#   t415: the kernel OOM line FLOATS with ambient load (killed at 3.48GB anon
#         in one window, 2.9GB in another — chrome's QA session alone presses
#         it ~340MB lower). Close agent-browser and stop dev servers BEFORE
#         grinding; the same heap can live or die on the room it is given.
#   t416: the heap sweet spot is a MEASURED band, not a constant —
#         1280 = V8 abort (external memory ignores the heap cap; the compile
#                live-set peaks ~1274MB and GC declares itself ineffective);
#         1408/1536/1792 = kernel kill (total anon 3.25GB+ on a loaded box);
#         1344 = the current dessert (abort line below, kernel line above,
#                with GC-completion slack between).
#         AND: warmth is the lever that gets page-data through — attempt-3's
#         "✓ Compiled successfully" is the filesystem cache's first complete
#         serialization; the NEXT warm attempt rides it past page-data. A
#         grinder's product is not just the BUILD_ID but the foundation of
#         the next run. Do not re-derive the band from scratch: trust 1344,
#         and re-ladder only when the verdict changes (new pages, new deps).
#   t417: on THIS sandbox even setsid/nohup background grinders die silently
#         mid-attempt (the patrol reaps them; no rc, no verdict) — so the
#         reliable lane is FOREGROUND rounds inside tool calls (each call
#         ≤ 600s, one timeout-560 attempt per call, the filesystem cache
#         carries progress between calls). And a BUILD_ID can be written
#         BEFORE page-data completes: never treat its presence as green
#         without .next/standalone existing beside it.
#
# Contract:
#   - Idempotent across tool-call invocations: if .next/BUILD_ID exists the
#     build already went green and the script exits 0 immediately.
#   - Each attempt is wrapped in `timeout 560` so a single Bash tool call
#     (600s ceiling) always returns with a verdict instead of being SIGKILLed
#     mid-attempt with no testimony.
#   - After every failed attempt the script cools down briefly and retries,
#     relying on .next/cache/webpack to carry progress forward.
#   - Hard cap on attempts (default 10) to avoid grinding on a true failure.
#   - Environment per t402's autopsies: node runtime (bun OOMs differently),
#     --webpack (Turbopack kernel-OOMs), heap cap 1792MB (896 mark-compacts).
#   - t435, the anti-tear law: on a REAL green (fresh BUILD_ID on disk), any
#     :3000 standalone born before this build is restarted in place — with
#     the env pins restated, so even a bare invocation leaves a coherent
#     world. A green can never leave memory and disk disagreeing (t434).
#
# Usage: bash scripts/build-until-green.sh [max_attempts]
# Exit codes: 0 = BUILD_ID present (green); 1 = attempts exhausted without one.

set -u
cd "$(dirname "$0")/.."

MAX_ATTEMPTS="${1:-10}"
HEAP_MB="${HEAP_MB:-1344}"   # t416 dessert; 1280 aborts (V8), 1408+ risks the kernel line
# t459 — the collapsed-band lever: the cold compile (cache chain broken by
# the t459 window's purge) needs ~1.4GB+ of V8 heap, but RSS (heap + ~1.9GB
# external) dies on the kernel line above ~1440. A smaller YOUNG generation
# (semi-space) forces more frequent scavenges and lowers the PEAK: the same
# compile fits under both walls with the old-gen cap raised a notch.
# KERNEL_MB-style band re-derivation: 1344/1408 abort V8; 1440-1792 hit the
# kernel at ~3.38GB anon; 1440 + semi-space 8 was the first cold GREEN.
SEMI_MB="${SEMI_MB:-}"
EXTRA_V8=""
[ -n "$SEMI_MB" ] && EXTRA_V8="--max-semi-space-size=${SEMI_MB}"
BUILD_ID=".next/BUILD_ID"
LOG=".qa-logs/build-t406.log"
mkdir -p .qa-logs

stamp() { date -u '+[%H:%M:%SZ]'; }

# t418 — the gate grew teeth, per this file's own t417 doctrine: a BUILD_ID
# can be stamped BEFORE page-data finishes, and a stamp without
# .next/standalone beside it is a server that cannot start. The grinder's
# product is the startable TRIO: BUILD_ID + standalone/server.js +
# standalone/.next/static (the static dir is what package.json's build
# script copies AFTER next build — the grinder now finishes that itself).
standalone_complete() {
  [ -f "$BUILD_ID" ] \
    && [ -f ".next/standalone/server.js" ] \
    && [ -d ".next/standalone/.next/static" ]
}

if standalone_complete && [ "${FRESH:-0}" != "1" ]; then
  echo "$(stamp) build trio complete (BUILD_ID + standalone + static) — nothing to grind."
  echo "        (source changed since? FRESH=1 forces a rebuild — the grinder"
  echo "         cannot cheaply diff the whole src tree, so it trusts the stamp)"
  # t435 — hands-off path stays hands-off, but silence is how the t434 tear
  # survived a full idempotent pass: say it if the world is ALREADY torn.
  stale_pid="$(ss -tlnp 2>/dev/null | grep ':3000 ' | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1)"
  if [ -n "$stale_pid" ] \
     && tr '\0' ' ' < "/proc/$stale_pid/cmdline" 2>/dev/null | grep -q 'standalone/server.js'; then
    bt="$(stat -c %Y "$BUILD_ID" 2>/dev/null || echo 0)"
    pt="$(stat -c %Y "/proc/$stale_pid" 2>/dev/null || echo 0)"
    if [ "$pt" -lt "$bt" ]; then
      echo "$(stamp) NOTE: the running standalone (pid $stale_pid) predates the on-disk build —"
      echo "        that world is torn (t434). scripts/reboot-recover.sh repairs it; this"
      echo "        no-op pass will not touch it."
    fi
  fi
  exit 0
fi

echo "$(stamp) build-until-green: start (cap=$MAX_ATTEMPTS) — logging to $LOG"

attempt=0
while [ "$attempt" -lt "$MAX_ATTEMPTS" ]; do
  attempt=$((attempt + 1))
  echo "$(stamp) attempt $attempt/$MAX_ATTEMPTS" >> "$LOG"
  echo "$(stamp) attempt $attempt/$MAX_ATTEMPTS"

  NODE_OPTIONS="--max-old-space-size=${HEAP_MB}${EXTRA_V8:+ $EXTRA_V8}" \
  timeout 560 node node_modules/next/dist/bin/next build --webpack \
    >> "$LOG" 2>&1
  rc=$?

  if [ $rc -eq 0 ] && [ -f "$BUILD_ID" ]; then
    if [ ! -f ".next/standalone/server.js" ]; then
      # the t417 trap, live: stamp written, page-data/standalone export not
      echo "$(stamp) attempt $attempt: rc=0 + BUILD_ID but NO standalone — the stamp-before-page-data trap; the cache carries progress" >> "$LOG"
      echo "$(stamp) attempt $attempt: BUILD_ID stamped but standalone missing — one more warm pass"
      sleep 3
      continue
    fi
    if [ ! -d ".next/standalone/.next/static" ]; then
      cp -r .next/static .next/standalone/.next/ >> "$LOG" 2>&1
    fi
    if [ ! -d ".next/standalone/public" ]; then
      cp -r public .next/standalone/ >> "$LOG" 2>&1
    fi
    echo "$(stamp) GREEN on attempt $attempt (trio complete: BUILD_ID + standalone + static)" >> "$LOG"
    # build provenance (t422): stamp the commit this build came from, so the
    # reboot-recover gate can tell a fresh trio from a shadow app built off
    # an older tree (the t421 shadow-world lesson, build axis).
    ( git rev-parse HEAD 2>/dev/null || echo unknown ) > .next/.built-at-commit
    # -------------------------------------------------- t435: the anti-tear law
    # A fresh build on disk makes every running standalone born before it a
    # stale broadcaster: memory speaks the OLD build, disk holds the NEW one,
    # SSR stays 200, and every chunk the HTML names 500s — the client never
    # hydrates (t434's live tear: a grinder outlived its boot and left a
    # client-dead world behind a healthy-looking 200). Detection lives in
    # reboot-recover (step 5 + the hydration probe); THIS is the source-side
    # closure: the grinder itself retires any standalone its own build just
    # outdated, so a GREEN can never leave a torn world behind — no matter
    # who invoked it, and whether or not a reboot-recover follows.
    tear_pid="$(ss -tlnp 2>/dev/null | grep ':3000 ' | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1)"
    if [ -n "$tear_pid" ] \
       && tr '\0' ' ' < "/proc/$tear_pid/cmdline" 2>/dev/null | grep -q 'standalone/server.js'; then
      bt="$(stat -c %Y "$BUILD_ID" 2>/dev/null || echo 0)"
      pt="$(stat -c %Y "/proc/$tear_pid" 2>/dev/null || echo 0)"
      if [ "$pt" -lt "$bt" ]; then
        echo "$(stamp) ANTI-TEAR: standalone (pid $tear_pid) predates the build it would now serve — restarting in place"
        echo "$(stamp)   (t434's tear, closed at the source: memory speaks the old build, disk holds this one)"
        kill "$tear_pid" 2>/dev/null || true
        for _ in $(seq 1 5); do [ -d "/proc/$tear_pid" ] || break; sleep 1; done
        if [ -d "/proc/$tear_pid" ]; then
          echo "$(stamp)   pid $tear_pid ignored SIGTERM (bun's own law) — escalating to SIGKILL"
          kill -9 "$tear_pid" 2>/dev/null || true
          sleep 1
        fi
        # the pins are explicit so a BARE grinder invocation (outside
        # reboot-recover, whose env this call would normally inherit) still
        # starts a server on the real DB and the real data plane —
        # t419's env pin + t420's data-plane pin, restated at the source.
        ( DATABASE_URL="file:$(pwd)/db/cryoflow.db" CRYOFLOW_DATA_DIR="$(pwd)/data" NODE_ENV=production \
            nohup bun .next/standalone/server.js >> server.log 2>&1 & )
        up="000"
        for _ in $(seq 1 20); do
          sleep 3
          up="$(curl -s -o /dev/null -w '%{http_code}' --max-time 6 http://localhost:3000/ || true)"
          [ "$up" = "200" ] && break
        done
        if [ "$up" = "200" ]; then
          echo "$(stamp) ANTI-TEAR: fresh standalone answers 200 — memory and disk speak the same build"
        else
          echo "$(stamp) ANTI-TEAR WARNING: the restarted server never answered 200 (last $up)."
          echo "$(stamp)   the BUILD is green; the WORLD needs scripts/reboot-recover.sh — run it."
        fi
      fi
    fi
    echo "$(stamp) GREEN on attempt $attempt — standalone startable (provenance: $(cat .next/.built-at-commit))"
    exit 0
  fi

  if [ $rc -eq 124 ]; then
    echo "$(stamp) attempt $attempt hit the 560s ceiling (killed by timeout; cache carries progress)" >> "$LOG"
    echo "$(stamp) attempt $attempt: 560s ceiling — cache carries progress, retrying"
  else
    tail -4 "$LOG" | sed 's/^/    | /'
    echo "$(stamp) attempt $attempt failed rc=$rc — cooling 3s, the cache grows every attempt" >> "$LOG"
    echo "$(stamp) attempt $attempt failed rc=$rc"
  fi

  sleep 3
done

echo "$(stamp) EXHAUSTED after $MAX_ATTEMPTS attempts without BUILD_ID — read $LOG tail for the true failure" >> "$LOG"
echo "$(stamp) EXHAUSTED after $MAX_ATTEMPTS attempts. Inspect $LOG"
exit 1

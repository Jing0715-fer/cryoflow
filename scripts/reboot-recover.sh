#!/usr/bin/env bash
# reboot-recover.sh — t418: the 04:14 disaster, codified as one command.
#
# THE DISASTER (Task 417's worklog, 2026-09-28 04:14): the sandbox's tini
# respawned pid 1 and start.sh's restore branch ran `find /home/z/my-project
# -mindepth 1 -maxdepth 1 ! -path upload -exec rm -rf {} +` before un-tarring
# the pre-stop snapshot. HEAD rolled back to a t272-era tar; every unpushed
# byte died. What survived came back through `git fetch + reset --hard
# origin/main` — pushed commits only. The manual recovery that followed took
# a full window of forensics; THIS script is that window, written down:
#
#   0. GIT RESURRECT  the recovery's FIRST move in every historical reboot,
#                     missing until t422's doctrine audit caught the hole:
#                     each reboot landed the tree at a stale tar commit while
#                     origin/main held the truth (t417's a03a29f, the 12:25
#                     rollback, the eight-day shadow, t274's 66-behind clone,
#                     t285's README law). Fetch, then classify: aligned →
#                     skip (WIP safe, dirty or not); local-ahead → LOUD warn
#                     and continue best-effort (the script refuses to be the
#                     executioner of unpushed work — push rhythm is survival
#                     rhythm); behind or diverged → the tar signature → stash
#                     dirty WIP (recoverable, unlike rm), hard-land main on
#                     origin/main, clean untracked src debris (t273's 24-file
#                     husk that broke its build), then RE-EXEC if the tree
#                     resurrection replaced this script with a newer self.
#                     db/ and data/ are gitignored — the user's data is
#                     immune to the reset (t285's own promise).
#   1. ENV PIN        start.sh overwrites .env with `db/custom.db` on EVERY
#                     boot (both branches — fresh and restore). Prisma reads
#                     the SHELL's process env before .env, so the pin is
#                     exported here too, not just written.
#   2. DEPS           the tar's narrow .gitignore (skills/ + node_modules/)
#                     means a fresh restore can land without the toolkit.
#   3. SCHEMA         `prisma db push` — the tar-era schema trails src.
#   4. BUILD          the startable trio gate (BUILD_ID + standalone +
#                     static). Not green? ONE grinder round per invocation,
#                     then exit 42: re-run the script, the webpack cache
#                     grows every round (t402's incremental-warmth law).
#                     On a COLD .next prefer calling build-until-green.sh
#                     directly across tool-call rounds FIRST — one attempt
#                     is up to 560s and a 600s tool-call ceiling can eat
#                     this script's verdict (the cache survives the kill).
#   5. PROD LANE      the t417 verdict: dev cold-compile is 3.57GB anon and
#                     the kernel executes it — the platform boot's dev lane
#                     (via .zscripts/dev.sh) is doomed weight on this box.
#                     Takeover: stop any dev watchdog first (it would
#                     resurrect the doomed lane), kill any :3000 listener
#                     that is NOT our standalone server — or a standalone
#                     born BEFORE the on-disk build (t434: a grinder that
#                     outlives the boot rewrites .next in place while the
#                     running server still serves its ORIGINAL build from
#                     memory; SSR stays 200, every referenced chunk 500s,
#                     the client never hydrates) — start the standalone as
#                     an orphaned child (the launch.sh trick: the parent
#                     exits, the server re-parents to init, the reaper
#                     leaves it alone).
#   6. SEED           GET /api/project seeds the 3-node starter when the DB
#                     is empty (the product's own door, zero guessing).
#   7. MOCK CLUSTER   the engine's CLI lane needs the listener on 3022.
#   8. PROBE CLEAR    a tar-era connection's lastProbe is a STALE fact —
#                     "no Slurm client" was witnessed. The Test route
#                     re-probes and persists. Cheap, idempotent, honest.
#   9. DEMO CHAIN     demo-chain-resurrect.mjs: idempotent from ANY world
#                     (reuses bundle/connection/nodes/outputs; re-running
#                     ADVANCES — t417 needed two passes). Budget-capped;
#                     exit 43 = the budget hit mid-chain, re-run.
#  10. VERIFY         probe every connection once more (covers the one the
#                     healer just created), then the HYDRATION PROBE
#                     (t434): "200 on /" is an SSR verdict only — extract a
#                     static chunk URL from the served HTML and demand a
#                     200 for it, closing the memory-vs-disk tear class.
#                     Then speak the world's state.
#
# EVERY STEP IS GATED: on a living world this script is a ~1-minute no-op
# health pass (db push compare, gates skip, the chain re-verifies its
# surfaces). Safe to run any time, safe to re-run after any interruption.
#
# Exit codes: 0 alive · 42 build pending (re-run) · 43 chain pending
# (re-run) · 1 hard failure (read the log).
#
# Usage:  bash scripts/reboot-recover.sh
# Env:    REBOOT_BUILD_ATTEMPTS (default 1)   grinder rounds per invocation
#         REBOOT_CHAIN_BUDGET (default 420)   seconds for the demo chain

set -u
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
ORIGIN="http://localhost:3000"
LOG=".qa-logs/reboot-recover.log"
CHAIN_BUDGET="${REBOOT_CHAIN_BUDGET:-420}"
mkdir -p .qa-logs db

stamp() { date -u '+[%H:%M:%SZ]'; }
say()  { echo "$(stamp) $*"; }

# local-gated routes want fetch metadata (t259 doctrine): always send Origin.
api_code() { curl -s -o /dev/null -w '%{http_code}' --max-time 6 -H "Origin: $ORIGIN" "$@"; }

# ------------------------------------------------------------ 0. git resurrect
SELF="scripts/reboot-recover.sh"
# world-rebirth tracking (t422): the family report marks batches whose
# evidence came from a rebuilt world — this script is the witness that knows
# when a rebuild actually happened. Only REAL work stamps it; a green-world
# no-op pass never writes data/.world-reborn.
REBORN="${REBOOT_REBORN:-}"
mark_reborn() { case " $REBORN " in *" $1 "*) ;; *) REBORN="$REBORN $1" ;; esac; }
if git rev-parse --git-dir >/dev/null 2>&1; then
  say "0. git resurrect — fetching origin/main (the last truth, per five reboots)"
  if git fetch origin main >> "$LOG" 2>&1; then
    local_head="$(git rev-parse HEAD 2>/dev/null || echo none)"
    origin_head="$(git rev-parse origin/main 2>/dev/null || echo none)"
    if [ "$local_head" = "$origin_head" ]; then
      say "0. tree already aligned with origin/main ($local_head) — nothing to resurrect"
    elif git merge-base --is-ancestor origin/main HEAD 2>/dev/null; then
      say "0. WARNING — local HEAD is AHEAD of origin/main (unpushed commits)."
      say "   push rhythm is survival rhythm: this window skipped its push. The"
      say "   script will NOT erase unpushed work — continuing best-effort on the"
      say "   local tree. Commit and push ASAP, then re-run for a clean pass."
    else
      # behind, or diverged — the tar-rollback signature (a boot commit that
      # is neither ancestor nor descendant of origin/main lands here too).
      self_before="$(git hash-object "$SELF" 2>/dev/null || echo unknown)"
      if [ -n "$(git status --porcelain 2>/dev/null | head -1)" ]; then
        git stash push -u -m "reboot-recover auto-stash $(date -u '+%Y%m%dT%H%M%SZ')" >> "$LOG" 2>&1 || true
        say "0. dirty tree stashed (recoverable via git stash pop — unlike rm)"
      fi
      if git checkout -B main origin/main >> "$LOG" 2>&1; then
        git clean -fd src/ >> "$LOG" 2>&1 || true   # t273: untracked src husks break the resurrected build
        # drill-2 self-catch: this MUST be the same name step 2 reads — the
        # in-process path dies with the run, the re-exec path passes it via env.
        export REBOOT_NEEDS_DEPS=1
        mark_reborn tree-resurrected
        say "0. tree resurrected: main hard-landed on origin/main ($origin_head), src debris cleaned"
        self_after="$(git hash-object "$SELF" 2>/dev/null || echo unknown)"
        if [ "$self_before" != "$self_after" ]; then
          say "0. the resurrection replaced this script with a newer self — re-executing"
          exec env REBOOT_NEEDS_DEPS=1 REBOOT_REBORN="$REBORN" bash "$SELF"
        fi
      else
        say "0. WARNING — checkout onto origin/main FAILED (read $LOG); continuing on the local tree"
      fi
    fi
  else
    say "0. WARNING — git fetch failed (offline? credentials?) — skipping alignment;"
    say "   the tree stays as-found. If this is a post-reboot tar world, fetch is the cure."
  fi
else
  say "0. no git repo here — skipping resurrection (run from the project root)"
fi

# ---------------------------------------------------------------- 1. env pin
DB_URL="file:$ROOT/db/cryoflow.db"
PIN="DATABASE_URL=$DB_URL"   # the .env LINE (key included — grep/echo food)
export DATABASE_URL="$DB_URL"   # prisma reads the PROCESS env before .env — t417's wound
if [ ! -f .env ] || ! grep -qF "$PIN" .env; then
  [ -f .env ] && cp .env .env.pre-recover
  { grep -v '^DATABASE_URL=' .env.pre-recover 2>/dev/null || true; echo "$PIN"; } > .env
  say "1. .env pinned to db/cryoflow.db (boot's custom.db write overwritten; prior copy in .env.pre-recover)"
else
  say "1. .env already pinned to db/cryoflow.db"
fi

# ------------------------------------------------------------------- 2. deps
if [ "${REBOOT_NEEDS_DEPS:-0}" = "1" ] || [ ! -f node_modules/next/dist/bin/next ]; then
  [ "${REBOOT_NEEDS_DEPS:-0}" = "1" ] \
    && say "2. tree jumped (step 0) — node_modules may trail the resurrected package.json — bun install ..." \
    || say "2. node_modules missing (tar's narrow .gitignore) — bun install ..."
  bun install >> "$LOG" 2>&1 || { say "2. FAILED — bun install died, read $LOG"; exit 1; }
  say "2. deps installed"
else
  say "2. node_modules present"
fi

# ---------------------------------------------------------------- 3. schema
if bun run db:push >> "$LOG" 2>&1; then
  say "3. schema in place (prisma db push)"
else
  say "3. FAILED — db:push died, read $LOG"; exit 1
fi

# ----------------------------------------------------------------- 4. build
trio_complete() {
  [ -f .next/BUILD_ID ] && [ -f .next/standalone/server.js ] \
    && [ -d .next/standalone/.next/static ]
}
# build provenance (t422): a trio built from an OLDER tree is a shadow app —
# the t421 shadow-world lesson's build-axis cousin. The grinder now stamps
# the commit it built from (.next/.built-at-commit); a present stamp that
# disagrees with HEAD means src moved (step 0's resurrection, or a parallel
# lane's push) and the build must re-grind. No stamp = legacy build —
# accepted as before; every build from t422 on carries provenance.
build_stale() {
  built_at="$(cat .next/.built-at-commit 2>/dev/null || echo '')"
  head_now="$(git rev-parse HEAD 2>/dev/null || echo '')"
  [ -n "$built_at" ] && [ -n "$head_now" ] && [ "$built_at" != "$head_now" ]
}
if trio_complete && build_stale; then
  built_at="$(cat .next/.built-at-commit 2>/dev/null)"
  say "4. build provenance STALE (built at ${built_at:0:9}, tree at $(git rev-parse HEAD 2>/dev/null | cut -c1-9)) — re-grinding"
fi
if trio_complete && ! build_stale; then
  if [ -f .next/.built-at-commit ]; then
    say "4. build trio complete (BUILD_ID + standalone + static) and provenance fresh ($(cat .next/.built-at-commit | cut -c1-9))"
  else
    say "4. build trio complete (BUILD_ID + standalone + static) — provenance unstamped (legacy build, accepted)"
  fi
else
  say "4. build incomplete — ONE grinder round (cache grows across invocations)"
  bash scripts/build-until-green.sh "${REBOOT_BUILD_ATTEMPTS:-1}"
  rc=$?
  if [ "$rc" -ne 0 ]; then
    say "4. build not green yet (rc=$rc) — exit 42: RE-RUN THIS SCRIPT"
    exit 42
  fi
  say "4. build green — standalone startable"
fi

# ------------------------------------------------- 4.5 data-plane pin (t183)
# THE T420 LESSON, second verse of t417's env pin: the standalone server.js
# process.chdir(__dirname)s at boot, so WITHOUT the CRYOFLOW_DATA_DIR absolute
# override (Task 183) every file the engine touches resolves through
# .next/standalone/data — a SHADOW world. API-surface QA cannot see it (the
# DB rides the absolute DATABASE_URL), but every fs-level suite assertion
# can: the t417 suite's reclaimed.local named .next/standalone/data/relion
# and the suite's stateRuns() read a real file the server never wrote. And
# every `next build` DELETES .next/standalone — killing both the shadow and
# any symlink repair that predates it. So: pin the env (the server reads the
# REAL data/) AND repair the symlink (defense for any cwd-reading tool).
export CRYOFLOW_DATA_DIR="$ROOT/data"
if [ -d .next/standalone/data ] && [ ! -L .next/standalone/data ]; then
  rm -rf .next/standalone/data
  say "4.5 shadow data plane removed (a non-symlink .next/standalone/data is build debris)"
fi
ln -sfn "$ROOT/data" .next/standalone/data
say "4.5 data plane pinned: CRYOFLOW_DATA_DIR=$ROOT/data + symlink repaired"

# ------------------------------------------------------------- 5. prod lane
if pgrep -f dev-server-watchdog.sh >/dev/null 2>&1; then
  pkill -f dev-server-watchdog.sh 2>/dev/null || true
  sleep 1
  say "5. dev watchdog stopped (it would resurrect the doomed dev lane)"
fi
code="$(api_code "$ORIGIN/" || true)"
lpid="$(ss -tlnp 2>/dev/null | grep ':3000 ' | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1)"
# t434's live tear law: cmdline alone cannot see a stale standalone — a
# server can speak the prod lane AND still be born before the on-disk build.
# /proc/<pid> mtime IS the process's birth (seconds resolution); .next/BUILD_ID's
# mtime is the build's. Older server than build = the grinder outlived the boot.
standalone_current() {
  [ "$code" != "000" ] && [ -n "$lpid" ] \
    && tr '\0' ' ' < "/proc/$lpid/cmdline" 2>/dev/null | grep -q 'standalone/server.js' || return 1
  bt="$(stat -c %Y .next/BUILD_ID 2>/dev/null || echo 0)"
  pt="$(stat -c %Y "/proc/$lpid" 2>/dev/null || echo 0)"
  [ "$pt" -ge "$bt" ]
}
if standalone_current; then
  say "5. :3000 already speaks the prod standalone (pid $lpid), born after the on-disk build"
else
  # WHY we are here: a stale standalone, a foreign lane, or a free port —
  # classify loudly, then the kill+start below is COMMON to all three.
  if [ "$code" != "000" ] && [ -n "$lpid" ] \
     && tr '\0' ' ' < "/proc/$lpid/cmdline" 2>/dev/null | grep -q 'standalone/server.js'; then
    say "5. standalone (pid $lpid) predates the on-disk build — the grinder outlived the boot"
    say "   (t434's live tear: memory speaks the OLD build, disk holds a NEW one) — restarting"
  elif [ "$code" != "000" ] || [ -n "$(ss -ltn 2>/dev/null | grep ':3000 ')" ]; then
    say "5. :3000 held by a non-standalone lane (pid ${lpid:-?}) — takeover (t417: dev lane OOM-loops here)"
  fi
  if [ "$code" != "000" ] || [ -n "$(ss -ltn 2>/dev/null | grep ':3000 ')" ]; then
    if [ -n "$lpid" ]; then
      kill "$lpid" 2>/dev/null || true
      for _ in $(seq 1 5); do
        [ -d "/proc/$lpid" ] || break
        sleep 1
      done
      if [ -d "/proc/$lpid" ]; then
        say "   pid $lpid ignored SIGTERM (bun's own law, t416) — escalating to SIGKILL"
        kill -9 "$lpid" 2>/dev/null || true
        sleep 1
      fi
    fi
  fi
  say "5. starting prod standalone (orphaned child — re-parents to init)"
  ( DATABASE_URL="$DB_URL" CRYOFLOW_DATA_DIR="$ROOT/data" NODE_ENV=production nohup bun .next/standalone/server.js >> server.log 2>&1 & )
  code="000"
  for _ in $(seq 1 20); do
    sleep 3
    code="$(api_code "$ORIGIN/" || true)"
    [ "$code" = "200" ] && break
  done
  [ "$code" = "200" ] || { say "5. FAILED — prod never answered (last $code), read server.log"; exit 1; }
  say "5. prod standalone answers 200"
  mark_reborn prod-started
fi

# ------------------------------------------------------------------ 6. seed
code="$(api_code "$ORIGIN/api/project")"
say "6. seed door spoken ($code) — GET /api/project seeds the starter when the DB is empty"

# ---------------------------------------------------------- 7. mock cluster
if ss -ltn 2>/dev/null | grep -q ':3022 '; then
  say "7. mock cluster already listening on 3022"
else
  bash services/mock-cluster/launch.sh >> "$LOG" 2>&1
  sleep 2
  if ss -ltn 2>/dev/null | grep -q ':3022 '; then
    say "7. mock cluster launched"
  else
    say "7. FAILED — mock cluster did not take 3022, read $LOG"; exit 1
  fi
fi

# -------------------------------------------------------- 8. probe clear
# connections live in a FILE (data/remote-connections.json) — t419's live
# incident taught that the GET route carries a DB résumé query and 500s/
# empties when the DB is dead, which is exactly when a recovery runs: the
# FILE is the storage truth, so enumerate ids from it, not from the API.
CONN_FILE="$ROOT/data/remote-connections.json"
# the FILE is pretty-printed ("id": "conn-…") — the drill-1 run caught the
# compact-JSON pattern lying "no connections" against a living registry;
# tolerate the space the storage truth actually writes.
conn_ids() { grep -o '"id": *"conn-[^"]*"' "$CONN_FILE" 2>/dev/null | cut -d'"' -f4 | sort -u; }
conn_count() { conn_ids | wc -l; }
test_all_connections() {
  ids="$(conn_ids)"
  [ -n "$ids" ] || { say "   (no connections registered yet — the healer will create one)"; return 0; }
  for id in $ids; do
    c="$(api_code -X POST "$ORIGIN/api/remote/connections/$id/test")"
    say "   probe $id → $c (stale lastProbe re-pinned to fact)"
  done
}
say "8. probe clear (pre-chain):"
test_all_connections
conns_before="$(conn_count)"

# ------------------------------------------------------------- 9. demo chain
say "9. demo chain — idempotent advance (budget ${CHAIN_BUDGET}s)"
timeout "$CHAIN_BUDGET" node scripts/demo-chain-resurrect.mjs \
  2>&1 | tee .qa-logs/reboot-chain-last.log | tail -30
rc="${PIPESTATUS[0]}"
if [ "$rc" = "124" ]; then
  say "9. budget hit mid-chain — exit 43: RE-RUN THIS SCRIPT, the healer advances"
  exit 43
fi
if [ "$rc" != "0" ]; then
  say "9. chain FAILED (rc=$rc) — read .qa-logs/reboot-chain-last.log"
  exit 1
fi

# --------------------------------------------------------------- 10. verify
say "10. probe clear (post-chain, covers the healer's connection):"
test_all_connections
conns_after="$(conn_count)"
if [ "$conns_after" -gt "$conns_before" ]; then
  say "   !! DUPLICATE CONNECTION — the registry grew $conns_before → $conns_after during the"
  say "   !! chain (t419's conn-mukueu6l incident: the healer's API-reuse failed and it out-"
  say "   !! created). DELETE the extra via DELETE /api/remote/connections/<id> — the world"
  say "   !! is otherwise alive, but one target now has two doors."
fi
# ------------------------------------------------- 10.5 hydration probe (t434)
# "200 on /" is an SSR verdict only — the t434 tear served a perfectly healthy
# HTML while every chunk it referenced was gone from disk: the client never
# hydrated and the app was a dead painting. The served HTML names the build
# it believes in; the disk must answer for at least one of those names.
hy_url="$(curl -s --max-time 8 -H "Origin: $ORIGIN" "$ORIGIN/" | grep -o '/_next/static/[^"]\+\.js' | head -1)"
if [ -z "$hy_url" ]; then
  say "10. HYDRATION PROBE BLIND — the served HTML names no static chunk (SSR body unexpected) — read server.log"
  exit 1
fi
hy_code="$(api_code "$ORIGIN$hy_url")"
if [ "$hy_code" != "200" ]; then
  say "10. HYDRATION TEAR — the served HTML references $hy_url which answers $hy_code"
  say "    the server's memory and the disk disagree on the build (a grinder outlived"
  say "    the boot — t434's live incident). RE-RUN THIS SCRIPT: step 5 now restarts"
  say "    standalones born before the on-disk build."
  exit 1
fi
say "10. hydration probe: $hy_url → 200 (memory and disk speak the same build)"

code="$(api_code "$ORIGIN/api/project")"
say "WORLD ALIVE — app $code · build trio present · mock cluster up · demo chain verified (FSC/Guinier/official number assert in the chain's own step 6) · hydration probe green"

# world-rebirth stamp (t422): written ONLY when this run actually resurrected
# something — the family report's ⟳ reborn-world marker reads it.
if [ -n "$(echo "$REBORN" | tr -d ' ')" ]; then
  causes="$(echo "$REBORN" | tr -s ' ' '+' | sed 's/^+//')"
  printf '{\n  "at": "%s",\n  "by": "reboot-recover.sh",\n  "causes": "%s",\n  "head": "%s"\n}\n' \
    "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$causes" \
    "$(git rev-parse --short HEAD 2>/dev/null || echo unknown)" > "$ROOT/data/.world-reborn"
  say "   world rebirth recorded → data/.world-reborn (causes: $causes) — batches run after this instant are marked ⟳ reborn-world by family --summary"
fi

exit 0

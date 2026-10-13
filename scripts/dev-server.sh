#!/bin/bash
# CryoFlow dev-server launcher — survives the tool-call reaper.
#
# Why a script that exits: the sandbox kills any process that is still a
# descendant of the tool's bash shell when the call ends. Starting the server
# as a child of THIS script and then letting the script exit orphans the
# server (it re-parents to init) — the reaper then leaves it alone.
# The caller must wait for readiness INSIDE the same tool call that runs
# this script (see "Usage" below).
#
# Usage (single tool call!):
#   bash scripts/dev-server.sh; sleep 14; curl -sf localhost:3000/api/jobs >/dev/null && echo UP
#
# t377 — CRYOFLOW_TRUST_GATEWAY=1 opts the http-guard into the
# gateway-forwarded lane (served-behind-a-reverse-proxy deployments);
# unset it for the strict local-companion defaults.

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

# t524 — THE GUARD RIDES WITH THE SERVER. The watchdog's own header says
# "Run detached: (nohup bash scripts/dev-server-watchdog.sh …)" — a line a
# human must remember, and five windows of bare-OOM deaths (t520's five
# kills, t521's three, t523's dmesg witness at anon-rss 2.0GB, this
# window's own global OOM kill on pid 11942) prove memory always beats
# that memory. Every invocation of this script now carries its own
# watchdog — BOTH paths, the fresh boot below AND the already-running
# early exit (whose bare `exit 0` was exactly where the first cut of this
# edit put the guard: unreachable, self-caught in one live test). The
# flock single-keeper law makes a second instance a no-op BY
# CONSTRUCTION, so this is safe to call from anywhere — manual boots,
# agent re-fires, and the watchdog's own boot() (which re-enters this
# script while ALREADY holding the lock; the nested invocation loses
# flock and exits, no recursion). CRYOFLOW_NO_WATCHDOG=1 opts out for
# ceremonies that must not be resurrected mid-flight (e.g. a deliberate
# `next build` that needs the 4GB box's headroom while the dev lane is
# down).
ensure_watchdog() {
  [ "${CRYOFLOW_NO_WATCHDOG:-}" = "1" ] && return 0
  QA_LOG_DIR="${CRYOFLOW_QA_LOG_DIR:-/tmp/cryoflow-qa}"
  mkdir -p "$QA_LOG_DIR"
  ( setsid nohup bash scripts/dev-server-watchdog.sh >> "$QA_LOG_DIR/dev-watchdog.log" 2>&1 < /dev/null & )
}

# already up? then do nothing — but the guard still reports for duty
if curl -H "Origin: http://localhost:3000" -sf -o /dev/null --max-time 3 http://localhost:3000/api/jobs; then
  ensure_watchdog
  echo "already running (watchdog ensured)"
  exit 0
fi
# stale lock/socket cleanup: kill leftovers from a crashed run
# t859 — the stale-pattern lesson: this pkill grepped for "next dev -p 3000",
# a spelling the spawn below never used (it was flagless), so a crashed
# flagless instance survived its own cleanup — the next boot then found
# :3000 busy and Next SILENTLY BUMPED to :3001 ("Port 3000 is in use, trying
# 3001"), while every consumer (this script's own health check, the QA
# battery, the census) kept knocking on :3000. Match both spellings now.
pkill -f "next dev" 2>/dev/null
pkill -f "next dev -p 3000" 2>/dev/null
pkill -f "next-server" 2>/dev/null
sleep 1
# 4GB box: unbounded V8 heap lets Turbopack caches push RSS past 2.6GB and
# the kernel OOM-kills next-server mid-QA. Cap the old space so V8 GCs
# aggressively instead — a slow collect beats a SIGKILL.
# t402 — the cap is now tunable: 896 fits the Turbopack lane, but the
# WEBPACK lane (DEV_NEXT_ARGS="--webpack", the escape hatch for the
# Turbopack-compile OOM disease — kernel kill at ~3.4GB RSS regardless of
# this cap, three witnesses in the t402 window) needs ~1792MB of V8 heap
# to compile the home graph; 896 dies with "Ineffective mark-compacts".
export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--max-old-space-size=${DEV_HEAP_MB:-896}"
# t377 — HARD overrides: the sandbox tool environment itself exports a
# TEMPLATE DATABASE_URL; `${VAR:-…}` passthrough would poison Prisma into
# a User/Post-only database. Always pinned to THIS repo's own paths.
# t867 — the pin learns to READ the repo's own .env first (the single
# source of truth): the restored world's live data (the seed + the healer's
# 15-node chain) landed in db/custom.db through the cron boot's plain
# `next dev` (which reads .env), while this script's frozen cryoflow.db pin
# booted the watchdog churn loop against a 0-byte DB (P2021 every route).
# .env's file: URL mirrors Prisma's own resolution (absolute kept; relative
# resolved from prisma/); absent .env, the t377-era cryoflow.db pin stands.
_prisma_env_url() {
  local envf="$REPO_ROOT/.env"
  [ -f "$envf" ] || return 1
  local url
  url=$(grep -E '^[[:space:]]*DATABASE_URL=' "$envf" | tail -1 | sed -E 's/^[^=]*=[[:space:]]*"?([^"]*)"?[[:space:]]*$/\1/')
  [ -n "$url" ] || return 1
  case "$url" in
    file:/*) echo "$url" ;;
    file:*)  echo "file:$REPO_ROOT/prisma/${url#file:}" ;;
    *)       echo "$url" ;;
  esac
}
if _pin_from_env=$(_prisma_env_url); then
  export DATABASE_URL="$_pin_from_env"
else
  export DATABASE_URL="file:$REPO_ROOT/db/cryoflow.db"
fi
export CRYOFLOW_DATA_DIR="$REPO_ROOT/data"
export CRYOFLOW_TRUST_GATEWAY=1
# t402 — spawn under NODE explicitly: `bunx next` / `bun next` make BUN the
# runtime for the dev server itself, whose memory profile differs wildly
# from node's (t402 witness: kernel OOM at 3.45GB anon-RSS on the FIRST
# route compile under bun, three times; the t390-t401 era ran `bun run dev`
# which resolves the .bin shim under node via /bin/sh). node also honors
# the --max-old-space-size cap above; bun's Rust core ignores it.
# t402 — log to a FILE, not /dev/null: a silent death (node exits in the
# first seconds, no kernel OOM record, nothing to read) cost this window
# three blind restarts. The log is the witness.
# t503 — logs live OUTSIDE the repo tree. The old path (.qa-logs/ inside
# the checkout) fed a self-sustaining rebuild fire: the server's own
# request log (the browser polls /api/jobs every ~2s) wrote a line, Next's
# dev watcher saw the change, Fast Refresh rebuilt, the rebuild LOGGED
# more lines, and the loop ate ~44MB/s until the RSS recycle killed the
# server — every QA window eventually collapsed into it (the t501 OOM
# storms were this, unnamed). /tmp is outside the watcher's world.
QA_LOG_DIR="${CRYOFLOW_QA_LOG_DIR:-/tmp/cryoflow-qa}"
mkdir -p "$QA_LOG_DIR"
# t859 — pin the port: an occupied :3000 at boot made Next drift to :3001
# SILENTLY (the message scrolls past in a log nobody reads mid-incident);
# the whole lane speaks :3000, so a silent drift strands every consumer.
# Pinned, the busy case fails LOUD instead (Next exits EADDRINUSE, the
# watchdog's boot-fail streak handles it) — and the cleanup pkill above
# now matches the spawn it was written for.
setsid node node_modules/next/dist/bin/next dev -p 3000 ${DEV_NEXT_ARGS:-} > "$QA_LOG_DIR/dev-server.log" 2>&1 < /dev/null &
# this script exits immediately → server re-parents to init → survives
ensure_watchdog

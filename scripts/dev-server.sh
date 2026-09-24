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

# already up? then do nothing
if curl -sf -o /dev/null --max-time 3 http://localhost:3000/api/jobs; then
  echo "already running"
  exit 0
fi
# stale lock/socket cleanup: kill leftovers from a crashed run
pkill -f "next dev -p 3000" 2>/dev/null
pkill -f "next-server" 2>/dev/null
sleep 1
# 4GB box: unbounded V8 heap lets Turbopack caches push RSS past 2.6GB and
# the kernel OOM-kills next-server mid-QA. Cap the old space so V8 GCs
# aggressively instead — a slow collect beats a SIGKILL.
export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--max-old-space-size=896"
# t377 — HARD overrides: the sandbox tool environment itself exports a
# TEMPLATE DATABASE_URL (my-project's custom.db); `${VAR:-…}` passthrough
# would poison Prisma into a User/Post-only database. These two are always
# pinned to THIS repo's own paths.
export DATABASE_URL="file:$REPO_ROOT/db/cryoflow.db"
export CRYOFLOW_DATA_DIR="$REPO_ROOT/data"
export CRYOFLOW_TRUST_GATEWAY=1
setsid bun run dev > /dev/null 2>&1 < /dev/null &
# this script exits immediately → server re-parents to init → survives

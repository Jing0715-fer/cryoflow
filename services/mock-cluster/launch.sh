#!/bin/bash
# CryoFlow mock-cluster launcher — survives the sandbox tool-call reaper.
#
# Why a script that exits: this sandbox kills any process that is still a
# descendant of the tool's bash shell when the call ends (see the recipe in
# cryoflow/scripts/dev-server.sh). Starting the server as a child of THIS
# script and letting the script exit immediately orphans the server (it
# re-parents to init) — the reaper then leaves it alone.
#
# Usage (single tool call!):
#   bash services/mock-cluster/launch.sh; sleep 2; \
#     node services/mock-cluster/test-client.mjs 'echo ok'
# Or with hot reload:
#   bash services/mock-cluster/launch.sh dev
set -u
cd "$(dirname "$0")"
MODE="${1:-start}"   # start | dev
PORT="${MOCK_CLUSTER_PORT:-3022}"
LOG="${MOCK_CLUSTER_LOG:-/tmp/mock-cluster.log}"

# stale instance holding the port? kill it first
if ss -ltn 2>/dev/null | grep -q ":$PORT "; then
  echo "port $PORT busy — killing old listener"
  fuser -k "$PORT/tcp" 2>/dev/null || true
  sleep 1
fi

# t295 — exec the entrypoint by ABSOLUTE path: the surviving process's
# cmdline must carry "services/mock-cluster/server.mjs" so the suites'
# pattern-based cleanup (pkill -f 'mock-cluster/server.mjs') can find it.
# A bare relative path ("bun server.mjs") is invisible to that pattern —
# the root cause of mock residue surviving across windows. Side win: the
# cmdline no longer contains "run start", so `pkill -f "bun run start"`
# (the app's own start pattern) can never kill the mock by accident again.
# fuser -k by port stays the fallback reaper (cmdline-agnostic).
case "$MODE" in
  dev) setsid bun --hot "$PWD/server.mjs" > "$LOG" 2>&1 < /dev/null & ;;
  *)   setsid bun "$PWD/server.mjs"      > "$LOG" 2>&1 < /dev/null & ;;
esac
# this script exits immediately → server re-parents to init → survives

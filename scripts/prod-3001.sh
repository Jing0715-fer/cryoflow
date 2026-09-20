#!/usr/bin/env bash
# CryoFlow standalone PROD server on :3001 (t301 doctrine, t311 polish, t312
# data-root fix; t325 re-pointed at the my-project copy after a sandbox
# rebuild, t328 re-pointed HOME at the repo itself after the sandbox reset
# the my-project tree back to the generic scaffold — the repo is the only
# real tree now): the dev server's Turbopack side holds ~3.4GB RSS on this
# 4GB box and the OOM killer wins any browser+dev coexistence; the
# standalone build runs in a few hundred MB. Orphan-launch pattern
# (survives the tool-call reaper: THIS script exits immediately, the
# server re-parents to init — an inline `setsid … &` inside a tool-bash
# chain does NOT survive; the reaper walks the still-intact ancestry at
# call end, t327's own first-hand lesson).
# t328 — run with NODE, not bun: the bun runtime balloons under prisma
# query logging (2.6GB RSS → OOM kill); node stays flat for hours.
# CRYOFLOW_DATA_DIR (Task 183's own override, t312): the standalone server
# chdirs into .next/standalone at boot, so without the override the engine's
# data tree lands in .next/standalone/data — a directory EVERY `next build`
# deletes in its first seconds. Pin the real repo tree; the DB path is
# already absolute.
cd /home/z/cryoflow || exit 1
# t332 — ALWAYS restart, never "already running": this is a QA launcher
# for the CURRENT build. The shortcut served stale in-memory code twice
# (an instance from before a `next build` keeps answering :3001 while the
# disk holds the new standalone — every later assertion then tests the
# wrong build). Kill by the server path AND by port, then VERIFY the port
# is actually free before booting (the start-prod.sh lessons).
# t332 — kill by the LISTENER's pid, taken from ss: on this box lsof
# cannot see the standalone listener at all (`lsof -ti :3001
# -sTCP:LISTEN` returns empty while ss shows it), the process title is
# "next-server (v16.1.3)" — NOT "server.js", so pkill -f misses it — and
# fuser silently no-ops. The listener's own pid from ss, killed by
# number, is the only thing that reliably clears the port.
listener_pid() {
  ss -ltnp 2>/dev/null | awk '$4 ~ /:3001$/ { if (match($0, /pid=[0-9]+/)) { print substr($0, RSTART+4, RLENGTH-4); exit } }'
}
for i in 1 2 3 4 5; do
  pid="$(listener_pid)"
  [ -z "$pid" ] && break
  kill -9 "$pid" 2>/dev/null
  sleep 1
done
export DATABASE_URL="file:/home/z/cryoflow/db/cryoflow.db"
export CRYOFLOW_DATA_DIR="/home/z/cryoflow/data"
export RELION_HOME="/home/z/relion-install"
export RELION_CTFFIND_EXECUTABLE="/home/z/ctffind-4.1.14/bin/ctffind"
export LD_LIBRARY_PATH="/home/z/downloads/debroot/root/usr/lib/x86_64-linux-gnu:${LD_LIBRARY_PATH:-}"
export PATH="/home/z/.venv/bin:/home/z/relion-install/bin:${PATH}"
export PORT=3001 NODE_ENV=production
export HOSTNAME=127.0.0.1
export NODE_OPTIONS="--max-old-space-size=896"
# the log lives at the REPO ROOT (prod-3001.log) — the diag suites' log
# witnesses read exactly there (t325's server-log greps; moving it broke
# four witness assertions for one run — keep the path stable)
setsid /usr/bin/node /home/z/cryoflow/.next/standalone/server.js > /home/z/cryoflow/prod-3001.log 2>&1 < /dev/null &
exit 0

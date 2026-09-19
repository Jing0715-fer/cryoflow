#!/usr/bin/env bash
# CryoFlow standalone PROD server on :3001 (t301 doctrine, t311 polish, t312
# data-root fix): the dev server's Turbopack side holds ~3.4GB RSS on this
# 4GB box and the OOM killer wins any browser+dev coexistence; the standalone
# build runs in a few hundred MB. Orphan-launch pattern (survives the
# tool-call reaper: script exits immediately, server re-parents to init).
# CRYOFLOW_DATA_DIR (Task 183's own override, t312): the standalone server
# chdirs into .next/standalone at boot, so without the override the engine's
# data tree lands in .next/standalone/data — a directory EVERY `next build`
# deletes in its first seconds. Pin the real repo tree; the DB path is
# already absolute.
cd /home/z/cryoflow || exit 1
if curl -sf -o /dev/null --max-time 3 http://localhost:3001/api/jobs; then
  echo "already running"
  exit 0
fi
pkill -f "next-server.*3001|standalone/server.js" 2>/dev/null
sleep 1
export DATABASE_URL="file:/home/z/cryoflow/db/cryoflow.db"
export CRYOFLOW_DATA_DIR="/home/z/cryoflow/data"
export RELION_HOME="/home/z/relion-install"
export RELION_CTFFIND_EXECUTABLE="/home/z/ctffind-4.1.14/bin/ctffind"
export LD_LIBRARY_PATH="/home/z/downloads/debroot/root/usr/lib/x86_64-linux-gnu:${LD_LIBRARY_PATH:-}"
export PATH="/home/z/.venv/bin:/home/z/relion-install/bin:${PATH}"
export PORT=3001 NODE_ENV=production
export HOSTNAME=127.0.0.1
export NODE_OPTIONS="--max-old-space-size=896"
setsid /usr/local/bin/bun /home/z/cryoflow/.next/standalone/server.js > /home/z/cryoflow/scripts/prod-3001.log 2>&1 < /dev/null &
exit 0

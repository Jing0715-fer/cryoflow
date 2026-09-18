#!/usr/bin/env bash
# t301 — standalone prod server on :3001, orphan-launch pattern (survives
# the tool-call reaper: script exits immediately, server re-parents to init)
cd /home/z/cryoflow || exit 1
if curl -sf -o /dev/null --max-time 3 http://localhost:3001/api/jobs; then
  echo "already running"; exit 0
fi
pkill -f "standalone/server.js" 2>/dev/null; sleep 1
export DATABASE_URL="file:/home/z/cryoflow/db/cryoflow.db"
export RELION_HOME="/home/z/relion-install"
export RELION_CTFFIND_EXECUTABLE="/home/z/ctffind-4.1.14/bin/ctffind"
export LD_LIBRARY_PATH="/home/z/downloads/debroot/root/usr/lib/x86_64-linux-gnu:${LD_LIBRARY_PATH:-}"
export PATH="/home/z/.venv/bin:/home/z/relion-install/bin:${PATH}"
export PORT=3001 NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=896"
setsid bun /home/z/cryoflow/.next/standalone/server.js > /home/z/cryoflow/scripts/prod-3001.log 2>&1 < /dev/null &
exit 0

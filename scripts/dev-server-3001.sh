#!/usr/bin/env bash
# CryoFlow dev server on :3001 with the full runtime env injection.
# Survives tool-call recycling via the setsid + immediate-exit pattern.
cd /home/z/cryoflow || exit 1
if curl -sf -o /dev/null --max-time 3 http://localhost:3001/api/jobs; then
  echo "already running"
  exit 0
fi
pkill -f "next dev -p 3001" 2>/dev/null
sleep 1
export DATABASE_URL="file:/home/z/cryoflow/db/cryoflow.db"
export RELION_HOME="/home/z/relion-install"
export RELION_CTFFIND_EXECUTABLE="/home/z/ctffind-4.1.14/bin/ctffind"
export LD_LIBRARY_PATH="/home/z/downloads/debroot/root/usr/lib/x86_64-linux-gnu:${LD_LIBRARY_PATH:-}"
export PATH="/home/z/.venv/bin:/home/z/relion-install/bin:${PATH}"
setsid /usr/local/bin/bun /home/z/cryoflow/node_modules/.bin/next dev -p 3001 > /home/z/cryoflow/scripts/dev-3001.log 2>&1 < /dev/null &
# script exits immediately → server re-parents to init → survives
exit 0

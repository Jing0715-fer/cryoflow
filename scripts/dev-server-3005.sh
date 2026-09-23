#!/usr/bin/env bash
# CryoFlow dev server on :3005 (t367) — the dev-server-3001.sh doctrine:
# setsid + immediate exit → the server re-parents to init and survives
# tool-call recycling. The full runtime env rides along.
cd /home/z/cryoflow || exit 1
if curl -sf -o /dev/null --max-time 3 http://localhost:3005/api/jobs; then
  echo "already running"
  exit 0
fi
pkill -f "next dev -p 3005" 2>/dev/null
sleep 1
export DATABASE_URL="file:/home/z/cryoflow/db/cryoflow.db"
export RELION_HOME="/home/z/relion-install"
export RELION_CTFFIND_EXECUTABLE="/home/z/ctffind-4.1.14/bin/ctffind"
export LD_LIBRARY_PATH="/home/z/downloads/debroot/root/usr/lib/x86_64-linux-gnu:${LD_LIBRARY_PATH:-}"
export PATH="/home/z/.venv/bin:/home/z/relion-install/bin:${PATH}"
# 4GB box: cap the old space so V8 GCs aggressively (a slow collect beats
# the kernel's SIGKILL mid-compile).
export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--max-old-space-size=896"
setsid /usr/local/bin/bun /home/z/cryoflow/node_modules/.bin/next dev -p 3005 > /home/z/cryoflow/scripts/dev-3005.log 2>&1 < /dev/null &
# script exits immediately → server re-parents to init → survives
exit 0

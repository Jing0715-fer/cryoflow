#!/bin/bash
# CryoFlow STANDALONE production server on :3001 (t391) — the browser-QA
# line per the t376/t387 discipline (dev + chromium = OOM on the 4GB box).
#
# Starts from the already-built .next/standalone bundle. Rebuild first:
#   node node_modules/.bin/next build && \
#   cp -r .next/static .next/standalone/.next/ && \
#   cp -r public .next/standalone/
#
# Survives the sandbox tool-call reaper via the launch.sh pattern: this
# script exits IMMEDIATELY after spawning (the server re-parents to init;
# a child spawned by a tool-call bash that lingers even a few seconds
# gets SIGTERMed at call end — observed twice on t391).
set -u
cd /home/z/cryoflow
if curl -sf -o /dev/null --max-time 3 http://localhost:3001/api/jobs; then
  echo "already running"
  exit 0
fi
pkill -f "standalone/server.js" 2>/dev/null
sleep 1
export DATABASE_URL="file:/home/z/cryoflow/db/cryoflow.db"
export CRYOFLOW_DATA_DIR="/home/z/cryoflow/data"
export PORT=3001
export HOSTNAME=0.0.0.0
setsid node .next/standalone/server.js > /home/z/cryoflow/scripts/standalone-3001.log 2>&1 < /dev/null &
exit 0

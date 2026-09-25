#!/usr/bin/env bash
# CryoFlow STANDalone production server on :3001 (t376/t383's production
# line — the only shape a browser QA session may run against on this 4GB
# box; dev + chrome OOMs, see the worklog's repeated convictions).
# Survives tool-call recycling via the setsid + immediate-exit pattern
# (same as dev-server-3001.sh).
cd /home/z/cryoflow || exit 1
if curl -sf -o /dev/null --max-time 3 http://localhost:3001/api/jobs; then
  echo "already running"
  exit 0
fi
pkill -f "standalone/server.js" 2>/dev/null
pkill -f "next-server" 2>/dev/null
sleep 1
export NODE_ENV=production
export DATABASE_URL="file:/home/z/cryoflow/db/cryoflow.db"
export CRYOFLOW_DATA_DIR="/home/z/cryoflow/data"
# t377 — the hosted-preview lane: requests through the reverse proxy carry
# its forwarding signature, which the http-guard's Host pin accepts.
export CRYOFLOW_TRUST_GATEWAY=1
export PORT=3001
export HOSTNAME=127.0.0.1
setsid /usr/bin/env node /home/z/cryoflow/.next/standalone/server.js > /home/z/cryoflow/standalone-3001.log 2>&1 < /dev/null &
# script exits immediately → server re-parents to init → survives
exit 0

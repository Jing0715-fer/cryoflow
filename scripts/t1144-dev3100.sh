#!/bin/bash
# t1144 — the dev lane on :3100 (the A/B pixel testimony's live door).
# The t1134 nohup-orphan law's surviving shape: a FOREGROUND script that
# spawns the server via setsid and exits — the same shape start-prod.sh
# speaks (its bun server survived every window; hand-booted orphans die).
cd /home/z/my-project
export DATABASE_URL="file:/home/z/my-project/db/cryoflow.db"
export CRYOFLOW_DATA_DIR=/home/z/my-project/data
export NODE_OPTIONS="--max-old-space-size=768"
mkdir -p /tmp/cryoflow-qa
if curl -H "Origin: http://localhost:3100" -sf -o /dev/null --max-time 2 http://localhost:3100/api/jobs 2>/dev/null; then
  echo "dev lane already up on :3100"
  exit 0
fi
setsid node node_modules/next/dist/bin/next dev -p 3100 > /tmp/cryoflow-qa/t1144-dev3100.log 2>&1 < /dev/null &
echo "spawned, pid $!"

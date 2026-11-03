#!/bin/bash
# qa62-phase-c.sh — self-contained: boot server → seed → phase C → report.
# Background processes get reaped between tool calls on this box, so the
# server lives only INSIDE one tool call.
cd /home/z/my-project
pkill -f "next-server" 2>/dev/null; pkill -f "qa-server-watchdog" 2>/dev/null; sleep 1
NODE_OPTIONS="--max-old-space-size=1536" nohup bun next start > .qa-logs/prod-server.log 2>&1 &
SRV=$!
for i in $(seq 1 25); do
  sleep 1
  curl -s -o /dev/null --max-time 2 http://localhost:3000/ && break
done
curl -s -o /dev/null -w "boot=%{http_code}\n" --max-time 3 http://localhost:3000/

python3 scripts/qa60-seed-fsc.py 2>&1 | tail -1
echo "entries=$(python3 -c "import json; print(len(json.load(open('data/engine-state.json'))))")"

QA_PHASES=C node scripts/qa62-e2e.mjs 2>&1 | tail -8
echo "C_EXIT=$?"
echo "entries_after=$(python3 -c "import json; print(len(json.load(open('data/engine-state.json'))))")"
kill $SRV 2>/dev/null; pkill -f "next-server" 2>/dev/null
echo DONE

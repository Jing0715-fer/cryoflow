#!/bin/bash
# qa62-cleanup.sh — one-shot, single-tool-call cleanup verification:
# boot server → seed --clean → verify live job gone + index empty.
cd /home/z/my-project
setsid bash -c 'cd /home/z/my-project && exec bun next start >> .qa-logs/prod-server.log 2>&1' < /dev/null > /dev/null 2>&1 &
for i in $(seq 1 14); do
  sleep 1
  curl -s -o /dev/null --max-time 2 http://localhost:3000/ && break
done
curl -s -o /dev/null -w "boot=%{http_code}\n" --max-time 3 http://localhost:3000/
python3 scripts/qa60-seed-fsc.py --clean 2>&1 | tail -4
echo "--- verification ---"
curl -s --max-time 5 "http://localhost:3000/api/jobs" | python3 -c "
import json, sys
body = json.load(sys.stdin)
jobs = body.get('jobs', body)
live = [j for j in jobs if j.get('name') == 'QA Refine Live']
seeds = [j['name'] for j in jobs if str(j.get('name','')).startswith('QA ')]
print('live-job-present:', bool(live))
print('remaining QA-named jobs:', seeds if seeds else 'none')
"
curl -s --max-time 5 "http://localhost:3000/api/projects/cmtrzp5x80002p8uofb9eu5pp/fsc-index" | python3 -c "
import json, sys
print('fsc-index jobs:', len(json.load(sys.stdin).get('jobs', [])))
"
pkill -f next-server 2>/dev/null
echo CLEANUP-DONE

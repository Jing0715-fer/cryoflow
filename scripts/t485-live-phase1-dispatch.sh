#!/usr/bin/env bash
# t485 phase 1 — a REAL refine3d dispatched through the mock cluster, so
# phase 2 (continue_run on the cluster lane) has a checkpoint to continue.
# The QA job is NON-auto (autoRefine:false, iterations:5) — the continue
# tool's auto-refine gate would refuse an auto-refine, and the fixed-
# iteration run is the textbook continue shape (5 + 3 → 8).
# Bare-POST dispatch (t317): the project's binding (Mock Cluster) picks the
# lane; the engine stages upstream files and runs the real mock RELION.
set -uo pipefail
BASE=http://localhost:3000
O=(-H "Origin: $BASE" -H "Content-Type: application/json")

echo "== 1. create the QA refine3d =="
NEW=$(curl -s "${O[@]}" -X POST "$BASE/api/jobs" -d '{
  "type": "refine3d",
  "name": "QA Refine Cluster Continue",
  "x": 3600, "y": 560,
  "params": {
    "symmetry": "D2", "iniHigh": 50, "doCtf": true, "particleDiameter": 200,
    "autoRefine": false, "iterations": 5, "tau2Fudge": 1, "doZeroMask": true,
    "samplingStep": "7.5", "offsetRange": 5, "offsetStep": 1, "padding": 2,
    "threads": 4
  }
}')
echo "$NEW" | python3 -c "import json,sys; d=json.load(sys.stdin); j=d.get('job',d); print('created:', j.get('id'), '| status:', j.get('status'))"
JID=$(echo "$NEW" | python3 -c "import json,sys; d=json.load(sys.stdin); j=d.get('job',d); print(j.get('id',''))")
if [ -z "$JID" ]; then echo "CREATE FAILED"; exit 1; fi

echo "== 2. wire Rebalance → QA job (particles → particles) =="
curl -s "${O[@]}" -X POST "$BASE/api/edges" -d "{
  \"fromJobId\": \"cmukrkgle000srjob623bpyhs\",
  \"toJobId\": \"$JID\",
  \"fromPort\": \"particles\", \"toPort\": \"particles\"
}" | python3 -c "import json,sys; d=json.load(sys.stdin); e=d.get('edge',d); print('edge:', e.get('id', d))" 

echo "== 3. bare-POST dispatch → the project's cluster binding picks the lane =="
curl -s "${O[@]}" -X POST "$BASE/api/jobs/$JID/run" -d '{}' --max-time 30 | python3 -c "
import json,sys
d=json.load(sys.stdin)
j=d.get('job',{})
print('dispatch:', j.get('id','')[-8:], '| status:', j.get('status'), '| waiting:', d.get('waiting'), '| error:', d.get('error'))"

echo "== 4. poll until completed (timeout 240s) =="
for i in $(seq 1 48); do
  sleep 5
  ST=$(curl -s "$BASE/api/jobs" "${O[@]}" --max-time 8 | python3 -c "
import json,sys
d=json.load(sys.stdin)
js=d.get('jobs',d)
j=[x for x in js if x.get('id','')=='$JID']
print(j[0].get('status','?') if j else 'gone')")
  echo "  [$((i*5))s] $ST"
  if [ "$ST" = "completed" ] || [ "$ST" = "failed" ] || [ "$ST" = "gone" ]; then break; fi
done
echo "JID=$JID" > /tmp/t485-jobid.txt
echo "phase 1 done: $JID ($ST)"

#!/usr/bin/env bash
# t453 live QA surgery — twin the class2d, wire it, run it, then mint the
# QA particles-mouth consumer. Snapshot printed at every step.
set -uo pipefail
H='-H Content-Type:application/json -H Origin:http://localhost:3000'
B=http://localhost:3000
CID=cmukrkgk3000grjobrlhupb8a      # original class2d
EID=cmukrkgjx000erjob36vow0pn      # extract feeding it
WS=cmukrk2z50008rjobxbrqiqyv       # workspace

echo "=== snapshot: jobs/edges before ==="
curl -s $H $B/api/jobs | python3 -c "import json,sys;d=json.load(sys.stdin);print('jobs:',len(d['jobs']))"
curl -s $H $B/api/edges | python3 -c "import json,sys;d=json.load(sys.stdin);print('edges:',len(d['edges']))"

echo "=== 1. mint twin class2d ==="
TWIN=$(curl -s $H -X POST $B/api/jobs -d "{
  \"type\":\"class2d\",
  \"name\":\"2D Classification (copy)\",
  \"x\":1050,\"y\":420,
  \"workspaceId\":\"$WS\",
  \"params\":{\"numClasses\":50,\"iterations\":25,\"tau2Fudge\":2,\"particleDiameter\":200,\"doFlattenSolvent\":true,\"useGrad\":true,\"doCTF\":true,\"doZeroMask\":true,\"doCenterClasses\":true}
}")
TID=$(echo "$TWIN" | python3 -c "import json,sys;print(json.load(sys.stdin)['job']['id'])")
echo "twin id: $TID"

echo "=== 2. wire extract -> twin (particles) ==="
curl -s $H -X POST $B/api/edges -d "{\"fromJobId\":\"$EID\",\"toJobId\":\"$TID\",\"fromPort\":\"particles\",\"toPort\":\"particles\"}" | head -c 200; echo ""

echo "=== 3. run twin (bare POST) ==="
curl -s $H -X POST $B/api/jobs/$TID/run | head -c 200; echo ""

echo "=== 4. poll twin status ==="
for i in $(seq 1 40); do
  sleep 4
  ST=$(curl -s $H $B/api/jobs/$TID | python3 -c "import json,sys;j=json.load(sys.stdin);j=j.get('job',j);print(j['status'],j.get('progress'))")
  echo "  [$i] $ST"
  case "$ST" in completed*|failed*|canceled*) break;; esac
done

echo "=== 5. twin occupancy vs original ==="
python3 - "$TID" << 'PY'
import json, sys, urllib.request
def get(url):
    r = urllib.request.Request(url, headers={"Origin": "http://localhost:3000"})
    return json.load(urllib.request.urlopen(r))
tid = sys.argv[1]
a = get("http://localhost:3000/api/jobs/cmukrkgk3000grjobrlhupb8a/classes")
b = get(f"http://localhost:3000/api/jobs/{tid}/classes")
fa = {c["cls"]: c["fraction"] for c in a["classes"]}
fb = {c["cls"]: c["fraction"] for c in b["classes"]}
only_a = sorted(set(fa) - set(fb)); only_b = sorted(set(fb) - set(fa))
gained = sorted(k for k in set(fa) & set(fb) if fb[k] > fa[k])
lost = sorted(k for k in set(fa) & set(fb) if fb[k] < fa[k])
held = sorted(k for k in set(fa) & set(fb) if fb[k] == fa[k])
print(f"A: total={a['total']} classes={len(fa)}  B: total={b['total']} classes={len(fb)}")
print(f"gained({len(gained)}): {gained}")
print(f"lost({len(lost)}): {lost}")
print(f"held: {len(held)}  onlyA: {len(only_a)}  onlyB: {len(only_b)}")
PY

echo "=== 6. mint QA consumer (select2d on ORIGINAL's particles mouth) ==="
QA=$(curl -s $H -X POST $B/api/jobs -d "{
  \"type\":\"select2d\",
  \"name\":\"Selection QA\",
  \"x\":1400,\"y\":640,
  \"workspaceId\":\"$WS\",
  \"params\":{\"selectedClasses\":\"auto\",\"occupancyCutoff\":0.5}
}")
QID=$(echo "$QA" | python3 -c "import json,sys;print(json.load(sys.stdin)['job']['id'])")
echo "QA id: $QID"
curl -s $H -X POST $B/api/edges -d "{\"fromJobId\":\"$CID\",\"toJobId\":\"$QID\",\"fromPort\":\"particles\",\"toPort\":\"particles\"}" | head -c 200; echo ""
echo "TID=$TID" > /tmp/t453-ids.env
echo "QID=$QID" >> /tmp/t453-ids.env
echo "=== surgery done — jobs/edges now ==="
curl -s $H $B/api/jobs | python3 -c "import json,sys;d=json.load(sys.stdin);print('jobs:',len(d['jobs']))"
curl -s $H $B/api/edges | python3 -c "import json,sys;d=json.load(sys.stdin);print('edges:',len(d['edges']))"

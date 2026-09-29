#!/usr/bin/env bash
# t476 live — the cluster's history through the real agent loop (builtin GLM).
# The real ledger (engine-state.json) remembers 10 dispatches through
# "Mock Cluster" (conn-mukrkgil) — every one exit 0, every jobId GONE from
# the DB (the canvases let them go; the ledger remembers). So the honest
# chain is: history question → list_clusters (zero args) → the résumé
# block answers total/completed/failed + the 3 newest, and the model must
# say the jobs are gone (exists:false) while the records still name them.
# t475's two lessons ride along: reset FIRST (a repeat POST would answer
# from session history instead of calling the tool), and tee the FIRST
# response so iter-0 tool events are printed, not lost.
set -uo pipefail
BASE=http://localhost:3000
O=(-H "Origin: $BASE" -H "Content-Type: application/json")

curl -s "${O[@]}" -X POST "$BASE/api/ai/chat" -d '{"action":"reset"}' --max-time 30 > /dev/null
echo "session reset"

SID=$(curl -s "${O[@]}" -X POST "$BASE/api/ai/chat" -d '{"message":"Mock Cluster 这台集群最近跑过什么？请用具体任务类型和时间回答，并说明这些任务现在还能不能在画布上打开。"}' --max-time 150 | tee /tmp/t476-first.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('sessionId',''))")
echo "session: $SID"
python3 -c "
import json
d=json.load(open('/tmp/t476-first.json'))
for e in d.get('events',[]):
    t=e.get('type')
    if t=='tool_call':
        print(f\"  [iter 0] TOOL CALL: {e.get('name')} args={json.dumps(e.get('args',{}),ensure_ascii=False)[:160]}\")
    elif t=='tool_result':
        det=e.get('detail') or {}
        rows=(det or {}).get('roster') if isinstance(det,dict) else None
        line=f\"  [iter 0] TOOL RESULT ok={e.get('ok')} name={e.get('name')}\"
        if isinstance(rows,list):
            for c in rows:
                dis=c.get('dispatches')
                if dis:
                    line+=f\" | {c.get('name')} total={dis.get('total')} ok={dis.get('completed')} fail={dis.get('failed')} last={dis.get('lastRunAt')} newest={[(r.get('jobType'),r.get('exists')) for r in dis.get('recent',[])]}\"
                else:
                    line+=f\" | {c.get('name')} (no résumé)\"
        print(line)
        print(f\"           summary: {(e.get('summary') or '')[:400]}\")
    elif t=='assistant_text':
        print(f\"  [iter 0] ASSISTANT: {(e.get('text') or '')[:400]}\")
"

for i in 1 2 3 4 5 6; do
  RESP=$(curl -s "${O[@]}" -X POST "$BASE/api/ai/chat" -d "{\"sessionId\":\"$SID\",\"continue\":true}" --max-time 180)
  echo "$RESP" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for e in d.get('events',[]):
    t=e.get('type')
    if t=='tool_call':
        print(f\"  [iter $i] TOOL CALL: {e.get('name')} args={json.dumps(e.get('args',{}),ensure_ascii=False)[:160]}\")
    elif t=='tool_result':
        det=e.get('detail') or {}
        rows=(det or {}).get('roster') if isinstance(det,dict) else None
        line=f\"  [iter $i] TOOL RESULT ok={e.get('ok')} name={e.get('name')}\"
        if isinstance(rows,list):
            for c in rows:
                dis=c.get('dispatches')
                if dis:
                    line+=f\" | {c.get('name')} total={dis.get('total')} ok={dis.get('completed')} fail={dis.get('failed')} last={dis.get('lastRunAt')} newest={[(r.get('jobType'),r.get('exists')) for r in dis.get('recent',[])]}\"
                else:
                    line+=f\" | {c.get('name')} (no résumé)\"
        print(line)
        print(f\"           summary: {(e.get('summary') or '')[:400]}\")
    elif t=='assistant_text':
        print(f\"  [iter $i] ASSISTANT: {(e.get('text') or '')[:800]}\")
    elif t=='error':
        print(f\"  [iter $i] ERROR: {e.get('message')}\")
nc = d.get('needsContinue')
print(f\"  [iter $i] needsContinue={nc}\")
"
  NEED=$(echo "$RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('needsContinue'))")
  [ "$NEED" != "True" ] && break
done
echo "session history: $BASE/api/ai/chat (GET)"

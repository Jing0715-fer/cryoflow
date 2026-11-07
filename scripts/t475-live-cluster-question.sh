#!/usr/bin/env bash
# t475 live — the cluster roll through the real agent loop (builtin GLM).
# The real registry holds ONE connection ("Mock Cluster", 127.0.0.1, last
# probe ok 2026-09-28 with Slurm + 4 relion modules) and the ACTIVE
# project is bound to it — so the honest chain is: cluster question →
# list_clusters (the 19th tool, zero args) → the registry's own roll call
# → the model speaks the roster in Chinese. No mutation, no probing: the
# read wears the dialog's own last-known truth.
set -uo pipefail
BASE=http://localhost:3000
O=(-H "Origin: $BASE" -H "Content-Type: application/json")

SID=$(curl -s "${O[@]}" -X POST "$BASE/api/ai/chat" -d '{"message":"我有哪些 SSH 集群可以用？能上集群跑吗？集群上有哪些 RELION 模块？请用具体名字和数字回答。"}' --max-time 120 | tee /tmp/t475-first.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('sessionId',''))")
echo "session: $SID"
python3 -c "
import json
d=json.load(open('/tmp/t475-first.json'))
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
                p=c.get('probe') or {}
                line+=f\" | {c.get('name')} {p.get('state')} modules={len(p.get('relionModules') or [])} slurm={p.get('slurm')} bound={c.get('projectBound')} checkedAt={p.get('checkedAt')}\"
        print(line)
        print(f\"           summary: {(e.get('summary') or '')[:300]}\")
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
                p=c.get('probe') or {}
                line+=f\" | {c.get('name')} {p.get('state')} modules={len(p.get('relionModules') or [])} slurm={p.get('slurm')} bound={c.get('projectBound')} checkedAt={p.get('checkedAt')}\"
        print(line)
        print(f\"           summary: {(e.get('summary') or '')[:300]}\")
    elif t=='assistant_text':
        print(f\"  [iter $i] ASSISTANT: {(e.get('text') or '')[:500]}\")
    elif t=='error':
        print(f\"  [iter $i] ERROR: {e.get('message')}\")
nc = d.get('needsContinue')
print(f\"  [iter $i] needsContinue={nc}\")
"
  NEED=$(echo "$RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('needsContinue'))")
  [ "$NEED" != "True" ] && break
done
echo "session history: $BASE/api/ai/chat (GET)"

#!/usr/bin/env bash
# t470 live — the convergence question through the real agent loop (builtin GLM).
# The live world's serial subject: "2D Classification (tutorial)" — a real
# 201-round class2d mirror (it000 28.0 Å → it200 7.11 Å).
set -uo pipefail
BASE=http://localhost:3000
O=(-H "Origin: $BASE" -H "Content-Type: application/json")

SID=$(curl -s "${O[@]}" -X POST "$BASE/api/ai/chat" -d '{"message":"「2D Classification (tutorial)」这个 2D 分类跑收敛了吗？分类还在重新洗牌吗？估计分辨率还有在进步吗？请用数字回答。"}' --max-time 120 | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('sessionId',''))")
echo "session: $SID"

for i in 1 2 3 4 5 6 7 8; do
  RESP=$(curl -s "${O[@]}" -X POST "$BASE/api/ai/chat" -d "{\"sessionId\":\"$SID\",\"continue\":true}" --max-time 180)
  echo "$RESP" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for e in d.get('events',[]):
    t=e.get('type')
    if t=='tool_call':
        print(f\"  [iter $i] TOOL CALL: {e.get('name')} args={json.dumps(e.get('args',{}),ensure_ascii=False)[:200]}\")
    elif t=='tool_result':
        det=e.get('detail') or {}
        dia=(det or {}).get('dialect') if isinstance(det,dict) else None
        print(f\"  [iter $i] TOOL RESULT ok={e.get('ok')} name={e.get('name')} dialect={dia}\")
        print(f\"           summary: {(e.get('summary') or '')[:260]}\")
    elif t=='assistant_text':
        print(f\"  [iter $i] ASSISTANT: {(e.get('text') or '')[:900]}\")
    elif t=='error':
        print(f\"  [iter $i] ERROR: {e.get('message')}\")
print(f\"  [iter $i] needsContinue={d.get('needsContinue')}\")
"
  NEEDS=$(echo "$RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('needsContinue'))")
  if [ "$NEEDS" != "True" ]; then break; fi
done

echo "--- world unchanged? ---"
curl -s "$BASE/api/jobs" | python3 -c "
import json,sys
d=json.load(sys.stdin); jobs=d if isinstance(d,list) else d.get('jobs',[])
print('jobs:', len(jobs), 'statuses:', {s:sum(1 for j in jobs if j.get('status')==s) for s in set(j.get('status') for j in jobs)})
"

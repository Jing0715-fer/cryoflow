#!/usr/bin/env bash
# t468 live — the count question through the real agent loop (builtin GLM).
set -uo pipefail
BASE=http://localhost:3000
O=(-H "Origin: $BASE" -H "Content-Type: application/json")

SID=$(curl -s "${O[@]}" -X POST "$BASE/api/ai/chat" -d '{"message":"这条链上我的粒子都去哪了？从导入到现在一共有多少颗粒？最后地图分辨率是多少？请用数字回答。"}' --max-time 120 | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('sessionId',''))")
echo "session: $SID"

for i in 1 2 3 4 5 6 7 8; do
  RESP=$(curl -s "${O[@]}" -X POST "$BASE/api/ai/chat" -d "{\"sessionId\":\"$SID\",\"continue\":true}" --max-time 180)
  echo "$RESP" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for e in d.get('events',[]):
    t=e.get('type')
    if t=='tool_call':
        print(f\"  [iter $i] TOOL CALL: {e.get('name')} args={json.dumps(e.get('args',{}),ensure_ascii=False)[:120]}\")
    elif t=='tool_result':
        det=e.get('detail') or {}
        picked=(det or {}).get('picked') if isinstance(det,dict) else None
        print(f\"  [iter $i] TOOL RESULT ok={e.get('ok')} name={e.get('name')} picked={picked}\")
    elif t=='assistant_text':
        print(f\"  [iter $i] ASSISTANT: {(e.get('text') or '')[:600]}\")
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
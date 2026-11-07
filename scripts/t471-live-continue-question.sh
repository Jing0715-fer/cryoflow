#!/usr/bin/env bash
# t471 live — the continue verb through the real agent loop (builtin GLM).
# The live world's subject: "QA Class2D Source" — a local-lane class2d
# fixture whose workdir now holds a complete it012 optimiser family
# (the t469 witness surgery, extended). The machine has NO local RELION,
# so the honest chain is: verdict-free verb request → continue_run →
# the plan written (miniBatches 250, fn_cont=it012) → the engine's own
# "RELION not detected" refusal → the model reports the fix.
set -uo pipefail
BASE=http://localhost:3000
O=(-H "Origin: $BASE" -H "Content-Type: application/json")

SID=$(curl -s "${O[@]}" -X POST "$BASE/api/ai/chat" -d '{"message":"QA Class2D Source 这个 2D 分类的精度还没到位。请帮它继续多跑 50 个 mini-batch——注意别毁掉它已有的结果。"}' --max-time 120 | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('sessionId',''))")
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
        lane=(det or {}).get('lane') if isinstance(det,dict) else None
        tot=(det or {}).get('totalIter') if isinstance(det,dict) else None
        print(f\"  [iter $i] TOOL RESULT ok={e.get('ok')} name={e.get('name')} lane={lane} totalIter={tot}\")
        print(f\"           summary: {(e.get('summary') or '')[:300]}\")
    elif t=='assistant_text':
        print(f\"  [iter $i] ASSISTANT: {(e.get('text') or '')[:900]}\")
    elif t=='error':
        print(f\"  [iter $i] ERROR: {e.get('message')}\")
print(f\"  [iter $i] needsContinue={d.get('needsContinue')}\")
"
  NEEDS=$(echo "$RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('needsContinue'))")
  if [ "$NEEDS" != "True" ]; then break; fi
done

echo "--- the plan on the job (the DB read-back) ---"
curl -s "$BASE/api/jobs" | python3 -c "
import json,sys
d=json.load(sys.stdin); jobs=d if isinstance(d,list) else d.get('jobs',[])
j=[x for x in jobs if x['id']=='cmumtmbc4000brjmzrlcl9jda'][0]
p=j.get('params',{})
print('status:', j['status'])
print('fn_cont:', p.get('fn_cont'))
print('miniBatches:', p.get('miniBatches'))
"

#!/usr/bin/env bash
# t477 live — the graveyard through the real agent loop (builtin GLM).
# The real graveyard now holds one t477-grammar grave ("Extract (t477
# witness)" — a real DELETE wrote its row snapshot) plus the t341-era
# row-less graves. The honest chain: graveyard question → list_deleted →
# the witness grave named with restorable:true → restore_deleted fires →
# the job is back under its original id. t475's lessons ride along: reset
# FIRST, tee the FIRST response so iter-0 tool events print.
set -uo pipefail
BASE=http://localhost:3000
O=(-H "Origin: $BASE" -H "Content-Type: application/json")

curl -s "${O[@]}" -X POST "$BASE/api/ai/chat" -d '{"action":"reset"}' --max-time 30 > /dev/null
echo "session reset"

SID=$(curl -s "${O[@]}" -X POST "$BASE/api/ai/chat" -d '{"message":"我之前删掉的任务都还在吗？如果还能找回，请把那个 extract 找回来。请用具体名字和状态回答。"}' --max-time 150 | tee /tmp/t477-first.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('sessionId',''))")
echo "session: $SID"
python3 -c "
import json
d=json.load(open('/tmp/t477-first.json'))
for e in d.get('events',[]):
    t=e.get('type')
    if t=='tool_call':
        print(f\"  [iter 0] TOOL CALL: {e.get('name')} args={json.dumps(e.get('args',{}),ensure_ascii=False)[:160]}\")
    elif t=='tool_result':
        det=e.get('detail') or {}
        line=f\"  [iter 0] TOOL RESULT ok={e.get('ok')} name={e.get('name')}\"
        graves=(det or {}).get('graves') if isinstance(det,dict) else None
        if isinstance(graves,list):
            for g in graves:
                line+=f\" | {g.get('name') or g.get('id','?')[:12]} restorable={g.get('restorable')}\"
        elif isinstance(det,dict) and 'restored' in det:
            line+=f\" | restored={json.dumps(det.get('restored'))} edges={len(det.get('edges') or [])}\"
        print(line)
        print(f\"           summary: {(e.get('summary') or '')[:300]}\")
    elif t=='assistant_text':
        print(f\"  [iter 0] ASSISTANT: {(e.get('text') or '')[:300]}\")
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
        line=f\"  [iter $i] TOOL RESULT ok={e.get('ok')} name={e.get('name')}\"
        graves=(det or {}).get('graves') if isinstance(det,dict) else None
        if isinstance(graves,list):
            for g in graves:
                line+=f\" | {g.get('name') or g.get('id','?')[:12]} restorable={g.get('restorable')}\"
        elif isinstance(det,dict) and 'restored' in det:
            line+=f\" | restored={json.dumps(det.get('restored'))} edges={len(det.get('edges') or [])}\"
        print(line)
        print(f\"           summary: {(e.get('summary') or '')[:300]}\")
    elif t=='assistant_text':
        print(f\"  [iter $i] ASSISTANT: {(e.get('text') or '')[:700]}\")
    elif t=='error':
        print(f\"  [iter $i] ERROR: {e.get('message')}\")
nc = d.get('needsContinue')
print(f\"  [iter $i] needsContinue={nc}\")
"
  NEED=$(echo "$RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('needsContinue'))")
  [ "$NEED" != "True" ] && break
done

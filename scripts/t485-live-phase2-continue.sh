#!/usr/bin/env bash
# t485 phase 2 — the real GLM continue question on the CLUSTER lane.
# The checkpoint lives at /projects/cryoflow/.../refine3d_g7i9jzbz on the
# mock cluster (run_it005_optimiser.star, complete, newest). The question
# names the job and asks for 3 more iterations — THE CONTINUE LAW says the
# verb is continue_run (never run_job), the lane is the job's own (the
# cluster), and after the act, wait_for_jobs catches the completion.
# t475/t476's lessons: reset FIRST, tee the first response so iter-0 tool
# events print, not lost.
set -uo pipefail
BASE=http://localhost:3000
O=(-H "Origin: $BASE" -H "Content-Type: application/json")
JID=cmun5dyzx0001rjfbg7i9jzbz

evs() {
python3 -c "
import json,sys
d=json.load(sys.stdin)
for e in d.get('events',[]):
    t=e.get('type')
    if t=='tool_call':
        print(f\"  [iter $1] TOOL CALL: {e.get('name')} args={json.dumps(e.get('args',{}),ensure_ascii=False)[:220]}\")
    elif t=='tool_result':
        det=e.get('detail') or {}
        line=f\"  [iter $1] TOOL RESULT ok={e.get('ok')} name={e.get('name')}\"
        s=json.dumps(det, ensure_ascii=False)
        if 'plan' in s or 'continue' in s.lower():
            line += ' | ' + s[:260]
        print(line)
        summ = e.get('summary') or ''
        if summ:
            print(f\"           summary: {summ[:260]}\")
    elif t=='assistant_text':
        print(f\"  [iter $1] ASSISTANT: {(e.get('text') or '')[:500]}\")
"
}

curl -s "${O[@]}" -X POST "$BASE/api/ai/chat" -d '{"action":"reset"}' --max-time 30 > /dev/null
echo "session reset"

SID=$(curl -s "${O[@]}" -X POST "$BASE/api/ai/chat" \
  -d '{"message":"QA Refine Cluster Continue 这个 3D 精修精度还没到位，帮它在原有基础上再多跑 3 个 iteration——注意千万别毁掉它已有的结果。"}' \
  --max-time 150 | tee /tmp/t485-p2-first.json | python3 -c "import json,sys; print(json.load(sys.stdin).get('sessionId',''))")
echo "session: $SID"
cat /tmp/t485-p2-first.json | evs 0

for i in 1 2 3 4 5 6; do
  RESP=$(curl -s "${O[@]}" -X POST "$BASE/api/ai/chat" -d "{\"sessionId\":\"$SID\",\"continue\":true}" --max-time 240)
  echo "$RESP" > /tmp/t485-p2-iter$i.json
  echo "$RESP" | evs $i
  DONE=$(echo "$RESP" | python3 -c "
import json,sys
d=json.load(sys.stdin)
evs=d.get('events',[])
has_text=any(e.get('type')=='assistant_text' and (e.get('text') or '').strip() for e in evs)
needs=d.get('needsContinue', False)
print('stop' if (has_text and not needs) else 'more')")
  if [ "$DONE" = "stop" ]; then echo "(turn complete at iter $i)"; break; fi
done
echo "$SID" > /tmp/t485-p2-sid.txt

#!/usr/bin/env bash
# t484 live — the whole book through the real agent loop (builtin GLM).
# The live ledger (data/engine-state.json) remembers 10 dispatches through
# "Mock Cluster" (conn-mukrkgil), every one exit 0, ten DIFFERENT job
# types — a perfect recitation surface. Two faces, two fresh sessions:
#   FACE A (control): "最近跑过什么" → list_clusters with NO args → the
#     résumé face (3 newest). The law must not over-open the book.
#   FACE B (the book): "一共跑过哪些派发？完整历史" → list_clusters
#     with fullHistory:true → all 10 rows, and the model must recite them.
# t475/t476's lessons ride along: reset FIRST, tee the first response so
# iter-0 tool events are printed, not lost.
set -uo pipefail
BASE=http://localhost:3000
O=(-H "Origin: $BASE" -H "Content-Type: application/json")

evs() {
python3 -c "
import json,sys
d=json.load(sys.stdin)
for e in d.get('events',[]):
    t=e.get('type')
    if t=='tool_call':
        print(f\"  [iter $1] TOOL CALL: {e.get('name')} args={json.dumps(e.get('args',{}),ensure_ascii=False)[:200]}\")
    elif t=='tool_result':
        det=e.get('detail') or {}
        rows=(det or {}).get('roster') if isinstance(det,dict) else None
        line=f\"  [iter $1] TOOL RESULT ok={e.get('ok')} name={e.get('name')}\"
        if isinstance(rows,list):
            for c in rows:
                dis=c.get('dispatches')
                if dis:
                    line+=f\" | {c.get('name')} total={dis.get('total')} recent={len(dis.get('recent',[]))} cappedAt={dis.get('cappedAt')}\"
                else:
                    line+=f\" | {c.get('name')} (no résumé)\"
        print(line)
        print(f\"           summary: {(e.get('summary') or '')[:300]}\")
    elif t=='assistant_text':
        print(f\"  [iter $1] ASSISTANT: {(e.get('text') or '')[:700]}\")
"
}

echo "=== FACE A (control): the résumé face answers the recent-history question ==="
curl -s "${O[@]}" -X POST "$BASE/api/ai/chat" -d '{"action":"reset"}' --max-time 30 > /dev/null
SID_A=$(curl -s "${O[@]}" -X POST "$BASE/api/ai/chat" \
  -d '{"message":"Mock Cluster 这台集群最近跑过什么？"}' --max-time 150 | tee /tmp/t484-faceA.json | python3 -c "import json,sys; print(json.load(sys.stdin).get('sessionId',''))")
echo "session A: $SID_A"
python3 -c "pass" < /dev/null
cat /tmp/t484-faceA.json | evs 0
for i in 1 2 3 4; do
  curl -s "${O[@]}" -X POST "$BASE/api/ai/chat" -d "{\"sessionId\":\"$SID_A\",\"continue\":true}" --max-time 180 | evs $i
done

echo ""
echo "=== FACE B (the book): fullHistory must open for the COMPLETE-history question ==="
curl -s "${O[@]}" -X POST "$BASE/api/ai/chat" -d '{"action":"reset"}' --max-time 30 > /dev/null
SID_B=$(curl -s "${O[@]}" -X POST "$BASE/api/ai/chat" \
  -d '{"message":"Mock Cluster 一共跑过哪些派发？我要完整历史，不要只给最近三次。请列出每次的任务类型和时间。"}' --max-time 150 | tee /tmp/t484-faceB.json | python3 -c "import json,sys; print(json.load(sys.stdin).get('sessionId',''))")
echo "session B: $SID_B"
cat /tmp/t484-faceB.json | evs 0
for i in 1 2 3 4 5; do
  curl -s "${O[@]}" -X POST "$BASE/api/ai/chat" -d "{\"sessionId\":\"$SID_B\",\"continue\":true}" --max-time 180 | evs $i
done

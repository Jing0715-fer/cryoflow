#!/usr/bin/env bash
# t486 live — the science read through the real agent loop (builtin GLM).
# Two faces, two fresh sessions:
#   FACE A (resolution): "到多少埃" → get_job_curves → the FSC truth
#     (fixture truth: 0.143 crossing ≈ 7.8 Å, RELION reports 7.788 Å,
#     B-factor −62.4 Å², 40 shells via postprocess.star).
#   FACE B (orientation): "取向均匀吗" → get_job_curves kinds=angdist →
#     the angular truth (fixture truth: 96 particles over 89/288 bins,
#     concentration verdict one of the two honest words).
# The tool face and the bench (t486-curves-bench.ts) already reconciled
# the loaders against the star files; this run reconciles the MODEL's
# recitation against the same truths — tool × model × file.
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
        curves=(det or {}).get('curves') if isinstance(det,dict) else None
        line=f\"  [iter $1] TOOL RESULT ok={e.get('ok')} name={e.get('name')}\"
        if isinstance(curves,list):
            for c in curves:
                if c.get('kind')=='fsc' and c.get('renderable'):
                    line+=f\" | fsc: 0.143@{c.get('resolutionAt143')} reported={c.get('reportedResolution')} shells={c.get('shellCount')}\"
                elif c.get('kind')=='guinier' and c.get('renderable'):
                    line+=f\" | guinier: {c.get('pointCount')} pts B={c.get('bfactor')}\"
                elif c.get('kind')=='angdist':
                    line+=f\" | angdist: renderable={c.get('renderable')} total={c.get('total','-')} aniso={c.get('anisotropy','-')} verdict={c.get('anisotropyVerdict','-')}\"
        print(line)
        print(f\"           summary: {(e.get('summary') or '')[:300]}\")
    elif t=='assistant_text':
        print(f\"  [iter $1] ASSISTANT: {(e.get('text') or '')[:700]}\")
"
}

echo "=== FACE A (resolution): the curve question must open the FSC ==="
curl -s "${O[@]}" -X POST "$BASE/api/ai/chat" -d '{"action":"reset"}' --max-time 30 > /dev/null
SID_A=$(curl -s "${O[@]}" -X POST "$BASE/api/ai/chat" \
  -d '{"message":"Post-process (tutorial) 那个任务的结果到多少埃了？地图可信吗？"}' --max-time 150 | tee /tmp/t486-faceA.json | python3 -c "import json,sys; print(json.load(sys.stdin).get('sessionId',''))")
echo "session A: $SID_A"
cat /tmp/t486-faceA.json | evs 0
for i in 1 2 3; do
  curl -s "${O[@]}" -X POST "$BASE/api/ai/chat" -d "{\"sessionId\":\"$SID_A\",\"continue\":true}" --max-time 180 | evs $i
done

echo ""
echo "=== FACE B (orientation): the coverage question must open the angdist ==="
curl -s "${O[@]}" -X POST "$BASE/api/ai/chat" -d '{"action":"reset"}' --max-time 30 > /dev/null
SID_B=$(curl -s "${O[@]}" -X POST "$BASE/api/ai/chat" \
  -d '{"message":"2D Classification (tutorial) 的粒子取向分布均匀吗？有没有取向偏好？"}' --max-time 150 | tee /tmp/t486-faceB.json | python3 -c "import json,sys; print(json.load(sys.stdin).get('sessionId',''))")
echo "session B: $SID_B"
cat /tmp/t486-faceB.json | evs 0
for i in 1 2 3; do
  curl -s "${O[@]}" -X POST "$BASE/api/ai/chat" -d "{\"sessionId\":\"$SID_B\",\"continue\":true}" --max-time 180 | evs $i
done

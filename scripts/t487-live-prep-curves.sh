#!/usr/bin/env bash
# t487 live — the prep read through the real agent loop (builtin GLM).
# Two faces, two fresh sessions:
#   FACE A (CTF fit): "CTF 拟合怎么样" → get_job_curves kinds=ctf →
#     the fixture truth: 24 micrographs, mean defocus ≈ 1.182 µm
#     (range 1.048–1.328), worst astigmatism 0.016 µm, mean FoM 0.076,
#     worst fit resolution 4.4 Å — all from micrographs_ctf.star.
#   FACE B (drift): "漂移大吗" → get_job_curves kinds=motion →
#     the fixture truth: 24 micrographs, mean total drift 2.65 Å,
#     worst 3.1 Å (mic_004.mrc), early 1.59 > late 1.06 →
#     "early-frames dominate" triage — all from corrected_micrographs.star.
# The tool face and the bench (t487-prep-curves-bench.ts) already
# reconciled the loaders against the star files; this run reconciles the
# MODEL's recitation against the same truths — tool × model × file.
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
                if c.get('kind')=='ctf' and c.get('renderable'):
                    line+=f\" | ctf: n={c.get('micrographCount')} meanDef={c.get('meanDefocusUm')}µm worstAstig={c.get('maxAstigmatismUm')}µm worstRes={c.get('worstFitResolutionA')}Å\"
                elif c.get('kind')=='motion' and c.get('renderable'):
                    line+=f\" | motion: n={c.get('micrographCount')} mean={c.get('meanTotalA')}Å worst={c.get('maxTotalA')}Å ({c.get('worstName')}) early={c.get('meanEarlyA')} late={c.get('meanLateA')}\"
                elif c.get('kind')=='topaz':
                    line+=f\" | topaz: renderable={c.get('renderable')} epochs={c.get('epochCount','-')}\"
        print(line)
        print(f\"           summary: {(e.get('summary') or '')[:320]}\")
    elif t=='assistant_text':
        print(f\"  [iter $1] ASSISTANT: {(e.get('text') or '')[:700]}\")
"
}

echo "=== FACE A (CTF fit): the prep question must open kind ctf ==="
curl -s "${O[@]}" -X POST "$BASE/api/ai/chat" -d '{"action":"reset"}' --max-time 30 > /dev/null
SID_A=$(curl -s "${O[@]}" -X POST "$BASE/api/ai/chat" \
  -d '{"message":"CTF Estimation 1 这个任务的 CTF 拟合怎么样？散焦分布均匀吗？"}' --max-time 150 | tee /tmp/t487-faceA.json | python3 -c "import json,sys; print(json.load(sys.stdin).get('sessionId',''))")
echo "session A: $SID_A"
cat /tmp/t487-faceA.json | evs 0
for i in 1 2 3; do
  curl -s "${O[@]}" -X POST "$BASE/api/ai/chat" -d "{\"sessionId\":\"$SID_A\",\"continue\":true}" --max-time 180 | evs $i
done

echo ""
echo "=== FACE B (drift): the triage question must open kind motion ==="
curl -s "${O[@]}" -X POST "$BASE/api/ai/chat" -d '{"action":"reset"}' --max-time 30 > /dev/null
SID_B=$(curl -s "${O[@]}" -X POST "$BASE/api/ai/chat" \
  -d '{"message":"Motion Correction 1 的这些片子漂移大吗？该丢弃哪些？"}' --max-time 150 | tee /tmp/t487-faceB.json | python3 -c "import json,sys; print(json.load(sys.stdin).get('sessionId',''))")
echo "session B: $SID_B"
cat /tmp/t487-faceB.json | evs 0
for i in 1 2 3; do
  curl -s "${O[@]}" -X POST "$BASE/api/ai/chat" -d "{\"sessionId\":\"$SID_B\",\"continue\":true}" --max-time 180 | evs $i
done

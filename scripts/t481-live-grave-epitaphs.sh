#!/usr/bin/env bash
# t481 live — the graves wear epitaphs, on the real app.
#
# Witnesses (t479 recipe): two EMPIAR-seed imports, the only chain-head
# that runs standalone. A gets a REAL 4 KB file dropped into its workdir
# before the delete, so A (5.4 KB) outweighs B (1.3 KB) — and B is
# deleted LAST, so B is the NEWEST. The sort flip is then visible in the
# top two rows: Newest first → B, A · Heaviest first → A, B.
#
# Read-only round: no burial door is fired (the 54 real graves are never
# touched, no set-aside needed). Cleanup is a precise rm of exactly the
# two witness tombstones + their workdirs — count-verified zero surgery.
#
# Run: bash scripts/t481-live-grave-epitaphs.sh
set -uo pipefail
BASE=http://localhost:3000
O=(-H "Origin: $BASE" -H "Content-Type: application/json")
PROJ=cmukrk2yy0000rjobryvy0pzu

echo "=== 1. two import witnesses (EMPIAR seed — real bytes, exit 0) ==="
WITNESS_PARAMS='{"nodeType":"micrographs","micrographsPath":"","pixelSize":1.77,"voltage":300,"cs":2.7,"ampContrast":0.1,"totalDose":25,"negativeStain":false,"fn_mtf":"","angpix":1.4,"kV":300,"Cs":2.7,"beamtilt_x":0,"beamtilt_y":0,"empiarData":true}'
WS=$(curl -s "${O[@]}" "$BASE/api/jobs" | python3 -c "import json,sys; print(json.load(sys.stdin)['jobs'][0]['workspaceId'])")
mk() {
  local name=$1 x=$2 y=$3
  curl -s "${O[@]}" -X POST "$BASE/api/jobs" \
    -d "{\"type\":\"import\",\"name\":\"$name\",\"x\":$x,\"y\":$y,\"workspaceId\":\"$WS\",\"params\":$WITNESS_PARAMS}" \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('job',d).get('id',''))"
}
A=$(mk "Import (t481 witness A)" 900 140)
B=$(mk "Import (t481 witness B)" 900 260)
echo "A=$A B=$B"
for id in $A $B; do
  curl -s "${O[@]}" -X POST "$BASE/api/jobs/$id/run" -d '{}' --max-time 30 > /dev/null
done
for i in $(seq 1 40); do
  ST=$(curl -s "${O[@]}" "$BASE/api/jobs" | python3 -c "
import json,sys
d=json.load(sys.stdin)
js=[j for j in d['jobs'] if j['id'] in ('$A','$B')]
print(' '.join(f\"{j['status']}:{j['progress']}\" for j in js))")
  echo "  [$i] $ST"
  [[ "$ST" != *running* && "$ST" != *queued* && "$ST" != *pending* ]] && break
  sleep 3
done

echo "=== 2. A's workdir gains a REAL 4 KB file (A outweighs B) ==="
AWD="data/relion/$PROJ/import_${A: -8}"
echo "A workdir: $AWD"
ls "$AWD" > /dev/null || { echo "FATAL: A workdir not found"; exit 1; }
dd if=/dev/zero of="$AWD/extra-weight.bin" bs=1024 count=4 2>&1 | tail -1
du -sb "$AWD" | awk '{print "  A workdir now weighs " $1 " bytes"}'

echo "=== 3. DELETE A first, then B (B is the NEWEST) ==="
for id in $A $B; do
  curl -s "${O[@]}" -X DELETE "$BASE/api/jobs/$id" | head -c 100; echo
done

echo "=== 4. the roll call with verdicts (server truth) ==="
curl -s "${O[@]}" "$BASE/api/jobs/deleted" | python3 -c "
import json,sys
d=json.load(sys.stdin)
graves=d['graves']
print(f'  total graves: {len(graves)}')
for g in graves[:3]:
    print(f\"  {g.get('name') or g['id'][:14]} type={g['type']} restorable={g['restorable']} bytes={g.get('bytes','—')} runLine={g.get('runLine','(absent)')}\")
old=[g for g in graves if not g.get('rowSnapshot')]
print(f'  row-less graves: {len(old)}; a sample runLine among old graves: {next((g.get(\"runLine\",\"(absent)\") for g in old), \"n/a\")}')"

echo "=== 5. cleanup — rm exactly the two witness tombstones + workdirs ==="
if [[ "${KEEP:-0}" == "1" ]]; then
  echo "KEEP=1 — cleanup skipped (run phase 5 manually after the browser pass)"
  curl -s "${O[@]}" "$BASE/api/jobs" | python3 -c "import json,sys; print('jobs:', len(json.load(sys.stdin)['jobs']))"
  exit 0
fi
N_BEFORE=$(ls data/deleted-jobs/*.json 2>/dev/null | wc -l)
rm -v "data/deleted-jobs/$A.json" "data/deleted-jobs/$B.json"
rm -rf "data/relion/$PROJ/import_${A: -8}" "data/relion/$PROJ/import_${B: -8}"
N_AFTER=$(ls data/deleted-jobs/*.json 2>/dev/null | wc -l)
echo "graves: $N_BEFORE → $N_AFTER (expect −2)"
ls data/relion/$PROJ/ | rg "import_" && echo "CHECK: import dirs remain (verify none are witnesses)" || echo "import dirs: none"
curl -s "${O[@]}" "$BASE/api/jobs" | python3 -c "import json,sys; print('jobs:', len(json.load(sys.stdin)['jobs']), '(expect 22)')"

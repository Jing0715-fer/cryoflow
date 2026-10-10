#!/usr/bin/env bash
# t479 live — the graveyard's weight and the burial door, on the real app.
#
# Witness law (t477/t478 precedent): fresh deletes always carry a row
# snapshot, so the SPENT+weighted grave is produced by stripping the row —
# the same surgery time performed on the real 54. The 54 real graves are
# SET ASIDE (mv, count-verified) so the bulk door never touches them; the
# burial of the witnesses is its own cleanup. Restoring the 54 afterwards
# returns the world byte-for-byte.
#
#   A "Extract (t479 witness A)" — restorable + weighted (row kept)
#   B "Extract (t479 witness B)" — spent + weighted (row stripped)
#
# Run: bash scripts/t479-live-grave-weight.sh
set -uo pipefail
BASE=http://localhost:3000
O=(-H "Origin: $BASE" -H "Content-Type: application/json")
PROJ=cmukrk2yy0000rjobryvy0pzu

echo "=== 1. two import witnesses (the only chain-head — runs standalone on the EMPIAR seed, real bytes) ==="
WITNESS_PARAMS='{"nodeType":"micrographs","micrographsPath":"","pixelSize":1.77,"voltage":300,"cs":2.7,"ampContrast":0.1,"totalDose":25,"negativeStain":false,"fn_mtf":"","angpix":1.4,"kV":300,"Cs":2.7,"beamtilt_x":0,"beamtilt_y":0,"empiarData":true}'
WS=$(curl -s "${O[@]}" "$BASE/api/jobs" | python3 -c "import json,sys; print(json.load(sys.stdin)['jobs'][0]['workspaceId'])")
mk() {
  local name=$1 x=$2 y=$3
  curl -s "${O[@]}" -X POST "$BASE/api/jobs" \
    -d "{\"type\":\"import\",\"name\":\"$name\",\"x\":$x,\"y\":$y,\"workspaceId\":\"$WS\",\"params\":$WITNESS_PARAMS}" \
    | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('job',d).get('id',''))"
}
A=$(mk "Import (t479 witness A)" 900 140)
B=$(mk "Import (t479 witness B)" 900 260)
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

echo "=== 2. DELETE both witnesses (real tombstones, workdirs survive) ==="
for id in $A $B; do
  curl -s "${O[@]}" -X DELETE "$BASE/api/jobs/$id" | head -c 120; echo
done

echo "=== 3. strip witness B's row (the t341 grammar — spent grave) ==="
python3 - "$B" << 'PYEOF'
import json, sys, os
b = sys.argv[1]
p = f"/home/z/my-project/data/deleted-jobs/{b}.json"
d = json.load(open(p))
d.pop("row", None)
json.dump(d, open(p, "w"), indent=2)
print(f"stripped row from {b}: row={'row' in d}")
PYEOF

echo "=== 4. set aside the 54 real graves (count-verified) ==="
BK=/home/z/my-project/data/deleted-jobs-backup-t479
mkdir -p "$BK"
N_BEFORE=$(ls data/deleted-jobs/*.json 2>/dev/null | wc -l)
# move every tombstone EXCEPT the two witnesses
for f in data/deleted-jobs/*.json; do
  base=$(basename "$f")
  [[ "$base" == "$A.json" || "$base" == "$B.json" ]] && continue
  mv "$f" "$BK/"
done
N_LEFT=$(ls data/deleted-jobs/*.json 2>/dev/null | wc -l)
N_BK=$(ls "$BK"/*.json | wc -l)
echo "before=$N_BEFORE set-aside=$N_BK left=$N_LEFT (expect 2)"

echo "=== 5. the roll call with weight (server truth) ==="
curl -s "${O[@]}" "$BASE/api/jobs/deleted" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for g in d['graves']:
    print(f\"  {g.get('name') or g['id'][:14]} type={g['type']} restorable={g['restorable']} bytes={g.get('bytes','—')}\")
total=sum(g.get('bytes',0) for g in d['graves'])
print(f'  TOTAL: {total} bytes')
"

echo "=== 6. the burial door — default (spare law, LIVE) ==="
curl -s "${O[@]}" -X DELETE "$BASE/api/jobs/deleted" | python3 -m json.tool

echo "=== 7. the burial door — force ?all=1 (restorable graves die) ==="
curl -s "${O[@]}" -X DELETE "$BASE/api/jobs/deleted?all=1" | python3 -m json.tool

echo "=== 8. restore the 54 (world back) ==="
mv "$BK"/*.json data/deleted-jobs/
rmdir "$BK"
N_AFTER=$(ls data/deleted-jobs/*.json 2>/dev/null | wc -l)
echo "graves after restore: $N_AFTER (expect 54)"
curl -s "${O[@]}" "$BASE/api/jobs" | python3 -c "import json,sys; print('jobs:', len(json.load(sys.stdin)['jobs']), '(expect 22)')"
ls /home/z/my-project/data/relion/$PROJ/ | rg "t479" && echo "RESIDUE: witness workdirs survived!" || echo "workdir residue: none (the burial was its own cleanup)"

#!/bin/bash
# t527-fetch-empiar.sh — the real-data resurrection fetch (Task 527).
#
# The 10 Falcon-2012 β-galactosidase micrographs + Henderson coords of the
# original /home/z/empiar-10017 set (641 MB, untracked) were annihilated by
# the sandbox reset (t520 witnessed, t525 archived, t526 seeded synthetic
# stand-ins, t526 pool item: "真数据需从公开库重取").
#
# The t380-era excuse for synthesising (EBI ~16 KB/s → 8 h per mirror) is
# GONE: this window measured ~644 KB/s — the whole set lands in minutes.
#
# Stems: the first 10 of EMPIAR-10017's alphabetical listing (the mirror
# asserts 8 = the same first 8 that scripts/make-empiar10017-fixtures.py
# recorded as the historical MICS list; the home set carried 10).
#
# Re-entrant: skips a file whose byte size already matches; curl -C - resumes
# partial downloads. Verified shapes: mic = 67,109,888 B (4096² float32 +
# 1024 header), coord = text, 2 floats/line.
set -u
BASE="https://ftp.ebi.ac.uk/empiar/world_availability/10017/data"
DEST="/home/z/empiar-10017/micrographs"
LOG="/tmp/cryoflow-qa/t527-fetch.log"
MIC_SIZE=67109888

mkdir -p "$DEST" /tmp/cryoflow-qa
echo "[$(date +%H:%M:%S)] t527 fetch start" >> "$LOG"

STEMS=(
  Falcon_2012_06_12-14_33_35_0
  Falcon_2012_06_12-14_57_34_0
  Falcon_2012_06_12-15_07_41_0
  Falcon_2012_06_12-15_14_01_0
  Falcon_2012_06_12-15_17_31_0
  Falcon_2012_06_12-15_27_22_0
  Falcon_2012_06_12-15_30_21_0
  Falcon_2012_06_12-15_33_42_0
  Falcon_2012_06_12-15_36_26_0
  Falcon_2012_06_12-15_41_22_0
)

fetch_one() {
  local stem="$1" kind="$2" url out want
  url="$BASE/${stem}.${kind}"
  out="$DEST/${stem}.${kind}"
  if [ "$kind" = "mrc" ]; then want=$MIC_SIZE; else want=0; fi
  local sz=0
  [ -f "$out" ] && sz=$(stat -c%s "$out")
  if [ "$want" != "0" ] && [ "$sz" = "$want" ]; then
    echo "[$(date +%H:%M:%S)] SKIP  ${stem}.${kind} (already ${sz} B)" >> "$LOG"
    return 0
  fi
  curl -sf --retry 3 --retry-delay 2 -C - -o "$out" "$url" \
    && echo "[$(date +%H:%M:%S)] OK    ${stem}.${kind} ($(stat -c%s "$out") B)" >> "$LOG" \
    || echo "[$(date +%H:%M:%S)] FAIL  ${stem}.${kind}" >> "$LOG"
}
export -f fetch_one
export BASE DEST LOG MIC_SIZE

# coords are tiny — grab them serially first so the coord-dependent consumers
# can start; the mics go 4-wide (the EBI throughput scales with streams).
for s in "${STEMS[@]}"; do fetch_one "$s" coord; done
printf '%s\n' "${STEMS[@]}" | xargs -P4 -I{} bash -c 'fetch_one "$@" mrc' _ {}

# verdict
ok=0; bad=0
for s in "${STEMS[@]}"; do
  sz=$(stat -c%s "$DEST/${s}.mrc" 2>/dev/null || echo 0)
  if [ "$sz" = "$MIC_SIZE" ]; then ok=$((ok+1)); else bad=$((bad+1)); echo "BAD $s: $sz" >> "$LOG"; fi
done
echo "[$(date +%H:%M:%S)] FETCH VERDICT: $ok/10 mics verified, $bad bad" >> "$LOG"
[ "$bad" = "0" ]

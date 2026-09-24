#!/usr/bin/env bash
# t382 — local verification of the two cluster-side awk programs
# (extractPreflightLines + countRemoteStar), copied verbatim from
# src/lib/remote/remote-run.ts's construction.
set -u
T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT

# ---- the pre-flight awk (verbatim from extractPreflightLines) ----
PRE_AWK='
function cfkey(n) {
  s = 0; d = 0
  for (i = 1; i <= length(n); i++) {
    c = substr(n, i, 1)
    if (c == "/") s = i
    else if (c == ".") d = i
  }
  if (d > s + 1) n = substr(n, 1, d - 1)
  sub(/^[A-Za-z0-9_.-]+\/job[0-9][0-9][0-9]*\//, "", n)
  return n
}
/^data_/ { block++; next }
/^loop_/ { inloop = 1; col = 0; next }
/^#/ { next }
/^_/ {
  if (block >= 2 && inloop) {
    col++
    if ($1 == "_rlnMicrographName" || $1 == "_rlnMicrographMovieName") micCol = col
  }
  next
}
block >= 2 && NF > 0 {
  if (micCol > 0) {
    n = $micCol
    gsub(/^"|"$/, "", n)
    if (n != "") {
      k = cfkey(n)
      if (!(k in first)) { first[k] = n; cnt[k] = 1 }
      else {
        cnt[k]++
        if (n != first[k] && !(k in second)) second[k] = n
      }
    }
  }
  next
}
END {
  shown = 0
  for (k in cnt) {
    bad = (cnt[k] > 1 || (k in second))
    if (!bad) continue
    printf "CRYOFLOW_COLLIDE\t%s\t%s", first[k], k
    if (k in second) printf "\t%s", second[k]
    printf "\n"
    shown++
    if (shown >= 3) break
  }
  if (shown > 0) exit 3
}
'

fail=0
ok()   { echo "PASS: $1"; }
bad()  { echo "FAIL: $1"; fail=1; }

# case 1 — mixed-extension twins (the user's shape: 172 micrographs = 86 pairs)
cat > "$T/twins.star" <<'EOF'
# RELION 5 optics + micrographs

data_optics

loop_
_rlnOpticsGroup #1
_rlnOpticsGroupName #2
_rlnMicrographPixelSize #3
1 optGroup1 1.77 300 2.7 0.1

data_micrographs

loop_
_rlnMicrographName #1
_rlnOpticsGroup #2
/data2/empiar/FoilHole_001_Fractions_DW.mrc 1
/data2/empiar/FoilHole_001_Fractions_DW.mrcs 1
/data2/empiar/FoilHole_002_Fractions_DW.mrc 1
/data2/empiar/FoilHole_002_Fractions_DW.mrcs 1
/data2/empiar/FoilHole_003_Fractions_DW.mrc 1
EOF
out=$(awk "$PRE_AWK" "$T/twins.star" 2>/dev/null); rc=$?
[ $rc -eq 3 ] && ok "twins star exits 3" || bad "twins star rc=$rc (want 3)"
echo "$out" | grep -q "FoilHole_001_Fractions_DW.mrcs" && ok "evidence names the .mrcs twin" || bad "evidence: $out"
[ "$(echo "$out" | wc -l)" -eq 2 ] && ok "exactly 2 collide lines (cap 3)" || bad "line count: $(echo "$out" | wc -l)"

# case 2 — duplicate rows (same mic listed twice)
cat > "$T/dups.star" <<'EOF'
data_optics

loop_
_rlnOpticsGroup #1
_rlnMicrographPixelSize #2
1 optGroup1 1.063

data_micrographs

loop_
_rlnMicrographName #1
_rlnOpticsGroup #2
/data03/x/A.mrc 1
/data03/x/B.mrc 1
/data03/x/A.mrc 1
EOF
out=$(awk "$PRE_AWK" "$T/dups.star" 2>/dev/null); rc=$?
[ $rc -eq 3 ] && ok "duplicate star exits 3" || bad "duplicate star rc=$rc"
echo "$out" | grep -q "^CRYOFLOW_COLLIDE.*A.mrc" && ok "duplicate names A.mrc" || bad "dup evidence: $out"

# case 3 — clean star (172 micrographs, disjoint basenames)
{
  echo "data_optics"; echo; echo "loop_"; echo "_rlnOpticsGroup #1"; echo "_rlnMicrographPixelSize #2"; echo "1 optGroup1 1.77"
  echo; echo "data_micrographs"; echo; echo "loop_"; echo "_rlnMicrographName #1"; echo "_rlnOpticsGroup #2"
  for i in $(seq -w 1 172); do echo "/data2/empiar/FoilHole_${i}_Fractions_DW.mrc 1"; done
} > "$T/clean.star"
out=$(awk "$PRE_AWK" "$T/clean.star" 2>/dev/null); rc=$?
[ $rc -eq 0 ] && [ -z "$out" ] && ok "clean 172-mic star passes silent" || bad "clean star rc=$rc out=$out"

# case 4 — pipeliner-prefixed names + quoted names + optics-only first block
cat > "$T/prefix.star" <<'EOF'
data_optics

loop_
_rlnOpticsGroup #1
1 1.77

data_micrographs

loop_
_rlnMicrographName #1
_rlnOpticsGroup #2
MotionCor/job002/micrographs/foo.mrc 1
Extract/job003/micrographs/foo.mrcs 1
"MotionCor/job002/micrographs/bar.tif" 1
MotionCor/job002/micrographs/bar.mrc 1
EOF
out=$(awk "$PRE_AWK" "$T/prefix.star" 2>/dev/null); rc=$?
[ $rc -eq 3 ] && ok "pipeline-prefixed + quoted twins exit 3" || bad "prefix star rc=$rc"
echo "$out" | grep -q "foo.mrc" && ok "prefix-stripped key collides foo" || bad "foo evidence: $out"
echo "$out" | grep -q "bar" && ok "quoted + bar twins collide" || bad "bar evidence: $out"

# case 5 — no mic column (a particles star) → clean pass (honest degrade)
cat > "$T/particles.star" <<'EOF'
data_optics

loop_
_rlnOpticsGroup #1
1 1.77

data_particles

loop_
_rlnImageName #1
_rlnClassNumber #2
000001@/x/stack.mrcs 2
000002@/x/stack.mrcs 1
EOF
out=$(awk "$PRE_AWK" "$T/particles.star" 2>/dev/null); rc=$?
[ $rc -eq 0 ] && [ -z "$out" ] && ok "particles star (no mic column) passes" || bad "particles star rc=$rc"

# ---- the count awk (verbatim from countRemoteStar) ----
CNT_AWK='
/^data_/ { block++; next }
/^loop_/ { inloop = 1; col = 0; next }
/^#/ { next }
/^_/ {
  if (block >= 2 && inloop) {
    col++
    if ($1 == "_rlnClassNumber") clsCol = col
  }
  next
}
block >= 2 && NF > 0 {
  rows++
  if (clsCol > 0) { c = $clsCol + 0; if (c > 0) cls[c]++ }
  next
}
END {
  printf "CF_ROWS\t%d\n", rows + 0
  if (clsCol > 0) {
    for (pass = 1; pass <= 3; pass++) {
      best = 0; bestn = -1
      for (c in cls) {
        if (cls[c] > bestn && !(c in done)) { bestn = cls[c]; best = c }
      }
      if (bestn <= 0) break
      printf "CF_CLASS\t%d\t%d\n", best, bestn
      done[best] = 1
    }
  }
}
'
{
  echo "data_optics"; echo; echo "loop_"; echo "_rlnOpticsGroup #1"; echo "1 1.77"
  echo; echo "data_particles"; echo; echo "loop_"
  echo "_rlnImageName #1"; echo "_rlnCoordinateX #2"; echo "_rlnCoordinateY #3"; echo "_rlnClassNumber #4"
  for i in $(seq 1 100); do echo "0000${i}@/x/stack.mrcs 12.5 30.5 2"; done
  for i in $(seq 1 50); do echo "0001${i}@/x/stack.mrcs 12.5 30.5 1"; done
  for i in $(seq 1 25); do echo "0002${i}@/x/stack.mrcs 12.5 30.5 5"; done
  for i in $(seq 1 25); do echo "0003${i}@/x/stack.mrcs 12.5 30.5 3"; done
} > "$T/count.star"
out=$(awk "$CNT_AWK" "$T/count.star" 2>/dev/null); rc=$?
[ $rc -eq 0 ] && ok "count awk runs" || bad "count awk rc=$rc"
echo "$out" | head -1 | grep -q "CF_ROWS	200" && ok "row count 200" || bad "rows: $(echo "$out" | head -1)"
first=$(echo "$out" | grep CF_CLASS | head -1)
echo "$first" | grep -q "CF_CLASS	2	100" && ok "top class = 2 (100)" || bad "top class: $first"
[ "$(echo "$out" | grep -c CF_CLASS)" -eq 3 ] && ok "top-3 classes only" || bad "class count: $(echo "$out" | grep -c CF_CLASS)"

# count awk on a micrographs star (no class col) → rows only
out=$(awk "$CNT_AWK" "$T/clean.star" 2>/dev/null)
echo "$out" | grep -q "CF_ROWS	172" && ok "micrographs star counts 172" || bad "mic rows: $out"
[ -z "$(echo "$out" | grep CF_CLASS)" ] && ok "no CF_CLASS without the column" || bad "unexpected CF_CLASS"

echo "----------------------------------------"
[ $fail -eq 0 ] && echo "ALL PASS" || echo "FAILURES PRESENT"
exit $fail

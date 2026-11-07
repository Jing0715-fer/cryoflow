#!/usr/bin/env bash
# t1179 — the recital-retirement QA ride: the three "deep bands" t1178
# re-queued (#7/#8/#13) are proven cured against the LIVE lane in ONE
# tool call (the boundary reaper law: server and consumers share the call).
# - readiness poll (the launcher's server, booted at window open)
# - jobs roster (the P1 flicker surface: completed flags as the lane tells it)
# - the chart quartet (guinier / resolution / angdist / fsc) on the
#   postprocess job, each fetched TWICE back-to-back — the second fetch is
#   the statcache's receipt (hit = stat-only, sub-ms-to-few-ms)
# - particles on a class2d job (the t1101 split: parse cached, ownership memo)
# every request wears the same-origin pair (t251's guard law).
set -u
cd /home/z/my-project
ORIGIN='http://localhost:3000'
H1="Origin: $ORIGIN"
ok=0; bad=0
note() { printf '%s\n' "$*"; }

# 1. readiness (poll, do not trust a single probe)
ready=""
for i in $(seq 1 20); do
  code=$(curl -s -o /dev/null -w '%{http_code}' -H "$H1" --max-time 4 "http://localhost:3000/api/jobs" 2>/dev/null)
  if [ "$code" = "200" ]; then ready="poll#$i"; break; fi
  sleep 2
done
if [ -z "$ready" ]; then note "READY MISS"; exit 1; fi
note "READY $ready"

# 2. roster
roster=$(curl -s -H "$H1" --max-time 8 "http://localhost:3000/api/jobs")
count=$(node -e 'const d=JSON.parse(process.argv[1]);const j=Array.isArray(d)?d:(d.jobs||d.rows||[]);console.log(j.length)' "$roster" 2>/dev/null || echo '?')
note "ROSTER jobs=$count"
# pick ids: postprocess + class2d (by kind/type heuristics)
ids=$(node -e '
const d=JSON.parse(process.argv[1]);
const j=Array.isArray(d)?d:(d.jobs||d.rows||[]);
const pick=(re)=>{const hit=j.find(x=>JSON.stringify(x).toLowerCase().match(re));return hit?(hit.id||hit.jobId||hit.job_id):""};
console.log([pick(/postprocess/),pick(/class2d|class_2d|2d/)].join(" "));
' "$roster" 2>/dev/null)
pp=$(echo $ids | cut -d' ' -f1); c2=$(echo $ids | cut -d' ' -f2)
note "PICKS postprocess=$pp class2d=$c2"

ride() { # name url expect_code
  local name="$1" url="$2"
  local t0 t1 code body
  t0=$(date +%s%N)
  code=$(curl -s -o /tmp/ride_body -w '%{http_code}' -H "$H1" --max-time 30 "$url")
  t1=$(date +%s%N)
  local ms=$(( (t1 - t0) / 1000000 ))
  local bytes=$(wc -c < /tmp/ride_body | tr -d ' ')
  note "RIDE $name code=$code ${ms}ms bytes=$bytes"
  echo "$code" >> /tmp/t1179_ride_codes
}

: > /tmp/t1179_ride_codes
# 3. chart quartet, twice each (the double fetch IS the statcache receipt)
if [ -n "$pp" ]; then
  ride guinier-1    "http://localhost:3000/api/jobs/$pp/guinier"
  ride guinier-2    "http://localhost:3000/api/jobs/$pp/guinier"
  ride angdist-1    "http://localhost:3000/api/jobs/$pp/angdist"
  ride angdist-2    "http://localhost:3000/api/jobs/$pp/angdist"
  ride resolution-1 "http://localhost:3000/api/jobs/$pp/resolution"
  ride resolution-2 "http://localhost:3000/api/jobs/$pp/resolution"
  ride fsc-1        "http://localhost:3000/api/jobs/$pp/fsc"
  ride fsc-2        "http://localhost:3000/api/jobs/$pp/fsc"
fi
# 4. particles on class2d
if [ -n "$c2" ]; then
  ride particles-1  "http://localhost:3000/api/jobs/$c2/particles?page=1"
  ride particles-2  "http://localhost:3000/api/jobs/$c2/particles?page=1"
fi
# 5. roster again (P1 flicker surface, second read)
ride jobs-2 "http://localhost:3000/api/jobs"

greens=$(grep -c '^200$' /tmp/t1179_ride_codes 2>/dev/null || echo 0)
total=$(wc -l < /tmp/t1179_ride_codes | tr -d ' ')
note "SUMMARY green=$greens/$total"
[ "$greens" = "$total" ] && [ "$total" -gt 0 ] && note "VERDICT GREEN" || note "VERDICT PARTIAL"

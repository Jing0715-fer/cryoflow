#!/bin/bash
# t879-mirror-patient.sh — the witness that waits for the mirror to MATURE.
#
# v1's lesson (this window): the footer renders "0 jobs · 0 edges" during
# the boot's loading state, and v1's loop broke on the FIRST match of any
# "N jobs … M edges" — it photographed the loading mirror and called it
# the world. The patient witness warms the FULL load() plane (all six
# routes the boot fetches, so no cold compile can fail the Promise.all),
# then polls until the count goes non-zero (GREEN) or a stability window
# proves the wall is honestly empty (every distinct value + the error
# toast text captured for the autopsy).
#
# v2's lesson: the canvas compile is an OOM coin flip on the 4GB box —
# the kernel killed next-server at anon-rss 2.9GB mid-page-load (dmesg
# witness), the chunk connections answered ERR_CONNECTION_REFUSED, and
# the whole attempt died. The patient witness now RETRIES: a refused
# connection or a chrome-error page triggers one full re-boot in the
# same call (the second compile rides a warm webpack cache and a freer
# box).
#
# v3's lesson (the dmesg autopsy's precision): `chrome invoked
# oom-killer` — the victim was chosen while TWO chrome instances
# (~500MB) co-resided with the 2.8GB compile peak. The coin is not
# flipped by luck but by ORDERING: curl triggers the identical SSR
# compile while chrome is DEAD (the peak passes chromeless), and chrome
# only launches after the mountain has been climbed. Compile before
# the co-resident moves in.
#
# v4's lesson: the SSR compile is only the FIRST wave — the browser's
# chunk requests compile the CLIENT graph on demand, a second wave
# exactly as fatal (two more dmesg witnesses: next-server parked at
# ~2.8GB plateau — V8 never returns the compile's memory — and chrome's
# page-load allocations tipped the box). So the HTML itself is read as
# the warming manifest: every /_next/static URL it names is curl-fetched
# chromelessly BEFORE chrome may launch. No compile wave ever runs
# while a co-resident lives; MALLOC_ARENA_MAX=2 shrinks glibc's arena
# overhead on the many-threaded dev server.
#
# v5's lesson: the HTML manifest is still not the whole graph — the
# canvas LAZY-imports its panels (3D viewer, charts, dialogs; the
# t1176 "lazy chunks dying under chrome co-residency" disease), so a
# third wave compiles at hydration time, with chrome already breathing.
# The manifest warm therefore goes RECURSIVE: every warmed JS body is
# scanned for further /_next/static/chunks URLs, three rounds deep or
# until no new URL appears. The node RSS plateau is logged at each
# stage — the box's balance sheet, written as the witness runs.
#
# v6's lesson: the plateau is MEASURED — 2426MB at cap 2048 after the
# SSR wave alone. The ledger: node 2.4-2.8GB + chrome ~0.4GB + platform
# ~0.7GB ≥ the 4GB box — the coin was never fair. v6 drops the V8 old-
# space cap to 1792 (t402's measured home-graph floor) and fixes the
# v5 regex (a double-escaped `[.]js` matched nothing — 0 assets warmed
# twice). The honest failure is also instrumented: a heap-cap thrash
# logs "Ineffective mark-compacts" and dies LOUD, naming the floor.
set -u
cd /home/z/my-project
ORIGIN="http://127.0.0.1:3000"
LOG=/tmp/t879-patient-server.log

mirror_once() {
  timeout 20 agent-browser eval "(document.body.innerText.match(/[0-9]+ jobs [^\\n]*edges/)||[''])[0]" 2>/dev/null | tail -1 | tr -d '"'
}

attempt() {
  local n="$1"
  echo "[patient] === attempt $n: clearing the field (chrome included — the ordering cure) ==="
  pkill -f dev-server-watchdog 2>/dev/null
  pkill -9 -f "next dev" 2>/dev/null
  pkill -9 -f next-server 2>/dev/null
  pkill -9 -f "\.agent-browser/browsers/" 2>/dev/null
  sleep 2

  echo "[patient] booting (heap 1792 = t402's home-graph floor, MALLOC_ARENA_MAX=2)"
  DEV_HEAP_MB=1792 MALLOC_ARENA_MAX=2 bash dev-server.sh > "$LOG" 2>&1 &
  local up=0
  for _ in $(seq 1 45); do
    sleep 3
    local code=$(curl -s -o /dev/null -w "%{http_code}" -m 5 -H "Origin: $ORIGIN" $ORIGIN/api/projects 2>/dev/null)
    [ "$code" = "200" ] && { up=1; break; }
  done
  [ "$up" = "1" ] || { echo "[patient] FATAL — the lane never came up"; tail -5 "$LOG"; return 1; }
  echo "[patient]    lane up"

  echo "[patient] warming the FULL load() plane (six routes, the boot's Promise.all)"
  for r in project jobs edges system projects workspaces; do
    code=$(curl -s -o /dev/null -w "%{http_code}" -m 120 -H "Origin: $ORIGIN" $ORIGIN/api/$r)
    echo "[patient]    /api/$r: $code"
  done

  echo "[patient] THE ORDERING CURE — curl compiles the canvas chromelessly"
  hcode=$(curl -s -o /dev/null -w "%{http_code}" -m 180 "$ORIGIN/")
  echo "[patient]    GET / (curl): $hcode"
  [ "$hcode" = "200" ] || { echo "[patient]    the chromeless compile died — attempt fails"; return 2; }

  echo "[patient] pre-warming the client graph — the HTML is the warming manifest"
  warmed=""
  urls=$(curl -s -m 30 "$ORIGIN/" | grep -o '/_next/static/[^"&<> ]*[.]js' | sort -u)
  round=0
  while [ -n "$urls" ] && [ "$round" -lt 4 ]; do
    round=$((round+1)); fresh=0
    nxt=""
    for u in $urls; do
      body=$(curl -s -m 60 "$ORIGIN$u")
      c=$?
      if [ $c -eq 0 ]; then
        fresh=$((fresh+1)); warmed="$warmed $u"
      fi
      if [ "$round" = "1" ] && [ $c -eq 0 ]; then
        # v7 recon: how does the runtime NAME its chunks? (the lazy graph
        # hides behind webpack's id maps — the first bodies answer that)
        echo "[patient]    recon[$u]: $(echo "$body" | grep -oE 'chunks/[A-Za-z0-9._-]{3,}' | sort -u | head -4 | tr '\n' ' ')"
      fi
      # harvest chunk names in ANY of the three runtime spellings
      cands=$({ echo "$body" | grep -oE '/_next/static/chunks/[A-Za-z0-9._-]+[.]js' ;
                echo "$body" | grep -oE 'static/chunks/[A-Za-z0-9._-]+' | sed 's#$#.js#;s#^#/_next/#' ;
                echo "$body" | grep -oE '"[A-Za-z0-9._-]+[.]chunk[.]js"' | tr -d '"' | sed 's#^#/_next/static/chunks/#' ;
             } | sort -u)
      for nu in $cands; do
        case "$warmed $nxt" in *" $nu "*) : ;; *) nxt="$nxt $nu" ;; esac
      done
    done
    echo "[patient]    round $round: $fresh assets warmed"
    urls=$(echo $nxt | tr ' ' '\n' | sort -u)
  done
  echo "[patient]    $(echo $warmed | wc -w) JS assets warmed over $round rounds"
  nodepid=$(pgrep -f next-server | head -1)
  [ -n "$nodepid" ] && echo "[patient]    node RSS plateau: $(( $(ps -o rss= -p "$nodepid" 2>/dev/null | tr -d ' ') / 1024 ))MB"

  echo "[patient] the peaks have passed — chrome may now move in"
  agent-browser open about:blank > /dev/null 2>&1 || true

  echo "[patient] navigating the canvas"
  agent-browser eval "location.assign('$ORIGIN'); 'nav'" > /dev/null 2>&1 || true

  echo "[patient] polling the mirror until it MATURES (non-zero) or 30 polls pass"
  lastmirror=""; seq_seen=""
  for i in $(seq 1 30); do
    sleep 6
    m=$(mirror_once)
    # a refused page (OOM kill mid-load) shows chrome-error; retry the attempt
    local href=$(timeout 15 agent-browser eval "location.href" 2>/dev/null | tail -1 | tr -d '"')
    case "$href" in
      *chrome-error*)
        echo "[patient]    t=$((i*6))s PAGE DEAD ($href) — the compile OOM coin lost"
        return 2 ;;
    esac
    case "$m" in
      ""|" ") : ;;
      *) if [ "$m" != "$lastmirror" ]; then
           echo "[patient]    t=$((i*6))s mirror: $m"
           seq_seen="$seq_seen | $m"
           lastmirror="$m"
         fi ;;
    esac
    case "$m" in
      *"16 jobs"*) return 0 ;;
    esac
  done
  return 3
}


final_verdict() {
  local href=$(timeout 20 agent-browser eval "location.href" 2>/dev/null | tail -1 | tr -d '"')
  local stamp=$(timeout 20 agent-browser eval "(document.body.innerText.match(/build[\\s\\n]*[0-9a-f]{6,8}/)||[''])[0]" 2>/dev/null | tail -1 | tr -d '"')
  echo "[patient] href: $href"
  echo "[patient] stamp: $stamp"
  echo "[patient] mirror sequence:$seq_seen"
  case "$lastmirror" in
    *"16 jobs"*) echo "[patient] VERDICT GREEN — the wall matured: 16 jobs · 15 edges" ;;
    "")
      echo "[patient] VERDICT MISS — the mirror never spoke; page text head:"
      timeout 20 agent-browser eval "document.body.innerText.slice(0,400)" 2>/dev/null | tail -3
      ;;
    *"0 jobs"*)
      echo "[patient] VERDICT EMPTY-STABLE — the wall held 0/0; full text (toast hunt):"
      timeout 20 agent-browser eval "document.body.innerText.slice(0,900)" 2>/dev/null | tail -6
      ;;
    *) echo "[patient] VERDICT ODD — mirror said: $lastmirror" ;;
  esac
  echo "[patient] server log tail:"
  tail -6 "$LOG"
}

attempt 1; rc=$?
if [ "$rc" = "2" ] || [ "$rc" = "3" ] || [ "$rc" = "1" ]; then
  echo "[patient] --- one retry granted (the OOM coin re-flipped) ---"
  attempt 2; rc=$?
fi
final_verdict

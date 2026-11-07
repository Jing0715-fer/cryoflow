#!/bin/bash
# t879-mirror-final.sh — the film leg's last face, the witness-1 shape.
#
# Six patient iterations (v2-v7) proved the structural ledger: node's
# post-compile plateau is 2.4-2.8GB REGARDLESS of the V8 cap (external
# memory dominates), chrome needs ~0.4GB, the platform ~0.7GB — the
# 4041MB box cannot hold the dev lane + chrome through ANY extra compile
# wave, and the v4-v7 manifest warms only summoned bogus compiles
# (`/_error` 400s from the runtime's own name strings).
#
# But witness 1 (v1, this window) FLIPPED THE COIN GREEN with its exact
# shape: plain boot, chrome alive from the start, three-route warm, nav,
# mirror spoken at t≈60s — the page hydrated and STAYED hydrated for
# minutes (the verdict evals answered). Its only flaw: the loop broke on
# the FIRST "0 jobs · 0 edges" (the loading mirror) and never read the
# matured wall. v8 is exactly that shape with the premature break cured.
set -u
cd /home/z/my-project
ORIGIN="http://127.0.0.1:3000"
LOG=/tmp/t879-final-server.log

echo "[final] 1. clearing the field"
pkill -f dev-server-watchdog 2>/dev/null
pkill -9 -f "next dev" 2>/dev/null
pkill -9 -f next-server 2>/dev/null
pkill -9 -f "\.agent-browser/browsers/" 2>/dev/null
sleep 2
agent-browser open about:blank > /dev/null 2>&1 || true

echo "[final] 2. booting (witness-1's exact shape: default heap, chrome co-resident)"
bash dev-server.sh > "$LOG" 2>&1 &
up=0
for _ in $(seq 1 45); do
  sleep 3
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 5 -H "Origin: $ORIGIN" $ORIGIN/api/projects 2>/dev/null)
  [ "$code" = "200" ] && { up=1; break; }
done
[ "$up" = "1" ] || { echo "[final] FATAL — the lane never came up"; tail -5 "$LOG"; exit 1; }
echo "[final]    lane up"

echo "[final] 3. warming the load() plane"
for r in project jobs edges system projects workspaces; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 120 -H "Origin: $ORIGIN" $ORIGIN/api/$r)
  echo "[final]    /api/$r: $code"
done

echo "[final] 4. navigating the canvas"
agent-browser eval "location.assign('$ORIGIN'); 'nav'" > /dev/null 2>&1 || true

echo "[final] 5. polling the mirror until it MATURES (non-zero) or 35 polls pass"
lastmirror=""; seq_seen=""
for i in $(seq 1 35); do
  sleep 6
  m=$(timeout 20 agent-browser eval "(document.body.innerText.match(/[0-9]+ jobs [^\\n]*edges/)||[''])[0]" 2>/dev/null | tail -1 | tr -d '"')
  href=$(timeout 15 agent-browser eval "location.href" 2>/dev/null | tail -1 | tr -d '"')
  case "$href" in
    *chrome-error*)
      echo "[final]    t=$((i*6))s PAGE DEAD — the coin lost (dmesg will name the victim)"
      break ;;
  esac
  case "$m" in
    ""|" ") : ;;
    *) if [ "$m" != "$lastmirror" ]; then
         echo "[final]    t=$((i*6))s mirror: $m  (node RSS: $(( $(ps -o rss= -p "$(pgrep -f next-server | head -1)" 2>/dev/null | tr -d ' ') / 1024 ))MB)"
         seq_seen="$seq_seen | $m"
         lastmirror="$m"
       fi ;;
  esac
  case "$m" in
    *"16 jobs"*) break ;;
  esac
done

echo "[final] 6. the verdict"
href=$(timeout 20 agent-browser eval "location.href" 2>/dev/null | tail -1 | tr -d '"')
stamp=$(timeout 20 agent-browser eval "(document.body.innerText.match(/build[\\s\\n]*[0-9a-f]{6,8}/)||[''])[0]" 2>/dev/null | tail -1 | tr -d '"')
echo "[final] href: $href"
echo "[final] stamp: $stamp"
echo "[final] mirror sequence:$seq_seen"
case "$lastmirror" in
  *"16 jobs"*) echo "[final] VERDICT GREEN — THE FILM LEG'S LAST FACE IS CLOSED: the wall says 16 jobs · 15 edges" ;;
  "")
    echo "[final] VERDICT MISS — mirror never spoke; text head:"
    timeout 20 agent-browser eval "document.body.innerText.slice(0,300)" 2>/dev/null | tail -2
    ;;
  *"0 jobs"*)
    echo "[final] VERDICT EMPTY-STABLE — wall held 0/0; toast hunt:"
    timeout 20 agent-browser eval "document.body.innerText.slice(0,900)" 2>/dev/null | tail -6
    ;;
  *) echo "[final] VERDICT ODD — mirror said: $lastmirror" ;;
esac
echo "[final] server log tail:"
tail -8 "$LOG"

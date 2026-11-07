#!/bin/bash
# t878-round.sh — the film leg's round driver: the chat API's loop is
# CLIENT-driven (the route's own doc: "while the response says needsContinue,
# it immediately re-POSTs {sessionId, continue:true}"), so a curl round must
# BE that loop. The panel drives it in the browser; this script drives it
# from the shell so the verdict, not the ritual, spends the window's context.
set -u
API="http://127.0.0.1:3000/api/ai/chat"
ORIGIN="http://127.0.0.1:3000"
MSG="${1:-创建一个新的 Motion Correction 任务，名字叫 QA Wire Leg，并从 Import Movies 1 连线过来}"
OUT="${2:-/tmp/t878-round.json}"
: > "$OUT"

echo "[round] sending message at $(date -u +%H:%M:%SZ)"
body=$(node -e "console.log(JSON.stringify({message:process.argv[1]}))" "$MSG")
resp=$(curl -s -m 300 -X POST -H "Origin: $ORIGIN" -H "Content-Type: application/json" -d "$body" "$API")
echo "$resp" >> "$OUT"

sid=$(node -e "try{console.log(JSON.parse(require('fs').readFileSync('$OUT','utf8').trim().split('\n').pop()).sessionId||'')}catch(e){console.log('')}")
i=0
while [ -n "$sid" ] && [ $i -lt 40 ]; do
  last=$(tail -1 "$OUT")
  needs=$(node -e "try{const j=JSON.parse(process.argv[1]); console.log(j.needsContinue?'yes':'no')+(j.error?' ERR:'+j.error.slice(0,60):'')}catch(e){console.log('parse-fail')}" "$last")
  echo "[round] $(date -u +%H:%M:%SZ) loop $i needsContinue=$needs"
  case "$needs" in
    no*) break ;;
    parse-fail) echo "[round] FATAL — response unparseable"; exit 1 ;;
  esac
  resp=$(curl -s -m 300 -X POST -H "Origin: $ORIGIN" -H "Content-Type: application/json" -d "{\"sessionId\":\"$sid\",\"continue\":true}" "$API")
  echo "$resp" >> "$OUT"
  i=$((i+1))
done
echo "[round] finished after $i continue rounds at $(date -u +%H:%M:%SZ)"

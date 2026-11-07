#!/bin/bash
# t878-film-leg.sh — the AI-panel wire-consumer film leg, under the t877
# warm-first law. The window that wrote this spent three boots learning
# the order of operations; this script IS that order, so the next window
# spends its context on the VERDICT, not the ritual.
#
# The sequence (each step's why lives in the worklog's t877 entry):
#   1. park the browser tab on about:blank (the t1172 HMR-reconnect whale)
#   2. the single-boot discipline: pkill every next mouth, nuke .next,
#      boot ONE lane via the canonical launcher (the t1183 wrapper recipe)
#   3. warm the API plane COLD-FIRST: /api/{projects,jobs,edges},
#      /api/ai/settings, then ONE trivial chat round (the builtin GLM
#      lane's compile is the heaviest — it must never run beside the
#      canvas compile; the t877 OOM witness: 3.23GB anon, kernel-killed)
#   4. open the canvas (the browser drives the whale compile alone)
#   5. wait for the hydrate (the footer's mirror: "16 jobs · 15 edges")
#   6. print READY — the round is the caller's to fire
#
# Usage: bash scripts/t878-film-leg.sh   (one SHORT tool call, then poll)
set -u
cd /home/z/my-project

echo "[t878] 1. parking the tab"
agent-browser open about:blank > /dev/null 2>&1 || true

echo "[t878] 2. single boot"
# The discipline is SINGLE-BOOT and SINGLE-KEEPER: the watchdog (scripts/
# dev-server-watchdog.sh) is a keeper with its own boot lane and its own
# SILENT_ZOMBIE patience — a manual canvas compile outlasts that patience,
# so a surviving watchdog KILLS the film leg's server mid-compile and boots
# its own (the t877 double-boot disease, two next-servers on ONE .next).
# The film leg runs keeper-less: the window itself is the keeper.
pkill -f dev-server-watchdog 2>/dev/null
pkill -9 -f "next dev" 2>/dev/null
pkill -9 -f "next-server" 2>/dev/null
sleep 3
if pgrep -f "next dev" > /dev/null 2>&1 || pgrep -f "next-server" > /dev/null 2>&1; then
  echo "[t878] FATAL — a next mouth survived the kill:"; pgrep -fa "next dev|next-server"; exit 1
fi
rm -rf .next
setsid nohup bash dev-server.sh > /tmp/t878-lane.log 2>&1 < /dev/null &
for _ in $(seq 1 40); do
  sleep 3
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 5 -H "Origin: http://localhost:3000" http://localhost:3000/api/projects 2>/dev/null)
  [ "$code" = "200" ] && break
done
[ "$code" = "200" ] || { echo "[t878] FATAL — the lane never came up (read /tmp/t878-lane.log)"; exit 1; }
echo "[t878]    lane up"

echo "[t878] 3. warming the API plane (cold-first)"
for r in projects jobs edges; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 90 -H "Origin: http://localhost:3000" http://localhost:3000/api/$r)
  echo "[t878]    /api/$r: $code"
  [ "$code" = "200" ] || { echo "[t878] FATAL — /api/$r refused to warm"; exit 1; }
done
curl -s -o /dev/null -m 60 -H "Origin: http://localhost:3000" http://localhost:3000/api/ai/settings || true
chat=$(curl -s -m 180 -X POST -H "Origin: http://localhost:3000" -H "Content-Type: application/json" \
  -d '{"message":"你好"}' http://localhost:3000/api/ai/chat | head -c 40)
echo "[t878]    chat warm: ${chat:0:40}"
case "$chat" in *sessionId*) ;; *) echo "[t878] FATAL — the chat lane never warmed"; exit 1 ;; esac

echo "[t878] 4. opening the canvas (the whale compiles alone)"
agent-browser open http://localhost:3000 > /dev/null 2>&1 || true

echo "[t878] 5. waiting for the hydrate (the footer's mirror)"
for _ in $(seq 1 30); do
  sleep 10
  mirror=$(timeout 20 agent-browser eval "(document.body.innerText.match(/\d+ jobs [^\n]*edges[^\n]*/)||[''])[0]" 2>/dev/null | tail -1)
  case "$mirror" in
    *"16 jobs"*"15 edges"*) echo "[t878]    mirror: $mirror — the world is on the wall"; break ;;
    "") : ;;
    *) echo "[t878]    mirror says: $mirror (waiting for the standing shape)" ;;
  esac
done

echo "[t878] 6. READY — fire the round:"
echo "        panel prompt: 创建一个新的 Motion Correction 任务，名字叫 QA Wire Leg，并从 Import Movies 1 连线过来"
echo "        verdict: cards 17 · footer '17 jobs · 16 edges' · NO reload · then DELETE via the product door, world as-left 16/15"

#!/bin/bash
# t879-mirror-witness.sh — the film leg's last face, in ONE foreground
# tool call. The census's lesson (t879): a process tree rooted in a live
# tool call survives the patrol's reap (the census's own boot lived
# through the whole live leg; the free-floating setsid keeper died in
# ~3min twice). So the witness runs the whole ritual inside one call:
# boot → warm the API plane → navigate the canvas → wait on the footer's
# mirror → read the verdict. The server's life is the call's life —
# long enough, if the warm cache holds.
set -u
cd /home/z/my-project
ORIGIN="http://127.0.0.1:3000"

echo "[witness] 1. clearing the field"
pkill -f dev-server-watchdog 2>/dev/null
pkill -9 -f "next dev" 2>/dev/null
pkill -9 -f next-server 2>/dev/null
sleep 2
agent-browser open about:blank > /dev/null 2>&1 || true

echo "[witness] 2. booting (the canonical webpack launcher, as a CHILD of this call)"
bash dev-server.sh > /tmp/t879-witness-server.log 2>&1 &
SRV=$!
up=0
for _ in $(seq 1 45); do
  sleep 3
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 5 -H "Origin: $ORIGIN" $ORIGIN/api/projects 2>/dev/null)
  [ "$code" = "200" ] && { up=1; break; }
done
[ "$up" = "1" ] || { echo "[witness] FATAL — the lane never came up"; tail -5 /tmp/t879-witness-server.log; exit 1; }
echo "[witness]    lane up"

echo "[witness] 3. warming the API plane"
for r in projects jobs edges; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 120 -H "Origin: $ORIGIN" $ORIGIN/api/$r)
  echo "[witness]    /api/$r: $code"
  [ "$code" = "200" ] || { echo "[witness] FATAL — /api/$r refused"; exit 1; }
done

echo "[witness] 4. navigating the canvas (127.0.0.1 — Chrome's localhost is dead)"
agent-browser eval "location.assign('$ORIGIN'); 'nav'" > /dev/null 2>&1 || true

echo "[witness] 5. waiting on the footer's mirror"
mirror=""
for _ in $(seq 1 36); do
  sleep 10
  mirror=$(timeout 20 agent-browser eval "(document.body.innerText.match(/\d+ jobs [^\n]*edges[^\n]*/)||[''])[0]" 2>/dev/null | tail -1)
  case "$mirror" in
    *jobs*edges*) break ;;
    "") : ;;
    *) : ;;
  esac
done
echo "[witness] mirror: $mirror"

echo "[witness] 6. the verdict"
href=$(timeout 20 agent-browser eval "location.href" 2>/dev/null | tail -1)
stamp=$(timeout 20 agent-browser eval "(document.body.innerText.match(/build\s*\n?\s*[0-9a-f]{6,8}/)||[''])[0]" 2>/dev/null | tail -1)
echo "[witness] href: $href"
echo "[witness] build stamp: $stamp"
case "$mirror" in
  *"16 jobs"*"15 edges"*) echo "[witness] VERDICT GREEN — the world is on the wall (16 · 15)" ;;
  *"17 jobs"*"16 edges"*) echo "[witness] VERDICT UNEXPECTED-17 — a ghost mint stands; investigate" ;;
  "") echo "[witness] VERDICT MISS — the mirror never spoke (read /tmp/t879-witness-server.log)" ;;
  *) echo "[witness] VERDICT ODD — mirror said: $mirror" ;;
esac

#!/usr/bin/env bash
# t1083-lane-sweep.sh — the standalone lane exam, Phase W+S (weigh + sweep).
#
# The t1083 entry's lead candidate: a `next build` + start-prod lane for the
# browser-heavy QA pairs would end the thin-host fights (dev 1.9-2.6GB +
# chrome >=1.5GB > 4GB). The t1083 entry's own instruction: weigh the build's
# own appetite HONESTLY. This script is the weigh's first half — record the
# as-found ambient, then strip it to the floor (t415: "close agent-browser and
# stop dev servers BEFORE grinding; the same heap can live or die on the room
# it is given"), leaving the box ready for the foreground grinder.
#
# The sweep's order matters: the watchdog keeper dies FIRST (else it revives
# the dev server mid-build — the ceremony's documented resurrection hazard,
# dev-server.sh's own header names CRYOFLOW_NO_WATCHDOG=1 for "a deliberate
# next build ... while the dev lane is down").
#
# Restore is the sibling script's job (t1083-lane-restore.sh). Nothing here
# restores anything — one phase, one verdict.

set -u
cd "$(dirname "$0")/.."

stamp() { date -u '+[%H:%M:%SZ]'; }
log() { echo "$(stamp) $*"; }

rss_mb() { ps -o rss= -p "$1" 2>/dev/null | awk '{print int($1/1024)}'; }

echo "=== t1083 lane exam — PHASE W: the as-found weigh ==="
log "git: $(git rev-parse --short HEAD) $(git status -sb | head -1)"
echo "--- ambient, as-found ---"
free -m | awk 'NR==2 {printf "mem: total=%sMB used=%sMB free=%sMB available=%sMB\n",$2,$3,$4,$7}'
df -h . | awk 'NR==2 {printf "disk: free=%s (scratch gate needs 2GB)\n",$4}'
DEV_PIDS="$(pgrep -f 'next dev -p 3000'; pgrep -f '^next-server')"
for p in $DEV_PIDS; do
  [ -n "$(rss_mb "$p")" ] && log "dev pid $p rss=$(rss_mb "$p")MB cmd=$(tr '\0' ' ' </proc/$p/cmdline 2>/dev/null | cut -c1-60)"
done
KEEPER_PID="$(pgrep -f 'dev-server-watchdog' | head -1)"
[ -n "$KEEPER_PID" ] && log "keeper pid $KEEPER_PID rss=$(rss_mb "$KEEPER_PID")MB"
MOCK_PID="$(pgrep -f 'bun server.mjs' | head -1)"
[ -n "$MOCK_PID" ] && log "mock pid $MOCK_PID rss=$(rss_mb "$MOCK_PID")MB port=$(ss -tlnp 2>/dev/null | grep "pid=$MOCK_PID" | sed -n 's/.*:\([0-9]*\) .*/\1/p' | head -1)"
AB_PID="$(pgrep -f 'agent-browser-linux-x64' | head -1)"
[ -n "$AB_PID" ] && log "agent-browser daemon pid $AB_PID rss=$(rss_mb "$AB_PID")MB"
if [ -f .next/BUILD_ID ]; then log "BUILD_ID present: $(cat .next/BUILD_ID) (trio gate will decide)"
else log "BUILD_ID absent — the grind path is the lane"; fi

echo
echo "=== PHASE S: the sweep (strip the ambient to the floor) ==="

# S1 — agent-browser session closed (t415: chrome's QA session alone presses
# the kernel OOM line ~340MB lower; the daemon may stay, the page dies).
agent-browser close >/dev/null 2>&1 && log "agent-browser session closed" || log "agent-browser close: nothing to close (rc=$?)"

# S2 — the keeper dies FIRST (it would revive the dev server mid-build).
if [ -n "$KEEPER_PID" ]; then
  pkill -f 'dev-server-watchdog' 2>/dev/null
  sleep 1
  pgrep -f 'dev-server-watchdog' >/dev/null && log "WARNING: keeper still alive" || log "keeper stopped (pid $KEEPER_PID)"
else
  log "no keeper found"
fi

# S3 — the dev lane, killed with dev-server.sh's own spellings (t859's law:
# match the spawn the cleanup was written for).
pkill -f 'next dev' 2>/dev/null
pkill -f 'next dev -p 3000' 2>/dev/null
pkill -f 'next-server' 2>/dev/null
sleep 2
pgrep -f 'next-server' >/dev/null && { log "dev next-server survived TERM — escalating"; pkill -9 -f 'next-server' 2>/dev/null; sleep 1; }
pgrep -f 'next dev' >/dev/null || log "dev lane stopped"

# S4 — the mock bun (the double-stop law names it; 32MB but the law is the law).
if [ -n "$MOCK_PID" ]; then
  kill "$MOCK_PID" 2>/dev/null
  for _ in $(seq 1 5); do [ -d "/proc/$MOCK_PID" ] || break; sleep 1; done
  [ -d "/proc/$MOCK_PID" ] && kill -9 "$MOCK_PID" 2>/dev/null
  log "mock bun stopped (pid $MOCK_PID) — restore is lane-restore's job"
fi

sleep 1
echo "--- ambient, post-sweep ---"
free -m | awk 'NR==2 {printf "mem: total=%sMB used=%sMB free=%sMB available=%sMB\n",$2,$3,$4,$7}'
ss -tln | grep -E ':(3000|3022) ' && log "WARNING: a lane port is still held" || log "ports 3000/3022 free — the floor is reached"
echo "=== sweep verdict: the box is ready for the foreground grinder ==="

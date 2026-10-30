#!/usr/bin/env bash
# t1083-lane-restore.sh — the standalone lane exam, Phase R (restore the world).
#
# The exam's contract with the next window: the as-left IS the standing
# world — dev lane up, keeper ensured, mock bun on :3022, the world
# fingerprint unmoved, the honest RELION badge. The prod lane is retired
# first (bun ignores SIGTERM per t435's own note — the escalation is part
# of the spell), and the trio on disk is left in place (a stale-vs-future-
# source trio with NO server running is not a tear — t434 needs memory to
# disagree with disk).

set -u
cd "$(dirname "$0")/.."

stamp() { date -u '+[%H:%M:%SZ]'; }
log() { echo "$(stamp) $*"; }

echo "=== t1083 lane exam — PHASE R: restore the standing world ==="

# R1 — retire the prod lane.
PROD_PIDS="$(pgrep -f 'standalone/server.js')"
if [ -n "$PROD_PIDS" ]; then
  for p in $PROD_PIDS; do kill "$p" 2>/dev/null; done
  sleep 2
  for p in $(pgrep -f 'standalone/server.js'); do
    log "pid $p ignored SIGTERM (bun's own law) — escalating to SIGKILL"
    kill -9 "$p" 2>/dev/null
  done
  sleep 1
  pgrep -f 'standalone/server.js' >/dev/null && log "WARNING: prod still alive" || log "prod lane retired"
else
  log "no prod lane running"
fi

# R2 — the mock bun home (the captured identity: services/mock-cluster,
# `bun server.mjs`, port 3022, detached — the spell that started it).
if pgrep -f 'bun server.mjs' >/dev/null; then
  log "mock already home"
else
  ( cd services/mock-cluster && setsid nohup bun server.mjs >> /tmp/cryoflow-qa/mock-cluster.log 2>&1 < /dev/null & )
  for _ in $(seq 1 10); do
    sleep 1
    ss -tln | grep -q ':3022 ' && break
  done
  ss -tln | grep -q ':3022 ' && log "mock bun restored (port 3022)" || log "WARNING: mock did not take :3022"
fi

# R3 — the dev lane through its own door (dev-server.sh re-ensures the
# keeper by construction; the readiness wait rides INSIDE this tool call).
if curl -H 'Origin: http://localhost:3000' -sf -o /dev/null --max-time 3 http://localhost:3000/api/jobs; then
  log "dev lane already answering"
else
  bash scripts/dev-server.sh
  up="000"
  for _ in $(seq 1 30); do
    sleep 2
    up="$(curl -s -o /dev/null -w '%{http_code}' -H 'Origin: http://localhost:3000' --max-time 5 http://localhost:3000/api/jobs || true)"
    [ "$up" = "200" ] && break
  done
  [ "$up" = "200" ] && log "dev lane answers 200 (watchdog ensured)" || { log "FAILED: dev lane never came up (last $up)"; tail -6 /tmp/cryoflow-qa/dev-server.log | sed 's/^/    | /'; }
fi

# R4 — the world fingerprint (pinned reader — the poison law).
JOBS="$(DATABASE_URL=file:/home/z/my-project/db/cryoflow.db node -e 'const {PrismaClient}=require("@prisma/client");const p=new PrismaClient({datasources:{db:{url:"file:/home/z/my-project/db/cryoflow.db"}}});(async()=>{const jobs=await p.job.count();const edges=await p.edge.count();const ws=await p.workspace.count();console.log(JSON.stringify({jobs,edges,ws}));await p.$disconnect()})()' 2>/dev/null | tail -1)"
log "world fingerprint: $JOBS (expected {\"jobs\":16,\"edges\":4,\"ws\":1})"

# R5 — the honest badge (clean lane: no RELION_HOME in the server env).
# The status door is guarded — the probe carries the Origin header (the bare
# 403 {"error":"Cross-site access..."} is the guard's honest refusal, not data).
SYS="$(curl -s -H 'Origin: http://localhost:3000' --max-time 8 http://localhost:3000/api/system | head -c 200)"
log "GET /api/system -> $SYS"
echo "=== PHASE R verdict: the standing world's faces are above ==="

#!/usr/bin/env bash
# t1083-lane-prod.sh — the standalone lane exam, Phase P (boot the prod lane).
#
# Preconditions (lane-sweep + the grinder's green): no dev lane, no keeper,
# no mock, .next/standalive trio complete, .next/.built-at-commit stamped.
# This script boots the standalone server the t435 anti-tear spell starts —
# with the env pins restated (t419's env pin + t420's data-plane pin) so a
# bare invocation leaves a coherent world — and measures the lane's honest
# steady-state appetite.
#
# The prod lane contract: :3000 (the whole lane speaks :3000), NO keeper
# (a ceremony must not be resurrected mid-flight — the boot is bare setsid,
# the sibling restore script retires it).

set -u
cd "$(dirname "$0")/.."

stamp() { date -u '+[%H:%M:%SZ]'; }
log() { echo "$(stamp) $*"; }

echo "=== t1083 lane exam — PHASE P: the prod lane boots ==="

# The trio gate (t417/t418: BUILD_ID alone is a server that cannot start).
if [ ! -f .next/BUILD_ID ] || [ ! -f .next/standalone/server.js ] || [ ! -d .next/standalone/.next/static ]; then
  log "REFUSED: the startable trio is incomplete — grind green first (build-until-green.sh)"
  exit 1
fi
log "trio complete: BUILD_ID $(cat .next/BUILD_ID), provenance $(cat .next/.built-at-commit 2>/dev/null || echo unknown)"

ss -tln | grep ':3000 ' && { log "REFUSED: :3000 is held — sweep first"; exit 1; }

# The boot, with the pins the anti-tear spell uses (restated explicitly —
# the sandbox's exported DATABASE_URL is the custom.db poison; the pins beat it).
export DATABASE_URL="file:$(pwd)/db/cryoflow.db"
export CRYOFLOW_DATA_DIR="$(pwd)/data"
export NODE_ENV=production
( setsid nohup bun .next/standalone/server.js >> /tmp/cryoflow-qa/prod-server.log 2>&1 < /dev/null & )
log "standalone spawned (log: /tmp/cryoflow-qa/prod-server.log)"

# Readiness: SSR first, then the API face.
up="000"
for _ in $(seq 1 30); do
  sleep 2
  up="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:3000/ || true)"
  [ "$up" = "200" ] && break
done
if [ "$up" != "200" ]; then
  log "FAILED: the standalone never answered 200 (last $up) — log tail:"
  tail -8 /tmp/cryoflow-qa/prod-server.log | sed 's/^/    | /'
  exit 1
fi
log "SSR 200 — the prod lane answers"

# The API face (the roster gate requires the Origin header — the bare 403 is
# its honest refusal, t1082's note).
JOBS="$(curl -s -H 'Origin: http://localhost:3000' --max-time 8 http://localhost:3000/api/jobs | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{const j=JSON.parse(d);const n=Array.isArray(j)?j.length:(j.jobs?j.jobs.length:-1);console.log(n)}catch(e){console.log("parse-fail")}}')"
SYS="$(curl -s --max-time 8 http://localhost:3000/api/system | head -c 200)"
log "GET /api/jobs (with Origin) -> $JOBS jobs"
log "GET /api/system -> $SYS"

# The lane's honest appetite.
sleep 3
PROD_PIDS="$(pgrep -f 'standalone/server.js')"
for p in $PROD_PIDS; do
  log "prod pid $p rss=$(ps -o rss= -p "$p" | awk '{print int($1/1024)}')MB cmd=$(tr '\0' ' ' </proc/$p/cmdline 2>/dev/null | cut -c1-50)"
done
free -m | awk 'NR==2 {printf "mem (prod lane steady): total=%sMB used=%sMB available=%sMB\n",$2,$3,$7}'

echo "=== PHASE P verdict: the lane's numbers are above — compare to dev's 1.85GB ==="

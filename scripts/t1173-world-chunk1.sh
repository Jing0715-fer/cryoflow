#!/bin/bash
# t1173-world-chunk1.sh — the reunion window's world foundation chunk:
# zombie-tab neuter (the t1172 third-mouth law) + the EMPIAR bundle
# rebuild (--bundle-only, the recycle ate /home/z/empiar-10017) +
# prisma db push on the launcher's default lane (cryoflow.db was 0 bytes)
# + the canonical dev-server.sh boot + readiness poll.
set -u
cd "$(dirname "$0")/.."
ROOT="$PWD"
LOG=/tmp/cryoflow-qa/t1173-chunk1.log
mkdir -p /tmp/cryoflow-qa

say() { echo "[chunk1] $*"; }

# 1. the zombie-tab neuter — the daemon's tab is the whale's third mouth
agent-browser open about:blank >/dev/null 2>&1 || true
say "daemon tab neutered (about:blank)"

# 2. the bundle (the film's mint chunk could call it defensively — t1172 #4)
if [ ! -d /home/z/empiar-10017/micrographs ]; then
  say "bundle gone — healer --bundle-only rebuilding (~40s)"
  node scripts/demo-chain-resurrect.mjs --bundle-only 2>&1 | tail -2
else
  say "bundle present"
fi

# 3. the default lane's schema (0-byte db from the recycle)
export DATABASE_URL="file:$ROOT/db/cryoflow.db"
npx prisma db push --skip-generate 2>&1 | tail -2
say "schema pushed to cryoflow.db"

# 4. stop any strays, boot the canonical launcher (t921 lane law)
pkill -f "next-server" 2>/dev/null; pkill -f "next dev" 2>/dev/null; sleep 1
(setsid bash scripts/dev-server.sh >> "$LOG" 2>&1 < /dev/null &)
say "launcher booted, polling readiness"

UP=0
for i in $(seq 1 30); do
  sleep 5
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 15 -H "Origin: http://localhost:3000" "http://localhost:3000/api/projects" 2>/dev/null)
  if [ "$code" = "200" ]; then UP=1; say "lane up (~$((i*5))s)"; break; fi
done
if [ "$UP" != "1" ]; then say "BOOT FAILED"; tail -8 "$LOG"; exit 1; fi

# 5. the world's own seed (the launcher lane's first boot seeds the starter)
curl -s -m 10 -H "Origin: http://localhost:3000" http://localhost:3000/api/jobs | python3 -c "import json,sys; d=json.load(sys.stdin); jobs=d if isinstance(d,list) else d.get('jobs',[]); print('jobs after boot:',len(jobs))"
curl -s -o /dev/null -w "canvas compile: %{http_code} in %{time_total}s\n" -m 120 "http://localhost:3000/" 2>/dev/null
echo '{"chunk1":"ok"}'

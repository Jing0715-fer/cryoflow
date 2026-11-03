#!/bin/bash
# boot-race experiment boot — mirrors scripts/start-prod.sh's prep steps
# EXACTLY (kill, port guard, static copy, symlink guard) but captures the
# server's stdout/stderr so [boot-race] dumps are readable. Task 183.
cd /home/z/my-project
pkill -f "standalone/server.js" 2>/dev/null
pkill -f "next start" 2>/dev/null
pkill -f "bun server.js" 2>/dev/null
pkill -f "next-server" 2>/dev/null
for i in 1 2 3 4 5; do
  if ! lsof -ti :3000 >/dev/null 2>&1; then break; fi
  fuser -k 3000/tcp 2>/dev/null
  sleep 1
done
cp -r .next/static .next/standalone/.next/ 2>/dev/null || true
cp -r public .next/standalone/ 2>/dev/null || true
WANT=/home/z/my-project/data
HAVE=$(readlink .next/standalone/data 2>/dev/null)
if [ "$HAVE" != "$WANT" ]; then
  rm -rf .next/standalone/data
  if ! ln -s "$WANT" .next/standalone/data 2>/dev/null; then
    echo "FATAL: symlink refused" >&2
    exit 3
  fi
fi
# diagnostic: WHAT does the standalone data path look like at boot time?
echo "[exp] standalone/data: $(readlink .next/standalone/data || echo "REAL DIR")" >> "${3:-/tmp/bootrace-server.log}"
if [ -d .next/standalone/data ] && [ ! -L .next/standalone/data ]; then
  echo "[exp] FROZEN SNAPSHOT present: engine-state size=$(stat -c %s .next/standalone/data/engine-state.json 2>/dev/null || echo missing)" >> "${3:-/tmp/bootrace-server.log}"
fi
sleep 1
# Task 183: absolute DATA_DIR — builds delete .next/standalone (the cwd)
export CRYOFLOW_DATA_DIR=/home/z/my-project/data
export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--max-old-space-size=896"
LOG="${3:-/tmp/bootrace-server.log}"
echo "[exp] boot at $(date +%H:%M:%S) label=$2" >> "$LOG"
cd .next/standalone
setsid bun server.js >> "$LOG" 2>&1 < /dev/null &
exit 0

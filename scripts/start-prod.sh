#!/bin/bash
# production server for QA under memory pressure — no Turbopack compile
# spikes, prebuilt routes; survives the tool-call reaper via setsid
#
# Task 86 lesson: `bun run start` execs `bun .next/standalone/server.js`,
# whose process title matches NEITHER "next start" NOR "next-server" —
# the old pkills silently left the PREVIOUS standalone instance bound to
# :3000, so a rebuilt .next kept serving stale in-memory HTML whose chunk
# hashes no longer existed on disk (ChunkLoadError 500s). Kill by the
# server.js path AND by port, then verify the port is actually free.
cd /home/z/my-project
pkill -f "standalone/server.js" 2>/dev/null
pkill -f "next start" 2>/dev/null
pkill -f "next-server" 2>/dev/null
# belt-and-braces: anything still listening on :3000 must die — a rebuild
# is only "live" if THIS script's instance is the one serving it
for i in 1 2 3 4 5; do
  if ! lsof -ti :3000 >/dev/null 2>&1; then break; fi
  fuser -k 3000/tcp 2>/dev/null
  sleep 1
done
# Task 99 lesson: the standalone server resolves DATA_DIR against ITS cwd
# (.next/standalone), and every `next build` REGENERATES that dir — Next
# copies the real data/ tree in as a FROZEN SNAPSHOT (a previous symlink is
# materialized). From then on the server and every probe script (which write
# the real ./data) diverge silently: seeded workdirs and engine-state records
# are invisible to the API (classes → 0, verify fails) and fs routes 400.
# Restore the live link before boot, EVERY time, whatever the build left.
rm -rf .next/standalone/data
ln -s /home/z/my-project/data .next/standalone/data
sleep 1
export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--max-old-space-size=896"
setsid bun run start >/dev/null 2>&1 < /dev/null &
exit 0

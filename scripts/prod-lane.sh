#!/bin/bash
# CryoFLOW prod lane launcher — the standalone :3200 QA server (t1100's
# Mol*-dialog QA lane), orphaned the dev-server.sh way: this script spawns
# the server as ITS child and exits, so the server re-parents to init and
# the tool-call reaper leaves it alone. The caller must wait for readiness
# INSIDE the same tool call that runs this script.
#
# Usage (single tool call!):
#   bash scripts/prod-lane.sh; sleep 5; curl -sf -H "Origin: http://localhost:3200" localhost:3200/ >/dev/null && echo UP
#
# t1103 — SELF-HEALING links: every `next build` DELETES .next/standalone
# (the t1100 lesson, re-learned this window: a post-rebuild standalone
# silently wrote its OWN empty data/ dir, and every run record vanished —
# the whole world spoke "missing-record" through an honest door). The
# launcher now repairs the data/, db/ and .next/static links BEFORE every
# boot: one world, no private data dir, no stale chunk mirror.
#
# The world's pin rides in the spawn env (the t377 anti-venom).

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT" || exit 1

if curl -sf -H "Origin: http://localhost:3200" http://localhost:3200/ >/dev/null 2>&1; then
  echo "already up"
  exit 0
fi

# the link repairs (idempotent; -T so an existing real dir is reported,
# never silently replaced while the server holds it)
mkdir -p .next/standalone/.next
if [ -d .next/standalone/data ] && [ ! -L .next/standalone/data ]; then
  echo "repair: standalone/data is a REAL dir (the post-rebuild wound) — moving aside"
  rm -rf .next/standalone/data.rebuild-wound
  mv .next/standalone/data .next/standalone/data.rebuild-wound
fi
ln -sfn "$REPO_ROOT/data" .next/standalone/data
ln -sfn "$REPO_ROOT/db" .next/standalone/db
ln -sfn "$REPO_ROOT/.next/static" .next/standalone/.next/static
ln -sfn "$REPO_ROOT/public" .next/standalone/public

DATABASE_URL="file:/home/z/my-project/db/cryoflow.db" \
PORT=3200 HOSTNAME=127.0.0.1 \
  node .next/standalone/server.js >> /tmp/prod-lane.log 2>&1 < /dev/null &

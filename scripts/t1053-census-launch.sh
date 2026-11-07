#!/bin/bash
# t1053 — the census launcher: survives the sandbox tool-call reaper by
# the launch.sh recipe (a script that exits immediately): the census is
# setsid inside THIS script and the script exits, orphaning the census
# (it re-parents to init) — the reaper leaves orphans alone.
# Usage (single SHORT tool call!): bash scripts/t1053-census-launch.sh
set -u
cd /home/z/my-project
setsid bash scripts/t927-census.sh > /tmp/t1053-census.log 2>&1 < /dev/null &
echo "census orphaned: pid $!"

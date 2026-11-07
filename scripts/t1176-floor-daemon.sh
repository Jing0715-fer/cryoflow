#!/bin/bash
# t1176-floor-daemon.sh — the box's own ground-keeper.
# The reaper harvests node_modules every few minutes; a dev server's deep
# resources (prisma engine, lazy requires) die with the tree and the data
# lane answers 500 in 8ms. The launcher's boot-time restore (t1174/t1175)
# only covers BOOTS — any long-lived lane needs the floor re-established
# CONTINUOUSLY. This daemon restores nothing but names: a 1.2s hardlink
# restore every 5s. It boots NOTHING and restarts NOTHING — it is not the
# forbidden server watchdog (which boot-loops against the OOM wall); it is
# the ground the lane stands on.
set -u
REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"
while true; do
  n=$(ls node_modules 2>/dev/null | wc -l)
  # t1177 — THE DEEP WITNESS: the harvest went FILE-LEVEL (next/dist eaten
  # out of a 643-entry-whole tree, live AND store; the launcher died at the
  # entrance with MODULE_NOT_FOUND while every headcount read whole). The
  # headcount asks the surface; the boot asks the entrance. Either fires.
  if { [ "$n" -lt 600 ] || [ ! -f node_modules/next/dist/bin/next ]; } && [ -d .nm-store ]; then
    rm -rf node_modules 2>/dev/null; cp -al .nm-store node_modules 2>/dev/null
    echo "[$(date '+%H:%M:%S')] floor restored ($n -> $(ls node_modules | wc -l))"
  fi
  sleep 5
done

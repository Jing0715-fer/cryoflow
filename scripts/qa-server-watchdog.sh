#!/bin/bash
# qa-server-watchdog.sh — keep a production server alive on :3000
# during QA rounds on this OOM-prone 4GB box (87 kernel kills and counting).
# Restarts within ~2s of a death; logs every transition. Run detached:
#   (nohup bash scripts/qa-server-watchdog.sh > .qa-logs/watchdog.log 2>&1 &)
# Stop with:  pkill -f qa-server-watchdog
#
# Task 101 fix: this used to run `bun next start`, which next.config's
# `output: standalone` explicitly rejects ("does not work with output:
# standalone") — the watchdog could never keep a WORKING server alive, it
# kept relaunching a broken one. Boot via scripts/start-prod.sh instead:
# one source of truth (port cleanup + data symlink safeguard + the real
# standalone server.js exec).
cd /home/z/my-project
while true; do
  if ! curl -s -o /dev/null --max-time 3 http://localhost:3000/; then
    echo "[$(date +%H:%M:%S)] server down — starting via start-prod.sh"
    bash scripts/start-prod.sh
    for i in $(seq 1 20); do
      sleep 1
      if curl -s -o /dev/null --max-time 2 http://localhost:3000/; then
        echo "[$(date +%H:%M:%S)] server up (waited ${i}s)"
        break
      fi
    done
  fi
  sleep 2
done

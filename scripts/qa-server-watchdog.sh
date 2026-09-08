#!/bin/bash
# qa-server-watchdog.sh — keep a production `next start` alive on :3000
# during QA rounds on this OOM-prone 4GB box (87 kernel kills and counting).
# Restarts within ~2s of a death; logs every transition. Run detached:
#   (nohup bash scripts/qa-server-watchdog.sh > .qa-logs/watchdog.log 2>&1 &)
# Stop with:  pkill -f qa-server-watchdog
cd /home/z/my-project
while true; do
  if ! curl -s -o /dev/null --max-time 3 http://localhost:3000/; then
    echo "[$(date +%H:%M:%S)] server down — starting"
    # kill stragglers holding the port or half-dead children
    pkill -f "next-server" 2>/dev/null; sleep 1
    NODE_OPTIONS="--max-old-space-size=1536" nohup bun next start >> .qa-logs/prod-server.log 2>&1 &
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

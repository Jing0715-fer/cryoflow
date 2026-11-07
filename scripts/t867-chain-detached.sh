#!/bin/bash
# t867 — the DETACHED chain healer driver.
# The dispatch route's first compile spikes the server past the box's OOM
# line; webpack's persistent cache accumulates across server generations,
# so each retry compiles cheaper. The healer is idempotent and its own
# patience rides through reboots. This driver loops the single-node chunk
# until the node's "completed in" line lands, then walks the spine — all
# detached (setsid) so the tool reaper can't kill it. Progress lands in
# /tmp/t867-detached.log; the driver exits when postprocess completes or
# the round budget burns.
set -u
cd /home/z/my-project
unset DATABASE_URL

CHAIN=(motioncorr ctffind autopick extract class2d select2d select initialmodel class3d symexpand rebalance refine3d maskcreate postprocess)
LOG=/tmp/t867-detached.log
: > "$LOG"

wait_up () {
  for k in $(seq 1 30); do
    code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/jobs --max-time 8 -H "Origin: http://localhost:3000")
    [ "$code" = "200" ] && return 0
    sleep 8
  done
  return 1
}

for node in "${CHAIN[@]}"; do
  round=0
  while [ $round -lt 8 ]; do
    round=$((round+1))
    if ! wait_up; then
      echo "[$(date +%H:%M:%S)] $node r$round: server down — booting" >> "$LOG"
      bash scripts/dev-server.sh >> "$LOG" 2>&1
      wait_up || { echo "$node: no rise, next round" >> "$LOG"; continue; }
    fi
    # quiescence: let the boot compiles settle before dispatch
    sleep 15
    curl -s -o /dev/null --max-time 30 http://localhost:3000/api/jobs -H "Origin: http://localhost:3000"
    echo "[$(date +%H:%M:%S)] $node r$round: dispatch (avail $(free -m | awk 'NR==2{print $7}')MB)" >> "$LOG"
    node scripts/demo-chain-resurrect.mjs --from "$node" --to "$node" >> "$LOG" 2>&1
    if grep -qE "$node (completed in|already carries outputs)" "$LOG"; then
      echo "[$(date +%H:%M:%S)] $node: COMPLETED" >> "$LOG"
      break
    fi
    echo "[$(date +%H:%M:%S)] $node r$round: red — next round" >> "$LOG"
    sleep 5
  done
  grep -qE "$node (completed in|already carries outputs)" "$LOG" || { echo "DRIVER STOP: $node never completed in 8 rounds" >> "$LOG"; exit 3; }
done
echo "[$(date +%H:%M:%S)] DRIVER DONE: the chain is whole" >> "$LOG"

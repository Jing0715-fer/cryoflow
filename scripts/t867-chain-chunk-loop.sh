#!/bin/bash
# t867 — the chain chunk loop with auto-resurrection.
# The dev server OOMs under compile+run load on this 4GB box; the healer is
# idempotent and --from/--to bounds a single node. This loop walks the spine
# ONE NODE per iteration; if :3000 dies mid-node, it waits for the watchdog
# (or boots once itself), then continues with the node that did not finish.
# Progress is derivable from the healer's own log lines ("X completed in").
#
# Usage: bash scripts/t867-chain-chunk-loop.sh [startType] [maxNodes]
set -u
cd /home/z/my-project
unset DATABASE_URL

CHAIN=(motioncorr ctffind autopick extract class2d select2d select initialmodel class3d symexpand rebalance refine3d maskcreate postprocess)
START="${1:-motioncorr}"
MAX="${2:-14}"

# find the starting index
idx=0
for i in "${!CHAIN[@]}"; do
  if [ "${CHAIN[$i]}" = "$START" ]; then idx=$i; break; fi
done

wait_up () {
  for k in $(seq 1 20); do
    code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 --max-time 6)
    [ "$code" = "200" ] && return 0
    sleep 8
  done
  return 1
}

# quiescence + route prewarm: the cold-boot compiles are the OOM killer;
# wait for memory to stop falling and warm the run-adjacent routes BEFORE
# dispatching a node through them.
settle_warm () {
  sleep 20
  curl -s -o /dev/null --max-time 20 http://localhost:3000/api/jobs -H "Origin: http://localhost:3000"
  curl -s -o /dev/null --max-time 20 http://localhost:3000/api/projects -H "Origin: http://localhost:3000"
  prev=99999
  for k in $(seq 1 8); do
    cur=$(free -m | awk 'NR==2{print $7}')
    [ $((prev - cur)) -lt 60 ] && [ "$cur" -gt 800 ] && return 0
    prev=$cur
    sleep 10
  done
  return 0
}

done_count=0
i=$idx
while [ $i -lt ${#CHAIN[@]} ] && [ $done_count -lt "$MAX" ]; do
  node="${CHAIN[$i]}"
  echo "=== [$done_count] chunk: $node ==="
  if ! wait_up; then
    echo "server down before $node — single clean boot"
    bash scripts/dev-server.sh
    wait_up || { echo "server refused to rise — stop honestly"; exit 2; }
  fi
  settle_warm
  free -m | awk 'NR==2{print "  avail before dispatch:",$7,"MB"}'
  node scripts/demo-chain-resurrect.mjs --from "$node" --to "$node" >> /tmp/t867-chunks.log 2>&1
  rc=$?
  if grep -q "$node completed in" /tmp/t867-chunks.log && [ $rc -eq 0 ]; then
    echo "  ok: $node"
  else
    echo "  chunk $node rc=$rc — inspecting"
    tail -3 /tmp/t867-chunks.log
    if ! curl -s -o /dev/null --max-time 5 http://localhost:3000; then
      echo "  server died during $node — waiting for resurrection"
      wait_up || { bash scripts/dev-server.sh; wait_up || { echo "no rise — stop"; exit 2; }; }
      # re-run the same node (idempotent healer)
      node scripts/demo-chain-resurrect.mjs --from "$node" --to "$node" >> /tmp/t867-chunks.log 2>&1
      grep -q "$node completed in" /tmp/t867-chunks.log && echo "  ok on retry: $node" || { echo "  STILL RED after retry: $node — stop honestly"; exit 3; }
    else
      echo "  server alive but node red — retry once"
      node scripts/demo-chain-resurrect.mjs --from "$node" --to "$node" >> /tmp/t867-chunks.log 2>&1
      grep -q "$node completed in" /tmp/t867-chunks.log && echo "  ok on retry: $node" || { echo "  STILL RED: $node — stop honestly"; exit 3; }
    fi
  fi
  done_count=$((done_count+1))
  i=$((i+1))
done
echo "=== loop finished: $done_count node(s) from $START ==="

#!/bin/bash
# Task 180 matrix driver — 115 suites in 10 chunks, sequential, detached.
# Logs per chunk; each chunk restarts the server fresh (FRESH_SERVER=1).
cd /home/z/my-project || exit 1
RANGES=("1 12" "13 24" "25 36" "37 48" "49 60" "61 72" "73 84" "85 96" "97 108" "109 115")
for i in "${!RANGES[@]}"; do
  read -r from to <<< "${RANGES[$i]}"
  k=$((i + 1))
  echo "=== CHUNK $k ($from..$to) start $(date +%H:%M:%S) ===" >> /tmp/matrix-t180.log
  bash scripts/run-matrix.sh "$from" "$to" >> /tmp/matrix-t180.log 2>&1
  rc=$?
  echo "=== CHUNK $k done rc=$rc $(date +%H:%M:%S) ===" >> /tmp/matrix-t180.log
  if [ $rc -ne 0 ]; then
    echo "CHUNK $k FAILED — stopping the driver (bit-chain: diagnose before re-run)" >> /tmp/matrix-t180.log
    exit $rc
  fi
done
echo "=== ALL CHUNKS GREEN $(date +%H:%M:%S) ===" >> /tmp/matrix-t180.log

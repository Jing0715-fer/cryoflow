#!/bin/bash
# Chunked matrix runner with built-in server self-heal (Task 102).
#
# WHY: the 4GB box OOM-kills next-server mid-matrix (RSS grows with every
# suite that seeds data — Task 101 learned this the hard way; Task 102
# re-learned it at chunk 1). Running the matrix in foreground chunks with
# a restart-if-down guard before each chunk keeps RSS low and a dead
# server from failing every suite after the kill.
#
# Usage: bash scripts/run-matrix-chunk.sh FROM TO   (same 1-based inclusive
# range semantics as run-matrix.sh; chunk sizes of 3–5 fit the tool-call
# timeout with margin).
cd /home/z/my-project
if ! curl -s -o /dev/null --max-time 5 http://localhost:3000/; then
  echo "[chunk] server DOWN — restarting via start-prod.sh"
  bash scripts/start-prod.sh > /tmp/prod-restart.log 2>&1
  sleep 2
fi
curl -s -o /dev/null -w "[chunk] server HTTP %{http_code}\n" http://localhost:3000/ --max-time 15
exec bash scripts/run-matrix.sh "$1" "$2"

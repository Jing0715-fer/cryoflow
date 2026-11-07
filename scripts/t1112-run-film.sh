#!/bin/bash
# t1112 film runner — the WHOLE third-birth film in one breath, the
# transcript captured to scripts/t1112-ride.log (the receipt). The
# world must open at the purest flat (birth-1's gate refuses otherwise);
# the film leaves it at the purest flat again (rollout p11).
cd /home/z/my-project || exit 1
LOG=scripts/t1112-ride.log
: > "$LOG"
run() {
  echo "### stage $1" >> "$LOG"
  node scripts/t1112-third-birth-ride.mjs "$1" >> "$LOG" 2>&1
  local rc=$?
  echo "### stage $1 rc=$rc" >> "$LOG"
  if [ "$rc" -ne 0 ]; then
    echo "ABORT at $1 (rc=$rc) — the transcript's tail:"
    tail -20 "$LOG"
    exit "$rc"
  fi
}
pkill -f 'mock-cluster/server.mjs'; sleep 1
run birth-1
bash services/mock-cluster/launch.sh; sleep 2
run birth-2
run interior-1
pkill -f 'mock-cluster/server.mjs'; sleep 1
run birth-3
bash services/mock-cluster/launch.sh; sleep 2
run birth-4
run interior-2
pkill -f 'mock-cluster/server.mjs'; sleep 1
run birth-5
bash services/mock-cluster/launch.sh; sleep 2
run birth-6
run interior-3
run rollout
echo "=== FILM DONE ==="
echo "PASS lines: $(grep -c 'PASS' "$LOG")"
echo "FAIL lines: $(grep -c 'FAIL' "$LOG")"

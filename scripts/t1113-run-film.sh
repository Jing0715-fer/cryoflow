#!/bin/bash
# t1113 film runner — the WHOLE absent-silences film in one breath, the
# transcript captured to scripts/t1113-ride.log (the receipt). The world
# must open at the purest flat (gate/vanish refuse otherwise); the film
# leaves it at the purest flat again (descent's purge + verify).
cd /home/z/my-project || exit 1
LOG=scripts/t1113-ride.log
: > "$LOG"
run() {
  echo "### stage $1" >> "$LOG"
  node scripts/t1113-absent-silences-ride.mjs "$1" >> "$LOG" 2>&1
  local rc=$?
  echo "### stage $1 rc=$rc" >> "$LOG"
  if [ "$rc" -ne 0 ]; then
    echo "ABORT at $1 (rc=$rc) — the transcript's tail:"
    tail -20 "$LOG"
    exit "$rc"
  fi
}
run gate
run vanish
pkill -f 'mock-cluster/server.mjs'; sleep 1
run fail-1
bash services/mock-cluster/launch.sh; sleep 2
run birth-1
run interior-1
pkill -f 'mock-cluster/server.mjs'; sleep 1
run fail-2
bash services/mock-cluster/launch.sh; sleep 2
run birth-2
run restore
run descent
run verify
echo "=== FILM DONE ==="
echo "PASS lines: $(grep -c 'PASS' "$LOG")"
echo "FAIL lines: $(grep -c 'FAIL' "$LOG")"

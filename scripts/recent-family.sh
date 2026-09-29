#!/bin/bash
# recent-family.sh — the t4xx bench family (34 suites as of Task 469), serial, exit 0 iff all green.
cd "$(dirname "$0")/.."
SUITES=$(ls scripts/t4[2-7][0-9]-*bench.ts | sort)
FAIL=0
N=0
for s in $SUITES; do
  N=$((N+1))
  if bun run "$s" > /tmp/bench-out.txt 2>&1; then
    echo "PASS $s"
  else
    echo "FAIL $s"
    tail -5 /tmp/bench-out.txt
    FAIL=$((FAIL+1))
  fi
done
echo "FAMILY: $N suites, $FAIL failures"
exit $FAIL

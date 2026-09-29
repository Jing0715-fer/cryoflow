#!/bin/bash
# recent-family.sh — the t4xx bench family (55 suites as of Task 491), serial, exit 0 iff all green.
# t491 lesson: the old glob t4[2-8][0-9] topped out at t489 and silently dropped t490+ from the family
# run — "glob 自动纳新" was only true while the decade digit stayed inside the class. Keep [2-9] so
# every future t49x/t50x-adjacent sibling is picked up; bump the top digit when t500 arrives.
cd "$(dirname "$0")/.."
SUITES=$(ls scripts/t4[2-9][0-9]-*bench.ts | sort)
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

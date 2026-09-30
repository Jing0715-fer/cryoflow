#!/bin/bash
# recent-family.sh — the t4xx/t5xx bench family (64 suites as of Task 500), serial, exit 0 iff all green.
# t491 lesson: the old glob t4[2-8][0-9] topped out at t489 and silently dropped t490+ from the family
# run — "glob 自动纳新" was only true while the decade digit stayed inside the class. Keep [2-9] so
# every future t49x/t50x-adjacent sibling is picked up; bump the top digit when t500 arrives.
# t500 lesson (㊳, due on schedule): the top digit DID arrive — glob widened to t[45][0-9][0-9],
# covering t420–t599; the next bump is due when t600 arrives (t599's window owes the same rite).
cd "$(dirname "$0")/.."
SUITES=$(ls scripts/t[45][0-9][0-9]-*bench.ts | sort)
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

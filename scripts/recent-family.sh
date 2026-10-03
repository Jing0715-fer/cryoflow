#!/bin/bash
# recent-family.sh — the t4xx/t5xx bench family (93 suites as of Task 546), serial, exit 0 iff all green.
# t491 lesson: the old glob t4[2-8][0-9] topped out at t489 and silently dropped t490+ from the family
# run — "glob 自动纳新" was only true while the decade digit stayed inside the class. Keep [2-9] so
# every future t49x/t50x-adjacent sibling is picked up; bump the top digit when t500 arrives.
# t501 lesson (㊳, due on schedule): the top digit DID arrive — glob widened to t[45][0-9][0-9],
# covering t420–t599; the next bump is due when t600 arrives (t599's window owes the same rite).
# t546 lesson (the orphan audit): the glob's real floor is t400, not t420 — and t419-ai-assistant
# had been an orphan for 100+ windows SOLELY because it lacked the -bench.ts suffix (its isolated
# world equals the family contract: own TMP + own DATABASE_URL, zero live-world touches). Renamed
# to t419-ai-assistant-bench.ts; the glob caught it the same breath. The old "66 as of Task 501"
# count had drifted too — actual roster is 93 (92 before the rename).
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

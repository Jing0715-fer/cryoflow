#!/bin/bash
# recent-family.sh — the t4xx/t5xx bench family (99 suites as of Task 547), serial, exit 0 iff all green.
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
# t547 lesson (the wide-orphan verdict, t546's handoff ①): the WHOLE orphan class got a per-file
# nature verdict — 42 files outside both rosters. SIX more isolated benches were enrolled by the
# same suffix rite (t402 continue-argv 32/0, t417 unit-reclaim ALL PASS, t420 agent-polish 54/0,
# t428 session-rename-export 40/0, t429 stay-note-json-export 38/0, t430 session-drawer 19/0 —
# each run green post-rename). The other 36 are orphans BY DESIGN: live QA tools/fixtures, one-shot
# probes/diags, live-fire exams, world e2e suites. The world-e2e enrollment decision landed at t548:
# t416/t417 were ALREADY family-run citizens (the t547 ledger over-counted the trio), and t542/t544
# joined family-run's new t54 batch — so no world e2e remains a roster orphan. The full 42-line
# ledger lives in worklog Task 547.
cd "$(dirname "$0")/.."
# t548 preflight: the old world's health announced before the family rides it
# (the t531 seeder's own read-only --check; t431 W1 resolves its real-world
# section through that contract). Non-fatal — the runner reports, it does not
# repair; the message names the cure.
if [ -f data/old-world.json ]; then
  if node scripts/qa-t531-old-world-seed.mjs --check > /tmp/old-world-check.txt 2>&1; then
    echo "PREFLIGHT old world healthy"
  else
    echo "PREFLIGHT OLD WORLD SICK — world-reading suites may fail; repair with: node scripts/qa-t531-old-world-seed.mjs"
    tail -3 /tmp/old-world-check.txt
  fi
fi
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

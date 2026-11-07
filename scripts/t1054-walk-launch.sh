#!/bin/bash
# t1054 — the slab walk's orphan launcher (the t1053 census-launcher's
# twin, R19's law): a script that setsids the payload and EXITS — the
# walk re-parents to init and survives the sandbox reaper. The walk's
# own worst case is ~950s (8 attempts × escalating backoff), far beyond
# any single tool call's patience — the log is the road's memory:
#   tail -f /tmp/t1054-walk.log
set -u
cd /home/z/my-project
setsid node scripts/t1049-slab-face-walk.mjs > /tmp/t1054-walk.log 2>&1 < /dev/null &
echo "walk orphaned: pid $!"

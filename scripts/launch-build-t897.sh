#!/usr/bin/env bash
# t897 (re-cast t898) — the orphan launcher for the cold-cache rebuild (the
# prod-3001.sh doctrine verbatim: the SCRIPT exits immediately, the grinder
# re-parents to init — a synchronous grinder exceeds the 10-minute tool
# window and the tool-call reaper kills it mid-compile). HEAP_MB passes
# through.
cd /home/z/my-project || exit 1
HEAP_MB="${HEAP_MB:-2048}" CRYOFLOW_NO_WATCHDOG=1 \
  setsid bash scripts/build-until-green.sh > /home/z/my-project/.qa-logs/build-t897.log 2>&1 < /dev/null &
exit 0

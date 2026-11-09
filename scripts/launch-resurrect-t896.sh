#!/usr/bin/env bash
# t896 (re-cast t898) — the orphan launcher for the demo-chain healer (the
# same prod-3001.sh doctrine: an inline `setsid … &` in a tool-bash chain
# does NOT survive the reaper; the SCRIPT exits immediately, the healer
# re-parents to init, "$@" passes through verbatim — e.g. --rerun, --from).
cd /home/z/my-project || exit 1
CRYOFLOW_NO_WATCHDOG=1 \
  setsid node scripts/demo-chain-resurrect.mjs "$@" \
  > /home/z/my-project/.qa-logs/resurrect-t896.log 2>&1 < /dev/null &
exit 0

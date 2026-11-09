#!/usr/bin/env bash
# t897 — the orphan launcher for the clobber watcher (the prod-3001
# doctrine: the SCRIPT exits immediately, the watcher re-parents to init).
cd /home/z/my-project || exit 1
CRYOFLOW_NO_WATCHDOG=1 setsid bash scripts/t897-clobber-watch.sh < /dev/null > /dev/null 2>&1 &
exit 0

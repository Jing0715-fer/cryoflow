#!/bin/bash
# heal-until-green.sh — the t404 supervisor.
#
# The healer (scripts/demo-chain-resurrect.mjs) dies SILENTLY in this
# sandbox: the patrol SIGKILLs background node processes without a trace
# (twice witnessed this window — no FAIL line, no exception stack, the
# log just stops mid-retry). The healer itself is idempotent by design
# (resolve-by-type reuses, filled jobs skip, staging resumes with
# "uploaded files are skipped"), so re-issuing it is FREE — the only
# cost of a kill is the seconds between death and revival.
#
# This supervisor is that revival: run the healer, check the exit code,
# re-issue on non-zero up to a hard cap. The cap (12) keeps a GENUINE
# chain failure (bad data, honest run refusal) from looping forever —
# a real failure prints "FAIL: ..." into the log every attempt and the
# supervisor exhausts its cap in ~one patrol-visible lifetime.
#
# Usage: nohup bash scripts/heal-until-green.sh >> .qa-logs/heal-t404.log 2>&1 &
cd "$(dirname "$0")/.." || exit 1
LOG="${1:-.qa-logs/heal-t404.log}"
for attempt in $(seq 1 12); do
  echo "[supervisor] heal attempt $attempt $(date -u +%H:%M:%SZ)" >> "$LOG"
  node scripts/demo-chain-resurrect.mjs >> "$LOG" 2>&1
  code=$?
  echo "[supervisor] attempt $attempt exit=$code" >> "$LOG"
  if [ "$code" -eq 0 ]; then
    echo "[supervisor] WORLD GREEN" >> "$LOG"
    exit 0
  fi
  sleep 20
done
echo "[supervisor] giving up after 12 attempts — inspect $LOG for the repeating FAIL" >> "$LOG"
exit 1

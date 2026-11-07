#!/bin/bash
# t873-heal-drive.sh — the recycled-sandbox heal driver (t871's five-chunk
# doctrine, re-armed for this window's law: the caller waits for readiness
# INSIDE the same tool call — the sandbox reaps detached keepers, so the
# server's life is bounded by the call that needs it, and the healer's own
# idempotency is the retry).
#
# usage: t873-heal-drive.sh [--from TYPE] [--to TYPE] [--rerun]
#   everything is passed through to scripts/demo-chain-resurrect.mjs.
#
# Flow per invocation (up to ATTEMPTS rounds):
#   1. ensure the server answers 200 (boot via dev-server.sh, wait inside
#      the call — the dev lane's own first law);
#   2. run the healer chunk in the foreground;
#   3. on server-death mid-run (ECONNREFUSED), re-ensure and re-run — the
#      healer resolves the chain idempotently, so a re-run ADVANCES, and a
#      fully-completed chunk is a no-op PASS.

LOG=/tmp/cryoflow-qa/t873-heal-drive.log
cd /home/z/my-project || exit 1
mkdir -p /tmp/cryoflow-qa

say() { echo "[$(date -u +%H:%M:%SZ)] $*" | tee -a "$LOG"; }

probe() {
  curl -s -o /dev/null -w "%{http_code}" -H "Origin: http://localhost:3000" \
    http://localhost:3000 --max-time 4
}

wait_up() {
  # cold compile can take ~210s; 45 x 5s = 225s of patience
  for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20 \
           21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40 41 42 43 44 45; do
    code=$(probe)
    if [ "$code" = "200" ]; then
      say "server up (attempt $i)"
      return 0
    fi
    sleep 5
  done
  return 1
}

ensure_server() {
  code=$(probe)
  if [ "$code" = "200" ]; then
    say "server already up"
    return 0
  fi
  say "server down (probe=$code) — booting via dev-server.sh"
  setsid nohup bash scripts/dev-server.sh >> "$LOG" 2>&1 < /dev/null &
  wait_up
}

ATTEMPTS=3
rc=1
for a in 1 2 3; do
  [ "$a" -gt "$ATTEMPTS" ] && break
  ensure_server || { say "attempt $a: server never came up"; continue; }
  say "attempt $a: healer chunk start ($*)"
  node scripts/demo-chain-resurrect.mjs "$@"
  rc=$?
  if [ "$rc" = "0" ]; then
    say "attempt $a: healer rc=0 — chunk PASS"
    break
  fi
  say "attempt $a: healer rc=$rc (server death mid-run?) — re-ensuring and retrying"
done

say "drive exit rc=$rc"
exit $rc

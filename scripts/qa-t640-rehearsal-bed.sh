#!/bin/bash
# t640 — the remote/cluster rehearsal bed, compressed into one verb.
#
# What P1 paid (window Task 640): the mock cluster (:3022) answers real SSH,
# t261 (the P1 stratum: connections/probe/doors/live loop) ALL PASS after one
# suite fix (asymmetric existsSync guard on the registry read), and t262
# (the full run engine: staging → dispatch → poll → sync-back → downstream
# twin → stop) ALL PASS with ZERO product changes. The bed exists; this
# script makes it repeatable — the rehearsal is a verb, not an archaeology
# project (t639's entry-① doctrine, same law as the recovery chain).
#
# t689 — the bed's first wake after ten dormant windows caught a DIAG THAT
# WAS SLANDERING THE PRODUCT: t262's C7 printed "the tab face is false" for
# windows while the face was innocent all along (t689's isolated probe,
# scripts/t689-remote-log-face.mjs, proved route → face → render works when
# the click actually lands; the diag's unscoped locator + non-force click
# never did). C7 is now a must, and the stale "roster restored to 12"
# messages grew a dynamic pre-suite baseline.
#
# Doctrine:
#   - the mock cluster is EXTERNAL infrastructure, never a child of the app:
#     it survives via the orphaning launcher (services/mock-cluster/launch.sh,
#     re-parents to init so the sandbox tool-call reaper cannot collect it)
#   - the suites ARE the rehearsal: t261 = P1 stratum, t262 = full engine;
#     both carry their own cleanup (world-safe shield + roster restore)
#   - a rehearsal that cannot start the rig says so honestly (t372 P0 gate
#     pattern) — it never fake-passes
#
# Usage:
#   bash scripts/qa-t640-rehearsal-bed.sh           # ensure cluster + SSH smoke
#   bash scripts/qa-t640-rehearsal-bed.sh --full    # + t261 + t262 back to back
set -u
cd "$(dirname "$0")/.."
ROOT="$PWD"

echo "== ensure the mock cluster =="
if ss -tln 2>/dev/null | grep -q ":3022 "; then
  echo "  already listening on :3022"
else
  bash services/mock-cluster/launch.sh
  sleep 2
fi
if node services/mock-cluster/test-client.mjs 'echo ok' 2>/dev/null | grep -q ok; then
  echo "  smoke: real SSH round-trip ok"
else
  echo "  FAIL: the mock cluster is not answering (t372 P0 gate — honest stop)"
  exit 1
fi

if [ "${1:-}" != "--full" ]; then
  echo "== bed ready (add --full to run t261 + t262) =="
  exit 0
fi

echo "== t261 — the P1 stratum (connections/probe/doors/live loop) =="
node scripts/t261-remote-connections.mjs || { echo "t261 FAILED"; exit 1; }
echo "== t262 — the full run engine (stage→dispatch→poll→sync→twin→stop) =="
node scripts/t262-remote-run-e2e.mjs || { echo "t262 FAILED"; exit 1; }
echo "== rehearsal bed: ALL GREEN =="

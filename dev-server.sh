#!/bin/bash
# dev-server.sh — the CANONICAL dev launcher (reborn in t1167).
#
# Spawn the dev server through THIS script and the app rides the ONE
# world the bare instruments ride. The two-db trap's full arc, for the
# window that asks why this file exists:
#
#   t1114 — the mourning: a window believed it had "reset" the world. It
#   had imported the db singleton WITHOUT the runtime env, landed on
#   .env's template (db/custom.db, a User/Post-only placeholder), read an
#   empty-looking world, and swept 3.1 GB of LIVE workdirs on the
#   strength of that misread. The data was never in the world it read.
#
#   t1115 — the one home: the verdict moved to src/lib/db-world.ts (the
#   pure well): RUNTIME_DB_BASELINE (the runtime world's ONE path) and
#   templateWorldWarnOf (the watchman — dev-only, hardened against
#   look-alikes: cryoflow.db-wal, cryoflow.db.bak, mycryoflow.db all earn
#   the sentence; query params strip before the test). This script was
#   the law's other half: export the runtime url BEFORE spawning next.
#
#   the fall — this script was untracked and died with a recycled
#   sandbox; the platform's boots regenerate .env toward the template;
#   the t1130 world-gate seat was left OUT of the census (an orphan) and
#   so nobody heard the flap. A bare `next dev` in the t1166 window rode
#   the 3-job template while the instruments read the 15-job world — the
#   census's fuel family (t1021-t1024) doorbelled the split-brain live.
#
#   t1167 — the root closed AND the launcher reborn: src/lib/db.ts now
#   pins its own landing (datasourceUrl = CRYOFLOW_DB_URL ||
#   file:${RUNTIME_DB_BASELINE}) so NO env, NO launch method and NO
#   regenerated .env can move the world under the app; this script is
#   the launch law's home again — belt to db.ts's suspenders. The
#   watchman stays (defense in depth: closing the root never retires the
#   guard), and it still quotes this file's export post by line — L82.
#
# Usage: bash dev-server.sh [next args…]   (or ./dev-server.sh)
# The prisma CLI keeps reading .env (schema.prisma's env("DATABASE_URL")
# is the fallback of record) — the .env contract is the t1130 gate's
# watch; heal it from .env.example if a boot regenerates the template.
#
# WHY the export below matters even though db.ts no longer reads
# DATABASE_URL (the t1167 root closure): the export neutralizes the
# template for every OTHER mouth in the process tree — prisma CLI
# calls, bare scripts, debuggers, anything that still resolves
# env("DATABASE_URL") — for THIS boot, whatever .env says today. The
# app itself is immune either way; this is the tree-wide belt.

set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO"

# The override knob comes through untouched: CRYOFLOW_DB_URL is the ONE
# override for the whole family (the app client, world-snapshot.mjs, the
# seats) — a lane test may set it; this launcher never clobbers it.
if [ -n "${CRYOFLOW_DB_URL:-}" ]; then
  echo "[dev-server] CRYOFLOW_DB_URL is set — riding the override lane:"
  echo "[dev-server]   $CRYOFLOW_DB_URL"
fi

# A stale dev lock (a recycled sandbox's leftover) must not block the
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
#
# ── L82 — THE EXPORT POST (the t1115 warn's sentence quotes this line) ──
export DATABASE_URL="file:${REPO}/db/cryoflow.db"
echo "[dev-server] DATABASE_URL=$DATABASE_URL  (the runtime world; .env's template is NOT load-bearing)"

# ── THE HEAP CAP (t1169 — the rebirth restitution) ──────────────────────
# The reborn launcher dropped the cap its ancestor carried
# (scripts/dev-server.sh's own NODE_OPTIONS line) and the 2026-11-03
# 22:2x census caught the consequence LIVE: an uncapped next-server
# ballooned to 2.8 GB anon on the 4 GB box, the kernel's global OOM
# killed it mid-census, and the fuel family's live legs died with it
# (t1021's world gate read `undefined` where the world should have
# spoken). A dev server that eats the box is not a dev server. The cap
# is override-able (DEV_HEAP_MB); the ancestor carried 896 for the older
# app — webpack's compile of the root page peaked past it (the third
# strike: a boot OOM INSIDE the cap) so the standing default rose 896 → 1536 → 2048 —
# ~2.3 GB RSS worst case; the live lane is short (the census kills the
# server after its seats) so the peak never meets the global OOM.
export NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--max-old-space-size=${DEV_HEAP_MB:-2048}"
echo "[dev-server] NODE_OPTIONS=$NODE_OPTIONS (the heap cap — the census rides this server; the box is 4 GB)"

# ── THE BUNDLER (t1169 — the second strike's cure) ──────────────────────
# The cap alone did not save the second census ride: Turbopack (Next 16's
# default dev bundler) keeps its compiled graphs in NATIVE (Rust) memory,
# which --max-old-space-size cannot bound — anon-rss still hit 2.7 GB and
# the global OOM killed the server again, mid-census, at seat t1164. The
# cure is to stop feeding the whale: dev rides --webpack — the SAME
# bundler the prod lane builds with (`npx next build --webpack`, the
# build-day command) — and webpack's memory lives in the V8 heap the cap
# above actually bounds. One bundler, one memory story, one cap that
# holds. Webpack's compiles are slower than Turbopack's; the census's
# 60-retry fetch budgets were sized for that and the boot warm-up
# absorbs the first hits.
exec npx next dev --webpack "$@"

#!/usr/bin/env node
/**
 * t1167 — the census seat re-key (the text-surgery law: a formal
 * script, never an inline regex injection). TWO seats join this window:
 *
 *   Seat 105 — t1167-one-world-unit: 19 pins on the green path (19 ok()
 *   calls; all unconditional). Lane 1 (unit-runner: the @/lib import
 *   rides jiti; db.ts itself is .ts). The APP-side ONE-world law: the
 *   client's landing is pinned in code (datasourceUrl =
 *   CRYOFLOW_DB_URL || file:${RUNTIME_DB_BASELINE}) — the two-db trap's
 *   root closed; the crown pin replays the trap's exact semantics
 *   (DATABASE_URL pointed at the template) and the client still counts
 *   the living world, equal to the REAL probe's liveJobs.
 *
 *   Seat 106 — t1130-env-world-unit: 5 pins (5 ok() checks, a/b/c/d/e).
 *   Lane 0 (bare node: only @prisma/client + node:fs — no @/lib import).
 *   The .env/CLI contract's world gate (the t1114/t1115 era's seat,
 *   resurrected from orphanhood): (a) .env carries the example's law,
 *   (b) .env.example is the template of record, (c) the BARE client
 *   lands on the living world (15), (d) the living world's shape, (e)
 *   the watchman remains in db.ts. This seat FLAPS when the platform
 *   regenerates .env toward the template — that flap is the re-heal
 *   reminder (the app is immune either way; the t1167 seat proves it).
 *
 * Four edits, each a counted anchor:
 *   1. NAMES  — both seats join the roster (after seat 104).
 *   2. RUNNERS — `1 0` joins the tail (jiti lane, then bare lane).
 *   3. EXPECTED — `19 5` appended (positional).
 *   4. the roster's birth marker comment.
 * Idempotent: re-running after the re-key reports and exits 0.
 */

import { readFileSync, writeFileSync } from "node:fs";

const CENSUS = "/home/z/my-project/scripts/t927-census.sh";
const src = readFileSync(CENSUS, "utf8");
let out = src;
const edits = [];

// 1. NAMES — the seats join after seat 104, before the closing paren.
if (!out.includes('"t1167-one-world-unit"')) {
  const anchor = '  "t1166-world-empty-lane-unit"\n)';
  if (!out.includes(anchor)) {
    console.error("rekey: the NAMES anchor (seat 104's entry) not found");
    process.exit(1);
  }
  out = out.replace(
    anchor,
    '  "t1166-world-empty-lane-unit"\n  "t1167-one-world-unit"\n  "t1130-env-world-unit"\n)',
  );
  edits.push("NAMES");
}

// 2. RUNNERS — `1 0` joins the tail (seat 105 rides jiti, seat 106 bare).
{
  const m = out.match(/declare -a RUNNERS=\(([^)]*)\)/);
  if (!m) {
    console.error("rekey: the RUNNERS array not found");
    process.exit(1);
  }
  const lanes = m[1].trim().split(/\s+/).filter(Boolean);
  if (lanes.length === 106) {
    if (lanes[104] !== "1" || lanes[105] !== "0") {
      console.error(`rekey: seats 105/106 lanes are ${lanes[104]}/${lanes[105]}, expected 1/0`);
      process.exit(1);
    }
    edits.push("RUNNERS (already)");
  } else if (lanes.length === 104) {
    out = out.replace(
      /declare -a RUNNERS=\(([^)]*)\)/,
      `declare -a RUNNERS=(${m[1].trim()} 1 0)`,
    );
    edits.push("RUNNERS");
  } else {
    console.error(
      `rekey: the RUNNERS array holds ${lanes.length} lanes, expected 104 (pre) or 106 (post)`,
    );
    process.exit(1);
  }
}

// 3. EXPECTED — `19 5` joins the tail (positional: seats 105/106).
{
  const m = out.match(/^EXPECTED=\(([^)]*)\)/m);
  if (!m) {
    console.error("rekey: the EXPECTED array not found");
    process.exit(1);
  }
  const pins = m[1].trim().split(/\s+/).filter(Boolean).map(Number);
  if (pins.length === 106) {
    if (pins[104] !== 19 || pins[105] !== 5) {
      console.error(`rekey: seats 105/106 expectations are ${pins[104]}/${pins[105]}, expected 19/5`);
      process.exit(1);
    }
    edits.push("EXPECTED (already)");
  } else if (pins.length === 104) {
    out = out.replace(
      /^(EXPECTED=\([^)]*?)\)/m,
      `$1 19 5)`,
    );
    edits.push("EXPECTED");
  } else {
    console.error(
      `rekey: the EXPECTED array holds ${pins.length} pins, expected 104 (pre) or 106 (post)`,
    );
    process.exit(1);
  }
}

// 4. the roster's comment line (the house style: the seat speaks its birth).
const marker = "# t1167 added the one-world unit, the 105th seat";
if (!out.includes(marker)) {
  const anchor = "declare -a NAMES=(";
  if (!out.includes(anchor)) {
    console.error("rekey: the NAMES declaration not found");
    process.exit(1);
  }
  out = out.replace(
    anchor,
    `${marker} (+ the t1130-env-world gate, the 106th, resurrected from orphanhood) — the two-db trap's root closed: the app client pins its own landing (datasourceUrl = CRYOFLOW_DB_URL || file:db/cryoflow.db, the ONE path from db-world.ts) so no env, no launch method, no regenerated .env can split the app from the world the instruments ride; the crown pin replays the trap (DATABASE_URL at the template) and the client still counts the living world; dev-server.sh reborn (the export post back at L82, the line the warn's sentence quotes); the watchman restored, watching the RESOLVED world; the t1130 gate joins the census as the .env contract's flap-alarm (a flap is the re-heal reminder, the app immune either way)\n${anchor}`,
  );
  edits.push("comment");
}

if (out === src) {
  console.log("rekey: nothing to do — the census already carries seats 105/106");
  process.exit(0);
}
writeFileSync(CENSUS, out);
console.log(`rekey: seats 105/106 enrolled (${edits.join(", ")}) — t927-census.sh now holds 106 seats`);

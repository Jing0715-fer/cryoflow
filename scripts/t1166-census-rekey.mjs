#!/usr/bin/env node
/**
 * t1166 — the census seat re-key (the text-surgery law: a formal
 * script, never an inline regex injection). Seat 104
 * (t1166-world-empty-lane-unit) joins at 26 pins on the green path
 * (27 ok() calls in source — B6/B6b both count; the chain helper is
 * shared). The empty-lane vein's instrument law: the sandbox recycle
 * of 2026-11-03 handed the windows a db at ZERO BYTES — zero TABLES,
 * not zero rows — and every live-reading face of world-snapshot.mjs
 * (the probe's ONE aggregate, the doctor's nine-model dump, the
 * restore's own wipe) crashed with an unhandled P2021 instead of
 * speaking. The cure: P2021 speaks EMPTY-LIVE (exit 0, the why rides
 * the payload — the snapshot is the cure), any OTHER db error speaks
 * MUTE-LIVE (the ladder's SEVENTH word, red:true exit 1 — a blind
 * guard is a doorbell, the why dug out of Prisma's boilerplate by
 * whyOf), the wipe tolerates the bare lane, and the words birthplace
 * grows to seven (the dialog's red clause catches the blind guard by
 * its flag). Three edits, each a counted anchor:
 *   1. NAMES  — the seat's file joins the roster (after seat 103).
 *   2. RUNNERS — `1` (unit-runner: the @/lib import rides jiti).
 *   3. EXPECTED — `26` appended (positional).
 * Idempotent: re-running after the re-key reports and exits 0.
 */

import { readFileSync, writeFileSync } from "node:fs";

const CENSUS = "/home/z/my-project/scripts/t927-census.sh";
const src = readFileSync(CENSUS, "utf8");
let out = src;
const edits = [];

// 1. NAMES — the seat joins after seat 103, before the closing paren.
if (!out.includes('"t1166-world-empty-lane-unit"')) {
  const anchor = '  "t1165-world-durability-unit"\n)';
  if (!out.includes(anchor)) {
    console.error("rekey: the NAMES anchor (seat 103's entry) not found");
    process.exit(1);
  }
  out = out.replace(
    anchor,
    '  "t1165-world-durability-unit"\n  "t1166-world-empty-lane-unit"\n)',
  );
  edits.push("NAMES");
}

// 2. RUNNERS — a `1` joins the tail (unit-runner lane, jiti imports).
{
  const m = out.match(/declare -a RUNNERS=\(([^)]*)\)/);
  if (!m) {
    console.error("rekey: the RUNNERS array not found");
    process.exit(1);
  }
  const lanes = m[1].trim().split(/\s+/).filter(Boolean);
  if (lanes.length === 104) {
    if (lanes[103] !== "1") {
      console.error(`rekey: seat 104's lane is ${lanes[103]}, expected 1`);
      process.exit(1);
    }
    edits.push("RUNNERS (already)");
  } else if (lanes.length === 103) {
    out = out.replace(
      /declare -a RUNNERS=\(([^)]*)\)/,
      `declare -a RUNNERS=(${m[1].trim()} 1)`,
    );
    edits.push("RUNNERS");
  } else {
    console.error(
      `rekey: the RUNNERS array holds ${lanes.length} lanes, expected 103 (pre) or 104 (post)`,
    );
    process.exit(1);
  }
}

// 3. EXPECTED — `26` joins the tail (positional: seat 104).
{
  const m = out.match(/^EXPECTED=\(([^)]*)\)/m);
  if (!m) {
    console.error("rekey: the EXPECTED array not found");
    process.exit(1);
  }
  const pins = m[1].trim().split(/\s+/).filter(Boolean).map(Number);
  if (pins.length === 104) {
    if (pins[103] !== 26) {
      console.error(`rekey: seat 104's expectation is ${pins[103]}, expected 26`);
      process.exit(1);
    }
    edits.push("EXPECTED (already)");
  } else if (pins.length === 103) {
    out = out.replace(
      /^(EXPECTED=\([^)]*?)\)/m,
      `$1 26)`,
    );
    edits.push("EXPECTED");
  } else {
    console.error(
      `rekey: the EXPECTED array holds ${pins.length} pins, expected 103 (pre) or 104 (post)`,
    );
    process.exit(1);
  }
}

// 4. the roster's comment line (the house style: the seat speaks its birth).
const marker = "# t1166 added the world-empty-lane unit, the 104th seat";
if (!out.includes(marker)) {
  const anchor = "declare -a NAMES=(";
  if (!out.includes(anchor)) {
    console.error("rekey: the NAMES declaration not found");
    process.exit(1);
  }
  out = out.replace(
    anchor,
    `${marker} — the sandbox recycle's 0-byte db taught the instruments to SPEAK the lane's silence: P2021 (no tables) is EMPTY-LIVE, exit 0, the why rides the payload (the snapshot is the cure); any other db silence is MUTE-LIVE, the ladder's SEVENTH word, red:true exit 1 (a blind guard is a doorbell, the why dug out of Prisma's boilerplate by whyOf); the restore's wipe tolerates the bare lane; the words birthplace grows to seven (world-durability-words.ts) and the dialog's red clause catches the blind guard by its flag\n${anchor}`,
  );
  edits.push("comment");
}

if (out === src) {
  console.log("rekey: nothing to do — the census already carries seat 104");
  process.exit(0);
}
writeFileSync(CENSUS, out);
console.log(`rekey: seat 104 enrolled (${edits.join(", ")}) — t927-census.sh now holds 104 seats`);

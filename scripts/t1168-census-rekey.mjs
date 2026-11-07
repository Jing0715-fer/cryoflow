#!/usr/bin/env node
/**
 * t1168 — the census seat re-key (the text-surgery law: a formal
 * script, never an inline regex injection). ONE seat joins this window:
 *
 *   Seat 107 — t1168-fs-text-unit: 35 pins on the green path (35 ok()
 *   calls; all unconditional). Lane 1 (unit-runner: the @/lib import
 *   rides jiti; fs-text.ts itself is .ts). The bounded-read law: a head
 *   read gets bytes not files (readTextHead sizes the buffer
 *   min(size, maxBytes) BEFORE the first read), a row count streams
 *   chunks (countRowsContaining, the boundary-straddling carry, the
 *   absorbed mega-line), the dispatch gate's classification became a
 *   HEAD LADDER that escalates on an undecided DIALECT (the parity law:
 *   the bounded read answers exactly what the whole read answered, or
 *   it has not answered yet), and the routes name the well instead of
 *   whole-reading (particles' 4 KB probe, sbatch's streamed .mrc count,
 *   ai-verdict's dead db import gone).
 *
 * Four edits, each a counted anchor:
 *   1. NAMES  — the seat joins the roster (after seat 106).
 *   2. RUNNERS — `1` joins the tail (jiti lane).
 *   3. EXPECTED — `35` appended (positional).
 *   4. the roster's birth marker comment.
 * Idempotent: re-running after the re-key reports and exits 0.
 */

import { readFileSync, writeFileSync } from "node:fs";

const CENSUS = "/home/z/my-project/scripts/t927-census.sh";
const src = readFileSync(CENSUS, "utf8");
let out = src;
const edits = [];

// 1. NAMES — the seat joins after seat 106, before the closing paren.
if (!out.includes('"t1168-fs-text-unit"')) {
  const anchor = '  "t1130-env-world-unit"\n)';
  if (!out.includes(anchor)) {
    console.error("rekey: the NAMES anchor (seat 106's entry) not found");
    process.exit(1);
  }
  out = out.replace(
    anchor,
    '  "t1130-env-world-unit"\n  "t1168-fs-text-unit"\n)',
  );
  edits.push("NAMES");
}

// 2. RUNNERS — `1` joins the tail (seat 107 rides jiti).
{
  const m = out.match(/declare -a RUNNERS=\(([^)]*)\)/);
  if (!m) {
    console.error("rekey: the RUNNERS array not found");
    process.exit(1);
  }
  const lanes = m[1].trim().split(/\s+/).filter(Boolean);
  if (lanes.length === 107) {
    if (lanes[106] !== "1") {
      console.error(`rekey: seat 107's lane is ${lanes[106]}, expected 1`);
      process.exit(1);
    }
    edits.push("RUNNERS (already)");
  } else if (lanes.length === 106) {
    out = out.replace(
      /declare -a RUNNERS=\(([^)]*)\)/,
      `declare -a RUNNERS=(${m[1].trim()} 1)`,
    );
    edits.push("RUNNERS");
  } else {
    console.error(
      `rekey: the RUNNERS array holds ${lanes.length} lanes, expected 106 (pre) or 107 (post)`,
    );
    process.exit(1);
  }
}

// 3. EXPECTED — `35` joins the tail (positional: seat 107).
{
  const m = out.match(/^EXPECTED=\(([^)]*)\)/m);
  if (!m) {
    console.error("rekey: the EXPECTED array not found");
    process.exit(1);
  }
  const pins = m[1].trim().split(/\s+/).filter(Boolean).map(Number);
  if (pins.length === 107) {
    if (pins[106] !== 35) {
      console.error(`rekey: seat 107's expectation is ${pins[106]}, expected 35`);
      process.exit(1);
    }
    edits.push("EXPECTED (already)");
  } else if (pins.length === 106) {
    out = out.replace(
      /^(EXPECTED=\([^)]*?)\)/m,
      `$1 35)`,
    );
    edits.push("EXPECTED");
  } else {
    console.error(
      `rekey: the EXPECTED array holds ${pins.length} pins, expected 106 (pre) or 107 (post)`,
    );
    process.exit(1);
  }
}

// 4. the roster's comment line (the house style: the seat speaks its birth).
const marker = "# t1168 added the fs-text unit, the 107th seat";
if (!out.includes(marker)) {
  const anchor = "declare -a NAMES=(";
  if (!out.includes(anchor)) {
    console.error("rekey: the NAMES declaration not found");
    process.exit(1);
  }
  out = out.replace(
    anchor,
    `${marker} — the bounded-read law: a head read gets bytes not files (readTextHead, the buffer sized min(size, maxBytes) before the first read), a row count streams chunks (countRowsContaining, the boundary carry, the absorbed mega-line), the dispatch gate's classification became a HEAD LADDER escalating on an undecided dialect (parity: the bounded read answers what the whole read answered, or has not answered yet); the sweep's three whole-file readers cured (particles' 4 KB probe, sbatch's streamed .mrc count, star-shape's ladder) + ai-verdict's dead db import gone\n${anchor}`,
  );
  edits.push("comment");
}

if (out === src) {
  console.log("rekey: nothing to do — the census already carries seat 107");
  process.exit(0);
}
writeFileSync(CENSUS, out);
console.log(`rekey: seat 107 enrolled (${edits.join(", ")}) — t927-census.sh now holds 107 seats`);

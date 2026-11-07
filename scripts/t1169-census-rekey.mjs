#!/usr/bin/env node
/**
 * t1169 — the census seat re-key (the text-surgery law: a formal
 * script, never an inline regex injection). ONE seat joins this window:
 *
 *   Seat 108 — t1169-pathref-hatch-unit: 19 pins on the green path
 *   (19 ok() calls; all unconditional). Lane 1 (unit-runner: the
 *   @/lib import rides jiti; pathref.ts itself is .ts). The escape
 *   hatch's ONE gate: pathrefHatchApplies(rel, name) — the t903
 *   canonical marker shape moved to the birthplace and ALL FOUR hatch
 *   carriers (outputs/file · outputs/subvolume-job · outputs/subvolume ·
 *   map-profile) rewired onto it; the sweep's catch — subvolume and
 *   map-profile still gated on the bare suffix (a planted non-hidden
 *   anything/evil.pathref opened the hatch to any absolute path its
 *   content named) — cured; the api-tree walk pin keeps future drift
 *   from forking.
 *
 * Four edits, each a counted anchor:
 *   1. NAMES  — the seat joins the roster (after seat 107).
 *   2. RUNNERS — `1` joins the tail (jiti lane).
 *   3. EXPECTED — `19` appended (positional).
 *   4. the roster's birth marker comment.
 * Idempotent: re-running after the re-key reports and exits 0.
 */

import { readFileSync, writeFileSync } from "node:fs";

const CENSUS = "/home/z/my-project/scripts/t927-census.sh";
const src = readFileSync(CENSUS, "utf8");
let out = src;
const edits = [];

// 1. NAMES — the seat joins after seat 107, before the closing paren.
if (!out.includes('"t1169-pathref-hatch-unit"')) {
  const anchor = '  "t1168-fs-text-unit"\n)';
  if (!out.includes(anchor)) {
    console.error("rekey: the NAMES anchor (seat 107's entry) not found");
    process.exit(1);
  }
  out = out.replace(
    anchor,
    '  "t1168-fs-text-unit"\n  "t1169-pathref-hatch-unit"\n)',
  );
  edits.push("NAMES");
}

// 2. RUNNERS — `1` joins the tail (seat 108 rides jiti).
{
  const m = out.match(/declare -a RUNNERS=\(([^)]*)\)/);
  if (!m) {
    console.error("rekey: the RUNNERS array not found");
    process.exit(1);
  }
  const lanes = m[1].trim().split(/\s+/).filter(Boolean);
  if (lanes.length === 108) {
    if (lanes[107] !== "1") {
      console.error(`rekey: seat 108's lane is ${lanes[107]}, expected 1`);
      process.exit(1);
    }
    edits.push("RUNNERS (already)");
  } else if (lanes.length === 107) {
    out = out.replace(
      /declare -a RUNNERS=\(([^)]*)\)/,
      `declare -a RUNNERS=(${m[1].trim()} 1)`,
    );
    edits.push("RUNNERS");
  } else {
    console.error(
      `rekey: the RUNNERS array holds ${lanes.length} lanes, expected 107 (pre) or 108 (post)`,
    );
    process.exit(1);
  }
}

// 3. EXPECTED — `19` joins the tail (positional: seat 108).
{
  const m = out.match(/^EXPECTED=\(([^)]*)\)/m);
  if (!m) {
    console.error("rekey: the EXPECTED array not found");
    process.exit(1);
  }
  const pins = m[1].trim().split(/\s+/).filter(Boolean).map(Number);
  if (pins.length === 108) {
    if (pins[107] !== 19) {
      console.error(`rekey: seat 108's expectation is ${pins[107]}, expected 19`);
      process.exit(1);
    }
    edits.push("EXPECTED (already)");
  } else if (pins.length === 107) {
    out = out.replace(
      /^(EXPECTED=\([^)]*?)\)/m,
      `$1 19)`,
    );
    edits.push("EXPECTED");
  } else {
    console.error(
      `rekey: the EXPECTED array holds ${pins.length} pins, expected 107 (pre) or 108 (post)`,
    );
    process.exit(1);
  }
}

// 4. the roster's comment line (the house style: the seat speaks its birth).
const marker = "# t1169 added the pathref-hatch unit, the 108th seat";
if (!out.includes(marker)) {
  const anchor = "declare -a NAMES=(";
  if (!out.includes(anchor)) {
    console.error("rekey: the NAMES declaration not found");
    process.exit(1);
  }
  out = out.replace(
    anchor,
    `${marker} — the escape hatch's ONE gate completed: pathrefHatchApplies(rel, name) at the birthplace (pathref.ts) and all four hatch carriers (outputs/file · subvolume-job · subvolume · map-profile) rewired onto it — the oldest-routes sweep's second-tier catch: subvolume and map-profile still gated the hatch on the bare .pathref suffix (a planted non-hidden anything/evil.pathref opened the hatch to any absolute path its content named; map-profile's 'defensive — the header check will refuse' comment was wrong for MRC-named targets); the api-tree walk pin keeps future drift from forking\n${anchor}`,
  );
  edits.push("comment");
}

if (out === src) {
  console.log("rekey: nothing to do — the census already carries seat 108");
  process.exit(0);
}
writeFileSync(CENSUS, out);
console.log(`rekey: seat 108 enrolled (${edits.join(", ")}) — t927-census.sh now holds 108 seats`);

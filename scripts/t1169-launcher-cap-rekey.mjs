#!/usr/bin/env node
/**
 * t1169 — the census seat re-key (the text-surgery law: a formal
 * script, never an inline regex injection). ONE seat joins this window:
 *
 *   Seat 109 — t1169-launcher-cap-unit: 8 pins on the green path (8 ok()
 *   calls; all unconditional). Lane 0 (bare node: node:fs + node:path
 *   only — no @/lib import). The heap cap's restitution law: the reborn
 *   launcher (dev-server.sh) carries NODE_OPTIONS=--max-old-space-size
 *   (DEV_HEAP_MB, 896 default) AFTER the quoted L82 export post and
 *   BEFORE the exec — the OOM strike this window witnessed (the uncapped
 *   server ballooned to 2.8 GB anon, the kernel's global OOM killed it
 *   mid-census, the fuel family's live legs died) is pinned as bytes so
 *   the next rebirth cannot lose the cap again.
 *
 * Four edits, each a counted anchor:
 *   1. NAMES  — the seat joins the roster (after seat 108).
 *   2. RUNNERS — `0` joins the tail (bare lane).
 *   3. EXPECTED — `8` appended (positional).
 *   4. the roster's birth marker comment.
 * Idempotent: re-running after the re-key reports and exits 0.
 */

import { readFileSync, writeFileSync } from "node:fs";

const CENSUS = "/home/z/my-project/scripts/t927-census.sh";
const src = readFileSync(CENSUS, "utf8");
let out = src;
const edits = [];

// 1. NAMES — the seat joins after seat 108, before the closing paren.
if (!out.includes('"t1169-launcher-cap-unit"')) {
  const anchor = '  "t1169-pathref-hatch-unit"\n)';
  if (!out.includes(anchor)) {
    console.error("rekey: the NAMES anchor (seat 108's entry) not found");
    process.exit(1);
  }
  out = out.replace(
    anchor,
    '  "t1169-pathref-hatch-unit"\n  "t1169-launcher-cap-unit"\n)',
  );
  edits.push("NAMES");
}

// 2. RUNNERS — `0` joins the tail (seat 109 rides bare node).
{
  const m = out.match(/declare -a RUNNERS=\(([^)]*)\)/);
  if (!m) {
    console.error("rekey: the RUNNERS array not found");
    process.exit(1);
  }
  const lanes = m[1].trim().split(/\s+/).filter(Boolean);
  if (lanes.length === 109) {
    if (lanes[108] !== "0") {
      console.error(`rekey: seat 109's lane is ${lanes[108]}, expected 0`);
      process.exit(1);
    }
    edits.push("RUNNERS (already)");
  } else if (lanes.length === 108) {
    out = out.replace(
      /declare -a RUNNERS=\(([^)]*)\)/,
      `declare -a RUNNERS=(${m[1].trim()} 0)`,
    );
    edits.push("RUNNERS");
  } else {
    console.error(
      `rekey: the RUNNERS array holds ${lanes.length} lanes, expected 108 (pre) or 109 (post)`,
    );
    process.exit(1);
  }
}

// 3. EXPECTED — `8` joins the tail (positional: seat 109).
{
  const m = out.match(/^EXPECTED=\(([^)]*)\)/m);
  if (!m) {
    console.error("rekey: the EXPECTED array not found");
    process.exit(1);
  }
  const pins = m[1].trim().split(/\s+/).filter(Boolean).map(Number);
  if (pins.length === 109) {
    if (pins[108] !== 8) {
      console.error(`rekey: seat 109's expectation is ${pins[108]}, expected 8`);
      process.exit(1);
    }
    edits.push("EXPECTED (already)");
  } else if (pins.length === 108) {
    out = out.replace(
      /^(EXPECTED=\([^)]*?)\)/m,
      `$1 8)`,
    );
    edits.push("EXPECTED");
  } else {
    console.error(
      `rekey: the EXPECTED array holds ${pins.length} pins, expected 108 (pre) or 109 (post)`,
    );
    process.exit(1);
  }
}

// 4. the roster's comment line (the house style: the seat speaks its birth).
const marker = "# t1169 added the launcher-cap unit, the 109th seat";
if (!out.includes(marker)) {
  const anchor = "declare -a NAMES=(";
  if (!out.includes(anchor)) {
    console.error("rekey: the NAMES declaration not found");
    process.exit(1);
  }
  out = out.replace(
    anchor,
    `${marker} (+ seat 108, the pathref-hatch ONE-gate completion, this window) — the heap cap's restitution law: the reborn launcher carries NODE_OPTIONS=--max-old-space-size (DEV_HEAP_MB, 896 default) after the quoted L82 export post and before the exec; the OOM strike this window witnessed (the uncapped server ballooned to 2.8 GB anon, the kernel's global OOM killed it mid-census, the fuel family's live legs died with it) is pinned as bytes so the next rebirth cannot lose the cap again\n${anchor}`,
  );
  edits.push("comment");
}

if (out === src) {
  console.log("rekey: nothing to do — the census already carries seat 109");
  process.exit(0);
}
writeFileSync(CENSUS, out);
console.log(`rekey: seat 109 enrolled (${edits.join(", ")}) — t927-census.sh now holds 109 seats`);

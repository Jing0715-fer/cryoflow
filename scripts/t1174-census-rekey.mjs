#!/usr/bin/env node
/**
 * t1174 — the census seat re-key (the text-surgery law: a formal
 * script, never an inline regex injection). ONE seat joins this window:
 *
 *   Seat 118 — t1174-subvolume-catalog-unit: 25 pins on the green path
 *   (25 ok() calls; all unconditional). Lane 1 (unit-runner: the
 *   @/lib/subvolume-catalog import rides jiti). The crop shelf's laws:
 *   the pure re-anchor math (identity, plain, crop-of-crop — the
 *   grandparent space cancels; the stale world's honest null; NO clamped
 *   guessing), the shelf's order (newest first, the 24 cap, input
 *   untouched, stable ties), and the source law (the route's
 *   door+containment+hatch family ring, header-evidenced rows — a
 *   refusing header is NO row, the empty-shelf-is-not-an-error, the
 *   parent's own start fields riding along, the viewer's t260 anchor
 *   path and the fraction-download round-trip, the send-success
 *   refresh, the lib's purity, the family's testid addresses).
 *
 * Four edits, each a counted anchor:
 *   1. NAMES  — the seat joins the roster (after seat 117).
 *   2. RUNNERS — `1` joins the tail (jiti lane).
 *   3. EXPECTED — `25` appended (positional).
 *   4. the roster's birth marker comment.
 * Idempotent: re-running after the re-key reports and exits 0.
 */

import { readFileSync, writeFileSync } from "node:fs";

const CENSUS = "/home/z/my-project/scripts/t927-census.sh";
const src = readFileSync(CENSUS, "utf8");
let out = src;
const edits = [];

// 1. NAMES — the seat joins after seat 117, before the closing paren.
if (!out.includes('"t1174-subvolume-catalog-unit"')) {
  const anchor = '  "t888-write-bound-unit"\n)';
  if (!out.includes(anchor)) {
    console.error("rekey: the NAMES anchor (seat 117's entry) not found");
    process.exit(1);
  }
  out = out.replace(
    anchor,
    '  "t879-pressure-words-unit"\n  "t1174-subvolume-catalog-unit"\n)',
  );
  edits.push("NAMES");
}

// 2. RUNNERS — `1` joins the tail (seat 118 rides jiti).
{
  const m = out.match(/declare -a RUNNERS=\(([^)]*)\)/);
  if (!m) {
    console.error("rekey: the RUNNERS array not found");
    process.exit(1);
  }
  const lanes = m[1].trim().split(/\s+/).filter(Boolean);
  if (lanes.length === 118) {
    if (lanes[117] !== "1") {
      console.error(`rekey: seat 118's lane is ${lanes[117]}, expected 1`);
      process.exit(1);
    }
    edits.push("RUNNERS (already)");
  } else if (lanes.length === 117) {
    out = out.replace(
      /declare -a RUNNERS=\(([^)]*)\)/,
      `declare -a RUNNERS=(${m[1].trim()} 1)`,
    );
    edits.push("RUNNERS");
  } else {
    console.error(
      `rekey: the RUNNERS array holds ${lanes.length} lanes, expected 117 (pre) or 118 (post)`,
    );
    process.exit(1);
  }
}

// 3. EXPECTED — `25` joins the tail (positional: seat 118).
{
  const m = out.match(/^EXPECTED=\(([^)]*)\)/m);
  if (!m) {
    console.error("rekey: the EXPECTED array not found");
    process.exit(1);
  }
  const pins = m[1].trim().split(/\s+/).filter(Boolean).map(Number);
  if (pins.length === 118) {
    if (pins[117] !== 25) {
      console.error(`rekey: seat 118's expectation is ${pins[117]}, expected 25`);
      process.exit(1);
    }
    edits.push("EXPECTED (already)");
  } else if (pins.length === 117) {
    out = out.replace(
      /^(EXPECTED=\([^)]*?)\)/m,
      `$1 25)`,
    );
    edits.push("EXPECTED");
  } else {
    console.error(
      `rekey: the EXPECTED array holds ${pins.length} pins, expected 117 (pre) or 118 (post)`,
    );
    process.exit(1);
  }
}

// 4. the roster's comment line (the house style: the seat speaks its birth).
const marker = "# t1174 added the subvolume-catalog unit, the 118th seat";
if (!out.includes(marker)) {
  const anchor = "declare -a NAMES=(";
  if (!out.includes(anchor)) {
    console.error("rekey: the NAMES declaration not found");
    process.exit(1);
  }
  out = out.replace(
    anchor,
    "# t1174 added the subvolume-catalog unit, the 118th seat — the crop shelf's laws made pins: the pure re-anchor math answers from each crop's OWN header (start − parent.start over the parent's dims — the grandparent space cancels; a box that pokes outside is REFUSED, never squeezed; a stale crop of a different map is honest null), the shelf's order (newest first, the 24 cap — a shelf, not an archive; the input untouched; ties stable), and the source law (the route's door+containment+hatch ring, header-evidenced rows — a refusing header is no row, the empty shelf is not an error, the parent's own start fields ride along, the viewer anchors through the t260 applyClipBoxIntent law, the download round-trips the header's geometry, the send-success refresh, the lib's purity — no fs, no db, no clock)\ndeclare -a NAMES=(",
  );
  edits.push("MARKER");
}

if (edits.length === 0) {
  console.log("rekey: nothing to do — the census already carries seat 118");
  process.exit(0);
}

writeFileSync(CENSUS, out);
console.log(`rekey: ${edits.join(", ")} — seat 118 joined (t1174-subvolume-catalog-unit, 25 pins, lane 1)`);

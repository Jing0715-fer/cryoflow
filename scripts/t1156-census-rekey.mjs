#!/usr/bin/env node
/**
 * t1156 — the census seat re-key (the text-surgery law: a formal
 * script, never an inline regex injection). Seat 95
 * (t1156-pixel-word-unit) joins at 17 pins: the pixel father is the
 * sampling rate's ONLY rounding birth — the NEW map's fifth vein
 * (t1155's NEXT-VEIN candidate walked home). The shape-hunt found the
 * Å/voxel word's four faces wearing three precisions and no father:
 * the map cards rounded locally (toFixed(2)), the particle browser
 * and the import gallery spoke the RAW STAR float ("1.23666667 Å/px"
 * beside the report's "1.24 Å / voxel" for the SAME map), and the
 * postprocess verdict interpolated `undefined` outright when its
 * angpix was null. The unit WORDS are a DOCUMENTED FAMILY (Å/px
 * diagnostics, Å / voxel map cards, Å editor cup + engine log); the
 * DIGITS have one birthplace. Three edits, each a counted anchor:
 *   1. NAMES  — the seat's file joins the roster (after seat 94).
 *   2. RUNNERS — `1` (unit-runner: the father's import, the t1155
 *      family's lane) + the seat-95 comment prepended.
 *   3. EXPECTED — `17` appended (positional) + the seat-95 reason
 *      prepended to the tail comment.
 * Idempotent: re-running after the re-key reports and exits 0.
 */
import { readFileSync, writeFileSync } from "node:fs";

const P = "/home/z/my-project/scripts/t927-census.sh";
const src = readFileSync(P, "utf8");

const SEAT_COMMENT_RUNNERS =
  "+seat 95: t1156 rides unit-runner (the pixel father's import, the t1155 family's lane) · ";
const SEAT_COMMENT_EXPECTED =
  "+seat 95 = t1156-pixel-word-unit (17 pins; the pixel father is the sampling rate's ONLY rounding birth — the NEW map's fifth vein (t1155's NEXT-VEIN candidate walked home): the shape-hunt found the Å/voxel word's four faces wearing three precisions and no father (the map cards rounded locally toFixed(2); the particle browser and the import gallery spoke the RAW STAR float — '1.23666667 Å/px' beside the report's '1.24 Å / voxel' for the SAME map; the postprocess verdict interpolated 'undefined' outright when its angpix was null — 'at undefined Å/px'); the unit WORDS are a DOCUMENTED FAMILY kept as boundaries (Å/px on the diagnostics and receipts, Å / voxel on the map cards, Å on the editor's param cup and the engine's map-import log — RELION's own convention); the DIGITS have one birthplace at 2 decimals (the editor's step: 0.01 is the identity's native grain); A the father runs FOR REAL (the 2-decimal grain on the MRC header's division, the identity values, the trailing-zero face, the junk face '?', the half-up edge on an exactly-representable value, the determinism); B the source law (the map cards ride the father, the raw STAR floats dead, the gallery's unit split healed, the verdict's undefined sentence dead, the remote-run 4-decimal diagnostic face kept BY CONTRACT with its boundary comment, the editor cup and the engine log untouched, the father pure); C the doctrine (the census paragraph at the father, the precision-vs-unit judgment — family not drift, the 4-decimal boundary drawn at BOTH ends)) · ";

if (src.includes('"t1156-pixel-word-unit"') && src.includes("27 28 27 17)")) {
  console.log("already re-keyed — idempotent exit 0");
  process.exit(0);
}

if (src.includes('"t1156-pixel-word-unit"')) {
  console.error("PARTIAL STATE: seat name present but EXPECTED tail wrong — inspect by hand");
  process.exit(1);
}

// 1 — NAMES.
const NAMES_OLD = '  "t1155-angstrom-word-unit"\n)';
const NAMES_NEW = '  "t1155-angstrom-word-unit"\n  "t1156-pixel-word-unit"\n)';
if (!src.includes(NAMES_OLD)) {
  console.error("NAMES anchor not found — the roster moved, re-key by hand");
  process.exit(1);
}
let next = src.replace(NAMES_OLD, NAMES_NEW);

// 2 — RUNNERS: append ` 1` and prepend the seat comment.
const RUNNERS_OLD = "1 1 1 1 1 1 1 1 1) #   +seat 94:";
const RUNNERS_NEW = `1 1 1 1 1 1 1 1 1 1) #   ${SEAT_COMMENT_RUNNERS}+seat 94:`;
if (!next.includes(RUNNERS_OLD)) {
  console.error("RUNNERS anchor not found — re-key by hand");
  process.exit(1);
}
next = next.replace(RUNNERS_OLD, RUNNERS_NEW);

// 3 — EXPECTED: append ` 17` and prepend the seat reason to the tail comment.
const EXPECTED_OLD = "29 29 27 30 27 28 27) #   +seat 94 =";
const EXPECTED_NEW = `29 29 27 30 27 28 27 17) #   ${SEAT_COMMENT_EXPECTED}+seat 94 =`;
if (!next.includes(EXPECTED_OLD)) {
  console.error("EXPECTED anchor not found — re-key by hand");
  process.exit(1);
}
next = next.replace(EXPECTED_OLD, EXPECTED_NEW);

writeFileSync(P, next);
console.log("re-keyed: NAMES +1 (95), RUNNERS +1 (unit-runner), EXPECTED +1 (17) — re-run to verify");

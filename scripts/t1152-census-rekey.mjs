#!/usr/bin/env node
/**
 * t1152 — the census seat re-key (the text-surgery law: a formal
 * script, never an inline regex injection). Seat 91
 * (t1152-byte-word-unit) joins at 27 pins: the byte word's ONE
 * birthplace — the NEW map's first vein (the server-face × tool-roster
 * map spent this window: the activity feed, fs/browse, the
 * workflow-import door and the cleanup family's second face all buried
 * with evidence at the source). The byte word had SIX births and FOUR
 * dialects; every twin died the same day. Three edits, each a counted
 * anchor:
 *   1. NAMES  — the seat's file joins the roster (after seat 90).
 *   2. RUNNERS — `1` (unit-runner: the father import, the
 *      t1148/t1149/t1150 family's lane) + the seat-91 comment prepended.
 *   3. EXPECTED — `27` appended (the array is positional; seat 91 is
 *      the LAST) + the seat-91 reason prepended to the tail comment.
 * Idempotent: re-running after the re-key reports and exits 0.
 */
import { readFileSync, writeFileSync } from "node:fs";

const P = "/home/z/my-project/scripts/t927-census.sh";
const src = readFileSync(P, "utf8");

const SEAT_COMMENT_RUNNERS =
  "+seat 91: t1152 rides unit-runner (the father import, the t1148/t1149/t1150 family's lane) · ";
const SEAT_COMMENT_EXPECTED =
  "+seat 91 = t1152-byte-word-unit (27 pins; the byte word's ONE birthplace — the NEW map's first vein (the server-face × tool-roster map SPENT this window: the activity feed, fs/browse, the workflow-import door and the cleanup family's second face all buried with evidence at the source), which UI FACES still re-derive what a father already knows: the byte word had SIX births and FOUR dialects — the father (disk-usage's fmtBytes, the t518 voice law) + byte-identical twins in cleanup-dialog and job-inspector, the canvas-export KB-0-decimals no-GB dialect ('2 KB', a 2.5 GB blob rendered '2560.0 MB'), the results-view KB-1-decimal no-GB dialect (the same blob the inspector called '1.50 GB' rendered '1536.0 MB'), the import-gallery unit-loop dialect with whole-number shortcuts ('10 KB' beside the father's '10.0 KB'), and the SEVENTH face (molstar-embed) drinking the canvas-export dialect through its import; A the father run FOR REAL (every band byte-pinned — 0 B / 500 B / 1023 B, 1.0 / 1.5 / 10.0 KB (the whole-number shortcut dead), 1.0 / 700.0 MB (the t458 pin holds), 1.00 / 1.50 / 2.50 GB, the determinism); B the source law (all SEVEN faces import the father, NO local definition survives anywhere, the canvas-export export is a DEATH CERTIFICATE dated t1152, the absence word ('—' for an UNKNOWN size ≤ 0 — not '0 B') is the gallery's own one-liner riding the father, the B/px measurement stays a different word, the census lives in the father's own header); C the doctrine (the one-formatter law verbatim — 'two byte formats on one screen is a lie about precision', the father CLIENT-SAFE by construction (no fs — six client faces import it), the engine's voice boundary (the ssh/engine/remote-run log prose keeps its own dialect), the drift words live in the census comment never in code)) · ";

if (src.includes('"t1152-byte-word-unit"') && src.includes("29 29 27 27)")) {
  console.log("already re-keyed — idempotent exit 0");
  process.exit(0);
}

if (src.includes('"t1152-byte-word-unit"')) {
  console.error("PARTIAL STATE: seat name present but EXPECTED tail wrong — inspect by hand");
  process.exit(1);
}

// 1 — NAMES.
const NAMES_OLD = '  "t1151-hpc-profile-tool-unit"\n)';
const NAMES_NEW = '  "t1151-hpc-profile-tool-unit"\n  "t1152-byte-word-unit"\n)';
if (!src.includes(NAMES_OLD)) {
  console.error("NAMES anchor not found — the roster moved, re-key by hand");
  process.exit(1);
}
let next = src.replace(NAMES_OLD, NAMES_NEW);

// 2 — RUNNERS: append ` 1` and prepend the seat comment.
const RUNNERS_OLD = "1 1 1 1 1) #   +seat 88:";
const RUNNERS_NEW = `1 1 1 1 1 1) #   ${SEAT_COMMENT_RUNNERS}+seat 88:`;
if (!next.includes(RUNNERS_OLD)) {
  console.error("RUNNERS anchor not found — re-key by hand");
  process.exit(1);
}
next = next.replace(RUNNERS_OLD, RUNNERS_NEW);

// 3 — EXPECTED: append ` 27` and prepend the seat reason.
const EXPECTED_OLD = "29 29 27) #   +seat 88";
const EXPECTED_NEW = `29 29 27 27) #   ${SEAT_COMMENT_EXPECTED}+seat 88`;
if (!next.includes(EXPECTED_OLD)) {
  console.error("EXPECTED anchor not found — re-key by hand");
  process.exit(1);
}
next = next.replace(EXPECTED_OLD, EXPECTED_NEW);

writeFileSync(P, next);
console.log("re-keyed: seat 91 t1152-byte-word-unit joins at 27 pins (NAMES + RUNNERS + EXPECTED)");

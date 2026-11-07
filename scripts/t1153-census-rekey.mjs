#!/usr/bin/env node
/**
 * t1153 — the census seat re-key (the text-surgery law: a formal
 * script, never an inline regex injection). Seat 92
 * (t1153-duration-word-unit) joins at 27 pins: the duration word's ONE
 * birthplace — the NEW map's second vein (which faces still re-derive
 * what a father already knows: the duration/clock/ago sweep). The QC
 * report's local fmtDur birth died (no day face — a 3-day run printed
 * "72h 5m" while the inspector said "3d 0h"); the slurm private hms
 * twin died; everything else outside the father is a documented
 * word-class boundary, enumerated in the father's own header. The same
 * sweep caught the byte word's EIGHTH birth under its own name — the
 * t1152 seat re-keys 27→30 in the same surgery. Four edits, each a
 * counted anchor:
 *   1. NAMES  — the seat's file joins the roster (after seat 91).
 *   2. RUNNERS — `1` (unit-runner: the duration father's import, the
 *      t1148 family's lane) + the seat-92 comment prepended.
 *   3. EXPECTED — seat 91's `27` → `30` (the eighth birth's three
 *      source pins B14-B16) and `27` appended for seat 92 (positional)
 *      + the seat-92 reason prepended to the tail comment.
 * Idempotent: re-running after the re-key reports and exits 0.
 */
import { readFileSync, writeFileSync } from "node:fs";

const P = "/home/z/my-project/scripts/t927-census.sh";
const src = readFileSync(P, "utf8");

const SEAT_COMMENT_RUNNERS =
  "+seat 92: t1153 rides unit-runner (the duration father's import, the t1148 family's lane) · ";
const SEAT_COMMENT_EXPECTED =
  "+seat 92 = t1153-duration-word-unit (27 pins; the duration word's ONE birthplace — the NEW map's second vein (which faces still re-derive what the lib/duration.ts father already knows: the duration/clock/ago sweep, the word-class boundary where t1152 found drift): the QC report's local fmtDur birth had NO day face (a 3-day run printed '72h 5m' in the report while the inspector said '3d 0h' for the same run) and died; slurm's private hms twin (byte-identical to the exported slurmHms) died — ONE birthplace even inside one file; A the father run FOR REAL (every band — 8s / 1m 0s / 2m 41s / 3h 12m, the 48h day edge (47h 59m stays hours, 48h becomes 2d 0h), 5d 4h, the round-before-banding edge (59.5s → 1m 0s), the junk face (NaN/0/negative/Infinity all '—'), the ago bands (just now inside a minute, then 2m 41s ago), the t714 dialect (an epoch-ms number and its ISO twin speak the same word), the clock's locale-coupled shape, slurm's own grammar (floor-1 law, padded [[DD-]HH:]MM:SS), the determinism); B the source law (the report's fmtDur rides the father — the local h/m arithmetic gone, results-view imports the father, the hms twin dead, the --time leg rides slurmHms, the census enumerates the documented dialects (the FACT face / the PREDICTION pair / the LEDGER face / the AXIS face / the GRAVE face / the SIM face / the freshness chip / SLURM's own grammar / the t123 oracle INSTRUMENT / the ENGINE's voice), elapsed.ts's fact face lives untouched, the oracle keeps its independent copy — it may NAME the father (Phase F) but never IMPORTS it); C the doctrine (the word-class boundary law verbatim — 'not drift but the word-class boundary', the shape-hunt law at the byte father (births hide under different names — hunt by the arithmetic, never only by the name), the father stays pure (fmtDuration has no clock — fmtAgo is the only clock reader)) · ";

if (src.includes('"t1153-duration-word-unit"') && src.includes("29 29 27 30 27)")) {
  console.log("already re-keyed — idempotent exit 0");
  process.exit(0);
}

if (src.includes('"t1153-duration-word-unit"')) {
  console.error("PARTIAL STATE: seat name present but EXPECTED tail wrong — inspect by hand");
  process.exit(1);
}

// 1 — NAMES.
const NAMES_OLD = '  "t1152-byte-word-unit"\n)';
const NAMES_NEW = '  "t1152-byte-word-unit"\n  "t1153-duration-word-unit"\n)';
if (!src.includes(NAMES_OLD)) {
  console.error("NAMES anchor not found — the roster moved, re-key by hand");
  process.exit(1);
}
let next = src.replace(NAMES_OLD, NAMES_NEW);

// 2 — RUNNERS: append ` 1` and prepend the seat comment.
const RUNNERS_OLD = "1 1 1 1 1 1) #   +seat 91:";
const RUNNERS_NEW = `1 1 1 1 1 1 1) #   ${SEAT_COMMENT_RUNNERS}+seat 91:`;
if (!next.includes(RUNNERS_OLD)) {
  console.error("RUNNERS anchor not found — re-key by hand");
  process.exit(1);
}
next = next.replace(RUNNERS_OLD, RUNNERS_NEW);

// 3 — EXPECTED: seat 91's 27 → 30, append ` 27` for seat 92, prepend the seat reason.
const EXPECTED_OLD = "29 29 27 27) #   +seat 91 = t1152-byte-word-unit (27 pins;";
const EXPECTED_NEW = `29 29 27 30 27) #   ${SEAT_COMMENT_EXPECTED}+seat 91 = t1152-byte-word-unit (30 pins (t1153 re-key 27→30: the EIGHTH birth's three source pins — B14 the staged face rides the father, B15 the shape-hunt law (comments stripped: the drift words live in the census comments), B16 the father's census carries the eighth birth);`;
if (!next.includes(EXPECTED_OLD)) {
  console.error("EXPECTED anchor not found — re-key by hand");
  process.exit(1);
}
next = next.replace(EXPECTED_OLD, EXPECTED_NEW);

writeFileSync(P, next);
console.log("re-keyed: seat 92 enrolled (27 pins), seat 91 re-keyed 27→30 — census expects 92");

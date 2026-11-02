#!/usr/bin/env node
/**
 * t1155 — the census seat re-key (the text-surgery law: a formal
 * script, never an inline regex injection). Seat 94
 * (t1155-angstrom-word-unit) joins at 27 pins: the Å / µm / B-factor
 * fathers are the ONLY rounding births — the NEW map's fourth vein
 * (the walk that followed t1154's boundary lines home). The drift the
 * Å father's own header predicted was found and cured: the SAME
 * quantities wore two grains across faces (the FSC 0.143 estimate
 * said "3.2 Å" in the agent's summary and "3.24 Å" in the QC report;
 * the judge prompt quoted the raw parseFloat float; the chart's
 * annotations said 2 decimals while the axis said 1; the B-factor
 * word existed three times by separate hands; the postprocess verdict
 * module ran its own local fmt). Three edits, each a counted anchor:
 *   1. NAMES  — the seat's file joins the roster (after seat 93).
 *   2. RUNNERS — `1` (unit-runner: the fathers' import, the
 *      t1148 family's lane) + the seat-94 comment prepended.
 *   3. EXPECTED — `27` appended (positional) + the seat-94 reason
 *      prepended to the tail comment.
 * Idempotent: re-running after the re-key reports and exits 0.
 */
import { readFileSync, writeFileSync } from "node:fs";

const P = "/home/z/my-project/scripts/t927-census.sh";
const src = readFileSync(P, "utf8");

const SEAT_COMMENT_RUNNERS =
  "+seat 94: t1155 rides unit-runner (the fathers' import, the t1148 family's lane) · ";
const SEAT_COMMENT_EXPECTED =
  "+seat 94 = t1155-angstrom-word-unit (27 pins; the Å/µm/B-factor fathers are the ONLY rounding births — the NEW map's fourth vein (the walk that followed t1154's boundary lines home): the drift the Å father's own header predicted was found and cured — the SAME quantities wore two grains across faces (the FSC 0.143 estimate said '3.2 Å' in the agent's summary and '3.24 Å' in the QC report's resolution lines; the class2d judge prompt and the class tool quoted the raw parseFloat float ('3.2145678 Å'); the resolution chart's annotations said 2 decimals while the same SVG's y axis said 1; the B-factor word existed three times by separate hands (the agent's Guinier line, the report's Guinier verdict, the sharpening weather report — agreeing by luck); the postprocess verdict module ran its own local fmt; the report's CTF line spoke 2-decimal µm against the agent's fmtUm 3-decimal); A the fathers run FOR REAL (the 1-decimal Å grain half-up, the trailing-zero face ('6 Å', never '6.0 Å'), the junk face ('?'), the µm father's 3-decimal, the B-factor father's Å² face, the determinism); B the source law (the agent's three raw births dead, the report's word faces ride the fathers, the annotations match the axis they sit on, the local fmt birth dead, the sharpening words ride fmtBFactor, the DATA faces keep their grain (the report's tables), the engine's before→after dialect untouched, the qc-board's documented docstring untouched, motion-compare's digits schema untouched, the live well generation-proof (t488's hardcoded projectId rotted it into a permanent skip)); C the doctrine (the census paragraph at the father, the rounding rule's law line, the boundary enumeration)) · ";

if (src.includes('"t1155-angstrom-word-unit"') && src.includes("27 30 27 28 27)")) {
  console.log("already re-keyed — idempotent exit 0");
  process.exit(0);
}

if (src.includes('"t1155-angstrom-word-unit"')) {
  console.error("PARTIAL STATE: seat name present but EXPECTED tail wrong — inspect by hand");
  process.exit(1);
}

// 1 — NAMES.
const NAMES_OLD = '  "t1154-progress-scale-unit"\n)';
const NAMES_NEW = '  "t1154-progress-scale-unit"\n  "t1155-angstrom-word-unit"\n)';
if (!src.includes(NAMES_OLD)) {
  console.error("NAMES anchor not found — the roster moved, re-key by hand");
  process.exit(1);
}
let next = src.replace(NAMES_OLD, NAMES_NEW);

// 2 — RUNNERS: append ` 1` and prepend the seat comment.
const RUNNERS_OLD = "1 1 1 1 1 1 1 1) #   +seat 93:";
const RUNNERS_NEW = `1 1 1 1 1 1 1 1 1) #   ${SEAT_COMMENT_RUNNERS}+seat 93:`;
if (!next.includes(RUNNERS_OLD)) {
  console.error("RUNNERS anchor not found — re-key by hand");
  process.exit(1);
}
next = next.replace(RUNNERS_OLD, RUNNERS_NEW);

// 3 — EXPECTED: append ` 27` and prepend the seat reason to the tail comment.
const EXPECTED_OLD = "29 29 27 30 27 28) #   +seat 93 =";
const EXPECTED_NEW = `29 29 27 30 27 28 27) #   ${SEAT_COMMENT_EXPECTED}+seat 93 =`;
if (!next.includes(EXPECTED_OLD)) {
  console.error("EXPECTED anchor not found — re-key by hand");
  process.exit(1);
}
next = next.replace(EXPECTED_OLD, EXPECTED_NEW);

writeFileSync(P, next);
console.log("re-keyed: NAMES +1 (94), RUNNERS +1 (unit-runner), EXPECTED +1 (27) — re-run to verify");

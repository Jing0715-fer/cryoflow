#!/usr/bin/env node
/**
 * t1164 — the census seat re-key (the text-surgery law: a formal
 * script, never an inline regex injection). Seat 102
 * (t1164-takehome-proof-unit) joins at 13 pins: the no-trace-neighbor
 * law made a PIN on the smoke sentinel. t1163's live catch — the
 * world-gate's first real-world refusal traced to qa63's take-home
 * failing SILENTLY once (a warned cleanup is a cleanup that did not
 * happen; 5 QA-family jobs stood; the next strict ride refused the
 * DRIFTED world the suite had made) — closed at the source: qa63's
 * take-home now returns its truth and the normal path ASSERTS zero
 * QA-family jobs in the dev lane before it may say SMOKE GREEN. A
 * the live face (the lane holds zero QA rows right now; the take-home
 * idempotent on a clean lane, a REAL run); B the source law (the bool
 * truth, the proof BEFORE the green word, the argv-direct spawnSync —
 * the shell eats $disconnect through quote-nesting, observed live —
 * the QA * naming contract, the dev-lane URL, the FATAL path's
 * take-home kept); C the tracked spine's immunity (all 15 tracked
 * jobs tutorial-named — the assertion and the spine coexist by
 * construction) and the header's contract.
 * Three edits, each a counted anchor:
 *   1. NAMES  — the seat's file joins the roster (after seat 101).
 *   2. RUNNERS — `0` (bare node: node: builtins only — no @/lib alias
 *      needed) + the seat-102 comment prepended.
 *   3. EXPECTED — `13` appended (positional) + the seat-102 reason
 *      prepended to the tail comment.
 * Idempotent: re-running after the re-key reports and exits 0.
 */
import { readFileSync, writeFileSync } from "node:fs";

const P = "/home/z/my-project/scripts/t927-census.sh";
const src = readFileSync(P, "utf8");

const SEAT_COMMENT_RUNNERS =
  "+seat 102: t1164 rides bare node (the unit imports node: builtins only — no @/lib alias needed) · ";
const SEAT_COMMENT_EXPECTED =
  "+seat 102 = t1164-takehome-proof-unit (13 pins; the no-trace-neighbor law made a PIN on the smoke sentinel — t1163's live catch traced the world-gate's first refusal to qa63's take-home failing SILENTLY once (a warned cleanup is a cleanup that did not happen; 5 QA-family jobs stood; the next strict ride refused the DRIFTED world the suite had made), closed at the source: qa63's take-home returns its truth and the normal path ASSERTS zero QA-family jobs in the dev lane before SMOKE GREEN — a green word now carries the no-trace proof; A the live face (the lane holds zero QA rows; the take-home idempotent on a clean lane, a REAL run); B the source law (the bool truth, the proof before the green word, the argv-direct spawnSync — the shell eats $disconnect through quote-nesting, observed live — the QA * naming contract, the dev-lane URL, the FATAL path's take-home kept); C the tracked spine's immunity (all 15 tracked jobs tutorial-named — the assertion and the spine coexist by construction) and the header's contract) · ";

if (
  src.includes('"t1164-takehome-proof-unit"') &&
  src.includes("27 17 13 23 12 16 25 14 13)")
) {
  console.log("t1164-census-rekey: seat 102 already enrolled — idempotent exit");
  process.exit(0);
}

let out = src;
let edits = 0;

// 1. NAMES — the seat joins the roster after seat 101.
const namesOld = '  "t1163-world-gate-unit"\n)';
const namesNew =
  '  "t1163-world-gate-unit"\n  "t1164-takehome-proof-unit"\n)';
if (!out.includes(namesOld)) {
  console.error("t1164-census-rekey: NAMES anchor not found");
  process.exit(1);
}
out = out.replace(namesOld, namesNew);
edits += 1;

// 2. RUNNERS — `0` appended (bare node) + the seat comment prepended.
const runnersOld = " 1 1 1 1 1 1 1 0 0 0 0) #   ";
const runnersNew = " 1 1 1 1 1 1 1 0 0 0 0 0) #   " + SEAT_COMMENT_RUNNERS;
if (!out.includes(runnersOld)) {
  console.error("t1164-census-rekey: RUNNERS anchor not found");
  process.exit(1);
}
out = out.replace(runnersOld, runnersNew);
edits += 1;

// 3. EXPECTED — `13` appended (positional) + the seat reason prepended.
const expectedOld = "27 17 13 23 12 16 25 14) #   ";
const expectedNew = "27 17 13 23 12 16 25 14 13) #   " + SEAT_COMMENT_EXPECTED;
if (!out.includes(expectedOld)) {
  console.error("t1164-census-rekey: EXPECTED anchor not found");
  process.exit(1);
}
out = out.replace(expectedOld, expectedNew);
edits += 1;

// The header's roster history grows one clause.
const headerOld =
  "t1163 added the world-gate unit, the 101st seat — the operator's lever (FAMILY_WORLD_GATE=strict refuses a doctor-RED world with honest testimony and exit 0 — the three jurisdictions of the doorbell law all executable).";
const headerNew = headerOld.slice(0, -1) + "; t1164 added the takehome-proof unit, the 102nd seat — the no-trace-neighbor law as a pin (a green suite must PROVE it left the world it found; a warned cleanup is a cleanup that did not happen).";
if (out.includes(headerOld)) {
  out = out.replace(headerOld, headerNew);
  edits += 1;
}

writeFileSync(P, out);
console.log(`t1164-census-rekey: seat 102 enrolled (${edits} edits) — NAMES + RUNNERS(0, bare node) + EXPECTED(13)`);

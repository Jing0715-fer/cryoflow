#!/usr/bin/env node
/**
 * t1163 — the census seat re-key (the text-surgery law: a formal
 * script, never an inline regex injection). Seat 101
 * (t1163-world-gate-unit) joins at 14 pins: the durability vein's
 * fourth face — the OPERATOR'S LEVER on the family runner. t1162 made
 * the family hear the doorbell (every batch entry carries the cheap
 * probe's verdict); t1163 lets the operator DECIDE:
 * FAMILY_WORLD_GATE=strict refuses to ride a doctor-RED world — the
 * batch writes HONEST TESTIMONY (a worldGated entry, every suite
 * "world-gated", attempts 0) and exits 0: a gated batch is an
 * operator choice, not a failure, and the exit code stays pure suite
 * arithmetic. The default keeps the t1162 behavior (report and ride);
 * strict never repairs, never retries, never fakes a verdict; a mute
 * probe is never red (the gate stays silent when the instrument went
 * silent); EMPTY-LIVE (red=false) rides — the recycle's signature is
 * the recovery's business, not the family's refusal. The doorbell
 * law's three jurisdictions are now all executable: the probe names
 * the drift, the doctor holds the hearing, the GATE decides (only the
 * operator's own way). A the instrument runs FOR REAL (strict × RED
 * DRIFTED temp-DB world = the refusal + the ⊘ summary face; default ×
 * RED = the ride proceeds with the ⚠ preflight; strict × honest STALE
 * world = the gate stays open — ridden by the READ-ONLY qa00 sentinel
 * so the world never moves); B the source law (strict-only, exit 0,
 * no manufactured failure, the testimony shape, the mute safety, the
 * EMPTY-LIVE whitelist, the default's t1162 shape); C the doctrine
 * (the help line, the non-fatal exit codes, the flag precedence).
 * Three edits, each a counted anchor:
 *   1. NAMES  — the seat's file joins the roster (after seat 100).
 *   2. RUNNERS — `0` (bare node: node: builtins + createRequire only —
 *      no @/lib alias needed) + the seat-101 comment prepended.
 *   3. EXPECTED — `14` appended (positional) + the seat-101 reason
 *      prepended to the tail comment.
 * Idempotent: re-running after the re-key reports and exits 0.
 */
import { readFileSync, writeFileSync } from "node:fs";

const P = "/home/z/my-project/scripts/t927-census.sh";
const src = readFileSync(P, "utf8");

const SEAT_COMMENT_RUNNERS =
  "+seat 101: t1163 rides bare node (the unit imports node: builtins + createRequire only — no @/lib alias needed) · ";
const SEAT_COMMENT_EXPECTED =
  "+seat 101 = t1163-world-gate-unit (14 pins; the durability vein's fourth face — the OPERATOR'S LEVER: FAMILY_WORLD_GATE=strict refuses to ride a doctor-RED world, writing HONEST TESTIMONY (worldGated entry, suites world-gated, attempts 0) and exiting 0 — a gated batch is an operator choice, not a failure; the default keeps t1162's report-and-ride; strict never repairs, never retries, never fakes a verdict; a mute probe is never red; EMPTY-LIVE rides — the recycle's signature is the recovery's business; the doorbell law's three jurisdictions all executable: the probe names the drift, the doctor holds the hearing, the GATE decides only the operator's own way; A the instrument runs FOR REAL (strict × RED DRIFTED temp-DB world = the refusal + the ⊘ summary face; default × RED = the ride proceeds with the ⚠ preflight; strict × honest STALE world = the gate stays open — ridden by the READ-ONLY qa00 sentinel so the world never moves); B the source law (strict-only, exit 0, no manufactured failure, the testimony shape, the mute safety, the EMPTY-LIVE whitelist, the default's t1162 shape); C the doctrine (the help line, the non-fatal exit codes, the flag precedence)) · ";

if (
  src.includes('"t1163-world-gate-unit"') &&
  src.includes("27 17 13 23 12 16 25 14)")
) {
  console.log("t1163-census-rekey: seat 101 already enrolled — idempotent exit");
  process.exit(0);
}

let out = src;
let edits = 0;

// 1. NAMES — the seat joins the roster after seat 100.
const namesOld = '  "t1162-world-probe-unit"\n)';
const namesNew =
  '  "t1162-world-probe-unit"\n  "t1163-world-gate-unit"\n)';
if (!out.includes(namesOld)) {
  console.error("t1163-census-rekey: NAMES anchor not found");
  process.exit(1);
}
out = out.replace(namesOld, namesNew);
edits += 1;

// 2. RUNNERS — `0` appended (bare node) + the seat comment prepended.
const runnersOld = " 1 1 1 1 1 1 1 0 0 0) #   ";
const runnersNew = " 1 1 1 1 1 1 1 0 0 0 0) #   " + SEAT_COMMENT_RUNNERS;
if (!out.includes(runnersOld)) {
  console.error("t1163-census-rekey: RUNNERS anchor not found");
  process.exit(1);
}
out = out.replace(runnersOld, runnersNew);
edits += 1;

// 3. EXPECTED — `14` appended (positional) + the seat reason prepended.
const expectedOld = "27 17 13 23 12 16 25) #   ";
const expectedNew = "27 17 13 23 12 16 25 14) #   " + SEAT_COMMENT_EXPECTED;
if (!out.includes(expectedOld)) {
  console.error("t1163-census-rekey: EXPECTED anchor not found");
  process.exit(1);
}
out = out.replace(expectedOld, expectedNew);
edits += 1;

// The header's roster history grows one clause.
const headerOld =
  "t1162 added the world-probe unit, the 100th seat — the doctor's third face (the freshness verdict rides the report the cron family already reads, and a RED probe is a doorbell, never an exit code).";
const headerNew = headerOld.slice(0, -1) + "; t1163 added the world-gate unit, the 101st seat — the operator's lever (FAMILY_WORLD_GATE=strict refuses a doctor-RED world with honest testimony and exit 0 — the three jurisdictions of the doorbell law all executable).";
if (out.includes(headerOld)) {
  out = out.replace(headerOld, headerNew);
  edits += 1;
}

writeFileSync(P, out);
console.log(`t1163-census-rekey: seat 101 enrolled (${edits} edits) — NAMES + RUNNERS(0, bare node) + EXPECTED(14)`);

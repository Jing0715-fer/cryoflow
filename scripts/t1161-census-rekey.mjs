#!/usr/bin/env node
/**
 * t1161 — the census seat re-key (the text-surgery law: a formal
 * script, never an inline regex injection). Seat 99
 * (t1161-snapshot-doctor-unit) joins at 16 pins: the freshness gate,
 * the snapshot's second face — t1160 taught the world to die as a
 * command; t1161 teaches the snapshot to admit its age. A stale
 * snapshot restored after a recycle would resurrect an OLD world and
 * present it as the truth; the doctor (world-snapshot.mjs doctor,
 * READ-ONLY) names the drift before it lies, four verdicts loudest
 * first: LIED (meta.counts against the snapshot's own data rows — a
 * snapshot that lies about itself is worse than no snapshot), DRIFTED
 * (count or job-ID differences, or rows updated after exportedAt —
 * both loss directions named: the live-only jobs a restore would NOT
 * bring back and the dead-world jobs it WOULD resurrect), STALE (data
 * faithful, the snapshot rides an older commit — the docs/qa cars'
 * usual footprint), FRESH (counts faithful, job IDs equal,
 * engine-state aligned). The recovery rides it too: reboot-recover's
 * step 3.5 speaks the doctor and rebuilds an EMPTY db (the recycle's
 * signature) from the tracked snapshot BEFORE the seed door — a born
 * world is the tracked 15-job spine — and NEVER auto-restores a living
 * world (REBOOT_SNAPSHOT_RESTORE=1 forces, the operator owns the
 * wipe). A the instrument runs FOR REAL (each verdict provoked on a
 * doctored temp copy: LIED ×2, DRIFTED both directions, the past-dated
 * exportedAt, the just-exported FRESH — the tracked snapshot never
 * touched); B the source law (the verdict ladder's order, the
 * read-only body, the exit codes 1/1/0/0, the two-sided ledger, the 1s
 * freshness slack, the URL jurisdiction); C the doctrine (the tracked
 * snapshot keeps its oath, the ladder in the header, the usage line,
 * the 3.5 integration).
 * Three edits, each a counted anchor:
 *   1. NAMES  — the seat's file joins the roster (after seat 98).
 *   2. RUNNERS — `0` (bare node: the unit imports node: builtins +
 *      child_process only — no @/lib alias needed) + the seat-99
 *      comment prepended.
 *   3. EXPECTED — `16` appended (positional) + the seat-99 reason
 *      prepended to the tail comment.
 * Idempotent: re-running after the re-key reports and exits 0.
 */
import { readFileSync, writeFileSync } from "node:fs";

const P = "/home/z/my-project/scripts/t927-census.sh";
const src = readFileSync(P, "utf8");

const SEAT_COMMENT_RUNNERS =
  "+seat 99: t1161 rides bare node (the unit imports node: builtins + child_process only — no @/lib alias needed) · ";
const SEAT_COMMENT_EXPECTED =
  "+seat 99 = t1161-snapshot-doctor-unit (16 pins; the freshness gate, the snapshot's second face — t1160 taught the world to die as a command; t1161 teaches the snapshot to admit its age: a stale snapshot restored after a recycle would resurrect an OLD world and present it as the truth, and the doctor (world-snapshot.mjs doctor, READ-ONLY) names the drift before it lies — LIED (meta.counts against the snapshot's own data rows), DRIFTED (count or job-ID differences, or rows updated after exportedAt; both loss directions named: the live-only jobs a restore would NOT bring back and the dead-world jobs it WOULD resurrect), STALE (data faithful, the snapshot rides an older commit — the docs/qa cars' usual footprint), FRESH (counts faithful, job IDs equal, engine-state aligned); the recovery rides it too: reboot-recover's step 3.5 speaks the doctor and rebuilds an EMPTY db from the tracked snapshot BEFORE the seed door, and NEVER auto-restores a living world (REBOOT_SNAPSHOT_RESTORE=1 forces, the operator owns the wipe); A the instrument runs FOR REAL (each verdict provoked on a doctored temp copy — LIED ×2, DRIFTED both directions, the past-dated exportedAt, the just-exported FRESH — the tracked snapshot never touched); B the source law (the verdict ladder's order, the read-only body, the exit codes 1/1/0/0, the two-sided ledger, the 1s freshness slack, the URL jurisdiction); C the doctrine (the tracked snapshot keeps its oath, the ladder in the header, the usage line, the 3.5 integration)) · ";

if (
  src.includes('"t1161-snapshot-doctor-unit"') &&
  src.includes("27 17 13 23 12 16)")
) {
  console.log("t1161-census-rekey: seat 99 already enrolled — idempotent exit");
  process.exit(0);
}

let out = src;
let edits = 0;

// 1. NAMES — the seat joins the roster after seat 98.
const namesOld = '  "t1160-world-snapshot-unit"\n)';
const namesNew =
  '  "t1160-world-snapshot-unit"\n  "t1161-snapshot-doctor-unit"\n)';
if (!out.includes(namesOld)) {
  console.error("t1161-census-rekey: NAMES anchor not found");
  process.exit(1);
}
out = out.replace(namesOld, namesNew);
edits += 1;

// 2. RUNNERS — `0` appended (bare node) + the seat comment prepended.
const runnersOld = " 1 1 1 1 1 1 1 0) #   ";
const runnersNew = " 1 1 1 1 1 1 1 0 0) #   " + SEAT_COMMENT_RUNNERS;
if (!out.includes(runnersOld)) {
  console.error("t1161-census-rekey: RUNNERS anchor not found");
  process.exit(1);
}
out = out.replace(runnersOld, runnersNew);
edits += 1;

// 3. EXPECTED — `16` appended (positional) + the seat reason prepended.
const expectedOld = "27 17 13 23 12) #   ";
const expectedNew = "27 17 13 23 12 16) #   " + SEAT_COMMENT_EXPECTED;
if (!out.includes(expectedOld)) {
  console.error("t1161-census-rekey: EXPECTED anchor not found");
  process.exit(1);
}
out = out.replace(expectedOld, expectedNew);
edits += 1;

// The header's roster history grows one clause.
const headerOld =
  "t1160 added the world-snapshot unit, the 98th seat — the durability vein (the world's death is a command, not an afternoon).";
const headerNew = headerOld.slice(0, -1) + "; t1161 added the snapshot-doctor unit, the 99th seat — the freshness gate (the snapshot must admit its age before a restore lies with it).";
if (out.includes(headerOld)) {
  out = out.replace(headerOld, headerNew);
  edits += 1;
}

writeFileSync(P, out);
console.log(`t1161-census-rekey: seat 99 enrolled (${edits} edits) — NAMES + RUNNERS(0, bare node) + EXPECTED(16)`);

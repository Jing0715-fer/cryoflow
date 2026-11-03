#!/usr/bin/env node
/**
 * t1162 — the census seat re-key (the text-surgery law: a formal
 * script, never an inline regex injection). Seat 100
 * (t1162-world-probe-unit) joins at 25 pins: the snapshot doctor's
 * THIRD face and the family report's world marker — t1160 taught the
 * world to die as a command; t1161 taught the snapshot to admit its
 * age; t1162 teaches the FAMILY to hear the doorbell. `probe` is the
 * CHEAP reading (count+head only — the self-truth tooth is free once
 * the JSON is in hand; the live truth costs ONE aggregate) that the
 * family batch runner stamps onto EVERY report entry: the freshness
 * verdict rides the report the cron family already reads. Verdicts,
 * loudest first: NO-SNAPSHOT (the tracked home gone or unparseable),
 * LIED (meta.counts.job against the snapshot's own rows), EMPTY-LIVE
 * (the recycle's signature — the snapshot is the CURE here, exit 0),
 * DRIFTED (count or freshness moved off the snapshot), STALE (the
 * docs/qa cars' footprint), FRESH. A RED probe is a DOORBELL, not a
 * diagnosis — the full doctor holds the hearing — and by the t548
 * doctrine it NEVER moves the runner's exit code (proven LIVE: a
 * world-RED batch with zero real-fails exits 0). A the instrument
 * runs FOR REAL (every verdict provoked: NO-SNAPSHOT ×2 on the absent
 * and the unparseable home, LIED, EMPTY-LIVE on a pushed-empty temp
 * DB, DRIFTED both ways — a live-only job created in a restored temp
 * DB and a past-dated exportedAt, STALE on a doctored head, FRESH on
 * a just-exported snapshot — the tracked snapshot never touched);
 * B the source law (the ladder's order, the ONE-aggregate cheapness,
 * the exit codes, the read-only body, the 1s slack, the URL
 * jurisdiction, the usage line); C the family integration (the stamp
 * on BOTH write sites — the close AND the death testimony, the
 * non-fatal law static AND live, the --summary faces, the preflight,
 * the help line, the header).
 * Three edits, each a counted anchor:
 *   1. NAMES  — the seat's file joins the roster (after seat 99).
 *   2. RUNNERS — `0` (bare node: node: builtins + createRequire only —
 *      no @/lib alias needed) + the seat-100 comment prepended.
 *   3. EXPECTED — `25` appended (positional) + the seat-100 reason
 *      prepended to the tail comment.
 * Idempotent: re-running after the re-key reports and exits 0.
 */
import { readFileSync, writeFileSync } from "node:fs";

const P = "/home/z/my-project/scripts/t927-census.sh";
const src = readFileSync(P, "utf8");

const SEAT_COMMENT_RUNNERS =
  "+seat 100: t1162 rides bare node (the unit imports node: builtins + createRequire only — no @/lib alias needed) · ";
const SEAT_COMMENT_EXPECTED =
  "+seat 100 = t1162-world-probe-unit (25 pins; the snapshot doctor's THIRD face and the family report's world marker — t1160 taught the world to die as a command; t1161 taught the snapshot to admit its age; t1162 teaches the FAMILY to hear the doorbell: probe is the CHEAP reading (count+head only — the self-truth tooth is free once the JSON is in hand; the live truth costs ONE aggregate) that the family batch runner stamps onto EVERY report entry, so the freshness verdict rides the report the cron family already reads; verdicts loudest first: NO-SNAPSHOT (the tracked home gone or unparseable), LIED (meta.counts.job against the snapshot's own rows), EMPTY-LIVE (the recycle's signature — the snapshot is the CURE here, exit 0), DRIFTED (count or freshness moved off the snapshot), STALE (the docs/qa cars' footprint), FRESH; a RED probe is a DOORBELL, not a diagnosis — the full doctor holds the hearing — and by the t548 doctrine it NEVER moves the runner's exit code (proven LIVE: a world-RED batch with zero real-fails exits 0); A the instrument runs FOR REAL (every verdict provoked: NO-SNAPSHOT ×2 on the absent and the unparseable home, LIED, EMPTY-LIVE on a pushed-empty temp DB, DRIFTED both ways — a live-only job created in a restored temp DB and a past-dated exportedAt, STALE on a doctored head, FRESH on a just-exported snapshot — the tracked snapshot never touched); B the source law (the ladder's order, the ONE-aggregate cheapness, the exit codes, the read-only body, the 1s slack, the URL jurisdiction, the usage line); C the family integration (the stamp on BOTH write sites — the close AND the death testimony, the non-fatal law static AND live, the --summary faces, the preflight, the help line, the header)) · ";

if (
  src.includes('"t1162-world-probe-unit"') &&
  src.includes("27 17 13 23 12 16 25)")
) {
  console.log("t1162-census-rekey: seat 100 already enrolled — idempotent exit");
  process.exit(0);
}

let out = src;
let edits = 0;

// 1. NAMES — the seat joins the roster after seat 99.
const namesOld = '  "t1161-snapshot-doctor-unit"\n)';
const namesNew =
  '  "t1161-snapshot-doctor-unit"\n  "t1162-world-probe-unit"\n)';
if (!out.includes(namesOld)) {
  console.error("t1162-census-rekey: NAMES anchor not found");
  process.exit(1);
}
out = out.replace(namesOld, namesNew);
edits += 1;

// 2. RUNNERS — `0` appended (bare node) + the seat comment prepended.
const runnersOld = " 1 1 1 1 1 1 1 0 0) #   ";
const runnersNew = " 1 1 1 1 1 1 1 0 0 0) #   " + SEAT_COMMENT_RUNNERS;
if (!out.includes(runnersOld)) {
  console.error("t1162-census-rekey: RUNNERS anchor not found");
  process.exit(1);
}
out = out.replace(runnersOld, runnersNew);
edits += 1;

// 3. EXPECTED — `25` appended (positional) + the seat reason prepended.
const expectedOld = "27 17 13 23 12 16) #   ";
const expectedNew = "27 17 13 23 12 16 25) #   " + SEAT_COMMENT_EXPECTED;
if (!out.includes(expectedOld)) {
  console.error("t1162-census-rekey: EXPECTED anchor not found");
  process.exit(1);
}
out = out.replace(expectedOld, expectedNew);
edits += 1;

// The header's roster history grows one clause.
const headerOld =
  "t1161 added the snapshot-doctor unit, the 99th seat — the freshness gate (the snapshot must admit its age before a restore lies with it).";
const headerNew = headerOld.slice(0, -1) + "; t1162 added the world-probe unit, the 100th seat — the doctor's third face (the freshness verdict rides the report the cron family already reads, and a RED probe is a doorbell, never an exit code).";
if (out.includes(headerOld)) {
  out = out.replace(headerOld, headerNew);
  edits += 1;
}

writeFileSync(P, out);
console.log(`t1162-census-rekey: seat 100 enrolled (${edits} edits) — NAMES + RUNNERS(0, bare node) + EXPECTED(25)`);

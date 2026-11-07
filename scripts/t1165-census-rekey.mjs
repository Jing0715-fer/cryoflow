#!/usr/bin/env node
/**
 * t1165 — the census seat re-key (the text-surgery law: a formal
 * script, never an inline regex injection). Seat 103
 * (t1165-world-durability-unit) joins at 56 pins on the green path
 * (58 ok() calls in source — two ride the probe's mute branch, the
 * honest-mute face's own pins; the count-before-rekey law counts the
 * ok() calls and SAYS the branch split). The durability vein's
 * PRODUCT face: readWorldDurability spawns the ONE probe instrument
 * (scripts/world-snapshot.mjs probe — the t1162 doorbell) and quotes
 * its machine JSON verbatim; the words (age buckets, verdict prose)
 * live in ONE client-safe birthplace (world-durability-words.ts) the
 * dialog and the AI presenter share; the card fails safe to amber on
 * an unknown word; a mute instrument speaks its WHY, never a guessed
 * verdict. A the live face (the REAL instrument, read-only — the seat
 * pins the CONTRACT's shape, not the world's exact numbers, the t529
 * law); the pure fathers on fixtures; parseProbeStdout's shape law;
 * the presenter's locator lines. B the source law (argv-direct spawn
 * with the subcommand NAMED — the side-effect-default law's product
 * face; the 10s budget; the payload composition; the client mirror;
 * the ONE-birthplace import; the words module's zero node imports).
 * C the doctrine (the card's testids; the fail-safe tone buckets —
 * FRESH teal · STALE/EMPTY-LIVE amber · the RED trio danger; the
 * honest mute face; the region's roster; the header's law).
 * Three edits, each a counted anchor:
 *   1. NAMES  — the seat's file joins the roster (after seat 102).
 *   2. RUNNERS — `1` (unit-runner: the @/lib import rides jiti — the
 *      t1148 pure-presenter family's lane) + the seat-103 comment
 *      prepended.
 *   3. EXPECTED — `56` appended (positional) + the seat-103 reason
 *      prepended to the tail comment.
 * Idempotent: re-running after the re-key reports and exits 0.
 */
import { readFileSync, writeFileSync } from "node:fs";

const P = "/home/z/my-project/scripts/t927-census.sh";
const src = readFileSync(P, "utf8");

const SEAT_COMMENT_RUNNERS =
  "+seat 103: t1165 rides unit-runner (the @/lib diagnostics import — the t1148 pure-presenter family's lane) · ";
const SEAT_COMMENT_EXPECTED =
  "+seat 103 = t1165-world-durability-unit (56 pins on the green path, 58 ok() calls in source — two ride the probe's mute branch; the durability vein's PRODUCT face: readWorldDurability spawns the ONE probe instrument (the t1162 doorbell) and quotes its machine JSON verbatim — one instrument, many mouths; the words live in ONE client-safe birthplace (world-durability-words.ts) the dialog and the AI presenter share; the card fails safe to amber on an unknown word; a mute instrument speaks its WHY, never a guessed verdict; A the live face (the REAL instrument, read-only — the contract's shape, not the world's exact numbers, the t529 law); the pure fathers on fixtures; parseProbeStdout's shape law (noise-tolerant tail, mute on every malformed shape, a RED verdict's JSON still parses — exit 1 is not a mute); B the source law (argv-direct spawn with the subcommand NAMED — the side-effect-default law's product face; the 10s budget; the payload composition; the client mirror; the ONE-birthplace import; the words module's zero node imports); C the doctrine (the card's testids; the fail-safe tone buckets — FRESH teal · STALE/EMPTY-LIVE amber · the RED trio danger; the honest mute face; the region's roster; the header's law)) · ";

if (
  src.includes('"t1165-world-durability-unit"') &&
  src.includes("27 17 13 23 12 16 25 14 13 56)")
) {
  console.log("t1165-census-rekey: seat 103 already enrolled — idempotent exit");
  process.exit(0);
}

let out = src;
let edits = 0;

// 1. NAMES — the seat joins the roster after seat 102.
const namesOld = '  "t1164-takehome-proof-unit"\n)';
const namesNew = '  "t1164-takehome-proof-unit"\n  "t1165-world-durability-unit"\n)';
if (!out.includes(namesOld)) {
  console.error("t1165-census-rekey: NAMES anchor not found");
  process.exit(1);
}
out = out.replace(namesOld, namesNew);
edits += 1;

// 2. RUNNERS — `1` appended (unit-runner) + the seat comment prepended.
const runnersOld = "1 1 1 1 1 0 0 0 0 0) #   ";
const runnersNew = "1 1 1 1 1 0 0 0 0 0 1) #   " + SEAT_COMMENT_RUNNERS;
if (!out.includes(runnersOld)) {
  console.error("t1165-census-rekey: RUNNERS anchor not found");
  process.exit(1);
}
out = out.replace(runnersOld, runnersNew);
edits += 1;

// 3. EXPECTED — `56` appended (positional) + the seat reason prepended.
const expectedOld = "27 17 13 23 12 16 25 14 13) #   ";
const expectedNew = "27 17 13 23 12 16 25 14 13 56) #   " + SEAT_COMMENT_EXPECTED;
if (!out.includes(expectedOld)) {
  console.error("t1165-census-rekey: EXPECTED anchor not found");
  process.exit(1);
}
out = out.replace(expectedOld, expectedNew);
edits += 1;

// The header's roster history grows one clause.
const headerOld =
  "t1164 added the takehome-proof unit, the 102nd seat — the no-trace-neighbor law as a pin (a green suite must PROVE it left the world it found; a warned cleanup is a cleanup that did not happen).";
const headerNew = headerOld.slice(0, -1) + "; t1165 added the world-durability unit, the 103rd seat — the chain of custody's PRODUCT face (the System diagnostics card spawns the ONE probe and quotes its verdict; a second verdict ladder in the product would drift from the instrument the cron family rides).";
if (out.includes(headerOld)) {
  out = out.replace(headerOld, headerNew);
  edits += 1;
}

writeFileSync(P, out);
console.log(`t1165-census-rekey: seat 103 enrolled (${edits} edits) — NAMES + RUNNERS(1, unit-runner) + EXPECTED(56)`);

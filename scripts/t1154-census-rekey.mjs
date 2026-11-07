#!/usr/bin/env node
/**
 * t1154 — the census seat re-key (the text-surgery law: a formal
 * script, never an inline regex injection). Seat 93
 * (t1154-progress-scale-unit) joins at 28 pins: the progress scale's
 * ONE birthplace — the NEW map's third vein (the t181 scale law's
 * home). The wire is 0–100 (the engine writes Math.round(frac*100),
 * clamped 1–99 running / 100 finalize) and the 4200% bug's THIRD life
 * hid in the agent lane the t181 cure never reached: three tool
 * summaries multiplied the raw wire by 100 again — "(progress 4200%)"
 * for a 42% run — while every screen face spoke the column correctly.
 * Three edits, each a counted anchor:
 *   1. NAMES  — the seat's file joins the roster (after seat 92).
 *   2. RUNNERS — `1` (unit-runner: the scale father's import, the
 *      t1148 family's lane) + the seat-93 comment prepended.
 *   3. EXPECTED — `28` appended (positional) + the seat-93 reason
 *      prepended to the tail comment.
 * Idempotent: re-running after the re-key reports and exits 0.
 */
import { readFileSync, writeFileSync } from "node:fs";

const P = "/home/z/my-project/scripts/t927-census.sh";
const src = readFileSync(P, "utf8");

const SEAT_COMMENT_RUNNERS =
  "+seat 93: t1154 rides unit-runner (the scale father's import, the t1148 family's lane) · ";
const SEAT_COMMENT_EXPECTED =
  "+seat 93 = t1154-progress-scale-unit (28 pins; the progress scale's ONE birthplace — the NEW map's third vein (the t181 scale law's home): the wire is 0–100 (the engine writes Math.round(frac*100) clamped 1–99 running / 100 finalize) and the 4200% bug's THIRD life hid in the agent lane the t181 cure never reached — three tool summaries multiplied the raw wire by 100 again ('(progress 4200%)' for a 42% run) while every screen face spoke the column correctly; A the father run FOR REAL (the integer grain, the rounding face, the junk contract (no guard invented), the fraction face (the ONE /100), the round-trip (the feed's ×100 back-translation speaks the same word), the determinism); B the source law (the three 4200% births dead in tools.ts, the seven UI drinkers import the father, the frame rides progressToFraction, the width/value faces stay value faces, the class-share boundary drawn at the gallery (two grains of one claim), the father client-safe — no fs, no clock); C the doctrine (the wire contract quoted, the t181 story told — BOTH lives, the boundary census (zoom / axis / class-share / storage / ML metrics / timeline share / engine voice), one claim one birthplace)) · ";

if (src.includes('"t1154-progress-scale-unit"') && src.includes("27 30 27 28)")) {
  console.log("already re-keyed — idempotent exit 0");
  process.exit(0);
}

if (src.includes('"t1154-progress-scale-unit"')) {
  console.error("PARTIAL STATE: seat name present but EXPECTED tail wrong — inspect by hand");
  process.exit(1);
}

// 1 — NAMES.
const NAMES_OLD = '  "t1153-duration-word-unit"\n)';
const NAMES_NEW = '  "t1153-duration-word-unit"\n  "t1154-progress-scale-unit"\n)';
if (!src.includes(NAMES_OLD)) {
  console.error("NAMES anchor not found — the roster moved, re-key by hand");
  process.exit(1);
}
let next = src.replace(NAMES_OLD, NAMES_NEW);

// 2 — RUNNERS: append ` 1` and prepend the seat comment.
const RUNNERS_OLD = "1 1 1 1 1 1 1) #   +seat 92:";
const RUNNERS_NEW = `1 1 1 1 1 1 1 1) #   ${SEAT_COMMENT_RUNNERS}+seat 92:`;
if (!next.includes(RUNNERS_OLD)) {
  console.error("RUNNERS anchor not found — re-key by hand");
  process.exit(1);
}
next = next.replace(RUNNERS_OLD, RUNNERS_NEW);

// 3 — EXPECTED: append ` 28` and prepend the seat reason to the tail comment.
const EXPECTED_OLD = "29 29 27 30 27) #   +seat 92 =";
const EXPECTED_NEW = `29 29 27 30 27 28) #   ${SEAT_COMMENT_EXPECTED}+seat 92 =`;
if (!next.includes(EXPECTED_OLD)) {
  console.error("EXPECTED anchor not found — re-key by hand");
  process.exit(1);
}
next = next.replace(EXPECTED_OLD, EXPECTED_NEW);

writeFileSync(P, next);
console.log("re-keyed: NAMES +1 (93), RUNNERS +1 (unit-runner), EXPECTED +1 (28) — re-run to verify");

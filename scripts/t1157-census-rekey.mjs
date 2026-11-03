#!/usr/bin/env node
/**
 * t1157 — the census seat re-key (the text-surgery law: a formal
 * script, never an inline regex injection). Seat 96
 * (t1157-thousands-word-unit) joins at 13 pins: the thousands word's
 * one father — the NEW map's sixth vein (t1157's candidate walked
 * home). The shape-hunt counted 127 toLocaleString births and found
 * 79 count faces speaking bare `toLocaleString()` — each inheriting
 * whatever locale its host spoke, the ENGINE's own result words
 * included, which the result-counts parser READS with a comma-only
 * contract (a de-DE server's "82.000" would parse as 82 and the
 * particle badge would lie). The codemod folded them in one counted
 * pass: the engine's and remote-run's words pin "en-US" BY LITERAL
 * (the t1152 voice boundary keeps the engine's dialect its own — a
 * locale pin is not a voice change), the UI/lib faces ride the father
 * (formatCountFull, t347), the shadcn chart base pins its own literal,
 * and every `new Date(...)` call stays bare BY DESIGN (the date-time
 * face is a DIFFERENT word riding the browser's locale on purpose).
 * Three edits, each a counted anchor:
 *   1. NAMES  — the seat's file joins the roster (after seat 95).
 *   2. RUNNERS — `1` (unit-runner: the father's import, the t1156
 *      family's lane) + the seat-96 comment prepended.
 *   3. EXPECTED — `13` appended (positional) + the seat-96 reason
 *      prepended to the tail comment.
 * Idempotent: re-running after the re-key reports and exits 0.
 */
import { readFileSync, writeFileSync } from "node:fs";

const P = "/home/z/my-project/scripts/t927-census.sh";
const src = readFileSync(P, "utf8");

const SEAT_COMMENT_RUNNERS =
  "+seat 96: t1157 rides unit-runner (the thousands father's import, the t1156 family's lane) · ";
const SEAT_COMMENT_EXPECTED =
  "+seat 96 = t1157-thousands-word-unit (13 pins; the thousands word's one father — the NEW map's sixth vein: 79 of 127 toLocaleString births spoke bare locale-dependent calls, the ENGINE's result words included, which the result-counts parser READS with a comma-only contract (toNum strips ',' — a de-DE server's \"82.000\" would parse as 82 and the particle badge would lie); the codemod folded them in one counted pass (t1157-thousands-codemod.mjs): the engine's and remote-run's words pin 'en-US' BY LITERAL (the t1152 voice boundary keeps the engine's dialect its own — a locale pin is not a voice change, it is the parser's contract made unilateral-proof), the UI/lib faces ride the father formatCountFull (t347) with 21 riders counted, the shadcn chart base pins its own literal (the base stays self-contained), and every new Date(...) call stays bare BY DESIGN (the date-time face is a DIFFERENT word riding the browser's locale on purpose — a separate census if it ever drifts); A the fathers run FOR REAL (the en-US shape on the receipt counts, the compact k/M bands, the determinism); B the source law (the engine's bare births dead + the literal pin present, remoteCountLead's pin — the parser's own input, the chart base's pin, the 21 riders, the surviving bare births are EXACTLY the temporal faces + the census's quoted literal, the parser's comma contract intact); C the doctrine (the census paragraph at the father, the voice boundary judgment, the temporal boundary)) · ";

if (src.includes('"t1157-thousands-word-unit"') && src.includes("27 28 27 17 13)")) {
  console.log("already re-keyed — idempotent exit 0");
  process.exit(0);
}

if (src.includes('"t1157-thousands-word-unit"')) {
  console.error("PARTIAL STATE: seat name present but EXPECTED tail wrong — inspect by hand");
  process.exit(1);
}

// 1 — NAMES.
const NAMES_OLD = '  "t1156-pixel-word-unit"\n)';
const NAMES_NEW = '  "t1156-pixel-word-unit"\n  "t1157-thousands-word-unit"\n)';
if (!src.includes(NAMES_OLD)) {
  console.error("NAMES anchor not found — the roster moved, re-key by hand");
  process.exit(1);
}
let next = src.replace(NAMES_OLD, NAMES_NEW);

// 2 — RUNNERS: append ` 1` and prepend the seat comment.
const RUNNERS_OLD = "1 1 1 1 1 1 1 1 1 1) #   +seat 95:";
const RUNNERS_NEW = `1 1 1 1 1 1 1 1 1 1 1) #   ${SEAT_COMMENT_RUNNERS}+seat 95:`;
if (!next.includes(RUNNERS_OLD)) {
  console.error("RUNNERS anchor not found — re-key by hand");
  process.exit(1);
}
next = next.replace(RUNNERS_OLD, RUNNERS_NEW);

// 3 — EXPECTED: append ` 13` and prepend the seat reason to the tail comment.
const EXPECTED_OLD = "29 29 27 30 27 28 27 17) #   +seat 95 =";
const EXPECTED_NEW = `29 29 27 30 27 28 27 17 13) #   ${SEAT_COMMENT_EXPECTED}+seat 95 =`;
if (!next.includes(EXPECTED_OLD)) {
  console.error("EXPECTED anchor not found — re-key by hand");
  process.exit(1);
}
next = next.replace(EXPECTED_OLD, EXPECTED_NEW);

writeFileSync(P, next);
console.log("re-keyed: NAMES +1 (96), RUNNERS +1 (unit-runner), EXPECTED +1 (13) — re-run to verify");

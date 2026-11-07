#!/usr/bin/env node
/**
 * t1158 — the census seat re-key (the text-surgery law: a formal
 * script, never an inline regex injection). Seat 97
 * (t1158-datetime-word-unit) joins at 23 pins: the date-time word's
 * census — the NEW map's seventh vein (the separate census the t1157
 * thousands-father paragraph promised). The t1157 shape-hunt spared
 * every `new Date(...)` face BY DESIGN; this window looked, judged,
 * and drew the boundary in ink: a stamp is a SPOKEN word, never a
 * parsed one, so the human faces keep riding the browser's locale.
 * The cure: the compact chip stamp's TWO byte-twins (ai-verdict-stamp,
 * selection-receipt) died — fmtStampChip/fmtStampRow are the ONE
 * birthplace in lib/duration.ts (the import dialog's row face rides
 * the year-bearing sibling, its "unknown date" kept); the ride is
 * DELIBERATE (the helper passes undefined as the locale, documented at
 * the birthplace); the census block names the six-dialect family
 * (forensic / chip / row / machine / banned / explicit-default); and
 * the blind spot the twins exposed grew a second cure — selection-
 * receipt's local en-US count pin (a PRE-PINNED birth escaped the
 * bare-call sweep) now rides formatCountFull, the digits' ONE father,
 * the riders census's 22nd.
 * Three edits, each a counted anchor:
 *   1. NAMES  — the seat's file joins the roster (after seat 96).
 *   2. RUNNERS — `1` (unit-runner: the duration father's import, the
 *      t1148 family's lane) + the seat-97 comment prepended.
 *   3. EXPECTED — `23` appended (positional) + the seat-97 reason
 *      prepended to the tail comment.
 * Idempotent: re-running after the re-key reports and exits 0.
 */
import { readFileSync, writeFileSync } from "node:fs";

const P = "/home/z/my-project/scripts/t927-census.sh";
const src = readFileSync(P, "utf8");

const SEAT_COMMENT_RUNNERS =
  "+seat 97: t1158 rides unit-runner (the duration father's import, the t1148 family's lane) · ";
const SEAT_COMMENT_EXPECTED =
  "+seat 97 = t1158-datetime-word-unit (23 pins; the date-time word's census — the NEW map's seventh vein, the separate census the t1157 thousands-father paragraph promised: the t1157 shape-hunt spared every new Date face BY DESIGN, this window looked and judged — a stamp is a SPOKEN word, never a parsed one, so the human faces keep riding the browser's locale; the cure: the compact chip stamp's two byte-twins (ai-verdict-stamp, selection-receipt) died — fmtStampChip/fmtStampRow are the ONE birthplace in lib/duration.ts, the import dialog's row face rides the year-bearing sibling with its 'unknown date' kept, the ride is DELIBERATE (the helper passes undefined as the locale, documented at the birthplace), the census block names the six-dialect family (forensic / chip / row / machine / banned / explicit-default), and the blind spot grew a second cure — selection-receipt's local en-US count pin (a PRE-PINNED birth escaped the bare-call sweep) now rides formatCountFull, the digits' ONE father, the riders census's 22nd; A the fathers run FOR REAL (the FIELDS pinned never their order — the locale ride IS the design, the three input dialects byte-identical, the determinism, the junk contract null so the call sites' absence words hold, the fathers differ by EXACTLY the year field); B the source law (the twins dead, the row face riding, ONE helper ONE call, the deliberate undefined, the six-dialect census block, the spoken-never-parsed judgment, the t1157 pointer kept, the machine ISO faces standing, the forensic bare faces standing, the calendar's explicit default standing, no clock in the fathers); C the doctrine (the twins judgment, the year boundary as a FACE claim, the lineage)) · ";

if (src.includes('"t1158-datetime-word-unit"') && src.includes("27 28 27 17 13 23)")) {
  console.log("already re-keyed — idempotent exit 0");
  process.exit(0);
}

if (src.includes('"t1158-datetime-word-unit"')) {
  console.error("PARTIAL STATE: seat name present but EXPECTED tail wrong — inspect by hand");
  process.exit(1);
}

// 1 — NAMES.
const NAMES_OLD = '  "t1157-thousands-word-unit"\n)';
const NAMES_NEW = '  "t1157-thousands-word-unit"\n  "t1158-datetime-word-unit"\n)';
if (!src.includes(NAMES_OLD)) {
  console.error("NAMES anchor not found — the roster moved, re-key by hand");
  process.exit(1);
}
let next = src.replace(NAMES_OLD, NAMES_NEW);

// 2 — RUNNERS: append ` 1` and prepend the seat comment.
const RUNNERS_OLD = "1 1 1 1 1 1 1 1 1 1 1) #   +seat 96:";
const RUNNERS_NEW = `1 1 1 1 1 1 1 1 1 1 1 1) #   ${SEAT_COMMENT_RUNNERS}+seat 96:`;
if (!next.includes(RUNNERS_OLD)) {
  console.error("RUNNERS anchor not found — re-key by hand");
  process.exit(1);
}
next = next.replace(RUNNERS_OLD, RUNNERS_NEW);

// 3 — EXPECTED: append ` 23` and prepend the seat reason to the tail comment.
const EXPECTED_OLD = "27 28 27 17 13) #   +seat 96 =";
const EXPECTED_NEW = `27 28 27 17 13 23) #   ${SEAT_COMMENT_EXPECTED}+seat 96 =`;
if (!next.includes(EXPECTED_OLD)) {
  console.error("EXPECTED anchor not found — re-key by hand");
  process.exit(1);
}
next = next.replace(EXPECTED_OLD, EXPECTED_NEW);

writeFileSync(P, next);
console.log("re-keyed: NAMES +1 (97), RUNNERS +1 (unit-runner), EXPECTED +1 (23) — re-run to verify");

#!/usr/bin/env node
/**
 * t1149 — the census seat re-key (the text-surgery law: a formal
 * script, never an inline regex injection). Seat 88
 * (t1149-preset-shelf-tool-unit) joins at 29 pins: the user's preset
 * shelf, the AGENT face — the t1148 vein's second vein (the
 * memory-key roster × the tool roster held one more gap). Three
 * edits, each a counted anchor:
 *   1. NAMES  — the seat's file joins the roster (after seat 87).
 *   2. RUNNERS — `1` (unit-runner: the pure presenter import, the
 *      same lane as the t1148 family) + the seat-88 comment prepended.
 *   3. EXPECTED — `29` appended (the array is positional; seat 88 is
 *      the LAST) + the seat-88 reason prepended to the tail comment.
 * Idempotent: re-running after the re-key reports and exits 0.
 */
import { readFileSync, writeFileSync } from "node:fs";

const P = "/home/z/my-project/scripts/t927-census.sh";
const src = readFileSync(P, "utf8");

const SEAT_COMMENT_RUNNERS =
  "+seat 88: t1149 rides unit-runner (the pure presenter import — the same lane as the t1148 family) · ";
const SEAT_COMMENT_EXPECTED =
  "+seat 88 = t1149-preset-shelf-tool-unit (29 pins; the USER'S preset shelf, the AGENT face — the t1148 vein's second vein: the memory-key roster × the tool roster held one more gap, the user's hand-tuned param snapshots speak through three UI faces (the inspector's save/apply, the palette's 'Add from your presets', the shelf dialog) and one server row, yet THIRTY-FOUR tools could not quote them — a user asking 「用我常用的 2D 参数建一个 job」 forced the model to invent values, and inventing values for a shelf the user tuned by hand is how a twin is born; A the presenter run FOR REAL (the rows face newest first — the palette's own display dialect, the cards' own 'knobs' word, the JOB_TYPES labels resolved, the unknown type flagged never hidden (the t753 law), the params byte-equal to the father's own output (the fixture feeds the SAME list through sanitizePresetShelf — the t1147 lesson), the THREE honest absences each its own word (never-synced / corrupt / synced-empty — the route's own empty-shelf semantics spoken, never collapsed), the trust decision riding the father (junk rows drop at the whitelist, the neighbours live), the determinism, the no-age law (a preset does not rot — dates, never paces, no Fresh no Marathon); B the well source-pinned (the zero-knob schema, the cousins named (list_job_types / get_job_params), the case routed, the pure presenter import, the id's ONE birthplace — PARAM_PRESET_SHELF_ID lives in the sanitize lib, the route and the well both import it, no second literal for an epoch to drift, the NO-project-scope law (the shelf is the user's — the list_job_types precedent, no getActiveProject, no projectId), the well only feeds (no JSON.parse, no sort, no second gate — the parse rides the presenter)); C the doctrine (the prompt's PRESET LAW (law 18 — quote the shelf's rows, never invent, never paraphrase; the wear flow create_job/update_job with the FULL spec-key snapshot semantics; the cousin lines drawn), the purity laws (no clock — a preset has no pace, no db, no react, the jobs' age fathers stay out, the trust father imported at the door, the newest-first sort pinned in the source)) · ";

if (src.includes('"t1149-preset-shelf-tool-unit"') && src.includes("35 30 29)")) {
  console.log("already re-keyed — idempotent exit 0");
  process.exit(0);
}

// 1 — NAMES.
const NAMES_OLD = '  "t1148-world-health-tool-unit"\n)';
const NAMES_NEW = '  "t1148-world-health-tool-unit"\n  "t1149-preset-shelf-tool-unit"\n)';
if (src.split(NAMES_OLD).length - 1 !== 1) {
  console.error("FATAL: the NAMES anchor does not appear exactly once");
  process.exit(1);
}

// 2 — RUNNERS: append the lane, prepend the comment.
const RUN_OLD = "1 1) # +seat 87:";
const RUN_NEW = "1 1 1) # " + SEAT_COMMENT_RUNNERS + "+seat 87:";
if (src.split(RUN_OLD).length - 1 !== 1) {
  console.error("FATAL: the RUNNERS anchor does not appear exactly once");
  process.exit(1);
}

// 3 — EXPECTED: append the count, prepend the reason.
const EXP_OLD = "35 30) # +seat 87 = t1148-world-health-tool-unit";
const EXP_NEW = "35 30 29) # " + SEAT_COMMENT_EXPECTED + "+seat 87 = t1148-world-health-tool-unit";
if (src.split(EXP_OLD).length - 1 !== 1) {
  console.error("FATAL: the EXPECTED anchor does not appear exactly once");
  process.exit(1);
}

const next = src
  .replace(NAMES_OLD, NAMES_NEW)
  .replace(RUN_OLD, RUN_NEW)
  .replace(EXP_OLD, EXP_NEW);
writeFileSync(P, next);

// The self-check: the arrays must now agree in length (88 each).
const names = (next.match(/"t\d{4}-[a-z0-9-]+-unit"/g) ?? []).length;
const expArr = next.match(/EXPECTED=\(([^)]*)\)/);
const expLen = expArr ? expArr[1].trim().split(/\s+/).length : -1;
const runArr = next.match(/RUNNERS=\(([^)]*)\)/);
const runLen = runArr ? runArr[1].trim().split(/\s+/).length : -1;
console.log(`re-keyed: NAMES-ish ${names} · RUNNERS ${runLen} · EXPECTED ${expLen}`);
if (runLen !== 88 || expLen !== 88) {
  console.error("FATAL: the arrays disagree — inspect by hand");
  process.exit(1);
}
console.log("seat 88 enrolled — 88 seats, aligned");

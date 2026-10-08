#!/usr/bin/env node
// t714-palette-user-presets-unit.mjs — the palette's user-preset face,
// pinned before the bundle wakes (the t653 pattern, fourth reuse; t713's
// third-reuse precedent extended).
//
// The t714 lane: the user face of the preset family joins the command
// palette — snapshots saved in the inspector can now START a job. The
// unit probe pins the pure laws a build-day e2e should never have to
// re-derive:
//
//   A  the recentFirst law — display order is newest-first, stable,
//      non-mutating (storage order is oldest-first; the display dialect
//      is not a different truth).
//   B  the empty law — zero snapshots means no group (the palette's
//      guard reads userPresets.length > 0; a heading orphan is a lie).
//   C  the source census — the palette's group exists, speaks the right
//      heading, walks the ONE write well (store.addJob — never a second
//      param path), reads on open AND on the module's own changed event,
//      and the row value carries the "your saved" search roots so the
//      user's snapshots are findable by the words that name them.
//   D  the fmtAgo widening — epoch-ms numbers are legal input (the
//      snapshot's numeric createdAt rides the same relative-time
//      dialect ISO strings ride).
//
// Run:  node scripts/unit-runner.mjs scripts/t714-palette-user-presets-unit.mjs
// (the t653 runner pattern — jiti + alias mapping; the product IS the oracle.)

import { recentFirst } from "../src/lib/user-param-presets";
import { fmtAgo } from "../src/lib/duration";
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log(`  FAIL: ${msg}`); } };

// ---- A: the recentFirst law ------------------------------------------------
console.log("== A: recentFirst ==");
const mk = (id, createdAt) => ({ id, type: "refine3d", name: `p-${id}`, params: { k: 1 }, createdAt });
const input = [mk("a", 1000), mk("b", 3000), mk("c", 2000), mk("d", 2500)];
const sorted = recentFirst(input);
ok(JSON.stringify(sorted.map((p) => p.id)) === JSON.stringify(["b", "d", "c", "a"]),
  "newest first (b3000 d2500 c2000 a1000)");
ok(input[0].id === "a" && input[3].id === "d", "input NOT mutated (display dialect, not storage rewrite)");
ok(sorted !== input, "returns a fresh array (non-aliasing)");
const ties = [mk("x", 1000), mk("y", 1000), mk("z", 1000)];
ok(recentFirst(ties).every((p) => p.createdAt === 1000), "equal timestamps stay (stable sort, no throw)");
ok(recentFirst([]).length === 0, "empty in, empty out");
ok(recentFirst([mk("solo", 7)]).length === 1, "single in, single out");

// ---- B: the empty law (palette source census) ------------------------------
console.log("== B: the palette's empty law ==");
const pal = readFileSync("src/components/workflow/command-palette.tsx", "utf8");
ok(pal.includes('heading="Add from your presets"'), "the group exists with its heading");
ok(pal.includes("{userPresets.length > 0 && ("),
  "the group is guarded — zero snapshots renders nothing (no heading orphan)");
ok(pal.includes("recentFirst(userPresets)"), "the group reads through recentFirst (one display dialect)");

// ---- C: the one-write-well + event contracts -------------------------------
console.log("== C: contracts ==");
ok(pal.includes("addUserPreset"), "a named add mouth exists (the twin of addPreset)");
ok(/const addUserPreset = \(p: UserParamPreset\) => \{\s*\n\s*void useWorkflowStore\.getState\(\)\.addJob\(p\.type, p\.params\);/.test(pal),
  "addUserPreset walks store.addJob — the ONE write well, never a second param path");
ok(pal.includes("loadUserParamPresets()"), "the group reads the module's own loader");
ok(pal.includes("USER_PARAM_PRESETS_EVENT"), "the palette listens on the module's changed event");
ok(/value=\{`preset add your saved/.test(pal), "row value carries the 'your saved' search roots");
ok(/onSelect=\{\(\) => addUserPreset\(p\)\}/.test(pal), "the row's onSelect is the named mouth");
ok(pal.includes("knobs"), "the right slot speaks the user's units (knob count)");
ok(pal.includes("fmtAgo(p.createdAt)"), "the save's age rides fmtAgo (one relative-time dialect)");

// ---- D: the fmtAgo widening ------------------------------------------------
console.log("== D: fmtAgo accepts epoch-ms ==");
const now = Date.now();
ok(fmtAgo(now - 30_000) === "just now", "numeric 30s ago reads 'just now'");
ok(/^\d+m \d+s ago$/.test(fmtAgo(now - 125_000)), "numeric 2m05s ago reads the m-s dialect");
ok(fmtAgo(new Date(now - 30_000).toISOString()) === "just now", "ISO still legal (the widening is backward-compatible)");
ok(fmtAgo(now - 90 * 24 * 3600 * 1000).includes("d"), "numeric three-months reads the day dialect");

console.log(`\nt714: ${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);

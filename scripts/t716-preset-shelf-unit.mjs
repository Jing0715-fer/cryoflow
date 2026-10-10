// t716-preset-shelf-unit.mjs — the preset shelf's dashboard face, pinned
// before the bundle wakes (the t653 pattern, sixth reuse; t714's census
// dialect + a new numeric law for the cascade).
//
// The t716 lane: the preset family (t713 inspector / t714 palette /
// t715 server mirror) gains its OVERVIEW face — every snapshot across
// every type on one dashboard shelf. The unit probe pins the laws a
// build-day e2e should never have to re-derive:
//
//   A  the shelf's own census — empty law, data dialect (one read + one
//      reconcile + one event), display order, honest overflow, the
//      delete mouth and its honest confirm, motion-reduce discipline.
//   B  the cascade's shape sync — the tenth rung exists (t721's notes
//      wall took 300, t720's digest holds 260, everything below shifted
//      +40 again), the ladder reaches 500ms, and t576's assertions moved
//      WITH the shape
//      (including the three counts t711's partial sync left stale).
//   C  the settle-margin law — a NUMERIC check that the disarm timer
//      exceeds the last rung's landing (780 > 500+240): the bug class
//      t716 caught (a photo-finish settle) can't come back silently.
//
// Run:  node scripts/unit-runner.mjs scripts/t716-preset-shelf-unit.mjs

import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log(`  FAIL: ${msg}`); } };

const shelfSrc = readFileSync("src/components/workflow/user-preset-shelf.tsx", "utf8");
const dashSrc = readFileSync("src/components/workflow/project-dashboard.tsx", "utf8");
const t576 = readFileSync("scripts/t576-dash-cascade-live-fire.mjs", "utf8");

// ---- A: the shelf's own census --------------------------------------------
console.log("== A: the shelf ==");
// t717 AMENDMENT — the empty law grew a door: zero snapshots used to
// render nothing wholesale; with carry (export/import) the zero shelf
// has a LIVE function (import is how a fresh machine's shelf ever
// fills), so the empty state renders the header + the import door, no
// grid. Only the unread first frame stays dark.
ok(shelfSrc.includes("if (presets === null) return null;") && shelfSrc.includes("preset-import-empty-door"),
  "empty law (t717) — unread frame renders nothing; a zero shelf is a DOOR (live import mouth), not a decorative grid");
ok(shelfSrc.includes("loadUserParamPresets()"), "reads through the ONE loader (no second truth)");
ok(shelfSrc.includes("void reconcileUserParamPresets()"), "fires the t715 reconcile on mount (cross-browser adoption)");
ok(shelfSrc.includes("window.addEventListener(USER_PARAM_PRESETS_EVENT, refresh)"),
  "listens on the module's changed event (palette/inspector mouths keep it honest)");
ok(shelfSrc.includes("recentFirst(presets)"), "display order rides recentFirst (the one display dialect)");
ok(/const SHELF_CAP = 8;/.test(shelfSrc), "shelf cap 8 — a glance, not a scroll");
ok(shelfSrc.includes("+{hidden} more snapshot") && shelfSrc.includes("setShowAll(true)"),
  "overflow says honestly how many more and expands in place (the wall's law)");
ok(shelfSrc.includes("deleteUserParamPreset(deleteTarget.id)") && shelfSrc.includes("setDeleteTarget(null)"),
  "the delete mouth walks the ONE delete well, then clears its target");
ok(shelfSrc.includes("presets are\n              snapshots, not links") || shelfSrc.includes("snapshots, not links"),
  "the confirm states what deletion does NOT do (wearing jobs keep their params)");
ok(shelfSrc.includes("data-testid=\"preset-shelf-delete-confirm\""), "the confirm's action button speaks by name (t686 anchor law)");
ok((shelfSrc.match(/motion-reduce:transition-none/g) ?? []).length >= 3,
  "motion-reduce discipline on every transition (qa49's law)", `${(shelfSrc.match(/motion-reduce:transition-none/g) ?? []).length} uses`);
ok(shelfSrc.includes("aria-label={`Delete preset “${p.name}”`}") || shelfSrc.includes("aria-label={`Delete preset"),
  "delete buttons carry per-preset aria-labels (keyboard honesty)");
ok(shelfSrc.includes("aria-label=\"Your parameter presets across all job types\""),
  "the section speaks its scope (across ALL types — the inspector was per-type)");
ok(shelfSrc.includes("{knobs} {knobs === 1 ? \"knob\" : \"knobs\"} · {fmtAgo(p.createdAt)}") || (shelfSrc.includes("knobs") && shelfSrc.includes("fmtAgo(p.createdAt)")),
  "the card's units are the palette's (N knobs · age) — one vocabulary");
ok(/const PREVIEW_CAP = 3;/.test(shelfSrc) && shelfSrc.includes("+{knobs - PREVIEW_CAP}"),
  "params preview: first three knobs as chips + honest +N (a snapshot's face is its knobs)");

// ---- B: the cascade's shape sync (L8179: form changed, checks follow) -----
console.log("== B: cascade sync ==");
ok(dashSrc.includes("<UserPresetShelf />"), "the dashboard hosts the shelf");
ok(dashSrc.includes('"--dash-d": "380ms"') && dashSrc.indexOf("UserPresetShelf") < dashSrc.indexOf('"--dash-d": "380ms"'),
  "the shelf's wrapper carries the 380ms rung (moved +40 again when t721's notes wall took 300)");
const dashDelays = [...dashSrc.matchAll(/"--dash-d": "(\d+)ms"/g)].map((m) => m[1]);
ok(JSON.stringify(dashDelays) === JSON.stringify(["140", "180", "220", "260", "300", "340", "380", "420", "460", "500"]),
  "the ladder is ten rungs, 140→500, no gaps or duplicates", dashDelays.join("/"));
/* t776 re-sync: the t576 probe was re-baselined to the t689 doctrine — the
 * rung count is a dynamic floor (rungN), the ladder contract is the 140ms
 * head verbatim + monotonic descent, and the D2/D3 counts derive from the
 * SAME reading. The interlock follows the contract, not the number. */
ok(t576.includes("section rungs present (the ladder floor)") && t576.includes("rungN >= 5"),
  "t576's armed count is the dynamic floor (rungN >= 5, the t776 contract)");
ok(t576.includes("ladder: 140ms head verbatim + monotonic descent") && t576.includes('delays[0] === "0.14s"'),
  "t576's ladder contract is the 140ms head verbatim + monotonic descent");
ok(t576.includes("(s?.names ?? []).length === rungN"), "t576 disarm count rides rungN (the dynamic reading)");
ok(t576.includes("Number(tagged) === rungN") && t576.includes("p3?.total === rungN"),
  "t576 D3 tag/total counts ride rungN — ALL counts, not the named one");

// ---- C: the settle-margin law (numeric — the bug class dies here) ---------
console.log("== C: settle margin ==");
const timer = Number((dashSrc.match(/setDashSettled\(true\), (\d+)\)/) ?? [])[1]);
const lastRung = Number(dashDelays[dashDelays.length - 1] ?? "0");
const DASH_ENTER_MS = 240; // the family's rung duration (t576 D1 pins it live)
ok(Number.isFinite(timer) && Number.isFinite(lastRung) && lastRung > 0,
  "both numbers parsed from source (the law checks reality, not memory)", `timer=${timer}ms lastRung=${lastRung}ms`);
ok(timer > lastRung + DASH_ENTER_MS,
  "the disarm timer EXCEEDS the last rung's landing (no photo-finish settle clip)",
  `${timer} > ${lastRung}+${DASH_ENTER_MS}`);
ok(dashSrc.includes("40ms of margin over the ladder's end"),
  "the margin is written down where the timer lives (the next rung adder re-checks it)");

console.log(`\nt716 preset-shelf unit: ${pass} pass / ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);

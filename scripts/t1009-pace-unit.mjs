#!/usr/bin/env node
/**
 * t1009 — THE PIPELINE PACE unit (node-only): the t1009 product face's
 * arithmetic pinned at its oracle, the doors pinned at source, the
 * tally law honored by construction.
 *
 * THE FACE: "how fast does this pipeline actually run?" — a project's
 * completed jobs carry the engine's REAL elapsed in `duration` (the
 * completion write `duration: Math.max(1000, elapsed)` overwrites the
 * simulated default — the E-band needle pins that contract at source),
 * so the pace math is honest clock arithmetic:
 *   P1–P6   the lifted oracle (src/lib/pace.ts, the elapsed.ts
 *           doctrine: the product's formatter is the only formatter —
 *           the unit strips `export ` and evals the SOURCE, no
 *           hand-copied twin to drift):
 *           median (odd/even/empty), totals counts + sums, the wall
 *           window (first start → last finish), per-type stages in
 *           FIRST-SEEN chain order (not alphabetical), the rows sorted
 *           by start (a no-clock run sorts LAST, honestly), finishedAt
 *           derived, the failure list carrying names and NO clock.
 *   E       the data contract at source (the engine's overwrite).
 *   D       the doors: the route's guard + FS-FREE shape, the dialog's
 *           aria-busy face / real table semantics / printed-numbers
 *           law / export-family ride / honest empty + failure faces /
 *           mounted gate, the dashboard's dynamic-name gauge button
 *           (no disabled — pace is always viewable), the palette item's
 *           handshake.
 *   T       THE TALLY LAW BY CONSTRUCTION: the three new/edited files
 *           carry ZERO conditional disabled sites — the six tally-pin
 *           units' numbers stand because this face added nothing to
 *           count (the tombstone unit's "no seventh pinner" law, kept
 *           by needle rather than by number).
 *   R       THE RECEIPT + THE DOC ROWS (t1011 — the keyboard arc's
 *           completion): the canvas's live region (role=status,
 *           aria-live=polite, sr-only, ALWAYS mounted — a live region
 *           must precede the change it reports), the mount-skip law
 *           (landing is not an event), the three honest count strings,
 *           the shortcuts dialog's ⇧ Space row (the verb's manual entry,
 *           seated beside its pointer siblings), the help guide's
 *           canvas chapter row naming Shift+Space and the receipt.
 *
 * THE PROBE PROTOCOL: node-only, readFileSync includes + one lifted
 * eval, exit honest, receipt to shots-qa/.t1009-unit-receipt.json.
 */
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TMP = path.join(ROOT, "shots-qa/.t1009-unit-receipt.json");
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");

let pass = 0, fail = 0;
const ok = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ` — ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
try { unlinkSync(TMP); } catch {}

/* ---------- P band — the lifted oracle ---------- */
console.log("P band — the lifted pace oracle:");
const paceSrc = read("src/lib/pace.ts").replace(/^export /gm, "");
const pace = new Function(`${paceSrc}; return { medianOf, computePace };`)();
const { medianOf, computePace } = pace;

ok("P1 medianOf — odd / even / empty",
  medianOf([5]) === 5 && medianOf([1, 2, 3, 4]) === 2.5 && medianOf([]) === null &&
  medianOf([3, 1]) === 2,
  "no run, no median (null, not 0)");

const t0 = 1728900000000;
const iso = (ms) => new Date(ms).toISOString();
const fixture = [
  { id: "j1", name: "Import", type: "import", status: "completed", duration: 500, startedAt: iso(t0) },
  { id: "j2", name: "MotionCorr A", type: "motioncorr", status: "completed", duration: 33000, startedAt: iso(t0 + 1000) },
  { id: "j3", name: "MotionCorr B", type: "motioncorr", status: "completed", duration: 9000, startedAt: iso(t0 + 2000) },
  { id: "j4", name: "Bad Face", type: "class2d", status: "failed", duration: 14000, startedAt: null },
  { id: "j5", name: "Live 2D", type: "class2d", status: "running", duration: 8000, startedAt: iso(t0 + 3000) },
  { id: "j6", name: "Ready 3D", type: "class3d", status: "idle", duration: 8000, startedAt: null },
];
const face = computePace(fixture);

ok("P2 totals — the four counts and the clock sums",
  face.totals.completed === 3 && face.totals.failed === 1 && face.totals.running === 1 && face.totals.idle === 1 &&
  face.totals.totalMs === 42500,
  "total 42500 = 500+33000+9000 (the failed 14000 never enters)");
ok("P3 wall window — first start → last finish",
  face.totals.wallMs === 34000,
  "max(finish)=t0+34000 − min(start)=t0");
ok("P4 median run — the completed set's own median",
  face.totals.medianMs === 9000,
  "500/9000/33000 → 9000");
ok("P5 stages — first-seen chain order, not alphabetical",
  face.stages.map((s) => s.type).join(",") === "import,motioncorr" &&
  face.stages[1].count === 2 && face.stages[1].medianMs === 21000 &&
  face.stages[1].maxMs === 33000 && face.stages[1].totalMs === 42000,
  "motioncorr: median 21000, max 33000, total 42000");
ok("P6 rows — chain order, finishedAt derived, the failed list carries NO clock",
  face.rows.length === 3 &&
  face.rows[0].id === "j1" && face.rows[0].finishedAt === iso(t0 + 500) &&
  face.rows[1].id === "j2" && face.rows[2].id === "j3" &&
  face.failed.length === 1 && face.failed[0].name === "Bad Face" &&
  !("durationMs" in face.failed[0]),
  "a run that never started owns no minutes");

/* the no-clock sort law: a completed job without a clock sorts LAST */
{
  const face2 = computePace([...fixture, { id: "j7", name: "Ghost Clock", type: "import", status: "completed", duration: 100, startedAt: null }]);
  ok("P7 the no-clock completed run sorts last (honest, not first)",
    face2.rows.length === 4 && face2.rows[3].id === "j7" && face2.totals.wallMs === 34000,
    "wall unchanged by the clockless run");
}

/* ---------- E band — the data contract at source ---------- */
console.log("E band — the engine's overwrite contract:");
ok("E the completion write turns simulated duration into REAL elapsed",
  read("src/lib/relion/engine.ts").includes("duration: Math.max(1000, elapsed)"),
  "engine.ts: the pace face's clock source");

/* ---------- D band — the doors at source ---------- */
console.log("D band — the doors:");
{
  const route = read("src/app/api/projects/[id]/pace/route.ts");
  ok("D1 the pace route rides the same-origin guard (the fsc-index sibling)",
    route.includes("isLocalRequest(request)") && route.includes("403"));
  ok("D2 the pace route is FS-FREE (DB clock facts only — cheap at any size)",
    route.includes("computePace") && !route.includes("readFileSync") && !route.includes("readdirSync"));
}
{
  const dlg = read("src/components/workflow/pace-dialog.tsx");
  ok("D3 the dialog's load flight speaks aria-busy, not disabled",
    dlg.includes("aria-busy={open && !data && !error}"));
  ok("D4 the dialog carries ZERO conditional disabled sites (the tally-pin units' numbers stand by construction)",
    !/disabled=\{/.test(dlg));
  ok("D5 the stage table is a real table (th scope=col, thead/tbody)",
    dlg.includes('scope="col"') && dlg.includes("<thead>") && dlg.includes("<tbody>"));
  ok("D6 the bars are pictures; the numbers are always printed",
    /aria-hidden="true"\s+className="h-2\.5 shrink rounded-full/.test(dlg) &&
    dlg.includes("longest {formatElapsed(s.maxMs)}"));
  ok("D7 the export family rides the same stages the bars render (one source, every sink)",
    dlg.includes("ChartExportButtons") && dlg.includes('name="Pipeline pace"') && dlg.includes("getRows="));
  ok("D8 the empty world gets an honest face",
    dlg.includes("Nothing has run yet"));
  ok("D9 the failure band lists names without claiming time",
    dlg.includes("time is not claimed"));
  ok("D10 the live elapsed is mounted-gated (the hydration law)",
    dlg.includes("setMounted(true)") && dlg.includes("mounted ?"));
}
{
  const dash = read("src/components/workflow/project-dashboard.tsx");
  ok("D11 the dashboard gauge button carries the dynamic name (stateful shape)",
    dash.includes("aria-label={`Pipeline pace — ${project.name}`}") &&
    dash.includes("onClick={onRequestPace}"));
}
{
  const pal = read("src/components/workflow/command-palette.tsx");
  ok("D12 the palette item rides the close-then-open handshake",
    pal.includes('"pipeline pace duration analytics how long stage timings wall time speed"') &&
    /setPaceOpen\(true\)/.test(pal));
}

/* ---------- D13–D15: the t1010 selection arm ---------- */
console.log("D band — the selection arm (t1010):");
{
  const card = read("src/components/workflow/job-card.tsx");
  ok("D13 the card's keyboard toggle speaks (Shift+Space before the act branch)",
    /if \(e\.key === " " && e\.shiftKey\) \{\s*\n\s*e\.preventDefault\(\);\s*\n\s*onToggleSelect\(job\.id\);/.test(card),
    "the keyboard users' multi-select (the shift modifier everywhere else)");
  const canvas = read("src/components/workflow/canvas.tsx");
  ok("D14 the toolbar's pace button carries the dynamic scope name",
    canvas.includes("aria-label={`Pace of ${sel.length} selected jobs`}") &&
    canvas.includes('data-testid="toolbar-pace-selection"'));
  const dlg = read("src/components/workflow/pace-dialog.tsx");
  ok("D15 the dialog's local well rides the SAME lib (no fetch, one truth)",
    dlg.includes('import { computePace } from "@/lib/pace"') &&
    dlg.includes("...computePace(jobs)") &&
    dlg.includes("selection (${jobs.length}"));
}

/* ---------- D16–D19: the t1011 receipt + doc rows ---------- */
console.log("R band — the selection's live receipt + the doc rows (t1011):");
{
  const canvas = read("src/components/workflow/canvas.tsx");
  ok("R1 the canvas hosts a polite status region for the selection",
    canvas.includes('data-testid="selection-live-receipt"') &&
    /role="status"[\s\S]{0,80}aria-live="polite"/.test(canvas) &&
    canvas.includes('className="sr-only"'),
    "role=status + aria-live=polite + sr-only (the t999 wall-echo pattern)");
  ok("R2 the receipt is ALWAYS mounted (a live region must precede its change)",
    /^\s*<SelectionLiveReceipt \/>\s*$/m.test(canvas) &&
    !/\{\s*\w+\s*&&\s*<SelectionLiveReceipt/.test(canvas),
    "rendered unconditionally — gating it would mute the first toggle");
  ok("R3 the receipt skips the landing (mount-skip before any string)",
    /if \(!landedRef\.current\) \{\s*\n\s*landedRef\.current = true;\s*\n\s*return;/.test(canvas),
    "the flip-then-bail shape: landing is not an event worth hearing");
  ok("R4 the three count strings are the receipt's whole vocabulary",
    canvas.includes('"Selection cleared"') &&
    canvas.includes('"1 job selected"') &&
    canvas.includes("`${selectedIds.length} jobs selected`"),
    "every count renders a different string — each step re-announces");
  const sd = read("src/components/workflow/shortcuts-dialog.tsx");
  ok("R5 the shortcuts dialog teaches the keyboard verb beside its siblings",
    sd.includes('{ keys: "⇧ Space", text: "Toggle the focused card in the selection — the keyboard\'s shift+click" }'),
    "the doc row seated between ⇧ Click and ⇧ Drag");
  const hg = read("src/components/workflow/help-guide-dialog.tsx");
  ok("R6 the help guide's canvas chapter names Shift+Space and the receipt",
    hg.includes("press Shift+Space to toggle it in the multi-selection") &&
    hg.includes("hears each count change"),
    "the manual never lags the verb");
}

/* ---------- W band — the twin wells ---------- */
console.log("W band — the twin wells (one window law, two readers):");
{
  // The pace face and the analytics panel (the t504 timeline, the t677
  // stage lens) are renderings of ONE window law: [startedAt, startedAt
  // + duration]. timeline-walk.ts is TS-shaped (interfaces + generics)
  // so it does not lift raw — the band pins the LAW AT BOTH SOURCES
  // instead: either reader changing its window arithmetic reddens here,
  // and the faces can never quietly fork.
  ok("W1 the pace well derives finishedAt from the window law",
    read("src/lib/pace.ts").includes("Date.parse(j.startedAt) + j.duration"),
    "pace.ts: finishedAt = start + duration");
  const tw = read("src/lib/timeline-walk.ts");
  ok("W2 the timeline well closes the window on the same law",
    tw.includes("start + Math.max(TIMELINE_MIN_WINDOW_MS, j.duration)") &&
    tw.includes("j.startedAt &&"),
    "timeline-walk.ts: end = start + max(1000, duration)");
  ok("W3 the failed rows keep their timeline windows but claim NO pace",
    face.failed.length === 1 && !face.rows.some((r) => r.id === "j4"),
    "the pace face never turns the failed window into a stage time");
}

/* ---------- the receipt ---------- */
const verdict = fail === 0 ? "GREEN" : "RED";
console.log(`\n${verdict} ${pass}/${pass + fail}`);
try {
  mkdirSync(path.join(ROOT, "shots-qa"), { recursive: true });
  writeFileSync(TMP, JSON.stringify({
    unit: "t1009-pace-unit", verdict, pass, fail, at: new Date().toISOString(),
    face: "pipeline pace (t1009 product face): /api/projects/[id]/pace + pace-dialog + dashboard/palette doors + t1011 selection receipt/doc rows",
  }, null, 2));
} catch { /* receipt best-effort */ }
process.exit(fail === 0 ? 0 : 1);

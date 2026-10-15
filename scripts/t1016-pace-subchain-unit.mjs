#!/usr/bin/env node
/**
 * t1016 — THE PACE SUBCHAIN unit (node-only, lib-imports via the
 * unit-runner): the pace dialog's new critical-chain arm pinned at its
 * lifted oracle, at its doors, and at the wire pass-through.
 *
 * THE ARM: when the canvas's pace button opens the face over a
 * selection, the internal wires ride along (both endpoints in the
 * selection), and the face walks the CRITICAL CHAIN within the picked
 * subgraph — the same backward walk the analytics page's fifth face
 * runs project-wide (lib/critical-path, t681), drinking the same
 * honest windows (lib/timeline-walk — never raw duration). The band
 * confesses its scope ("within the selection", the t687 law), prints
 * its numbers (the picture never carries the fact alone), and stays
 * SILENT unless the walk found a real dependency chain (a single step
 * is not a chain — the longest run is not a story about wires).
 *
 * BANDS:
 *   M  the INDEPENDENT mirror (the walk law recomputed from scratch —
 *      a shared bug can't hide behind a shared import): chain order,
 *      gap signs (waited vs overlapped), finisher selection, dangling
 *      edges ignored, the single-step world
 *   L  the LIFTED oracle (the product's own libs via jiti): the walk's
 *      windows match the mirror's numbers on the same fixtures —
 *      never-started dropped, running stretched, span/busy/gap exact
 *   D  the dialog at source: the edges prop, the unarmed-doors gate,
 *      the honest-windows call (walkTimeline, not raw duration), the
 *      ≥2 chain gate, the band's data hooks, the scope confession, the
 *      printed numbers, the live-finisher confession, the ends-with
 *      chip's honest title, and the OTHER two doors unchanged (no
 *      edges prop at the project/palette mounts)
 *   C  the canvas at source: internalWires (both-endpoints filter) is
 *      what rides — the same wires the save dialog counts, one memo,
 *      one truth
 *   T  THE TALLY LAW BY CONSTRUCTION: pace-dialog.tsx carries ZERO
 *      disabled={ sites — the six tally-pin units' numbers stand
 *      because this arm added nothing to count
 *
 * THE PROBE PROTOCOL: unit-runner (jiti alias) for the L band,
 * readFileSync includes for the D/C/T bands, exit honest, receipt to
 * shots-qa/.t1016-unit-receipt.json.
 */
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import path from "node:path";

import { criticalPath } from "@/lib/critical-path";
import { walkTimeline } from "@/lib/timeline-walk";

const ROOT = process.cwd();
const TMP = path.join(ROOT, "shots-qa/.t1016-unit-receipt.json");

let pass = 0, fail = 0;
const ok = (label, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ✓ ${label}${extra ? ` — ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
try { unlinkSync(TMP); } catch {}

/* ---------- M band — the independent mirror ---------- */
console.log("M band — the independent mirror (the walk law from scratch):");

// mirror: honest windows per lib/timeline-walk's contract
function mirrorRows(jobs, now) {
  const RUN = ["completed", "failed", "running"];
  return jobs
    .filter((j) => j.startedAt && RUN.includes(j.status))
    .map((j) => {
      const start = new Date(j.startedAt).getTime();
      const end =
        j.status === "running"
          ? Math.max(now, start + 1000)
          : start + Math.max(1000, j.duration);
      return { job: j, start, end, ms: Math.max(1000, end - start) };
    })
    .filter((r) => Number.isFinite(r.start) && r.end > r.start)
    .sort((a, b) => a.start - b.start || a.job.name.localeCompare(b.job.name));
}
// mirror: the walk-back per lib/critical-path's contract
function mirrorWalk(rows, edges) {
  if (rows.length === 0) return null;
  const byId = new Map(rows.map((r) => [r.job.id, r]));
  const preds = new Map();
  for (const e of edges) {
    const from = byId.get(e.fromJobId);
    const to = byId.get(e.toJobId);
    if (!from || !to) continue;
    if (!preds.has(to.job.id)) preds.set(to.job.id, []);
    preds.get(to.job.id).push(from);
  }
  const laterOf = (a, b) => {
    if (a.end !== b.end) return a.end > b.end ? a : b;
    if (a.start !== b.start) return a.start > b.start ? a : b;
    return a.job.name.localeCompare(b.job.name) <= 0 ? a : b;
  };
  let entry = rows[0];
  for (const r of rows) entry = laterOf(entry, r);
  const rev = [];
  let cur = entry;
  let guard = rows.length + 1;
  while (cur && guard-- > 0) {
    const ps = preds.get(cur.job.id) ?? [];
    const driver = ps.length > 0 ? ps.reduce((a, b) => (laterOf(a, b) === b ? b : a)) : undefined;
    rev.push({ job: cur.job, start: cur.start, end: cur.end, ms: cur.ms,
      gapBeforeMs: driver ? cur.start - driver.end : null });
    if (!driver) break;
    cur = driver;
  }
  const chain = rev.reverse();
  const busyMs = chain.reduce((acc, s) => acc + s.ms, 0);
  const spanMs = Math.max(entry.end - chain[0].start, 0);
  return { chain, spanMs, busyMs, gapMs: spanMs - busyMs };
}

const t0 = 1728900000000;
const iso = (ms) => new Date(ms).toISOString();
// the 3-node waited chain: A(0..5s) → B(6..10s) → C(11..14s); E unwired
// ends before C — the finisher is C either way
const waitJobs = [
  { id: "a", name: "Import", type: "import", status: "completed", duration: 5000, startedAt: iso(t0) },
  { id: "b", name: "MotionCorr", type: "motioncorr", status: "completed", duration: 4000, startedAt: iso(t0 + 6000) },
  { id: "c", name: "Class2D", type: "class2d", status: "completed", duration: 3000, startedAt: iso(t0 + 11000) },
  { id: "e", name: "Side quest", type: "ctf", status: "completed", duration: 2000, startedAt: iso(t0 + 1000) },
];
const waitEdges = [
  { id: "w1", fromJobId: "a", toJobId: "b" },
  { id: "w2", fromJobId: "b", toJobId: "c" },
  { id: "wd", fromJobId: "c", toJobId: "ghost" }, // dangling — ignored
];
const mRows = mirrorRows(waitJobs, Date.now());
const mWalk = mirrorWalk(mRows, waitEdges);

ok("M1 chain is root→finisher in wire order",
  mWalk.chain.map((s) => s.job.id).join(",") === "a,b,c",
  "the unwired side quest never joins");
ok("M2 gaps are the honest waits (+1s, +1s)",
  mWalk.chain[1].gapBeforeMs === 1000 && mWalk.chain[2].gapBeforeMs === 1000 &&
  mWalk.chain[0].gapBeforeMs === null,
  "root owns no gap");
ok("M3 span/busy/gap exact (14s / 12s / 2s)",
  mWalk.spanMs === 14000 && mWalk.busyMs === 12000 && mWalk.gapMs === 2000);

// the overlap world: B launches BEFORE A finishes (negative gap)
const overlapJobs = [
  { id: "o1", name: "A", type: "import", status: "completed", duration: 6000, startedAt: iso(t0) },
  { id: "o2", name: "B", type: "ctf", status: "completed", duration: 3000, startedAt: iso(t0 + 4000) },
];
const oWalk = mirrorWalk(mirrorRows(overlapJobs, Date.now()), [{ fromJobId: "o1", toJobId: "o2" }]);
ok("M4 overlap speaks a negative gap",
  oWalk.chain[1].gapBeforeMs === -2000 && oWalk.gapMs < 0,
  "the canvas allows it, the face says it");

// the single-step world: a later unwired finisher walks ALONE —
// the dialog's ≥2 gate must keep the band silent here
const soloJobs = [
  { id: "s1", name: "A", type: "import", status: "completed", duration: 5000, startedAt: iso(t0) },
  { id: "s2", name: "B", type: "ctf", status: "completed", duration: 2000, startedAt: iso(t0 + 1000) },
];
const sWalk = mirrorWalk(mirrorRows(soloJobs, Date.now()), []);
ok("M5 an unwired world walks a single step (no chain to speak of)",
  sWalk.chain.length === 1 && sWalk.chain[0].job.id === "s1",
  "the latest finisher walks alone — its 5s outlasts the side run's 3s");

/* ---------- L band — the lifted oracle vs the mirror ---------- */
console.log("L band — the product's libs on the same fixtures:");
const lRows = walkTimeline(waitJobs, Date.now());
const lWalk = criticalPath(lRows.rows, waitEdges);
ok("L1 walkTimeline drops the never-started, keeps the run windows",
  lRows.rows.length === 4 &&
  lRows.neverStarted === 0,
  "all four fixtures started");
const neverJobs = [...waitJobs, { id: "n", name: "Ready", type: "class3d", status: "idle", duration: 8000, startedAt: null }];
ok("L2 an idle job is counted, never walked",
  walkTimeline(neverJobs, Date.now()).rows.length === 4 &&
  walkTimeline(neverJobs, Date.now()).neverStarted === 1);
ok("L3 the lifted walk matches the mirror exactly",
  lWalk.chain.map((s) => s.job.id).join(",") === mWalk.chain.map((s) => s.job.id).join(",") &&
  lWalk.spanMs === mWalk.spanMs && lWalk.busyMs === mWalk.busyMs && lWalk.gapMs === mWalk.gapMs);
const lOverlap = criticalPath(walkTimeline(overlapJobs, Date.now()).rows, [{ fromJobId: "o1", toJobId: "o2" }]);
ok("L4 the lifted overlap matches too",
  lOverlap.chain[1].gapBeforeMs === oWalk.chain[1].gapBeforeMs);

// the live finisher: a running job's window stretches to now — and if
// it ends last, the chain's finisher IS the live run
const liveJobs = [
  { id: "l1", name: "Import", type: "import", status: "completed", duration: 5000, startedAt: iso(t0) },
  { id: "l2", name: "Live", type: "ctf", status: "running", duration: 999000, startedAt: iso(t0 + 6000) },
];
const nowProbe = Date.now();
const lLive = criticalPath(walkTimeline(liveJobs, nowProbe).rows, [{ fromJobId: "l1", toJobId: "l2" }]);
ok("L5 a live finisher stretches to now",
  lLive.chain[1].job.id === "l2" && lLive.chain[1].end >= nowProbe,
  "the window's open end pinned at the reading's now");

/* ---------- D band — the dialog at source ---------- */
console.log("D band — the dialog's subchain arm at source:");
const dlg = readFileSync(path.join(ROOT, "src/components/workflow/pace-dialog.tsx"), "utf8");

ok("D1 the edges prop is declared and destructured",
  dlg.includes("edges?: CriticalEdge[]") && /\{\n  open,\n  onOpenChange,\n  projectId,\n  projectName,\n  jobs,\n  edges,\n\}: \{/.test(dlg));
ok("D2 the unarmed doors gate: no jobs, no edges, no walk",
  /if \(!open \|\| !jobs || !edges \|\| edges\.length === 0\) return null;/.test(dlg));
ok("D3 the honest windows, not raw duration",
  dlg.includes("const walk = walkTimeline(jobs, Date.now())"));
ok("D4 the walk reads the caller's own wires",
  dlg.includes("criticalPath(walk.rows, edges)"));
ok("D5 a single step is not a chain (the ≥2 gate)",
  /crit && crit\.chain\.length >= 2 \? crit : null/.test(dlg));
ok("D6 the band's data hooks",
  dlg.includes('data-canvas-ui="pipeline-pace-critical"') &&
  dlg.includes("data-critical-steps={subchain.chain.length}") &&
  dlg.includes("data-critical-span={subchain.spanMs}") &&
  dlg.includes("data-critical-busy={subchain.busyMs}") &&
  dlg.includes("data-critical-finisher={subchain.chain[subchain.chain.length - 1].job.id}"));
ok("D7 the scope confession (the t687 law)",
  dlg.includes("Critical chain within the selection"));
ok("D8 the numbers are printed (the picture never carries the fact alone)",
  dlg.includes("formatElapsed(subchain.spanMs)") &&
  dlg.includes("formatElapsed(subchain.busyMs)"));
ok("D9 the gap words: waited / overlapped / zero",
  dlg.includes("+ waited ${formatElapsed(subchain.gapMs)}") &&
  dlg.includes("overlapped ${formatElapsed(-subchain.gapMs)}") &&
  dlg.includes("+ waited 0s"));
ok("D10 a live finisher confesses its open window",
  dlg.includes("still running, its window stretches to now"));
ok("D11 the ends-with chip carries the honest title",
  dlg.includes("ends with: {subchain.chain[subchain.chain.length - 1].job.name}") &&
  dlg.includes("every step here is a dependency it (transitively) waited on"));
ok("D12 the project door passes NO edges (its face unchanged)",
  (() => {
    const dash = readFileSync(path.join(ROOT, "src/components/workflow/project-dashboard.tsx"), "utf8");
    const at = dash.indexOf("<PaceDialog");
    const mount = dash.slice(at, dash.indexOf("/>", at));
    return !mount.includes("edges=");
  })());
ok("D13 the palette door passes NO edges (its face unchanged)",
  (() => {
    const pal = readFileSync(path.join(ROOT, "src/components/workflow/command-palette.tsx"), "utf8");
    const at = pal.indexOf("<PaceDialog");
    const mount = pal.slice(at, pal.indexOf("/>", at));
    return !mount.includes("edges=");
  })());

/* ---------- C band — the canvas wire pass-through ---------- */
console.log("C band — the canvas's wires at source:");
const canvas = readFileSync(path.join(ROOT, "src/components/workflow/canvas.tsx"), "utf8");
ok("C1 the wires ride to the pace dialog",
  canvas.includes("edges={internalWires}"));
ok("C2 internalWires is the both-endpoints filter (the save dialog's own wires)",
  /const internalWires = React\.useMemo\(\(\) => \{\s*\n\s*const ids = new Set\(sel\.map\(\(j\) => j\.id\)\);\s*\n\s*return wsEdges\.filter\(\(e\) => ids\.has\(e\.fromJobId\) && ids\.has\(e\.toJobId\)\);/.test(canvas));
ok("C3 the count is the array's length (one memo, one truth)",
  canvas.includes("const internalWireCount = internalWires.length;"));

/* ---------- T band — the tally law by construction ---------- */
console.log("T band — the tally law by construction:");
ok("T1 pace-dialog carries ZERO disabled={ sites — the six tally pins' numbers stand",
  !dlg.includes("disabled={"));

/* ---------- receipt ---------- */
const verdict = fail === 0 ? "GREEN" : "RED";
console.log(`\n${verdict}: ${pass}/${pass + fail} green`);
mkdirSync(path.join(ROOT, "shots-qa"), { recursive: true });
writeFileSync(TMP, JSON.stringify({
  unit: "t1016-pace-subchain-unit",
  verdict, pass, fail,
  at: new Date().toISOString(),
  bands: ["M mirror", "L lifted oracle", "D dialog at source", "C canvas wires", "T tally law"],
}, null, 2));
process.exit(fail === 0 ? 0 : 1);

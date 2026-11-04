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
 *      never-started dropped, running stretched, span/busy/gap exact;
 *      the summarizeCritical projection (t1017) preserves the walk's
 *      numbers and names verbatim
 *   D  the dialog at source: the edges prop, the unarmed-doors gate,
 *      the honest-windows call (walkTimeline, not raw duration), the
 *      ≥2 chain gate, the band's data hooks, the scope confession (the
 *      selection's word AND the project's word — the t687 law), the
 *      printed numbers, the live-finisher confession, the ends-with
 *      chip's honest title, the TWO-TRANSPORTS merge (the memo or the
 *      route's chain — one band), the local well's critical:null (the
 *      two never double-speak), the STEP ROSTER (t1018 — rank, printed
 *      window, the per-row gap words, the running step's "so far",
 *      the root's no-gap gate, the chainWalk.chain source), and the
 *      canvas door's wire pass-through
 *   R  the ROUTE at source (t1017 — the project arm): the same libs
 *      (walkTimeline + criticalPath + summarizeCritical), the
 *      project-scoped edges query, the same ≥2 gate, the response
 *      shipping `critical`, still FS-FREE
 *   C  the canvas at source: internalWires (both-endpoints filter) is
 *      what rides — the same wires the save dialog counts, one memo,
 *      one truth
 *   X  the EXPORT FACE (t1019 — the data doors at the chain's scale):
 *      the band's own ChartExportButtons with png={false} (a list owns
 *      no <svg> — the PNG doors are ABSENT, never disabled), getRows
 *      mapping the SAME chainWalk.chain the roster renders (one
 *      source, every sink), the root's gap cell empty (the i > 0 gate
 *      made law in the file), and the component omitting — never
 *      disabling — the PNG doors under the png prop
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

import { criticalPath, summarizeCritical } from "@/lib/critical-path";
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

// t1017 — the projection: one shape both transports speak
const lSummary = summarizeCritical(lWalk);
ok("L6 summarizeCritical preserves the walk verbatim",
  lSummary.spanMs === lWalk.spanMs && lSummary.busyMs === lWalk.busyMs &&
  lSummary.gapMs === lWalk.gapMs &&
  lSummary.chain.map((s) => s.id).join(",") === lWalk.chain.map((s) => s.job.id).join(",") &&
  lSummary.chain.map((s) => s.name).join("|") === lWalk.chain.map((s) => s.job.name).join("|") &&
  lSummary.chain.every((s, i) => s.status === lWalk.chain[i].job.status &&
    s.start === lWalk.chain[i].start && s.end === lWalk.chain[i].end &&
    s.ms === lWalk.chain[i].ms && s.gapBeforeMs === lWalk.chain[i].gapBeforeMs),
  "span/busy/gap + every step's id, name, status, window, gap — no drift");

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
ok("D5 a single step is not a chain (the ≥2 gate, projected)",
  /crit && crit\.chain\.length >= 2 \? summarizeCritical\(crit\) : null/.test(dlg));
ok("D6 the band's data hooks",
  dlg.includes('data-canvas-ui="pipeline-pace-critical"') &&
  dlg.includes("data-critical-steps={chainWalk.chain.length}") &&
  dlg.includes("data-critical-span={chainWalk.spanMs}") &&
  dlg.includes("data-critical-busy={chainWalk.busyMs}") &&
  dlg.includes("data-critical-finisher={chainFinisher.id}"));
ok("D7 the scope confession — the selection's word",
  dlg.includes("Critical chain within the selection"));
ok("D8 the numbers are printed (the picture never carries the fact alone)",
  dlg.includes("formatElapsed(chainWalk.spanMs)") &&
  dlg.includes("formatElapsed(chainWalk.busyMs)"));
ok("D9 the gap words: waited / overlapped / zero",
  dlg.includes("+ waited ${formatElapsed(chainWalk.gapMs)}") &&
  dlg.includes("overlapped ${formatElapsed(-chainWalk.gapMs)}") &&
  dlg.includes("+ waited 0s"));
ok("D10 a live finisher confesses its open window",
  dlg.includes("still running, its window stretches to now"));
ok("D11 the ends-with chip carries the honest title",
  dlg.includes("ends with: {chainFinisher.name}") &&
  dlg.includes("every step here is a dependency it (transitively) waited on"));
ok("D12 the project door passes NO edges prop (the arm rides the transport)",
  (() => {
    const dash = readFileSync(path.join(ROOT, "src/components/workflow/project-dashboard.tsx"), "utf8");
    const at = dash.indexOf("<PaceDialog");
    const mount = dash.slice(at, dash.indexOf("/>", at));
    return !mount.includes("edges=");
  })());
ok("D13 the palette door passes NO edges prop (the arm rides the transport)",
  (() => {
    const pal = readFileSync(path.join(ROOT, "src/components/workflow/command-palette.tsx"), "utf8");
    const at = pal.indexOf("<PaceDialog");
    const mount = pal.slice(at, pal.indexOf("/>", at));
    return !mount.includes("edges=");
  })());
ok("D14 the two transports, one band (the memo or the route's chain)",
  dlg.includes("const chainWalk = subchain ?? data?.critical ?? null;"));
ok("D15 the project scope word (the t687 law for the fetch doors)",
  dlg.includes('"Critical chain of this project"'));
ok("D16 the local well ships critical:null — the two never double-speak",
  dlg.includes("setData({ projectId: \"\", critical: null, ...computePace(jobs) });"));
ok("D17 the step roster exists (t1018 — the chain at dialog scale)",
  dlg.includes('data-canvas-ui="pipeline-pace-critical-roster"'));
ok("D18 every step prints its own window",
  dlg.includes("{formatElapsed(s.ms)}"));
ok("D19 the roster's gap words per row (the analytics dialect)",
  dlg.includes("+ waited ${formatElapsed(s.gapBeforeMs)}") &&
  dlg.includes("overlapped ${formatElapsed(-s.gapBeforeMs)}"));
ok("D20 a running step confesses \"so far\" (its window stretches)",
  dlg.includes('so far</span>'));
ok("D21 the root owns no gap (the i > 0 gate)",
  /\{i > 0 && s\.gapBeforeMs != null\s*\?/.test(dlg));
ok("D22 the roster reads chainWalk.chain (both transports feed it) + the per-row hooks",
  dlg.includes("chainWalk.chain.map((s, i)") &&
  dlg.includes('data-critical-row={s.id}') &&
  dlg.includes('data-critical-index={i}') &&
  dlg.includes('data-critical-gap={s.gapBeforeMs}'));

/* ---------- R band — the route at source (t1017, the project arm) ---------- */
console.log("R band — the project's server-side walk at source:");
const route = readFileSync(path.join(ROOT, "src/app/api/projects/[id]/pace/route.ts"), "utf8");
ok("R1 the route rides the SAME libs (one law, two transports)",
  route.includes('walkTimeline') && route.includes('criticalPath') && route.includes('summarizeCritical'));
ok("R2 the edges query is project-scoped",
  route.includes("db.edge.findMany") && route.includes("where: { projectId: id }"));
ok("R3 the same ≥2 gate at the route (a single step is not a chain)",
  /crit && crit\.chain\.length >= 2 \? summarizeCritical\(crit\) : null/.test(route));
ok("R4 the response ships `critical`",
  route.includes("{ projectId: id, ...face, critical }"));
ok("R5 still FS-FREE (the walk reads clocks + edges, never a workdir)",
  !route.includes("readFileSync") && !route.includes("readdirSync"));

/* ---------- C band — the canvas wire pass-through ---------- */
console.log("C band — the canvas's wires at source:");
const canvas = readFileSync(path.join(ROOT, "src/components/workflow/canvas.tsx"), "utf8");
ok("C1 the wires ride to the pace dialog",
  canvas.includes("edges={internalWires}"));
ok("C2 internalWires is the both-endpoints filter (the save dialog's own wires)",
  /const internalWires = React\.useMemo\(\(\) => \{\s*\n\s*const ids = new Set\(sel\.map\(\(j\) => j\.id\)\);\s*\n\s*return wsEdges\.filter\(\(e\) => ids\.has\(e\.fromJobId\) && ids\.has\(e\.toJobId\)\);/.test(canvas));
ok("C3 the count is the array's length (one memo, one truth)",
  canvas.includes("const internalWireCount = internalWires.length;"));

/* ---------- X band — the export face (t1019, the data doors) ---------- */
console.log("X band — the export face (the data doors at the chain's scale):");
const ceb = readFileSync(path.join(ROOT, "src/components/workflow/results/chart-export-buttons.tsx"), "utf8");
ok("X1 the band carries its own export face (name=\"Critical chain\")",
  dlg.includes('name="Critical chain"'));
ok("X2 the face confesses its dialect — png={false} (the two DATA doors only)",
  dlg.includes("png={false}"));
ok("X3 one source, every sink — getRows maps the SAME chainWalk.chain the roster renders",
  (dlg.match(/chainWalk\.chain\.map\(\(s, i\)/g) || []).length === 2);
ok("X4 the export's root owns no gap — the i > 0 gate lives in the file too",
  (dlg.match(/i > 0 && s\.gapBeforeMs != null/g) || []).length === 2);
ok("X5 the component OMITS the PNG doors under {png ? ( — twice — and defaults them on",
  (ceb.match(/\{png \? \(/g) || []).length === 2 && ceb.includes("png = true"));
ok("X6 the seconds dialect — window/gap columns round like the stage table (one formatter's law)",
  dlg.includes('"window (s)"') && dlg.includes('"gap before (s)"') &&
  /"window \(s\)": Math\.round\(s\.ms \/ 100\) \/ 10/.test(dlg));

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
  bands: ["M mirror", "L lifted oracle + projection", "D dialog at source", "R route at source", "C canvas wires", "X export face", "T tally law"],
}, null, 2));
process.exit(fail === 0 ? 0 : 1);

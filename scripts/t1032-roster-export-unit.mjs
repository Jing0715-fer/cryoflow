#!/usr/bin/env node
/**
 * t1032-roster-export-unit — the job roster's data doors' instrument.
 *
 * The t1032 window continues the product line: the t1019/t1028/t1029/
 * t1030/t1031 grammar chain visits its SIXTH seat — the dashboard's
 * spotlight roster, the project's paper (Task 84 made it a REAL <table>
 * for print — the printed roster is the management summary) whose rows
 * could not leave as bytes. The cure, two cars:
 *   1. src/lib/roster-export.ts — the roster's ONE father: ROSTER_HEAD
 *      (the row's own facts: Job / Type / Status / Workspace / Detail —
 *      the name-address law at the roster, the type's portrait SPOKEN),
 *      rosterDetailLine (the row's second line — one formula, two
 *      surfaces: the t322 queued dialect, the Task 142 composition
 *      "42% · 12m 05s · ~12m", the compact stay receipt, "not started",
 *      the —), and rosterRows (the row builder — the workspace cell's
 *      three faces: the chip's name, the orphan's "Unassigned", the —).
 *      The client-bound ETA arm (estimateEta reads pace baselines)
 *      arrives as an injected `etaOf` — the lib stays pure.
 *   2. project-dashboard.tsx — the jobs label row mounts the doors
 *      (png={false}: a list owns no <svg> — the t1019 two-door dialect),
 *      getRows drinks rosterDisplay (the rows the section SPEAKS — the
 *      t1031 spoken-rows law: the filtered, searched slice, newest-first,
 *      the order the printed thead names), and the doors take the right
 *      edge (ml-auto) beside the Open workflow verb.
 *   The twin retirement rides along: formatEta moves to lib/elapsed.ts
 *   (its PREDICTION twin formatElapsed's home — annotation-free, the
 *   strip-eval oracle unbroken) with job-card re-exporting so every
 *   importer's path and this file's own call sites stay unchanged (the
 *   t1030 twin-retirement law's const-alias shape).
 *
 * F band — source pins on both cars (the laws' words in the sources).
 * B band — the fixture ride: every detail arm cell for cell (the queued
 *          words, the composition, the receipt, the honest —), the
 *          workspace cell's three faces, the type's catalog word and the
 *          stranger fallback, the keys are the paper's heads in the
 *          paper's order, the caller's order preserved (the builder never
 *          re-sorts), the strip-eval oracle still lifting the elapsed
 *          twins, and the honest guards refuse null/empty.
 *
 * Census slot 48. Run: node scripts/unit-runner.mjs scripts/t1032-roster-export-unit.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = "/home/z/my-project";
const LIB = path.join(ROOT, "src/lib/roster-export.ts");
const COMP = path.join(ROOT, "src/components/workflow/project-dashboard.tsx");
const CARD = path.join(ROOT, "src/components/workflow/job-card.tsx");
const ELAPSED = path.join(ROOT, "src/lib/elapsed.ts");

let pass = 0, fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}${extra ? `  ${extra}` : ""}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); };
};

const { ROSTER_HEAD, rosterRows, rosterDetailLine } = await import(
  path.join(ROOT, "src/lib/roster-export.ts")
);

console.log("== t1032 roster export unit ==");

// ---------- F band: the cure's words in the sources ----------
console.log("-- F band: source pins --");
const lib = readFileSync(LIB, "utf8");
const comp = readFileSync(COMP, "utf8");
const card = readFileSync(CARD, "utf8");
const elapsed = readFileSync(ELAPSED, "utf8");

// 1. the head is the paper's own five words, in the row's order
ok("lib: ROSTER_HEAD is the row's own facts in the row's order",
  JSON.stringify(ROSTER_HEAD) === JSON.stringify(["Job", "Type", "Status", "Workspace", "Detail"]),
  ROSTER_HEAD.join(" | "));

// 2. the t322 queued dialect rides the cell, verbatim from the row's JSX
ok("lib: the queued line speaks the dependency words verbatim",
  lib.includes("`queued · waits on ${job.runRemote.slurmDependsOn.join(\", \")}`"));
ok("lib: the queued line's no-deps word verbatim",
  lib.includes('"queued · waiting for the scheduler"'));

// 3. the Task 142 composition: progress, then fact, then prediction — each arm gated
ok("lib: the running line composes progress · elapsed · eta with honest gates",
  /if \(rowElapsed > 0\) line \+= ` · \$\{formatElapsed\(rowElapsed\)\}`;/.test(lib) &&
  /if \(eta != null\) line \+= ` · \$\{formatEta\(eta\)\}`;/.test(lib));

// 4. the display-economy law: no truncation in the lib — the … never travels
ok("lib: NO truncation in the lib (the CSV speaks the value the cell MEANS)",
  !lib.includes(".slice("), "the truncate is width, not meaning");

// 5. the type cell speaks the portrait's NAME; a stranger falls to the machine key
ok("lib: the Type cell speaks the catalog label, stranger falls to the key",
  lib.includes("jobType(job.type)?.label ?? job.type"));

// 6. the workspace cell's three faces: chip name / Unassigned / —
ok("lib: the Workspace cell speaks the chip's name, the orphan's word, or the —",
  lib.includes('wsName ?? (orphan ? "Unassigned" : "—")'));

// 7. the status word rides isSlurmQueued (the t322 dialect at the cell)
ok("lib: the Status cell rides isSlurmQueued (queued, never a false running)",
  lib.includes('isSlurmQueued(job) ? "queued" : job.status'));

// 8. the builder's honest guard
ok("lib: rosterRows refuses null/empty (the honest disabled face)",
  /if \(!jobs \|\| jobs\.length === 0\) return null;/.test(lib));

// 9. the receipt is the stay-receipt's own father, never re-typed
ok("lib: compactStayReceipt imported (one father, many drinkers)",
  lib.includes('import { compactStayReceipt } from "@/lib/remote/stay-receipt";'));

// 10. the twins share one roof: formatElapsed AND formatEta from the lib
ok("lib: the elapsed twins imported from @/lib/elapsed (the retirement's home)",
  lib.includes('import { formatElapsed, formatEta } from "@/lib/elapsed";'));

// 11. the twin retirement: formatEta LIVES in elapsed.ts, annotation-free
ok("elapsed: formatEta retired beside its fact twin (annotation-free, the oracle's law)",
  /export function formatEta\(ms\) \{/.test(elapsed) &&
  !/export function formatEta\(ms: number\)/.test(elapsed));

// 12. job-card re-exports so every path AND its own call sites stay unchanged
ok("job-card: the const-alias re-export (import + export, call sites unchanged)",
  /import \{ formatEta \} from "@\/lib\/elapsed";/.test(card) &&
  /export \{ formatEta \};/.test(card));

// 13. the component mounts the doors in the two-door dialect
ok("comp: ChartExportButtons imported (the shared doors)",
  comp.includes('import { ChartExportButtons } from "@/components/workflow/results/chart-export-buttons";'));
ok("comp: the door's name is the section's own word (Job roster)",
  comp.includes('name="Job roster"'));
ok("comp: png={false} — a list owns no <svg>, the PNG doors ABSENT never disabled (the t1019 dialect)",
  /name="Job roster"[\s\S]{0,80}png=\{false\}/.test(comp));
ok("comp: getRows drinks the lib's builder (one father, two faces)",
  comp.includes("getRows={() =>") && comp.includes("rosterRows(rosterDisplay, {"));

// 14. the spoken-rows law: the door exports rosterDisplay — newest-first,
//     the order the printed thead names
ok("comp: getRows drinks rosterDisplay (the spoken rows, the thead's order)",
  comp.includes("rosterRows(rosterDisplay, {"));

// 15. the ETA arm injected at click time — the lib stays pure
ok("comp: the etaOf injection (estimateEta at click time, the baselines stay client-side)",
  comp.includes("etaOf: (j) => estimateEta(j.id, j.startedAt, j.progress)"));

// 16. the door sits in the jobs label row, right edge (ml-auto), before the verb
const labelIdx = comp.indexOf('data-spot-jobslabel=""');
const doorIdx = comp.indexOf("<ChartExportButtons");
const verbIdx = comp.indexOf("Open workflow", doorIdx); // the verb BESIDE the door (the label row's) — the word also lives on the project card's switch button far above
ok("comp: the doors mount in the label row, right edge, before the Open-workflow verb",
  labelIdx > -1 && doorIdx > labelIdx && verbIdx > doorIdx && doorIdx - labelIdx < 3600);
ok("comp: the doors take ml-auto (the right edge the verb yielded)",
  comp.includes('className="no-print ml-auto"'));

// ---------- B band: the fixture ride ----------
console.log("-- B band: the fixture ride --");

const NOW = 1_800_000_000_000; // a fixed clock — the ride never races
const ws = [{ id: "ws1", name: "Main" }];
const mk = (over) => ({
  id: "job_x",
  name: "Job X",
  type: "import",
  status: "completed",
  progress: 100,
  startedAt: null,
  result: "42 particles",
  workspaceId: "ws1",
  runRemote: null,
  remoteRemaining: null,
  ...over,
});
const etaOf = () => null; // the ride's quiet clock — the ETA arm rides its own fixtures

// the head order — the keys are the paper's heads in the paper's order
const rows = rosterRows([mk()], { workspaces: ws, now: NOW, etaOf });
ok("ride: the keys are ROSTER_HEAD in order",
  rows && JSON.stringify(Object.keys(rows[0])) === JSON.stringify(ROSTER_HEAD));

// the caller's order is the builder's order — newest-first is the CALLER's word
const two = rosterRows([mk({ id: "b", name: "B" }), mk({ id: "a", name: "A" })], { workspaces: ws, now: NOW, etaOf });
ok("ride: the builder preserves the caller's order (it never re-sorts)",
  two && two[0].Job === "B" && two[1].Job === "A");

// the type cell: the catalog's label word; a stranger falls to the machine key
ok("ride: the type cell speaks the catalog label",
  rows[0].Type === "Import Movies / Micrographs / Particles", rows[0].Type);
ok("ride: a stranger type falls to the machine key",
  rosterRows([mk({ type: "alien_xx" })], { workspaces: ws, now: NOW, etaOf })[0].Type === "alien_xx");

// the status cell: the badge's display word
ok("ride: the status cell speaks the badge's word (completed)",
  rows[0].Status === "completed");

// the workspace cell — three faces
ok("ride: the workspace cell speaks the chip's name",
  rows[0].Workspace === "Main");
ok("ride: the orphan row speaks the chip's word (Unassigned)",
  rosterRows([mk({ workspaceId: null })], { workspaces: ws, now: NOW, etaOf })[0].Workspace === "Unassigned");
ok("ride: a workspace-less project prints no chip — the —",
  rosterRows([mk({ workspaceId: null })], { workspaces: [], now: NOW, etaOf })[0].Workspace === "—");

// the detail arms — the queued dialect
ok("ride: slurm-queued with deps speaks the wait words verbatim",
  rosterRows([mk({
    status: "running",
    runRemote: { mode: "slurm", slurmState: "PENDING", slurmDependsOn: ["Motion Correction 1", "CTF Estimation 1"] },
  })], { workspaces: ws, now: NOW, etaOf })[0].Detail === "queued · waits on Motion Correction 1, CTF Estimation 1");
const qRow = rosterRows([mk({ status: "running", runRemote: { mode: "slurm", slurmState: "PENDING" } })], { workspaces: ws, now: NOW, etaOf })[0];
ok("ride: slurm-queued without deps speaks the scheduler word",
  qRow.Detail === "queued · waiting for the scheduler");
ok("ride: the queued STATUS (never a false running)",
  qRow.Status === "queued");

// the running composition — progress · elapsed · eta
ok("ride: the running line composes 42% · 12m 05s · ~12m",
  rosterDetailLine(
    mk({ status: "running", progress: 42.4, startedAt: new Date(NOW - 725_000).toISOString() }),
    { now: NOW, etaOf: () => 720_000 }
  ) === "42% · 12m 05s · ~12m");
ok("ride: a fresh clock (elapsed 0) speaks progress only",
  rosterDetailLine(
    mk({ status: "running", progress: 42, startedAt: new Date(NOW).toISOString() }),
    { now: NOW, etaOf: () => 720_000 }
  ) === "42% · ~12m");
ok("ride: an unobservable pace speaks no ETA arm",
  rosterDetailLine(
    mk({ status: "running", progress: 42, startedAt: new Date(NOW - 725_000).toISOString() }),
    { now: NOW, etaOf: () => null }
  ) === "42% · 12m 05s");
ok("ride: no start, no clock — progress only",
  rosterDetailLine(mk({ status: "running", progress: 42, startedAt: null }), { now: NOW }) === "42%");

// the receipt arms
ok("ride: a result speaks untouched (no remaining truth — the no-flicker law)",
  rosterRows([mk({ result: "CtfRefine done · 96 particles" })], { workspaces: ws, now: NOW })[0].Detail
    === "CtfRefine done · 96 particles");
ok("ride: the stay receipt's remaining-0 word travels",
  rosterRows([mk({ result: "96 particles extracted — 2 image file(s) stayed on the cluster (bring them home from the Files tab)", remoteRemaining: { remaining: 0 } })], { workspaces: ws, now: NOW })[0].Detail
    === "96 particles extracted · all brought home");
ok("ride: the stay receipt's remaining-2 word travels",
  rosterRows([mk({ result: "96 particles extracted — 2 image file(s) stayed on the cluster (bring them home from the Files tab)", remoteRemaining: { remaining: 2 } })], { workspaces: ws, now: NOW })[0].Detail
    === "96 particles extracted · 2 still on cluster");

// the honest words
ok("ride: idle speaks 'not started'",
  rosterRows([mk({ status: "idle", result: null })], { workspaces: ws, now: NOW, etaOf })[0].Detail === "not started");
ok("ride: a resultless non-idle speaks the —",
  rosterRows([mk({ status: "pending", result: null })], { workspaces: ws, now: NOW, etaOf })[0].Detail === "—");

// the guards
ok("ride: a null roster refuses", rosterRows(null, { workspaces: ws, now: NOW }) === null);
ok("ride: an empty roster refuses", rosterRows([], { workspaces: ws, now: NOW }) === null);

// the strip-eval oracle still lifts the elapsed file — BOTH twins ride it
const lifted = readFileSync(ELAPSED, "utf8")
  .replace(/^import .*$/gm, "")
  .replace(/export /g, "");
const ns = new Function(`${lifted}; return { formatElapsed, formatEta };`)();
ok("oracle: formatElapsed still answers (42s / 1m 05s / 1h 04m)",
  ns.formatElapsed(42_000) === "42s" &&
  ns.formatElapsed(65_000) === "1m 05s" &&
  ns.formatElapsed(3_845_000) === "1h 04m");
ok("oracle: formatEta answers beside its twin (~45s / ~12m / ~3h 6m)",
  ns.formatEta(45_000) === "~45s" &&
  ns.formatEta(720_000) === "~12m" &&
  ns.formatEta(11_130_000) === "~3h 6m");

console.log(`\n${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

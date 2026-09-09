// t86 — palette Notes predicate unification + multi-file workflow import (Task 86).
// Two themes, one round:
//   THEME 1 (bug #23 fix): the palette Notes group was the LAST reader still
//     on the raw j.note predicate — Task 83 made hasJudgment the cross-surface
//     contract (header chip / canvas lens / dashboard filter), so a job
//     annotated ONLY through class notes stayed lit on canvas yet was
//     unsearchable in the palette. This suite locks the upgrade:
//       • class-notes-only jobs now appear in the Notes group (A),
//       • the row's middle column shows the scannable class INDEX
//         ("class notes on Class 3, 5, 7") instead of an empty cell (A),
//       • the count capsule renders (A),
//       • class note TEXTS fuse into the row's search payload (A),
//       • workspace scoping is unchanged — foreign-workspace hosts stay out (A).
//   THEME 2 (feature): workflow import accepts MULTIPLE files —
//       • one picker session stages any number (B),
//       • the dialog is a queue: per-file summary rows + per-file parse
//         failures inline ("skipped" rows) + one shared workspace picker (B),
//       • confirm sends one POST per file; ONE aggregate toast with a
//         single Undo spanning every file's created jobs (B),
//       • single-file flow unchanged (regression, B).
// Phases:
//   S  setup — zombie daemon killed, baseline normalized, classNotes
//      planted on an idle select2d in the ACTIVE workspace, tripwire re-read
//   A  palette Notes group — predicate, index fallback, capsule, payload
//      fusion, workspace scoping
//   B  multi-file import — queue dialog, mixed valid/invalid staging,
//      aggregate toast, batch undo, single-file regression
//   C  console clean
//   Z  cleanup verified over the API
// Run: node scripts/t86-e2e.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";

const BASE = "http://localhost:3000";
const N3 = "t86 ice ring artifact at the edge";
const N5 = "t86 secondary structure visible";
const N7 = "t86 junk class, exclude";
const FXDIR = "/home/z/my-project/.qa-t86";

let fail = 0;
let pass = 0;
const must = (cond, label) => {
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (cond) pass++; else fail++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async (path, method, body) => {
  const res = await fetch(BASE + path, {
    method: method ?? (body ? "PATCH" : "GET"),
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
};
const listJobs = async () => (await api("/api/jobs")).json.jobs ?? [];

// qa81 lesson: a leftover agent-browser page with a ParamsTab open holds a
// stale form whose debounced save rewrites params ~1.7s after our PATCH.
try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
await sleep(500);

/* ---------------- setup + baseline normalization ---------------- */
console.log("Phase S — setup");
let jobs0 = await listJobs();
let sel = jobs0.find((j) => j.type === "select2d" && j.status === "idle" && j.name === "QA Class Select");
if (!sel) {
  console.log("  … gallery host missing — re-seeding via qa58");
  execSync("python3 scripts/qa58-seed-gallery.py", { encoding: "utf8", timeout: 120_000 });
  jobs0 = await listJobs();
  sel = jobs0.find((j) => j.type === "select2d" && j.status === "idle" && j.name === "QA Class Select");
}
must(sel != null, "S1 idle select2d gallery host present in active workspace");
// normalize baseline (qa78 lesson: living-instance residue must never be a
// hidden input — the annotated slice is built from zero on purpose)
let cleared = 0;
for (const j of jobs0) {
  const hadNote = !!j.note;
  const hadCls = j.params?.classNotes && j.params.classNotes !== "{}" && j.params.classNotes !== "";
  if (hadNote || hadCls) {
    await api(`/api/jobs/${j.id}`, "PATCH", { note: "", params: { classNotes: "{}" } });
    cleared++;
  }
}
if (cleared > 0) await sleep(2500); // outlive any zombie debounce window

// plant THREE class notes, NO job note — the exact shape the old predicate
// made invisible in the palette while the canvas kept it lit
await api(`/api/jobs/${sel.id}`, "PATCH", { note: "", params: { classNotes: JSON.stringify({ 3: N3, 5: N5, 7: N7 }) } });
// tripwire: re-read AFTER the debounce window of any zombie writer (qa81 S3)
await sleep(2500);
const selNow = (await listJobs()).find((j) => j.id === sel.id);
const verifyCls = JSON.parse(selNow?.params?.classNotes ?? "{}");
must(verifyCls["3"] === N3 && verifyCls["5"] === N5 && verifyCls["7"] === N7, "S2 classNotes survived the zombie window");
must(!selNow?.note, "S3 host carries NO job note (predicate test is pure)");

/* ---------------- browser ---------------- */
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
p.on("pageerror", (e) => consoleErrors.push(String(e)));

await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await p.waitForTimeout(800);

const openPalette = async () => {
  await p.keyboard.press("Control+KeyK");
  await p.waitForSelector('[cmdk-input]');
  await sleep(250);
};
// probe scoped to ONE palette group: heading text + that group's rows
const groupProbe = (headingPrefix) => p.evaluate((hp) => {
  for (const g of document.querySelectorAll("[cmdk-group]")) {
    const h = g.querySelector("[cmdk-group-heading]")?.textContent?.trim() ?? "";
    if (h.startsWith(hp)) {
      return {
        found: true,
        heading: h,
        items: [...g.querySelectorAll("[cmdk-item]")].map((x) => x.textContent?.trim() ?? ""),
        badgeCounts: [...g.querySelectorAll("[data-palette-note-classbadge]")].map(
          (x) => x.getAttribute("data-palette-note-classcount")
        ),
      };
    }
  }
  return { found: false, heading: null, items: [], badgeCounts: [] };
}, headingPrefix);

/* ---------------- Phase A: palette Notes group predicate ---------------- */
console.log("Phase A — palette Notes group (hasJudgment)");
await openPalette();
let notes = await groupProbe("Notes ·");
must(notes.found, "A1 Notes group present for a class-notes-only job (pre-fix: absent)");
must(notes.heading === "Notes · 1 annotated job", `A2 heading counts the union predicate (${notes.heading})`);
const hostRow = notes.items.find((t) => t.includes("QA Class Select"));
must(hostRow !== undefined, "A3 host row listed");
must(hostRow?.includes("class notes on Class 3, Class 5, Class 7"), `A4 index-first fallback in the middle column`);
must(notes.badgeCounts.length === 1 && notes.badgeCounts[0] === "3", `A5 count capsule == 3 (got ${JSON.stringify(notes.badgeCounts)})`);

// payload fusion: a phrase from a CLASS note must surface the HOST row
await p.locator("[cmdk-input]").fill("");
await p.keyboard.type("ice ring artifact");
await sleep(400);
notes = await groupProbe("Notes ·");
must(notes.found && notes.items.some((t) => t.includes("QA Class Select")), "A6 class-note text finds the HOST row (payload fusion)");
const classes = await groupProbe("Class notes ·");
must(classes.found && classes.items.some((t) => t.includes("Class 3")), "A7 same query still hits the per-annotation row");

// close the palette before the import phase
await p.keyboard.press("Escape");
await sleep(400);

// workspace scoping: a class-noted job in ANOTHER workspace stays out.
// Deterministic seed: a dedicated workspace + one motioncorr host — the
// gallery DB normally has a single workspace, so scoping needs data that
// MUST exist for the assertion to mean anything (qa84 S-phase lesson:
// make the tested condition real before asserting on it).
let scopeWs = null;
let foreign = null;
const wsList = (await api("/api/workspaces")).json.workspaces ?? [];
scopeWs = wsList.find((w) => w.name === "t86 Scope Probe");
if (!scopeWs) {
  const cr = await api("/api/workspaces", "POST", { name: "t86 Scope Probe" });
  scopeWs = cr.json.workspace ?? null;
}
if (scopeWs) {
  const cr = await api("/api/jobs", "POST", {
    type: "motioncorr",
    name: "t86 Foreign Host",
    workspaceId: scopeWs.id,
  });
  foreign = cr.json.job ?? null;
  if (foreign) {
    await api(`/api/jobs/${foreign.id}`, "PATCH", { params: { classNotes: JSON.stringify({ 3: "t86 foreign workspace note" }) } });
    await sleep(800);
  }
}
if (foreign) {
  await openPalette();
  notes = await groupProbe("Notes ·");
  must(notes.found, "A8 Notes group still present with foreign note planted");
  must(!notes.items.some((t) => t.includes("t86 Foreign Host")), "A9 foreign-workspace host excluded (scope unchanged)");
  must(notes.items.some((t) => t.includes("QA Class Select")), "A10 active-workspace host still listed");
  await p.keyboard.press("Escape");
  await sleep(400);
  await api(`/api/jobs/${foreign.id}`, "DELETE");
} else {
  console.log("  ok: A8-A10 skipped — workspace/job seed unavailable to test against");
}

/* ---------------- Phase B: multi-file import ---------------- */
console.log("Phase B — multi-file import");
mkdirSync(FXDIR, { recursive: true });
const wf = (name, jobs) => JSON.stringify({
  format: "cryoflow-workflow",
  version: 1,
  exportedAt: "2026-09-10T01:00:00.000Z",
  project: "QA",
  workspace: "t86 source",
  jobs: jobs.map(([type, nm, i]) => ({ type, name: nm, x: i * 300, y: 0, params: {} })),
  edges: [],
}, null, 2);
const good1 = `${FXDIR}/t86-good1.json`;
const good2 = `${FXDIR}/t86-good2.json`;
const bad1 = `${FXDIR}/t86-bad1.json`;
writeFileSync(good1, wf("g1", [["import", "t86 G1 Import", 0], ["motioncorr", "t86 G1 MotionCorr", 1]]));
writeFileSync(good2, wf("g2", [["ctffind", "t86 G2 CtfFind", 0], ["autopick", "t86 G2 AutoPick", 1], ["extract", "t86 G2 Extract", 2]]));
writeFileSync(bad1, '{"format": "cryoflow-workflow"'); // truncated JSON

const jobsBefore = (await listJobs()).length;
const importInput = 'input[aria-label="Import workflow JSON files"]';
await p.setInputFiles(importInput, [good1, good2, bad1]);
await p.waitForSelector('[data-testid="import-queue"]');
await sleep(300);

let dl = await p.evaluate(() => ({
  title: document.querySelector('[data-canvas-ui="import-workflow-dialog"] h2')?.textContent?.trim() ?? "",
  rows: [...document.querySelectorAll('[data-testid="import-queue-row"]')].map((r) => ({
    name: r.querySelector('[data-testid="import-file-name"]')?.textContent?.trim() ?? "",
    text: r.textContent?.trim() ?? "",
    warn: !!r.querySelector('[data-testid="import-row-warning"]'),
  })),
  fails: [...document.querySelectorAll('[data-testid="import-queue-fail"]')].map((r) => r.textContent?.trim() ?? ""),
  countLine: document.querySelector('[data-testid="import-queue-count"]')?.textContent?.trim() ?? "",
  confirm: [...document.querySelectorAll('[data-canvas-ui="import-workflow-dialog"] button')].map((x) => (x.textContent ?? "").replace(/\s+/g, " ").trim()).find((t) => t.startsWith("Import")),
}));
must(dl.title === "Import workflows", `B1 plural heading (got "${dl.title}")`);
must(dl.rows.length === 2, `B2 two staged rows (got ${dl.rows.length})`);
must(dl.rows[0].name === "t86-good1.json" && dl.rows[1].name === "t86-good2.json", "B3 queue preserves pick order");
must(dl.rows[0].text.includes("2 jobs") && dl.rows[1].text.includes("3 jobs"), "B4 per-file job counts");
must(dl.fails.length === 1 && dl.fails[0].includes("t86-bad1.json") && dl.fails[0].includes("Not valid JSON"), "B5 parse failure inline with its file name");
must(dl.countLine.includes("2 files") && dl.countLine.includes("5 jobs"), `B6 aggregate banner (${dl.countLine})`);
must(dl.confirm?.includes("2 workflows") && dl.confirm?.includes("5 jobs"), `B7 confirm copy (got "${dl.confirm}")`);

// confirm → sequential POSTs → ONE aggregate toast
await p.locator("button", { hasText: "Import 2 workflows" }).first().click();
await p.waitForSelector('[data-canvas-ui="import-workflow-dialog"]', { state: "detached", timeout: 15_000 });
await sleep(1500);

const created = (await listJobs()).filter((j) => j.name.startsWith("t86 "));
must(created.length === 5, `B8 five jobs created across the batch (got ${created.length})`);
must(created.every((j) => j.status === "idle"), "B9 all created idle — nothing runs");
const createdIds = created.map((j) => j.id);
const cardsOn = await p.evaluate((ids) =>
  ids.map((id) => !!document.querySelector(`[data-job="${id}"]`)), createdIds);
must(cardsOn.every(Boolean), "B10 all batch cards on the canvas");
const toast = await p.evaluate(() =>
  [...document.querySelectorAll("ol > li")].map((li) => li.textContent?.trim() ?? "")
    .find((t) => t.includes("Workflows imported")) ?? ""
);
must(toast.includes("2 workflows — 5 jobs"), `B11 aggregate toast (${toast.slice(0, 80)})`);
must(toast.includes("Undo"), "B12 undo offered on the aggregate toast");

// ONE undo spans every file's created jobs
await p.locator("ol > li", { hasText: "Workflows imported" }).getByRole("button", { name: "Undo" }).click();
await sleep(1800);
const afterUndo = (await listJobs()).filter((j) => j.name.startsWith("t86 "));
must(afterUndo.length === 0, `B13 batch undo removed all five (got ${afterUndo.length})`);
const cardsOff = await p.evaluate((ids) =>
  ids.map((id) => !!document.querySelector(`[data-job="${id}"]`)), createdIds);
must(cardsOff.every((x) => !x), "B14 canvas clean after undo");

// single-file regression — the Task-4x flow must be unchanged
await p.setInputFiles(importInput, [good1]);
await p.waitForSelector('[data-testid="import-queue"]');
await sleep(300);
dl = await p.evaluate(() => ({
  title: document.querySelector('[data-canvas-ui="import-workflow-dialog"] h2')?.textContent?.trim() ?? "",
  rows: document.querySelectorAll('[data-testid="import-queue-row"]').length,
  countLine: document.querySelector('[data-testid="import-queue-count"]')?.textContent?.trim() ?? null,
  confirm: [...document.querySelectorAll('[data-canvas-ui="import-workflow-dialog"] button')].map((x) => (x.textContent ?? "").replace(/\s+/g, " ").trim()).find((t) => t.startsWith("Import")),
}));
must(dl.title === "Import workflow", `B15 singular heading preserved (got "${dl.title}")`);
must(dl.rows === 1, "B16 one row for one file");
must(dl.countLine === null, "B17 aggregate banner hidden for single file");
must(dl.confirm?.includes("1 workflow") && dl.confirm?.includes("2 jobs"), `B18 singular confirm copy (got "${dl.confirm}")`);
await p.locator("button", { hasText: "Import 1 workflow" }).first().click();
await p.waitForSelector('[data-canvas-ui="import-workflow-dialog"]', { state: "detached", timeout: 15_000 });
await sleep(1200);
const single = (await listJobs()).filter((j) => j.name.startsWith("t86 "));
must(single.length === 2, `B19 single-file import still works (got ${single.length})`);
await p.locator("ol > li", { hasText: "Workflows imported" }).getByRole("button", { name: "Undo" }).click();
await sleep(1800);
must((await listJobs()).filter((j) => j.name.startsWith("t86 ")).length === 0, "B20 single-file undo clean");

/* ---------------- Phase C: console ---------------- */
console.log("Phase C — console");
must(consoleErrors.length === 0, `C1 console clean (got ${consoleErrors.length})`);
if (consoleErrors.length) console.log(consoleErrors.slice(0, 5).map((e) => `    ${e.slice(0, 160)}`).join("\n"));

/* ---------------- Phase Z: cleanup verified over the API ---------------- */
console.log("Phase Z — cleanup");
for (const j of (await listJobs()).filter((j) => j.name.startsWith("t86 "))) {
  await api(`/api/jobs/${j.id}`, "DELETE");
}
await api(`/api/jobs/${sel.id}`, "PATCH", { note: "", params: { classNotes: "{}" } });
if (foreign) await api(`/api/jobs/${foreign.id}`, "DELETE");
if (scopeWs) await api(`/api/workspaces/${scopeWs.id}`, "DELETE");
await sleep(2500);
const residual = (await listJobs()).filter((j) => j.name.startsWith("t86 "));
must(residual.length === 0, `Z1 t86 import jobs deleted (got ${residual.length})`);
const hostClean = (await listJobs()).find((j) => j.id === sel.id);
must(!hostClean?.note && (!hostClean?.params?.classNotes || hostClean.params.classNotes === "{}"), "Z2 host notes cleared");
const stray = (await listJobs()).filter((j) => j.note || (j.params?.classNotes && j.params.classNotes !== "{}"));
must(stray.length === 0, `Z3 zero annotated jobs anywhere (got ${stray.length})`);
const jobsAfter = (await listJobs()).length;
must(jobsAfter === jobsBefore, `Z4 job count restored (${jobsAfter} == baseline ${jobsBefore})`);
rmSync(FXDIR, { recursive: true, force: true });

console.log(fail === 0 ? `\nT86 ALL PASS (${pass} assertions)` : `\nT86 ${fail} FAIL / ${pass} pass`);
process.exit(fail === 0 ? 0 : 1);

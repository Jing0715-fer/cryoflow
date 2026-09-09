// t87 — params diff for any same-type pair (Task 87) + undo-toast fold.
// The FSC compare dialog's A/B table (FscParamsDiff) previously served ONLY
// jobs with FSC files; this round generalizes it: select exactly two
// same-type jobs on the canvas → the bulk-selection toolbar grows a Compare
// button → a thin dialog shows the launch params side by side (pick order
// = column order). Plus the Task 86 leftover: the undo toast folds the
// failed-file list past three names (first three honest + "+N more").
// Phases:
//   S  setup — zombie daemon killed, two motioncorr jobs seeded with a
//      KNOWN param story (patchX & dosePerFrame differ; bfactor & patchY
//      identical), positioned inside the existing content bbox
//   A  same-type pair — toolbar Compare button, dialog opens, taxonomy
//      counts, changed/same rows, pick-order columns, show-all toggle,
//      Esc closes + selection survives
//   B  mixed-type pair — the Compare button must NOT exist for 2 jobs of
//      different types, nor for 3 selected
//   C  undo fold — 5-file batch (1 clean + 4 port-incompatible poisoned
//      files that pass CLIENT validation) → partial toast names the first
//      three failures and folds the 4th behind "+ 1 more"; Undo removes
//      the one successful file's jobs
//   D  console clean
//   Z  cleanup verified over the API
// Run: node scripts/t87-e2e.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";

const BASE = "http://localhost:3000";
const FXDIR = "/home/z/my-project/.qa-t87";
const NAME_A = "t87 Mc Alpha";
const NAME_B = "t87 Mc Beta";

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

try { execSync("pkill -f agent-browser"); } catch { /* none running */ }
await sleep(500);

/* ---------------- setup ---------------- */
console.log("Phase S — setup");
// pre-clean: a crashed earlier run leaves the seeded pair behind, and two
// same-named cards would make the [data-job] clicks ambiguous
for (const j of (await listJobs()).filter((j) => j.name.startsWith("t87 "))) {
  await api(`/api/jobs/${j.id}`, "DELETE");
}
await sleep(1200);
const jobsBefore = (await listJobs()).length; // baseline AFTER pre-clean, BEFORE seeding — Z restores to this
// anchor the seeded pair in an EMPTY BAND just below the content bbox —
// bbox-center placement collides with whatever card the persisted layout
// already put there (a neighbor's badge intercepts the click), and Reset
// view (zoom 1 + recenter) cannot contain a world wider than the viewport
// anyway. Everything-visible comes from wheel zoom-out below instead.
const allNow = await listJobs();
const inWs = allNow.filter((j) => j.workspaceId);
must(inWs.length > 0, "S1 workspace jobs present for bbox math");
const maxy = Math.max(...inWs.map((j) => j.y));
const bcx = (Math.min(...inWs.map((j) => j.x)) + Math.max(...inWs.map((j) => j.x))) / 2;
const ax = Math.round(bcx) - 260;
const ay = Math.round(maxy) + 240;
must(inWs.some((j) => j.status === "completed"), "S1b a completed job exists (world is alive)");
const mk = async (name, x, y, params) => {
  const r = await api("/api/jobs", "POST", { type: "motioncorr", name, x, y, params });
  if (r.status !== 200 && r.status !== 201) throw new Error(`POST ${name}: ${r.status} ${JSON.stringify(r.json)}`);
  return r.json.job;
};
const jobA = await mk(NAME_A, ax + 60, ay + 620, { patchX: 5, dosePerFrame: 1.28, bfactor: 150 });
const jobB = await mk(NAME_B, ax + 460, ay + 620, { patchX: 7, dosePerFrame: 1.4, bfactor: 150 });
must(!!jobA?.id && !!jobB?.id, "S2 two motioncorr jobs seeded");
// tripwire: PATCHes are debounced writers' food — re-read the params story
await sleep(2000);
const reread = (await listJobs()).filter((j) => j.id === jobA.id || j.id === jobB.id);
const pa = reread.find((j) => j.id === jobA.id)?.params ?? {};
const pb = reread.find((j) => j.id === jobB.id)?.params ?? {};
must(pa.patchX === 5 && pb.patchX === 7 && pa.dosePerFrame === 1.28 && pb.dosePerFrame === 1.4,
  `S3 known diff survived the zombie window (A:${JSON.stringify(pa)} B:${JSON.stringify(pb)})`);
must(pa.bfactor === 150 && pb.bfactor === 150, "S4 bfactor identical on both");
must(pa.patchY === undefined && pb.patchY === undefined, "S4b patchY absent on BOTH (POST stores only provided keys — it must not become a row)");

/* ---------------- browser ---------------- */
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
p.on("pageerror", (e) => consoleErrors.push(String(e)));

await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await p.waitForTimeout(800);

// zoom out so the WHOLE world (wider than the viewport at zoom 1) is
// clickable — wheel down = zoom out (zoom-to-cursor at the view center)
await p.mouse.move(800, 450);
for (let i = 0; i < 8; i++) {
  await p.mouse.wheel(0, 240);
  await sleep(120);
}
await sleep(500);

// selection: plain click selects, Shift+click toggles in (design-tool
// convention, job-card pointerdown). Click the [data-job] ROOT by id —
// deterministic and always the card body (ports handle their own events).
const ids = { a: jobA.id, b: jobB.id, sel2d: (await listJobs()).find((j) => j.name === "QA Class Select")?.id };
const pickFirst = async (id) => {
  await p.locator(`[data-job="${id}"]`).first().click();
  await sleep(350);
};
const pickSecond = async (id) => {
  await p.locator(`[data-job="${id}"]`).first().click({ modifiers: ["Shift"] });
  await sleep(350);
};

/* ---------------- Phase A: same-type pair ---------------- */
console.log("Phase A — same-type pair");
await pickFirst(ids.a);
await pickSecond(ids.b);
const tb = await p.evaluate(() => {
  const t = document.querySelector('[data-canvas-ui="selection-toolbar"]');
  return {
    present: !!t,
    label: t?.getAttribute("aria-label") ?? "",
    compare: !!t?.querySelector('[data-testid="toolbar-compare-params"]'),
  };
});
must(tb.present, "A1 selection toolbar appears for the pair");
must(tb.label.includes(", compare,"), `A2 toolbar aria-label advertises compare (${tb.label})`);
must(tb.compare, "A3 Compare button present for same-type pair");
await p.locator('[data-testid="toolbar-compare-params"]').click();
await p.waitForSelector('[data-testid="params-diff-dialog"]');
await sleep(300);

let dl = await p.evaluate(() => {
  const dlg = document.querySelector('[data-testid="params-diff-dialog"]');
  const section = dlg?.querySelector('[data-testid="fsc-params-diff"]');
  const rows = [...(section?.querySelectorAll("tr[data-kind]") ?? [])];
  const cols = [...(section?.querySelectorAll("thead th[title]") ?? [])].map((t) => t.getAttribute("title"));
  return {
    title: dlg?.querySelector("h2")?.textContent?.trim() ?? "",
    counts: section?.querySelector('[data-testid="fsc-params-counts"]')?.textContent?.trim() ?? "",
    changed: rows.filter((r) => r.getAttribute("data-kind") === "changed").map((r) => r.getAttribute("data-key")),
    sameVisible: rows.filter((r) => r.getAttribute("data-kind") === "same").length,
    cols,
    footnote: !!dlg?.querySelector('[data-testid="params-diff-footnote"]'),
    diffOnly: section?.querySelector('[data-testid="fsc-params-diffonly"]')?.textContent?.trim() ?? "",
  };
});
must(dl.title === "Compare parameters", `A4 dialog title (got "${dl.title}")`);
must(dl.counts.includes("2 differ") && dl.counts.includes("1 identical"), `A5 taxonomy counts (${dl.counts})`);
must(dl.changed.includes("patchX") && dl.changed.includes("dosePerFrame") && dl.changed.length === 2,
  `A6 the two seeded keys are the changed rows (${JSON.stringify(dl.changed)})`);
must(dl.sameVisible === 0, "A7 differences-only default hides identical rows");
must(dl.cols.length === 2 && dl.cols[0]?.startsWith(NAME_A) && dl.cols[1]?.startsWith(NAME_B),
  `A8 columns follow PICK order (got ${JSON.stringify(dl.cols)})`);
must(dl.diffOnly === "differences only", "A9 toggle shows the ACTIVE state chip while collapsed (FscParamsDiff renders state, not action)");
must(dl.footnote, "A10 actionable footnote present");

// values on a changed row: patchX 5 (A) vs 7 (B)
const cellVals = await p.evaluate(() => {
  const row = [...document.querySelectorAll('[data-testid="fsc-params-diff"] tr[data-kind="changed"]')]
    .find((r) => r.getAttribute("data-key") === "patchX");
  return [...(row?.querySelectorAll("td") ?? [])].slice(1).map((td) => td.textContent?.trim() ?? "");
});
must(cellVals[0] === "5" && cellVals[1] === "7", `A11 changed row carries both values (${JSON.stringify(cellVals)})`);

// show all → identical rows appear
await p.locator('[data-testid="fsc-params-diffonly"]').click();
await sleep(250);
dl = await p.evaluate(() => {
  const rows = [...document.querySelectorAll('[data-testid="fsc-params-diff"] tr[data-kind]')];
  return {
    same: rows.filter((r) => r.getAttribute("data-kind") === "same").map((r) => r.getAttribute("data-key")),
    toggle: document.querySelector('[data-testid="fsc-params-diffonly"]')?.textContent?.trim() ?? "",
  };
});
must(dl.same.includes("bfactor") && dl.same.length === 1,
  `A12 show-all reveals the identical row (${JSON.stringify(dl.same)})`);
must(dl.toggle === "show all", "A13 toggle now reads 'show all' (expanded state)");

// Esc closes the dialog, selection + toolbar survive
await p.keyboard.press("Escape");
await sleep(400);
const after = await p.evaluate(() => ({
  dlg: !!document.querySelector('[data-testid="params-diff-dialog"]'),
  toolbar: !!document.querySelector('[data-canvas-ui="selection-toolbar"]'),
}));
must(!after.dlg, "A14 Esc closes the dialog");
must(after.toolbar, "A15 toolbar (selection) survives the dialog close");

/* ---------------- Phase B: mixed-type pair / 3 selected ---------------- */
console.log("Phase B — mixed-type guard");
await pickSecond(ids.sel2d); // 3 selected: A, B, select2d
let tb3 = await p.evaluate(() => {
  const t = document.querySelector('[data-canvas-ui="selection-toolbar"]');
  return {
    label: t?.getAttribute("aria-label") ?? "",
    compare: !!t?.querySelector('[data-testid="toolbar-compare-params"]'),
  };
});
must(tb3.label.includes("3 jobs selected") && !tb3.compare, `B1 three selected → no compare (${tb3.label})`);
// clear B, leaving A + select2d (2 selected, DIFFERENT types)
await pickSecond(ids.b); // toggles B back off
tb3 = await p.evaluate(() => {
  const t = document.querySelector('[data-canvas-ui="selection-toolbar"]');
  return { compare: !!t?.querySelector('[data-testid="toolbar-compare-params"]') };
});
must(!tb3.compare, "B2 two different-type jobs → no compare");
// clear the selection for a clean Phase C (click empty canvas = deselect)
await p.mouse.click(30, 450);
await sleep(300);

/* ---------------- Phase C: undo toast fold ---------------- */
console.log("Phase C — undo toast fold");
mkdirSync(FXDIR, { recursive: true });
const clean = `${FXDIR}/t87-c1.json`;
const poison = (i) => {
  // passes CLIENT validation (both port names exist in their specs) and
  // FAILS the server's portsValid compatibility check — motioncorr's
  // "micrographs" output kind is not accepted by extract's "coords" input
  const path = `${FXDIR}/t87-p${i}.json`;
  writeFileSync(path, JSON.stringify({
    format: "cryoflow-workflow", version: 1, exportedAt: "2026-09-10T02:00:00.000Z",
    project: "QA", workspace: "t87 source",
    jobs: [
      { type: "motioncorr", name: `t87 Poison ${i} Mc`, x: 0, y: 0, params: {} },
      { type: "extract", name: `t87 Poison ${i} Extract`, x: 300, y: 0, params: {} },
    ],
    edges: [{ from: 0, to: 1, fromPort: "micrographs", toPort: "coords" }],
  }, null, 2));
  return path;
};
writeFileSync(clean, JSON.stringify({
  format: "cryoflow-workflow", version: 1, exportedAt: "2026-09-10T02:00:00.000Z",
  project: "QA", workspace: "t87 source",
  jobs: [
    { type: "motioncorr", name: "t87 Clean Mc", x: 0, y: 0, params: {} },
    { type: "ctffind", name: "t87 Clean Ctf", x: 300, y: 0, params: {} },
  ],
  edges: [],
}, null, 2));
const files = [clean, poison(2), poison(3), poison(4), poison(5)];

await p.setInputFiles('input[aria-label="Import workflow JSON files"]', files);
await p.waitForSelector('[data-testid="import-queue"]');
await sleep(300);
const qRows = await p.evaluate(() => ({
  rows: document.querySelectorAll('[data-testid="import-queue-row"]').length,
  fails: document.querySelectorAll('[data-testid="import-queue-fail"]').length,
}));
must(qRows.rows === 5 && qRows.fails === 0, `C1 all five stage clean client-side (rows ${qRows.rows}, fails ${qRows.fails})`);
await p.locator("button", { hasText: "Import 5 workflows" }).first().click();
await p.waitForSelector('[data-canvas-ui="import-workflow-dialog"]', { state: "detached", timeout: 20_000 });
await sleep(1500);

const toast = await p.evaluate(() =>
  [...document.querySelectorAll("ol > li")].map((li) => li.textContent?.trim() ?? "")
    .find((t) => t.includes("imported")) ?? ""
);
must(toast.includes("Partially imported") || toast.includes("1 of 5"), `C2 partial toast shown (${toast.slice(0, 60)})`);
must(toast.includes("t87-p2.json") && toast.includes("t87-p3.json") && toast.includes("t87-p4.json"), "C3 first three failures named");
must(toast.includes("+ 1 more"), `C4 fourth failure folded behind '+ 1 more' (${toast.slice(0, 130)})`);
must(!toast.includes("t87-p5.json"), "C5 fifth name NOT printed (honest fold)");
const created = (await listJobs()).filter((j) => j.name.startsWith("t87 Clean"));
must(created.length === 2, `C6 exactly the clean file's jobs exist (got ${created.length})`);
const poisonJobs = (await listJobs()).filter((j) => j.name.startsWith("t87 Poison"));
must(poisonJobs.length === 0, "C7 poisoned files created nothing (server rejected the wiring)");
await p.locator("ol > li", { hasText: "imported" }).getByRole("button", { name: "Undo" }).click();
await sleep(1800);
must((await listJobs()).filter((j) => j.name.startsWith("t87 Clean")).length === 0, "C8 undo removes the clean file's jobs");

/* ---------------- Phase D: console ---------------- */
console.log("Phase D — console");
// the four poisoned imports REJECT with 400 by design — the browser logs
// every failed XHR as a console error, so those four are expected and
// honest; anything else must be empty
const expected400 = consoleErrors.filter((e) => e.includes("status of 400"));
const unexpected = consoleErrors.filter((e) => !e.includes("status of 400"));
must(expected400.length === 4, `D1a exactly the 4 expected 400s from the poisoned files (got ${expected400.length})`);
must(unexpected.length === 0, `D1b no other console errors (got ${unexpected.length})`);
if (unexpected.length) console.log(unexpected.slice(0, 5).map((e) => `    ${e.slice(0, 160)}`).join("\n"));

/* ---------------- Phase Z: cleanup ---------------- */
console.log("Phase Z — cleanup");
for (const j of (await listJobs()).filter((j) => j.name.startsWith("t87 "))) {
  await api(`/api/jobs/${j.id}`, "DELETE");
}
await sleep(1500);
const residual = (await listJobs()).filter((j) => j.name.startsWith("t87 "));
must(residual.length === 0, `Z1 t87 jobs deleted (got ${residual.length})`);
const jobsAfter = (await listJobs()).length;
must(jobsAfter === jobsBefore, `Z2 job count restored (${jobsAfter} == baseline ${jobsBefore})`);
rmSync(FXDIR, { recursive: true, force: true });

console.log(fail === 0 ? `\nT87 ALL PASS (${pass} assertions)` : `\nT87 ${fail} FAIL / ${pass} pass`);
process.exit(fail === 0 ? 0 : 1);

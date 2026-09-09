// t95 — Task 95: duplicate-import guard in the preview dialog.
//
// Re-importing the same workflow export currently creates silent name
// copies in the target workspace. Task 95 moves that knowledge BEFORE the
// confirm: each queue row gets an amber "N dup" chip when any of the
// file's job names already exist in the SELECTED target workspace, and
// the confirm button gains a "· N dup" suffix. Keyed on the picker state
// — the same file is a duplicate in one workspace and fresh in another,
// which is exactly why the guard warns instead of blocking.
//
// Phase S — setup: baseline, seed one existing job, boot to canvas
// Phase A — drop a workflow whose jobs are [existing, fresh] → dialog row
//   carries the dup chip ("1 dup"), tooltip names the target workspace,
//   confirm copy carries the "· 1 dup" suffix
// Phase B — switch the target workspace radio → chip disappears (fresh
//   there) and the confirm suffix goes; switch back → chip returns
// Phase C — all-fresh workflow → no chip anywhere (regression)
// Phase D — static contract: testid, memo keyed on targetWs, suffix logic
// Phase Z — cleanup: delete seeded job + t95 workspace, counts restored
//
// Run: node scripts/t95-e2e.mjs   (server on :3000)
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let PASS = 0;
let b = null;
let p = null;
async function cleanup() {
  try { if (p) await p.close(); } catch {}
  try { if (b) await b.close(); } catch {}
}
const must = (cond, label) => {
  if (!cond) {
    console.log(`FATAL: ${label}`);
    p?.close().catch(() => {});
    b?.close().catch(() => {});
    process.exit(1);
  }
  PASS++;
  console.log(`  ok: ${label}`);
};

const api = async (path, method = "GET", body) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}`);
  if (method === "DELETE") return null;
  return res.json();
};
const listJobs = async () => (await api("/api/jobs")).jobs;

/* ---------------- Phase S: setup ---------------- */
console.log("Phase S — setup");
// self-clean: sweep t95 jobs and the t95 workspace from crashed runs
for (const j of (await listJobs()).filter((x) => x.name.startsWith("t95 "))) {
  try { await api(`/api/jobs/${j.id}`, "DELETE"); } catch { /* gone */ }
}
const wss0 = (await api("/api/workspaces")).workspaces;
for (const w of wss0.filter((w) => w.name.startsWith("t95 "))) {
  try { await api(`/api/workspaces/${w.id}`, "DELETE"); } catch { /* gone */ }
}
const jobsBefore = (await listJobs()).length;
const wsBefore = ((await api("/api/workspaces")).workspaces).length;
must(jobsBefore >= 0 && wsBefore >= 1, `S1 baseline reachable (${jobsBefore} jobs, ${wsBefore} workspaces)`);
const homeWs = ((await api("/api/workspaces")).workspaces)[0];

// seed the collision: a job whose name the staged workflow will reuse
const seeded = (await api("/api/jobs", "POST", {
  type: "motioncorr",
  name: "t95 Dup MotionCorr",
  workspaceId: homeWs.id,
})).job;
must(!!seeded?.id, "S2 collision job seeded in the first workspace");

b = await chromium.launch();
p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
p.on("pageerror", (e) => consoleErrors.push(String(e)));

// second workspace BEFORE the dialog opens (the picker refreshes on open)
const otherWs = (await api("/api/workspaces", "POST", { name: "t95 Other" })).workspace;
must(!!otherWs?.id, "S3 fresh target workspace created");

await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await sleep(600);
const curView = () =>
  p.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view") ?? null);
for (let i = 0; i < 4 && (await curView()) !== "canvas"; i++) {
  await p.keyboard.press("Shift+C");
  await sleep(700);
}
must((await curView()) === "canvas", `S4 canvas view active (got "${await curView()}")`);

const WF = (jobNames) => JSON.stringify({
  format: "cryoflow-workflow",
  version: 1,
  exportedAt: "2026-09-10T04:00:00.000Z",
  project: "QA",
  workspace: "t95 source",
  jobs: jobNames.map((nm, i) => ({ type: i % 2 ? "motioncorr" : "import", name: nm, x: i * 300, y: 0, params: {} })),
  edges: [],
});
const MIXED = WF(["t95 Dup MotionCorr", "t95 Fresh Import"]);
const FRESH = WF(["t95 Fresh Alpha", "t95 Fresh Beta"]);

const makeDT = (payloads) =>
  p.evaluateHandle((items) => {
    const d = new DataTransfer();
    for (const { name, json } of items) d.items.add(new File([json], name, { type: "application/json" }));
    return d;
  }, payloads);

const SECTION = 'section[data-canvas="viewport"]';
const drop = async (json, fileName = "t95-wf.json") => {
  const dt = await makeDT([{ name: fileName, json }]);
  await p.locator(SECTION).dispatchEvent("dragenter", { dataTransfer: dt });
  await p.locator(SECTION).dispatchEvent("drop", { dataTransfer: dt });
  await p.waitForSelector('[data-canvas-ui="import-workflow-dialog"]', { timeout: 15_000 });
};
const row = () =>
  p.evaluate(() => {
    const r = document.querySelector('[data-testid="import-queue-row"]');
    if (!r) return null;
    return {
      dupChip: r.querySelector('[data-testid="import-row-dup"]')?.textContent?.replace(/\s+/g, " ").trim() ?? null,
      dupTitle: r.querySelector('[data-testid="import-row-dup"]')?.getAttribute("title") ?? null,
      versionChip: !!r.querySelector('[data-testid="import-row-warning"]'),
    };
  });
const confirmText = () =>
  p.evaluate(() =>
    [...document.querySelectorAll('[data-canvas-ui="import-workflow-dialog"] button')]
      .map((x) => (x.textContent ?? "").replace(/\s+/g, " ").trim())
      .find((t) => t.startsWith("Import")) ?? "");
const pickWs = async (name) => {
  await p.locator('[role="radio"]', { hasText: name }).first().click();
  await sleep(300);
};
const checkedWs = () =>
  p.evaluate(() => {
    const radios = [...document.querySelectorAll('[role="radio"]')];
    const on = radios.find((r) => r.getAttribute("aria-checked") === "true");
    // the workspace name lives in the truncate span; the first span is the
    // empty radio dot, and textContent of the whole button drags in stats
    return on?.querySelector(".truncate")?.textContent?.trim() ?? null;
  });
const closeDialog = async () => {
  await p.locator('[data-canvas-ui="import-workflow-dialog"] button', { hasText: "Cancel" }).first().click();
  await p.waitForSelector('[data-canvas-ui="import-workflow-dialog"]', { state: "detached", timeout: 10_000 });
};

/* ---------------- Phase A: mixed file → dup chip + confirm suffix ---------------- */
console.log("Phase A — duplicate chip on the mixed file");
await drop(MIXED);
must((await checkedWs()) === homeWs.name,
  `A1 default target is the active workspace (got "${await checkedWs()}", want "${homeWs.name}")`);
let r = await row();
must(r && r.dupChip !== null && /1 dup/.test(r.dupChip),
  `A2 dup chip reads the existing-name count (got ${JSON.stringify(r && r.dupChip)})`);
must(r.dupTitle?.includes("1 job name already exists in") && r.dupTitle?.includes(homeWs.name),
  `A3 tooltip names the target workspace (got "${r.dupTitle?.slice(0, 70)}")`);
must(!r.versionChip, "A4 v1 file carries no version chip — the two amber chips are independent");
must((await confirmText()).includes("Import 1 workflow · 2 jobs · 1 dup"),
  `A5 confirm copy carries the dup suffix (got "${await confirmText()}")`);

/* ---------------- Phase B: switch target → chip re-evaluates ---------------- */
console.log("Phase B — chip follows the target workspace");
await pickWs(otherWs.name);
r = await row();
must(r && r.dupChip === null, `B1 fresh workspace → chip gone (got ${JSON.stringify(r && r.dupChip)})`);
must(!(await confirmText()).includes("dup"), `B2 confirm suffix gone (got "${await confirmText()}")`);
await pickWs(homeWs.name);
r = await row();
must(r && r.dupChip !== null && /1 dup/.test(r.dupChip), "B3 switching back brings the chip and the suffix");
must((await confirmText()).includes("· 1 dup"), "B4 confirm suffix restored");
await closeDialog();
must((await listJobs()).length === jobsBefore + 1, "B5 Cancel imports nothing (only the seed exists)");

/* ---------------- Phase C: all-fresh file → no chip ---------------- */
console.log("Phase C — fresh file carries no dup chip");
await drop(FRESH, "t95-fresh.json");
r = await row();
must(r && r.dupChip === null, `C1 no duplicate names in target → no chip (got ${JSON.stringify(r && r.dupChip)})`);
must(!(await confirmText()).includes("dup"), "C2 confirm copy stays clean");
await closeDialog();

/* ---------------- Phase D: static contract ---------------- */
console.log("Phase D — static contract (source)");
const { execSync } = await import("node:child_process");
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 60_000 }).trim();
const dlgSrc = sh("cat src/components/workflow/import-workflow-dialog.tsx");
must(dlgSrc.includes('data-testid="import-row-dup"'), "D1 dup chip testid in the dialog");
must(dlgSrc.includes("[jobs, targetWs]") && dlgSrc.includes("existingNames"),
  "D2 memo keyed on the SELECTED workspace (re-evaluates on picker change)");
must(dlgSrc.includes("dupTitle") && dlgSrc.includes("· ${dupJobTotal} dup"),
  "D3 tooltip helper + confirm suffix in source");
must(dlgSrc.includes("importing creates a duplicate") && dlgSrc.includes("importing creates duplicates"),
  "D4 tooltip copy explains the warn-not-block semantics");

/* ---------------- Phase Z: cleanup ---------------- */
console.log("Phase Z — cleanup");
await api(`/api/jobs/${seeded.id}`, "DELETE");
await api(`/api/workspaces/${otherWs.id}`, "DELETE");
const jobsAfter = (await listJobs()).length;
const wsAfter = ((await api("/api/workspaces")).workspaces).length;
must(jobsAfter === jobsBefore, `Z1 job count restored (${jobsAfter} == baseline ${jobsBefore})`);
must(wsAfter === wsBefore, `Z2 workspace count restored (${wsAfter} == baseline ${wsBefore})`);
must(consoleErrors.filter((e) => !e.includes("400")).length === 0,
  `Z3 console clean (got ${JSON.stringify(consoleErrors.slice(0, 3))})`);

await cleanup();
console.log(`T95 ALL PASS (${PASS} assertions)`);

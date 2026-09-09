// t96 — Task 96: rename-guard mechanics closure.
//
// The curl experiment (t96-shape-probe.mjs) nailed the server's ACTUAL
// rename behavior and exposed two Task 95 bugs: the preview warned about
// duplicates that never happen (the server renames collisions to "(i2)")
// and missed the renames that do (batch-internal, cross-workspace before
// the scope fix). Task 96: server rename scope narrowed from PROJECT to
// TARGET WORKSPACE (a copy into another workspace keeps its names —
// template-copy story), and the dialog's warning now mirrors the server's
// uniqueName walk exactly. This suite closes the loop end-to-end: the
// chip's PROMISE is compared against what the server actually DID.
//
// Phase S — setup: baseline, seed job in homeWs, second workspace, boot
// Phase A — intra-batch collision: two staged files sharing a fresh job
//   name → chip ONLY on the later file ("1 rename"), confirm suffix,
//   then IMPORT → server actually created "X" and "X (i2)"
// Phase B — cross-workspace copy: name exists in homeWs only, target ws2
//   is clean → NO chip (no false alarm) and the import KEEPS the name
//   verbatim in ws2 (the pre-Task-96 server renamed it silently)
// Phase C — existing-in-target: same file targeting homeWs → chip fires,
//   import lands "X (i2)" in homeWs (the original Task 95 story, now
//   with honest copy)
// Phase D — static contract: route where-clause is workspace-scoped,
//   dialog walk mirrors the server's empty-name default label
// Phase Z — cleanup: t96 jobs + second workspace deleted, counts restored
//
// Run: node scripts/t96-e2e.mjs   (server on :3000)
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
// self-clean: sweep t96 jobs and the t96 workspace from crashed runs
for (const j of (await listJobs()).filter((x) => x.name.startsWith("t96"))) {
  try { await api(`/api/jobs/${j.id}`, "DELETE"); } catch { /* gone */ }
}
for (const w of (await api("/api/workspaces")).workspaces.filter((w) => w.name.startsWith("t96 "))) {
  try { await api(`/api/workspaces/${w.id}`, "DELETE"); } catch { /* gone */ }
}
const jobsBefore = (await listJobs()).length;
const wsBefore = ((await api("/api/workspaces")).workspaces).length;
must(jobsBefore >= 0 && wsBefore >= 1, `S1 baseline reachable (${jobsBefore} jobs, ${wsBefore} workspaces)`);
const homeWs = ((await api("/api/workspaces")).workspaces)[0];

// seed TWO collision jobs: Alpha gets copied into ws2 by Phase B, so
// Phase C needs Beta — a name that exists ONLY in homeWs — to tell the
// "re-import into the occupied original workspace" story honestly
const seededA = (await api("/api/jobs", "POST", {
  type: "motioncorr",
  name: "t96 Alpha MotionCorr",
  workspaceId: homeWs.id,
})).job;
const seededB = (await api("/api/jobs", "POST", {
  type: "motioncorr",
  name: "t96 Beta MotionCorr",
  workspaceId: homeWs.id,
})).job;
must(!!seededA?.id && !!seededB?.id, "S2 collision jobs seeded in the first workspace (Alpha + Beta)");
const nSeeds = 2;

b = await chromium.launch();
p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
p.on("pageerror", (e) => consoleErrors.push(String(e)));

// the second workspace exists BEFORE the dialog opens (picker refreshes on open)
const ws2 = (await api("/api/workspaces", "POST", { name: "t96 Second" })).workspace;
must(!!ws2?.id, "S3 second (clean) workspace created");

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
  exportedAt: "2026-09-10T05:30:00.000Z",
  project: "QA",
  workspace: "t96 source",
  jobs: jobNames.map((nm, i) => ({ type: i % 2 ? "motioncorr" : "import", name: nm, x: i * 300, y: 0, params: {} })),
  edges: [],
});

const makeDT = (payloads) =>
  p.evaluateHandle((items) => {
    const d = new DataTransfer();
    for (const { name, json } of items) d.items.add(new File([json], name, { type: "application/json" }));
    return d;
  }, payloads);

const SECTION = 'section[data-canvas="viewport"]';
const drop = async (files) => {
  const dt = await makeDT(files.map(({ json, name }) => ({ name, json })));
  await p.locator(SECTION).dispatchEvent("dragenter", { dataTransfer: dt });
  await p.locator(SECTION).dispatchEvent("drop", { dataTransfer: dt });
  await p.waitForSelector('[data-canvas-ui="import-workflow-dialog"]', { timeout: 15_000 });
};
// per-row reader — the multi-file queue is the whole point of Phase A,
// so the probe must scope by the row's data-queue-file-name, not "first row"
const rowByName = (fileName) =>
  p.evaluate((fn) => {
    const r = document.querySelector(`[data-queue-file-name="${fn}"][data-testid="import-queue-row"]`);
    if (!r) return null;
    return {
      renameChip: r.querySelector('[data-testid="import-row-rename"]')?.textContent?.replace(/\s+/g, " ").trim() ?? null,
      renameTitle: r.querySelector('[data-testid="import-row-rename"]')?.getAttribute("title") ?? null,
    };
  }, fileName);
const confirmText = () =>
  p.evaluate(() =>
    [...document.querySelectorAll('[data-canvas-ui="import-workflow-dialog"] button')]
      .map((x) => (x.textContent ?? "").replace(/\s+/g, " ").trim())
      .find((t) => t.startsWith("Import")) ?? "");
const pickWs = async (name) => {
  await p.locator('[role="radio"]', { hasText: name }).first().click();
  await sleep(300);
};
const confirmImport = async (expectJobs) => {
  await p.locator('[data-canvas-ui="import-workflow-dialog"] button', { hasText: /^Import/ }).first().click();
  await p.waitForSelector('[data-canvas-ui="import-workflow-dialog"]', { state: "detached", timeout: 20_000 });
  await sleep(700); // store merge settles
  const now = (await listJobs()).length;
  must(now === expectJobs, `  import landed (${now} == expected ${expectJobs})`);
};
const jobsNamed = async (name) => (await listJobs()).filter((j) => j.name === name);

/* ---------------- Phase A: intra-batch collision ---------------- */
console.log("Phase A — two staged files sharing a job name");
const SHARED = "t96 Batch Shared";
await drop([
  { name: "t96-a.json", json: WF([SHARED]) },
  { name: "t96-b.json", json: WF([SHARED]) },
]);
let ra = await rowByName("t96-a.json");
let rb = await rowByName("t96-b.json");
must(ra && ra.renameChip === null, `A1 first file owns the fresh name → no chip (got ${JSON.stringify(ra && ra.renameChip)})`);
must(rb && rb.renameChip !== null && /1 rename/.test(rb.renameChip),
  `A2 later file's name already claimed in-batch → chip (got ${JSON.stringify(rb && rb.renameChip)})`);
must(rb.renameTitle?.includes("(i2)") && rb.renameTitle?.includes("earlier file in this batch"),
  `A3 tooltip explains both collision sources (got "${rb.renameTitle?.slice(0, 80)}")`);
must((await confirmText()).includes("Import 2 workflows · 2 jobs · 1 rename"),
  `A4 confirm copy counts batch-internal renames (got "${await confirmText()}")`);
await confirmImport(jobsBefore + nSeeds + 2); // +seeds +2 imported
const kept = await jobsNamed(SHARED);
const renamed = await jobsNamed(`${SHARED} (i2)`);
must(kept.length === 1 && renamed.length === 1,
  `A5 MECHANICS: server created "${SHARED}" ×${kept.length} and "${SHARED} (i2)" ×${renamed.length} — the chip told the truth`);

/* ---------------- Phase B: cross-workspace copy keeps its name ---------------- */
console.log("Phase B — template copy into a clean workspace");
await drop([{ name: "t96-b2.json", json: WF(["t96 Alpha MotionCorr"]) }]);
let r = await rowByName("t96-b2.json");
must(r && r.renameChip !== null, `B1 default target (homeWs) → chip fires (got ${JSON.stringify(r && r.renameChip)})`);
await pickWs(ws2.name);
r = await rowByName("t96-b2.json");
must(r && r.renameChip === null, `B2 clean target → chip gone, no false alarm (got ${JSON.stringify(r && r.renameChip)})`);
must(!(await confirmText()).includes("rename"), "B3 confirm copy clean on the fresh target");
await confirmImport(jobsBefore + nSeeds + 3); // +seeds +2(A) +1(B)
const copied = (await listJobs()).filter((j) => j.name === "t96 Alpha MotionCorr" && j.workspaceId === ws2.id);
must(copied.length === 1,
  `B4 MECHANICS: the copy into ws2 keeps its name verbatim (×${copied.length}) — pre-Task-96 this was silently "(i2)"`);

/* ---------------- Phase C: existing-in-target collision ---------------- */
console.log("Phase C — re-import into the occupied workspace");
// the canvas auto-switched to ws2 after B's import; the dialog defaults
// to the ACTIVE workspace. Beta exists only in homeWs, so the clean-ws2
// default shows no chip — then picking homeWs (occupied) lights it up.
await drop([{ name: "t96-c.json", json: WF(["t96 Beta MotionCorr"]) }]);
r = await rowByName("t96-c.json");
must(r && r.renameChip === null, `C1 default target is ws2 (Beta not there) → no chip (got ${JSON.stringify(r && r.renameChip)})`);
await pickWs(homeWs.name);
r = await rowByName("t96-c.json");
must(r && r.renameChip !== null && /1 rename/.test(r.renameChip),
  `C2 target switched to the occupied workspace → chip fires (got ${JSON.stringify(r && r.renameChip)})`);
await confirmImport(jobsBefore + nSeeds + 4); // +seeds +2(A) +1(B) +1(C)
const renamedC = (await listJobs()).filter(
  (j) => j.name === "t96 Beta MotionCorr (i2)" && j.workspaceId === homeWs.id
);
must(renamedC.length === 1,
  `C3 MECHANICS: re-import lands "t96 Beta MotionCorr (i2)" in homeWs (×${renamedC.length})`);

/* ---------------- Phase D: static contract ---------------- */
console.log("Phase D — static contract (source)");
const { execSync } = await import("node:child_process");
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 60_000 }).trim();
const routeSrc = sh("cat src/app/api/workflow-import/route.ts");
const dlgSrc = sh("cat src/components/workflow/import-workflow-dialog.tsx");
must(routeSrc.includes("where: { projectId: active.project.id, workspaceId }"),
  "D1 route's taken-name query is scoped to the TARGET WORKSPACE (not the project)");
must(routeSrc.includes("target-workspace + batch-internal"),
  "D2 route comment states the de-dup scope");
must(dlgSrc.includes("jobType(j.type)?.label"),
  "D3 dialog walk mirrors the server's empty-name default label");
must(dlgSrc.includes("earlier-FILE-in-batch") && dlgSrc.includes("earlier-JOB-in-file"),
  "D4 dialog comment names all three collision kinds");

/* ---------------- Phase Z: cleanup ---------------- */
console.log("Phase Z — cleanup");
for (const j of (await listJobs()).filter((x) => x.name.startsWith("t96"))) {
  try { await api(`/api/jobs/${j.id}`, "DELETE"); } catch { /* gone */ }
}
await api(`/api/workspaces/${ws2.id}`, "DELETE");
const jobsAfter = (await listJobs()).length;
const wsAfter = ((await api("/api/workspaces")).workspaces).length;
must(jobsAfter === jobsBefore, `Z1 job count restored (${jobsAfter} == baseline ${jobsBefore})`);
must(wsAfter === wsBefore, `Z2 workspace count restored (${wsAfter} == baseline ${wsBefore})`);
must(consoleErrors.filter((e) => !e.includes("400")).length === 0,
  `Z3 console clean (got ${JSON.stringify(consoleErrors.slice(0, 3))})`);

await cleanup();
console.log(`T96 ALL PASS (${PASS} assertions)`);

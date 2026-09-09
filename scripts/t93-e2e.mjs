// t93 — Task 93: FOLDER drag-and-drop import + folder-aware veil.
//
// Task 92 made the canvas a drop target for workflow files. Task 93 makes
// it a drop target for FOLDERS: the entries API walks the dropped tree,
// a .json gate (mirroring the picker forms' accept=".json") keeps the
// multi-GB data files of a Relion job folder out of the parse funnel, and
// collected files are renamed to their relative paths so the preview queue
// shows provenance. The veil grows a folder chip (items.length reads 1 for
// a whole directory — the count chip would lie), and a drop that offered
// files but yielded zero candidates says so instead of vanishing.
//
// The probe drives REAL product code against a stubbed entries API: an
// init-script patches DataTransferItem.webkitGetAsEntry to return fake
// entry trees registered per sentinel file name. That exercises the walk
// itself (pagination loop, depth cap, size gate, renaming) — not just the
// source text.
//
// Phase S — setup: API baseline (jobs/workspaces), page on canvas
// Phase A — folder veil: directory gesture summons the veil with the
//   folder chip (count chip suppressed); loose-file gesture still shows
//   the count chip; leave hides everything
// Phase B — folder drop (2 valid .json + 1 truncated + data files) →
//   preview dialog with RELATIVE-path row names + inline failure row;
//   Cancel imports nothing
// Phase C — folder drop (valid + 9 MB fake .json) → only the small file
//   survives the size gate; Import creates the jobs idle, cards on canvas
// Phase D — folder with zero candidates → NO dialog, honest
//   "Nothing to import" toast, data unchanged
// Phase E — depth cap: a 9-deep chain passes only the depth-8 file
// Phase F — static contract: entries walk + caps + gate + folder chip
// Phase Z — cleanup: delete t93 jobs via API, counts back to baseline
//
// Run: node scripts/t93-e2e.mjs   (server on :3000)
import { chromium } from "playwright";
import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
const sh = (cmd) => execSync(cmd, { encoding: "utf8", timeout: 120_000 }).trim();
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
// self-clean: a previous crashed run may have left t93 jobs behind —
// sweep them BEFORE capturing the baseline so re-runs are idempotent
for (const j of (await listJobs()).filter((x) => x.name.startsWith("t93 "))) {
  try { await api(`/api/jobs/${j.id}`, "DELETE"); } catch { /* already gone */ }
}
const jobsBefore = (await listJobs()).length;
const wsBefore = (await api("/api/workspaces")).workspaces.length;
must(jobsBefore >= 0 && wsBefore >= 1, `S1 baseline reachable (${jobsBefore} jobs, ${wsBefore} workspaces)`);

b = await chromium.launch();
p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
p.on("pageerror", (e) => consoleErrors.push(String(e)));

// Stub the entries API BEFORE any app code runs: fake entry trees are
// registered per sentinel item name; unregistered items fall through to
// the real webkitGetAsEntry (null for synthetic drops → loose-file path).
await p.addInitScript(() => {
  const mkFile = (name, fullPath, content) => ({
    isFile: true,
    isDirectory: false,
    name,
    fullPath,
    file: (cb, err) => {
      try { cb(new File([content], name, { type: "application/json" })); }
      catch (e) { err && err(e); }
    },
  });
  const mkBig = (name, fullPath, bytes) => ({
    isFile: true,
    isDirectory: false,
    name,
    fullPath,
    file: (cb) => cb(new File([new Uint8Array(bytes)], name, { type: "application/json" })),
  });
  // readEntries paginates: children come out in batches of `batchSize`
  // until an empty batch — exercises the product's loop-until-empty.
  const mkDir = (name, fullPath, children, batchSize = 3) => {
    let page = 0;
    return {
      isFile: false,
      isDirectory: true,
      name,
      fullPath,
      createReader: () => ({
        readEntries: (cb) => {
          if (page * batchSize >= children.length) { cb([]); return; }
          const slice = children.slice(page * batchSize, (page + 1) * batchSize);
          page += 1;
          cb(slice);
        },
      }),
    };
  };
  window.__mk = { mkFile, mkBig, mkDir };
  window.__fakeEntries = new Map();
  const orig = DataTransferItem.prototype.webkitGetAsEntry;
  DataTransferItem.prototype.webkitGetAsEntry = function () {
    const f = typeof this.getAsFile === "function" ? this.getAsFile() : null;
    const fake = f && window.__fakeEntries.get(f.name);
    if (fake) return fake;
    try { return orig ? orig.call(this) : null; } catch { return null; }
  };
});

await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await p.waitForTimeout(600);
const curView = () =>
  p.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view") ?? null);
must(["canvas", "dashboard"].includes(await curView()), `S2 app boots to a view (got "${await curView()}")`);
for (let i = 0; i < 4 && (await curView()) !== "canvas"; i++) {
  await p.keyboard.press("Shift+C");
  await sleep(700);
}
must((await curView()) === "canvas", "S3 canvas view active for the drop legs");

// Workflow payloads (same shape t92 used — the staging funnel is shared)
const WF = (name, jobNames) => JSON.stringify({
  format: "cryoflow-workflow",
  version: 1,
  exportedAt: "2026-09-10T03:00:00.000Z",
  project: "QA",
  workspace: "t93 source",
  jobs: jobNames.map((nm, i) => ({ type: i % 2 ? "motioncorr" : "import", name: nm, x: i * 300, y: 0, params: {} })),
  edges: [],
});
const GOOD_A = WF("t93 F A", ["t93 F Import", "t93 F MotionCorr"]); // 2 jobs
const GOOD_B = WF("t93 F B", ["t93 F Class2D"]); // 1 job
const GOOD_DEEP = WF("t93 F Deep", ["t93 F DeepPick"]);
const BAD = '{"format": "cryoflow-workflow"'; // truncated JSON

// Register the fake trees against sentinel item names
await p.evaluate(({ wfA, wfB, wfBad, deep }) => {
  const { mkFile, mkBig, mkDir } = window.__mk;
  // mixed folder: 2 valid + 1 truncated + data files (gated out)
  window.__fakeEntries.set("__folder_jobs__", mkDir("jobs", "/jobs", [
    mkFile("wf-a.json", "/jobs/wf-a.json", wfA),
    mkFile("stack.mrcs", "/jobs/stack.mrcs", "\0BINARY"),
    mkDir("sub", "/jobs/sub", [
      mkFile("wf-b.json", "/jobs/sub/wf-b.json", wfB),
      mkFile("notes.txt", "/jobs/sub/notes.txt", "not json"),
      mkFile("wf-bad.json", "/jobs/sub/wf-bad.json", wfBad),
    ], 2),
  ], 2));
  // size-gate folder: 1 valid + a 9 MB .json (over the cap)
  window.__fakeEntries.set("__folder_huge__", mkDir("jobs", "/jobs", [
    mkFile("wf-a.json", "/jobs/wf-a.json", wfA),
    mkBig("wf-huge.json", "/jobs/wf-huge.json", 9 * 1024 * 1024),
  ], 2));
  // candidate-free folder: only data files
  window.__fakeEntries.set("__folder_empty__", mkDir("dataset", "/dataset", [
    mkFile("stack.mrcs", "/dataset/stack.mrcs", "\0"),
    mkFile(".DS_Store", "/dataset/.DS_Store", "\0"),
    mkFile("notes.txt", "/dataset/notes.txt", "text"),
  ], 2));
  // depth-cap folder: 9 nested dirs; wf-mid at depth 8 (in), wf-deep at n9 (out)
  const pathOf = (i) => "/jobs/" + Array.from({ length: i }, (_, k) => `n${k + 1}`).join("/");
  const node9 = mkDir("n9", pathOf(9), [mkFile("wf-deep.json", pathOf(9) + "/wf-deep.json", deep)], 3);
  const node8 = mkDir("n8", pathOf(8), [node9], 3);
  const node7 = mkDir("n7", pathOf(7), [node8, mkFile("wf-mid.json", pathOf(7) + "/wf-mid.json", deep)], 3);
  const node6 = mkDir("n6", pathOf(6), [node7], 3);
  const node5 = mkDir("n5", pathOf(5), [node6], 3);
  const node4 = mkDir("n4", pathOf(4), [node5], 3);
  const node3 = mkDir("n3", pathOf(3), [node4], 3);
  const node2 = mkDir("n2", pathOf(2), [node3], 3);
  const node1 = mkDir("n1", pathOf(1), [node2], 3);
  window.__fakeEntries.set("__folder_deep__", mkDir("jobs", "/jobs", [node1], 3));
}, { wfA: GOOD_A, wfB: GOOD_B, wfBad: BAD, deep: GOOD_DEEP });

// One sentinel File per item — its NAME keys the registry lookup
const makeItemDT = (names) =>
  p.evaluateHandle((ns) => {
    const d = new DataTransfer();
    for (const n of ns) d.items.add(new File([""], n, { type: "" }));
    return d;
  }, names);

const veil = () =>
  p.evaluate(() => {
    const v = document.querySelector('[data-canvas-ui="drop-import-overlay"]');
    if (!v) return null;
    const cs = getComputedStyle(v);
    return {
      text: (v.textContent || "").replace(/\s+/g, " ").trim(),
      visible: cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0,
      pe: cs.pointerEvents,
      chip: v.querySelector('[data-canvas-ui="drop-file-count"]')?.textContent?.trim() ?? null,
      folderChip: v.querySelector('[data-canvas-ui="drop-folder-chip"]')?.textContent?.replace(/\s+/g, " ").trim() ?? null,
    };
  });
const queue = () =>
  p.evaluate(() => ({
    rows: [...document.querySelectorAll('[data-testid="import-queue-row"]')].map((r) => ({
      name: r.getAttribute("data-queue-file-name") ?? "",
    })),
    fails: [...document.querySelectorAll('[data-testid="import-queue-fail"]')].map((r) => ({
      name: r.getAttribute("data-queue-file-name") ?? "",
    })),
  }));
const toastText = () =>
  p.evaluate(() =>
    [...document.querySelectorAll("ol > li")].map((li) => li.textContent?.trim() ?? "").join(" | "));
const SECTION = 'section[data-canvas="viewport"]';

/* ---------------- Phase A: folder veil ---------------- */
console.log("Phase A — folder veil contract");
must((await veil()) === null, "A1 no veil at rest");

let dt = await makeItemDT(["__folder_jobs__"]);
await p.locator(SECTION).dispatchEvent("dragenter", { dataTransfer: dt });
await sleep(250);
let v = await veil();
must(v && v.visible, "A2 directory gesture summons the veil");
must(v.text.includes("Drop folder to import"), "A3 veil copy names the folder action");
must(v.folderChip !== null && /folder/i.test(v.folderChip), `A4 folder chip shown (got ${JSON.stringify(v.folderChip)})`);
must(v.chip === null, "A5 count chip suppressed for a directory (items.length would lie)");
await p.locator(SECTION).dispatchEvent("dragleave", { dataTransfer: dt });
await sleep(150);
must((await veil()) === null, "A6 leave hides the folder veil");

// regression: a loose-file gesture still gets the honest count chip
dt = await makeItemDT(["t93-good.json"]);
await p.locator(SECTION).dispatchEvent("dragenter", { dataTransfer: dt });
await sleep(200);
v = await veil();
must(v && v.visible && v.chip === "1 file ready" && v.folderChip === null,
  `A7 loose-file gesture keeps the count chip (got ${v && JSON.stringify({ chip: v.chip, folderChip: v.folderChip })})`);
await p.locator(SECTION).dispatchEvent("dragleave", { dataTransfer: dt });
await sleep(150);

/* ---------------- Phase B: folder drop → dialog; relative names; Cancel ---------------- */
console.log("Phase B — folder drop: relative paths + inline failure; Cancel");
dt = await makeItemDT(["__folder_jobs__"]);
await p.locator(SECTION).dispatchEvent("dragenter", { dataTransfer: dt });
await p.locator(SECTION).dispatchEvent("drop", { dataTransfer: dt });
await p.waitForSelector('[data-canvas-ui="import-workflow-dialog"]', { timeout: 15_000 });
must(true, "B1 folder drop opens the preview dialog");
const qb = await queue();
const names = qb.rows.map((r) => r.name).sort();
must(names.length === 2 && names[0] === "jobs/sub/wf-b.json" && names[1] === "jobs/wf-a.json",
  `B2 queue rows use relative paths inside the folder (got ${JSON.stringify(names)})`);
must(qb.fails.length === 1 && qb.fails[0].name === "jobs/sub/wf-bad.json",
  `B3 truncated json surfaces as an inline failure row (got ${JSON.stringify(qb.fails)})`);
must(!names.join("|").includes("stack.mrcs") && !qb.fails.map((f) => f.name).join("|").includes("notes.txt"),
  "B4 data files never reach the queue (gate, not parse failure)");
await p.locator('[data-canvas-ui="import-workflow-dialog"] button', { hasText: "Cancel" }).first().click();
await p.waitForSelector('[data-canvas-ui="import-workflow-dialog"]', { state: "detached", timeout: 10_000 });
must((await listJobs()).length === jobsBefore, "B5 Cancel imports nothing");

/* ---------------- Phase C: size gate + Import ---------------- */
console.log("Phase C — 9 MB .json is gated; folder Import");
dt = await makeItemDT(["__folder_huge__"]);
await p.locator(SECTION).dispatchEvent("dragenter", { dataTransfer: dt });
await p.locator(SECTION).dispatchEvent("drop", { dataTransfer: dt });
await p.waitForSelector('[data-canvas-ui="import-workflow-dialog"]', { timeout: 15_000 });
const qc = await queue();
must(qc.rows.length === 1 && qc.rows[0].name === "jobs/wf-a.json" && !qc.rows[0].name.includes("wf-huge"),
  `C1 oversized .json skipped by the size gate (got ${JSON.stringify(qc.rows.map((r) => r.name))})`);
const confirmText = await p.evaluate(() =>
  [...document.querySelectorAll('[data-canvas-ui="import-workflow-dialog"] button')]
    .map((x) => (x.textContent ?? "").replace(/\s+/g, " ").trim())
    .find((t) => t.startsWith("Import")) ?? "");
must(confirmText.includes("1 workflow") && confirmText.includes("2 jobs"), `C2 confirm copy (got "${confirmText}")`);
await p.locator('[data-canvas-ui="import-workflow-dialog"] button', { hasText: /^Import/ }).first().click();
await p.waitForSelector('[data-canvas-ui="import-workflow-dialog"]', { state: "detached", timeout: 20_000 });
await sleep(1500);
const created = (await listJobs()).filter((j) => j.name.startsWith("t93 "));
must(created.length === 2, `C3 two jobs created by the folder drop (got ${created.length})`);
must(created.every((j) => j.status === "idle"), "C4 created idle — nothing runs");
const cardIds = created.map((j) => j.id);
const cardsOn = await p.evaluate((ids) => ids.map((id) => !!document.querySelector(`[data-job="${id}"]`)), cardIds);
must(cardsOn.every(Boolean), "C5 dropped cards land on the canvas");
must((await toastText()).includes("Workflows imported"), `C6 aggregate toast (got "${(await toastText()).slice(0, 90)}")`);

/* ---------------- Phase D: candidate-free folder → honest toast ---------------- */
console.log("Phase D — zero-candidate folder");
dt = await makeItemDT(["__folder_empty__"]);
await p.locator(SECTION).dispatchEvent("dragenter", { dataTransfer: dt });
await p.locator(SECTION).dispatchEvent("drop", { dataTransfer: dt });
await sleep(1200);
const dialogOpen = await p.evaluate(() => !!document.querySelector('[data-canvas-ui="import-workflow-dialog"]'));
must(!dialogOpen, "D1 data-only folder opens NO dialog");
must((await toastText()).includes("Nothing to import"), `D2 honest toast for a gate-skipped drop (got "${(await toastText()).slice(0, 90)}")`);
must((await listJobs()).length === jobsBefore + 2, "D3 data unchanged by the skipped drop");

/* ---------------- Phase E: depth cap ---------------- */
console.log("Phase E — depth cap keeps the walk bounded");
dt = await makeItemDT(["__folder_deep__"]);
await p.locator(SECTION).dispatchEvent("dragenter", { dataTransfer: dt });
await p.locator(SECTION).dispatchEvent("drop", { dataTransfer: dt });
await p.waitForSelector('[data-canvas-ui="import-workflow-dialog"]', { timeout: 15_000 });
const qe = await queue();
must(qe.rows.length === 1 && qe.rows[0].name.endsWith("/n7/wf-mid.json"),
  `E1 depth-8 file collected (got ${JSON.stringify(qe.rows.map((r) => r.name))})`);
must(!qe.rows.map((r) => r.name).join("|").includes("wf-deep"),
  "E2 depth-10 file skipped by the depth cap");
await p.locator('[data-canvas-ui="import-workflow-dialog"] button', { hasText: "Cancel" }).first().click();
await p.waitForSelector('[data-canvas-ui="import-workflow-dialog"]', { state: "detached", timeout: 10_000 });
must((await listJobs()).length === jobsBefore + 2, "E3 Cancel keeps the data set unchanged");

/* ---------------- Phase F: static contract ---------------- */
console.log("Phase F — static contract (source)");
const src = (f) => sh(`cat src/${f}`);
const dropSrc = src("components/workflow/drop-import.tsx");
const canvasSrc = src("components/workflow/canvas.tsx");
must(
  dropSrc.includes("webkitGetAsEntry") && dropSrc.includes("MAX_WALK_DEPTH") && dropSrc.includes("MAX_SCAN"),
  "F1 entries-API walk with depth and scan caps",
);
must(
  dropSrc.includes('endsWith(IMPORTABLE_EXT)') && dropSrc.includes("MAX_IMPORT_FILE_BYTES"),
  "F2 .json + size gate mirrors the picker forms' accept attribute",
);
must(dropSrc.includes("drop-folder-chip"), "F3 folder chip in the overlay contract");
must(dropSrc.includes("readEntries") && dropSrc.includes("batch.length === 0"), "F4 readEntries loop until empty batch");
must(canvasSrc.includes("folder={dropFolder}"), "F5 canvas passes the folder flag to the overlay");

/* ---------------- Phase Z: cleanup ---------------- */
console.log("Phase Z — cleanup");
for (const j of created) {
  try { await api(`/api/jobs/${j.id}`, "DELETE"); } catch { /* already gone */ }
}
const jobsAfter = (await listJobs()).length;
const wsAfter = (await api("/api/workspaces")).workspaces.length;
must(jobsAfter === jobsBefore, `Z1 job count restored (${jobsAfter} == baseline ${jobsBefore})`);
must(wsAfter === wsBefore, `Z2 workspace count restored (${wsAfter} == baseline ${wsBefore})`);
must(consoleErrors.filter((e) => !e.includes("400")).length === 0,
  `Z3 console clean (got ${JSON.stringify(consoleErrors.slice(0, 3))})`);

await cleanup();
console.log(`T93 ALL PASS (${PASS} assertions)`);

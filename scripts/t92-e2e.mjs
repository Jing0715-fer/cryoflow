// t92 — Task 92: canvas drag-and-drop import (the third import form) +
// single-source staging.
//
// Task 86 built the parse funnel and left the post-parse choreography
// (all-invalid toast / preview-dialog hand-off) duplicated in its two
// callers; Task 92 extracts stageWorkflowFiles and adds the third form —
// dropping workflow files onto the canvas — on top of it.
//
// Phase S — setup: API baseline (jobs/workspaces), page loaded on canvas
// Phase A — overlay contract:
//   dragenter with Files → veil visible ("Drop workflow files to import",
//   "1 file ready" chip); child-enter + parent-leave keeps it alive
//   (depth counting, not a boolean); final leave hides it; a text-only
//   drag never summons it
// Phase B — drop a valid file → preview dialog opens with the queue row;
//   veil gone; Cancel leaves the data set untouched
// Phase C — drop again → Import → jobs created idle, cards on canvas,
//   aggregate toast
// Phase D — drop an invalid-only file → NO dialog, destructive toast with
//   the first parse error (same contract as the file-picker path)
// Phase E — window guard: a drop outside the canvas has its default
//   prevented (no navigation), the app stays alive
// Phase F — static contract: stageWorkflowFiles has exactly three callers
//   (canvas input, palette, drop), guard effect exists, overlay carries
//   pointer-events-none + motion-reduce
// Phase Z — cleanup: delete t92 jobs via API, counts back to baseline
//
// Run: node scripts/t92-e2e.mjs   (server on :3000)
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
    // fire-and-forget teardown + synchronous exit: an async cleanup that
    // outlives the assertion lets the suite keep running headless (and
    // crash confusingly inside later phases — Task 91 must() lesson)
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
// self-clean: a previous crashed run may have left t92 jobs behind —
// sweep them BEFORE capturing the baseline so re-runs are idempotent
for (const j of (await listJobs()).filter((x) => x.name.startsWith("t92 "))) {
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

// In-page fixture factory: DataTransfer + File are browser constructs, so
// the JSON payloads travel as strings and become Files inside the page.
const WF = (name, jobNames) => JSON.stringify({
  format: "cryoflow-workflow",
  version: 1,
  exportedAt: "2026-09-10T02:00:00.000Z",
  project: "QA",
  workspace: "t92 source",
  jobs: jobNames.map((nm, i) => ({ type: i % 2 ? "motioncorr" : "import", name: nm, x: i * 300, y: 0, params: {} })),
  edges: [],
});
const GOOD_1 = WF("t92 drop import", ["t92 D Import", "t92 D MotionCorr"]);
const BAD = '{"format": "cryoflow-workflow"'; // truncated JSON

const makeDT = (payloads) =>
  // payloads: [{ name, json, type }] — one File per entry
  p.evaluateHandle((items) => {
    const d = new DataTransfer();
    for (const { name, json, type } of items) {
      d.items.add(new File([json], name, { type }));
    }
    return d;
  }, payloads);

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
    };
  });
const SECTION = 'section[data-canvas="viewport"]';

/* ---------------- Phase A: overlay contract ---------------- */
console.log("Phase A — overlay contract");
must((await veil()) === null, "A1 no veil at rest");

// Files drag → veil up
let dt = await makeDT([{ name: "t92-a.json", json: GOOD_1, type: "application/json" }]);
await p.locator(SECTION).dispatchEvent("dragenter", { dataTransfer: dt });
await sleep(250);
let v = await veil();
must(v && v.visible, "A2 Files dragenter summons the veil");
must(v.text.includes("Drop workflow files to import"), "A3 veil copy names the action");

// Depth counting: entering a CHILD fires leave on the PARENT while the
// gesture is still inside — a boolean would flicker the veil away.
await p.locator(SECTION).dispatchEvent("dragover", { dataTransfer: dt });
const childSel = await p.evaluate(() => {
  const el = document.querySelector('[data-canvas="workspace"] [data-job]');
  return el ? `[data-job="${el.getAttribute("data-job")}"]` : '[data-canvas="workspace"]';
});
await p.locator(childSel).first().dispatchEvent("dragenter", { dataTransfer: dt }); // depth 2
await p.locator(SECTION).dispatchEvent("dragleave", { dataTransfer: dt });          // depth 1
await sleep(150);
v = await veil();
must(v && v.visible, "A4 child-enter + parent-leave keeps the veil (depth counter, no flicker)");
await p.locator(childSel).first().dispatchEvent("dragleave", { dataTransfer: dt }); // depth 0
await sleep(150);
must((await veil()) === null, "A5 final leave hides the veil");

// A text-only drag is nobody's business
dt = await p.evaluateHandle(() => {
  const d = new DataTransfer();
  d.setData("text/plain", "not files");
  return d;
});
await p.locator(SECTION).dispatchEvent("dragenter", { dataTransfer: dt });
await sleep(150);
must((await veil()) === null, "A6 text-only drag never summons the veil");

/* ---------------- Phase B: drop valid → dialog; Cancel ---------------- */
console.log("Phase B — drop valid → preview dialog; Cancel");
dt = await makeDT([{ name: "t92-good.json", json: GOOD_1, type: "application/json" }]);
await p.locator(SECTION).dispatchEvent("dragenter", { dataTransfer: dt });
await sleep(150);
v = await veil();
must(v && v.chip === "1 file ready", `A7/B1 count chip reads the gesture (got ${v && JSON.stringify(v.chip)})`);
await p.locator(SECTION).dispatchEvent("drop", { dataTransfer: dt });
await p.waitForSelector('[data-canvas-ui="import-workflow-dialog"]', { timeout: 15_000 });
must(true, "B2 drop opens the preview dialog");
must((await veil()) === null, "B3 veil dismissed by the drop itself");
const q = await p.evaluate(() => ({
  rows: [...document.querySelectorAll('[data-testid="import-queue-row"]')].map((r) => ({
    name: r.querySelector('[data-testid="import-file-name"]')?.textContent?.trim() ?? "",
    text: r.textContent?.trim() ?? "",
  })),
}));
must(q.rows.length === 1 && q.rows[0].name === "t92-good.json", `B4 queue row is the dropped file (got ${JSON.stringify(q.rows.map((r) => r.name))})`);
must(q.rows[0].text.includes("2 jobs"), "B5 per-file job count in the row");
await p.locator('[data-canvas-ui="import-workflow-dialog"] button', { hasText: "Cancel" }).first().click();
await p.waitForSelector('[data-canvas-ui="import-workflow-dialog"]', { state: "detached", timeout: 10_000 });
must((await listJobs()).length === jobsBefore, "B6 Cancel imports nothing");

/* ---------------- Phase C: drop → Import ---------------- */
console.log("Phase C — drop → Import");
dt = await makeDT([{ name: "t92-good.json", json: GOOD_1, type: "application/json" }]);
await p.locator(SECTION).dispatchEvent("dragenter", { dataTransfer: dt });
await p.locator(SECTION).dispatchEvent("drop", { dataTransfer: dt });
await p.waitForSelector('[data-canvas-ui="import-workflow-dialog"]', { timeout: 15_000 });
const confirmText = await p.evaluate(() =>
  [...document.querySelectorAll('[data-canvas-ui="import-workflow-dialog"] button')]
    .map((x) => (x.textContent ?? "").replace(/\s+/g, " ").trim())
    .find((t) => t.startsWith("Import")) ?? "");
must(confirmText.includes("1 workflow") && confirmText.includes("2 jobs"), `C1 confirm copy (got "${confirmText}")`);
await p.locator('[data-canvas-ui="import-workflow-dialog"] button', { hasText: /^Import/ }).first().click();
await p.waitForSelector('[data-canvas-ui="import-workflow-dialog"]', { state: "detached", timeout: 20_000 });
await sleep(1500);
const created = (await listJobs()).filter((j) => j.name.startsWith("t92 "));
must(created.length === 2, `C2 two jobs created by the drop (got ${created.length})`);
must(created.every((j) => j.status === "idle"), "C3 created idle — nothing runs");
const cardIds = created.map((j) => j.id);
const cardsOn = await p.evaluate((ids) => ids.map((id) => !!document.querySelector(`[data-job="${id}"]`)), cardIds);
must(cardsOn.every(Boolean), "C4 dropped cards land on the canvas");
const toastText = await p.evaluate(() =>
  [...document.querySelectorAll("ol > li")].map((li) => li.textContent?.trim() ?? "").join(" | "));
must(toastText.includes("Workflows imported") && toastText.includes("2 jobs"), `C5 aggregate toast (got "${toastText.slice(0, 90)}")`);

/* ---------------- Phase D: invalid-only drop ---------------- */
console.log("Phase D — invalid-only drop");
dt = await makeDT([{ name: "t92-bad.json", json: BAD, type: "application/json" }]);
await p.locator(SECTION).dispatchEvent("dragenter", { dataTransfer: dt });
await p.locator(SECTION).dispatchEvent("drop", { dataTransfer: dt });
await sleep(1200);
const dialogOpen = await p.evaluate(() => !!document.querySelector('[data-canvas-ui="import-workflow-dialog"]'));
must(!dialogOpen, "D1 all-invalid drop opens NO dialog");
const dToast = await p.evaluate(() =>
  [...document.querySelectorAll("ol > li")].map((li) => li.textContent?.trim() ?? "").join(" | "));
must(dToast.includes("Import failed") && dToast.includes("Not valid JSON"), `D2 destructive toast carries the first parse error (got "${dToast.slice(0, 90)}")`);
must((await listJobs()).length === jobsBefore + 2, "D3 data unchanged by the failed drop");

/* ---------------- Phase E: window guard ---------------- */
console.log("Phase E — window guard");
// Register the probe listener AFTER mount so it runs after the guard's
// listener (same target, registration order) and can observe the
// preventDefault the guard applies to drops it does not claim.
await p.evaluate(() => {
  window.__guardSeen = { drop: null, dragover: null };
  window.addEventListener("drop", (e) => { window.__guardSeen.drop = e.defaultPrevented; });
  window.addEventListener("dragover", (e) => { window.__guardSeen.dragover = e.defaultPrevented; });
});
// two <header>s exist (app banner + print-doc header) — anchor the ROLE,
// not the tag (qa79 doctrine: role beats bare text/tag)
const HDR = 'header.no-print';
dt = await makeDT([{ name: "t92-stray.json", json: GOOD_1, type: "application/json" }]);
await p.locator(HDR).dispatchEvent("dragover", { dataTransfer: dt });
await p.locator(HDR).dispatchEvent("drop", { dataTransfer: dt });
await sleep(400);
const guardSeen = await p.evaluate(() => window.__guardSeen);
must(guardSeen.drop === true, "E1 stray drop default-prevented at window level");
must(guardSeen.dragover === true, "E2 stray dragover default-prevented at window level");
must(p.url().startsWith(BASE), "E3 no navigation followed the stray drop");
must((await curView()) === "canvas", "E4 app still alive on the canvas after the stray drop");
const guardDialog = await p.evaluate(() => !!document.querySelector('[data-canvas-ui="import-workflow-dialog"]'));
must(!guardDialog, "E5 stray drop did not stage an import");

/* ---------------- Phase F: static contract ---------------- */
console.log("Phase F — static contract (source)");
const src = (f) => sh(`cat src/${f}`);
const stageSrc = src("lib/import-stage.ts");
const canvasSrc = src("components/workflow/canvas.tsx");
const paletteSrc = src("components/workflow/command-palette.tsx");
const dropSrc = src("components/workflow/drop-import.tsx");
const pageSrc = src("app/page.tsx");
must(
  canvasSrc.includes("void stageWorkflowFiles(files)") &&
  paletteSrc.includes("await stageWorkflowFiles(files)") &&
  dropSrc.includes("onFiles(files)"),
  "F1 stageWorkflowFiles consumed by input, palette, and drop (three forms, one contract)",
);
must(pageSrc.includes("useDropNavigationGuard()"), "F2 window guard mounted app-wide (page.tsx, not canvas-scoped)");
must(dropSrc.includes("pointer-events-none"), "F3 overlay is pointer-events-none — it never swallows its own drop");
must(dropSrc.includes("motion-reduce:animate-none") && dropSrc.includes('aria-hidden="true"'), "F4 overlay motion-reduce-safe and aria-hidden");
must(dropSrc.includes('includes("Files")'), "F5 drag handlers gate on Files — text drags ignored");

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
console.log(`T92 ALL PASS (${PASS} assertions)`);
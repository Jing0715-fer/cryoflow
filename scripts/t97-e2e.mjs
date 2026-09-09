// t97 — Task 97: delete undo (same-id full-fidelity restore).
//
// Every delete affordance on the canvas promised "This cannot be undone" —
// the product's own confession. Task 97 adds a toast Undo action carrying a
// pre-delete snapshot; POST /api/jobs/restore re-creates the rows under
// their ORIGINAL ids (the engine workdir is keyed by job id and was never
// swept, so outputs/logs re-attach as if nothing happened) and the wires
// are re-POSTed sequentially (the sidecar edge file is read-modify-write).
//
// Phase S — setup: baseline, pick a completed job with edges (data-driven)
// Phase A — single delete via context menu → confirm dialog promises the
//   undo window → toast "Job deleted · Undo" → job gone (API) → Undo →
//   SAME id back with status/progress/result intact + both wires back
// Phase B — multi delete: two seeded idle jobs + a wire between them,
//   shift-click selection → Delete key → bulk confirm → Undo → both back
//   with the same ids and the wire between them
// Phase C — double-undo honesty: clicking the original toast's Undo again
//   must refuse honestly ("Nothing to undo") and leave NO duplicate rows
// Phase D — static contract: restore route (status whitelist + coerce +
//   id-collision guard), store (undoDelete + sequential re-wire + snapshot
//   wiring), honest copy in all four confirm dialogs, 409-refusal copy on
//   the linked-copies card dialog
// Phase Z — cleanup: t97 seeds deleted, console clean, counts restored
//
// Run: node scripts/t97-e2e.mjs   (server on :3000)
import { readFileSync } from "node:fs";
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
const toastText = () =>
  p.evaluate(() =>
    [...document.querySelectorAll("ol > li")].map((li) => li.textContent?.trim() ?? "").join(" | "));

/* ---------------- Phase S: setup ---------------- */
console.log("Phase S — setup");
// self-clean: sweep t97 jobs from crashed runs
for (const j of (await listJobs()).filter((x) => x.name.startsWith("t97"))) {
  try { await api(`/api/jobs/${j.id}`, "DELETE"); } catch { /* gone */ }
}
const jobsBefore = (await listJobs()).length;
must(jobsBefore >= 1, `S1 baseline reachable (${jobsBefore} jobs)`);

// data-driven target: a COMPLETED job with at least one wire — deleting it
// and undoing must bring back the run state AND the connections
const allEdges = (await api("/api/edges")).edges;
const allJobs = await listJobs();
const candidates = allJobs.filter(
  (j) =>
    j.status === "completed" &&
    allEdges.some((e) => e.fromJobId === j.id || e.toJobId === j.id)
);
must(candidates.length >= 1, `S2 a completed job with wires exists (${candidates.map((j) => j.name).join(", ") || "none"})`);
const target = candidates.find((j) => j.name === "QA Extract") ?? candidates[0];
const targetEdges = allEdges.filter((e) => e.fromJobId === target.id || e.toJobId === target.id);
must(targetEdges.length >= 1, `S3 target "${target.name}" (${target.id.slice(-6)}) has ${targetEdges.length} wire(s) + status ${target.status}`);

b = await chromium.launch();
p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
p.on("pageerror", (e) => consoleErrors.push(String(e)));

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
const card = p.locator(`[data-job="${target.id}"]`).first();
must(await card.isVisible(), "S5 target card visible on the canvas");

/* ---------------- Phase A: single delete → undo (full fidelity) ---------------- */
console.log("Phase A — single delete → undo");
// completed cards open the inspector on plain click — the context menu is
// the delete affordance that works regardless of card state
await card.click({ button: "right" });
await sleep(400);
await p.locator('[role="menuitem"]', { hasText: "Delete…" }).first().click();
await sleep(400);
const confirmDlg = p.locator('[role="alertdialog"]');
must(await confirmDlg.isVisible(), "A1 delete confirm dialog open");
const dlgText = (await confirmDlg.textContent()) ?? "";
must(
  dlgText.includes("short window to undo") && !dlgText.includes("cannot be undone"),
  `A2 dialog promises the undo window (no longer "cannot be undone")`
);
await confirmDlg.locator("button", { hasText: "Delete" }).last().click();
await sleep(1000);
const afterDelete = await listJobs();
must(!afterDelete.some((j) => j.id === target.id), `A3 job deleted (API)`);
const edgesAfterDelete = (await api("/api/edges")).edges.filter(
  (e) => e.fromJobId === target.id || e.toJobId === target.id
);
must(edgesAfterDelete.length === 0, "A3b wires gone with the job");
let tText = await toastText();
must(
  tText.includes("Job deleted") && tText.includes(target.name),
  `A4 toast names the job (got "${tText.slice(0, 90)}")`
);
// click Undo on the ORIGINAL delete toast (it stays ~20s — Phase C needs it)
const undoBtn = p.locator("ol > li", { hasText: "Job deleted" }).locator("button", { hasText: "Undo" }).first();
must(await undoBtn.isVisible(), "A5 Undo action visible on the delete toast");
await undoBtn.click();
await sleep(1500);
const afterUndo = (await listJobs()).find((j) => j.id === target.id);
must(!!afterUndo, "A6 job back — SAME id (same-id restore, not a re-creation)");
must(
  afterUndo?.status === target.status && afterUndo?.progress === target.progress && afterUndo?.result === target.result,
  `A7 run state restored verbatim (${afterUndo?.status}, progress ${afterUndo?.progress})`
);
const edgesAfterUndo = (await api("/api/edges")).edges.filter(
  (e) => e.fromJobId === target.id || e.toJobId === target.id
);
must(
  targetEdges.every((te) =>
    edgesAfterUndo.some(
      (e) => e.fromJobId === te.fromJobId && e.toJobId === te.toJobId && e.fromPort === te.fromPort && e.toPort === te.toPort
    )
  ),
  `A8 all ${targetEdges.length} wire(s) back with the same ports`
);
tText = await toastText();
must(
  tText.includes("Delete undone") && tText.includes("1 of 1 job back"),
  `A9 undo toast honest (got "${tText.slice(0, 110)}")`
);

/* ---------------- Phase B: multi delete → undo ---------------- */
console.log("Phase B — multi delete → undo");
const homeWs = ((await api("/api/workspaces")).workspaces)[0];
const seededA = (await api("/api/jobs", "POST", {
  type: "motioncorr",
  name: "t97 Alpha MotionCorr",
  workspaceId: homeWs.id,
  x: 300,
  y: 300,
})).job;
const seededB = (await api("/api/jobs", "POST", {
  type: "motioncorr",
  name: "t97 Beta MotionCorr",
  workspaceId: homeWs.id,
  x: 760,
  y: 300,
})).job;
const seededEdge = (await api("/api/edges", "POST", {
  fromJobId: seededA.id,
  toJobId: seededB.id,
})).edge;
must(!!seededA?.id && !!seededB?.id && !!seededEdge?.id, "B1 two idle jobs + one wire seeded");
await p.reload({ waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await sleep(800);
await p.locator(`[data-job="${seededA.id}"]`).first().click();
await sleep(300);
await p.locator(`[data-job="${seededB.id}"]`).first().click({ modifiers: ["Shift"] });
await sleep(300);
await p.keyboard.press("Delete");
await sleep(500);
const bulkDlg = p.locator('[role="alertdialog"]');
must(
  ((await bulkDlg.textContent()) ?? "").includes("Delete 2 jobs"),
  "B2 bulk confirm shows the pair count"
);
await bulkDlg.locator("button", { hasText: "Delete 2 jobs" }).last().click();
await sleep(1200);
const afterBulk = await listJobs();
must(
  !afterBulk.some((j) => j.id === seededA.id || j.id === seededB.id),
  "B3 both seeded jobs deleted (API)"
);
const bulkUndo = p.locator("ol > li", { hasText: "Deleted 2 jobs" }).locator("button", { hasText: "Undo" }).first();
must(await bulkUndo.isVisible(), "B4 Undo visible on the bulk delete toast");
await bulkUndo.click();
await sleep(1800);
const afterBulkUndo = await listJobs();
const backA = afterBulkUndo.find((j) => j.id === seededA.id);
const backB = afterBulkUndo.find((j) => j.id === seededB.id);
must(!!backA && !!backB, "B5 both jobs back — SAME ids");
const wireBack = (await api("/api/edges")).edges.some(
  (e) => e.fromJobId === seededA.id && e.toJobId === seededB.id
);
must(wireBack, "B6 the wire between them reconnected");

/* ---------------- Phase C: undo is single-shot ---------------- */
console.log("Phase C — undo is single-shot");
// Radix Toast.Action CLOSES its toast on click — the undo action consumes
// itself, so a double click is impossible in the UI. Assert that contract,
// then prove the SERVER backstop still refuses a replayed restore.
await sleep(800);
tText = await toastText();
must(
  !tText.includes("Deleted 2 jobs"),
  `C1 the delete toast closed on Undo — the action is single-shot (got "${tText.slice(0, 90)}")`
);
const replay = await api("/api/jobs/restore", "POST", {
  jobs: [
    { id: seededA.id, type: "motioncorr", name: seededA.name },
    { id: seededB.id, type: "motioncorr", name: seededB.name },
  ],
});
must(
  replay.failed.length === 2 &&
    replay.failed.every((f) => f.error === "A job with this id already exists"),
  "C2 server backstop: replayed restore fails on id collision (both rows)"
);
const dupCount = (await listJobs()).filter(
  (j) => j.id === seededA.id || j.id === seededB.id || j.name === seededA.name || j.name === seededB.name
).length;
must(dupCount === 2, "C3 no duplicates minted by the replay (2 rows, same ids)");

/* ---------------- Phase D: static contract ---------------- */
console.log("Phase D — static contract");
const restoreSrc = readFileSync("src/app/api/jobs/restore/route.ts", "utf8");
must(
  restoreSrc.includes('new Set(["idle", "pending", "completed", "failed"])') &&
    restoreSrc.includes('input.status === "running"'),
  "D1 restore route: status whitelist + running coerce"
);
must(
  restoreSrc.includes("A job with this id already exists"),
  "D2 restore route: id-collision guard (the double-undo backstop)"
);
must(
  restoreSrc.includes("same sanitizer") && restoreSrc.includes("allowed.add(\"empiarData\")"),
  "D3 restore route: params scalar filter mirrors POST (import engine flag included)"
);
const storeSrc = readFileSync("src/lib/store.ts", "utf8");
must(
  storeSrc.includes("undoDelete: async (snapshot)") &&
    storeSrc.includes("export interface DeleteSnapshot"),
  "D4 store: undoDelete + DeleteSnapshot exported"
);
must(
  storeSrc.includes("read-modify-write") && storeSrc.includes("for (const e of snapshot.edges)"),
  "D5 store: wires re-POSTed sequentially (sidecar concurrency)"
);
must(
  (storeSrc.match(/duration: 20_000/g) ?? []).length >= 3,
  "D6 store: 20s undo window on all three delete toasts"
);
must(
  storeSrc.includes("jobs: get().jobs.filter((j) => idSet.has(j.id))"),
  "D7 store: deleteSelected snapshots BEFORE deleting"
);
for (const f of ["src/app/page.tsx", "src/components/workflow/canvas.tsx", "src/components/workflow/job-panel.tsx"]) {
  const src = readFileSync(f, "utf8");
  must(
    src.includes("short window to undo") && !src.includes("cannot be undone"),
    `D8 ${f}: undo-window copy replaced the lie`
  );
}
const cardSrc = readFileSync("src/components/workflow/job-card.tsx", "utf8");
must(
  cardSrc.includes("the server refuses to delete it until they are removed") &&
    !cardSrc.includes("will be removed too"),
  "D9 card dialog: linked-copies claim matches the 409 refusal"
);
const delRoute = readFileSync("src/app/api/jobs/[id]/route.ts", "utf8");
must(
  delRoute.includes("REFUSED (409)") && delRoute.includes("/api/jobs/restore"),
  "D10 DELETE route comment: refusal story + undo pointer (stale cascade myth retired)"
);

/* ---------------- Phase Z: cleanup ---------------- */
console.log("Phase Z — cleanup");
for (const j of [backA, backB]) {
  if (j) try { await api(`/api/jobs/${j.id}`, "DELETE"); } catch { /* gone */ }
}
const residual = (await listJobs()).filter((x) => x.name.startsWith("t97"));
must(residual.length === 0, `Z1 t97 seeds deleted (got ${residual.length} left)`);
must((await listJobs()).length === jobsBefore, `Z2 job count restored (${await listJobs().then((l) => l.length)} == ${jobsBefore})`);
must(target && (await listJobs()).some((j) => j.id === target.id && j.status === "completed"), "Z3 the completed target is still on the canvas, untouched");
await sleep(400);
must(consoleErrors.length === 0, `Z4 console clean (got ${consoleErrors.length})`);

console.log(`T97 ALL PASS (${PASS} assertions)`);
await cleanup();
process.exit(0);

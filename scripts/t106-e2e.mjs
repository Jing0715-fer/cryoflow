// t106 — Task 106: the history panel (the linear stack made visible).
//
// Task 104 built the command stack, Task 105 put the next entry in the
// tooltips — Task 106 finishes the trilogy with the Photoshop-style
// panel: past rows (oldest → newest), a Now divider, future rows
// (italic, next-redo first). Clicking a past row undoes everything
// after it; clicking a future row redoes up to it. Jumps run through
// undoSteps/redoSteps — n sequential awaits of the SAME single-step
// undo()/redo() paths the keyboard walks (one inverse implementation,
// zero drift), with an early exit that keeps a stale count from
// toasting. Rows lock (disabled + opacity) while a batch is in flight.
//
// Phase S — pre-clean, remote band seeding (3 cards), canvas view
// Phase H — build history: drag A, drag B, delete C → panel shows 3
//           past rows with the right labels, Now divider, 0 future
// Phase J — jump past: click row 0 (Move A) → B restored + C restored
//           (SAME id) + A still moved (API truth); panel: 1 past,
//           2 future; trigger gains text-primary
// Phase R — walk the future: click "Delete C" row → C re-deleted, B
//           still original; click "Move B" row → B moved again;
//           panel drains to 3 past / 0 future
// Phase D — divergence: a fresh drag pushes onto the (empty) future
//           branch → panel grows to 4 past rows
// Phase E — reload → history is in-memory: empty-state text, 0 steps
// Phase F — static contract: store loops + early exit, panel testids,
//           jump math, busy lock, no persistence
// Phase Z — cleanup (every seeded job deleted), console clean
//
// Run: node scripts/t106-e2e.mjs   (server on :3000)
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let PASS = 0;
let b = null;
let p = null;
const seeded = []; // {id, name} — Z deletes every one, FATAL paths included
async function cleanup() {
  try { if (p) await p.close(); } catch {}
  try { if (b) await b.close(); } catch {}
  for (const s of seeded) {
    try { await fetch(`${BASE}/api/jobs/${s.id}`, { method: "DELETE" }); } catch {}
  }
}
const must = (cond, label) => {
  if (!cond) {
    console.log(`FATAL: ${label}`);
    // sync exit (t102 lesson): an async cleanup lets the caller keep
    // running into a closed page — close fire-and-forget, die now
    p?.close().catch(() => {});
    b?.close().catch(() => {});
    process.exit(1);
  }
  PASS++;
  console.log(`  ok: ${label}`);
};

const api = async (path, method = "GET", body) => {
  const r = await fetch(BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return r;
};
const listJobs = async () => {
  const r = await api("/api/jobs");
  const j = await r.json();
  return j.jobs ?? j;
};
const jobById = async (id) => (await listJobs()).find((j) => j.id === id) ?? null;

const curView = () =>
  p.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view") ?? "");
const toCanvas = async () => {
  for (let i = 0; i < 4 && (await curView()) !== "canvas"; i++) {
    await p.keyboard.press("Shift+C");
    await sleep(700);
  }
};
/** the minimap svg's world mapping — the t105 navigation helper */
const mapGeo = async () =>
  p.evaluate(() => {
    const svg = document.querySelector('[data-canvas-ui="minimap-svg"]');
    if (!svg) return null;
    const vb = (svg.getAttribute("viewBox") ?? "").split(/\s+/).map(Number);
    const r = svg.getBoundingClientRect();
    return { wx: vb[0], wy: vb[1], ww: vb[2], wh: vb[3], x: r.x, y: r.y, w: r.width, h: r.height };
  });
const worldToClient = (g, wx, wy) => ({
  x: g.x + ((wx - g.wx) / g.ww) * g.w,
  y: g.y + ((wy - g.wy) / g.wh) * g.h,
});
/** Real card drag: pointer down at the card's screen center, move by
 *  (dx,dy) SCREEN px, up. Caller sleeps past the PATCH before reading. */
const dragCard = async (id, dx, dy) => {
  const box = await p.locator(`[data-job="${id}"]`).boundingBox();
  must(box, `drag target ${id} is on screen`);
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  await p.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 6 });
  await p.mouse.up();
};
const pos = async (id) => {
  const j = await jobById(id);
  return j ? { x: j.x, y: j.y } : null;
};
/** idempotent panel open (t102 lesson: the trigger TOGGLES) */
const openHistory = async () => {
  if ((await p.locator('[data-canvas-ui="history-panel"]').count()) === 0) {
    await p.locator('[data-canvas-ui="history-trigger"]').click();
    await sleep(350);
  }
  must(await p.locator('[data-canvas-ui="history-panel"]').isVisible(),
    "history panel open");
};
const histRows = (kind) => p.locator(`[data-canvas-ui="history-row"][data-history-kind="${kind}"]`);
const rowText = (loc) => loc.evaluate((el) => el.textContent ?? "");

/* ---------------- browser ---------------- */
b = await chromium.launch();
p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
p.on("pageerror", (e) => consoleErrors.push(String(e)));

try {
  /* ---------------- Phase S: seeding + view ---------------- */
  console.log("Phase S — seeding, canvas view");
  const existing0 = await listJobs();
  for (const j of existing0.filter((j) => j.name?.startsWith("t106 "))) {
    await api(`/api/jobs/${j.id}`, "DELETE");
  }
  const all = await listJobs();
  const wsId = (await (await api("/api/workspaces")).json()).workspaces?.[0]?.id ?? "";
  must(wsId !== "", "S0 workspace resolved for seeding");
  const maxY = all.reduce((m, j) => Math.max(m, j.y ?? 0), 0);
  const maxX = all.reduce((m, j) => Math.max(m, j.x ?? 0), 0);
  const Y0 = Math.round(maxY + 2200);
  const X0 = Math.round(maxX + 3000);
  must(Y0 > maxY + 2000 && X0 > maxX + 2500,
    `S1 band is ${Y0 - maxY}px below and ${X0 - maxX}px east of the old world`);
  const seedSpecs = [
    ["t106 A", X0, Y0],
    ["t106 B", X0 + 400, Y0 + 260],
    ["t106 C", X0 + 800, Y0],
  ];
  for (const [name, x, y] of seedSpecs) {
    const r = await (await api("/api/jobs", "POST", { type: "refine3d", name, workspaceId: wsId, x, y })).json();
    seeded.push({ id: r.job.id, name });
  }
  must(seeded.length === 3, "S2 three cards seeded in the remote band");
  await p.goto(BASE, { waitUntil: "networkidle" });
  await sleep(1200);
  await toCanvas();
  must((await curView()) === "canvas", "S3 canvas view active");
  // bring the band into view: 100% zoom + one map-click at card A
  await p.keyboard.press("0");
  await sleep(600);
  const A = seeded[0], B = seeded[1], C = seeded[2];
  const g0 = await mapGeo();
  must(g0, "S4 minimap geometry readable");
  const home = worldToClient(g0, X0 + 110, Y0 + 48);
  await p.mouse.click(home.x, home.y);
  await sleep(700);
  must((await p.locator(`[data-job="${A.id}"]`).count()) === 1 &&
       (await p.locator(`[data-job="${B.id}"]`).count()) === 1 &&
       (await p.locator(`[data-job="${C.id}"]`).count()) === 1,
    "S5 all three band cards on screen (map-click navigation)");

  /* ---------------- Phase H: build history ---------------- */
  console.log("Phase H — drag A, drag B, delete C");
  const origA = await pos(A.id);
  const origB = await pos(B.id);
  await dragCard(A.id, 140, 90);
  await sleep(1000);
  const movedA = await pos(A.id);
  must(movedA && origA && Math.abs(movedA.x - origA.x - 140) <= 2 && Math.abs(movedA.y - origA.y - 90) <= 2,
    `H1 drag A committed (+140,+90): got (${movedA.x - origA.x},${movedA.y - origA.y})`);
  await dragCard(B.id, 60, 40);
  await sleep(1000);
  const movedB = await pos(B.id);
  must(movedB && origB && Math.abs(movedB.x - origB.x - 60) <= 2 && Math.abs(movedB.y - origB.y - 40) <= 2,
    `H2 drag B committed (+60,+40): got (${movedB.x - origB.x},${movedB.y - origB.y})`);
  await clickCardById(C.id);
  await p.keyboard.press("Delete");
  await sleep(600);
  const confirmBtn = p.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true });
  must(await confirmBtn.isVisible(), "H3 keyboard delete asks first (Task 97 guard)");
  await confirmBtn.click();
  await sleep(1200);
  must((await jobById(C.id)) === null, "H4 C deleted (server truth)");
  // the delete's confirm click may have dismissed the popover — open it now
  await openHistory();
  must((await histRows("past").count()) === 3, "H5 panel shows 3 past rows");
  must(/Move t106 A/.test(await rowText(histRows("past").nth(0))) &&
       /Move t106 B/.test(await rowText(histRows("past").nth(1))) &&
       /Delete t106 C/.test(await rowText(histRows("past").nth(2))),
    "H6 labels in application order (A, B, Delete C)");
  must((await histRows("future").count()) === 0, "H7 no future rows yet");
  must((await p.locator('[data-canvas-ui="history-now"]').count()) === 1,
    "H7b Now divider present");
  must((await p.locator('[data-canvas-ui="history-count"]').textContent()) === "3 steps",
    "H7c count badge reads the stacks");

  /* ---------------- Phase J: jump into the past ---------------- */
  console.log("Phase J — click past row 0 (Move A)");
  await histRows("past").nth(0).click();
  await sleep(2200); // two sequential server-synced steps (undo Move B, undo Delete C)
  const backB = await pos(B.id);
  must(backB && backB.x === origB.x && backB.y === origB.y,
    "J1 B restored to pre-drag position");
  const backC = await jobById(C.id);
  must(!!backC, "J2 C restored (SAME id — restore, not re-creation)");
  const stillA = await pos(A.id);
  must(stillA && stillA.x === movedA.x && stillA.y === movedA.y,
    "J3 A stays moved (row 0 = keep THAT change, undo what came after)");
  must((await histRows("past").count()) === 1 && (await histRows("future").count()) === 2,
    "J4 panel: 1 past row, 2 future rows after the jump");
  must((await p.locator('[data-canvas-ui="history-trigger"]').getAttribute("class"))?.includes("text-primary") === true,
    "J5 trigger highlights while undone work is parked in the future");

  /* ---------------- Phase R: walk the future ---------------- */
  console.log("Phase R — click future rows (Move B, then Delete C)");
  // future = [Delete C, Move B] (undo pushes to the END — the most
  // recently undone is the next redo). Display reverses the array so the
  // next-redo (Move B) is displayed first, closest to "Now".
  must(/Move t106 B/.test(await rowText(histRows("future").nth(0))),
    "R0 next-redo row (Move B) is displayed first, closest to Now");
  await histRows("future").nth(0).click();
  await sleep(1800); // one PATCH round-trip
  const againB = await pos(B.id);
  must(againB && againB.x === movedB.x && againB.y === movedB.y,
    "R1 B moved again (redo up to 'Move B')");
  must((await jobById(C.id)) !== null,
    "R1b C stays restored (partial redo — one step, no more)");
  must(/Delete t106 C/.test(await rowText(histRows("future").nth(0))),
    "R1c the remaining future row is 'Delete C'");
  await histRows("future").nth(0).click();
  await sleep(1800);
  must((await jobById(C.id)) === null, "R2 C re-deleted (future drained)");
  must((await histRows("past").count()) === 3 && (await histRows("future").count()) === 0,
    "R2b panel: 3 past rows, 0 future rows");
  must((await p.locator('[data-canvas-ui="history-trigger"]').getAttribute("class"))?.includes("text-primary") !== true,
    "R2c trigger drops the highlight when nothing is parked");

  /* ---------------- Phase D: divergence grows the past ---------------- */
  console.log("Phase D — fresh drag after jumps");
  await dragCard(A.id, 30, 30);
  await sleep(1000);
  const divA = await pos(A.id);
  must(divA && Math.abs(divA.x - movedA.x - 30) <= 3 && Math.abs(divA.y - movedA.y - 30) <= 3,
    "D1 drag A again (+30,+30) — the branch point moves forward");
  await openHistory(); // the drag's pointerdown dismissed the popover
  must((await histRows("past").count()) === 4, "D2 panel grows to 4 past rows");
  must(/Move t106 A/.test(await rowText(histRows("past").nth(3))),
    "D2b newest row is the fresh drag");

  /* ---------------- Phase E: reload → in-memory history ---------------- */
  console.log("Phase E — reload clears the stack (by design)");
  await p.reload({ waitUntil: "networkidle" });
  await sleep(1200);
  await toCanvas();
  await openHistory();
  must(await p.locator('[data-canvas-ui="history-empty"]').isVisible(),
    "E1 empty-state text on a fresh session");
  must((await p.locator('[data-canvas-ui="history-count"]').textContent()) === "0 steps",
    "E1b count badge reads 0 steps");

  /* ---------------- Phase F: static contract ---------------- */
  console.log("Phase F — static contract");
  const storeSrc = readFileSync("src/lib/store.ts", "utf8");
  const canvasSrc = readFileSync("src/components/workflow/canvas.tsx", "utf8");
  must(/undoSteps: async \(n\) => \{/.test(storeSrc) &&
       /for \(let k = 0; k < n; k\+\+\)/.test(storeSrc) &&
       /await get\(\)\.undo\(\)/.test(storeSrc),
    "F1 undoSteps: sequential awaits of the single-step path");
  must(/redoSteps: async \(n\) => \{/.test(storeSrc) &&
       /if \(get\(\)\.historyFuture\.length === 0\) return;/.test(storeSrc),
    "F1b redoSteps loop + early exit on empty future");
  must(/history-row/.test(canvasSrc) && /data-history-kind="past"/.test(canvasSrc) &&
       /data-history-kind="future"/.test(canvasSrc) && /history-now/.test(canvasSrc) &&
       /history-empty/.test(canvasSrc),
    "F2 panel probe hooks: rows (past+future), Now divider, empty state");
  must(/disabled=\{jumping\}/.test(canvasSrc) &&
       /setJumping\(true\)/.test(canvasSrc) &&
       /finally\(\(\) => setJumping\(false\)\)/.test(canvasSrc),
    "F3 busy lock: rows disabled while a batch is in flight");
  must(/historyPast\.length - 1 - i/.test(canvasSrc) &&
       /historyFuture\.length - i/.test(canvasSrc),
    "F4 jump math reads live stack lengths (panel = a view over the stacks)");
  must(!/storage\.setItem\([^)]*histor/i.test(storeSrc) &&
       !/storage\.setItem/.test(canvasSrc),
    "F5 history stays in-memory (canvas has ZERO storage.setItem calls — all storage writes live in the store)");

  /* ---------------- Phase Z: cleanup + console ---------------- */
  console.log("Phase Z — cleanup");
  // R2 already deleted C — a DELETE on a dead id 404s. The cleanliness
  // contract is "gone from the server", not "DELETE said ok" (t103:
  // 清理按世界恢复原状验收，不按调用了 DELETE 验收).
  for (const s of seeded) {
    await api(`/api/jobs/${s.id}`, "DELETE").catch(() => {});
  }
  const left = (await listJobs()).filter((j) => seeded.some((s) => s.id === j.id));
  must(left.length === 0, `Z1 all seeded jobs gone from the server (got ${left.length} left)`);
  must(consoleErrors.length === 0, `Z2 console clean (got ${consoleErrors.length})`);
  consoleErrors.slice(0, 5).forEach((e) => console.log(`    console: ${e.slice(0, 200)}`));

  console.log(`T106 ALL PASS (${PASS} assertions)`);
} finally {
  await cleanup();
}

async function clickCardById(id) {
  await p.locator(`[data-job="${id}"]`).click();
  await sleep(350);
}

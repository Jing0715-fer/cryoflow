// t125 — Task 125: history panel kind icons + consecutive-run disclosure
// groups. The entry carries its kind structurally (store.ts sets it at
// every push site); the panel icons rows by kind and collapses runs of
// HISTORY_GROUP_MIN+ same-kind entries into one disclosure row.
//
// Phases:
//   S  — remote-band seeding (t106 dialect), minimap navigation
//   A  — threshold: 1-2 moves stay loose rows (with icons), 3 collapse
//   B  — disclosure: expand reveals leaves, numbering intact, jump from a
//        leaf still walks the stack, future-side pairs stay loose
//   K  — kind mix: a delete breaks the run; trash icon salience
//   F  — static contracts: structural kind in store, GROUP_MIN, meta table,
//        bundle carries the group dialect
//   Z  — cleanup + console
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { setTimeout as sleep } from "timers/promises";

const BASE = "http://localhost:3000";
let b = null;
let p = null;
let passed = 0;
const seeded = []; // {id} — Z deletes every one, FATAL paths included
const must = (cond, msg) => {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  passed++;
  console.log(`  ok: ${msg}`);
};

const api = async (path, method = "GET", body) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
};
const listJobs = async () => {
  const j = await (await api("/api/jobs")).json();
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
/** Real card drag: pointer down at center, move by SCREEN px, up. */
const dragCard = async (id, dx, dy) => {
  const box = await p.locator(`[data-job="${id}"]`).boundingBox();
  must(box, `drag target ${id} is on screen`);
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  await p.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 6 });
  await p.mouse.up();
};
const openHistory = async () => {
  if ((await p.locator('[data-canvas-ui="history-panel"]').count()) === 0) {
    await p.locator('[data-canvas-ui="history-trigger"]').click();
    await sleep(350);
  }
  must(await p.locator('[data-canvas-ui="history-panel"]').isVisible(), "history panel open");
};
const leafRows = (kind) =>
  p.locator(`[data-canvas-ui="history-row"][data-history-kind="${kind}"]`);
const groupRows = (kind) =>
  p.locator(`[data-canvas-ui="history-group"]${kind ? `[data-history-kind="${kind}"]` : ""}`);
const rowText = (loc) => loc.evaluate((el) => el.textContent ?? "");
const rowNumbers = async (kind) =>
  leafRows(kind).evaluateAll((els) =>
    els.map((el) => el.querySelector("span")?.textContent ?? ""));

/* ---------------- browser ---------------- */
b = await chromium.launch();
p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
p.on("pageerror", (e) => consoleErrors.push(String(e)));

try {
  /* ---------------- Phase S: seeding + navigation ---------------- */
  console.log("Phase S — seeding, canvas view");
  const existing0 = await listJobs();
  for (const j of existing0.filter((j) => j.name?.startsWith("t125 "))) {
    await api(`/api/jobs/${j.id}`, "DELETE");
  }
  const all = await listJobs();
  const wsId = (await (await api("/api/workspaces")).json()).workspaces?.[0]?.id ?? "";
  must(wsId !== "", "S0 workspace resolved for seeding");
  const maxY = all.reduce((m, j) => Math.max(m, j.y ?? 0), 0);
  const maxX = all.reduce((m, j) => Math.max(m, j.x ?? 0), 0);
  const X0 = Math.round(maxX + 3000);
  const Y0 = Math.round(maxY + 2200);
  const seedSpecs = [
    ["t125 A", X0, Y0],
    ["t125 B", X0 + 320, Y0],
    ["t125 C", X0, Y0 + 260],
    ["t125 D", X0 + 320, Y0 + 260],
  ];
  for (const [name, x, y] of seedSpecs) {
    const r = await (await api("/api/jobs", "POST", { type: "refine3d", name, workspaceId: wsId, x, y })).json();
    seeded.push({ id: r.job.id });
  }
  must(seeded.length === 4, "S1 four cards seeded in the remote band");
  const [A, B, C, D] = seeded;
  await p.goto(BASE, { waitUntil: "networkidle" });
  await sleep(1200);
  await toCanvas();
  must((await curView()) === "canvas", "S2 canvas view active");
  // bring the band into view: 100% zoom + one map-click at card A
  await p.keyboard.press("0");
  await sleep(600);
  const g0 = await mapGeo();
  must(g0, "S3 minimap geometry readable");
  const home = worldToClient(g0, X0 + 110, Y0 + 48);
  await p.mouse.click(home.x, home.y);
  await sleep(700);
  must((await p.locator(`[data-job="${A.id}"]`).count()) === 1 &&
       (await p.locator(`[data-job="${D.id}"]`).count()) === 1,
    "S4 band cards on screen (map-click navigation)");

  /* ---------------- Phase A: threshold behavior ---------------- */
  console.log("Phase A — 1-2 moves stay loose, 3 collapse");
  await dragCard(A.id, 60, 40);
  await sleep(1000);
  await openHistory();
  must((await leafRows("past").count()) === 1 && (await groupRows("").count()) === 0,
    "A1 one move = one loose row, no groups");
  must((await leafRows("past").nth(0).locator("svg").count()) >= 1,
    "A2 the loose row carries a kind icon");

  await dragCard(B.id, 60, 40);
  await sleep(1000);
  await openHistory();
  must((await leafRows("past").count()) === 2 && (await groupRows("").count()) === 0,
    "A3 a pair of moves is normal work — still two loose rows");

  await dragCard(C.id, 60, 40);
  await sleep(1000);
  await openHistory();
  must((await leafRows("past").count()) === 0, "A4 three moves collapse — zero loose rows");
  const grp = groupRows("move");
  must((await grp.count()) === 1, "A5 exactly one move group");
  must((await grp.getAttribute("data-run-count")) === "3", "A6 group carries run count 3");
  must((await grp.getAttribute("aria-expanded")) === "false", "A7 group starts collapsed");
  must(/3× move/.test(await rowText(grp)), "A8 group label reads '3× move'");
  must(/Move t125 A · Move t125 B · Move t125 C/.test((await grp.getAttribute("title")) ?? ""),
    "A9 group tooltip carries every label in order");
  must((await grp.locator("svg").count()) >= 2, "A10 group carries chevron + kind icon");

  /* ---------------- Phase B: disclosure + jumps still work ---------------- */
  console.log("Phase B — expand, jump from a leaf, future-side symmetry");
  await grp.click();
  await sleep(300);
  must((await grp.getAttribute("aria-expanded")) === "true", "B1 click expands the group");
  must((await leafRows("past").count()) === 3, "B2 expansion reveals the three leaves");
  must(JSON.stringify(await rowNumbers("past")) === JSON.stringify(["1", "2", "3"]),
    "B3 absolute numbering survives the disclosure");
  must(/Move t125 A/.test(await rowText(leafRows("past").nth(0))),
    "B4 first leaf is Move A (application order)");

  // collapse again — disclosure is a toggle
  await grp.click();
  await sleep(200);
  must((await grp.getAttribute("aria-expanded")) === "false" &&
       (await leafRows("past").count()) === 0,
    "B5 second click re-collapses");

  // jump from inside the expanded group: expand, click the OLDEST leaf,
  // everything after it undoes (B and C restored)
  await grp.click();
  await sleep(200);
  await leafRows("past").nth(0).click();
  await sleep(2400); // two sequential server-synced undo steps
  must(await jobById(D.id), "B6 job D untouched by the run jump");
  must((await leafRows("past").count()) === 1, "B7 one past row remains (Move A kept)");
  // future = the two undone moves, rendered next-redo first — a pair →
  // below threshold, still loose rows
  must((await leafRows("future").count()) === 2 && (await groupRows("").count()) === 0,
    "B8 future pair stays loose (below threshold), no group");
  must(JSON.stringify(await rowNumbers("future")) === JSON.stringify(["3", "2"]),
    "B9 future numbering descends from the top (3 then 2)");

  // redo one step via the future leaf — the linear walk is intact
  await leafRows("future").nth(0).click();
  await sleep(1800);
  must((await leafRows("past").count()) === 2 && (await leafRows("future").count()) === 1,
    "B10 redo from a leaf: 2 past, 1 future");

  /* ---------------- Phase K: kind mix breaks runs ---------------- */
  console.log("Phase K — a delete breaks the run, trash icon salience");
  // past is [Move A, Move B], future [Move C]. Drag D → past gains Move D
  // → a fresh 3-run; then delete D → kinds [move×3, delete] → one group
  // + one loose trash row.
  await dragCard(D.id, 90, 30);
  await sleep(1000);
  await openHistory();
  must((await groupRows("move").count()) === 1 && (await leafRows("past").count()) === 0,
    "K1 the fresh move rejoins a 3-run");
  // delete t125 D via selection + keyboard (t106 dialect)
  await p.locator(`[data-job="${D.id}"]`).click();
  await sleep(300);
  await p.keyboard.press("Delete");
  await sleep(600);
  const confirmBtn = p.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true });
  must(await confirmBtn.isVisible(), "K2 keyboard delete asks first (Task 97 guard)");
  await confirmBtn.click();
  await sleep(1200);
  must((await jobById(D.id)) === null, "K3 D deleted (server truth)");
  await openHistory();
  must((await groupRows("move").count()) === 1 && (await leafRows("past").count()) === 1,
    "K4 delete breaks the run: one move group + one loose delete row");
  must(/Delete t125 D/.test(await rowText(leafRows("past").nth(0))),
    "K5 the loose row is the delete");
  must((await leafRows("past").nth(0).locator("svg.lucide-trash-2, svg.lucide-trash2").count()) === 1,
    "K6 the delete row carries the trash icon");

  /* ---------------- Phase F: static contracts ---------------- */
  console.log("Phase F — static contracts");
  const storeSrc = readFileSync("src/lib/store.ts", "utf8");
  must(/export type HistoryEntryKind = "move" \| "tidy" \| "delete"/.test(storeSrc) &&
       /kind: HistoryEntryKind;/.test(storeSrc),
    "F1 the entry kind is a structural field, typed in store");
  must((storeSrc.match(/kind: "(move|tidy|delete)"/g) ?? []).length === 5,
    "F2 every push site sets its kind (2 moves + 2 deletes + 1 tidy)");
  const canvasSrc = readFileSync("src/components/workflow/canvas.tsx", "utf8");
  must(/HISTORY_GROUP_MIN = 3/.test(canvasSrc) && /historyRuns\(/.test(canvasSrc),
    "F3 run computation + threshold live in canvas");
  must(/HISTORY_KIND_META/.test(canvasSrc) && /noun: "auto-arrange"/.test(canvasSrc),
    "F4 kind meta table drives icons + nouns (no label parsing)");
  must(/data-canvas-ui="history-group"/.test(canvasSrc) && /aria-expanded=\{open\}/.test(canvasSrc),
    "F5 disclosure rows are buttons with aria-expanded");
  const chunkHit = await p.evaluate(async () => {
    const links = [...document.querySelectorAll("script[src]")].map((s) => s.src);
    for (const src of links) {
      const txt = await (await fetch(src)).text();
      if (txt.includes("history-group")) return true;
    }
    return false;
  });
  must(chunkHit, "F6 the shipped bundle carries the group dialect");

  /* ---------------- Phase Z: cleanup + console ---------------- */
  console.log("Phase Z — cleanup");
  const remaining = await listJobs();
  must(remaining.filter((j) => j.name?.startsWith("t125 ")).length === 3,
    "Z1 exactly the deleted D is gone (A-C remain for cleanup)");

  const pageErrors = consoleErrors.filter((e) => !/Failed to load resource/i.test(e) || !/404|status of 4/.test(e));
  must(pageErrors.length === 0, `Z2 zero unexpected console errors (got ${pageErrors.length}: ${pageErrors[0] ?? "-"})`);

  console.log(`\nT125 ALL PASS (${passed} assertions)`);
} finally {
  try { if (p) await p.close(); } catch {}
  try { if (b) await b.close(); } catch {}
  for (const s of seeded) {
    try { await fetch(`${BASE}/api/jobs/${s.id}`, { method: "DELETE" }); } catch {}
  }
}

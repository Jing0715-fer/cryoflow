// t104 — Task 104: linear undo/redo history (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y).
//
// The delete toast's Undo closure (Task 97) was the only undo in the app —
// it expired with the toast and nothing could unwind a bad MOVE, ALIGN or
// TIDY. Task 104 generalizes that closure into a linear command stack:
// position commits (drag / group drag / align / distribute / auto-tidy) and
// deletes (single + bulk) push entries whose undo/redo closures perform
// their own server sync (PATCH by id; /api/jobs/restore re-creates rows
// VERBATIM — both inverses are id-stable, which is exactly why adds and
// edge edits are EXCLUDED: recreating them mints new server ids, so they
// kill the redo branch instead (invalidateRedo)).
//
// The probe walks the stack through every entrance the user has:
// keyboard (Ctrl+Z / Ctrl+Shift+Z), the zoom-controls buttons, and the
// delete toast's Undo action — and asserts the toast path UNIFIES with the
// stack (undoing from the toast leaves redo available, exactly like Ctrl+Z).
// Server truth (API reads) is the referee for every position/ existence
// assertion; the browser only supplies real gestures.
//
// Phase S — pre-clean, remote band seeding (3 cards), canvas view
// Phase M — drag A → Ctrl+Z restores → Ctrl+Shift+Z re-applies (API truth)
// Phase U — drag B → toolbar undo-btn / redo-btn walk the same stack
// Phase D — delete C (keyboard + confirm) → Ctrl+Z restores SAME id →
//           Ctrl+Shift+Z re-deletes
// Phase B — delete C again → toast Undo button → C back; redo re-deletes
//           (the toast path unifies with the linear stack)
// Phase T — auto-tidy (Wand2) moves everything → Ctrl+Z restores every
//           pre-layout position
// Phase I — Ctrl+D duplicate KILLS the redo branch: Ctrl+Shift+Z is an
//           honest no-op (the tidy stays undone, the copy stays)
// Phase F — static contract: cap+slice pushes, pop-before-run undo,
//           undoEntry's three branches, ≥8 invalidateRedo sites, keyboard
//           branches, shortcuts rows, toolbar buttons, no persistence
// Phase Z — cleanup (every seeded + duplicated job deleted), console clean
//
// Run: node scripts/t104-e2e.mjs   (server on :3000)
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
  p.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view") ?? null);
const toCanvas = async () => {
  for (let i = 0; i < 4 && (await curView()) !== "canvas"; i++) {
    await p.keyboard.press("Shift+C");
    await sleep(700);
  }
};
const readViewport = () =>
  p.evaluate(() => {
    const el = document.querySelector('[data-canvas="workspace"]');
    const m = /translate\(([-\d.]+)px, ([-\d.]+)px\) scale\(([-\d.]+)\)/.exec(
      el instanceof HTMLElement ? el.style.transform : ""
    );
    return m ? { x: Number(m[1]), y: Number(m[2]), zoom: Number(m[3]) } : null;
  });
/** Pan EMPTY background so the world point (wx,wy) sits at the viewport
 *  center — the t103 pattern. The start corner (rect.x+120, rect.y+120) is
 *  ≥340px from center diagonally while the nearest card sits AT center:
 *  outside its 220×96 box at zoom 1 (layout verified per phase). */
const panWorldPointToCenter = async (wx, wy) => {
  const vp = await readViewport();
  const rect = await p.evaluate(() => {
    const r = document.querySelector('[data-canvas="viewport"]')?.getBoundingClientRect();
    return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null;
  });
  const curSX = wx * vp.zoom + vp.x;
  const curSY = wy * vp.zoom + vp.y;
  const dx = rect.width / 2 - curSX;
  const dy = rect.height / 2 - curSY;
  const sx = rect.x + 120;
  const sy = rect.y + 120;
  await p.mouse.move(sx, sy);
  await p.mouse.down();
  await p.mouse.move(sx + dx, sy + dy, { steps: 8 });
  await p.mouse.up();
  await sleep(500);
};
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
const clickCard = async (id) => {
  await p.locator(`[data-job="${id}"]`).click();
  await sleep(350);
};
const ctrlZ = async () => { await p.keyboard.press("Control+z"); await sleep(1000); };
const ctrlShiftZ = async () => { await p.keyboard.press("Control+Shift+z"); await sleep(1000); };
const pos = async (id) => {
  const j = await jobById(id);
  return j ? { x: j.x, y: j.y } : null;
};

/* ---------------- browser ---------------- */
b = await chromium.launch();
p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
p.on("pageerror", (e) => consoleErrors.push(String(e)));

/* ---------------- Phase S: remote band seeding ---------------- */
console.log("Phase S — remote band seeding, canvas view");
const existing0 = await listJobs();
for (const j of existing0.filter((j) => j.name?.startsWith("t104 "))) {
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
  ["t104 A", X0, Y0],
  ["t104 B", X0 + 400, Y0 + 260],
  ["t104 C", X0 + 800, Y0],
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
// normalize the camera: 100% zoom, then pan card A's center to mid-screen —
// all drag deltas below are 1:1 screen=world pixels
await p.keyboard.press("0");
await sleep(600);
const A = seeded[0], B = seeded[1], C = seeded[2];
await panWorldPointToCenter(X0 + 110, Y0 + 48);
const boxA = await p.locator(`[data-job="${A.id}"]`).boundingBox();
must(boxA && boxA.width > 40, "S4 card A is on screen at 100% zoom after pan");

/* ---------------- Phase M: drag + keyboard undo/redo ---------------- */
console.log("Phase M — drag, Ctrl+Z, Ctrl+Shift+Z (API truth)");
const origA = await pos(A.id);
await dragCard(A.id, 140, 90);
await sleep(1000); // PATCH + entry push
const movedA = await pos(A.id);
must(movedA && origA && Math.abs(movedA.x - origA.x - 140) <= 2 && Math.abs(movedA.y - origA.y - 90) <= 2,
  `M1 drag committed (+140,+90): got (${movedA.x - origA.x},${movedA.y - origA.y})`);
await ctrlZ();
const undoneA = await pos(A.id);
must(undoneA && undoneA.x === origA.x && undoneA.y === origA.y,
  "M2 Ctrl+Z restored the pre-drag position (server PATCH included)");
await ctrlShiftZ();
const redoneA = await pos(A.id);
must(redoneA && redoneA.x === movedA.x && redoneA.y === movedA.y,
  "M3 Ctrl+Shift+Z re-applied the drag");

/* ---------------- Phase U: toolbar buttons walk the same stack ---------------- */
console.log("Phase U — undo/redo toolbar buttons");
await panWorldPointToCenter(X0 + 400 + 110 + 140, Y0 + 260 + 48 + 90); // A now sits +140,+90 from seed
const origB = await pos(B.id);
await dragCard(B.id, 80, 40);
await sleep(1000);
const movedB = await pos(B.id);
must(movedB && Math.abs(movedB.x - origB.x - 80) <= 2 && Math.abs(movedB.y - origB.y - 40) <= 2,
  `U1 drag B committed (+80,+40): got (${movedB.x - origB.x},${movedB.y - origB.y})`);
const undoBtn = p.locator('[data-canvas-ui="undo-btn"]');
const redoBtn = p.locator('[data-canvas-ui="redo-btn"]');
must(await undoBtn.isEnabled(), "U2 undo button enabled with entries in the past");
await undoBtn.click();
await sleep(1000);
const undoneB = await pos(B.id);
must(undoneB && undoneB.x === origB.x && undoneB.y === origB.y,
  "U3 toolbar undo restored B (same stack the keyboard walks)");
must(await redoBtn.isEnabled(), "U4 redo button enabled after an undo");
await redoBtn.click();
await sleep(1000);
const redoneB = await pos(B.id);
must(redoneB && redoneB.x === movedB.x && redoneB.y === movedB.y,
  "U5 toolbar redo re-applied B");

/* ---------------- Phase D: delete → undo → redo (keyboard) ---------------- */
console.log("Phase D — delete undo/redo with same-id restore");
await panWorldPointToCenter(X0 + 800 + 110, Y0 + 48);
await clickCard(C.id);
await p.keyboard.press("Delete");
await sleep(600);
const confirmBtn = p.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true });
must(await confirmBtn.isVisible(), "D1 keyboard delete asks first (Task 97 guard)");
await confirmBtn.click();
await sleep(1200);
must((await jobById(C.id)) === null, "D2 C deleted (server truth)");
await ctrlZ();
const backC = await jobById(C.id);
must(!!backC, "D3 Ctrl+Z restored C — SAME id (restore, not re-creation)");
await ctrlShiftZ();
must((await jobById(C.id)) === null, "D4 Ctrl+Shift+Z re-deleted C");

/* ---------------- Phase B: toast Undo unifies with the stack ---------------- */
console.log("Phase B — toast Undo button shares the linear stack");
await ctrlZ(); // undo the re-delete: C back, ready for a fresh user delete
const backC2 = await jobById(C.id);
must(!!backC2, "B0 C back on the canvas after undoing the re-delete");
await clickCard(C.id);
await p.keyboard.press("Delete");
await sleep(600);
await p.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
await sleep(1200);
must((await jobById(C.id)) === null, "B1 C deleted again (toast alive ~20s)");
const toastUndo = p.locator("ol > li", { hasText: "Job deleted" }).locator("button", { hasText: "Undo" }).first();
must(await toastUndo.isVisible(), "B2 Undo action visible on the delete toast");
await toastUndo.click();
await sleep(1500);
const backC3 = await jobById(C.id);
must(!!backC3, "B3 toast Undo restored C — same id");
await ctrlShiftZ();
must((await jobById(C.id)) === null, "B4 redo available after toast-undo — the paths UNIFY (C re-deleted)");
await ctrlZ(); // leave C on the canvas for the tidy phase
must(!!(await jobById(C.id)), "B5 C back for the tidy phase");

/* ---------------- Phase T: auto-tidy is undoable ---------------- */
console.log("Phase T — tidy moves everything, Ctrl+Z restores every position");
await panWorldPointToCenter(X0 + 400, Y0 + 200); // re-center the band region
const beforeTidy = {};
for (const s of [A, B, C]) beforeTidy[s.id] = await pos(s.id);
const wand = p.locator('[aria-label="Auto-arrange workflow"]').first();
must(await wand.isVisible(), "T1 auto-arrange button visible");
await wand.click();
await sleep(1500);
const afterTidy = {};
for (const s of [A, B, C]) afterTidy[s.id] = await pos(s.id);
const tidyMoved = [A, B, C].filter((s) => {
  const a = afterTidy[s.id], o = beforeTidy[s.id];
  return a && o && (a.x !== o.x || a.y !== o.y);
}).length;
must(tidyMoved >= 2, `T2 tidy rearranged the band (got ${tidyMoved}/3 cards moved)`);
await ctrlZ();
let tidyUndone = 0;
for (const s of [A, B, C]) {
  const u = await pos(s.id);
  if (u && u.x === beforeTidy[s.id].x && u.y === beforeTidy[s.id].y) tidyUndone++;
}
must(tidyUndone === 3, `T3 Ctrl+Z restored every pre-layout position (got ${tidyUndone}/3)`);

/* ---------------- Phase I: add-family mutations kill the redo branch ---------------- */
console.log("Phase I — duplicate invalidates redo");
await panWorldPointToCenter(X0 + 110, Y0 + 48);
await clickCard(A.id);
await p.keyboard.press("Control+d");
await sleep(1500);
const copy = (await listJobs()).find((j) => j.name === "t104 A (copy)");
must(!!copy, "I1 Ctrl+D duplicated A (new id minted)");
if (copy) seeded.push({ id: copy.id, name: copy.name });
await ctrlShiftZ();
must(!!(await jobById(C.id)), "I2 redo is dead — Ctrl+Shift+Z did not re-delete anything (C stays)");
const afterI = {};
for (const s of [A, B, C]) afterI[s.id] = await pos(s.id);
const tidyStillUndone = [A, B, C].every((s) => {
  const u = afterI[s.id];
  return u && u.x === beforeTidy[s.id].x && u.y === beforeTidy[s.id].y;
});
must(tidyStillUndone, "I3 Ctrl+Shift+Z did not re-apply the tidy (future invalidated by the duplicate)");

/* ---------------- Phase F: static contract ---------------- */
console.log("Phase F — static contract");
const storeSrc = readFileSync("src/lib/store.ts", "utf8");
must((storeSrc.match(/slice\(-HISTORY_CAP\)/g) ?? []).length >= 6,
  "F1 every push honors the HISTORY_CAP slice (5 record sites + redo)");
must(/set\(\{ historyPast: past\.slice\(0, -1\) \}\);/.test(storeSrc),
  "F2 undo pops BEFORE running the entry (re-entrant Ctrl+Z cannot double-fire)");
must(/undoEntry: async \(entry\) =>/.test(storeSrc) && /past\.slice\(0, i\), historyFuture: \[\]/.test(storeSrc) &&
    /historyFuture: future\.filter\(\(e\) => e !== entry\)/.test(storeSrc),
  "F3 undoEntry: top-of-stack linear path + buried-branch truncate + future retire");
must((storeSrc.match(/get\(\)\.invalidateRedo\(\)/g) ?? []).length >= 8,
  "F4 ≥8 add-family sites kill the redo branch (add/template/dup×2/import/undo-import/connect/edge)");
must(/k === "z" \|\| k === "Z"/.test(readFileSync("src/app/page.tsx", "utf8")) &&
    /k === "y" \|\| k === "Y"/.test(readFileSync("src/app/page.tsx", "utf8")),
  "F5 keyboard branches for Ctrl+Z and Ctrl+Y exist");
const dialogSrc = readFileSync("src/components/workflow/shortcuts-dialog.tsx", "utf8");
must(/⌘\/Ctrl Z/.test(dialogSrc) && /Redo an undone change/.test(dialogSrc),
  "F6 shortcuts dialog documents undo and redo");
const canvasSrc = readFileSync("src/components/workflow/canvas.tsx", "utf8");
must(/data-canvas-ui="undo-btn"/.test(canvasSrc) && /disabled=\{historyPast\.length === 0\}/.test(canvasSrc) &&
    /data-canvas-ui="redo-btn"/.test(canvasSrc) && /disabled=\{historyFuture\.length === 0\}/.test(canvasSrc),
  "F7 toolbar buttons read the live stacks for their disabled states");
must(!/storage\.setItem\([^)]*histor/i.test(storeSrc) && !/[Hh]istory[A-Za-z]*KEY/.test(storeSrc),
  "F8 history is in-memory only — never persisted to storage (reload starts fresh by design)");

/* ---------------- Phase Z: cleanup + console ---------------- */
console.log("Phase Z — cleanup");
let deleted = 0;
for (const s of seeded) {
  const r = await api(`/api/jobs/${s.id}`, "DELETE");
  if (r.ok) deleted++;
}
must(deleted === seeded.length, `Z1 all ${seeded.length} seeded/duplicated jobs deleted (got ${deleted})`);
must(consoleErrors.length === 0, `Z2 console clean (got ${consoleErrors.length})`);

console.log(`T104 ALL PASS (${PASS} assertions)`);
await cleanup();
process.exit(0);

// t100 — Task 100: named viewport bookmarks (cross-session, per-workspace).
//
// Task 98 gave the canvas per-workspace viewport memory (sessionStorage,
// per-tab, burns with the tab). Task 99 made it survive a reload. Both are
// EPHEMERAL state — "where I was". A bookmark is different in kind: a
// USER-CREATED asset ("where I want to come back to") that must outlive the
// tab AND the session, so it lives in localStorage:
//   - save: current viewport captured under a name for THIS (project:ws);
//     same-name saves overwrite (a bookmark is a named snapshot, not a log)
//   - jump: restores the saved viewport (through the clamp gate)
//   - delete: removes it everywhere (memory + localStorage)
//   - per-workspace isolation: ws B's bookmark panel never shows ws A's names
//   - writes happen ONLY on the explicit save/delete actions (low frequency
//     synchronous localStorage IO — never per-frame, Task 13 #13 stays dead)
//
// Phase S — setup: canvas up, bookmark storage cleared
// Phase A — save: personalize view → save "t100 Spot" → row appears with
//   the right zoom; saving the SAME name again stays one row (overwrite)
// Phase B — reload & jump: localStorage hydrate → row still there → pan
//   elsewhere → jump → transform returns EXACTLY to the saved view
// Phase C — workspace isolation: second ws shows the EMPTY state; back to
//   Main the bookmark is intact
// Phase D — delete: row + localStorage entry vanish, empty state returns
// Phase E — static contract: storage key, hydrate shape-check, explicit-only
//   writes, UI testids, name cap
// Phase Z — cleanup: console clean
//
// Run: node scripts/t100-e2e.mjs   (server on :3000)
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const KEY = "cryoflow.viewportBookmarks.v1";
const NAME = "t100 Spot";
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

const worldTf = () =>
  p.evaluate(() => {
    const el = document.querySelector('[data-canvas="workspace"]');
    return el instanceof HTMLElement ? (el.style.transform ?? "") : "";
  });
const zoomPct = () =>
  p.evaluate(() => {
    const el = document.querySelector('[data-canvas-ui="zoom-controls"]');
    return el?.textContent?.match(/(\d+)%/)?.[1] ?? "";
  });
const curView = () =>
  p.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view") ?? null);
const toCanvas = async () => {
  for (let i = 0; i < 4 && (await curView()) !== "canvas"; i++) {
    await p.keyboard.press("Shift+C");
    await sleep(700);
  }
};
const openBookmarks = async () => {
  await p.locator('[data-canvas-ui="viewport-bookmarks-trigger"]').click();
  await p.waitForSelector('[data-canvas-ui="viewport-bookmarks-panel"]');
  await sleep(300);
};
const panBg = async (dx, dy) => {
  await p.mouse.move(1200, 810);
  await p.mouse.down();
  await p.mouse.move(1200 + dx, 810 + dy, { steps: 8 });
  await p.mouse.up();
  await sleep(500);
};
const switchWs = async (name) => {
  await p.locator('[aria-label="Active workspace"]').click();
  await sleep(400);
  await p.locator('[role="option"]', { hasText: name }).first().click();
  await sleep(900);
};

/* ---------------- Phase S: setup ---------------- */
console.log("Phase S — setup");
// pre-clean any leftover workspaces from a crashed earlier run (a FATAL'd
// run never reaches its own Z phase — S must sweep the mess it finds)
for (const w of ((await (await fetch(`${BASE}/api/workspaces`)).json()).workspaces)) {
  if (w.name.startsWith("t100 ")) {
    await fetch(`${BASE}/api/workspaces/${w.id}`, { method: "DELETE" });
  }
}
b = await chromium.launch();
p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
p.on("pageerror", (e) => consoleErrors.push(String(e)));
await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await sleep(800);
await p.evaluate((k) => window.localStorage.removeItem(k), KEY);
await toCanvas();
must((await curView()) === "canvas", "S1 canvas view active");
await p.locator('[aria-label="Reset view"]').click();
await sleep(800);
const tfFit = await worldTf();
must(tfFit.includes("translate") && tfFit.includes("scale"), "S2 fit baseline live");

/* ---------------- Phase A: save + overwrite semantics ---------------- */
console.log("Phase A — save");
await p.locator('[aria-label="Zoom in"]').click();
await sleep(300);
await panBg(-140, -60);
const tfSaved = await worldTf();
const zoomSaved = await zoomPct();
must(tfSaved !== tfFit, `A1 view personalized (zoom ${zoomSaved}%)`);
await openBookmarks();
must((await p.locator('[data-canvas-ui="viewport-bookmark-empty"]').count()) === 1,
  "A2 empty state before any save");
await p.locator('[data-canvas-ui="viewport-bookmark-input"]').fill(NAME);
await p.locator('[data-canvas-ui="viewport-bookmark-save"]').click();
await sleep(300);
let rows = p.locator('[data-canvas-ui="viewport-bookmark-row"]');
must((await rows.count()) === 1, `A3 row appears after save`);
const rowText = (await rows.first().textContent()) ?? "";
must(rowText.includes(NAME) && rowText.includes(zoomSaved),
  `A4 row carries the name and the captured zoom (${zoomSaved}%)`);
must((await p.locator('[data-canvas-ui="viewport-bookmark-empty"]').count()) === 0,
  "A5 empty state retired once a bookmark exists");
// same name again → overwrite, NOT a second row
await p.locator('[data-canvas-ui="viewport-bookmark-input"]').fill(NAME);
await p.locator('[data-canvas-ui="viewport-bookmark-save"]').click();
await sleep(300);
must((await p.locator('[data-canvas-ui="viewport-bookmark-row"]').count()) === 1,
  "A6 same-name save OVERWRITES (named snapshot, not a log)");
await p.keyboard.press("Escape");
await sleep(300);

/* ---------------- Phase B: reload & jump ---------------- */
console.log("Phase B — reload & jump");
await p.reload({ waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await sleep(1000);
await toCanvas();
await openBookmarks();
rows = p.locator('[data-canvas-ui="viewport-bookmark-row"]');
must((await rows.count()) === 1 && ((await rows.first().textContent()) ?? "").includes(NAME),
  "B1 bookmark survives the reload (localStorage hydrate)");
await p.keyboard.press("Escape");
await sleep(300);
// move AWAY from the saved view, then jump back through the bookmark
await p.locator('[aria-label="Zoom out"]').click();
await sleep(300);
await panBg(200, 100);
const tfAway = await worldTf();
must(tfAway !== tfSaved, "B2 viewport moved away from the saved view");
await openBookmarks();
await rows.first().locator("button").first().click();
await sleep(700);
const tfJumped = await worldTf();
must(tfJumped === tfSaved,
  `B3 jump restores the saved view EXACTLY (zoom ${await zoomPct()}%)`);

/* ---------------- Phase C: workspace isolation ---------------- */
console.log("Phase C — workspace isolation");
const homeWs = ((await (await fetch(`${BASE}/api/workspaces`)).json()).workspaces)[0];
const ws2 = (await (await fetch(`${BASE}/api/workspaces`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "t100 Second" }),
})).json()).workspace;
// the workspace was seeded via the API — the loaded page's switcher doesn't
// know it yet; reload so the dropdown lists it (t98 seeds BEFORE goto)
await p.reload({ waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await sleep(1000);
await toCanvas();
await switchWs("t100 Second");
await openBookmarks();
must((await p.locator('[data-canvas-ui="viewport-bookmark-empty"]').count()) === 1,
  "C1 the second workspace's panel is EMPTY (per-ws namespace)");
await p.keyboard.press("Escape");
await sleep(300);
await switchWs(homeWs.name);
await openBookmarks();
rows = p.locator('[data-canvas-ui="viewport-bookmark-row"]');
must((await rows.count()) === 1 && ((await rows.first().textContent()) ?? "").includes(NAME),
  "C2 back in the original ws the bookmark is intact");
await p.keyboard.press("Escape");
await sleep(300);

/* ---------------- Phase D: delete ---------------- */
console.log("Phase D — delete");
await openBookmarks();
const storedBefore = await p.evaluate((k) => window.localStorage.getItem(k) ?? "", KEY);
must(storedBefore.includes(NAME), "D1 localStorage holds the bookmark before delete");
await p.locator('[aria-label="Delete bookmark t100 Spot"]').click();
await sleep(400);
must((await p.locator('[data-canvas-ui="viewport-bookmark-row"]').count()) === 0,
  "D2 row vanishes after delete");
must((await p.locator('[data-canvas-ui="viewport-bookmark-empty"]').count()) === 1,
  "D3 empty state returns");
const storedAfter = await p.evaluate((k) => window.localStorage.getItem(k) ?? "", KEY);
must(!storedAfter.includes(NAME), "D4 localStorage entry removed too (memory + disk)");
await p.keyboard.press("Escape");
await sleep(300);

/* ---------------- Phase E: static contract ---------------- */
console.log("Phase E — static contract");
const storeSrc = readFileSync("src/lib/store.ts", "utf8");
must(
  storeSrc.includes('VIEWPORT_BOOKMARKS_KEY = "cryoflow.viewportBookmarks.v1"') &&
    storeSrc.includes("window.localStorage.setItem(VIEWPORT_BOOKMARKS_KEY"),
  "E1 localStorage key namespaced + versioned, persisted synchronously"
);
must(
  /function hydrateViewportBookmarks\(\)[\s\S]*?typeof window === "undefined"/.test(storeSrc) &&
    (storeSrc.match(/Number\.isFinite\(/g) ?? []).length >= 6,
  "E2 hydrate SSR-guarded + double shape-check (outer map AND each viewport)"
);
must(
  /saveViewportBookmark: \(name\) => \{[\s\S]*?trim\(\)/.test(storeSrc) &&
    storeSrc.includes("if (!trimmed) return false;"),
  "E3 save trims + refuses empty names (belt to the UI's disabled braces)"
);
must(
  storeSrc.includes("never per-frame, Task 13 #13 stays retired") ||
    storeSrc.includes("low-frequency"),
  "E4 explicit-action-only write policy documented (no per-frame localStorage)"
);
const canvasSrc = readFileSync("src/components/workflow/canvas.tsx", "utf8");
must(
  canvasSrc.includes('data-canvas-ui="viewport-bookmarks-trigger"') &&
    canvasSrc.includes('data-canvas-ui="viewport-bookmark-row"') &&
    canvasSrc.includes('data-canvas-ui="viewport-bookmark-empty"') &&
    canvasSrc.includes('data-canvas-ui="viewport-bookmark-delete"'),
  "E5 all four UI landmarks in place (trigger/row/empty/delete)"
);
must(
  canvasSrc.includes("setViewport(vp);") &&
    canvasSrc.includes('maxLength={60}'),
  "E6 jump routes through setViewport (clamp gate); names capped at 60"
);

/* ---------------- Phase Z: cleanup ---------------- */
console.log("Phase Z — cleanup");
// drop the seeded workspace — the deletion must SUCCEED, not be attempted:
// a swallowed failure here leaves the world dirty for every suite after us
const delRes = await fetch(`${BASE}/api/workspaces/${ws2.id}`, { method: "DELETE" });
must(delRes.ok, `Z2 seeded workspace deleted (got ${delRes.status})`);
await p.evaluate((k) => window.localStorage.removeItem(k), KEY);
await sleep(400);
must(consoleErrors.length === 0, `Z1 console clean (got ${consoleErrors.length})`);

console.log(`T100 ALL PASS (${PASS} assertions)`);
await cleanup();
process.exit(0);

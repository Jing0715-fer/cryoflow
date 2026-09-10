// t101 — Task 101: bookmark hotkey jump (stable slots 1–9).
//
// Task 100 shipped named bookmarks (cross-session localStorage). Task 101
// gives each a STABLE HOTKEY SEAT: digits 1–9 on the canvas land on the
// saved view holding that seat. The seat is assigned at creation (lowest
// free), NEVER renumbered (deleting #3 must not turn #4 into #3 — muscle
// memory is a contract), kept on same-name overwrite, and released only by
// delete. Storage bumps to v2: name → { viewport, slot }; a v1 payload is
// migrated at hydrate (slots by stored key order) and removed.
//
// Phase S — setup: storage swept (v1+v2), canvas up, fit baseline
//   S0 — v1 migration BEHAVIOR: seeded legacy payload is seated into v2
//   by stored key order and the legacy key removed at hydrate
// Phase A — save three → seats 1/2/3 assigned in order; v2 shape on disk
// Phase B — hotkey jump: pan away → press 1/3/2 → transforms return
//   EXACTLY; the jump writes through to the session memory (sessionStorage)
// Phase C — stability: delete #2 → survivors keep 1/3; next save takes the
//   freed seat 2; same-name overwrite keeps its seat and updates the view
// Phase E — exhaustion: fill seats 4..9 → a 10th bookmark is unnumbered
//   (no chip, slot null on disk) and still panel-jumpable; seat 9 jumps
// Phase D — static contract: MAX_BOOKMARK_SLOTS + lowestFreeSlot + null
//   fallback; v1 migration; canvas-only + modifier-guarded digit branch;
//   shortcuts dialog documents 1–9; jump routes through setViewport
// Phase Z — cleanup: storage swept, console clean
//
// Run: node scripts/t101-e2e.mjs   (server on :3000)
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const KEY = "cryoflow.viewportBookmarks.v2";
const KEY_V1 = "cryoflow.viewportBookmarks.v1";
const MEMORY_KEY = "cryoflow.viewportMemory.v1";
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
const saveBookmark = async (name) => {
  await openBookmarks();
  await p.locator('[data-canvas-ui="viewport-bookmark-input"]').fill(name);
  await p.locator('[data-canvas-ui="viewport-bookmark-save"]').click();
  await sleep(300);
  await p.keyboard.press("Escape");
  await sleep(250);
};
const panBg = async (dx, dy) => {
  await p.mouse.move(1200, 810);
  await p.mouse.down();
  await p.mouse.move(1200 + dx, 810 + dy, { steps: 8 });
  await p.mouse.up();
  await sleep(500);
};
const seatChips = () => p.locator('[data-canvas-ui="viewport-bookmark-slot"]');
const rowChips = async (name) =>
  (await p.locator('[data-canvas-ui="viewport-bookmark-row"]', { hasText: name })
    .locator('[data-canvas-ui="viewport-bookmark-slot"]').allTextContents()).join(",");
const zoomIn = async () => {
  await p.locator('[aria-label="Zoom in"]').click();
  await sleep(300);
};
const storedBookmarks = () =>
  p.evaluate((k) => {
    const raw = window.localStorage.getItem(k);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const out = {};
    for (const [wsKey, named] of Object.entries(parsed)) {
      for (const [name, entry] of Object.entries(named)) out[name] = entry;
    }
    return out;
  }, KEY);

/* ---------------- Phase S: setup ---------------- */
console.log("Phase S — setup");
b = await chromium.launch();
p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleErrors = [];
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
p.on("pageerror", (e) => consoleErrors.push(String(e)));
await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await sleep(800);
// S0 — v1 migration BEHAVIOR (D2 only proves the code exists): seed a
// legacy payload, hydrate must seat it by stored key order into v2 and
// remove the legacy key. The synthetic ws key matches nothing the panel
// reads, so this cannot pollute the row assertions below.
await p.evaluate(([k1, k2]) => {
  window.localStorage.removeItem(k2);
  window.localStorage.setItem(k1, JSON.stringify({
    "legacy:ws": {
      "Legacy First": { x: 12, y: 34, zoom: 0.8 },
      "Legacy Second": { x: 56, y: 78, zoom: 1.2 },
    },
  }));
}, [KEY_V1, KEY]);
await p.reload({ waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await sleep(900);
const migrated = await p.evaluate(([k1, k2]) => {
  const v2raw = window.localStorage.getItem(k2);
  const v1 = window.localStorage.getItem(k1);
  if (!v2raw || v1 !== null) return { legacyGone: v1 === null, entries: null };
  const parsed = JSON.parse(v2raw);
  return { legacyGone: true, entries: parsed["legacy:ws"] ?? null };
}, [KEY_V1, KEY]);
must(migrated?.legacyGone === true, "S0a migration removes the legacy v1 key");
must(
  migrated?.entries?.["Legacy First"]?.slot === 1 &&
    migrated?.entries?.["Legacy Second"]?.slot === 2 &&
    migrated?.entries?.["Legacy First"]?.viewport?.x === 12,
  "S0b migration seats by stored key order into v2 (viewport intact)"
);
// sweep BOTH generations — a stale v1 payload would migrate itself into a
// fresh v2 map and pollute every row-count assertion below
await p.evaluate((k) => window.localStorage.removeItem(k), KEY);
await p.evaluate((k) => window.localStorage.removeItem(k), KEY_V1);
await p.reload({ waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await sleep(900);
await toCanvas();
must((await curView()) === "canvas", "S1 canvas view active");
await p.locator('[aria-label="Reset view"]').click();
await sleep(800);
await openBookmarks();
must((await p.locator('[data-canvas-ui="viewport-bookmark-empty"]').count()) === 1,
  "S2 clean slate — no bookmarks");

/* ---------------- Phase A: seats assigned in order ---------------- */
console.log("Phase A — seats 1/2/3 in order");
await zoomIn();
await panBg(-140, -60);
const tfA = await worldTf();
await saveBookmark("t101 Alpha");
await zoomIn();
await panBg(-80, 40);
const tfB = await worldTf();
await saveBookmark("t101 Beta");
await zoomIn();
await panBg(60, -90);
const tfC = await worldTf();
await saveBookmark("t101 Gamma");
await openBookmarks();
must((await rowChips("t101 Alpha")) === "1", "A1 Alpha took seat 1");
must((await rowChips("t101 Beta")) === "2", "A2 Beta took seat 2");
must((await rowChips("t101 Gamma")) === "3", "A3 Gamma took seat 3");
const hint = await p.locator('[data-canvas-ui="viewport-bookmark-hint"]').textContent();
must((hint ?? "").includes("1–9"), "A4 panel hint documents the 1–9 keys");
await p.keyboard.press("Escape");
await sleep(250);
const disk = await storedBookmarks();
must(
  disk && disk["t101 Alpha"]?.slot === 1 && disk["t101 Beta"]?.slot === 2 && disk["t101 Gamma"]?.slot === 3,
  "A5 v2 disk shape: entries carry stable slot numbers"
);
must(
  disk && [disk["t101 Alpha"], disk["t101 Beta"], disk["t101 Gamma"]]
    .every((e) => [e.viewport.x, e.viewport.y, e.viewport.zoom].every((n) => Number.isFinite(n))),
  "A6 v2 disk shape: viewports all-finite"
);

/* ---------------- Phase B: hotkey jumps ---------------- */
console.log("Phase B — hotkey jumps");
await panBg(320, 180);
const tfAway = await worldTf();
must(tfAway !== tfA && tfAway !== tfB && tfAway !== tfC, "B1 viewport parked away from all three");
await p.keyboard.press("1");
await sleep(500);
must((await worldTf()) === tfA, "B2 key 1 → Alpha's view EXACTLY");
await p.keyboard.press("3");
await sleep(500);
must((await worldTf()) === tfC, "B3 key 3 → Gamma's view EXACTLY");
await p.keyboard.press("2");
await sleep(500);
const tfJump = await worldTf();
must(tfJump === tfB, "B4 key 2 → Beta's view EXACTLY");
const mem = await p.evaluate((k) => JSON.parse(window.sessionStorage.getItem(k) ?? "{}"), MEMORY_KEY);
const beta = (await storedBookmarks())?.["t101 Beta"];
must(
  Object.values(mem).some((m) => m.x === beta.viewport.x && m.y === beta.viewport.y && m.zoom === beta.viewport.zoom),
  "B5 jump writes through to the session memory (sessionStorage)"
);

/* ---------------- Phase C: seats are stable ---------------- */
console.log("Phase C — stable seats");
await openBookmarks();
await p.locator('[aria-label="Delete bookmark t101 Beta"]').click();
await sleep(400);
must((await rowChips("t101 Alpha")) === "1" && (await rowChips("t101 Gamma")) === "3",
  "C1 deleting #2 does NOT renumber survivors (1 and 3 keep their seats)");
await p.keyboard.press("Escape");
await sleep(250);
await zoomIn();
await panBg(100, 100);
await saveBookmark("t101 Delta");
await openBookmarks();
must((await rowChips("t101 Delta")) === "2", "C2 the next save takes the freed seat (hole reuse)");
await p.keyboard.press("Escape");
await sleep(250);
await zoomIn();
const diskPreOverwrite = await storedBookmarks();
const alphaPre = JSON.stringify(diskPreOverwrite["t101 Alpha"].viewport);
await saveBookmark("t101 Alpha");
const diskC = await storedBookmarks();
must(diskC["t101 Alpha"]?.slot === 1, "C3 overwrite keeps the seat (re-saving never moves a key)");
must(JSON.stringify(diskC["t101 Alpha"].viewport) !== alphaPre,
  "C3b overwrite stores the FRESH view (a snapshot update, not a no-op)");

/* ---------------- Phase E: seat exhaustion ---------------- */
console.log("Phase E — exhaustion");
// seats in play: 1=Alpha 2=Delta 3=Gamma. Fill 4..9, then overflow.
const seatViews = {};
for (let i = 4; i <= 9; i++) {
  await zoomIn();
  await panBg(40, -30);
  seatViews[i] = await worldTf();
  await saveBookmark(`t101 Seat${i}`);
}
await openBookmarks();
must((await seatChips().count()) === 9, "E1 nine numbered rows — all seats taken");
await zoomIn();
const tfOver10 = await worldTf();
await saveBookmark("t101 Overflow");
await openBookmarks(); // chips live in the popover — count with it open
must((await seatChips().count()) === 9, "E2 the 10th bookmark gets NO seat (no chip)");
const diskE = await storedBookmarks();
must(diskE["t101 Overflow"]?.slot === null, "E3 overflow stored with slot null (panel-click only)");
const overflowRow = p.locator('[data-canvas-ui="viewport-bookmark-row"]', { hasText: "t101 Overflow" });
await overflowRow.locator("button").first().click();
await sleep(600);
must((await worldTf()) === tfOver10, "E4 the unnumbered bookmark still jumps from the panel");
await panBg(-260, 140);
await p.keyboard.press("9");
await sleep(500);
must((await worldTf()) === seatViews[9], "E5 key 9 lands on the seat-9 view");
await p.keyboard.press("Escape");
await sleep(250);

/* ---------------- Phase D: static contract ---------------- */
console.log("Phase D — static contract");
const storeSrc = readFileSync("src/lib/store.ts", "utf8");
must(
  storeSrc.includes("MAX_BOOKMARK_SLOTS = 9") &&
    storeSrc.includes("function lowestFreeSlot") &&
    /slot: seat <= MAX_BOOKMARK_SLOTS \? seat : null/.test(storeSrc),
  "D1 slot budget: 9 seats, lowest-free assignment, null overflow"
);
must(
  storeSrc.includes('VIEWPORT_BOOKMARKS_KEY_V1 = "cryoflow.viewportBookmarks.v1"') &&
    /VIEWPORT_BOOKMARKS_KEY_V1\)\s*!==\s*null[\s\S]{0,80}removeItem\(VIEWPORT_BOOKMARKS_KEY_V1\)/.test(storeSrc),
  "D2 v1 migration exists: hydrate reads the legacy key, seats it, removes it"
);
must(
  /lowestFreeSlot\(s\.viewportBookmarks\[key\] \?\? \{\}\)/.test(storeSrc) &&
    /const slot = existing \? existing\.slot : lowestFreeSlot/.test(storeSrc),
  "D3 save: overwrite keeps the seat, fresh names take lowest-free"
);
must(
  storeSrc.includes("s.setViewport(hit.viewport)") && storeSrc.includes("jumpToViewportBookmark"),
  "D4 jump routes through setViewport (zoom clamp gate)"
);
const pageSrc = readFileSync("src/app/page.tsx", "utf8");
must(
  /k >= "1" && k <= "9" && !e\.metaKey && !e\.ctrlKey && !e\.altKey/.test(pageSrc) &&
    /if \(s\.view !== "dashboard"\) \{\s*\n\s*if \(s\.jumpToViewportBookmark\(Number\(k\)\)\)/.test(pageSrc),
  "D5 digit branch: modifier-guarded (browser tabs win) + canvas-only (dashboard owns 1–6)"
);
const dialogSrc = readFileSync("src/components/workflow/shortcuts-dialog.tsx", "utf8");
must(
  /keys: "1–9", text: "Jump to a bookmarked view/.test(dialogSrc),
  "D6 shortcuts dialog documents the bookmark keys"
);
const canvasSrc = readFileSync("src/components/workflow/canvas.tsx", "utf8");
must(
  canvasSrc.includes('data-canvas-ui="viewport-bookmark-slot"') &&
    /a\.slot \?\? Number\.MAX_SAFE_INTEGER/.test(canvasSrc),
  "D7 rows show the seat chip and sort by seat (unnumbered trail)"
);
must(
  canvasSrc.includes("bookmarkWsKey = `${project?.id ?? \"-\"}:${activeWorkspaceId ?? \"-\"}`"),
  "D8 panel reads bookmarks by the SAME key rule the store writes them (project?.id)"
);

/* ---------------- Phase Z: cleanup ---------------- */
console.log("Phase Z — cleanup");
await p.evaluate((k) => window.localStorage.removeItem(k), KEY);
await p.evaluate((k) => window.localStorage.removeItem(k), KEY_V1);
await sleep(300);
must(consoleErrors.length === 0, `Z1 console clean (got ${consoleErrors.length})`);

console.log(`T101 ALL PASS (${PASS} assertions)`);
await cleanup();
process.exit(0);

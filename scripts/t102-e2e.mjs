// t102 — Task 102: bookmark cross-tab freshness (storage-event sync).
//
// Task 100 made bookmarks a cross-SESSION asset (localStorage). Task 102
// makes them a cross-TAB live asset: a save/delete/overwrite in one tab
// propagates to every other open tab of the same origin via the `storage`
// event — no reload, no polling. The writing tab hears nothing (no echo
// loop); listeners re-parse e.newValue through the SAME parse path the
// boot hydrate uses, so a bookmark trusted by one tab is trusted by all.
// sessionStorage (viewport memory) never fires storage events — the
// per-tab contract from Task 99 survives untouched.
//
// TRANSPORT HONESTY (probe limitation, documented): headless Chromium via
// Playwright isolates BOTH platform links this feature rides on — storage
// events do NOT deliver across pages of one context (verified by
// scripts/t102-diag-storage-event.mjs: vanilla listener, vanilla write,
// zero delivery) and localStorage is even PER-PAGE here (verified by
// scripts/t102-diag-sharing.mjs: p2 never sees p1's write). Real browsers
// share both. So the probe covers every link WE own against the EXACT
// real payload:
//   real UI action in the writer → real localStorage write → probe reads
//   the writer's actual payload → synthetic StorageEvent dispatched in
//   the observer with that byte-identical string → listener → shared
//   parse → store setState → live panel re-render.
// The links NOT probed end-to-end are the browser's cross-tab delivery
// and storage sharing — platform behavior, same trust class as "Radix
// closes the toast on click" (t97 C). The F phase pins the listener
// registration statically.
//
// Phase S — two tabs (A, B) in ONE browser context, both loaded BEFORE
//   any save, keys swept (boot hydrate sees nothing anywhere)
// Phase A — A saves "Sync Alpha" via UI → synthetic event in B carries
//   A's real payload → B's OPEN panel shows the row, seat chip, zoom
// Phase B — A re-saves same name at a new zoom → B's row zoom% updates
//   live AND the row's DOM node is REPLACED (snapshot-bound key remounts
//   it — the entrance animation replays so the change is visible)
// Phase C — A deletes → synthetic removal event → B's open panel falls
//   back to the empty state live
// Phase D — bidirectional: B saves via UI (seat 1 — hole reuse on SYNCED
//   state), A adopts it live; A saves Gamma (seat 2), B adopts; B's panel
//   shows both chips in seat order
// Phase E — raw payload events: corrupt payload degrades to empty (never
//   trusted), valid foreign payload adopted wholesale, removed key →
//   empty (newValue null path)
// Phase F — static contract: listener keyed to the bookmark key (+ clear
//   case), no echo write inside the listener, shared parse path, memory
//   key untouched by the listener, canvas row key binds the snapshot
// Phase Z — cleanup both tabs, console clean on BOTH tabs
//
// Run: node scripts/t102-e2e.mjs   (server on :3000)
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const KEY = "cryoflow.viewportBookmarks.v2";
const KEY_V1 = "cryoflow.viewportBookmarks.v1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let PASS = 0;
let b = null;
let p = null; // tab A (writer / observer both directions)
let q = null; // tab B (observer / writer both directions)
async function cleanup() {
  try { if (p) await p.close(); } catch {}
  try { if (q) await q.close(); } catch {}
  try { if (b) await b.close(); } catch {}
}
const must = (cond, label) => {
  if (!cond) {
    console.log(`FATAL: ${label}`);
    p?.close().catch(() => {});
    q?.close().catch(() => {});
    b?.close().catch(() => {});
    process.exit(1);
  }
  PASS++;
  console.log(`  ok: ${label}`);
};

const curView = (pg) =>
  pg.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view") ?? null);
const toCanvas = async (pg) => {
  for (let i = 0; i < 4 && (await curView(pg)) !== "canvas"; i++) {
    await pg.keyboard.press("Shift+C");
    await sleep(700);
  }
};
const openBookmarks = async (pg) => {
  // idempotent: the trigger TOGGLES — clicking an already-open panel shut
  // leaves the input gone and the next fill times out (phase D found this)
  if (await pg.locator('[data-canvas-ui="viewport-bookmarks-panel"]').isVisible().catch(() => false)) return;
  await pg.locator('[data-canvas-ui="viewport-bookmarks-trigger"]').click();
  await pg.waitForSelector('[data-canvas-ui="viewport-bookmarks-panel"]');
  await sleep(300);
};
const closeBookmarks = async (pg) => {
  await pg.keyboard.press("Escape");
  await sleep(250);
};
const saveBookmark = async (pg, name) => {
  await openBookmarks(pg);
  await pg.locator('[data-canvas-ui="viewport-bookmark-input"]').fill(name);
  await pg.locator('[data-canvas-ui="viewport-bookmark-save"]').click();
  await sleep(300);
  await closeBookmarks(pg);
};
/** Read the writer's REAL localStorage payload (this playwright build
 *  keeps localStorage per-page, so the writer is the only honest source)
 *  and deliver it to `observer` as the byte-identical StorageEvent a
 *  real browser would hand it (see transport note). With an explicit
 *  `value`, deliver that instead (corrupt/foreign/null legs). */
const payloadOf = (pg) => pg.evaluate((k) => localStorage.getItem(k), KEY);
const deliverSync = async (observer, value) => {
  await observer.evaluate(
    ([k, val]) => window.dispatchEvent(new StorageEvent("storage", { key: k, newValue: val })),
    [KEY, value]
  );
  await sleep(400);
};
const rows = (pg, name) =>
  pg.locator('[data-canvas-ui="viewport-bookmark-row"]', name ? { hasText: name } : {});
const rowSlot = async (pg, name) =>
  (await rows(pg, name).locator('[data-canvas-ui="viewport-bookmark-slot"]').allTextContents()).join(",");
const rowZoom = async (pg, name) => {
  const t = await rows(pg, name).first().textContent();
  return t?.match(/(\d+)%/)?.[0] ?? "";
};
/** Poll the row's zoom% until it matches `want` (the panel row can land a
 *  frame or two after the dispatch); returns the last seen value for the
 *  failure message. */
const rowZoomEventually = async (pg, name, want) => {
  let got = "";
  for (let i = 0; i < 10; i++) {
    got = await rowZoom(pg, name);
    if (got === want) return got;
    await sleep(200);
  }
  return got;
};
/** zoom% the payload SHOULD render — read from the exact string the event
 *  carried, closing the loop write→parse→UI with no free variables. */
const payloadZoom = (payload) => {
  const parsed = JSON.parse(payload ?? "{}");
  for (const named of Object.values(parsed)) {
    for (const [name, bm] of Object.entries(named)) {
      if (name === "Sync Alpha") return `${Math.round(bm.viewport.zoom * 100)}%`;
    }
  }
  return "";
};
const zoomIn = async (pg, times) => {
  for (let i = 0; i < times; i++) {
    await pg.locator('[aria-label="Zoom in"]').click();
    await sleep(250);
  }
};

/* ---------------- Phase S: two clean tabs, listeners live ---------------- */
console.log("Phase S — two tabs, swept keys, listeners armed");
b = await chromium.launch();
p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleA = [];
p.on("console", (m) => { if (m.type() === "error") consoleA.push(m.text()); });
p.on("pageerror", (e) => consoleA.push(String(e)));
await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await sleep(800);
// sweep BEFORE any hydration that matters: A reloads empty
await p.evaluate(([k1, k2]) => { localStorage.removeItem(k1); localStorage.removeItem(k2); }, [KEY, KEY_V1]);
await p.reload({ waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await sleep(800);
await toCanvas(p);
// tab B: same context, loads AFTER the sweep so its hydrate sees nothing
// — any row it ever shows must have arrived via the (synthetic) storage
// event, not via boot
q = await b.newPage({ viewport: { width: 1600, height: 900 } });
const consoleB = [];
q.on("console", (m) => { if (m.type() === "error") consoleB.push(m.text()); });
q.on("pageerror", (e) => consoleB.push(String(e)));
await q.goto(BASE, { waitUntil: "networkidle" });
await q.waitForSelector('[data-canvas="viewport"]');
await sleep(800);
await toCanvas(q);
await openBookmarks(q); // observer's panel stays open for the whole run
must((await q.locator('[data-canvas-ui="viewport-bookmark-row"]').count()) === 0,
  "S1 tab B boots EMPTY (clean hydrate — sync is the only path to a row)");
must((await q.locator('[data-canvas-ui="viewport-bookmark-empty"]').count()) === 1,
  "S2 empty state visible in B before any sync");

/* ---------------- Phase A: save in A appears in B live ---------------- */
console.log("Phase A — cross-tab save");
await saveBookmark(p, "Sync Alpha"); // real UI save → real write in A
const payloadA = await payloadOf(p);
must(payloadA && payloadA.includes("Sync Alpha"), "A0 A's UI save really wrote the payload");
await deliverSync(q, payloadA); // the event the browser would hand B (byte-identical)
must((await q.locator('[data-canvas-ui="viewport-bookmark-row"]').count()) === 1,
  "A1 A's save appears in B's OPEN panel without any reload");
must((await rows(q, "Sync Alpha").count()) === 1, "A2 row carries the saved name");
must((await rowSlot(q, "Sync Alpha")) === "1", "A3 slot chip 1 arrived with the row");
const savedZoom = payloadZoom(payloadA);
must((await rowZoomEventually(q, "Sync Alpha", savedZoom)) === savedZoom && savedZoom !== "",
  `A4 B renders the exact snapshot the event carried (got ${await rowZoom(q, "Sync Alpha")}, want ${savedZoom})`);

/* ---------------- Phase B: overwrite propagates + remount ---------------- */
console.log("Phase B — overwrite propagates, row remounts");
await zoomIn(p, 2);
const zoomBefore = await rowZoom(q, "Sync Alpha");
const oldNode = await rows(q, "Sync Alpha").first().elementHandle();
await saveBookmark(p, "Sync Alpha"); // same name → overwrite, seat kept
const payloadB = await payloadOf(p);
await deliverSync(q, payloadB);
const zoomAfter = await rowZoomEventually(q, "Sync Alpha", payloadZoom(payloadB));
must(zoomAfter !== zoomBefore,
  `B1 B's row zoom updated live (${zoomBefore} → ${zoomAfter})`);
must(zoomAfter === payloadZoom(payloadB),
  `B2 B shows exactly the re-saved snapshot (got ${zoomAfter})`);
const nodeAlive = oldNode ? await oldNode.evaluate((el) => el.isConnected).catch(() => false) : false;
must(!nodeAlive, "B3 row's DOM node was REPLACED (snapshot-bound key → entrance animation replays)");
must((await rowSlot(q, "Sync Alpha")) === "1", "B4 overwrite kept the seat (slot unchanged)");

/* ---------------- Phase C: delete propagates ---------------- */
console.log("Phase C — cross-tab delete");
await openBookmarks(p);
await rows(p, "Sync Alpha").locator('[data-canvas-ui="viewport-bookmark-delete"]').click();
await sleep(400);
await closeBookmarks(p); // real UI delete → real write in A (full map minus the row)
await deliverSync(q, await payloadOf(p)); // the event the browser would hand B
must((await q.locator('[data-canvas-ui="viewport-bookmark-row"]').count()) === 0,
  "C1 A's delete removed the row from B's OPEN panel live");
must((await q.locator('[data-canvas-ui="viewport-bookmark-empty"]').count()) === 1,
  "C2 B fell back to the empty state");

/* ---------------- Phase D: bidirectional + seat math on synced state ---------------- */
console.log("Phase D — bidirectional sync");
await saveBookmark(q, "Sync Beta"); // B saves — A must hear it
await deliverSync(p, await payloadOf(q)); // deliver B's real payload into A
await openBookmarks(p); // A observes (its panel closed back in C)
must((await rows(p, "Sync Beta").count()) === 1, "D1 B's save appears in A live (reverse direction)");
must((await rowSlot(p, "Sync Beta")) === "1", "D2 B's bookmark took seat 1 (freed in C)");
await saveBookmark(p, "Sync Gamma"); // A saves (panel opens/closes)
await deliverSync(q, await payloadOf(p));
await openBookmarks(q); // B observes (its panel closed at its own save)
must((await rows(q, "Sync Gamma").count()) === 1, "D3 A's save appears in B live");
must((await rowSlot(q, "Sync Gamma")) === "2", "D4 A's bookmark took the next free seat (2)");
await openBookmarks(p); // chips live in the popover DOM
const chipsA = await p.locator('[data-canvas-ui="viewport-bookmark-slot"]').allTextContents();
must(chipsA.join(",") === "1,2", `D5 A's panel holds both seats in seat order (got ${chipsA.join(",")})`);

/* ---------------- Phase E: raw payload events (corrupt / foreign / null) ---------------- */
console.log("Phase E — raw payload events");
await deliverSync(q, "{corrupt json");
must((await q.locator('[data-canvas-ui="viewport-bookmark-row"]').count()) === 0,
  "E1 corrupt payload degrades B to empty (never trusted)");
// foreign WORKSPACE entry: the store adopts it wholesale, but the panel is
// per-ws (Task 100) — it must NOT leak into this ws's list
const otherWs = JSON.stringify({ "foreign:ws": { "Foreign View": { viewport: { x: 5, y: 6, zoom: 0.75 }, slot: 3 } } });
await deliverSync(q, otherWs);
must((await rows(q, "Foreign View").count()) === 0,
  "E2 another workspace's entry must NOT leak into this ws's panel");
// foreign entry under the CURRENT ws key: adopted into the live panel
const curWs = Object.keys(JSON.parse(payloadA))[0];
const foreign = JSON.stringify({ [curWs]: { "Foreign View": { viewport: { x: 5, y: 6, zoom: 0.75 }, slot: 3 } } });
await deliverSync(q, foreign);
must((await rows(q, "Foreign View").count()) === 1, "E3 valid foreign payload adopted wholesale");
must((await rowSlot(q, "Foreign View")) === "3", "E3b foreign seat travels with the entry");
await deliverSync(q, null);
must((await q.locator('[data-canvas-ui="viewport-bookmark-row"]').count()) === 0,
  "E4 key removed elsewhere → B empties (newValue null path)");
await p.evaluate((k) => localStorage.removeItem(k), KEY);
await sleep(300);

/* ---------------- Phase F: static contract ---------------- */
console.log("Phase F — static contract");
const storeSrc = readFileSync("src/lib/store.ts", "utf8");
must(
  /window\.addEventListener\("storage", \(e: StorageEvent\) => \{[\s\S]*?e\.key !== VIEWPORT_BOOKMARKS_KEY && e\.key !== null/.test(storeSrc),
  "F1 listener keyed to the bookmark key, with the localStorage.clear() (null key) case"
);
const listenIdx = storeSrc.indexOf('addEventListener("storage"');
const listenerBody = listenIdx >= 0
  ? storeSrc.slice(listenIdx, storeSrc.indexOf("\n}", listenIdx) + 2)
  : "";
must(
  listenerBody !== "" && !listenerBody.includes("setItem") && !listenerBody.includes("persistViewportBookmarks"),
  "F2 listener never writes back — no echo loop by construction"
);
must(
  /if \(raw\) return parseViewportBookmarksRaw\(raw\)/.test(storeSrc) &&
    listenerBody.includes("parseViewportBookmarksRaw"),
  "F3 ONE parse path shared by boot hydrate and the cross-tab listener"
);
must(
  !listenerBody.includes("VIEWPORT_MEMORY_KEY") && !listenerBody.includes("sessionStorage"),
  "F4 viewport memory untouched by the listener (per-tab contract, Task 99)"
);
const canvasSrc = readFileSync("src/components/workflow/canvas.tsx", "utf8");
must(
  /key=\{`\$\{name\}:\$\{Math\.round\(bm\.viewport\.zoom \* 100\)\}`\}/.test(canvasSrc),
  "F5 row key binds the snapshot (name + zoom), not just the name"
);
must(
  /animate-in fade-in slide-in-from-left-1/.test(canvasSrc),
  "F6 rows announce arrival with the entrance animation"
);

/* ---------------- Phase Z: cleanup + both consoles ---------------- */
console.log("Phase Z — cleanup");
await p.evaluate(([k1, k2]) => { localStorage.removeItem(k1); localStorage.removeItem(k2); }, [KEY, KEY_V1]);
await sleep(300);
must(consoleA.length === 0, `Z1 tab A console clean (got ${consoleA.length})`);
must(consoleB.length === 0, `Z2 tab B console clean (got ${consoleB.length})`);

console.log(`T102 ALL PASS (${PASS} assertions)`);
await cleanup();
process.exit(0);

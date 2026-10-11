// t102 diag3 — A4 bisect: what does B's row actually render vs the payload?
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const KEY = "cryoflow.viewportBookmarks.v2";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const q = await b.newPage({ viewport: { width: 1600, height: 900 } });
for (const pg of [p, q]) {
  await pg.goto(BASE, { waitUntil: "networkidle" });
  await pg.waitForSelector('[data-canvas="viewport"]');
  await sleep(700);
}
await p.evaluate(([k1, k2]) => { localStorage.removeItem(k1); localStorage.removeItem(k2); }, [KEY, "cryoflow.viewportBookmarks.v1"]);
await p.reload({ waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await sleep(700);
const toCanvas = async (pg) => {
  for (let i = 0; i < 4; i++) {
    const v = await pg.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view") ?? null);
    if (v === "canvas") return;
    await pg.keyboard.press("Shift+C");
    await sleep(700);
  }
};
await toCanvas(p);
// save in A via UI
await p.locator('[data-canvas-ui="viewport-bookmarks-trigger"]').click();
await p.waitForSelector('[data-canvas-ui="viewport-bookmarks-panel"]');
await p.locator('[data-canvas-ui="viewport-bookmark-input"]').fill("Sync Alpha");
await p.locator('[data-canvas-ui="viewport-bookmark-save"]').click();
await sleep(300);
await p.keyboard.press("Escape");
await sleep(250);
const payload = await p.evaluate((k) => localStorage.getItem(k), KEY);
console.log("payload:", payload);
// open B's panel, dispatch, inspect
await q.locator('[data-canvas-ui="viewport-bookmarks-trigger"]').click();
await q.waitForSelector('[data-canvas-ui="viewport-bookmarks-panel"]');
await sleep(300);
await q.evaluate(([k, val]) => window.dispatchEvent(new StorageEvent("storage", { key: k, newValue: val })), [KEY, payload]);
await sleep(500);
const rowText = await q.locator('[data-canvas-ui="viewport-bookmark-row"]').first().textContent();
console.log("B row text:", JSON.stringify(rowText));
// what's in B's STORE-backed panel vs B's localStorage?
const qStore = await q.evaluate((k) => localStorage.getItem(k), KEY);
console.log("B's own localStorage:", JSON.stringify(qStore));
await p.evaluate((k) => localStorage.removeItem(k), KEY);
await b.close();

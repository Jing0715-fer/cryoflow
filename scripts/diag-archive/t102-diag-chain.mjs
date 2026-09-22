// t102 diag — bisect the sync chain on ONE page:
//   1. real UI save → is the payload in localStorage?
//   2. synthetic dispatch → does a vanilla listener see it?
//   3. does the app listener act (panel row appears)?
//   4. if not: re-parse the payload by hand — is it valid?
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const KEY = "cryoflow.viewportBookmarks.v2";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errs = [];
p.on("pageerror", (e) => errs.push(String(e)));
await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await sleep(800);
for (let i = 0; i < 4 && (p.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view") ?? null).then(v => console.log("view", v)) === null); i++) {}
// to canvas
for (let i = 0; i < 4; i++) {
  const v = await p.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view") ?? null);
  if (v === "canvas") break;
  await p.keyboard.press("Shift+C");
  await sleep(700);
}
// clean
await p.evaluate(([k1, k2]) => { localStorage.removeItem(k1); localStorage.removeItem(k2); }, [KEY, "cryoflow.viewportBookmarks.v1"]);
await p.reload({ waitUntil: "networkidle" });
await p.waitForSelector('[data-canvas="viewport"]');
await sleep(800);
for (let i = 0; i < 4; i++) {
  const v = await p.evaluate(() => document.querySelector("[data-view]")?.getAttribute("data-view") ?? null);
  if (v === "canvas") break;
  await p.keyboard.press("Shift+C");
  await sleep(700);
}
// arm vanilla listener
await p.evaluate(() => {
  window.__seen = [];
  window.addEventListener("storage", (e) => window.__seen.push(e.key));
});
// real UI save
await p.locator('[data-canvas-ui="viewport-bookmarks-trigger"]').click();
await p.waitForSelector('[data-canvas-ui="viewport-bookmarks-panel"]');
await p.locator('[data-canvas-ui="viewport-bookmark-input"]').fill("Diag Alpha");
await p.locator('[data-canvas-ui="viewport-bookmark-save"]').click();
await sleep(400);
const stored = await p.evaluate((k) => localStorage.getItem(k), KEY);
console.log("1. after UI save, localStorage:", stored ? stored.slice(0, 120) : "NULL");
// dispatch synthetic with the SAME stored payload
const seen = await p.evaluate(([k, val]) => {
  window.dispatchEvent(new StorageEvent("storage", { key: k, newValue: val }));
  return window.__seen;
}, [KEY, stored]);
await sleep(600);
console.log("2. vanilla listener saw:", JSON.stringify(seen));
const rows = await p.locator('[data-canvas-ui="viewport-bookmark-row"]').count();
console.log("3. panel rows after dispatch:", rows);
console.log("4. pageerrors:", JSON.stringify(errs));
await p.evaluate((k) => localStorage.removeItem(k), KEY);
await b.close();

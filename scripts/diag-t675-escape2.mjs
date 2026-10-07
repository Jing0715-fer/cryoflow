// t675 diag2 — WHO eats the Escape when focus sits on the palette's
// DialogContent? Instruments: (1) a document-capture keydown listener that
// logs defaultPrevented + target at keydown time; (2) a document-bubble
// listener (sees the FINAL defaultPrevented after every capture listener
// ran); (3) the dialog manifest at each step; (4) the input-focus
// discriminating test — click the palette input, Escape again.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const REFINE3D_ID = "cmuwipe635000refine3d";
const DRILL_ID = "t675diagd";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pollUntil = async (fn, timeoutMs = 10000) => {
  const t0 = Date.now();
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() - t0 > timeoutMs) return null;
    await sleep(300);
  }
};

const seats0 = await fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`).then((r) => r.json()).then((j) => j.bookmarks ?? []);
const clean = seats0.filter((x) => x.id !== DRILL_ID);
await fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`, {
  method: "PUT", headers: { "Content-Type": "application/json", Origin: BASE },
  body: JSON.stringify({ bookmarks: [...clean, { id: DRILL_ID, name: "Diag drill", ts: Date.now(), snapshot: { mode: "iso", fov: 0.876, position: [42.7, 38.1, 95.3], up: [0, 1, 0], target: [0, 0, 0], radius: 63.2, radiusMax: 110.4, fog: 0, clipFar: 0, minNear: 0, minFar: 0 }, view: { sigma: 2.5, sign: 1, slice: { on: true, axis: "Z", pos: 0.35 }, clip: { on: false, x: 1, y: 1, z: 1, invert: false } } }] }),
});
console.log("· diag drill mounted");

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });

await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60000 });
await sleep(2000);
// instrument BEFORE anything: capture + bubble Escape watchers
await page.evaluate(() => {
  const w = window;
  w.__esc = [];
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") w.__esc.push({ phase: "capture-late", prevented: e.defaultPrevented, target: e.target?.tagName + "." + String(e.target?.className || "").slice(0, 40) });
  }, { capture: true });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") w.__esc.push({ phase: "bubble-final", prevented: e.defaultPrevented });
  }, false);
});
const manifest = (tag) => page.evaluate((t) => {
  const ds = [...document.querySelectorAll('[role="dialog"]')].map((d) => ({
    label: (d.getAttribute("aria-label") || d.textContent || "").slice(0, 40),
    state: d.getAttribute("data-state"),
  }));
  return { tag: t, dialogs: ds, cmdk: document.querySelectorAll("[cmdk-item]").length, poprows: document.querySelectorAll('[data-canvas-ui="camera-bookmarks"] button[aria-label^="Delete bookmark"]').length };
}, tag).then((m) => console.log(JSON.stringify(m)));

await page.locator('[role="tab"][title^="Project dashboard"]').first().click().catch(() => {});
await sleep(1200);
const reRow = page.locator("[data-roster-row]", { hasText: "3D auto-refine" }).first();
await pollUntil(async () => (await reRow.count()) > 0 || null, 10000);
await reRow.locator('button[title^="Open 3D auto-refine"]').first().click().catch(() => {});
await pollUntil(async () => (await page.locator('[role="dialog"]').count()) > 0 || null, 15000);
await sleep(1200);
await page.locator('[data-insp-face="tabs"] [role="tab"]', { hasText: /^Results/ }).first().click().catch(() => {});
await sleep(1200);
const enlarge = page.locator('button[aria-label^="Enlarge"]').first();
await pollUntil(async () => (await enlarge.count()) > 0 || null, 25000);
await enlarge.click().catch(() => {});
await sleep(1200);
const v3d = page.locator("button", { hasText: "View in 3D" }).first();
if (!(await v3d.count())) { console.log("no view3d"); process.exit(1); }
await v3d.click().catch(() => {});
await pollUntil(async () =>
  (await page.locator('button[aria-label="Camera view bookmarks — 4 saved"]').count()) > 0 || null, 20000);
await page.locator('button[aria-label^="Camera view bookmarks"]').first().click().catch(() => {});
await sleep(800);
await manifest("popover open");
await page.evaluate(() => { window.__esc.length = 0; });

await page.keyboard.press("Control+k");
await pollUntil(async () => (await page.locator("[cmdk-item]").count()) > 0 || null, 15000);
await sleep(600);
await manifest("palette open");

// X-click a diag row → focus falls to content div
const drow = page.locator(`[data-palette-savedview-row="${DRILL_ID}"]`).first();
await drow.hover().catch(() => {});
await sleep(400);
await drow.locator(`button[data-palette-savedview-delete="${DRILL_ID}"]`).click();
await sleep(1200);
await manifest("after X click");

// ESCAPE #1 — expect FAIL (focus on content div)
await page.evaluate(() => { window.__esc.length = 0; });
await page.keyboard.press("Escape");
await sleep(1200);
console.log("escape#1 watchers:", JSON.stringify(await page.evaluate(() => window.__esc)));
await manifest("after Escape #1");

// now click the palette INPUT (move focus there) and Escape again
await page.locator('[cmdk-input]').first().click().catch((e) => console.log("input click err", e.message.slice(0, 80)));
await sleep(400);
await page.evaluate(() => { window.__esc.length = 0; });
await page.keyboard.press("Escape");
await sleep(1200);
console.log("escape#2 watchers:", JSON.stringify(await page.evaluate(() => window.__esc)));
await manifest("after Escape #2 (focus in input)");

await page.screenshot({ path: ".qa-logs/t675-diag2-end.png" });
await b.close();
// cleanup: remove diag drill
await fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`, {
  method: "PUT", headers: { "Content-Type": "application/json", Origin: BASE },
  body: JSON.stringify({ bookmarks: clean }),
});
console.log("DIAG2 DONE");

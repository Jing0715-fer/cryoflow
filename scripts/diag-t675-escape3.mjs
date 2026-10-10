// t675 diag3 — THE decisive instrument: wrap Set.prototype.add/delete with
// addInitScript (runs before the app bundle) and log every element-valued
// Set operation with a stack. The DismissableLayer registry IS a Set of DOM
// nodes — the log reconstructs who joined the layer stack and who left,
// around the X-click and the two Escapes.
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

// fresh diag drill
const seats0 = await fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`).then((r) => r.json()).then((j) => j.bookmarks ?? []);
const clean = seats0.filter((x) => x.id !== DRILL_ID);
if (!seats0.some((x) => x.id === DRILL_ID)) {
  await fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`, {
    method: "PUT", headers: { "Content-Type": "application/json", Origin: BASE },
    body: JSON.stringify({ bookmarks: [...clean, { id: DRILL_ID, name: "Diag drill", ts: Date.now(), snapshot: { mode: "iso", fov: 0.876, position: [42.7, 38.1, 95.3], up: [0, 1, 0], target: [0, 0, 0], radius: 63.2, radiusMax: 110.4, fog: 0, clipFar: 0, minNear: 0, minFar: 0 }, view: { sigma: 2.5, sign: 1, slice: { on: true, axis: "Z", pos: 0.35 }, clip: { on: false, x: 1, y: 1, z: 1, invert: false } } }] }),
  });
}
console.log("· diag drill ensured");

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
await page.addInitScript(() => {
  const w = window;
  w.__setOps = [];
  let n = 0;
  const fp = (el) => {
    if (!el) return "null";
    if (el.nodeType !== 1) return "non-el";
    el.__fp = el.__fp || `E${++n}:${el.tagName}.${String(el.className).slice(0, 30)}`;
    return el.__fp;
  };
  const origAdd = Set.prototype.add;
  Set.prototype.add = function (v) {
    if (v && v.nodeType === 1) {
      w.__setOps.push({ t: Date.now() % 100000, op: "add", el: fp(v), stack: new Error().stack.split("\n").slice(2, 5).map((s) => s.trim().slice(0, 80)).join(" <- ") });
    }
    return origAdd.call(this, v);
  };
  const origDel = Set.prototype.delete;
  Set.prototype.delete = function (v) {
    if (v && v.nodeType === 1) {
      w.__setOps.push({ t: Date.now() % 100000, op: "del", el: fp(v), stack: new Error().stack.split("\n").slice(2, 5).map((s) => s.trim().slice(0, 80)).join(" <- ") });
    }
    return origDel.call(this, v);
  };
});

await page.goto(`${BASE}/`, { waitUntil: "networkidle", timeout: 60000 });
await sleep(2000);
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

const mark = async (tag) => page.evaluate((t) => {
  (window.__setOps = window.__setOps || []).push({ t: Date.now() % 100000, op: `=== ${t} ===`, el: "", stack: "" });
}, tag);
await mark("popover-open");

await page.keyboard.press("Control+k");
await pollUntil(async () => (await page.locator("[cmdk-item]").count()) > 0 || null, 15000);
await sleep(600);
await mark("palette-open");

const drow = page.locator(`[data-palette-savedview-row="${DRILL_ID}"]`).first();
await drow.hover().catch(() => {});
await sleep(400);
await mark("before-x-click");
await drow.locator(`button[data-palette-savedview-delete="${DRILL_ID}"]`).click();
await sleep(1200);
await mark("after-x-click");

await page.keyboard.press("Escape");
await sleep(1200);
await mark("after-escape1");
const open1 = await page.locator("[cmdk-item]").count();
await page.keyboard.press("Escape");
await sleep(1200);
await mark("after-escape2");
const open2 = await page.locator("[cmdk-item]").count();
console.log(`escape1: cmdk=${open1} (still open if >0) | escape2: cmdk=${open2}`);

const ops = await page.evaluate(() => window.__setOps);
// print only ops from palette-open onwards
const startIdx = ops.findIndex((o) => o.op.includes("palette-open"));
for (const o of ops.slice(Math.max(0, startIdx - 2))) {
  console.log(`${o.op.padEnd(20)} ${o.el.padEnd(38)} ${o.stack.slice(0, 140)}`);
}
await page.screenshot({ path: ".qa-logs/t675-diag3-end.png" });
await b.close();
await fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`, {
  method: "PUT", headers: { "Content-Type": "application/json", Origin: BASE },
  body: JSON.stringify({ bookmarks: clean }),
});
console.log("DIAG3 DONE");

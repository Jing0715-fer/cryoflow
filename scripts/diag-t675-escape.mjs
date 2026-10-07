// t675 diag — what exactly happens after Escape when the palette sits over
// the viewer dialog? Records: cmdk count, dialog count, focused element,
// popover state, then the trigger click, then Control+k — one snapshot each.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const REFINE3D_ID = "cmuwipe635000refine3d";
const DRILL2_ID = "t675drill2";
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

const seats = await fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`).then((r) => r.json()).then((j) => j.bookmarks ?? []);
if (!seats.some((x) => x.id === DRILL2_ID)) {
  seats.push({ id: DRILL2_ID, name: "Probe drill beta", ts: Date.now(), snapshot: { mode: "iso", fov: 0.876, position: [42.7, 38.1, 95.3], up: [0, 1, 0], target: [0, 0, 0], radius: 63.2, radiusMax: 110.4, fog: 0, clipFar: 0, minNear: 0, minFar: 0 }, view: { sigma: 2.5, sign: 1, slice: { on: true, axis: "Z", pos: 0.35 }, clip: { on: false, x: 1, y: 1, z: 1, invert: false } } });
  await fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`, { method: "PUT", headers: { "Content-Type": "application/json", Origin: BASE }, body: JSON.stringify({ bookmarks: seats.slice(0, 8) }) });
}
console.log("· seats:", (await fetchSeats()).length);
async function fetchSeats() { return fetch(`${BASE}/api/jobs/${REFINE3D_ID}/camera-bookmarks`).then((r) => r.json()).then((j) => j.bookmarks ?? []); }

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 1000 } });
const snap = async (tag) => {
  const s = await page.evaluate(() => ({
    cmdk: document.querySelectorAll("[cmdk-item]").length,
    dialogs: document.querySelectorAll('[role="dialog"]').length,
    poprows: document.querySelectorAll('[data-canvas-ui="camera-bookmarks"] button[aria-label^="Delete bookmark"]').length,
    focus: document.activeElement ? `${document.activeElement.tagName}:${(document.activeElement.getAttribute("aria-label") || document.activeElement.getAttribute("placeholder") || document.activeElement.className || "").slice(0, 60)}` : "none",
  }));
  console.log(`[${tag}]`, JSON.stringify(s));
  return s;
};

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
  (await page.locator('button[aria-label="Camera view bookmarks — 7 saved"]').count()) > 0 || null, 20000);
await page.locator('button[aria-label^="Camera view bookmarks"]').first().click().catch(() => {});
await sleep(900);
await snap("after popover open");

await page.keyboard.press("Control+k");
await pollUntil(async () => (await page.locator("[cmdk-item]").count()) > 0 || null, 15000);
await sleep(800);
await snap("palette open");

// delete drill2 via palette X
const d2row = page.locator(`[data-palette-savedview-row="${DRILL2_ID}"]`).first();
await d2row.hover().catch(() => {});
await sleep(400);
await d2row.locator(`button[data-palette-savedview-delete="${DRILL2_ID}"]`).click();
await pollUntil(async () => (await page.locator("[cmdk-item]", { hasText: "Saved view — " }).count()) === 6 || null, 8000);
await snap("after delete");

await page.keyboard.press("Escape");
await sleep(600);
await snap("after Escape 600ms");
await sleep(900);
await snap("after Escape 1500ms");

// try the trigger click
await page.locator('button[aria-label^="Camera view bookmarks"]').first().click().catch((e) => console.log("trigger click err:", e.message.slice(0, 120)));
await sleep(900);
await snap("after trigger click");

// try Control+k
await page.keyboard.press("Control+k");
await sleep(1200);
await snap("after Control+k");

await page.screenshot({ path: ".qa-logs/t675-diag-end.png" });
await b.close();
console.log("DIAG DONE");

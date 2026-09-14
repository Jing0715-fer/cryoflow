#!/usr/bin/env node
/** t176-tour.mjs — agent-browser is blind to synthetic touch taps, but the
 *  console sweep still rides Playwright: 280px fold tour, console hygiene,
 *  and the three beauty shots (palette clamp, resurrected X, bar fit). */
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 280, height: 653 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3,
});
const page = await context.newPage();
const errs = [];
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
page.on("pageerror", (e) => errs.push(String(e)));
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2500);
// beauty shot 1: palette sheet clamped at 280
await page.click('button[aria-label="Add a job"]');
await sleep(900);
await page.screenshot({ path: "scripts/shot-176-palette-280.png" });
await page.keyboard.press("Escape");
await sleep(600);
// beauty shot 2: sheet with the resurrected X (idle import via cmdk → select)
const jobs = await (await fetch(BASE + "/api/jobs")).json();
const list = Array.isArray(jobs) ? jobs : jobs.jobs ?? [];
const idleImport = list.find((j) => j.status === "idle" && /import/i.test(j.name));
await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button, [role=button], [role=tab]")];
  const fit = btns.find((b) => (b.textContent || "").trim().toUpperCase() === "FIT");
  if (fit) fit.click();
});
await sleep(1200);
const vp = await page.evaluate(() => {
  const w = document.querySelector('[data-canvas="workspace"]');
  const m = new DOMMatrixReadOnly(getComputedStyle(w).transform === "none" ? "" : getComputedStyle(w).transform);
  return { x: m.e, y: m.f, z: m.a };
});
const d = await page.evaluate(({ vpx, vpy, vpz, wx, wy }) => ({
  dx: 140 - (wx * vpz + vpx),
  dy: 300 - (wy * vpz + vpy),
}), { vpx: vp.x, vpy: vp.y, vpz: vp.z, wx: idleImport.x ?? 0, wy: idleImport.y ?? 0 });
await page.mouse.move(140, 326);
await page.mouse.down();
await page.mouse.move(140 + d.dx, 326 + d.dy, { steps: 8 });
await page.mouse.up();
await sleep(800);
await page.touchscreen.tap(140, 300);
await sleep(1500);
await page.screenshot({ path: "scripts/shot-176-sheet-x-280.png" });
await page.keyboard.press("Escape");
await sleep(700);
// beauty shot 3: inspector bar fit at 280 (via cmdk)
await page.keyboard.press("ControlOrMeta+k");
await sleep(700);
await page.keyboard.type((list.find((j) => j.status === "completed" && /import/i.test(j.name))?.name ?? "").slice(0, 18), { delay: 40 });
await sleep(700);
await page.evaluate(() => { [...document.querySelectorAll("[cmdk-item]")][0]?.click(); });
await sleep(1800);
await page.screenshot({ path: "scripts/shot-176-inspector-280.png" });
console.log("console errors:", errs.length);
for (const e of errs) console.log("  ", e.slice(0, 160));
await browser.close();
console.log("TOUR DONE");

#!/usr/bin/env node
/** t176-shots.mjs — final beauty shots: palette badge clearance + the
 *  resurrected sheet X (card placed clear of the KPI overlay). */
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 280, height: 653 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3,
});
const page = await context.newPage();
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2500);
await page.click('button[aria-label="Add a job"]');
await sleep(900);
await page.screenshot({ path: "scripts/shot-176-palette-280.png" });
await page.keyboard.press("Escape");
await sleep(600);
// sheet with X: idle import placed in the clear band below the KPI bar
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
  dy: 450 - (wy * vpz + vpy),
}), { vpx: vp.x, vpy: vp.y, vpz: vp.z, wx: idleImport.x ?? 0, wy: idleImport.y ?? 0 });
// pan from a verified-empty canvas spot, then tap the card's live center
for (const [sx, sy] of [[140, 326], [140, 500], [60, 326], [200, 560], [60, 500]]) {
  const ok = await page.evaluate(([sx, sy]) => {
    const el = document.elementFromPoint(sx, sy);
    return !el || (!el.closest("[data-job]") && !el.closest("button"));
  }, [sx, sy]);
  if (!ok) continue;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + d.dx, sy + d.dy, { steps: 8 });
  await page.mouse.up();
  await sleep(800);
  break;
}
const spot = await page.evaluate((want) => {
  const c = [...document.querySelectorAll("[data-job]")].find((el) => el.getAttribute("data-job") === want);
  const r = c?.getBoundingClientRect();
  return r && r.top >= 20 && r.bottom <= innerHeight - 80 && r.left >= 0 && r.right <= innerWidth
    ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null;
}, idleImport.id);
console.log("card spot:", JSON.stringify(spot));
if (spot) {
  const hit = await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y);
    return el ? el.tagName + "|" + (typeof el.className === "string" ? el.className.slice(0, 50) : "") : "none";
  }, [spot.x, spot.y]);
  console.log("tap point hits:", hit);
  await page.touchscreen.tap(spot.x, spot.y);
  await sleep(1600);
}
const open = await page.evaluate(() => !!document.querySelector("[data-panel-sheet]"));
console.log("sheet open for shot:", open);
if (open) await page.screenshot({ path: "scripts/shot-176-sheet-x-280.png" });
await browser.close();
console.log("SHOTS DONE");

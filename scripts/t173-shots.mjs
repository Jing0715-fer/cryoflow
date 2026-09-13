#!/usr/bin/env node
/**
 * t173 beauty shots — the finger's invitation, photographed at 320×568:
 *   1. the sheet at rest (grabber seated in the header band, dock pinned)
 *   2. mid-drag (the echo lit on the left edge, sheet following the pointer)
 *   3. desktop aside (affordance-free, scope intact)
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = "/home/z/my-project/.qa-logs";

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true,
});
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2500);
await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button, [role=button], [role=tab]")];
  const fit = btns.find((b) => (b.textContent || "").trim().toUpperCase() === "FIT");
  if (fit) fit.click();
});
await sleep(1200);

const jobs = await (await fetch(BASE + "/api/jobs")).json();
const idleIds = new Set((jobs.jobs ?? jobs).filter((j) => j.status === "idle").map((j) => j.id));
let card = null;
for (let a = 0; a < 8 && !card; a++) {
  const cards = await page.evaluate(() =>
    [...document.querySelectorAll("[data-job]")].map((c) => {
      const r = c.getBoundingClientRect();
      return { id: c.getAttribute("data-job"),
        inVp: r.top >= 30 && r.left >= 0 && r.bottom <= innerHeight - 30 && r.right <= innerWidth,
        cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
    }));
  card = cards.find((c) => idleIds.has(c.id || "") && c.inVp) || null;
  if (card) break;
  const px = 160 + (a % 3) * 30, py = 300 + (a % 2) * 40;
  await page.mouse.move(px, py); await page.mouse.down();
  await page.mouse.move(px - 180, py - (a % 2 ? 140 : 40), { steps: 6 }); await page.mouse.up();
  await sleep(600);
}
await page.touchscreen.tap(card.cx, card.cy);
await sleep(1500);
await page.screenshot({ path: `${OUT}/t173-sheet-rest.png` });

// mid-drag: grab the sheet away from form fields, hold it half-open
const rect = await page.evaluate(() => {
  const r = document.querySelector('[role="dialog"]').getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
const sy = Math.min(rect.y + rect.h / 2, 480);
await page.mouse.move(rect.x + 100, sy);
await page.mouse.down();
await page.mouse.move(rect.x + 150, sy, { steps: 8 });
await sleep(150);
await page.screenshot({ path: `${OUT}/t173-mid-drag-echo.png` });
await page.mouse.move(rect.x + rect.w * 0.95, sy, { steps: 10 });
await page.mouse.up();
await sleep(800);
console.log("mobile shots done (dismissed:", await page.evaluate(() => !document.querySelector('[role="dialog"]')), ")");
await ctx.close();

// desktop aside — the scope's other face
const dctx = await browser.newContext({ viewport: { width: 1440, height: 800 } });
const dpage = await dctx.newPage();
await dpage.goto(BASE, { waitUntil: "networkidle" });
await sleep(2500);
await dpage.evaluate(() => {
  const btns = [...document.querySelectorAll("button, [role=button], [role=tab]")];
  const fit = btns.find((b) => (b.textContent || "").trim().toUpperCase() === "FIT");
  if (fit) fit.click();
});
await sleep(1200);
const dcard = await dpage.evaluate((ids) => {
  const set = new Set(JSON.parse(ids));
  return [...document.querySelectorAll("[data-job]")].map((c) => {
    const r = c.getBoundingClientRect();
    return { id: c.getAttribute("data-job"), cx: r.x + r.width / 2, cy: r.y + r.height / 2,
      ok: r.top >= 60 && r.left >= 300 && r.bottom <= innerHeight - 60 };
  }).find((c) => set.has(c.id || "") && c.ok);
}, JSON.stringify([...idleIds]));
if (dcard) {
  await dpage.mouse.click(dcard.cx, dcard.cy);
  await sleep(1200);
  await dpage.screenshot({ path: `${OUT}/t173-desktop-aside.png` });
  console.log("desktop shot done");
}
await dctx.close();
await browser.close();

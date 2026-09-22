#!/usr/bin/env node
/* t177 after-photos: the truce faces + the breathing title (keeper shots) */
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);
for (let i = 0; i < 3; i++) { await page.evaluate(() => document.querySelector('button[aria-label="Zoom in"]')?.click()); await sleep(400); }

const jobs = await (await fetch(BASE + "/api/jobs")).json();
const list = Array.isArray(jobs) ? jobs : jobs.jobs ?? [];
const compLong = list.find((j) => j.status === "completed" && (j.name || "").length >= 10);
const job = list.find((j) => j.id === compLong.id);
const vp = await page.evaluate(() => {
  const w = document.querySelector('[data-canvas="workspace"]');
  const t = getComputedStyle(w).transform;
  const m = new DOMMatrixReadOnly(t === "none" ? "" : t);
  return { x: m.e, y: m.f, z: m.a };
});
const d = { dx: 720 - (job.x * vp.z + vp.x), dy: 450 - (job.y * vp.z + vp.y) };
for (const [sx, sy] of [[720, 378], [720, 594], [403, 378], [1036, 378]]) {
  const ok = await page.evaluate(([sx, sy]) => {
    const el = document.elementFromPoint(sx, sy);
    return !!el && !!el.closest('[data-canvas="viewport"]') && !el.closest("[data-job]") && !el.closest("button");
  }, [sx, sy]);
  if (!ok) continue;
  await page.mouse.move(sx, sy); await page.mouse.down();
  await page.mouse.move(sx + d.dx, sy + d.dy, { steps: 8 }); await page.mouse.up();
  break;
}
await sleep(800);
const spot = await page.evaluate((want) => {
  const c = [...document.querySelectorAll("[data-job]")].find((el) => el.getAttribute("data-job") === want);
  const r = c.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}, compLong.id);
await page.mouse.click(spot.x, spot.y, { button: "right" });
await sleep(900);
const item = await page.evaluate(() => {
  const del = [...document.querySelectorAll('[role="menuitem"]')].find((m) => (m.textContent || "").trim().startsWith("Delete"));
  const r = del.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + 10 };
});
await page.mouse.move(item.x, item.y); await sleep(200);
await page.mouse.down(); await sleep(100); await page.mouse.up();
await page.waitForSelector('[role="alertdialog"]', { timeout: 5000 });
await sleep(600);
await page.screenshot({ path: "/home/z/my-project/scripts/shots-t177/confirm-light.png" });
await page.evaluate(() => document.documentElement.classList.add("dark"));
await sleep(500);
await page.screenshot({ path: "/home/z/my-project/scripts/shots-t177/confirm-dark.png" });
await page.evaluate(() => document.documentElement.classList.remove("dark"));
console.log("confirm shots done");

// the 280 title: running job inspector at fold width
const ctx2 = await browser.newContext({ viewport: { width: 280, height: 653 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
const mpage = await ctx2.newPage();
await mpage.goto(BASE, { waitUntil: "networkidle" });
await sleep(2500);
const running = list.find((j) => j.status === "running");
const vp2 = await mpage.evaluate(() => {
  const w = document.querySelector('[data-canvas="workspace"]');
  const t = getComputedStyle(w).transform;
  const m = new DOMMatrixReadOnly(t === "none" ? "" : t);
  return { x: m.e, y: m.f, z: m.a };
});
const job2 = list.find((j) => j.id === running.id);
const d2 = { dx: 140 - (job2.x * vp2.z + vp2.x), dy: 320 - (job2.y * vp2.z + vp2.y) };
for (const [sx, sy] of [[140, 326], [140, 500], [60, 326], [60, 500], [200, 560]]) {
  const ok = await mpage.evaluate(([sx, sy]) => {
    const el = document.elementFromPoint(sx, sy);
    return !el || (!el.closest("[data-job]") && !el.closest("button"));
  }, [sx, sy]);
  if (!ok) continue;
  await mpage.mouse.move(sx, sy); await mpage.mouse.down();
  await mpage.mouse.move(sx + d2.dx, sy + d2.dy, { steps: 8 }); await mpage.mouse.up();
  break;
}
await sleep(800);
const spot2 = await mpage.evaluate((want) => {
  const c = [...document.querySelectorAll("[data-job]")].find((el) => el.getAttribute("data-job") === want);
  const r = c.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}, running.id);
await mpage.touchscreen.tap(spot2.x, spot2.y);
await sleep(1800);
await mpage.screenshot({ path: "/home/z/my-project/scripts/shots-t177/title-280.png" });
console.log("title shot done");
await browser.close();

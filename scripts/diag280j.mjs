#!/usr/bin/env node
/** diag280j.mjs — sample dialog presence at high frequency after touch tap. */
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 280, height: 653 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3,
});
const page = await context.newPage();
const jobs = await (await fetch(BASE + "/api/jobs")).json();
const list = Array.isArray(jobs) ? jobs : jobs.jobs ?? [];
const compImport = list.find((j) => j.status === "completed" && /import/i.test(j.name));
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);
await page.evaluate(() => {
  window.__dlgLog = [];
  const mo = new MutationObserver(() => {
    const n = document.querySelectorAll('[role="dialog"]').length;
    const last = window.__dlgLog[window.__dlgLog.length - 1];
    if (last?.n !== n) window.__dlgLog.push({ t: performance.now() | 0, n });
  });
  mo.observe(document.body, { childList: true, subtree: true });
});
await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button, [role=button], [role=tab]")];
  const fit = btns.find((b) => (b.textContent || "").trim().toUpperCase() === "FIT");
  if (fit) fit.click();
});
await sleep(1500);
let hit = null;
for (let attempt = 0; attempt < 24 && !hit; attempt++) {
  hit = await page.evaluate((want) => {
    const m = 30;
    const c = [...document.querySelectorAll("[data-job]")].find((el) => el.getAttribute("data-job") === want);
    if (!c) return null;
    const r = c.getBoundingClientRect();
    if (r.top >= m && r.left >= 0 && r.bottom <= innerHeight - m && r.right <= innerWidth)
      return { cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
    return null;
  }, compImport.id);
  if (hit) break;
  const px = 140 + (attempt % 3) * 30, py = 300 + (attempt % 2) * 40;
  await page.mouse.move(px, py);
  await page.mouse.down();
  await page.mouse.move(px - 150, py - (attempt % 2 ? 150 : 50), { steps: 6 });
  await page.mouse.up();
  await sleep(700);
  if (attempt === 9) {
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll("button, [role=button], [role=tab]")];
      const fit = btns.find((b) => (b.textContent || "").trim().toUpperCase() === "FIT");
      if (fit) fit.click();
    });
    await sleep(1500);
  }
}
console.log("card:", JSON.stringify(hit));
await page.touchscreen.tap(hit.cx, hit.cy);
for (const ms of [60, 150, 300, 600, 1200, 2500]) {
  await sleep(ms === 60 ? 60 : ms - [60, 150, 300, 600, 1200, 2500][[60, 150, 300, 600, 1200, 2500].indexOf(ms) - 1]);
  const s = await page.evaluate(() => ({
    n: document.querySelectorAll('[role="dialog"]').length,
    insp: !!document.querySelector("[data-inspector-dialog]"),
    log: window.__dlgLog,
  }));
  console.log(`t+${ms}ms dialogs=${s.n} inspector=${s.insp} log=${JSON.stringify(s.log)}`);
}
await browser.close();

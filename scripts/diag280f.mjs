#!/usr/bin/env node
/** diag280f.mjs — why does the inspector show no [role=tab] at 280? */
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
await sleep(2500);
await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button, [role=button], [role=tab]")];
  const fit = btns.find((b) => (b.textContent || "").trim().toUpperCase() === "FIT");
  if (fit) fit.click();
});
await sleep(1500);
for (let attempt = 0; attempt < 10; attempt++) {
  const hit = await page.evaluate((want) => {
    const m = 30;
    const c = [...document.querySelectorAll("[data-job]")].find((el) => el.getAttribute("data-job") === want);
    if (!c) return null;
    const r = c.getBoundingClientRect();
    if (r.top >= m && r.left >= 0 && r.bottom <= innerHeight - m && r.right <= innerWidth)
      return { cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
    return null;
  }, compImport.id);
  if (hit) { await page.touchscreen.tap(hit.cx, hit.cy); break; }
  const px = 140 + (attempt % 3) * 30, py = 300 + (attempt % 2) * 40;
  await page.mouse.move(px, py);
  await page.mouse.down();
  await page.mouse.move(px - 130, py - (attempt % 2 ? 120 : 40), { steps: 6 });
  await page.mouse.up();
  await sleep(700);
}
await sleep(2000);
const d = await page.evaluate(() => {
  const dlgs = [...document.querySelectorAll('[role="dialog"]')].map((g) => ({
    cls: (g.className || "").slice(0, 60),
    isInspector: !!g.getAttribute("data-inspector-dialog"),
    tabs: [...g.querySelectorAll('[role="tab"]')].map((t) => (t.textContent || "").trim()),
    w: Math.round(g.getBoundingClientRect().width),
  }));
  const insp = document.querySelector('[data-inspector-dialog]');
  return { n: dlgs.length, dlgs, inspPresent: !!insp,
    sheetOpen: !!document.querySelector("[data-panel-sheet]"),
    bodyEnd: document.body.innerText.slice(-300) };
});
console.log(JSON.stringify(d, null, 1).slice(0, 2200));
await browser.close();

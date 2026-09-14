#!/usr/bin/env node
/** diag280d.mjs — replicate diag280b's exact sheet-params timing. */
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
const idleImport = list.find((j) => j.status === "idle" && /import/i.test(j.name));
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
  }, idleImport.id);
  if (hit) { await page.touchscreen.tap(hit.cx, hit.cy); break; }
  const px = 140 + (attempt % 3) * 30, py = 300 + (attempt % 2) * 40;
  await page.mouse.move(px, py);
  await page.mouse.down();
  await page.mouse.move(px - 130, py - (attempt % 2 ? 120 : 40), { steps: 6 });
  await page.mouse.up();
  await sleep(700);
}
await sleep(1500);
await page.locator('[role="dialog"] [role="tab"]', { hasText: "Params" }).first().click({ timeout: 4000 });
await sleep(800);
const dump = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"][data-panel-sheet]');
  const R = dlg.getBoundingClientRect();
  const bad = [];
  for (const el of dlg.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (r.right > R.right + 1 || r.left < R.left - 1)
      bad.push({ tag: el.tagName.toLowerCase(), over: Math.round(Math.max(r.right - R.right, R.left - r.left)),
        rect: [Math.round(r.left), Math.round(r.right)], R: [Math.round(R.left), Math.round(R.right)],
        cls: (typeof el.className === "string" ? el.className.slice(0, 90) : "") });
  }
  bad.sort((a, b) => b.over - a.over);
  return { dlgR: [Math.round(R.left), Math.round(R.right)], bad: bad.slice(0, 5) };
});
console.log(JSON.stringify(dump, null, 1));
await browser.close();

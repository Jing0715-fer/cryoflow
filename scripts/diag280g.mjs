#!/usr/bin/env node
/** diag280g.mjs — inspector open retry + hit-target debug at 280. */
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
let opened = false;
for (let a = 0; a < 5 && !opened; a++) {
  await sleep(1200);
  opened = await page.evaluate(() => !!document.querySelector("[data-inspector-dialog]"));
  if (!opened) {
    const dbg = await page.evaluate((want) => {
      const c = [...document.querySelectorAll("[data-job]")].find((el) => el.getAttribute("data-job") === want);
      const r = c?.getBoundingClientRect();
      if (!r) return { gone: true };
      const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { card: [Math.round(r.x), Math.round(r.y), Math.round(r.right), Math.round(r.bottom)],
        hit: el ? el.tagName + "." + (typeof el.className === "string" ? el.className.slice(0, 50) : "") : "none",
        dlg: document.querySelectorAll('[role="dialog"]').length };
    }, compImport.id);
    console.log("retry", a, JSON.stringify(dbg));
    const c = await page.evaluate((want) => {
      const r = [...document.querySelectorAll("[data-job]")].find((el) => el.getAttribute("data-job") === want)?.getBoundingClientRect();
      return r ? { cx: r.x + r.width / 2, cy: r.y + r.height / 2 } : null;
    }, compImport.id);
    if (c) await page.touchscreen.tap(c.cx, c.cy);
  }
}
console.log("inspector opened:", opened);
if (opened) {
  const tabs = await page.evaluate(() => {
    const dlg = document.querySelector("[data-inspector-dialog]");
    const R = dlg.getBoundingClientRect();
    const trigs = [...dlg.querySelectorAll('[role="tab"]')].filter((t) => t.getBoundingClientRect().width > 0);
    const right = Math.max(...trigs.map((t) => t.getBoundingClientRect().right));
    const bad = [];
    for (const el of dlg.querySelectorAll("*")) {
      const r2 = el.getBoundingClientRect();
      if (r2.width <= 0) continue;
      if (r2.bottom < R.top || r2.top > R.bottom) continue;
      if (r2.right > R.right + 1 || r2.left < R.left - 1) bad.push(Math.round(Math.max(r2.right - R.right, R.left - r2.left)));
    }
    const icons = [...dlg.querySelectorAll('[role="tab"] svg')].map((s) => getComputedStyle(s).display);
    return { rootW: Math.round(R.width), trigRight: Math.round(right), nClipped: bad.length, maxOver: bad.length ? Math.max(...bad) : 0, trigW: trigs.map((t) => Math.round(t.getBoundingClientRect().width)), icons };
  });
  console.log("inspector bar:", JSON.stringify(tabs));
}
await browser.close();

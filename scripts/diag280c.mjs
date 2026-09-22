#!/usr/bin/env node
/** diag280c.mjs — the sheet Close over=15px mystery, empirically. */
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
await sleep(1600);

const dump = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"][data-panel-sheet]');
  const R = dlg.getBoundingClientRect();
  const out = { dlg: { l: Math.round(R.left), r: Math.round(R.right), w: Math.round(R.width) }, state: dlg.getAttribute("data-state"), abs: [] };
  for (const el of dlg.querySelectorAll("*")) {
    const cs = getComputedStyle(el);
    if (cs.position !== "absolute" && cs.position !== "fixed") continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0) continue;
    out.abs.push({
      tag: el.tagName.toLowerCase(),
      over: Math.round(r.right - R.right),
      rect: [Math.round(r.left), Math.round(r.right)],
      pos: cs.position,
      right: cs.right, transform: cs.transform === "none" ? "" : cs.transform.slice(0, 40),
      translate: cs.translate || "",
      cls: (typeof el.className === "string" ? el.className.slice(0, 70) : ""),
    });
  }
  out.abs.sort((a, b) => b.over - a.over);
  return out;
});
console.log(JSON.stringify(dump, null, 1).slice(0, 3000));
await browser.close();

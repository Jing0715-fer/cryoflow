#!/usr/bin/env node
/** diag280i.mjs — mouse-click vs touch-tap on the completed card, both viewports. */
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();

async function trial(mode, vp) {
  const context = await browser.newContext({
    viewport: vp, isMobile: true, hasTouch: true, deviceScaleFactor: 3,
  });
  const page = await context.newPage();
  const jobs = await (await fetch(BASE + "/api/jobs")).json();
  const list = Array.isArray(jobs) ? jobs : jobs.jobs ?? [];
  const compImport = list.find((j) => j.status === "completed" && /import/i.test(j.name));
  await page.goto(BASE, { waitUntil: "networkidle" });
  await sleep(2200);
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button, [role=button], [role=tab]")];
    const fit = btns.find((b) => (b.textContent || "").trim().toUpperCase() === "FIT");
    if (fit) fit.click();
  });
  await sleep(1500);
  let hit = null;
  for (let attempt = 0; attempt < 10 && !hit; attempt++) {
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
    await page.mouse.move(px - 130, py - (attempt % 2 ? 120 : 40), { steps: 6 });
    await page.mouse.up();
    await sleep(700);
  }
  if (!hit) { console.log(mode, vp.width, "CARD NOT IN VIEW"); await context.close(); return; }
  if (mode === "mouse") await page.mouse.click(hit.cx, hit.cy);
  else await page.touchscreen.tap(hit.cx, hit.cy);
  await sleep(1600);
  const ok = await page.evaluate(() => !!document.querySelector("[data-inspector-dialog]"));
  console.log(`mode=${mode} vw=${vp.width} → inspector ${ok ? "OPENED" : "DID NOT OPEN"}`);
  await context.close();
}

await trial("mouse", { width: 280, height: 653 });
await trial("touch", { width: 280, height: 653 });
await trial("touch", { width: 320, height: 568 });
await browser.close();

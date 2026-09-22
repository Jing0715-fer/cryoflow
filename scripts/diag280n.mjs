#!/usr/bin/env node
/** diag280n.mjs — what exactly is clipped on the inspector Log tab at 280? */
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
// open inspector via cmdk (deterministic)
await page.keyboard.press("ControlOrMeta+k");
await sleep(700);
await page.keyboard.type(compImport.name.slice(0, 18), { delay: 40 });
await sleep(700);
await page.evaluate(() => {
  const it = [...document.querySelectorAll("[cmdk-item]")][0];
  it.click();
});
await sleep(1800);
await page.locator('[data-inspector-dialog] [role="tab"]', { hasText: "Log" }).first().click();
await sleep(1200);
const d = await page.evaluate(() => {
  const dlg = document.querySelector("[data-inspector-dialog]");
  const R = dlg.getBoundingClientRect();
  const bad = [];
  for (const el of dlg.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    if (r.bottom < R.top || r.top > R.bottom) continue;
    if (r.right > R.right + 1 || r.left < R.left - 1) {
      // walk ancestors: is there a horizontally scrollable container between el and dlg?
      let scrollable = null, node = el.parentElement;
      while (node && node !== dlg) {
        const cs = getComputedStyle(node);
        if (/(auto|scroll)/.test(cs.overflowX) && node.scrollWidth > node.clientWidth + 1) {
          scrollable = node;
          break;
        }
        node = node.parentElement;
      }
      bad.push({
        tag: el.tagName.toLowerCase(),
        over: Math.round(Math.max(r.right - R.right, R.left - r.left)),
        text: (el.textContent || "").trim().slice(0, 30),
        parentCls: (typeof el.parentElement?.className === "string" ? el.parentElement.className.slice(0, 70) : ""),
        scrollable: scrollable ? (typeof scrollable.className === "string" ? scrollable.className.slice(0, 60) : "data-log-console") : null,
        cls: (typeof el.className === "string" ? el.className.slice(0, 60) : ""),
      });
    }
  }
  bad.sort((a, b) => b.over - a.over);
  return { rootW: Math.round(R.width), n: bad.length, top: bad.slice(0, 8) };
});
console.log(JSON.stringify({ rootW: d.rootW, n: d.n }, null, 0)); console.log(JSON.stringify(d.top, null, 1));
await browser.close();

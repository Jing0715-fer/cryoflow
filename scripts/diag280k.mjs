#!/usr/bin/env node
/** diag280k.mjs — open the inspector via command palette (⌘K) at 280, then measure the bar. */
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
await page.keyboard.press("ControlOrMeta+k");
await sleep(700);
await page.keyboard.type(compImport.name.slice(0, 18), { delay: 40 });
await sleep(700);
// list the offered actions for the job
const items = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  return [...dlg.querySelectorAll("[cmdk-item]")].map((i) => (i.textContent || "").trim().slice(0, 60));
});
console.log("cmdk items:", JSON.stringify(items.slice(0, 8)));
// pick the jump/inspector item (first job-row item)
const picked = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  const it = [...dlg.querySelectorAll("[cmdk-item]")][0];
  if (!it) return false;
  it.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  it.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
  it.click();
  return (it.textContent || "").trim().slice(0, 50);
});
console.log("picked:", picked);
await sleep(1800);
const s = await page.evaluate(() => {
  const dlg = document.querySelector("[data-inspector-dialog]");
  if (!dlg) return { open: false };
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
  const icons = [...dlg.querySelectorAll('[role="tab"] svg')].map((x) => getComputedStyle(x).display);
  return { open: true, rootW: Math.round(R.width), trigW: trigs.map((t) => Math.round(t.getBoundingClientRect().width)),
    trigRight: Math.round(right), dlgRight: Math.round(R.right), nClipped: bad.length, maxOver: bad.length ? Math.max(...bad) : 0, icons };
});
console.log("inspector:", JSON.stringify(s));
await browser.close();

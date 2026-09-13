#!/usr/bin/env node
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
  permissions: ["clipboard-read", "clipboard-write"],
});
const page = await ctx.newPage();
const failed = [];
page.on("response", (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2500);
await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button, [role=button], [role=tab]")];
  const fit = btns.find((b) => (b.textContent || "").trim().toUpperCase() === "FIT");
  if (fit) fit.click();
});
await sleep(1500);
const jobs = await (await fetch(BASE + "/api/jobs")).json();
const list = Array.isArray(jobs) ? jobs : jobs.jobs;
const doneIds = new Set(list.filter((j) => j.status === "completed").map((j) => j.id));
const cards = await page.evaluate(() =>
  [...document.querySelectorAll("[data-job]")].map((c) => {
    const r = c.getBoundingClientRect();
    return { id: c.getAttribute("data-job"),
      inVp: r.top >= 60 && r.left >= 0 && r.bottom <= innerHeight - 60 && r.right <= innerWidth,
      cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
  }));
const card = cards.find((c) => doneIds.has(c.id || "") && c.inVp);
console.log("tapped completed card:", card?.id);
await page.touchscreen.tap(card.cx, card.cy);
await sleep(1800);
const tabs = await page.evaluate(() =>
  [...document.querySelectorAll('[role=dialog] [role=tab]')].map((t) => (t.textContent || "").trim()));
console.log("inspector tabs:", JSON.stringify(tabs));
for (const t of tabs) {
  await page.locator('[role=dialog] [role=tab]', { hasText: t }).first().click({ timeout: 3000 }).catch((e) => console.log("tab click fail:", t, String(e).slice(0, 80)));
  await sleep(600);
}
const noLog = await page.evaluate(() =>
  (document.querySelector('[role="dialog"]')?.textContent || "").includes("No engine log"));
console.log("No engine log found:", noLog);
console.log("failed responses:", JSON.stringify(failed, null, 1));
await browser.close();

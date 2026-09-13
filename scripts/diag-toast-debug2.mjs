#!/usr/bin/env node
/* diag-toast-debug2.mjs — high-frequency watch on the toast viewport */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 844 } });
page.on("pageerror", (e) => console.log("PAGEERROR:", String(e)));

await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2500);

// Instrument BEFORE clicking: MutationObserver on the viewport ol
await page.evaluate(() => {
  window.__toastEvents = [];
  const ol = document.querySelector("ol");
  if (!ol) { window.__toastEvents.push("no-ol"); return; }
  new MutationObserver((muts) => {
    for (const m of muts) {
      for (const n of m.addedNodes) window.__toastEvents.push(`added:${n.nodeName}:${(n.textContent || "").slice(0, 60)}`);
      for (const n of m.removedNodes) window.__toastEvents.push(`removed:${n.nodeName}:${(n.textContent || "").slice(0, 60)}`);
      if (m.type === "attributes") window.__toastEvents.push(`attr:${m.target.nodeName}:${m.attributeName}=${m.target.getAttribute(m.attributeName)}`);
    }
  }).observe(ol, { childList: true, subtree: false, attributes: true, attributeFilter: ["data-state", "data-swipe", "style"] });
});

await page.click('button[aria-label="Export canvas as PNG"]');
console.log("clicked, watching ol mutations at high frequency...");

for (let i = 1; i <= 24; i++) {
  await sleep(500);
  const evs = await page.evaluate(() => {
    const evs = window.__toastEvents || [];
    window.__toastEvents = [];
    const lis = document.querySelectorAll("li[data-radix-toast-impl], ol > li");
    return { evs, liCount: lis.length };
  });
  if (evs.evs.length || evs.liCount) {
    console.log(`t+${(i * 0.5).toFixed(1)}s li=${evs.liCount}`, JSON.stringify(evs.evs).slice(0, 400));
  }
  if (i === 12) console.log("--- midpoint, still watching ---");
}
console.log("watch done");
await browser.close();

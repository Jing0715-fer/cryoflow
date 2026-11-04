#!/usr/bin/env node
/* diag-toast-debug.mjs — why doesn't the export toast appear? */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 844 } });
page.on("pageerror", (e) => console.log("PAGEERROR:", String(e)));
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE-ERR:", m.text().slice(0, 140)); });

await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2500);

const btn = page.locator('button[aria-label="Export canvas as PNG"]');
console.log("export btn count:", await btn.count());
console.log("btn disabled:", await btn.first().isDisabled().catch((e) => "err " + e));
const box = await btn.first().boundingBox().catch(() => null);
console.log("btn box:", box);

await btn.first().click().catch((e) => console.log("CLICK ERR:", String(e).slice(0, 120)));
console.log("clicked");

for (let i = 1; i <= 12; i++) {
  await sleep(2500);
  const snap = await page.evaluate(() => {
    const lis = [...document.querySelectorAll("li[data-radix-toast-impl]")];
    const regions = [...document.querySelectorAll("[role=region]")].map((r) => r.getAttribute("aria-label") || r.className.slice(0, 60));
    const ol = document.querySelector("ol");
    const btn = document.querySelector('button[aria-label="Export canvas as PNG"]');
    const spin = !!document.querySelector('button[aria-label="Export canvas as PNG"] .animate-spin');
    return { lis: lis.length, liStates: lis.map((l) => l.getAttribute("data-state")), regions, olExists: !!ol, btnDisabled: btn ? btn.disabled : null, spinner: spin };
  });
  console.log(`t+${(i * 2.5).toFixed(1)}s:`, JSON.stringify(snap));
  if (snap.lis > 0) break;
}
await browser.close();

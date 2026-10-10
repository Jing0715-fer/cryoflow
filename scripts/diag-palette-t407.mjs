// t407 diag v2 — open the palette via its own button, dump every row + group
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE, { waitUntil: "domcontentloaded" });
// wait for the app to be interactive: the palette trigger button itself
await page.waitForSelector('button[aria-label="Open command palette (Ctrl+K)"]', { timeout: 30000 });
await page.click('button[aria-label="Open command palette (Ctrl+K)"]');
await page.waitForSelector('[cmdk-root]', { timeout: 10000 });
await page.waitForTimeout(700);
const groups = await page.evaluate(() =>
  [...document.querySelectorAll("[cmdk-group-heading]")].map((el) => el.textContent.trim())
);
console.log("groups:", JSON.stringify(groups));
const rows = await page.evaluate(() =>
  [...document.querySelectorAll('[data-slot="command-item"]')].map((el) => el.innerText.trim().replace(/\n/g, " | "))
);
console.log("palette rows:", rows.length);
rows.forEach((r) => console.log("  -", JSON.stringify(r.slice(0, 95))));
await browser.close();

// t407 diag — what does the inspector's Results tab actually contain?
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForSelector('button[aria-label="Open command palette (Ctrl+K)"]', { timeout: 30000 });
await page.click('button[aria-label="Open command palette (Ctrl+K)"]');
await page.waitForSelector('[cmdk-root]', { timeout: 10000 });
await sleep(600);
await page.locator('[data-slot="command-item"]', { hasText: "β-Galactosidase" }).first().click();
await sleep(2000);
await page.keyboard.press("Escape");
await sleep(800);
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await sleep(2500);
// what do the job cards look like?
const cards = await page.evaluate(() =>
  [...document.querySelectorAll('[data-job]')].slice(0, 20).map((el) => ({
    name: el.getAttribute("data-job") || el.getAttribute("data-name") || el.innerText.slice(0, 40),
    role: el.getAttribute("role"),
    tag: el.tagName,
  }))
);
console.log("job cards:", cards.length);
cards.slice(0, 6).forEach((c) => console.log("  ", JSON.stringify(c)));
// click the postprocess card
const node = page.locator('[data-job]', { hasText: "Post-process" }).first();
console.log("postprocess card count:", await node.count());
await node.click();
await sleep(2500);
// tabs visible?
const tabs = await page.evaluate(() =>
  [...document.querySelectorAll('[role="tab"]')].map((el) => el.textContent.trim())
);
console.log("tabs:", JSON.stringify(tabs));
await page.locator('[role="tab"]', { hasText: "Results" }).click();
await sleep(4000);
const btns = await page.evaluate(() =>
  [...document.querySelectorAll("button")].map((el) => el.getAttribute("aria-label") || el.innerText.trim()).filter((t) => t && /export|report/i.test(t))
);
console.log("export-ish buttons:", JSON.stringify(btns));
const panelText = await page.evaluate(() => document.body.innerText.slice(0, 200));
await page.screenshot({ path: "scripts/shots-qa/t407-results-diag.png" });
console.log("body head:", JSON.stringify(panelText.replace(/\n+/g, " | ").slice(0, 180)));
await browser.close();

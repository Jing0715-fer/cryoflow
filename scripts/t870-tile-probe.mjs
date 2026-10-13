import { chromium } from "playwright";
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1600, height: 1200 } });
await page.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));
await page.locator('[data-job="cmv6wl2ls000uu99xqvlodopd"]').first().click({ force: true });
await new Promise((r) => setTimeout(r, 1500));
await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
await new Promise((r) => setTimeout(r, 2500));
const labels = await page.evaluate(() =>
  [...document.querySelectorAll('button[aria-label^="Enlarge"]')].map((x) => x.getAttribute("aria-label")).slice(0, 20)
);
console.log(JSON.stringify(labels, null, 1));
const tabs = await page.evaluate(() => [...document.querySelectorAll('[role="tab"]')].map((x) => x.textContent));
console.log("tabs:", JSON.stringify(tabs));
await b.close();

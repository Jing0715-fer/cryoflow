import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 844 } });
await page.goto(BASE, { waitUntil: "networkidle" });
await new Promise((r) => setTimeout(r, 2500));
const card = page.locator("[data-job]", { hasText: "QA Post 300" }).locator('[role="button"]').first();
try {
  await card.click({ timeout: 5000, debugIgnore: undefined });
  console.log("click ok");
} catch (e) {
  console.log("CLICK FAIL FULL:");
  console.log(String(e).slice(0, 2000));
}
// inspect the matched elements
const n = await page.locator("[data-job]", { hasText: "QA Post 300" }).count();
console.log("matches for [data-job] hasText QA Post 300:", n);
const btns = await page.locator("[data-job]", { hasText: "QA Post 300" }).locator('[role="button"]').count();
console.log("role=button descendants across matches:", btns);
const b0 = page.locator("[data-job]", { hasText: "QA Post 300" }).locator('[role="button"]').first();
const bb = await b0.boundingBox().catch((e) => null);
console.log("first button box:", bb);
await browser.close();

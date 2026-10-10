import { chromium } from "playwright";
const browser = await chromium.launch({ args: ["--single-process", "--js-flags=--max-old-space-size=256", "--disable-gpu", "--disable-dev-shm-usage", "--renderer-process-limit=1"] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.route(/\.(woff2?|png|svg|jpe?g)$/i, (r) => r.fulfill({ status: 204, body: "" }));
  await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(6000);
  await page.getByRole("tab", { name: "Workflow" }).click().catch(async () => { await page.locator("[role=tab]", { hasText: "Workflow" }).first().click(); });
  await page.waitForTimeout(2500);
  const labels = await page.evaluate(() => Array.from(document.querySelectorAll("[aria-label]")).map((e) => e.getAttribute("aria-label")).filter((l) => l && l.includes("—")).slice(0, 40));
  console.log("CARDS:\n" + labels.join("\n"));
  const tabs = await page.evaluate(() => Array.from(document.querySelectorAll("[role=tab]")).map((e) => e.textContent?.trim()).filter(Boolean));
  console.log("TABS:", JSON.stringify(tabs));
} finally { await browser.close().catch(() => {}); }

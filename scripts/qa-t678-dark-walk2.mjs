// t678 — the dark walk, deep legs: palette-jump into a job (inspector
// faces), the project dashboard wall, and the storage dialog — the
// token-surface composites the shallow walk didn't reach. The theme
// toggle stays the driver; every stop photographs honestly.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.qa-logs";

const browser = await chromium.launch();
const ctx = await browser.newContext({
  colorScheme: "light",
  viewport: { width: 1600, height: 950 },
});
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(2200);

// flip to dark via the real toggle
await page.getByRole("button", { name: /switch to (dark|light) theme/i }).click();
await page.waitForTimeout(1200);

// A. palette-jump into the first job -> the inspector opens
await page.keyboard.press("Control+k");
await page.waitForTimeout(900);
const firstRow = page.locator("[cmdk-item]").first();
await firstRow.click();
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/t678-walk2-dark-inspector.png` });

// the inspector's Results tab (gallery faces live there)
const tabs = page.locator('[data-insp-face="tabs"] [role="tab"]');
const n = await tabs.count();
console.log("inspector tabs:", n);
for (let i = 0; i < Math.min(n, 4); i++) {
  const t = tabs.nth(i);
  const label = (await t.textContent()) || `tab${i}`;
  await t.click();
  await page.waitForTimeout(2200);
  await page.screenshot({
    path: `${OUT}/t678-walk2-dark-tab${i}-${label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24)}.png`,
  });
}

// B. the project dashboard (saved views wall) — via header tab
const dashTab = page.locator('[role="tab"][title^="Project dashboard"], [data-tab="dashboard"]').first();
if (await dashTab.count()) {
  await dashTab.click();
  await page.waitForTimeout(2200);
  await page.screenshot({ path: `${OUT}/t678-walk2-dark-dashboard.png` });
} else {
  console.log("dashboard tab not found by title");
}

await browser.close();
console.log("deep dark walk done");

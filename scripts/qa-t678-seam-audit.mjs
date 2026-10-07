// t678 — the seam audit: photograph the theme system's four corners.
// The app is light-first (footer says so); next-themes rides the system
// scheme. Hardcoded neutral chrome (267 sites) either (a) is the
// always-dark analytic aesthetic, (b) adapts fine in both schemes, or
// (c) actually breaks under one scheme (e.g. token ink on a hardcoded
// dark panel). Evidence first — the sweep's knife follows the wounds.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.qa-logs";

const browser = await chromium.launch();

async function shoot(scheme, tag, actions) {
  const ctx = await browser.newContext({
    colorScheme: scheme,
    viewport: { width: 1600, height: 950 },
  });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(2200);
  const htmlClass = await page.evaluate(() => document.documentElement.className);
  console.log(`[${tag}] html class: ${JSON.stringify(htmlClass)}`);
  await actions(page);
  await ctx.close();
}

// 1. dark dashboard — the token surface flips dark; do the hardcoded
//    light inks on token cards survive?
await shoot("dark", "dark-dashboard", async (page) => {
  await page.screenshot({ path: `${OUT}/t678-dark-dashboard.png` });
});

// 2. dark + job inspector (click the first job card on the canvas)
await shoot("dark", "dark-inspector", async (page) => {
  const card = page.locator("[data-testid^='job-card-'], .react-flow__node").first();
  if (await card.count()) {
    await card.click({ force: true });
    await page.waitForTimeout(1800);
  }
  await page.screenshot({ path: `${OUT}/t678-dark-inspector.png` });
});

// 3. dark + command palette
await shoot("dark", "dark-palette", async (page) => {
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/t678-dark-palette.png` });
});

// 4. light + job inspector — token ink on the hardcoded zinc-950 panel:
//    the suspected wound (dark ink on dark panel would be invisible).
await shoot("light", "light-inspector", async (page) => {
  const card = page.locator("[data-testid^='job-card-'], .react-flow__node").first();
  if (await card.count()) {
    await card.click({ force: true });
    await page.waitForTimeout(1800);
  }
  await page.screenshot({ path: `${OUT}/t678-light-inspector.png` });
});

// 5. light + command palette
await shoot("light", "light-palette", async (page) => {
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/t678-light-palette.png` });
});

await browser.close();
console.log("five corner photographs done");

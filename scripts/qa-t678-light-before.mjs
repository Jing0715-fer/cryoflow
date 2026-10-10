// t678 — the BEFORE evidence: the app's theme system (next-themes,
// defaultTheme=light, enableSystem) coexists with 267 hardcoded neutral
// classes; a light-system user gets token-driven light ui/ chrome riding
// on hardcoded zinc-950 workflow chrome. This script forces the LIGHT
// color scheme (what a no-dark-preference user sees on first paint) and
// photographs the seams. Not a pass/fail probe — an evidence camera.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const OUT = "/home/z/my-project/.qa-logs/t678-light-before.png";

const browser = await chromium.launch();
const ctx = await browser.newContext({
  colorScheme: "light", // the frankenstein trigger: next-themes enableSystem honors this
  viewport: { width: 1600, height: 950 },
});
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const htmlClass = await page.evaluate(() => document.documentElement.className);
console.log("html class under light scheme:", JSON.stringify(htmlClass));
await page.screenshot({ path: OUT, fullPage: false });
console.log("📸 saved:", OUT);
await browser.close();

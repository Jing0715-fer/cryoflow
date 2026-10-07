// t678 — the dark twin's trustworthiness walk. The theme toggle is a
// real user control (header, setTheme dark); the token surfaces flip
// while the image/console islands stay dark by design. This walk
// drives the ACTUAL toggle and photographs the main surfaces under
// dark, hunting for wounds: hardcoded light-assumption inks riding
// on flipped token grounds. Evidence camera, not pass/fail.
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

// flip to dark via the REAL toggle (the sun icon in the header)
const toggle = page.getByRole("button", { name: /switch to (dark|light) theme/i });
if (!(await toggle.count())) {
  console.log("FAIL: theme toggle not found in header");
  process.exit(1);
}
await toggle.click();
await page.waitForTimeout(1500);
const cls = await page.evaluate(() => document.documentElement.className);
console.log("html class after toggle:", JSON.stringify(cls));

// 1. dark canvas
await page.screenshot({ path: `${OUT}/t678-walk-dark-canvas.png` });

// 2. dark command palette
await page.keyboard.press("Control+k");
await page.waitForTimeout(1100);
await page.screenshot({ path: `${OUT}/t678-walk-dark-palette.png` });
await page.keyboard.press("Escape");
await page.waitForTimeout(600);

// 3. dark job inspector — open a job's inspector via the canvas node.
// The job card dblclick opens the inspector tab face (per t572 dance:
// Results tab lives in the inspector face). Try single click first.
const node = page.locator(".react-flow__node").first();
if (await node.count()) {
  await node.dblclick({ force: true });
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${OUT}/t678-walk-dark-inspector.png` });
} else {
  console.log("no canvas node found for inspector walk");
}

// 4. dark storage dialog (a token-surface dialog)
// skip for now — the walk's first pass is the three core surfaces.

await browser.close();
console.log("dark walk done");

import { chromium } from "playwright";
const b = await chromium.launch();
const page = await b.newPage({ colorScheme: "light", viewport: { width: 1600, height: 950 } });
await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const btns = await page.evaluate(() =>
  [...document.querySelectorAll("button[aria-label]")].map((b) => b.getAttribute("aria-label")).slice(0, 30)
);
console.log("aria buttons:", JSON.stringify(btns, null, 0));
const themeBtns = btns.filter((n) => /theme/i.test(n));
console.log("theme-ish count:", themeBtns.length);
// try the role query the probe uses
const cnt = await page.getByRole("button", { name: /switch to (dark|light) theme/i }).count();
console.log("getByRole count:", cnt);
await b.close();

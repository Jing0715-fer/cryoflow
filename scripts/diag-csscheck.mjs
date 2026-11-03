import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 844 } });
await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await new Promise(r => setTimeout(r, 2500));
const res = await page.evaluate(() => {
  let swipeRules = [], txRules = 0, sheetCount = 0;
  for (const sheet of document.styleSheets) {
    sheetCount++;
    let rules; try { rules = sheet.cssRules; } catch { continue; }
    for (const r of rules) {
      const t = r.cssText || "";
      if (t.includes("radix-toast-swipe")) swipeRules.push(t.slice(0, 200));
      if (t.includes("translate-x-")) txRules++;
    }
  }
  return { sheetCount, swipeRules: swipeRules.slice(0, 6), swipeCount: swipeRules.length, txRules };
});
console.log(JSON.stringify(res, null, 2));
await browser.close();

import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 844 } });
await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await new Promise(r => setTimeout(r, 2500));
const res = await page.evaluate(() => {
  const hits = [];
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch { continue; }
    const walk = (list, layer) => {
      for (const r of list) {
        if (r.cssRules) { walk(r.cssRules, r.name || layer); continue; }
        const sel = r.selectorText || "";
        if (sel.includes("swipe")) hits.push({ layer, sel: sel.slice(0, 300), body: (r.style?.cssText || r.cssText || "").slice(0, 300) });
      }
    };
    walk(rules, "root");
  }
  return hits;
});
console.log(JSON.stringify(res, null, 2));
await browser.close();

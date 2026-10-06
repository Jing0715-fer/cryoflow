import { chromium } from "playwright";
const b = await chromium.launch();
const page = await b.newPage();
await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(3000);
const found = await page.evaluate(() => {
  const hits = [];
  const scan = (sheet) => {
    let list;
    try { list = sheet.cssRules; } catch { return; }
    for (const r of list) {
      if (r.cssRules?.length > 0 && !r.selectorText) { scan(r); continue; }
      const sel = r.selectorText || "";
      if (/warning-(50|950)|success-700|running-400/.test(sel)) hits.push(sel.slice(0, 120));
    }
  };
  for (const s of document.styleSheets) scan(s);
  return hits;
});
console.log(found.slice(0, 40).join("\n"));
console.log("total:", found.length);
await b.close();

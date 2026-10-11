import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await new Promise(r => setTimeout(r, 1500));
await page.emulateMedia({ features: [
  { name: "hover", value: "none" },
  { name: "pointer", value: "coarse" },
] });
await new Promise(r => setTimeout(r, 300));
const res = await page.evaluate(() => ({
  hoverNone: matchMedia("(hover: none)").matches,
  pointerCoarse: matchMedia("(pointer: coarse)").matches,
}));
console.log("after emulateMedia:", JSON.stringify(res));
// find the actual close button? no toast yet — check rule ORDER in the live sheets:
const order = await page.evaluate(() => {
  const hits = [];
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch { continue; }
    const walk = (list, media) => {
      for (const r of list) {
        if (r.cssRules && r.cssRules.length && !(r.selectorText)) { walk(r.cssRules, r.media ? r.media.mediaText : media); continue; }
        const sel = r.selectorText || "";
        if (sel.includes("opacity-0") || sel.includes("hover-none") && sel.includes("opacity")) {
          hits.push({ media: media || "-", sel: sel.slice(0, 80), body: r.style?.cssText || "" });
        }
      }
    };
    walk(rules, null);
  }
  return hits.slice(0, 12);
});
console.log(JSON.stringify(order, null, 2));
await browser.close();

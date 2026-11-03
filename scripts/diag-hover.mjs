import { chromium } from "playwright";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
await new Promise(r => setTimeout(r, 2000));
const res = await page.evaluate(() => {
  const mq = (q) => window.matchMedia(q).matches;
  // find any rule mentioning hover-none's generated form
  let hoverNoneRules = 0, sample = [];
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch { continue; }
    const walk = (list) => {
      for (const r of list) {
        if (r.cssRules) { walk(r.cssRules); continue; }
        const t = r.cssText || "";
        if (t.includes("hover-none") || (r.media && /hover: *none/.test(r.media.mediaText))) {
          hoverNoneRules++;
          if (sample.length < 4) sample.push(t.slice(0, 160));
        }
      }
    };
    walk(rules);
  }
  const btnClassHint = !![...document.querySelectorAll("button")].find(b => b.className && String(b.className).includes("hover-none"));
  return {
    hoverNoneMQ: mq("(hover: none)"),
    hoverHoverMQ: mq("(hover: hover)"),
    pointerCoarse: mq("(pointer: coarse)"),
    hoverNoneRules, sample, btnClassHint,
  };
});
console.log(JSON.stringify(res, null, 2));
await browser.close();

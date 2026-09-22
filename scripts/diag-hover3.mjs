import { chromium, devices } from "playwright";
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
const page = await ctx.newPage();
await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
await new Promise(r => setTimeout(r, 2500));
const res = await page.evaluate(() => ({
  hoverNone: matchMedia("(hover: none)").matches,
  coarse: matchMedia("(pointer: coarse)").matches,
  vw: innerWidth, vh: innerHeight,
}));
console.log("iPhone 13 context:", JSON.stringify(res));
// does resize keep the modality?
await page.setViewportSize({ width: 1280, height: 844 });
await new Promise(r => setTimeout(r, 400));
const res2 = await page.evaluate(() => ({
  hoverNone: matchMedia("(hover: none)").matches,
  vw: innerWidth,
}));
console.log("after resize 1280:", JSON.stringify(res2));
await ctx.close();

// desktop default for contrast
const dpage = await browser.newPage({ viewport: { width: 1280, height: 844 } });
await dpage.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
await new Promise(r => setTimeout(r, 1500));
console.log("desktop default:", JSON.stringify(await dpage.evaluate(() => ({ hoverNone: matchMedia("(hover: none)").matches }))));
await browser.close();

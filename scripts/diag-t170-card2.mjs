import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 844 } });
await page.goto(BASE, { waitUntil: "networkidle" });
await new Promise((r) => setTimeout(r, 2500));
const out = await page.evaluate(() => {
  return [...document.querySelectorAll("[data-job]")]
    .filter((c) => { const r = c.getBoundingClientRect(); return r.width > 0 && r.x < 300; })
    .map((c) => {
      const r = c.getBoundingClientRect();
      let p = c.parentElement, pchain = [];
      while (p && pchain.length < 4) { pchain.push(p.tagName + "." + (typeof p.className === "string" ? p.className.slice(0, 40) : "")); p = p.parentElement; }
      return {
        job: c.getAttribute("data-job"),
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        cls: (typeof c.className === "string" ? c.className : "").slice(0, 70),
        text: (c.textContent || "").trim().slice(0, 30),
        parents: pchain,
      };
    });
});
console.log(JSON.stringify(out, null, 1));
await browser.close();

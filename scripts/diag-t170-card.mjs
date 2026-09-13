import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 844 } });
await page.goto(BASE, { waitUntil: "networkidle" });
await new Promise((r) => setTimeout(r, 2500));
const info = await page.evaluate(() => {
  const card = [...document.querySelectorAll("[data-job]")].find((c) => (c.textContent || "").includes("QA Post 300"));
  const r = card.getBoundingClientRect();
  const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
  const top = document.elementFromPoint(cx, cy);
  const chain = [];
  let n = top;
  while (n && chain.length < 8) {
    chain.push(n.tagName + "." + (typeof n.className === "string" ? n.className.slice(0, 60) : ""));
    n = n.parentElement;
  }
  const btn = card.querySelector('[role="button"]');
  const br = btn ? btn.getBoundingClientRect() : null;
  let topAtBtn = null;
  if (br) {
    const e = document.elementFromPoint(br.x + br.width / 2, br.y + br.height / 2);
    topAtBtn = e ? e.tagName + "." + (typeof e.className === "string" ? e.className.slice(0, 50) : "") : null;
  }
  return {
    cardRect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    center: { x: Math.round(cx), y: Math.round(cy) },
    topEl: top ? top.tagName : null,
    chain,
    btnRect: br ? { x: Math.round(br.x), y: Math.round(br.y), w: Math.round(br.width), h: Math.round(br.height) } : null,
    topAtBtn,
  };
});
console.log(JSON.stringify(info, null, 1));
await browser.close();

// t121-a13 diagnostic — why can't the Custom card be clicked open?
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.goto(BASE, { waitUntil: "domcontentloaded" });
await sleep(4500);
for (let i = 0; i < 10; i++) {
  if (await p.locator("[data-job]").first().isVisible().catch(() => false)) break;
  await sleep(1500);
}
const info = await p.evaluate(() => {
  const cards = [...document.querySelectorAll("[data-job]")].map((el) => {
    const r = el.getBoundingClientRect();
    return { text: (el.textContent || "").slice(0, 40), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  });
  const targets = cards.filter((c) => c.text.includes("t121"));
  // what's at the center of each t121 card?
  const hit = targets.map((t) => {
    const cx = t.x + t.w / 2, cy = t.y + t.h / 2;
    const el = document.elementFromPoint(cx, cy);
    const chain = [];
    let cur = el;
    for (let i = 0; i < 5 && cur; i++) { chain.push(cur.tagName + (cur.getAttribute?.("data-job") !== null && cur.getAttribute?.("data-job") !== undefined ? "[data-job]" : "") + (cur.className && typeof cur.className === "string" ? "." + cur.className.split(" ").slice(0, 2).join(".") : "")); cur = cur.parentElement; }
    return { ...t, centerX: Math.round(cx), centerY: Math.round(cy), hitTag: el?.tagName, inViewport: cx >= 0 && cx <= innerWidth && cy >= 0 && cy <= innerHeight, chain,
      occluder: el ? { ui: el.closest("[data-canvas-ui]")?.getAttribute("data-canvas-ui") ?? null, aria: el.closest("[aria-label]")?.getAttribute("aria-label") ?? null, text: (el.textContent || "").slice(0, 60) } : null };
  });
  const selTb = [...document.querySelectorAll('[data-canvas-ui="selection-toolbar"]')].map((el) => el.getBoundingClientRect().toJSON());
  return { innerW: innerWidth, innerH: innerHeight, total: cards.length, targets: hit, selTb };
});
console.log(JSON.stringify(info, null, 1));
// try one click with pointer events + report dialog state
const card = p.locator("[data-job]", { hasText: "t121 Custom" }).first();
console.log("card count:", await p.locator("[data-job]", { hasText: "t121 Custom" }).count());
try {
  const box = await card.boundingBox();
  console.log("bbox:", box);
  if (box) {
    await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await sleep(1500);
    console.log("dialog after real mouse click:", await p.locator("[data-inspector-dialog][data-state=open]").count());
  }
} catch (e) { console.log("click err:", String(e).slice(0, 200)); }
await b.close();

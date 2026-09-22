/* dissect t87 Phase A: toolbar vs minimap rects after selecting the pair */
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto(BASE, { waitUntil: "networkidle" });
await sleep(2500);

const ids = await p.evaluate(async () => {
  const jobs = await (await fetch("/api/jobs")).json();
  const list = jobs.jobs ?? jobs;
  const mc = list.filter((j) => /^motioncorr$/i.test(j.type) && j.status === "completed");
  return mc.slice(0, 2).map((j) => j.id);
});
console.log("motioncorr pair:", ids);
if (ids.length < 2) { console.log("NOT ENOUGH MOTIONCORR COMPLETED JOBS"); await browser.close(); process.exit(0); }

const pickFirst = async (id) => {
  // t87's pickFirst: pan so the card is reachable, then shift-click? Read actual:
  // simplified here: find card, shift-click it
  for (let i = 0; i < 6; i++) {
    const spot = await p.evaluate((want) => {
      const card = [...document.querySelectorAll("[data-job]")].find((el) => el.getAttribute("data-job") === want);
      if (!card) return null;
      const r = card.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2,
        inVp: r.top >= 40 && r.bottom <= innerHeight - 40 && r.left >= 290 && r.right <= innerWidth - 20 };
    }, id);
    if (spot && spot.inVp) {
      await p.mouse.move(spot.x, spot.y);
      await p.keyboard.down("Shift");
      await p.mouse.click(spot.x, spot.y);
      await p.keyboard.up("Shift");
      return;
    }
    const delta = await p.evaluate((want) => {
      const card = [...document.querySelectorAll("[data-job]")].find((el) => el.getAttribute("data-job") === want);
      if (!card) return null;
      const r = card.getBoundingClientRect();
      return { dx: innerWidth * 0.5 - (r.left + r.width / 2), dy: innerHeight * 0.45 - (r.top + r.height / 2) };
    }, id);
    if (!delta) break;
    const start = await p.evaluate(() => {
      for (const [fx, fy] of [[0.5, 0.4], [0.5, 0.6], [0.3, 0.4], [0.7, 0.4]]) {
        const sx = Math.round(innerWidth * fx), sy = Math.round(innerHeight * fy);
        const el = document.elementFromPoint(sx, sy);
        if (el && el.closest('[data-canvas="viewport"]') && !el.closest("[data-job]") && !el.closest("button")) return [sx, sy];
      }
      return null;
    });
    if (!start) break;
    await p.mouse.move(start[0], start[1]);
    await p.mouse.down();
    await p.mouse.move(start[0] + delta.dx, start[1] + delta.dy, { steps: 8 });
    await p.mouse.up();
    await sleep(800);
  }
};
await pickFirst(ids[0]);
await pickFirst(ids[1]);
await sleep(600);
const state = await p.evaluate(() => {
  const tb = document.querySelector('[data-canvas-ui="selection-toolbar"]');
  const mm = document.querySelector('[data-canvas-ui="minimap"]');
  const cmp = document.querySelector('[data-testid="toolbar-compare-params"]');
  const r = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) };
  };
  const cmpR = cmp ? cmp.getBoundingClientRect() : null;
  let intercept = null;
  if (cmpR) {
    const cx = cmpR.left + cmpR.width / 2, cy = cmpR.top + cmpR.height / 2;
    const el = document.elementFromPoint(cx, cy);
    intercept = el ? (el.tagName + "." + (typeof el.className === "string" ? el.className.split(" ").slice(0, 4).join(".") : "") + " inMM=" + !!el.closest("[data-canvas-ui=minimap]")) : "null";
  }
  return {
    toolbar: r(tb), minimap: r(mm), compare: r(cmp),
    sel: document.querySelector('[data-canvas-ui="selection-toolbar"]')?.getAttribute("aria-label") ?? "",
    intercept,
  };
});
console.log(JSON.stringify(state, null, 1));
await browser.close();

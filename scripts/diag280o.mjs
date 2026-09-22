#!/usr/bin/env node
/** diag280o.mjs — identify the tap-stealing svg at the shot spot. */
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 280, height: 653 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3,
});
const page = await context.newPage();
const jobs = await (await fetch(BASE + "/api/jobs")).json();
const list = Array.isArray(jobs) ? jobs : jobs.jobs ?? [];
const idleImport = list.find((j) => j.status === "idle" && /import/i.test(j.name));
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2500);
await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button, [role=button], [role=tab]")];
  const fit = btns.find((b) => (b.textContent || "").trim().toUpperCase() === "FIT");
  if (fit) fit.click();
});
await sleep(1500);
const vp = await page.evaluate(() => {
  const w = document.querySelector('[data-canvas="workspace"]');
  const m = new DOMMatrixReadOnly(getComputedStyle(w).transform === "none" ? "" : getComputedStyle(w).transform);
  return { x: m.e, y: m.f, z: m.a };
});
const d = await page.evaluate(({ vpx, vpy, vpz, wx, wy }) => ({
  dx: 140 - (wx * vpz + vpx), dy: 450 - (wy * vpz + vpy),
}), { vpx: vp.x, vpy: vp.y, vpz: vp.z, wx: idleImport.x ?? 0, wy: idleImport.y ?? 0 });
for (const [sx, sy] of [[140, 326], [140, 500], [60, 326], [200, 560], [60, 500]]) {
  const ok = await page.evaluate(([sx, sy]) => {
    const el = document.elementFromPoint(sx, sy);
    return !el || (!el.closest("[data-job]") && !el.closest("button"));
  }, [sx, sy]);
  if (!ok) continue;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(sx + d.dx, sy + d.dy, { steps: 8 });
  await page.mouse.up();
  await sleep(800);
  break;
}
const res = await page.evaluate((want) => {
  const c = [...document.querySelectorAll("[data-job]")].find((el) => el.getAttribute("data-job") === want);
  const r = c.getBoundingClientRect();
  const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
  const walk = [];
  let el = document.elementFromPoint(cx, cy);
  const first = el;
  while (el && walk.length < 6) {
    const cs = getComputedStyle(el);
    walk.push({ tag: el.tagName, pe: cs.pointerEvents, cls: (typeof el.className === "string" ? el.className.slice(0, 40) : el.getAttribute("data-edges-layer") != null ? "EDGE-ROOT" : ""), dataE: el.getAttribute?.("data-e") });
    el = el.parentElement;
  }
  // elementsFromPoint stack
  const stack = document.elementsFromPoint(cx, cy).slice(0, 6).map((e2) =>
    e2.tagName + (e2.getAttribute?.("data-e") ? `[${e2.getAttribute("data-e")}]` : "") + (e2.getAttribute?.("data-edges-layer") != null ? "[EDGE-ROOT]" : "") + (e2.closest("[data-job]") === c ? "(card)" : ""));
  return { center: [Math.round(cx), Math.round(cy)], firstTag: first?.tagName, firstPE: first ? getComputedStyle(first).pointerEvents : null, chain: walk, stack };
}, idleImport.id);
console.log(JSON.stringify(res, null, 1));
await browser.close();

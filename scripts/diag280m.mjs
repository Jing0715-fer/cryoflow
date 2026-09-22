#!/usr/bin/env node
/** diag280m.mjs — deterministic card placement via viewport math, then touch tap. */
import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 280, height: 653 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3,
});
const page = await context.newPage();
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE-ERR:", m.text().slice(0, 200)); });
const jobs = await (await fetch(BASE + "/api/jobs")).json();
const list = Array.isArray(jobs) ? jobs : jobs.jobs ?? [];
const compImport = list.find((j) => j.status === "completed" && /import/i.test(j.name));
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);
await page.evaluate(() => {
  window.__dlgLog = [];
  const mo = new MutationObserver(() => {
    const n = document.querySelectorAll('[role="dialog"]').length;
    const last = window.__dlgLog[window.__dlgLog.length - 1];
    if (last?.n !== n) window.__dlgLog.push({ t: performance.now() | 0, n });
  });
  mo.observe(document.body, { childList: true, subtree: true });
});
await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button, [role=button], [role=tab]")];
  const fit = btns.find((b) => (b.textContent || "").trim().toUpperCase() === "FIT");
  if (fit) fit.click();
});
await sleep(1500);
// deterministic placement: read the live viewport transform, compute the drag
const vp = await page.evaluate((want) => {
  const w = document.querySelector('[data-canvas="workspace"]');
  const m = new DOMMatrixReadOnly(getComputedStyle(w).transform === "none" ? "" : getComputedStyle(w).transform);
  const job = JSON.parse(document.querySelector("[data-job]").closest("body").dataset.none || "null"); // placeholder
  return { x: m.e, y: m.f, z: m.a };
}, compImport.id).catch(() => null);
const job = list.find((j) => j.id === compImport.id);
const target = await page.evaluate(({ vpx, vpy, vpz, wx, wy, spot }) => {
  const tx = spot === "topright" ? innerWidth - 40 : innerWidth / 2;
  const ty = spot === "topright" ? 74 : innerHeight / 2 - 60;
  const dx = tx - (wx * vpz + vpx);
  const dy = ty - (wy * vpz + vpy);
  return { dx, dy };
}, { vpx: vp.x, vpy: vp.y, vpz: vp.z, wx: job.x ?? 0, wy: job.y ?? 0, spot: process.env.SPOT || "center" });
console.log("pan delta:", JSON.stringify(target));
const sx = 140, sy = 326;
await page.mouse.move(sx, sy);
await page.mouse.down();
await page.mouse.move(sx + target.dx, sy + target.dy, { steps: 8 });
await page.mouse.up();
await sleep(900);
const check = await page.evaluate((want) => {
  const c = [...document.querySelectorAll("[data-job]")].find((el) => el.getAttribute("data-job") === want);
  const r = c?.getBoundingClientRect();
  if (!r) return null;
  const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
    hit: el ? el.tagName + "." + (typeof el.className === "string" ? el.className.slice(0, 40) : "") : "none" };
}, compImport.id);
console.log("card now at:", JSON.stringify(check));
if (check) {
  const cx = check.x + check.w / 2, cy = check.y + check.h / 2;
  await page.touchscreen.tap(cx, cy);
  let prev = 0;
  for (const ms of [40, 80, 160, 320, 640, 1600]) {
    await sleep(ms - prev); prev = ms;
    const s = await page.evaluate(() => ({
      n: document.querySelectorAll('[role="dialog"]').length,
      insp: !!document.querySelector("[data-inspector-dialog]"),
      log: window.__dlgLog,
    }));
    console.log(`t+${ms} dialogs=${s.n} inspector=${s.insp} log=${JSON.stringify(s.log)}`);
  }
}
await browser.close();

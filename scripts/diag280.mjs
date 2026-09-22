#!/usr/bin/env node
/**
 * diag280.mjs — Task 176 census: the 280px foldable inner-cover state.
 *
 * 320 (iPhone SE) has been the claimed smallest served surface since
 * Task 173; the 280px band (foldable cover displays, e.g. Galaxy Z Flip
 * cover ≈ 280–373 CSS px depending on generation) was explicitly left
 * as a Task 173 leftover. This census drives the WHOLE app at 280×653
 * in a real device context (isMobile + hasTouch, dpr 3) and reports:
 *
 *   A. global horizontal overflow per surface (canvas / dashboard /
 *      palette sheet / job sheet / inspector modal)
 *   B. element-level overflow samples (who is wider than the viewport)
 *   C. the Task 175 fit-anchor contract at 280 (first-load visible cards)
 *   D. the palette sheet's own width (w-72 = 288 > 280 is the predicted
 *      first finding — SheetContent side="left" has no <sm max-w)
 *   E. the JobPanel sheet's internals at 280 (body tabs — 309px needed
 *      at 320 per t173's M6 — the predicted second finding; dock;
 *      Expert hit; inputs; affordances)
 *   F. the toast at 280 (full-width below md: — expected fine, verify)
 *   G. the inspector modal at 280 (96vw → 268px; internal grids)
 *
 * Read-only: no mutations (export click downloads nothing harmful; the
 * toast is dismissed by the provider's own timer).
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 280, height: 653 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 3,
});
const page = await context.newPage();

const overflowCensus = () =>
  page.evaluate(() => {
    const vw = innerWidth;
    const doc = document.documentElement;
    const bad = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (r.right > vw + 1 || r.left < -1) {
        bad.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className && typeof el.className === "string"
            ? el.className.slice(0, 90)
            : ""),
          w: Math.round(r.width),
          left: Math.round(r.left),
          right: Math.round(r.right),
        });
      }
    }
    bad.sort((a, b) => Math.max(b.right - vw, -b.left) - Math.max(a.right - vw, -a.left));
    return { vw, scrollW: Math.max(doc.scrollWidth, document.body.scrollWidth), n: bad.length, top: bad.slice(0, 8) };
  });

const report = (label, c) => {
  const over = c.scrollW > c.vw + 1;
  console.log(`\n[${label}] viewport=${c.vw} scrollW=${c.scrollW} ${over ? "★ H-OVERFLOW +" + (c.scrollW - c.vw) + "px" : "no document overflow"} · off-vp elements=${c.n}`);
  for (const b of c.top) console.log(`   <${b.tag}> w=${b.w} [${b.left}..${b.right}] ${b.cls}`);
};

console.log("=== A. canvas at 280×653 ===");
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2500);

// header height + rightmost edge
const header = await page.evaluate(() => {
  const h = document.querySelector("header");
  if (!h) return null;
  const r = h.getBoundingClientRect();
  let right = 0;
  for (const b of h.querySelectorAll("button, [role=tab]")) {
    const br = b.getBoundingClientRect();
    if (br.width > 0) right = Math.max(right, br.right);
  }
  return { h: Math.round(r.height), rightmost: Math.round(right), vw: innerWidth };
});
console.log("header:", JSON.stringify(header));

await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button, [role=button], [role=tab]")];
  const fit = btns.find((b) => (b.textContent || "").trim().toUpperCase() === "FIT");
  if (fit) fit.click();
});
await sleep(1500);
report("canvas+fit", await overflowCensus());

const fitVis = await page.evaluate(() => {
  const m = 8;
  return [...document.querySelectorAll("[data-job]")].map((c) => {
    const r = c.getBoundingClientRect();
    return r.top >= m && r.left >= 0 && r.bottom <= innerHeight - m && r.right <= innerWidth;
  }).filter(Boolean).length;
});
console.log("fit-anchor: fully-visible cards after FIT =", fitVis, "(t175 contract: ≥1 on first load)");

console.log("\n=== D. palette sheet at 280 ===");
await page.click('button[aria-label="Add a job"]');
await sleep(900);
const pal = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  if (!dlg) return null;
  const r = dlg.getBoundingClientRect();
  return { w: Math.round(r.width), left: Math.round(r.left), right: Math.round(r.right), vw: innerWidth };
});
console.log("palette sheet rect:", JSON.stringify(pal), pal && pal.w > pal.vw ? "★ WIDER THAN VIEWPORT" : "fits");
report("palette-open", await overflowCensus());
await page.keyboard.press("Escape");
await sleep(700);

console.log("\n=== E. job sheet at 280 ===");
const jobs = await (await fetch(BASE + "/api/jobs")).json();
const list = Array.isArray(jobs) ? jobs : jobs.jobs ?? [];
const idleIds = new Set(list.filter((j) => j.status === "idle").map((j) => j.id));
let card = null;
for (let attempt = 0; attempt < 8 && !card; attempt++) {
  const cards = await page.evaluate(() => {
    const m = 30;
    return [...document.querySelectorAll("[data-job]")].map((c) => {
      const r = c.getBoundingClientRect();
      return { id: c.getAttribute("data-job"),
        inVp: r.top >= m && r.left >= 0 && r.bottom <= innerHeight - m && r.right <= innerWidth,
        cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
    });
  });
  card = cards.find((c) => idleIds.has(c.id || "") && c.inVp) || null;
  if (card) break;
  const px = 140 + (attempt % 3) * 30, py = 300 + (attempt % 2) * 40;
  await page.mouse.move(px, py);
  await page.mouse.down();
  await page.mouse.move(px - 130, py - (attempt % 2 ? 120 : 40), { steps: 6 });
  await page.mouse.up();
  await sleep(700);
}
console.log("idle card visible:", card ? card.id : "NONE");
if (card) {
  await page.touchscreen.tap(card.cx, card.cy);
  await sleep(1500);
  const sheet = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"][data-panel-sheet]');
    if (!dlg) return null;
    const r = dlg.getBoundingClientRect();
    const trigs = [...dlg.querySelectorAll('[role="tab"]')].filter((t) => t.getBoundingClientRect().width > 0);
    const tabRight = Math.max(...trigs.map((t) => t.getBoundingClientRect().right), 0);
    const tabLeft = Math.min(...trigs.map((t) => t.getBoundingClientRect().left), 1e9);
    const dock = dlg.querySelector('[data-canvas-ui="command-preview-panel"]');
    const expert = [...dlg.querySelectorAll("button")].find((b) => (b.textContent || "").includes("Expert options"));
    const g = dlg.querySelector("[data-swipe-grabber]");
    return {
      w: Math.round(r.width), vw: innerWidth,
      tabs: trigs.map((t) => Math.round(t.getBoundingClientRect().width)),
      tabNeeded: Math.round(tabRight - tabLeft), tabRight: Math.round(tabRight),
      dockW: dock ? Math.round(dock.getBoundingClientRect().width) : 0,
      expertH: expert ? Math.round(expert.getBoundingClientRect().height) : 0,
      grabber: !!g,
    };
  });
  console.log("sheet:", JSON.stringify(sheet));
  if (sheet && sheet.tabRight > Math.min(sheet.vw, sheet.w) + 1) {
    console.log(`   ★ BODY TABS OVERFLOW: rightmost ${sheet.tabRight} > ${Math.min(sheet.vw, sheet.w)} (needed ${sheet.tabNeeded}, t173 measured 309 at 320)`);
  }
  report("sheet-open", await overflowCensus());

  // Params tab: inputs + expert
  await page.locator('[role="dialog"] [role="tab"]', { hasText: "Params" }).first().click({ timeout: 4000 }).catch(() => {});
  await sleep(900);
  report("sheet-params", await overflowCensus());
  await page.keyboard.press("Escape");
  await sleep(700);
}

console.log("\n=== G. inspector modal at 280 ===");
const compIds = list.filter((j) => j.status === "completed").map((j) => j.id);
let ccard = null;
for (let attempt = 0; attempt < 8 && !ccard; attempt++) {
  const cards = await page.evaluate(() => {
    const m = 30;
    return [...document.querySelectorAll("[data-job]")].map((c) => {
      const r = c.getBoundingClientRect();
      return { id: c.getAttribute("data-job"),
        inVp: r.top >= m && r.left >= 0 && r.bottom <= innerHeight - m && r.right <= innerWidth,
        cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
    });
  });
  ccard = cards.find((c) => compIds.includes(c.id || "") && c.inVp) || null;
  if (ccard) break;
  const px = 140 + (attempt % 3) * 30, py = 250 + (attempt % 2) * 40;
  await page.mouse.move(px, py);
  await page.mouse.down();
  await page.mouse.move(px - 130, py - (attempt % 2 ? 120 : 40), { steps: 6 });
  await page.mouse.up();
  await sleep(700);
}
console.log("completed card visible:", ccard ? ccard.id : "NONE");
if (ccard) {
  await page.touchscreen.tap(ccard.cx, ccard.cy);
  await sleep(1800);
  const insp = await page.evaluate(() => {
    const dlg = document.querySelector('[data-inspector-dialog]');
    if (!dlg) return null;
    const r = dlg.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth };
  });
  console.log("inspector rect:", JSON.stringify(insp));
  report("inspector-open", await overflowCensus());
  await page.keyboard.press("Escape");
  await sleep(800);
}

console.log("\n=== F. toast at 280 ===");
await page.setViewportSize({ width: 900, height: 800 });
await sleep(400);
await page.click('button[aria-label="Export canvas as PNG"]');
await sleep(600);
await page.setViewportSize({ width: 280, height: 653 });
await sleep(500);
const toast = await page.evaluate(() => {
  const vp = document.querySelector('[role="region"][aria-label*="Notifications"]');
  const li = vp ? vp.querySelector("li") : null;
  if (!vp || !li) return null;
  const vr = vp.getBoundingClientRect(), lr = li.getBoundingClientRect();
  return { vw: Math.round(vr.width), lw: Math.round(lr.width), lx: Math.round(lr.left), ly: Math.round(lr.top), vh: innerHeight };
});
console.log("toast:", JSON.stringify(toast) || "none rendered");
await sleep(5200); // let the 5s toast retire

console.log("\n=== B. dashboard at 280 ===");
await page.evaluate(() => {
  const sw = [...document.querySelectorAll('[title="Project dashboard (Shift+D toggles)"]')];
  if (sw[0]) sw[0].click();
});
await sleep(1800);
report("dashboard", await overflowCensus());

await page.close();
await context.close();
await browser.close();
console.log("\nDIAG280 DONE");

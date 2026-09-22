#!/usr/bin/env node
/**
 * diag-mobile-320.mjs — exploratory: EXTREME-viewport acceptance of the
 * mobile JobPanel Sheet at 320×568 (iPhone SE class), Task 172's explicit
 * leftover ("Params tab 全控件密度在 320px 视口的极限验收").
 *
 * Method: 320×568 touch context → FIT → pan until a visible idle card →
 * tap → Sheet → measure the whole surface: document overflow, body-tab
 * bar fit, Params census (painted ∪ ::before slop), badge/meta row
 * squeeze, action-row fit, dock geometry.
 *
 * FINDINGS (Task 173 opening census, 2026-09-14):
 *   - body tabs exactly fit (Log right edge 309/320); zero doc overflow;
 *     dock full-width in-viewport; inputs at their ≥40 comfort contract.
 *   - ONE silent shortfall caught: the Expert-options trigger's RESOLVED
 *     hit height was 41px (−inset-y-2 on a 25px painted trigger) — the
 *     t172 lesson (padding-box geometry) applied to t172's own leftover.
 *     Fixed to −inset-y-2.5 (45); t173's M4 now measures resolved pixels.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 320, height: 568 },
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2500);

await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button, [role=button], [role=tab]")];
  const fit = btns.find((b) => (b.textContent || "").trim().toUpperCase() === "FIT");
  if (fit) fit.click();
});
await sleep(1500);

const jobs = await (await fetch(BASE + "/api/jobs")).json();
const list = Array.isArray(jobs) ? jobs : jobs.jobs ?? [];
const idleIds = new Set(list.filter((j) => j.status === "idle").map((j) => j.id));
console.log("world:", list.length, "jobs | idle:", idleIds.size);

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
  const px = 160 + (attempt % 3) * 30, py = 300 + (attempt % 2) * 40;
  await page.mouse.move(px, py);
  await page.mouse.down();
  await page.mouse.move(px - 180, py - (attempt % 2 ? 140 : 40), { steps: 6 });
  await page.mouse.up();
  await sleep(700);
}
if (!card) { console.log("NO VISIBLE IDLE CARD after panning — abort"); process.exit(1); }
console.log("idle card:", card.id, "at", Math.round(card.cx), Math.round(card.cy));
await page.touchscreen.tap(card.cx, card.cy);
await sleep(1500);

const sheet = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  if (!dlg) return null;
  const r = dlg.getBoundingClientRect();
  return {
    x: r.x, y: r.y, w: r.width, h: r.height,
    docOverflowX: document.documentElement.scrollWidth > innerWidth,
    scrollW: document.documentElement.scrollWidth, innerW: innerWidth, innerH: innerHeight,
  };
});
if (!sheet) { console.log("NO SHEET — abort"); process.exit(1); }
console.log("sheet:", JSON.stringify(sheet));

async function measure(label, fn) {
  const out = await page.evaluate(fn);
  console.log(`--- ${label} ---`);
  console.log(JSON.stringify(out, null, 1));
}

await measure("body tabs", () => {
  const dlg = document.querySelector('[role="dialog"]');
  const list = dlg.querySelector('[role="tablist"]');
  const triggers = [...dlg.querySelectorAll('[role="tab"]')];
  const lr = list.getBoundingClientRect();
  return {
    listW: Math.round(lr.width), listScrollW: list.scrollWidth, listClientW: list.clientWidth,
    listOverflow: list.scrollWidth > list.clientWidth + 1,
    triggers: triggers.map((t) => { const r = t.getBoundingClientRect();
      return { txt: t.textContent.trim(), x: Math.round(r.x), w: Math.round(r.width) }; }),
  };
});

await measure("affordances + census", () => {
  const dlg = document.querySelector('[role="dialog"]');
  const g = dlg.querySelector("[data-swipe-grabber]");
  const c = dlg.querySelector("[data-swipe-edge-cue]");
  const grabber = g ? { w: Math.round(g.getBoundingClientRect().width),
    h: Math.round(g.getBoundingClientRect().height),
    pe: getComputedStyle(g).pointerEvents } : null;
  const cue = c ? { w: Math.round(c.getBoundingClientRect().width),
    op: getComputedStyle(c).opacity, pe: getComputedStyle(c).pointerEvents } : null;
  const els = dlg.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [role=combobox]:not([disabled]), [role=switch], [role=tab]');
  let under44 = 0, inputsUnder40 = 0, visible = 0;
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    visible++;
    const cs = getComputedStyle(el, "::before");
    const slop = cs && cs.content && cs.content !== "none" && cs.position === "absolute";
    const effW = slop ? (parseFloat(cs.width) || r.width) : r.width;
    const effH = slop ? (parseFloat(cs.height) || r.height) : r.height;
    const isInput = el.tagName === "INPUT" || el.tagName === "SELECT";
    if (isInput) { if (effH < 39.9) inputsUnder40++; }
    else if (effW < 43.9 || effH < 43.9) {
      under44++;
      console.log(`  under44: ${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 32)}" eff ${Math.round(effW)}x${Math.round(effH)}`);
    }
  }
  return { grabber, cue, visible, under44, inputsUnder40 };
});

// Expert trigger resolved geometry (the finding that started Task 173)
await page.locator('[role="dialog"] [role="tab"]', { hasText: "Params" }).first().click({ timeout: 4000 });
await sleep(900);
await measure("expert trigger (resolved)", () => {
  const dlg = document.querySelector('[role="dialog"]');
  const trig = [...dlg.querySelectorAll("button")].find((b) => (b.textContent || "").includes("Expert options"));
  if (!trig) return null;
  const r = trig.getBoundingClientRect();
  const cs = getComputedStyle(trig, "::before");
  const slop = cs && cs.content && cs.content !== "none" && cs.position === "absolute";
  return { painted: `${Math.round(r.width)}x${Math.round(r.height)}`,
    eff: slop ? `${Math.round(parseFloat(cs.width) || r.width)}x${Math.round(parseFloat(cs.height) || r.height)}` : "no-slop" };
});

await measure("dock", () => {
  const dlg = document.querySelector('[role="dialog"]');
  const dock = dlg.querySelector('[data-canvas-ui="command-preview-panel"]');
  if (!dock) return { present: false };
  const r = dock.getBoundingClientRect();
  return { present: true, x: Math.round(r.x), w: Math.round(r.width), bottom: Math.round(r.bottom), inVp: r.bottom <= innerHeight && r.x >= 0 };
});

await page.screenshot({ path: "/home/z/my-project/.qa-logs/mobile-320-params.png" });
console.log("diag done");
await browser.close();

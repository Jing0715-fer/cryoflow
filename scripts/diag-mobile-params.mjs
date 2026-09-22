#!/usr/bin/env node
/**
 * diag-mobile-params.mjs — exploratory: touch-target census of the
 * JobPanel's Params tab inside the MOBILE Sheet (Task 171's explicit
 * leftover: t171 verified no-overflow + dock persistence, never the
 * per-control hit geometry).
 *
 * Method: 390×844 touch context → FIT → tap a visible idle card →
 * Params tab → enumerate every focusable/interactive control with its
 * painted rect + ::before slop (Task 171's CopyButton pattern) → flag
 * anything whose EFFECTIVE target (painted ∪ slop) is under 44×44.
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
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
const idleType = list.find((j) => idleIds.has(j.id))?.type;
console.log("idle target type:", idleType);

const cards = await page.evaluate(() => {
  const m = 60;
  return [...document.querySelectorAll("[data-job]")].map((c) => {
    const r = c.getBoundingClientRect();
    return { id: c.getAttribute("data-job"),
      inVp: r.top >= m && r.left >= 0 && r.bottom <= innerHeight - m && r.right <= innerWidth,
      cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
  });
});
const card = cards.find((c) => idleIds.has(c.id || "") && c.inVp);
await page.touchscreen.tap(card.cx, card.cy);
await sleep(1500);

// Params tab
await page.locator('[role="dialog"] [role="tab"]', { hasText: "Params" }).first().click({ timeout: 4000 });
await sleep(1000);

// census: every interactive control inside the sheet
const census = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  if (!dlg) return null;
  const els = dlg.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [role=combobox]:not([disabled]), [role=slider], [role=switch], [role=tab]');
  const out = [];
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue; // unmounted/hidden
    const cs = getComputedStyle(el, "::before");
    const slop = cs && cs.content && cs.content !== "none" && cs.position === "absolute";
    const sw = slop ? (parseFloat(cs.width) || r.width) : r.width;
    const sh = slop ? (parseFloat(cs.height) || r.height) : r.height;
    out.push({
      tag: el.tagName.toLowerCase(),
      kind: el.getAttribute("role") || el.type || "",
      label: (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || "").trim().slice(0, 36),
      w: Math.round(r.width), h: Math.round(r.height),
      effW: Math.round(sw), effH: Math.round(sh),
      under44: sw < 43.9 || sh < 43.9,
      visible: r.bottom > 0 && r.top < innerHeight,
    });
  }
  return out;
});

if (!census) { console.log("NO DIALOG — abort"); process.exit(1); }
const vis = census.filter((c) => c.visible);
console.log("controls visible:", vis.length, "| total:", census.length);
console.log("--- UNDER 44px effective target ---");
for (const c of vis.filter((c) => c.under44)) {
  console.log(`  ${c.tag}[${c.kind}] "${c.label}" painted ${c.w}x${c.h} eff ${c.effW}x${c.effH}`);
}
console.log("--- OK (≥44 effective) ---");
for (const c of vis.filter((c) => !c.under44).slice(0, 10)) {
  console.log(`  ${c.tag}[${c.kind}] "${c.label}" ${c.w}x${c.h}`);
}
await page.screenshot({ path: "/home/z/my-project/.qa-logs/mobile-params.png" });
await browser.close();

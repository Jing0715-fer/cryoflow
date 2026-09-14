#!/usr/bin/env node
/**
 * diag280b.mjs — Task 176 census, pass two: DIALOG-RELATIVE clipping.
 *
 * Pass one (diag280.mjs) compared elements against the VIEWPORT and the
 * 280px surfaces came back clean — but both the inspector modal and the
 * sheet carry overflow-hidden containers: content that is CLIPPED by
 * those never reaches the viewport census. At 269–280px of dialog the
 * crushed row is invisible in both senses: no scrollbar, no overflow,
 * just lost pixels. This pass measures every surface's internals
 * against ITS OWN container bounds.
 *
 * Surfaces: job-sheet Params (Expert open) + I/O on an Import Movies
 * idle job · inspector modal per internal tab on a completed Import ·
 * command palette · shortcuts dialog · dashboard KPI row · palette
 * sheet internals at 280 (post-fix rehearsal — sheet will be 280 after
 * the max-w fix, content designed for 288).
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

/* Elements clipped by or overflowing a container (dialog-relative).
   Only elements whose anchor point is inside the container vertically —
   the canvas world behind dialogs lives at its own coordinates. */
const clipCensus = (sel, label) =>
  page.evaluate(({ sel, label }) => {
    const root = document.querySelector(sel);
    if (!root) return { missing: true };
    const R = root.getBoundingClientRect();
    const bad = [];
    for (const el of root.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (r.bottom < R.top || r.top > R.bottom) continue; // outside vertically
      // clipped on the right/left by the container's own box
      if (r.right > R.right + 1 || r.left < R.left - 1) {
        bad.push({
          tag: el.tagName.toLowerCase(),
          cls: (typeof el.className === "string" ? el.className.slice(0, 80) : ""),
          w: Math.round(r.width),
          over: Math.round(Math.max(r.right - R.right, R.left - r.left)),
        });
      }
    }
    bad.sort((a, b) => b.over - a.over);
    // dedupe by tag+cls prefix
    const seen = new Set();
    const top = bad.filter((b) => {
      const k = b.tag + "|" + b.cls.slice(0, 40);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0, 6);
    return { label, rootW: Math.round(R.width), n: bad.length, top };
  }, { sel, label });

const report = (c) => {
  if (c.missing) { console.log(`[${c.label ?? "?"}] ROOT MISSING`); return; }
  console.log(`[${c.label}] root=${c.rootW}px clipped/overflow elements=${c.n}`);
  for (const b of c.top) console.log(`   over=${b.over}px <${b.tag}> ${b.cls}`);
};

const jobs = await (await fetch(BASE + "/api/jobs")).json();
const list = Array.isArray(jobs) ? jobs : jobs.jobs ?? [];
const idleImport = list.find((j) => j.status === "idle" && /import/i.test(j.name));
const compImport = list.find((j) => j.status === "completed" && /import/i.test(j.name));
console.log("idle import:", idleImport?.id, "· completed import:", compImport?.id);

await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2500);

// FIT then pan to the idle import card
await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button, [role=button], [role=tab]")];
  const fit = btns.find((b) => (b.textContent || "").trim().toUpperCase() === "FIT");
  if (fit) fit.click();
});
await sleep(1500);

async function panToCard(id) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const hit = await page.evaluate((want) => {
      const m = 30;
      const c = [...document.querySelectorAll("[data-job]")].find((el) => el.getAttribute("data-job") === want);
      if (!c) return null;
      const r = c.getBoundingClientRect();
      if (r.top >= m && r.left >= 0 && r.bottom <= innerHeight - m && r.right <= innerWidth)
        return { cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
      return null;
    }, id);
    if (hit) return hit;
    const px = 140 + (attempt % 3) * 30, py = 300 + (attempt % 2) * 40;
    await page.mouse.move(px, py);
    await page.mouse.down();
    await page.mouse.move(px - 130, py - (attempt % 2 ? 120 : 40), { steps: 6 });
    await page.mouse.up();
    await sleep(700);
  }
  return null;
}

console.log("\n=== job sheet: idle Import · Params + Expert + I/O ===");
const spot = await panToCard(idleImport.id);
console.log("card in view:", !!spot);
await page.touchscreen.tap(spot.cx, spot.cy);
await sleep(1500);
await page.locator('[role="dialog"] [role="tab"]', { hasText: "Params" }).first().click({ timeout: 4000 });
await sleep(800);
report(await clipCensus('[role="dialog"][data-panel-sheet]', "sheet-params"));
const paramsMeta = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"][data-panel-sheet]');
  const expert = [...dlg.querySelectorAll("button")].find((b) => (b.textContent || "").includes("Expert options"));
  if (expert) expert.click();
  const inputs = [...dlg.querySelectorAll("input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden]), select")]
    .filter((el) => el.getBoundingClientRect().width > 0)
    .map((el) => Math.round(el.getBoundingClientRect().height));
  return { expert: !!expert, inputH: inputs.length ? Math.min(...inputs) : null, n: inputs.length };
});
console.log("params meta:", JSON.stringify(paramsMeta));
await sleep(600);
report(await clipCensus('[role="dialog"][data-panel-sheet]', "sheet-params-expert-open"));
await page.locator('[role="dialog"] [role="tab"]', { hasText: "I/O" }).first().click({ timeout: 4000 });
await sleep(700);
report(await clipCensus('[role="dialog"][data-panel-sheet]', "sheet-io"));
await page.keyboard.press("Escape");
await sleep(700);

console.log("\n=== inspector modal: completed Import, per internal tab ===");
const spot2 = await panToCard(compImport.id);
console.log("card in view:", !!spot2);
await page.touchscreen.tap(spot2.cx, spot2.cy);
await sleep(1800);
const inspTabs = await page.evaluate(() => {
  const dlg = document.querySelector('[data-inspector-dialog]');
  if (!dlg) return [];
  return [...dlg.querySelectorAll('[role="tab"]')].filter((t) => t.getBoundingClientRect().width > 0)
    .map((t) => (t.textContent || "").trim());
});
console.log("inspector tabs:", inspTabs.join(", "));
for (const tab of inspTabs) {
  await page.evaluate((name) => {
    const dlg = document.querySelector('[data-inspector-dialog]');
    const t = [...dlg.querySelectorAll('[role="tab"]')].find((x) => (x.textContent || "").trim() === name);
    if (t) t.click();
  }, tab);
  await sleep(1200);
  report(await clipCensus('[data-inspector-dialog]', `inspector:${tab}`));
}
await page.keyboard.press("Escape");
await sleep(800);

console.log("\n=== command palette at 280 ===");
await page.keyboard.press("ControlOrMeta+k");
await sleep(900);
report(await clipCensus('[role="dialog"]', "cmdk"));
await page.keyboard.press("Escape");
await sleep(600);

console.log("\n=== shortcuts dialog at 280 ===");
{
  const opened = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      /shortcuts/i.test(b.getAttribute("aria-label") || "") || /shortcuts/i.test(b.title || ""));
    if (btn) { btn.click(); return true; }
    return false;
  });
  console.log("shortcuts trigger:", opened);
  await sleep(900);
  report(await clipCensus('[role="dialog"]', "shortcuts"));
  await page.keyboard.press("Escape");
  await sleep(600);
}

console.log("\n=== dashboard KPI row at 280 ===");
await page.evaluate(() => {
  const sw = [...document.querySelectorAll('[title="Project dashboard (Shift+D toggles)"]')];
  if (sw[0]) sw[0].click();
});
await sleep(1800);
const kpi = await page.evaluate(() => {
  const cards = [...document.querySelectorAll("main [class*='rounded'], main article")].filter((c) => {
    const r = c.getBoundingClientRect();
    return r.width > 80 && r.width < 280 && r.height > 60;
  }).slice(0, 12).map((c) => Math.round(c.getBoundingClientRect().width));
  return cards;
});
console.log("dashboard card widths sample:", kpi.join(","));

await page.close();
await context.close();
await browser.close();
console.log("\nDIAG280B DONE");

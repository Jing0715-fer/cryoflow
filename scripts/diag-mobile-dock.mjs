#!/usr/bin/env node
/**
 * diag-mobile-dock.mjs — exploratory: the Task-170 JobPanel command dock
 * in the MOBILE Sheet form (page.tsx panelSheetOpen, SheetContent
 * w-full sm:max-w-md). Task 170 shipped the dock panel-wide but never
 * individually accepted the Sheet shape — this diag looks before pinning.
 *
 * Checks (observational, not yet the contract):
 *   D1  card tap opens the Sheet (role=dialog) below xl
 *   D2  dock renders INSIDE the sheet dialog
 *   D3  dock visible: not clipped, copy button inside viewport
 *   D4  long argv wraps — no horizontal document overflow
 *   D5  copy from the sheet hands over the shown text
 *   D6  console clean
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  permissions: ["clipboard-read", "clipboard-write"],
});
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));

await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2500);

// pick an idle job (idle cards land in the panel, not the inspector)
const jobs = await page.evaluate(async () => {
  const r = await fetch("/api/jobs");
  const d = await r.json();
  const list = Array.isArray(d) ? d : d.jobs ?? [];
  return list.map((j) => ({ id: j.id, name: j.name, type: j.type, status: j.status }));
});
console.log("jobs:", jobs.length);
const idle = jobs.find((j) => j.status === "idle");
if (!idle) { console.log("NO IDLE JOB — abort"); process.exit(1); }
console.log("idle target:", idle.name, idle.type);

// fit all nodes into view first (minimap FIT) so the idle card is on-screen
const fitTried = await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button, [role=button], [role=tab]")];
  const fit = btns.find((b) => (b.textContent || "").trim().toUpperCase() === "FIT");
  if (fit) { fit.click(); return true; }
  return false;
});
console.log("FIT pressed:", fitTried);
await sleep(1500);

// pick ANY idle card that is fully inside the viewport (world has ~8 idle)
const idleIds = new Set(jobs.filter((j) => j.status === "idle").map((j) => j.id));
console.log("idle jobs:", idleIds.size);
const target = await page.evaluate(() => {
  const cards = [...document.querySelectorAll("[data-job]")];
  return cards.map((c) => {
    const r = c.getBoundingClientRect();
    return { id: c.getAttribute("data-job"),
      inVp: r.top >= 60 && r.left >= 0 && r.bottom <= innerHeight - 70 && r.right <= innerWidth && r.width > 0,
      cx: r.x + r.width / 2, cy: r.y + r.height / 2, w: r.width, h: r.height,
      text: (c.textContent || "").slice(0, 30) };
  });
});
const vis = target.find((c) => idleIds.has(c.id || "") && c.inVp);
console.log("visible idle card:", !!vis, "| total cards:", target.length,
  "| in-vp cards:", target.filter((c) => c.inVp).length);
if (!vis) {
  console.log("no idle card in viewport after FIT — off-screen ids:",
    JSON.stringify(target.filter((c) => idleIds.has(c.id || "")).map((c) => ({ id: c.id, cx: Math.round(c.cx) }))));
  console.log("NO VISIBLE IDLE CARD EVEN AFTER FIT — abort");
  process.exit(1);
}
console.log("tapping idle card at", Math.round(vis.cx), Math.round(vis.cy), JSON.stringify(vis.text));

// real touch tap (hasTouch context) — pointer events drive the card handler
await page.touchscreen.tap(vis.cx, vis.cy);
await sleep(1500);

// D1 tap the card
let tapped = true;
const dialogOpen = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  return dlg ? { open: true, hasPanel: !!dlg.querySelector("[data-job], form, [role=tablist]"),
    text: (dlg.textContent || "").slice(0, 120) } : { open: false };
});
console.log("D1 sheet open:", JSON.stringify(dialogOpen));

// D2 dock inside the dialog
const dock = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  if (!dlg) return { inDialog: false, exists: false };
  const d = dlg.querySelector('[data-canvas-ui="command-preview-panel"]');
  return { inDialog: !!d, exists: !!document.querySelector('[data-canvas-ui="command-preview-panel"]') };
});
console.log("D2 dock:", JSON.stringify(dock));

// D3 visibility + geometry — SCOPED to the sheet dialog (the document also
// carries the hidden desktop-aside instance whose rects are all zero)
const geom = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  const d = dlg?.querySelector('[data-canvas-ui="command-preview-panel"]');
  if (!d) return null;
  const r = d.getBoundingClientRect();
  const btn = d.querySelector("button");
  const br = btn ? btn.getBoundingClientRect() : null;
  return {
    rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    inViewport: r.bottom <= innerHeight && r.right <= innerWidth && r.top >= 0 && r.height > 0,
    btnRect: br ? { w: Math.round(br.width), h: Math.round(br.height), inVp: br.bottom <= innerHeight && br.right <= innerWidth && br.width > 0 } : null,
    docOverflow: document.scrollingElement.scrollWidth > document.scrollingElement.clientWidth,
  };
});
console.log("D3 geometry:", JSON.stringify(geom));

// D4 preview text wrap behavior — scoped to dialog
const wrap = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  const t = dlg?.querySelector('[data-canvas-ui="command-preview-text"]');
  if (!t) return null;
  const cs = getComputedStyle(t);
  const pre = t.closest('[data-canvas-ui="command-preview"]');
  const pr = pre ? pre.getBoundingClientRect() : null;
  const scrollableX = t.scrollWidth > t.clientWidth + 1;
  return { whiteSpace: cs.whiteSpace, wordBreak: cs.wordBreak,
    preW: pr ? Math.round(pr.width) : null, scrollW: t.scrollWidth, clientW: t.clientWidth,
    scrollableX, textLen: (t.textContent || "").length };
});
console.log("D4 wrap:", JSON.stringify(wrap));

// D5 copy from the sheet
if (geom && geom.btnRect) {
  const btn = page.locator('[role="dialog"] [data-canvas-ui="command-preview-panel"] [data-canvas-ui="command-preview"] button').first();
  try {
    await btn.click({ timeout: 3000 });
    await sleep(600);
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    const shown = await page.evaluate(() =>
      document.querySelector('[role="dialog"] [data-canvas-ui="command-preview-text"]')?.textContent || "");
    console.log("D5 copy:", JSON.stringify({ clipLen: clip.length, shownLen: shown.length, equal: clip === shown, head: clip.slice(0, 60) }));
  } catch (e) { console.log("D5 copy FAILED:", String(e).slice(0, 200)); }
}

// D6 console
console.log("D6 console errors:", consoleErrors.length, consoleErrors.slice(0, 3));

// screenshot for the record
await page.screenshot({ path: "/home/z/my-project/.qa-logs/mobile-dock-sheet.png", fullPage: false });
console.log("screenshot: .qa-logs/mobile-dock-sheet.png");

await browser.close();

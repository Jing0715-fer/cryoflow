#!/usr/bin/env node
/**
 * t172-e2e.mjs — Task 172: the touch-target census and the finger exit.
 *
 * Task 171 accepted the Sheet form but its census stopped at the dock;
 * this round's own census (diag-mobile-params) measured 17 of 18 visible
 * Params-tab controls under the 44px touch convention — tabs at 24px
 * tall, action-row icons at 32×32, the Sheet's own X at SIXTEEN. The
 * fixes ship at three layers, and the probe pins each layer where it
 * lives:
 *
 *   component layer  — TabsTrigger grows a VERTICAL-only hit-slop
 *                      (horizontal would overlap the flush neighbor tab);
 *                      ui/sheet.tsx's built-in Close grows −inset-3.5
 *                      (16 → 44, the app's smallest target and its
 *                      primary exit affordance); the panel's size-8 icon
 *                      buttons and the Expert-options trigger grow slops.
 *   scope layer      — globals.css bumps input min-heights ONLY under
 *                      [data-panel-sheet]: the desktop aside keeps its
 *                      exact metrics (asserted live in D).
 *   gesture layer    — SwipeSheetContent: horizontal-intent gate, DOM
 *                      transform written via ref (no re-render per move),
 *                      dismiss past 28% width or a fast flick, spring
 *                      back otherwise, exit animation flying out from
 *                      under the pointer (Radix implicit-from).
 *
 * Phases: S baseline / X source oracles / M mobile live (slop geometry,
 * scoped comfort, swipe dismiss + spring-back + dock persistence) /
 * D desktop sanity (aside unchanged, inputs NOT bumped — the scope
 * contract) / Z roster identity.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const ROOT = "/home/z/my-project";

let passed = 0;
const failures = [];
function must(cond, label) {
  if (cond) {
    passed += 1;
    console.log("  ok:", label);
  } else {
    failures.push(label);
    console.log("  FAIL:", label);
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const src = (p) => readFileSync(join(ROOT, p), "utf8");
const has = (haystack, needle) => haystack.includes(needle);

async function apiJobs() {
  const r = await fetch(`${BASE}/api/jobs`);
  const d = await r.json();
  return Array.isArray(d) ? d : d.jobs ?? [];
}

/* ================================================================== */
/* S — baseline + targets                                              */
/* ================================================================== */
console.log("== S: baseline + targets ==");
const jobs0 = await apiJobs();
must(jobs0.length > 0, "S world non-empty");
const baseline = jobs0.map((j) => `${j.id}:${j.name}`).sort().join("|");
const idleJobs = jobs0.filter((j) => j.status === "idle");
must(idleJobs.length > 0, "S at least one idle job (panel target)");

/* ================================================================== */
/* X — source oracles                                                  */
/* ================================================================== */
console.log("== X: source oracles ==");
const tabsSrc = src("src/components/ui/tabs.tsx");
must(has(tabsSrc, "before:inset-x-0") && has(tabsSrc, "before:-inset-y-3") && has(tabsSrc, "relative"),
  "X1 TabsTrigger carries the VERTICAL-only slop (inset-x-0 + -inset-y-3)");
must(has(tabsSrc, "horizontal slop would overlap"),
  "X2 the why rides beside the code (neighbor-tab overlap note)");

const sheetSrc = src("src/components/ui/sheet.tsx");
must(has(sheetSrc, "before:-inset-3.5"),
  "X3 the sheet's built-in Close carries -inset-3.5 (16→44)");

const panelSrc = src("src/components/workflow/job-panel.tsx");
const slopCount = (panelSrc.match(/before:-inset-1\.5/g) || []).length;
must(slopCount >= 4,
  `X4 panel icon buttons carry hit-slop (got ${slopCount} × before:-inset-1.5, need ≥4)`);
must(has(panelSrc, "before:-inset-y-2"),
  "X5 Expert-options trigger carries the vertical slop");

const sbatchSrc = src("src/components/workflow/hpc-sbatch-dialog.tsx");
must(has(sbatchSrc, "before:-inset-1.5"),
  "X6 HpcSbatchDialog compact trigger carries hit-slop");

const swipeSrc = src("src/components/workflow/swipe-sheet-content.tsx");
must(has(swipeSrc, "dx > 14") && has(swipeSrc, "Math.abs(dx) > Math.abs(dy) * 1.35"),
  "X7 the intent gate: horizontal intent only (dx>14 ∧ |dx|>1.35·|dy|)");
must(has(swipeSrc, "w * 0.28") && has(swipeSrc, "g.v > 0.55"),
  "X8 the dismiss contract: 28% of width OR a fast flick");
must(has(swipeSrc, 'closest("input, textarea, select'),
  "X9 form fields never start the gesture");
must(has(swipeSrc, "setPointerCapture") && has(swipeSrc, 'style.transform'),
  "X10 the drag writes the DOM directly (capture + inline transform, no per-move render)");

const cssSrc = src("src/app/globals.css");
must(has(cssSrc, '[data-panel-sheet] input:not([type="checkbox"])') && has(cssSrc, "min-height: 2.5rem"),
  "X11 the comfort block is scoped to [data-panel-sheet] (exclusion-form selector, min-height)");

const pageSrc = src("src/app/page.tsx");
must(has(pageSrc, "SwipeSheetContent") && !has(pageSrc.split("panelSheetOpen")[1] || "", "FAILMARK"),
  "X12 the panel Sheet mounts SwipeSheetContent");
must(has(pageSrc, 'onDismiss={() => select(null)}'),
  "X13 dismissal routes to select(null) — the one truth for closing");

/* ================================================================== */
/* M — mobile live: slop geometry, comfort, the finger exit            */
/* ================================================================== */
console.log("== M: mobile 390×844 touch ==");
const browser = await chromium.launch();
const mCtx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  permissions: ["clipboard-read", "clipboard-write"],
});
const page = await mCtx.newPage();
const consoleErrors = [];
const failedUrls = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
page.on("pageerror", (e) => consoleErrors.push(String(e)));
page.on("response", (r) => { if (r.status() >= 400) failedUrls.push(`${r.status()} ${r.url()}`); });

await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2500);
await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button, [role=button], [role=tab]")];
  const fit = btns.find((b) => (b.textContent || "").trim().toUpperCase() === "FIT");
  if (fit) fit.click();
});
await sleep(1500);

const idleIds = new Set(idleJobs.map((j) => j.id));
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
must(!!card, "M0 an idle card is tappable in-viewport after FIT");
await page.touchscreen.tap(card.cx, card.cy);
await sleep(1500);

const sheetOpen = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  return { open: !!dlg,
    panelSheet: !!document.querySelector('[data-panel-sheet][role="dialog"], [role="dialog"][data-panel-sheet]') };
});
must(sheetOpen.open, "M1 idle tap opens the Sheet");
must(sheetOpen.panelSheet, "M1b the sheet carries data-panel-sheet (comfort scope live)");

// M2 — slop geometry, live: every slopped layer reads ≥44 effective
const slop = await page.evaluate(() => {
  function eff(el, label) {
    if (!el) return { label, missing: true };
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el, "::before");
    const sw = parseFloat(cs.width) || 0;
    const sh = parseFloat(cs.height) || 0;
    return { label, w: Math.round(r.width), h: Math.round(r.height),
      effW: Math.round(Math.max(r.width, sw)), effH: Math.round(Math.max(r.height, sh)) };
  }
  const dlg = document.querySelector('[role="dialog"]');
  const q = (sel) => dlg?.querySelector(sel);
  return {
    mainTab: eff(q('[role="tablist"] [role="tab"]'), "main tab"),
    actionBtn: eff([...(dlg?.querySelectorAll("button") || [])]
      .find((b) => (b.getAttribute("aria-label") || "").includes("Reset")), "reset icon"),
    sheetX: eff([...(dlg?.querySelectorAll("button") || [])]
      .find((b) => (b.textContent || "").trim() === "Close"), "sheet X"),
    sbatch: eff([...(dlg?.querySelectorAll("button") || [])]
      .find((b) => (b.getAttribute("aria-label") || "").includes("sbatch")), "sbatch icon"),
  };
});
must(slop.mainTab && !slop.mainTab.missing && slop.mainTab.effH >= 44,
  `M2 main tab effective height ≥44 (painted ${slop.mainTab?.h}, eff ${slop.mainTab?.effH})`);
must(slop.actionBtn && !slop.actionBtn.missing && slop.actionBtn.effW >= 44 && slop.actionBtn.effH >= 44,
  `M3 action-row icon ≥44×44 (painted ${slop.actionBtn?.w}×${slop.actionBtn?.h})`);
must(slop.sheetX && !slop.sheetX.missing && slop.sheetX.effW >= 44 && slop.sheetX.effH >= 44,
  `M4 sheet X ≥44×44 (painted ${slop.sheetX?.w}×${slop.sheetX?.h})`);
must(slop.sbatch && !slop.sbatch.missing && slop.sbatch.effW >= 44 && slop.sbatch.effH >= 44,
  `M5 sbatch icon ≥44×44 (painted ${slop.sbatch?.w}×${slop.sbatch?.h})`);

// M6 — Params tab: scoped comfort + dock persistence on this tab too
await page.locator('[role="dialog"] [role="tab"]', { hasText: "Params" }).first().click({ timeout: 4000 });
await sleep(900);
const comfort = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  const name = dlg?.querySelector('input[aria-label="Job name"]');
  const nums = [...(dlg?.querySelectorAll('input[type="number"]') || [])];
  const dock = dlg?.querySelector('[data-canvas-ui="command-preview-panel"]');
  return { nameH: name ? Math.round(name.getBoundingClientRect().height) : null,
    numH: nums.length ? Math.round(nums[0].getBoundingClientRect().height) : null,
    numCount: nums.length, dockOnParams: !!dock };
});
must(comfort.nameH != null && comfort.nameH >= 40,
  `M6 name input ≥40px in the sheet (got ${comfort.nameH})`);
must(comfort.numCount === 0 || comfort.numH >= 40,
  `M7 number inputs ≥40px in the sheet (got ${comfort.numH} over ${comfort.numCount})`);
must(comfort.dockOnParams, "M8 dock persists on Params (panel-wide contract, again)");

// M9 — the finger exit: a drag past 28% dismisses, flying from the finger
const sheetRect = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  const r = dlg.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
const startY = Math.min(sheetRect.y + sheetRect.h / 2, 600);
await page.mouse.move(sheetRect.x + 120, startY);
await page.mouse.down();
await page.mouse.move(sheetRect.x + 190, startY, { steps: 6 });
await page.mouse.move(sheetRect.x + 330, startY, { steps: 10 });
await page.mouse.up();
await sleep(900);
const dismissed = await page.evaluate(() => !document.querySelector('[role="dialog"][data-panel-sheet]'));
must(dismissed, "M9 drag past 28% dismisses the sheet (finger exit alive)");
must((await page.evaluate(() => document.querySelectorAll('[role="dialog"]').length)) === 0,
  "M10 no dialog remains after the swipe");

// M11 — spring-back: reopen, drag 40px slowly, release → still open
await page.touchscreen.tap(card.cx, card.cy);
await sleep(1400);
const reopened = await page.evaluate(() => !!document.querySelector('[role="dialog"][data-panel-sheet]'));
must(reopened, "M11a the sheet reopens (idle tap again)");
const sheetRect2 = await page.evaluate(() => {
  const r = document.querySelector('[role="dialog"]').getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
await page.mouse.move(sheetRect2.x + 120, 500);
await page.mouse.down();
await page.mouse.move(sheetRect2.x + 160, 500, { steps: 8 });
await sleep(120);
await page.mouse.move(sheetRect2.x + 162, 500, { steps: 2 });
await page.mouse.up();
await sleep(700);
const stillOpen = await page.evaluate(() => !!document.querySelector('[role="dialog"][data-panel-sheet]'));
must(stillOpen, "M11 a short slow drag springs back (sheet stays)");

// M12 — dock persisted through the gesture round-trip; roster cleanup next
const dockAfter = await page.evaluate(() =>
  !!document.querySelector('[role="dialog"] [data-canvas-ui="command-preview-panel"]'));
must(dockAfter, "M12 dock alive after the spring-back (no gesture side effects)");

// M13 — contract-aware console hygiene (the /log 404 pair from t171)
const log404 = failedUrls.some((u) => u.startsWith("404") && /\/api\/jobs\/[^/]+\/log/.test(u));
const realErrors = consoleErrors.filter((e) =>
  !(log404 && /Failed to load resource/.test(e)));
must(realErrors.length === 0,
  `M13 zero non-contractual console errors (got ${realErrors.length}${log404 ? ", /log 404 contractual" : ""})`);
if (realErrors.length > 0) for (const e of realErrors) console.log("    console-error:", e.slice(0, 200));
await mCtx.close();

/* ================================================================== */
/* D — desktop sanity: the scope contract's other axis                 */
/* ================================================================== */
console.log("== D: desktop 1280×800 sanity ==");
const dCtx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
});
const dPage = await dCtx.newPage();
const dErrors = [];
dPage.on("console", (m) => { if (m.type() === "error") dErrors.push(m.text()); });
dPage.on("pageerror", (e) => dErrors.push(String(e)));
await dPage.goto(BASE, { waitUntil: "networkidle" });
await sleep(2500);
await dPage.evaluate(() => {
  const btns = [...document.querySelectorAll("button, [role=button], [role=tab]")];
  const fit = btns.find((b) => (b.textContent || "").trim().toUpperCase() === "FIT");
  if (fit) fit.click();
});
await sleep(1500);
const dCards = await dPage.evaluate(() => {
  const m = 60, rail = 300;
  return [...document.querySelectorAll("[data-job]")].map((c) => {
    const r = c.getBoundingClientRect();
    return { id: c.getAttribute("data-job"),
      inVp: r.top >= m && r.left >= rail && r.bottom <= innerHeight - m && r.right <= innerWidth,
      cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
  });
});
const dIdle = dCards.find((c) => idleIds.has(c.id || "") && c.inVp);
must(!!dIdle, "D0 an idle card is clickable clear of the left rail");
await dPage.mouse.click(dIdle.cx, dIdle.cy);
await sleep(1400);
const dState = await dPage.evaluate(() => {
  const aside = [...document.querySelectorAll("aside")]
    .find((a) => a.querySelector('[data-canvas-ui="command-preview-panel"]'));
  const name = aside?.querySelector('input[aria-label="Job name"]');
  return { dialog: !!document.querySelector('[role="dialog"]'),
    aside: !!aside,
    nameH: name ? Math.round(name.getBoundingClientRect().height) : null,
    panelSheet: !!document.querySelector("[data-panel-sheet]") };
});
must(!dState.dialog && dState.aside,
  "D1 desktop idle click opens the ASIDE (no sheet exists there)");
must(dState.nameH != null && dState.nameH < 40,
  `D2 desktop input keeps its desktop metrics (name height ${dState.nameH} < 40 — scope held)`);
must(!dState.panelSheet,
  "D3 data-panel-sheet exists nowhere on desktop");
must(dErrors.length === 0, `D4 zero console errors on desktop (got ${dErrors.length})`);
await dCtx.close();
await browser.close();

/* ================================================================== */
/* Z — roster identity                                                 */
/* ================================================================== */
console.log("== Z: roster identity ==");
const jobs1 = await apiJobs();
const after = jobs1.map((j) => `${j.id}:${j.name}`).sort().join("|");
must(after === baseline, "Z roster identical to baseline (gestures litter nothing)");

console.log(`\nT172 ${failures.length === 0 ? "ALL PASS" : "FAILED"} (${passed} assertions)`);
if (failures.length > 0) {
  console.log("failures:");
  for (const f of failures) console.log("  -", f);
  process.exit(1);
}

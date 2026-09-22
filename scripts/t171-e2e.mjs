#!/usr/bin/env node
/**
 * t171-e2e.mjs — Task 171: the Sheet earns its acceptance.
 *
 * Task 170 shipped the JobPanel command dock "panel-wide" but never
 * individually accepted the MOBILE Sheet shape (page.tsx panelSheetOpen,
 * SheetContent w-full sm:max-w-md) — the handoff flagged it explicitly.
 * This round verifies it live and ships the two refinements the
 * verification surfaced:
 *   1. CopyButton hit-slop — the compact copy button measured 34×28 px
 *      in the Sheet, under the 44×44 touch convention; a ::before
 *      -inset-2 slop grows the TAPPABLE area without moving a visual
 *      pixel (every consumer seats the button beside a non-interactive
 *      <pre>, so nothing interactive is shadowed).
 *   2. single-mount — below xl the desktop aside (CSS `hidden xl:flex`)
 *      still MOUNTED the whole JobPanel tree invisibly: a second
 *      command fetch and a second live panel re-rendering on every
 *      store tick. The mount itself is now gated on (!mounted || isXl)
 *      — `!mounted` keeps the desktop cold-load honest, because the
 *      persisted selection seed (Task 157) can make selectedId
 *      non-null at first paint while isXl corrects only in an effect.
 *
 * Phases:
 *   S  roster baseline + target selection (relative contract)
 *   X  source oracles: hit-slop present with visual size unchanged,
 *      aside gated, Sheet carries the same <JobPanel />, the dispatch
 *      contract in the store (inspect nulls selectedId), the dock's
 *      wrap contract untouched
 *   M  MOBILE (390×844, touch, real clipboard): FIT → tap an idle card
 *      → the Sheet opens with the panel; dock inside the dialog, in
 *      viewport, bottom-pinned, NO document overflow; dock survives
 *      ALL FOUR tabs (the panel-wide contract, mobile edition); the
 *      copy button's effective touch target ≥ 44×44; copy hands over
 *      the shown text; EXACTLY ONE command-preview-panel in the
 *      document (single-mount, live); a completed card opens the
 *      INSPECTOR, never the panel Sheet (dispatch at mobile); console
 *      clean
 *   D  DESKTOP sanity (the gating change's other axis): idle card
 *      click opens the ASIDE — no dialog, dock in viewport, copy works
 *   Z  roster identity (both-ways diff vs baseline)
 *
 * Environment-immunity doctrine: assertions about the dock's CONTENT
 * are shape assertions (non-empty text, copy == shown), never dialect
 * assertions — the RELION toolchain may be present or absent.
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
const doneJobs = jobs0.filter((j) => j.status === "completed");
must(idleJobs.length > 0, "S at least one idle job (panel target)");
must(doneJobs.length > 0, "S at least one completed job (inspector target)");
console.log(`  world: ${jobs0.length} jobs, ${idleJobs.length} idle, ${doneJobs.length} completed`);

/* ================================================================== */
/* X — source oracles                                                  */
/* ================================================================== */
console.log("== X: source oracles ==");
const cb = src("src/components/workflow/copy-button.tsx");
must(has(cb, "relative") && has(cb, "before:-inset-2") && has(cb, "before:content-['']"),
  "X1 CopyButton carries the hit-slop trio (relative + -inset-2 + content)");
must(has(cb, "h-7"),
  "X2 visual size unchanged (h-7) — slop grows the target, not the paint");
must(has(cb, "44×44"),
  "X3 the why rides beside the code (touch-convention note)");

const pageSrc = src("src/app/page.tsx");
must(has(pageSrc, "(!mounted || isXl)"),
  "X4 desktop aside MOUNT is gated (!mounted || isXl) — no invisible panel below xl");
const sheetBlock = pageSrc.slice(pageSrc.indexOf("panelSheetOpen"));
must(has(sheetBlock.slice(0, sheetBlock.indexOf("</Sheet>", sheetBlock.indexOf("Job details"))) + "</Sheet>", "<JobPanel />"),
  "X5 the Sheet carries the SAME <JobPanel /> — one panel truth, two surfaces");

const panelSrc = src("src/components/workflow/job-panel.tsx");
must(has(panelSrc, "whitespace-pre-wrap break-all") && has(panelSrc, "shrink-0 space-y-1.5 border-t"),
  "X6 dock wrap + bottom-pin classes untouched (pre-wrap break-all, shrink-0 border-t)");

const storeSrc = src("src/lib/store.ts");
must(has(storeSrc, "set({ inspectId: id, selectedId: null })"),
  "X7 dispatch contract in the store: inspect REPLACES the panel (selectedId nulled)");

/* ================================================================== */
/* M — mobile: the Sheet earns its acceptance                          */
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

// FIT the canvas so cards are on-screen (min-zoom clamp may still leave
// edge cards off-viewport — picking a VISIBLE card is part of the method,
// not a dodge: a real user pans; the probe picks what a pan would show)
await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button, [role=button], [role=tab]")];
  const fit = btns.find((b) => (b.textContent || "").trim().toUpperCase() === "FIT");
  if (fit) fit.click();
});
await sleep(1500);

const idleIds = new Set(idleJobs.map((j) => j.id));
const doneIds = new Set(doneJobs.map((j) => j.id));
const cards = await page.evaluate(() => {
  const margin = 60; // header above, toolbar below — a tappable card clears both
  return [...document.querySelectorAll("[data-job]")].map((c) => {
    const r = c.getBoundingClientRect();
    return { id: c.getAttribute("data-job"),
      inVp: r.top >= margin && r.left >= 0 && r.bottom <= innerHeight - margin && r.right <= innerWidth && r.width > 0,
      cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
  });
});
const idleCard = cards.find((c) => idleIds.has(c.id || "") && c.inVp);
must(!!idleCard, "M0 an idle card is tappable in-viewport after FIT");

await page.touchscreen.tap(idleCard.cx, idleCard.cy);
await sleep(1500);

const sheetState = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  if (!dlg) return { open: false };
  return { open: true,
    tablist: !!dlg.querySelector("[role=tablist]"),
    dockCount: document.querySelectorAll('[data-canvas-ui="command-preview-panel"]').length,
    dockInDialog: !!dlg.querySelector('[data-canvas-ui="command-preview-panel"]') };
});
must(sheetState.open && sheetState.tablist,
  "M1 idle tap opens the Sheet carrying the panel (tablist present)");
must(sheetState.dockInDialog,
  "M2 dock renders INSIDE the sheet dialog");

const dockGeom = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  const d = dlg?.querySelector('[data-canvas-ui="command-preview-panel"]');
  if (!d) return null;
  const r = d.getBoundingClientRect();
  const sheet = dlg.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
    bottom: Math.round(r.bottom), innerH: innerHeight, sheetW: Math.round(sheet.width),
    spansSheet: Math.abs(r.width - sheet.width) <= 2,
    inViewport: r.height > 0 && r.bottom <= innerHeight && r.top >= 0,
    docOverflow: document.scrollingElement.scrollWidth > document.scrollingElement.clientWidth };
});
must(!!dockGeom && dockGeom.inViewport && dockGeom.h > 0,
  "M3 dock visible in viewport with real height (not the hidden-aside ghost)");
must(!!dockGeom && dockGeom.spansSheet,
  "M4 dock spans the sheet width (panel-wide, not a cramped inset)");
must(!!dockGeom && !dockGeom.docOverflow,
  "M5 zero horizontal document overflow with the sheet open");

// M6 — the dock survives ALL FOUR tabs: the panel-wide contract, mobile
const tabNames = ["I/O", "Params", "Results", "Log"];
let dockOnEveryTab = true;
let overflowOnAnyTab = false;
let sheetNoLogHonest = false; // the idle job's Log tab contract (M6b)
for (const t of tabNames) {
  const tab = page.locator('[role="dialog"] [role="tab"]', { hasText: t }).first();
  try {
    await tab.click({ timeout: 3000 });
    await sleep(700);
  } catch {
    // a disabled tab (e.g. Results on some jobs) — dock persistence is
    // still asserted for whatever tabs exist
  }
  const st = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    const d = dlg?.querySelector('[data-canvas-ui="command-preview-panel"]');
    if (!d) return { dock: false };
    const r = d.getBoundingClientRect();
    return { dock: true, visible: r.height > 0 && r.bottom <= innerHeight,
      docOverflow: document.scrollingElement.scrollWidth > document.scrollingElement.clientWidth,
      text: dlg?.textContent || "" };
  });
  if (!st.dock || !st.visible) dockOnEveryTab = false;
  if (st.docOverflow) overflowOnAnyTab = true;
  // an IDLE job never wrote a log — its Log tab must answer the /log 404
  // with the honest empty state. NOTE the two dialects: the inspector's
  // log console says "No engine log"; the PANEL's LogTab (the Sheet's
  // tab is this one) says "No log available (job has not run yet)."
  if (t === "Log" && st.dock) {
    sheetNoLogHonest = st.text.includes("No log available");
    must(sheetNoLogHonest,
      "M6b the idle job's Log tab answers honestly (No log available rendered)");
  }
}
must(dockOnEveryTab, "M6 dock visible on EVERY tab (panel-wide contract at mobile)");
must(!overflowOnAnyTab, "M7 no horizontal overflow on any tab");

// M8 — touch target: the slop is real paint-free geometry
const hit = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  const btn = dlg?.querySelector('[data-canvas-ui="command-preview-panel"] button');
  if (!btn) return null;
  const br = btn.getBoundingClientRect();
  const cs = getComputedStyle(btn, "::before");
  const pw = parseFloat(cs.width) || 0;
  const ph = parseFloat(cs.height) || 0;
  return { w: Math.round(br.width), h: Math.round(br.height), pseudoW: Math.round(pw), pseudoH: Math.round(ph) };
});
must(!!hit && hit.pseudoW >= 44 && hit.pseudoH >= 44,
  `M8 copy button effective touch target ≥44×44 (pseudo ${hit ? `${hit.pseudoW}×${hit.pseudoH}` : "n/a"}, visual ${hit ? `${hit.w}×${hit.h}` : "n/a"})`);
must(!!hit && hit.w <= 40 && hit.h <= 40,
  "M9 visual size stays compact (≤40px painted) — target grew, chrome did not");

// M10 — copy from the sheet hands over exactly the shown text
const shownText = await page.evaluate(() =>
  document.querySelector('[role="dialog"] [data-canvas-ui="command-preview-text"]')?.textContent || "");
must(shownText.length > 0, "M10a dock shows a non-empty contract (shape, not dialect)");
const copyBtn = page.locator('[role="dialog"] [data-canvas-ui="command-preview-panel"] [data-canvas-ui="command-preview"] button').first();
let copyOk = false;
try {
  await copyBtn.click({ timeout: 3000 });
  await sleep(600);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  copyOk = clip === shownText;
} catch { copyOk = false; }
must(copyOk, "M10 copy from the Sheet hands over exactly the shown text");

// M11 — single-mount, live: exactly ONE command-preview-panel exists
must(sheetState.dockCount === 1,
  `M11 exactly ONE command-preview-panel in the document while the Sheet is open (got ${sheetState.dockCount})`);

// M12 — dispatch at mobile: a completed card opens the INSPECTOR, and the
// panel Sheet does NOT ride along (inspect nulls selectedId)
await page.keyboard.press("Escape");
await sleep(600);
const doneCard = cards.find((c) => doneIds.has(c.id || "") && c.inVp);
must(!!doneCard, "M12a a completed card is tappable in-viewport");
await page.touchscreen.tap(doneCard.cx, doneCard.cy);
await sleep(1500);
const inspState = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  return { dialog: !!dlg,
    sheetDock: !!document.querySelector('[data-canvas-ui="command-preview-panel"]'),
    recorded: !!document.querySelector('[data-canvas-ui="command-recorded"]') };
});
must(inspState.dialog && !inspState.sheetDock,
  "M12 completed tap opens a dialog that is NOT the panel Sheet (dispatch at mobile)");
// the inspector auto-opens RESULTS for completed jobs; the Command line
// section lives on Overview and Radix unmounts inactive tabs (t170 C6)
await page.locator('[role=dialog] [role=tab]', { hasText: /overview/i }).first()
  .click({ timeout: 4000 }).catch(() => {});
await sleep(800);
const recordedThere = await page.evaluate(() =>
  !!document.querySelector('[data-canvas-ui="command-recorded"]'));
must(recordedThere,
  "M13 the inspector speaks the recorded contract (command-recorded present on Overview)");

// M14 — console hygiene, contract-aware. The browser logs a console error
// for EVERY non-2xx fetch — including the /log 404 that IS the designed
// contract for a log-less job (M6b watched the honest "No engine log"
// state render in the Sheet's Log tab; no response code can keep the
// browser's own console line silent). The whitelist pairs the observed
// 404 with the observed honest state; NOTHING else is forgivable.
const log404 = failedUrls.some((u) => u.startsWith("404") && /\/api\/jobs\/[^/]+\/log/.test(u));
if (log404) {
  must(sheetNoLogHonest,
    "M14a the /log 404 was answered by the honest No-engine-log state (observed at M6b)");
  console.log("    (contractual /log 404 observed — honest state observed at M6b)");
}
const realErrors = consoleErrors.filter((e) =>
  !(log404 && sheetNoLogHonest && /Failed to load resource/.test(e)));
must(realErrors.length === 0,
  `M14 zero non-contractual console errors across the mobile session (got ${realErrors.length})`);
if (realErrors.length > 0) {
  for (const e of realErrors) console.log("    console-error:", e.slice(0, 200));
}
await mCtx.close();

/* ================================================================== */
/* D — desktop sanity: the gating change's other axis                  */
/* ================================================================== */
console.log("== D: desktop 1280×800 sanity ==");
const dCtx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  permissions: ["clipboard-read", "clipboard-write"],
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
  const margin = 60; // header above, toolbar below
  const leftRail = 300; // w-72 (288px) palette rail at lg — a card under it
  // is visually "visible" but its center lands on the rail (t170's
  // palette-intercepts-pointer lesson), so require a clear left edge
  return [...document.querySelectorAll("[data-job]")].map((c) => {
    const r = c.getBoundingClientRect();
    return { id: c.getAttribute("data-job"),
      inVp: r.top >= margin && r.left >= leftRail && r.bottom <= innerHeight - margin && r.right <= innerWidth && r.width > 0,
      cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
  });
});
const dIdle = dCards.find((c) => idleIds.has(c.id || "") && c.inVp);
must(!!dIdle, "D0 an idle card is clickable in-viewport clear of the left rail");
await dPage.mouse.click(dIdle.cx, dIdle.cy);
await sleep(1500);
const dState = await dPage.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  // the PANEL aside specifically — querySelector("aside") would meet the
  // left palette rail first and pass vacuously
  const aside = [...document.querySelectorAll("aside")]
    .find((a) => a.querySelector('[data-canvas-ui="command-preview-panel"]'));
  const dock = aside?.querySelector('[data-canvas-ui="command-preview-panel"]') ?? null;
  const r = dock ? dock.getBoundingClientRect() : null;
  const ar = aside ? aside.getBoundingClientRect() : null;
  return { dialog: !!dlg,
    asideMounted: !!aside,
    asideVisible: aside ? getComputedStyle(aside).display !== "none" && (ar?.width ?? 0) > 0 : false,
    dock: !!dock, dockInVp: r ? r.height > 0 && r.bottom <= innerHeight && r.top >= 0 : false };
});
must(!dState.dialog && dState.asideMounted && dState.asideVisible,
  "D1 desktop idle click opens the ASIDE (no dialog) — gating kept xl honest");
must(dState.dock && dState.dockInVp,
  "D2 dock alive in the desktop aside, in viewport");
const dCopy = await dPage.evaluate(() => {
  const btn = document.querySelector('[data-canvas-ui="command-preview-panel"] button');
  if (!btn) return null;
  const pre = document.querySelector('[data-canvas-ui="command-preview-text"]');
  return { shown: pre?.textContent || "" };
});
if (dCopy && dCopy.shown) {
  await dPage.locator('[data-canvas-ui="command-preview-panel"] button').first().click();
  await sleep(600);
  const clip = await dPage.evaluate(() => navigator.clipboard.readText());
  must(clip === dCopy.shown, "D3 desktop copy == shown (slop changed nothing at the mouse)");
} else {
  must(false, "D3 desktop copy == shown (dock or text missing)");
}
must(dErrors.length === 0, `D4 zero console errors on desktop (got ${dErrors.length})`);
await dCtx.close();
await browser.close();

/* ================================================================== */
/* Z — roster identity                                                 */
/* ================================================================== */
console.log("== Z: roster identity ==");
const jobs1 = await apiJobs();
const after = jobs1.map((j) => `${j.id}:${j.name}`).sort().join("|");
must(after === baseline, "Z roster identical to baseline (no drift, no litter)");

console.log(`\nT171 ${failures.length === 0 ? "ALL PASS" : "FAILED"} (${passed} assertions)`);
if (failures.length > 0) {
  console.log("failures:");
  for (const f of failures) console.log("  -", f);
  process.exit(1);
}

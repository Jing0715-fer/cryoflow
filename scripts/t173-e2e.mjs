#!/usr/bin/env node
/**
 * t173-e2e.mjs — Task 173: the extreme viewport earns its acceptance and
 * the finger gets its invitation.
 *
 * Two half-day threads from Task 172's handoff, one probe:
 *  ① 320×568 (iPhone SE class) — the Params tab's controls, the body-tab
 *    bar, the dock and the document were never measured at the smallest
 *    viewport the app claims to serve. The census at 320 SURFACED a
 *    silent shortfall: the Expert-options trigger's resolved hit height
 *    was 41px (−inset-y-2 on a 25px painted trigger = 25+16) — t172's X5
 *    pinned the literal, never the resolved pixel. Fixed to −inset-y-2.5
 *    (25+20=45); M4 now measures the RESOLVED geometry (the t172 lesson
 *    applied to t172's own leftover).
 *  ② The swipe affordance — the drag has been alive since Task 172 but
 *    nothing invited it. A static grabber (top-center pill in the
 *    header's padding band) plus a drag-following left-edge shade
 *    (--swipe-progress written beside the transform) make the finger
 *    exit discoverable; both are aria-hidden + pointer-events-none.
 *
 * Phases: S baseline+targets · X source oracles · M mobile at 320×568
 * (census, grabber, echo live during drag, swipe exit, spring-back,
 * dock persistence, contract-aware console) · D desktop scoping
 * (affordance absent, metrics intact) · Z roster identity.
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let passed = 0, failed = 0;
const must = (cond, label) => {
  if (cond) { passed++; console.log("  ok:", label); }
  else { failed++; console.log("  FAIL:", label); }
};
const src = (p) => readFileSync(p, "utf8");

const consoleErrors = [];
const failedUrls = [];
async function trackConsole(page, label) {
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    consoleErrors.push({ label, text: m.text() });
  });
  page.on("pageerror", (e) => consoleErrors.push({ label, text: String(e) }));
  page.on("response", (r) => { if (r.status() >= 400) failedUrls.push(`${label} ${r.status()} ${r.url()}`); });
}

const browser = await chromium.launch();

/* ============ X: source oracles ============ */
console.log("== X: source oracles ==");
{
  const panelSrc = src("src/components/workflow/job-panel.tsx");
  must(panelSrc.includes("before:-inset-y-2.5"),
    "X1 Expert-options trigger slop upgraded to -inset-y-2.5 (25px painted + 20 = 45 ≥ 44)");
  must(!panelSrc.includes("before:-inset-y-2 "),
    "X2 no stale -inset-y-2 literal remains");

  const swipeSrc = src("src/components/workflow/swipe-sheet-content.tsx");
  must(swipeSrc.includes('data-swipe-grabber=""'),
    "X3 the grabber span exists (data-swipe-grabber)");
  must(swipeSrc.includes('data-swipe-edge-cue=""'),
    "X4 the edge-cue span exists (data-swipe-edge-cue)");
  must(swipeSrc.includes('aria-hidden="true"') &&
       swipeSrc.includes("pointer-events-none"),
    "X5 both affordances are decorative (aria-hidden + pointer-events-none)");
  must(swipeSrc.includes('setProperty("--swipe-progress"'),
    "X6 the echo rides the drag: --swipe-progress written beside the transform");
  must(swipeSrc.includes('String(Math.min(capped / w, 1))'),
    "X7 progress is the capped drag fraction (never >1, never negative)");
  must(swipeSrc.includes('--swipe-progress", "0"') &&
       swipeSrc.includes('cue.style.transition = "opacity 220ms'),
    "X8 spring-back resets the echo over the same 220ms the sheet returns in");
  must(swipeSrc.includes('opacity: "var(--swipe-progress, 0)"') &&
       swipeSrc.includes("linear-gradient(to right, rgba(0,0,0,0.16), transparent)"),
    "X9 the shade is var-driven and enters from the LEFT edge (the travel direction)");
  must(swipeSrc.includes("top-1.5") && swipeSrc.includes("h-1 w-9"),
    "X10 the grabber sits in the header's padding band (top-1.5, 4×36 painted)");
}

/* ============ M: mobile at 320×568 ============ */
console.log("== M: mobile 320×568 (iPhone SE class) ==");
const context = await browser.newContext({
  viewport: { width: 320, height: 568 },
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
trackConsole(page, "mobile");
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2500);

// FIT
await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button, [role=button], [role=tab]")];
  const fit = btns.find((b) => (b.textContent || "").trim().toUpperCase() === "FIT");
  if (fit) fit.click();
});
await sleep(1500);

const jobs = await (await fetch(BASE + "/api/jobs")).json();
const list = Array.isArray(jobs) ? jobs : jobs.jobs ?? [];
const idleIds = new Set(list.filter((j) => j.status === "idle").map((j) => j.id));
must(list.length > 0, "M0a world non-empty");
must(idleIds.size > 0, "M0b at least one idle job exists");

// pan until an idle card is visible (FIT at 320 fits very few cards;
// panning is the user's real path — the t171 methodology, extended)
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
must(!!card, "M0c an idle card is visible in-viewport after pan");

await page.touchscreen.tap(card.cx, card.cy);
await sleep(1500);
must(await page.evaluate(() => !!document.querySelector('[role="dialog"][data-panel-sheet]')),
  "M1 tapping the idle card opens the Sheet");

// M2/M3 — the affordances, measured live
{
  const aff = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    const g = dlg.querySelector("[data-swipe-grabber]");
    const c = dlg.querySelector("[data-swipe-edge-cue]");
    if (!g || !c) return { have: false };
    const gr = g.getBoundingClientRect();
    const cr = c.getBoundingClientRect();
    const gs = getComputedStyle(g), cs = getComputedStyle(c);
    return {
      have: true,
      gW: Math.round(gr.width), gH: Math.round(gr.height), gX: Math.round(gr.x),
      gPE: gs.pointerEvents, gAria: g.getAttribute("aria-hidden"),
      cW: Math.round(cr.width), cH: Math.round(cr.height), cX: Math.round(cr.x),
      cPE: cs.pointerEvents, cAria: c.getAttribute("aria-hidden"),
      cOp: cs.opacity,
      dlgW: Math.round(dlg.getBoundingClientRect().width),
    };
  });
  must(aff.have, "M2 both affordances render inside the dialog");
  if (aff.have) {
    must(aff.gW === 36 && aff.gH === 4,
      `M2a grabber paints 36×4 (got ${aff.gW}×${aff.gH})`);
    must(aff.gPE === "none" && aff.gAria === "true",
      "M2b grabber intercepts nothing (pointer-events none, aria-hidden)");
    must(aff.gX >= aff.dlgW / 2 - 24 && aff.gX <= aff.dlgW / 2 + 12,
      "M2c grabber sits top-center (in the header's padding band)");
    must(aff.cW === 24 && aff.cX <= 1,
      `M3a edge cue hugs the sheet's left edge, 24px wide (got ${aff.cW}px at x=${aff.cX})`);
    must(aff.cPE === "none" && aff.cAria === "true",
      "M3b edge cue intercepts nothing (pointer-events none, aria-hidden)");
    must(parseFloat(aff.cOp) === 0,
      "M3c the echo is silent at rest (computed opacity 0)");
  }
}

// M4 — Expert trigger: RESOLVED hit height (the t172 lesson applied)
{
  await page.locator('[role="dialog"] [role="tab"]', { hasText: "Params" }).first().click({ timeout: 4000 });
  await sleep(900);
  const expert = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    const trig = [...dlg.querySelectorAll("button")].find((b) =>
      (b.textContent || "").includes("Expert options"));
    if (!trig) return null;
    const r = trig.getBoundingClientRect();
    const cs = getComputedStyle(trig, "::before");
    const slop = cs && cs.content && cs.content !== "none" && cs.position === "absolute";
    return {
      paintedH: Math.round(r.height),
      effH: slop ? Math.round(parseFloat(cs.height) || r.height) : Math.round(r.height),
      effW: slop ? Math.round(parseFloat(cs.width) || r.width) : Math.round(r.width),
    };
  });
  if (expert) {
    must(expert.effH >= 44,
      `M4 Expert trigger RESOLVED hit ${expert.effH}×${Math.round(expert.effW)} ≥ 44 (painted ${expert.paintedH}, was 41 before the fix)`);
  } else {
    must(false, "M4 Expert trigger absent on this job's Params tab (world changed?)");
  }

  // inputs at their 40 contract (t172's scoped comfort block holds at 320)
  const inputs = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    return [...dlg.querySelectorAll("input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden]), select")]
      .filter((el) => el.getBoundingClientRect().width > 0)
      .map((el) => Math.round(el.getBoundingClientRect().height));
  });
  must(inputs.length > 0 && Math.min(...inputs) >= 40,
    `M5 sheet inputs keep the ≥40 comfort contract at 320 (min ${inputs.length ? Math.min(...inputs) : "n/a"} of ${inputs.length})`);
}

// M6 — body tabs fit the 320 sheet
{
  const tabs = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    const dlgR = dlg.getBoundingClientRect();
    const trigs = [...dlg.querySelectorAll('[role="tab"]')].filter((t) => t.getBoundingClientRect().width > 0);
    return { right: Math.max(...trigs.map((t) => t.getBoundingClientRect().right)), vw: innerWidth, dlgR: dlgR.right };
  });
  must(tabs.right <= Math.min(tabs.vw, tabs.dlgR) + 1,
    `M6 body tabs fit the 320 sheet (rightmost edge ${Math.round(tabs.right)} ≤ ${Math.min(tabs.vw, Math.round(tabs.dlgR))})`);
}

// M7 — dock persists across tabs at 320 (panel-wide contract, small edition)
{
  const dockOn = async () => await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    const d = dlg.querySelector('[data-canvas-ui="command-preview-panel"]');
    if (!d) return null;
    const r = d.getBoundingClientRect();
    return { w: Math.round(r.width), bottom: Math.round(r.bottom), inVp: r.bottom <= innerHeight + 1 && r.x >= 0 };
  });
  await page.locator('[role="dialog"] [role="tab"]', { hasText: "I/O" }).first().click({ timeout: 4000 });
  await sleep(500);
  const d1 = await dockOn();
  must(d1 && d1.inVp && d1.w >= 318, `M7a dock present + full-width on I/O at 320 (${d1 ? `${d1.w}px` : "absent"})`);
  await page.locator('[role="dialog"] [role="tab"]', { hasText: "Params" }).first().click({ timeout: 4000 });
  await sleep(500);
  const d2 = await dockOn();
  must(d2 && d2.inVp, "M7b dock persists on Params at 320");
}

// M8 — the echo follows the drag (live, mid-gesture)
{
  const rect = await page.evaluate(() => {
    const r = document.querySelector('[role="dialog"]').getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  const startY = Math.min(rect.y + rect.h / 2, 480);
  await page.mouse.move(rect.x + 100, startY);
  await page.mouse.down();
  await page.mouse.move(rect.x + 180, startY, { steps: 8 });
  await sleep(120); // let a pointermove land and the var write flush
  const mid = await page.evaluate(() => {
    const el = document.querySelector('[role="dialog"][data-panel-sheet]');
    const cue = el.querySelector("[data-swipe-edge-cue]");
    return {
      transform: el.style.transform,
      progress: el.style.getPropertyValue("--swipe-progress"),
      cueOpacity: getComputedStyle(cue).opacity,
    };
  });
  must(mid.transform.includes("translateX") && parseFloat(mid.progress) > 0.1,
    `M8a mid-drag: transform follows (${mid.transform}) and progress ${Number(mid.progress).toFixed(2)}`);
  must(parseFloat(mid.cueOpacity) > 0.1,
    `M8b the echo lights up during the drag (computed opacity ${Number(mid.cueOpacity).toFixed(2)})`);

  // M9 — release past 28% → finger exit (unchanged contract)
  await page.mouse.move(rect.x + rect.w * 0.95, startY, { steps: 10 });
  await page.mouse.up();
  await sleep(900);
  must(await page.evaluate(() => !document.querySelector('[role="dialog"][data-panel-sheet]')),
    "M9 release past 28% dismisses (the invitation ends in the real exit)");
}

// M10 — spring-back: reopen, short slow drag, echo returns to 0
await page.touchscreen.tap(card.cx, card.cy);
await sleep(1400);
{
  const rect = await page.evaluate(() => {
    const r = document.querySelector('[role="dialog"]').getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  const startY = Math.min(rect.y + rect.h / 2, 480);
  await page.mouse.move(rect.x + 120, startY);
  await page.mouse.down();
  await page.mouse.move(rect.x + 160, startY, { steps: 8 });
  await page.mouse.move(rect.x + 162, startY, { steps: 2 });
  await page.mouse.up();
  await sleep(500);
  must(await page.evaluate(() => !!document.querySelector('[role="dialog"][data-panel-sheet]')),
    "M10a short slow drag springs back (sheet survives)");
  const after = await page.evaluate(() => {
    const el = document.querySelector('[role="dialog"][data-panel-sheet]');
    const cue = el.querySelector("[data-swipe-edge-cue]");
    return { cueOpacity: getComputedStyle(cue).opacity, progress: el.style.getPropertyValue("--swipe-progress") };
  });
  must(parseFloat(after.cueOpacity) < 0.02 && (after.progress === "0" || after.progress === ""),
    `M10b the echo goes silent again (opacity ${Number(after.cueOpacity).toFixed(3)}, var "${after.progress}")`);
}

// M11 — contract-aware console hygiene (the /log 404 for a never-run
// job IS the designed contract; the browser logs a console error for
// EVERY non-2xx fetch — no response code keeps its own line silent —
// so the whitelist PAIRS the observed 404 with the observed honest
// state; everything else is intolerable. t171's recipe.)
{
  await page.locator('[role="dialog"] [role="tab"]', { hasText: "Log" }).first().click({ timeout: 4000 }).catch(() => {});
  await sleep(900);
  const honest = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    return (dlg.textContent || "").includes("No log available");
  });
  const mobileErrors = consoleErrors.filter((e) => e.label === "mobile").map((e) => e.text);
  const log404 = failedUrls.some((u) => u.startsWith("mobile 404") && /\/api\/jobs\/[^/]+\/log/.test(u));
  if (log404) {
    must(honest, "M11a the observed /log 404 pairs with the observed honest empty state");
    console.log("    (contractual /log 404 observed — honest state observed live)");
  }
  const realErrors = mobileErrors.filter((e) =>
    !(log404 && honest && /Failed to load resource/.test(e)));
  must(realErrors.length === 0,
    `M11 zero non-contractual console errors across the mobile session (got ${realErrors.length})`);
  for (const e of realErrors) console.log("    console-error:", e.slice(0, 200));
}

await page.close();
await context.close();

/* ============ D: desktop scoping ============ */
console.log("== D: desktop scoping ==");
{
  const dctx = await browser.newContext({ viewport: { width: 1440, height: 800 } });
  const dpage = await dctx.newPage();
  trackConsole(dpage, "desktop");
  await dpage.goto(BASE, { waitUntil: "networkidle" });
  await sleep(2500);

  // FIT first, then a visible idle card CLEAR of the left palette rail
  // (w-72 = 288px at lg — visible ≠ clickable, the t170/t171 lesson)
  await dpage.evaluate(() => {
    const btns = [...document.querySelectorAll("button, [role=button], [role=tab]")];
    const fit = btns.find((b) => (b.textContent || "").trim().toUpperCase() === "FIT");
    if (fit) fit.click();
  });
  await sleep(1500);

  // pick a visible idle card clear of the left rail (t171's lesson)
  const djobs = await (await fetch(BASE + "/api/jobs")).json();
  const dlist = Array.isArray(djobs) ? djobs : djobs.jobs ?? [];
  const dIdle = new Set(dlist.filter((j) => j.status === "idle").map((j) => j.id));
  const dcard = await dpage.evaluate((idleSetJson) => {
    const idleSet = new Set(JSON.parse(idleSetJson));
    const margin = 60, leftRail = 300;
    return [...document.querySelectorAll("[data-job]")].map((c) => {
      const r = c.getBoundingClientRect();
      return { id: c.getAttribute("data-job"), cx: r.x + r.width / 2, cy: r.y + r.height / 2,
        inVp: r.top >= margin && r.left >= leftRail && r.bottom <= innerHeight - margin && r.right <= innerWidth && r.width > 0 };
    }).find((c) => idleSet.has(c.id || "") && c.inVp);
  }, JSON.stringify([...dIdle]));
  if (dcard) {
    await dpage.mouse.click(dcard.cx, dcard.cy);
    await sleep(1200);
    const aside = await dpage.evaluate(() => {
      // the PANEL aside specifically — querySelector("aside") would meet
      // the LEFT palette rail first (it is an aside too; the t171 trap)
      const panel = [...document.querySelectorAll("aside")]
        .find((a) => a.querySelector('[data-canvas-ui="command-preview-panel"]') || a.querySelector("input[aria-label='Job name']"));
      const grabbers = document.querySelectorAll("[data-swipe-grabber]").length;
      const cues = document.querySelectorAll("[data-swipe-edge-cue]").length;
      const dialogs = document.querySelectorAll('[role="dialog"]').length;
      const name = panel?.querySelector("input[aria-label='Job name']");
      return {
        have: !!panel && !!name,
        nameH: name ? Math.round(name.getBoundingClientRect().height) : 0,
        grabbers, cues, dialogs,
      };
    });
    must(aside.have, "D1 the desktop aside opens with the JobPanel");
    must(aside.grabbers === 0 && aside.cues === 0,
      "D2 the affordances are scoped to the swipe sheet (absent on desktop)");
    must(aside.dialogs === 0, "D3 no dialog on desktop (the sheet never rides along)");
    must(aside.nameH >= 36 && aside.nameH < 40,
      `D4 desktop name input keeps its exact 36px (got ${aside.nameH} — scope intact)`);
  } else {
    must(false, "D1 no clickable idle card on desktop (world changed?)");
  }
  const dOthers = consoleErrors.filter((e) => e.label === "desktop" && !/\/log/.test(e.text));
  must(dOthers.length === 0, `D5 desktop console clean (got ${dOthers.length})`);
  await dpage.close();
  await dctx.close();
}

/* ============ Z: roster identity ============ */
console.log("== Z: roster identity ==");
{
  const after = await (await fetch(BASE + "/api/jobs")).json();
  const alist = Array.isArray(after) ? after : after.jobs ?? [];
  const idName = (l) => l.map((j) => `${j.id}|${j.name}`).sort().join(",");
  must(idName(alist) === idName(list),
    "Z roster identical to baseline (id+name membership — the affordances litter nothing)");
}

console.log(`\nT173 ${failed === 0 ? "ALL PASS" : "FAILED"} (${passed} assertions, ${failed} failures)`);
await browser.close();
process.exit(failed === 0 ? 0 : 1);

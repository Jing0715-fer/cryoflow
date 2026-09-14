#!/usr/bin/env node
/**
 * t176-e2e.mjs — Task 176: the fold earns its place; the ghost X comes home.
 *
 * The 280px band (foldable cover displays) was Task 173's explicit
 * leftover: 320 was the claimed smallest served surface, nothing below
 * it had ever been measured. The census (diag280*.mjs) surfaced THREE
 * defects, two of them visible on EVERY mobile width:
 *
 *  ① THE GHOST X (the headline): Task 171's hit-slop edit left a stray
 *     `relative` in the Sheet Close's class list. Tailwind v4 emits
 *     .relative AFTER .absolute in the utility cascade, so the button
 *     computed position:relative — its top-4/right-4 became relative
 *     OFFSETS on an in-flow box parked BELOW the sheet's content
 *     (measured: y=653 on a 653 viewport, rect [-15..264]×[653..669]).
 *     The primary exit affordance was focusable, slop-fattened
 *     (::before 44×44 — position-independent geometry, which is why
 *     t172's resolved-pixel probe scored it green), and entirely
 *     OFF-SCREEN on every mobile width since Task 171. Three rounds of
 *     touch craft never saw it: pseudo-element contracts measure
 *     geometry, not placement. One word removed.
 *  ② THE PALETTE OVERFLOW: the palette sheet rides w-72 (288px) with
 *     no <sm max-w — 8px wider than a 280 viewport (sheet.tsx's own
 *     side="left" carries no floor clamp). max-w-full caps it.
 *  ③ THE INSPECTOR TAB BAR: ~357px of triggers inside a 96vw dialog —
 *     clipped by the dialog's own overflow-hidden: at 280 the Files
 *     tab (and part of Results) were UNREACHABLE; at 320 too (307px
 *     dialog); even at 390 it shaved 23px. max-sm compaction: icons
 *     park (decorative, aria-hidden), padding/gap shave one step,
 *     container px-3, list max-w-full. Desktop ≥sm keeps the exact
 *     Task 114 bar.
 *
 * Probe doctrine this round: the random pan loop was the harness's own
 * flake generator — placement is now COMPUTED from the live viewport
 * matrix ([data-canvas="workspace"] transform + the job's world
 * coords), the card lands where the assertion needs it, and the
 * touch-tap path is exercised at a known-good coordinate (the earlier
 * "tap does not open the inspector" readings were placement races, not
 * product bugs — deterministic placement taps green every time).
 *
 * Phases: S baseline+targets · X source oracles · M mobile at 280×653
 * (fit anchor, ghost-X resurrection + click-to-exit, sheet census,
 * palette clamp, inspector bar + per-tab census + Files reachability,
 * toast band, cmdk + shortcuts, contract-aware console) · D desktop
 * scoping (icons live ≥sm, palette unclamped, bar fits with icons) ·
 * Z roster identity.
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

/* ============ S: baseline + world shape ============ */
const jobs = await (await fetch(BASE + "/api/jobs")).json();
const list = Array.isArray(jobs) ? jobs : jobs.jobs ?? [];
const idleIds = new Set(list.filter((j) => j.status === "idle").map((j) => j.id));
const compIds = list.filter((j) => j.status === "completed").map((j) => j.id);
const idleImport = list.find((j) => j.status === "idle" && /import/i.test(j.name));
const compImport = list.find((j) => j.status === "completed" && /import/i.test(j.name));

console.log("== S: baseline ==");
must(list.length > 0, "S1 world non-empty");
must(idleIds.size > 0, "S2 at least one idle job exists");
must(compIds.length > 0, "S3 at least one completed job exists");
must(!!idleImport, "S4 an idle Import job exists (sheet target)");
must(!!compImport, "S5 a completed Import job exists (inspector target)");

/* ============ X: source oracles ============ */
console.log("== X: source oracles ==");
{
  const sheetSrc = src("src/components/ui/sheet.tsx");
  must(!sheetSrc.includes("relative before:absolute"),
    "X1 no double-position in the Sheet Close (the stray `relative` that out-ranked `absolute` is gone)");
  must(sheetSrc.includes("before:absolute before:-inset-3.5") && sheetSrc.includes("absolute top-4 right-4"),
    "X2 the Close keeps its 44px hit-slop and its absolute corner (both contracts intact)");

  const pageSrc = src("src/app/page.tsx");
  must(pageSrc.includes("w-72 max-w-full gap-0 p-0 sm:max-w-xs"),
    "X3 the palette sheet clamps to the viewport below sm (max-w-full alongside w-72)");

  const inspSrc = src("src/components/workflow/job-inspector.tsx");
  must(inspSrc.includes("border-b px-3 pt-2.5 sm:px-6"),
    "X4 the inspector bar container drops to px-3 below sm (sm:px-6 preserved)");
  must(inspSrc.includes("h-9 max-w-full bg-muted/60 p-0.5"),
    "X5 the inspector TabsList can never outgrow its parent (max-w-full)");
  must(inspSrc.includes("max-sm:gap-1 max-sm:px-1.5"),
    "X6 triggers shave one padding/gap step below sm (px-3/gap-1.5 intact ≥sm)");
  const parked = (inspSrc.match(/size-3\.5 max-sm:hidden/g) || []).length;
  must(parked === 4,
    `X7 all four tab icons park below sm (aria-hidden decor; got ${parked}/4)`);
  must(inspSrc.includes("flex flex-wrap shrink-0 items-center gap-2 border-b border-zinc-800 bg-zinc-900/80"),
    "X8 the log console toolbar wraps instead of overflowing below sm (the Tail/Full/Follow cluster was ~380px past a 269px dialog)");
  must(inspSrc.includes("ml-auto flex max-sm:flex-wrap items-center gap-0.5"),
    "X9 the toolbar's action cluster itself wraps below sm (search+toggle+follow all reachable)");
  must(inspSrc.includes("flex max-sm:flex-wrap shrink-0 items-center gap-2.5 border-t"),
    "X10 the severity legend row wraps below sm (the error chip measured 33px past a 269px dialog)");

  const palSrc = src("src/components/workflow/palette.tsx");
  must(palSrc.includes("flex items-center gap-2 px-1 max-lg:pr-9"),
    "X11 the palette header reserves the Close's corner below lg (the count badge sat exactly under the resurrected X at the fold band)");

  const edgesSrc = src("src/components/workflow/edges-layer.tsx");
  must(edgesSrc.includes('className="edge-hit-path"') && !edgesSrc.includes('pointerEvents: "stroke"'),
    "X12 the edge hover corridor rides the globals class (no inline pointerEvents stroke left)");
  const globalsSrc = src("src/app/globals.css");
  must(globalsSrc.includes(".edge-hit-path") && /@media \(hover: none\)\s*{\s*\.edge-hit-path\s*{\s*pointer-events: none;/.test(globalsSrc),
    "X13 the corridor is stroke on mouse, none under (hover: none) — touch taps can't be stolen by a wire over a card face");

  const mmSrc = src("src/components/workflow/canvas-minimap.tsx");
  must(mmSrc.includes("hidden touch-none select-none rounded-lg border bg-card/95 p-1.5 backdrop-blur [-webkit-touch-callout:none] lg:block"),
    "X14 the minimap is a desktop instrument (hidden <lg — at the fold band its 192px frame covered 69% of the canvas and sat under the FAB)");
  const canvasSrc = src("src/components/workflow/canvas.tsx");
  must(canvasSrc.includes("size-7 max-lg:hidden"),
    "X15 the dock's minimap toggle hides with it below lg (no dead control)");
}

/* ============ M: mobile at 280×653 ============ */
console.log("== M: mobile 280×653 (foldable cover class) ==");
const context = await browser.newContext({
  viewport: { width: 280, height: 653 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 3,
});
const page = await context.newPage();
trackConsole(page, "mobile");
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2500);

/* deterministic placement: read the live viewport matrix, drag the world
   so the target card lands exactly where the assertion needs it. */
async function placeCard(id, tx, ty) {
  const job = list.find((j) => j.id === id);
  const vp = await page.evaluate(() => {
    const w = document.querySelector('[data-canvas="workspace"]');
    const t = getComputedStyle(w).transform;
    const m = new DOMMatrixReadOnly(t === "none" ? "" : t);
    return { x: m.e, y: m.f, z: m.a };
  });
  const wx = job?.x ?? 0, wy = job?.y ?? 0;
  const d = await page.evaluate(({ vpx, vpy, vpz, wx, wy, tx, ty }) => ({
    dx: tx - (wx * vpz + vpx),
    dy: ty - (wy * vpz + vpy),
  }), { vpx: vp.x, vpy: vp.y, vpz: vp.z, wx, wy, tx, ty });
  // start the pan on a clean canvas spot (elementFromPoint must not be a card)
  for (const [sx, sy] of [[140, 326], [140, 500], [60, 326], [60, 500], [200, 560]]) {
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
  return page.evaluate((want) => {
    const c = [...document.querySelectorAll("[data-job]")].find((el) => el.getAttribute("data-job") === want);
    const r = c?.getBoundingClientRect();
    if (!r) return null;
    return { x: r.x + r.width / 2, y: r.y + r.height / 2,
      inVp: r.top >= 20 && r.left >= 0 && r.bottom <= innerHeight - 20 && r.right <= innerWidth };
  }, id);
}

// FIT anchor at 280 (t175's origin-corner contract, one notch down)
await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button, [role=button], [role=tab]")];
  const fit = btns.find((b) => (b.textContent || "").trim().toUpperCase() === "FIT");
  if (fit) fit.click();
});
await sleep(1500);
const fitVis = await page.evaluate(() => {
  const m = 8;
  return [...document.querySelectorAll("[data-job]")].map((c) => {
    const r = c.getBoundingClientRect();
    return r.top >= m && r.left >= 0 && r.bottom <= innerHeight - m && r.right <= innerWidth;
  }).filter(Boolean).length;
});
must(fitVis >= 1, `M0 the fit-anchor holds at 280 (first load shows ${fitVis} full cards ≥ 1)`);

const clipCensus = (sel) =>
  page.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (!root) return null;
    const R = root.getBoundingClientRect();
    let n = 0;
    for (const el of root.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (r.bottom < R.top || r.top > R.bottom) continue;
      if (r.right > R.right + 1 || r.left < R.left - 1) n++;
    }
    return { rootW: Math.round(R.width), rootRight: Math.round(R.right), clipped: n };
  }, sel);

// M1 — the sheet's ghost X, resurrected
const idleSpot = await placeCard(idleImport.id, 140, 320);
must(idleSpot && idleSpot.inVp, "M1a the idle Import card is placed in-viewport (computed pan)");
await page.touchscreen.tap(idleSpot.x, idleSpot.y);
await sleep(1500);
const closeBtn = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"][data-panel-sheet]');
  if (!dlg) return null;
  const btn = [...dlg.querySelectorAll("button")].find((b) =>
    (b.className || "").includes("data-[state=open]:bg-secondary"));
  if (!btn) return null;
  const cs = getComputedStyle(btn);
  const r = btn.getBoundingClientRect();
  const before = getComputedStyle(btn, "::before");
  return {
    pos: cs.position,
    rect: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)],
    slop: before.content !== "none" && Math.round(parseFloat(before.height)) === 44,
    inVp: r.top >= 0 && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
  };
});
must(!!closeBtn, "M1b the sheet renders with its built-in Close");
if (closeBtn) {
  must(closeBtn.pos === "absolute",
    `M1c the Close computes position:absolute (was relative — the ghost state)`);
  must(closeBtn.inVp,
    `M1d the Close is ON SCREEN in the top-right corner (rect ${closeBtn.rect.join(",")}; was y=653 off-screen)`);
  must(closeBtn.slop, "M1e the 44px hit-slop survives (position-independent, still 44)");
}
// the resurrection ends in the real exit: click the X, the sheet closes
await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"][data-panel-sheet]');
  const btn = [...dlg.querySelectorAll("button")].find((b) =>
    (b.className || "").includes("data-[state=open]:bg-secondary"));
  btn.click();
});
await sleep(900);
must(await page.evaluate(() => !document.querySelector('[role="dialog"][data-panel-sheet]')),
  "M1f clicking the Close actually dismisses the sheet (the ghost works again)");

// M2 — the sheet census: nothing clipped, contracts hold at 280
const idleSpot2 = await placeCard(idleImport.id, 140, 320);
await page.touchscreen.tap(idleSpot2.x, idleSpot2.y);
await sleep(1500);
{
  const c = await clipCensus('[role="dialog"][data-panel-sheet]');
  must(c && c.clipped === 0, `M2a sheet census at rest: 0 clipped (root ${c?.rootW}px)`);
  const tabs = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"][data-panel-sheet]');
    const trigs = [...dlg.querySelectorAll('[role="tab"]')].filter((t) => t.getBoundingClientRect().width > 0);
    return { right: Math.max(...trigs.map((t) => t.getBoundingClientRect().right)), dlgR: dlg.getBoundingClientRect().right };
  });
  must(tabs.right <= tabs.dlgR + 1,
    `M2b body tabs fit the 280 sheet (rightmost ${Math.round(tabs.right)} ≤ ${Math.round(tabs.dlgR)})`);
  const dock = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"][data-panel-sheet] [data-canvas-ui="command-preview-panel"]');
    return d ? Math.round(d.getBoundingClientRect().width) : 0;
  });
  must(dock >= 276, `M2c dock is full-width at 280 (${dock}px)`);
}
await page.locator('[role="dialog"] [role="tab"]', { hasText: "Params" }).first().click({ timeout: 4000 });
await sleep(900);
{
  const c = await clipCensus('[role="dialog"][data-panel-sheet]');
  must(c && c.clipped === 0, "M2d sheet census on Params: 0 clipped");
  const inputs = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"][data-panel-sheet]');
    return [...dlg.querySelectorAll("input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=hidden]), select")]
      .filter((el) => el.getBoundingClientRect().width > 0)
      .map((el) => Math.round(el.getBoundingClientRect().height));
  });
  must(inputs.length > 0 && Math.min(...inputs) >= 40,
    `M2e inputs keep the ≥40 comfort contract at 280 (min ${inputs.length ? Math.min(...inputs) : "n/a"} of ${inputs.length})`);
}
await page.keyboard.press("Escape");
await sleep(700);

// M3 — the palette sheet clamps to the foldable width
await page.click('button[aria-label="Add a job"]');
await sleep(900);
{
  const pal = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    if (!dlg) return null;
    const r = dlg.getBoundingClientRect();
    const btn = [...dlg.querySelectorAll("button")].find((b) =>
      (b.className || "").includes("data-[state=open]:bg-secondary"));
    const br = btn?.getBoundingClientRect();
    return { w: Math.round(r.width), right: Math.round(r.right), vw: innerWidth,
      xIn: br ? br.right <= innerWidth && br.left >= 0 : null };
  });
  must(pal && pal.w <= pal.vw,
    `M3a palette sheet fits the 280 viewport (w=${pal?.w} ≤ ${pal?.vw}; was 288)`);
  must(pal && pal.xIn === true, "M3b the palette's own Close is on screen too (same ghost fix)");
  const c = await clipCensus('[role="dialog"]');
  must(c && c.clipped === 0, "M3c palette census: 0 clipped");
  const badge = await page.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    const b = dlg.querySelector('[title*="types shown"]');
    const x = [...dlg.querySelectorAll("button")].find((bt) =>
      (bt.className || "").includes("data-[state=open]:bg-secondary"));
    if (!b || !x) return null;
    const br = b.getBoundingClientRect(), xr = x.getBoundingClientRect();
    return { badgeRight: Math.round(br.right), xLeft: Math.round(xr.left) };
  });
  must(badge && badge.badgeRight <= badge.xLeft,
    `M3d the count badge clears the resurrected X (badge right ${badge?.badgeRight} ≤ X left ${badge?.xLeft}; was overlapped)`);
}
await page.keyboard.press("Escape");
await sleep(700);

// M3e — the corridor contract, live: touch context computes none
{
  const corridor = await page.evaluate(() => {
    const p = document.querySelector('[data-edges-layer] .edge-hit-path');
    return p ? getComputedStyle(p).pointerEvents : "absent";
  });
  must(corridor === "none",
    `M3e the edge corridor is dead on touch (computed pointer-events ${corridor})`);
}

// M3f — the minimap yields below lg
{
  const mm = await page.evaluate(() => {
    const el = document.querySelector('[data-canvas-ui="minimap"]');
    const tg = document.querySelector('[data-canvas-ui="minimap-toggle"]');
    return {
      mmAbsent: !el || getComputedStyle(el).display === "none",
      tgAbsent: !tg || getComputedStyle(tg).display === "none",
    };
  });
  must(mm.mmAbsent, "M3f the minimap does not cover the fold-band canvas (hidden <lg; was 192px over 69% of the width)");
  must(mm.tgAbsent, "M3g its dock toggle hides with it (no dead control)");
}

// M4 — the inspector tab bar: reachable everywhere, Files clickable
const compSpot = await placeCard(compImport.id, 140, 320);
must(compSpot && compSpot.inVp, "M4a the completed Import card is placed in-viewport");
await page.touchscreen.tap(compSpot.x, compSpot.y);
await sleep(1800);
{
  const bar = await page.evaluate(() => {
    const dlg = document.querySelector("[data-inspector-dialog]");
    if (!dlg) return null;
    const R = dlg.getBoundingClientRect();
    const trigs = [...dlg.querySelectorAll('[role="tab"]')].filter((t) => t.getBoundingClientRect().width > 0);
    const right = Math.max(...trigs.map((t) => t.getBoundingClientRect().right));
    const icons = [...dlg.querySelectorAll('[role="tab"] svg')].map((s) => getComputedStyle(s).display);
    return { open: true, rootW: Math.round(R.width), right: Math.round(right), dlgR: Math.round(R.right),
      trigW: trigs.map((t) => Math.round(t.getBoundingClientRect().width)),
      icons, names: trigs.map((t) => (t.textContent || "").trim()) };
  });
  must(bar && bar.open, "M4b the inspector opens at 280");
  if (bar && bar.open) {
    must(bar.right <= bar.dlgR + 1,
      `M4c the bar fits the dialog (rightmost tab ${bar.right} ≤ ${bar.dlgR}; was ~357 clipped)`);
    must(bar.icons.every((d) => d === "none"),
      "M4d the icons are parked below sm (display:none — labels carry the meaning)");
    must(bar.trigW.every((w) => w >= 24), `M4e triggers keep tappable widths (got ${bar.trigW.join("/")})`);
    // every tab reachable: click Files (the one that was clipped away).
    // Radix triggers activate on REAL pointer events — el.click() in
    // evaluate dispatches a bare MouseEvent and never flips the tab.
    await page.locator('[data-inspector-dialog] [role="tab"]', { hasText: "Files" }).first().click({ timeout: 4000 });
    await sleep(1000);
    const files = await page.evaluate(() => {
      const dlg = document.querySelector("[data-inspector-dialog]");
      const t = [...dlg.querySelectorAll('[role="tab"]')].find((x) => (x.textContent || "").trim() === "Files");
      const panel = dlg.querySelector('[role="tabpanel"][id*="content-files"]');
      return { active: t?.getAttribute("aria-selected") === "true", panelVisible: !!panel };
    });
    must(files.active && files.panelVisible, "M4f the Files tab is reachable and activates (was clipped away at 280/320)");
    // per-tab census
    for (const tab of ["Overview", "Log", "Results", "Files"]) {
      await page.locator('[data-inspector-dialog] [role="tab"]', { hasText: tab }).first().click({ timeout: 4000 });
      await sleep(900);
      const c = await clipCensus("[data-inspector-dialog]");
      must(c && c.clipped === 0, `M4g inspector census on ${tab}: 0 clipped (root ${c?.rootW}px)`);
    }
  }
}
await page.keyboard.press("Escape");
await sleep(800);

// M5 — the toast stays a full-width top band at 280
await page.setViewportSize({ width: 900, height: 800 });
await sleep(400);
await page.click('button[aria-label="Export canvas as PNG"]');
await sleep(600);
await page.setViewportSize({ width: 280, height: 653 });
await sleep(500);
{
  const toast = await page.evaluate(() => {
    const vp = document.querySelector('[role="region"][aria-label*="Notifications"]');
    const li = vp?.querySelector("li");
    if (!vp || !li) return null;
    const lr = li.getBoundingClientRect();
    return { w: Math.round(lr.width), x: Math.round(lr.left), y: Math.round(lr.top), vw: innerWidth };
  });
  must(toast && toast.w <= toast.vw - 24 && toast.x >= 8,
    `M5 the toast rides the full-width top band at 280 (${toast ? `${toast.w}px @ x=${toast.x}` : "absent"})`);
  await sleep(5200); // let the 5s toast retire before the console sweep
}

// M6 — command palette + shortcuts dialog at 280
await page.keyboard.press("ControlOrMeta+k");
await sleep(900);
{
  const c = await clipCensus('[role="dialog"]');
  must(c && c.clipped === 0, `M6a command palette census: 0 clipped (root ${c?.rootW}px)`);
}
await page.keyboard.press("Escape");
await sleep(600);
await page.keyboard.press("?");
await sleep(900);
{
  const c = await clipCensus('[role="dialog"]');
  must(c && c.clipped === 0, `M6b shortcuts dialog census: 0 clipped (root ${c?.rootW}px)`);
}
await page.keyboard.press("Escape");
await sleep(600);

// M7 — contract-aware console hygiene (the t171 recipe)
{
  const mobileErrors = consoleErrors.filter((e) => e.label === "mobile").map((e) => e.text);
  const log404 = failedUrls.some((u) => u.startsWith("mobile 404") && /\/api\/jobs\/[^/]+\/(log|outputs)/.test(u));
  const realErrors = mobileErrors.filter((e) =>
    !(log404 && /Failed to load resource/.test(e)));
  must(realErrors.length === 0,
    `M7 zero non-contractual console errors across the mobile session (got ${realErrors.length})`);
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
  await dpage.evaluate(() => {
    const btns = [...document.querySelectorAll("button, [role=button], [role=tab]")];
    const fit = btns.find((b) => (b.textContent || "").trim().toUpperCase() === "FIT");
    if (fit) fit.click();
  });
  await sleep(1500);
  // open the inspector on desktop: a completed card CLEAR of the left rail
  const dcard = await dpage.evaluate((compJson) => {
    const compSet = new Set(JSON.parse(compJson));
    const margin = 60, leftRail = 300;
    return [...document.querySelectorAll("[data-job]")].map((c) => {
      const r = c.getBoundingClientRect();
      return { id: c.getAttribute("data-job"), cx: r.x + r.width / 2, cy: r.y + r.height / 2,
        inVp: r.top >= margin && r.left >= leftRail && r.bottom <= innerHeight - margin && r.right <= innerWidth && r.width > 0 };
    }).find((c) => compSet.has(c.id || "") && c.inVp);
  }, JSON.stringify(compIds));
  if (dcard) {
    await dpage.mouse.click(dcard.cx, dcard.cy);
    await sleep(1800);
    const bar = await dpage.evaluate(() => {
      const dlg = document.querySelector("[data-inspector-dialog]");
      if (!dlg) return null;
      const R = dlg.getBoundingClientRect();
      const trigs = [...dlg.querySelectorAll('[role="tab"]')].filter((t) => t.getBoundingClientRect().width > 0);
      const right = Math.max(...trigs.map((t) => t.getBoundingClientRect().right));
      const icons = [...dlg.querySelectorAll('[role="tab"] svg')].map((s) => getComputedStyle(s).display);
      return { right: Math.round(right), dlgR: Math.round(R.right), icons };
    });
    must(bar && bar.right <= bar.dlgR + 1,
      `D1 the desktop bar fits WITH its icons (rightmost ${bar?.right} ≤ ${bar?.dlgR})`);
    must(bar && bar.icons.every((d) => d !== "none"),
      "D2 the icons are alive ≥sm (the max-sm scope never touches desktop)");
    // close the inspector before the corridor check (the canvas is under it)
    await dpage.keyboard.press("Escape");
    await sleep(600);
    const dCorr = await dpage.evaluate(() => {
      const p = document.querySelector('[data-edges-layer] .edge-hit-path');
      return p ? getComputedStyle(p).pointerEvents : "absent";
    });
    must(dCorr === "stroke",
      `D2b the corridor survives on mouse (computed pointer-events ${dCorr})`);
    const dMm = await dpage.evaluate(() => {
      const el = document.querySelector('[data-canvas-ui="minimap"]');
      return el ? getComputedStyle(el).display : "absent";
    });
    must(dMm === "block",
      `D2c the minimap is alive on desktop ≥lg (display ${dMm} — Task 105's contract intact)`);
  } else {
    must(false, "D1 no clickable completed card on desktop (world changed?)");
  }
  // palette sheet in the TABLET band (700px, ≥sm but <lg where the FAB
  // is visible): max-w-full must COEXIST with sm:max-w-xs — the sheet
  // keeps its designed 288, the fold clamp only lives below 640.
  await dctx.close();
  const tctx = await browser.newContext({ viewport: { width: 700, height: 800 }, isMobile: true, hasTouch: true });
  const tpage = await tctx.newPage();
  trackConsole(tpage, "tablet");
  await tpage.goto(BASE, { waitUntil: "networkidle" });
  await sleep(2200);
  await tpage.click('button[aria-label="Add a job"]');
  await sleep(900);
  const palW = await tpage.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    return dlg ? Math.round(dlg.getBoundingClientRect().width) : 0;
  });
  must(palW === 288, `D3 the palette keeps its 288px in the sm band (max-w-full doesn't bite ≥sm; got ${palW})`);
  await tpage.close();
  await tctx.close();
  const dOthers = consoleErrors.filter((e) => (e.label === "desktop" || e.label === "tablet") && !/\/log/.test(e.text));
  must(dOthers.length === 0, `D4 desktop+tablet console clean (got ${dOthers.length})`);
}

/* ============ Z: roster identity ============ */
console.log("== Z: roster identity ==");
{
  const after = await (await fetch(BASE + "/api/jobs")).json();
  const alist = Array.isArray(after) ? after : after.jobs ?? [];
  const idName = (l) => l.map((j) => `${j.id}|${j.name}`).sort().join(",");
  must(idName(alist) === idName(list),
    "Z roster identical to baseline (id+name membership — the fold round litters nothing)");
}

console.log(`\nT176 ${failed === 0 ? "ALL PASS" : "FAILED"} (${passed} assertions, ${failed} failures)`);
await browser.close();
process.exit(failed === 0 ? 0 : 1);

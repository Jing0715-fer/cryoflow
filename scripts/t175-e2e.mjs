#!/usr/bin/env node
/**
 * t175-e2e.mjs — Task 175: the affordance legibility round.
 *
 * Three grains from Task 173/174's handoff, one diag (diag-affordance.mjs),
 * and a FOURTH the diag exposed on the way:
 *  ① the destructive toast's ink. The close X wore text-red-300 — on the
 *    light surface 2.49:1, on the DARK token (a BRIGHTER red, red-400)
 *    1.50:1. And the diag's raw computed read uncovered the real root:
 *    `text-destructive-foreground` had generated NO RULE since the shadcn
 *    v4 migration — the @theme block mapped --color-destructive but never
 *    --color-destructive-foreground, so every destructive label inherited
 *    body ink (near-black on red in light = 2.94:1, near-white on bright
 *    red in dark = 2.40:1). The t174 lesson again: a class in the source
 *    is not a rule in the stylesheet. Fix: the missing @theme mapping
 *    (re-animates the class for the toast, ToastAction and FOUR delete
 *    buttons), the dark --destructive unified with light (white ink
 *    ~4.55:1, one red in both themes), the X to red-200 (~3.3:1), the
 *    description to full opacity (~4.55:1 — 90% blended to ~4.3).
 *  ② the swipe echo was hardcoded black — rgba(0,0,0,0.16) over a dark
 *    card measured Δ≈0 pixels. Now it rides var(--foreground) through
 *    color-mix: ink-tinted in both themes, invisible in neither.
 *  ③ the grabber had never moved — a .swipe-grabber-hint one-shot nudge
 *    (7px toward the way out, 0.55s after the entrance settles, one
 *    iteration, silenced by prefers-reduced-motion; the keyframes ride
 *    `transform`, which composes with the centering `translate:` that
 *    Tailwind v4 emits — M6 proves the pill stays centered mid-nudge).
 *  ④ (probe's own) the diag's first pixel sample read Δ0.0 because the
 *    iPhone-13 context screenshots at deviceScaleFactor 3 and the sample
 *    used CSS coordinates — two identical CANVAS patches, not an
 *    invisible echo. All pixel work here scales by devicePixelRatio.
 *
 * Phases: S baseline · X source oracles · M mobile 390×844 in an
 * iPhone-13 device context (destructive contrast light+dark, description
 * opacity, grabber nudge live + centered + resting, reduced-motion gate,
 * dark echo pixels, swipe exit, console) · D desktop (same contrast
 * contract, CSSOM proof the token class now generates, console) · Z.
 */
import { chromium, devices } from "playwright";
import sharp from "sharp";
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

/* rasterize ANY computed color (oklch tokens compute to lab(...) in
   Chromium) through a 1×1 canvas — the browser's own sRGB conversion;
   inlined per-use inside evaluate callbacks (no Node closures survive
   serialization) */
const lum = ([r, g, b]) => {
  const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [hi, lo] = lum(a) > lum(b) ? [lum(a), lum(b)] : [lum(b), lum(a)];
  return (hi + 0.05) / (lo + 0.05);
};

const browser = await chromium.launch();

/* ============ S: baseline ============ */
console.log("== S: baseline ==");
const page0 = await browser.newPage({ viewport: { width: 1280, height: 844 } });
await page0.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);
const jobs0 = await (await fetch(BASE + "/api/jobs")).json();
const list = Array.isArray(jobs0) ? jobs0 : jobs0.jobs ?? [];
must(list.length > 0, `S1 world alive (${list.length} jobs)`);
must(list.some((j) => j.status === "idle"), "S2 idle jobs present");
await page0.close();

/* ============ X: source oracles ============ */
console.log("== X: source oracles ==");
{
  const globals = src("src/app/globals.css");
  const toastSrc = src("src/components/ui/toast.tsx");
  const swipeSrc = src("src/components/workflow/swipe-sheet-content.tsx");

  must(globals.includes("--color-destructive-foreground: var(--destructive-foreground);"),
    "X1 the @theme mapping exists — text-destructive-foreground is a class again (was dead since the v4 migration)");
  must(/the same silent-generation family|silent-generation/.test(globals),
    "X2 the why lives next to the mapping (the silent-generation lesson)");
  const darkBlock = globals.slice(globals.indexOf(".dark {"), globals.indexOf("--border: oklch(1 0 0 / 12%)"));
  must(!darkBlock.includes("oklch(0.704 0.191 22.216)") && darkBlock.includes("--destructive: oklch(0.577 0.245 27.325);"),
    "X3 dark --destructive unified with light (was the BRIGHTER red-400 — ink on brighter ink)");
  must(toastSrc.includes("group-[.destructive]:text-red-200") && !toastSrc.includes("group-[.destructive]:text-red-300"),
    "X4 the destructive X wears red-200 (3.3:1 both themes; red-300 measured 2.49/1.50)");
  must(toastSrc.includes("group-[.destructive]:opacity-100"),
    "X5 the destructive description drops the 90% blend (4.3 → 4.55 — clears the 4.5 small-text bar)");
  must(swipeSrc.includes("linear-gradient(to right, color-mix(in oklab, var(--foreground) 16%, transparent), transparent)") &&
       !swipeSrc.includes('background: "linear-gradient(to right, rgba'),
    "X6 the echo rides the foreground token (hardcoded black measured Δ0 pixels on a dark card)");
  must(swipeSrc.includes('"swipe-grabber-hint pointer-events-none'),
    "X7 the grabber carries the hint class (the invitation learned to move)");
  must(globals.includes("@keyframes swipe-grabber-nudge") &&
       /swipe-grabber-nudge 1\.05s cubic-bezier\([^)]*\) 0\.55s 1 both/.test(globals),
    "X8 the nudge: one iteration, 0.55s late (after the entrance settles), fill both");
  must(/@media \(prefers-reduced-motion: reduce\)\s*{\s*\.swipe-grabber-hint\s*{\s*animation: none/.test(globals),
    "X9 reduced motion silences the nudge (gate ① of the handoff's two)");
  must(/COMPOSES with the centering/.test(globals) && /they invite, they\s*never intercept|steals focus from\s*nothing/.test(swipeSrc + globals),
    "X10 the composition + no-focus-steal gates are written into the source (gate ②)");
}

/* ============ M: mobile 390×844, iPhone-13 device context ============ */
console.log("== M: mobile 390×844 (iPhone 13) ==");
const mCtx = await browser.newContext({
  ...devices["iPhone 13"],
  viewport: { width: 390, height: 844 },
});
const mPage = await mCtx.newPage();
trackConsole(mPage, "mobile");
await mPage.goto(BASE, { waitUntil: "networkidle" });
await sleep(2400);

const modality = await mPage.evaluate(() => ({
  hoverNone: matchMedia("(hover: none)").matches,
  coarse: matchMedia("(pointer: coarse)").matches,
}));
must(modality.hoverNone && modality.coarse,
  `M0 the context reports the touch modality (hover:none=${modality.hoverNone}, coarse=${modality.coarse})`);

// fire the destructive toast through the app's OWN path: a synthetic
// .txt drop on the canvas — offered=1, files=0 (the .json gate) → the
// honest "Nothing to import" toast (collectDroppedFiles documents the
// .files fallback as the synthetic-drop path)
async function fireDestructive(pg) {
  await pg.evaluate(() => {
    const canvas = document.querySelector('[data-canvas="viewport"]');
    const dt = new DataTransfer();
    dt.items.add(new File(["hello"], "notes.txt", { type: "text/plain" }));
    canvas.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
  });
  const li = pg.locator('li[data-swipe-direction][data-state="open"]').first();
  await li.waitFor({ state: "visible", timeout: 8000 });
  return li;
}

const li = await fireDestructive(mPage);
must((await li.getAttribute("class")).includes("destructive"),
  "M1 the drop path fires the DESTRUCTIVE toast (the app's own funnel, not a synthetic dispatch of the store)");

const readInk = (root) => {
  // toSrgb is INLINED — this function is serialized into the browser,
  // where no Node-side variable (no eval of an outer template) exists
  const toSrgb = (colorStr) => {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const ctx = c.getContext("2d");
    ctx.fillStyle = colorStr;
    ctx.fillRect(0, 0, 1, 1);
    return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3));
  };
  const btn = root.querySelector("[toast-close]");
  const title = root.querySelector("[class*=font-semibold]") || root;
  const desc = root.querySelector("[class*=opacity]");
  return {
    x: toSrgb(getComputedStyle(btn).color),
    bg: toSrgb(getComputedStyle(root).backgroundColor),
    title: toSrgb(getComputedStyle(title).color),
    descOp: desc ? getComputedStyle(desc).opacity : null,
  };
};
const lightInk = await li.evaluate(readInk);
must(ratio(lightInk.x, lightInk.bg) >= 3,
  `M2 LIGHT X vs destructive bg ${ratio(lightInk.x, lightInk.bg).toFixed(2)}:1 ≥ 3 (was 2.49)`);
must(ratio(lightInk.title, lightInk.bg) >= 4.5,
  `M3 LIGHT title vs bg ${ratio(lightInk.title, lightInk.bg).toFixed(2)}:1 ≥ 4.5 (was 2.94 — the dead class)`);
must(lightInk.descOp === "1",
  `M4 the destructive description sits at FULL opacity (got ${lightInk.descOp})`);

await mPage.evaluate(() => document.documentElement.classList.add("dark"));
await sleep(400);
const darkInk = await li.evaluate(readInk);
must(ratio(darkInk.x, darkInk.bg) >= 3 && ratio(darkInk.title, darkInk.bg) >= 4.5,
  `M5 DARK: X ${ratio(darkInk.x, darkInk.bg).toFixed(2)}:1 ≥ 3, title ${ratio(darkInk.title, darkInk.bg).toFixed(2)}:1 ≥ 4.5 (was 1.50 / 2.40)`);
await mPage.evaluate(() => document.documentElement.classList.remove("dark"));
await li.locator("[toast-close]").click({ force: true });
await sleep(600);

// --- the sheet: grabber nudge, echo pixels, swipe exit ---
await mPage.evaluate(() => {
  const btns = [...document.querySelectorAll("button, [role=button], [role=tab]")];
  const fit = btns.find((b) => (b.textContent || "").trim().toUpperCase() === "FIT");
  if (fit) fit.click();
});
await sleep(1400);
const idleIds = new Set(list.filter((j) => j.status === "idle").map((j) => j.id));
let card = null;
for (let attempt = 0; attempt < 8 && !card; attempt++) {
  const cards = await mPage.evaluate(() => {
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
  await mPage.mouse.move(px, py);
  await mPage.mouse.down();
  await mPage.mouse.move(px - 180, py - (attempt % 2 ? 140 : 40), { steps: 6 });
  await mPage.mouse.up();
  await sleep(700);
}
must(!!card, "M6 an idle card is visible in-viewport (pan until it is — the t173 methodology)");
await mPage.touchscreen.tap(card.cx, card.cy);
await sleep(400); // mid-entrance

const anim = await mPage.evaluate(() => {
  const g = document.querySelector('[role="dialog"] [data-swipe-grabber]');
  if (!g) return null;
  const cs = getComputedStyle(g);
  return { name: cs.animationName, iter: cs.animationIterationCount, fill: cs.animationFillMode };
});
must(anim && anim.name === "swipe-grabber-nudge" && anim.iter === "1" && anim.fill === "both",
  `M7 the nudge is LIVE on mount (name=${anim?.name}, iter=${anim?.iter}, fill=${anim?.fill} — one shot per open, was "none" forever)`);

await sleep(550); // ≈0.95s after mount: inside the nudge window
const midNudge = await mPage.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  const g = dlg.querySelector("[data-swipe-grabber]");
  const dr = dlg.getBoundingClientRect(), gr = g.getBoundingClientRect();
  return { off: Math.abs(gr.x + gr.width / 2 - (dr.x + dr.width / 2)), w: Math.round(gr.width) };
});
must(midNudge.off > 1.5 && midNudge.off < 12 && midNudge.w === 36,
  `M8 mid-nudge: the pill has LEFT home by ${midNudge.off.toFixed(1)}px (alive) and stays centered-ish (<12 — composition with translate: holds; a lost -50% would read ~25px), width ${midNudge.w}`);

await sleep(1700); // ≈2.65s after mount: the nudge has rested (fill both = back at 0)
const restNudge = await mPage.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"]');
  const g = dlg.querySelector("[data-swipe-grabber]");
  const dr = dlg.getBoundingClientRect(), gr = g.getBoundingClientRect();
  return Math.abs(gr.x + gr.width / 2 - (dr.x + dr.width / 2));
});
must(restNudge < 1,
  `M9 the nudge rests (offset ${restNudge.toFixed(2)}px — one shot, never looping)`);

// reduced-motion gate: silence it, REOPEN (fresh mount), expect none
await mPage.emulateMedia({ reducedMotion: "reduce" });
await mPage.keyboard.press("Escape");
await sleep(700);
await mPage.touchscreen.tap(card.cx, card.cy);
await sleep(900);
const rmAnim = await mPage.evaluate(() => {
  const g = document.querySelector('[role="dialog"] [data-swipe-grabber]');
  return g ? getComputedStyle(g).animationName : "absent";
});
must(rmAnim === "none",
  `M10 prefers-reduced-motion silences the nudge (animationName "${rmAnim}" — the handoff's gate ①, live)`);
await mPage.emulateMedia({ reducedMotion: "no-preference" });

// --- dark echo pixels: deep drag, sharp sampling at PHYSICAL resolution ---
await mPage.evaluate(() => document.documentElement.classList.add("dark"));
await sleep(500);
const rect = await mPage.evaluate(() => {
  const r = document.querySelector('[role="dialog"]').getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
const startY = Math.min(rect.y + rect.h / 2, 480);
await mPage.mouse.move(rect.x + 60, startY);
await mPage.mouse.down();
await mPage.mouse.move(rect.x + 280, startY, { steps: 10 }); // ≈56% progress
await sleep(150);
const mid = await mPage.evaluate(() => {
  const el = document.querySelector('[role="dialog"][data-panel-sheet]');
  const cue = el.querySelector("[data-swipe-edge-cue]");
  return {
    transform: el.style.transform,
    progress: parseFloat(el.style.getPropertyValue("--swipe-progress")),
    cueOp: getComputedStyle(cue).opacity,
    sx: el.getBoundingClientRect().x,
  };
});
must(mid.transform.includes("translateX") && mid.progress > 0.4 && mid.progress < 0.7 &&
     Math.abs(parseFloat(mid.cueOp) - mid.progress) < 0.02,
  `M11 mid-drag: transform follows, progress ${mid.progress.toFixed(2)}, cue opacity ${Number(mid.cueOp).toFixed(2)} = progress`);

const shot = await mPage.screenshot();
await mPage.mouse.up();
await sleep(800);
const dismissed = await mPage.evaluate(() => !document.querySelector('[role="dialog"][data-panel-sheet]'));
must(dismissed, "M12 release past 28% dismisses (the invitation ends in the real exit)");

const { data, info } = await sharp(shot).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const dpr = info.width / 390;
const samplePx = (cssX, cssY) => {
  const x = Math.round(cssX * dpr), y = Math.round(cssY * dpr);
  let r = 0, g = 0, b = 0, n = 0;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const i = ((y + dy) * info.width + (x + dx)) * info.channels;
    r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
  }
  return [r / n, g / n, b / n];
};
const onEcho = samplePx(mid.sx + 4, startY);
const offEcho = samplePx(mid.sx + 70, startY);
const delta = Math.max(...onEcho.map((v, i) => Math.abs(v - offEcho[i])));
must(delta >= 12,
  `M13 DARK echo pixels: on-echo rgb(${onEcho.map(Math.round)}) vs card rgb(${offEcho.map(Math.round)}) → Δ ${delta.toFixed(1)} ≥ 12 (was Δ≈0 — hardcoded black)`);

// console hygiene: the sheet's Log tab may honest-404 (t171's recipe —
// pair the observed 404 with the observed empty state, tolerate nothing else)
{
  // reopen once more so the session genuinely exercised the sheet's Log
  await mPage.evaluate(() => document.documentElement.classList.remove("dark"));
  await mPage.touchscreen.tap(card.cx, card.cy).catch(() => {});
  await sleep(1200);
  await mPage.locator('[role="dialog"] [role="tab"]', { hasText: "Log" }).first().click({ timeout: 4000 }).catch(() => {});
  await sleep(900);
  const honest = await mPage.evaluate(() => {
    const dlg = document.querySelector('[role="dialog"]');
    return dlg ? (dlg.textContent || "").includes("No log available") : false;
  });
  const log404 = failedUrls.some((u) => u.startsWith("mobile 404") && /\/api\/jobs\/[^/]+\/log/.test(u));
  const mobileErrors = consoleErrors.filter((e) => e.label === "mobile").map((e) => e.text);
  const realErrors = mobileErrors.filter((e) =>
    !(log404 && honest && /Failed to load resource/.test(e)));
  must(realErrors.length === 0,
    `M14 console clean across the mobile session (got ${realErrors.length}${log404 ? "; contractual /log 404 paired with the honest empty state" : ""})`);
  for (const e of realErrors) console.log("    console-error:", e.slice(0, 200));
  await mPage.keyboard.press("Escape").catch(() => {});
  await sleep(400);
}
await mCtx.close();

/* ============ D: desktop 1280 ============ */
console.log("== D: desktop 1280 ==");
{
  const dPage = await browser.newPage({ viewport: { width: 1280, height: 844 } });
  trackConsole(dPage, "desktop");
  await dPage.goto(BASE, { waitUntil: "networkidle" });
  await sleep(2200);

  // CSSOM proof: the token class now GENERATES (before this round the
  // built stylesheet contained zero .text-destructive-foreground rules).
  // Tailwind v4 nests everything in @layer blocks — walk RECURSIVELY
  // through layer/media/supports rule containers.
  const cssom = await dPage.evaluate(() => {
    let hit = null;
    const walk = (rules) => {
      for (const r of rules) {
        if (r.selectorText && r.selectorText.includes("text-destructive-foreground")) {
          hit = r.cssText.slice(0, 120);
          return true;
        }
        if (r.cssRules && walk(r.cssRules)) return true;
      }
      return false;
    };
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch { continue; }
      if (walk(rules)) break;
    }
    return hit;
  });
  must(!!cssom && /color/.test(cssom),
    `D1 the token class generates a real rule (CSSOM: ${cssom?.slice(0, 80)}...)`);

  const li = await dPage.evaluate(() => {
    const canvas = document.querySelector('[data-canvas="viewport"]');
    const dt = new DataTransfer();
    dt.items.add(new File(["x"], "notes.txt", { type: "text/plain" }));
    canvas.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
  }).then(async () => {
    const l = dPage.locator('li[data-swipe-direction][data-state="open"]').first();
    await l.waitFor({ state: "visible", timeout: 8000 });
    return l;
  });
  const dLight = await li.evaluate(readInk);
  must(ratio(dLight.x, dLight.bg) >= 3 && ratio(dLight.title, dLight.bg) >= 4.5,
    `D2 LIGHT on desktop: X ${ratio(dLight.x, dLight.bg).toFixed(2)}:1, title ${ratio(dLight.title, dLight.bg).toFixed(2)}:1`);
  await dPage.evaluate(() => document.documentElement.classList.add("dark"));
  await sleep(400);
  const dDark = await li.evaluate(readInk);
  must(ratio(dDark.x, dDark.bg) >= 3 && ratio(dDark.title, dDark.bg) >= 4.5,
    `D3 DARK on desktop: X ${ratio(dDark.x, dDark.bg).toFixed(2)}:1, title ${ratio(dDark.title, dDark.bg).toFixed(2)}:1 — one contract, two themes, two viewports`);

  const dErrors = consoleErrors.filter((e) => e.label === "desktop" && !/\/log/.test(e.text));
  must(dErrors.length === 0, `D4 desktop console clean (got ${dErrors.length})`);
  await dPage.close();
}

/* ============ Z: roster identity ============ */
console.log("== Z: roster identity ==");
{
  const after = await (await fetch(BASE + "/api/jobs")).json();
  const alist = Array.isArray(after) ? after : after.jobs ?? [];
  const idName = (l) => l.map((j) => `${j.id}|${j.name}`).sort().join(",");
  must(idName(alist) === idName(list),
    "Z roster identical to baseline (id+name membership — the legibility round litters nothing)");
}

console.log(`\nT175 ${failed === 0 ? "ALL PASS" : "FAILED"} (${passed} assertions, ${failed} failures)`);
await browser.close();
process.exit(failed === 0 ? 0 : 1);

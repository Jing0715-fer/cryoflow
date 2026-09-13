#!/usr/bin/env node
/**
 * t174-e2e.mjs — Task 174: the toast earns its finger.
 *
 * The toast was the one surface the four touch rounds never visited.
 * Three grains surfaced in diag-toast.mjs, all fixed this round:
 *  ① ToastClose was opacity-0 + group-hover — on a coarse-pointer
 *    viewport it was FOREVER INVISIBLE (pointer-events live, affordance
 *    a ghost) and its painted target was 24×24. Fixed: hover-none: (the
 *    project's own input-modality variant) reveals it on touch, and a
 *    ::before -inset-2.5 hit-slop grows the tappable area to 44×44
 *    without moving a painted pixel.
 *  ② Radix's swipe state machine ran (data-swipe=move, the move var
 *    tracked the finger) but the toast STOOD STILL — Tailwind v4 never
 *    emitted translate-x-[var(--radix-toast-swipe-move-x)] (arbitrary
 *    values wrapping a var with a leading -- fail to generate; zero CSS
 *    rules mention swipe). Fixed: hand-written follow rules in
 *    globals.css scoped to li[data-swipe] (move/cancel/end).
 *  ③ swipeDirection was Radix's default "right" everywhere — but the
 *    toast ENTERS FROM THE TOP EDGE below sm:. Fixed: the Provider's
 *    swipeDirection now follows the same 640px line the placement uses
 *    (up below it, right above) via a matchMedia read in toaster.tsx.
 *
 * Phases: S baseline+roster · X source oracles · M mobile 390×844
 * (close revealed, hit area, direction=up, drag-follow live, exit,
 * spring-back, close bridge, console) · D desktop 1280 (hover convention
 * kept, direction=right, follow+exit, vertical ignored) · Z identity.
 */
import { chromium, devices } from "playwright";
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
async function trackConsole(page, label) {
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    consoleErrors.push({ label, text: m.text() });
  });
  page.on("pageerror", (e) => consoleErrors.push({ label, text: String(e) }));
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 844 } });
trackConsole(page, "main");

/* The MOBILE phase runs in an iPhone-13 device context — Playwright's
   default launch reports hover:hover (a desktop device), and neither
   emulateMedia({features}) nor CDP's setEmulatedMedia can flip
   hover/pointer (Chromium emulates only the prefers-* features). The
   device descriptor's isMobile+hasTouch enable the REAL device
   emulation, which is exactly what makes a phone report
   (hover:none)/(pointer:coarse) — the same modality the project's
   hover-none: variant was built for. Verified live: matchMedia flips
   true here and stays true across viewport resizes. */
const mCtx = await browser.newContext({
  ...devices["iPhone 13"],
  viewport: { width: 390, height: 844 },
});
const mPage = await mCtx.newPage();
trackConsole(mPage, "mobile");

/* Fire a fresh toast on the given page: the export button lives in the
   zoom cluster (a fixed-position island that at 390px sits OUTSIDE the
   viewport at x≈419 — the trigger must happen while wide), then the
   viewport can be resized and the toast follows the CSS placement live. */
async function fireToast(pg, toWidth) {
  await pg.setViewportSize({ width: 1280, height: 844 });
  await sleep(400);
  await pg.click('button[aria-label="Export canvas as PNG"]');
  const li = pg.locator('li[data-swipe-direction][data-state="open"]').first();
  await li.waitFor({ state: "visible", timeout: 25000 });
  if (toWidth) {
    await pg.setViewportSize({ width: toWidth, height: 844 });
    await sleep(600);
  }
  return li;
}

/* ============ S: baseline ============ */
console.log("== S: baseline ==");
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2500);
const jobs0 = await (await fetch(BASE + "/api/jobs")).json();
const list = Array.isArray(jobs0) ? jobs0 : jobs0.jobs ?? [];
must(list.length > 0, `S1 world alive (${list.length} jobs)`);
must(list.some((j) => j.status === "idle"), "S2 idle jobs present");

/* ============ X: source oracles ============ */
console.log("== X: source oracles ==");
{
  const toastSrc = src("src/components/ui/toast.tsx");
  const toasterSrc = src("src/components/ui/toaster.tsx");
  const globals = src("src/app/globals.css");

  must(toastSrc.includes("hover-none:opacity-100"),
    "X1 ToastClose revealed on coarse pointers (hover-none: — the project's input-modality variant)");
  must(toastSrc.includes("before:-inset-2.5"),
    "X2 ToastClose ::before hit-slop -inset-2.5 (24 painted + 20 = 44 tappable)");
  must(/grains from the diag/.test(toastSrc),
    "X3 the diag's two grains are written into the source (① invisible ② 24×24)");
  must(toasterSrc.includes("function useToastSwipeDirection"),
    "X4 toaster reads the swipe direction from a matchMedia hook");
  must(toasterSrc.includes("(min-width: 640px)"),
    "X5 the direction breakpoint is 640 — the same sm: the viewport's PLACEMENT uses (not useIsMobile's 768)");
  must(toasterSrc.includes('<ToastProvider swipeDirection={swipeDirection}>'),
    "X6 the Provider's swipeDirection is the hook's output");
  must(globals.includes('li[data-swipe="move"]') && globals.includes("--radix-toast-swipe-move-x") && globals.includes("--radix-toast-swipe-move-y"),
    "X7 globals.css hand-writes the drag-follow (move tracks BOTH axes — Radix only advances the direction's axis)");
  must(globals.includes('li[data-swipe="cancel"]') && globals.includes('li[data-swipe="end"]'),
    "X8 cancel springs home, end holds the release offset");
  must(/never emitted|fail to generate/.test(globals),
    "X9 the why-is-this-hand-written lesson lives next to the rules");
}

/* ============ M: mobile 390×844 ============ */
console.log("== M: mobile 390×844 ==");
{
  await mPage.goto(BASE, { waitUntil: "networkidle" });
  await sleep(2500);
  const li = await fireToast(mPage, 390);

  const modality = await mPage.evaluate(() => ({
    hoverNone: matchMedia("(hover: none)").matches,
    coarse: matchMedia("(pointer: coarse)").matches,
  }));
  must(modality.hoverNone && modality.coarse,
    `M0 the mobile context reports the touch modality (hover:none=${modality.hoverNone}, coarse=${modality.coarse})`);

  const closeState = await li.evaluate((root) => {
    const btn = root.querySelector("[toast-close]");
    if (!btn) return null;
    const cs = getComputedStyle(btn);
    const before = getComputedStyle(btn, "::before");
    const r = btn.getBoundingClientRect();
    const bw = parseFloat(before.width) || 0, bh = parseFloat(before.height) || 0;
    return {
      opacity: cs.opacity,
      paintedW: Math.round(r.width), paintedH: Math.round(r.height),
      beforeW: Math.round(bw), beforeH: Math.round(bh),
      effW: Math.round(Math.max(r.width, bw)), effH: Math.round(Math.max(r.height, bh)),
    };
  });
  must(!!closeState, "M1 ToastClose exists in the sheet-form toast");
  must(closeState && closeState.opacity === "1",
    `M2 the close is REVEALED on touch (computed opacity ${closeState?.opacity} — was "0")`);
  must(closeState && closeState.effW >= 44 && closeState.effH >= 44 && closeState.paintedW <= 24,
    `M3 tappable ${closeState?.effW}×${closeState?.effH} ≥44 while painted stays ${closeState?.paintedW}×${closeState?.paintedH}`);

  const dir = await li.getAttribute("data-swipe-direction");
  must(dir === "up", `M4 direction is UP at 390px (got "${dir}" — placement is top, exit follows)`);

  // drag-follow live: the finger moves, the toast MOVES (was: var moved,
  // transform none)
  const box = await li.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await mPage.mouse.move(cx, cy);
  await mPage.mouse.down();
  const follow = [];
  for (const dy of [-60, -110]) {
    await mPage.mouse.move(cx, cy + dy, { steps: 4 });
    await sleep(50);
    follow.push(await li.evaluate((n) => {
      const t = getComputedStyle(n).transform;
      let ty = null;
      const m = t.match(/matrix.*\((.+)\)/);
      if (m) { const parts = m[1].split(",").map(parseFloat); ty = parts[5] ?? parts[1]; }
      return { swipe: n.getAttribute("data-swipe"), transform: t, ty };
    }));
  }
  must(follow[0].swipe === "move" && follow[1].swipe === "move",
    "M5 the drag is LIVE (data-swipe=move through the pull)");
  must(follow[0].ty !== null && follow[0].ty < -20 && follow[1].ty < -60,
    `M6 the toast FOLLOWS the finger (translateY ${follow[0].ty} → ${follow[1].ty}px — was "none")`);
  await mPage.mouse.up();
  await sleep(700);
  const afterExit = await mPage.locator('li[data-swipe-direction][data-state="open"]').count();
  const anyLi = await mPage.locator("li[data-swipe-direction]").count();
  must(afterExit === 0 && anyLi === 0,
    `M7 release past the threshold dismisses (open=0, any li=0 — Radix unmounts, got open=${afterExit} any=${anyLi})`);

  // spring-back: a SHORT pull (delta 20 × mouse factor 2 = 40 < 50) cancels
  const li2 = await fireToast(mPage, 390);
  const b2 = await li2.boundingBox();
  const c2x = b2.x + b2.width / 2, c2y = b2.y + b2.height / 2;
  await mPage.mouse.move(c2x, c2y);
  await mPage.mouse.down();
  await mPage.mouse.move(c2x, c2y - 20, { steps: 4 });
  await sleep(60);
  await mPage.mouse.up();
  await sleep(700);
  const spring = await li2.evaluate((n) => ({
    still: document.contains(n),
    state: n.getAttribute("data-state"),
    transform: getComputedStyle(n).transform,
  })).catch(() => ({ still: false }));
  must(spring.still && spring.state === "open",
    "M8 a short pull springs back — the toast survives (delta×2 < threshold)");
  must(spring.transform === "none" || /matrix\(1, 0, 0, 1, 0, 0\)/.test(spring.transform),
    `M9 spring-back resets the follow transform (got "${spring.transform}")`);

  // the close bridge still closes (Radix may unmount outright or pass
  // through a closed animation state — what matters is the toast is no
  // longer OPEN)
  await li2.locator("[toast-close]").click({ force: true });
  await sleep(500);
  const openLeft = await mPage.locator('li[data-swipe-direction][data-state="open"]').count();
  const goneOrClosed = await li2.evaluate((n) => !document.contains(n) || n.getAttribute("data-state") === "closed").catch(() => true);
  must(openLeft === 0 && goneOrClosed, `M10 the close bridge dismisses (open left=${openLeft}, goneOrClosed=${goneOrClosed})`);

  const mOthers = consoleErrors.filter((e) => e.label === "mobile" && !/\/log\?|\/log\b/.test(e.text));
  must(mOthers.length === 0, `M11 console clean through the touch phase (got ${mOthers.length})`);
}

/* ============ D: desktop 1280 ============ */
console.log("== D: desktop 1280 ==");
{
  // a SEPARATE default page: hover:hover — the desktop face of the
  // contract (hover-none: reveals NOTHING here)
  const dPage = await browser.newPage({ viewport: { width: 1280, height: 844 } });
  trackConsole(dPage, "desktop");
  await dPage.goto(BASE, { waitUntil: "networkidle" });
  await sleep(2000);
  const li = await fireToast(dPage, null);
  const closeOpacity = await li.evaluate((root) => {
    const btn = root.querySelector("[toast-close]");
    return btn ? getComputedStyle(btn).opacity : null;
  });
  must(closeOpacity === "0",
    `D1 hover convention KEPT on desktop (close opacity ${closeOpacity} — hover-none: only reveals on touch)`);
  const dir = await li.getAttribute("data-swipe-direction");
  must(dir === "right", `D2 direction is RIGHT above sm: (got "${dir}")`);

  const box = await li.boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await dPage.mouse.move(cx, cy);
  await dPage.mouse.down();
  await dPage.mouse.move(cx + 90, cy, { steps: 4 });
  await sleep(50);
  const dFollow = await li.evaluate((n) => {
    const t = getComputedStyle(n).transform;
    const m = t.match(/matrix.*\((.+)\)/);
    const tx = m ? parseFloat(m[1].split(",")[4]) : null;
    return { swipe: n.getAttribute("data-swipe"), tx };
  });
  must(dFollow.swipe === "move" && dFollow.tx !== null && dFollow.tx > 40,
    `D3 the corner toast follows the finger right (translateX ${dFollow.tx}px)`);
  await dPage.mouse.up();
  await sleep(700);
  must(await dPage.locator('li[data-swipe-direction][data-state="open"]').count() === 0,
    "D4 release dismisses on desktop too");

  // vertical is NOT the direction up here — the contract's other face
  const li2 = await fireToast(dPage, null);
  const b2 = await li2.boundingBox();
  const c2x = b2.x + b2.width / 2, c2y = b2.y + b2.height / 2;
  await dPage.mouse.move(c2x, c2y);
  await dPage.mouse.down();
  await dPage.mouse.move(c2x, c2y - 140, { steps: 4 });
  await sleep(60);
  const vDrag = await li2.evaluate((n) => ({
    swipe: n.getAttribute("data-swipe"),
    still: document.contains(n),
  }));
  must(vDrag.swipe === null && vDrag.still,
    `D5 a vertical drag is IGNORED when direction is right (data-swipe="${vDrag.swipe}") — the gesture contract has two faces`);
  await dPage.mouse.up();
  await dPage.close();
}

/* ============ Z: roster identity ============ */
console.log("== Z: roster identity ==");
{
  const after = await (await fetch(BASE + "/api/jobs")).json();
  const alist = Array.isArray(after) ? after : after.jobs ?? [];
  const idName = (l) => l.map((j) => `${j.id}|${j.name}`).sort().join(",");
  must(idName(alist) === idName(list),
    "Z roster identical to baseline (id+name membership — the toasts litter nothing)");
}

console.log(`\nT174 ${failed === 0 ? "ALL PASS" : "FAILED"} (${passed} assertions, ${failed} failures)`);
await browser.close();
process.exit(failed === 0 ? 0 : 1);

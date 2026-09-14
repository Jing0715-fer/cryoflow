#!/usr/bin/env node
/* t177 — the destructive truce + the title's breathing room.
 *
 * Task 175 unified the --destructive TOKEN; this round audits the FACES.
 * The census (grep + photo) found six grains:
 *   ① THREE hardcoded `bg-rose-600 text-white` confirm buttons (page.tsx
 *      single + bulk delete, canvas.tsx multi delete) — rose, not the
 *      token red, no dark adaptation: three dialogs agreed with each
 *      other but disagreed with the toast and the B-family confirms.
 *   ② button.tsx destructive variant: `text-white` + `dark:bg-destructive/60`
 *      — in dark the washed 60%-alpha red reads DISABLED next to the
 *      toast's full red. badge.tsx carried the same one-off wash.
 *   ③ job-inspector failed-card icon: text-rose-600 with NO dark variant
 *      (dark red icon on dark card — every sibling text uses rose-300/400).
 *   ④ inspector identity row at 269px: badge squeezed a long title into
 *      "Q…" — flex-wrap below sm lets the badge step aside.
 *   ⑤ job-card's own single-delete confirm: a HYBRID (token bg + hardcoded
 *      text-white, no focus ring) — the sixth face found while wiring the
 *      probe, invisible to both the rose-grep and the variant-grep.
 *   ⑥ alert.tsx destructive variant: ZERO consumers — audited, no face to
 *      photograph, left as-is (noted in worklog, no probe assertion).
 *
 * Probe contract:
 *   S  baseline + roster
 *   X  source oracles (rose-600 gone, token strings in, /60 wash gone,
 *      identity-row wrap, dark icon variant, token unity regression guard)
 *   M  280×653 iPhone-13 context: long title un-truncated with badge
 *      wrapped below; Shift-drag band selects two cards → Delete key →
 *      the BULK confirm (page.tsx face) measured in LIGHT and DARK —
 *      same token red, rasterized ratio ≥ 4.4; Cancel walks out, roster safe
 *   D  1440 desktop: badge shares the title line (max-sm scoping);
 *      right-click → single confirm (job-card face) + band → bulk face,
 *      same red both themes; console clean
 *   Z  roster identity
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
let failures = 0, assertions = 0;
const must = (cond, label) => {
  assertions++;
  if (cond) console.log(`  ok: ${label}`);
  else { failures++; console.log(`  FAIL: ${label}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
import { readFileSync } from "node:fs";
const src = (p) => readFileSync(`/home/z/my-project/${p}`, "utf8");

const consoleErrors = [], failedUrls = [];
async function trackConsole(page, label) {
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push({ label, text: m.text() }); });
  page.on("pageerror", (e) => consoleErrors.push({ label, text: String(e) }));
  page.on("response", (r) => { if (r.status() >= 400) failedUrls.push(`${label} ${r.status()} ${r.url()}`); });
}

/* WCAG ratio over rasterized sRGB (the t175 doctrine: never do color math
   on oklch/lab components — rasterize through the browser's own canvas) */
const lum = ([r, g, b]) => {
  const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [hi, lo] = lum(a) > lum(b) ? [lum(a), lum(b)] : [lum(b), lum(a)];
  return (hi + 0.05) / (lo + 0.05);
};
/* measure the destructive Action in the topmost confirm dialog */
const MEASURE = `(() => {
  const dlg = document.querySelector('[role="alertdialog"]');
  if (!dlg) return null;
  const action = [...dlg.querySelectorAll("button")].find(b => (b.className || "").includes("bg-destructive"));
  const title = dlg.querySelector("h2, [class*='font-semibold']");
  if (!action) return { dlg: true, action: false, title: title?.textContent ?? "" };
  const rast = (col) => {
    const c = document.createElement("canvas"); c.width = c.height = 1;
    const x = c.getContext("2d"); x.fillStyle = col; x.fillRect(0, 0, 1, 1);
    const d = x.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2]];
  };
  const cs = getComputedStyle(action);
  const r = action.getBoundingClientRect();
  return { action: true, bg: cs.backgroundColor, fg: cs.color,
    bgRgb: rast(cs.backgroundColor), fgRgb: rast(cs.color),
    w: Math.round(r.width), h: Math.round(r.height), title: title?.textContent ?? "" };
})()`;

const browser = await chromium.launch();

/* ============ S: baseline ============ */
console.log("== S: baseline ==");
const jobs = await (await fetch(BASE + "/api/jobs")).json();
const list = Array.isArray(jobs) ? jobs : jobs.jobs ?? [];
const roster = list.map((j) => `${j.id}|${j.name}`).sort();
const running = list.find((j) => j.status === "running" && (j.name || "").length >= 10);
const compLong = list.find((j) => j.status === "completed" && (j.name || "").length >= 10);
const idle = list.find((j) => j.status === "idle");
must(list.length > 0, `S1 world alive (${list.length} jobs)`);
must(!!running, `S2 a long-named running job exists (${running?.name})`);
must(!!compLong, `S3 a long-named completed job exists (${compLong?.name})`);
must(!!idle, `S4 an idle job exists (${idle?.name})`);

/* ============ X: source oracles ============ */
console.log("== X: source oracles ==");
{
  const pageSrc = src("src/app/page.tsx");
  must(!pageSrc.includes("bg-rose-600"),
    "X1 page.tsx has no hardcoded rose-600 confirm left (single + bulk both on token)");
  must((pageSrc.match(/bg-destructive text-destructive-foreground hover:bg-destructive\/90/g) || []).length === 2,
    "X2 both page confirms ride the token (bg-destructive + token foreground + /90 hover)");
  const canvasSrc = src("src/components/workflow/canvas.tsx");
  must(!canvasSrc.includes("bg-rose-600"),
    "X3 canvas confirm off rose-600 (the multi-delete dialog joins the truce)");
  must(canvasSrc.includes("bg-destructive text-destructive-foreground hover:bg-destructive/90"),
    "X4 canvas confirm rides the token");
  /* check the variant STRING itself — comments may name the old classes */
  const variantStr = (s) => (s.match(/destructive:\s*(?:\/\*[\s\S]*?\*\/\s*)?"([^"]+)"/) || [])[1] ?? "";
  const btnV = variantStr(src("src/components/ui/button.tsx"));
  must(btnV.includes("text-destructive-foreground") && !btnV.includes("text-white"),
    "X5 button destructive variant: token foreground (text-white retired)");
  must(!btnV.includes("/60"),
    "X6 button destructive variant: the 60%-alpha dark wash is gone (full token red both themes)");
  const badgeV = variantStr(src("src/components/ui/badge.tsx"));
  must(badgeV.includes("bg-destructive text-destructive-foreground") && !badgeV.includes("/60"),
    "X7 badge destructive variant: same truce (token fg, no dark wash)");
  const cardSrc = src("src/components/workflow/job-card.tsx");
  must(!cardSrc.includes("bg-destructive text-white"),
    "X8 job-card confirm hybrid retired (token bg + text-white was grain five)");
  must((cardSrc.match(/bg-destructive text-destructive-foreground hover:bg-destructive\/90/g) || []).length === 1,
    "X9 job-card confirm rides the exact family string");
  const inspSrc = src("src/components/workflow/job-inspector.tsx");
  must(inspSrc.includes("flex max-sm:flex-wrap items-center gap-2"),
    "X10 identity row: badge steps aside below sm (max-sm:flex-wrap)");
  must(/title=\{job\.name\}>\s*\n\s*\{job\.name\}/.test(inspSrc),
    "X11 the title carries its hover reveal (title attr = job name)");
  must(inspSrc.includes("bg-rose-600/15 text-rose-600 dark:text-rose-400"),
    "X12 failed-card icon wears dark:text-rose-400 (was invisible dark-red-on-dark)");
  const globals = src("src/app/globals.css");
  const light = globals.match(/--destructive: ([^;]+);/g) || [];
  must(light.length === 2 && light[0] === light[1],
    "X13 Task 175 guard: ONE destructive value, light and .dark identical");
}

/* shared: place a card so its CENTER sits at (tx,ty) (computed pan) */
function makePlacer(page, list) {
  return async function placeCard(id, tx, ty) {
    const job = list.find((j) => j.id === id);
    const vp = await page.evaluate(() => {
      const w = document.querySelector('[data-canvas="workspace"]');
      const t = getComputedStyle(w).transform;
      const m = new DOMMatrixReadOnly(t === "none" ? "" : t);
      return { x: m.e, y: m.f, z: m.a };
    });
    const wx = job?.x ?? 0, wy = job?.y ?? 0;
    const d = await page.evaluate(({ vpx, vpy, vpz, wx, wy, tx, ty }) => ({
      dx: tx - (wx * vpz + vpx), dy: ty - (wy * vpz + vpy),
    }), { vpx: vp.x, vpy: vp.y, vpz: vp.z, wx, wy, tx, ty });
    /* adaptive start points: proportional to the viewport (the fixed
       140/60-column list put the desktop drag INSIDE the palette rail —
       x=140 < rail width 279 — and the "pan" silently did nothing), and
       every candidate must be ON the canvas viewport, off cards/buttons */
    const W = await page.evaluate(() => innerWidth), H = await page.evaluate(() => innerHeight);
    const cands = [[0.5, 0.42], [0.5, 0.66], [0.28, 0.42], [0.72, 0.42], [0.5, 0.82], [0.3, 0.8]]
      .map(([fx, fy]) => [Math.round(W * fx), Math.round(H * fy)]);
    for (const [sx, sy] of cands) {
      const ok = await page.evaluate(([sx, sy]) => {
        const el = document.elementFromPoint(sx, sy);
        return !!el && !!el.closest('[data-canvas="viewport"]') && !el.closest("[data-job]") && !el.closest("button");
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
  };
}

/* ============ M: 280×653 fold band ============ */
if (process.env.SKIP_M) { console.log("== M: SKIPPED (SKIP_M) =="); } else
console.log("== M: fold band (280×653 touch) ==");
const context = await browser.newContext({
  viewport: { width: 280, height: 653 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3,
});
const page = await context.newPage();
trackConsole(page, "mobile");
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2500);
const placeCard = makePlacer(page, list);

const identityRow = () => page.evaluate(() => {
  const dlg = document.querySelector("[data-inspector-dialog]");
  if (!dlg) return null;
  const h2 = dlg.querySelector("h2");
  if (!h2) return null;
  const badge = h2.parentElement.querySelector("[class*='rounded-full']");
  const H = h2.getBoundingClientRect(), B = badge?.getBoundingClientRect();
  return {
    name: h2.textContent, titleAttr: h2.getAttribute("title"),
    w: Math.round(H.width), truncated: h2.scrollWidth > h2.clientWidth + 1,
    wrapped: B ? B.top > H.top + 4 : null, badgeTop: B ? Math.round(B.top) : null,
    titleTop: Math.round(H.top),
  };
});

// M1 — the running job: badge below, title whole
{
  const spot = await placeCard(running.id, 140, 320);
  must(spot && spot.inVp, "M1a the running card is placed in-viewport (computed pan)");
  await page.touchscreen.tap(spot.x, spot.y);
  await sleep(1800);
  const row = await identityRow();
  must(row && row.name === running.name, `M1b inspector opens on “${running.name}”`);
  must(row && !row.truncated, "M1c the title is NOT truncated at 269px (was “Q…”)");
  must(row && row.w >= 100, `M1d the title breathes (${row?.w}px ≥ 100)`);
  must(row && row.wrapped === true,
    `M1e the badge stepped aside (badge top ${row?.badgeTop} > title top ${row?.titleTop})`);
  must(row && row.titleAttr === running.name, "M1f the hover reveal is wired (title attr = job name)");
  await page.keyboard.press("Escape");
  await sleep(700);
}

// M2 — a completed job: same truce, same shape
{
  const spot = await placeCard(compLong.id, 140, 320);
  must(spot && spot.inVp, "M2a the completed card is placed in-viewport");
  await page.touchscreen.tap(spot.x, spot.y);
  await sleep(1800);
  const row = await identityRow();
  must(row && !row.truncated, `M2b “${compLong.name}” reads whole at 269px`);
  must(row && row.wrapped === true, "M2c badge wrapped below (long name + badge > one 129px line)");
  await page.keyboard.press("Escape");
  await sleep(700);
}

/* the bulk destructive: Shift-drag a rubber band over two cards, Delete key.
   NEVER click Delete — Cancel walks out, the roster must not move.
   Coordinates are re-read AFTER both placements: placing B pans the world
   and drags A with it — the pre-placement position of A is stale. The band
   starts OUTSIDE the pair's bounding box (up-left) — a start inside the
   span would miss the left card or grab a card and drag it instead. */
async function bandSelectTwo(pageRef, placeFn, idA, idB, maxX, txA = 90, txB = 205, ty = 300) {
  await placeFn(idA, txA, ty);
  const b = await placeFn(idB, txB, ty);
  if (!b?.inVp) return null;
  const rect = async (want) => pageRef.evaluate((want) => {
    const c = [...document.querySelectorAll("[data-job]")].find((el) => el.getAttribute("data-job") === want);
    const r = c?.getBoundingClientRect();
    return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2,
      inVp: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth } : null;
  }, want);
  const a = await rect(idA);
  if (!a?.inVp) return null;
  const minx = Math.min(a.x, b.x), maxx = Math.max(a.x, b.x);
  const miny = Math.min(a.y, b.y), maxy = Math.max(a.y, b.y);
  let start = null;
  for (const [dx, dy] of [[-18, -48], [-18, -78], [-46, -48], [-60, -20], [-18, 90], [18, 96]]) {
    const [sx, sy] = [minx + dx, miny + dy];
    if (sx < 4 || sy < 4 || sx > maxX - 8 || sy > 640) continue;
    const ok = await pageRef.evaluate(([sx, sy]) => {
      const el = document.elementFromPoint(sx, sy);
      return !!el && !!el.closest('[data-canvas="viewport"]') && !el.closest("[data-job]") && !el.closest("button");
    }, [sx, sy]);
    if (ok) { start = [sx, sy]; break; }
  }
  if (!start) return null;
  await pageRef.keyboard.down("Shift");
  await pageRef.mouse.move(start[0], start[1]);
  await pageRef.mouse.down();
  await pageRef.mouse.move(Math.min(maxx + 16, maxX), maxy + 40, { steps: 10 });
  await pageRef.mouse.up();
  await pageRef.keyboard.up("Shift");
  await sleep(800);
  const ringSel = await pageRef.evaluate(() =>
    [...document.querySelectorAll("[data-job]")].filter((c) => (c.className || "").includes("ring-2")).length);
  return { a, b, ringSel };
}
async function openBulkByDeleteKey() {
  await page.keyboard.press("Delete");
  await sleep(900);
  return page.evaluate(() => {
    const dlg = document.querySelector('[role="alertdialog"]');
    return dlg ? (dlg.querySelector("h2, [class*='font-semibold']")?.textContent ?? "?") : null;
  });
}
async function cancelConfirmOn(pageRef, label = "Cancel") {
  await pageRef.evaluate((label) => {
    const dlg = document.querySelector('[role="alertdialog"]');
    const c = [...(dlg?.querySelectorAll("button") ?? [])].find((b) => (b.textContent || "").trim() === label);
    c?.click();
  }, label);
  await sleep(700);
  return pageRef.evaluate(() => !document.querySelector('[role="alertdialog"]'));
}

let lightM = null;
{
  const band = await bandSelectTwo(page, placeCard, idle.id, compLong.id, 280);
  must(!!band, `M3a the rubber band swept both placed cards (shift+drag; ring-selected ${band?.ringSel ?? "?"})`);
  const title = await openBulkByDeleteKey();
  must(title !== null, `M3b the BULK confirm opens at 280 via Delete key (title “${title}”)`);
  lightM = await page.evaluate(MEASURE);
  must(lightM?.action, "M3c the destructive Action found in the dialog");
  if (lightM?.action) {
    const r = ratio(lightM.fgRgb, lightM.bgRgb);
    must(r >= 4.4, `M3d LIGHT: ink on the token red ${r.toFixed(2)}:1 ≥ 4.4 (${lightM.fg} on ${lightM.bg})`);
    must(lightM.w >= 40 && lightM.h >= 40, `M3e the confirm keeps tappable size (${lightM.w}×${lightM.h}) — the family now carries h-10`);
  }
  must(await cancelConfirmOn(page), "M3f Cancel walks out clean (dialog gone, nothing deleted)");
}
{
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await sleep(500);
  const title = await openBulkByDeleteKey();
  must(title !== null, "M4a the bulk confirm reopens under dark (selection survived Cancel)");
  const darkM = await page.evaluate(MEASURE);
  if (darkM?.action && lightM?.action) {
    must(darkM.bgRgb.join(",") === lightM.bgRgb.join(","),
      `M4b the TRUCE: dark red == light red (${darkM.bgRgb} vs ${lightM.bgRgb}; the /60 wash would have diverged)`);
    const r = ratio(darkM.fgRgb, darkM.bgRgb);
    must(r >= 4.4, `M4c DARK: ink on the token red ${r.toFixed(2)}:1 ≥ 4.4`);
  } else must(false, "M4b/c measurable dark Action");
  must(await cancelConfirmOn(page), "M4d Cancel walks out clean under dark");
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  await sleep(400);
}
{
  const seen = consoleErrors.filter((e) => e.label === "mobile");
  must(seen.length === 0 && failedUrls.filter((u) => u.startsWith("mobile")).length === 0,
    `M5 mobile console contract-clean (${seen.length} errors, ${failedUrls.filter((u) => u.startsWith("mobile")).length} bad URLs)`);
}
await page.close();
await context.close();

/* ============ D: desktop ============ */
console.log("== D: desktop (1440) ==");
const dpage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
trackConsole(dpage, "desktop");
await dpage.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);
/* zoom in FIRST: at the 25% floor the cards are ~55px wide and the edges'
   16px hover corridors cover nearly every point of them — the corridor
   steals both left- and right-clicks. Three notches in (25→50%) gives the
   card a real body to click on, exactly what a human does. */
for (let i = 0; i < 3; i++) {
  await dpage.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Zoom in"]');
    btn?.click();
  });
  await sleep(450);
}
const dPlace = makePlacer(dpage, list);
/* the browser's own story: log every contextmenu + menu-item activation */
await dpage.evaluate(() => {
  window.__t177log = [];
  window.addEventListener("contextmenu", (e) => window.__t177log.push(`ctx@${Math.round(e.clientX)},${Math.round(e.clientY)} on ${e.target?.closest?.("[data-job]")?.getAttribute("data-job")?.slice(0, 6) ?? e.target?.tagName}`), true);
  document.addEventListener("click", (e) => {
    const mi = e.target?.closest?.('[role="menuitem"]');
    if (mi) window.__t177log.push(`menuitem-click: ${(mi.textContent || "").trim().slice(0, 20)}`);
  }, true);
});
/* settle-polling, edge-safe click point: the inspector's close pan ANIMATES
   the canvas (a rect read mid-flight is a stale coordinate) AND the edges'
   16px hover corridor (pointer-events:stroke, desktop) can sit ON TOP of a
   small card's center and steal the contextmenu into the canvas menu.
   So: poll until the rect stops moving, then spiral over candidate points
   inside the card until elementFromPoint actually belongs to THIS card. */
const cardPoint = async (id) => {
  /* the palette rail covers the canvas's left third — scrollIntoView parks
     the card UNDER it (observed: a palette category button over the whole
     card). Place it in the free center field with the computed pan instead
     (the same placer the fold band uses), then spiral within the rect.
     Three full retries: the inspector's exit animation can swallow the
     pan drag (every candidate reads the overlay → no drag happens). */
  for (let attempt = 0; attempt < 3; attempt++) {
    const placed = await dPlace(id, 720, 450);
    if (process.env.T177_DEBUG) console.log(`    [cp] attempt ${attempt}: placed=${JSON.stringify(placed)}`);
    if (!placed) { await sleep(600); continue; }
    const rect = await dpage.evaluate((want) => {
      const c = [...document.querySelectorAll("[data-job]")].find((el) => el.getAttribute("data-job") === want);
      const r = c?.getBoundingClientRect();
      return r ? { x: r.x, y: r.y, w: r.width, h: r.height, inVp: true } : null;
    }, id);
    if (process.env.T177_DEBUG) console.log(`    [cp] attempt ${attempt}: rect=${JSON.stringify(rect)}`);
    if (!rect) { await sleep(600); continue; }
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  /* dense grid: a 121×53 card at 55% zoom carries edge corridors (16px per
     side) across its middle — 9 offsets can land entirely inside them;
     28 points sweep the whole body */
  const offs = [];
  for (const dx of [-45, -30, -15, 0, 15, 30, 45]) for (const dy of [-15, -5, 5, 15]) offs.push([dx, dy]);
  for (const [dx, dy] of offs) {
    const px = Math.min(Math.max(cx + dx, rect.x + 3), rect.x + rect.w - 3);
    const py = Math.min(Math.max(cy + dy, rect.y + 3), rect.y + rect.h - 3);
    const ok = await dpage.evaluate(([px, py, want]) => {
      const el = document.elementFromPoint(px, py);
      return !!el && !!el.closest(`[data-job="${want}"]`);
    }, [px, py, id]);
    if (ok) return { x: px, y: py, inVp: rect.inVp };
  }
  if (process.env.T177_DEBUG) {
    const what = await dpage.evaluate(([px, py]) => {
      const el = document.elementFromPoint(px, py);
      const bodyKids = [...document.querySelectorAll("body > div")].slice(0, 30).map((d) => {
        const cls = typeof d.className === "string" ? d.className : "";
        return `${d.getAttribute("role") ?? d.tagName.toLowerCase()}:${d.getAttribute("data-state") ?? "-"}:${cls.includes("animate-out") ? "ghost" : "x"}:${Math.round(d.getBoundingClientRect().width)}x${Math.round(d.getBoundingClientRect().height)}`;
      });
      const ad = document.querySelector('[role="alertdialog"]');
      return { at: `${Math.round(px)},${Math.round(py)}`, adTitle: ad?.querySelector("h2")?.textContent ?? null, log: window.__t177log ?? [] };
    }, [rect.x + rect.w / 2, rect.y + rect.h / 2]);
    console.log(`    [cp] attempt ${attempt}: spiral 0/${offs.length}; what=${JSON.stringify(what)}`);
  }
  await sleep(600);
  }
  return null;
};

{
  const spot = await cardPoint(compLong.id);
  must(spot && spot.inVp, "D1 the completed card scrolled into view");
  await dpage.mouse.click(spot.x, spot.y);
  await sleep(1800);
  const row = await dpage.evaluate(() => {
    const dlg = document.querySelector("[data-inspector-dialog]");
    const h2 = dlg?.querySelector("h2");
    if (!h2) return null;
    const badge = h2.parentElement.querySelector("[class*='rounded-full']");
    const H = h2.getBoundingClientRect(), B = badge?.getBoundingClientRect();
    return { truncated: h2.scrollWidth > h2.clientWidth + 1,
      sameLine: B ? Math.abs(B.top - H.top) < 4 : null, name: h2.textContent };
  });
  must(row && row.name === compLong.name, `D2 inspector opens on “${compLong.name}” at 1440 (real mouse click)`);
  must(row && row.sameLine === true, "D3 ≥sm keeps the badge on the title line (max-sm scoping)");
  must(row && !row.truncated, "D4 desktop title un-truncated");
  await dpage.keyboard.press("Escape");
  await sleep(1300);
  if (process.env.T177_DEBUG) {
    const snap = await dpage.evaluate(() => {
      const ad = document.querySelector('[role="alertdialog"]');
      const dialogs = [...document.querySelectorAll("body > [role]")].map((d) => `${d.getAttribute("role")}:${d.getAttribute("data-state")}:${(ad?.querySelector("h2")?.textContent ?? d.getAttribute("aria-label") ?? "").slice(0, 26)}`);
      return { dialogs, inspOpen: !!document.querySelector("[data-inspector-dialog]"), menuOpen: document.querySelectorAll('[role="menu"]').length };
    });
    console.log(`    [d2end] ${JSON.stringify(snap)}`);
  }
}

/* single-delete face: context menu → Delete (deepest-element dispatch +
   one retry — the right-click race is the probe's, not the product's) */
async function openSingleConfirm() {
  for (let attempt = 0; attempt < 3; attempt++) {
    const spot = await cardPoint(compLong.id);
    if (!spot) return { stage: "card-not-found" };
    // REAL right-click only: the synthetic contextmenu dispatch opens a
    // menu whose items list fine but whose item clicks never reach the
    // dialog (v4/v5 lesson — v2/v3's real clicks passed twice)
    await dpage.mouse.click(spot.x, spot.y, { button: "right" });
    await sleep(1000);
    const item = await dpage.evaluate(() => {
      const items = [...document.querySelectorAll('[role="menuitem"]')].map((m) => {
        const r = m.getBoundingClientRect();
        return { t: (m.textContent || "").trim().slice(0, 14), x: r.x, y: r.y, w: r.width, h: r.height, vis: r.width > 0 };
      });
      const del = items.find((m) => m.t.startsWith("Delete") && m.vis);
      return { del, all: items };
    });
    if (!item.del) {
      /* the canvas menu means the corridor stole the click — try the next
         spiral offset; only the JOB menu (has “Open inspector”) counts */
      await dpage.keyboard.press("Escape");
      await sleep(600);
      continue;
    }
    if (process.env.T177_DEBUG) console.log(`    [d5] attempt ${attempt}: delete item at (${Math.round(item.del.x)},${Math.round(item.del.y)}) ${Math.round(item.del.w)}x${Math.round(item.del.h)}; all: ${item.all.map((m) => `${m.t}@${Math.round(m.y)}`).join(", ")}`);
    /* the diag-proven cadence: Radix menu items drop a zero-gap
       move+down+up — the pointerenter tracking needs a beat to latch */
    await dpage.mouse.move(item.del.x + item.del.w / 2, item.del.y + Math.min(10, item.del.h / 2));
    await sleep(250);
    await dpage.mouse.down();
    await sleep(120);
    await dpage.mouse.up();
    /* the dialog mounts LATE when the canvas is settling (observed: open
       at +1050ms, absent at +1000ms) — poll instead of a fixed sleep,
       and never Esc between attempts (the retry's Esc kept killing the
       late-arriving dialog) */
    let m = null;
    for (let i = 0; i < 10; i++) {
      await sleep(300);
      m = await dpage.evaluate(MEASURE);
      if (process.env.T177_DEBUG) console.log(`    [d5-poll] ${i}: ${m ? (m.action ? "ACTION" : `dlg-no-action (${m.title})`) : "no-dialog"}`);
      if (m && (m.action || m.dlg)) return m;
    }
    if (attempt === 0) continue;
    return { stage: "no-dialog-after-item-click" };
  }
}

let dSingleLight = null;
{
  dSingleLight = await openSingleConfirm();
  must(dSingleLight?.action, `D5 the SINGLE confirm opens via context menu (“${dSingleLight?.title ?? dSingleLight?.stage ?? "none"}”)`);
  if (dSingleLight?.action) {
    const r = ratio(dSingleLight.fgRgb, dSingleLight.bgRgb);
    must(r >= 4.4, `D6 the job-card face LIGHT ${r.toFixed(2)}:1 ≥ 4.4`);
  }
  must(await cancelConfirmOn(dpage, "Keep job"), "D7 “Keep job” walks out clean");
}
{
  await dpage.evaluate(() => document.documentElement.classList.add("dark"));
  await sleep(500);
  const dDark = await openSingleConfirm();
  if (dDark?.action && dSingleLight?.action) {
    must(dDark.bgRgb.join(",") === dSingleLight.bgRgb.join(","),
      `D8 the job-card face: dark red == light red (${dDark.bgRgb} vs ${dSingleLight.bgRgb})`);
    const r = ratio(dDark.fgRgb, dDark.bgRgb);
    must(r >= 4.4, `D9 the job-card face DARK ${r.toFixed(2)}:1 ≥ 4.4`);
  } else must(false, `D8/D9 measurable dark single confirm (got stage: ${dDark?.stage ?? (dDark?.action ? "ok" : "null")})`);
  must(await cancelConfirmOn(dpage, "Keep job"), "D10 “Keep job” walks out under dark");
  await dpage.evaluate(() => document.documentElement.classList.remove("dark"));
  await sleep(400);
}

/* bulk face at desktop: the SAME placed-band dance as the fold band */
{
  const band = await bandSelectTwo(dpage, dPlace, idle.id, compLong.id, 1440, 600, 850, 350);
  must(!!band, `D11 the desktop band selected the placed pair (ring-selected ${band?.ringSel ?? "?"})`);
  if (band) {
    await dpage.keyboard.press("Delete");
    await sleep(900);
    const bulk = await dpage.evaluate(MEASURE);
    must(bulk?.action && /Delete \d+ jobs/.test(bulk.title), `D12 the BULK face opens (“${bulk?.title}”)`);
    if (bulk?.action && lightM?.action) {
      must(bulk.bgRgb.join(",") === lightM.bgRgb.join(","),
        "D13 the bulk face == the mobile bulk face (one token everywhere)");
    }
    must(await cancelConfirmOn(dpage), "D14 Cancel walks out (bulk, desktop)");
  }
}
{
  const seen = consoleErrors.filter((e) => e.label === "desktop");
  must(seen.length === 0, `D15 desktop console clean (${seen.length})`);
}
await dpage.close();

/* ============ Z: roster identity ============ */
console.log("== Z: roster identity ==");
{
  const after = await (await fetch(BASE + "/api/jobs")).json();
  const afterList = Array.isArray(after) ? after : after.jobs ?? [];
  const afterRoster = afterList.map((j) => `${j.id}|${j.name}`).sort();
  must(JSON.stringify(afterRoster) === JSON.stringify(roster),
    `Z roster identical to baseline (${afterList.length} jobs, Cancel/Keep never deleted)`);
}

await browser.close();
console.log(failures === 0
  ? `\nT177 ALL PASS (${assertions} assertions, 0 failures)`
  : `\nT177 FAILED (${failures} of ${assertions} assertions)`);
process.exit(failures === 0 ? 0 : 1);

#!/usr/bin/env node
/**
 * diag-affordance.mjs — Task 175 reconnaissance: the affordance legibility
 * census. Three grains, measured against the LIVE (unfixed) build:
 *
 *  ① destructive toast contrast — the close X is group-[.destructive]:
 *    text-red-300 on bg-destructive. The light token is red-600 (oklch
 *    0.577) → ~2.5:1; the DARK token is red-400 (oklch 0.704 — BRIGHTER!)
 *    → red-300 on red-400 collapses to ~1.5:1, a ghost on its own card.
 *  ② the swipe echo is hardcoded black — rgba(0,0,0,0.16) over a dark
 *    card adds black to near-black: invisible. Verified with REAL PIXELS
 *    (sharp-decoded screenshot, patch sampling on/off the echo band).
 *  ③ the grabber never moves — a static pill; no first-open invitation.
 *
 * Trigger recipe for the destructive toast: a synthetic drop of a .txt
 * onto the canvas — collectDroppedFiles' .files fallback (documented for
 * "synthetic drops in tests") yields offered=1, files=0 (the .json gate
 * skips it) → the honest "Nothing to import" destructive toast fires.
 */
import { chromium, devices } from "playwright";
import sharp from "sharp";

const BASE = "http://localhost:3000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const lum = ([r, g, b]) => {
  const f = (c) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [hi, lo] = lum(a) > lum(b) ? [lum(a), lum(b)] : [lum(b), lum(a)];
  return (hi + 0.05) / (lo + 0.05);
};
const parseRgb = (s) => (s.match(/\d+/g) || []).slice(0, 3).map(Number);

const browser = await chromium.launch();

/* ---- grain ① destructive toast contrast, LIGHT then DARK ---- */
console.log("== grain ① destructive toast contrast ==");
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 844 } });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await sleep(2200);

  async function fireDestructive(pg) {
    return pg.evaluate(() => {
      const canvas = document.querySelector('[data-canvas="viewport"]');
      if (!canvas) return "no-canvas";
      const dt = new DataTransfer();
      dt.items.add(new File(["hello"], "notes.txt", { type: "text/plain" }));
      canvas.dispatchEvent(
        new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt })
      );
      return "dropped";
    });
  }
  const r0 = await fireDestructive(page);
  await sleep(900);
  const li = page.locator('li[data-swipe-direction][data-state="open"]').first();
  await li.waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
  const light = await li.evaluate((root) => {
    // Chromium computes oklch tokens to lab(...) — read TRUE sRGB by
    // rasterizing each color through a 1×1 canvas (the only conversion
    // the browser itself performs, for any color syntax).
    const toSrgb = (colorStr) => {
      const c = document.createElement("canvas");
      c.width = c.height = 1;
      const ctx = c.getContext("2d");
      ctx.fillStyle = colorStr;
      ctx.fillRect(0, 0, 1, 1);
      return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3));
    };
    const btn = root.querySelector("[toast-close]");
    const title = root.querySelector("[data-title], h2, [class*=font-semibold]") || root;
    return root.className.includes("destructive") && btn
      ? {
          variant: "destructive",
          xColor: toSrgb(getComputedStyle(btn).color).join(","),
          bg: toSrgb(getComputedStyle(root).backgroundColor).join(","),
          titleColor: toSrgb(getComputedStyle(title).color).join(","),
          title: (root.textContent || "").slice(0, 60),
          rawX: getComputedStyle(btn).color,
          rawBg: getComputedStyle(root).backgroundColor,
          rawTitle: getComputedStyle(title).color,
          tag: title.tagName + "." + (title.className || "").toString().slice(0, 50),
        }
      : { variant: root.className.slice(0, 80) };
  });
  console.log("  toast:", light.title, "| variant ok:", light.variant === "destructive");
  console.log("  LIGHT raw: X", light.rawX, "| bg", light.rawBg, "| title", light.rawTitle, "| matched:", light.tag);
  const xL = light.xColor.split(",").map(Number), bgL = light.bg.split(",").map(Number);
  const tL = light.titleColor.split(",").map(Number);
  console.log(`  LIGHT  X vs bg   : ${ratio(xL, bgL).toFixed(2)}:1  (bar 3:1) ${ratio(xL, bgL) >= 3 ? "PASS" : "FAIL"}`);
  console.log(`  LIGHT  title vs bg: ${ratio(tL, bgL).toFixed(2)}:1  (bar 4.5:1) ${ratio(tL, bgL) >= 4.5 ? "PASS" : "FAIL"}`);

  // flip to dark — tokens are class-driven, the LIVE li re-computes
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await sleep(400);
  const dark = await li.evaluate((root) => {
    const toSrgb = (colorStr) => {
      const c = document.createElement("canvas");
      c.width = c.height = 1;
      const ctx = c.getContext("2d");
      ctx.fillStyle = colorStr;
      ctx.fillRect(0, 0, 1, 1);
      return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3));
    };
    const btn = root.querySelector("[toast-close]");
    const title = root.querySelector("[data-title], h2, [class*=font-semibold]") || root;
    return {
      xColor: getComputedStyle(btn).color,
      bg: getComputedStyle(root).backgroundColor,
      titleColor: getComputedStyle(title).color,
      xSrgb: toSrgb(getComputedStyle(btn).color).join(","),
      bgSrgb: toSrgb(getComputedStyle(root).backgroundColor).join(","),
      titleSrgb: toSrgb(getComputedStyle(title).color).join(","),
    };
  });
  const xD = dark.xSrgb.split(",").map(Number), bgD = dark.bgSrgb.split(",").map(Number), tD = dark.titleSrgb.split(",").map(Number);
  console.log(`  DARK   X vs bg   : ${ratio(xD, bgD).toFixed(2)}:1  (bar 3:1) ${ratio(xD, bgD) >= 3 ? "PASS" : "FAIL"}`);
  console.log(`  DARK   title vs bg: ${ratio(tD, bgD).toFixed(2)}:1  (bar 4.5:1) ${ratio(tD, bgD) >= 4.5 ? "PASS" : "FAIL"}`);
  console.log(`  (colors: X ${dark.xColor} on bg ${dark.bg})`);
  await page.close();
}

/* ---- grains ② ③ the sheet's affordances, at 390×844 in the DARK ---- */
console.log("\n== grains ② ③ echo pixels + grabber animation ==");
{
  const ctx = await browser.newContext({
    ...devices["iPhone 13"],
    viewport: { width: 390, height: 844 },
  });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await sleep(2200);

  // FIT + pan until an idle card is visible (t173 methodology)
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll("button, [role=button], [role=tab]")];
    const fit = btns.find((b) => (b.textContent || "").trim().toUpperCase() === "FIT");
    if (fit) fit.click();
  });
  await sleep(1400);
  const jobs = await (await fetch(BASE + "/api/jobs")).json();
  const list = Array.isArray(jobs) ? jobs : jobs.jobs ?? [];
  const idleIds = new Set(list.filter((j) => j.status === "idle").map((j) => j.id));
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
  console.log("  idle card:", card ? card.id : "NONE");
  await page.touchscreen.tap(card.cx, card.cy);
  await sleep(1500);

  // grain ③: is the grabber animated?
  const grabber = await page.evaluate(() => {
    const g = document.querySelector('[role="dialog"] [data-swipe-grabber]');
    return g ? getComputedStyle(g).animationName : "absent";
  });
  console.log(`  grain ③ grabber animationName: "${grabber}" (static = none)`);

  // grain ②: mid-drag echo pixels in the DARK theme
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await sleep(500);
  const rect = await page.evaluate(() => {
    const r = document.querySelector('[role="dialog"]').getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  const startY = Math.min(rect.y + rect.h / 2, 480);
  await page.mouse.move(rect.x + 60, startY);
  await page.mouse.down();
  // deep drag: ~56% progress — visibility scales with progress (the
  // shade's opacity IS the drag fraction), so measure where an eye looks
  await page.mouse.move(rect.x + 280, startY, { steps: 10 });
  await sleep(150);
  const mid = await page.evaluate(() => {
    const el = document.querySelector('[role="dialog"][data-panel-sheet]');
    const cue = el.querySelector("[data-swipe-edge-cue]");
    return {
      transform: el.style.transform,
      cueBg: getComputedStyle(cue).backgroundImage.slice(0, 90),
      cueOp: getComputedStyle(cue).opacity,
      sx: el.getBoundingClientRect().x,
    };
  });
  console.log(`  mid-drag: transform=${mid.transform} cueOp=${mid.cueOp}`);
  console.log(`  echo gradient: ${mid.cueBg}...`);

  const shot = await page.screenshot();
  await page.mouse.up();
  await sleep(400);
  const { data, info } = await sharp(shot).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // physical pixels: the iPhone-13 context runs deviceScaleFactor 3 —
  // CSS coordinates must be scaled or the samples land on the canvas
  // behind the sheet (the diag's own second truth: a perfect Δ0.0 was
  // two identical CANVAS patches, not an invisible echo)
  const dpr = info.width / 390;
  const px = (cssX, cssY) => {
    const x = Math.round(cssX * dpr), y = Math.round(cssY * dpr);
    let r = 0, g = 0, b = 0, n = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const i = ((y + dy) * info.width + (x + dx)) * info.channels;
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
    }
    return [r / n, g / n, b / n];
  };
  const onEcho = px(mid.sx + 4, startY);
  const offEcho = px(mid.sx + 70, startY);
  const delta = Math.max(...onEcho.map((v, i) => Math.abs(v - offEcho[i])));
  console.log(`  DARK pixels  on-echo rgb(${onEcho.map(Math.round)}) vs card rgb(${offEcho.map(Math.round)}) → Δmax ${delta.toFixed(1)}`);
  console.log(`  grain ② verdict: echo ${delta < 8 ? "INVISIBLE in dark (FAIL)" : "visible (PASS)"}`);

  await ctx.close();
}

await browser.close();
console.log("\ndiag-affordance done");

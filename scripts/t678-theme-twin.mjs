// t678 — THE THEME TWIN CONTRACT.
//
// The forensic audit this window ran (worklog Task 678) closed a fossil
// ledger line ("~470 hardcoded color sites") and discovered the real
// living design underneath it:
//
//   1. The app is LIGHT-FIRST (footer says so) with a REAL theme toggle
//      (header sun/moon, next-themes, persisted in localStorage) — and
//      the toggle had ZERO regression coverage until now.
//   2. Token surfaces (body, palette, dashboard, inspector chrome) flip
//      coherently between the :root and .dark token blocks.
//   3. The image/console islands (log terminal, micrograph frames,
//      class tiles) are ALWAYS-DARK BY DESIGN: their zinc-950 grounds
//      and zinc inks are the island's own language, deliberately
//      theme-independent (images and consoles read on black; the print
//      boundary already adjudicates them). A future sweep that "fixes"
//      them to tokens would DESTROY the design.
//
// This probe locks all three halves: the toggle contract (flip,
// aria-label swap, persistence both ways), the token flip (computed
// body/palette lightness moves), and the island hold (the log
// terminal's computed lightness is < 0.2 AND unchanged across themes).
// Zero server mutations — the theme lives in a throwaway context's
// localStorage; the world is safe by construction.
//
// Probe lessons (first-flight autopsy): while a radix modal (the job
// inspector) stands, the header is aria-hidden + pointer-locked, so
// the toggle is addressed by CSS attribute locator and the island's
// two-theme measurement is taken as two INSTANCES (jump → measure →
// Escape → toggle → jump again) — the contract is the class's
// theme-independence, not one node's survival.
//
// Legs:
//   S  the shell stands + the toggle is present in light dress
//   A  the toggle contract: light → dark → persisted → reload →
//      dark still; back to light → persisted → reload → light still
//   B  the token flip: body lightness falls from light (>0.9) to dark
//      (<0.3); the palette card's ground moves with it
//   C  the island hold: the log terminal's computed lightness is dark
//      (<0.2) in BOTH themes and effectively unchanged (|Δ| ≤ 0.02)
//   D  dark coherence: the palette renders rows, the dashboard wall
//      renders its saved-view cards
//   E  buckets: zero real console errors, zero 404s, flaps bounded
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const BASE = "http://localhost:3000";

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pollUntil = async (fn, timeoutMs = 10000) => {
  const t0 = Date.now();
  for (;;) {
    const v = await fn().catch(() => null);
    if (v) return v;
    if (Date.now() - t0 > timeoutMs) return null;
    await sleep(300);
  }
};

mkdirSync(".qa-logs", { recursive: true });

// ---------- browser + instruments (family grammar, no abort lane) ----------
const b = await chromium.launch();
const ctx = await b.newContext({
  colorScheme: "light",
  viewport: { width: 1600, height: 950 },
});
const page = await ctx.newPage();
const consoleErrors = [], hmrNoise = [], resourceFlap = [], resource404 = [], chunkFlap = [];
page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (t.includes("webpack-hmr") && t.includes("ERR_CONNECTION_REFUSED")) { hmrNoise.push(t); return; }
  if (t.startsWith("Failed to load chunk") && t.includes("async loader")) { chunkFlap.push(t); return; }
  if (t.startsWith("Failed to load resource")) {
    if (/status of 404/.test(t)) resource404.push(t);
    else if (/ERR_(CONNECTION_REFUSED|EMPTY_RESPONSE|CONNECTION_RESET|INCOMPLETE_CHUNKED_ENCODING)/.test(t)) resourceFlap.push(t);
    else consoleErrors.push(t);
    return;
  }
  consoleErrors.push(t);
});
page.on("pageerror", (e) => {
  if (/Failed to load chunk/.test(e.message)) { chunkFlap.push(e.message); return; }
  consoleErrors.push(`pageerror: ${e.message}`);
});
const waitShell = () => pollUntil(async () =>
  ((await page.locator('[role="tab"]').count()) > 0 &&
    (await page.evaluate(() => document.readyState)).includes("complete")) || null, 30000);

// computed-background lightness, theme-agnostic: oklch L or rgb midpoint
const bgLightness = (selDesc) => page.evaluate((desc) => {
  const el = desc.marker
    ? document.querySelector(desc.sel)?.closest(desc.marker)
    : document.querySelector(desc.sel);
  if (!el) return null;
  const c = getComputedStyle(el).backgroundColor;
  // this Chrome serializes computed colors as lab(L a b) — L is 0..100
  const lab = c.match(/lab\(([\d.]+)/);
  if (lab) return { L: parseFloat(lab[1]) / 100, raw: c };
  const m = c.match(/oklch\(([\d.]+)/);
  if (m) return { L: parseFloat(m[1]), raw: c };
  const rgb = c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/);
  if (rgb) {
    const [r, g, bl] = [+rgb[1], +rgb[2], +rgb[3]].map((v) => v / 255);
    const mx = Math.max(r, g, bl), mn = Math.min(r, g, bl);
    return { L: (mx + mn) / 2, raw: c };
  }
  return { L: null, raw: c };
}, selDesc);

const htmlClass = () => page.evaluate(() => document.documentElement.className);
// CSS attribute locator — immune to the modal's aria-hidden on the header
const themeToggle = () => page.locator(
  'button[aria-label="Switch to dark theme"], button[aria-label="Switch to light theme"]'
).first();
const toggleLabel = () => themeToggle().getAttribute("aria-label");
const storedTheme = () => page.evaluate(() => localStorage.getItem("theme"));
const goDark = async () => {
  await themeToggle().click();
  const ok = await pollUntil(async () => /(^|\s)dark(\s|$)/.test(await htmlClass()) || null, 8000);
  if (!ok) throw new Error("goDark: the html never flipped to dark");
};
const goLight = async () => {
  await themeToggle().click();
  const ok = await pollUntil(async () => /(^|\s)light(\s|$)/.test(await htmlClass()) || null, 8000);
  if (!ok) throw new Error("goLight: the html never flipped to light");
};

const openPalette = async () => {
  await page.keyboard.press("Control+k");
  await pollUntil(async () => (await page.locator("[cmdk-item]").count()) > 0 || null, 15000);
};
const closePalette = async () => {
  await page.keyboard.press("Escape").catch(() => {});
  await pollUntil(async () => (await page.locator("[cmdk-item]").count()) === 0 || null, 8000);
  await sleep(400);
};
// jump: first palette row → the job inspector; returns the tabs locator count
const jumpToFirstJob = async () => {
  await openPalette();
  await page.locator("[cmdk-item]").first().click();
  const ok = await pollUntil(async () =>
    (await page.locator('[data-insp-face="tabs"] [role="tab"]').count()) > 0 || null, 15000);
  return !!ok;
};
const openLogTerminal = async () => {
  const logTab = page.locator('[data-insp-face="tabs"] [role="tab"]', { hasText: /^Log/ }).first();
  await logTab.click();
  return await pollUntil(async () => {
    const n = await page.locator("div.bg-zinc-950.shadow-inner").count();
    return n > 0 || null;
  }, 10000);
};
const escapeInspector = async () => {
  await page.keyboard.press("Escape").catch(() => {});
  await pollUntil(async () =>
    (await page.locator('[data-insp-face="tabs"]').count()) === 0 || null, 8000);
  await sleep(400);
};

// ---------- S: the shell + the toggle in light dress ----------
console.log("· S: the shell and the toggle");
await page.goto(BASE, { waitUntil: "networkidle" });
await waitShell();
must(await waitShell() !== null, "S the shell stands (tabs + readyState complete)");
const toggleCount = await themeToggle().count();
must(toggleCount === 1, "S the theme toggle stands in the header (one control)", `count=${toggleCount}`);
must((await toggleLabel()) === "Switch to dark theme",
  "S the toggle wears its light dress (aria offers dark)");

// ---------- A: the toggle contract ----------
console.log("· A: the toggle contract");
must(/(^|\s)light(\s|$)/.test(await htmlClass()), "A the html opens in light (next-themes resolved)");
await goDark();
must(true, "A one click flips the html to dark");
must((await toggleLabel()) === "Switch to light theme",
  "A the aria-label swaps with the dress");
must((await storedTheme()) === "dark", "A the choice persists to localStorage (theme=dark)");
await page.reload({ waitUntil: "networkidle" });
await waitShell();
must(/(^|\s)dark(\s|$)/.test(await htmlClass()), "A a reload keeps the dark (the inline script honors storage)");
await goLight();
must(true, "A one click returns to light");
await page.reload({ waitUntil: "networkidle" });
await waitShell();
must(/(^|\s)light(\s|$)/.test(await htmlClass()), "A a reload keeps the light (persistence both ways)");

// ---------- B: the token flip ----------
console.log("· B: the token surfaces flip");
const bodyLight = await bgLightness({ sel: "body" });
must(bodyLight && bodyLight.L !== null && bodyLight.L > 0.9,
  "B the body's ground is light-token pale", `L=${bodyLight?.L} (${bodyLight?.raw})`);
await openPalette();
const palLight = await bgLightness({ sel: "[cmdk-input]", marker: '[role="dialog"]' });
must(palLight && palLight.L !== null && palLight.L > 0.9,
  "B the palette card rides the light popover token", `L=${palLight?.L} (${palLight?.raw})`);
const lightRows = await page.locator("[cmdk-item]").count();
await closePalette();

await goDark();
const bodyDark = await bgLightness({ sel: "body" });
must(bodyDark && bodyDark.L !== null && bodyDark.L < 0.3,
  "B the body's ground falls to the dark token", `L=${bodyDark?.L} (${bodyDark?.raw})`);
await openPalette();
const palDark = await bgLightness({ sel: "[cmdk-input]", marker: '[role="dialog"]' });
must(palLight && palDark && palLight.L !== null && palDark.L !== null && Math.abs(palLight.L - palDark.L) > 0.5,
  "B the palette card's ground moved with the theme (ΔL > 0.5)",
  `light=${palLight?.L} dark=${palDark?.L}`);
const darkRows = await page.locator("[cmdk-item]").count();
must(darkRows > 0 && lightRows > 0, "D the palette renders its rows in dark too",
  `light=${lightRows} dark=${darkRows}`);
await closePalette();

// ---------- C: the island hold (two instances, one contract) ----------
console.log("· C: the always-dark island holds");
const jumpedDark = await jumpToFirstJob();
must(jumpedDark, "C the palette jump opens the job inspector (dark pass)");
const termDark = jumpedDark ? await openLogTerminal() : null;
must(!!termDark, "C the Log face shows the terminal island (bg-zinc-950 shadow-inner)");
const islandDark = await bgLightness({ sel: "div.bg-zinc-950.shadow-inner" });
must(islandDark && islandDark.L !== null && islandDark.L < 0.2,
  "C the island is dark in the dark theme (<0.2)", `L=${islandDark?.L} (${islandDark?.raw})`);
await escapeInspector();

await goLight();
const jumpedLight = await jumpToFirstJob();
must(jumpedLight, "C the jump repeats in light (inspector reopens)");
const termLight = jumpedLight ? await openLogTerminal() : null;
must(!!termLight, "C the Log face shows the island again (light pass)");
const islandLight = await bgLightness({ sel: "div.bg-zinc-950.shadow-inner" });
must(islandLight && islandLight.L !== null && islandLight.L < 0.2,
  "C the island stays dark in the light theme too (<0.2)", `L=${islandLight?.L} (${islandLight?.raw})`);
must(islandDark && islandLight && islandDark.L !== null && islandLight.L !== null &&
  Math.abs(islandDark.L - islandLight.L) <= 0.02,
  "C the island's ground is theme-independent (|ΔL| ≤ 0.02 — the hold contract)",
  `dark=${islandDark?.L} light=${islandLight?.L}`);
await escapeInspector();

// ---------- D: dark coherence on the dashboard wall ----------
await goDark();
const dashTab = page.locator('[role="tab"][title^="Project dashboard"]').first();
if (await dashTab.count()) {
  await dashTab.click();
  await sleep(2200);
  const wallCards = await page.locator("[data-saved-view-card]").count();
  must(wallCards > 0, "D the dashboard wall renders its saved-view cards in dark", `cards=${wallCards}`);
} else {
  must(false, "D the dashboard tab exists to walk in dark");
}

// ---------- 📸 ×2 ----------
await page.goto(BASE, { waitUntil: "networkidle" });
await waitShell();
await sleep(1500);
await page.screenshot({ path: ".qa-logs/t678-probe-dark-canvas.png" });
await goLight();
await sleep(1200);
await page.screenshot({ path: ".qa-logs/t678-probe-light-canvas.png" });

// ---------- E: buckets ----------
console.log("· E: the noise buckets");
must(consoleErrors.length === 0, "E console: zero real errors across both themes",
  consoleErrors.length ? consoleErrors.slice(0, 3).join(" | ").slice(0, 200) : "0");
must(resource404.length === 0, "E zero 404s", `${resource404.length}`);
must(chunkFlap.length === 0 && resourceFlap.length <= 3 && hmrNoise.length <= 3,
  "E chunk/resource/hmr flaps bounded",
  `chunk=${chunkFlap.length} resource=${resourceFlap.length} hmr=${hmrNoise.length}`);

console.log(`==== t678 theme-twin: ${PASS} pass / ${FAIL} fail ====`);
await b.close();
process.exit(FAIL ? 1 : 0);

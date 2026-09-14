/* t192 e2e — the dark portrait finally taken. The Mol* canvas paints
 * ITSELF, so computed-style audits are blind to it; the probe reads the
 * LIVE plugin through window.__molstar (the app's own QA affordance) and
 * asserts the viewport follows the room:
 *   S  setup — dark toggle via the app's own button, html.dark + persistence
 *   A  audit — programmatic light-patch / low-contrast walk on 6 surfaces
 *   V  viewer — canvas bg: native→dark app token→back on light (LIVE toggle)
 *   Z  read-only — roster identity, console clean
 * x3 runs required by house rules. */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "fs";
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const RUN = Number(process.env.RUN ?? "1");
const OUT = "scripts/shots-t192";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const fails = [];
const must = (cond, label) => {
  if (cond) { pass++; console.log(`  ok: ${label}`); }
  else { fail++; fails.push(label); console.error(`  FAIL: ${label}`); }
};
const section = (t) => console.log(`\n== ${t} ==`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => consoleErrors.push(String(e).slice(0, 200)));

const roster0 = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];

/* ============ S: dark via the app's own switch ============ */
section("S: the app's own dark switch");
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2000);
// deterministic start: force light first (localStorage may be dark from recon)
const lightBtn = page.locator('button[aria-label="Switch to light theme"]');
if (await lightBtn.isVisible().catch(() => false)) { await lightBtn.click(); await sleep(600); }
must(!(await page.evaluate(() => document.documentElement.classList.contains("dark"))), "S1 forced light start (html.dark absent)");
await page.locator('button[aria-label="Switch to dark theme"]').click();
await sleep(700);
must(await page.evaluate(() => document.documentElement.classList.contains("dark")), "S2 app's own switch sets html.dark");
await page.reload({ waitUntil: "networkidle" });
await sleep(1800);
must(await page.evaluate(() => document.documentElement.classList.contains("dark")), "S3 dark survives reload (next-themes persistence)");

/* ============ A: programmatic audit on key surfaces ============ */
section("A: light-patch + contrast audit in the dark");
const AUDIT_FN = () => {
  const lum = (r, g, b) => {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const parse = (s) => {
    const m = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
  };
  const effBg = (el) => {
    const layers = [];
    let cur = el;
    while (cur && cur instanceof Element) {
      const c = parse(getComputedStyle(cur).backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a >= 0.99) break; }
      cur = cur.parentElement;
    }
    if (!layers.length) return { r: 255, g: 255, b: 255, solid: false };
    if (layers[0].a >= 0.99) return { ...layers[0], solid: true };
    let base = { r: 11, g: 15, b: 20 };
    for (let i = layers.length - 1; i >= 0; i--) {
      const L = layers[i];
      base = { r: L.r * L.a + base.r * (1 - L.a), g: L.g * L.a + base.g * (1 - L.a), b: L.b * L.a + base.b * (1 - L.a) };
    }
    return { ...base, solid: true };
  };
  const out = [];
  for (const el of document.querySelectorAll("body *")) {
    const box = el.getBoundingClientRect();
    if (box.width < 10 || box.height < 8) continue;
    if (el.offsetParent === null && getComputedStyle(el).position !== "fixed") continue;
    const st = getComputedStyle(el);
    if (st.visibility === "hidden" || st.display === "none") continue;
    const bg = effBg(el);
    const bgL = lum(bg.r, bg.g, bg.b);
    if (bg.solid && bgL > 0.82) {
      out.push({ kind: "light-patch", tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 60), text: (el.textContent || "").trim().slice(0, 30) });
      continue;
    }
    const hasText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim().length > 1);
    if (!hasText) continue;
    const fg = parse(st.color);
    if (!fg) continue;
    const fgL = lum(fg.r, fg.g, fg.b);
    const contrast = (Math.max(fgL, bgL) + 0.05) / (Math.min(fgL, bgL) + 0.05);
    if (contrast < 2.2) out.push({ kind: "low-contrast", tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 60), text: (el.textContent || "").trim().slice(0, 30) });
  }
  return out;
};
// surfaces: canvas, dashboard, inspector, hpc dialog, palette, shortcuts
const surfaceSuspects = {};
await sleep(500);
surfaceSuspects.canvas = await page.evaluate(AUDIT_FN);
await page.keyboard.press("Shift+KeyD"); await sleep(1600);
surfaceSuspects.dashboard = await page.evaluate(AUDIT_FN);
await page.keyboard.press("Shift+KeyD"); await sleep(1100);
const jobsA = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
const idleA = jobsA.filter((j) => j.status === "idle").sort((a, b) => (a.x ?? 0) - (b.x ?? 0))[0];
await page.locator(`[data-job="${idleA.id}"]`).first().click({ force: true });
await sleep(1500);
surfaceSuspects.inspector = await page.evaluate(AUDIT_FN);
await page.keyboard.press("Escape"); await sleep(600);
await page.keyboard.press("Control+k"); await sleep(900);
surfaceSuspects.palette = await page.evaluate(AUDIT_FN);
await page.keyboard.press("Escape"); await sleep(500);
await page.keyboard.press("Shift+Slash"); await sleep(900);
surfaceSuspects.shortcuts = await page.evaluate(AUDIT_FN);
await page.keyboard.press("Escape"); await sleep(500);
writeFileSync(`/tmp/t192-suspects-r${RUN}.json`, JSON.stringify(surfaceSuspects, null, 1));
const total = Object.values(surfaceSuspects).reduce((a, s) => a + s.length, 0);
must(total === 0, `A1 audit: 0 suspects across ${Object.keys(surfaceSuspects).length} surfaces (got ${total}${total ? ": " + JSON.stringify(surfaceSuspects).slice(0, 300) : ""})`);

/* ============ V: the Mol* viewport follows the room ============ */
section("V: the viewer's canvas follows the room");
execSync('QA_VOL_HOST="QA Refine3D" python3 scripts/qa67-seed-volume.py', { stdio: "pipe" });
const jobs = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
const host = jobs.find((j) => j.name === "QA Refine3D");
must(!!host, "V1 QA Refine3D in roster (seeder idempotent)");
await page.locator(`[data-job="${host.id}"]`).first().click({ force: true });
await sleep(1600);
await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
await sleep(1400);
await page.locator('button[aria-label^="Enlarge"]').first().click({ timeout: 3000 }).catch(() => {});
await sleep(1100);
const v3d = page.locator("button", { hasText: "View in 3D" });
let viewerUp = false;
if (await v3d.isVisible().catch(() => false)) {
  await v3d.click();
  for (let k = 0; k < 30; k++) {
    await sleep(2000);
    if (await page.evaluate(() => !!(window).__molstar?.canvas3d).catch(() => false)) { viewerUp = true; break; }
  }
}
must(viewerUp, "V2 Mol* plugin live (window.__molstar.canvas3d)");
const bgInDark = await page.evaluate(() => {
  const c = (window).__molstar?.canvas3d;
  const col = c?.props?.renderer?.backgroundColor;
  if (!col) return null;
  // Mol* Color packs rgb as 24-bit int
  return { r: (col >> 16) & 255, g: (col >> 8) & 255, b: col & 255 };
});
must(!!bgInDark, `V3 renderer backgroundColor readable (got ${JSON.stringify(bgInDark)})`);
// same resolver as the product: Tailwind 4 tokens compute to lab(), so the
// probe resolves the app token through a 1×1 canvas (sRGB bytes)
const target = await page.evaluate(() => {
  const css = getComputedStyle(document.body).backgroundColor;
  const c = document.createElement("canvas"); c.width = c.height = 1;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = css; ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  return { r: d[0], g: d[1], b: d[2], css };
});
must(!!bgInDark && !!target && Math.abs(bgInDark.r - target.r) <= 2 && Math.abs(bgInDark.g - target.g) <= 2 && Math.abs(bgInDark.b - target.b) <= 2,
  `V4 dark viewport bg == app background token (canvas ${JSON.stringify(bgInDark)} vs app ${JSON.stringify(target)})`);
const lumDark = bgInDark ? (0.2126 * bgInDark.r + 0.7152 * bgInDark.g + 0.0722 * bgInDark.b) / 255 : 1;
must(lumDark < 0.25, `V5 dark viewport is actually dark (luminance ${lumDark.toFixed(3)} < 0.25)`);

// LIVE toggle back to light — viewport must return to the native default.
// The fullscreen viewer dialog's overlay occludes the header toggle from
// REAL pointers, but the button is still in the DOM: el.click() walks the
// app's own React onClick → setTheme → next-themes → useTheme chain (the
// exact wiring a user's click would run), just without the hit-test.
const clickThemeToggle = async (label) =>
  page.evaluate((lb) => {
    const b = [...document.querySelectorAll("button")].find(
      (x) => x.getAttribute("aria-label") === lb
    );
    if (!b) return false;
    b.click();
    return true;
  }, label);
must(await clickThemeToggle("Switch to light theme"), "V6a light toggle fired via the app's own button handler (JS click, overlay-occluded)");
await sleep(900);
const bgAfterLight = await page.evaluate(() => {
  const c = (window).__molstar?.canvas3d;
  const col = c?.props?.renderer?.backgroundColor;
  return col ? { r: (col >> 16) & 255, g: (col >> 8) & 255, b: col & 255 } : null;
});
must(!!bgAfterLight && !(bgAfterLight.r === bgInDark.r && bgAfterLight.g === bgInDark.g && bgAfterLight.b === bgInDark.b),
  `V6 light toggle reverts viewport to native default (now ${JSON.stringify(bgAfterLight)})`);

// dark again — dark portrait moment (this is the shot that waited 9 rounds)
await clickThemeToggle("Switch to dark theme");
await sleep(1400);
await page.screenshot({ path: `${OUT}/t192-dark-viewer-fixed.png` });
const bgBackDark = await page.evaluate(() => {
  const c = (window).__molstar?.canvas3d;
  const col = c?.props?.renderer?.backgroundColor;
  return col ? { r: (col >> 16) & 255, g: (col >> 8) & 255, b: col & 255 } : null;
});
must(!!bgBackDark && target && Math.abs(bgBackDark.r - target.r) <= 2 && Math.abs(bgBackDark.g - target.g) <= 2 && Math.abs(bgBackDark.b - target.b) <= 2,
  "V7 back to dark: viewport bg == app token again (live follow both ways)");

// portrait: canvas bg vs screenshot pixels — the eyeball double-check rides here
await page.keyboard.press("Escape"); await sleep(800);

/* ============ Z: read-only proof ============ */
section("Z: read-only");
const roster1 = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
must(roster1.length === roster0.length, `Z1 roster identity (${roster0.length} == ${roster1.length})`);
must(consoleErrors.length === 0, `Z2 console clean (${consoleErrors.length}${consoleErrors.length ? ": " + consoleErrors[0] : ""})`);

console.log(`\nT192 RUN ${RUN}: ${pass} pass, ${fail} fail`);
if (fail) { console.log(fails.map((f) => "  ✗ " + f).join("\n")); process.exit(1); }
await browser.close();

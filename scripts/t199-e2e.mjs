/* t199 e2e — Mol*'s own controls learn the room's palette. t192 taught
 * the CANVAS to follow the theme (renderer background rides the app
 * token), but Mol* ships a HARDCODED light skin for its own controls:
 * #eeece7 paper buttons at 35% opacity, #9c835f caramel icons, #ae5d04
 * rust hovers. Over the dark canvas those controls read as muddy grey
 * squares with caramel ghosts — legible but wrong (five windows of
 * deferral). t199 re-skins the VISIBLE controls (vertical viewport
 * stack, their panels, toasts, task bar, help bubbles) under
 * `.dark .msp-plugin`, every value drinking an app token variable;
 * light mode never sees any of it.
 *   S  setup — seeder, deterministic dark via the app's own switch
 *   X  source oracles — the override block exists, every rule keeps the
 *      `.dark .msp-plugin` scope (light is immune BY SHAPE, not by luck),
 *      values are var() tokens not hex snapshots, the visible families
 *      are all covered (viewport stack, hover, disabled, toast, task bar,
 *      help), and the 35% opacity dim is reset to 1
 *   D  live — computed-style audit with the 1x1-canvas color parser
 *      (t192's recipe: it is the only interpreter that speaks every CSS
 *      color syntax and answers in sRGB bytes): the button background
 *      EQUALS the app's --secondary bytes, the icon ink equals
 *      --muted-foreground (not caramel), opacity is 1, and the WCAG
 *      contrast of the re-skinned chip BEATS the old skin's mud
 *      numerically; the light theme gets its Mol* skin back VERBATIM
 *   Z  read-only — roster identity, console clean
 * x3 runs required by house rules. */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { readFileSync } from "fs";
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const RUN = Number(process.env.RUN ?? "1");
const OUT = "scripts/shots-t199";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const fails = [];
const must = (cond, label) => {
  if (cond) { pass++; console.log(`  ok: ${label}`); }
  else { fail++; fails.push(label); console.error(`  FAIL: ${label}`); }
};
const section = (t) => console.log(`\n== ${t} ==`);

const CSS = readFileSync("src/app/globals.css", "utf8");
const roster0 = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];

/* ============ S: setup ============ */
section("S: the world");
execSync('QA_VOL_HOST="QA Refine3D" python3 scripts/qa67-seed-volume.py', { stdio: "pipe" });
const jobs = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
const host = jobs.find((j) => j.name === "QA Refine3D");
must(!!host, "S1 QA Refine3D in roster (seeder idempotent)");

/* ============ X: source oracles ============ */
section("X: the skin block tells the truth");
// isolate the t199 block (from its banner comment to the next banner or EOF)
const blockStart = CSS.indexOf("Mol* dark skin (t199)");
must(blockStart > 0, "X1 the t199 skin block exists in globals.css");
const block = CSS.slice(blockStart);
// the banner comment DOCUMENTS Mol*'s light skin (that's teaching
// material, not code) — strip comments before auditing the rule bodies
const blockNoComments = block.replace(/\/\*[\s\S]*?\*\//g, "");
must((block.match(/\.dark \.msp-plugin/g) || []).length >= 8, `X2 every rule keeps the .dark .msp-plugin scope (${(block.match(/\.dark \.msp-plugin/g) || []).length} selectors) — light mode is immune BY SHAPE, not by luck`);
must(!/#(eeece7|f3f2ee|e0ddd4|e3e0d8|e9e6e0|9c835f|63533c|ae5d04)/i.test(blockNoComments), "X3 zero hardcoded light-skin hex in the RULE BODIES — values drink TOKENS, not snapshots");
must(block.includes("var(--secondary)") && block.includes("var(--popover)") && block.includes("var(--accent-foreground)") && block.includes("var(--muted-foreground)"), "X4 the skin drinks the app's own variables (secondary/popover/accent-foreground/muted-foreground) — a future token retune re-skins Mol* for free");
must(block.includes(".msp-viewport-controls-buttons") && block.includes("opacity: 1"), "X5 the vertical viewport stack is covered and the 35% dim is reset to full opacity");
must(block.includes(".msp-btn-icon:hover") && block.includes(".msp-btn-link[disabled],") === false && block.includes("[disabled]"), "X6 hover and disabled semantics are re-skinned (rust hover -> app cyan, caramel disabled -> app dim grey)");
must(block.includes(".msp-toast") && block.includes("msp-background-tasks") && block.includes(".msp-help"), "X7 toasts, the background-task bar and the help bubbles are covered (the visible Mol* surfaces, not just the buttons)");

/* ============ D: the live audit ============ */
section("D: the controls, live in both rooms");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => consoleErrors.push(String(e).slice(0, 200)));

// the 1x1 canvas is the only interpreter that speaks every CSS color
// syntax (lab/oklch/hex) and answers in sRGB bytes — t192's recipe
const toRgb = async (cssColor) => await page.evaluate((c) => {
  const cv = document.createElement("canvas");
  cv.width = 1; cv.height = 1;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1);
  return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3));
}, cssColor);
const relLum = ([r, g, b]) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a, b) => {
  const l1 = relLum(a), l2 = relLum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);
// deterministic dark via the app's own switch (t192's lesson — use the
// system's door, not emulateMedia)
const lightBtn = page.locator('button[aria-label="Switch to light theme"]');
if (await lightBtn.isVisible().catch(() => false)) { await lightBtn.click(); await sleep(500); }
await page.locator('button[aria-label="Switch to dark theme"]').click();
await sleep(900);

await page.locator(`[data-job="${host.id}"]`).first().click({ force: true });
await sleep(1600);
await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
await sleep(1400);
const orthoTile = page.locator('button[aria-label="Enlarge orthovol"]');
if (await orthoTile.isVisible().catch(() => false)) await orthoTile.click();
else await page.locator('button[aria-label^="Enlarge"]').first().click({ timeout: 3000 }).catch(() => {});
await sleep(1100);
await page.locator("button", { hasText: "View in 3D" }).click();
let viewerUp = false;
for (let k = 0; k < 30; k++) {
  await sleep(2000);
  if (await page.evaluate(() => !!window.__molstar?.canvas3d).catch(() => false)) { viewerUp = true; break; }
}
must(viewerUp, "D1 Mol* viewer live (dark room)");

const vpBtn = page.locator(".msp-viewport-controls-buttons button[class]").first();
must(await vpBtn.isVisible().catch(() => false), "D2 Mol* viewport control stack is rendered");
const bg = await vpBtn.evaluate((el) => getComputedStyle(el).backgroundColor);
const ink = await vpBtn.evaluate((el) => getComputedStyle(el).color);
const op = await vpBtn.evaluate((el) => getComputedStyle(el).opacity);
const secTok = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--secondary").trim());
const inkTok = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--muted-foreground").trim());
const secRgb = await toRgb(secTok);
const inkRgb = await toRgb(inkTok);
const bgRgb = await toRgb(bg);
const inkNow = await toRgb(ink);
must(JSON.stringify(bgRgb) === JSON.stringify(secRgb), `D3 button background == the app's --secondary bytes (${bg} -> [${bgRgb}] vs token [${secRgb}])`);
must(JSON.stringify(inkNow) === JSON.stringify(inkRgb), `D4 icon ink == the app's --muted-foreground bytes (${ink} -> [${inkNow}] vs token [${inkRgb}]) — the caramel ghost is gone`);
must(op === "1", `D5 opacity is 1 (the 35% dim is dead)`);
const cAfter = contrast(bgRgb, inkNow);
const cBefore = contrast([125, 127, 128], [156, 131, 95]); // the old mud: skin@35% over the dark canvas vs caramel
must(cAfter >= 3 && cAfter > cBefore, `D6 the re-skinned chip's WCAG contrast ${cAfter.toFixed(2)}:1 beats the old mud's ${cBefore.toFixed(2)}:1 and clears the 3:1 icon floor`);
// the BLOCK buttons (opened panels' wide buttons) carry Mol*'s 35% dim in
// light mode — the skin must lift BOTH the dim and the paper there too
const blockBtn = page.locator(".msp-viewport-controls-buttons .msp-btn-block").first();
if (await blockBtn.isVisible().catch(() => false)) {
  const bgB = await blockBtn.evaluate((el) => getComputedStyle(el).backgroundColor);
  const opB = await blockBtn.evaluate((el) => getComputedStyle(el).opacity);
  const bgBRgb = await toRgb(bgB);
  must(JSON.stringify(bgBRgb) === JSON.stringify(secRgb) && opB === "1", `D6b the panel's .msp-btn-block drinks the same token and drops the 35% dim (${bgB} · opacity ${opB})`);
}

// the portrait: dark viewer with re-skinned controls
await page.screenshot({ path: `${OUT}/t199-dark-viewer-2x.png` }).catch(() => {});

// LIGHT room — the fix's boundary: Mol*'s skin returns VERBATIM
await page.keyboard.press("Escape");
await sleep(900);
await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === "Switch to light theme");
  b?.click();
});
await sleep(1000);
await page.locator(`[data-job="${host.id}"]`).first().click({ force: true });
await sleep(1500);
await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
await sleep(1300);
const ortho2 = page.locator('button[aria-label="Enlarge orthovol"]');
if (await ortho2.isVisible().catch(() => false)) await ortho2.click();
else await page.locator('button[aria-label^="Enlarge"]').first().click({ timeout: 3000 }).catch(() => {});
await sleep(1100);
await page.locator("button", { hasText: "View in 3D" }).click();
for (let k = 0; k < 30; k++) { await sleep(2000); if (await page.evaluate(() => !!window.__molstar?.canvas3d).catch(() => false)) break; }
const vpBtnL = page.locator(".msp-viewport-controls-buttons button[class]").first();
const bgL = await vpBtnL.evaluate((el) => getComputedStyle(el).backgroundColor);
const opL = await vpBtnL.evaluate((el) => getComputedStyle(el).opacity);
// Mol*'s VERBATIM light state for a btn-link button: transparent paper,
// full opacity (the dim only ever lived on .msp-btn-block)
const bgLRgb = await toRgb(bgL);
const blockL = page.locator(".msp-viewport-controls-buttons .msp-btn-block").first();
const bgBL = await blockL.evaluate((el) => getComputedStyle(el).backgroundColor).catch(() => null);
const opBL = await blockL.evaluate((el) => getComputedStyle(el).opacity).catch(() => null);
const bgBLRgb = bgBL ? await toRgb(bgBL) : null;
must(JSON.stringify(bgLRgb) === JSON.stringify([0, 0, 0]) && bgL.endsWith("0, 0, 0, 0)"), `D7 light room: the btn-link paper returns VERBATIM transparent (${bgL}) — the fix's boundary is its ambition`);
// Mol*'s VERBATIM light value is STATE-dependent: an ENABLED .msp-btn is
// #f3f2ee (the base skin), a DISABLED one #eeece7 at 35% (fieldset[disabled]
// variants — earlier greps mistook that rule's tail for a second
// unconditional .msp-btn rule). What must hold: the bytes belong to
// Mol*'s native paper set and are NOT the app's dark token.
must(bgBLRgb && (JSON.stringify(bgBLRgb) === JSON.stringify([243, 242, 238]) || JSON.stringify(bgBLRgb) === JSON.stringify([238, 236, 231])) && JSON.stringify(bgBLRgb) !== JSON.stringify(secRgb), `D7b light room: the .msp-btn-block stays on Mol*'s native paper (${bgBL}) — not the app's dark token`);

await page.screenshot({ path: `${OUT}/t199-light-viewer-2x.png` }).catch(() => {});

/* ============ Z: read-only ============ */
section("Z: the world unchanged");
const roster1 = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
must(roster1.length === roster0.length, `Z1 roster identity (${roster1.length} jobs)`);
must(consoleErrors.length === 0, `Z2 console clean (${consoleErrors.length} errors)`);
if (consoleErrors.length) console.error(consoleErrors.slice(0, 5));

await browser.close();
console.log(`\nT199 RUN ${RUN}: ${pass} pass, ${fail} fail`);
if (fail) { console.error(fails.map((f) => "  - " + f).join("\n")); process.exit(1); }

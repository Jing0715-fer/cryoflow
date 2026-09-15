/* t203 e2e — the band earns a TERRITORY. t198 gave the betrayal an
 * address (the weakest-quarter chip), t202 gave the address a door
 * (click -> the plane obeys); t203 closes the READING loop:
 *   - the landscape strip itself carries each speaking overlay's weakest
 *     band as a thin bracket (the overlay's own colour) — the betrayal's
 *     extent is visible on the depth axis BEFORE any click, and the
 *     playhead's presence inside it is spoken by the bracket brightening
 *   - the chip answers back: when the plane sits INSIDE its band the
 *     chip's ink brightens to text-foreground (data-visiting) —
 *     navigation and reading are one state, not two instruments
 *   - same lib father (localAgreement + weakestBand); a flat verdict
 *     draws no territory (no address, no lie)
 *   S  setup — seeder, orthovol + BOTH half-maps
 *   W  wire — the probe's own band oracle (from/to per map)
 *   X  source oracles — brackets drink ONE father, aria-hidden display
 *      layer, chip visiting swaps (never joins) the ink tokens
 *   D  live — bracket count/geometry/colour per map; the visiting flip
 *      at 0% (half2 armed, half1 not — both states in one frame); the
 *      jump arms half1 and disarms half2; scrubbing outside disarms all
 *   Z  read-only — roster identity, console clean
 * x3 runs required by house rules. */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { readFileSync } from "fs";
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const RUN = Number(process.env.RUN ?? "1");
const OUT = "scripts/shots-t203";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const fails = [];
const must = (cond, label) => {
  if (cond) { pass++; console.log(`  ok: ${label}`); }
  else { fail++; fails.push(label); console.error(`  FAIL: ${label}`); }
};
const section = (t) => console.log(`\n== ${t} ==`);
const near = (a, b) => a.length === 3 && b.length === 3 && Math.abs(a[0] - b[0]) <= 2 && Math.abs(a[1] - b[1]) <= 2 && Math.abs(a[2] - b[2]) <= 2;

const SRC = readFileSync("src/components/workflow/results/molstar-embed.tsx", "utf8");
const roster0 = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
const H = { "sec-fetch-site": "same-origin" };

/* ============ S: setup ============ */
section("S: the world");
execSync('QA_VOL_HOST="QA Refine3D" python3 scripts/qa67-seed-volume.py', { stdio: "pipe" });
const jobs = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
const host = jobs.find((j) => j.name === "QA Refine3D");
must(!!host, "S1 QA Refine3D in roster (seeder idempotent)");
const outs = JSON.stringify(await (await fetch(`${BASE}/api/jobs/${host.id}/outputs`)).json());
must(outs.includes("orthovol.mrc") && outs.includes("run_it020_half1.mrc") && outs.includes("run_it020_half2.mrc"), "S2 orthovol + BOTH half-maps in outputs");

/* ============ W: the wire feeds the band oracle ============ */
section("W: bands on the wire, the probe's own oracle");
const prof = async (p) => (await (await fetch(`${BASE}/api/jobs/${host.id}/map-profile?path=${encodeURIComponent(p)}&axis=z`, { headers: H })).json());
const mainW = await prof("orthovol.mrc");
const half1W = await prof("run_it020_half1.mrc");
const half2W = await prof("run_it020_half2.mrc");
must(mainW?.bins?.length > 0 && half1W?.bins?.length > 0 && half2W?.bins?.length > 0, `W1 all three profiles valid (main ${mainW?.bins?.length}, half1 ${half1W?.bins?.length}, half2 ${half2W?.bins?.length} bins)`);
const resample = (bins, n) => {
  if (bins.length <= 1) return Array(n).fill(bins[0] ?? 0);
  return Array.from({ length: n }, (_, i) => {
    const t = (i / Math.max(1, n - 1)) * (bins.length - 1);
    const lo = Math.floor(t), hi = Math.min(bins.length - 1, lo + 1);
    return bins[lo] + (bins[hi] - bins[lo]) * (t - lo);
  });
};
const pearson = (a, b) => {
  const n = Math.min(a.length, b.length);
  if (n < 2) return NaN;
  let sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { sa += a[i]; sb += b[i]; }
  const ma = sa / n, mb = sb / n;
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < n; i++) { const da = a[i] - ma, db = b[i] - mb; cov += da * db; va += da * da; vb += db * db; }
  return va === 0 || vb === 0 ? NaN : cov / Math.sqrt(va * vb);
};
const weakestOf = (mainBins, oBins) => {
  const n = Math.max(mainBins.length, oBins.length);
  if (n < 4) return null;
  const a = resample(mainBins, n), b = resample(oBins, n);
  let w = null;
  for (let k = 0; k < 4; k++) {
    const lo = Math.floor((k * n) / 4), hi = Math.floor(((k + 1) * n) / 4);
    const r = pearson(a.slice(lo, hi), b.slice(lo, hi));
    if (!Number.isFinite(r)) continue;
    if (!w || r < w.r) w = { r, from: lo / n, to: hi / n };
  }
  return w;
};
const w1 = weakestOf(mainW.bins, half1W.bins);
const w2 = weakestOf(mainW.bins, half2W.bins);
must(!!w1 && !!w2, `W2 both maps' weakest bands are finite (half1 ${(w1.from * 100).toFixed(0)}–${(w1.to * 100).toFixed(0)}% r ${w1.r.toFixed(2)}; half2 ${(w2.from * 100).toFixed(0)}–${(w2.to * 100).toFixed(0)}% r ${w2.r.toFixed(2)})`);
const geo = (w) => ({ x: (w.from * 100).toFixed(2), width: ((w.to - w.from) * 100).toFixed(2) });
const g1 = geo(w1), g2 = geo(w2);
console.log(`  (oracle geometry: half1 x=${g1.x} w=${g1.width}; half2 x=${g2.x} w=${g2.width})`);

/* ============ X: source oracles ============ */
section("X: the source keeps its promises");
must(/data-band-bracket=\{o\.name\}/.test(SRC) && /data-band-visiting=\{visiting \? "1" : "0"\}/.test(SRC) && /<g aria-hidden="true">\{bandBrackets\}<\/g>/.test(SRC), "X1 the strip carries per-map band brackets as an aria-hidden display layer (the chips keep the semantics)");
must(/const w = weakestBand\(localAgreement\(profile\.bins, op\.bins\)\);/.test(SRC) && /if \(!w\) return \[\]; \/\/ flat verdict: no address, no territory/.test(SRC), "X2 the brackets drink the SAME father (localAgreement + weakestBand) and a flat verdict draws no territory");
must(/opacity=\{visiting \? "0\.85" : "0\.3"\}/.test(SRC) && /fill=\{o\.color\}/.test(SRC), "X3 the bracket speaks presence through opacity and wears the overlay's own colour");
must(/data-visiting=\{visiting \? "1" : undefined\}/.test(SRC) && /\$\{visiting \? "text-foreground" : "text-muted-foreground"\}/.test(SRC) && !/text-muted-foreground \$\{visiting/.test(SRC) && !/text-foreground \$\{visiting/.test(SRC), "X4 the chip's visiting ink REPLACES (never joins) the rest ink — same-specificity utilities resolve by stylesheet order, not class order");
must(/const visiting = slicePos >= w\.from && slicePos < w\.to;/.test(SRC), "X5 the visiting test is the half-open band (from inclusive, to exclusive) — the same cut the lib drew");

/* ============ D: live ============ */
section("D: the territory, live");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1720, height: 940 } });
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => consoleErrors.push(String(e).slice(0, 200)));

await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);
// deterministic DARK via the app's own switch (t192's door — the t202 lesson)
const darkBtn = page.locator('button[aria-label="Switch to dark theme"]');
if (await darkBtn.isVisible().catch(() => false)) { await darkBtn.click(); await sleep(900); }
must(await page.evaluate(() => document.documentElement.classList.contains("dark")), "D0 the dark room is on (the app's own switch)");
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
must(viewerUp, "D1 Mol* viewer live");

await page.locator('button[aria-label^="Overlay maps"]').waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
await page.locator('button[aria-label^="Overlay maps"]').click();
await sleep(900);
while ((await page.locator('button[aria-label^="Remove overlay"]').count()) > 0) {
  await page.locator('button[aria-label^="Remove overlay"]').first().click();
  await sleep(900);
}
// the stability gate (t202's medicine): only Escape when the popover is
// visible TWICE, 250ms apart
const popUp = async () => await page.locator('[data-testid^="map-choice-"]').first().isVisible().catch(() => false);
if (await popUp()) { await sleep(250); if (await popUp()) await page.keyboard.press("Escape"); }
await sleep(600);
must((await page.locator('div[data-local-row="1"]').count()) === 0, "D2 self-healed world: NO local row before any adoption");
// the dialog stack can shift under the self-heal — diagnose and re-open
if ((await page.locator('button[aria-label="Toggle cross-section plane"]').count()) === 0) {
  for (let k = 0; k < 3; k++) {
    if (!(await page.locator('[data-slot="dialog-overlay"][data-state="open"]').first().isVisible().catch(() => false))) break;
    await page.keyboard.press("Escape");
    await sleep(900);
  }
  await page.locator(`[data-job="${host.id}"]`).first().click({ force: true });
  await sleep(1600);
  await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
  await sleep(1400);
  const ot = page.locator('button[aria-label="Enlarge orthovol"]');
  if (await ot.isVisible().catch(() => false)) await ot.click();
  await sleep(1000);
  await page.locator("button", { hasText: "View in 3D" }).click();
  let v2 = false;
  for (let k = 0; k < 30; k++) { await sleep(2000); if (await page.evaluate(() => !!window.__molstar?.canvas3d).catch(() => false)) { v2 = true; break; } }
  must(v2, "D2b viewer re-opened after the world shifted");
  await page.locator('button[aria-label^="Overlay maps"]').waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
}

await page.locator('button[aria-label="Toggle cross-section plane"]').click();
let stripVisible = false;
for (let k = 0; k < 12; k++) {
  await sleep(1000);
  if (await page.locator('svg[role="slider"][aria-label^="Density profile along the"]').isVisible().catch(() => false)) { stripVisible = true; break; }
}
must(stripVisible, "D3 main landscape strip rendered");
const strip = page.locator('svg[role="slider"][aria-label^="Density profile along the"]');

// adopt half1 — ONE bracket, geometry + colour from the wire (t198's
// robust re-open here too)
await page.locator('button[aria-label^="Overlay maps"]').click();
await sleep(1100);
const half1Btn = page.locator('[data-testid^="map-choice-"][title*="half1"]');
if (!(await half1Btn.isVisible().catch(() => false))) {
  await page.locator('button[aria-label^="Overlay maps"]').click();
  await sleep(1100);
}
await half1Btn.click();
await sleep(3500);
const br1 = page.locator('[data-band-bracket="run_it020_half1"]');
let b1Up = false;
for (let k = 0; k < 10; k++) {
  if (await br1.isVisible().catch(() => false)) { b1Up = true; break; }
  await sleep(1000);
}
const b1x = await br1.getAttribute("x").catch(() => null);
const b1w = await br1.getAttribute("width").catch(() => null);
const b1fill = await br1.getAttribute("fill").catch(() => null);
const terrainStroke = await page.locator('[data-overlay-terrain*="half1"] polyline, svg polyline[stroke="#22d3ee"]').first().getAttribute("stroke").catch(() => null);
must(b1Up && b1x === g1.x && b1w === g1.width, `D4 half1's bracket geometry == the wire oracle (x=${b1x} w=${b1w}, expect x=${g1.x} w=${g1.width})`);
must(b1Up && (!!terrainStroke ? b1fill === terrainStroke : true) && !!b1fill, `D5 the bracket wears the overlay's own colour (fill ${b1fill}, terrain stroke ${terrainStroke ?? "n/a"})`);

// adopt half2 — the SECOND bracket, its own territory (t198's robust
// re-open: the first click may toggle the popover closed if the adoption
// auto-closed it)
await page.locator('button[aria-label^="Overlay maps"]').click();
await sleep(1100);
const half2Btn = page.locator('[data-testid^="map-choice-"][title*="half2"]');
if (!(await half2Btn.isVisible().catch(() => false))) {
  await page.locator('button[aria-label^="Overlay maps"]').click();
  await sleep(1100);
}
await half2Btn.click();
await sleep(3500);
const br2 = page.locator('[data-band-bracket="run_it020_half2"]');
let b2Up = false;
for (let k = 0; k < 10; k++) {
  if (await br2.isVisible().catch(() => false)) { b2Up = true; break; }
  await sleep(1000);
}
const b2x = await br2.getAttribute("x").catch(() => null);
const b2w = await br2.getAttribute("width").catch(() => null);
must(b2Up && b2x === g2.x && b2w === g2.width, `D6 half2's bracket geometry == the wire oracle (x=${b2x} w=${b2w}, expect x=${g2.x} w=${g2.width})`);

// THE READING LOOP: Home -> 0% — half2's Q1 territory hosts the plane,
// half1's Q3 does not. Both states in one frame.
await strip.focus(); await sleep(300);
await strip.press("Home"); await sleep(700);
const v1AtHome = await br1.getAttribute("data-band-visiting");
const v2AtHome = await br2.getAttribute("data-band-visiting");
const o1AtHome = await br1.getAttribute("opacity");
const o2AtHome = await br2.getAttribute("opacity");
must(v1AtHome === "0" && o1AtHome === "0.3" && v2AtHome === "1" && o2AtHome === "0.85", `D7 Home (0%): half1's bracket rests (v=${v1AtHome} op=${o1AtHome}), half2's BRIGHTENS (v=${v2AtHome} op=${o2AtHome}) — both states in one frame`);
const chip1 = page.locator('[data-local-chip="run_it020_half1"]');
const chip2 = page.locator('[data-local-chip="run_it020_half2"]');
must((await chip1.getAttribute("data-visiting")) === null && (await chip2.getAttribute("data-visiting")) === "1", "D8 the chips answer: half1 at rest, half2 data-visiting");
// the visiting ink is the foreground token — brighter than the rest ink
const fgTok = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--foreground").trim());
const fgRgb = await toRgb(fgTok);
const ink2 = await toRgb(await chip2.evaluate((el) => getComputedStyle(el).color));
must(near(ink2, fgRgb), `D9 the visiting chip's ink == --foreground bytes [${fgRgb}]`);
const restInk = await toRgb(await chip1.evaluate((el) => getComputedStyle(el).color));
const mfTok = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--muted-foreground").trim());
must(near(restInk, await toRgb(mfTok)), `D10 the resting chip's ink == --muted-foreground bytes — the two states are distinct tokens`);
const relLum = ([r, g, b]) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a, b) => (Math.max(relLum(a), relLum(b)) + 0.05) / (Math.min(relLum(a), relLum(b)) + 0.05);
const mutedBg = await toRgb(await chip2.evaluate((el) => getComputedStyle(el).backgroundColor));
const cVisit = contrast(ink2, mutedBg);
must(cVisit >= 4.5, `D11 CENSUS: the visiting pair ${cVisit.toFixed(2)}:1 >= 4.5 (small-text floor)`);

// the jump arms half1's territory and disarms half2's — one click
await chip1.click();
await sleep(700);
const v1After = await br1.getAttribute("data-band-visiting");
const v2After = await br2.getAttribute("data-band-visiting");
const now63 = Number(await strip.getAttribute("aria-valuenow"));
must(now63 === 63 && v1After === "1" && v2After === "0", `D12 after the chip's jump (plane ${now63}%): half1's bracket brightens (v=${v1After}), half2's rests (v=${v2After}) — the door landed inside the territory it named`);

// scrub outside both bands (pointer jump to ~90% via the strip itself, t190's door)
await strip.focus(); await sleep(200);
await strip.press("End"); await sleep(700);
const v1End = await br1.getAttribute("data-band-visiting");
const v2End = await br2.getAttribute("data-band-visiting");
const chip1Vis = await chip1.getAttribute("data-visiting");
must(v1End === "0" && v2End === "0" && chip1Vis === null, `D13 End (100%): no band hosts the plane — both brackets rest, no chip claims the playhead`);

await page.screenshot({ path: `${OUT}/t203-territory-2x.png` }).catch(() => {});
await page.screenshot({ path: `${OUT}/t203-viewer-2x.png`, fullPage: false }).catch(() => {});

/* ============ Z: read-only ============ */
section("Z: the world read back");
const roster1 = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
must(roster1.length === roster0.length && roster1.length === 26, `Z1 roster identity (${roster1.length}, canonical 26)`);
const r1names = roster1.map((j) => j.name).sort().join("|");
const r0names = roster0.map((j) => j.name).sort().join("|");
must(r1names === r0names, "Z2 roster identity by name — nothing stayed behind");
await browser.close();
must(consoleErrors.length === 0, `Z3 console clean (${consoleErrors.length} errors${consoleErrors.length ? ": " + consoleErrors[0] : ""})`);

console.log(`\n== RESULT ==\npass ${pass} / fail ${fail}${fails.length ? "\n  - " + fails.join("\n  - ") : ""}`);
process.exit(fail === 0 ? 0 : 1);

/* the 1x1 canvas is the only interpreter that speaks every CSS color
 * syntax (oklch included) and answers in sRGB bytes — t192's recipe */
async function toRgb(cssColor) {
  return await page.evaluate((c) => {
    const cv = document.createElement("canvas");
    cv.width = 1; cv.height = 1;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1);
    return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3));
  }, cssColor);
}

/* t202 e2e — the address earns a DOOR. t198 named the divergence's
 * address (the weakest quarter band); t202 makes it NAVIGABLE:
 *   - lib: LocalBand carries from/to — the band's ACTUAL fraction extent
 *     beside the human label (the coordinate is never parsed out of the
 *     vocabulary; report bytes unchanged)
 *   - wall: the weakest-quarter chip is a real BUTTON — click moves the
 *     slice plane to the band's centre (2dp, the strip's own rounding
 *     dialect), the receipt speaks the jump, the 2D ortho browser rides
 *     the same intent event; keyboard Enter/Space work; hover/active/
 *     focus-visible ride the app's tokens
 *   - census: the WCAG numbers the t201 handoff deferred — chip rest /
 *     chip hover / strip focus ring, BOTH rooms, floors 4.5 (chip text)
 *     and 3.0 (non-text ring); the census's first catch is the strip's
 *     old cyan-500/70 ring (1.70:1 in the light room) — replaced by the
 *     solid --ring token (3.07:1 light / 6.66:1 dark)
 *   S  setup — seeder, orthovol + BOTH half-maps
 *   W  wire — profiles feed the probe's own local oracle + centre math
 *   X  source oracles — from/to in the lib, button not span, jump drinks
 *      applySliceIntent (never a label parse), solid ring, receipt line
 *   D  live — click jumps the plane (strip valuenow == oracle), receipt
 *      names the address, Enter does the same from the keyboard, hover
 *      bytes == the accent pair, focus ring == --ring bytes; the light
 *      room gets the census numbers (chip pairs + the strip ring's fix)
 *   Z  read-only — roster identity, console clean
 * x3 runs required by house rules. */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { readFileSync } from "fs";
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const RUN = Number(process.env.RUN ?? "1");
const OUT = "scripts/shots-t202";
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
const QCLIB = readFileSync("src/lib/qc-report.ts", "utf8");
const roster0 = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
const H = { "sec-fetch-site": "same-origin" };

/* ============ S: setup ============ */
section("S: the world");
execSync('QA_VOL_HOST="QA Refine3D" python3 scripts/qa67-seed-volume.py', { stdio: "pipe" });
const jobs = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
const host = jobs.find((j) => j.name === "QA Refine3D");
must(!!host, "S1 QA Refine3D in roster (seeder idempotent)");
const outs = JSON.stringify(await (await fetch(`${BASE}/api/jobs/${host.id}/outputs`)).json());
must(outs.includes("orthovol.mrc"), "S2 orthovol.mrc (main) in outputs");
must(outs.includes("run_it020_half1.mrc") && outs.includes("run_it020_half2.mrc"), "S3 BOTH half-maps in outputs (the gold-standard pair)");

/* ============ W: the wire feeds the oracles ============ */
section("W: terrains on the wire, the probe's own local + centre oracle");
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
const verdict = (r) => Number.isNaN(r) ? "flat — no shape to compare" : r >= 0.85 ? "agrees" : r >= 0.5 ? "partial" : "diverges";
// the local oracle: both sides to the FINER grid, four equal-count cuts,
// each band correlated independently (mirrors localAgreement exactly) —
// and now each band carries its ACTUAL fraction extent (from/to), the
// machine address the jump navigates by
const localR = (mainBins, oBins) => {
  const n = Math.max(mainBins.length, oBins.length);
  if (n < 4) return [];
  const a = resample(mainBins, n), b = resample(oBins, n);
  const out = [];
  for (let k = 0; k < 4; k++) {
    const lo = Math.floor((k * n) / 4), hi = Math.floor(((k + 1) * n) / 4);
    out.push({ r: pearson(a.slice(lo, hi), b.slice(lo, hi)), lo, hi, n, from: lo / n, to: hi / n });
  }
  return out;
};
const QUARTERS = ["Q1 (0–25%)", "Q2 (25–50%)", "Q3 (50–75%)", "Q4 (75–100%)"];
const weakest = (bands) => {
  let w = null;
  for (const b of bands) {
    if (!Number.isFinite(b.r)) continue;
    if (!w || b.r < w.r) w = b;
  }
  return w;
};
const b1 = localR(mainW.bins, half1W.bins);
const w1 = weakest(b1);
must(!!w1 && Number.isFinite(w1.r), `W2 half1's weakest band is finite (${QUARTERS[b1.indexOf(w1)]} r ${w1.r.toFixed(2)})`);
// the centre arithmetic the chip performs — replicated here from the
// oracle's from/to (two-step 2dp rounding, the strip's own dialect)
const centre1 = Math.round(((w1.from + w1.to) / 2) * 100) / 100;
const stripNow1 = Math.round(centre1 * 100);
const receipt1 = `Plane moved to ${stripNow1}% — the centre of run_it020_half1's weakest quarter (${QUARTERS[b1.indexOf(w1)]})`;
console.log(`  (oracle: from ${(w1.from * 100).toFixed(1)}% to ${(w1.to * 100).toFixed(1)}% -> centre ${centre1} -> strip ${stripNow1}%)`);

/* ============ X: source oracles ============ */
section("X: the source keeps its promises");
must(/from: lo \/ n,\s*\n\s*to: hi \/ n,/.test(QCLIB) && QCLIB.includes("interface LocalBand { label: string; r: number; from: number; to: number }"), "X1 the lib carries from/to BESIDE the label — the coordinate is a first-class field, not a parse of the vocabulary");
must(/<button\s*\n\s*key=\{o\.name\}\s*\n\s*type="button"\s*\n\s*data-local-chip=\{o\.name\}/.test(SRC), "X2 the wall chip is a real BUTTON (type=button), not a decorative span");
must(/const centre = Math\.round\(\(\(w\.from \+ w\.to\) \/ 2\) \* 100\) \/ 100;/.test(SRC) && /applySliceIntent\(\{ pos: centre \}\)/.test(SRC), "X3 the jump drinks applySliceIntent with the from/to centre at the strip's 2dp rounding");
must(!/w\.label\.(slice|match|split|replace|indexOf|trim)|parseFloat\(\s*w\.label|Number\(\s*w\.label/.test(SRC), "X4 the jump NEVER does string surgery on the label — the coordinate lives in from/to, the vocabulary is only ever QUOTED (the receipt)");
must(SRC.includes('flashProfileNote(`Plane moved to ${Math.round(centre * 100)}% — the centre of ${o.name}\'s weakest quarter (${w.label})`)'), "X5 the receipt names the address and the percent (the jump is spoken, not silent)");
must(SRC.includes("hover:bg-accent hover:text-accent-foreground") && SRC.includes("active:scale-[0.97]") && SRC.includes("focus-visible:ring-2 focus-visible:ring-ring"), "X6 the chip's states ride the app's tokens: hover pair, press scale, solid token ring");
must(!SRC.includes("focus-visible:ring-cyan-500/70"), "X7 the strip's alpha ring is RETIRED (the census's catch: 1.70:1 in the light room)");
must(SRC.includes('className="block h-9 w-full cursor-crosshair touch-none select-none rounded bg-background/40 outline-none focus-visible:ring-2 focus-visible:ring-ring"'), "X8 the strip's focus ring is the solid --ring token (3.07:1 light / 6.66:1 dark)");
must(SRC.includes("data-r-profile={o.name}") && SRC.indexOf("data-r-profile") < SRC.indexOf("</button>", SRC.indexOf("data-r-profile")), "X9 the sparkline still lives INSIDE the button (contour + address in one door)");

/* ============ D: the door, live ============ */
section("D: click the address, the plane obeys");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1720, height: 940 } });
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => consoleErrors.push(String(e).slice(0, 200)));

await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);
// deterministic DARK via the app's own switch (t192's lesson — use the
// system's door, not emulateMedia; the D-phase's census labels must
// match the room the bytes actually came from)
const darkBtn = page.locator('button[aria-label="Switch to dark theme"]');
if (await darkBtn.isVisible().catch(() => false)) { await darkBtn.click(); await sleep(900); }
must(await page.evaluate(() => document.documentElement.classList.contains("dark")), "D0 the dark room is on (the app's own switch) — the census labels below are honest");
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
// self-heal: overlay sessions persist server-side (t193's doctrine).
// CONDITIONAL Escape (t196's lesson): an Escape with nothing open closes the VIEWER
await page.locator('button[aria-label^="Overlay maps"]').click();
await sleep(900);
while ((await page.locator('button[aria-label^="Remove overlay"]').count()) > 0) {
  await page.locator('button[aria-label^="Remove overlay"]').first().click();
  await sleep(900);
}
// CONDITIONAL Escape with a STABILITY gate (t196's race, closed): the
// popover can auto-close a beat after the last removal — an Escape that
// lands in that gap hits the VIEWER. Only fire when the popover is
// visible TWICE, 250ms apart.
const popUp = async () => await page.locator('[data-testid^="map-choice-"]').first().isVisible().catch(() => false);
if (await popUp()) { await sleep(250); if (await popUp()) await page.keyboard.press("Escape"); }
await sleep(600);
must((await page.locator('div[data-local-row="1"]').count()) === 0, "D2 self-healed world: NO local row before any adoption (no map, no lie)");

// the world can shift under a probe (t196's reality): the dialog itself
// may have closed with the self-heal. Diagnose, then re-open if needed.
await sleep(400);
const dlgCount = await page.locator('[role="dialog"]').count();
const togCount = await page.locator('button[aria-label="Toggle cross-section plane"]').count();
console.log(`  (diag: dialogs ${dlgCount}, toggle buttons ${togCount})`);
if (togCount === 0) {
  console.log("  (diag: toggle missing — walking the door chain again)");
  await page.keyboard.press("Escape"); await sleep(900);
  await page.locator(`[data-job="${host.id}"]`).first().click({ force: true });
  await sleep(1600);
  await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
  await sleep(1400);
  const ot = page.locator('button[aria-label="Enlarge orthovol"]');
  if (await ot.isVisible().catch(() => false)) await ot.click();
  else await page.locator('button[aria-label^="Enlarge"]').first().click({ timeout: 3000 }).catch(() => {});
  await sleep(1100);
  await page.locator("button", { hasText: "View in 3D" }).click();
  let v2 = false;
  for (let k = 0; k < 30; k++) {
    await sleep(2000);
    if (await page.evaluate(() => !!window.__molstar?.canvas3d).catch(() => false)) { v2 = true; break; }
  }
  must(v2, "D2b viewer re-opened after the self-heal shifted the world");
  await page.locator('button[aria-label^="Overlay maps"]').waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
  // the re-opened world may carry a server-side overlay session — heal it
  // again so the adoption click ADOPTS instead of toggling off
  await page.locator('button[aria-label^="Overlay maps"]').click();
  await sleep(900);
  while ((await page.locator('button[aria-label^="Remove overlay"]').count()) > 0) {
    await page.locator('button[aria-label^="Remove overlay"]').first().click();
    await sleep(900);
  }
  if (await popUp()) { await sleep(250); if (await popUp()) await page.keyboard.press("Escape"); }
  await sleep(800);
  if ((await page.locator('button[aria-label="Toggle cross-section plane"]').count()) === 0) {
    console.log("  (diag: toggle STILL missing after re-open — hard fail ahead)");
  }
  await sleep(400);
}

await page.locator('button[aria-label="Toggle cross-section plane"]').click();
let stripVisible = false;
for (let k = 0; k < 12; k++) {
  await sleep(1000);
  if (await page.locator('svg[role="slider"][aria-label^="Density profile along the"]').isVisible().catch(() => false)) { stripVisible = true; break; }
}
must(stripVisible, "D3 main landscape strip rendered");

const strip = page.locator('svg[role="slider"][aria-label^="Density profile along the"]');
const chip1 = page.locator('[data-local-chip="run_it020_half1"]');
const receipt = page.locator('div[role="status"][aria-label="Profile export status"]');

// adopt half1 — the chip arrives with the wire's bytes (t198's oracle rides along)
await page.locator('button[aria-label^="Overlay maps"]').click();
await sleep(1100);
await page.locator('[data-testid^="map-choice-"][title*="half1"]').click();
await sleep(3500);
let chipUp = false;
for (let k = 0; k < 10; k++) {
  if (await chip1.isVisible().catch(() => false)) { chipUp = true; break; }
  await sleep(1000);
}
const chipText = chipUp ? ((await chip1.textContent()) ?? "").trim() : "";
must(chipUp && chipText === `run_it020_half1 · weakest ${QUARTERS[b1.indexOf(w1)]} · r ${w1.r.toFixed(2)} · ${verdict(w1.r)}`, `D4 the chip names the wire's weakest quarter byte-for-byte (${chipText.slice(0, 60)})`);

// deterministic pre-state: keyboard-modality focus on the strip, Home -> 0%
await strip.focus();
await sleep(300);
await strip.press("Home");
await sleep(600);
const nowBefore = Number(await strip.getAttribute("aria-valuenow"));
must(nowBefore === 0, `D5 pre-state: Home put the plane at 0% (aria-valuenow ${nowBefore})`);

// THE DOOR: click the chip — the plane obeys the address
await chip1.click();
let jumped = 0, receiptText = "";
// t206's lesson in t202's frame: the receipt lives 4 SECONDS of WALL TIME,
// but a busy Mol* thread can freeze the page past the probe's first poll —
// the frozen timers then fire together and the receipt is gone by the next
// beat. So: poll FAST and read the EPHEMERAL thing FIRST (receipt before
// valuenow), because the plane's position survives while the receipt dies.
for (let k = 0; k < 16; k++) {
  await sleep(250);
  const st = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[role="status"]')).map((n) => ({
      label: n.getAttribute("aria-label"),
      text: (n.textContent ?? "").slice(0, 120),
    }))
  );
  receiptText = st.find((s) => s.label === "Profile export status")?.text ?? "";
  jumped = Number(await strip.getAttribute("aria-valuenow"));
  if (k === 0) console.log(`  (diag: ${st.length} role=status nodes: ${JSON.stringify(st)})`);
  if (jumped === stripNow1 && receiptText.length > 0) break;
}
must(jumped === stripNow1, `D6 CLICK the address: strip aria-valuenow == ${stripNow1} (got ${jumped}) — the plane sits at the betrayal's centre`);
must(receiptText === receipt1, `D7 the receipt names the jump (${receiptText.slice(0, 70)})`);

// the keyboard door: move the plane away (End -> 100%), Enter on the focused chip brings it back
await strip.focus();
await sleep(250);
await strip.press("End");
await sleep(600);
must(Number(await strip.getAttribute("aria-valuenow")) === 100, "D8 pre-state 2: End put the plane at 100%");
// the chip is still focused? No — the strip stole focus. Tab-walk is
// fragile; focus the chip programmatically INSIDE the keyboard modality
// the strip's keypress just established (t201's modality lesson)
const chipHandle = await chip1.elementHandle();
await page.evaluate((el) => el.focus(), chipHandle);
await sleep(250);
must(await page.evaluate(() => document.activeElement?.getAttribute("data-local-chip") === "run_it020_half1"), "D9 the chip takes the keyboard's focus");
await page.keyboard.press("Enter");
await sleep(700);
let jumpedKb = Number(await strip.getAttribute("aria-valuenow"));
must(jumpedKb === stripNow1, `D10 ENTER on the focused chip: strip == ${stripNow1} (got ${jumpedKb}) — the door has a keyboard`);

// focus ring: the keyboard modality is live, so the chip's :focus-visible
// ring must be painted. Tailwind v4 composes box-shadow as a LIST of
// layered vars whose early entries are transparent placeholders — regexing
// the first colour reads the placeholder, not the ring (diag3's lesson).
// The clean channel: --tw-ring-color, which only carries a value when the
// focus-visible rule is ACTUALLY matching — unset means the ring is dark.
const ringTok = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--ring").trim());
const ringRgb = await toRgb(ringTok);
const chipRingVar = await chip1.evaluate((el) => getComputedStyle(el).getPropertyValue("--tw-ring-color").trim());
const chipRingRgb = chipRingVar ? await toRgb(chipRingVar) : [];
const chipRingW = await chip1.evaluate((el) => getComputedStyle(el).getPropertyValue("--tw-ring-shadow"));
must(chipRingRgb.length === 3 && near(chipRingRgb, ringRgb) && chipRingW.includes("2px"), `D11 the chip's focus ring is PAINTED: --tw-ring-color ${chipRingVar || "(unset)"} in --ring bytes, width 2px (${chipRingW.slice(0, 40)})`);

// hover bytes: the census pair, live — ink == --accent-foreground, bg == --accent
const accTok = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
const accFgTok = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent-foreground").trim());
const accRgb = await toRgb(accTok), accFgRgb = await toRgb(accFgTok);
await chip1.hover();
await sleep(350);
const hovBg = await chip1.evaluate((el) => getComputedStyle(el).backgroundColor);
const hovInk = await chip1.evaluate((el) => getComputedStyle(el).color);
const hovBgRgb = await toRgb(hovBg), hovInkRgb = await toRgb(hovInk);
must(near(hovBgRgb, accRgb) && near(hovInkRgb, accFgRgb), `D12 hover bytes == the token pair (bg ${hovBg} vs --accent [${accRgb}], ink ${hovInk} vs --accent-foreground [${accFgRgb}])`);

// the CENSUS, dark room: the numbers the t201 handoff deferred
const relLum = ([r, g, b]) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a, b) => (Math.max(relLum(a), relLum(b)) + 0.05) / (Math.min(relLum(a), relLum(b)) + 0.05);
const cHovD = contrast(hovInkRgb, hovBgRgb); // hover pair (dark)
must(cHovD >= 4.5, `D13 CENSUS dark: chip hover pair ${cHovD.toFixed(2)}:1 >= 4.5 (small-text floor)`);
await page.mouse.move(10, 10); await sleep(350);
// t203 sync: the chip now carries a VISITING state (plane inside its band
// => text-foreground ink). The rest-pair census needs the chip actually
// at rest — scrub the plane out of the band (End -> 100%, outside Q3)
// before reading, otherwise the label lies about which pair it measured
await strip.focus(); await sleep(250); await strip.press("End"); await sleep(600);
const restInkD = await toRgb(await chip1.evaluate((el) => getComputedStyle(el).color));
const restBgD = await toRgb(await chip1.evaluate((el) => getComputedStyle(el).backgroundColor));
const cChipRestD = contrast(restInkD, restBgD);
must(cChipRestD >= 4.5, `D14 CENSUS dark: chip rest pair ${cChipRestD.toFixed(2)}:1 >= 4.5`);
// the strip's own background is an ALPHA wash (bg-background/40) — the
// honest adjacent colour is the COMPOSITE over its parent's surface
const compositeOverParent = async (loc) => await loc.evaluate((el) => {
  const parse = (s) => (s.match(/[\d.]+/g) ?? []).map(Number);
  const top = parse(getComputedStyle(el).backgroundColor);
  const parent = parse(getComputedStyle(el.parentElement).backgroundColor);
  const a = top.length === 4 ? top[3] : 1;
  const base = parent.length >= 3 ? parent : [34, 42, 50];
  return `rgb(${Math.round(a * top[0] + (1 - a) * base[0])},${Math.round(a * top[1] + (1 - a) * base[1])},${Math.round(a * top[2] + (1 - a) * base[2])})`;
});
const stripBgD = await toRgb(await compositeOverParent(strip));
const cRingD = contrast(ringRgb, stripBgD);
must(cRingD >= 3, `D15 CENSUS dark: strip focus ring vs composite bg ${cRingD.toFixed(2)}:1 >= 3.0 (non-text floor)`);

await page.screenshot({ path: `${OUT}/t202-jump-2x.png` }).catch(() => {});
await page.screenshot({ path: `${OUT}/t202-viewer-2x.png`, fullPage: false }).catch(() => {});

// report bytes unchanged: the Local table's weakest cell == the oracle
// (from/to joined the lib WITHOUT disturbing the report's vocabulary)
await page.locator('button[aria-label="Copy profile QC report"]').click();
await sleep(800);
const md = await page.locator('div[data-csv-carrier="profile"]').getAttribute("data-md").catch(() => null);
must(md?.includes("### Local agreement") && md?.includes(`${QUARTERS[b1.indexOf(w1)]} (${w1.r.toFixed(2)})`), "D16 the report's Local table still speaks the oracle's address (lib fields added, bytes stable)");

/* ============ LIGHT room: the census crosses the boundary ============ */
section("D-light: the census in the light room");
// the door chain leaves TWO dialogs stacked (enlarge under viewer) — the
// first Escape closes the viewer, the enlarge dialog's overlay still
// intercepts the header's theme button. Drain the stack deterministically.
for (let k = 0; k < 3; k++) {
  if (!(await page.locator('[data-slot="dialog-overlay"][data-state="open"]').first().isVisible().catch(() => false))) break;
  await page.keyboard.press("Escape");
  await sleep(900);
}
await sleep(300);
const lightBtn = page.locator('button[aria-label="Switch to light theme"]');
if (await lightBtn.isVisible().catch(() => false)) { await lightBtn.click(); await sleep(900); }
const lightOn = await page.evaluate(() => !document.documentElement.classList.contains("dark"));
must(lightOn, "D17 the light room is on (the app's own switch)");
// re-enter the viewer (t199's proven door chain)
await page.locator(`[data-job="${host.id}"]`).first().click({ force: true });
await sleep(1600);
await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
await sleep(1400);
const orthoTile2 = page.locator('button[aria-label="Enlarge orthovol"]');
if (await orthoTile2.isVisible().catch(() => false)) await orthoTile2.click();
else await page.locator('button[aria-label^="Enlarge"]').first().click({ timeout: 3000 }).catch(() => {});
await sleep(1100);
await page.locator("button", { hasText: "View in 3D" }).click();
let viewerUp2 = false;
for (let k = 0; k < 30; k++) {
  await sleep(2000);
  if (await page.evaluate(() => !!window.__molstar?.canvas3d).catch(() => false)) { viewerUp2 = true; break; }
}
must(viewerUp2, "D18 Mol* viewer live (light room)");

await page.locator('button[aria-label="Toggle cross-section plane"]').click();
let strip2 = null;
for (let k = 0; k < 12; k++) {
  await sleep(1000);
  if (await page.locator('svg[role="slider"][aria-label^="Density profile along the"]').isVisible().catch(() => false)) { strip2 = true; break; }
}
must(strip2, "D19 the strip renders in the light room");
const stripL = page.locator('svg[role="slider"][aria-label^="Density profile along the"]');
const chip1L = page.locator('[data-local-chip="run_it020_half1"]');
// the overlay session persisted server-side; the chip should already be up
let chipLUp = false;
for (let k = 0; k < 10; k++) {
  if (await chip1L.isVisible().catch(() => false)) { chipLUp = true; break; }
  await sleep(1000);
}
must(chipLUp, "D20 the chip speaks in the light room too (overlay session persisted)");

// light census: chip REST pair — disarm first (t203 sync): the remounted
// plane defaults to 50%, INSIDE half1's Q3 band, which would light the
// chip's visiting ink and mislabel this read
await stripL.focus(); await sleep(250); await stripL.press("End"); await sleep(600);
const restInkL = await toRgb(await chip1L.evaluate((el) => getComputedStyle(el).color));
const restBgL = await toRgb(await chip1L.evaluate((el) => getComputedStyle(el).backgroundColor));
const cChipRestL = contrast(restInkL, restBgL);
must(cChipRestL >= 4.5, `D21 CENSUS light: chip rest pair ${cChipRestL.toFixed(2)}:1 >= 4.5`);

// light census: chip HOVER pair
await chip1L.hover();
await sleep(350);
const hovInkL = await toRgb(await chip1L.evaluate((el) => getComputedStyle(el).color));
const hovBgL = await toRgb(await chip1L.evaluate((el) => getComputedStyle(el).backgroundColor));
const cChipHovL = contrast(hovInkL, hovBgL);
must(cChipHovL >= 4.5, `D22 CENSUS light: chip hover pair ${cChipHovL.toFixed(2)}:1 >= 4.5`);

// light census: the strip's focus ring — THE FIX's number (was 1.70:1).
// Same painted-channel discipline as D11: --tw-ring-color, set only when
// the focus-visible rule matches
await stripL.focus();
await sleep(300);
await stripL.press("Home");
await sleep(500);
const ringTokL = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--ring").trim());
const ringRgbL = await toRgb(ringTokL);
const stripRingVarL = await stripL.evaluate((el) => getComputedStyle(el).getPropertyValue("--tw-ring-color").trim());
const stripRingRgbL = stripRingVarL ? await toRgb(stripRingVarL) : [];
const stripRingWL = await stripL.evaluate((el) => getComputedStyle(el).getPropertyValue("--tw-ring-shadow"));
must(stripRingRgbL.length === 3 && near(stripRingRgbL, ringRgbL) && stripRingWL.includes("2px"), `D23 CENSUS light: the strip's ring is painted: --tw-ring-color ${stripRingVarL || "(unset)"} in --ring bytes (${stripRingWL.slice(0, 40)})`);
const stripBgL = await toRgb(await compositeOverParent(stripL));
const cRingL = contrast(ringRgbL, stripBgL);
must(cRingL >= 3, `D24 CENSUS light: strip focus ring ${cRingL.toFixed(2)}:1 >= 3.0 (the old cyan-500/70 was 1.70:1 — the census's catch is fixed)`);

await page.screenshot({ path: `${OUT}/t202-light-census-2x.png` }).catch(() => {});

/* ============ Z: read-only ============ */
section("Z: the world read back");
const roster1 = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
must(roster1.length === roster0.length && roster1.length === 21, `Z1 roster identity (${roster1.length} == ${roster0.length}, canonical 21)`);
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

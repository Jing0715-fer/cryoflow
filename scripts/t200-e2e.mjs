/* t200 e2e — the agreement earns a CONTOUR. t198's quarter bands give a
 * betrayal its BAND (the weakest quarter's address); the r profile gives
 * it its SHAPE: a sliding window (n/8 planes, clamped 4..16) walked
 * across the shared fraction scale over 24 stations, correlated
 * independently at every stop, drawn as a sparkline INSIDE each
 * weakest-quarter chip — stations left to right, dashed line at r=0,
 * negative stations shaded red. The contour is a VISUAL instrument: the
 * report keeps the quarter table (visual instruments don't enter
 * reports — the t193 export doctrine's report chapter), the wall draws
 * the curve. ONE father (rProfile in @/lib/qc-report): the sparkline is
 * this array drawn left to right.
 *   S  setup — seeder, orthovol + BOTH half-maps
 *   W  wire — the probe walks its OWN sliding-window pearson oracle
 *   X  source oracles — ONE rProfile father, no report call site (the
 *      contour stays off the paper), the sparkline is labeled and
 *      probe-findable, negative stations shaded, chip text untouched
 *      (t198's byte-for-byte oracle survives the embedding)
 *   D  live — adoption draws the contour: every FINITE station de-typed
 *      back to r and compared to the wire oracle RAW (the y coordinate
 *      carries a 2dp quantization — comparing pre-rounded values once
 *      produced a false FAIL at a rounding boundary); NaN stations are
 *      GENUINE GAPS (segmented runs — never "x,NaN" bytes, never a
 *      bridge); the second map draws its own; removals dissolve in step;
 *      the empty set leaves nothing
 *   Z  read-only — roster identity, console clean
 * x3 runs required by house rules. */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { readFileSync } from "fs";
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const RUN = Number(process.env.RUN ?? "1");
const OUT = "scripts/shots-t200";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const fails = [];
const must = (cond, label) => {
  if (cond) { pass++; console.log(`  ok: ${label}`); }
  else { fail++; fails.push(label); console.error(`  FAIL: ${label}`); }
};
const section = (t) => console.log(`\n== ${t} ==`);

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

/* ============ W: the wire feeds the oracle ============ */
section("W: terrains on the wire, the probe's own contour oracle");
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
// the contour oracle: sliding window (n/8 clamped 4..16), 24 stations by
// window CENTRE — mirrors rProfile exactly
const STEPS = 24;
const rProfileOracle = (mainBins, oBins) => {
  const n = Math.max(mainBins.length, oBins.length);
  if (n < 4) return { window: 0, rs: [] };
  const a = resample(mainBins, n), b = resample(oBins, n);
  const w = Math.min(16, Math.max(4, Math.round(n / 8)));
  const rs = [];
  for (let k = 0; k < STEPS; k++) {
    const centre = Math.round((k / (STEPS - 1)) * (n - 1));
    const lo = Math.max(0, Math.min(n - w, centre - Math.floor(w / 2)));
    rs.push(pearson(a.slice(lo, lo + w), b.slice(lo, lo + w)));
  }
  return { window: w, rs };
};
const rp1 = rProfileOracle(mainW.bins, half1W.bins);
const rp2 = rProfileOracle(mainW.bins, half2W.bins);
must(rp1.rs.length === 24 && rp2.rs.length === 24 && rp1.window >= 4, `W2 both contour oracles walk 24 stations at window ${rp1.window}`);

/* ============ X: source oracles ============ */
section("X: the source tells the truth");
must((QCLIB.match(/export const rProfile/g) || []).length === 1 && SRC.includes("rProfile(profile.bins, o.bins)"), "X1 ONE rProfile father in @/lib/qc-report — the wall's sparkline drinks from it");
must(!QCLIB.includes("rProfile(") && QCLIB.includes("visual instruments don't enter reports"), "X2 the contour never enters the REPORT (zero rProfile call sites in the lib — buildProfileReport keeps the quarter table)");
must(SRC.includes('data-r-profile={o.name}') && SRC.includes('role="img"') && SRC.includes("Sliding-window agreement profile"), "X3 the sparkline is labeled (role=img) and probe-findable (data-r-profile)");
must(SRC.includes('strokeDasharray="3 3"') && SRC.includes('fill="#f43f5e"') && SRC.includes("-r * 4.5"), "X4 the drawing is honest: dashed r=0 line, negative stations shaded, y mapped r in [-1,1]");
must(/const rp = rProfile\(profile\.bins, o\.bins\)[\s\S]{0,900}Number\.isFinite\(r\)/.test(SRC) && SRC.includes("runs.push(cur)"), "X4b the drawing keeps the hole promise: NaN stations are segmented out as genuine gaps (never invalid bytes)");
must(SRC.includes("{o.name} · weakest {w.label} · r {w.r.toFixed(2)} · {agreementVerdict(w.r)}"), "X5 the chip TEXT is untouched by the embedding (t198's byte-for-byte oracle survives)");
must(/data-r-profile=\{o\.name\}[\s\S]{0,2400}data-local-chip/.test(SRC) || /data-local-chip=\{o\.name\}[\s\S]{0,2400}data-r-profile=\{o\.name\}/.test(SRC), "X6 the sparkline lives INSIDE the weakest-quarter chip (one row, contour + address together)");

/* ============ D: the live loop ============ */
section("D: the contour, live");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => consoleErrors.push(String(e).slice(0, 200)));

await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);
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
// API-STAGED WORLD (the qa67-seeder doctrine's UI chapter): adoption is
// NOT the surface under test here (t198 already owns the UI adoption
// path, and the Layers popover's choice buttons carry a disable storm:
// active || busy || overlayBusy !== null — plus a re-render detach race).
// The contour is. So the probe stages half1+half2 through the SAME
// overlay-session API the viewer restores from, reopens the viewer, and
// asserts the DRAWING; only the REMOVAL path stays UI-driven (one
// popover door, opened idempotently).
const H2 = { "sec-fetch-site": "same-origin", "content-type": "application/json" };
const stage = (paths) => fetch(`${BASE}/api/jobs/${host.id}/overlay-session`, {
  method: "PUT", headers: H2,
  body: JSON.stringify({
    mode: "replace",
    entries: paths.map((p, i) => ({
      path: p, name: p, color: i === 0 ? "#22d3ee" : "#a78bfa", alpha: 1, sigmaOffset: 0,
    })),
    removedPaths: [],
  }),
});
// clean slate first (a crashed predecessor's session must not leak in)
await stage([]);
await stage(["run_it020_half1.mrc", "run_it020_half2.mrc"]);
const sess = await (await fetch(`${BASE}/api/jobs/${host.id}/overlay-session`, { headers: H2 })).json();
must((sess.entries ?? []).length === 2, "D2 staged world: half1+half2 in the overlay session (API truth)");

// reopen the viewer so it RESTORES the staged tenancy
await page.keyboard.press("Escape").catch(() => {});
await sleep(1200);
await page.locator('button[aria-label="Enlarge orthovol"]').click().catch(() => {});
await sleep(1100);
await page.locator("button", { hasText: "View in 3D" }).click();
let viewer2 = false;
for (let k = 0; k < 30; k++) {
  await sleep(2000);
  if (await page.evaluate(() => !!window.__molstar?.canvas3d).catch(() => false)) { viewer2 = true; break; }
}
must(viewer2, "D3 viewer reopened (restored tenancy)");
// the profile panel (and its chips) renders only while the slice is ON
// — a reopened viewer starts slice-OFF (t196's door-chain doctrine)
await page.locator('button[aria-label="Toggle cross-section plane"]').click();
let strip2 = false;
for (let k = 0; k < 12; k++) {
  await sleep(1000);
  if (await page.locator('svg[role="slider"][aria-label^="Density profile along the"]').isVisible().catch(() => false)) { strip2 = true; break; }
}
must(strip2, "D3b slice re-armed in the reopened viewer");
let bothUp = false;
for (let k = 0; k < 20; k++) {
  const a = await page.locator('[data-r-profile="run_it020_half1"]').isVisible().catch(() => false);
  const b = await page.locator('[data-r-profile="run_it020_half2"]').isVisible().catch(() => false);
  if (a && b) { bothUp = true; break; }
  await sleep(1000);
}
must(bothUp, "D4 the restored adoption draws BOTH contours");

// Read a contour as {station -> r}: every polyline of the svg (the line
// is segmented into finite RUNS — NaN stations are holes), each point
// de-typed back to r. x is the station's address: k = round(x*23/100).
const readContour = async (name) => {
  const handles = await page.locator(`svg[data-r-profile="${name}"] polyline`).all();
  const byK = new Map();
  for (const h of handles) {
    const p = await h.getAttribute("points");
    for (const tok of (p ?? "").split(" ").filter(Boolean)) {
      const [x, y] = tok.split(",").map(Number);
      const k = Math.round((x / 100) * (STEPS - 1));
      if (!byK.has(k)) byK.set(k, (5 - y) / 4.5);
    }
  }
  return byK;
};
// The contour equals the wire oracle: every FINITE station present with
// its TRUE r (raw comparison — the drawing quantizes y to 2dp, ±0.005/4.5
// ≈ ±0.0011 on de-typing; the old probe compared pre-rounded values and
// false-FAILED at a rounding boundary), every NaN station ABSENT — the
// hole is real, never a zero, never a bridge.
const contourOk = (byK, oracle) => {
  for (let k = 0; k < oracle.rs.length; k++) {
    const r = oracle.rs[k];
    const g = byK.get(k);
    if (!Number.isFinite(r)) { if (g !== undefined) return false; continue; }
    if (g === undefined || Math.abs(g - r) > 0.0075) return false;
  }
  return byK.size === oracle.rs.filter(Number.isFinite).length;
};
const byK1 = await readContour("run_it020_half1");
const nan1 = rp1.rs.filter((r) => !Number.isFinite(r)).length;
must(contourOk(byK1, rp1), `D5 half1's contour equals the wire oracle station-by-station (${byK1.size}/24 finite, ${nan1} holes, window ${rp1.window})`);
const neg1 = await page.locator('svg[data-r-profile="run_it020_half1"] rect').count();
const oracleNeg1 = rp1.rs.filter((r) => Number.isFinite(r) && r < 0).length;
must(neg1 === oracleNeg1, `D6 negative stations shaded honestly (${neg1} rects == oracle's ${oracleNeg1})`);
const nan2 = rp2.rs.filter((r) => !Number.isFinite(r)).length;
must(nan2 > 0, `D6b the world itself speaks flat windows (${nan2} NaN stations in half2's oracle — the hole logic is exercised, not dead code)`);
const byK2 = await readContour("run_it020_half2");
must(contourOk(byK2, rp2), `D7 half2's contour equals ITS wire oracle — ${nan2} flat stations are genuine GAPS in the drawing`);
const stroke1 = await page.locator('svg[data-r-profile="run_it020_half1"] polyline').first().getAttribute("stroke");
must(stroke1 !== null && stroke1.length > 0, `D8 the contour wears the overlay's color (${stroke1})`);

// the portrait: two contours on the wall
await page.screenshot({ path: `${OUT}/t200-wall-2x.png` }).catch(() => {});

// UI removal path — one popover door, opened idempotently
const openOverlayPopover = async () => {
  for (let i = 0; i < 8; i++) {
    if ((await page.locator('button[aria-label^="Remove overlay"]').count()) > 0) return true;
    await page.locator('button[aria-label^="Overlay maps"]').click();
    await sleep(1100);
  }
  return false;
};
must(await openOverlayPopover(), "D9 the Layers popover opened (idempotent door)");
await page.locator('button[aria-label="Remove overlay run_it020_half2"]').click();
await sleep(1800);
must((await page.locator('svg[data-r-profile="run_it020_half2"]').count()) === 0, "D10 UI removal dissolves half2's contour");
must((await page.locator('svg[data-r-profile="run_it020_half1"]').count()) === 1, "D11 half1's contour survives its neighbour's removal (per-map)");
must(await openOverlayPopover(), "D12 the popover re-opened for the second removal");
await page.locator('button[aria-label="Remove overlay run_it020_half1"]').click();
await sleep(1800);
must((await page.locator("svg[data-r-profile]").count()) === 0, "D13 the empty set leaves NO contour (retirement covers the empty set)");

// world restitution: the UI removals already rewrote the session; assert
// the server truth and never leave a tenancy behind. Persistence rides an
// async PUT behind the React removal — poll until the wire agrees instead
// of betting on a fixed sleep.
let sessEmpty = false;
let sessLen = -1;
for (let k = 0; k < 12; k++) {
  const s2 = await (await fetch(`${BASE}/api/jobs/${host.id}/overlay-session`, { headers: H2 })).json();
  sessLen = (s2.entries ?? []).length;
  if (sessLen === 0) { sessEmpty = true; break; }
  await sleep(1000);
}
must(sessEmpty, `D14 world restitution: the overlay session is empty server-side (poll found ${sessLen})`);

/* ============ Z: read-only ============ */
section("Z: the world unchanged");
const roster1 = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
must(roster1.length === roster0.length, `Z1 roster identity (${roster1.length} jobs)`);
must(consoleErrors.length === 0, `Z2 console clean (${consoleErrors.length} errors)`);
if (consoleErrors.length) console.error(consoleErrors.slice(0, 5));

await browser.close();
console.log(`\nT200 RUN ${RUN}: ${pass} pass, ${fail} fail`);
if (fail) { console.error(fails.map((f) => "  - " + f).join("\n")); process.exit(1); }

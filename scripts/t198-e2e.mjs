/* t198 e2e — the divergence earns an ADDRESS. A global r can hide a
 * localized betrayal: a comparison map can agree over most of the depth
 * and part ways in a single band (a mask edge, a noise shelf). t193 made
 * the divergence VISIBLE (two terrains, one plane); t195/t196 made it
 * COUNTABLE (global r, pairwise r); t198 makes it LOCATABLE:
 *   - report: a "### Local agreement" table (Map | Q1..Q4 | Weakest) —
 *     the shared fraction scale cut into four equal-count bands, each
 *     correlated independently on its OWN variance; the weakest quarter
 *     is the street number of the noise
 *   - wall: one live chip per comparison map (data-local-row) naming
 *     its weakest quarter — no export, nothing to retire, and it does
 *     not exist when no comparison map is speaking (no map, no lie)
 *   S  setup — seeder, orthovol + BOTH half-maps
 *   W  wire — profiles feed the probe's own local-agreement oracle
 *   X  source oracles — ONE localAgreement father (report table + wall
 *      chips both drink), equal-count cuts, weakest-band NaN discipline,
 *      section ordering (Local before Pairwise), honest shortest guard
 *   D  live — one overlay: chip appears with the WIRE's weakest band
 *      byte-for-byte, report table equals the oracle's four cells; the
 *      second overlay adds its own chip WITHOUT disturbing the pair
 *      logic (t196 stays green); removals dissolve chips and sections
 *      in step; the empty set leaves NOTHING on the wall
 *   Z  read-only — roster identity, console clean
 * x3 runs required by house rules. */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { readFileSync } from "fs";
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const RUN = Number(process.env.RUN ?? "1");
const OUT = "scripts/shots-t198";
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
const outs = JSON.stringify(await (await fetch(`${BASE}/api/jobs/${host.id}/outputs`)).json());
must(outs.includes("orthovol.mrc"), "S2 orthovol.mrc (main) in outputs");
must(outs.includes("run_it020_half1.mrc") && outs.includes("run_it020_half2.mrc"), "S3 BOTH half-maps in outputs (the gold-standard pair)");

/* ============ W: the wire feeds the oracles ============ */
section("W: terrains on the wire, the probe's own local oracle");
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
// each band correlated independently (mirrors localAgreement exactly)
const localR = (mainBins, oBins) => {
  const n = Math.max(mainBins.length, oBins.length);
  if (n < 4) return [];
  const a = resample(mainBins, n), b = resample(oBins, n);
  const out = [];
  for (let k = 0; k < 4; k++) {
    const lo = Math.floor((k * n) / 4), hi = Math.floor(((k + 1) * n) / 4);
    out.push(pearson(a.slice(lo, hi), b.slice(lo, hi)));
  }
  return out;
};
const QUARTERS = ["Q1 (0–25%)", "Q2 (25–50%)", "Q3 (50–75%)", "Q4 (75–100%)"];
const weakest = (bands) => {
  let w = null;
  bands.forEach((r, i) => { if (Number.isFinite(r) && (!w || r < w.r)) w = { i, r }; });
  return w;
};
const b1 = localR(mainW.bins, half1W.bins), b2 = localR(mainW.bins, half2W.bins);
const w1 = weakest(b1), w2 = weakest(b2);
const fmt = (r) => `r ${r.toFixed(2)} · ${verdict(r)}`;
const chip1Exp = `run_it020_half1 · weakest ${QUARTERS[w1.i]} · ${fmt(w1.r)}`;
const chip2Exp = `run_it020_half2 · weakest ${QUARTERS[w2.i]} · ${fmt(w2.r)}`;
console.log(`  (oracles: half1 weakest ${QUARTERS[w1.i]} ${w1.r.toFixed(2)} | half2 weakest ${QUARTERS[w2.i]} ${w2.r.toFixed(2)})`);
const rHalfHalf = pearson(resample(half1W.bins, Math.max(half1W.bins.length, half2W.bins.length)), resample(half2W.bins, Math.max(half1W.bins.length, half2W.bins.length))).toFixed(2);
must(b1.length === 4 && b2.length === 4, "W2 both local oracles speak four bands (equal-count cuts of the shared grid)");

/* ============ X: source oracles ============ */
section("X: the source tells the truth");
must((QCLIB.match(/const localAgreement/g) || []).length === 1 && QCLIB.includes("localAgreement(bins, o.bins)") && SRC.includes("weakestBand(localAgreement("), "X1 ONE localAgreement father — the report table AND the wall chips both drink from it");
must(QCLIB.includes("Math.floor((k * n) / 4)") && QCLIB.includes("a.slice(lo, hi)"), "X2 equal-count cuts [floor(k*n/4), floor((k+1)*n/4)) — disjoint, exhaustive, no shared boundary plane");
must(QCLIB.includes("### Local agreement") && QCLIB.indexOf("### Local agreement") < QCLIB.indexOf("### Pairwise agreement"), "X3 the Local agreement section exists and sits BEFORE the pairwise table (per-map locals, then the pairs)");
must(SRC.includes('data-local-row="1"') && SRC.includes("data-local-chip=") && SRC.includes('aria-label="Local shape agreement — the weakest quarter of each comparison map"'), "X4 the wall speaks weakest quarters through a labeled, probe-findable row");
must(QCLIB.includes("localized betrayal") && SRC.includes("the address to inspect"), "X5 the WEAKNESS doctrine lives on BOTH the report (prose) and the wall (chip title)");
must(QCLIB.includes("Number.isFinite(b.r)") && /export const weakestBand[\s\S]{0,300}return w;/.test(QCLIB), "X6 weakestBand refuses to rank NaN bands and returns null when every band is flat (no invented addresses)");
must(QCLIB.includes("if (n < 4) return [];"), "X7 the shortest honest guard: four bands need at least four planes (n<4 says nothing rather than lying)");
must((QCLIB.match(/QUARTER_LABELS = \[/g) || []).length === 1 && QUARTERS.every((q) => QCLIB.includes(q)), "X8 the four quarter labels are ONE shared vocabulary (lib-owned, not re-typed per surface)");

/* ============ D: the live loop ============ */
section("D: the address, live");
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
// self-heal: overlay sessions persist server-side (t193's doctrine).
// CONDITIONAL Escape (t196's lesson): removing overlays can auto-close
// the popover — an Escape with nothing open would close the VIEWER
await page.locator('button[aria-label^="Overlay maps"]').click();
await sleep(900);
while ((await page.locator('button[aria-label^="Remove overlay"]').count()) > 0) {
  await page.locator('button[aria-label^="Remove overlay"]').first().click();
  await sleep(900);
}
if (await page.locator('[data-testid^="map-choice-"]').first().isVisible().catch(() => false)) {
  await page.keyboard.press("Escape");
}
await sleep(600);
must((await page.locator('div[data-local-row="1"]').count()) === 0, "D2 self-healed world: NO local row before any adoption (no map, no lie)");

await page.locator('button[aria-label="Toggle cross-section plane"]').click();
let stripVisible = false;
for (let k = 0; k < 12; k++) {
  await sleep(1000);
  if (await page.locator('svg[role="slider"][aria-label^="Density profile along the"]').isVisible().catch(() => false)) { stripVisible = true; break; }
}
must(stripVisible, "D3 main landscape strip rendered");

const carrier = page.locator('div[data-csv-carrier="profile"]');
const carrierMd = async () => await carrier.getAttribute("data-md").catch(() => null);
const copyRep = page.locator('button[aria-label="Copy profile QC report"]');
const localRow = page.locator('div[data-local-row="1"]');

// adopt half1 — one overlay: ONE weakest-quarter chip, exact bytes
await page.locator('button[aria-label^="Overlay maps"]').click();
await sleep(1100);
await page.locator('[data-testid^="map-choice-"][title*="half1"]').click();
await sleep(3500);
let t1 = false;
for (let k = 0; k < 10; k++) {
  if (await page.locator('[data-overlay-terrain*="half1"]').isVisible().catch(() => false)) { t1 = true; break; }
  await sleep(1000);
}
must(t1, "D4 half1 terrain arrived");
let chipUp = false;
for (let k = 0; k < 10; k++) {
  if (await localRow.isVisible().catch(() => false)) { chipUp = true; break; }
  await sleep(1000);
}
const chip1 = chipUp ? ((await page.locator('[data-local-chip="run_it020_half1"]').textContent()) ?? "").trim() : "";
must(chipUp && chip1 === chip1Exp, `D5 the wall chip names half1's weakest quarter with the WIRE's r (${chip1.slice(0, 70)})`);
await copyRep.click();
await sleep(700);
const md1 = await carrierMd();
// SECTION bitmap first: the vs-main table's rows start with the same
// "| run_it020_half" prefix as the local table's rows — locate the
// segment BETWEEN headings before picking rows (the t194 column-bitmap
// lesson, now with a section axis)
const localSection = (md) => {
  const s = (md ?? "").indexOf("### Local agreement");
  if (s < 0) return "";
  const rest = md.slice(s);
  const e = rest.indexOf("### Pairwise agreement");
  return e > 0 ? rest.slice(0, e) : rest;
};
const localLine1 = localSection(md1).split("\n").find((l) => l.startsWith("| run_it020_half1"));
const cells1 = localLine1 ? localLine1.split("|").map((c) => c.trim()) : [];
must(md1?.includes("### Local agreement"), "D6 the report speaks the Local agreement section");
must(cells1.length >= 7 && cells1.slice(2, 6).join("|") === b1.map((r) => Number.isFinite(r) ? r.toFixed(2) : "—").join("|"), `D7 the four quarter cells equal the probe's oracle byte-for-byte (${cells1.slice(2, 6).join(" ")})`);
must(cells1[6] === `${QUARTERS[w1.i]} (${w1.r.toFixed(2)})`, `D8 the Weakest column names the oracle's address (${cells1[6]})`);
must(md1?.includes("localized betrayal"), "D9 the report teaches WHY a global r is not enough");

// adopt half2 — a second chip, and t196's pair row must stay intact
await page.locator('button[aria-label^="Overlay maps"]').click();
await sleep(1100);
const half2Btn = page.locator('[data-testid^="map-choice-"][title*="half2"]');
if (!(await half2Btn.isVisible().catch(() => false))) {
  await page.locator('button[aria-label^="Overlay maps"]').click();
  await sleep(1100);
}
await half2Btn.click();
await sleep(3500);
let t2 = false;
for (let k = 0; k < 10; k++) {
  if (await page.locator('[data-overlay-terrain*="half2"]').isVisible().catch(() => false)) { t2 = true; break; }
  await sleep(1000);
}
must(t2, "D10 half2 terrain arrived");
let bothUp = false;
for (let k = 0; k < 10; k++) {
  if (await page.locator('[data-local-chip="run_it020_half2"]').isVisible().catch(() => false)) { bothUp = true; break; }
  await sleep(1000);
}
const chip2 = bothUp ? ((await page.locator('[data-local-chip="run_it020_half2"]').textContent()) ?? "").trim() : "";
must(bothUp && chip2 === chip2Exp, `D11 the second chip names half2's weakest quarter with the WIRE's r (${chip2.slice(0, 70)})`);
const pairChip = (await page.locator('div[data-pairwise-row="1"]').textContent().catch(() => "")) ?? "";
must(pairChip.includes("half1") && pairChip.includes("half2") && pairChip.includes(`r ${rHalfHalf}`), "D12 t196's pairwise chip is UNDISTURBED (same father family, orthogonal rows)");
must((await carrierMd()) === null, "D13 the second adoption retired the armed report (its dimension grew)");
await copyRep.click();
await sleep(700);
const md2 = await carrierMd();
must(md2?.includes("### Local agreement") && md2?.includes("### Pairwise agreement"), "D14 the re-export speaks BOTH the local table and the pairwise table");
const localRows2 = localSection(md2).split("\n").filter((l) => l.startsWith("| run_it020_half"));
must(localRows2.length === 2, "D15 the local table now speaks both maps (two rows)");

// remove half2 — its chip and pairwise section leave; half1's chip stays
await page.locator('button[aria-label^="Overlay maps"]').click();
await sleep(900);
await page.locator('button[aria-label="Remove overlay run_it020_half2"]').click();
await sleep(1600);
must((await page.locator('[data-local-chip="run_it020_half2"]').count()) === 0, "D16 removal dissolves half2's chip");
must((await localRow.isVisible().catch(() => false)) && (await page.locator('[data-local-chip="run_it020_half1"]').count()) === 1, "D17 half1's chip SURVIVES its neighbour's removal (per-map row, not per-pair)");
await copyRep.click();
await sleep(700);
const md3 = await carrierMd();
must(md3?.includes("### Local agreement") && !md3?.includes("### Pairwise agreement"), "D18 the report drops the pairwise section but KEEPS the local table (one map still speaks)");

// remove half1 — the empty set: the wall keeps NOTHING (t195's doctrine:
// the retirement contract must cover the empty set)
await page.locator('button[aria-label^="Overlay maps"]').click();
await sleep(900);
await page.locator('button[aria-label="Remove overlay run_it020_half1"]').click();
await sleep(1600);
must((await page.locator('div[data-local-row="1"]').count()) === 0, "D19 the empty set leaves NO local row on the wall (retirement covers the empty set)");

// world restitution: leave NO adopted overlay behind — the next run (or
// the next probe) must find the world exactly as we found it
await page.locator('button[aria-label^="Overlay maps"]').click();
await sleep(900);
while ((await page.locator('button[aria-label^="Remove overlay"]').count()) > 0) {
  await page.locator('button[aria-label^="Remove overlay"]').first().click();
  await sleep(900);
}
if (await page.locator('[data-testid^="map-choice-"]').first().isVisible().catch(() => false)) {
  await page.keyboard.press("Escape");
}
await sleep(500);

/* ============ Z: read-only ============ */
section("Z: the world unchanged");
const roster1 = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
must(roster1.length === roster0.length && roster1.every((j, i) => j.id === roster0.find((r) => r.id === j.id)?.id), `Z1 roster identity (${roster1.length} jobs, nothing created or destroyed)`);
must(consoleErrors.length === 0, `Z2 console clean (${consoleErrors.length} errors)`);
if (consoleErrors.length) console.error(consoleErrors.slice(0, 5));

await browser.close();
console.log(`\nT198 RUN ${RUN}: ${pass} pass, ${fail} fail`);
if (fail) { console.error(fails.map((f) => "  - " + f).join("\n")); process.exit(1); }

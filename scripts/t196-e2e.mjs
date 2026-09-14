/* t196 e2e — the gold-standard pair gets its number. half1 vs half2 is
 * THE cryo-EM QC question: two independent reconstructions built from
 * disjoint halves of the data — where they agree with EACH OTHER, the
 * density is real (the question FSC asks). t195's report spoke each
 * overlay vs the MAIN map; t196 completes the matrix:
 *   - report: a "### Pairwise agreement" table (Map A | Map B | r |
 *     Verdict) whenever 2+ comparison terrains are adopted, both sides
 *     resampled to the FINER of the two grids (the finer ruler preserves
 *     more shape)
 *   - wall: a live chip row (data-pairwise-row) under the overlay
 *     terrains — the gold-standard number visible without exporting,
 *     live-computed, nothing exported, nothing to retire
 *   S  setup — seeder, orthovol + BOTH half-maps
 *   W  wire — three profiles feed the probe's own pearson oracles
 *   X  source oracles — ONE pairwise helper (builder + wall both drink),
 *      finer-grid resample, guarded section, FSC teaching on wall+report
 *   D  live — 1 overlay: no pairwise row, no pairwise section; 2nd
 *      adoption retires the armed report (its dimension grew), the wall
 *      chip appears with r == wire oracle; re-export speaks the pairwise
 *      table with BOTH vs-main rows AND the half1-half2 row; removal
 *      retires again and the section/chip disappear
 *   Z  read-only — roster identity, console clean
 * x3 runs required by house rules. */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { readFileSync } from "fs";
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const RUN = Number(process.env.RUN ?? "1");
const OUT = "scripts/shots-t196";
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
section("W: three terrains on the wire");
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
  let sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { sa += a[i]; sb += b[i]; }
  const ma = sa / n, mb = sb / n;
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < n; i++) { const da = a[i] - ma, db = b[i] - mb; cov += da * db; va += da * da; vb += db * db; }
  return va === 0 || vb === 0 ? NaN : cov / Math.sqrt(va * vb);
};
// the pairwise oracle resamples BOTH to the FINER grid = max of the two
const rHalfHalf = pearson(resample(half1W.bins, Math.max(half1W.bins.length, half2W.bins.length)), resample(half2W.bins, Math.max(half1W.bins.length, half2W.bins.length))).toFixed(2);
const rMainHalf1 = pearson(resample(half1W.bins, mainW.bins.length), mainW.bins).toFixed(2);
const rMainHalf2 = pearson(resample(half2W.bins, mainW.bins.length), mainW.bins).toFixed(2);
console.log(`  (oracles: half1~half2 r=${rHalfHalf}, main~half1 r=${rMainHalf1}, main~half2 r=${rMainHalf2})`);

/* ============ X: source oracles ============ */
section("X: the source tells the truth");
must((SRC.match(/const pairwiseAgreement/g) || []).length === 1 && (SRC.match(/pairwiseAgreement\(/g) || []).length >= 2, "X1 ONE pairwise helper — the report AND the wall both drink from it (definition + 2 call sites)");
must(/const pairwiseAgreement[\s\S]{0,600}Math\.max\(overlays\[i\]\.bins\.length, overlays\[j\]\.bins\.length\)/.test(SRC), "X2 pairs resample to the FINER of the two grids (the finer ruler preserves more shape)");
must(/if \(overlays\.length > 1\) \{[\s\S]{0,300}### Pairwise agreement/.test(SRC), "X3 the pairwise table exists only when 2+ terrains are adopted (no empty-table lie)");
must(SRC.includes('data-pairwise-row="1"') && SRC.includes('aria-label="Pairwise shape agreement between adopted comparison maps"'), "X4 the wall speaks pairs through a labeled, probe-findable row");
must(SRC.includes("the question FSC asks") && SRC.split("the question FSC asks").length >= 3, "X5 the FSC teaching lives on BOTH the wall (title) and the report (prose)");
must(/nothing exported, nothing to retire/.test(SRC), "X6 the wall chip is live-computed — nothing exported, nothing to retire");

/* ============ D: the live loop ============ */
section("D: the pair, live");
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
// CONDITIONAL Escape: removing overlays can auto-close the popover — an
// Escape with nothing open would close the VIEWER dialog instead, and the
// toggle button would vanish (the flake this probe's first batch hit)
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

await page.locator('button[aria-label="Toggle cross-section plane"]').click();
let stripVisible = false;
for (let k = 0; k < 12; k++) {
  await sleep(1000);
  if (await page.locator('svg[role="slider"][aria-label^="Density profile along the"]').isVisible().catch(() => false)) { stripVisible = true; break; }
}
must(stripVisible, "D2 main landscape strip rendered");

const carrier = page.locator('div[data-csv-carrier="profile"]');
const carrierMd = async () => await carrier.getAttribute("data-md").catch(() => null);
const copyRep = page.locator('button[aria-label="Copy profile QC report"]');
const pairRow = page.locator('div[data-pairwise-row="1"]');

// adopt half1 — one overlay: NO pairwise anything yet
await page.locator('button[aria-label^="Overlay maps"]').click();
await sleep(1100);
await page.locator('[data-testid^="map-choice-"][title*="half1"]').click();
await sleep(3500);
let t1 = false;
for (let k = 0; k < 10; k++) {
  if (await page.locator('[data-overlay-terrain*="half1"]').isVisible().catch(() => false)) { t1 = true; break; }
  await sleep(1000);
}
must(t1, "D3 half1 terrain arrived");
must((await pairRow.count()) === 0, "D4 ONE overlay: no pairwise row on the wall (no pair, no lie)");
await copyRep.click();
await sleep(700);
const md1 = await carrierMd();
must(md1?.includes("### Comparison maps (1)") && !md1?.includes("### Pairwise agreement"), "D5 ONE overlay: the report speaks the vs-main table only (no empty pairwise section)");

// adopt half2 — the gold-standard pair is complete
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
must(t2, "D6 half2 terrain arrived");
must((await carrierMd()) === null, "D7 the second adoption retired the armed report (its dimension grew — overlayProfiles changed)");
let pairUp = false;
for (let k = 0; k < 10; k++) {
  if (await pairRow.isVisible().catch(() => false)) { pairUp = true; break; }
  await sleep(1000);
}
const chipText = pairUp ? ((await pairRow.textContent()) ?? "") : "";
must(pairUp && chipText.includes("half1") && chipText.includes("half2") && chipText.includes(`r ${rHalfHalf}`), `D8 the wall chip speaks the pair with the WIRE's r (${chipText.trim().slice(0, 70)})`);

await copyRep.click();
await sleep(700);
const md2 = await carrierMd();
must(md2?.includes("### Comparison maps (2)") && md2?.includes("### Pairwise agreement"), "D9 the report now speaks BOTH sections");
const vsRows = (md2 ?? "").split("\n").filter((l) => l.startsWith("| run_it020_half"));
const row1 = vsRows.find((l) => l.includes("half1") && !l.includes("half2"));
const row2 = vsRows.find((l) => l.includes("half2") && !l.includes("half1"));
const pairLine = (md2 ?? "").split("\n").find((l) => l.includes("half1") && l.includes("half2") && l.startsWith("|"));
must(!!row1 && row1.split("|").map((c) => c.trim())[4] === rMainHalf1, `D10 vs-main row half1 == wire oracle (${rMainHalf1})`);
must(!!row2 && row2.split("|").map((c) => c.trim())[4] === rMainHalf2, `D11 vs-main row half2 == wire oracle (${rMainHalf2})`);
must(!!pairLine && pairLine.split("|").map((c) => c.trim()).slice(1, 3).join("|") === "run_it020_half1|run_it020_half2" && pairLine.split("|").map((c) => c.trim())[3] === rHalfHalf, `D12 the pairwise row names both halves and carries the wire's r (${rHalfHalf}) — FOUR columns: r lives at split[3], not [4] (the t194 column-bitmap lesson, self-inflicted)`);
must(md2?.includes("the question FSC asks"), "D13 the report teaches WHY the pair matters (FSC prose)");

// the portrait: two terrains + the gold-standard chip
await page.screenshot({ path: `${OUT}/t196-pair-2x.png` }).catch(() => {});

// remove half2 — the pair dissolves, the wall chip and section leave
await page.locator('button[aria-label^="Overlay maps"]').click();
await sleep(900);
await page.locator('button[aria-label="Remove overlay run_it020_half2"]').click();
await sleep(1600);
must((await pairRow.count()) === 0, "D14 removal dissolves the wall chip (no pair, no lie)");
must((await carrierMd()) === null, "D15 removal retired the report again");
await copyRep.click();
await sleep(700);
const md3 = await carrierMd();
must(md3?.includes("### Comparison maps (1)") && !md3?.includes("### Pairwise agreement"), "D16 back to one overlay: the pairwise section is gone from the report too");

// world restitution: leave NO adopted overlay behind — the next run (or
// the next probe) must not inherit this run's tenancy (Task 161's radius
// protocol, the UI chapter). Conditional Escape again.
await page.locator('button[aria-label^="Overlay maps"]').click();
await sleep(900);
while ((await page.locator('button[aria-label^="Remove overlay"]').count()) > 0) {
  await page.locator('button[aria-label^="Remove overlay"]').first().click();
  await sleep(900);
}
if (await page.locator('[data-testid^="map-choice-"]').first().isVisible().catch(() => false)) {
  await page.keyboard.press("Escape");
}
await sleep(400);
must((await page.locator('[data-overlay-terrain]').count()) === 0, "D17 world restitution: no overlay left adopted");

/* ============ Z: read-only ============ */
section("Z: read-only");
const roster1 = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
must(roster1.length === roster0.length, `Z1 roster identity (${roster0.length} == ${roster1.length})`);
must(consoleErrors.length === 0, `Z2 console clean (${consoleErrors.length}${consoleErrors.length ? ": " + consoleErrors[0] : ""})`);

console.log(`\nT196 RUN ${RUN}: ${pass} pass, ${fail} fail`);
if (fail) { console.log(fails.map((f) => "  ✗ " + f).join("\n")); process.exit(1); }
await browser.close();

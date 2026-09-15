/* t195 e2e — the landscape earns a human summary. The slice instrument's
 * profile panel gains the report family's third and fourth doors (Copy
 * Report / Download Report): buildProfileReport is ONE builder deriving
 * from the profile ROWS (never parsing the CSV — parse-of-parse is a
 * second derivation waiting to drift), speaking peak/trough/span in
 * prose, a GFM table of adopted comparison maps with a REAL shape-
 * agreement number (Pearson r on the shared 0-100% fraction scale,
 * resampled by fraction — never bin index) and an honest "none adopted"
 * teaching line. mdCell (t194) is promoted to @/lib/md — the second
 * consumer arrived, the twin had to die (downloadText precedent).
 *   S  setup — seeder, roster, orthovol + both half-maps
 *   W  wire — map-profile serves main and half (the r oracle's parents)
 *   X  source oracles — ONE builder, no parse-of-parse, carrier
 *      cohabitation (data-csv + data-md), retirement deps
 *      [profile, overlayProfiles], fraction resampling before pearson,
 *      verdict ladder, mdCell promotion, flex-wrap carrier
 *   D  live UI — export speaks; peak == wire argmax; scrub never
 *      retires; adoption retires the report but NOT the CSV
 *      (the asymmetry oracle: CSV is a main-map function); re-export's
 *      r equals the probe's own wire-computed pearson; removal retires
 *      again; download door names the .md and never apologizes
 *   Z  read-only — roster identity, console clean
 * x3 runs required by house rules. */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { readFileSync } from "fs";
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const RUN = Number(process.env.RUN ?? "1");
const OUT = "scripts/shots-t195";
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
const HPCS = readFileSync("src/components/workflow/hpc-queue-sim.tsx", "utf8");
const MDLIB = readFileSync("src/lib/md.ts", "utf8");
const QCLIB = readFileSync("src/lib/qc-report.ts", "utf8");
const roster0 = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
// the map-profile surface denies metadata-less requests by design —
// the probe speaks browser, not curl (t193's H header)
const H = { "sec-fetch-site": "same-origin" };
const slice = (src, a, b) => {
  const i = src.indexOf(a);
  if (i < 0) return "";
  const j = src.indexOf(b, i + a.length);
  return j < 0 ? src.slice(i) : src.slice(i, j);
};

/* ============ S: setup ============ */
section("S: the world");
execSync('QA_VOL_HOST="QA Refine3D" python3 scripts/qa67-seed-volume.py', { stdio: "pipe" });
const jobs = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
const host = jobs.find((j) => j.name === "QA Refine3D");
must(!!host, "S1 QA Refine3D in roster (seeder idempotent)");
const outs = JSON.stringify(await (await fetch(`${BASE}/api/jobs/${host.id}/outputs`)).json());
must(outs.includes("orthovol.mrc"), "S2 orthovol.mrc (main map) in outputs");
must(outs.includes("run_it020_half1.mrc") && outs.includes("run_it020_half2.mrc"), "S3 both half-maps in outputs (the comparison pair)");

/* ============ W: the wire that feeds the r oracle ============ */
section("W: the wire speaks both maps");
const mainWire = await (await fetch(`${BASE}/api/jobs/${host.id}/map-profile?path=${encodeURIComponent("orthovol.mrc")}&axis=z`, { headers: H })).json();
const halfWire = await (await fetch(`${BASE}/api/jobs/${host.id}/map-profile?path=${encodeURIComponent("run_it020_half1.mrc")}&axis=z`, { headers: H })).json();
must(Array.isArray(mainWire?.bins) && mainWire.bins.length > 0, `W1 main profile valid (${mainWire?.bins?.length} bins)`);
must(Array.isArray(halfWire?.bins) && halfWire.bins.length > 0, `W2 half1 profile valid (${halfWire?.bins?.length} bins)`);
const wirePeak = mainWire.bins.reduce((p, v, i, a) => (v > a[p] ? i : p), 0);
const wirePeakPct = `${((wirePeak / Math.max(1, mainWire.bins.length - 1)) * 100).toFixed(1)}%`;
// the probe mirrors the product's resample+pearson (its own independent
// second derivation — allowed HERE because the probe is the auditor, and
// a mismatch is exactly what it exists to catch)
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
const wireR = pearson(resample(halfWire.bins, mainWire.bins.length), mainWire.bins).toFixed(2);

/* ============ X: source oracles ============ */
section("X: the source tells the truth");
must((QCLIB.match(/const buildProfileReport/g) || []).length === 1 && !SRC.includes("const buildProfileReport"), "X1 ONE builder — buildProfileReport defined exactly once (in @/lib/qc-report since t197; the viewer imports it)");
const repBody = slice(SRC, "const exportProfileReport", "const commitSlice");
must(repBody.length > 0 && !repBody.includes("ProfileCsv"), "X2 the report export NEVER touches the CSV (no parse-of-parse in the function body)");
must(!repBody.includes("slicePos"), "X3 the report is a function of the LANDSCAPE, not the playhead (no slicePos in the export)");
must(MDLIB.includes("export const mdCell") && HPCS.includes('import { mdCell } from "@/lib/md"') && QCLIB.includes('import { mdCell } from "@/lib/md"') && !/^const mdCell/m.test(HPCS) && !/^const mdCell/m.test(QCLIB), "X4 mdCell promoted to @/lib/md — hpc and qc-report both import it, the twin is dead (the viewer dropped its import when the builder moved, t197)");
must((() => { const t = slice(SRC, 'data-csv-carrier="profile"', ">\n"); return t.includes("data-csv={lastProfileCsv ?? undefined}") && t.includes("data-md={lastProfileReport ?? undefined}"); })(), "X5 data-md cohabits with data-csv on the ALWAYS-ATTACHED carrier (t194 doctrine)");
must(SRC.includes("setLastProfileReport(null);") && SRC.includes("}, [profile, overlayProfiles]);"), "X6 retirement deps are [profile, overlayProfiles] — the report retires when anything it SPEAKS changes");
must(repBody.includes('downloadText(fname, md, "text/markdown;charset=utf-8")'), "X7 the fallback download speaks markdown mime (same bytes as the clipboard)");
must(QCLIB.includes("pearson(resampleByFraction("), "X8 r is computed on FRACTION-resampled terrains (never bin index) — the math lives in @/lib/qc-report since t197");
must(QCLIB.includes("r >= 0.85") && QCLIB.includes("r >= 0.5") && QCLIB.includes("flat — no shape to compare"), "X9 the verdict ladder is honest (agrees/partial/diverges + flat says it cannot compare) — in @/lib/qc-report since t197");
must(SRC.includes('aria-label="Copy profile QC report"') && SRC.includes('aria-label="Download profile QC report"') && (SRC.match(/disabled=\{!profile\}/g) || []).length >= 4, "X10 both report doors named, all four doors disabled without a landscape");
must(/flex min-w-0 flex-wrap items-center justify-end gap-1\.5"\s*\n\s*data-csv-carrier="profile"/.test(SRC), "X11 the carrier wraps gracefully (flex-wrap) — four chips + XYZ + plane readout cannot overflow the panel");
must(QCLIB.includes("_Exported from CryoFlow's slice instrument"), "X12 the report carries its own provenance caveat (contour-independent, whole-map) — in @/lib/qc-report since t197");

/* ============ D: the live loop ============ */
section("D: the report, live");
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
// DETERMINISTIC MAIN MAP: name it (t191/t193 lesson — the first tile is
// whichever output sorts first)
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
// SELF-HEAL: overlay sessions persist server-side — clear any restored
// adoption before asserting (qa67-seeder doctrine, the UI chapter)
await page.locator('button[aria-label^="Overlay maps"]').click();
await sleep(900);
while ((await page.locator('button[aria-label^="Remove overlay"]').count()) > 0) {
  await page.locator('button[aria-label^="Remove overlay"]').first().click();
  await sleep(900);
}
// CONDITIONAL Escape (t196's doctrine, synced here): removing overlays
// can auto-close the popover — an Escape with nothing open closes the
// VIEWER dialog instead, and the toggle button vanishes (this probe's
// intermittent first-batch flake, twice observed in t198's window)
if (await page.locator('[data-testid^="map-choice-"]').first().isVisible().catch(() => false)) {
  await page.keyboard.press("Escape");
}
await sleep(600);

// Cold-session armor (t209's backfit — t196's shape, the two-sightings
// rule finally reached this probe): a persisted overlay session makes
// Mol* restore its MRCs BEFORE the toolbar buttons exist, and the
// cross-section toggle can lag the viewer dialog by minutes (t209's RUN
// sighting on a freshly restarted server). Give the toggle a long poll;
// if it still hasn't shown, evict BOTH mirrors (the PUT contract +
// localStorage — the ritual above already ran clean, the eviction is the
// fresh start) and re-open the viewer.
let toggleBtn = page.locator('button[aria-label="Toggle cross-section plane"]');
let toggleUp = await toggleBtn.isVisible().catch(() => false);
for (let k = 0; k < 30 && !toggleUp; k++) {
  await sleep(2000);
  toggleUp = await toggleBtn.isVisible().catch(() => false);
}
if (!toggleUp) {
  await fetch(`${BASE}/api/jobs/${host.id}/overlay-session`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ entries: [], mode: "replace" }),
  }).catch(() => {});
  await page.evaluate((k) => localStorage.removeItem(`cryoflow.mol-overlays:${k}`), host.id).catch(() => {});
  await page.reload({ waitUntil: "networkidle" });
  await sleep(2200);
  await page.locator(`[data-job="${host.id}"]`).first().click({ force: true });
  await sleep(1600);
  await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
  await sleep(1400);
  const ot = page.locator('button[aria-label="Enlarge orthovol"]');
  if (await ot.isVisible().catch(() => false)) await ot.click();
  await sleep(1000);
  await page.locator("button", { hasText: "View in 3D" }).click();
  for (let k = 0; k < 30; k++) { await sleep(2000); if (await page.evaluate(() => !!window.__molstar?.canvas3d).catch(() => false)) break; }
  toggleBtn = page.locator('button[aria-label="Toggle cross-section plane"]');
}
await toggleBtn.click();
let stripVisible = false, stripAxis = "?";
for (let k = 0; k < 12; k++) {
  await sleep(1000);
  if (await page.locator('svg[role="slider"][aria-label^="Density profile along the"]').isVisible().catch(() => false)) { stripVisible = true; break; }
}
must(stripVisible, "D2 main landscape strip rendered");
const strip = page.locator('svg[role="slider"][aria-label^="Density profile along the"]');
stripAxis = (((await strip.getAttribute("aria-label")) ?? "").match(/along the ([XYZ]) axis/) || [])[1] ?? "?";
must(stripAxis === "Z" || stripAxis === "X" || stripAxis === "Y", `D2b the strip speaks its axis (${stripAxis})`);
const axLow = stripAxis.toLowerCase();

const carrier = page.locator('div[data-csv-carrier="profile"]');
const carrierMd = async () => await carrier.getAttribute("data-md").catch(() => null);
const carrierCsv = async () => await carrier.getAttribute("data-csv").catch(() => null);
const note = async () => (await page.locator('div[aria-label="Profile export status"]').textContent().catch(() => "")) ?? "";

must((await carrierMd()) === null && (await carrierCsv()) === null, "D3 before any export the carrier carries NOTHING (no md, no csv)");

const copyRep = page.locator('button[aria-label="Copy profile QC report"]');
const dlRep = page.locator('button[aria-label="Download profile QC report"]');
must(await copyRep.isEnabled() && await dlRep.isEnabled(), "D4 both report doors enabled once the landscape exists");
await copyRep.click();
await sleep(700);
const md1 = await carrierMd();
const n1 = await note();
// the receipt speaks whichever door fired: the clipboard, or the honest
// fallback that NAMES its degradation (t188's B3: the clipboard can be
// truly denied in headless — the fallback is the second door, not a lie)
const spoken = /Copied the QC summary/.test(n1) || (/Downloaded map-qc-report-/.test(n1) && n1.includes("(clipboard unavailable)"));
must(!!md1 && spoken, `D5 copy leaves a receipt (clipboard or honest fallback) AND the carrier now carries the report bytes (${n1.trim().slice(0, 55)})`);
const footerText = (await page.locator("span", { hasText: /mean ρ along/ }).last().textContent().catch(() => "")) ?? "";
const nBins = Number((/· (\d+) bins/.exec(footerText) || [])[1]);
const hdrOk = md1?.startsWith("## Map QC summary — ") && md1.includes("orthovol") && md1.includes(`along **${stripAxis}**`);
const binsOk = md1?.includes(`(${nBins} bins)`);
must(hdrOk && binsOk, `D6 the report names the map, the axis and the footer's bin count (${nBins} bins along ${stripAxis})`);
must(md1?.includes(`**${wirePeakPct}**`) && md1?.includes("**Peak** mean ρ"), `D7 the report's peak equals the WIRE's argmax (${wirePeakPct}) — prose agrees with bytes`);
must(md1?.includes("**Span** across planes:") && /max -?\d+\.\d{4}, min -?\d+\.\d{4}/.test(md1 ?? ""), "D8 span/max/min present with fixed-point discipline");
must(md1?.includes("### Comparison maps (0)") && md1?.includes("None adopted yet"), "D9 the honest empty state: comparison section says NONE and teaches the door (Layers)");

// scrub never retires: the report is a landscape function
const mdBefore = md1;
await strip.focus();
await page.keyboard.press("ArrowLeft");
await sleep(900);
await page.keyboard.press("ArrowRight");
await sleep(900);
must((await carrierMd()) === mdBefore, "D10 scrubbing does NOT retire the report (bytes unchanged through ArrowLeft+ArrowRight)");

// arm the CSV too — the asymmetry oracle needs both exports alive
await page.locator('button[aria-label="Copy profile as CSV"]').click();
await sleep(700);
must(!!(await carrierCsv()), "D11 CSV armed as well (both twins on the carrier)");

// adopt half1 — the report's dimension grows stale the moment the
// overlay SET changes (retirement deps [profile, overlayProfiles])
await page.locator('button[aria-label^="Overlay maps"]').click();
await sleep(1100);
const halfBtn = page.locator('[data-testid^="map-choice-"][title*="half1"]');
must(await halfBtn.isVisible().catch(() => false), "D12 half1 offered in the Layers panel");
await halfBtn.click();
await sleep(3500);
let terrainUp = false;
for (let k = 0; k < 10; k++) {
  if (await page.locator('[data-overlay-terrain*="half1"]').isVisible().catch(() => false)) { terrainUp = true; break; }
  await sleep(1000);
}
must(terrainUp, "D13 half1 terrain line arrived");
must((await carrierMd()) === null, "D14 the ADOPTION retired the report (attribute removed at observer speed — stale summary never survives a new dimension)");

await copyRep.click();
await sleep(700);
const md2 = await carrierMd();
const row = (md2 ?? "").split("\n").find((l) => l.includes("half1") && l.startsWith("|"));
must(md2?.includes(`### Comparison maps (1)`) && md2?.includes("| Map | Bins | Peak at | Agreement r | Verdict |") && !!row, "D15 re-export speaks the comparison table (1 map, GFM header)");
// column bitmap: split("|") -> [0]"" [1]name [2]bins [3]peak [4]r [5]verdict
const cells = row ? row.split("|").map((c) => c.trim()) : [];
const rCell = cells[4], vCell = cells[5];
must(cells[1]?.includes("half1") && Number(cells[2]) === halfWire.bins.length && /\d+\.\d%/.test(cells[3] ?? ""), `D16 the row speaks half1's own truth (bins ${cells[2]}, peak ${cells[3]})`);
must(rCell === wireR, `D17 the report's r equals the probe's wire-computed pearson (${rCell} == ${wireR})`);
must(["agrees", "partial", "diverges"].includes(vCell ?? ""), `D18 the verdict comes from the ladder (${vCell})`);

// remove the overlay — the report retires AGAIN, the CSV does not
await page.locator('button[aria-label^="Overlay maps"]').click();
await sleep(900);
await page.locator('button[aria-label="Remove overlay run_it020_half1"]').click();
await sleep(1600);
const mdAfter = await carrierMd();
const csvAfter = await carrierCsv();
must(mdAfter === null && csvAfter !== null, "D19 removal retires the REPORT but not the CSV — the asymmetry oracle (CSV is a main-map function; the report speaks the overlay set)");

// the download door names the file and never apologizes (explicit mode)
await dlRep.click();
await sleep(700);
const noteDl = await note();
must(new RegExp(`Downloaded map-qc-report-${axLow}-`).test(noteDl) && !noteDl.includes("(clipboard unavailable)"), `D20 the explicit download names the .md and does not apologize (${noteDl.trim().slice(0, 60)})`);

// the portrait: landscape + four doors + receipt
await page.screenshot({ path: `${OUT}/t195-report-doors.png` }).catch(() => {});

await page.keyboard.press("Escape");
await sleep(600);

/* ============ Z: read-only ============ */
section("Z: read-only");
const roster1 = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
must(roster1.length === roster0.length, `Z1 roster identity (${roster0.length} == ${roster1.length})`);
must(consoleErrors.length === 0, `Z2 console clean (${consoleErrors.length}${consoleErrors.length ? ": " + consoleErrors[0] : ""})`);

console.log(`\nT195 RUN ${RUN}: ${pass} pass, ${fail} fail`);
if (fail) { console.log(fails.map((f) => "  ✗ " + f).join("\n")); process.exit(1); }
await browser.close();

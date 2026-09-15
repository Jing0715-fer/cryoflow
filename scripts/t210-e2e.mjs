/* t210 e2e — every door stays pressable: the LANE doctrine. t203 drew
 * each local betrayal, t208 drew each pair's territory — both rows
 * assumed the sandbox's one-pair world. A SECOND map (or pair)
 * betraying in the SAME quarter would paint directly over the first
 * bracket, and a covered bracket is a door that cannot be pressed: a
 * lying door. t210 packs BOTH rows lane by lane with ONE algorithm
 * (packLanes — greedy first-fit on a from-sorted list; touching bands
 * share a lane, colliding bands split upward): the local stack grows
 * upward from 27.4, the pair stack floats above however many local
 * lanes exist (in the one-local-lane world that is exactly t208's
 * y 24.4, byte for byte). The probe's world grows a THIRD speaking map
 * (scripts/seed-masked.py, run_it020_masked.mrc) engineered so the
 * structure is live-testable: pair(h1,h2)=Q3 stays alone, pair(h1,m)
 * and pair(h2,m) BOTH land in Q2 — a genuine collision that must split
 * — while the three LOCALS betray in three DISTINCT quarters (Q3, Q1,
 * Q4) and honestly share the bottom lane. One shared lane, one split
 * lane, three local lanes collapsed into one: the packing's both
 * behaviours, live.
 *   S  setup — seeder, orthovol + BOTH half-maps + the MASKED variant
 *   W  wire — three pair oracles + the LANE oracle (greedy packing
 *      replicated) + per-pair centres and receipts
 *   X  source oracles — t209's full set + packLanes (one definition,
 *      two consumers), the lane attributes, the float formulas, the
 *      legend's lane lesson
 *   D  live — t209's set adapted to the 3-map world + the lanes:
 *      three pair rects, per-pair y == the lane oracle byte-for-byte,
      same-quarter split (two Q2 pairs on two lanes), disjoint share
 *      (Q2 + Q3 on one lane), three locals collapsed onto lane0, EVERY
 *      door pressed (three pair doors + the masked local door), the
 *      legend's territory rows mirror the fuller world (1+3+1+1)
 *   Z  read-only — roster identity, console clean
 * x3 runs required by house rules. */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { readFileSync } from "fs";
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const RUN = Number(process.env.RUN ?? "1");
const OUT = "scripts/shots-t210";
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
const QUARTERS = ["Q1 (0–25%)", "Q2 (25–50%)", "Q3 (50–75%)", "Q4 (75–100%)"];

/* ============ S: setup ============ */
section("S: the world");
execSync('QA_VOL_HOST="QA Refine3D" python3 scripts/qa67-seed-volume.py', { stdio: "pipe" });
execSync("python3 scripts/seed-refine-halves.py", { stdio: "pipe" });
execSync("python3 scripts/seed-masked.py", { stdio: "pipe" });
const jobs = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
const host = jobs.find((j) => j.name === "QA Refine3D");
must(!!host, "S1 QA Refine3D in roster (seeder idempotent)");
const outs = JSON.stringify(await (await fetch(`${BASE}/api/jobs/${host.id}/outputs`)).json());
must(outs.includes("orthovol.mrc") && outs.includes("run_it020_half1.mrc") && outs.includes("run_it020_half2.mrc") && outs.includes("run_it020_masked.mrc"), "S2 orthovol + BOTH half-maps + the MASKED variant in outputs (t210's third speaker)");

// S3: the probe starts HYGIENIC. The server overlay mirror follows the job
// across browsers; a persisted session makes Mol* restore its MRCs before
// the panel button exists, and RUN=4/5 proved a cold box can hide that
// button behind the restore for minutes (dbg2's timetable: a session-free
// world shows it in ~5s). A fresh playwright context has no localStorage,
// so the browser mirror starts empty by construction — the server side is
// the one that must be cleared BEFORE any page opens.
await fetch(`${BASE}/api/jobs/${host.id}/overlay-session`, {
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ entries: [], mode: "replace" }),
}).catch(() => {});

/* ============ W: the wire feeds the band oracle + the depth string ============ */
section("W: bands and depth strings on the wire");
const prof = async (p) => (await (await fetch(`${BASE}/api/jobs/${host.id}/map-profile?path=${encodeURIComponent(p)}&axis=z`, { headers: H })).json());
const mainW = await prof("orthovol.mrc");
const half1W = await prof("run_it020_half1.mrc");
const half2W = await prof("run_it020_half2.mrc");
const maskedW = await prof("run_it020_masked.mrc");
must(mainW?.bins?.length > 0 && half1W?.bins?.length > 0 && half2W?.bins?.length > 0 && maskedW?.bins?.length > 0, `W1 all four profiles valid (main ${mainW?.bins?.length}, half1 ${half1W?.bins?.length}, half2 ${half2W?.bins?.length}, masked ${maskedW?.bins?.length} bins)`);
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
    if (!w || r < w.r) w = { r, from: lo / n, to: hi / n, k };
  }
  return w;
};
const w1 = weakestOf(mainW.bins, half1W.bins);
const w2 = weakestOf(mainW.bins, half2W.bins);
const w3 = weakestOf(mainW.bins, maskedW.bins);
must(!!w1 && !!w2 && !!w3 && w1.k === 2 && w2.k === 0, `W2 the locals' addresses match history (half1 Q${w1.k + 1} r ${w1.r.toFixed(2)}, half2 Q${w2.k + 1} r ${w2.r.toFixed(2)}, masked Q${w3?.k + 1} r ${w3?.r.toFixed(2)})`);
must(!!w3 && w3.k !== w1.k && w3.k !== w2.k, `W3 the three LOCALS betray in three DISTINCT quarters (Q${w1.k + 1}/Q${w2.k + 1}/Q${w3.k + 1}) — the local row's honest share of lane0`);
// the PAIRWISE oracle: the same cut, the pair as its own two maps —
// half1 x half2's weakest band (NOT against the main landscape)
const wPair = weakestOf(half1W.bins, half2W.bins);
must(!!wPair, `W4 the pair's own weakest band exists (Q${wPair.k + 1} r ${wPair.r.toFixed(2)})`);
const wPairHM = weakestOf(half1W.bins, maskedW.bins);
const wPairH2M = weakestOf(half2W.bins, maskedW.bins);
must(!!wPairHM && !!wPairH2M, `W5 the masked pairs' weakest bands exist (h1×m Q${wPairHM?.k + 1} r ${wPairHM?.r.toFixed(2)}, h2×m Q${wPairH2M?.k + 1} r ${wPairH2M?.r.toFixed(2)})`);
// THE ENGINEERED COLLISION: both masked pairs land in the SAME quarter
// (Q2) while the halves' own pair stays in Q3 — the same-quarter pairs
// must SPLIT lanes, the disjoint Q3 pair must SHARE lane0 with one of
// them. The structure the lane doctrine exists for, live.
must(wPairHM.k === wPairH2M.k && wPairHM.k !== wPair.k, `W6 the engineered collision is LIVE (both masked pairs in Q${wPairHM.k + 1}, the halves' pair in Q${wPair.k + 1} — one split + one share)`);
// the LANE oracle — the probe replicates packLanes (greedy first-fit on
// a from-sorted list) and derives each pair's lane and y, byte for byte
const packLanesOracle = (bands) => {
  const ends = [];
  return bands.map(({ from, to }) => {
    let lane = ends.findIndex((e) => e <= from + 1e-9);
    if (lane < 0) { lane = ends.length; ends.push(to); }
    else ends[lane] = Math.max(ends[lane], to);
    return lane;
  });
};
// pair order == pairwiseAgreement's nested i<j over the adoption order
// [half1, half2, masked]; the stable from-sort keeps ties in that order
const pairBands = [
  { key: "run_it020_half1|run_it020_half2", w: wPair, a: "run_it020_half1", b: "run_it020_half2" },
  { key: "run_it020_half1|run_it020_masked", w: wPairHM, a: "run_it020_half1", b: "run_it020_masked" },
  { key: "run_it020_half2|run_it020_masked", w: wPairH2M, a: "run_it020_half2", b: "run_it020_masked" },
];
const pairLaneOrder = [...pairBands].sort((x, y) => x.w.from - y.w.from || x.w.to - y.w.to);
const pairLanesO = packLanesOracle(pairLaneOrder.map(({ w }) => w));
const pairLaneByKey = {};
pairLaneOrder.forEach(({ key }, i) => { pairLaneByKey[key] = pairLanesO[i]; });
const localLaneCountO = Math.max(...packLanesOracle([w2, w1, w3].sort((x, y) => x.from - y.from || x.to - y.to))) + 1;
const pairBaseYO = 24.4 - (localLaneCountO - 1) * 3.0;
const pairYByKey = {};
pairLaneOrder.forEach(({ key }, i) => { pairYByKey[key] = (pairBaseYO - pairLanesO[i] * 3.0).toFixed(1); });
console.log(`  (lanes: h1h2 -> lane ${pairLaneByKey["run_it020_half1|run_it020_half2"]} y ${pairYByKey["run_it020_half1|run_it020_half2"]}; h1m -> lane ${pairLaneByKey["run_it020_half1|run_it020_masked"]} y ${pairYByKey["run_it020_half1|run_it020_masked"]}; h2m -> lane ${pairLaneByKey["run_it020_half2|run_it020_masked"]} y ${pairYByKey["run_it020_half2|run_it020_masked"]}; localLanes ${localLaneCountO})`);
must(new Set(pairLanesO).size === 2 && pairLaneByKey["run_it020_half1|run_it020_half2"] === pairLaneByKey["run_it020_half1|run_it020_masked"] && pairLaneByKey["run_it020_half1|run_it020_masked"] !== pairLaneByKey["run_it020_half2|run_it020_masked"], "W7 the lane oracle splits the collision and shares the disjoint lane (2 lanes: h1h2 and h1m share lane0, h2m rides lane1)");
const rPairGlobal = pearson(resample(half1W.bins, Math.max(half1W.bins.length, half2W.bins.length)), resample(half2W.bins, Math.max(half1W.bins.length, half2W.bins.length)));
// t207: the DOOR's arithmetic — the centre of the pair's band, rounded to
// the same 2dp grid the chip/bracket doors use (ONE algorithm, three doors)
const pairCentre = Math.round(((wPair.from + wPair.to) / 2) * 100) / 100;
const pairPct = Math.round(pairCentre * 100);
const pairReceipt = `Plane moved to ${pairPct}% — the centre of the thinnest corroboration between run_it020_half1 and run_it020_half2 (${QUARTERS[wPair.k]})`;
console.log(`  (door: pair centre ${pairCentre} -> ${pairPct}%)`);
// the DEPTH string: the strip's own 2dp dialect (from–to, en dash) —
// the SAME numbers t204's bracket door jumps to
const depthStr = (w) => `${w.from.toFixed(2)}–${w.to.toFixed(2)}`;
const d1 = depthStr(w1), d2 = depthStr(w2), d3 = depthStr(w3), dPair = depthStr(wPair);
console.log(`  (oracle: half1 ${QUARTERS[w1.k]} depth ${d1}; half2 ${QUARTERS[w2.k]} depth ${d2}; PAIR ${QUARTERS[wPair.k]} depth ${dPair})`);

/* ============ X: source oracles ============ */
section("X: the source keeps its promises");
must(QCLIB.includes("| Weakest | Depth (fraction) |`") && QCLIB.includes("| --- | --- | --- | --- | --- | --- | --- |"), "X1 the Local table carries SEVEN columns — Depth (fraction) rides AFTER Weakest (no front-wave cell index moves)");
must(QCLIB.includes("const depth = w ? `${w.from.toFixed(2)}–${w.to.toFixed(2)}` : \"—\";"), "X2 the depth cell drinks from/to directly (the strip's 2dp dialect) — never a parse of the label");
must(/w \? `\$\{w\.label\} \(\$\{w\.r\.toFixed\(2\)\}\)` : "flat — no local shape"/.test(QCLIB), "X3 the Weakest cell's t198 dialect is byte-identical (label + r, flat stays flat)");
must(QCLIB.includes("the Depth column quotes that address as fractions"), "X4 the prose names the Depth column — the paper teaches its own new instrument");
must(!/w\.label\.(slice|match|split|replace|indexOf|trim)|parseFloat\(\s*w\.label|Number\(\s*w\.label/.test(QCLIB), "X5 the lib NEVER does string surgery on the label — the coordinate lives in from/to (t202's X4, now on the report side too)");
must(QCLIB.includes("t205") && QCLIB.includes("the paper and the wall now quote the same address"), "X6 the LocalBand contract carries the t205 amendment — paper and wall quote ONE address");
must(QCLIB.includes("| Map A | Map B | Agreement r | Verdict | Depth (fraction) |") && QCLIB.includes("| --- | --- | --- | --- | --- |"), "X7 the Pairwise table carries FIVE columns — Depth rides AFTER Verdict (t196's A/B/r indices unmoved)");
must(QCLIB.includes('const pdepth = p.weakest ? `${p.weakest.from.toFixed(2)}–${p.weakest.to.toFixed(2)}` : "—";'), "X8 the pairwise depth cell drinks weakest.from/to directly — a pair without an address keeps the honest dash");
must(/const pairwiseAgreement[\s\S]{0,600}Math\.max\(overlays\[i\]\.bins\.length, overlays\[j\]\.bins\.length\)/.test(QCLIB), "X9 t197's X2 distance guard SURVIVED the t206 edit (resample-to-finer stays near the definition)");
must(QCLIB.includes("the localAgreement cut") && QCLIB.includes("pair as its own two maps") && QCLIB.includes("equal-count cut as localAgreement"), "X10 the pairwise weakest is the localAgreement cut applied BETWEEN the pair (one algorithm, two inputs)");
must((QCLIB.match(/### Pairwise agreement/g) || []).length === 1 && QCLIB.includes("where each pair's corroboration is thinnest"), "X11 the prose teaches the pairwise Depth column — where the corroboration is thinnest");
must(SRC.includes("const pdepth = p.weakest ? ` · ${p.weakest.from.toFixed(2)}–${p.weakest.to.toFixed(2)}` : \"\";") && SRC.includes("thinnest corroboration sits between"), "X12 the wall chip rides the same address (2dp dialect + the title names the band)");
must(SRC.includes("if (!pw || !pjump) {") && SRC.includes("data-pairwise-chip={`${p.a}|${p.b}`}"), "X13 t207: the pair WITHOUT an address stays a plain span — no address, no door, no lie (and both forms carry the probe-findable attribute)");
must(SRC.includes("onClick={pjump}") && /return \(\s*<button[\s\S]{0,400}data-pairwise-chip/.test(SRC), "X14 the pair WITH an address is a real button — the door answers the hand AND the keyboard (no aria-hidden cowardice)");
must(SRC.includes("const pcentre = pw ? Math.round(((pw.from + pw.to) / 2) * 100) / 100 : null;"), "X15 the door's centre is the chip/bracket door's own algorithm (Math.round(((from+to)/2)*100)/100) — one arithmetic, three doors");
must(SRC.includes("the centre of the thinnest corroboration between ${p.a} and ${p.b} (${pw.label})"), "X16 the receipt speaks the pair's dialect (t202's receipt template, the pair's vocabulary)");
must(SRC.includes("data-visiting={pvisiting ? \"1\" : undefined}") && SRC.includes("${pvisiting ? \"text-foreground\" : \"text-muted-foreground\"}"), "X17 visiting rides the pair's band and the ink REPLACES, never joins (t203's same-specificity discipline)");
// t208: the strip's pair painter — the territory the pair's door lands on
must(SRC.includes("data-pair-bracket={`${p.a}|${p.b}`}") && SRC.includes('fill="currentColor"'), "X18 the strip draws the pair's territory in NEUTRAL ink — corroboration belongs to the pair, not to either map's colour");
must((SRC.match(/the centre of the thinnest corroboration between \$\{p\.a\} and \$\{p\.b\} \(\$\{pw\.label\}\)/g) || []).length === 2, "X19 the receipt dialect is spoken by BOTH doors (chip t207 + bracket t208) — byte-identical, one vocabulary");
must(SRC.includes("if (!p.weakest) return []; // no address, no territory") && SRC.includes("data-pair-visiting={pvisiting ? \"1\" : \"0\"}"), "X20 the pair bracket keeps the honest branch (a pair without an address draws nothing) and the visiting attribute always answers");
must(SRC.includes('<g aria-hidden="true">{pairBrackets}</g>') && SRC.includes('<g aria-hidden="true">{bandBrackets}</g>'), "X21 the pair's territory lives in the aria-hidden layer — the hand's door only; the keyboard's door remains the pairwise chip (t204's discipline, t207's button)");
// t209: the legend's door + the paper's epilogue — the dialect's two voices
must(SRC.includes('data-profile-legend-toggle="1"') && SRC.includes('aria-expanded={legendOpen}') && SRC.includes('aria-controls="profile-legend"'), "X22 the legend's toggle is a REAL disclosure control — aria-expanded answers, aria-controls binds the lesson it opens");
must(SRC.includes('id="profile-legend"') && SRC.includes('data-profile-legend="1"') && SRC.includes("{legendOpen && ("), "X23 the legend renders ONLY when the lesson is open — teaching that forces itself open is a pop-up, not a legend");
must(SRC.includes('bg-amber-600 text-white') && SRC.includes('hover:bg-amber-600/15'), "X24 the teaching door wears AMBER — its own accent against the CSV's cyan and the report's violet (open state fills, so the reader always knows the lesson is showing)");
must(SRC.includes('data-legend-territory="landscape"') && SRC.includes('data-legend-territory="overlay"') && SRC.includes('data-legend-territory="pair"') && SRC.includes('data-legend-territory="playhead"'), "X25 the legend names EVERY territory the strip draws — landscape, each overlay, the pair, the playhead");
must(SRC.includes('style={{ background: o.color }}') && SRC.includes('data-legend-map={o.name}'), "X26 the legend's swatches wear the overlays' REAL colours (the same hex the strip's brackets wear) — teaching with the instrument's own ink, never a paraphrase");
must(SRC.includes("EQUAL-COUNT KNIFE") && SRC.includes("two fathers and drifts apart") && SRC.includes("NO Depth column"), "X27 the legend teaches the knife and the honest absence — the same vocabulary the paper's epilogue speaks");
must(QCLIB.includes("### Reading the depth addresses") && (QCLIB.match(/### Reading the depth addresses/g) || []).length === 1, "X28 the paper's epilogue exists — ONE section that teaches the whole depth dialect");
must(QCLIB.indexOf("### Reading the depth addresses") > QCLIB.indexOf("### Pairwise agreement") && QCLIB.indexOf("### Reading the depth addresses") < QCLIB.indexOf("_Exported from"), "X29 the epilogue sits AFTER the tables it teaches and BEFORE the export footer — the paper ends by teaching, then by naming its provenance");
must(QCLIB.includes("0 = the front face, 1 = the back face") && QCLIB.includes("equal-count knife") && QCLIB.includes("two fathers") && QCLIB.includes("press the chip or the bracket"), "X30 the epilogue speaks the full dialect — fractions not Å, the honest knife, the two-fathers honesty, the doors");
must(QCLIB.indexOf('lines.push("### Reading the depth addresses");') > QCLIB.indexOf('if (overlays.length > 1) {'), "X31 the epilogue rides the overlays guard — no comparison maps, no addresses, no lesson (honest absence is structural)");
// t210: the LANE doctrine's source — one algorithm, two consumers
must((SRC.match(/const packLanes = \(bands: Array<\{ from: number; to: number \}>\): number\[\]/g) || []).length === 1, "X32 packLanes is defined EXACTLY once (one algorithm, module-level, both rows drink from it)");
must((SRC.match(/packLanes\(/g) || []).length === 2, "X33 packLanes is called EXACTLY twice — the local painter and the pair painter (one algorithm, two consumers, no third path)");
must(SRC.includes('data-band-lane={lane}') && SRC.includes('data-pair-lane={lane}'), "X34 both painters SPEAK their lane (the DOM carries the lane index for every bracket)");
must(SRC.includes("y={(27.4 - lane * 3.0).toFixed(1)}") && SRC.includes("y={(pairBaseY - lane * 3.0).toFixed(1)}"), "X35 the two stacks' geometry formulas live in the source — lane0 emits 27.4/24.4 byte-identical to t203/t208's fixed rows");
must(SRC.includes("const pairBaseY = 24.4 - (localLaneCount - 1) * 3.0;"), "X36 the pair stack FLOATS on the local stack's height — the rows can never collide, whatever the world");
must(SRC.includes("packed lane by lane so every door stays pressable") && SRC.includes("data-legend-territory=\"pair\""), "X37 the legend teaches the lanes (the neutral-ink lesson rides the live DOM, pinned by D55 — the source spells the apostrophe as a JSX entity)");
must((SRC.match(/sort\(\(a, b\) => a\.w\.from - b\.w\.from \|\| a\.w\.to - b\.w\.to\)/g) || []).length === 2, "X38 both painters sort by from-then-to (first-fit's canonical order — stable ties keep pairwiseAgreement's order)");

/* ============ D: live ============ */
section("D: the paper, live");
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1720, height: 940 } });
const consoleErrors = [];
page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
page.on("pageerror", (e) => consoleErrors.push(String(e).slice(0, 200)));

await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);
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

// Cold-session armor (RUN=4's lesson): a persisted overlay session makes
// Mol* restore two MRCs BEFORE the panel button exists, and a cold box can
// stretch that past any honest wait — dbg2's timetable says a session-free
// world shows the button in ~5s. So: give the button 45s; if it still
// hasn't shown, evict BOTH mirrors (the server session via its own PUT
// contract, the browser's localStorage) and re-open the viewer.
let btnUp = await page.locator('button[aria-label^="Overlay maps"]').isVisible().catch(() => false);
for (let k = 0; k < 9 && !btnUp; k++) {
  await sleep(5000);
  btnUp = await page.locator('button[aria-label^="Overlay maps"]').isVisible().catch(() => false);
}
if (!btnUp) {
  await fetch(`${BASE}/api/jobs/${host.id}/overlay-session`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ entries: [], mode: "replace" }),
  });
  await page.evaluate((k) => localStorage.removeItem(`cryoflow.mol-overlays:${k}`), host.id).catch(() => {});
  await page.reload({ waitUntil: "networkidle" });
  await sleep(2200);
  await page.locator(`[data-job="${host.id}"]`).first().click({ force: true });
  await sleep(1600);
  await page.locator('[role="tab"]', { hasText: "Results" }).click().catch(() => {});
  await sleep(1400);
  const ot2 = page.locator('button[aria-label="Enlarge orthovol"]');
  if (await ot2.isVisible().catch(() => false)) await ot2.click();
  await sleep(1000);
  await page.locator("button", { hasText: "View in 3D" }).click();
  let v3 = false;
  for (let k = 0; k < 30; k++) { await sleep(2000); if (await page.evaluate(() => !!window.__molstar?.canvas3d).catch(() => false)) { v3 = true; break; } }
  must(v3, "D1b viewer re-opened after the cold-session eviction");
  btnUp = await page.locator('button[aria-label^="Overlay maps"]').waitFor({ state: "visible", timeout: 60000 }).then(() => true).catch(() => false);
}
must(btnUp, "D1c the Overlay maps panel button is on stage");
// the Layers session PERSISTS with the job (server mirror + localStorage) —
// a previous run's adoptions come back on restore, and the restore can land
// AFTER the first panel open. Clean ritual: open the panel, evict every
// active overlay, and trust the world only after TWO consecutive opens show
// none (t198's re-open armor — a late restore must not hide behind one
// early observation). The scan re-runs on EVERY panel open, so the panel is
// polled, never napped; and an ACTIVE map's title reads "Already overlaid",
// so eviction must happen BEFORE any [title*=...] lookup can match.
const panelQuiet = async () => {
  if (await page.getByText("Scanning job outputs").isVisible().catch(() => false)) return false;
  return (await page.locator('button[aria-label^="Remove overlay"]').count()) === 0;
};
const evictOnce = async () => {
  // the panel UI renders after Mol* finishes loading the volume AND the
  // restored overlays — the button can take >30s to exist on a warm box,
  // and far longer on a COLD one (freshly restored world, first MRC read,
  // RUN=2 sighting: 90s was not enough); wait generously
  await page.locator('button[aria-label^="Overlay maps"]').click({ timeout: 150000 });
  for (let k = 0; k < 24; k++) { if (await panelQuiet()) break; await sleep(500); }
  let removed = 0;
  while ((await page.locator('button[aria-label^="Remove overlay"]').count()) > 0) {
    await page.locator('button[aria-label^="Remove overlay"]').first().click();
    removed++;
    await sleep(900);
  }
  await page.keyboard.press("Escape");
  await sleep(700);
  return removed;
};
let quietOpens = 0;
for (let k = 0; k < 4 && quietOpens < 2; k++) {
  const removed = await evictOnce();
  quietOpens = removed === 0 ? quietOpens + 1 : 0;
}
must(quietOpens >= 2, "D2pre clean world by TWO consecutive quiet opens (persisted sessions evicted)");
await sleep(400);
must((await page.locator('div[data-local-row="1"]').count()) === 0, "D2 self-healed world: NO local row before any adoption");
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

// t204's ORDER, learned the hard way (RUN=6's lesson): the profile panel
// must be OPEN before any adoption — the local chip lives in the panel's
// local row, and a closed panel turns every chip lookup into a false
// negative (the D2 count above was passing for the wrong reason).
await page.locator('button[aria-label="Toggle cross-section plane"]').click();
let stripVisible = false;
for (let k = 0; k < 12; k++) {
  await sleep(1000);
  if (await page.locator('svg[role="slider"][aria-label^="Density profile along the"]').isVisible().catch(() => false)) { stripVisible = true; break; }
}
must(stripVisible, "D3strip the profile panel is open — the landscape strip speaks");
const strip = page.locator('svg[role="slider"][aria-label^="Density profile along the"]');

// ============ t209: the legend BEFORE any adoption ============
// the toggle exists as soon as the profile speaks, and the lesson is
// DEFAULT-CLOSED (an instrument that teaches uninvited is a pop-up). With
// ZERO comparison maps the open legend must show only the landscape and
// the playhead — no overlay rows, no pair row: the territory rows mirror
// the world exactly, so the honest absence is LIVE-testable here at the
// legend's end (X31 pins the paper's end structurally).
const legToggle = page.locator('button[data-profile-legend-toggle="1"]');
const legBlock = page.locator('div[data-profile-legend="1"]');
must((await legToggle.count()) === 1, "D45 the teaching door exists ('How to read' beside the export doors)");
must((await legToggle.getAttribute("aria-expanded")) === "false", "D46 the lesson starts CLOSED (aria-expanded false — opt-in teaching)");
await legToggle.click();
await sleep(400);
must((await legToggle.getAttribute("aria-expanded")) === "true" && (await legBlock.count()) === 1, "D47 pressing the teaching door opens the lesson (aria-expanded true, the block on stage)");
let terrCounts = {};
for (const t of await legBlock.locator("[data-legend-territory]").all()) {
  const k = await t.getAttribute("data-legend-territory");
  terrCounts[k] = (terrCounts[k] ?? 0) + 1;
}
must((terrCounts.landscape ?? 0) === 1 && (terrCounts.playhead ?? 0) === 1, "D48 with zero overlays the legend still teaches the two permanent territories (landscape + playhead)");
must((terrCounts.overlay ?? 0) === 0 && (terrCounts.pair ?? 0) === 0, "D49 with zero overlays there are NO overlay rows and NO pair row — the legend mirrors the world, it does not invent it");
await legToggle.click();
await sleep(300);
must((await legToggle.getAttribute("aria-expanded")) === "false" && (await legBlock.count()) === 0, "D50 the lesson closes again (the block is GONE, not merely hidden)");

// adopt BOTH halves — the local row speaks, the report carries BOTH maps
const adopt = async (title) => {
  const btn = page.locator(`[data-testid^="map-choice-"][title*="${title}"]`);
  const pollBtn = async () => {
    for (let k = 0; k < 30; k++) {
      if (await btn.isVisible().catch(() => false)) return true;
      await sleep(500);
    }
    return false;
  };
  // the panel button is a TOGGLE: clicking it while the panel is open
  // CLOSES the panel (RUN=10's double-toggle trap). Look before you
  // click — if the choice is already visible the panel is already open.
  const ensureOpen = async () => {
    if (await btn.isVisible().catch(() => false)) return true;
    await page.locator('button[aria-label^="Overlay maps"]').click({ timeout: 120000 });
    return await pollBtn();
  };
  // the outputs scan re-runs on EVERY panel open (and the spinner replaces
  // the list while it runs) — POLL for the choice, never a fixed nap; a
  // blind second click would CLOSE the panel mid-scan (first run's lesson)
  let seen = await ensureOpen();
  if (!seen) seen = await ensureOpen(); // one honest re-open
  must(seen, `D3pre the ${title} choice surfaced from the scan`);
  // t195's two-sightings rule, applied to the choice click itself: the
  // outputs scan RE-RENDERS the list while it runs, and a re-render can
  // detach the button mid-click ("element is not stable / detached") —
  // first RUN=1 sighting. So: bounded click attempts, and after each
  // failure re-open the panel and re-poll (the scan replaces the list
  // with the spinner, so the button must be awaited again).
  let clicked = false;
  for (let attempt = 1; attempt <= 3 && !clicked; attempt++) {
    try {
      await btn.click({ timeout: 5000 });
      clicked = true;
    } catch {
      await page.keyboard.press("Escape");
      await sleep(700);
      seen = await ensureOpen();
    }
  }
  must(clicked, `D3pre the ${title} choice clicked (attempts survived the scan's re-renders)`);
  await sleep(1500);
  // t198's D4 signal, repurposed as CUSTODY: the overlay TERRAIN is Mol*'s
  // own completion receipt — it appears only when the map is loaded AND
  // rendered, i.e. the main thread is free again. Waiting for it here
  // serializes the adoptions on the renderer's actual readiness (RUN=9:
  // clicking half2 while Mol* is still swallowing half1's MRC froze the
  // page past any honest timeout). The chip may still lag behind (its
  // profile fetch rides the same busy thread) — D3's long poll owns that.
  const terrain = page.locator(`[data-overlay-terrain*="${title}"]`);
  let terrUp = false;
  for (let k = 0; k < 60 && !terrUp; k++) {
    if (await terrain.isVisible().catch(() => false)) terrUp = true;
    else await sleep(2000);
  }
  must(terrUp, `D3terr the ${title} terrain rendered — Mol* is done with this map`);
  // RUN=3/6/7's lesson, settled: the chip can lag the click by minutes in a
  // cold world (the profile effect refetches EVERY overlay's terrain on
  // each adoption, and Mol* keeps the main thread busy loading MRCs) — so
  // the click is the adopt's only contract, and the chips are judged ONCE
  // by D3's long poll. No fixed nap survives a cold MRC read; no per-map
  // poll can beat a refetch that resets its own predecessors.
  await sleep(1500);
};
await adopt("half1");
await adopt("half2");
await adopt("masked");
const chip1 = page.locator('[data-local-chip="run_it020_half1"]');
const chip2 = page.locator('[data-local-chip="run_it020_half2"]');
const chipM = page.locator('[data-local-chip="run_it020_masked"]');
let chipsUp = false;
for (let k = 0; k < 100 && !chipsUp; k++) {
  if ((await chip1.count()) > 0 && (await chip2.count()) > 0 && (await chipM.count()) > 0) chipsUp = true;
  else await sleep(2000);
}
must(chipsUp, "D3 all THREE maps adopted — the local row speaks thrice (long poll: chips can lag a cold adoption by minutes)");

// THE PAPER: the report exists only AFTER an export action (t198's
// contract: buildProfileReport runs in the copy/download handler) — the
// carrier's data-md stays null until the Copy button is pressed. Both
// adoptions are complete, so ONE copy speaks both maps.
const copyRep = page.locator('button[aria-label="Copy profile QC report"]');
await copyRep.waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
await copyRep.click().catch(() => {});
const carrier = page.locator('div[data-md-carrier="profile"], div[data-csv-carrier="profile"]').first();
let md = null;
for (let k = 0; k < 30; k++) {
  const s = await carrier.getAttribute("data-md", { timeout: 1500 }).catch(() => null);
  if (s && s.includes("### Local agreement") && s.includes("Depth (fraction)")) { md = s; break; }
  await sleep(2000);
}
must(!!md, "D4 the report carrier speaks (data-md with the Local section + Depth column)");
const localSection = (s) => {
  const a = (s ?? "").indexOf("### Local agreement");
  if (a < 0) return "";
  const b = (s ?? "").indexOf("### Pairwise agreement");
  return (s ?? "").slice(a, b > a ? b : undefined);
};
const ls = localSection(md);
const header = ls.split("\n").find((l) => l.startsWith("| Map |"));
must(header === "| Map | Q1 (0–25%) | Q2 (25–50%) | Q3 (50–75%) | Q4 (75–100%) | Weakest | Depth (fraction) |", `D5 the header carries SEVEN columns (${(header ?? "").slice(-40)})`);
const row1 = ls.split("\n").find((l) => l.startsWith("| run_it020_half1"));
const row2 = ls.split("\n").find((l) => l.startsWith("| run_it020_half2"));
const row3 = ls.split("\n").find((l) => l.startsWith("| run_it020_masked"));
// t198's RAW convention: split on "|" and trim — the boundary empties stay,
// so a 7-column row is 9 segments and the cells keep t198's indices
// (quarters 2..5, Weakest 6, Depth 7) with no renumbering of the front wave
const cellsOf = (l) => (l ?? "").split("|").map((c) => c.trim());
const c1 = cellsOf(row1), c2 = cellsOf(row2), c3 = cellsOf(row3);
must(c1.length === 9 && c2.length === 9 && c3.length === 9, `D6 all THREE rows carry 9 segments (2 boundary empties + 7 columns) (${c1.length}/${c2.length}/${c3.length})`);
must(c1[7] === d1, `D7 half1's depth cell == the wire oracle byte-for-byte (${c1[7]} == ${d1})`);
must(c2[7] === d2, `D8 half2's depth cell == the wire oracle byte-for-byte (${c2[7]} == ${d2})`);
must(c3[7] === d3, `D8b masked's depth cell == the wire oracle byte-for-byte (${c3[7]} == ${d3})`);
must(c1[6] === `${QUARTERS[w1.k]} (${w1.r.toFixed(2)})`, `D9 half1's Weakest cell == t198's oracle UNTOUCHED (${c1[6]})`);
must(c2[6] === `${QUARTERS[w2.k]} (${w2.r.toFixed(2)})`, `D10 half2's Weakest cell == t198's oracle UNTOUCHED (${c2[6]})`);
must(c3[6] === `${QUARTERS[w3.k]} (${w3.r.toFixed(2)})`, `D10b masked's Weakest cell == the wire oracle (${c3[6]})`);
const oracleQuarters1 = [0, 1, 2, 3].map((k) => {
  const n = Math.max(mainW.bins.length, half1W.bins.length);
  const lo = Math.floor((k * n) / 4), hi = Math.floor(((k + 1) * n) / 4);
  const r = pearson(resample(mainW.bins, n).slice(lo, hi), resample(half1W.bins, n).slice(lo, hi));
  return Number.isFinite(r) ? r.toFixed(2) : "—";
});
must(c1.slice(2, 6).join("|") === oracleQuarters1.join("|"), "D11 the four quarter cells still equal the probe's own oracle (the table's BODY survives beside the new column)");
must(md.includes("### Pairwise agreement") && ls.length > 100, "D13 the Local section is bounded by the pairwise section (t194's section-locating doctrine holds)");
must(ls.includes("the Depth column quotes that address as fractions"), "D12 the prose names the Depth column, live");

// THE PAIR'S OWN PAPER: cut the Pairwise section and judge its new column
const pairSection = (s) => {
  const a = (s ?? "").indexOf("### Pairwise agreement");
  if (a < 0) return "";
  const b = (s ?? "").indexOf("### Session", a);
  return (s ?? "").slice(a, b > a ? b : undefined);
};
const ps = pairSection(md);
const pheader = ps.split("\n").find((l) => l.startsWith("| Map A |"));
must(pheader === "| Map A | Map B | Agreement r | Verdict | Depth (fraction) |", `D14 the pairwise header carries FIVE columns (${(pheader ?? "").slice(-45)})`);
const pLine = ps.split("\n").find((l) => l.startsWith("| run_it020_half1") && l.includes("run_it020_half2"));
const pc = cellsOf(pLine);
must(pc.length === 7, `D15 the pairwise row carries 7 segments (2 boundary empties + 5 columns) (${pc.length})`);
must(pc[1] === "run_it020_half1" && pc[2] === "run_it020_half2", "D16 the pair is named in order (t196's columns 1..2 unmoved)");
must(pc[3] === rPairGlobal.toFixed(2), `D17 the pair's global r == the wire oracle at split[3] — t196's D12 lesson honored (${pc[3]} == ${rPairGlobal.toFixed(2)})`);
must(pc[4] === "diverges" || pc[4] === "partial" || pc[4] === "agrees" || pc[4] === "flat — no shape to compare", `D18 the Verdict vocabulary survives at split[4] (${pc[4]})`);
must(pc[5] === dPair, `D19 the pair's depth cell == the wire oracle byte-for-byte (${pc[5]} == ${dPair})`);
// t210: the masked pairs' paper rows — same five columns, same oracles
const pLineHM = ps.split("\n").find((l) => l.startsWith("| run_it020_half1") && l.includes("run_it020_masked"));
const pLineH2M = ps.split("\n").find((l) => l.startsWith("| run_it020_half2") && l.includes("run_it020_masked"));
const pcHM = cellsOf(pLineHM), pcH2M = cellsOf(pLineH2M);
must(pcHM.length === 7 && pcH2M.length === 7, `D19b both masked pair rows carry 7 segments (${pcHM.length}/${pcH2M.length})`);
must(pcHM[5] === depthStr(wPairHM) && pcH2M[5] === depthStr(wPairH2M), `D19c the masked pairs' depth cells == the wire oracles (${pcHM[5]} / ${pcH2M[5]})`);
must(ps.includes("where each pair's corroboration is thinnest"), "D20 the prose names the pairwise Depth column, live");

// THE WALL: the pairwise chip rides the same address
const pairChipText = (await page.locator('div[data-pairwise-row="1"]').textContent().catch(() => "")) ?? "";
must(pairChipText.includes("run_it020_half1") && pairChipText.includes("run_it020_half2"), "D21 the wall chip names both halves (t196's row survives)");
must(pairChipText.includes(`r ${rPairGlobal.toFixed(2)}`), `D22 the wall chip's r == the wire oracle (${rPairGlobal.toFixed(2)})`);
must(pairChipText.includes(` · ${dPair}`), `D23 the wall chip rides the pair's address in the 2dp dialect (${dPair})`);
const pairChipTitle = await page.locator('div[data-pairwise-row="1"] [data-pairwise-chip]').first().getAttribute("title").catch(() => null);
must(!!pairChipTitle && pairChipTitle.includes("thinnest corroboration sits between") && pairChipTitle.includes(QUARTERS[wPair.k]), "D24 the chip's title teaches the band (vocabulary AND coordinates — t206's locator follows the door's button form)");
must((await page.locator('div[data-pairwise-row="1"] button[data-pairwise-chip]').count()) === 3, "D25 all THREE addressed pairs render as BUTTONS (three doors exist)");

// THE PAIR'S DOOR, live: Home puts the plane at 0% (outside the pair's
// band — resting chip), then ONE click lands the plane on the band's
// CENTRE (not the clicked x, not the local bands' centres) and the
// receipt names the pair. The receipt is the EPHEMERAL thing — read it
// first and poll fast (t202's frozen-thread lesson).
await strip.focus(); await sleep(300);
await strip.press("Home"); await sleep(700);
must(Number(await strip.getAttribute("aria-valuenow")) === 0, "D26 pre-state: Home put the plane at 0% (outside the pair's band)");
const pairBtn = page.locator('button[data-pairwise-chip]').first(); // (h1,h2) — pairwiseAgreement's first pair in adoption order
await pairBtn.click();
// t202's lesson, hardened by RUN=2's sighting: the receipt lives ~4 wall-
// time seconds and a frozen main thread can compress that to nothing —
// all 16 fast polls can miss its entire life. The DOOR is idempotent
// (pressing again re-lands the same centre and re-flashes the note), so
// a missed receipt earns a bounded re-press, not a failure (t195's
// bounded-click-retries doctrine, now for the receipt's sake).
let pairNow = -1, pairReceiptText = "";
for (let attempt = 0; attempt < 3; attempt++) {
  if (attempt > 0) { await pairBtn.click().catch(() => {}); }
  for (let k = 0; k < 16; k++) {
    await sleep(250);
    const st = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[role="status"]')).map((n) => ({
        label: n.getAttribute("aria-label"),
        text: (n.textContent ?? "").slice(0, 160),
      }))
    );
    pairReceiptText = st.find((s) => s.label === "Profile export status")?.text ?? "";
    pairNow = Number(await strip.getAttribute("aria-valuenow"));
    if (pairNow === pairPct && pairReceiptText.length > 0) break;
  }
  if (pairNow === pairPct && pairReceiptText.length > 0) break;
}
must(pairNow === pairPct, `D27 PRESS the pair's door: strip aria-valuenow == ${pairPct} (got ${pairNow}) — the plane lands on the pair's band centre`);
must(pairReceiptText === pairReceipt, `D28 the receipt names the pair byte-for-byte (${pairReceiptText.slice(0, 90)})`);
must((await pairBtn.getAttribute("data-visiting")) === "1", "D29 visiting rides the pair's band (the plane is INSIDE it — ink risen)");
// the keyboard door: away (End), then Enter on the focused chip
await strip.focus(); await strip.press("End"); await sleep(700);
must(Number(await strip.getAttribute("aria-valuenow")) === 100, "D30 pre-keyboard: End put the plane at 100% (outside the band, ink at rest)");
await pairBtn.focus(); await sleep(300);
await pairBtn.press("Enter");
let kbdNow = -1;
for (let k = 0; k < 10; k++) {
  await sleep(300);
  kbdNow = Number(await strip.getAttribute("aria-valuenow"));
  if (kbdNow === pairPct) break;
}
must(kbdNow === pairPct, `D31 the keyboard's door: Enter on the focused chip lands ${pairPct} (got ${kbdNow}) — the button answers both hands`);
must((await pairBtn.getAttribute("data-visiting")) === "1", "D32 visiting follows the keyboard's jump too (one state, both inputs)");

// ============ t208's territory, t210's LANES, live ============
// the plane currently sits at the halves-pair's band centre (D31's Enter)
// — so THAT pair's bracket must be VISITING while both masked pairs rest
// (their Q2 is elsewhere), and half1's local bracket rides along (the
// pair's band IS half1's local Q3): multiple rows, one plane, many truths.
const pairRect = page.locator('svg[role="slider"] rect[data-pair-bracket="run_it020_half1|run_it020_half2"]');
const rectHM = page.locator('svg[role="slider"] rect[data-pair-bracket="run_it020_half1|run_it020_masked"]');
const rectH2M = page.locator('svg[role="slider"] rect[data-pair-bracket="run_it020_half2|run_it020_masked"]');
must((await page.locator('svg[role="slider"] rect[data-pair-bracket]').count()) === 3, "D33 THREE pair territories on the strip (three pairs, three brackets — the multi-pair world is live)");
must((await pairRect.count()) === 1 && (await pairRect.isVisible().catch(() => false)) && (await rectHM.isVisible().catch(() => false)) && (await rectH2M.isVisible().catch(() => false)), "D33b each pair's bracket is individually present and visible (no bracket swallowed by another)");
// THE LANE DOCTRINE, byte for byte: each pair's x/width == its band, each
// pair's y == the lane oracle's float formula — the collision SPLIT (the
// two Q2 pairs on different lanes) and the disjoint SHARE (Q3 riding
// lane0 beside one Q2) both visible in one frame's geometry.
for (const [label, loc, band, key] of [["h1h2", pairRect, wPair, "run_it020_half1|run_it020_half2"], ["h1m", rectHM, wPairHM, "run_it020_half1|run_it020_masked"], ["h2m", rectH2M, wPairH2M, "run_it020_half2|run_it020_masked"]]) {
  const x = await loc.getAttribute("x"), y = await loc.getAttribute("y"), wd = await loc.getAttribute("width"), ln = await loc.getAttribute("data-pair-lane");
  must(x === (band.from * 100).toFixed(2) && wd === ((band.to - band.from) * 100).toFixed(2), `D34 ${label}'s band geometry == the wire oracle (x ${x}, width ${wd})`);
  must(y === pairYByKey[key] && Number(ln) === pairLaneByKey[key], `D34b ${label}'s LANE == the packing oracle (lane ${ln}, y ${y} — expected lane ${pairLaneByKey[key]} at y ${pairYByKey[key]})`);
  must((await loc.getAttribute("fill")) === "currentColor", `D35 ${label}'s territory wears NEUTRAL ink (corroboration belongs to the pair)`);
}
must((await rectHM.getAttribute("y")) !== (await rectH2M.getAttribute("y")), "D34c the SAME-QUARTER collision SPLIT: the two Q2 pairs ride DIFFERENT lanes (neither door covers the other)");
must((await rectHM.getAttribute("y")) === (await pairRect.getAttribute("y")), "D34d the DISJOINT share: the Q3 pair rides the SAME lane as the first Q2 pair (touching bands pack together)");
must((await pairRect.getAttribute("data-pair-visiting")) === "1", "D36 at the halves-pair's centre its ink is RISEN (visiting rides the plane, not the click)");
must((await rectHM.getAttribute("data-pair-visiting")) === "0" && (await rectH2M.getAttribute("data-pair-visiting")) === "0", "D36b both masked pairs' ink rests (their Q2 is elsewhere — the rows disagree TRUTHFULLY about the same plane)");
must((await page.locator('svg[role="slider"] rect[data-band-bracket="run_it020_half1"]').getAttribute("data-band-visiting")) === "1", "D37 the plane sits inside BOTH rows' bands (pair Q3 == half1's local Q3 — two truths, one plane)");
must((await page.locator('svg[role="slider"] rect[data-band-bracket="run_it020_half2"]').getAttribute("data-band-visiting")) === "0" && (await page.locator('svg[role="slider"] rect[data-band-bracket="run_it020_masked"]').getAttribute("data-band-visiting")) === "0", "D38 half2's and masked's local brackets rest (their quarters are elsewhere)");
// THE LOCALS' LANE: three distinct quarters collapse onto ONE shared lane
// — all three local brackets at y 27.4, x per band, no lane spent
for (const [nm, band] of [["run_it020_half2", w2], ["run_it020_half1", w1], ["run_it020_masked", w3]]) {
  const loc = page.locator(`svg[role="slider"] rect[data-band-bracket="${nm}"]`);
  must((await loc.getAttribute("y")) === "27.4" && (await loc.getAttribute("data-band-lane")) === "0" && (await loc.getAttribute("x")) === (band.from * 100).toFixed(2), `D38b ${nm}'s local bracket rides lane0 at y 27.4 (x ${await loc.getAttribute("x")} — three distinct quarters, one honest lane)`);
}
// EVERY DOOR ANSWERS: away first (End = 100%, outside everything), then
// press EACH pair rect — the plane lands on THAT pair's band centre and
// the receipt names THAT pair (the receipt is the ephemeral thing —
// idempotent-door re-press armor: a missed receipt earns a re-press)
const pressDoor = async (loc, pct, receipt) => {
  await strip.focus(); await strip.press("End"); await sleep(600);
  await loc.click({ force: true, timeout: 8000 }).catch(() => {});
  let now = -1, rcpt = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) { await loc.click({ force: true, timeout: 8000 }).catch(() => {}); }
    for (let k = 0; k < 16; k++) {
      await sleep(250);
      const st = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[role="status"]')).map((n) => ({
          label: n.getAttribute("aria-label"),
          text: (n.textContent ?? "").slice(0, 160),
        }))
      );
      rcpt = st.find((s) => s.label === "Profile export status")?.text ?? "";
      now = Number(await strip.getAttribute("aria-valuenow"));
      if (now === pct && rcpt.length > 0) break;
    }
    if (now === pct && rcpt.length > 0) break;
  }
  return { now, rcpt };
};
const pctOf = (w) => Math.round(Math.round(((w.from + w.to) / 2) * 100) / 100 * 100);
for (const [label, loc, band, key] of [["h1m", rectHM, wPairHM, "run_it020_half1|run_it020_masked"], ["h2m", rectH2M, wPairH2M, "run_it020_half2|run_it020_masked"], ["h1h2", pairRect, wPair, "run_it020_half1|run_it020_half2"]]) {
  const pct = pctOf(band);
  const receipt = `Plane moved to ${pct}% — the centre of the thinnest corroboration between ${key.split("|")[0]} and ${key.split("|")[1]} (${QUARTERS[band.k]})`;
  const { now, rcpt } = await pressDoor(loc, pct, receipt);
  must(now === pct, `D40 PRESS ${label}'s territory: strip aria-valuenow == ${pct} (got ${now}) — that pair's own door, not a scrub`);
  must(rcpt === receipt, `D41 ${label}'s receipt names ITS pair byte-for-byte (${rcpt.slice(0, 90)})`);
  must((await loc.getAttribute("data-pair-visiting")) === "1", `D42 ${label}'s ink risen after its own door`);
}
// PORTRAIT: the plane parked on the halves-pair's centre by its own door
// — pair row lane0 risen, half1's colour risen, half2/masked resting, and
// BOTH Q2 doors visible on their two lanes: one frame, the whole doctrine.
await page.screenshot({ path: `${OUT}/t210-lanes-2x.png` }).catch(() => {});
// the territory follows the plane HOME: keyboard away (the bracket layer
// is aria-hidden — the strip itself is the keyboard's scrub), and the
// resting ink must come back down
await strip.focus(); await strip.press("Home"); await sleep(700);
must(Number(await strip.getAttribute("aria-valuenow")) === 0 && (await pairRect.getAttribute("data-pair-visiting")) === "0" && (await rectHM.getAttribute("data-pair-visiting")) === "0" && (await rectH2M.getAttribute("data-pair-visiting")) === "0", "D43 Home: ALL territories' ink rests (every bracket follows the plane home — no stuck ink on any lane)");
must((await page.locator('svg[role="slider"] rect[data-band-bracket="run_it020_half2"]').getAttribute("data-band-visiting")) === "1", "D44 Home lands INSIDE half2's local Q1 — the local row answers where the pair rows cannot (their territories start at 0.25)");

// ============ t209's legend, live with ALL THREE maps speaking ============
// the lesson re-opens AFTER the adoptions: now the territory rows must
// mirror the FULL world (landscape + THREE overlay rows + pair row +
// playhead), the overlay swatches must wear the strip's own ink, and the
// doors must still answer WITH the lesson showing (the legend is a
// teacher, never a shield).
await legToggle.click();
await sleep(400);
must((await legToggle.getAttribute("aria-expanded")) === "true" && (await legBlock.count()) === 1, "D51 the lesson re-opens with the full world speaking");
const countTerr = async () => {
  const c = {};
  for (const t of await legBlock.locator("[data-legend-territory]").all()) {
    const k = await t.getAttribute("data-legend-territory");
    c[k] = (c[k] ?? 0) + 1;
  }
  return c;
};
const terr2 = await countTerr();
must((terr2.landscape ?? 0) === 1 && (terr2.overlay ?? 0) === 3 && (terr2.pair ?? 0) === 1 && (terr2.playhead ?? 0) === 1, `D52 the territory rows mirror the FULL world (landscape 1, overlay 3, pair 1, playhead 1 — got ${JSON.stringify(terr2)})`);
must((await legBlock.locator('[data-legend-territory="overlay"][data-legend-map="run_it020_half1"]').count()) === 1 && (await legBlock.locator('[data-legend-territory="overlay"][data-legend-map="run_it020_half2"]').count()) === 1 && (await legBlock.locator('[data-legend-territory="overlay"][data-legend-map="run_it020_masked"]').count()) === 1, "D53 each overlay's row is NAMED (data-legend-map == the map's own name, not a paraphrase)");
// the swatches teach with the INSTRUMENT'S OWN INK: the legend's swatch
// colour == the strip bracket's fill colour, per map, byte-for-byte
const hexToRgb = (hex) => {
  const m = (hex ?? "").replace("#", "");
  const v = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(v, 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};
for (const h of ["run_it020_half1", "run_it020_half2", "run_it020_masked"]) {
  const stripFill = await page.locator(`svg[role="slider"] rect[data-band-bracket="${h}"]`).getAttribute("fill");
  const swatch = await legBlock.locator(`[data-legend-map="${h}"] span[aria-hidden="true"]`).first().evaluate((el) => el.style.backgroundColor).catch(() => null);
  must(!!stripFill && swatch === hexToRgb(stripFill), `D54 ${h}'s legend swatch wears the strip's OWN ink (${stripFill} → ${swatch})`);
}
must((await legBlock.locator('[data-legend-territory="pair"]').textContent()).includes("wearing neither's colour") && (await legBlock.locator('[data-legend-territory="pair"]').textContent()).includes("packed lane by lane"), "D55 the pair row teaches the neutral ink AND the lanes (corroboration belongs to the pair, packed so every door stays pressable)");
must((await legBlock.locator("[data-legend-knife=\"1\"]").textContent()).includes("EQUAL-COUNT KNIFE") && (await legBlock.locator("[data-legend-tables=\"1\"]").textContent()).includes("two fathers"), "D56 the lesson teaches the knife AND the honest absence, live");
// the doors still answer WITH the lesson showing: press half1's local chip
// (t204's door) — the plane lands on the band's centre and the receipt
// speaks the local dialect (idempotent-door re-press armor: a frozen
// thread can swallow the note's whole life, the door re-lands the same
// centre, so a missed receipt earns a bounded re-press, not a failure)
const h1Centre = Math.round(((w1.from + w1.to) / 2) * 100) / 100;
const h1Pct = Math.round(h1Centre * 100);
const h1Receipt = `Plane moved to ${h1Pct}% — the centre of run_it020_half1's weakest quarter (${QUARTERS[w1.k]})`;
const chip1Btn = page.locator('[data-local-chip="run_it020_half1"]');
let chipNow = -1, chipReceipt = "";
for (let attempt = 0; attempt < 3; attempt++) {
  if (attempt > 0) { await chip1Btn.click().catch(() => {}); }
  for (let k = 0; k < 16; k++) {
    await sleep(250);
    const st = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[role="status"]')).map((n) => ({
        label: n.getAttribute("aria-label"),
        text: (n.textContent ?? "").slice(0, 160),
      }))
    );
    chipReceipt = st.find((s) => s.label === "Profile export status")?.text ?? "";
    chipNow = Number(await strip.getAttribute("aria-valuenow"));
    if (chipNow === h1Pct && chipReceipt.length > 0) break;
  }
  if (chipNow === h1Pct && chipReceipt.length > 0) break;
}
must(chipNow === h1Pct, `D57 the doors answer WITH the lesson showing: chip door lands ${h1Pct} (got ${chipNow}) — the legend teaches, it never shields`);
must(chipReceipt === h1Receipt, `D58 the chip's receipt names the map byte-for-byte (${chipReceipt.slice(0, 90)})`);
// PORTRAIT: the plane parked on half1's centre by the chip's own door —
// half1's colour risen, the pair's neutral ink risen (same band), half2
// at rest, and the OPEN legend teaching all of it in the instrument's
// own ink: one frame, the whole dialect.
await page.screenshot({ path: `${OUT}/t210-legend-open-2x.png` }).catch(() => {});
// the paper's epilogue rides the report copied at D4: after Pairwise,
// before the footer, teaching the same words the legend teaches
must(md.includes("### Reading the depth addresses"), "D59 the copied report teaches the epilogue (the paper speaks the dialect without the app)");
must(md.indexOf("### Reading the depth addresses") > md.indexOf("### Pairwise agreement") && md.indexOf("### Reading the depth addresses") < md.indexOf("_Exported from"), "D60 the epilogue's position on the paper: after the tables it teaches, before the provenance footer (the live order matches X29's source order)");
const epi = md.slice(md.indexOf("### Reading the depth addresses"));
must(epi.includes("0 = the front face, 1 = the back face") && epi.includes("equal-count knife") && epi.includes("two fathers") && epi.includes("press the chip or the bracket"), "D61 the epilogue's live bytes speak the full dialect (fractions, knife, two fathers, doors)");
must((md.match(/### Reading the depth addresses/g) || []).length === 1, "D62 the lesson prints ONCE — an epilogue that repeats itself is a second father");
await legToggle.click();
await sleep(300);
must((await legToggle.getAttribute("aria-expanded")) === "false" && (await legBlock.count()) === 0, "D63 the lesson closes cleanly after teaching (no stuck open state)");

await page.screenshot({ path: `${OUT}/t210-final-2x.png` }).catch(() => {});

/* ============ Z: read-only ============ */
section("Z: the world read back");
const roster1 = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
must(roster1.length === roster0.length && roster1.length === 21, `Z1 roster identity (${roster1.length}, canonical 21)`);
const r1names = roster1.map((j) => j.name).sort().join("|");
const r0names = roster0.map((j) => j.name).sort().join("|");
must(r1names === r0names, "Z2 roster identity by name — nothing stayed behind");
await browser.close();
must(consoleErrors.length === 0, `Z3 console clean (${consoleErrors.length} errors${consoleErrors.length ? ": " + consoleErrors[0] : ""})`);

console.log(`\n== RESULT ==\npass ${pass} / fail ${fail}${fails.length ? "\n  - " + fails.join("\n  - ") : ""}`);
process.exit(fail === 0 ? 0 : 1);

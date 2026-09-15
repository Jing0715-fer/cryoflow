/* t206 e2e — the pairwise betrayal earns its ADDRESS too. t196 put the
 * pair's gold-standard r on the wall and in the report, t198 gave each
 * map's divergence an address (the weakest quarter), t205 taught the
 * report to print the address's coordinates; t206 extends the SAME
 * doctrine to the pair ITSELF: pairwiseAgreement also names the pair's
 * weakest quarter band (the equal-count cut, applied between the pair —
 * NOT against the main landscape), the report's Pairwise table grows a
 * trailing "Depth (fraction)" column (AFTER Verdict — A/B/r indices
 * unmoved, t196's D12 split[3] lesson), and the wall's pairwise chip
 * rides the same 2dp address. A pair too short to cut (n < 4) or flat
 * across every band earns no address — the honest dash answers.
 *   S  setup — seeder, orthovol + BOTH half-maps (+ hygienic start)
 *   W  wire — band oracles + the PAIRWISE oracle (half1 x half2)
 *   X  source oracles — 5-column header, depth drinks from/to, the
 *      t197 X2 distance guard survives, the chip speaks the dialect
 *   D  live — export, cut the Pairwise section, byte-for-byte against
 *      the wire oracle; the wall chip carries the address; the Local
 *      table's own depth cells survive beside the new column
 *   Z  read-only — roster identity, console clean
 * x3 runs required by house rules. */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { readFileSync } from "fs";
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const RUN = Number(process.env.RUN ?? "1");
const OUT = "scripts/shots-t206";
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
const jobs = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
const host = jobs.find((j) => j.name === "QA Refine3D");
must(!!host, "S1 QA Refine3D in roster (seeder idempotent)");
const outs = JSON.stringify(await (await fetch(`${BASE}/api/jobs/${host.id}/outputs`)).json());
must(outs.includes("orthovol.mrc") && outs.includes("run_it020_half1.mrc") && outs.includes("run_it020_half2.mrc"), "S2 orthovol + BOTH half-maps in outputs");

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
    if (!w || r < w.r) w = { r, from: lo / n, to: hi / n, k };
  }
  return w;
};
const w1 = weakestOf(mainW.bins, half1W.bins);
const w2 = weakestOf(mainW.bins, half2W.bins);
must(!!w1 && !!w2 && w1.k === 2 && w2.k === 0, `W2 the oracle's addresses match history (half1 Q${w1.k + 1} r ${w1.r.toFixed(2)}, half2 Q${w2.k + 1} r ${w2.r.toFixed(2)})`);
// the PAIRWISE oracle: the same cut, the pair as its own two maps —
// half1 x half2's weakest band (NOT against the main landscape)
const wPair = weakestOf(half1W.bins, half2W.bins);
must(!!wPair, `W3 the pair's own weakest band exists (Q${wPair.k + 1} r ${wPair.r.toFixed(2)})`);
const rPairGlobal = pearson(resample(half1W.bins, Math.max(half1W.bins.length, half2W.bins.length)), resample(half2W.bins, Math.max(half1W.bins.length, half2W.bins.length)));
// the DEPTH string: the strip's own 2dp dialect (from–to, en dash) —
// the SAME numbers t204's bracket door jumps to
const depthStr = (w) => `${w.from.toFixed(2)}–${w.to.toFixed(2)}`;
const d1 = depthStr(w1), d2 = depthStr(w2), dPair = depthStr(wPair);
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
must(QCLIB.includes("the pair as its own two maps") && QCLIB.includes("equal-count cut as localAgreement"), "X10 the pairwise weakest is the localAgreement cut applied BETWEEN the pair (one algorithm, two inputs)");
must((QCLIB.match(/### Pairwise agreement/g) || []).length === 1 && QCLIB.includes("where each pair's corroboration is thinnest"), "X11 the prose teaches the pairwise Depth column — where the corroboration is thinnest");
must(SRC.includes("const pdepth = p.weakest ? ` · ${p.weakest.from.toFixed(2)}–${p.weakest.to.toFixed(2)}` : \"\";") && SRC.includes("thinnest corroboration sits between"), "X12 the wall chip rides the same address (2dp dialect + the title names the band)");

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
const chip1 = page.locator('[data-local-chip="run_it020_half1"]');
const chip2 = page.locator('[data-local-chip="run_it020_half2"]');
let chipsUp = false;
for (let k = 0; k < 100 && !chipsUp; k++) {
  if ((await chip1.count()) > 0 && (await chip2.count()) > 0) chipsUp = true;
  else await sleep(2000);
}
must(chipsUp, "D3 both maps adopted — the local row speaks twice (long poll: chips can lag a cold adoption by minutes)");

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
// t198's RAW convention: split on "|" and trim — the boundary empties stay,
// so a 7-column row is 9 segments and the cells keep t198's indices
// (quarters 2..5, Weakest 6, Depth 7) with no renumbering of the front wave
const cellsOf = (l) => (l ?? "").split("|").map((c) => c.trim());
const c1 = cellsOf(row1), c2 = cellsOf(row2);
must(c1.length === 9 && c2.length === 9, `D6 both rows carry 9 segments (2 boundary empties + 7 columns) (${c1.length}/${c2.length})`);
must(c1[7] === d1, `D7 half1's depth cell == the wire oracle byte-for-byte (${c1[7]} == ${d1})`);
must(c2[7] === d2, `D8 half2's depth cell == the wire oracle byte-for-byte (${c2[7]} == ${d2})`);
must(c1[6] === `${QUARTERS[w1.k]} (${w1.r.toFixed(2)})`, `D9 half1's Weakest cell == t198's oracle UNTOUCHED (${c1[6]})`);
must(c2[6] === `${QUARTERS[w2.k]} (${w2.r.toFixed(2)})`, `D10 half2's Weakest cell == t198's oracle UNTOUCHED (${c2[6]})`);
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
must(ps.includes("where each pair's corroboration is thinnest"), "D20 the prose names the pairwise Depth column, live");

// THE WALL: the pairwise chip rides the same address
const pairChipText = (await page.locator('div[data-pairwise-row="1"]').textContent().catch(() => "")) ?? "";
must(pairChipText.includes("run_it020_half1") && pairChipText.includes("run_it020_half2"), "D21 the wall chip names both halves (t196's row survives)");
must(pairChipText.includes(`r ${rPairGlobal.toFixed(2)}`), `D22 the wall chip's r == the wire oracle (${rPairGlobal.toFixed(2)})`);
must(pairChipText.includes(` · ${dPair}`), `D23 the wall chip rides the pair's address in the 2dp dialect (${dPair})`);
const pairChipTitle = await page.locator('div[data-pairwise-row="1"] span').first().getAttribute("title").catch(() => null);
must(!!pairChipTitle && pairChipTitle.includes("thinnest corroboration sits between") && pairChipTitle.includes(QUARTERS[wPair.k]), "D24 the chip's title teaches the band (vocabulary AND coordinates)");


await page.screenshot({ path: `${OUT}/t206-pair-paper-2x.png` }).catch(() => {});

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

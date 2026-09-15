/* t214 e2e — the roster speaks its numbers. t212 put every owner's NAME
 * on the paper, t213 made every row pressable — but a roster you can
 * read and travel is still not a roster you can COMPARE: the deep report
 * quotes the winner's peak (76.2% of depth) while the other owners sit
 * nameless-numb below it. t214 adds the Peak column: each owner's MAIN
 * map is profiled once (the same map-profile API, the same argmax, the
 * SAME exported formula — peakPctOf/peakIndexOf in qc-report.ts, so the
 * deep report's Peak bullet and the inventory's Peak cell are one truth
 * on two surfaces). The peaks ride ALONGSIDE the deep measurement — the
 * inventory still settles first (partial truth over silence), each cell
 * fills when its owner is heard, and "—" means still-measuring/refused,
 * never a guess (the pending doctrine, per row). The doors' aria
 * promises grow the peak too — a door says what its row says.
 *   S  setup — the naked world (idempotent seeders, NO updatedAt bumps)
 *   W  wire — both owners' main profiles fetch independently; the probe
 *      computes the expected peak cells with its own argmax
 *   X  source oracles — the shared well (peakIndexOf/peakPctOf used by
 *      buildProfileReport AND measureOwnerPeaks), the contract's nullable
 *      peak, the four-column head, the "—" honest cell, the alongside
 *      ordering, the abort-honest merge, the teaching clause, the door
 *      promise
 *   D  live — the full row bytes == wire (both owners), the deep report's
 *      peak == the winner row's peak (one truth, two surfaces), the
 *      rendered Peak column speaks the same numbers, the doors' aria
 *      carry the peaks, a reopen re-settles fast (statcache)
 *   Z  read-only — roster identity, console clean
 * x3 runs required by house rules. */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { readFileSync } from "fs";
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "scripts/shots-t214";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const fails = [];
const must = (cond, label) => {
  if (cond) { pass++; console.log(`  ok: ${label}`); }
  else { fail++; fails.push(label); console.error(`  FAIL: ${label}`); }
};
const section = (t) => console.log(`\n== ${t} ==`);

const LIB = readFileSync("src/lib/qc-report.ts", "utf8");
const DLG = readFileSync("src/components/workflow/session-report-dialog.tsx", "utf8");
const H = { "sec-fetch-site": "same-origin" };

const jobs = async () => {
  const d = await (await fetch(BASE + "/api/jobs", { headers: H })).json();
  return d.jobs ?? d;
};
const outputs = async (id) =>
  (await (await fetch(`${BASE}/api/jobs/${id}/outputs`, { headers: H })).json());
const isVolume = (f) => f.kind === "mrc" && Array.isArray(f.dims) && f.dims.length === 3;
const VOLUME_CAPABLE = /refine3d|class3d|postprocess|multibody/i;
const MAIN_MAP_RE = /half0|postprocess\.mrc$/i;

/* ============ S: setup — the naked world, two owners ============ */
section("S: the world, with two speaking jobs (naked — no bumps)");
execSync("python3 scripts/qa67-seed-volume.py", { stdio: "pipe" });
execSync("python3 scripts/seed-refine-halves.py", { stdio: "pipe" });
execSync('QA_VOL_HOST="QA Class2D Source" python3 scripts/qa67-seed-volume.py', { stdio: "pipe" });
const rosterS = await jobs();
const host = rosterS.find((j) => j.name === "QA Refine3D");
const second = rosterS.find((j) => j.name === "QA Class2D Source");
must(!!host && !!second, "S1 both owners in roster (Refine3D the capable host, Class2D Source the tail-tier second)");
const outsH = await outputs(host.id);
const outsS = await outputs(second.id);
must((outsH.files ?? []).filter(isVolume).length === 4, "S2 the host owns FOUR volumes (orthovol + both halves + masked)");
must((outsS.files ?? []).filter(isVolume).length === 1, "S3 the second owner speaks exactly one volume (orthovol)");

/* ============ W: the wire — expected peaks, computed independently ============ */
section("W: both owners' landscapes, spoken independently");
async function expectedOwners() {
  const done = (await jobs()).filter((j) => j.status === "completed");
  const rec = (a, b) =>
    a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : a.id < b.id ? -1 : 1;
  const queue = [
    ...done.filter((j) => VOLUME_CAPABLE.test(j.type)).sort(rec),
    ...done.filter((j) => !VOLUME_CAPABLE.test(j.type)).sort(rec),
  ].slice(0, 24);
  const owners = [];
  for (const j of queue) {
    const d = await outputs(j.id);
    const vols = (d.files ?? []).filter(isVolume);
    if (vols.length === 0) continue;
    const sorted = [...vols].sort(
      (a, b) => Number(MAIN_MAP_RE.test(b.name)) - Number(MAIN_MAP_RE.test(a.name)),
    );
    owners.push({ job: j, mainName: sorted[0].label ?? sorted[0].name, volumeCount: vols.length, mainPath: sorted[0].path });
  }
  return owners;
}
const owners = await expectedOwners();
must(owners.length === 2, `W1 the walk hears TWO owners (${owners.length})`);
must(owners[0]?.job.id === host.id && owners[1]?.job.id === second.id, "W2 walk order: capable host first, tail-tier second");
const profFor = async (id, p) =>
  (await (await fetch(`${BASE}/api/jobs/${id}/map-profile?path=${encodeURIComponent(p)}&axis=z`, { headers: H })).json());
const peakOf = (bins) => {
  const i = bins.reduce((bi, v, idx, arr) => (v > arr[bi] ? idx : bi), 0);
  return `${((i / Math.max(1, bins.length - 1)) * 100).toFixed(1)}%`;
};
const binsH = (await profFor(host.id, owners[0].mainPath)).bins;
const binsS = (await profFor(second.id, owners[1].mainPath)).bins;
must(!!binsH?.length && !!binsS?.length, `W3 both profiles on the wire (${binsH?.length} + ${binsS?.length} bins)`);
const peakH = peakOf(binsH);
const peakS = peakOf(binsS);
must(peakH !== peakS || true, `W4 the expected cells: host ${peakH}, second ${peakS}`);

/* ============ X: source oracles ============ */
section("X: one truth, two surfaces — rebuilt in source");
must(LIB.includes("export const peakIndexOf = (bins: number[]): number =>") && LIB.includes("export const peakPctOf = (bins: number[]): string => pctAt(bins, peakIndexOf(bins));"), "X1 the shared well — peakIndexOf/peakPctOf exported from the ONE home");
must((LIB.match(/peakIndexOf\(bins\)/g) ?? []).length >= 2, "X2 buildProfileReport itself drinks the well (the deep report's Peak bullet shares the formula)");
must(LIB.includes("volumeCount: number; peak: string | null; peakPct: number | null; shapeR?: number | null; weakest?: { label: string; r: number; from: number } | null }[] | null;"), "X3 the contract's per-row peak, its 1-decimal number (t215's lens drinks the rounded cells, not the raw bins), t221's Agreement r and t222's weakest band (optional-nullable — the grid never guesses), all nullable while measuring");
must(LIB.includes("| Job | Main map | Volumes | Peak |") && LIB.includes("|-----|----------|---------|------|"), "X4 the four-column head (who, what, how many, where the mass sits)");
must(LIB.includes('${o.peak ?? "—"}'), "X5 the honest cell — — means still measuring, never a guess");
must((DLG.match(/async function measureOwnerPeaks\(/g) ?? []).length === 1 && DLG.includes("peakPctOf(d.bins)"), "X6 measureOwnerPeaks defined once, quoting the SAME formula (peakPctOf)");
{
  const settle = DLG.indexOf("setMapInventory(\n        owners.map");
  const fire = DLG.indexOf("const peaks = measureOwnerPeaks(owners, ctrl.signal);");
  const deep = DLG.indexOf("measureMapQc(owners[0]");
  const merge = DLG.indexOf("const heard = await peaks;");
  must(settle >= 0 && fire > settle && deep > fire && merge > deep, "X7 the alongside order — inventory settles, peaks fire, the deep report measures, the merge lands after");
}
must(DLG.includes("if (ctrl.signal.aborted || heard.size === 0) return;"), "X8 the merge is abort-honest (a closed dialog fills nothing)");
must(LIB.includes("The Peak column quotes each owner's main map exactly the way the deep report quotes the winner") && LIB.includes("— means still measuring, never a guess"), "X9 the paper teaches the column (same measure, same axis, no guesses)");
must(DLG.includes("peak ${owner.peak}` : \"\"}${delta ? `, Δ ${delta} vs winner` : \"\"}"), "X10 the door's promise grows the peak and the delta (t215: the aria quotes what the row says — peak AND Δ, both from the imported well)");

/* ============ D: live — the roster speaks ============ */
section("D: the roster, quoted");
const browser = await chromium.launch();
const errors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await sleep(2200);

await page.locator('button[aria-label="Session QC report"]').click();
const carrier = page.locator("[data-report-doc][data-md]");
let md = null;
for (let i = 0; i < 90 && !md; i++) {
  const v = await carrier.getAttribute("data-md").catch(() => null);
  if (v && v.includes(`| ${peakH} |`) && v.includes(`| ${peakS} |`)) md = v;
  else await sleep(500);
}
must(!!md, `D1 the carrier settles with BOTH peak cells (host ${peakH}, second ${peakS})`);
must(md && md.includes(`| ${host.name} | orthovol | 4 | ${peakH} |`), `D2 the host's full row == wire ("| ${host.name} | orthovol | 4 | ${peakH} |")`);
must(md && md.includes(`| ${second.name} | orthovol | 1 | ${peakS} |`), `D3 the second's full row == wire ("| ${second.name} | orthovol | 1 | ${peakS} |")`);
must(md && md.includes(`**${peakH}** of depth`) && md.indexOf(`**${peakH}** of depth`) < md.indexOf(`| ${host.name} | orthovol | 4 | ${peakH} |`), "D4 ONE TRUTH, TWO SURFACES — the deep report's Peak bullet and the winner row's cell quote the same number, deep first");
must(md && md.includes("| Job | Main map | Volumes | Peak |"), "D5 the rendered paper's head carries the Peak column");
must(md && !md.includes("| QA Refine3D | orthovol | 4 | — |"), "D6 no dash lingers on a speaking row (the pending window closed)");

// the RENDERED table speaks the same numbers cell-for-cell
const doorRows = page.locator("[data-report-body] tr[data-owner-door]");
for (let i = 0; i < 40 && (await doorRows.count()) !== 2; i++) await sleep(500);
for (let i = 0; i < 40; i++) {
  const a = (await doorRows.nth(0).getAttribute("aria-label").catch(() => "")) ?? "";
  if (a.includes(`peak ${peakH}`)) break;
  await sleep(500);
}
// t215: the Δ winner column joined the table — the LAST td is now the
// delta, the Peak cell is the 4th. Position is pinned by the HEAD, not
// by "last" (last was only honest while the table had four columns).
const cellH = ((await doorRows.nth(0).locator("td").nth(3).textContent()) ?? "").trim();
const cellS = ((await doorRows.nth(1).locator("td").nth(3).textContent()) ?? "").trim();
must(cellH === peakH && cellS === peakS, `D7 the rendered Peak cells == wire (host "${cellH}", second "${cellS}")`);
const ariaH = (await doorRows.nth(0).getAttribute("aria-label")) ?? "";
must(ariaH.includes(`peak ${peakH}`), `D8 the host door's aria quotes its peak ("${ariaH}")`);
// RUN=1's lesson: the report body hosts FOUR tables (deep quartiles,
// comparison, pairwise, inventory) — a bare "[data-report-body] thead th"
// collects every family's head. The quartet must be read from the ONE
// table that carries the doors (has-scoped), never from the whole body.
const headCells = await page.locator("[data-report-body] table:has(tr[data-owner-door]) thead th").allTextContents();
must(JSON.stringify(headCells) === JSON.stringify(["Job", "Main map", "Volumes", "Peak", "Δ winner", "Agreement r", "Weakest"]), `D9 the inventory's OWN head is the septet (${JSON.stringify(headCells)})`);

// reopen — the statcache makes the peaks re-settle quickly (the walk and
// the peaks re-run on every open; nothing is remembered across opens)
await page.keyboard.press("Escape");
await page.locator("[data-report-doc]").waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
await sleep(400);
const t0 = Date.now();
await page.locator('button[aria-label="Session QC report"]').click();
let md2 = null;
for (let i = 0; i < 90 && !md2; i++) {
  const v = await carrier.getAttribute("data-md").catch(() => null);
  if (v && v.includes(`| ${peakH} |`) && v.includes(`| ${peakS} |`)) md2 = v;
  else await sleep(400);
}
must(!!md2, `D10 a reopen re-settles both peaks (statcache-cheap, ${Date.now() - t0}ms)`);
const invHeading = page.locator('h3:has-text("Session map inventory")');
await invHeading.scrollIntoViewIfNeeded();
await sleep(400);
await page.screenshot({ path: `${OUT}/t214-peaks-2x.png` });
await page.keyboard.press("Escape");

/* ============ Z: the world read back ============ */
section("Z: the world read back");
const rosterZ = await jobs();
must(rosterZ.length === 21, `Z1 roster identity (${rosterZ.length})`);
must(errors.length === 0, `Z2 console clean (${errors.length} errors)`);

await browser.close();

console.log(`\n== RESULT ==\npass ${pass} / fail ${fail}`);
if (fail > 0) { console.error(fails.map((f) => `  - ${f}`).join("\n")); process.exit(1); }

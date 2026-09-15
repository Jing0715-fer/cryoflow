/* t215 e2e — the comparison becomes readable. t212 put every owner's
 * NAME on the paper, t213 made every row pressable, t214 gave every row
 * its peak — but numbers you must subtract IN YOUR HEAD are numbers the
 * instrument never really spoke. t215 grows the inventory a fifth
 * column, "Δ winner": each peak read against the winner's own, computed
 * by ONE exported helper (deltaVsWinner in qc-report.ts) that the door
 * aria quotes too — twins fork, imports don't. The delta is derived
 * from the ROUNDED cells (peakPctNumOf rounds on the paper's own
 * 1-decimal grid BEFORE any subtraction), so the paper's arithmetic is
 * the reader's arithmetic — no 0.1 drift between the printed peaks and
 * the printed delta. And the lens: on the page, the row whose |Δ| is
 * strictly the unique maximum wears an amber edge (outlierRowIdx — a
 * tie for the crown is no crown; the winner's +0.0 can never outshine
 * itself); the exported bytes keep the numbers and let the reader
 * judge. The reference row speaks +0.0, a dash obeys the pending law.
 *   S  setup — the DIVERGENT world: seed-outlier.py overwrites the
 *      tail-tier host's orthovol with the blob at z=16 (peak ≈ 25.4% of
 *      depth) while the winner keeps qa67's shape (76.2%) — the file
 *      NAME never moves, only the landscape under the number
 *   W  wire — both owners' profiles fetched independently; the probe
 *      computes the expected peak AND delta cells with reader
 *      arithmetic (from the rounded cells, like a human would)
 *   X  source oracles — the numeric well (pctNumAt/peakPctNumOf), the
 *      delta/lens helpers single-definition + imported, the quintet
 *      key, the honest Δ cell, the teaching clause, the comparator
 *      extinction in the lens, data-outlier wiring
 *   D  live — full rows == wire (all five cells), the amber edge on
 *      exactly the tail row, aria quotes peak AND delta, the lens never
 *      shields the door (press it — t209's lesson), reopen re-settles
 *   Z  read-only — roster identity, console clean
 * x3 runs required by house rules. */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { readFileSync } from "fs";
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "scripts/shots-t215";
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

/* ============ S: setup — the divergent world ============ */
section("S: the world, with a DIVERGENT second owner (no bumps, file name never moves)");
// t216: the world must be rebuildable from the probe's OWN setup — no
// reliance on accumulated state (data/ is not in git; a sandbox rollback
// wiped the winner's orthovol + masked and 4 assertions died on sight).
// The full recipe (t210's, inherited): winner orthovol -> outlier orthovol
// -> halves -> masked -> the DIVERGENT overwrite LAST (it re-shapes the
// outlier's orthovol, so nothing may re-seed that file afterwards).
execSync('QA_VOL_HOST="QA Refine3D" python3 scripts/qa67-seed-volume.py', { stdio: "pipe" });
execSync("python3 scripts/qa67-seed-volume.py", { stdio: "pipe" });
execSync("python3 scripts/seed-refine-halves.py", { stdio: "pipe" });
execSync("python3 scripts/seed-masked.py", { stdio: "pipe" });
const outlierReceipt = execSync("python3 scripts/seed-outlier.py", { encoding: "utf8" });
must(outlierReceipt.includes("DIVERGENT"), "S1 the outlier seeder ran and said so (idempotent overwrite, after qa67)");
const rosterS = await jobs();
const host = rosterS.find((j) => j.name === "QA Refine3D");
const second = rosterS.find((j) => j.name === "QA Class2D Source");
must(!!host && !!second, "S2 both owners in roster (Refine3D the capable host, Class2D Source the tail-tier second)");
const outsH = await outputs(host.id);
const outsS = await outputs(second.id);
must((outsH.files ?? []).filter(isVolume).length === 4, "S3 the host owns FOUR volumes (orthovol + both halves + masked)");
must((outsS.files ?? []).filter(isVolume).length === 1, "S4 the second owner still speaks exactly ONE volume — the seeder moved the landscape, not the file name");

/* ============ W: the wire — expected peaks AND deltas, reader arithmetic ============ */
section("W: both landscapes spoken independently; deltas from the rounded cells");
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
must(peakS !== peakH, `W4 the DIVERGENCE is real on the wire: host ${peakH}, second ${peakS} (the tie world is gone — the lens has something to say)`);
// reader arithmetic: the deltas are computed FROM THE PRINTED CELLS, the
// way a human subtracts them — 25.4 - 76.2, not raw-bin esoterica
const num = (s) => Number(s.replace("%", ""));
const deltaW = `+${Math.abs(Number((num(peakH) - num(peakH)).toFixed(1))).toFixed(1)}`;
const dS = Number((num(peakS) - num(peakH)).toFixed(1));
const deltaS = `${dS < 0 ? "-" : "+"}${Math.abs(dS).toFixed(1)}`;
must(deltaW === "+0.0", "W5 the reference row's expected delta is +0.0 (the winner reads against itself)");
must(dS < 0, `W6 the second's expected delta is NEGATIVE (${deltaS}) — its mass sits higher on the depth ruler`);

/* ============ X: source oracles ============ */
section("X: one well, two surfaces, one lens — rebuilt in source");
must(LIB.includes("export const pctNumAt = (bins: number[], i: number): number =>") && LIB.includes("export const pctAt = (bins: number[], i: number): string =>\n  `${pctNumAt(bins, i).toFixed(1)}%`;"), "X1 the numeric well — pctNumAt exported and pctAt (the paper's words) drinks it (a parse-back of the string would fork the well)");
must(LIB.includes("export const peakPctNumOf = (bins: number[]): number =>\n  Number(pctNumAt(bins, peakIndexOf(bins)).toFixed(1));"), "X2 peakPctNumOf rounds on the paper's own 1-decimal grid BEFORE any subtraction — the printed cells are the well");
must((LIB.match(/export const deltaVsWinner/g) ?? []).length === 1 && DLG.includes("deltaVsWinner,") && !DLG.includes("const deltaVsWinner"), "X3 deltaVsWinner defined ONCE in qc-report, IMPORTED by the dialog (twins fork, imports don't)");
must((LIB.match(/export const outlierRowIdx/g) ?? []).length === 1 && DLG.includes("outlierRowIdx(mapInventory ?? [])") && !DLG.includes("const outlierRowIdx"), "X4 outlierRowIdx defined ONCE, imported — the dialog does not re-derive the crown");
must(LIB.includes("| Job | Main map | Volumes | Peak | Δ winner |") && DLG.includes('const OWNER_HEAD = ["Job", "Main map", "Volumes", "Peak", "Δ winner"];'), "X5 the table grew a fifth column and the KEY GREW WITH IT — by design this time, before any probe died (the t214 lesson as routine discipline)");
must(LIB.includes("${o.peak ?? \"—\"} | ${delta ?? \"—\"} |"), "X6 the honest Δ cell — a dash obeys the same pending law, never a guess");
must(LIB.includes("The Δ winner column reads every peak against the winner's own") && LIB.includes("the row farthest from the winner wears the amber edge (a lens, not a verdict"), "X7 the paper teaches the lens (reference row, dash law, amber edge — and the bytes keep the numbers)");
{
  const outBody = LIB.slice(LIB.indexOf("export const outlierRowIdx"), LIB.indexOf("/** Every PAIR"));
  must(outBody.includes("1e-9") && outBody.includes("unique") && !outBody.includes("? 1 : -1"), "X8 the lens's comparator is three-state with an epsilon — the unary (a<b?1:-1) shape stays extinct (the t211 lesson, lens edition)");
}
must(DLG.includes('data-outlier={isOutlier ? "1" : undefined}') && DLG.includes('boxShadow: "inset 3px 0 0 0 rgb(245 158 11)"'), "X9 the amber edge is wired as data-outlier + an inset amber shadow (a lens, not a verdict — the row stays a door)");
must(DLG.includes("text: peakPctOf(d.bins), pct: peakPctNumOf(d.bins)"), "X10 measureOwnerPeaks returns BOTH surfaces of the one well at ONE call site (the text for the cell, the number for the lens)");
must(DLG.includes("${delta ? `, Δ ${delta} vs winner` : \"\"}"), "X11 the door's promise quotes the delta from the SAME imported helper");

/* ============ D: live — the lens speaks ============ */
section("D: the roster, compared");
const browser = await chromium.launch();
const errors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(BASE + "/", { waitUntil: "networkidle" });
await sleep(2200);

const openReport = async () => {
  await page.locator('button[aria-label="Session QC report"]').click();
  const carrier = page.locator("[data-report-doc][data-md]");
  let v = null;
  for (let i = 0; i < 90 && !v; i++) {
    const a = await carrier.getAttribute("data-md").catch(() => null);
    if (a && a.includes(`| ${peakH} | +0.0 |`) && a.includes(`| ${peakS} | ${deltaS} |`)) v = a;
    else await sleep(500);
  }
  return v;
};
const md = await openReport();
must(!!md, `D1 the carrier settles with BOTH delta cells (winner +0.0, second ${deltaS})`);
must(md && md.includes(`| ${host.name} | orthovol | 4 | ${peakH} | +0.0 |`), `D2 the winner's full row == wire, five cells ("| ${host.name} | orthovol | 4 | ${peakH} | +0.0 |")`);
must(md && md.includes(`| ${second.name} | orthovol | 1 | ${peakS} | ${deltaS} |`), `D3 the second's full row == wire ("| ${second.name} | orthovol | 1 | ${peakS} | ${deltaS} |")`);
must(md && md.includes(`**${peakH}** of depth`) && md.indexOf(`**${peakH}** of depth`) < md.indexOf(`| ${host.name} | orthovol | 4 | ${peakH} | +0.0 |`), "D4 the deep report's Peak bullet and the winner row still quote the same number, deep first (one truth, two surfaces — untouched by the lens)");
must(md && md.includes("The Δ winner column reads every peak against the winner's own"), "D5 the paper itself teaches the lens");

const doorRows = page.locator("[data-report-body] tr[data-owner-door]");
for (let i = 0; i < 40 && (await doorRows.count()) !== 2; i++) await sleep(500);
const headCells = await page.locator("[data-report-body] table:has(tr[data-owner-door]) thead th").allTextContents();
must(JSON.stringify(headCells) === JSON.stringify(["Job", "Main map", "Volumes", "Peak", "Δ winner"]), `D6 the inventory's OWN head is the quintet (${JSON.stringify(headCells)})`);
const cellsW = (await doorRows.nth(0).locator("td").allTextContents()).map((c) => c.trim());
const cellsS = (await doorRows.nth(1).locator("td").allTextContents()).map((c) => c.trim());
must(JSON.stringify(cellsW) === JSON.stringify([host.name, "orthovol", "4", peakH, "+0.0"]), `D7 the rendered winner row == wire, cell for cell (${JSON.stringify(cellsW)})`);
must(JSON.stringify(cellsS) === JSON.stringify([second.name, "orthovol", "1", peakS, deltaS]), `D8 the rendered second row == wire (${JSON.stringify(cellsS)})`);

// THE LENS: exactly one amber row, and it is the TAIL row
for (let i = 0; i < 20 && (await page.locator("[data-report-body] tr[data-outlier]").count()) !== 1; i++) await sleep(500);
const outlierCount = await page.locator("[data-report-body] tr[data-outlier]").count();
must(outlierCount === 1, `D9 exactly ONE row wears the amber edge (${outlierCount}) — a contested crown is no crown`);
const outlierId = await page.locator("[data-report-body] tr[data-outlier]").first().getAttribute("data-owner-door");
must(outlierId === second.id, "D10 the amber edge sits on the SECOND row — the one whose mass sits farthest from the winner's");
must(!(await doorRows.nth(0).getAttribute("data-outlier")), "D11 the winner row is NOT the outlier (+0.0 can never outshine itself)");
const ariaS = (await doorRows.nth(1).getAttribute("aria-label")) ?? "";
must(ariaS.includes(`peak ${peakS}`) && ariaS.includes(`Δ ${deltaS} vs winner`), `D12 the tail door's aria quotes peak AND delta ("${ariaS}")`);
const ariaH = (await doorRows.nth(0).getAttribute("aria-label")) ?? "";
must(ariaH.includes(`peak ${peakH}`) && ariaH.includes("Δ +0.0 vs winner"), `D13 the host door's aria quotes its zero delta honestly ("${ariaH}")`);

// THE LENS NEVER SHIELDS THE DOOR (t209's lesson, report edition):
// the amber row is still pressable and still lands on its results
await doorRows.nth(1).click();
await page.locator("[data-report-doc]").waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
const ins = page.locator("[data-inspector-dialog]");
await ins.waitFor({ state: "visible", timeout: 15000 });
const insName = (await ins.textContent()) ?? "";
must(insName.includes(second.name), `D14 the amber row is still a door — pressing it lands on ${second.name}'s results (a lens, not a shield)`);
await page.keyboard.press("Escape");
await page.locator("[data-inspector-dialog]").waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
await sleep(400);

// reopen — the statcache makes the lens re-speak quickly
const t0 = Date.now();
const md2 = await openReport();
must(!!md2, `D15 a reopen re-settles both deltas (statcache-cheap, ${Date.now() - t0}ms)`);
const invHeading = page.locator('h3:has-text("Session map inventory")');
await invHeading.scrollIntoViewIfNeeded();
await sleep(400);
await page.screenshot({ path: `${OUT}/t215-lens-2x.png` });
await page.keyboard.press("Escape");
await page.locator("[data-report-doc]").waitFor({ state: "detached", timeout: 10000 }).catch(() => {});

/* ============ Z: the world read back ============ */
section("Z: the world read back");
const rosterZ = await jobs();
must(rosterZ.length === 21, `Z1 roster identity (${rosterZ.length})`);
must(errors.length === 0, `Z2 console clean (${errors.length} errors)`);

await browser.close();

console.log(`\n== RESULT ==\npass ${pass} / fail ${fail}`);
if (fail > 0) { console.error(fails.map((f) => `  - ${f}`).join("\n")); process.exit(1); }

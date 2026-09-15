/* t212 e2e — the paper sees the WHOLE session. t211 taught the report's
 * walk to find the volume owner the fold had been hiding; but the report
 * still told only ONE job's story: the newest owner rode the deep
 * profiles, and every OTHER owner stayed unseen below it. t212 generalizes
 * the lesson: the SAME walk (volume-capable tiers, recency, budget 24)
 * now RECORDS every owner it passes — the inventory costs zero extra
 * outputs probes — and the paper grows a "### Session map inventory"
 * table (Job | Main map | Volumes), newest walk first, right after the
 * deep profiles. The inventory is a fact of the WALK: it settles even
 * when the deep measurement then refuses (partial truth over silence);
 * it honest-absents when the world owns no volumes at all.
 *   S  setup — the four-volume host (Refine3D) AND a second owner
 *      (qa67's own default host, QA Class2D Source — a never-volume-TIER
 *      job, so the inventory's row ORDER is the tier doctrine made
 *      visible: capable owner first, tail-tier owner second)
 *   W  wire — the walk spoken independently through the API returns BOTH
 *      owners in order; profiles feed the probe's own peak/pearson
 *   X  source oracles — the inventory rides buildSessionReport's contract
 *      (field, title, table head, honest-absence guard); the walk's
 *      rename (findMapBrief -> walkVolumeOwners) left no twin; the
 *      inventory settles BEFORE the deep measurement in the source
 *   D  live — the paper carries the inventory: rows == wire owners, row
 *      ORDER == walk order, names and counts == wire, the deep profiles
 *      still ride the winner, section position between Map QC and sweep
 *   Z  read-only — roster identity, console clean
 * x3 runs required by house rules. */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { readFileSync } from "fs";
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "scripts/shots-t212";
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

/* ============ S: setup — TWO owners ============ */
section("S: the world, with two speaking jobs");
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
must(!VOLUME_CAPABLE.test(second.type), `S4 the second owner's type (${second.type}) sits in the NEVER-VOLUME tier — its inventory presence is the tail tier made visible`);

/* ============ W: the wire feeds the oracles ============ */
section("W: the walk, spoken independently — every owner");
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
    owners.push({
      job: j,
      mainName: sorted[0].label ?? sorted[0].name,
      volumeCount: vols.length,
      mainPath: sorted[0].path,
    });
  }
  return owners;
}
const owners = await expectedOwners();
must(owners.length === 2, `W1 the walk hears TWO owners (${owners.length})`);
must(owners[0]?.job.id === host.id, "W2 the walk's FIRST owner is the capable host (the deep-report winner)");
must(owners[1]?.job.id === second.id, "W3 the walk's SECOND owner is the tail-tier job (the inventory's reason to exist)");
const prof = async (p) =>
  (await (await fetch(`${BASE}/api/jobs/${host.id}/map-profile?path=${encodeURIComponent(p)}&axis=z`, { headers: H })).json());
const mainW = await prof(owners[0].mainPath);
must(!!mainW?.bins?.length, `W4 profiles on the wire (main ${mainW?.bins?.length} bins)`);
const peakIdx = mainW.bins.reduce((bi, v, i, arr) => (v > arr[bi] ? i : bi), 0);
const peakPct = `${((peakIdx / Math.max(1, mainW.bins.length - 1)) * 100).toFixed(1)}%`;
const profFor = async (id, p) =>
  (await (await fetch(`${BASE}/api/jobs/${id}/map-profile?path=${encodeURIComponent(p)}&axis=z`, { headers: H })).json());
const secondW = await profFor(second.id, owners[1].mainPath);
must(!!secondW?.bins?.length, `W5 the second owner's profile on the wire (its peak cell drinks the same well, ${secondW?.bins?.length} bins)`);
const peakIdx2 = secondW.bins.reduce((bi, v, i, arr) => (v > arr[bi] ? i : bi), 0);
const peakPct2 = `${((peakIdx2 / Math.max(1, secondW.bins.length - 1)) * 100).toFixed(1)}%`;

/* ============ X: source oracles ============ */
section("X: the inventory, rebuilt in source");
must(LIB.includes("mapInventory: { jobId: string; jobName: string; mainName: string; volumeCount: number; peak: string | null; peakPct: number | null }[] | null;"), "X1 the inventory rides buildSessionReport's contract (typed, nullable while pending; each row's peak AND its 1-decimal number nullable while measuring — t214 + t215)");
must(LIB.includes("### Session map inventory"), "X2 the paper's inventory title lives in the ONE home for the families");
must(LIB.includes("| Job | Main map | Volumes | Peak |"), "X3 the inventory table's head (four columns: who, what, how many, where the mass sits — t214)");
must(LIB.includes("if (mapInventory && mapInventory.length > 0) {"), "X4 the honest absence — no volumes, no table, no lie");
must(DLG.includes("async function walkVolumeOwners(") && !DLG.includes("findMapBrief"), "X5 the walk's new name, and no twin of the old one survives");
{
  // call-site order, not first-mention order (the useState destructure
  // mentions setMapInventory long before the effect runs)
  const invCall = DLG.indexOf("owners.map((o) => ({ jobId");
  const qcCall = DLG.indexOf("measureMapQc(owners[0]");
  must(invCall >= 0 && qcCall >= 0 && invCall < qcCall, "X6 the inventory settles BEFORE the deep measurement, and the winner still rides owners[0]");
}

/* ============ D: live wire through the UI ============ */
section("D: the paper sees the whole session");
const browser = await chromium.launch();
const errors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(BASE, { waitUntil: "networkidle" });
await sleep(2200);

const door = page.locator('button[aria-label="Session QC report"]');
must(await door.isVisible().catch(() => false), "D1 the header door is visible");
await door.click();
await sleep(600);
const dlg = page.locator('[data-report-doc]');
must(await dlg.isVisible().catch(() => false), "D2 the report page opens");

const carrier = page.locator('[data-report-doc][data-md]');
let md = null;
for (let i = 0; i < 60 && !md; i++) {
  const v = await carrier.getAttribute("data-md").catch(() => null);
  if (v && v.includes("Map QC summary")) md = v;
  else await sleep(500);
}
must(!!md, "D3 the map section settles on the carrier (still-measuring never lingers)");
// t214: the peaks fill in AFTER the deep section — wait for BOTH cells
let mdp = null;
for (let i = 0; i < 60 && !mdp; i++) {
  const v = await carrier.getAttribute("data-md").catch(() => null);
  if (v && v.includes(`| ${peakPct} |`) && v.includes(`| ${peakPct2} |`)) mdp = v;
  else await sleep(500);
}
mdp = mdp ?? md;
must(mdp && mdp.includes(`| ${peakPct} |`) && mdp.includes(`| ${peakPct2} |`), "D3b the PEAK cells settle on the carrier (— never lingers when the wire speaks)");
md = mdp;
must(md && md.includes("### Session map inventory"), "D4 THE INVENTORY SPEAKS — the paper admits the rest of the session exists");
must(md && md.includes(`| ${host.name} | orthovol | 4 | ${peakPct} |`), `D5 the host's row: name, main map, all four volumes, its peak (${peakPct})`);
must(md && md.includes(`| ${second.name} | orthovol | 1 | ${peakPct2} |`), `D6 the second owner's row: name, main map, its single volume, its peak (${peakPct2})`);
must(md && md.indexOf(`| ${host.name} |`) < md.indexOf(`| ${second.name} |`), "D7 the rows walk in WALK ORDER — capable tier first, tail tier second");
must(md && md.indexOf("## Map QC") < md.indexOf("### Session map inventory") && md.indexOf("### Session map inventory") < md.indexOf("## Scheduling sweep"), "D8 the inventory sits between the deep profiles and the sweep annex");
must(md && md.includes(`Job \`${host.id}\``), "D9 the deep profiles still ride the walk's first owner");
must(md && md.includes(`**${peakPct}** of depth`), `D10 the peak equals the wire's argmax (${peakPct})`);
must(md && !md.includes("None of this session's jobs has 3D maps"), "D11 no empty-state lie in a world with two speaking jobs");
// the portrait must SHOW the inventory — scroll the rendered heading
// into view before the shot (a portrait of the fold's top is not a
// portrait of the inventory)
const invHeading = page.locator('h3:has-text("Session map inventory")');
must(await invHeading.isVisible().catch(() => false), "D12 the rendered inventory heading is visible");
await invHeading.scrollIntoViewIfNeeded();
await sleep(400);
await page.screenshot({ path: `${OUT}/t212-inventory-2x.png` });
await browser.close();

/* ============ Z: the world read back ============ */
section("Z: the world read back");
const rosterZ = await jobs();
must(rosterZ.length === 21, `Z1 roster identity (${rosterZ.length})`);
must(errors.length === 0, `Z2 console clean (${errors.length} errors)`);

console.log(`\n== RESULT ==\npass ${pass} / fail ${fail}`);
if (fail > 0) { console.error(fails.map((f) => `  - ${f}`).join("\n")); process.exit(1); }

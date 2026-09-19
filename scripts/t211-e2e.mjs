/* t211 e2e — the session report must not lie. The Map QC section's walk
 * (findMapBrief) probed only the 8 newest completed jobs — and the demo
 * pipeline's newest eight are exactly its map-less upper half (a refine3d
 * whose outputs carry only star tables, three postprocesses likewise, and
 * four never-volume upstream jobs), while a Refine3D four rows down owned
 * FOUR volumes. The report declared a world WITH maps to have none: a
 * lying instrument. Worse, the ordering one-liner answered -1 on EQUAL
 * updatedAt stamps, silently reversing same-instant jobs. The t211 walk:
 *   1. volume-capable types (refine3d/class3d/postprocess/multibody) ride
 *      the front of the queue, each tier newest-first;
 *   2. a real three-way comparator with an id tiebreak (deterministic
 *      under equal stamps);
 *   3. the probe budget lifted to 24 — the honest failure mode is
 *      "scanned them all, none speaks", never "never asked".
 * The probe deliberately does NOT bump the volume host's updatedAt (t197's
 * S4 note round-trip is exactly the mechanism that MASKED this bug for
 * nineteen windows: it made the seeded host the newest completed job, so
 * the old cap-8 walk landed on it). Instead S4 pins the bug scene: a
 * map-less volume-capable job stands NEWER than the four-volume host, so
 * the old walk would still lie today.
 *   S  setup — seeders (orthovol + both halves, idempotent, file-writes
 *      only — never the DB), then the bug scene is pinned
 *   W  wire — the NEW walk, spoken independently through the API
 *      (volume-capable-first tiers, recency, cap 24), feeds main+overlay
 *      profiles, the probe's own peak and pearson oracles
 *   X  source oracles — VOLUME_CAPABLE_RE / MAP_BRIEF_CAP=24 / the three-
 *      way comparator / the fake comparator gone / the tiered walk
 *   D  live — the session report's Map QC speaks the walk winner with the
 *      wire's numbers; the empty-state line is GONE in a world that has
 *      maps; pending never lingers; the glance equals the wire
 *   Z  read-only — roster identity, console clean
 * x3 runs required by house rules. */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { readFileSync } from "fs";
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "scripts/shots-t211";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const fails = [];
const must = (cond, label) => {
  if (cond) { pass++; console.log(`  ok: ${label}`); }
  else { fail++; fails.push(label); console.error(`  FAIL: ${label}`); }
};
const section = (t) => console.log(`\n== ${t} ==`);

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
/** the NEW walk, spoken independently: volume-capable tiers first, each
 *  tier newest-first (three-way, id tiebreak), budget 24, first job with
 *  a true volume wins. */
async function expectedWalkNew() {
  const done = (await jobs()).filter((j) => j.status === "completed");
  const rec = (a, b) =>
    a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : a.id < b.id ? -1 : 1;
  const queue = [
    ...done.filter((j) => VOLUME_CAPABLE.test(j.type)).sort(rec),
    ...done.filter((j) => !VOLUME_CAPABLE.test(j.type)).sort(rec),
  ].slice(0, 24);
  for (const j of queue) {
    const d = await outputs(j.id);
    const vols = (d.files ?? []).filter(isVolume);
    if (vols.length > 0) {
      const sorted = [...vols].sort(
        (a, b) => Number(MAIN_MAP_RE.test(b.name)) - Number(MAIN_MAP_RE.test(a.name)),
      );
      return { job: j, main: sorted[0], overlays: sorted.slice(1, 3) };
    }
  }
  return null;
}

/* ============ S: setup — the world AND the bug scene ============ */
section("S: the world, and the scene of the lie");
execSync("python3 scripts/qa67-seed-volume.py", { stdio: "pipe" });
execSync("python3 scripts/seed-refine-halves.py", { stdio: "pipe" });
const rosterS = await jobs();
const host = rosterS.find((j) => j.name === "QA Refine3D");
must(!!host, "S1 QA Refine3D in roster (the four-volume host)");
const outsS = await outputs(host.id);
must((outsS.files ?? []).some((f) => f.name === "orthovol.mrc"), "S2 orthovol.mrc (main) in outputs");
must(
  (outsS.files ?? []).some((f) => f.name === "run_it020_half1.mrc") &&
  (outsS.files ?? []).some((f) => f.name === "run_it020_half2.mrc"),
  "S3 BOTH half-maps in outputs (the comparison terrains)",
);
// the bug scene, MANUFACTURED (t212 amendment): the world's updatedAt
// stamps DRIFT — t197's own note round-trip bumps the host, gallery
// restores rewrite whole batches — so the probe does not ASSUME the old
// walk would lie here, it BUILDS the scene. The old walk probes the
// newest 8 completed; the scene needs the host at rank 9+. Jobs already
// ranked above the host stay; map-less jobs BELOW the host get a note
// round-trip (idempotent, the same PATCH t197 uses) — each bump promotes
// one candidate past the host. Bounded and honest: if the world is too
// small to manufacture the scene, the probe says so and relies on the
// X-series walk oracles (which pin the fix in source regardless of
// world shape).
const rec = (a, b) =>
  a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : a.id < b.id ? -1 : 1;
let ranked = [...(await jobs()).filter((j) => j.status === "completed")].sort(rec);
let hostRank = ranked.findIndex((j) => j.id === host.id);
let promoted = 0;
while (hostRank >= 0 && hostRank < 8 && promoted < 10) {
  let moved = false;
  for (const j of ranked.slice(hostRank + 1)) {
    const d = await outputs(j.id);
    if ((d.files ?? []).filter(isVolume).length === 0) {
      const pr = await fetch(`${BASE}/api/jobs/${j.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json", ...H },
        body: JSON.stringify({ note: j.note ?? "" }),
      });
      if (pr.ok) { moved = true; promoted++; break; }
    }
  }
  if (!moved) break; // no map-less candidate below — the scene cannot be manufactured
  ranked = [...(await jobs()).filter((j) => j.status === "completed")].sort(rec);
  hostRank = ranked.findIndex((j) => j.id === host.id);
}
if (hostRank >= 8) {
  must(true, `S5 the bug scene is LIVE — the old walk (newest-8) would miss the host (rank ${hostRank + 1}, ${promoted} promotion${promoted === 1 ? "" : "s"})`);
} else {
  console.log(`  skip: S5 — world cannot manufacture the scene (host rank ${hostRank + 1}); the X-series walk oracles still pin the fix`);
}

/* ============ W: the wire feeds the oracles ============ */
section("W: the NEW walk, spoken independently");
const walk = await expectedWalkNew();
must(walk && walk.job.id === host.id, `W1 the new walk's winner is the four-volume host (${walk ? walk.job.name : "none"})`);
must(walk && walk.overlays.length === 2, `W2 the winner speaks ${walk ? walk.overlays.length : 0} comparison terrains (main + both halves)`);
const prof = async (p) =>
  (await (await fetch(`${BASE}/api/jobs/${host.id}/map-profile?path=${encodeURIComponent(p)}&axis=z`, { headers: H })).json());
const mainW = walk ? await prof(walk.main.path) : null;
const ovW = [];
if (walk) for (const o of walk.overlays) ovW.push(await prof(o.path));
must(!!mainW?.bins?.length && ovW.every((b) => b?.bins?.length > 0), `W3 profiles on the wire (main ${mainW?.bins?.length}, overlays ${ovW.map((b) => b.bins.length).join("/")})`);
const peakIdx = mainW.bins.reduce((bi, v, i, arr) => (v > arr[bi] ? i : bi), 0);
const peakPct = `${((peakIdx / Math.max(1, mainW.bins.length - 1)) * 100).toFixed(1)}%`;
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
const rMain = pearson(resample(ovW[0].bins, mainW.bins.length), mainW.bins);
const rHalfPair = pearson(
  resample(ovW[0].bins, Math.max(ovW[0].bins.length, ovW[1].bins.length)),
  resample(ovW[1].bins, Math.max(ovW[0].bins.length, ovW[1].bins.length)),
);
const rStr = (r) => (Number.isNaN(r) ? "—" : r.toFixed(2));

/* ============ X: source oracles ============ */
section("X: the walk, rebuilt in source");
must(DLG.includes("VOLUME_CAPABLE_RE = /refine3d|class3d|postprocess|multibody/i"), "X1 the volume-capable prior exists (plausible owners ride the front)");
must(DLG.includes("const MAP_BRIEF_CAP = 24;"), "X2 the probe budget is 24 — the honest failure mode is 'scanned them all', never 'never asked'");
must(!DLG.includes('.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))'), "X3 the fake comparator is gone — a one-liner that answers -1 on EQUAL stamps is a lie");
must(DLG.includes("a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : a.id < b.id ? -1 : 1"), "X4 the three-way comparator with the id tiebreak lives in the walk");
must((DLG.match(/VOLUME_CAPABLE_RE\.test\(j\.type\)/g) ?? []).length === 2, "X5 the tiered walk: the prior is consulted exactly twice (capable front, never-volume tail)");
must(DLG.includes("jobIds.slice(0, MAP_BRIEF_CAP)") && !DLG.includes("jobIds.slice(0, 8)"), "X6 the probe loop eats the named budget, not a bare 8");

/* ============ D: live wire through the UI ============ */
section("D: the report tells the truth");
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

// wait for the measurement to settle, then read the bytes from the
// ALWAYS-ATTACHED carrier
const carrier = page.locator('[data-report-doc][data-md]');
let md = null;
for (let i = 0; i < 60 && !md; i++) {
  const v = await carrier.getAttribute("data-md").catch(() => null);
  if (v && v.includes("Map QC summary")) md = v;
  else await sleep(500);
}
must(!!md, "D3 the map section settles on the carrier (still-measuring never lingers)");
must(md && !md.includes("None of this session's jobs has 3D maps"), "D4 THE LIE IS GONE — a world with four volumes is not told it has none");
must(md && !md.includes("Still measuring"), "D5 no pending line lingers — the section speaks the measurement");
must(md && md.includes(`Job \`${host.id}\``), "D6 the map section speaks the walk winner's job id");
must(md && md.includes("Map QC summary — orthovol"), "D7 the main map is named (the walk winner's label — orthovol leads)");
must(md && md.includes(`**${peakPct}** of depth`), `D8 the peak equals the wire's argmax (${peakPct})`);
must(md && md.includes(`| ${rStr(rMain)} |`) && md.includes(`| ${rStr(rHalfPair)} |`), `D9 the agreement numbers equal the probe's pearson (vs-main ${rStr(rMain)}, pair ${rStr(rHalfPair)})`);
must(md && md.includes("### Pairwise agreement"), "D10 two terrains ⇒ the pairwise section exists");
{
  const wire = await jobs();
  const completed = wire.filter((j) => j.status === "completed").length;
  must(md && md.includes(`${wire.length} job`) && md.includes(`${completed} succeeded`), `D11 the glance equals the wire (${wire.length} jobs, ${completed} completed)`);
}
await page.screenshot({ path: `${OUT}/t211-session-truth-2x.png` });
await browser.close();

/* ============ Z: the world read back ============ */
section("Z: the world read back");
const rosterZ = await jobs();
must(rosterZ.length === 23, `Z1 roster identity (${rosterZ.length})`);
must(errors.length === 0, `Z2 console clean (${errors.length} errors)`);

console.log(`\n== RESULT ==\npass ${pass} / fail ${fail}`);
if (fail > 0) { console.error(fails.map((f) => `  - ${f}`).join("\n")); process.exit(1); }

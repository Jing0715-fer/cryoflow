/* t197 e2e — the report families meet: the session QC report. Two human
 * report builders lived inside their instruments (t194 sweep, t195/t196
 * map QC); t197 binds them under one cover and takes the map QC to the
 * job level WITHOUT the viewer (the same map-profile API, the same math,
 * now walking the session's own maps).
 *   S  setup — seeder (orthovol + BOTH halves), note-touch makes QA
 *      Refine3D the deterministic walk winner, wire derives the walk
 *      expectation independently (same rule, spoken through the API)
 *   W  wire — main + overlay profiles feed the probe's own pearson and
 *      peak oracles
 *   X  source oracles — ONE home for the families (@/lib/qc-report):
 *      hpc + molstar import, no local twins; the binding father never
 *      parses family bytes; NO timestamps in the report bodies (the
 *      filename carries the stamp); store slice written by compare();
 *      the dialog's carrier cohabits data-report-doc + data-md; the
 *      print-exception contract lives in globals.css
 *   D  live — header door opens the page; pipeline glance equals the
 *      wire's counts; the map section speaks the walk winner with the
 *      wire's peak and r; the sweep annex starts honest-empty, then a
 *      real compare binds the annex VERBATIM (winner bolded, name from
 *      the profiles wire); copy speaks both worlds; the print contract
 *      (body[data-report-print]) shows only the document under print
 *      media emulation; close removes the flag
 *   Z  read-only — roster identity, console clean
 * x3 runs required by house rules. */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { readFileSync } from "fs";
import { execSync } from "node:child_process";

const BASE = process.env.BASE ?? "http://localhost:3000";
const RUN = Number(process.env.RUN ?? "1");
const OUT = "scripts/shots-t197";
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
const HPC = readFileSync("src/components/workflow/hpc-queue-sim.tsx", "utf8");
const MOL = readFileSync("src/components/workflow/results/molstar-embed.tsx", "utf8");
const STORE = readFileSync("src/lib/store.ts", "utf8");
const DLG = readFileSync("src/components/workflow/session-report-dialog.tsx", "utf8");
const CSS = readFileSync("src/app/globals.css", "utf8");
const HDR = readFileSync("src/components/workflow/header.tsx", "utf8");
const roster0 = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
const H = { "sec-fetch-site": "same-origin" };

/** the walk the dialog performs, spoken independently through the API:
 *  completed jobs, volume-capable types first (each tier recency-ordered,
 *  three-way with an id tiebreak), budget 24 — the t212 sync of the
 *  t211 walk (the old newest-8 replica drifted from the product's walk
 *  after t211 rebuilt it; the two probes now speak the SAME walk). */
async function expectedWalk() {
  const d = (await (await fetch(BASE + "/api/jobs", { headers: H })).json());
  const jobs = d.jobs ?? [];
  const VC = /refine3d|class3d|postprocess|multibody/i;
  const rec = (a, b) =>
    a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : a.id < b.id ? -1 : 1;
  const done = jobs.filter((j) => j.status === "completed");
  const queue = [
    ...done.filter((j) => VC.test(j.type)).sort(rec),
    ...done.filter((j) => !VC.test(j.type)).sort(rec),
  ].slice(0, 24);
  for (const j of queue) {
    const dd = await (await fetch(`${BASE}/api/jobs/${j.id}/outputs`, { headers: H })).json();
    const vols = (dd.files ?? []).filter((f) => f.kind === "mrc" && Array.isArray(f.dims) && f.dims.length === 3);
    if (vols.length > 0) {
      const sorted = [...vols].sort((a, b) => Number(/half0|postprocess\.mrc$/i.test(b.name)) - Number(/half0|postprocess\.mrc$/i.test(a.name)));
      return { job: j, main: sorted[0], overlays: sorted.slice(1, 3) };
    }
  }
  return null;
}

/* ============ S: setup ============ */
section("S: the world");
execSync('QA_VOL_HOST="QA Refine3D" python3 scripts/qa67-seed-volume.py', { stdio: "pipe" });
const jobsS = (await (await fetch(BASE + "/api/jobs", { headers: H })).json()).jobs ?? [];
const host = jobsS.find((j) => j.name === "QA Refine3D");
must(!!host, "S1 QA Refine3D in roster (seeder idempotent)");
const outsS = JSON.stringify(await (await fetch(`${BASE}/api/jobs/${host.id}/outputs`, { headers: H })).json());
must(outsS.includes("orthovol.mrc"), "S2 orthovol.mrc (main) in outputs");
must(outsS.includes("run_it020_half1.mrc") && outsS.includes("run_it020_half2.mrc"), "S3 BOTH half-maps in outputs (the gold-standard pair)");
// the deterministic walk winner: a semantically idempotent note round-trip
// bumps updatedAt (Prisma @updatedAt on update) — Refine3D becomes the
// newest completed job, so the dialog's walk lands on the seeded pair.
const patchRes = await fetch(`${BASE}/api/jobs/${host.id}`, {
  method: "PATCH", headers: { "Content-Type": "application/json", ...H },
  body: JSON.stringify({ note: host.note ?? "" }),
});
must(patchRes.ok, "S4 note round-trip bumps updatedAt (the walk's tiebreaker)");

/* ============ W: the wire feeds the oracles ============ */
section("W: the walk, spoken independently");
const walk = await expectedWalk();
must(walk && walk.job.id === host.id, `W1 the walk's winner is the seeded host (${walk ? walk.job.name : "none"})`);
must(walk && walk.overlays.length === 2, `W2 the winner speaks ${walk ? walk.overlays.length : 0} comparison terrains (main + both halves)`);
const prof = async (p) => (await (await fetch(`${BASE}/api/jobs/${host.id}/map-profile?path=${encodeURIComponent(p)}&axis=z`, { headers: H })).json());
const mainW = await prof(walk.main.path);
const ovW = [];
for (const o of walk.overlays) ovW.push(await prof(o.path));
must(mainW?.bins?.length > 0 && ovW.every((b) => b?.bins?.length > 0), `W3 profiles on the wire (main ${mainW?.bins?.length}, overlays ${ovW.map((b) => b.bins.length).join("/")})`);
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
section("X: one home for the families");
must(LIB.includes("export const buildSessionReport") && LIB.includes("export const buildSweepReport") && LIB.includes("export const buildProfileReport"), "X1 the lib is the ONE home: binding father + both family builders (moved verbatim)");
must(!/const buildSweepReport/.test(HPC) && HPC.includes('from "@/lib/qc-report"'), "X2 hpc imports the family builder — no local twin survives");
must(!/const buildProfileReport/.test(MOL) && MOL.includes('} from "@/lib/qc-report"'), "X3 molstar imports the family builder — no local twin survives");
must(LIB.includes("export const sessionReportFilename") && !LIB.includes("Generated ${new Date()"), "X4 no timestamps inside the report bodies — the filename carries the stamp (the t195 doctrine, now enforced on the sweep too)");
{
  const sweepBody = LIB.slice(LIB.indexOf("export const buildSweepReport"), LIB.indexOf("export const sweepReportFilename"));
  const sessionBody = LIB.slice(LIB.indexOf("export const buildSessionReport"), LIB.indexOf("export const sessionReportFilename"));
  const profileBody = LIB.slice(LIB.indexOf("export const buildProfileReport"), LIB.indexOf("export const profileReportFilename"));
  must(!sweepBody.includes("new Date") && !sessionBody.includes("new Date") && !profileBody.includes("new Date"), "X5 none of the three builders calls new Date — same state, same bytes");
}
must(LIB.includes("lines.push(mapQc.report.trimEnd())") && LIB.includes("lines.push(sweep.trimEnd())"), "X6 the binding father embeds family bytes VERBATIM (it binds, it never re-translates)");
must(HPC.includes("setLastSweep({ rows, bestId })") && STORE.includes("lastSweep: SessionSweepState | null") && STORE.includes("setLastSweep: (s) => set({ lastSweep: s })"), "X7 the store owns the session's last race — compare() writes it, wholesale");
must(DLG.includes('data-report-doc') && /data-md=\{md\}/.test(DLG), "X8 the carrier cohabits with the print-doc marker on the always-attached dialog content");
must(DLG.includes('aria-label="Copy session report"') && DLG.includes('aria-label="Download session report"') && DLG.includes('aria-label="Print session report"'), "X9 three doors, each with its own name (copy / download / print)");
must(DLG.includes("(clipboard unavailable)") && DLG.includes("downloadText(sessionReportFilename(), md"), "X10 the copy door speaks both worlds — denial falls back to download and the receipt says so");
must(DLG.includes("document.body.setAttribute(\"data-report-print\", \"\")") && DLG.includes("document.body.removeAttribute(\"data-report-print\")"), "X11 the dialog owns the print flag — set while open, cleaned on close/unmount");
must(CSS.includes("body[data-report-print] > *:not(:has([data-report-doc]))") && CSS.includes('[data-slot="dialog-content"][data-report-doc]'), "X12 the print exception lives in the stylesheet — everything without the document hides, the document un-dialogs");
must(HDR.includes('aria-label="Session QC report"') && HDR.includes('nextDynamic(() => import("./session-report-dialog")'), "X13 the header door is real and the dialog is code-split (the shell never pays for the renderer)");
must(DLG.includes("remarkGfm") && DLG.includes("ReactMarkdown"), "X14 the document renders — react-markdown + remark-gfm (tables are the families' native grammar)");

/* ============ D: live wire through the UI ============ */
section("D: the families meet on the wall");
const browser = await chromium.launch();
const errors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
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

// the honest pre-map state is possible to catch (pending) — wait for the
// measurement to settle, then read the bytes from the ALWAYS-ATTACHED carrier
const carrier = page.locator('[data-report-doc][data-md]');
let md = null;
for (let i = 0; i < 40 && !md; i++) {
  const v = await carrier.getAttribute("data-md").catch(() => null);
  if (v && v.includes("Map QC summary")) md = v;
  else await sleep(500);
}
must(!!md, "D3 the map section settles on the carrier (still-measuring never lingers)");
must(md.startsWith("# CryoFlow session QC report"), "D4 the document opens with the session cover (H1)");
must(md.includes(`Project **`) && md.includes("## Pipeline at a glance"), "D5 the pipeline glance section speaks");
{
  const d = (await (await fetch(BASE + "/api/jobs", { headers: H })).json());
  const jobs = d.jobs ?? [];
  const completed = jobs.filter((j) => j.status === "completed").length;
  const running = jobs.filter((j) => j.status === "running").length;
  const failed = jobs.filter((j) => j.status === "failed").length;
  must(md.includes(`${jobs.length} job`) && md.includes(`${completed} succeeded`), `D6 the glance equals the wire (${jobs.length} jobs, ${completed} completed)`);
}
must(md.includes(`Job \`${host.id}\``), "D7 the map section speaks the walk winner's job id");
must(md.includes(`**${peakPct}** of depth`), `D8 the peak equals the wire's argmax (${peakPct})`);
must(md.includes(`| ${rStr(rMain)} |`) && md.includes(`| ${rStr(rHalfPair)} |`), `D9 the agreement numbers equal the probe's pearson (vs-main ${rStr(rMain)}, pair ${rStr(rHalfPair)})`);
must(md.includes("### Pairwise agreement"), "D10 two terrains ⇒ the pairwise section exists");
// t214's lesson on this line: the inventory's teaching clause now says
// "— means still measuring, never a guess" — a PERMANENT doctrine
// sentence, not a state line. The loose substring "still measuring"
// used to be a state marker; the state lines themselves are what D11
// forbids, so they are pinned verbatim (map-pending, overlay-pending,
// empty state).
must(!md.includes("Still measuring this session's maps") && !md.includes("still measuring — its landscape has not arrived") && !md.includes("None of this session's jobs has 3D maps"), "D11 no state line, no empty-state line — the section speaks the measurement (the t214 doctrine clause is prose, not state; the three STATE lines are pinned verbatim)");
must(md.includes("No sweep raced this session"), "D12 the sweep annex starts honest-empty (no race yet)");

must((await page.locator("body").getAttribute("data-report-print")) === "", "D13 the print flag rides the body while the dialog is open");
// print media emulation: the exception hides everything but the document
await page.emulateMedia({ media: "print" });
await sleep(300);
// computed display LIES about painting (an element inside a display:none
// ancestor still reports its own display) — getClientRects() is the
// painted-or-not oracle: zero rects means zero ink.
const paints = (sel) => page.locator(sel).first().evaluate((el) => el.getClientRects().length > 0).catch(() => false);
const hdrPaints = await paints("header.no-print");
const mastPaints = await paints("header[data-print-doc]");
const docPaints = await paints("[data-report-doc]");
const ovlPaints = await paints('[data-slot="dialog-overlay"]');
must(!hdrPaints, "D14 under print media the app chrome paints no ink (header)");
must(!mastPaints, "D14b the paper masthead paints no ink either — ONLY the report prints");
must(docPaints, "D15 under print media the document is the ink (painted)");
// the Tailwind v4 trap: -translate-x-1/2 emits the NATIVE translate:
// property — a static dialog box still shifted -50% printed half off the
// page (the PDF portrait caught it mid-word). The print reset must cover
// the individual transform properties; assert the box starts on-page.
const docX = await dlg.evaluate((el) => Math.round(el.getBoundingClientRect().x));
must(docX >= 0, `D15b the document box starts on-page under print media (x=${docX})`);
must(!ovlPaints, "D16 the overlay steps aside (no ink)");
await page.emulateMedia({ media: null });
await sleep(300);

// the copy door — both worlds are honest (clipboard granted OR denied)
await page.locator('button[aria-label="Copy session report"]').click();
await sleep(700);
const note = await page.locator('[data-report-doors] ~ p[role="status"], p[role="status"]').first().textContent().catch(() => "");
must(!!note && (note.includes("Copied the session QC report") || note.includes("(clipboard unavailable)")), `D17 the receipt speaks its world ("${(note ?? "").slice(0, 52)}…")`);

// close: the flag must leave the body (no other printout inherits it)
await page.keyboard.press("Escape");
await sleep(500);
must((await page.locator("body").getAttribute("data-report-print")) === null, "D18 close removes the print flag (the exception is scoped, not sticky)");

// drive a REAL race (t194's recipe) and reopen — the annex binds verbatim.
// t203 sync (the flake's second sighting, same line): the report dialog's
// EXIT ANIMATION can eat the job-tile click, leaving nothing selected and
// the sbatch button unborn — drain the dialog stack, then poll for the
// button instead of betting on a fixed sleep
for (let k = 0; k < 3; k++) {
  if (!(await page.locator('[data-slot="dialog-overlay"][data-state="open"]').first().isVisible().catch(() => false))) break;
  await page.keyboard.press("Escape");
  await sleep(800);
}
const idleJob = jobsS.filter((j) => j.status === "idle").sort((a, b) => (a.x ?? 0) - (b.x ?? 0))[0];
await page.locator(`[data-job="${idleJob.id}"]`).first().click({ timeout: 5000, force: true }).catch(() => {});
await sleep(1300);
let sbatchUp = false;
for (let k = 0; k < 10 && !sbatchUp; k++) {
  if ((await page.locator('button[aria-label="Generate Slurm sbatch script for this job"]').count()) > 0) { sbatchUp = true; break; }
  // the tile click may have been swallowed — retry the selection
  await page.locator(`[data-job="${idleJob.id}"]`).first().click({ timeout: 5000, force: true }).catch(() => {});
  await sleep(1200);
}
await page.locator('button[aria-label="Generate Slurm sbatch script for this job"]').click();
await sleep(1400);
await page.locator('button[aria-label="Run queue simulation"]').click();
await sleep(1500);
await page.locator('button[aria-label="Compare cluster profiles"]').click();
await sleep(3500);
// compare() leaves the queue-sim dialog OPEN — its overlay would eat the
// header door's click (the t196 lesson mirrored: look at what is open
// before reaching for a door). One Escape closes the sim dialog.
await page.keyboard.press("Escape");
await sleep(700);

await page.locator('button[aria-label="Session QC report"]').click();
await sleep(800);
let md2 = null;
for (let i = 0; i < 30; i++) {
  const v = await carrier.getAttribute("data-md").catch(() => null);
  if (v && v.includes("HPC sweep")) { md2 = v; break; }
  await sleep(500);
}
must(!!md2, "D19 after a real race the annex binds (the stale empty-state is gone)");
must(md2 && !md2.includes("No sweep raced this session"), "D20 the empty state retires when the race arrives");
const profiles = (await (await fetch(BASE + "/api/hpc/profiles", { headers: H })).json()).profiles ?? [];
const winner = md2?.match(/\*\*(.+?)\*\* wins with a/)?.[1];
must(!!winner && profiles.some((p) => p.name === winner), `D21 the bolded winner is a real profile name ("${winner}")`);
must(md2 && /\d+% faster than the slowest contestant/.test(md2), "D22 the margin sentence survives the binding verbatim");
// the failure doctrine's POSITIVE form: nobody was silently dropped —
// every profile on the wire appears in the annex (the "kept visible"
// line itself only speaks when someone failed)
{
  // contestants = the profiles compare() actually races (gpusPerNode >= 1 —
  // the same filter; a CPU-only profile never entered, so its absence from
  // the annex is honesty, not a drop)
  const profs = ((await (await fetch(BASE + "/api/hpc/profiles", { headers: H })).json()).profiles ?? []).filter((p) => p.gpusPerNode >= 1);
  must(profs.length > 0 && profs.every((p) => md2.includes(p.name)), `D23 no contestant dropped from the annex (${profs.length} racers all present)`);
}

// the map section survives the sweep's arrival (independent families, one cover)
must(md2 && md2.includes(`Job \`${host.id}\``) && md2.includes("### Pairwise agreement"), "D24 the map section still speaks after the annex arrives (one document, independent families)");

await browser.close();

/* ============ Z: read-only ============ */
section("Z: the world unmarked");
const roster1 = (await (await fetch(BASE + "/api/jobs")).json()).jobs ?? [];
must(roster1.length === roster0.length, `Z1 roster size unchanged (${roster1.length})`);
must(roster1.every((j, i) => roster0.some((k) => k.id === j.id)), "Z2 roster identity — nothing stayed behind");
must(errors.length === 0, `Z3 console clean (${errors.length} errors)${errors.length ? " — " + errors[0].slice(0, 120) : ""}`);

console.log(`\nT197 RUN ${RUN}: ${pass} pass, ${fail} fail`);
if (fail > 0) { console.log(fails.map((f) => "  - " + f).join("\n")); process.exit(1); }

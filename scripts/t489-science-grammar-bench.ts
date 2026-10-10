/**
 * t489 — the science trio joins the well: interpretFsc /
 * interpretGuinier / interpretAngDist move the SCIENCE side's judgment
 * (Nyquist cap + reported disagreement, sharpened + fit range,
 * concentration verdict + hottest three bins) into chart-data.ts —
 * the ONE well — completing the set: all six curve wells now carry a
 * judgment layer. The loaders attach it, the thin routes pass it
 * through untouched, the agent's get_job_curves angdist face quotes it
 * (zero behavior change — t486's bench holds the tool faces fixed),
 * and the three science panels read it instead of re-judging.
 *
 *   T1  one well    — the builders are exported, the loaders wire them,
 *                     the empty faces carry null
 *   T2  the math    — byte-identical judgment faces on synthetic rows
 *   T3  tool drinks — the angdist face reads the interpretation, the
 *                     inline twin (>6 threshold, hottest sort) is gone
 *   T4  panels      — the science panels read the well, no face re-judges
 *   T5  passthrough — response faces + thin routes carry the field
 *   T6  live well   — fixture jobs reconcile: the strip's numbers ARE
 *                     the tool's numbers (verdict/concentration/top3/
 *                     Nyquist/range)
 */

import { readFileSync } from "fs";

/* t503 — the checkout moves between sandbox resets (my-project era ->
 * cryoflow home); resolve the repo root from THIS file, not a
 * hardcoded absolute path that rots the bench the moment the tree moves. */
const REPO = (await import("node:path")).default.resolve(
  (await import("node:url")).fileURLToPath(new URL(".", import.meta.url)),
  "..",
);
process.env.DATABASE_URL = `file:${REPO}/db/cryoflow.db`;
process.env.CRYOFLOW_DATA_DIR = `${REPO}/data`;

let pass = 0;
let fail = 0;
function ok(cond: unknown, label: string): void {
  if (cond) {
    pass++;
    console.log(`  PASS ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}`);
  }
}
function section(t: string): void {
  console.log(`\n== ${t}`);
}

// dynamic imports AFTER the env pins (t484's lesson)
const {
  interpretFsc,
  interpretGuinier,
  interpretAngDist,
  loadFsc,
  loadGuinier,
  loadAngDist,
} = await import("../src/lib/chart-data");
const { db } = await import("../src/lib/db");
const chartDataSrc = readFileSync(`${REPO}/src/lib/chart-data.ts`, "utf8");
const chartRowsSrc = readFileSync(`${REPO}/src/lib/chart-rows.ts`, "utf8");
const toolsSrc = readFileSync(`${REPO}/src/lib/ai/tools.ts`, "utf8");
const fscPanelSrc = readFileSync(
  `${REPO}/src/components/workflow/results/fsc-chart.tsx`,
  "utf8"
);
const guinierPanelSrc = readFileSync(
  `${REPO}/src/components/workflow/results/guinier-chart.tsx`,
  "utf8"
);
const angDistPanelSrc = readFileSync(
  `${REPO}/src/components/workflow/results/angular-distribution-chart.tsx`,
  "utf8"
);

/* ---------------- T1 one well ---------------- */
section("T1 — the science builders are exported and the loaders wire them");
ok(
  typeof interpretFsc === "function" &&
    typeof interpretGuinier === "function" &&
    typeof interpretAngDist === "function",
  "interpretFsc / interpretGuinier / interpretAngDist are exported from the well"
);
ok(
  chartDataSrc.includes("interpretation: interpretFsc(") &&
    chartDataSrc.includes("interpretation: interpretGuinier(") &&
    chartDataSrc.includes("interpretation: interpretAngDist("),
  "all three science loaders attach their interpretation"
);
ok(
  (chartDataSrc.match(/interpretation: null/g) ?? []).length === 7,
  "empty faces carry interpretation: null — t488's four (ctf ×2, motion, topaz) + the science trio's three"
);
ok(
  chartRowsSrc.includes("export interface FscInterpretation") &&
    chartRowsSrc.includes("export interface GuinierInterpretation") &&
    chartRowsSrc.includes("export interface AngDistInterpretation"),
  "the three judgment shapes live in chart-rows (the shared response face)"
);
ok(
  (chartRowsSrc.match(/interpretation\?:/g) ?? []).length === 6,
  "all SIX curve responses carry the optional interpretation field"
);
ok(
  chartDataSrc.includes("interface AngDistData extends AngDistResponse"),
  "AngDistData aligns with the shared response face (the t486 CtfData pattern)"
);

/* ---------------- T2 the math ---------------- */
section("T2 — byte-identical judgment faces on synthetic rows");

// angdist: a small grid with a known hottest order + a stable-sort tie
{
  const cells = [
    0, 5, 0, // rot 0: tilt 1 has 5
    10, 0, 0, // rot 1: tilt 0 has 10
    0, 0, 1, // rot 2: tilt 2 has 1
    2, 0, 2, // rot 3: tilt 0 has 2, tilt 2 has 2 (tie, index order wins)
  ];
  const d = interpretAngDist(7.25, cells, 3);
  ok(
    d?.verdict === "anisotropic" && d.concentration === 7.3,
    "angdist: verdict + 1-dp concentration (>6 ⇒ anisotropic, 7.25 → 7.3)"
  );
  ok(
    d?.hottestBins.length === 3 &&
      d.hottestBins[0].rotBin === 1 &&
      d.hottestBins[0].tiltBin === 0 &&
      d.hottestBins[0].count === 10 &&
      d.hottestBins[1].rotBin === 0 &&
      d.hottestBins[1].tiltBin === 1 &&
      d.hottestBins[1].count === 5 &&
      d.hottestBins[2].rotBin === 3 &&
      d.hottestBins[2].tiltBin === 0 &&
      d.hottestBins[2].count === 2,
    "angdist: hottest three descend by count, empty bins excluded, rot/tilt split matches the tool's grammar"
  );
  ok(
    interpretAngDist(6, cells, 3)?.verdict === "fairly even" &&
      interpretAngDist(6.04, cells, 3)?.verdict === "anisotropic",
    "angdist: the >6 threshold is the ONE verdict (6 fairly even, 6.04 anisotropic)"
  );
  ok(interpretAngDist(7, [], 12) === null, "angdist: no cells → null");
}

// fsc: Nyquist window (2%) + reported disagreement (0.5 Å)
{
  const shells = [
    { freq: 0.001, res: 999, fsc: 0.9 }, // sentinel row — fscShells drops it
    { freq: 0.01, res: 100, fsc: 0.9 },
    { freq: 0.05, res: 20, fsc: 0.5 },
    { freq: 0.1, res: 10, fsc: 0.1 },
  ];
  ok(
    interpretFsc(shells, 10.5, 10.1)?.atNyquist === true,
    "fsc: reported within 2% of the highest-frequency shell (10.1 vs 10) ⇒ atNyquist — sentinel rows never fool it"
  );
  ok(
    interpretFsc(shells, 10.5, 12)?.atNyquist === false &&
      interpretFsc(shells, 10.5, null)?.atNyquist === false,
    "fsc: a reported off the Nyquist end (or absent) is not atNyquist"
  );
  ok(
    interpretFsc(shells, 10.5, 12)?.reportedDiffers === true &&
      interpretFsc(shells, 10.5, 10.8)?.reportedDiffers === false,
    "fsc: >0.5 Å from the raw crossing ⇒ reportedDiffers, within ⇒ not"
  );
  ok(
    interpretFsc(shells, null, 12)?.reportedDiffers === true,
    "fsc: a reported with NO raw crossing counts as differing (the smoothed estimate stands alone)"
  );
  ok(
    interpretFsc([], null, null) === null,
    "fsc: no shells → null (the empty face)"
  );
}

// guinier: sharpened presence + the fit range in ångström (1 dp)
{
  const points = [
    { x: 0.01, lnAmp: 1.0, lnAmpSharpened: null },
    { x: 0.04, lnAmp: 0.5, lnAmpSharpened: 2.0 },
    { x: 0.02, lnAmp: null, lnAmpSharpened: null }, // dropped — no usable lnAmp
    { x: -1, lnAmp: 0.9, lnAmpSharpened: null }, // dropped — x ≤ 0
  ];
  const d = interpretGuinier(points);
  ok(
    d?.hasSharpened === true,
    "guinier: the sharpened curve exists (one point carries lnAmpSharpened)"
  );
  ok(
    d?.rangeAngstrom !== null &&
      d?.rangeAngstrom.from === 5 &&
      d?.rangeAngstrom.to === 10,
    "guinier: fit range 5.0 – 10.0 Å (x 0.04 → 5 Å, x 0.01 → 10 Å; dropped rows never shrink the range)"
  );
  ok(
    interpretGuinier([
      { x: 0.0104, lnAmp: 1, lnAmpSharpened: null },
      { x: 0.0201, lnAmp: 0.5, lnAmpSharpened: null },
    ])?.rangeAngstrom?.from === 7.1 &&
      interpretGuinier([
        { x: 0.0104, lnAmp: 1, lnAmpSharpened: null },
        { x: 0.0201, lnAmp: 0.5, lnAmpSharpened: null },
      ])?.rangeAngstrom?.to === 9.8,
    "guinier: the range rounds to 1 dp (x 0.0201 → 7.1 Å high-res end, x 0.0104 → 9.8 Å low-res end), the tooltip's own conversion"
  );
  ok(
    interpretGuinier([
      { x: 0.01, lnAmp: 1, lnAmpSharpened: null },
      { x: 0.04, lnAmp: 0.5, lnAmpSharpened: null },
    ])?.hasSharpened === false,
    "guinier: no sharpened column ⇒ hasSharpened false"
  );
  ok(interpretGuinier([]) === null, "guinier: no points → null");
}

/* ---------------- T3 the tool drinks the well ---------------- */
section("T3 — the angdist face quotes the well, the inline twin is gone");
ok(
  toolsSrc.includes("interp?.verdict") &&
    toolsSrc.includes("interp?.concentration") &&
    toolsSrc.includes("interp?.hottestBins"),
  "the tool reads the interpretation for angdist (verdict + concentration + hottest three)"
);
ok(
  !toolsSrc.includes("d.anisotropy > 6") &&
    !toolsSrc.includes("rotBin: Math.floor(c.idx / d.tiltBins)"),
  "the inline >6 verdict and hottest sort are GONE from the tool (one well, no twins)"
);
ok(
  chartDataSrc.includes('> 6 ? "anisotropic" : "fairly even"') &&
    !toolsSrc.includes('"anisotropic"'),
  "the verdict words live ONLY in the well (the tool quotes, never re-speaks)"
);

/* ---------------- T4 the panels ---------------- */
section("T4 — the science panels read the well, no face re-judges");
ok(
  angDistPanelSrc.includes("ChartInterpretation") &&
    angDistPanelSrc.includes('interp?.verdict === "anisotropic"') &&
    angDistPanelSrc.includes("Hottest bins"),
  "the angdist panel renders the shared strip and reads the well's verdict"
);
ok(
  !angDistPanelSrc.includes("data.anisotropy > 6") &&
    !angDistPanelSrc.includes("anisotropy.toFixed"),
  "the angdist panel no longer re-judges (threshold + formatting live in the well)"
);
ok(
  fscPanelSrc.includes("data.interpretation?.atNyquist") &&
    fscPanelSrc.includes("data.interpretation?.reportedDiffers"),
  "the fsc badges read the well's Nyquist/disagreement judgment"
);
ok(
  !fscPanelSrc.includes("Math.abs(shells[0].res - reported)"),
  "the fsc panel no longer re-computes the Nyquist window"
);
ok(
  guinierPanelSrc.includes("ChartInterpretation") &&
    guinierPanelSrc.includes("interp?.hasSharpened") &&
    guinierPanelSrc.includes("Fit range"),
  "the guinier panel reads hasSharpened from the well and speaks the fit range"
);

/* ---------------- T5 passthrough ---------------- */
section("T5 — the thin routes pass the judgment through untouched");
for (const kind of ["fsc", "guinier", "angdist"] as const) {
  const routeSrc = readFileSync(
    `${REPO}/src/app/api/jobs/[id]/${kind}/route.ts`,
    "utf8"
  );
  ok(
    routeSrc.includes(`NextResponse.json(await load${kind === "angdist" ? "AngDist" : kind === "fsc" ? "Fsc" : "Guinier"}(id))`),
    `${kind} route: still a thin guard+json shell (the judgment rides the loader result)`
  );
}

/* ---------------- T6 the live well ---------------- */
section("T6 — fixture jobs: the strip's numbers ARE the tool's numbers");
const project = "cmukrk2yy0000rjobryvy0pzu";
const ppJob = await db.job.findFirst({
  where: { type: "postprocess", projectId: project },
});
const class3dJob = await db.job.findFirst({
  where: { type: "class3d", projectId: project },
});
const mcFixture = await db.job.findFirst({
  where: { type: "motioncorr", projectId: project },
});

if (ppJob) {
  const f = await loadFsc(ppJob.id);
  const rows = f.shells
    .filter((s) => Number.isFinite(s.fsc) && Number.isFinite(s.res) && s.res < 900 && s.res > 0)
    .sort((a, b) => a.res - b.res);
  const expectedDiffers =
    f.reportedResolution != null &&
    (f.resolutionAt143 == null ||
      Math.abs(f.reportedResolution - f.resolutionAt143) > 0.5);
  ok(
    f.shells.length > 0 &&
      f.interpretation != null &&
      f.interpretation.reportedDiffers === expectedDiffers,
    `fsc (${ppJob.name}): the well's disagreement judgment reconciles (reported ${f.reportedResolution?.toFixed(2) ?? "?"} Å)`
  );
  const expectedNyquist =
    f.reportedResolution != null &&
    rows.length > 0 &&
    Math.abs(rows[0].res - f.reportedResolution) / f.reportedResolution < 0.02;
  ok(
    f.interpretation?.atNyquist === expectedNyquist,
    `fsc: the Nyquist cap judgment reconciles with the drawn rows (rows[0] = ${rows[0]?.res.toFixed(1)} Å)`
  );

  const g = await loadGuinier(ppJob.id);
  ok(
    g.points.length > 0 &&
      g.interpretation != null &&
      g.interpretation.hasSharpened ===
        g.points.some((p) => p.lnAmpSharpened != null),
    `guinier (${ppJob.name}): ${g.points.length} pts, sharpened judgment reconciles`
  );
  const xs = g.points.filter((p) => p.x > 0).map((p) => p.x);
  const expectFrom = Math.round(Math.sqrt(1 / Math.max(...xs)) * 10) / 10;
  const expectTo = Math.round(Math.sqrt(1 / Math.min(...xs)) * 10) / 10;
  ok(
    g.interpretation?.rangeAngstrom?.from === expectFrom &&
      g.interpretation?.rangeAngstrom?.to === expectTo,
    `guinier: the fit range reconciles (${expectFrom} – ${expectTo} Å)`
  );
}

if (class3dJob) {
  const a = await loadAngDist(class3dJob.id);
  const expected = a.anisotropy > 6 ? "anisotropic" : "fairly even";
  ok(
    a.total > 0 &&
      a.interpretation != null &&
      a.interpretation.verdict === expected &&
      a.interpretation.concentration === Math.round(a.anisotropy * 10) / 10,
    `angdist (${class3dJob.name}): ${a.total} particles, verdict "${expected}" ×${a.interpretation?.concentration} reconciles`
  );
  // the strip leads with the true hottest bin — its count IS the grid max
  ok(
    a.interpretation?.hottestBins[0]?.count === a.max,
    `angdist: the hottest bin carries the grid max (×${a.max})`
  );
  // full reconcile: recompute the top three from the cells, compare exactly
  const top = a.cells
    .map((count, idx) => ({ idx, count }))
    .filter((c) => c.count > 0)
    .sort((x, y) => y.count - x.count)
    .slice(0, 3)
    .map((c) => ({
      rotBin: Math.floor(c.idx / a.tiltBins),
      tiltBin: c.idx % a.tiltBins,
      count: c.count,
    }));
  ok(
    JSON.stringify(a.interpretation?.hottestBins) === JSON.stringify(top),
    `angdist: the hottest three match the tool's own sort byte for byte (${top.map((b) => `r${b.rotBin}/t${b.tiltBin}×${b.count}`).join(", ")})`
  );
}

if (mcFixture) {
  const e = await loadAngDist(mcFixture.id);
  ok(
    e.total === 0 && e.interpretation === null,
    `angdist (${mcFixture.name}): no angles in the workdir → the honest empty face (interpretation null, never a fake verdict)`
  );
}

console.log(`\n== t489 bench: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

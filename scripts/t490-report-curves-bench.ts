/**
 * t490 — the report quotes the curves.
 *
 * The interpretation well has six families (t486 science trio + t487 prep
 * trio + t488/t489 judgment layer); the inspector panels render it, the
 * agent tool quotes it — and the Session QC report, the one document the
 * session hands its owner, never said a word about any curve. This round
 * wires the fourth family: the dialog probes the SAME chart routes the
 * panels drink from, curveVerdictOf (the paper's own voice, in qc-report)
 * words the verdicts over the well's interpretation fields, and
 * buildSessionReport binds the rows as the "Curve verdicts" section
 * between the map inventory and the sweep annex. The paper re-judges
 * nothing — the well owns every threshold, the paper quotes.
 *
 * Five benches in one:
 *   T1  the paper's voice — curveVerdictOf over synthetic responses,
 *         byte-exact lines for all six kinds + honest nulls + the
 *         well-word-wins teeth (no re-judgment)
 *   T2  the father binds — section order, TOC entry, table shape,
 *         mdCell escaping, honest pending/error/empty states
 *   T3  the well three-way — LIVE fixture: postprocess fsc+guinier
 *         cross-checked against postprocess.star itself, motion + ctf
 *         against the loader truth the tool face already witnessed
 *   T4  the wiring — dialog probes the routes + aborts + feeds the
 *         father; qc-report stays pure (no fetch, no fs); the tool's
 *         fmtAng aliases the shared rounding rule
 *   T5  the probe map — candidates only where a curve can live, every
 *         route segment exists on disk, kinds stay the tool's six
 *
 * Runs against the LIVE fixture (tutorial project in db/cryoflow.db,
 * workdirs under data/relion/) — read-only throughout.
 */
import { readFileSync, existsSync } from "fs";
import path from "path";

const REPO = "/home/z/my-project";
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
const { curveVerdictOf, CURVE_KIND_LABELS, buildSessionReport } = await import(
  "../src/lib/qc-report"
);
const { reportTocOf } = await import("../src/lib/report-html");
const { loadFsc, loadGuinier, loadCtf, loadMotion } = await import(
  "../src/lib/chart-data"
);
const { db } = await import("../src/lib/db");
const { parseStar, findPair } = await import("../src/lib/starfile");
const { fmtAngstrom } = await import("../src/lib/chart-rows");

const dialogSrc = readFileSync(
  `${REPO}/src/components/workflow/session-report-dialog.tsx`,
  "utf8"
);
const qcReportSrc = readFileSync(`${REPO}/src/lib/qc-report.ts`, "utf8");
const toolsSrc = readFileSync(`${REPO}/src/lib/ai/tools.ts`, "utf8");
const chartRowsSrc = readFileSync(`${REPO}/src/lib/chart-rows.ts`, "utf8");

/* ---------------- T1 the paper's voice ---------------- */
section("T1 — curveVerdictOf: the paper's voice over the well's fields");

const fscData = {
  source: "postprocess" as const,
  sourceFile: "postprocess.star",
  shells: [{ freq: 0.1, res: 30, fsc: 0.9 }],
  resolutionAt143: 7.785,
  resolutionAt05: 7.2,
  reportedResolution: 7.788,
  reportedLabel: "_rlnFinalResolution",
  interpretation: { atNyquist: false, reportedDiffers: false },
};
ok(
  curveVerdictOf("fsc", fscData) ===
    "FSC 0.143 at 7.8 Å (0.5 at 7.2 Å) · reported 7.8 Å",
  `fsc verdict byte-exact (got "${curveVerdictOf("fsc", fscData)}")`
);
ok(
  curveVerdictOf("fsc", {
    ...fscData,
    interpretation: { atNyquist: true, reportedDiffers: true },
  }) ===
    "FSC 0.143 at 7.8 Å (0.5 at 7.2 Å) · reported 7.8 Å — at the Nyquist cap, the curve cannot cross — the reported estimate differs from the crossing",
  "fsc interpretation clauses ride in (Nyquist cap + disagreement)"
);
ok(
  curveVerdictOf("fsc", { ...fscData, shells: [] }) === null,
  "fsc with no shells → null (honest skip, not an empty verdict)"
);

const guinierData = {
  jobId: "j1",
  sourceFile: "postprocess_guinier.star",
  points: [
    { x: 0.02, amp: 1, lnAmp: 0, lnAmpSharpened: 0 },
    { x: 0.04, amp: 0.5, lnAmp: -0.7, lnAmpSharpened: -0.5 },
    { x: 0.06, amp: 0.25, lnAmp: -1.4, lnAmpSharpened: -1.0 },
  ],
  bfactor: -62.4,
  interpretation: { hasSharpened: true, rangeAngstrom: { from: 7.069, to: 169.0 } },
};
ok(
  curveVerdictOf("guinier", guinierData) ===
    "Guinier 3 pts · B-factor -62.4 Å² · covers 7.1–169.0 Å · sharpened curve in plot",
  `guinier verdict byte-exact (got "${curveVerdictOf("guinier", guinierData)}")`
);
ok(
  curveVerdictOf("guinier", { ...guinierData, points: [] }) === null,
  "guinier with no points → null"
);

const angdistData = {
  iteration: null,
  total: 96,
  rotBins: 24,
  tiltBins: 12,
  cells: [],
  max: 2,
  occupied: 89,
  anisotropy: 1.9,
  symmetry: "C1",
  starFile: "run_data.star",
  interpretation: {
    verdict: "fairly even" as const,
    concentration: 1.9,
    hottestBins: [
      { rotBin: 6, tiltBin: 0, count: 2 },
      { rotBin: 6, tiltBin: 5, count: 2 },
      { rotBin: 8, tiltBin: 3, count: 2 },
    ],
  },
};
ok(
  curveVerdictOf("angdist", angdistData) ===
    "96 particles · 89/288 bins · ×1.9 — fairly even · hottest r6/t0",
  `angdist verdict byte-exact (got "${curveVerdictOf("angdist", angdistData)}")`
);
// the WELL-WORD-WINS teeth: the paper must never re-judge — an
// anisotropic-looking raw factor with a "fairly even" well verdict
// speaks the well's word and the well's concentration, not its own.
ok(
  curveVerdictOf("angdist", { ...angdistData, anisotropy: 9.0 }) ===
    "96 particles · 89/288 bins · ×1.9 — fairly even · hottest r6/t0",
  "well-word-wins: interp verdict + concentration quoted, anisotropy NOT re-judged"
);
ok(
  curveVerdictOf("angdist", { ...angdistData, interpretation: undefined }) ===
    "96 particles · 89/288 bins · ×1.9 — fairly even",
  "no interpretation → tool-fallback grammar still speaks (1dp + default word)"
);

const ctfData = {
  micrographs: Array.from({ length: 24 }, (_, i) => ({
    name: `mic_${String(i + 1).padStart(3, "0")}`,
    relPath: `micrographs/mic_${String(i + 1).padStart(3, "0")}.star`,
    defocusU: 1.2,
    defocusV: 1.1,
    astigmatism: 0.01,
    defocusAngle: 30,
    fom: 0.08,
    maxResolution: 4.4,
  })),
  summary: {
    count: 24,
    meanDefocus: 1.182,
    minDefocus: 1.048,
    maxDefocus: 1.328,
    maxAstigmatism: 0.016,
    meanFom: 0.08,
    worstResolution: 4.4,
  },
  interpretation: {
    worstMicrographs: [
      { name: "mic_015", defocusUm: 1.328, astigmatismUm: 0.016, fom: 0.08, maxResolutionA: 4.4 },
    ],
  },
};
ok(
  curveVerdictOf("ctf", ctfData) ===
    "24 micrographs · mean defocus 1.182 µm · worst fit 4.4 Å (mic_015)",
  `ctf verdict byte-exact (got "${curveVerdictOf("ctf", ctfData)}")`
);
ok(curveVerdictOf("ctf", { ...ctfData, micrographs: [] }) === null, "ctf with no micrographs → null");

const motionData = {
  jobId: "j2",
  sourceFile: "micrographs.star" as string | null,
  micrographs: Array.from({ length: 24 }, (_, i) => ({
    name: `mic_${String(i + 1).padStart(3, "0")}`,
    relPath: `micrographs/mic_${String(i + 1).padStart(3, "0")}.star`,
    total: 2.6,
    early: 1.6,
    late: 1.0,
  })),
  summary: {
    count: 24,
    meanTotal: 2.66,
    maxTotal: 3.06,
    worstName: "mic_004",
    meanEarly: 1.6,
    meanLate: 1.1,
  },
  interpretation: {
    driftTriage: "early-frames dominate (the stage settles late)",
    worstMicrographs: [{ name: "mic_004", totalA: 3.06, earlyA: 1.9, lateA: 1.2 }],
  },
};
ok(
  curveVerdictOf("motion", motionData) ===
    "24 micrographs · mean drift 2.7 Å · worst 3.1 Å (mic_004) — early-frames dominate (the stage settles late)",
  `motion verdict byte-exact, triage verbatim (got "${curveVerdictOf("motion", motionData)}")`
);
ok(curveVerdictOf("motion", { ...motionData, micrographs: [] }) === null, "motion with no micrographs → null");

const topazData = {
  epochs: [
    { it: 1, trainLoss: 0.6931, testLoss: null, precision: 0.5, recall: 0.4, testPrecision: null, testRecall: null },
    { it: 3, trainLoss: 0.1101, testLoss: 0.2, precision: 0.92, recall: 0.88, testPrecision: 0.9, testRecall: 0.86 },
  ],
  source: "run.out",
  interpretation: {
    firstEpoch: { it: 1, trainLoss: 0.6931, testLoss: null, precision: 0.5, recall: 0.4 },
    lastEpoch: { it: 3, trainLoss: 0.1101, testLoss: 0.2, precision: 0.92, recall: 0.88 },
    lossDirection: "falling" as const,
  },
};
ok(
  curveVerdictOf("topaz", topazData) ===
    "loss 0.6931→0.1101 (falling) · epoch 3: P 92% · R 88%",
  `topaz verdict byte-exact (got "${curveVerdictOf("topaz", topazData)}")`
);
ok(
  curveVerdictOf("topaz", { ...topazData, interpretation: undefined }) === null,
  "topaz without a judgment → null (the paper never guesses a direction)"
);
ok(
  curveVerdictOf("fsc", null) === null && curveVerdictOf("motion", undefined) === null,
  "null/undefined data → null across kinds"
);

/* ---------------- T2 the father binds ---------------- */
section("T2 — buildSessionReport binds the Curve verdicts family");

const base = {
  projectName: "beta-gal",
  pipeline: { total: 3, succeeded: 2, running: 1, failed: 0, waiting: 0 },
  mapQc: null,
  mapPending: false,
  mapError: false,
  mapInventory: null,
  sweep: null,
};

const rows: InstanceType<typeof Object> extends never ? never : import("../src/lib/qc-report").CurveVerdictRow[] = [
  { jobId: "j1", jobName: "Post-process | tutorial", kind: "fsc", verdict: "FSC 0.143 at 7.8 Å" },
  { jobId: "j1", jobName: "Post-process | tutorial", kind: "guinier", verdict: "Guinier 24 pts" },
  { jobId: "j2", jobName: "3D Classification 1", kind: "angdist", verdict: "96 particles · ×1.9 — fairly even" },
];

const mdRows = buildSessionReport({ ...base, curves: rows, curvesPending: false, curvesError: false });
ok(
  mdRows.indexOf("## Map QC") < mdRows.indexOf("## Curve verdicts") &&
    mdRows.indexOf("## Curve verdicts") < mdRows.indexOf("## Scheduling sweep"),
  "section order: Map QC < Curve verdicts < Scheduling sweep (t212 D8 still true)"
);
ok(
  reportTocOf(mdRows).some((e) => e.level === 2 && e.text === "Curve verdicts"),
  `TOC carries the new family (toc: ${reportTocOf(mdRows).map((e) => e.text).join(" · ")})`
);
ok(mdRows.includes("| Job | Curve | Verdict |"), "table speaks Job | Curve | Verdict");
ok(mdRows.includes("\\|"), "job name's pipe is mdCell-escaped on the paper");
ok(
  mdRows.includes("| FSC |") && mdRows.includes("| Guinier |") && mdRows.includes("| Angular distribution |"),
  "kinds render their human labels, never the enum"
);
ok(mdRows.includes("one well, three readers"), "the family's intro names its provenance law");

const mdPending = buildSessionReport({ ...base, curves: null, curvesPending: true, curvesError: false });
ok(
  mdPending.includes("_Still reading this session's curves"),
  "pending: the section says it is reading, it does not guess"
);
const mdError = buildSessionReport({ ...base, curves: null, curvesPending: false, curvesError: true });
ok(
  mdError.includes("does not guess the verdicts"),
  "error: the routes refused, the paper says so honestly"
);
const mdEmpty = buildSessionReport({ ...base, curves: [], curvesPending: false, curvesError: false });
ok(
  mdEmpty.includes("None of this session's completed jobs carries curve data yet"),
  "empty: the honest teaching state (which jobs would feed it)"
);

/* ---------------- T3 the well three-way (live fixture) ---------------- */
section("T3 — the paper quotes the live fixture, the star file is the third party");

const ppJob = await db.job.findFirst({
  where: { type: "postprocess", name: { contains: "tutorial" } },
});
ok(ppJob != null, "tutorial postprocess job exists in the live db");

if (ppJob) {
  const { getRun } = await import("../src/lib/relion/engine");
  const run = getRun(ppJob.id);
  ok(run?.workdir != null && existsSync(run.workdir!), "engine state carries the fixture workdir");
  const starText = run ? readFileSync(path.join(run.workdir!, "postprocess.star"), "utf8") : "";
  const star = parseStar(starText);
  const fileReported = parseFloat(findPair(star, "_rlnFinalResolution") ?? "");
  const fileBfac = parseFloat(findPair(star, "_rlnBfactorUsedForSharpening") ?? "");

  const fscData = await loadFsc(ppJob.id);
  const fscVerdict = curveVerdictOf("fsc", fscData);
  ok(fscVerdict != null, "fsc verdict exists for the postprocess");
  ok(
    fscVerdict?.includes(`reported ${fmtAngstrom(fileReported)}`) ?? false,
    `fsc verdict quotes the star file's own reported resolution (${fileReported} Å → ${fmtAngstrom(fileReported)})`
  );
  ok(
    fscVerdict?.includes(fmtAngstrom(fscData.resolutionAt143)) ?? false,
    `fsc verdict quotes the crossing (${fmtAngstrom(fscData.resolutionAt143)})`
  );
  ok(
    fscData.interpretation != null &&
      (fscData.interpretation.atNyquist === false) === !(fscVerdict ?? "").includes("Nyquist cap") &&
      (fscData.interpretation.reportedDiffers === false) === !(fscVerdict ?? "").includes("differs from the crossing"),
    "fsc clauses follow the well's interpretation exactly (no false words on a clean face)"
  );

  const guinierData = await loadGuinier(ppJob.id);
  const guinierVerdict = curveVerdictOf("guinier", guinierData);
  ok(
    guinierVerdict?.includes(`B-factor ${fileBfac.toFixed(1)} Å²`) ?? false,
    `guinier verdict quotes the star file's own B-factor (${fileBfac} Å²)`
  );
  ok(
    guinierVerdict?.includes(`${guinierData.points.length} pts`) ?? false,
    `guinier verdict counts the loader's points (${guinierData.points.length})`
  );
}

const mcJob = await db.job.findFirst({
  where: { type: "motioncorr", name: { contains: "tutorial" } },
});
if (mcJob) {
  const motionData = await loadMotion(mcJob.id);
  const motionVerdict = curveVerdictOf("motion", motionData);
  ok(motionVerdict != null, "motion verdict exists for the tutorial MotionCorr");
  ok(
    motionVerdict?.includes(`${motionData.micrographs.length} micrographs`) ?? false,
    `motion verdict counts the loader's micrographs (${motionData.micrographs.length})`
  );
  ok(
    motionData.summary != null &&
      (motionVerdict?.includes(fmtAngstrom(motionData.summary.maxTotal)) ?? false) &&
      (motionData.summary.worstName ? motionVerdict?.includes(motionData.summary.worstName) : true),
    `motion verdict quotes the worst drift + its name (${motionData.summary?.worstName ?? "?"} · ${fmtAngstrom(motionData.summary?.maxTotal ?? null)})`
  );
  ok(
    motionData.interpretation != null &&
      (motionVerdict?.includes(motionData.interpretation.driftTriage) ?? false),
    `motion verdict carries the well's triage verbatim ("${motionData.interpretation?.driftTriage}")`
  );
}

const ctfJob = await db.job.findFirst({
  where: { type: "ctffind", name: { contains: "tutorial" } },
});
if (ctfJob) {
  const ctfData = await loadCtf(ctfJob.id);
  const ctfVerdict = curveVerdictOf("ctf", ctfData);
  ok(ctfVerdict != null, "ctf verdict exists for the tutorial CtfFind");
  ok(
    ctfData.summary != null &&
      (ctfVerdict?.includes(fmtAngstrom(ctfData.summary.worstResolution)) ?? false),
    `ctf verdict quotes the worst fit resolution (${fmtAngstrom(ctfData.summary?.worstResolution ?? null)})`
  );
  ok(
    ctfData.interpretation != null &&
      (ctfVerdict?.includes(`(${ctfData.interpretation.worstMicrographs[0]?.name})`) ?? false),
    `ctf verdict names the worst micrograph (${ctfData.interpretation?.worstMicrographs[0]?.name})`
  );
}

/* ---------------- T4 the wiring ---------------- */
section("T4 — the dialog probes the routes, the paper stays pure");

ok(
  dialogSrc.includes("curveVerdictOf") && dialogSrc.includes("CurveVerdictRow"),
  "dialog imports the paper's curve voice (curveVerdictOf + row type)"
);
ok(
  dialogSrc.includes("measureCurveVerdicts") &&
    /CURVE_PROBES_BY_TYPE[^;]*postprocess[\s\S]*refine3d\|class3d\|class2d\|initialmodel[\s\S]*ctffind[\s\S]*motioncorr[\s\S]*topaz/.test(dialogSrc),
  "probe map covers postprocess / 3D runs / ctffind / motioncorr / topaz"
);
ok(
  dialogSrc.includes('CURVE_ROUTE_SEGMENT[kind]') && dialogSrc.includes('topaz: "topaz-training"'),
  "route segments wired; topaz rides the topaz-training segment"
);
ok(
  /setCurvesPending\(true\)[\s\S]*measureCurveVerdicts\([\s\S]*ctrl\.signal[\s\S]*setCurvesPending\(false\)/.test(dialogSrc) &&
    dialogSrc.includes("return () => ctrl.abort();"),
  "curve walk: pending state + abort controller + settle"
);
ok(
  dialogSrc.includes("curves,") &&
    dialogSrc.includes("curvesPending,") &&
    dialogSrc.includes("curvesError,"),
  "the father receives the family's three states"
);
ok(
  !/fetch\(/.test(qcReportSrc),
  "qc-report stays pure — the paper does no IO (the dialog measures)"
);
ok(
  !/\bfs\b|\bpath\b/.test(qcReportSrc.split("import {")[0]) &&
    !qcReportSrc.includes('from "fs"') &&
    !qcReportSrc.includes('from "path"'),
  "qc-report imports no fs/path (browser-safe document builder)"
);
ok(
  !qcReportSrc.includes("> 6") && !qcReportSrc.includes("earlyA") && !qcReportSrc.includes("lateA"),
  "the paper re-judges nothing: no >6 threshold, no early/late math in qc-report"
);
ok(
  toolsSrc.includes("const fmtAng = fmtAngstrom;") && toolsSrc.includes("const fmtUm = fmtMicron;"),
  "the tool face aliases the shared rounding rule (one birthplace for the digits)"
);
ok(
  chartRowsSrc.includes("export const fmtAngstrom") && chartRowsSrc.includes("export const fmtMicron"),
  "the rounding rules live in the shared surface (chart-rows)"
);
ok(
  qcReportSrc.includes("fmtAngstrom") && qcReportSrc.includes("fmtMicron"),
  "the paper's voice rounds through the shared rule"
);
ok(
  Object.keys(CURVE_KIND_LABELS).join(",") === "fsc,guinier,angdist,ctf,motion,topaz",
  "CURVE_KIND_LABELS speaks the tool's six kinds in order"
);

/* ---------------- T5 the probe map + routes on disk ---------------- */
section("T5 — probes only where a curve can live; every route exists");

const routeDir = `${REPO}/src/app/api/jobs/[id]`;
for (const seg of ["fsc", "guinier", "angdist", "ctf", "motion", "topaz-training"]) {
  ok(existsSync(`${routeDir}/${seg}/route.ts`), `route on disk: /api/jobs/[id]/${seg}`);
}

const completed = await db.job.findMany({ where: { status: "completed" } });
const probeMap: [RegExp, string[]][] = [
  [/postprocess/, ["fsc", "guinier"]],
  [/refine3d|class3d|class2d|initialmodel|multibody/, ["fsc", "angdist"]],
  [/ctffind/, ["ctf"]],
  [/motioncorr/, ["motion"]],
  [/topaz/, ["topaz"]],
];
const sixKinds = new Set(["fsc", "guinier", "angdist", "ctf", "motion", "topaz"]);
let probed = 0;
let allKindsValid = true;
for (const j of completed) {
  const kinds = probeMap.find(([re]) => re.test(j.type))?.[1] ?? [];
  for (const k of kinds) {
    probed++;
    if (!sixKinds.has(k)) allKindsValid = false;
  }
}
ok(allKindsValid && probed > 0, `every probed kind is one of the six (${probed} probes over ${completed.length} completed jobs)`);
const neverProbed = completed.filter((j) =>
  ["import", "extract", "select", "select2d", "autopick", "maskcreate", "rebalance", "symexpand"].includes(j.type)
);
ok(
  neverProbed.every((j) => !(probeMap.find(([re]) => re.test(j.type))?.[1] ?? []).length),
  "volume-less/selection types never spend a probe"
);

/* ---------------- verdict ---------------- */
console.log(`\n== t490 bench: ${pass} pass, ${fail} fail`);
if (fail > 0) process.exit(1);

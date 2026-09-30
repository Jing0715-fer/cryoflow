/**
 * t487 — the curves bridge carries SIX: loadCtf / loadMotion /
 * loadTopazTraining join the t486 trio in chart-data.ts, the three prep
 * routes (ctf / motion / topaz-training) become thin guard+json shells
 * over them, and the agent's get_job_curves grows kinds ctf/motion/topaz
 * so a prep question ("CTF 拟合怎么样", "漂移大吗", "topaz 训练好了吗")
 * reads the same wells the charts drink from — you quote what the chart
 * draws, by construction.
 *
 *   T1  tool shape  — description names the prep trio's science + ask words
 *   T2  loadCtf     — fixture face: count/order/summary math + cache untouched
 *   T3  loadMotion  — fixture face: worst offender + early/late math
 *   T4  loadTopaz   — honest empty + a training-named log is read (then cleaned)
 *   T5  tool faces  — kinds filters, honest cross-kind reasons, all-six default
 *   T6  the law     — #15 speaks the prep asks, #2 carries the new questions
 *   T7  one well    — three shells import the loaders, parse logic zero-left
 */

import { readFileSync, writeFileSync, unlinkSync, existsSync } from "fs";
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
const { AI_TOOLS, executeAiTool } = await import("../src/lib/ai/tools");
const { loadCtf, loadMotion, loadTopazTraining } = await import(
  "../src/lib/chart-data"
);
const { ctfMicrographRows } = await import("../src/lib/compare-rows");
const { db } = await import("../src/lib/db");
const promptSrc = readFileSync(`${REPO}/src/lib/ai/prompt.ts`, "utf8");
const ctfRouteSrc = readFileSync(
  `${REPO}/src/app/api/jobs/[id]/ctf/route.ts`,
  "utf8"
);
const motionRouteSrc = readFileSync(
  `${REPO}/src/app/api/jobs/[id]/motion/route.ts`,
  "utf8"
);
const topazRouteSrc = readFileSync(
  `${REPO}/src/app/api/jobs/[id]/topaz-training/route.ts`,
  "utf8"
);
const chartDataSrc = readFileSync(`${REPO}/src/lib/chart-data.ts`, "utf8");

const tool = AI_TOOLS.find((t) => t.name === "get_job_curves") as
  | (typeof AI_TOOLS[number] & { description: string })
  | undefined;

/* ---------------- T1 tool shape ---------------- */
section("T1 — the prep trio is named with its science");
ok(AI_TOOLS.length === 24, `AI_TOOLS still holds 24 tools (got ${AI_TOOLS.length})`);
const desc = tool?.description ?? "";
ok(
  desc.includes("ctf (per-micrograph CTF fit quality") &&
    desc.includes("motion (per-micrograph accumulated drift") &&
    desc.includes("topaz (per-epoch picker training curve"),
  "description names ctf/motion/topaz with their scientific face"
);
ok(
  desc.includes("early/late split") && desc.includes("worst fit resolution"),
  "description carries the triage split and the fit limit"
);
ok(
  desc.includes("CTF 拟合怎么样") &&
    desc.includes("漂移大吗") &&
    desc.includes("topaz 训练好了吗"),
  "description speaks the prep asker's words (zh + en)"
);
ok(
  desc.includes("inspect_job") && desc.includes("check_convergence"),
  "description keeps the honest split from inspect_job/check_convergence"
);

/* ---------------- fixtures ---------------- */
// workdir lives on the run state (engine), not the Job table — the jobs
// are picked by type in the tutorial project (t486's fixture pick)
const ctfJob = await db.job.findFirst({
  where: { type: "ctffind", projectId: "cmukrk2yy0000rjobryvy0pzu" },
});
const mcJob = await db.job.findFirst({
  where: { type: "motioncorr", projectId: "cmukrk2yy0000rjobryvy0pzu" },
});
ok(
  ctfJob != null && mcJob != null,
  "fixture ctffind + motioncorr jobs exist in the live db"
);

const ctfWorkdir = ctfJob
  ? `${process.env.CRYOFLOW_DATA_DIR}/relion/${ctfJob.projectId}/ctffind_${ctfJob.id.slice(-8)}`
  : "";
const mcWorkdir = mcJob
  ? `${process.env.CRYOFLOW_DATA_DIR}/relion/${mcJob.projectId}/motioncorr_${mcJob.id.slice(-8)}`
  : "";

/* ---------------- T2 loadCtf ---------------- */
section("T2 — loadCtf reads the fixture and does the route's math");
if (ctfJob) {
  const d = await loadCtf(ctfJob.id);
  ok(d.micrographs.length === 24, `24 micrographs read (got ${d.micrographs.length})`);
  ok(
    d.micrographs.every(
      (m, i) => i === 0 || d.micrographs[i - 1].defocusU >= m.defocusU
    ),
    "micrographs arrive defocusU-descending (the route's order, moved verbatim)"
  );
  // the cache-untouched law: the lib's cached array must still be in FILE
  // order after loadCtf sorted its own copy (callers must NOT mutate)
  const first = ctfMicrographRows(ctfWorkdir);
  const firstFileOrderName = first[0]?.name;
  const sortedName = [...first].sort((a, b) => b.defocusU - a.defocusU)[0]?.name;
  const again = ctfMicrographRows(ctfWorkdir);
  ok(
    again[0]?.name === firstFileOrderName && firstFileOrderName !== sortedName,
    `cached array untouched by loadCtf's sort (still file order: ${again[0]?.name})`
  );
  // summary math, recomputed here from the same rows (t486's reconcile law)
  const defoci = d.micrographs.map((m) => (m.defocusU + m.defocusV) / 2);
  const meanDefocus = defoci.reduce((s, v) => s + v, 0) / defoci.length;
  const foms = d.micrographs.filter((m) => m.fom > 0).map((m) => m.fom);
  const meanFom = foms.reduce((s, v) => s + v, 0) / foms.length;
  const worst = d.micrographs.reduce((a, b) =>
    b.maxResolution > a.maxResolution ? b : a
  );
  ok(
    d.summary != null &&
      d.summary.count === d.micrographs.length &&
      Math.abs(d.summary.meanDefocus - meanDefocus) < 1e-9 &&
      Math.abs(d.summary.meanFom - meanFom) < 1e-9,
    "summary aggregates reconcile (count, meanDefocus, meanFom)"
  );
  ok(
    d.summary != null &&
      d.summary.maxAstigmatism ===
        Math.max(...d.micrographs.map((m) => m.astigmatism)) &&
      d.summary.worstResolution === worst.maxResolution &&
      d.summary.minDefocus === Math.min(...defoci),
    "worst faces reconcile (maxAstigmatism, worstResolution, minDefocus)"
  );
} else {
  fail++;
  console.log("  FAIL skipped T2 for missing fixture");
}

/* ---------------- T3 loadMotion ---------------- */
section("T3 — loadMotion reads the fixture and does the route's math");
if (mcJob) {
  const d = await loadMotion(mcJob.id);
  ok(d.micrographs.length === 24, `24 micrographs read (got ${d.micrographs.length})`);
  ok(
    d.sourceFile === "corrected_micrographs.star",
    "sourceFile names the catalogue (route's honest face, moved verbatim)"
  );
  const total = d.micrographs.reduce((s, m) => s + m.total, 0);
  const early = d.micrographs.reduce((s, m) => s + m.early, 0);
  const late = d.micrographs.reduce((s, m) => s + m.late, 0);
  const worstRow = d.micrographs.reduce((a, b) => (b.total > a.total ? b : a));
  ok(
    d.summary != null &&
      Math.abs(d.summary.meanTotal - total / d.micrographs.length) < 1e-9 &&
      d.summary.maxTotal === worstRow.total &&
      d.summary.worstName === worstRow.name,
    `summary reconciles (mean/max total, worst offender ${worstRow.name})`
  );
  ok(
    d.summary != null &&
      Math.abs(d.summary.meanEarly - early / d.micrographs.length) < 1e-9 &&
      Math.abs(d.summary.meanLate - late / d.micrographs.length) < 1e-9,
    "early/late split reconciles (the two halves a user triages on)"
  );
} else {
  fail++;
  console.log("  FAIL skipped T3 for missing fixture");
}

/* ---------------- T4 loadTopazTraining ---------------- */
section("T4 — loadTopazTraining: honest empty, and a log is read honestly");
if (mcJob) {
  // Face A: a MotionCorr workdir holds no topaz log — honest empty
  const empty = await loadTopazTraining(mcJob.id);
  ok(
    empty.epochs.length === 0 && empty.source === null,
    "a motioncorr workdir gets the honest empty face (epochs [], source null)"
  );
  // Face B: drop a training-named log into the workdir, read it, clean it.
  // The parser is tolerant (topaz-training.ts); the loader owns the hunt
  // (training|loss|topaz*.log naming), the 4 MB ceiling and the merge.
  const probe = path.join(mcWorkdir, "topaz_training.txt");
  const created = !existsSync(probe);
  try {
    writeFileSync(
      probe,
      [
        "## epoch 1, loss=0.90, precision=0.40, recall=0.35",
        "## epoch 2, loss=0.70, precision=0.55, recall=0.50",
        "## epoch 3, loss=0.50, precision=0.68, recall=0.63",
        "",
      ].join("\n")
    );
    const d = await loadTopazTraining(mcJob.id);
    ok(
      d.epochs.length === 3 && d.source === "topaz_training.txt",
      `3 epochs read from the training-named log (source ${d.source})`
    );
    const last = d.epochs[d.epochs.length - 1];
    ok(
      last?.it === 3 &&
        last.trainLoss === 0.5 &&
        last.precision === 0.68 &&
        last.recall === 0.63,
      "per-epoch numbers are the log's own (loss falls 0.9 → 0.5, nothing fabricated)"
    );
    const first = d.epochs[0];
    ok(
      first?.trainLoss === 0.9 && first?.precision === 0.4,
      "the epoch head survives (first epoch keeps its own loss/precision)"
    );
  } finally {
    if (created && existsSync(probe)) unlinkSync(probe);
  }
  ok(
    !existsSync(probe) || !created,
    "the probe log is cleaned up — the fixture workdir is left as found"
  );
} else {
  fail++;
  console.log("  FAIL skipped T4 for missing fixture");
}

/* ---------------- T5 tool faces ---------------- */
section("T5 — the tool answers prep questions with the matching kind");
if (ctfJob && mcJob) {
  const ctx = { projectId: ctfJob.projectId };
  const curvesOf = (res: Awaited<ReturnType<typeof executeAiTool>>) =>
    (res.detail as { curves: Array<Record<string, unknown>> }).curves;

  // a CTF question on a CtfFind job: exactly one ctf curve, renderable
  const ctfFace = await executeAiTool(
    "get_job_curves",
    { job_id: ctfJob.id, kinds: ["ctf"] },
    ctx
  );
  const ctfCurve = curvesOf(ctfFace)[0];
  ok(
    ctfFace.ok === true &&
      curvesOf(ctfFace).length === 1 &&
      ctfCurve.kind === "ctf" &&
      ctfCurve.renderable === true &&
      ctfCurve.micrographCount === 24 &&
      typeof ctfCurve.meanDefocusUm === "number",
    "kinds:['ctf'] on a CtfFind job: one renderable curve with the µm-face numbers"
  );
  ok(
    Array.isArray(ctfCurve.worstMicrographs) &&
      (ctfCurve.worstMicrographs as unknown[]).length === 3 &&
      (ctfCurve.worstMicrographs as Array<Record<string, unknown>>).every(
        (m) => typeof m.name === "string" && typeof m.fom === "number"
      ),
    "the three worst-fitting micrographs are named (chart's outlier job, spoken)"
  );

  // a drift question on a MotionCorr job: triage split spoken
  const motionFace = await executeAiTool(
    "get_job_curves",
    { job_id: mcJob.id, kinds: ["motion"] },
    { projectId: mcJob.projectId }
  );
  const mCurve = curvesOf(motionFace)[0];
  ok(
    mCurve.kind === "motion" &&
      mCurve.renderable === true &&
      typeof mCurve.driftTriage === "string" &&
      typeof mCurve.worstName === "string" &&
      typeof mCurve.meanEarlyA === "number" &&
      typeof mCurve.meanLateA === "number",
    `kinds:['motion'] on a MotionCorr job: one renderable curve with the triage ("${mCurve.driftTriage}")`
  );

  // cross-kind honesty: each prep kind points at its sibling, never fakes
  const ctfOnMc = await executeAiTool(
    "get_job_curves",
    { job_id: mcJob.id, kinds: ["ctf"] },
    { projectId: mcJob.projectId }
  );
  const ctfOnMcCurve = curvesOf(ctfOnMc)[0];
  ok(
    ctfOnMcCurve.renderable === false &&
      (ctfOnMcCurve.reason as string).includes("micrographs_ctf.star") &&
      (ctfOnMcCurve.reason as string).includes("motion"),
    "ctf on a MotionCorr job: honest reason that POINTS at kind motion"
  );
  const motionOnCtf = await executeAiTool(
    "get_job_curves",
    { job_id: ctfJob.id, kinds: ["motion"] },
    ctx
  );
  const motionOnCtfCurve = curvesOf(motionOnCtf)[0];
  ok(
    motionOnCtfCurve.renderable === false &&
      (motionOnCtfCurve.reason as string).includes("corrected_micrographs.star") &&
      (motionOnCtfCurve.reason as string).includes("ctf"),
    "motion on a CtfFind job: honest reason that POINTS at kind ctf"
  );

  // topaz on either: still the honest empty (no picker trained here)
  const topazOnMc = await executeAiTool(
    "get_job_curves",
    { job_id: mcJob.id, kinds: ["topaz"] },
    { projectId: mcJob.projectId }
  );
  const topazCurve = curvesOf(topazOnMc)[0];
  ok(
    topazCurve.renderable === false &&
      (topazCurve.reason as string).includes("topaz"),
    "topaz with no picker trained: honest reason, never a fake epoch"
  );

  // default = all six: a CtfFind job gets 6 curve faces (3 renderable at most)
  const all = await executeAiTool("get_job_curves", { job_id: ctfJob.id }, ctx);
  const allCurves = curvesOf(all);
  ok(
    allCurves.length === 6 &&
      allCurves.map((c) => c.kind).join(",") ===
        "fsc,guinier,angdist,ctf,motion,topaz",
    "no kinds = all six kinds answered, in the schema's order"
  );
} else {
  fail++;
  console.log("  FAIL skipped T5 for missing fixtures");
}

/* ---------------- T6 the law ---------------- */
section("T6 — THE CURVE LAW grew the prep asks, the read list grew too");
ok(
  promptSrc.includes("CTF 拟合怎么样") &&
    promptSrc.includes("漂移大吗") &&
    promptSrc.includes("topaz 训练好了吗"),
  "law #15 speaks the prep asks (zh + en)"
);
ok(
  promptSrc.includes("A prep question wants the matching kind") &&
    promptSrc.includes("per-micrograph CTF fit stats") &&
    promptSrc.includes("early/late drift split") &&
    promptSrc.includes("per-epoch topaz loss curve"),
  "law #15 teaches the matching-kind rule and names the three new wells"
);
ok(
  promptSrc.includes("这些图漂移大吗？") && promptSrc.includes("CTF 拟合怎么样？"),
  "read list (#2) carries the new sample questions"
);
{
  const nums = [...promptSrc.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]));
  ok(
    nums.join(",") === "1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16",
    "doctrine numbers run 1–16 with no gaps (extension, not rebirth — t500's law 16 rides the same ladder)"
  );
}

/* ---------------- T7 one well ---------------- */
section("T7 — the three shells and the tool drink from ONE loader");
ok(
  ctfRouteSrc.includes("loadCtf") &&
    motionRouteSrc.includes("loadMotion") &&
    topazRouteSrc.includes("loadTopazTraining"),
  "all three thin shells import their loader from chart-data"
);
ok(
  ctfRouteSrc.includes("ChartJobNotFound") &&
    motionRouteSrc.includes("ChartJobNotFound") &&
    topazRouteSrc.includes("ChartJobNotFound"),
  "every shell translates ChartJobNotFound → 404"
);
ok(
  ctfRouteSrc.includes("isLocalRequest") &&
    motionRouteSrc.includes("isLocalRequest") &&
    topazRouteSrc.includes("isLocalRequest"),
  "every shell keeps the same-origin guard (t251/t266)"
);
ok(
  !ctfRouteSrc.includes("ctfMicrographRows(") &&
    !ctfRouteSrc.includes(".reduce(") &&
    !motionRouteSrc.includes("motionCatalogueRows(") &&
    !motionRouteSrc.includes(".reduce(") &&
    !topazRouteSrc.includes("readdirSync") &&
    !topazRouteSrc.includes("cachedFileCompute") &&
    !topazRouteSrc.includes("parseTopazTraining"),
  "no parse/summary logic left behind in the shells (the move is total)"
);
ok(
  chartDataSrc.includes('"topaz-training"') &&
    chartDataSrc.includes("ctfMicrographRows") &&
    chartDataSrc.includes("motionCatalogueRows") &&
    chartDataSrc.includes("parseTopazTraining"),
  'the statcache key "topaz-training" and the t469 grammars survive in the loader'
);
ok(
  chartDataSrc.includes("export class ChartJobNotFound") &&
    chartDataSrc.includes("loadCtf") &&
    chartDataSrc.includes("loadMotion") &&
    chartDataSrc.includes("loadTopazTraining"),
  "chart-data exports the three new loaders + the not-found truth"
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

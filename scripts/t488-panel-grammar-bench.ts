/**
 * t488 — the panels speak the tool's grammar: interpretCtf /
 * interpretMotion / interpretTopaz move the JUDGMENT layer (worst fits,
 * drift triage, first/last epoch + loss direction) into chart-data.ts —
 * the ONE well — and the loaders attach it to their responses. The thin
 * routes pass it through untouched, the agent's get_job_curves quotes it
 * (zero behavior change — t486/t487's benches hold the tool faces
 * fixed), and the prep panels' interpretation strips render it. Panel =
 * model can quote, by construction.
 *
 *   T1  one well    — the builders are exported, the loaders wire them
 *   T2  the math    — byte-identical judgment faces on synthetic rows
 *   T3  tool drinks — tools.ts reads the interpretation, no inline twin
 *   T4  panels      — the three strips render the well's grammar
 *   T5  passthrough — thin routes + response faces carry the field
 *   T6  live well   — fixture jobs reconcile: the strip's numbers ARE
 *                     the tool's numbers (worst/worst/triage/direction)
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
const {
  interpretCtf,
  interpretMotion,
  interpretTopaz,
  loadCtf,
  loadMotion,
  loadTopazTraining,
} = await import("../src/lib/chart-data");
const { db } = await import("../src/lib/db");
const chartDataSrc = readFileSync(`${REPO}/src/lib/chart-data.ts`, "utf8");
const chartRowsSrc = readFileSync(`${REPO}/src/lib/chart-rows.ts`, "utf8");
const toolsSrc = readFileSync(`${REPO}/src/lib/ai/tools.ts`, "utf8");
const ctfPanelSrc = readFileSync(
  `${REPO}/src/components/workflow/results/ctf-quality-chart.tsx`,
  "utf8"
);
const motionPanelSrc = readFileSync(
  `${REPO}/src/components/workflow/results/motion-drift-chart.tsx`,
  "utf8"
);
const topazPanelSrc = readFileSync(
  `${REPO}/src/components/workflow/results/topaz-training-chart.tsx`,
  "utf8"
);
const stripSrc = readFileSync(
  `${REPO}/src/components/workflow/results/interpretation-strip.tsx`,
  "utf8"
);
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

/* ---------------- T1 one well ---------------- */
section("T1 — the builders exist and the loaders wire them");
ok(
  typeof interpretCtf === "function" &&
    typeof interpretMotion === "function" &&
    typeof interpretTopaz === "function",
  "chart-data exports interpretCtf / interpretMotion / interpretTopaz"
);
ok(
  chartDataSrc.includes("interpretation: interpretCtf(micrographs, summary)") &&
    chartDataSrc.includes("interpretation: interpretMotion(micrographs, summary)") &&
    chartDataSrc.includes("interpretation: interpretTopaz(epochs, source)"),
  "all three loaders attach the interpretation to their responses"
);
ok(
  chartDataSrc.includes("interpretation: null") &&
    chartDataSrc.match(/interpretation: null/g)?.length === 7,
  `the honest empty faces carry interpretation null too (got ${
    chartDataSrc.match(/interpretation: null/g)?.length ?? 0
  }/7 — ctf has two; t489's science trio adds fsc/guinier/angdist)`
);
ok(
  chartRowsSrc.includes("interface CtfInterpretation") &&
    chartRowsSrc.includes("interface MotionInterpretation") &&
    chartRowsSrc.includes("interface TopazInterpretation"),
  "chart-rows declares the three interpretation faces"
);

/* ---------------- T2 the math ---------------- */
section("T2 — the builders' judgment faces are byte-identical to the tool's");
{
  // ctf: four rows, worst three by fit resolution, µm/FoM rounding laws
  const rows = [
    { name: "mic_a", defocusU: 1.2005, defocusV: 1.2, astigmatism: 0.0123, fom: 0.086, maxResolution: 3.9 },
    { name: "mic_b", defocusU: 2.0, defocusV: 2.0004, astigmatism: 0.02, fom: 0.05, maxResolution: 4.4 },
    { name: "mic_c", defocusU: 1.5, defocusV: 1.5, astigmatism: 0.005, fom: 0.099, maxResolution: 3.2 },
    { name: "mic_d", defocusU: 0.9, defocusV: 0.9, astigmatism: 0.001, fom: 0.12, maxResolution: 0 },
  ];
  const interp = interpretCtf(rows as never, { count: 4 } as never);
  ok(
    interp?.worstMicrographs.map((w) => w.name).join(",") === "mic_b,mic_a,mic_c",
    "worst three ordered by fit resolution LARGEST first (mic_d's 0 is unjudgeable)"
  );
  const b = interp!.worstMicrographs[0];
  ok(
    b.maxResolutionA === 4.4 &&
      b.defocusUm === 2.0 &&
      b.astigmatismUm === 0.02 &&
      b.fom === 0.05,
    "the rounding laws land (3dp µm mean, 3dp astig, 2dp FoM, raw Å)"
  );
  const d0 = interp!.worstMicrographs.find((w) => w.name === "mic_d");
  ok(
    d0 === undefined,
    "a 0 fit resolution never enters the strip (0 = not measured)"
  );
  ok(
    interpretCtf([], { count: 0 } as never) === null &&
      interpretCtf(rows as never, null) === null,
    "empty rows or null summary → null (the honest absence, not a fake verdict)"
  );
}
{
  // motion: the three triage words are the tool's EXACT strings
  const rows = [
    { name: "m1", total: 3.14, early: 2.0, late: 1.14 },
    { name: "m2", total: 2.86, early: 1.4, late: 1.46 },
    { name: "m3", total: 1.5, early: 0.7, late: 0.8 },
  ];
  const early = interpretMotion(rows as never, {
    meanEarly: 1.37,
    meanLate: 1.13,
  } as never);
  ok(
    early?.driftTriage === "early-frames dominate (the stage settles late)",
    "early>late speaks the tool's exact early triage"
  );
  const late = interpretMotion(rows as never, {
    meanEarly: 1.1,
    meanLate: 1.4,
  } as never);
  ok(
    late?.driftTriage === "late-frames dominate (kept drifting to the end)",
    "late>early speaks the tool's exact late triage"
  );
  const even = interpretMotion(rows as never, {
    meanEarly: 1.2,
    meanLate: 1.2,
  } as never);
  ok(even?.driftTriage === "even split", "equal means speak the even split");
  ok(
    early?.worstMicrographs[0].name === "m1" &&
      early?.worstMicrographs[0].totalA === 3.1 &&
      early?.worstMicrographs[0].earlyA === 2 &&
      early?.worstMicrographs[0].lateA === 1.1,
    "worst three by total, drift at 1dp Å (m1 leads)"
  );
  ok(interpretMotion([], null) === null, "null summary → null interpretation");
}
{
  // topaz: first/last in the tool's exact 5-field shape + the direction
  const epochs = [
    { it: 1, trainLoss: 0.9, testLoss: 1.1, precision: 0.4, recall: 0.35, testPrecision: 0.3, testRecall: 0.2 },
    { it: 2, trainLoss: 0.7, testLoss: 0.9, precision: 0.55, recall: 0.5, testPrecision: 0.5, testRecall: 0.45 },
    { it: 3, trainLoss: 0.5, testLoss: 0.8, precision: 0.68, recall: 0.63, testPrecision: 0.6, testRecall: 0.55 },
  ];
  const interp = interpretTopaz(epochs as never, "run.out");
  ok(
    interp?.firstEpoch.it === 1 &&
      interp?.lastEpoch.it === 3 &&
      interp?.firstEpoch.trainLoss === 0.9 &&
      interp?.lastEpoch.trainLoss === 0.5,
    "first/last epochs carry the tool's pair (1→3, 0.9→0.5)"
  );
  ok(
    interp?.lossDirection === "falling",
    "0.9 → 0.5 is judged falling (a fact from pure comparison)"
  );
  ok(
    !("testPrecision" in interp!.firstEpoch) &&
      !("testRecall" in interp!.firstEpoch),
    "the held-out P/R fields stay OUT of the first/last face (the tool's shape)"
  );
  const rising = interpretTopaz(
    epochs.map((e, i) => ({ ...e, trainLoss: 0.5 + i * 0.1 })) as never,
    null
  );
  ok(rising?.lossDirection === "rising", "a climbing train loss is judged rising");
  const flat = interpretTopaz(
    epochs.map((e) => ({ ...e, trainLoss: 0.7 })) as never,
    null
  );
  ok(flat?.lossDirection === "flat", "an unmoving train loss is judged flat");
  const noLoss = interpretTopaz(
    epochs.map((e, i) => ({ ...e, trainLoss: i === 0 ? null : e.trainLoss })) as never,
    null
  );
  ok(
    noLoss?.lossDirection === undefined,
    "a missing head loss leaves the direction UNSTATED (no fake arrow)"
  );
  ok(interpretTopaz([], "run.out") === null, "no epochs → null interpretation");
}

/* ---------------- T3 the tool drinks the well ---------------- */
section("T3 — get_job_curves quotes the well, the inline twin is gone");
ok(
  toolsSrc.includes("d.interpretation?.worstMicrographs") &&
    toolsSrc.includes("interp?.driftTriage") &&
    toolsSrc.includes("d.interpretation?.firstEpoch") &&
    toolsSrc.includes("d.interpretation?.lastEpoch"),
  "the tool reads the interpretation for ctf (worst three), motion (triage + worst three) and topaz (first/last)"
);
ok(
  !toolsSrc.includes("b.maxResolution - a.maxResolution") &&
    !toolsSrc.includes(".sort((a, b) => b.total - a.total)"),
  "the inline worst-three sort is GONE from the tool (one well, no twins)"
);
ok(
  !toolsSrc.includes("early-frames dominate") &&
    chartDataSrc.includes("early-frames dominate (the stage settles late)") &&
    chartDataSrc.includes("late-frames dominate (kept drifting to the end)"),
  "the triage words live ONLY in the well (the tool quotes, never re-speaks)"
);

/* ---------------- T4 the panels ---------------- */
section("T4 — the three panels render the well's grammar");
ok(
  stripSrc.includes("data-chart-interpretation") &&
    stripSrc.includes("export function ChartInterpretation"),
  "the shared strip exists with its bench marker (one judgment, one face)"
);
ok(
  ctfPanelSrc.includes("ChartInterpretation") &&
    ctfPanelSrc.includes("interpretation?.worstMicrographs"),
  "the CTF panel renders the worst fits from the well"
);
ok(
  motionPanelSrc.includes("ChartInterpretation") &&
    motionPanelSrc.includes("data.interpretation") &&
    motionPanelSrc.includes("interp.driftTriage") &&
    motionPanelSrc.includes('driftTriage === "even split"'),
  "the motion panel renders the triage and tones the even split healthy"
);
ok(
  topazPanelSrc.includes("ChartInterpretation") &&
    topazPanelSrc.includes("lossDirection") &&
    topazPanelSrc.includes("lastEpoch"),
  "the topaz panel renders the direction arrow and the last epoch's P/R"
);
ok(
  (ctfPanelSrc.includes('"falling"') ? 1 : 0) === 0 ||
    topazPanelSrc.includes('"falling"'),
  "direction wording stays where the direction is judged (the well + its topaz reader)"
);

/* ---------------- T5 passthrough ---------------- */
section("T5 — the thin shells pass the judgment through untouched");
ok(
  ctfRouteSrc.includes("NextResponse.json(await loadCtf(") &&
    motionRouteSrc.includes("NextResponse.json(await loadMotion(") &&
    topazRouteSrc.includes("NextResponse.json(await loadTopazTraining("),
  "all three shells still serialize the loader's whole response (interpretation rides along)"
);
ok(
  !ctfRouteSrc.includes(".reduce(") &&
    !motionRouteSrc.includes(".reduce(") &&
    !topazRouteSrc.includes("parseTopazTraining"),
  "no judgment math leaks into the shells (the move is total, again)"
);
ok(
  chartRowsSrc.includes("interpretation?: CtfInterpretation | null") &&
    chartRowsSrc.includes("interpretation?: MotionInterpretation | null") &&
    chartRowsSrc.includes("interpretation?: TopazInterpretation | null"),
  "the three response faces declare the optional interpretation field"
);

/* ---------------- T6 the live well ---------------- */
section("T6 — fixture jobs: the strip's numbers ARE the tool's numbers");
const ctfJob = await db.job.findFirst({
  where: { type: "ctffind", projectId: "cmukrk2yy0000rjobryvy0pzu" },
});
const mcJob = await db.job.findFirst({
  where: { type: "motioncorr", projectId: "cmukrk2yy0000rjobryvy0pzu" },
});
if (ctfJob && mcJob) {
  const d = await loadCtf(ctfJob.id);
  const worstA = Math.max(...d.micrographs.map((m) => m.maxResolution));
  ok(
    d.summary != null &&
      d.interpretation != null &&
      d.interpretation.worstMicrographs.length === 3 &&
      d.interpretation.worstMicrographs[0].maxResolutionA === worstA,
    `ctf: the strip leads with the true worst fit (${worstA.toFixed(1)} Å)`
  );
  const toolSpoken = d.interpretation!.worstMicrographs
    .map((w) => w.maxResolutionA?.toFixed(1))
    .join(" / ");
  ok(
    d.interpretation!.worstMicrographs.every(
      (w, i, arr) => i === 0 || (arr[i - 1].maxResolutionA ?? 0) >= (w.maxResolutionA ?? 0)
    ),
    `ctf: worst-first order holds across the strip (${toolSpoken})`
  );

  const m = await loadMotion(mcJob.id);
  const expectedTriage =
    m.summary!.meanEarly > m.summary!.meanLate
      ? "early-frames dominate (the stage settles late)"
      : m.summary!.meanLate > m.summary!.meanEarly
        ? "late-frames dominate (kept drifting to the end)"
        : "even split";
  const maxTotalA = Math.round(
    Math.max(...m.micrographs.map((x) => x.total)) * 10
  ) / 10;
  ok(
    m.interpretation?.driftTriage === expectedTriage,
    `motion: the triage reconciles with the summary ("${expectedTriage}")`
  );
  ok(
    m.interpretation?.worstMicrographs[0].totalA === maxTotalA,
    `motion: the strip leads with the true worst drift (${maxTotalA} Å)`
  );

  // topaz: drop a falling log into the motioncorr workdir, read the
  // direction, clean up (t487's probe pattern)
  const mcWorkdir = `${process.env.CRYOFLOW_DATA_DIR}/relion/${mcJob.projectId}/motioncorr_${mcJob.id.slice(-8)}`;
  const probe = path.join(mcWorkdir, "topaz_training.txt");
  const created = !existsSync(probe);
  try {
    writeFileSync(
      probe,
      [
        "## epoch 1, loss=0.90, precision=0.40, recall=0.35",
        "## epoch 2, loss=0.62, precision=0.58, recall=0.52",
        "## epoch 3, loss=0.51, precision=0.68, recall=0.63",
        "",
      ].join("\n")
    );
    const t = await loadTopazTraining(mcJob.id);
    ok(
      t.interpretation != null &&
        t.interpretation.lossDirection === "falling" &&
        t.interpretation.firstEpoch.trainLoss === 0.9 &&
        t.interpretation.lastEpoch.trainLoss === 0.51 &&
        t.interpretation.lastEpoch.precision === 0.68,
      "topaz: the strip reads 0.9 → 0.51 falling with the last epoch's P — from the well"
    );
  } finally {
    if (created && existsSync(probe)) unlinkSync(probe);
  }
  ok(!created || !existsSync(probe), "the probe log is cleaned up — the fixture workdir is left as found");
} else {
  fail++;
  console.log("  FAIL skipped T6 for missing fixtures");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

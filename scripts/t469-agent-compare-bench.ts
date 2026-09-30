/**
 * t469 — the agent reads the PAIR VERDICT (compare_jobs, the 16th tool).
 *
 * The compare dialog (t439 CTF / t440 Motion / t453 Class) is the UI's
 * own door onto "did my new params help". This bench pins the agent's
 * door to the SAME furniture: the shared join/deltas/verdict/movers
 * brain (lib/paired-compare.ts), the domains' own lenses and word laws
 * (ctf/motion/class-compare.ts), and the ONE row grammar
 * (lib/compare-rows.ts — the same functions the ctf/motion routes now
 * call). No private brain, no private read path.
 *
 * Fixture ore: real star files in temp workdirs (the same parsers the
 * routes speak), seeded through the engine's own run registry.
 *
 * Run: bun run scripts/t469-agent-compare-bench.ts
 */

import { execSync } from "child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

/* ------------------------------------------------------------------ */
/* Isolated world FIRST — env before any src import                     */
/* ------------------------------------------------------------------ */

const TMP = mkdtempSync(path.join(os.tmpdir(), "t469-compare-"));
const DATA_DIR = path.join(TMP, "data");
const DB_PATH = path.join(TMP, "test.db");
mkdirSync(DATA_DIR, { recursive: true });
process.env.CRYOFLOW_DATA_DIR = DATA_DIR;
process.env.DATABASE_URL = `file:${DB_PATH}`;
process.env.CRYOFLOW_DISABLE_BUILTIN_AI = "1";
execSync("bunx prisma db push --skip-generate", {
  cwd: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  env: { ...process.env, DATABASE_URL: `file:${DB_PATH}` },
  stdio: "pipe",
});

let pass = 0;
let fail = 0;
const must = (cond: boolean, name: string) => {
  if (cond) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}`);
  }
};

/** The compare_jobs detail shape the assertions read (the tool's own
 *  contract; unknown on AiToolResult so the bench narrows once here). */
interface CompareDetail {
  domain?: string;
  lens?: string;
  verdict?: { improved: number; regressed: number; tied: number; medianDelta: number };
  movers?: { improvers: { name: string; delta: number }[]; regressors: { name: string; delta: number }[] };
  unpaired?: { onlyA: number; onlyB: number };
  trustLine?: string | null;
  verdictText?: string;
}
const detail = (r: { detail?: unknown }): CompareDetail => (r.detail ?? {}) as CompareDetail;


/* ------------------------------------------------------------------ */
/* Imports (after env)                                                 */
/* ------------------------------------------------------------------ */

const { executeAiTool, AI_TOOLS } = await import("../src/lib/ai/tools");
const { buildSystemPrompt } = await import("../src/lib/ai/prompt");
const { db } = await import("../src/lib/db");
const { upsertRun } = await import("../src/lib/relion/engine");
const {
  joinByName,
  pairedDeltas,
  verdict,
  topMovers,
  fmtDelta,
  pairVerdictText,
  DEFAULT_WORDS,
} = await import("../src/lib/paired-compare");
const { CTF_LENSES } = await import("../src/lib/ctf-compare");
const { ctfMicrographRows } = await import("../src/lib/compare-rows");
const { CLASS_WORDS } = await import("../src/lib/class-compare");

/* ------------------------------------------------------------------ */
/* T1. the catalog wears the pair read                                  */
/* ------------------------------------------------------------------ */

console.log("T1. the catalog wears the pair read");

const compareTool = AI_TOOLS.find((t) => t.name === "compare_jobs");
must(compareTool != null, "T1a: compare_jobs is in the catalog (the 16th tool)");
must(
  AI_TOOLS.length === 28 && new Set(AI_TOOLS.map((t) => t.name)).size === 28,
  `T1b: 28 unique tools — t512's environment read is the newest birth (got ${AI_TOOLS.length})`,
);
const compareParams = (compareTool?.parameters ?? {}) as {
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: unknown;
};
must(
  compareParams.required?.length === 2 &&
    compareParams.required.includes("job_a") &&
    compareParams.required.includes("job_b") &&
    compareParams.additionalProperties === false &&
    compareParams.properties?.lens != null,
  "T1c: the schema requires both job ids, takes an optional lens, nothing else",
);
must(
  /compare dialog/i.test(compareTool?.description ?? "") &&
    /ctffind|motioncorr|class2d/i.test(compareTool?.description ?? "") &&
    /READ/i.test(compareTool?.description ?? ""),
  "T1d: the description names the dialog's brain, the three domains and the READ law",
);

/* ------------------------------------------------------------------ */
/* Fixture workdirs — real star files, the routes' own ore              */
/* ------------------------------------------------------------------ */

const ctfStar = (rows: string[]): string =>
  [
    "data_optics",
    "loop_",
    "_rlnOpticsGroup",
    "1",
    "",
    "data_micrographs",
    "loop_",
    "_rlnMicrographName #1",
    "_rlnDefocusU #2",
    "_rlnDefocusV #3",
    "_rlnCtfAstigmatism #4",
    "_rlnCtfFigureOfMerit #5",
    "_rlnCtfMaxResolution #6",
    ...rows,
    "",
  ].join("\n");

// fom verdict: 2 improved (mic_001 +0.05, mic_003 +0.05), 1 tied, 1 regressed (mic_004 −0.05)
// median of [0.05, 0, 0.05, −0.05] = +0.025; mic_005 only in A, mic_006 only in B
const CTF_A = ctfStar([
  "mic_001.mrc 1.0 1.0 0.10 0.80 5.5",
  "mic_002.mrc 1.2 1.1 0.10 0.75 6.0",
  "mic_003.mrc 1.4 1.2 0.20 0.60 7.0",
  "mic_004.mrc 1.6 1.5 0.10 0.50 8.0",
  "mic_005.mrc 1.8 1.7 0.10 0.55 9.0",
]);
const CTF_B = ctfStar([
  "mic_001.mrc 1.0 1.0 0.10 0.85 5.0",
  "mic_002.mrc 1.2 1.1 0.10 0.75 6.0",
  "mic_003.mrc 1.4 1.2 0.20 0.65 6.5",
  "mic_004.mrc 1.6 1.5 0.10 0.45 8.5",
  "mic_006.mrc 1.9 1.8 0.10 0.70 5.8",
]);

const motionStar = (rows: string[]): string =>
  [
    "data_optics",
    "loop_",
    "_rlnOpticsGroup",
    "1",
    "",
    "data_micrographs",
    "loop_",
    "_rlnMicrographName #1",
    "_rlnAccumMotionTotal #2",
    "_rlnAccumMotionEarly #3",
    "_rlnAccumMotionLate #4",
    ...rows,
    "",
  ].join("\n");

// total drift, lower is better: 1 improved (−2.00), 1 tied, 1 regressed (+2.00)
const MOTION_A = motionStar([
  "mic_001.mrc 10.00 6.00 4.00",
  "mic_002.mrc 20.00 12.00 8.00",
  "mic_003.mrc 30.00 15.00 15.00",
]);
const MOTION_B = motionStar([
  "mic_001.mrc 8.00 5.00 3.00",
  "mic_002.mrc 22.00 12.00 10.00",
  "mic_003.mrc 30.00 15.00 15.00",
]);

const classStar = (rows: string[]): string =>
  [
    "data_particles",
    "loop_",
    "_rlnImageName #1",
    "_rlnClassNumber #2",
    ...rows,
    "",
  ].join("\n");

const modelStar = [
  "data_model_classes",
  "loop_",
  "_rlnClassNumber #1",
  "_rlnEstimatedResolution #2",
  "1 7.5",
  "2 8.0",
  "3 9.0",
  "",
].join("\n");

// occupancy, % points: Class 001 50→20 (−30, lost), Class 002 30→60 (+30, gained), Class 003 20→20 (held)
const CLASS_A = classStar([
  "000001@particles.star 1",
  "000002@particles.star 1",
  "000003@particles.star 1",
  "000004@particles.star 1",
  "000005@particles.star 1",
  "000006@particles.star 2",
  "000007@particles.star 2",
  "000008@particles.star 2",
  "000009@particles.star 3",
  "000010@particles.star 3",
]);
const CLASS_B = classStar([
  "000001@particles.star 1",
  "000002@particles.star 1",
  "000003@particles.star 2",
  "000004@particles.star 2",
  "000005@particles.star 2",
  "000006@particles.star 2",
  "000007@particles.star 2",
  "000008@particles.star 2",
  "000009@particles.star 3",
  "000010@particles.star 3",
]);

function makeWorkdir(name: string, files: Record<string, string>): string {
  const wd = path.join(TMP, name);
  mkdirSync(wd, { recursive: true });
  for (const [f, body] of Object.entries(files)) {
    writeFileSync(path.join(wd, f), body);
  }
  return wd;
}

const ctfAwd = makeWorkdir("ctf_a", { "micrographs_ctf.star": CTF_A });
const ctfBwd = makeWorkdir("ctf_b", { "micrographs_ctf.star": CTF_B });
const motAwd = makeWorkdir("motion_a", { "corrected_micrographs.star": MOTION_A });
const motBwd = makeWorkdir("motion_b", { "corrected_micrographs.star": MOTION_B });
const clsAwd = makeWorkdir("class_a", {
  "run_it001_data.star": CLASS_A,
  "run_it001_model.star": modelStar,
});
const clsBwd = makeWorkdir("class_b", {
  "run_it001_data.star": CLASS_B,
  "run_it001_model.star": modelStar,
});

/* ------------------------------------------------------------------ */
/* Seed the world — the runs registry points at the fixtures            */
/* ------------------------------------------------------------------ */

const project = await db.project.create({ data: { name: "t469 pair verdict" } });
const ctx = { projectId: project.id };

async function seedJob(data: {
  type: string;
  name: string;
  status: string;
  workdir?: string;
}) {
  const job = await db.job.create({
    data: { projectId: project.id, params: "{}", x: 0, y: 0, type: data.type, name: data.name, status: data.status },
  });
  if (data.workdir) {
    upsertRun(job.id, {
      jobId: job.id,
      projectId: project.id,
      type: data.type,
      pid: null,
      cmd: "bench",
      workdir: data.workdir,
      logFile: path.join(data.workdir, "run.out"),
      errFile: path.join(data.workdir, "run.err"),
      startedAt: new Date().toISOString(),
      outputs: {},
      done: true,
      exitCode: 0,
    });
  }
  return job;
}

const ctfA = await seedJob({ type: "ctffind", name: "CTF Run A", status: "completed", workdir: ctfAwd });
const ctfB = await seedJob({ type: "ctffind", name: "CTF Run B", status: "completed", workdir: ctfBwd });
const motA = await seedJob({ type: "motioncorr", name: "Motion Run A", status: "completed", workdir: motAwd });
const motB = await seedJob({ type: "motioncorr", name: "Motion Run B", status: "completed", workdir: motBwd });
const clsA = await seedJob({ type: "class2d", name: "Class Run A", status: "completed", workdir: clsAwd });
const clsB = await seedJob({ type: "class2d", name: "Class Run B", status: "completed", workdir: clsBwd });
const ctfRunning = await seedJob({ type: "ctffind", name: "CTF Run Live", status: "running" });
const postX = await seedJob({ type: "postprocess", name: "Post X", status: "completed" });
const postY = await seedJob({ type: "postprocess", name: "Post Y", status: "completed" });

/* ------------------------------------------------------------------ */
/* T2. the honest refusals                                              */
/* ------------------------------------------------------------------ */

console.log("T2. the honest refusals");

{
  const r = await executeAiTool("compare_jobs", {}, ctx);
  must(r.ok === false && r.summary.includes("BOTH job ids"), "T2a: no ids → the refusal names the fix");
  const bogus = await executeAiTool("compare_jobs", { job_a: "no-such", job_b: ctfA.id }, ctx);
  must(
    bogus.ok === false && bogus.summary.includes("get_workflow_state"),
    "T2b: a bogus id refuses and points at the state read",
  );
  const self = await executeAiTool("compare_jobs", { job_a: ctfA.id, job_b: ctfA.id }, ctx);
  must(
    self.ok === false && self.summary.includes("cannot pair with itself"),
    "T2c: a run cannot pair with itself — the refusal says so",
  );
  const mixed = await executeAiTool("compare_jobs", { job_a: ctfA.id, job_b: motA.id }, ctx);
  must(
    mixed.ok === false &&
      mixed.summary.includes("ctffind") &&
      mixed.summary.includes("motioncorr") &&
      mixed.summary.includes("class2d"),
    "T2d: cross-stage pairs refuse and name both types + the domain canon",
  );
  const noDomain = await executeAiTool("compare_jobs", { job_a: postX.id, job_b: postY.id }, ctx);
  must(
    noDomain.ok === false && noDomain.summary.includes("do not share a compare domain"),
    "T2e: a type with no compare domain refuses honestly",
  );
  const running = await executeAiTool("compare_jobs", { job_a: ctfA.id, job_b: ctfRunning.id }, ctx);
  must(
    running.ok === false && running.summary.includes("running") && running.summary.includes("CTF Run Live"),
    "T2f: a running member refuses — the door guard speaks the status",
  );
}

/* ------------------------------------------------------------------ */
/* T3. the CTF verdict — the dialog's own numbers, in the agent's face  */
/* ------------------------------------------------------------------ */

console.log("T3. the CTF verdict");

{
  const r = await executeAiTool("compare_jobs", { job_a: ctfA.id, job_b: ctfB.id }, ctx);
  must(r.ok === true && detail(r)?.domain === "ctf" && detail(r)?.lens === "fom", "T3a: the default lens is fom");
  must(
    r.summary.includes("4 paired · 2 improved / 1 regressed / 1 unchanged"),
    "T3b: the summary speaks the verdict counts in the domain's words",
  );
  must(
    Math.abs((detail(r)?.verdict?.medianDelta ?? NaN) - 0.025) < 1e-9,
    "T3c: the median delta is +0.025 (the numpy median of [−0.05, 0, 0.05, 0.05])",
  );
  const improvers = (detail(r)?.movers?.improvers ?? []).map((d: { name: string }) => d.name);
  const regressors = (detail(r)?.movers?.regressors ?? []).map((d: { name: string }) => d.name);
  must(
    [...improvers].sort().join("|") === "mic_001.mrc|mic_003.mrc" &&
      JSON.stringify(regressors) === JSON.stringify(["mic_004.mrc"]),
    "T3d: the movers are NAMED — the two improvers and the one regressor, magnitude-first",
    // (the improvers' ORDER is float dust at the last bit — 0.65−0.60 vs
    // 0.85−0.80 differ past the 15th digit — so the tie is asserted as a
    // set; the magnitude-first ordering itself is pinned by T6c against
    // the core's own topMovers)
  );
  must(
    detail(r)?.unpaired?.onlyA === 1 && detail(r)?.unpaired?.onlyB === 1,
    "T3e: unpaired rows are counted, never folded in (PAIRED OR SILENT)",
  );
  must(
    typeof detail(r)?.trustLine === "string" &&
      (detail(r)?.trustLine ?? "").includes("Defocus agreement") &&
      (detail(r)?.trustLine ?? "").includes("0.000 µm") &&
      (detail(r)?.trustLine ?? "").includes("4 paired micrographs"),
    "T3f: the trust line is the dialog's own defocus-agreement sentence",
  );
  must(
    typeof detail(r)?.verdictText === "string" &&
      (detail(r)?.verdictText ?? "").includes("CTF A/B") &&
      (detail(r)?.verdictText ?? "").includes(`Median delta ${fmtDelta(0.025, 3)}`) &&
      (detail(r)?.verdictText ?? "").includes("Unpaired (cannot vote): 1 only in A · 1 only in B."),
    "T3g: the verdict text speaks the block — headline, median, non-voters",
  );
  const maxres = await executeAiTool("compare_jobs", { job_a: ctfA.id, job_b: ctfB.id, lens: "maxres" }, ctx);
  must(
    maxres.ok === true && detail(maxres)?.lens === "maxres" &&
      detail(maxres)?.verdict?.improved === 2 && detail(maxres)?.verdict?.regressed === 1,
    "T3h: the lens override speaks — maxres (lower is better) reads the same electorate",
  );
  const bogusLens = await executeAiTool("compare_jobs", { job_a: ctfA.id, job_b: ctfB.id, lens: "sharpen" }, ctx);
  must(
    bogusLens.ok === false && bogusLens.summary.includes("fom|maxres|astig"),
    "T3i: a bogus lens refuses by naming the domain's lenses",
  );
}

/* ------------------------------------------------------------------ */
/* T4. the Motion verdict — lower is better, Ångström dialect           */
/* ------------------------------------------------------------------ */

console.log("T4. the Motion verdict");

{
  const r = await executeAiTool("compare_jobs", { job_a: motA.id, job_b: motB.id }, ctx);
  must(
    r.ok === true && detail(r)?.domain === "motion" && r.summary.includes("1 improved / 1 regressed / 1 unchanged"),
    "T4a: the motion verdict counts improved/regressed by the lens's own direction (less is better)",
  );
  must(
    (detail(r)?.movers?.improvers ?? [])[0]?.delta === -2 &&
      (detail(r)?.movers?.regressors ?? [])[0]?.delta === 2,
    "T4b: B's quieter micrograph improved (delta −2.00), the shakier regressed (+2.00)",
  );
  must(
    typeof detail(r)?.verdictText === "string" &&
      (detail(r)?.verdictText ?? "").includes("lower is better") &&
      (detail(r)?.verdictText ?? "").includes(" Å"),
    "T4c: the text says the direction and the Å unit (t469's unit fix rides along)",
  );
  must(detail(r)?.trustLine === null, "T4d: motion has no trust line — the count chips are its health");
}

/* ------------------------------------------------------------------ */
/* T5. the Class verdict — occupancy speaks gained/lost/held            */
/* ------------------------------------------------------------------ */

console.log("T5. the Class verdict");

{
  const r = await executeAiTool("compare_jobs", { job_a: clsA.id, job_b: clsB.id }, ctx);
  must(
    r.ok === true && r.summary.includes("1 gained / 1 lost / 1 held"),
    "T5a: the occupancy verdict speaks the population's words, not quality's",
  );
  const gained = (detail(r)?.movers?.improvers ?? [])[0];
  const lost = (detail(r)?.movers?.regressors ?? [])[0];
  must(
    gained?.name === "Class 002" && gained?.delta === 30 && lost?.name === "Class 001" && lost?.delta === -30,
    "T5b: Class 002 gained 30 points, Class 001 lost 30 — the names are the RELION dialect",
  );
  must(
    typeof detail(r)?.trustLine === "string" &&
      (detail(r)?.trustLine ?? "").includes("Concentration census") &&
      (detail(r)?.trustLine ?? "").includes("across 3 paired classes"),
    "T5c: the census is the class domain's health check",
  );
  must(
    typeof detail(r)?.verdictText === "string" &&
      (detail(r)?.verdictText ?? "").includes("Class 002 (+30.0%)") &&
      (detail(r)?.verdictText ?? "").includes("Class 001 (−30.0%)"),
    "T5d: the verdict text names the movers with fmtDelta signs — the sign IS the news",
  );
}

/* ------------------------------------------------------------------ */
/* T6. no private brain — the tool's verdict IS the lib's verdict       */
/* ------------------------------------------------------------------ */

console.log("T6. no private brain");

{
  const r = await executeAiTool("compare_jobs", { job_a: ctfA.id, job_b: ctfB.id }, ctx);
  const rowsA = ctfMicrographRows(ctfAwd);
  const rowsB = ctfMicrographRows(ctfBwd);
  const join = joinByName(rowsA, rowsB);
  const deltas = pairedDeltas(join.pairs, CTF_LENSES.fom);
  const v = verdict(deltas);
  const movers = topMovers(deltas);
  must(
    JSON.stringify(detail(r)?.verdict) === JSON.stringify(v),
    "T6a: the tool's verdict equals joinByName+pairedDeltas+verdict recomputed from the shared rows",
  );
  const text = pairVerdictText({
    domainLabel: "CTF",
    nameA: ctfA.name,
    nameB: ctfB.name,
    lensLabel: CTF_LENSES.fom.label,
    unit: CTF_LENSES.fom.unit,
    digits: CTF_LENSES.fom.digits,
    higherIsBetter: CTF_LENSES.fom.higherIsBetter,
    words: DEFAULT_WORDS,
    verdict: v,
    movers,
    onlyA: join.onlyA,
    onlyB: join.onlyB,
  });
  must(
    detail(r)?.verdictText === text,
    "T6b: the verdict text is the pure face's text, byte for byte",
  );
  must(
    JSON.stringify(detail(r)?.movers?.improvers) ===
      JSON.stringify(movers.improvers.map((d: { name: string; a: number; b: number; delta: number }) => ({ name: d.name, a: d.a, b: d.b, delta: d.delta }))),
    "T6c: the movers are the core's topMovers, not a private ranking",
  );
  must(CLASS_WORDS.better === "gained" && CLASS_WORDS.same === "held", "T6d: the word laws stay the domain modules' own");
}

/* ------------------------------------------------------------------ */
/* T7. the prompt wears THE COMPARE LAW                                 */
/* ------------------------------------------------------------------ */

console.log("T7. the prompt wears THE COMPARE LAW");

{
  const prompt = buildSystemPrompt({ projectName: "t469", projectMode: "local", projectRemote: null, jobCount: 8 });
  must(
    prompt.includes("THE COMPARE LAW") && prompt.includes("compare_jobs(job_a, job_b)"),
    "T7a: THE COMPARE LAW is in the doctrine with the tool's own signature",
  );
  must(
    /QUESTIONS ARE READS[\s\S]*compare_jobs/.test(prompt),
    "T7b: the reads law lists compare_jobs among the reads",
  );
  must(
    prompt.includes("gained/lost/held for class occupancy") &&
      prompt.includes("NEVER compute deltas"),
    "T7c: the law teaches the vocabulary split and forbids private arithmetic",
  );
  must(
    prompt.includes("compare_jobs (A/B verdicts between finished runs)"),
    "T7d: the end-to-end recipe offers the pair verdict on results",
  );
}

/* ------------------------------------------------------------------ */

console.log(`\nt469 — ${pass} ok, ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);

/**
 * t470 — the agent reads the SETTLED QUESTION (check_convergence, the 17th tool).
 *
 * The convergence family's two faces (t454 class census, t456/t459 arc)
 * compare ONE run with ITSELF. This bench pins the agent's door to the
 * SAME furniture: the dialog's census chain (joinByName + pairedDeltas +
 * movingCensus + pairVerdictText), the resolution-arc route's own scan
 * (now lib/convergence-rows.ts), and the plateau law — no private brain,
 * no private read path (t419 law, fourth read tool).
 *
 * Fixture ore: real star files in temp workdirs, seeded through the
 * engine's own run registry (the t469 scaffolding).
 *
 * Run: bun run scripts/t470-convergence-tool-bench.ts
 */

import { execSync } from "child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

/* ------------------------------------------------------------------ */
/* Isolated world FIRST — env before any src import                     */
/* ------------------------------------------------------------------ */

const TMP = mkdtempSync(path.join(os.tmpdir(), "t470-convergence-"));
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

/** The check_convergence detail shape the assertions read (the tool's own
 *  contract; unknown on AiToolResult so the bench narrows once here). */
interface ConvDetail {
  dialect?: string;
  noun?: string;
  rounds?: number[];
  pair?: { a: number; b: number };
  census?: {
    verdict: { improved: number; regressed: number; tied: number; medianDelta: number };
    movers: { improvers: { name: string; delta: number }[]; regressors: { name: string; delta: number }[] };
    unpaired: { onlyA: number; onlyB: number };
    censusLine: string | null;
    censusText: string;
  } | null;
  arc?: {
    points: number;
    from: { iteration: number; resolution: number };
    to: { iteration: number; resolution: number };
    best: { iteration: number; resolution: number };
    verdictWord: string | null;
    verdictDetail: string | null;
    summary: string;
    biggestJump: { from: number; to: number; delta: number } | null;
    estimateLabel: string;
  } | null;
}
const detail = (r: { detail?: unknown }): ConvDetail => (r.detail ?? {}) as ConvDetail;

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
  pairVerdictText,
} = await import("../src/lib/paired-compare");
const { CLASS_LENSES, CLASS_WORDS } = await import("../src/lib/class-compare");
const { movingCensus } = await import("../src/lib/convergence");
const {
  arcPresentationOf,
  arcSummary,
  arcVerdict,
  resolutionArcOf,
} = await import("../src/lib/resolution-arc");
const {
  roundOccupancy,
  resolutionArcFromWorkdir,
  workdirRounds,
} = await import("../src/lib/convergence-rows");

/* ------------------------------------------------------------------ */
/* T1. the catalog wears the settled read                               */
/* ------------------------------------------------------------------ */

console.log("T1. the catalog wears the settled read");

const convTool = AI_TOOLS.find((t) => t.name === "check_convergence");
must(convTool != null, "T1a: check_convergence is in the catalog (the 17th tool)");
must(
  AI_TOOLS.length === 30 && new Set(AI_TOOLS.map((t) => t.name)).size === 30,
  `T1b: 30 unique tools — t515's products read is the newest birth (got ${AI_TOOLS.length})`,
);
const convParams = (convTool?.parameters ?? {}) as {
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: unknown;
};
must(
  convParams.required?.length === 1 &&
    convParams.required.includes("job_id") &&
    convParams.additionalProperties === false &&
    convParams.properties?.round_a != null &&
    convParams.properties?.round_b != null,
  "T1c: the schema requires job_id, takes optional round_a/round_b, nothing else",
);
must(
  /convergence dialog/i.test(convTool?.description ?? "") &&
    /resolution.arc dialog|plateau/i.test(convTool?.description ?? "") &&
    /READ/i.test(convTool?.description ?? "") &&
    /whole arc/i.test(convTool?.description ?? "") &&
    /compare_jobs/i.test(convTool?.description ?? ""),
  "T1d: the description names the dialogs' brains, the READ law, the whole-arc default and the compare_jobs hand-off",
);

/* ------------------------------------------------------------------ */
/* Fixture star grammars — the real files' own dialects                 */
/* ------------------------------------------------------------------ */

/** The particles loop the occupancy grammar reads (_rlnClassNumber). */
const dataStar = (rows: string[]): string =>
  [
    "data_particles",
    "loop_",
    "_rlnImageName #1",
    "_rlnClassNumber #2",
    ...rows,
    "",
  ].join("\n");

const particleRows = (counts: number[]): string[] => {
  const rows: string[] = [];
  counts.forEach((n, i) => {
    for (let k = 1; k <= n; k++) {
      rows.push(`${String(rows.length + 1).padStart(6, "0")}@particles.star ${i + 1}`);
    }
  });
  return rows;
};

/** data_model_general pair — parseCurrentResolution's findPair ore.
 *  Real STAR pairs speak `key value` on ONE line — the grammar the
 *  route's own scan reads. */
const modelStar = (res: number): string =>
  ["data_model_general", `_rlnCurrentResolution ${res.toFixed(2)}`, ""].join("\n");

/** A data star with NO class loop — the dead round (mid-write ore). */
const deadStar = ["data_root", "loop_", "_rlnSomething", "1", ""].join("\n");

function makeWorkdir(name: string, files: Record<string, string>): string {
  const wd = path.join(TMP, name);
  mkdirSync(wd, { recursive: true });
  for (const [f, body] of Object.entries(files)) {
    writeFileSync(path.join(wd, f), body);
  }
  return wd;
}

/* Occupancy design (50 particles, 5 classes, pp = share × 100):
 *   it000: 10/10/10/10/10 (each 20%)
 *   it005:  9/12/10/10/9  (18/24/20/20/18)
 *   it010:  9/12/10/10/9  (identical to it005 — settled tail)
 * Default pair 000→010: Class 002 +4.0pp, 001/005 −2.0pp, 003/004 tied
 *   → 3 of 5 moved > 1.0 pp → "still re-shuffling"; 1 gained / 2 lost / 2 held.
 * Pair 005→010: all tied → 0 movers → "the assignment has settled". */
const occ000 = [10, 10, 10, 10, 10];
const occTail = [9, 12, 10, 10, 9];

const clsWd = makeWorkdir("conv_cls", {
  "run_it000_data.star": dataStar(particleRows(occ000)),
  "run_it000_model.star": modelStar(28.0),
  "run_it005_data.star": dataStar(particleRows(occTail)),
  "run_it005_model.star": modelStar(9.5),
  "run_it010_data.star": dataStar(particleRows(occTail)),
  "run_it010_model.star": modelStar(7.2),
});
const oneWd = makeWorkdir("conv_one", {
  "run_it000_data.star": dataStar(particleRows(occ000)),
});
const deadWd = makeWorkdir("conv_dead", {
  "run_it000_data.star": dataStar(particleRows(occ000)),
  "run_it003_data.star": deadStar,
});
const bareWd = makeWorkdir("conv_bare", {
  "run_it000_data.star": dataStar(particleRows(occ000)),
  "run_it005_data.star": dataStar(particleRows(occTail)),
});
/* Gold arcs — half1 model stars. Plateau: the last three moves all under
 * 0.3 Å. Improving: the last move at/above the threshold. */
const half1 = (wd: string, rounds: [number, number][]) => {
  for (const [it, res] of rounds) {
    writeFileSync(path.join(wd, `run_it${String(it).padStart(3, "0")}_half1_model.star`), modelStar(res));
  }
};
const plateauWd = path.join(TMP, "conv_ref_plateau");
mkdirSync(plateauWd, { recursive: true });
half1(plateauWd, [
  [0, 28.0],
  [4, 10.0],
  [8, 9.85],
  [12, 9.7],
  [16, 9.6],
]);
const gainWd = path.join(TMP, "conv_ref_gain");
mkdirSync(gainWd, { recursive: true });
/* 11.85 − 11.45 = 0.4 Å beyond dust (a 0.35 boundary would flirts with
 * toFixed rounding) — the sharpening tail must be unambiguous. */
half1(gainWd, [
  [0, 28.0],
  [4, 12.0],
  [8, 11.85],
  [12, 11.45],
]);

/* ------------------------------------------------------------------ */
/* Seed the world — the runs registry points at the fixtures            */
/* ------------------------------------------------------------------ */

const project = await db.project.create({ data: { name: "t470 settled read" } });
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

const cls = await seedJob({ type: "class2d", name: "Class Converge", status: "completed", workdir: clsWd });
const one = await seedJob({ type: "class2d", name: "One Round", status: "completed", workdir: oneWd });
const dead = await seedJob({ type: "class3d", name: "Dead Round", status: "completed", workdir: deadWd });
const bare = await seedJob({ type: "refine3d", name: "Bare Refine", status: "completed", workdir: bareWd });
const plateau = await seedJob({ type: "refine3d", name: "Plateau Refine", status: "completed", workdir: plateauWd });
const gain = await seedJob({ type: "refine3d", name: "Gain Refine", status: "completed", workdir: gainWd });
const cold = await seedJob({ type: "class2d", name: "Cold Class2D", status: "completed" });
const running = await seedJob({ type: "refine3d", name: "Live Refine", status: "running", workdir: plateauWd });
const postX = await seedJob({ type: "postprocess", name: "Post X", status: "completed" });

/* ------------------------------------------------------------------ */
/* T2. the honest refusals                                              */
/* ------------------------------------------------------------------ */

console.log("T2. the honest refusals");

{
  const r = await executeAiTool("check_convergence", {}, ctx);
  must(r.ok === false && r.summary.includes("needs a job id"), "T2a: no id → the refusal names the fix");
  const bogus = await executeAiTool("check_convergence", { job_id: "no-such" }, ctx);
  must(
    bogus.ok === false && bogus.summary.includes("get_workflow_state"),
    "T2b: a bogus id refuses and points at the state read",
  );
  const wrongType = await executeAiTool("check_convergence", { job_id: postX.id }, ctx);
  must(
    wrongType.ok === false && wrongType.summary.includes("the convergence family speaks") && wrongType.summary.includes("postprocess"),
    "T2c: a non-arc type refuses and names the family (refine3d gold, class2d/class3d serial)",
  );
  const live = await executeAiTool("check_convergence", { job_id: running.id }, ctx);
  must(
    live.ok === false && live.summary.includes("SETTLED rounds") && live.summary.includes("running"),
    "T2d: a running run refuses — its rounds are still being written",
  );
  const icy = await executeAiTool("check_convergence", { job_id: cold.id }, ctx);
  must(
    icy.ok === false && icy.summary.includes("no iteration rounds"),
    "T2e: a cold mirror refuses honestly (no run_itNNN_data.star landed)",
  );
  const lonely = await executeAiTool("check_convergence", { job_id: one.id }, ctx);
  must(
    lonely.ok === false && lonely.summary.includes("only one settled round (Round 000)"),
    "T2f: a one-round run refuses — the dialog's own notice",
  );
  const offLadder = await executeAiTool("check_convergence", { job_id: cls.id, round_a: 3 }, ctx);
  must(
    offLadder.ok === false &&
      offLadder.summary.includes("Round 003 is not one of this run's rounds") &&
      offLadder.summary.includes("Round 000, Round 005, Round 010"),
    "T2g: an off-ladder round refuses and names the whole ladder",
  );
  const selfPair = await executeAiTool("check_convergence", { job_id: cls.id, round_a: 0, round_b: 0 }, ctx);
  must(
    selfPair.ok === false && selfPair.summary.includes("two DISTINCT rounds"),
    "T2h: a round paired with itself refuses",
  );
  const corpse = await executeAiTool("check_convergence", { job_id: dead.id }, ctx);
  must(
    corpse.ok === false && corpse.summary.includes("Round 003's data star holds no class rows"),
    "T2i: a dead round refuses — the census never guesses a mid-write round",
  );
  const bareRead = await executeAiTool("check_convergence", { job_id: bare.id }, ctx);
  must(
    bareRead.ok === false && bareRead.summary.includes("no model stars with _rlnCurrentResolution"),
    "T2j: a gold run without model stars refuses — the arc reads, never invents",
  );
  const slicedArc = await executeAiTool(
    "check_convergence",
    { job_id: plateau.id, round_a: 0, round_b: 4 },
    ctx,
  );
  must(
    slicedArc.ok === false &&
      slicedArc.summary.includes("WHOLE journey") &&
      slicedArc.summary.includes("round pairs are the classification census's question"),
    "T2k: a gold run refuses round pairs — the plateau law watches the whole tail",
  );
}

/* ------------------------------------------------------------------ */
/* T3. the census (serial default — the whole arc)                      */
/* ------------------------------------------------------------------ */

console.log("T3. the census reads the whole arc");

{
  const r = await executeAiTool("check_convergence", { job_id: cls.id }, ctx);
  must(r.ok === true, "T3a: the serial read succeeds on the real workdir");
  const d = detail(r);
  must(
    d.dialect === "serial" && d.noun === "classification" && d.pair?.a === 0 && d.pair?.b === 10,
    "T3b: the default pair IS the run's whole arc (Round 000 vs Round 010)",
  );
  must(
    d.census?.verdict.improved === 1 &&
      d.census.verdict.regressed === 2 &&
      d.census.verdict.tied === 2,
    "T3c: the verdict counts speak gained/lost/held (1/2/2)",
  );
  must(
    d.census?.censusLine?.includes("3 of 5 classes moved more than 1.0 pp between Round 000 and Round 010") === true &&
      d.census.censusLine?.includes("(biggest: Class 002, +4.0 pp)") === true &&
      d.census.censusLine?.endsWith("the assignment is still re-shuffling.") === true,
    "T3d: the census line names the movers and the ending (still re-shuffling)",
  );
  must(
    d.census?.censusText.startsWith('Class occupancy A/B — "Round 000" vs "Round 010"') === true,
    "T3e: the census text face is pairVerdictText's own grammar (Round labels as names)",
  );
  must(
    d.census?.movers.improvers[0]?.name === "Class 002" &&
      Math.abs(d.census.movers.improvers[0].delta - 4.0) < 1e-9,
    "T3f: the biggest gain is named with its pp delta (Class 002, +4.0)",
  );
  must(
    r.summary.includes('"Class Converge" classification — 1 gained / 2 lost / 2 held between Round 000 and Round 010 (the assignment is still re-shuffling)') &&
      r.summary.includes("arc 28.0 Å → 7.2 Å over 3 rounds — best 7.2 Å at Round 010 (still improving)"),
    "T3g: the summary composes census + arc in the domain's own words",
  );
}

/* ------------------------------------------------------------------ */
/* T4. the round overrides — ask any two of the run's own rounds        */
/* ------------------------------------------------------------------ */

console.log("T4. the round overrides");

{
  const tail = await executeAiTool("check_convergence", { job_id: cls.id, round_a: 5, round_b: 10 }, ctx);
  must(
    tail.ok === true &&
      detail(tail).pair?.a === 5 &&
      detail(tail).pair?.b === 10 &&
      detail(tail).census?.verdict.tied === 5 &&
      detail(tail).census?.censusLine?.endsWith("the assignment has settled.") === true,
    "T4a: a settled tail pair reads 'has settled' (0 movers of 5)",
  );
  const flipped = await executeAiTool("check_convergence", { job_id: cls.id, round_a: 10, round_b: 0 }, ctx);
  must(
    flipped.ok === true && detail(flipped).pair?.a === 0 && detail(flipped).pair?.b === 10,
    "T4b: a reversed pair is normalized to the arc's own direction (earlier, later)",
  );
  const half = await executeAiTool("check_convergence", { job_id: cls.id, round_a: 0 }, ctx);
  must(
    half.ok === true && detail(half).pair?.a === 0 && detail(half).pair?.b === 10,
    "T4c: one given round keeps the other end of the whole arc",
  );
}

/* ------------------------------------------------------------------ */
/* T5. the gold arcs — the plateau law is the refinement's answer       */
/* ------------------------------------------------------------------ */

console.log("T5. the gold arcs");

{
  const p = await executeAiTool("check_convergence", { job_id: plateau.id }, ctx);
  const dp = detail(p);
  must(
    p.ok === true && dp.dialect === "gold" && dp.noun === "refinement" && dp.census === null,
    "T5a: the gold read is arc-only (the dialog never opened a refine3d census)",
  );
  must(
    dp.arc?.points === 5 && dp.arc.verdictWord === "plateaued" && dp.arc.best.resolution === 9.6,
    "T5b: the plateau law speaks (5 points, plateaued, best 9.6 Å)",
  );
  must(
    dp.arc?.summary === "28.0 Å → 9.6 Å over 5 rounds — best 9.6 Å at Round 016" &&
      dp.arc.biggestJump?.from === 0 &&
      dp.arc.biggestJump?.to === 4 &&
      Math.abs(dp.arc.biggestJump.delta - 18.0) < 1e-9,
    "T5c: the arc summary and the biggest jump are the route's own numbers",
  );
  must(
    p.summary.includes('"Plateau Refine" refinement — 28.0 Å → 9.6 Å over 5 rounds — best 9.6 Å at Round 016 (plateaued)'),
    "T5d: the gold summary composes the noun + arc + verdict word",
  );
  const g = await executeAiTool("check_convergence", { job_id: gain.id }, ctx);
  const dg = detail(g);
  must(
    dg.arc?.verdictWord === "still improving" &&
      dg.arc?.verdictDetail?.includes("Round 008 → Round 012 gained 0.4 Å") === true,
    "T5e: a sharpening tail reads 'still improving' with the last move named",
  );
  must(
    dp.arc?.estimateLabel === "FSC 0.143 estimate" &&
      detail(await executeAiTool("check_convergence", { job_id: cls.id }, ctx)).arc?.estimateLabel ===
        "the model's own estimate",
    "T5f: the dialects keep their honest labels (gold FSC vs the model's own)",
  );
}

/* ------------------------------------------------------------------ */
/* T6. no private brain — the tool's numbers ARE the libs' numbers      */
/* ------------------------------------------------------------------ */

console.log("T6. no private brain");

{
  const r = await executeAiTool("check_convergence", { job_id: cls.id }, ctx);
  const d = detail(r);
  const occA = roundOccupancy(clsWd, 0)!;
  const occB = roundOccupancy(clsWd, 10)!;
  const join = joinByName(occA.classes, occB.classes);
  const lens = CLASS_LENSES.share;
  const deltas = pairedDeltas(join.pairs, lens);
  const v = verdict(deltas);
  const movers = topMovers(deltas);
  const censusLine = movingCensus(deltas, { aRound: 0, bRound: 10 });
  const censusText =
    pairVerdictText({
      domainLabel: "Class occupancy",
      nameA: "Round 000",
      nameB: "Round 010",
      lensLabel: lens.label,
      unit: lens.unit,
      digits: lens.digits,
      higherIsBetter: lens.higherIsBetter,
      words: CLASS_WORDS,
      verdict: v,
      movers,
      onlyA: join.onlyA,
      onlyB: join.onlyB,
    }) + (censusLine ? `\n${censusLine}` : "");
  must(
    JSON.stringify(d.census?.verdict) === JSON.stringify(v),
    "T6a: the tool's verdict is the pure brain's verdict (JSON-equal)",
  );
  must(
    d.census?.censusLine === censusLine,
    "T6b: the census line is movingCensus byte-for-byte",
  );
  must(
    d.census?.censusText === censusText,
    "T6c: the census text is pairVerdictText + censusLine byte-for-byte",
  );
  const pureArc = resolutionArcOf(resolutionArcFromWorkdir(clsWd));
  const pureSummary = arcSummary(pureArc);
  const pureWord = arcVerdict(pureArc)?.word ?? null;
  must(
    d.arc?.summary === pureSummary && d.arc?.verdictWord === pureWord,
    "T6d: the arc is the route's own scan + verdict (summary and word equal)",
  );
}

/* ------------------------------------------------------------------ */
/* T7. the prompt wears the CONVERGENCE LAW                             */
/* ------------------------------------------------------------------ */

console.log("T7. the prompt wears the law");

{
  const p = buildSystemPrompt({ projectName: "t470", projectMode: "demo", projectRemote: null, jobCount: 3 });
  must(
    p.includes("THE CONVERGENCE LAW") && p.includes("check_convergence"),
    "T7a: THE CONVERGENCE LAW names the tool",
  );
  must(
    p.includes("收敛了吗") && p.includes("plateau"),
    "T7b: the law speaks the user's phrases (Chinese + English + plateau)",
  );
  must(
    p.includes("one run against itself is check_convergence's question"),
    "T7c: the law draws the compare_jobs boundary verbatim",
  );
  const occurrences = (p.match(/check_convergence/g) ?? []).length;
  must(occurrences >= 3, `T7d: the tool rides law + reads + recipe (got ${occurrences} mentions)`);
}

/* ------------------------------------------------------------------ */
/* T0. the row grammar's own ladder (the lib speaks the route's regex)  */
/* ------------------------------------------------------------------ */

console.log("T0. the ladder grammar");

{
  must(
    JSON.stringify(workdirRounds(clsWd)) === JSON.stringify([0, 5, 10]),
    "T0a: the ladder is ascending and deduped (the iterations route's own list)",
  );
  must(workdirRounds(path.join(TMP, "no-such-dir")).length === 0, "T0b: a missing workdir is an honest empty ladder");
  const occ = roundOccupancy(clsWd, 5)!;
  must(
    occ.classes.length === 5 &&
      occ.total === 50 &&
      Math.abs(occ.classes[1].fraction - 0.24) < 1e-9 &&
      occ.classes[1].name === "Class 002",
    "T0c: one round's occupancy speaks ClassRunRow (count, share, name)",
  );
}

console.log(`\nt470 convergence bench: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

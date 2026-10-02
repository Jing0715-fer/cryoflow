/**
 * t471 — the agent FIRES the convergence verdict (continue_run, the 18th tool).
 *
 * t468 read the ledger, t469 compared the pair, t470 read the settled
 * question — and t470's leftover said it: "判决与动词在对话里接上了，
 * 工具面还差一步". This bench pins the verb to the SAME furniture the
 * UI's continue row fires (t455): checkpointOf → continuePlanOf →
 * continueParamWrites over continueSourcesFor (the picker's own data
 * plane), then startJob on the job's OWN lane — zero private mutation
 * path (t419 law, third write tool).
 *
 * The dispatch is asserted to its honest refusal face (the t419 bench
 * convention — no bench fakes a RELION install): the sandbox has no
 * RELION and no cluster, so startJob answers "RELION not detected" on
 * the local lane and "cluster connection not found" on the job's own
 * cluster lane — and BOTH answers prove the plan was assembled, written
 * through the spec, and handed to the product's own dispatch.
 *
 * Run: bun run scripts/t471-continue-tool-bench.ts
 */

import { execSync } from "child_process";
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

/* ------------------------------------------------------------------ */
/* Isolated world FIRST — env before any src import                     */
/* ------------------------------------------------------------------ */

const TMP = mkdtempSync(path.join(os.tmpdir(), "t471-continue-"));
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

interface ContinueDetail {
  jobId?: string;
  jobName?: string;
  checkpoint?: { round: number; path: string; archived: boolean };
  paramKey?: string;
  currentIter?: number;
  more?: number;
  totalIter?: number;
  clamped?: boolean;
  lane?: string;
  fnCont?: string;
  status?: string;
}
const detail = (r: { detail?: unknown }): ContinueDetail => (r.detail ?? {}) as ContinueDetail;

/* ------------------------------------------------------------------ */
/* Imports (after env)                                                 */
/* ------------------------------------------------------------------ */

const { executeAiTool, AI_TOOLS } = await import("../src/lib/ai/tools");
const { buildSystemPrompt } = await import("../src/lib/ai/prompt");
const { db } = await import("../src/lib/db");
const { upsertRun } = await import("../src/lib/relion/engine");
const { checkpointOf, continuePlanOf, continueParamWrites, iterKnobOf } = await import(
  "../src/lib/convergence-continue"
);
const { continueSourcesFor } = await import("../src/lib/relion/continue-sources");

/* ------------------------------------------------------------------ */
/* T1. the catalog wears the verb                                       */
/* ------------------------------------------------------------------ */

console.log("T1. the catalog wears the verb");

const cont = AI_TOOLS.find((t) => t.name === "continue_run");
must(cont != null, "T1a: continue_run is in the catalog (the 18th tool)");
must(
  AI_TOOLS.length === 33 && new Set(AI_TOOLS.map((t) => t.name)).size === 33,
  `T1b: 33 unique tools — t522's history read is the newest birth (got ${AI_TOOLS.length})`,
);
const contParams = (cont?.parameters ?? {}) as {
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: unknown;
};
must(
  contParams.required?.length === 1 &&
    contParams.required.includes("job_id") &&
    contParams.additionalProperties === false &&
    contParams.properties?.more != null,
  "T1c: the schema requires job_id, takes optional more, nothing else",
);
must(
  /RESUMES/i.test(cont?.description ?? "") &&
    /WIPES/i.test(cont?.description ?? "") &&
    /check_convergence/.test(cont?.description ?? "") &&
    /OWN lane/i.test(cont?.description ?? "") &&
    /auto-refine/i.test(cont?.description ?? ""),
  "T1d: the description names the resume-vs-wipe law, the verdict hand-off, the own-lane law and the auto-refine why",
);

/* ------------------------------------------------------------------ */
/* Fixture workdirs — the optimiser families the completeness law reads */
/* ------------------------------------------------------------------ */

const touch = (wd: string, name: string, body = "data_general\nloop_\n") =>
  writeFileSync(path.join(wd, name), body);

/** A complete class2d round (the plain-model companions, engine law). */
const class2dFamily = (wd: string, it: number) => {
  const p = String(it).padStart(3, "0");
  touch(wd, `run_it${p}_optimiser.star`);
  touch(wd, `run_it${p}_data.star`);
  touch(wd, `run_it${p}_model.star`);
  touch(wd, `run_it${p}_sampling.star`);
  touch(wd, `run_it${p}_classes.mrcs`);
};

const crownWd = path.join(TMP, "cont_crown");
mkdirSync(crownWd, { recursive: true });
class2dFamily(crownWd, 5);
const vdamWd = path.join(TMP, "cont_vdam");
mkdirSync(vdamWd, { recursive: true });
class2dFamily(vdamWd, 10);
const clampWd = path.join(TMP, "cont_clamp");
mkdirSync(clampWd, { recursive: true });
class2dFamily(clampWd, 3);
const remoteWd = path.join(TMP, "cont_remote");
mkdirSync(remoteWd, { recursive: true });
class2dFamily(remoteWd, 7);
const bareWd = path.join(TMP, "cont_bare");
mkdirSync(bareWd, { recursive: true });
touch(bareWd, "run_it005_data.star"); // optimiser never landed
const goneWd = path.join(TMP, "cont_gone"); // never created (wiped/never-ran)
const lockedWd = path.join(TMP, "cont_locked");
mkdirSync(lockedWd, { recursive: true });
class2dFamily(lockedWd, 2);

/* ------------------------------------------------------------------ */
/* Seed the world                                                       */
/* ------------------------------------------------------------------ */

const project = await db.project.create({ data: { name: "t471 continue verb" } });
const ctx = { projectId: project.id };

async function seedJob(data: {
  type: string;
  name: string;
  status: string;
  params?: Record<string, unknown>;
  workdir?: string;
  remote?: Record<string, unknown>;
}) {
  const job = await db.job.create({
    data: {
      projectId: project.id,
      params: JSON.stringify(data.params ?? {}),
      x: 0,
      y: 0,
      type: data.type,
      name: data.name,
      status: data.status,
    },
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
      ...(data.remote ? { remote: data.remote } : {}),
    } as Parameters<typeof upsertRun>[1]);
  }
  return job;
}

const crown = await seedJob({
  type: "class2d",
  name: "Continue Crown",
  status: "completed",
  params: { iterations: "25" },
  workdir: crownWd,
});
const vdam = await seedJob({
  type: "class2d",
  name: "Continue VDAM",
  status: "completed",
  params: { algorithm: "vdam", miniBatches: "200" },
  workdir: vdamWd,
});
const clamp = await seedJob({
  type: "class2d",
  name: "Continue Clamped",
  status: "completed",
  params: { iterations: "48" },
  workdir: clampWd,
});
const remoteJob = await seedJob({
  type: "class2d",
  name: "Continue Remote",
  status: "completed",
  workdir: remoteWd,
  remote: {
    connectionId: "conn-ghost",
    connectionName: "Ghost Cluster",
    host: "gpu01.cluster",
    user: "cryo",
    module: "",
    mode: "direct",
    remoteRoot: "/scratch",
    remoteWorkdir: remoteWd,
    pid: null,
    slurmId: null,
  },
});
const autoRef = await seedJob({
  type: "refine3d",
  name: "Auto Refine",
  status: "completed",
  params: { autoRefine: "true" },
});
const cold = await seedJob({ type: "class2d", name: "Cold Continue", status: "completed" });
const bare = await seedJob({
  type: "class2d",
  name: "Bare Family",
  status: "completed",
  workdir: bareWd,
});
const wiped = await seedJob({
  type: "class2d",
  name: "Wiped Workdir",
  status: "completed",
  workdir: goneWd,
});
const locked = await seedJob({
  type: "class2d",
  name: "Locked Workdir",
  status: "completed",
  workdir: lockedWd,
});
const post = await seedJob({ type: "postprocess", name: "Post X", status: "completed" });
const live = await seedJob({
  type: "class2d",
  name: "Live Continue",
  status: "running",
  workdir: crownWd,
});

// the crown's input door: an import that RAN and produced particles.star
// (the resolver reads the run record's outputs ledger — existsSync gate)
const particlesStar = path.join(TMP, "particles.star");
writeFileSync(particlesStar, "data_particles\nloop_\n\n"); // zero rows → the ref gate steps aside
const imp = await seedJob({ type: "import", name: "Import Source", status: "completed" });
upsertRun(imp.id, {
  jobId: imp.id,
  projectId: project.id,
  type: "import",
  pid: null,
  cmd: "bench",
  workdir: TMP,
  logFile: path.join(TMP, "import.out"),
  errFile: path.join(TMP, "import.err"),
  startedAt: new Date().toISOString(),
  outputs: { particles_star: particlesStar },
  done: true,
  exitCode: 0,
});
await db.edge.create({
  data: { projectId: project.id, fromJobId: imp.id, toJobId: crown.id },
});

/* ------------------------------------------------------------------ */
/* T2. the honest refusals                                              */
/* ------------------------------------------------------------------ */

console.log("T2. the honest refusals");

{
  const r = await executeAiTool("continue_run", {}, ctx);
  must(r.ok === false && r.summary.includes("needs a job id"), "T2a: no id → the refusal names the fix");
  const bogus = await executeAiTool("continue_run", { job_id: "no-such" }, ctx);
  must(
    bogus.ok === false && bogus.summary.includes("Job not found") && bogus.summary.includes("get_workflow_state"),
    "T2b: a bogus id refuses and points at the state read",
  );
  const wrongType = await executeAiTool("continue_run", { job_id: post.id }, ctx);
  must(
    wrongType.ok === false &&
      wrongType.summary.includes("only the refine family") &&
      wrongType.summary.includes("postprocess") &&
      wrongType.summary.includes("fn_cont"),
    "T2c: a non-refine-family type refuses and names the family + fn_cont",
  );
  const running = await executeAiTool("continue_run", { job_id: live.id }, ctx);
  must(
    running.ok === false && running.summary.includes("already running") && running.summary.includes("SETTLED"),
    "T2d: a running run refuses — a continue resumes a settled run",
  );
  const auto = await executeAiTool("continue_run", { job_id: autoRef.id }, ctx);
  must(
    auto.ok === false &&
      auto.summary.includes("auto-refine owns this run's convergence") &&
      auto.summary.includes("manual dialect"),
    "T2e: an auto-refine run refuses — the row's own why, verbatim",
  );
  const icy = await executeAiTool("continue_run", { job_id: cold.id }, ctx);
  must(
    icy.ok === false &&
      icy.summary.includes("could not be read") &&
      icy.summary.includes("has never run"),
    "T2f: a run that never had a workdir speaks the picker's own why (never ran)",
  );
  const bareR = await executeAiTool("continue_run", { job_id: bare.id }, ctx);
  must(
    bareR.ok === false && bareR.summary.includes("No complete checkpoint"),
    "T2g: a data-star-only workdir refuses — the optimiser never landed",
  );
  const wipedR = await executeAiTool("continue_run", { job_id: wiped.id }, ctx);
  must(
    wipedR.ok === false &&
      wipedR.summary.includes("could not be read") &&
      wipedR.summary.includes("wiped"),
    "T2h: a wiped workdir speaks the scan's own fact (notDir → the caller's words)",
  );
  chmodSync(lockedWd, 0o000);
  let lockedR: { ok: boolean; summary: string } | null = null;
  try {
    lockedR = await executeAiTool("continue_run", { job_id: locked.id }, ctx);
  } finally {
    chmodSync(lockedWd, 0o755);
  }
  must(
    lockedR != null &&
      lockedR.ok === false &&
      lockedR.summary.includes("could not be read") &&
      lockedR.summary.includes("stays absent rather than guessing"),
    "T2i: an unreadable workdir speaks the scan's own error (the row's degraded face)",
  );
  const zero = await executeAiTool("continue_run", { job_id: crown.id, more: 0 }, ctx);
  must(
    zero.ok === false &&
      zero.summary.includes("positive number") &&
      zero.summary.includes("5/10/25") &&
      zero.summary.includes("EM epochs"),
    "T2j: more=0 refuses and names the EM chips",
  );
  const negative = await executeAiTool("continue_run", { job_id: crown.id, more: -5 }, ctx);
  must(negative.ok === false && negative.summary.includes("positive number"), "T2k: a negative more refuses");
}

/* ------------------------------------------------------------------ */
/* T3. the crown fire — plan, writes, the product's own dispatch        */
/* ------------------------------------------------------------------ */

console.log("T3. the crown fire — plan, writes, the product's own dispatch");

{
  const r = await executeAiTool("continue_run", { job_id: crown.id }, ctx);
  const d = detail(r);
  // the dispatch is REACHED and answered by the sandbox's honest face
  must(
    r.summary.includes("Start refused") && r.summary.includes("RELION not detected"),
    "T3a: the dispatch is reached — the engine's own RELION gate answers (no private refusal)",
  );
  // the plan rides the summary even on refusal — the agent reports what WOULD run
  must(
    r.summary.includes("Round 005") && r.summary.includes("iterations 25 + 5 → 30") && r.summary.includes("--iter is the TOTAL"),
    "T3b: the plan line carries the checkpoint round and RELION's total law",
  );
  must(
    r.summary.includes(`fn_cont=${path.join(crownWd, "run_it005_optimiser.star")}`),
    "T3c: the fn_cont write is named in the summary",
  );
  // the DB carries the plan (the product's own resume path reads it)
  const after = await db.job.findUniqueOrThrow({ where: { id: crown.id } });
  const stored = JSON.parse(after.params) as Record<string, unknown>;
  must(
    stored.fn_cont === path.join(crownWd, "run_it005_optimiser.star") && String(stored.iterations) === "30",
    "T3d: fn_cont + the --iter total are written through the spec (coerced like update_job)",
  );
  // the detail contract
  must(
    d.checkpoint?.round === 5 &&
      d.checkpoint.path === path.join(crownWd, "run_it005_optimiser.star") &&
      d.checkpoint.archived === false,
    "T3e: detail.checkpoint names the arc's head (round, path, live)",
  );
  must(
    d.paramKey === "iterations" && d.currentIter === 25 && d.more === 5 && d.totalIter === 30 && d.clamped === false,
    "T3f: detail carries the full arithmetic (default more = the first EM chip)",
  );
  must(d.lane === "local", "T3g: detail.lane says local (no remote ledger on this job)");
}

/* ------------------------------------------------------------------ */
/* T4. the dialects — VDAM counts mini-batches, the ceiling is the form's */
/* ------------------------------------------------------------------ */

console.log("T4. the dialects — VDAM and the ceiling");

{
  const r = await executeAiTool("continue_run", { job_id: vdam.id }, ctx);
  const d = detail(r);
  must(
    r.summary.includes("miniBatches 200 + 50 → 250"),
    "T4a: VDAM's default more is the first VDAM chip (50 mini-batches, not 5 epochs)",
  );
  must(d.paramKey === "miniBatches" && d.totalIter === 250 && d.clamped === false, "T4b: detail rides the VDAM knob");
  const after = await db.job.findUniqueOrThrow({ where: { id: vdam.id } });
  const stored = JSON.parse(after.params) as Record<string, unknown>;
  must(String(stored.miniBatches) === "250", "T4c: the VDAM total is written (the engine's first read agrees)");

  const c = await executeAiTool("continue_run", { job_id: clamp.id, more: 10 }, ctx);
  const cd = detail(c);
  must(
    c.summary.includes("48 + 10 → 50") && c.summary.includes("reaching the form's ceiling"),
    "T4d: the clamp is SAID (58 requested → 50 written, the form's own ceiling)",
  );
  must(cd.clamped === true && cd.totalIter === 50, "T4e: detail.clamped is true and the total is the ceiling");
}

/* ------------------------------------------------------------------ */
/* T5. the lane law — a cluster checkpoint speaks the cluster first     */
/* ------------------------------------------------------------------ */

console.log("T5. the lane law — the picker's data plane owns the cluster face");

{
  // A remote-run job's checkpoint scan IS the picker's remote scan — the
  // dead connection degrades at the CHECKPOINT gate (the UI row's own
  // degraded face), long before any dispatch: the verb never guesses a
  // checkpoint it could not read.
  const r = await executeAiTool("continue_run", { job_id: remoteJob.id }, ctx);
  must(
    r.ok === false &&
      r.summary.includes("could not be read") &&
      r.summary.includes("cluster listing failed"),
    "T5a: a dead cluster degrades at the checkpoint gate with the picker's own error",
  );
  must(
    detail(r).fnCont === undefined,
    "T5b: no plan, no writes — the verb never invents a checkpoint it could not read",
  );
  // the lane composition the handler fires with, on the seeded ledger
  const { remoteInfoFor } = await import("../src/lib/remote/remote-run");
  const { continueLaneOf } = await import("../src/lib/convergence-continue");
  const lane = continueLaneOf({ runRemote: remoteInfoFor(remoteJob.id) });
  must(
    lane != null &&
      lane.connectionId === "conn-ghost" &&
      lane.module === null &&
      lane.mode === "direct",
    "T5c: continueLaneOf(remoteInfoFor(...)) — the handler's own expression — names the job's own cluster",
  );
}

/* ------------------------------------------------------------------ */
/* T6. no private brain — the writes ARE the shared brains' writes      */
/* ------------------------------------------------------------------ */

console.log("T6. no private brain — the shared brains' own arithmetic");

{
  const sources = await continueSourcesFor({ id: crown.id, name: crown.name, type: crown.type, projectId: project.id });
  const ckpt = checkpointOf(sources);
  const knob = iterKnobOf("class2d", { iterations: "25" });
  must(ckpt != null && knob != null, "T6a: the shared data plane + knob brain answer for the crown world");
  if (ckpt && knob) {
    const plan = continuePlanOf({ type: "class2d", params: { iterations: "25" }, checkpoint: ckpt, more: 5 });
    must(plan != null && plan.fnCont === ckpt.path && plan.totalIter === 30, "T6b: the shared plan brain recomputes the same plan");
    const writes = continueParamWrites(plan!);
    const after = await db.job.findUniqueOrThrow({ where: { id: crown.id } });
    const stored = JSON.parse(after.params) as Record<string, unknown>;
    must(
      Object.entries(writes).every(([k, v]) => String(stored[k]) === String(v)),
      "T6c: the DB carries exactly continueParamWrites' keys/values — the tool wrote the shared brain's writes, byte for byte",
    );
  }
  const d = detail(await executeAiTool("continue_run", { job_id: crown.id, more: 10 }, ctx));
  must(
    d.currentIter === 30 && d.totalIter === 40,
    "T6d: a second fire reads the WRITTEN total (30) as the new current — the knob's own read chain",
  );
}

/* ------------------------------------------------------------------ */
/* T7. the prompt wears the CONTINUE LAW                                */
/* ------------------------------------------------------------------ */

console.log("T7. the prompt wears the CONTINUE LAW");

{
  const p = buildSystemPrompt({ projectName: "t471", projectMode: "spa", projectRemote: null, jobCount: 11 });
  must(
    p.includes("10. THE CONTINUE LAW") && p.includes("continue_run(job_id, more)"),
    "T7a: THE CONTINUE LAW is doctrine law 10 and names the verb",
  );
  must(
    p.includes("NEVER run_job") && p.includes("WIPE the results the verdict just read"),
    "T7b: the law forbids the wipe path by name",
  );
  must(
    p.includes("read with check_convergence, act with continue_run"),
    "T7c: the verdict → verb chain is stated as one chain",
  );
  must(
    p.includes("12. After run_job or continue_run") && p.includes("13. delete_job refuses") && p.includes("14. After tool calls"),
    "T7d: the doctrine renumbered cleanly (t475's cluster law sits at 11, wait/delete/narrate moved to 12/13/14)",
  );
}

/* ------------------------------------------------------------------ */

console.log(`\nt471 — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

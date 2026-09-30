/**
 * t518 — the cleanup learns to swing the shovel.
 *
 * t517 gave the verb a read face (get_cleanup_plan, the menu); the
 * shovel itself stayed behind the dialog's POST. This window lifts the
 * execution into the well too (lib/relion/cleanup-execute — the live
 * re-walk, the per-file rm, the remote twin, the manifest rewrite, and
 * the per-job in-flight lock) so the roster's 32nd tool —
 * cleanup_job_files — and the dialog's POST are two doors into one
 * per-job-serial shovel. The knobs are scopes and tiers ONLY: a file
 * list has no knob to arrive through, which is what makes the TOCTOU
 * law structural instead of aspirational.
 *
 * Bench doors:
 *   T1  the face — roster 32, the knob set (no path/file knob), the
 *       description's laws, the pair with the plan face.
 *   T2  the execute well — the shovel and its lock live in the lib,
 *       the route POST is a shell, the 400s and the 403 door stay.
 *   T3  the receipts, fixture-fed — per-side counts, fmtBytes lookups,
 *       errors verbatim, zero passes that confess, refusals that speak
 *       the plan face's reason.
 *   T4  a REAL deletion in the isolated world — the safe tier goes
 *       (scratch, .tmp, the beaten iteration, the shard), the keep-set
 *       survives (latest chainable, output, input door), the empty dir
 *       is pruned, a second pass confesses zero, a running job is
 *       refused, and the shared lock hands both callers one verdict.
 *   T5  the neighbors — the plan face stays delete-free, the map's
 *       writer clause names both writers now.
 *
 * Run: bun scripts/t518-cleanup-verb-bench.ts
 */

import { execSync } from "child_process";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync, lstatSync, symlinkSync, statSync } from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

/* ------------------------------------------------------------------ */
/* Isolated world FIRST — env before any src import                     */
/* ------------------------------------------------------------------ */

const TMP = mkdtempSync(path.join(os.tmpdir(), "t518-"));
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

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string): string => readFileSync(path.join(REPO, p), "utf8");

const { db } = await import("../src/lib/db");
const { ensureActiveProject } = await import("../src/lib/seed");
const { executeAiTool, presentCleanupExecution, AI_TOOLS } = await import("../src/lib/ai/tools");
const { defaultParams } = await import("../src/lib/workflow");
const { writeRuns } = await import("../src/lib/relion/engine");
const { fmtBytes } = await import("../src/lib/relion/disk-usage");
const { runCleanupExclusive } = await import("../src/lib/relion/cleanup-execute");
const typeCleanupExecute = await import("../src/lib/hpc/cleanup");

/* ------------------------------------------------------------------ */
/* T1 — the face                                                        */
/* ------------------------------------------------------------------ */

console.log("T1. the face (roster, knobs, description laws, the pair)");

must(
  AI_TOOLS.length === 32 && new Set(AI_TOOLS.map((t) => t.name)).size === 32,
  `T1a: the roster holds 32 unique tools (got ${AI_TOOLS.length})`
);
const face = AI_TOOLS.find((t) => t.name === "cleanup_job_files");
must(face != null, "T1b: cleanup_job_files sits in the roster");
const props = (face?.parameters.properties ?? {}) as Record<string, { type?: string }>;
must(
  face != null &&
    JSON.stringify(face.parameters.required) ===
      JSON.stringify(["job_id", "local", "remote", "tiers"]) &&
    props.job_id?.type === "string" &&
    props.local?.type === "boolean" &&
    props.remote?.type === "boolean" &&
    props.tiers?.type === "array" &&
    !Object.keys(props).some((k) => /path|file|name/i.test(k) && k !== "job_id"),
  "T1c: the knobs are job_id + sides + tiers — no path or file-list knob exists to arrive through"
);
must(
  face != null &&
    face.description.includes("THE tool for") &&
    face.description.includes("NEVER a file list") &&
    face.description.includes("The keep-set is the contract and is never touched") &&
    face.description.includes("re-walks the directory LIVE first"),
  "T1d: the description carries the laws (THE tool for / no file list / keep-set contract / live re-walk)"
);
must(
  face != null && face.description.includes("get_cleanup_plan FIRST"),
  "T1e: the description orders the menu before the shovel"
);
must(
  read("src/lib/ai/tools.ts").includes('case "cleanup_job_files":') &&
    read("src/lib/ai/tools.ts").includes(
      'import { runCleanupExclusive } from "@/lib/relion/cleanup-execute";'
    ),
  "T1f: the dispatch is wired and the shovel is the well's own"
);
must(
  (AI_TOOLS.find((t) => t.name === "get_cleanup_plan")?.description ?? "").includes(
    "cleanup_job_files"
  ),
  "T1g: the plan face names its verb — the pair reads as a pair"
);

/* ------------------------------------------------------------------ */
/* T2 — the execute well                                                */
/* ------------------------------------------------------------------ */

console.log("T2. the execute well (lock lives in the lib, the route is a shell)");

const execBody = read("src/lib/relion/cleanup-execute.ts");
const routeBody = read("src/app/api/jobs/[id]/cleanup/route.ts");
must(
  execBody.includes("async function executeCleanup") &&
    execBody.includes("function pruneLocalEmptyDirs") &&
    execBody.includes("const inFlight = new Map") &&
    execBody.includes("export function runCleanupExclusive"),
  "T2a: the execute well owns the shovel, the prune, the lock and the exclusive runner"
);
must(
  execBody.includes("re-walk LIVE — the plan is a preview, not a mandate") &&
    execBody.includes("vanished between walk and rm — a skip, not an error"),
  "T2b: the TOCTOU law and the vanish-skip law ride the well verbatim"
);
must(
  !routeBody.includes("function executeCleanup") &&
    !routeBody.includes("const inFlight") &&
    routeBody.includes("await runCleanupExclusive(id, scopes, tiers)"),
  "T2c: the route POST is a shell — one well line, no lock left behind"
);
must(
  routeBody.includes('"Nothing selected — choose at least one side (local or cluster)"') &&
    routeBody.includes('"No tiers selected — pick what to clean"') &&
    routeBody.includes("Cross-site job actions are not allowed") &&
    routeBody.includes("status: 409"),
  "T2d: the 400s, the 403 write door and the 409 mapping stay in the route"
);
must(
  routeBody.includes("the dialog's POST and the agent's cleanup verb are") &&
    execBody.includes("two doors into the SAME shovel"),
  "T2e: both headers teach the two-doors-one-shovel doctrine"
);

/* ------------------------------------------------------------------ */
/* T3 — the receipts, fixture-fed                                       */
/* ------------------------------------------------------------------ */

console.log("T3. the receipts (lookups, zero passes, refusals)");

const happy = {
  ok: true,
  local: { deleted: 3, freedBytes: 1048576, errors: [] },
  remote: {
    deleted: 11,
    freedBytes: 640000,
    errors: ["one file vanished mid-rm — a skip, not an error"],
    manifestRewritten: true,
  },
} as unknown as Parameters<typeof presentCleanupExecution>[1];
const rT3 = presentCleanupExecution("Mask Create 1", happy);
must(rT3.ok === true, "T3a: a successful execution answers ok");
must(
  rT3.summary.includes(`local — 3 files deleted, ${fmtBytes(1048576)} freed`) &&
    rT3.summary.includes(`cluster — 11 files deleted, ${fmtBytes(640000)} freed`),
  "T3b: per-side counts and bytes are fmtBytes lookups, not re-derivations"
);
must(
  rT3.summary.includes("cluster manifest rewritten"),
  "T3c: the manifest rewrite rides the cluster side"
);
must(
  rT3.summary.includes("1 per-file failure rides the annex verbatim"),
  "T3d: the failure census speaks (singular rides)"
);
must(
  rT3.summary.includes("the keep-set (outputs, input doors, resume checkpoints) was never touched"),
  "T3e: the receipt names the contract it kept"
);
must(
  (rT3.detail as Record<string, unknown>).local === happy.local &&
    (rT3.detail as Record<string, unknown>).remote === happy.remote,
  "T3f: the annex rides by reference (raw digits, zero clone)"
);

const single = {
  ok: true,
  local: { deleted: 1, freedBytes: 4096, errors: [] },
  remote: null,
} as unknown as Parameters<typeof presentCleanupExecution>[1];
must(
  presentCleanupExecution("Post-process 1", single).summary.includes(
    `local — 1 file deleted, ${fmtBytes(4096)} freed`
  ),
  "T3g: singular verb (1 file deleted)"
);

const zero = {
  ok: true,
  local: { deleted: 0, freedBytes: 0, errors: [] },
  remote: null,
} as unknown as Parameters<typeof presentCleanupExecution>[1];
must(
  presentCleanupExecution("Post-process 1", zero).summary.includes(
    "local — nothing matched the selected tiers (0 files deleted, 0 B freed)"
  ) &&
    !presentCleanupExecution("Post-process 1", zero).summary.includes("cluster —"),
  "T3h: a zero pass confesses, and an absent side says nothing"
);

const refused = { ok: false, error: "The job is running — its intermediate files are being written. Stop it first, then clean." } as unknown as Parameters<typeof presentCleanupExecution>[1];
const rT3r = presentCleanupExecution("QA Refine Live", refused);
must(
  rT3r.ok === false && rT3r.summary === "QA Refine Live: The job is running — its intermediate files are being written. Stop it first, then clean.",
  "T3i: a refusal speaks the well's error verbatim — one voice for both faces"
);

/* ------------------------------------------------------------------ */
/* T4 — a REAL deletion (isolated world)                                */
/* ------------------------------------------------------------------ */

console.log("T4. the real swing (delete, survive, prune, refuse, share the lock)");

const active = await ensureActiveProject();
must(active != null, "world: the isolated project exists");
const projectId = active!.project.id;

const clsJob = await db.job.create({
  data: {
    projectId,
    type: "class2d",
    name: "2D Classification 1",
    x: 200,
    y: 200,
    params: JSON.stringify(defaultParams("class2d")),
    status: "completed",
  },
});
must(clsJob != null, "world: the class2d row exists");

const workdir = path.join(DATA_DIR, "relion", projectId, `class2d_${clsJob.id.slice(-8)}`);
mkdirSync(path.join(workdir, "shard_1"), { recursive: true });
writeFileSync(path.join(workdir, ".cf-shard-abc"), "x".repeat(11));
writeFileSync(path.join(workdir, "scratch.tmp"), "x".repeat(22));
writeFileSync(path.join(workdir, "shard_1", "parts.star"), "x".repeat(33));
writeFileSync(path.join(workdir, "run_it001_data.star"), "x".repeat(44));
writeFileSync(path.join(workdir, "run_it002_data.star"), "x".repeat(55));
writeFileSync(path.join(workdir, "class2d_001.out.star"), "x".repeat(100));
symlinkSync("/nonexistent/particles.mrcs", path.join(workdir, "input.mrcs"));

writeRuns({
  [clsJob.id]: {
    jobId: clsJob.id,
    projectId,
    type: "class2d",
    pid: null,
    cmd: "relion_refine --o class2d_001",
    workdir,
    logFile: path.join(workdir, "run.out"),
    errFile: path.join(workdir, "run.err"),
    startedAt: new Date().toISOString(),
    outputs: { particles_star: path.join(workdir, "class2d_001.out.star") },
    done: true,
    exitCode: 0,
  },
});

const ctx = { projectId };
const rLive = await executeAiTool(
  "cleanup_job_files",
  { job_id: clsJob.id, local: true, remote: false, tiers: ["safe"] },
  ctx
);
must(rLive.ok === true, "T4a: the tool answers ok end-to-end");
must(
  typeof rLive.summary === "string" &&
    rLive.summary.includes(`local — 4 files deleted, ${fmtBytes(110)} freed`),
  `T4b: the receipt counts the safe tier (4 files / 110 bytes — scratch, .tmp, the shard, the beaten iteration)`
);
must(
  !existsSync(path.join(workdir, ".cf-shard-abc")) &&
    !existsSync(path.join(workdir, "scratch.tmp")) &&
    !existsSync(path.join(workdir, "run_it001_data.star")) &&
    !existsSync(path.join(workdir, "shard_1")),
  "T4c: the safe tier is GONE from disk (including the pruned empty shard_1)"
);
must(
  existsSync(path.join(workdir, "run_it002_data.star")) &&
    statSync(path.join(workdir, "run_it002_data.star")).size === 55 &&
    existsSync(path.join(workdir, "class2d_001.out.star")) &&
    lstatSync(path.join(workdir, "input.mrcs")).isSymbolicLink(),
  "T4d: the keep-set survives (latest chainable, the output, the input door — lstat, since a dangling door lies to existsSync)"
);
must(
  typeof rLive.summary === "string" && !rLive.summary.includes(".. "),
  "T4e: no stacked periods in the live receipt"
);

const rAgain = await executeAiTool(
  "cleanup_job_files",
  { job_id: clsJob.id, local: true, remote: false, tiers: ["safe", "diagnostics", "bulk"] },
  ctx
);
must(
  rAgain.ok === true &&
    typeof rAgain.summary === "string" &&
    rAgain.summary.includes("local — nothing matched the selected tiers (0 files deleted, 0 B freed)"),
  "T4f: a second pass confesses zero across ALL tiers — the keep-set held everything"
);

const runJob = await db.job.create({
  data: {
    projectId,
    type: "refine3d",
    name: "QA Refine Live",
    x: 300,
    y: 300,
    params: JSON.stringify(defaultParams("refine3d")),
    status: "running",
  },
});
const runWorkdir = path.join(DATA_DIR, "relion", projectId, `refine3d_${runJob.id.slice(-8)}`);
mkdirSync(runWorkdir, { recursive: true });
writeFileSync(path.join(runWorkdir, "scratch.tmp"), "x".repeat(9));
writeRuns({
  [clsJob.id]: {
    jobId: clsJob.id,
    projectId,
    type: "class2d",
    pid: null,
    cmd: "relion_refine --o class2d_001",
    workdir,
    logFile: path.join(workdir, "run.out"),
    errFile: path.join(workdir, "run.err"),
    startedAt: new Date().toISOString(),
    outputs: { particles_star: path.join(workdir, "class2d_001.out.star") },
    done: true,
    exitCode: 0,
  },
  [runJob.id]: {
    jobId: runJob.id,
    projectId,
    type: "refine3d",
    pid: null,
    cmd: "relion_refine --o refine3d_001",
    workdir: runWorkdir,
    logFile: path.join(runWorkdir, "run.out"),
    errFile: path.join(runWorkdir, "run.err"),
    startedAt: new Date().toISOString(),
    outputs: {},
    done: false,
    exitCode: null,
  },
});
const rRefuse = await executeAiTool(
  "cleanup_job_files",
  { job_id: runJob.id, local: true, remote: false, tiers: ["safe"] },
  ctx
);
must(
  rRefuse.ok === false &&
    typeof rRefuse.summary === "string" &&
    rRefuse.summary.includes("The job is running — its intermediate files are being written. Stop it first, then clean."),
  "T4g: a running job is refused with the well's own sentence — and nothing was deleted"
);
must(existsSync(path.join(runWorkdir, "scratch.tmp")), "T4h: the refused run's files are untouched on disk");

const rNoSide = await executeAiTool(
  "cleanup_job_files",
  { job_id: clsJob.id, local: false, remote: false, tiers: ["safe"] },
  ctx
);
must(
  rNoSide.ok === false &&
    typeof rNoSide.summary === "string" &&
    rNoSide.summary.startsWith("Nothing selected"),
  "T4i: no sides selected — the route's 400 sentence, honest at the tool door too"
);
const rNoTier = await executeAiTool(
  "cleanup_job_files",
  { job_id: clsJob.id, local: true, remote: false, tiers: ["everything"] },
  ctx
);
must(
  rNoTier.ok === false &&
    typeof rNoTier.summary === "string" &&
    rNoTier.summary.startsWith("No tiers selected"),
  "T4j: an invented tier name filters to nothing — no tiers selected"
);

const [lockA, lockB] = await Promise.all([
  runCleanupExclusive(clsJob.id, { local: true, remote: false }, ["safe"]),
  runCleanupExclusive(clsJob.id, { local: true, remote: false }, ["safe"]),
]);
must(
  lockA === lockB && lockA.ok === true,
  "T4k: two doors, one shovel — the concurrent callers share one verdict object"
);

/* ------------------------------------------------------------------ */
/* T5 — the neighbors                                                   */
/* ------------------------------------------------------------------ */

console.log("T5. the neighbors (the read face stays delete-free, the laws evolve)");

must(
  !read("src/lib/relion/cleanup-plan.ts").includes("rmSync"),
  "T5a: the plan face still never imports a delete — the shovel lives in the execute well"
);
must(
  read("src/lib/ai/tools.ts").includes(
    "the Storage dialog's Clean doors and the agent's cleanup_job_files are the only writers"
  ),
  "T5b: the map's writer clause names both writers now (the clause followed the law)"
);
must(
  read("src/lib/ai/tools.ts").includes("run get_cleanup_plan FIRST"),
  "T5c: the shovel's description orders the menu first"
);
must(
  typeCleanupExecute && typeof typeCleanupExecute.classifyCleanup === "function",
  "T5d: the planner is still the only brain that picks files"
);

/* ------------------------------------------------------------------ */

console.log(`\nt518-cleanup-verb: ${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);

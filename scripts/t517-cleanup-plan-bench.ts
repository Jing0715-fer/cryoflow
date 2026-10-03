/**
 * t517 — the cleanup learns to show its menu.
 *
 * The per-job cleanup dialog (t331) always held the verb: a walked plan
 * in three tiers with honest consequences, a guarded write behind it.
 * But the roster of 30 could not answer the daily question "这个任务能
 * 清什么 / what can this job clean" — the agent could name whales
 * (get_storage_report) yet never open one's menu. This window gives the
 * verb a read face: get_cleanup_plan drinks the route's own well
 * (computeCleanupPlan, lifted verbatim into lib/relion/cleanup-plan —
 * the walk, the liveness verdict, the remote join, the downstream
 * census) and presents it pure.
 *
 * Bench doors:
 *   T1  the face — roster 31, one knob, the description's laws.
 *   T2  the well — route shell, POST face untouched, liveness strings
 *       live in the well, and the read face never imports a delete.
 *   T3  the presenter, fixture-fed — tier lines are lookups (fmtBytes
 *       is the only human voice), annex rides by reference, freshness
 *       rides the head, single/plural verbs correct.
 *   T4  the honesties — running reason verbatim, nothing-cleanable,
 *       missing dir, local-only, cluster error; plus a REAL walk in the
 *       isolated world: safe tier 4 files / 110 bytes, keep-set 3 / 155.
 *   T5  the neighbors — storage's read face intact, the door predicate
 *       verbatim, the executor scoped to the session's project.
 *
 * Run: bun scripts/t517-cleanup-plan-bench.ts
 */

import { execSync } from "child_process";
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync, symlinkSync } from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

/* ------------------------------------------------------------------ */
/* Isolated world FIRST — env before any src import                     */
/* ------------------------------------------------------------------ */

const TMP = mkdtempSync(path.join(os.tmpdir(), "t517-"));
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
const { executeAiTool, presentCleanupPlan, AI_TOOLS } = await import("../src/lib/ai/tools");
const { defaultParams } = await import("../src/lib/workflow");
const { writeRuns } = await import("../src/lib/relion/engine");
const { fmtBytes } = await import("../src/lib/relion/disk-usage");
const { computeCleanupPlan } = await import("../src/lib/relion/cleanup-plan");
const { isCleanableStatus } = await import("../src/lib/storage-clean");

/* ------------------------------------------------------------------ */
/* T1 — the face                                                        */
/* ------------------------------------------------------------------ */

console.log("T1. the face (roster, knob, description laws)");

must(
  AI_TOOLS.length === 34 && new Set(AI_TOOLS.map((t) => t.name)).size === 34,
  `T1a: the roster holds 34 unique tools (got ${AI_TOOLS.length})`
);
const face = AI_TOOLS.find((t) => t.name === "get_cleanup_plan");
must(face != null, "T1b: get_cleanup_plan sits in the roster");
must(
  face != null &&
    face.parameters.type === "object" &&
    Object.keys(face.parameters.properties ?? {}).length === 1 &&
    (face.parameters.properties as Record<string, { type?: string }>).job_id?.type === "string" &&
    JSON.stringify(face.parameters.required) === JSON.stringify(["job_id"]) &&
    face.parameters.additionalProperties === false,
  "T1c: one knob — job_id, required, nothing else"
);
must(
  face != null &&
    face.description.includes("THE tool for") &&
    face.description.includes("Read-only PLANNER PREVIEW") &&
    face.description.includes("deletes nothing") &&
    face.description.includes("get_storage_report is the project's map"),
  "T1d: the description carries the three laws (THE tool for / read-only preview / the map-vs-menu boundary)"
);
must(
  read("src/lib/ai/tools.ts").includes('case "get_cleanup_plan":'),
  "T1e: the dispatch is wired"
);
must(
  read("src/lib/ai/tools.ts").includes('import { computeCleanupPlan } from "@/lib/relion/cleanup-plan";'),
  "T1f: the executor drinks the well by name"
);

/* ------------------------------------------------------------------ */
/* T2 — the well                                                        */
/* ------------------------------------------------------------------ */

console.log("T2. the well (route shell, POST face untouched, no delete in the read)");

const wellBody = read("src/lib/relion/cleanup-plan.ts");
const routeBody = read("src/app/api/jobs/[id]/cleanup/route.ts");
const execBody = read("src/lib/relion/cleanup-execute.ts");
must(
  wellBody.includes("export async function computeCleanupPlan") &&
    wellBody.includes("export function walkLocalRunFiles") &&
    wellBody.includes("WALK_MAX_ENTRIES = 20_000") &&
    wellBody.includes("export async function resolveCleanupJob"),
  "T2a: the well owns the walk, the cap, the resolution and the assembly"
);
must(
  wellBody.includes("The job is running — its intermediate files are being written. Stop it first, then clean.") &&
    wellBody.includes("This job has not run yet — there is no run directory to clean."),
  "T2b: the liveness refusals live in the well (the route's own words, verbatim)"
);
must(
  !wellBody.includes("rmSync") && !wellBody.includes("unlinkSync") && !wellBody.includes("rmdirSync"),
  "T2c: the read face never imports a delete"
);
must(
  routeBody.includes("computeCleanupPlan(id, { refresh })") &&
    !routeBody.includes("function walkLocalRunFiles") &&
    !routeBody.includes("function resolveCleanupJob"),
  "T2d: the GET is a protocol shell — one well line, no moved brains left behind"
);
must(
  execBody.includes("deleteRemoteFiles") &&
    execBody.includes("inFlight") &&
    routeBody.includes('const VALID_TIERS: CleanupTierId[] = ["safe", "diagnostics", "bulk"]') &&
    routeBody.includes("Cross-site job actions are not allowed"),
  "T2e: the write face keeps its shovel and its lock in the execute well, its tiers and its 403 door in the route (t518: guards follow the law, not the address)"
);

/* ------------------------------------------------------------------ */
/* T3 — the presenter, fixture-fed                                      */
/* ------------------------------------------------------------------ */

console.log("T3. the presenter (locators are lookups, annex by reference)");

const safeGroup = {
  tier: "safe" as const,
  label: "Iteration & scratch files",
  consequence: "these can be deleted safely",
  files: [
    { path: ".cf-shard-abc", size: 900 },
    { path: "scratch.tmp", size: 100 },
    { path: "shard_1/parts.star", size: 48 },
  ],
  truncated: false,
  count: 3,
  bytes: 1048,
};
const diagGroup = {
  tier: "diagnostics" as const,
  label: "CTF & plot diagnostics",
  consequence: "plots can be re-made",
  files: [{ path: "log.ctf", size: 512 }],
  truncated: false,
  count: 1,
  bytes: 512,
};
const fixture = {
  ok: true,
  runnable: true,
  job: { id: "jobT3", name: "2D Classification 3", type: "class2d", status: "completed" },
  local: {
    exists: true,
    workdir: "/tmp/fake-workdir",
    groups: [safeGroup, diagGroup],
    kept: { count: 2, bytes: 921600 },
  },
  remote: null,
  downstream: [
    { id: "d1", name: "3D Classification 1", type: "class3d", status: "completed" },
    { id: "d2", name: "Mask Create 1", type: "maskcreate", status: "completed" },
  ],
  checkedAt: "2026-09-30T09:00:00.000Z",
} as unknown as Parameters<typeof presentCleanupPlan>[0];

const rT3 = presentCleanupPlan(fixture);
must(rT3.ok === true, "T3a: the happy plan answers ok");
must(
  rT3.summary.includes(`iteration & scratch files: ${fmtBytes(1048)} in 3 files`) &&
    rT3.summary.includes(`ctf & plot diagnostics: ${fmtBytes(512)} in 1 file`),
  "T3b: the tier lines are lookups — label lowercased, fmtBytes the only human voice, counts beside them"
);
must(
  rT3.summary.includes(`2 files (${fmtBytes(921600)}) survive in the keep-set`),
  "T3c: the keep-set speaks with its own count and bytes"
);
must(
  rT3.summary.includes("no cluster record — a local-only run"),
  "T3d: remote null says local-only"
);
must(
  rT3.summary.includes(
    "2 downstream jobs may still read the kept outputs — weigh them before bulk tiers."
  ),
  "T3e: the downstream census rides the summary (plural)"
);
must(
  rT3.summary.includes("Plan walked at 2026-09-30T09:00:00.000Z"),
  "T3f: the freshness stamp rides the summary, verbatim"
);
const detail3 = rT3.detail as Record<string, unknown>;
must(
  detail3.local === fixture.local && detail3.downstream === fixture.downstream,
  "T3g: the annex rides by reference — the dialog's payload, zero clone"
);
must(
  (detail3.local as typeof fixture.local).groups[0].bytes === 1048,
  "T3h: raw digits in the annex (the summary is the only formatted face)"
);
must(
  (detail3.checkedAt as string) === "2026-09-30T09:00:00.000Z" && detail3.runnable === true,
  "T3i: the head rows ride first (freshness + verdict)"
);

const single = {
  ...fixture,
  job: { id: "jobT3b", name: "Mask Create 2", type: "maskcreate", status: "completed" },
  local: { ...fixture.local, groups: [{ ...diagGroup, count: 1, bytes: 7 }], kept: { count: 1, bytes: 8 } },
  downstream: [{ id: "d1", name: "Post-process 1", type: "postprocess", status: "completed" }],
} as unknown as Parameters<typeof presentCleanupPlan>[0];
const rT3s = presentCleanupPlan(single);
must(
  rT3s.summary.includes(`ctf & plot diagnostics: ${fmtBytes(7)} in 1 file`) &&
    rT3s.summary.includes("1 downstream job may still read the kept outputs") &&
    rT3s.summary.includes(`1 file (${fmtBytes(8)}) survives in the keep-set`),
  "T3j: singular verbs (1 file, survives, 1 downstream job may)"
);

/* ------------------------------------------------------------------ */
/* T4 — the honesties (fixtures + one REAL walk)                        */
/* ------------------------------------------------------------------ */

console.log("T4. the honesties (reason first, absence verbatim, the real walk)");

const running = {
  ...fixture,
  runnable: false,
  reason: "The job is running — its intermediate files are being written. Stop it first, then clean.",
} as unknown as Parameters<typeof presentCleanupPlan>[0];
const rT4a = presentCleanupPlan(running);
must(
  rT4a.summary.startsWith("2D Classification 3 (class2d): The job is running — its intermediate files are being written."),
  "T4a: a live run's refusal rides FIRST, verbatim (the route's own words)"
);
must(
  (rT4a.detail as Record<string, unknown>).reason === running.reason,
  "T4b: the reason rides the annex head too"
);

const nothing = {
  ...fixture,
  local: { ...fixture.local, groups: [], kept: { count: 5, bytes: 4096 } },
} as unknown as Parameters<typeof presentCleanupPlan>[0];
must(
  presentCleanupPlan(nothing).summary.includes(
    `local: nothing cleanable — all 5 files (${fmtBytes(4096)}) sit in the keep-set`
  ),
  "T4c: an all-keep directory says nothing cleanable, not an error"
);

const nothingOne = {
  ...fixture,
  local: { ...fixture.local, groups: [], kept: { count: 1, bytes: 761 } },
} as unknown as Parameters<typeof presentCleanupPlan>[0];
const rT4c2 = presentCleanupPlan(nothingOne);
must(
  rT4c2.summary.includes(`local: nothing cleanable — all 1 file (${fmtBytes(761)}) sits in the keep-set`),
  "T4c2: the verb rides the count's ternary (all 1 file sits) — t515's lesson, pinned"
);

const refused = {
  ...fixture,
  runnable: false,
  reason: "The job is running — its intermediate files are being written. Stop it first, then clean.",
  local: { ...fixture.local, groups: [], kept: { count: 1, bytes: 761 } },
} as unknown as Parameters<typeof presentCleanupPlan>[0];
const rT4c3 = presentCleanupPlan(refused);
must(
  rT4c3.summary.includes("Stop it first, then clean. local:") && !rT4c3.summary.includes(".. "),
  "T4c3: the refusal's own period is the only period (no stacked dots)"
);

const gone = {
  ...fixture,
  local: {
    exists: false,
    workdir: "/tmp/vanished",
    groups: [],
    kept: { count: 0, bytes: 0 },
    note: "Run directory no longer exists on disk",
  },
} as unknown as Parameters<typeof presentCleanupPlan>[0];
must(
  presentCleanupPlan(gone).summary.includes("local: Run directory no longer exists on disk"),
  "T4d: the vanished dir speaks its note verbatim"
);

const brokenCluster = {
  ...fixture,
  remote: {
    known: true,
    exists: false,
    workdir: "/projects/cryoflow/job",
    connection: null,
    groups: [],
    kept: { count: 0, bytes: 0 },
    error: "The connection (lab cluster) is gone and no same-host connection exists — reconnect the cluster to clean it.",
  },
} as unknown as Parameters<typeof presentCleanupPlan>[0];
must(
  presentCleanupPlan(brokenCluster).summary.includes(
    "cluster: The connection (lab cluster) is gone and no same-host connection exists — reconnect the cluster to clean it."
  ),
  "T4e: a dead cluster side degrades onto its own error, verbatim"
);

/* --- the real walk (isolated world) --------------------------------- */

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

const plan = await computeCleanupPlan(clsJob.id);
must(plan != null && plan.runnable === true, "T4f: the settled run's plan is runnable");
must(plan != null && plan.remote === null && plan.downstream.length === 0,
  "T4g: a local-only, downstream-free run says so");

const safe = plan?.local.groups.find((g) => g.tier === "safe");
must(
  safe != null && safe.count === 4 && safe.bytes === 110,
  `T4h: the safe tier holds the scratch, the shard, the .tmp AND the beaten iteration (4 files / 110 bytes, got ${safe?.count} / ${safe?.bytes})`
);
must(
  plan?.local.kept.count === 3 && plan?.local.kept.bytes === 155,
  `T4i: the keep-set holds the latest chainable, the output and the input door (3 files / 155 bytes, got ${plan?.local.kept.count} / ${plan?.local.kept.bytes})`
);
must(
  plan?.local.groups.length === 1,
  "T4j: empty tiers never ride the plan (no empty diagnostics/bulk groups)"
);

const rLive = await executeAiTool("get_cleanup_plan", { job_id: clsJob.id }, { projectId });
must(rLive.ok === true, "T4k: the tool answers ok end-to-end");
must(
  typeof rLive.summary === "string" &&
    rLive.summary.includes("2D Classification 1") &&
    rLive.summary.includes(`iteration & scratch files: ${fmtBytes(110)} in 4 files`) &&
    rLive.summary.includes(`3 files (${fmtBytes(155)}) survive in the keep-set`),
  "T4l: the live summary is the walk's own locator, byte-honest"
);
must(
  typeof rLive.summary === "string" && rLive.summary.includes("Plan walked at "),
  "T4m: the live summary carries its freshness stamp"
);

const rMissing = await executeAiTool("get_cleanup_plan", { job_id: "bogus" }, { projectId });
must(
  rMissing.ok === false &&
    typeof rMissing.summary === "string" &&
    rMissing.summary.startsWith("Job not found: bogus"),
  "T4n: a bogus id is an honest absence, not an invented plan"
);

/* ------------------------------------------------------------------ */
/* T5 — the neighbors                                                   */
/* ------------------------------------------------------------------ */

console.log("T5. the neighbors (the read family's laws stay put)");

const toolsBody = read("src/lib/ai/tools.ts");
must(
  toolsBody.includes("the Storage dialog's Clean doors and the agent's cleanup_job_files are the only writers"),
  "T5a: get_storage_report's boundary law verbatim (the map's writer clause)"
);
must(
  read("src/lib/storage-clean.ts").includes(
    "return status !== \"running\" && status !== \"pending\";"
  ),
  "T5b: the door predicate isCleanableStatus verbatim in storage-clean"
);
must(
  toolsBody.includes("findJobInProject(jobId, ctx.projectId)"),
  "T5c: the executor pre-scopes to the session's project"
);
must(
  AI_TOOLS.findIndex((t) => t.name === "get_cleanup_plan") ===
    AI_TOOLS.findIndex((t) => t.name === "get_storage_report") + 1,
  "T5d: the menu sits beside the map in the roster"
);
must(
  wellBody.includes("the dialog drinks the same cup") === false &&
    wellBody.includes("drink from the same cup"),
  "T5e: the well's header still teaches the one-cup doctrine"
);

/* ------------------------------------------------------------------ */

console.log(`\nt517-cleanup-plan: ${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);

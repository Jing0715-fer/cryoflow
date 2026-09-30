/**
 * t476 — the records join the roll (list_clusters grows a dispatch résumé).
 *
 * t475 handed the agent the registry's roll call — names, probes, bindings.
 * But "这台集群最近跑过什么 / what has this cluster been running?" was still
 * mute: the résumé aggregate (connectionRunResume, t270) has answered the
 * dialog's résumé card since t270, and the records panorama since t295 —
 * the agent just couldn't read either. This read joins the SAME aggregate
 * to every roster row: total/completed/failed + the ≤3 newest runs, each
 * wearing the t272 existence truth (the record outlives the job —
 * exists:false means the canvas let it go while the ledger remembers).
 *
 * This bench pins:
 *  T1  the catalog keeps its shape (still 19 tools — an extension, not a
 *      new tool; the description now names the résumé)
 *  T2  the omission law: a cluster with zero dispatches wears NO block —
 *      "no résumé" stays honest the same way the list route omits the field
 *  T3  the résumé's arithmetic: done/exitCode buckets (0 → completed,
 *      137 → failed, running → neither), lastRunAt, recent = the 3 newest,
 *      newest first, each entry naming jobId/jobType/done/exitCode/startedAt
 *  T4  the existence truth rides the rows: a job still on a canvas says
 *      exists:true + which project; a deleted job says exists:false and
 *      does NOT invent a project name
 *  T5  the spoken line: the BOUND cluster's résumé earns a clause
 *      ("carries N recorded dispatches"); zero records → zero clause
 *  T6  the law: THE CLUSTER LAW now names the résumé and the
 *      record-outlives-job rule, the reads list answers the cluster-
 *      history question, numbering stays contiguous 1–14
 *
 * Run: bun run scripts/t476-cluster-dispatch-bench.ts
 */

import { execSync } from "child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

/* ------------------------------------------------------------------ */
/* Isolated world FIRST — env before any src import                     */
/* ------------------------------------------------------------------ */

const TMP = mkdtempSync(path.join(os.tmpdir(), "t476-cluster-dispatch-"));
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

/* ------------------------------------------------------------------ */
/* Imports (after env)                                                 */
/* ------------------------------------------------------------------ */

const { executeAiTool, AI_TOOLS } = await import("../src/lib/ai/tools");
const { buildSystemPrompt } = await import("../src/lib/ai/prompt");
const { db } = await import("../src/lib/db");

const REGISTRY = path.join(DATA_DIR, "remote-connections.json");
const PROJECTS = path.join(DATA_DIR, "projects.json");
const STATE = path.join(DATA_DIR, "engine-state.json");

function writeRegistry(list: unknown[]): void {
  writeFileSync(REGISTRY, JSON.stringify(list, null, 2));
}

function writeProjects(active: string | null, boundConnectionId: string | null): void {
  writeFileSync(
    PROJECTS,
    JSON.stringify({
      active,
      projects: active
        ? {
            [active]: {
              mode: "spa",
              engine: "relion",
              ...(boundConnectionId ? { remote: { connectionId: boundConnectionId } } : {}),
            },
          }
        : {},
    }),
  );
}

function writeState(runs: Record<string, unknown>): void {
  writeFileSync(STATE, JSON.stringify(runs, null, 2));
}

/* a run record shaped like RunRecord — only the fields the résumé reads */
function runRecord(shape: {
  jobId: string;
  type: string;
  startedAt: string;
  done: boolean;
  exitCode: number | null;
  connectionId: string;
}) {
  return {
    jobId: shape.jobId,
    projectId: "ledger-project",
    type: shape.type,
    pid: null,
    cmd: "relion_refine --t476",
    workdir: "/projects/qa/run_it000",
    logFile: "/projects/qa/run_it000/log",
    errFile: "/projects/qa/run_it000/err",
    startedAt: shape.startedAt,
    outputs: {},
    done: shape.done,
    exitCode: shape.exitCode,
    remote: { connectionId: shape.connectionId },
  };
}

/* a connection row shaped like RemoteConnection (only what the tool reads) */
function connection(shape: { id: string; name?: string }) {
  return {
    id: shape.id,
    name: shape.name ?? "",
    host: "hpc.example.edu",
    port: 22,
    username: "qc",
    authMethod: "agent",
    privateKeyPath: null,
    passphrase: null,
    password: null,
    remoteRoot: "/data/qa/cryo",
    defaultModule: null,
    envLines: [],
    useSlurm: true,
    lastProbe: null,
  };
}

type DispatchRow = {
  jobId: string;
  jobType: string;
  done: boolean;
  exitCode: number | null;
  startedAt: string;
  exists: boolean;
  projectName?: string;
};
type RosterRow = {
  id: string;
  dispatches?: {
    total: number;
    completed: number;
    failed: number;
    lastRunAt: string | null;
    recent: DispatchRow[];
  };
};

/* ------------------------------------------------------------------ */
/* T1 — the catalog keeps its shape (an extension, not a new tool)      */
/* ------------------------------------------------------------------ */

console.log("T1. still 21 tools; the description now names the résumé");

{
  const tool = AI_TOOLS.find((t) => t.name === "list_clusters");
  must(tool != null, "T1a: list_clusters is in the catalog");
  must(
    AI_TOOLS.length === 24 && new Set(AI_TOOLS.map((t) => t.name)).size === 24,
    `T1b: 23 unique tools — t486's curve read was the birth, extensions only since (got ${AI_TOOLS.length})`,
  );
  const params = (tool?.parameters ?? {}) as {
    properties?: Record<string, unknown>;
    additionalProperties?: unknown;
  };
  // t484 — the schema grew ONE optional param (fullHistory): the résumé
  // itself still needs nothing, but the whole-book read is now a bridge
  // away. Exactly one property, nothing required, no extra keys.
  must(
    params.properties != null &&
      Object.keys(params.properties).join(",") === "fullHistory" &&
      params.additionalProperties === false &&
      !(tool?.parameters as { required?: string[] }).required,
    "T1c: the schema takes exactly one OPTIONAL param (fullHistory) — the résumé face still needs nothing",
  );
  const d = tool?.description ?? "";
  must(
    /résumé|dispatch/i.test(d) && d.includes("LAST probe") && d.includes("checkedAt"),
    "T1d: the description names the résumé without losing the probe's birthday",
  );
}

/* ------------------------------------------------------------------ */
/* T2 — the omission law: no dispatches, no block                       */
/* ------------------------------------------------------------------ */

console.log("T2. a cluster with zero dispatches wears no résumé block");

const project = await db.project.create({ data: { name: "t476 records roll" } });
const other = await db.project.create({ data: { name: "Side Canvas" } });
const ctx = { projectId: project.id };

{
  writeRegistry([connection({ id: "conn-idle", name: "Idle Beast" })]);
  writeProjects(project.id, "conn-idle");
  writeState({});
  const r = await executeAiTool("list_clusters", {}, ctx);
  const row = (r.detail as { roster: RosterRow[] }).roster[0];
  must(
    row?.dispatches === undefined,
    "T2a: zero records → the dispatches key is absent, not a zeroed block",
  );
  must(
    !(r.summary as string).includes("recorded dispatch"),
    "T2b: zero records → the spoken line stays clean (zero-noise)",
  );
}

/* ------------------------------------------------------------------ */
/* T3 — the résumé's arithmetic (buckets, lastRunAt, ≤3 newest first)   */
/* ------------------------------------------------------------------ */

console.log("T3. the ledger's arithmetic rides the roster");

{
  writeRegistry([connection({ id: "conn-busy", name: "GPU Cluster" })]);
  writeProjects(project.id, null);
  // five dispatches: 2 completed (exit 0), 1 failed (exit 137 — stopped),
  // 1 still running, 1 older completed that must fall off the ≤3 aperture
  writeState({
    r1: runRecord({ jobId: "job-old", type: "motioncorr", startedAt: "2026-09-29T01:00:00.000Z", done: true, exitCode: 0, connectionId: "conn-busy" }),
    r2: runRecord({ jobId: "job-stop", type: "class3d", startedAt: "2026-09-29T09:00:00.000Z", done: true, exitCode: 137, connectionId: "conn-busy" }),
    r3: runRecord({ jobId: "job-live", type: "class2d", startedAt: "2026-09-29T14:15:20.828Z", done: false, exitCode: null, connectionId: "conn-busy" }),
    r4: runRecord({ jobId: "job-mid", type: "refine3d", startedAt: "2026-09-29T07:16:19.124Z", done: true, exitCode: 0, connectionId: "conn-busy" }),
    // a LOCAL run (no remote) and another connection's run — neither may
    // leak into conn-busy's résumé
    r5: runRecord({ jobId: "job-local", type: "extract", startedAt: "2026-09-29T23:00:00.000Z", done: true, exitCode: 0, connectionId: "conn-other" }),
  });
  const r = await executeAiTool("list_clusters", {}, ctx);
  const d = r.detail as { roster: RosterRow[] };
  const row = d.roster.find((c) => c.id === "conn-busy");
  must(row?.dispatches != null, "T3a: a dispatched cluster wears its résumé");
  must(
    row?.dispatches?.total === 4,
    `T3b: total counts only THIS connection's records (got ${row?.dispatches?.total}, want 4)`,
  );
  must(
    row?.dispatches?.completed === 2 && row?.dispatches?.failed === 1,
    `T3c: exitCode 0 → completed, 137 → failed, running → neither (got ${row?.dispatches?.completed}/${row?.dispatches?.failed})`,
  );
  must(
    row?.dispatches?.lastRunAt === "2026-09-29T14:15:20.828Z",
    "T3d: lastRunAt is the newest dispatch, running or not",
  );
  const recent = row?.dispatches?.recent ?? [];
  must(
    recent.length === 3 && recent[0]?.jobId === "job-live" && recent[1]?.jobId === "job-stop" && recent[2]?.jobId === "job-mid",
    "T3e: recent is the 3 newest, newest first (the old one falls off the aperture)",
  );
  must(
    recent.every((e) => e.jobType && typeof e.done === "boolean" && typeof e.startedAt === "string"),
    "T3f: every recent entry names its jobType, done flag and startedAt",
  );
  must(
    !recent.some((e) => e.jobId === "job-local") && !recent.some((e) => e.jobId === "job-old"),
    "T3g: another connection's records and pre-aperture history never leak in",
  );
}

/* ------------------------------------------------------------------ */
/* T4 — the existence truth: the record outlives the job                */
/* ------------------------------------------------------------------ */

console.log("T4. exists is the canvas's truth, not the ledger's wish");

{
  // two of the three recent dispatches get REAL DB jobs — one on this
  // project, one on another canvas; the third stays ledger-only (gone)
  await db.job.create({
    data: { id: "job-live", projectId: project.id, type: "class2d", name: "Live Class2D", status: "running", x: 0, y: 0 },
  });
  await db.job.create({
    data: { id: "job-mid", projectId: other.id, type: "refine3d", name: "Cross Refine", status: "completed", x: 0, y: 0 },
  });
  const r = await executeAiTool("list_clusters", {}, ctx);
  const row = (r.detail as { roster: RosterRow[] }).roster.find((c) => c.id === "conn-busy");
  const recent = row?.dispatches?.recent ?? [];
  const live = recent.find((e) => e.jobId === "job-live");
  const cross = recent.find((e) => e.jobId === "job-mid");
  const gone = recent.find((e) => e.jobId === "job-stop");
  must(
    live?.exists === true && live?.projectName === "t476 records roll",
    "T4a: a job still on this canvas says exists:true and names its project",
  );
  must(
    cross?.exists === true && cross?.projectName === "Side Canvas",
    "T4b: a job on ANOTHER canvas says so (the t272 cross-canvas hint)",
  );
  must(
    gone?.exists === false && gone?.projectName === undefined,
    "T4c: a deleted job says exists:false and invents no project name",
  );
}

/* ------------------------------------------------------------------ */
/* T5 — the spoken line: the bound cluster's résumé earns a clause      */
/* ------------------------------------------------------------------ */

console.log("T5. the summary carries the bound cluster's résumé count");

{
  writeProjects(project.id, "conn-busy");
  const r = await executeAiTool("list_clusters", {}, ctx);
  must(
    (r.summary as string).includes('carries 4 recorded dispatches (3 newest in detail)'),
    `T5a: the spoken line names the bound cluster's count (got: ${r.summary})`,
  );
  must(
    (r.summary as string).includes('dispatches to "GPU Cluster"'),
    "T5b: the résumé clause joins the binding clause, not replaces it",
  );

  writeRegistry([connection({ id: "conn-busy", name: "GPU Cluster" }), connection({ id: "conn-idle", name: "Idle Beast" })]);
  const r2 = await executeAiTool("list_clusters", {}, ctx);
  must(
    !(r2.summary as string).includes("Idle Beast") || !(r2.summary as string).includes("0 recorded"),
    "T5c: unbound clusters' (empty) histories stay silent in the spoken line",
  );
}

/* ------------------------------------------------------------------ */
/* T6 — the law: résumé + record-outlives-job on the books              */
/* ------------------------------------------------------------------ */

console.log("T6. THE CLUSTER LAW now speaks the résumé");

{
  const prompt = buildSystemPrompt({ projectName: "t476 records roll", projectMode: "spa", projectRemote: null, jobCount: 0 });
  must(prompt.includes("THE CLUSTER LAW"), "T6a: the cluster law is in the doctrine");
  must(
    /dispatch résumé|dispatch résum/i.test(prompt.split("THE CLUSTER LAW")[1]?.split("\n")[0] ?? "") &&
      /outlives its job|exists:false/i.test(prompt.split("THE CLUSTER LAW")[1]?.split("\n")[0] ?? ""),
    "T6b: the law names the résumé and the record-outlives-job rule",
  );
  must(
    prompt.includes("这台集群最近跑过什么") && prompt.includes("11. THE CLUSTER LAW") && prompt.includes("12. After run_job or continue_run"),
    "T6c: the reads list answers the cluster-history question; numbering contiguous",
  );
}

console.log(`\nt476: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);

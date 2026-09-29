/**
 * t477 — the graveyard speaks its names (list_deleted + restore_deleted).
 *
 * delete_job has spoken since t341; its mirror was mute: "我之前删掉的
 * 任务还能找回吗" had no door, and the tombstones held only the run record
 * + wires — the row's name/params lived in the client's undo stack and
 * died with the page. This window: the tombstone snapshots the ROW too
 * (a grave that remembers its own name is self-sufficient), list_deleted
 * names every grave from the restore path's own read, and restore_deleted
 * runs the SAME restoreJobRows the canvas's undo button runs.
 *
 * This bench pins:
 *  T1  the catalog: 21 unique tools, list_deleted takes nothing,
 *      restore_deleted takes exactly job_id
 *  T2  an empty graveyard is a true answer
 *  T3  the grave remembers its row: writeJobTombstone snapshots
 *      type/name/params/status/workspace; the roll call wears name,
 *      deletedAt, the run summary and restorable:true
 *  T4  an old grave (t341-era, no row) stays honest: rowSnapshot:false
 *      with the why, and restore refuses instead of inventing a job
 *  T5  the verb is fire: restore brings the row back under the ORIGINAL
 *      id (status/params/workspace intact), the roll call then says the
 *      id is taken, and a second restore refuses
 *  T6  the running→idle coercion: a running grave comes back idle with
 *      coerced reported, never as a live process that no longer exists
 *  T7  the law: #13 names the mirror verbs, the reads list answers the
 *      graveyard question, numbering stays contiguous 1–14
 *
 * Run: bun run scripts/t477-graveyard-bench.ts
 */

import { execSync } from "child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

/* ------------------------------------------------------------------ */
/* Isolated world FIRST — env before any src import                     */
/* ------------------------------------------------------------------ */

const TMP = mkdtempSync(path.join(os.tmpdir(), "t477-graveyard-"));
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
const { writeJobTombstone, listJobTombstones } = await import("../src/lib/job-tombstone");
const { upsertRun, clearRunRecord } = await import("../src/lib/relion/engine");

const GRAVE_DIR = path.join(DATA_DIR, "deleted-jobs");

/* ------------------------------------------------------------------ */
/* T1 — the catalog                                                     */
/* ------------------------------------------------------------------ */

console.log("T1. 22 tools; the graveyard read and the restore verb");

{
  must(
    AI_TOOLS.length === 22 && new Set(AI_TOOLS.map((t) => t.name)).size === 22,
    `T1a: 22 unique tools (got ${AI_TOOLS.length})`,
  );
  const list = AI_TOOLS.find((t) => t.name === "list_deleted");
  const restore = AI_TOOLS.find((t) => t.name === "restore_deleted");
  const lp = (list?.parameters ?? {}) as { properties?: Record<string, unknown>; additionalProperties?: unknown };
  must(
    lp.properties != null && Object.keys(lp.properties).length === 0 && lp.additionalProperties === false,
    "T1b: list_deleted takes nothing at all",
  );
  const rp = (restore?.parameters ?? {}) as {
    properties?: { job_id?: unknown };
    required?: string[];
    additionalProperties?: unknown;
  };
  must(
    rp.properties?.job_id != null && rp.required?.includes("job_id") === true && rp.additionalProperties === false,
    "T1c: restore_deleted takes exactly job_id (required)",
  );
  must(
    /graveyard|tombstone/i.test(list?.description ?? "") && /ORIGINAL id/.test(restore?.description ?? ""),
    "T1d: the descriptions name the graveyard and the original-id law",
  );
}

/* ------------------------------------------------------------------ */
/* T2 — an empty graveyard is a true answer                             */
/* ------------------------------------------------------------------ */

console.log("T2. no graves yet — a true answer, not a refusal");

const project = await db.project.create({ data: { name: "t477 graveyard" } });
const ws = await db.workspace.create({ data: { projectId: project.id, name: "Main" } });
const ctx = { projectId: project.id };

{
  const r = await executeAiTool("list_deleted", {}, ctx);
  must(
    r.ok === true && (r.summary as string).includes("graveyard is empty"),
    "T2a: the empty graveyard answers ok:true and says so",
  );
}

/* ------------------------------------------------------------------ */
/* T3 — the grave remembers its row                                     */
/* ------------------------------------------------------------------ */

console.log("T3. a t477 grave carries the row snapshot");

let jobIdA = "";
let upstreamId = "";
{
  const job = await db.job.create({
    data: {
      projectId: project.id,
      workspaceId: ws.id,
      type: "class2d",
      name: "2D Classification (deleted)",
      x: 100,
      y: 200,
      status: "completed",
      progress: 100,
      params: JSON.stringify({ threads: 8 }),
      result: "74 classes survived",
      duration: 60000,
    },
  });
  jobIdA = job.id;
  // an upstream + edge, created while the row is ALIVE — the tombstone
  // snapshots the wire and the restore should re-attach it
  const upstream = await db.job.create({
    data: { projectId: project.id, workspaceId: ws.id, type: "import", name: "Import Movies", x: 0, y: 0, status: "completed", params: "{}" },
  });
  upstreamId = upstream.id;
  await db.edge.create({
    data: { projectId: project.id, fromJobId: upstream.id, toJobId: jobIdA },
  });
  // a run record so the grave's run summary has something true to say
  upsertRun(jobIdA, {
    jobId: jobIdA,
    projectId: project.id,
    type: "class2d",
    pid: null,
    cmd: "relion_refine",
    workdir: "/data/run_it000",
    logFile: "/data/run_it000/log",
    errFile: "/data/run_it000/err",
    startedAt: "2026-09-30T02:40:00.000Z",
    outputs: {},
    done: true,
    exitCode: 0,
  });
  await writeJobTombstone(jobIdA);
  clearRunRecord(jobIdA); // the DELETE route's own hygiene — a bench delete mimics it
  await db.job.delete({ where: { id: jobIdA } });

  const r = await executeAiTool("list_deleted", {}, ctx);
  const graves = (r.detail as { graves: Array<Record<string, unknown>> }).graves;
  must(graves.length === 1, "T3a: the grave answers the roll call");
  const g = graves[0];
  must(
    g.id === jobIdA && g.name === "2D Classification (deleted)" && g.type === "class2d",
    "T3b: the grave names its job (id, name, type from the row snapshot)",
  );
  must(
    typeof g.deletedAt === "string" && g.rowSnapshot === true && g.restorable === true,
    "T3c: the grave wears its deletion time and restorable:true",
  );
  must(
    (g.run as Record<string, unknown> | null)?.exitCode === 0,
    "T3d: the run summary quotes the ledger's exit code",
  );
  must(
    typeof g.edges === "number" && (r.summary as string).includes("1 deleted job in the graveyard, 1 restorable"),
    "T3e: the spoken line counts the graves and the restorable",
  );
}

/* ------------------------------------------------------------------ */
/* T4 — an old grave stays honest (t341-era, no row)                    */
/* ------------------------------------------------------------------ */

console.log("T4. a row-less grave confesses what it cannot do");

{
  mkdirSync(GRAVE_DIR, { recursive: true });
  const oldGrave = {
    id: "grave-old-0000",
    deletedAt: "2026-09-28T05:23:55.131Z",
    record: null,
    fileEdges: [],
    dbEdges: [],
  };
  writeFileSync(path.join(GRAVE_DIR, "grave-old-0000.json"), JSON.stringify(oldGrave, null, 2));

  const r = await executeAiTool("list_deleted", {}, ctx);
  const graves = (r.detail as { graves: Array<Record<string, unknown>> }).graves;
  const old = graves.find((g) => g.id === "grave-old-0000");
  must(
    old?.rowSnapshot === false && old?.restorable === false && /row snapshot/.test(old?.why as string),
    "T4a: the old grave says rowSnapshot:false and names its why",
  );

  const v = await executeAiTool("restore_deleted", { job_id: "grave-old-0000" }, ctx);
  must(
    v.ok === false && /canvas's undo|create_job/i.test(v.summary as string),
    "T4b: the verb refuses a row-less grave instead of inventing a job",
  );
  must(
    listJobTombstones().length === 2 && listJobTombstones()[1]?.id === "grave-old-0000",
    "T4c: the roll call sorts newest first (the t341 grave sits at the tail)",
  );
}

/* ------------------------------------------------------------------ */
/* T5 — the verb is fire                                                */
/* ------------------------------------------------------------------ */

console.log("T5. restore_deleted brings the row back under its original id");

{
  // jobIdA's grave (written in T3 while the row was alive) already carries
  // the upstream edge — no fixture work left, only the fire
  const ghost = await executeAiTool("restore_deleted", { job_id: "cmusk-never-was" }, ctx);
  must(
    ghost.ok === false && /No tombstone/.test(ghost.summary as string),
    "T5a: a restore of an id no grave holds refuses honestly",
  );

  const v = await executeAiTool("restore_deleted", { job_id: jobIdA }, ctx);
  must(v.ok === true && /back on the canvas under its original id/.test(v.summary as string), "T5b: the restore fires and says the original id");
  const row = await db.job.findUnique({ where: { id: jobIdA } });
  must(
    row != null && row.status === "completed" && row.name === "2D Classification (deleted)" && row.workspaceId === ws.id,
    "T5c: the row is back — status, name and home intact",
  );
  must(
    JSON.parse(row?.params ?? "{}").threads === 8,
    "T5d: the params survived the round trip (scalar-filtered, not verbatim-trusted)",
  );
  const edgeBack = await db.edge.findUnique({
    where: { fromJobId_toJobId: { fromJobId: upstreamId, toJobId: jobIdA } },
  });
  must(edgeBack != null && /wire re-attached/.test(v.summary as string), "T5e: the wire came back and the summary says so");
  must(
    /run record \(outputs, results\) re-attached/.test(v.summary as string),
    "T5f: the run record re-attach is spoken (downstream can consume again)",
  );

  const again = await executeAiTool("restore_deleted", { job_id: jobIdA }, ctx);
  must(
    again.ok === false && /already exists/.test((again.detail as { failed: Array<{ error: string }> }).failed[0]?.error ?? ""),
    "T5g: a second restore refuses — the id is taken (the double-undo guard)",
  );

  const roll = await executeAiTool("list_deleted", {}, ctx);
  const g = (roll.detail as { graves: Array<Record<string, unknown>> }).graves.find((x) => x.id === jobIdA);
  must(
    g?.restorable === false && /already restored or re-created/.test(g?.why as string),
    "T5h: the roll call now marks the grave occupied (it never promises a blocked restore)",
  );
}

/* ------------------------------------------------------------------ */
/* T6 — the running→idle coercion                                       */
/* ------------------------------------------------------------------ */

console.log("T6. a running grave comes back idle, never as a ghost process");

{
  const job = await db.job.create({
    data: {
      projectId: project.id,
      workspaceId: ws.id,
      type: "motioncorr",
      name: "Motion Correction (running)",
      x: 0,
      y: 300,
      status: "running",
      progress: 42,
      params: "{}",
      startedAt: new Date(),
    },
  });
  await writeJobTombstone(job.id);
  await db.job.delete({ where: { id: job.id } });

  const v = await executeAiTool("restore_deleted", { job_id: job.id }, ctx);
  must(
    v.ok === true && /came back idle/.test(v.summary as string),
    "T6a: the restore speaks the coercion (running was stopped at delete time)",
  );
  const row = await db.job.findUnique({ where: { id: job.id } });
  must(
    row?.status === "idle" && row?.progress === 0 && row?.startedAt === null,
    "T6b: the row is idle with no progress and no start timestamp (the PATCH reset semantics)",
  );
}

/* ------------------------------------------------------------------ */
/* T7 — the law                                                         */
/* ------------------------------------------------------------------ */

console.log("T7. #13 speaks the mirror verbs");

{
  const prompt = buildSystemPrompt({ projectName: "t477 graveyard", projectMode: "spa", projectRemote: null, jobCount: 0 });
  must(
    /13\. delete_job refuses/.test(prompt) && prompt.includes("restore_deleted") && prompt.includes("ORIGINAL id"),
    "T7a: #13 names the mirror verbs and the original-id law",
  );
  must(
    prompt.includes("被删的任务能找回吗") && prompt.split("QUESTIONS ARE READS")[1]?.includes("list_deleted"),
    "T7b: the reads list answers the graveyard question",
  );
  must(
    prompt.includes("14. After tool calls") && prompt.includes("15. THE CURVE LAW"),
    "T7c: the numbering stays contiguous 1–15 (t486's curve law joined the book)",
  );
}

console.log(`\nt477: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);

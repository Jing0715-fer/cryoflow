/**
 * t481 — the graves wear epitaphs.
 *
 * The drawer's one-line rows could not carry the grave's story: the run's
 * verdict and its result lived in a title attribute (invisible to touch,
 * easy to miss on hover), the why lived nowhere visible at all. This
 * round gives every grave a READING layer:
 *   - graveRunLine: the run's own one-line verdict, computed ONCE in the
 *     roll call brain (graveRowsOf) so the agent's list_deleted quotes
 *     the same sentence the drawer's epitaph prints — one grammar, two
 *     faces, zero drift;
 *   - the omission law: a grave with no run record wears no runLine —
 *     absence is the honest zero, the key stays absent;
 *   - the two-faces law: list_deleted's rows stay JSON-equal to
 *     graveRowsOf() WITH the new field riding along.
 *
 * The coercion grammar is closed (writeJobTombstone coerces terminal):
 *   exit 0 → finished clean · exit -1 → was stopped (the coercion's own
 *   sentinel) · any other real code → failed · null → still running.
 *
 * Run: bun run scripts/t481-grave-epitaph-bench.ts
 */

import { mkdtempSync, mkdirSync, writeFileSync } from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

/* ------------------------------------------------------------------ */
/* Isolated world FIRST — env before any src import                     */
/* ------------------------------------------------------------------ */

const TMP = mkdtempSync(path.join(os.tmpdir(), "t481-grave-epitaph-"));
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

import { execSync } from "child_process";

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
const { graveRowsOf, graveRunLine, writeJobTombstone } = await import("../src/lib/job-tombstone");
const { clearRunRecord, upsertRun } = await import("../src/lib/relion/engine");
const { db } = await import("../src/lib/db");

/* ------------------------------------------------------------------ */
/* Fixture — one clean grave, one stopped grave, one record-less grave  */
/* ------------------------------------------------------------------ */

const project = await db.project.create({ data: { name: "t481 epitaphs" } });
const ws = await db.workspace.create({ data: { projectId: project.id, name: "Main" } });
const ctx = { projectId: project.id };

async function makeGrave(name: string, run: { done: boolean; exitCode: number | null; result?: string } | null) {
  const job = await db.job.create({
    data: {
      projectId: project.id,
      workspaceId: ws.id,
      type: "class2d",
      name,
      x: 100,
      y: 200,
      status: run?.done ? "completed" : "running",
      progress: run?.done ? 100 : 40,
      params: JSON.stringify({ threads: 4 }),
      result: run?.result ?? null,
      duration: 60000,
    },
  });
  if (run) {
    upsertRun(job.id, {
      jobId: job.id,
      projectId: project.id,
      type: "class2d",
      pid: null,
      cmd: "relion_refine",
      workdir: "/not-under-relion/run_it000",
      logFile: "/not-under-relion/run_it000/log",
      errFile: "/not-under-relion/run_it000/err",
      startedAt: "2026-09-30T03:40:00.000Z",
      outputs: {},
      done: run.done,
      exitCode: run.exitCode,
      ...(run.result ? { result: run.result } : {}),
    } as Parameters<typeof upsertRun>[1]);
  }
  await writeJobTombstone(job.id);
  clearRunRecord(job.id);
  await db.job.delete({ where: { id: job.id } });
  return job.id;
}

const cleanId = await makeGrave("2D Classification (clean)", {
  done: true,
  exitCode: 0,
  result: "74 classes survived",
});
const stoppedId = await makeGrave("2D Classification (stopped)", {
  done: false,
  exitCode: null,
});

/* a t341-era grave: no row snapshot, no run record — the omission law's
 * own witness (runLine must stay ABSENT, never an invented verdict) */
const GRAVE_DIR = path.join(DATA_DIR, "deleted-jobs");
mkdirSync(GRAVE_DIR, { recursive: true });
writeFileSync(
  path.join(GRAVE_DIR, "grave-old-epitaph.json"),
  JSON.stringify(
    { id: "grave-old-epitaph", deletedAt: "2026-09-28T05:00:00.000Z", record: null, fileEdges: [], dbEdges: [] },
    null,
    2
  )
);

/* ------------------------------------------------------------------ */
/* T1 — the grammar is closed (graveRunLine truth table)                */
/* ------------------------------------------------------------------ */

console.log("T1. graveRunLine — one closed grammar for the run's own words");

{
  must(
    graveRunLine({ done: true, exitCode: 0 }) === "finished clean (exit 0)",
    "T1a: exit 0 reads finished clean (exit 0)"
  );
  must(
    graveRunLine({ done: true, exitCode: -1 }) === "was stopped when it was deleted",
    "T1b: exit -1 (the stop coercion's own sentinel) reads was stopped"
  );
  must(
    graveRunLine({ done: true, exitCode: 137 }) === "failed (exit 137)",
    "T1c: a real exit code reads failed (exit 137)"
  );
  must(
    graveRunLine({ done: false, exitCode: null }) === "was still running when it was deleted",
    "T1d: exit null (pre-coercion shape) reads still running"
  );
  must(graveRunLine(null) === undefined, "T1e: no run record → undefined (the omission law)");
}

/* ------------------------------------------------------------------ */
/* T2 — the roll call wears the verdicts                                */
/* ------------------------------------------------------------------ */

console.log("T2. graveRowsOf rows carry runLine — and the record-less grave stays silent");

{
  const rows = await graveRowsOf();
  const clean = rows.find((r) => r.id === cleanId);
  const stopped = rows.find((r) => r.id === stoppedId);
  const old = rows.find((r) => r.id === "grave-old-epitaph");

  must(
    !!clean && clean.runLine === "finished clean (exit 0)",
    "T2a: the clean grave's row says finished clean (exit 0)"
  );
  must(
    !!clean && clean.run?.result === "74 classes survived",
    "T2b: the clean grave's row keeps the run's own result line"
  );
  must(
    !!stopped && stopped.runLine === "was stopped when it was deleted",
    "T2c: the stopped grave's row says was stopped (the t341 coercion speaks)"
  );
  must(!!stopped && stopped.run?.done === true, "T2d: the stopped grave's record is terminal (done true)");
  must(
    !!old && !("runLine" in old) && old.run === null,
    "T2e: the record-less grave wears NO runLine — absence, never an invented verdict"
  );
  must(
    rows.every((r) => r.runLine === undefined || typeof r.runLine === "string"),
    "T2f: runLine is a string or absent — never null, never an empty lie"
  );
}

/* ------------------------------------------------------------------ */
/* T3 — one brain, two faces (the new field rides BOTH)                 */
/* ------------------------------------------------------------------ */

console.log("T3. list_deleted's rows and graveRowsOf's rows stay ONE roll call");

{
  const tool = await executeAiTool("list_deleted", {}, ctx);
  const toolRows = (tool.detail as { graves: unknown[] }).graves;
  const libRows = await graveRowsOf();
  must(
    JSON.stringify(toolRows) === JSON.stringify(libRows),
    "T3a: with runLine riding, the tool's detail.graves is still field-for-field graveRowsOf()"
  );
  must(
    JSON.stringify(toolRows).includes('"runLine":"finished clean (exit 0)"'),
    "T3b: the agent's rows quote the same verdict the epitaph prints"
  );
}

/* ------------------------------------------------------------------ */
/* T4 — the tool's own contract names the field                         */
/* ------------------------------------------------------------------ */

console.log("T4. the directory speaks the epitaph");

{
  const listDeleted = AI_TOOLS.find((t) => t.name === "list_deleted");
  must(!!listDeleted, "T4a: list_deleted is on the roster");
  must(
    !!listDeleted && (listDeleted.description as string).includes("runLine"),
    "T4b: the description names runLine — the model knows the verdict field exists"
  );
  must(
    AI_TOOLS.length === 29,
    "T4c: the roster holds 29 tools — an epitaph is a field, not a new verb (t486, t503, t508, t511, t512 and t513 are the births since)"
  );
}

/* ------------------------------------------------------------------ */

console.log(`\nt481 grave-epitaph bench: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

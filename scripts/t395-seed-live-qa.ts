/**
 * t395 live-QA seed — the fixture for the "Continue from here:" picker
 * under the REAL-NAMING companion law.
 *
 *   · class2d workdir: it001 EM complete (classes.mrcs stack), it002 VDAM
 *     complete (classes.mrcs + both moment stacks → the newest), it003 torn
 *     (optimiser + data only — the picker's disabled-with-named-reasons row);
 *   · refine3d workdir (GOLD): it004 complete (both half MODEL stars + the
 *     filtered half refs), it005 torn (half1_model.star died mid-flush);
 *   · DB: one project + one workspace + the two jobs (ids matching the run
 *     records) + an edge class2d → refine3d (so the refine3d picker shows
 *     BOTH its own gold rounds and the class2d upstream group);
 *   · engine-state.json: two LOCAL run records (done, exit 0) pointing at
 *     the workdirs.
 *
 * Run: bun run scripts/t395-seed-live-qa.ts
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// (import.meta.dir is a Bun extension tsc cannot see — the standard URL
// form keeps both runtimes and the typecheck honest)
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(REPO, "data");
const RELION_ROOT = path.join(DATA, "relion");
const PROJECT_ID = "cmui4e1600000ojgodyawasbh";
const JOB_A = "cmui4e172000cojgo2urmuczl"; // class2d
const JOB_B = "cmui4item000eojgokx3n74iv"; // refine3d
const DIR_A = path.join(RELION_ROOT, PROJECT_ID, "class2d_2urmuczl");
const DIR_B = path.join(RELION_ROOT, PROJECT_ID, "refine3d_kx3n74iv");

function touch(dir: string, files: string[]): void {
  mkdirSync(dir, { recursive: true });
  for (const f of files) writeFileSync(path.join(dir, f), "x".repeat(64));
}

// ---- the workdirs -------------------------------------------------------
rmSync(DIR_A, { recursive: true, force: true });
rmSync(DIR_B, { recursive: true, force: true });

touch(DIR_A, [
  // it001 — EM, complete
  "run_it001_optimiser.star", "run_it001_data.star", "run_it001_model.star", "run_it001_sampling.star",
  "run_it001_classes.mrcs",
  // it002 — VDAM, complete → the newest
  "run_it002_optimiser.star", "run_it002_data.star", "run_it002_model.star", "run_it002_sampling.star",
  "run_it002_classes.mrcs", "run_it002_1moment.mrcs", "run_it002_2moment.mrcs",
  // it003 — torn mid-flush (optimiser + data only)
  "run_it003_optimiser.star", "run_it003_data.star",
  // noise that must never answer
  "run.out", "run.err", "note.txt",
]);

touch(DIR_B, [
  // it004 — gold, complete
  "run_it004_optimiser.star", "run_it004_data.star", "run_it004_sampling.star",
  "run_it004_half1_model.star", "run_it004_half2_model.star",
  "run_it004_half1_class001.mrc", "run_it004_half2_class001.mrc",
  // it005 — gold, torn (half2 written, half1's star died mid-flush)
  "run_it005_optimiser.star", "run_it005_data.star", "run_it005_sampling.star",
  "run_it005_half2_model.star", "run_it005_half2_class001.mrc",
  "run.out", "run.err",
]);

// ---- the run records ----------------------------------------------------
const state = {
  [JOB_A]: {
    jobId: JOB_A,
    projectId: PROJECT_ID,
    type: "class2d",
    pid: null,
    cmd: "relion_refine --i particles.star --o run (t395 fixture, real naming)",
    workdir: DIR_A,
    logFile: path.join(DIR_A, "run.out"),
    errFile: path.join(DIR_A, "run.err"),
    startedAt: new Date().toISOString(),
    outputs: {},
    done: true,
    exitCode: 0,
  },
  [JOB_B]: {
    jobId: JOB_B,
    projectId: PROJECT_ID,
    type: "refine3d",
    pid: null,
    cmd: "mpirun -n 7 relion_refine_mpi --auto_refine (t395 fixture, gold naming)",
    workdir: DIR_B,
    logFile: path.join(DIR_B, "run.out"),
    errFile: path.join(DIR_B, "run.err"),
    startedAt: new Date().toISOString(),
    outputs: {},
    done: true,
    exitCode: 0,
  },
};
writeFileSync(path.join(DATA, "engine-state.json"), JSON.stringify(state, null, 2));
console.log("seed: engine-state.json + workdirs written (real RELION naming)");

// ---- the DB -------------------------------------------------------------
process.env.DATABASE_URL = `file:${path.join(REPO, "db", "cryoflow.db")}`;
const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();
await db.edge.deleteMany({});
await db.job.deleteMany({});
await db.workspace.deleteMany({});
await db.project.deleteMany({});
const proj = await db.project.create({
  data: { id: PROJECT_ID, name: "t395 live QA — the round picker under real naming" },
});
const ws = await db.workspace.create({
  data: { projectId: proj.id, name: "Main", order: 0 },
});
const a = await db.job.create({
  data: {
    id: JOB_A, projectId: proj.id, workspaceId: ws.id, type: "class2d",
    name: "2D Classification", x: 400, y: 200, status: "idle",
    params: "{}",
  },
});
const b = await db.job.create({
  data: {
    id: JOB_B, projectId: proj.id, workspaceId: ws.id, type: "refine3d",
    name: "3D Auto-Refine", x: 800, y: 200, status: "idle",
    params: "{}",
  },
});
await db.edge.create({ data: { projectId: proj.id, fromJobId: a.id, toJobId: b.id } });
await db.$disconnect();
console.log(`seed: DB rows — project ${proj.id}, class2d ${a.id}, refine3d ${b.id}, edge A→B`);

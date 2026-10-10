/**
 * t396 live-QA seed — the USER'S exact world for the continue-picker
 * regression: the run records were CLEARED (Reset-to-idle after the
 * failed dispatches — the standard "re-configure and re-run" flow), and
 * the output directories still hold their rounds, including the user's
 * run_it025_optimiser.star.
 *
 *   · class2d workdir: it024 complete, it025 complete (THE FILE the user
 *     named — newest), it026 torn (optimiser + data only);
 *   · refine3d workdir (GOLD): it004 complete, it005 torn;
 *   · DB: project + workspace + the two IDLE jobs + an edge class2d →
 *     refine3d (so the refine3d picker shows its own derived gold rounds
 *     AND the class2d upstream's derived rounds);
 *   · engine-state.json: DELETED — no run records anywhere. The picker
 *     must find everything through the t396 derived-workdir fallback.
 *
 * Run: bun run scripts/t396-seed-live-qa.ts
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(REPO, "data");
const RELION_ROOT = path.join(DATA, "relion");
const PROJECT_ID = "ck396proj000000000000000001";
const JOB_A = "ck396joba000000000000000002"; // class2d
const JOB_B = "ck396jobb000000000000000003"; // refine3d
const DIR_A = path.join(RELION_ROOT, PROJECT_ID, `class2d_${JOB_A.slice(-8)}`);
const DIR_B = path.join(RELION_ROOT, PROJECT_ID, `refine3d_${JOB_B.slice(-8)}`);

function touch(dir: string, files: string[]): void {
  mkdirSync(dir, { recursive: true });
  for (const f of files) writeFileSync(path.join(dir, f), "x".repeat(64));
}

// ---- the workdirs (rounds intact, records gone) --------------------------
rmSync(DIR_A, { recursive: true, force: true });
rmSync(DIR_B, { recursive: true, force: true });

touch(DIR_A, [
  // it024 — EM, complete
  "run_it024_optimiser.star", "run_it024_data.star", "run_it024_model.star", "run_it024_sampling.star",
  "run_it024_classes.mrcs",
  // it025 — complete → the newest (THE user-named file)
  "run_it025_optimiser.star", "run_it025_data.star", "run_it025_model.star", "run_it025_sampling.star",
  "run_it025_classes.mrcs",
  // it026 — torn mid-flush (optimiser + data only)
  "run_it026_optimiser.star", "run_it026_data.star",
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

// ---- NO run records — the Reset-to-idle world ----------------------------
rmSync(path.join(DATA, "engine-state.json"), { force: true });
console.log("seed: engine-state.json DELETED — no run records (the reset world)");

// ---- the DB -------------------------------------------------------------
process.env.DATABASE_URL = `file:${path.join(REPO, "db", "cryoflow.db")}`;
const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();
await db.edge.deleteMany({});
await db.job.deleteMany({});
await db.workspace.deleteMany({});
await db.project.deleteMany({});
const proj = await db.project.create({
  data: { id: PROJECT_ID, name: "t396 live QA — derived fallback after reset" },
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
console.log(`seed: DB rows — project ${proj.id}, class2d ${a.id}, refine3d ${b.id}, edge A→B (all idle, no records)`);

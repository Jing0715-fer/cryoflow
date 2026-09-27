/**
 * t402b — the intermediate-selection E2E seed (LOCAL lane, no RELION, no SSH).
 *
 * The user's ask: 「select 2d 增加支持从 2d 的中间结果选取颗粒，不一定
 * 非得是完全跑完，同理 3d 分类也是」. This seed builds the exact world the
 * field report came from — a class2d that died mid-run (the "interrupted
 * (exit unknown)" verdict) whose workdir still holds settled rounds — plus
 * its 3D twin in REAL RELION's class3d dialect (per-class VOLUMES, no
 * combined classes.mrcs) so both thumbnail lanes and both fallback mouths are
 * exercised:
 *
 *   class2d "2D cls · torn at it003" (failed)
 *     - it000/it001/it002: complete families (data + model + optimiser +
 *       classes.mrcs stack)
 *     - it003: a data star with NO sibling witness (the torn-write guard's
 *       proof — the gallery and the engine must BOTH answer iteration 2,
 *       never the half-written 3)
 *   select2d "Select from 2D (torn)"      ← wired class2d, classes "1,2"
 *   class3d "3D cls · volume dialect" (failed)
 *     - it001/it002: data + optimiser + run_itNNN_class00K.mrc VOLUMES,
 *       deliberately NO classes.mrcs anywhere (the volumeFiles lane)
 *   select2d "Select from 3D (volumes)"   ← wired class3d, classes "1"
 *
 * Expected after dispatching the selects:
 *   selA: 21 of 30 particles kept (classes 1,2 of it002: 12+9)
 *   selB: 8 of 15 particles kept (class 1 of it002: 8)
 * Both logs must carry the "source: iteration 2 … (not completed)" note.
 *
 * Idempotent: the project is wiped and rebuilt on every run.
 * Run: bun scripts/t402b-select-intermediate.mjs
 */
import fs from "fs";
import path from "path";

// Pin the DB BEFORE the PrismaClient constructor reads the env: the tool
// shell exports a TEMPLATE DATABASE_URL (custom.db in another project)
// that would silently redirect this seed into the wrong file. The escape
// hatch is CRYOFLOW_SEED_DB for anyone seeding elsewhere.
process.env.DATABASE_URL =
  process.env.CRYOFLOW_SEED_DB ??
  "file:" + path.join(path.resolve(import.meta.dir, ".."), "db", "cryoflow.db");
const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();
const PROJECT_NAME = "t402b — intermediate selection";
// project root (this script lives in scripts/) — cwd-independent
const ROOT = path.resolve(import.meta.dir, "..");
const DATA_ROOT = process.env.CRYOFLOW_DATA_DIR ?? path.join(ROOT, "data");
const RELION_DIR = path.join(DATA_ROOT, "relion");

/* ---------- tiny MRC2014 writer (mode 2, little-endian, no extended header) ---------- */
function writeMrc(file, nx, ny, nz, fillFn) {
  const header = Buffer.alloc(1024);
  header.writeInt32LE(nx, 0);
  header.writeInt32LE(ny, 4);
  header.writeInt32LE(nz, 8);
  header.writeInt32LE(2, 12); // mode 2 = float32
  header.writeFloatLE(nx, 40); // cella x (1 Å/px)
  header.writeFloatLE(ny, 44);
  header.writeFloatLE(nz, 48);
  const data = Buffer.alloc(nx * ny * nz * 4);
  let o = 0;
  for (let z = 0; z < nz; z++) {
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        data.writeFloatLE(fillFn(x, y, z), o);
        o += 4;
      }
    }
  }
  fs.writeFileSync(file, Buffer.concat([header, data]));
}

/** a class-average-looking pattern, distinct per class index */
const classPattern = (cls) => (x, y, z) =>
  Math.sin((x + cls * 9) * 0.28) * Math.cos((y + cls * 5) * 0.22) +
  0.4 * Math.sin(((x + y) / (6 + cls)) + z * 0.05) * (cls % 2 === 0 ? 1 : -1);

/* ---------- STAR writers ---------- */
function dataStarText(classCounts) {
  const rows = [];
  let p = 1;
  classCounts.forEach((n, ci) => {
    for (let k = 0; k < n; k++) {
      rows.push(`part_${String(p).padStart(5, "0")}@../stack.mrcs ${ci + 1}`);
      p++;
    }
  });
  return [
    "",
    "data_particles",
    "",
    "loop_",
    "_rlnImageName #1",
    "_rlnClassNumber #2",
    ...rows,
    "",
    "",
  ].join("\n");
}

const tinyStar = (name) => `# ${name} — t402b witness stub\ndata_${name}\n\n_rlnCurrentIteration 0\n`;

function writeRound(dir, iter, classCounts, { volumes, witnesses }) {
  const pad = String(iter).padStart(3, "0");
  fs.writeFileSync(path.join(dir, `run_it${pad}_data.star`), dataStarText(classCounts));
  for (const w of witnesses) {
    fs.writeFileSync(path.join(dir, `run_it${pad}_${w}.star`), tinyStar(w));
  }
  if (volumes) {
    for (let c = 1; c <= classCounts.length; c++) {
      writeMrc(
        path.join(dir, `run_it${pad}_class${String(c).padStart(3, "0")}.mrc`),
        64,
        64,
        64,
        classPattern(c)
      );
    }
  }
}

// The class stack needs each slice visually distinct: write it properly
// (one writeMrc with a z-aware fill).
function writeClassStack(dir, iter, k) {
  const pad = String(iter).padStart(3, "0");
  writeMrc(path.join(dir, `run_it${pad}_classes.mrcs`), 64, 64, k, (x, y, z) =>
    Math.sin((x + (z + 1) * 9) * 0.28) * Math.cos((y + (z + 1) * 5) * 0.22) +
    0.4 * Math.sin((x + y) / (6 + z + 1))
  );
}

/* ---------- main ---------- */
async function main() {
  const existing = await db.project.findFirst({ where: { name: PROJECT_NAME } });
  if (existing) {
    await db.project.delete({ where: { id: existing.id } });
    console.log(`[seed] wiped previous "${PROJECT_NAME}"`);
  }
  const project = await db.project.create({ data: { name: PROJECT_NAME } });
  console.log(`[seed] project ${project.id}`);

  const mk = (type, name, status, params, x, y) =>
    db.job.create({
      data: { projectId: project.id, type, name, status, params: JSON.stringify(params), x, y },
    });

  const c2d = await mk("class2d", "2D cls · torn at it003", "failed", {}, 220, 160);
  const selA = await mk("select2d", "Select from 2D (torn)", "idle", { selectedClasses: "1,2" }, 620, 160);
  const c3d = await mk("class3d", "3D cls · volume dialect", "failed", {}, 220, 460);
  const selB = await mk("select2d", "Select from 3D (volumes)", "idle", { selectedClasses: "1" }, 620, 460);

  await db.edge.create({ data: { projectId: project.id, fromJobId: c2d.id, toJobId: selA.id } });
  await db.edge.create({ data: { projectId: project.id, fromJobId: c3d.id, toJobId: selB.id } });

  const tornResult = JSON.stringify({
    message: "interrupted (exit unknown) — rounds it000–it002 settled on disk",
  });
  await db.job.update({ where: { id: c2d.id }, data: { result: tornResult, progress: 72 } });
  await db.job.update({ where: { id: c3d.id }, data: { result: tornResult, progress: 64 } });

  // ---- the 2D workdir: settled families + one torn round -----------------
  const dir2d = path.join(RELION_DIR, project.id, `class2d_${c2d.id.slice(-8)}`);
  fs.mkdirSync(dir2d, { recursive: true });
  writeRound(dir2d, 0, [4, 2, 2, 2], { witnesses: ["model", "optimiser"] });
  writeRound(dir2d, 1, [10, 4, 3, 3], { witnesses: ["model", "optimiser"] });
  writeRound(dir2d, 2, [12, 9, 6, 3], { witnesses: ["model", "optimiser"] });
  writeClassStack(dir2d, 1, 4);
  writeClassStack(dir2d, 2, 4);
  // the torn round: a data star with NO witness — the guard must skip it
  fs.writeFileSync(path.join(dir2d, "run_it003_data.star"), dataStarText([40, 0, 0, 0]));
  console.log(`[seed] 2D workdir: ${dir2d} (it000-002 settled, it003 witnessless)`);

  // ---- the 3D workdir: REAL RELION class3d dialect (volumes only) ----------
  const dir3d = path.join(RELION_DIR, project.id, `class3d_${c3d.id.slice(-8)}`);
  fs.mkdirSync(dir3d, { recursive: true });
  writeRound(dir3d, 1, [5, 4, 3], { witnesses: ["optimiser"], volumes: true });
  writeRound(dir3d, 2, [8, 5, 2], { witnesses: ["optimiser"], volumes: true });
  console.log(`[seed] 3D workdir: ${dir3d} (volume dialect, no classes.mrcs)`);

  // ---- run records: the honest shape of an interrupted LOCAL run ---------
  // The render routes (iterations/image, outputs/file) resolve the workdir
  // through the run record — a torn job in the real world ALWAYS has one
  // (the interrupted run wrote it before dying). Without it the gallery
  // would answer counts but no thumbnails, which is not the world we seed.
  const stateFile = path.join(DATA_ROOT, "engine-state.json");
  let state = {};
  try {
    state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    if (!state || typeof state !== "object" || Array.isArray(state)) state = {};
  } catch {
    /* fresh state */
  }
  const startedAt = new Date(Date.now() - 45 * 60_000).toISOString();
  for (const [job, dir] of [
    [c2d, dir2d],
    [c3d, dir3d],
  ]) {
    fs.writeFileSync(
      path.join(dir, "run.out"),
      [
        " RELION: 2D/3D classification (t402b seed — torn world)",
        " iteration 000 · 001 · 002 settled",
        " iteration 003 ... (no further output)",
        "",
      ].join("\n")
    );
    fs.writeFileSync(
      path.join(dir, "run.err"),
      [
        " + initialising ...",
        " + iteration 002 finished",
        " [engine] process exited without a code (interrupted)",
        "",
      ].join("\n")
    );
    state[job.id] = {
      jobId: job.id,
      projectId: project.id,
      type: job.type,
      pid: null,
      cmd: "relion_refine --i particles.star --o run (torn mid-flight)",
      workdir: dir,
      logFile: path.join(dir, "run.out"),
      errFile: path.join(dir, "run.err"),
      startedAt,
      outputs: {},
      done: true,
      exitCode: null,
      result: "interrupted (exit unknown)",
    };
  }
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  console.log(`[seed] run records written to ${stateFile}`);

  // ---- register + activate the project (the file registry the app reads) ----
  const projectsFile = path.join(DATA_ROOT, "projects.json");
  let pf = { active: null, projects: {} };
  try {
    pf = JSON.parse(fs.readFileSync(projectsFile, "utf8"));
    if (!pf || typeof pf !== "object" || !pf.projects) pf = { active: null, projects: {} };
  } catch {
    /* fresh registry */
  }
  pf.projects[project.id] = { mode: "spa", engine: "relion" };
  pf.active = project.id;
  fs.writeFileSync(projectsFile, JSON.stringify(pf, null, 2));
  console.log(`[seed] registered + activated in ${projectsFile}`);

  console.log("\n=== t402b world (assertions) ===");
  console.log(`class2d : ${c2d.id}  → /classes must answer iteration 2 (NOT 3), counts 12/9/6/3`);
  console.log(`class3d : ${c3d.id}  → /classes must answer iteration 2, volumeFiles class001..003`);
  console.log(`selA    : ${selA.id}  → dispatch keeps 21 of 30 (classes 1,2 @ it002)`);
  console.log(`selB    : ${selB.id}  → dispatch keeps 8 of 15 (class 1 @ it002)`);
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exitCode = 1;
  await db.$disconnect();
});

/**
 * SEED t521 — the tutorial fixture world, reborn.
 *
 * Why: the six benches t427/t464/t486/t487/t488/t490 were written against a
 * "tutorial" fixture family that lived in the OLD world (a project with
 * import → autopick / ctffind / motioncorr / class2d / postprocess jobs,
 * real RELION star files on disk, engine run records pointing at them).
 * The t519 sandbox reset wiped the db + data/relion + engine-state.json;
 * the t518 live cleanup shrank the class2d mirror. The benches still speak
 * the truth — their fixtures simply no longer exist. This seeder rebuilds
 * the MINIMAL faithful fixture set, deterministically:
 *
 *   project cmukrk2yy0000rjobryvy0pzu ("Tutorial")
 *     import      cmukrk2z00002rjob254ps15r  (t427's IMPORT_ID)  → micrographs.star + 24 tiny .mrc
 *     autopick    cmukrkgjn000crjobud2kzmms  (t427's AUTO_ID)    → 24 per-mic coord stars (17 picks each = 408)
 *     postprocess cmukrkglx000yrjobf05kmjc8  (t427's POST_ID)    → postprocess.star (fsc+guinier+general)
 *     ctffind     cmututfix000000ctffind                         → micrographs_ctf.star (24 rows)
 *     motioncorr  cmututfix0000motionco                          → corrected_micrographs.star (24 rows)
 *     class2d     cmututfix000000class2                          → run_it020_data.star (angles) + run_it020_half1_model.star (gold FSC)
 *
 * Hard ids are NOT cosmetic: t427 defaults its job ids, t487/t488 default
 * the PROJECT id, and the engine workdir convention ${type}_${id.slice(-8)}
 * derives every path. The curve math is ported verbatim from the original
 * qa50/qa51 python seeders (deterministic rng seed 42) so the numbers keep
 * the same shape the loaders learned on: FSC 0.143 at ~3.12 Å, B −52.4,
 * Guinier 36 shells, per-iteration resolution 28.5 → 3.18 Å.
 *
 * Idempotent: upserts every row, rewrites every file. Run after any world
 * reset, BEFORE the bench family:
 *
 *   node scripts/qa-t521-tutorial-seed.mjs
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.DATABASE_URL = `file:${REPO}/db/cryoflow.db`;
process.env.CRYOFLOW_DATA_DIR = `${REPO}/data`;

const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();

const PROJECT_ID = "cmukrk2yy0000rjobryvy0pzu";
const IDS = {
  import: "cmukrk2z00002rjob254ps15r",
  autopick: "cmukrkgjn000crjobud2kzmms",
  postprocess: "cmukrkglx000yrjobf05kmjc8",
  ctffind: "cmututfix000000ctffind",
  motioncorr: "cmututfix0000motionco",
  class2d: "cmututfix000000class2",
};
const NAMES = {
  import: "tutorial Import",
  autopick: "tutorial Auto-pick",
  postprocess: "tutorial Post-process",
  ctffind: "tutorial CtfFind",
  motioncorr: "tutorial MotionCorr",
  class2d: "tutorial 2D Classification",
};
const workdirOf = (type) =>
  `${REPO}/data/relion/${PROJECT_ID}/${type}_${IDS[type].slice(-8)}`;

/* ---------- deterministic curve math (ported from qa50/qa51, seed 42) ---- */

let rngState = 42;
function rng() {
  // deterministic uniform [0,1) — same role as python random.Random(42)
  rngState = (rngState * 1103515245 + 12345) % 2147483648;
  return rngState / 2147483648;
}
const uniform = (a, b) => a + (b - a) * rng();

const F0 = 0.01, F1 = 0.35, N = 40; // FSC shells
const fscCurve = (f) => 0.97 / (1.0 + Math.exp((f - 0.28) / 0.0226)) + 0.005;
const G0 = 0.001, G1 = 0.12, GN = 36; // Guinier shells
const ITERS = [
  [2, 28.5], [5, 12.4], [8, 8.1], [12, 5.6],
  [16, 4.3], [20, 3.62], [24, 3.31], [30, 3.18],
];

function buildPostprocessStar() {
  const lines = [
    "data_general",
    "",
    "_rlnOptimisationSetOriginalHalfMap            Import/job004/half1_class001_unfil.mrc",
    "_rlnOptimisationSetOriginalHalfMap2           Import/job004/half2_class001_unfil.mrc",
    "_rlnFinalResolution                           3.120000",
    "_rlnBfactorUsedForSharpening                  -52.400000",
    "_rlnUnfilteredMapHalf1                        postprocess_it020_half1_class001.mrc",
    "_rlnMaskName                                  mask_create/mask.mrc",
    "",
    "data_fsc",
    "",
    "loop_",
    "_rlnResolution #1",
    "_rlnAngstromResolution #2",
    "_rlnFourierShellCorrelationCorrected #3",
    "_rlnCorrectedFourierShellCorrelationPhaseRandomizedMaskedMaps #4",
    "_rlnFourierShellCorrelationUnmaskedMaps #5",
    "_rlnFourierShellCorrelationMaskedMaps #6",
  ];
  for (let i = 0; i < N; i++) {
    const f = F0 + ((F1 - F0) * i) / (N - 1);
    const c = fscCurve(f);
    const un = Math.min(0.99, c * 1.04 + 0.01 + uniform(-0.004, 0.004));
    const ma = Math.min(0.99, c * 1.12 + 0.02 + uniform(-0.004, 0.004));
    const ph = Math.max(0.0, 0.008 + 0.06 * f + uniform(-0.003, 0.003));
    const ang = i === 0 ? 999.0 : 1.0 / f;
    lines.push(`${f.toFixed(9)}  ${ang.toFixed(6)}  ${c.toFixed(6)}  ${ph.toFixed(6)}  ${un.toFixed(6)}  ${ma.toFixed(6)}`);
  }
  lines.push(
    "",
    "data_guinier",
    "",
    "loop_",
    "_rlnResolutionSquared #1",
    "_rlnLogAmplitudesOriginal #2",
    "_rlnInterceptResidual #3",
    "_rlnLogAmplitudesSharpened #4",
    "_rlnLogAmplitudesWeighted #5"
  );
  for (let i = 0; i < GN; i++) {
    const x = G0 + ((G1 - G0) * i) / (GN - 1);
    const orig = 2.2 - 2.8 * x + uniform(-0.01, 0.01);
    const intercept = 2.2 - 0.35 * x;
    const sharp = orig + 0.5 + 12.0 * x;
    const weighted = (orig + sharp) / 2.0;
    lines.push(`${x.toFixed(7)}  ${orig.toFixed(6)}  ${intercept.toFixed(6)}  ${sharp.toFixed(6)}  ${weighted.toFixed(6)}`);
  }
  return lines.join("\n") + "\n";
}

function buildIterationStar(res, withGoldFsc) {
  const lines = [
    "data_model_general",
    "",
    `_rlnCurrentResolution   ${res.toFixed(6)}`,
    "_rlnSolventMaskFSCVolumeFraction   0.212000",
    "",
  ];
  if (withGoldFsc) {
    lines.push(
      "data_model_half_map_fsc",
      "",
      "loop_",
      "_rlnResolution #1",
      "_rlnAngstromResolution #2",
      "_rlnGoldStandardFsc #3"
    );
    for (let i = 0; i < 30; i++) {
      const f = 0.01 + (0.3 - 0.01) * (i / 29);
      const g = 0.95 * Math.exp(-f * 4) + 0.02; // crosses 0.143 near 7.8 Å
      lines.push(`${f.toFixed(9)}  ${(1 / f).toFixed(6)}  ${g.toFixed(6)}`);
    }
  }
  return lines.join("\n") + "\n";
}

function buildCtfStar() {
  const lines = [
    "data_optics",
    "",
    "loop_",
    "_rlnOpticsGroup #1",
    "_rlnImagePixelSize #2",
    "1  0.93",
    "",
    "data_micrographs",
    "",
    "loop_",
    "_rlnMicrographName #1",
    "_rlnDefocusU #2",
    "_rlnDefocusV #3",
    "_rlnDefocusAngle #4",
    "_rlnCtfAstigmatism #5",
    "_rlnCtfFigureOfMerit #6",
    "_rlnCtfMaxResolution #7",
  ];
  for (let i = 0; i < 24; i++) {
    // deterministic PERMUTATION ((i*7+5) mod 24, 7 is invertible mod 24):
    // file order must differ from defocus-descending order — t487 T2's
    // cache law needs the file-first mic NOT to be the defocusU-max mic
    // (max lands at i=13, so mic_014 leads the sort while mic_001 leads
    // the file).
    const u = 14800 - ((i * 7 + 5) % 24) * 210 + uniform(-120, 120); // Å (loader auto-scales >1000)
    const v = u - (140 + uniform(0, 160));
    const angle = uniform(0, 180);
    const astig = 40 + uniform(0, 260);
    const fom = 0.34 - i * 0.006 + uniform(-0.01, 0.01);
    const maxres = 3.4 + (i % 7) * 0.85 + uniform(-0.1, 0.1); // worst = a deterministic mic
    lines.push(
      `mic_${String(i + 1).padStart(3, "0")}.mrc  ${u.toFixed(1)}  ${v.toFixed(1)}  ${angle.toFixed(2)}  ${astig.toFixed(1)}  ${fom.toFixed(4)}  ${maxres.toFixed(2)}`
    );
  }
  return lines.join("\n") + "\n";
}

function buildMotionStar() {
  const lines = [
    "data_micrographs",
    "",
    "loop_",
    "_rlnMicrographName #1",
    "_rlnAccumMotionTotal #2",
    "_rlnAccumMotionEarly #3",
    "_rlnAccumMotionLate #4",
  ];
  for (let i = 0; i < 24; i++) {
    const total = 5.9 - i * 0.16 + uniform(-0.15, 0.15);
    const early = total * 0.62 + uniform(-0.05, 0.05); // early-frames dominate, deterministic
    const late = total - early;
    lines.push(
      `mic_${String(i + 1).padStart(3, "0")}.mrc  ${total.toFixed(3)}  ${early.toFixed(3)}  ${late.toFixed(3)}`
    );
  }
  return lines.join("\n") + "\n";
}

function buildAnglesStar() {
  // 900 particles, 65% concentrated in two lobes (qa52's shape) — the
  // orientation panel's anisotropy verdict and Mollweide both read this.
  const lines = [
    "data_particles",
    "",
    "loop_",
    "_rlnImageName #1",
    "_rlnClassNumber #2",
    "_rlnAngleRot #3",
    "_rlnAngleTilt #4",
    "_rlnAnglePsi #5",
  ];
  for (let i = 0; i < 900; i++) {
    const lobe = i % 2 === 0 ? 0 : 1;
    let rot;
    let tilt;
    if (i < 585) {
      rot = (lobe === 0 ? 30 : 210) + uniform(-15, 15);
      tilt = (lobe === 0 ? 40 : 60) + uniform(-10, 10);
    } else {
      rot = uniform(0, 360);
      tilt = uniform(0, 180);
    }
    const psi = uniform(0, 360);
    lines.push(
      `${String(i + 1).padStart(7, "0")}@particles.star  ${(i % 8) + 1}  ${rot.toFixed(3)}  ${tilt.toFixed(3)}  ${psi.toFixed(3)}`
    );
  }
  return lines.join("\n") + "\n";
}

function buildCoordStar(picks) {
  const lines = [
    "loop_",
    "_rlnCoordinateX #1",
    "_rlnCoordinateY #2",
    "_rlnAutopickFigureOfMerit #3",
  ];
  for (const [x, y, fom] of picks) {
    lines.push(`${x.toFixed(1)}  ${y.toFixed(1)}  ${fom.toFixed(4)}`);
  }
  return lines.join("\n") + "\n";
}

function buildMicrographsStar() {
  const lines = ["data_micrographs", "", "loop_", "_rlnMicrographName #1"];
  for (let i = 0; i < 24; i++) {
    lines.push(`micrographs/mic_${String(i + 1).padStart(3, "0")}.mrc`);
  }
  return lines.join("\n") + "\n";
}

/** A tiny but header-valid MRC: mode 2 (float32), 256×256×1, zero pixels —
 *  the header is all any bench reads; the size check demands the data be
 *  present, so the bytes are real (263,168 B each, sparse-free but cheap). */
function buildMrc() {
  const nx = 256;
  const ny = 256;
  const header = Buffer.alloc(1024);
  header.writeInt32LE(nx, 0);
  header.writeInt32LE(ny, 4);
  header.writeInt32LE(1, 8); // nz
  header.writeInt32LE(2, 12); // mode = float32
  header.writeInt32LE(0, 92); // nsymbt
  const data = Buffer.alloc(nx * ny * 4);
  return Buffer.concat([header, data]);
}

/* ---------- db + engine state + files ----------------------------------- */

async function main() {
  const written = [];

  // 1. db rows — upserts (rerun-safe), explicit ids (bench contracts)
  await db.project.upsert({
    where: { id: PROJECT_ID },
    update: { name: "Tutorial" },
    create: { id: PROJECT_ID, name: "Tutorial" },
  });
  const ws = await db.workspace.upsert({
    where: { id: `${PROJECT_ID}ws` },
    update: {},
    create: { id: `${PROJECT_ID}ws`, projectId: PROJECT_ID, name: "Main" },
  });

  const completed = new Date(Date.now() - 40 * 60 * 1000);
  for (const type of ["import", "autopick", "ctffind", "motioncorr", "class2d", "postprocess"]) {
    const params =
      type === "class2d"
        ? JSON.stringify({ numClasses: 8, symmetry: "C1" })
        : type === "autopick"
          ? JSON.stringify({ threshold: 0.3 })
          : "{}";
    await db.job.upsert({
      where: { id: IDS[type] },
      update: { status: "completed", progress: 100 },
      create: {
        id: IDS[type],
        projectId: PROJECT_ID,
        workspaceId: ws.id,
        type,
        name: NAMES[type],
        x: 140 + Object.keys(IDS).indexOf(type) * 240,
        y: 260,
        status: "completed",
        progress: 100,
        params,
        startedAt: completed,
        duration: 8000,
      },
    });
  }
  // the owner edge the picks BFS walks upstream: import → autopick
  await db.edge.upsert({
    where: { fromJobId_toJobId: { fromJobId: IDS.import, toJobId: IDS.autopick } },
    update: {},
    create: { id: `${PROJECT_ID}edge-ia`, projectId: PROJECT_ID, fromJobId: IDS.import, toJobId: IDS.autopick },
  });
  console.log("db rows: project + workspace + 6 jobs + 1 edge (upserted)");

  // 2. engine state — read-modify-write (the server rereads on mtime change)
  const statePath = path.join(REPO, "data", "engine-state.json");
  const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {};
  const startedAt = completed.toISOString();
  for (const type of Object.keys(IDS)) {
    const workdir = workdirOf(type);
    state[IDS[type]] = {
      jobId: IDS[type],
      projectId: PROJECT_ID,
      type,
      pid: null,
      cmd: "QA fixture (qa-t521-tutorial-seed)",
      workdir,
      logFile: `${workdir}/run.out`,
      errFile: `${workdir}/run.err`,
      startedAt,
      outputs: {},
      done: true,
      exitCode: 0,
      result: "t521 tutorial fixture — seeded completed",
    };
  }
  const tmp = `${statePath}.seed-tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 1));
  const { renameSync } = await import("fs");
  renameSync(tmp, statePath);
  console.log("engine state: 6 run records (workdirs pinned)");

  // 3. files
  const root = workdirOf("import").replace(/\/import_[^/]+$/, "");
  mkdirSync(root, { recursive: true });

  const importWd = workdirOf("import");
  mkdirSync(path.join(importWd, "micrographs"), { recursive: true });
  writeFileSync(path.join(importWd, "micrographs.star"), buildMicrographsStar());
  const mrc = buildMrc();
  for (let i = 0; i < 24; i++) {
    writeFileSync(path.join(importWd, "micrographs", `mic_${String(i + 1).padStart(3, "0")}.mrc`), mrc);
  }
  written.push("import: micrographs.star + 24 mrc (256×256 float32 headers)");

  const autoWd = workdirOf("autopick");
  mkdirSync(path.join(autoWd, "micrographs"), { recursive: true });
  for (let m = 0; m < 24; m++) {
    const picks = [];
    for (let p = 0; p < 17; p++) {
      picks.push([20 + ((m * 37 + p * 53) % 216), 20 + ((m * 61 + p * 29) % 216), 0.62 - p * 0.022]);
    }
    writeFileSync(path.join(autoWd, "micrographs", `mic_${String(m + 1).padStart(3, "0")}_autopick.star`), buildCoordStar(picks));
  }
  written.push("autopick: 24 coord stars × 17 picks = 408 (FOM present)");

  const ppWd = workdirOf("postprocess");
  mkdirSync(ppWd, { recursive: true });
  writeFileSync(path.join(ppWd, "postprocess.star"), buildPostprocessStar());
  written.push("postprocess: postprocess.star (fsc 40 shells + guinier 36 pts, B −52.4)");

  const ctfWd = workdirOf("ctffind");
  mkdirSync(ctfWd, { recursive: true });
  writeFileSync(path.join(ctfWd, "micrographs_ctf.star"), buildCtfStar());
  written.push("ctffind: micrographs_ctf.star (24 rows, optics block included)");

  const mcWd = workdirOf("motioncorr");
  mkdirSync(mcWd, { recursive: true });
  writeFileSync(path.join(mcWd, "corrected_micrographs.star"), buildMotionStar());
  written.push("motioncorr: corrected_micrographs.star (24 rows, early>late)");

  const c2dWd = workdirOf("class2d");
  mkdirSync(c2dWd, { recursive: true });
  writeFileSync(path.join(c2dWd, "run_it020_data.star"), buildAnglesStar());
  writeFileSync(path.join(c2dWd, "run_it020_half1_model.star"), buildIterationStar(7.785, true));
  writeFileSync(path.join(c2dWd, "run_model.star"), buildIterationStar(7.785, false));
  written.push("class2d: run_it020_data.star (900 angles) + model stars (gold FSC)");

  // 4. project registry — the UI's project map
  const regPath = path.join(REPO, "data", "projects.json");
  const reg = existsSync(regPath) ? JSON.parse(readFileSync(regPath, "utf8")) : { active: null, projects: {} };
  reg.projects[PROJECT_ID] = reg.projects[PROJECT_ID] ?? { mode: "spa", engine: "relion" };
  writeFileSync(regPath, JSON.stringify(reg, null, 2));
  console.log("projects.json: tutorial project registered (active pointer untouched)");

  console.log("\nseeded:");
  for (const w of written) console.log("  ·", w);
  console.log(`\nproject root: ${root}`);
}

main()
  .then(() => db.$disconnect())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

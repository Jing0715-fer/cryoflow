/**
 * SEED t391-ui — the UI layout lab for the inspector/params polish pass.
 *
 * Creates (idempotently — named project, wiped and rebuilt on rerun) one
 * project with a full SPA chain in mixed states so every inspector surface
 * has honest content:
 *
 *   import(idle) → motioncorr(done) → ctffind(done) → autopick(done)
 *     → extract(done) → class2d(done, tuned params) → select(done)
 *     → initialmodel(done) → class3d(RUNNING) → refine3d(failed)
 *
 * Rows are written via Prisma directly (QA scaffolding, not product
 * behavior): statuses/progress/startedAt are set as the run engine would
 * leave them. Run:  node scripts/qa-t391-ui-seed.mjs
 * (DATABASE_URL must point at the same db the server serves.)
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const PROJECT_NAME = "UI Layout Lab";

const now = Date.now();
const iso = (msAgo) => new Date(now - msAgo);

/** class2d t386 defaults + a few deliberate non-defaults (amber dots). */
const class2dParams = {
  numClasses: 100,
  algorithm: "vdam",
  miniBatches: 200,
  particleDiameter: 200,
  tau2Fudge: 2,
  doZeroMask: true,
  doCenter: true,
  doCtf: true,
  ctfIntactFirstPeak: false,
  psiSampling: "6",
  offsetRange: 5,
  offsetStep: 1,
  oversampling: 1,
  allowCoarser: false,
  highresLimit: 0,
  batchSize: 3,
  threads: 4,
  doHelical2d: false,
};

const class3dParams = {
  numClasses: 4,
  numIter: 25,
  algorithm: "em",
  particleDiameter: 200,
  samplingStep: "7.5",
  offsetRange: 5,
  offsetStep: 1,
  doCtf: true,
  tau2Fudge: 4,
  iniHigh: 40,
  threads: 4,
  batchSize: 3,
  doBlush: false,
  symmetry: "D2",
};

const refine3dParams = {
  autoRefine: true,
  iniHigh: 50,
  particleDiameter: 200,
  samplingStep: "7.5",
  autoLocalSampling: "1.8",
  offsetRange: 5,
  offsetStep: 1,
  doCtf: true,
  symmetry: "D2",
  threads: 4,
  batchSize: 3,
};

const p = (o) => JSON.stringify(o);

async function main() {
  const existing = await db.project.findFirst({ where: { name: PROJECT_NAME } });
  if (existing) {
    await db.project.delete({ where: { id: existing.id } });
    console.log("replaced previous", PROJECT_NAME);
  }
  const project = await db.project.create({ data: { name: PROJECT_NAME } });
  const ws = await db.workspace.create({
    data: { projectId: project.id, name: "Main", order: 0 },
  });

  const mk = (o) =>
    db.job.create({
      data: {
        projectId: project.id,
        workspaceId: ws.id,
        createdAt: iso(o.bornAgo),
        updatedAt: iso(o.bornAgo - (o.doneAgo ?? 0)),
        ...o.row,
      },
    });

  const jobs = {};
  const defs = [
    {
      k: "import",
      row: {
        type: "import",
        name: "Import Movies 1",
        x: 40, y: 260, status: "idle",
        params: p({ nodeType: "movies", micrographsPath: "/data/empiar10017/movies", pixelSize: 1.77, voltage: 300, cs: 2.7, ampContrast: 0.1, totalDose: 25 }),
      },
      bornAgo: 90 * 60_000,
    },
    {
      k: "motioncorr",
      row: {
        type: "motioncorr",
        name: "Motion Correction 1",
        x: 330, y: 260, status: "completed", progress: 100,
        params: p({ useOwn: true, doseWeighting: true, saveNoDW: false, groupingForPs: 1, patchX: 5, patchY: 5, gainRef: "", defectsFile: "", float16: false }),
        result: "REAL: motion corrected, 24 movies · 24 micrographs",
        startedAt: iso(88 * 60_000), duration: 210_000,
      },
      bornAgo: 89 * 60_000, doneAgo: 3 * 60_000,
    },
    {
      k: "ctffind",
      row: {
        type: "ctffind",
        name: "CTF Estimation 1",
        x: 620, y: 260, status: "completed", progress: 100,
        params: p({ dfMin: 5000, dfMax: 50000, dfStep: 500, dAst: 100, useGivenPs: false, fastSearch: true, ctfWin: 512, phaseShift: false }),
        result: "REAL: CTF fitted, 24 micrographs",
        startedAt: iso(85 * 60_000), duration: 95_000,
      },
      bornAgo: 86 * 60_000, doneAgo: 2 * 60_000,
    },
    {
      k: "autopick",
      row: {
        type: "autopick",
        name: "Autopick 1",
        x: 910, y: 260, status: "completed", progress: 100,
        params: p({ pickingMethod: "log", logDiamLower: 150, logDiamUpper: 180, logUpperThr: 999, threshold: 0.05, maxStddevNoise: 1.1, minDistance: 100 }),
        result: "REAL: 18,240 particles picked on 24 micrographs",
        startedAt: iso(80 * 60_000), duration: 40_000,
      },
      bornAgo: 81 * 60_000, doneAgo: 1 * 60_000,
    },
    {
      k: "extract",
      row: {
        type: "extract",
        name: "Particle Extraction 1",
        x: 1200, y: 260, status: "completed", progress: 100,
        params: p({ boxSize: 256, doInvert: true, norm: true, dustBefore: -1, dustAfter: -1, float16: false, downsampleTo: 128, doRescale: true, recenter: false }),
        result: "REAL: 18,240 particles extracted · box 256 px · binned to 128",
        startedAt: iso(78 * 60_000), duration: 60_000,
      },
      bornAgo: 79 * 60_000, doneAgo: 1 * 60_000,
    },
    {
      k: "class2d",
      row: {
        type: "class2d",
        name: "2D Classification 1",
        x: 40, y: 560, status: "completed", progress: 100,
        params: p(class2dParams),
        result: "REAL: 2D classification finished — 100 classes · 18,240 particles · VDAM 200 mini-batches",
        startedAt: iso(70 * 60_000), duration: 9 * 60_000,
        note: "Good average separation — classes 1-30 look like β-gal views; feed Select then Initial Model.",
      },
      bornAgo: 74 * 60_000, doneAgo: 5 * 60_000,
    },
    {
      k: "select",
      row: {
        type: "select",
        name: "Select 2D Classes 1",
        x: 330, y: 560, status: "completed", progress: 100,
        params: p({ minScore: 0.35, doSplit: false, doShuffle: false }),
        result: "REAL: 11,376 of 18,240 particles kept (62% · 100 → 41 classes)",
        startedAt: iso(60 * 60_000), duration: 15_000,
      },
      bornAgo: 64 * 60_000, doneAgo: 3 * 60_000,
    },
    {
      k: "initialmodel",
      row: {
        type: "initialmodel",
        name: "Initial Model 1",
        x: 620, y: 560, status: "completed", progress: 100,
        params: p({ numClasses: 1, symmetry: "C1", miniBatches: 200, particleDiameter: 200, doRunC1: true, doSolvent: false, sigmaTilt: 3 }),
        result: "REAL: initial model finished — 11,376 particles · 1 class · D2 point group suggested",
        startedAt: iso(55 * 60_000), duration: 8 * 60_000,
      },
      bornAgo: 58 * 60_000, doneAgo: 2 * 60_000,
    },
    {
      k: "class3d",
      row: {
        type: "class3d",
        name: "3D Classification 1",
        x: 910, y: 560, status: "running", progress: 42,
        params: p(class3dParams),
        startedAt: iso(3 * 60_000), duration: 20 * 60_000,
      },
      bornAgo: 8 * 60_000,
    },
    {
      k: "refine3d",
      row: {
        type: "refine3d",
        name: "3D Auto-Refine 1",
        x: 1200, y: 560, status: "failed", progress: 88,
        params: p(refine3dParams),
        result: null,
        startedAt: iso(30 * 60_000), duration: 6 * 60_000,
      },
      bornAgo: 33 * 60_000, doneAgo: 3 * 60_000,
    },
  ];

  for (const d of defs) jobs[d.k] = await mk(d);

  const chain = ["import", "motioncorr", "ctffind", "autopick", "extract", "class2d", "select", "initialmodel", "class3d", "refine3d"];
  for (let i = 0; i < chain.length - 1; i++) {
    await db.edge.create({
      data: {
        projectId: project.id,
        fromJobId: jobs[chain[i]].id,
        toJobId: jobs[chain[i + 1]].id,
      },
    });
  }

  console.log("seeded", defs.length, "jobs,", chain.length - 1, "edges — project:", project.id);
  console.log("class2d:", jobs.class2d.id);
  console.log("class3d(running):", jobs.class3d.id);
  console.log("refine3d(failed):", jobs.refine3d.id);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

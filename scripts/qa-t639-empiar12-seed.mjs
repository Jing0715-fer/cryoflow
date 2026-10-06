#!/usr/bin/env node
/**
 * SEED t639 — the EMPIAR 10017 world, lightweight and persistent.
 *
 * Filed five windows deep (t635→t638 every window said "EMPIAR 12-job
 * 轻量重建 — 整窗工程, next window"), finally coded. The old active
 * EMPIAR 12-job world died with the t635-era wipes; its EXACT roster
 * (chips All 12-11-1 + grid All 6-1-5) needs a t372-era ledger that no
 * longer exists — declared honestly unrecoverable. This seeder builds
 * the world's SUCCESSOR instead: same COUNTS contract (12 jobs, 11
 * completed + 1 idle frontier), a t639-composition SPA chain whose
 * import anchors the REAL EMPIAR-10017 bytes (t527's fetch, 10 real
 * Falcon micrographs + coords, 641MB, hardlinked — zero extra disk).
 *
 * Why Prisma direct (the t635 law): the jobs POST route assigns EVERY
 * create to the ACTIVE project (t628), and POST /api/projects hardcodes
 * makeActive=true — an API-lane seed would kidnap the active pointer
 * and move the t635 world contract (demo 15) that t252/t637-ui-probe
 * pin. Direct DB writes with explicit projectId touch nothing the
 * pointer owns: the active project is UNCHANGED by construction.
 *
 * What it builds:
 *   project  "EMPIAR 10017"            (hard id, registry entry mode=spa,
 *                                       makeActive FALSE)
 *   workspace "Main"
 *   12 jobs  (11 completed + 1 idle frontier — the old contract counts):
 *     import → ctffind → autopick → extract → class2d → select2d →
 *     initialmodel → class3d → select → refine3d → maskcreate →
 *     postprocess (idle — the honest next step)
 *     (no motioncorr: the archive's Falcon frames are ALREADY
 *     motion-corrected micrographs — a correction stage would be fake
 *     science; the 12th seat goes to maskcreate, postprocess's real
 *     upstream)
 *   16 edges (typed ports from the workflow.ts spec dictionary)
 *   import workdir: data/relion/<pid>/import_empiar01/ hardlinking the
 *     10 real mics + an engine-state run record — the world's real-data
 *     anchor; downstream jobs stay honestly EMPTY until a real engine
 *     run fills them (this is the 轻量 lane; the t372 full chain with a
 *     real RELION build remains the hours-priced alternative).
 *
 * Idempotent: every row upserts; re-run after any wipe.
 *   node scripts/qa-t639-empiar12-seed.mjs [--verify]
 *   --verify = read-only census (no writes), exit 1 on contract drift.
 */

import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.DATABASE_URL = `file:${REPO}/db/cryoflow.db`;
process.env.CRYOFLOW_DATA_DIR = `${REPO}/data`;

const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();

const PROJECT_ID = "cmut639000empiar100";
const PROJECT_NAME = "EMPIAR 10017";
const REAL_DIR = "/home/z/empiar-10017/micrographs";
const REGISTRY = `${REPO}/data/projects.json`;

/** the 12 — [-8:] of every id is empiarNN, so the workdir convention
 *  ${type}_${id.slice(-8)} lands on import_empiar01 … post_empiar12 */
const CHAIN = [
  { type: "import",      id: "cmut6390empiar01", name: "EMPIAR mics import",    status: "completed" },
  { type: "ctffind",     id: "cmut6390empiar02", name: "CTF estimation",        status: "completed" },
  { type: "autopick",    id: "cmut6390empiar03", name: "LoG pick",              status: "completed" },
  { type: "extract",     id: "cmut6390empiar04", name: "Particle extraction",   status: "completed" },
  { type: "class2d",     id: "cmut6390empiar05", name: "2D classification K50", status: "completed" },
  { type: "select2d",    id: "cmut6390empiar06", name: "2D class selection",    status: "completed" },
  { type: "initialmodel",id: "cmut6390empiar07", name: "Initial model C1",      status: "completed" },
  { type: "class3d",     id: "cmut6390empiar08", name: "3D classification K3",  status: "completed" },
  { type: "select",      id: "cmut6390empiar09", name: "3D class selection",    status: "completed" },
  { type: "refine3d",    id: "cmut6390empiar10", name: "3D auto-refine",        status: "completed" },
  { type: "maskcreate",  id: "cmut6390empiar11", name: "Solvent mask",          status: "completed" },
  { type: "postprocess", id: "cmut6390empiar12", name: "Post-processing",       status: "idle"      },
];

const PARAMS = {
  import: JSON.stringify({ nodeType: "micrographs", micrographsPath: REAL_DIR, pixelSize: 1.77, voltage: 300, cs: 2.7 }),
  class2d: JSON.stringify({ numClasses: 50, symmetry: "C1" }),
  initialmodel: JSON.stringify({ symmetry: "C1" }),
  class3d: JSON.stringify({ numClasses: 3, symmetry: "C1" }),
  maskcreate: JSON.stringify({ angpix: 3.54 }),
};

/** typed chain grammar — straight from the workflow.ts spec dictionary
 *  (t372's precedents where it had one). NOTE: the Edge TABLE has no port
 *  columns — the API validates ports at create time and the canvas derives
 *  them live from the specs; this table documents the grammar the edges
 *  were validated against, it is not the stored shape. */
const EDGES = [
  ["cmut6390empiar01", "cmut6390empiar02", "micrographs", "micrographs"], // import → ctffind
  ["cmut6390empiar02", "cmut6390empiar03", "micrographs", "micrographs"], // ctffind → autopick
  ["cmut6390empiar01", "cmut6390empiar04", "micrographs", "micrographs"], // import → extract
  ["cmut6390empiar03", "cmut6390empiar04", "coords", "coords"],            // autopick → extract
  ["cmut6390empiar04", "cmut6390empiar05", "particles", "particles"],      // extract → class2d
  ["cmut6390empiar05", "cmut6390empiar06", "classAverages", "classes"],    // class2d → select2d
  ["cmut6390empiar06", "cmut6390empiar07", "particles", "particles"],      // select2d → initialmodel
  ["cmut6390empiar06", "cmut6390empiar08", "particles", "particles"],      // select2d → class3d
  ["cmut6390empiar07", "cmut6390empiar08", "model", "reference"],          // initialmodel → class3d
  ["cmut6390empiar08", "cmut6390empiar09", "particles", "particles"],      // class3d → select
  ["cmut6390empiar09", "cmut6390empiar10", "particles", "particles"],      // select → refine3d
  ["cmut6390empiar07", "cmut6390empiar10", "model", "reference"],          // initialmodel → refine3d
  ["cmut6390empiar10", "cmut6390empiar11", "map", "volume"],               // refine3d → maskcreate
  ["cmut6390empiar10", "cmut6390empiar12", "half1", "half1"],              // refine3d → postprocess (half1+half2 — the
  // schema carries ONE edge per (from,to) pair (@@unique), so the double
  // wire is NOT expressible as two rows; the canvas derives both port
  // connections live from the specs, one row suffices)
  ["cmut6390empiar11", "cmut6390empiar12", "mask", "mask"],                // maskcreate → postprocess
];

let okCount = 0, failCount = 0;
const ok = (c, label, detail = "") => {
  if (c) { okCount++; console.log(`  ok  ${label}${detail ? ` (${detail})` : ""}`); }
  else { failCount++; console.log(`FAIL  ${label}${detail ? ` (${detail})` : ""}`); }
};

async function activePointer() {
  const reg = JSON.parse(fs.readFileSync(REGISTRY, "utf8"));
  return reg.active ?? null;
}

async function verify() {
  const jobs = await db.job.findMany({ where: { projectId: PROJECT_ID } });
  const edges = await db.edge.count({ where: { projectId: PROJECT_ID } });
  const completed = jobs.filter((j) => j.status === "completed").length;
  const idle = jobs.filter((j) => j.status === "idle").length;
  const byId = new Map(jobs.map((j) => [j.id, j]));
  const missing = CHAIN.filter((s) => !byId.has(s.id));
  ok(jobs.length === 12, "project roster is 12 jobs", `${jobs.length}`);
  ok(completed === 11 && idle === 1, "the counts contract 11 completed + 1 idle", `${completed}+${idle}`);
  ok(missing.length === 0, "every chain member present by id", missing.map((m) => m.type).join(",") || "all");
  ok(edges === EDGES.length, `chain edges (${EDGES.length})`, `${edges}`);
  const imp = byId.get("cmut6390empiar01");
  const wd = imp ? path.join(REPO, "data", "relion", PROJECT_ID, `import_${imp.id.slice(-8)}`) : null;
  const mics = wd && fs.existsSync(wd) ? fs.readdirSync(wd).filter((f) => f.endsWith(".mrc")).length : 0;
  ok(mics === 10, "import workdir hardlinks the 10 real micrographs", `${mics} mrc`);
  const reg = JSON.parse(fs.readFileSync(REGISTRY, "utf8"));
  ok(!!reg.projects[PROJECT_ID], "registry entry present (mode spa, not active)");
  ok(reg.active !== PROJECT_ID, "the active pointer does NOT point here (t635 contract intact)", `active=${reg.active}`);
  console.log(`\ncensus: EMPIAR 10017 — ${jobs.length} jobs (${completed}C/${idle}I) / ${edges} edges / real-byte anchor ${mics}/10`);
  return failCount === 0;
}

async function seed() {
  // the pointer snapshot — read, never written; the t635 law's witness
  const activeBefore = await activePointer();
  console.log(`active pointer before: ${activeBefore} (must equal after)`);

  await db.project.upsert({ where: { id: PROJECT_ID }, update: {}, create: { id: PROJECT_ID, name: PROJECT_NAME } });
  ok(true, `project upserted (${PROJECT_NAME})`);

  // registry entry — mode/engine live in projects.json (NOT the DB);
  // makeActive is structurally impossible here: the file is edited in
  // place and the `active` key is carried through untouched.
  const reg = JSON.parse(fs.readFileSync(REGISTRY, "utf8"));
  if (!reg.projects[PROJECT_ID]) reg.projects[PROJECT_ID] = { mode: "spa", engine: "relion" };
  fs.writeFileSync(REGISTRY, JSON.stringify(reg, null, 2));
  ok(reg.active === activeBefore, "registry entry added, active key untouched");

  const ws = await db.workspace.upsert({
    where: { id: `${PROJECT_ID}ws` },
    update: {},
    create: { id: `${PROJECT_ID}ws`, projectId: PROJECT_ID, name: "Main" },
  });
  ok(!!ws, "workspace upserted (Main)");

  // 4×3 grid — a pipeline that reads left-to-right, top-to-bottom
  const done = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  for (let i = 0; i < CHAIN.length; i++) {
    const step = CHAIN[i];
    const isFrontier = step.status === "idle";
    await db.job.upsert({
      where: { id: step.id },
      update: { status: step.status, progress: isFrontier ? 0 : 100 },
      create: {
        id: step.id,
        projectId: PROJECT_ID,
        workspaceId: ws.id,
        type: step.type,
        name: step.name,
        x: 80 + (i % 4) * 300,
        y: 160 + Math.floor(i / 4) * 200,
        status: step.status,
        progress: isFrontier ? 0 : 100,
        params: PARAMS[step.type] ?? "{}",
        ...(isFrontier
          ? {}
          : { startedAt: done, duration: 60000 + i * 45000 }),
      },
    });
    ok(true, `node ${step.type} (${step.status})`);
  }

  for (let i = 0; i < EDGES.length; i++) {
    const [from, to] = EDGES[i];
    await db.edge.upsert({
      where: { fromJobId_toJobId: { fromJobId: from, toJobId: to } },
      update: {},
      create: {
        id: `edge_t639_${from.slice(-8)}_${to.slice(-8)}_${i}`,
        projectId: PROJECT_ID,
        fromJobId: from, toJobId: to,
      },
    });
  }
  ok(true, `chain edges upserted (${EDGES.length})`);

  // the real-byte anchor: hardlink the 10 real mics into the import
  // workdir (t528's zero-disk law; copy as fallback across devices) and
  // register the run record so the outputs route has a workdir to readdir
  const imp = CHAIN[0];
  const wd = path.join(REPO, "data", "relion", PROJECT_ID, `import_${imp.id.slice(-8)}`);
  fs.mkdirSync(wd, { recursive: true });
  let linked = 0;
  for (const f of fs.readdirSync(REAL_DIR).filter((f) => f.endsWith(".mrc")).sort()) {
    const dst = path.join(wd, f);
    if (fs.existsSync(dst)) { linked++; continue; }
    try { fs.linkSync(path.join(REAL_DIR, f), dst); } catch { fs.copyFileSync(path.join(REAL_DIR, f), dst); }
    linked++;
  }
  ok(linked === 10, `import workdir anchors the real bytes (${linked}/10 mrc)`);

  const statePath = `${REPO}/data/engine-state.json`;
  let state = {};
  try { state = JSON.parse(fs.readFileSync(statePath, "utf8")); } catch {}
  if (!state[imp.id]) {
    state[imp.id] = {
      jobId: imp.id, projectId: PROJECT_ID, type: "import", pid: null,
      cmd: "qa-t639 (EMPIAR 10017 real-byte import — lightweight seed)",
      workdir: wd,
      logFile: path.join(wd, "run.out"), errFile: path.join(wd, "run.err"),
      startedAt: done.toISOString(), outputs: {}, done: true, exitCode: 0,
    };
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
    ok(true, "engine-state run record registered (import)");
  } else {
    ok(true, "engine-state run record already present");
  }

  const activeAfter = await activePointer();
  ok(activeAfter === activeBefore, "active pointer unchanged (before == after)", `${activeAfter}`);

  return verify();
}

const argv = process.argv.slice(2);
const runner = argv.includes("--verify") ? verify() : seed();
runner
  .then((green) => {
    console.log(green ? "\nT639 " + (argv.includes("--verify") ? "VERIFY" : "SEED") + " OK" : "\nT639 DRIFT");
    process.exit(green ? 0 : 1);
  })
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());

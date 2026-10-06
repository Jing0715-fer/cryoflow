#!/usr/bin/env node
/**
 * SEED t635 — the demo world SKELETON (the "extend t521 for the demo"
 * branch that qa-t531-old-world-seed.mjs predicted: "post-wipe creation
 * is the t521 seeder's law; extend it for the demo if this ever fires" —
 * it fired: the sandbox container replacement of the t635 window wiped
 * db + data/relion + engine-state + the EMPIAR bundle, and the t531
 * seeder walked into a DB with no β-Galactosidase project to resolve).
 *
 * What this builds (the MINIMUM t531 needs to take over):
 *   project "β-Galactosidase Tutorial (demo)"   (hard id, new — the old
 *     id died with the old inode; nothing references it by id, the
 *     manifest t531 writes is the resolution contract and it is minted
 *     fresh from what this script + t531 lay down)
 *     workspace "Main"
 *     the canonical 13-chain, all completed, chained by edges:
 *       import → motioncorr → ctffind → autopick → extract → class2d →
 *       select2d → select → class3d → symexpand → rebalance → refine3d →
 *       postprocess
 *
 * What it deliberately does NOT build (each has its own seeder/lane):
 *   - workdirs, engine-state records, old-world.json → t531 (it walks the
 *     chain this script lays down and writes the real physics files)
 *   - the EMPIAR-10017 real bundle → t527 (fetch) + t528 (no-dash stage)
 *   - the EMPIAR active job world → the t372 full chain (hours; filed)
 *   - the per-suite fixtures → qa58/qa60 seeders (idempotent by name)
 *
 * Idempotent: upserts every row. Run BEFORE t531, after any wipe:
 *   node scripts/qa-t635-demo-skeleton-seed.mjs
 */

import path from "path";
import { fileURLToPath } from "url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
process.env.DATABASE_URL = `file:${REPO}/db/cryoflow.db`;
process.env.CRYOFLOW_DATA_DIR = `${REPO}/data`;

const { PrismaClient } = await import("@prisma/client");
const db = new PrismaClient();

const PROJECT_ID = "cmuwipe6350000demoproject";
const PROJECT_NAME = "β-Galactosidase Tutorial (demo)";

// hard ids — the workdir convention ${type}_${id.slice(-8)} derives every
// path from these, so they are contract, not cosmetics (the t521 law)
const CHAIN = [
  { type: "import", id: "cmuwipe63500import", name: "EMPIAR mics import" },
  { type: "motioncorr", id: "cmuwipe6350motioncorr", name: "own motioncorr" },
  { type: "ctffind", id: "cmuwipe635000ctffind", name: "CTF estimation" },
  { type: "autopick", id: "cmuwipe6350autopick", name: "LoG pick" },
  { type: "extract", id: "cmuwipe635000extract", name: "Particle extraction" },
  { type: "class2d", id: "cmuwipe635000class2d", name: "2D classification" },
  { type: "select2d", id: "cmuwipe63500select2d", name: "2D class selection" },
  { type: "select", id: "cmuwipe6350000select", name: "Subset selection" },
  { type: "class3d", id: "cmuwipe635000class3d", name: "3D classification" },
  { type: "symexpand", id: "cmuwipe6350symexpand", name: "Symmetry expansion" },
  { type: "rebalance", id: "cmuwipe63500rebalance", name: "Particle rebalance" },
  { type: "refine3d", id: "cmuwipe635000refine3d", name: "3D auto-refine" },
  { type: "postprocess", id: "cmuwipe6350postprocess", name: "Post-processing" },
];

const PARAMS = {
  import: JSON.stringify({ nodeType: "micrographs", micrographsPath: "/data2/empiar10017/data", pixelSize: 1.77, voltage: 300, cs: 2.7 }),
  motioncorr: JSON.stringify({ useOwn: true }),
  class2d: JSON.stringify({ numClasses: 8, symmetry: "C1" }),
  class3d: JSON.stringify({ numClasses: 3, symmetry: "C1" }),
  refine3d: JSON.stringify({ symmetry: "C1" }),
};

let okCount = 0, failCount = 0;
const ok = (c, label) => {
  if (c) { okCount++; console.log(`  ok  ${label}`); }
  else { failCount++; console.log(`FAIL  ${label}`); }
};

async function main() {
  await db.project.upsert({
    where: { id: PROJECT_ID },
    update: {},
    create: { id: PROJECT_ID, name: PROJECT_NAME },
  });
  ok(true, `project upserted (${PROJECT_NAME})`);

  const ws = await db.workspace.upsert({
    where: { id: `${PROJECT_ID}ws` },
    update: {},
    create: { id: `${PROJECT_ID}ws`, projectId: PROJECT_ID, name: "Main" },
  });
  ok(!!ws, `workspace upserted (Main)`);

  const done = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3d ago — the demo's historical depth
  for (let i = 0; i < CHAIN.length; i++) {
    const step = CHAIN[i];
    await db.job.upsert({
      where: { id: step.id },
      update: { status: "completed", progress: 100 },
      create: {
        id: step.id,
        projectId: PROJECT_ID,
        workspaceId: ws.id,
        type: step.type,
        name: step.name,
        x: 80 + (i % 5) * 260,
        y: 160 + Math.floor(i / 5) * 180,
        status: "completed",
        progress: 100,
        params: PARAMS[step.type] ?? "{}",
        startedAt: done,
        duration: 60000 + i * 30000,
      },
    });
    ok(true, `chain node ${step.type} (${step.id.slice(-8)})`);
  }

  for (let i = 0; i < CHAIN.length - 1; i++) {
    const from = CHAIN[i], to = CHAIN[i + 1];
    await db.edge.upsert({
      where: { fromJobId_toJobId: { fromJobId: from.id, toJobId: to.id } },
      update: {},
      create: { id: `edge_wipe635_${from.type}_${to.type}`, projectId: PROJECT_ID, fromJobId: from.id, toJobId: to.id },
    });
  }
  ok(true, `chain edges (${CHAIN.length - 1})`);

  // summary — the world t531 will walk
  const jobs = await db.job.count({ where: { projectId: PROJECT_ID } });
  const edges = await db.edge.count({ where: { projectId: PROJECT_ID } });
  console.log(`\ndemo skeleton: ${jobs} jobs / ${edges} edges / 1 workspace — hand off to qa-t531-old-world-seed.mjs`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());

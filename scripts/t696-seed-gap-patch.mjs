#!/usr/bin/env node
/**
 * t696 — the seed-gap patch: wake the two C-class strips in the LIVE demo
 * world, per docs/seed-gap-design.md.
 *
 * The t692 census priced them as SEED gaps, not product bugs:
 *   - refine3d: a completed refinement's tail (halves + model.star) with no
 *     run_data.star — the one file every completed RELION auto-refine leaves.
 *   - initialmodel: workdirFor derives initialmodel_ialmodel; the seed wrote
 *     the job record and both edges but never the directory.
 *
 * Law of the patch:
 *   - READ the world first: the 168 particle rows come from the REAL
 *     selected.star in select_00select (the world's own truth for "the kept
 *     particles"). The refined particles ARE the selected particles.
 *   - The builders are replicated BYTE-FAITHFULLY from
 *     scripts/qa-t531-old-world-seed.mjs (provenance per function; t695's
 *     copy-fully law — the comment names the source lines).
 *   - IDEMPOTENT: every write is guarded by an exists-check (the same
 *     re-collection law as engine.ts synthesizeSequentialHalves L8007).
 *     Running twice changes nothing the second time.
 *   - TWO LAYERS for initialmodel (t692 priced one, the patch found the
 *     other): the outputs route resolves the workdir THROUGH the run
 *     record (job-outputs.ts L134 getRun → the missing-record
 *     short-circuit fires BEFORE any walk). The seed wrote records for its
 *     CHAIN jobs (refine3d's record says cmd "seeded:refine3d") but skipped
 *     the WORKFLOW-PAIR jobs — initialmodel needs BOTH the engine-state
 *     record AND the workdir. External writers are a documented, tolerated
 *     pattern (engine.ts L261-262: readRuns' mtime/size check picks up
 *     external writers; the seed itself wrote "seeded:*" records this way).
 *   - RunRecord.logFile/errFile are REQUIRED fields (engine.ts L114) and
 *     the t636 claim-without-write law says a record may not name files
 *     that do not exist — so the patch writes run.log/run.err too.
 *   - The final map is run_model.mrc (the lib's exact list for
 *     initialmodel's model_mrc key, engine.ts L1739) — NOT refine3d's
 *     run_class001.mrc convention (the patch's first draft got this
 *     wrong; the stray file is removed below).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, rmSync } from "node:fs";
import path from "node:path";

const ROOT = "/home/z/my-project";
const PDIR = path.join(ROOT, "data/relion/cmuwipe6350000demoproject");
const WD_SELECT = path.join(PDIR, "select_00select");
const WD_REFINE = path.join(PDIR, "refine3d_refine3d");
const WD_INIT = path.join(PDIR, "initialmodel_ialmodel");

let fail = 0;
const must = (cond, msg) => {
  console.log(`  ${cond ? "ok" : "FAIL"}: ${msg}`);
  if (!cond) fail++;
};

/* ---------- the world's own rows ---------------------------------------- */

function readSelectedRows() {
  const text = readFileSync(path.join(WD_SELECT, "selected.star"), "utf8");
  const rows = text
    .split("\n")
    .filter((l) => /^[0-9]/.test(l.trim()))
    .map((l) => l.trim());
  must(rows.length === 168, `selected.star carries the select verdict (got ${rows.length} rows, want 168)`);
  return rows;
}

/* ---------- builders, byte-faithful from qa-t531-old-world-seed.mjs ------
 * provenance: buildParticlesStar L306-314, buildModelStar L168-193,
 * buildMrcVolume L512-537, finishMrcHeader L455-478. The only dialect
 * choice: initialmodel's class map uses the 3D buildMrcVolume (t661's law —
 * nz=1 stubs poison the 3D viewer world). */

function buildParticlesStar(rows, withAngles = true) {
  const cols = withAngles
    ? ["_rlnImageName #1", "_rlnClassNumber #2", "_rlnAngleRot #3", "_rlnAngleTilt #4", "_rlnAnglePsi #5"]
    : ["_rlnImageName #1", "_rlnOpticsGroup #2"];
  const lines = ["data_particles", "", "loop_", ...cols, ...rows];
  return lines.join("\n") + "\n";
}

function buildModelStar(res, withGoldFsc) {
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
      const g = 0.95 * Math.exp(-f * 4) + 0.02;
      lines.push(`${f.toFixed(9)}  ${(1 / f).toFixed(6)}  ${g.toFixed(6)}`);
    }
  }
  return lines.join("\n") + "\n";
}

function finishMrcHeader(header, nx, ny, nz, pixel, dmin, dmax, dmean) {
  header.writeInt32LE(nx, 28); // MX
  header.writeInt32LE(ny, 32); // MY
  header.writeInt32LE(nz, 36); // MZ
  header.writeFloatLE(nx * pixel, 40); // CELLA x (Å)
  header.writeFloatLE(ny * pixel, 44); // CELLA y
  header.writeFloatLE(nz * pixel, 48); // CELLA z
  header.writeFloatLE(90, 52); // alpha
  header.writeFloatLE(90, 56); // beta
  header.writeFloatLE(90, 60); // gamma
  header.writeInt32LE(1, 64); // MAPC = 1 (X fastest)
  header.writeInt32LE(2, 68); // MAPR = 2 (Y)
  header.writeInt32LE(3, 72); // MAPS = 3 (Z slowest)
  header.writeFloatLE(dmin, 76); // DMIN
  header.writeFloatLE(dmax, 80); // DMAX
  header.writeFloatLE(dmean, 84); // DMEAN
  header.writeInt32LE(0, 88); // ISORT
  header.writeInt32LE(0, 92); // NSYMBT
  header.writeFloatLE(0, 96); // RMS
  header.writeInt32LE(0, 196); // ORIGIN x
  header.writeInt32LE(0, 200); // ORIGIN y
  header.writeInt32LE(0, 204); // ORIGIN z
  header.write("MAP ", 208, "ascii"); // the magic Mol* refuses to load without
  header.writeInt32LE(0x4144, 212); // MACHST little-endian ("DA")
  return header;
}

function buildMrcVolume(size = 64) {
  const header = Buffer.alloc(1024);
  header.writeInt32LE(size, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size, 8);
  header.writeInt32LE(2, 12);
  const data = Buffer.alloc(size * size * size * 4);
  const c = (size - 1) / 2;
  const sigma = size / 8;
  let o = 0;
  let sum = 0;
  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const r2 = (x - c) ** 2 + (y - c) ** 2 + (z - c) ** 2;
        const v = 100 * Math.exp(-r2 / (2 * sigma * sigma));
        data.writeFloatLE(v, o);
        sum += v;
        o += 4;
      }
    }
  }
  finishMrcHeader(header, size, size, size, 1.77, 0, 100, sum / (size * size * size));
  return Buffer.concat([header, data]);
}

/* ---------- the patch ---------------------------------------------------- */

const IT = "005"; // story-free: the strip reads only the latest iteration

function putText(dir, name, content) {
  const p = path.join(dir, name);
  if (existsSync(p)) {
    console.log(`  skip (idempotent): ${path.relative(PDIR, p)} already exists`);
    return;
  }
  writeFileSync(p, content, "utf8");
  console.log(`  wrote: ${path.relative(PDIR, p)} (${statSync(p).size}B)`);
}
function putBinary(dir, name, buf) {
  const p = path.join(dir, name);
  if (existsSync(p)) {
    console.log(`  skip (idempotent): ${path.relative(PDIR, p)} already exists`);
    return;
  }
  writeFileSync(p, buf);
  console.log(`  wrote: ${path.relative(PDIR, p)} (${statSync(p).size}B)`);
}

console.log("== t696 seed-gap patch — the two C-class strips wake ==");

const rows = readSelectedRows();

console.log("-- refine3d: the completed refinement's final data star");
putText(WD_REFINE, "run_data.star", buildParticlesStar(rows, true));

console.log("-- initialmodel: the workdir that never was (completed VDAM shape)");
mkdirSync(WD_INIT, { recursive: true });
putText(WD_INIT, `run_it${IT}_data.star`, buildParticlesStar(rows, true));
putText(WD_INIT, "run_data.star", buildParticlesStar(rows, true));
putBinary(WD_INIT, `run_it${IT}_class001.mrc`, buildMrcVolume(64));
putBinary(WD_INIT, "run_model.mrc", buildMrcVolume(64)); // the lib's exact list (engine L1739), not refine3d's convention
putText(WD_INIT, `run_it${IT}_model.star`, buildModelStar(10.0, false));
putText(WD_INIT, "run_model.star", buildModelStar(10.0, false));
// the record names logFile/errFile (required fields) — the files must exist (t636)
putText(WD_INIT, "run.log", [
  "[seeded] InitialModel (VDAM) — demo world, t531 lineage, patched by t696",
  "[seeded] input: 168 particles from the select verdict (selected.star)",
  "[seeded] 5 iterations, K=1 — final reference at 10.0 A (run_model.mrc)",
  "",
].join("\n"));
putText(WD_INIT, "run.err", "");

// first-draft stray: refine3d's final-map convention, wrong for initialmodel
try {
  rmSync(path.join(WD_INIT, "run_class001.mrc"), { force: true });
} catch { /* already gone */ }

console.log("-- initialmodel: the run record (the layer t692's pricing missed)");
const STATE = path.join(ROOT, "data/engine-state.json");
const runs = JSON.parse(readFileSync(STATE, "utf8"));
if (runs["cmututold000initialmodel"]) {
  console.log("  skip (idempotent): run record already exists");
} else {
  const wd = (p) => path.join(WD_INIT, p);
  runs["cmututold000initialmodel"] = {
    jobId: "cmututold000initialmodel",
    projectId: "cmuwipe6350000demoproject",
    type: "initialmodel",
    pid: null,
    cmd: "seeded:initialmodel",
    workdir: WD_INIT,
    logFile: wd("run.log"),
    errFile: wd("run.err"),
    startedAt: "2026-10-07T18:35:12.000Z", // the seed session's next heartbeat, fixed for idempotency
    outputs: {
      model_mrc: wd("run_model.mrc"),
      refine_data_star: wd("run_data.star"),
    },
    done: true,
    exitCode: 0,
    result: "Initial model seeded — 1 class from 168 particles · reference on disk",
  };
  writeFileSync(STATE, JSON.stringify(runs, null, 2));
  console.log("  wrote: engine-state.json entry cmututold000initialmodel (cmd seeded:initialmodel)");
}

console.log("== patch done ==");
process.exit(fail === 0 ? 0 : 1);

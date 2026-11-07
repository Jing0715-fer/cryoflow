#!/usr/bin/env node
/**
 * t699 — the maskcreate life patch: give the demo world's last incomplete
 * job its full life (record + workdir + mask + logs), per the t699 record
 * census and the t696 law it generalized.
 *
 * The census (scripts/t699-record-census.py) found exactly one incomplete
 * life: cmututold00000maskcreate — DB row says completed, but the seed
 * wrote NO record and NO workdir. Its outputs endpoint answers the
 * missing-record confession ("re-run the job to rebuild"), and it sits ON
 * THE LIVE MAIN CHAIN as postprocess's mask provider
 * (refine3d --half1--> maskcreate --mask--> postprocess): resolveInputs
 * (engine.ts L1872) walks runs[up.id] — with no record the provider is
 * skipped and a re-run of postprocess would be told "run MaskCreate first"
 * over a job that IS completed (the t325-class lie, local flavor).
 *
 * Why the strip censuses never saw it: output-summary.ts L571 puts
 * maskcreate in the designed-silence class ("single map — no key
 * numbers") — no summary to measure, so the missing record was invisible
 * to instruments that look at the summary leg. The record layer needs the
 * record census (t699's instrument).
 *
 * Law of the patch (t696's, inherited):
 *   - workdir name is workdirFor's own convention: type_id.slice(-8)
 *     (engine.ts L742) → maskcreate_skcreate.
 *   - mask.mrc is the lib's exact dialect: engine L1744 exact table
 *     (maskcreate → mask_mrc: ["mask.mrc"]) and L6955's --o outPath(ctx,
 *     "mask.mrc"). No other name.
 *   - the mask is a REAL 3D volume (t661's law: nz=1 stubs poison the 3D
 *     viewer world) with mask VALUES (0..1, binary core + soft edge —
 *     what relion_mask_create actually writes), not the class-map gaussian.
 *   - RunRecord.logFile/errFile are REQUIRED (engine.ts L114) and the
 *     t636 claim-without-write law forbids naming files that don't exist
 *     — run.log/run.err are written first.
 *   - IDEMPOTENT: every write is exists-guarded, timestamps are fixed
 *     (no Date.now()) — running twice changes nothing the second time.
 *   - External writers are a documented, tolerated pattern (engine.ts
 *     L261-262: readRuns' mtime/size check picks up external writers;
 *     the seed itself wrote "seeded:*" records this way).
 *   - startedAt continues the seed session's heartbeat family
 *     (topaztrain/denoise 18:35:11.703Z, initialmodel 18:35:12.000Z —
 *     t696's fixed value); maskcreate takes 18:35:12.500Z.
 *   - Probe safety: no live probe references maskcreate in the demo world
 *     (t677/t695/t692/t693 clean; family-run mentions the type only in a
 *     comment about the EMPIAR chain, which builds its own world); the
 *     bed's world-guard is a dynamic lower bound (18 dirs ≥ 17 holds);
 *     t695 is world-following (wire recomputed from the outputs endpoint
 *     per job — maskcreate's summary stays null → no-strip on both legs).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = "/home/z/my-project";
const PDIR = path.join(ROOT, "data/relion/cmuwipe6350000demoproject");
const WD_MASK = path.join(PDIR, "maskcreate_skcreate"); // workdirFor: type_id.slice(-8)
const JOB_ID = "cmututold00000maskcreate";

let fail = 0;
const must = (cond, msg) => {
  console.log(`  ${cond ? "ok" : "FAIL"}: ${msg}`);
  if (!cond) fail++;
};

/* ---------- the mask builder ---------------------------------------------
 * finishMrcHeader is byte-faithful from qa-t531-old-world-seed.mjs L455-478
 * (provenance per t695's copy-fully law; the same lines t696 copied).
 * The volume values are a MASK, not a map: 1.0 inside a sphere, falling to
 * 0.0 across a soft edge (relion_mask_create's --ini_threshold +
 * --width_soft_edge semantics) — a binary-ish volume, dmin 0, dmax 1. */

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

function buildMrcMask(size = 64) {
  const header = Buffer.alloc(1024);
  header.writeInt32LE(size, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size, 8);
  header.writeInt32LE(2, 12);
  const data = Buffer.alloc(size * size * size * 4);
  const c = (size - 1) / 2;
  const rCore = size * 0.30; // binary core radius
  const rEdge = size * 0.38; // soft edge outer radius
  let o = 0;
  let sum = 0;
  let min = 1;
  let max = 0;
  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const r = Math.sqrt((x - c) ** 2 + (y - c) ** 2 + (z - c) ** 2);
        let v;
        if (r <= rCore) v = 1;
        else if (r >= rEdge) v = 0;
        else {
          const t = (r - rCore) / (rEdge - rCore);
          v = 1 - (t * t * (3 - 2 * t)); // smoothstep falloff — the soft edge
        }
        data.writeFloatLE(v, o);
        sum += v;
        if (v < min) min = v;
        if (v > max) max = v;
        o += 4;
      }
    }
  }
  must(Math.abs(max - 1) < 1e-6 && Math.abs(min) < 1e-6, `mask values span 0..1 (got ${min.toFixed(3)}..${max.toFixed(3)})`);
  finishMrcHeader(header, size, size, size, 1.77, min, max, sum / (size * size * size));
  return Buffer.concat([header, data]);
}

/* ---------- the patch ---------------------------------------------------- */

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

console.log("== t699 maskcreate life patch — the last incomplete life completes ==");

console.log("-- workdir (workdirFor convention: maskcreate_skcreate)");
mkdirSync(WD_MASK, { recursive: true });
putBinary(WD_MASK, "mask.mrc", buildMrcMask(64)); // the lib's exact name (engine L1744/L6955)
putText(WD_MASK, "run.log", [
  "[seeded] MaskCreate — demo world, t531 lineage, patched by t699",
  "[seeded] relion_mask_create --i <refine3d half1> --o mask.mrc",
  "[seeded]   --ini_threshold 0.02 --extend_inimask 3 --width_soft_edge 8",
  "[seeded] soft-edged solvent mask written (binary core + smooth edge, 0..1)",
  "",
].join("\n"));
putText(WD_MASK, "run.err", "");

console.log("-- the run record (the layer the summary-leg instruments never see)");
const STATE = path.join(ROOT, "data/engine-state.json");
const runs = JSON.parse(readFileSync(STATE, "utf8"));
if (runs[JOB_ID]) {
  console.log("  skip (idempotent): run record already exists");
} else {
  const wd = (p) => path.join(WD_MASK, p);
  runs[JOB_ID] = {
    jobId: JOB_ID,
    projectId: "cmuwipe6350000demoproject",
    type: "maskcreate",
    pid: null,
    cmd: "seeded:maskcreate",
    workdir: WD_MASK,
    logFile: wd("run.log"),
    errFile: wd("run.err"),
    startedAt: "2026-10-07T18:35:12.500Z", // the seed session's heartbeat, after initialmodel (t696), fixed for idempotency
    outputs: {
      mask_mrc: wd("mask.mrc"),
    },
    done: true,
    exitCode: 0,
    result: "Mask seeded — soft-edged solvent mask from refine3d's half map · 0/1 volume on disk",
  };
  writeFileSync(STATE, JSON.stringify(runs, null, 2));
  console.log(`  wrote: engine-state.json entry ${JOB_ID} (cmd seeded:maskcreate)`);
}

console.log("== patch done ==");
process.exit(fail === 0 ? 0 : 1);

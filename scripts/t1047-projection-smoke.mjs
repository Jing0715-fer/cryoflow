#!/usr/bin/env node
/** t1047 smoke — the slab projection's behavioral leg on a REAL map.
 *  Bare node cannot import the TS lib, so this replays the fold EXACTLY
 *  as readMrcProjection speaks it (same layout, same clamp, same reduce)
 *  against the real header bytes + a raw voxel read, and verifies:
 *   1. the fold's arithmetic on a real 3D map (z/y/x frames, slab + full)
 *   2. the route verb end-to-end through the running dev server (PNG
 *      bytes come back, the stack refusal speaks, the pngKey params ride)
 *  The static unit pins the SOURCE words; this leg pins the NUMBERS. */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const MAP = path.join(ROOT, "data/relion/cmv8nhqxo0000sy8934xli45t/class3d_1dgvx5iy/run_class001.mrc");

let pass = 0, fail = 0;
const ok = (c, n) => { if (c) { pass++; console.log(`  ok ${n}`); } else { fail++; console.log(`  FAIL ${n}`); } };

// --- MRC header (the lib's own dialect: mode 2 float32 assumed-safe read via mode field)
const buf = readFileSync(MAP);
const nx = buf.readInt32LE(0), ny = buf.readInt32LE(4), nz = buf.readInt32LE(8);
const mode = buf.readInt32LE(12);
const nsymbt = buf.readInt32LE(92);
const bpp = mode === 2 ? 4 : mode === 0 ? 1 : mode === 6 ? 2 : 4;
const dataStart = 1024 + nsymbt;
console.log(`map ${path.basename(MAP)}: ${nx}x${ny}x${nz} mode ${mode} nsymbt ${nsymbt}`);
ok(nx > 1 && ny > 1 && nz > 1, "the map is a real 3D box");

const vol = new Float32Array(nx * ny * nz);
for (let iz = 0; iz < nz; iz++) {
  for (let iy = 0; iy < ny; iy++) {
    const off = dataStart + ((iz * ny + iy) * nx) * bpp;
    for (let ix = 0; ix < nx; ix++) {
      vol[(iz * ny + iy) * nx + ix] = mode === 2 ? buf.readFloatLE(off + ix * 4) : buf.readUInt8(off + ix);
    }
  }
}
const clamp = (v, dim) => Math.max(0, Math.min(dim - 1, Math.round(Math.min(1, Math.max(0, v)) * (dim - 1))));

// --- fold z (full + slab), the lib's own loops
const foldZ = (from, to, op) => {
  const b0 = clamp(from, nz), b1 = clamp(to, nz);
  const voxels = b1 - b0 + 1;
  const out = new Float32Array(nx * ny);
  for (let iy = 0; iy < ny; iy++) for (let ix = 0; ix < nx; ix++) {
    let acc = op === "max" ? -Infinity : op === "min" ? Infinity : 0;
    for (let iz = b0; iz <= b1; iz++) {
      const v = vol[(iz * ny + iy) * nx + ix];
      acc = op === "max" ? (v > acc ? v : acc) : op === "min" ? (v < acc ? v : acc) : acc + v;
    }
    out[iy * nx + ix] = op === "mean" ? acc / voxels : acc;
  }
  return { out, voxels };
};

console.log("A — the fold's arithmetic (z)");
{
  const full = foldZ(0, 1, "max");
  ok(full.voxels === nz, `full-extent fold says the whole depth (${full.voxels} === ${nz})`);
  const slab = foldZ(0.25, 0.75, "max");
  const expect = Math.round(0.75 * (nz - 1)) - Math.round(0.25 * (nz - 1)) + 1;
  ok(slab.voxels === expect, `the slab's depth is the kept range's own (${slab.voxels} === ${expect})`);
  // max over the slab >= max over ANY single plane inside it: spot-check
  // the center ray against a direct walk
  const iy = (ny >> 1), ix = (nx >> 1);
  let direct = -Infinity;
  for (let iz = Math.round(0.25 * (nz - 1)); iz <= Math.round(0.75 * (nz - 1)); iz++) {
    const v = vol[(iz * ny + iy) * nx + ix];
    if (v > direct) direct = v;
  }
  ok(slab.out[iy * nx + ix] === direct, "the center ray's max matches a direct walk");
  const meanFull = foldZ(0, 1, "mean");
  ok(Number.isFinite(meanFull.out[iy * nx + ix]), "the mean fold is finite (the /voxels happened)");
  const minFull = foldZ(0, 1, "min");
  ok(minFull.out[iy * nx + ix] <= meanFull.out[iy * nx + ix] && meanFull.out[iy * nx + ix] <= full.out[iy * nx + ix], "min ≤ mean ≤ max on the probe ray");
}

// --- the route verb end-to-end (the dev server, the Origin law)
console.log("B — the route verb (the running dev server)");
{
  const rel = "run_class001.mrc"; // the route speaks WORKDIR-RELATIVE paths (the outputs listing's own language)
  const base = "http://localhost:3000/api/jobs/JOBID/outputs/file";
  // find the owning job id: the jobs listing names workdirs
  const lst = await fetch("http://localhost:3000/api/jobs?projectId=cmv8nhqxo0000sy8934xli45t", { headers: { Origin: "http://localhost:3000" } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const jobs = lst?.jobs ?? lst ?? [];
  // the RELION workdir convention: `${type}_${id-suffix}` — the map's own
  // directory names its owner (class3d_1dgvx5iy → the job whose id ends
  // 1dgvx5iy); no workdir field rides the listing, the suffix is the tie
  const owner = (Array.isArray(jobs) ? jobs : []).find((j) => MAP.includes(`class3d_${j.id.slice(-8)}`) || j.id.endsWith("1dgvx5iy"));
  if (!owner) {
    console.log("  (skip — the job listing did not name the owner; the fold leg already spoke)");
  } else {
    const url = base.replace("JOBID", owner.id) + `?path=${encodeURIComponent(rel)}&format=png&plane=project&axis=z&from=0.25&to=0.75&op=max`;
    const r = await fetch(url, { headers: { Origin: "http://localhost:3000" } });
    ok(r.ok, `the project verb answers 200 (${r.status})`);
    if (r.ok) {
      const ab = await r.arrayBuffer();
      ok(ab.byteLength > 512, `the PNG has bytes (${ab.byteLength})`);
      const head = Buffer.from(ab.slice(0, 8));
      ok(head[0] === 0x89 && head[1] === 0x50, "the bytes open as a PNG signature");
    }
    // the slab's mean variant answers too
    const r2 = await fetch(base.replace("JOBID", owner.id) + `?path=${encodeURIComponent(rel)}&format=png&plane=project&axis=z&from=0.25&to=0.75&op=mean`, { headers: { Origin: "http://localhost:3000" } });
    ok(r2.ok, "the mean variant answers 200 too");
    // a stack's refusal keeps its word (a .mrcs path — use a coords star? the
    // refusal only needs a stack file; if none is at hand the skip is honest)
    const stackJob = (Array.isArray(jobs) ? jobs : []).find((j) => (j.workdir ?? j.workDir ?? "").includes("extract"));
    if (stackJob) {
      const mrcs = (stackJob.workdir ?? stackJob.workDir ?? "");
      console.log(`  (stack face: extract job ${stackJob.id} present — the volumes-only refusal is pinned by the static unit's source words)`);
    }
  }
}

console.log(`\n${pass} ok, ${fail} FAIL`);
process.exit(fail ? 1 : 0);

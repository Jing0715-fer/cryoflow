#!/usr/bin/env node
// t1133-render-stamp-unit.mjs — the render cache's generation-stamp law,
// the census's 71st instrument.
//
// THE DEFECT (found live this window): the render cache keyed every
// surface (slice PNGs, iteration sheets, .done verdicts) by the stack's
// NAME + polarity alone. A re-run REWRITES the stacks in place under the
// SAME names ("a re-run refreshes, never mints" — the t1132 law), so the
// class2d job's class sheet went on wearing the SEED's noise tiles over
// the healed bytes: the mirror's stack carried a centered blob at std
// 0.74 vs the 0.1225 noise floor, and the served tile read +-3 gray
// levels — symmetric noise, invisible to the eye, confessed by the bytes.
//
// THE CURE (two cures, one law — a rendered face may outlive its source
// only by the source's own identity):
//   A. THE CONTENT STAMP: every rendered product wears the SOURCE file's
//      (mtime-size) stamp in its own filename (sliceNNNN__<stamp>.png,
//      sheet__<stamp>.png); the local render leg stats the mirror file
//      FIRST and keys both the cache read and the render write under that
//      stamp; a refreshed source can never answer from an older
//      generation. Sibling generations retire when a fresh one lands.
//   B. THE DISPATCH INVALIDATION: startJob (the ONE mouth every dispatch
//      funnel passes) retires the job's whole render cache at the moment
//      a new run is accepted.
//
// This instrument pins: the healed world's bytes (the signal channel the
// ride was for), the books that recompute, the stamped generation on
// disk, the served tile's on-camera signal, and the invalidation door.

import { execSync } from "child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from "fs";
import http from "node:http";
import os from "os";
import path from "path";

const BASE = "http://localhost:3000";
const REPO = "/home/z/my-project";
const PROJ = "cmvbjl6060000srlis2ai5mb3";
const CLASS2D_JOB = "cmvbjl9b7000gsrli46lkfgpq";
const CLUSTER_C2D = `${REPO}/services/mock-cluster/fs/projects/cryoflow/${PROJ}/class2d_46lkfgpq`;
const MIRROR_C2D = `${REPO}/data/relion/${PROJ}/class2d_46lkfgpq`;
const CACHE_JOB = `${REPO}/data/remote-preview/live/${CLASS2D_JOB}`;
const NOISE_FLOOR = 0.1225;

const SH = { Origin: BASE, "Sec-Fetch-Site": "same-origin" };

let fail = 0;
let n = 0;
const must = (cond, label) => {
  n++;
  console.log(cond ? `  ok: ${label}` : `  FAIL: ${label}`);
  if (!cond) fail++;
};

function httpGet(url, asBuffer = false) {
  return new Promise((resolve, reject) => {
    http
      .get(url, { headers: SH }, (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          resolve(asBuffer ? { status: res.statusCode, buf } : { status: res.statusCode, body: buf.toString("utf8") });
        });
      })
      .on("error", reject);
  });
}

function classAverageStats(file) {
  const buf = readFileSync(file);
  if (buf.length < 1024 || buf.subarray(208, 212).toString("ascii") !== "MAP ") return null;
  const nx = buf.readInt32LE(0), ny = buf.readInt32LE(4), nz = buf.readInt32LE(8);
  const nsymbt = buf.readInt32LE(92);
  const total = nx * ny * nz;
  const off = 1024 + nsymbt;
  if (buf.length < off + total * 4) return null;
  let sum = 0, sum2 = 0, sampled = 0, min = Infinity, max = -Infinity;
  for (let i = 0; i < total; i += 4) {
    const v = buf.readFloatLE(off + i * 4);
    sum += v; sum2 += v * v; sampled++;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const mean = sum / sampled;
  const std = Math.sqrt(Math.max(0, sum2 / sampled - mean * mean));
  // first slice's center vs border (the centered blob's proxy)
  let center = 0, border = 0, cn = 0, bn = 0;
  const c0 = Math.floor(nx / 4), c1 = c0 + Math.floor(nx / 2);
  for (let y = 0; y < ny; y++)
    for (let x = 0; x < nx; x++) {
      const v = buf.readFloatLE(off + (y * nx + x) * 4);
      if (x >= c0 && x < c1 && y >= c0 && y < c1) { center += v; cn++; }
      else if (x < 8 || x >= nx - 8 || y < 8 || y >= ny - 8) { border += v; bn++; }
    }
  return { nx, ny, nz, std, min, max, signal: center / cn - border / bn };
}

console.log("== A: the healed world's bytes (the signal channel the ride was for) ==");
const finalStats = classAverageStats(`${CLUSTER_C2D}/run_classes.mrcs`);
must(finalStats != null && finalStats.nz === 50 && finalStats.nx === 64, `the final classes stack's shape stands (${finalStats?.nx}x${finalStats?.ny}x${finalStats?.nz})`);
must(finalStats != null && finalStats.std > NOISE_FLOOR + 0.02, `the final stack's signal channel is ALIVE (std ${finalStats?.std.toFixed(4)} vs the floor ${NOISE_FLOOR})`);
must(finalStats != null && Math.abs(finalStats.signal) > 0.01, `the final stack carries centered structure (center-border ${finalStats?.signal.toFixed(4)})`);
const it000Stats = classAverageStats(`${CLUSTER_C2D}/run_it000_classes.mrcs`);
must(it000Stats != null && it000Stats.std > NOISE_FLOOR + 0.02, `the seed round's averages are alive too (std ${it000Stats?.std.toFixed(4)})`);

console.log("== B: the books recompute (formula-driven assignments) ==");
const star = readFileSync(`${CLUSTER_C2D}/run_data.star`, "utf8");
const rows = star.split(/\r?\n/).filter((l) => l.includes("@") && l.includes(".mrcs"));
must(rows.length === 96, `the star's promise stands (96 rows, found ${rows.length})`);
const expect = rows.map((_, p) => String(((p * 7 + 200) % 50) + 1));
const got = rows.map((l) => l.split("\t")[1]);
must(JSON.stringify(expect) === JSON.stringify(got), "the class books recompute (row p wears class (p*7+200)%50+1)");

console.log("== C: the stamped generation on disk (the cure's evidence) ==");
// t1136 — the book-heal ride re-ran class2d through the run door: the
// mirror stack's bytes are identical but its MTIME moved, so the content
// stamp moved with it. The render-on-request law means the fresh
// generation renders when a consumer asks — ASK (the sheet route renders
// the whole generation under the current stamp, the same face the ride's
// own retake proved), then assert the disk.
const sheetR = await httpGet(`${BASE}/api/jobs/${CLASS2D_JOB}/iterations/sheet?file=run_it200_classes.mrcs`, true);
const it200Dir = `${CACHE_JOB}/run_it200_classes`;
must(existsSync(it200Dir), "the it200 render cache dir stands");
must(sheetR.status === 200 && sheetR.buf.subarray(1, 4).toString("ascii") === "PNG", `the sheet route answers with a PNG under the fresh stamp (${sheetR.status})`);
// the stamped products accumulate PER REQUEST (the t1136 lesson: the sheet
// is one montage PNG; the per-slice tiles render one fetch each) — the unit
// renders the WHOLE generation itself (50 slices), then asserts the disk
for (let s = 0; s < 50; s++) {
  const r = await httpGet(`${BASE}/api/jobs/${CLASS2D_JOB}/iterations/image?file=run_it200_classes.mrcs&slice=${s}`, true);
  if (r.status !== 200) { must(false, `the slice ${s} render answers (${r.status})`); break; }
}
const stamped = existsSync(it200Dir) ? readdirSync(it200Dir).filter((f) => /__\d+-\d+\.png$/.test(f)) : [];
must(stamped.length >= 40, `the it200 generation's stamped products stand (${stamped.length} stamped files)`);
const stampOf = (p) => {
  try {
    const st = statSync(p);
    return `${Math.round(st.mtimeMs)}-${st.size}`;
  } catch {
    return null;
  }
};
const mirrorStamp = stampOf(`${MIRROR_C2D}/run_it200_classes.mrcs`);
must(mirrorStamp != null, `the mirror stack's stamp answers (${mirrorStamp})`);
must(stamped.some((f) => f.endsWith(`__${mirrorStamp}.png`)), "the on-disk stamps MATCH the mirror file's (mtime-size) identity (the local leg's own keying)");

console.log("== D: the served tile carries the signal (the camera-level witness) ==");
const r1 = await httpGet(`${BASE}/api/jobs/${CLASS2D_JOB}/iterations/image?file=run_it200_classes.mrcs&slice=0`, true);
must(r1.status === 200 && r1.buf.subarray(1, 4).toString("ascii") === "PNG", `the iteration image route answers with a PNG (${r1.status})`);
// center vs border in gray levels — the blob must be ON the tile
const png = r1.buf;
function pngCenterBorder(buf) {
  // decode a small grayscale PNG via the system PIL (the repo's own toolchain)
  const tmp = path.join(os.tmpdir(), `t1133-tile-${Date.now()}.png`);
  writeFileSync(tmp, buf);
  const out = execSync(
    `python3 -c "from PIL import Image; import numpy as np, sys; im=np.asarray(Image.open('${tmp}').convert('L'),dtype=np.float32); c=im[16:48,16:48].mean(); b=np.concatenate([im[:8,:].ravel(),im[-8:,:].ravel(),im[:,:8].ravel(),im[:,-8:].ravel()]).mean(); print(f'{im.shape[0]} {im.std():.2f} {c-b:.2f}')"`,
    { encoding: "utf8" }
  ).trim();
  rmSync(tmp, { force: true });
  const [size, std, sig] = out.split(/\s+/).map(Number);
  return { size, std, signal: sig };
}
const tile1 = pngCenterBorder(png);
must(tile1.size === 64, `the served tile is a 64px face (${tile1.size})`);
must(Math.abs(tile1.signal) > 20, `the served tile carries the centered structure (${tile1.signal.toFixed(1)} gray levels — the seed's noise face read ±3)`);
const r2 = await httpGet(`${BASE}/api/jobs/${CLASS2D_JOB}/iterations/image?file=run_it200_classes.mrcs&slice=0`, true);
must(r2.status === 200 && r2.buf.equals(png), "the second fetch answers the SAME bytes (the stamped cache hit)");

console.log("== E: the dispatch invalidation door (Cure B) ==");
// a THROWAWAY job id: the door must retire whatever the cache held for it
const fakeJob = "t1133-invalidations-probe";
const fakeDir = `${REPO}/data/remote-preview/live/${fakeJob}/probe-stack`;
mkdirSync(fakeDir, { recursive: true });
writeFileSync(`${fakeDir}/slice0000__111-222.png`, "x");
writeFileSync(`${fakeDir}/sheet__111-222.png`, "x");
const invScript = `
const { register } = await import("${REPO}/scripts/ts-alias-register.mjs").catch(() => ({}));
`;
// the fn is TS-land; exercise it through a compiled probe instead: replicate
// its contract by importing the module via the repo's own loader.
const probe = execSync(
  `cd ${REPO} && node --import ./scripts/ts-alias-register.mjs -e "
import { invalidateJobRenderCache } from '@/lib/remote/iteration-live';
invalidateJobRenderCache('${fakeJob}');
console.log('invalidated');
" 2>&1`,
  { encoding: "utf8" }
).trim();
must(probe.includes("invalidated"), "the invalidation door answers through the module's own loader");
must(!existsSync(`${REPO}/data/remote-preview/live/${fakeJob}`), "the probe job's whole render cache retired (dir gone)");

console.log("== F: the ride's record (the run door's world) ==");
const jobs = JSON.parse((await httpGet(`${BASE}/api/jobs`)).body).jobs ?? [];
const mine = jobs.filter((j) => j.projectId === PROJ);
must(mine.length === 15, `the world's job count stands at 15 (${mine.length})`);
const c2d = mine.find((j) => j.type === "class2d");
must(c2d != null && c2d.status === "completed", `the class2d job stands completed (${c2d?.status ?? "missing"})`);
const upd = Date.parse(c2d?.updatedAt ?? "");
must(Number.isFinite(upd) && upd > Date.parse("2026-10-18T00:58:00Z"), "the job's record carries the re-run (updatedAt after the ride's knock)");

console.log(`\n${n}/${n - fail} green${fail === 0 ? " — the stamp law stands." : ` — ${fail} FAIL(S).`}`);
process.exit(fail === 0 ? 0 : 1);

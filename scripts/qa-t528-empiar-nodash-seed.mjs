#!/usr/bin/env node
// t528 — the no-dash EMPIAR-10017 staging seeder (pool item ① of t527).
//
// t372 (the REAL-RELION full-chain run on the mock cluster) imports its
// micrographs and movies from /data2/empiar10017/{data,movie} — the
// NO-DASH layout of the t372 era, distinct from diag-t380's dash layout
// (fs/data2/empiar-10017/{micrographs,coords}, restored by the t527
// seeder). The sandbox reset annihilated the no-dash staging; the REAL
// data itself is already home (t527: /home/z/empiar-10017, 10 mics +
// 10 coords, identity-law verified). This seeder re-stages the no-dash
// consumer view out of the real bytes — the t527 law applied to a second
// consumer: recipe tracked, data hardlinked, synthetic only where the
// consumer's contract demands a shape the real set doesn't carry.
//
// What it restores, and why exactly this shape:
//   services/mock-cluster/fs/data2/empiar10017/data/
//     EXACTLY 5 real mics — t372's P2c asserts /5 micrographs/i against
//     the import receipt, so the count is part of the contract. Stems =
//     the first 5 alphabetical (the t527 STEMS order). HARDLINKS: 335 MB
//     of mirror for zero extra disk (fs is gitignored — t341 law).
//   services/mock-cluster/fs/data2/empiar10017/movie/
//     2 synthetic movie stacks (5 frames × 1024² float32 each): t372's
//     P8 exercises relion_motioncorr --use_own through a real import →
//     motioncorr chain, and the real set carries NO frame stacks — the
//     contract demands a shape the archive never had. Frames are CROPS
//     of the real micrograph bytes (window walked per frame + tiny
//     deterministic noise) — the real ice texture, honestly labelled in
//     the MRC header and here: mechanics are graded by the real corrector,
//     not fidelity (that is diag-t380's job, on real mics).
//
// Identity law (inherited from t527): a real mic is 67,109,888 B
// (4096² float32 + 1024 header), mode 2, NX=NY=4096 NZ=1, all-positive
// ice sample. Every staged mic is verified before linking; a failed
// identity aborts the staging (never grade a fake world).
//
// Re-run any time a sandbox reset eats the staging. Skip-fast when present.
import { existsSync, linkSync, copyFileSync, mkdirSync, openSync, readSync, closeSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const HOME_DIR = "/home/z/empiar-10017/micrographs";
const NODASH = path.join(ROOT, "services/mock-cluster/fs/data2/empiar10017");
const DATA_DIR = path.join(NODASH, "data");
const MOVIE_DIR = path.join(NODASH, "movie");
const MIC_SIZE = 67_109_888;

const STEMS = [
  "Falcon_2012_06_12-14_33_35_0",
  "Falcon_2012_06_12-14_57_34_0",
  "Falcon_2012_06_12-15_07_41_0",
  "Falcon_2012_06_12-15_14_01_0",
  "Falcon_2012_06_12-15_17_31_0",
  "Falcon_2012_06_12-15_27_22_0",
  "Falcon_2012_06_12-15_30_21_0",
  "Falcon_2012_06_12-15_33_42_0",
  "Falcon_2012_06_12-15_36_26_0",
  "Falcon_2012_06_12-15_41_22_0",
];
const DATA_STEMS = STEMS.slice(0, 5); // exactly 5 — the P2c contract
const MOVIE_STEMS = STEMS.slice(0, 2); // 2 synthetic frame stacks

const log = (m) => console.log(`[t528-seed] ${m}`);

/** the identity law for a real Falcon 4096² float32 mic (t527 law verbatim) */
function micIsReal(p) {
  try {
    if (statSync(p).size !== MIC_SIZE) return false;
    const fd = openSync(p, "r");
    const hdr = Buffer.alloc(1024);
    readSync(fd, hdr, 0, 1024, 0);
    const nx = hdr.readInt32LE(0);
    const ny = hdr.readInt32LE(4);
    const nz = hdr.readInt32LE(8);
    const mode = hdr.readInt32LE(12);
    // sampled all-positive ice: 4096 floats mid-file
    const buf = Buffer.alloc(4096 * 4);
    readSync(fd, buf, 0, buf.length, 1024 + 2048 * 4096 * 4);
    closeSync(fd);
    if (!(nx === 4096 && ny === 4096 && nz === 1 && mode === 2)) return false;
    let sum = 0;
    for (let i = 0; i < 4096; i++) sum += buf.readFloatLE(i * 4);
    return sum / 4096 > 0;
  } catch {
    return false;
  }
}

/** hardlink stage; falls back to copy across devices (t527 law) */
function stageInto(src, dst) {
  try {
    linkSync(src, dst);
  } catch (e) {
    if (e.code === "EEXIST") return;
    if (e.code === "EXDEV") copyFileSync(src, dst);
    else throw e;
  }
}

/** deterministic PRNG (mulberry32) — reruns are byte-identical */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CROP = 1024;   // movie frame is a 1024² window of the 4096² mic
const FRAMES = 5;    // frames per stack — enough for the real corrector
const STEP_X = 2;    // px of window walk per frame (the "motion" to align)
const STEP_Y = 1;

/**
 * Build one synthetic movie stack from a REAL mic: frame f reads the
 * (x0 + f*STEP_X, y0 + f*STEP_Y) 1024² window of the source image and
 * adds deterministic σ=3 gaussian noise. Real texture, walked window,
 * honest label — the mechanics lane's stand-in.
 */
function synthesizeMovie(micPath, stem, outPath, seed) {
  const fd = openSync(micPath, "r");
  const NX = 4096;
  const rowBytes = NX * 4;
  const x0 = 1536, y0 = 1024; // base window (max walked: 1536+8+1024 < 4096)
  const stack = Buffer.alloc(FRAMES * CROP * CROP * 4);
  const rng = mulberry32(seed);
  for (let f = 0; f < FRAMES; f++) {
    const row = Buffer.alloc(CROP * 4);
    for (let y = 0; y < CROP; y++) {
      const srcRow = y0 + f * STEP_Y + y;
      readSync(fd, row, 0, row.length, 1024 + srcRow * rowBytes + (x0 + f * STEP_X) * 4);
      for (let x = 0; x < CROP; x++) {
        const v = row.readFloatLE(x * 4);
        // Box-Muller gaussian noise, σ=3 — the aligner's chewing gum
        const u1 = Math.max(rng(), 1e-9), u2 = rng();
        const g = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const o = f * CROP * CROP + y * CROP + x;
        stack.writeFloatLE(v + g * 3, o * 4);
      }
    }
  }
  closeSync(fd);

  const hdr = Buffer.alloc(1024);
  hdr.writeInt32LE(CROP, 0);
  hdr.writeInt32LE(CROP, 4);
  hdr.writeInt32LE(FRAMES, 8);
  hdr.writeInt32LE(2, 12); // MODE float32
  hdr.writeInt32LE(1, 64); hdr.writeInt32LE(2, 68); hdr.writeInt32LE(3, 72);
  hdr.write("MAP ", 208, "ascii");
  hdr.writeInt32LE(0x00004144, 212); // "DA" little-endian machine stamp
  const label = `t528 synthetic movie crop of EMPIAR-10017 ${stem} (real bytes, walked window)`;
  hdr.write(label.slice(0, 80), 228, "ascii");
  const out = Buffer.concat([hdr, stack]);
  writeFileSync(outPath, out);
  return out.length;
}

function main() {
  const t0 = Date.now();
  if (!existsSync(HOME_DIR)) {
    console.error("[t528-seed] real data missing — run scripts/qa-t527-empiar-real-seed.mjs first (the t527 fetch is this seeder's upstream)");
    process.exit(2);
  }
  // upstream identity: the whole real set verifies or nothing stages
  for (const s of STEMS) {
    if (!micIsReal(path.join(HOME_DIR, `${s}.mrc`))) {
      console.error(`[t528-seed] identity law FAILED for ${s}.mrc — aborting (never stage an unverified byte)`);
      process.exit(2);
    }
  }
  log(`identity law passed for all ${STEMS.length} real mics`);

  // ---- data/: EXACTLY 5 real mics (P2c contract) ----
  mkdirSync(DATA_DIR, { recursive: true });
  for (const f of readdirSync(DATA_DIR)) rmSync(path.join(DATA_DIR, f), { force: true });
  for (const s of DATA_STEMS) stageInto(path.join(HOME_DIR, `${s}.mrc`), path.join(DATA_DIR, `${s}.mrc`));
  const dataCount = readdirSync(DATA_DIR).filter((f) => f.endsWith(".mrc")).length;
  log(`data/ staged: ${dataCount} real mics (assert target: 5)`);

  // ---- movie/: 2 synthetic frame stacks built from real bytes ----
  mkdirSync(MOVIE_DIR, { recursive: true });
  for (const f of readdirSync(MOVIE_DIR)) rmSync(path.join(MOVIE_DIR, f), { force: true });
  MOVIE_STEMS.forEach((s, i) => {
    const out = path.join(MOVIE_DIR, `${s}_frames.mrc`);
    const bytes = synthesizeMovie(path.join(HOME_DIR, `${s}.mrc`), s, out, 20261003 + i);
    log(`movie/ synthesized: ${path.basename(out)} — ${FRAMES}×${CROP}² float32, ${(bytes / 1048576).toFixed(1)} MB (from real ${s})`);
  });
  const movieCount = readdirSync(MOVIE_DIR).filter((f) => f.endsWith(".mrc")).length;
  log(`movie/ staged: ${movieCount} frame stacks (assert target: 2)`);

  log(`done in ${((Date.now() - t0) / 1000).toFixed(0)}s — no-dash staging restored (data=real links, movie=synthetic crops of real bytes)`);
  if (dataCount !== 5 || movieCount !== 2) {
    console.error("[t528-seed] STAGING COUNT WRONG — t372 P2c will refuse");
    process.exit(2);
  }
}

main();

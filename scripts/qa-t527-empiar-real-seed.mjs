#!/usr/bin/env node
// t527 — the REAL-data EMPIAR-10017 seeder. The pool item t526 left open
// ("真数据需从公开库重取") finally closed: this window measured EBI at
// ~644 KB/s solo, ~4 MB/s across 4 streams — the t380-era excuse for
// synthesising the mirror (16 KB/s → 8 hours) is gone.
//
// What it restores, and why exactly this shape:
//   /home/z/empiar-10017/micrographs/          10 real mics + 10 Henderson
//     .coords BESIDE them (the engine's coord lane, engine.ts "expected
//     Henderson picks in EMPIAR_DIR", reads that directory; the import lane
//     reads *.mrc sorted — ANY count, but the historical set carried 10).
//   services/mock-cluster/fs/data2/empiar-10017/
//     micrographs/ 8 mics + coords/ 8 coords — EXACTLY 8 each: diag-t380
//     asserts the mirror counts (mics===8 && coords===8), stems = the first
//     8 alphabetical (the same list make-empiar10017-fixtures.py recorded
//     as the historical MICS). Staged as HARDLINKS — 537 MB of mirror for
//     zero extra disk; the fs is already gitignored (t341 law: data never
//     ships in git, the fetch procedure does).
//
// Identity law: a real mic is 67,109,888 B (4096² float32 + 1024 header),
// mode 2, NX=NY=4096 NZ=1, and an all-positive ice plane (sampled mean > 0
// — the P1 cryo truth the fidelity exam grades). The t526 synthetic
// stand-ins (263,168 B, "t526 synthetic fixture" label) are retired ONLY
// after every real mic verifies — the chain never runs unprotected.
//
// Re-run any time a sandbox reset eats the data. Skip-fast when present.
// The synthetic fallback (qa-t526-empiar-seed.mjs) remains documented for
// a 16 KB/s world — but it must never satisfy diag-t380 again.
import { spawnSync } from "node:child_process";
import {
  createWriteStream,
  existsSync,
  linkSync,
  copyFileSync,
  openSync,
  readSync,
  closeSync,
  readdirSync,
  rmSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const ROOT = path.join(import.meta.dirname, "..");
const HOME_DIR = "/home/z/empiar-10017/micrographs";
const MIRROR = path.join(ROOT, "services/mock-cluster/fs/data2/empiar-10017");
const BASE = "https://ftp.ebi.ac.uk/empiar/world_availability/10017/data";
const MIC_SIZE = 67_109_888;

// the first 10 of the alphabetical listing; [0..7] double as the mirror set
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
const MIRROR_STEMS = STEMS.slice(0, 8);

const log = (m) => console.log(`[t527-seed] ${m}`);

/** download one file with retry; size-verified, partials discarded */
async function fetchTo(url, out, wantSize) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      await pipeline(Readable.fromWeb(r.body), createWriteStream(out));
      const sz = statSync(out).size;
      if (wantSize && sz !== wantSize) throw new Error(`size ${sz} != ${wantSize}`);
      return;
    } catch (e) {
      log(`  attempt ${attempt} failed for ${path.basename(out)}: ${e.message}`);
      if (attempt === 3) throw e;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

/** the identity law for a real Falcon 4096² float32 mic */
function micIsReal(p) {
  try {
    if (statSync(p).size !== MIC_SIZE) return false;
    const fd = openSyncRead(p);
    const hdr = fd.read(1024);
    const nx = hdr.readInt32LE(0);
    const ny = hdr.readInt32LE(4);
    const nz = hdr.readInt32LE(8);
    const mode = hdr.readInt32LE(12);
    fd.close();
    if (!(nx === 4096 && ny === 4096 && nz === 1 && mode === 2)) return false;
    // sampled all-positive ice (P1 spirit): read 4096 floats mid-file
    const fh = openSyncRead(p, 1024 + 2048 * 4096 * 4);
    const buf = fh.read(4096 * 4);
    fh.close();
    let sum = 0;
    for (let i = 0; i < 4096; i++) sum += buf.readFloatLE(i * 4);
    return sum / 4096 > 0;
  } catch {
    return false;
  }
}

function openSyncRead(p, position = 0) {
  const fd = openSync(p, "r");
  return {
    read(len) {
      const buf = Buffer.alloc(len);
      readSync(fd, buf, 0, len, position);
      return buf;
    },
    close() {
      closeSync(fd);
    },
  };
}

/** fetch a mic or coord if not already valid on disk */
async function ensure(kind, stem, dir) {
  const out = path.join(dir, `${stem}.${kind}`);
  if (kind === "mrc" && micIsReal(out)) return false;
  if (kind === "coord" && existsSync(out) && statSync(out).size > 100) return false;
  log(`fetching ${stem}.${kind} …`);
  await fetchTo(`${BASE}/${stem}.${kind}`, out, kind === "mrc" ? MIC_SIZE : 0);
  if (kind === "mrc" && !micIsReal(out)) {
    rmSync(out, { force: true });
    throw new Error(`${stem}.mrc failed the identity law after download`);
  }
  return true;
}

/** hardlink stage for the mirror; falls back to copy across devices */
function stageInto(src, dst) {
  try {
    linkSync(src, dst);
  } catch (e) {
    if (e.code === "EEXIST") return;
    if (e.code === "EXDEV") copyFileSync(src, dst);
    else throw e;
  }
}

async function main() {
  const t0 = Date.now();
  const have = existsSync(HOME_DIR)
    ? readdirSync(HOME_DIR).filter((f) => f.endsWith(".mrc")).length
    : 0;
  const allReal =
    have === 10 && STEMS.every((s) => micIsReal(path.join(HOME_DIR, `${s}.mrc`)));
  if (allReal && MIRROR_STEMS.every((s) => existsSync(path.join(MIRROR, "micrographs", `${s}.mrc`)))) {
    log("real data already in place (10 home + 8 mirror) — nothing to seed");
  } else {
    log(`home dir has ${have} mrc(s); restoring the REAL set (10 mics + 10 coords)`);
    spawnSync("mkdir", ["-p", HOME_DIR]);
    for (const s of STEMS) {
      await ensure("coord", s, HOME_DIR);
      await ensure("mrc", s, HOME_DIR);
    }
  }

  // mirror: EXACTLY 8+8 — clean the directories first so the count asserts hold
  spawnSync("mkdir", ["-p", path.join(MIRROR, "micrographs"), path.join(MIRROR, "coords")]);
  for (const d of ["micrographs", "coords"]) {
    for (const f of readdirSync(path.join(MIRROR, d))) {
      rmSync(path.join(MIRROR, d, f), { force: true });
    }
  }
  for (const s of MIRROR_STEMS) {
    stageInto(path.join(HOME_DIR, `${s}.mrc`), path.join(MIRROR, "micrographs", `${s}.mrc`));
    stageInto(path.join(HOME_DIR, `${s}.coord`), path.join(MIRROR, "coords", `${s}.coord`));
  }

  // retire the t526 stand-ins — only now that the real set stands verified
  let retired = 0;
  for (const f of readdirSync(HOME_DIR)) {
    if (/^Falcon_2012_06_12-14\.33\.35_\d{3}\.mrc$/.test(f)) {
      rmSync(path.join(HOME_DIR, f), { force: true });
      retired++;
    }
  }

  const mics = readdirSync(path.join(MIRROR, "micrographs")).length;
  const coords = readdirSync(path.join(MIRROR, "coords")).length;
  log(`mirror staged: ${mics} mics + ${coords} coords (assert target: 8+8)`);
  log(`retired ${retired} synthetic stand-in(s) from ${HOME_DIR}`);
  log(`done in ${((Date.now() - t0) / 1000).toFixed(0)}s — REAL EMPIAR-10017 restored`);
  if (mics !== 8 || coords !== 8) {
    console.error("[t527-seed] MIRROR COUNT WRONG — diag-t380 will refuse");
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(`[t527-seed] FAILED: ${e.message}`);
  console.error("[t527-seed] fallback law: node scripts/qa-t526-empiar-seed.mjs restores the synthetic chain (fidelity exam stays honestly red)");
  process.exit(1);
});

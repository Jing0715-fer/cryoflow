#!/usr/bin/env node
// t526 — EMPIAR fixture rebuilder. The real /home/z/empiar-10017 (10 raw
// micrographs + Henderson coords, 641MB, untracked) was annihilated by a
// sandbox reset (t520 witnessed the loss; t525 recorded it in
// _legacy-archive/README.md) — and this window bit the FIRST live consumer:
// t415's honest-fail fixture died at `EMPIAR directory not found`.
//
// t527 — SUPERSEDED AS THE PRIMARY LAW: the real data is back (EBI
// bandwidth recovered ~40×), restored by scripts/qa-t527-empiar-real-seed.mjs
// (bash twin: scripts/t527-fetch-empiar.sh). This seeder remains the
// documented FALLBACK for a 16 KB/s world — it restores the fixture CHAIN
// (import/motioncorr/strip lanes) but can never satisfy the fidelity exam:
// diag-t380's reality probe reads the float bytes and grades synthetic
// contrast as what it is.
//
// The import lane's contract (engine.ts:3028) needs only: a directory of
// *.mrc files. It sorts names and writes the STAR — no content checksum,
// no fidelity gate (fidelity is diag-t380's separate job). So a seeded set
// of header-legal float32 mrcs restores the fixture CHAIN honestly: same
// file count as the real set (10), same extension contract, synthetic
// pixels marked as synthetic in the header's unused label field.
//
// Re-run any time a sandbox reset eats the directory. Idempotent: skips
// when the files are already present.
import { mkdirSync, existsSync, writeFileSync, readdirSync } from "node:fs";

const DIR = "/home/z/empiar-10017/micrographs";
const COUNT = 10;
const NX = 256;
const NY = 256;

if (existsSync(DIR) && readdirSync(DIR).filter((f) => f.endsWith(".mrc")).length >= COUNT) {
  console.log("empiar fixture already present — nothing to seed");
  process.exit(0);
}
mkdirSync(DIR, { recursive: true });

// mrc 2014 header (1024 bytes): nx,ny,nz @0-8 int32, mode @12 (2 = float32),
// mx,my,mz @16-24, cella @28-36 (float, angstrom), dmin/dmax @40/48,
// label @224. Deterministic blob: a sine sweep + per-file phase so PNG
// previews (if any suite renders them) differ per micrograph.
const buf = Buffer.alloc(1024 + NX * NY * 4);
buf.writeInt32LE(NX, 0);
buf.writeInt32LE(NY, 4);
buf.writeInt32LE(1, 8); // nz: single image (micrograph, not a stack)
buf.writeInt32LE(2, 12); // mode 2 = 32-bit float
buf.writeInt32LE(NX, 16);
buf.writeInt32LE(NY, 20);
buf.writeInt32LE(1, 24);
buf.writeFloatLE(NX * 1.24, 28); // cella.x (≈1.24 Å/px, EMPIAR 10017-ish)
buf.writeFloatLE(NY * 1.24, 32);
buf.writeFloatLE(1.24, 36);
buf.writeFloatLE(-1, 40);
buf.writeFloatLE(1, 48);
buf.write("t526 synthetic fixture — real data lost to a sandbox reset (see _legacy-archive/README.md)", 224);

for (let i = 0; i < COUNT; i++) {
  const phase = (i * 0.7) % (2 * Math.PI);
  for (let y = 0; y < NY; y++) {
    for (let x = 0; x < NX; x++) {
      const v =
        0.5 +
        0.3 * Math.sin((x / NX) * 8 * Math.PI + phase) * Math.cos((y / NY) * 6 * Math.PI) +
        0.1 * Math.sin((x + y) / 7.0 + i);
      buf.writeFloatLE(v, 1024 + (y * NX + x) * 4);
    }
  }
  writeFileSync(`${DIR}/Falcon_2012_06_12-14.33.35_${String(i + 1).padStart(3, "0")}.mrc`, buf);
}
console.log(`seeded ${COUNT} synthetic micrographs -> ${DIR}`);

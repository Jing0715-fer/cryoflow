#!/usr/bin/env node
// t382 — crop the five real EMPIAR-10017 micrographs to 1024² (still REAL
// pixels, 1/16 the LoG memory) so the E2E fits the 4GB sandbox next to
// next-server. Originals stay untouched for the other suites.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";

const SRC = "/home/z/cryoflow/services/mock-cluster/fs/data2/empiar10017/data";
const DST = "/home/z/cryoflow/services/mock-cluster/fs/data2/empiar10017/crop1024";
mkdirSync(DST, { recursive: true });

const files = readdirSync(SRC).filter((f) => f.endsWith(".mrc"));
const N = 1024;
for (const f of files) {
  const buf = readFileSync(`${SRC}/${f}`);
  const nx = buf.readInt32LE(0), ny = buf.readInt32LE(4);
  if (nx !== 4096 || ny !== 4096) { console.log(`skip ${f} (${nx}×${ny})`); continue; }
  // center crop
  const x0 = (nx - N) >> 1, y0 = (ny - N) >> 1;
  const out = Buffer.alloc(1024 + N * N * 4);
  const header = buf.subarray(0, 1024);
  header.copy(out, 0);
  out.writeInt32LE(N, 0); out.writeInt32LE(N, 4); out.writeInt32LE(1, 8);
  for (let y = 0; y < N; y++) {
    buf.copy(out, 1024 + y * N * 4, 1024 + (y0 + y) * nx * 4 + x0 * 4, 1024 + (y0 + y) * nx * 4 + (x0 + N) * 4);
  }
  writeFileSync(`${DST}/${f}`, out);
  console.log(`cropped ${f} → 1024² (${(out.length / 1e6).toFixed(1)} MB)`);
}
console.log("done");

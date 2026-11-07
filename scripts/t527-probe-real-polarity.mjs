#!/usr/bin/env node
// t527-probe — measure the REAL Falcon bytes where the exam's proxies are:
// (a) at the Henderson coord positions vs their LOCAL background (a ring at
//     2-3× the particle radius) — the honest "particle vs ice" pair;
// (b) border (the exam's ice proxy) vs global mean — is the proxy still ice?
// Reads the mrc directly (4096² float32, 1024-byte header).
import { openSync, readSync, closeSync, statSync } from "node:fs";
import { readFileSync } from "node:fs";

const DIR = "/home/z/empiar-10017/micrographs";
const mic = process.argv[2] ?? "Falcon_2012_06_12-14_33_35_0";
const p = `${DIR}/${mic}.mrc`;

const fd = openSync(p, "r");
const hdr = Buffer.alloc(1024);
readSync(fd, hdr, 0, 1024, 0);
const nx = hdr.readInt32LE(0);
const ny = hdr.readInt32LE(4);
console.log(`mic ${mic}: nx=${nx} ny=${ny} size=${statSync(p).size}`);

const coords = readFileSync(`${DIR}/${mic}.coord`, "utf8")
  .trim()
  .split("\n")
  .map((l) => l.trim().split(/\s+/).map(Number));
console.log(`coords: ${coords.length} picks`);

const ROW = nx * 4;
const readRow = (y) => {
  const buf = Buffer.alloc(ROW);
  readSync(fd, buf, 0, ROW, 1024 + y * ROW);
  return buf;
};

// cache the whole image in float64 rows lazily (4096² × 4B = 67MB fine)
const img = new Float32Array(nx * ny);
for (let y = 0; y < ny; y++) {
  const buf = readRow(y);
  for (let x = 0; x < nx; x++) img[y * nx + x] = buf.readFloatLE(x * 4);
}
closeSync(fd);

const at = (x, y) => img[Math.min(ny - 1, Math.max(0, y | 0)) * nx + Math.min(nx - 1, Math.max(0, x | 0))];
const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

// global stats
const globalMean = mean(Array.from(img).filter((_, i) => i % 97 === 0));
const border = [];
for (let i = 0; i < nx; i += 8) {
  border.push(at(i, 0), at(i, ny - 1), at(0, i), at(nx - 1, i));
}
console.log(`global mean ≈ ${globalMean.toFixed(1)} | border mean = ${mean(border).toFixed(1)} (${((mean(border) / globalMean - 1) * 100).toFixed(1)}% vs global)`);

// per-pick: particle disk (r=51 ≈ 180Å at 1.77Å/px... actually 90px radius) vs LOCAL ring (r 130..180)
const SIG = 51; // particle radius ~90px diameter per suite LoG (120-180Å)
let darker = 0;
let brighter = 0;
const ratios = [];
for (const [cx, cy] of coords) {
  const disk = [];
  for (let dy = -SIG; dy <= SIG; dy += 4)
    for (let dx = -SIG; dx <= SIG; dx += 4)
      if (dx * dx + dy * dy <= SIG * SIG) disk.push(at(cx + dx, cy + dy));
  const ring = [];
  for (let dy = -SIG * 3; dy <= SIG * 3; dy += 4)
    for (let dx = -SIG * 3; dx <= SIG * 3; dx += 4) {
      const r = Math.hypot(dx, dy);
      if (r >= SIG * 2 && r <= SIG * 3) ring.push(at(cx + dx, cy + dy));
    }
  const pd = mean(disk);
  const ld = mean(ring);
  const ratio = ld / pd; // local-ice / particle — >1 = particle darker (cryo truth)
  ratios.push(ratio);
  if (pd < ld) darker++;
  else brighter++;
}
console.log(`picks: ${darker} DARKER than local ice, ${brighter} brighter (of ${coords.length})`);
console.log(`local-ice/particle ratio: median=${ratios.sort((a, b) => a - b)[Math.floor(ratios.length / 2)].toFixed(3)} min=${ratios[0].toFixed(3)} max=${ratios[ratios.length - 1].toFixed(3)}`);

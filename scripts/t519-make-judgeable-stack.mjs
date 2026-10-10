/**
 * t519 — synthesize a JUDGEABLE 12-class stack (64x64, mode-2 float MRCs).
 *
 * The mock cluster paints pure noise blobs — the real VLM correctly rejects
 * all 12 (that WAS the t513 rubric working). But the field test needs a
 * sheet with genuinely distinguishable classes to exercise every rubric
 * branch: keep / maybe / each junk signature.
 *
 * Class design (evidence the rubric demands, painted with real structure):
 *   1  good view A  — round envelope, two domain lobes, central groove
 *   2  ice          — sharp hexagonal bright patch
 *   3  edge artifact— density pushed against / cut by the box border
 *   4  good view B  — elongated, rod densities (alpha-helix feel)
 *   5  carbon film  — straight hard edge + thick bar
 *   6  empty        — uniform noise, no particle
 *   7  good view C  — triangular, three separated domain lobes
 *   8  blob         — particle-sized mass, NO internal detail, soft edges
 *   9  aggregate    — irregular clump clearly larger than the particle
 *  10  zebra stripes— periodic banding (drift/charging)
 *  11  weak good    — view A at 3x lower contrast (the maybe case)
 *  12  duplicate    — view A blurred (same view, keep only the sharper)
 *
 * Replaces run_it200_classes.mrcs in the seeded mirror (the judge reads
 * local mirror first). Occupancies in run_it200_data.star are redistributed
 * so the numbers riding the image are realistic (good classes carry the
 * mass, junk classes starve).
 */
import { readFileSync, writeFileSync } from "node:fs";

const N = 64;
const CLASSES = 12;
const OUT = process.argv[2] ?? "data/relion/cmuoc66gl000eok6nplid8vmm/class2d_6kau3twp/run_it200_classes.mrcs";
const DATA_STAR = OUT.replace("run_it200_classes.mrcs", "run_it200_data.star");

/* tiny PRNG (deterministic) */
let seed = 42;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

const grid = () => Array.from({ length: N }, () => new Float64Array(N));
const addGauss = (g, cx, cy, sigma, amp) => {
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const d2 = (x - cx) ** 2 + (y - cy) ** 2;
      g[y][x] += amp * Math.exp(-d2 / (2 * sigma * sigma));
    }
};
const noiseFloor = (g, level) => {
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) g[y][x] += (rnd() - 0.5) * level;
};
const normalize = (g) => {
  let mn = Infinity, mx = -Infinity;
  for (const row of g) for (const v of row) { if (v < mn) mn = v; if (v > mx) mx = v; }
  const span = mx - mn || 1;
  for (const row of g) for (let x = 0; x < N; x++) row[x] = (row[x] - mn) / span;
};

/* --- the good molecule: two lobes + groove, sharp-ish boundary --- */
function goodViewA(contrast = 1) {
  const g = grid();
  addGauss(g, 32, 26, 7.5, 1.0 * contrast);   // upper lobe
  addGauss(g, 32, 39, 6.5, 0.85 * contrast);  // lower lobe
  // groove: carve a low-density channel between lobes
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const d = Math.abs(y - 32.5);
      if (Math.abs(x - 32) < 9 && d < 3.2) g[y][x] *= 0.35;
    }
  // internal speckle structure (organized, follows shape)
  for (let i = 0; i < 90; i++) {
    const a = rnd() * Math.PI * 2, r = rnd() * 11;
    const x = Math.round(32 + Math.cos(a) * r * 0.8);
    const y = Math.round(32.5 + Math.sin(a) * r);
    if (x > 0 && x < N && y > 0 && y < N) g[y][x] += 0.16 * contrast * rnd();
  }
  noiseFloor(g, 0.22);
  normalize(g);
  return g;
}

function goodViewB() {
  const g = grid();
  addGauss(g, 32, 32, 11, 0.9); // elongated envelope base
  // rod densities (alpha-helix feel): three parallel bright rods
  for (const dy of [-5, 0, 5])
    for (let y = 14; y < 50; y++)
      for (let x = 20; x < 45; x++) {
        const d = Math.abs(y - (32 + dy));
        if (d < 2.2) g[y][x] += 0.5 * Math.exp(-((x - 32) ** 2) / (2 * 8 * 8));
      }
  noiseFloor(g, 0.22);
  normalize(g);
  return g;
}

function goodViewC() {
  const g = grid();
  // three separated domain lobes (triangular arrangement)
  addGauss(g, 32, 22, 5.5, 1.0);
  addGauss(g, 22, 41, 5.0, 0.9);
  addGauss(g, 42, 41, 5.0, 0.9);
  for (let i = 0; i < 70; i++) {
    const cx = [32, 22, 42][Math.floor(rnd() * 3)];
    const cy = [22, 41, 41][Math.floor(rnd() * 3)];
    const x = Math.round(cx + (rnd() - 0.5) * 8), y = Math.round(cy + (rnd() - 0.5) * 8);
    if (x > 0 && x < N && y > 0 && y < N) g[y][x] += 0.14 * rnd();
  }
  noiseFloor(g, 0.22);
  normalize(g);
  return g;
}

const frames = [];
frames[0] = goodViewA();
// ice: sharp-edged hexagonal bright patch
{
  const g = grid();
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      // hexagon centered 30,32 radius 16
      const dx = Math.abs(x - 30), dy = Math.abs(y - 32);
      const hex = dx * 0.866 + dy * 0.5 <= 15;
      if (hex) g[y][x] += 0.95;
    }
  noiseFloor(g, 0.3);
  normalize(g);
  frames[1] = g;
}
// edge artifact: particle cut by the border
{
  const g = grid();
  addGauss(g, 6, 32, 8, 1.0); // hugs the left border
  addGauss(g, 58, 20, 6, 0.8); // second one at top-right corner
  noiseFloor(g, 0.25);
  normalize(g);
  frames[2] = g;
}
frames[3] = goodViewB();
// carbon: straight hard edge + thick bar
{
  const g = grid();
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (x + y < 46) g[y][x] += 0.85; // diagonal hard edge
      if (Math.abs(y - 44) < 3.5 && x > 8 && x < 56) g[y][x] += 0.7; // thick bar
    }
  }
  noiseFloor(g, 0.25);
  normalize(g);
  frames[4] = g;
}
// empty: pure noise
{
  const g = grid();
  noiseFloor(g, 1.0);
  normalize(g);
  frames[5] = g;
}
frames[6] = goodViewC();
// featureless blob: big soft mass, no interior, soft edges
{
  const g = grid();
  addGauss(g, 32, 32, 13, 1.0);
  noiseFloor(g, 0.18);
  normalize(g);
  frames[7] = g;
}
// aggregate: irregular clump, clearly larger than the good classes
{
  const g = grid();
  addGauss(g, 28, 30, 10, 1.0);
  addGauss(g, 40, 24, 7, 0.9);
  addGauss(g, 36, 42, 8, 0.95);
  addGauss(g, 22, 42, 5, 0.7);
  noiseFloor(g, 0.25);
  normalize(g);
  frames[8] = g;
}
// zebra stripes
{
  const g = grid();
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) g[y][x] += 0.5 + 0.5 * Math.sin((x + y * 0.35) * 0.85);
  noiseFloor(g, 0.12);
  normalize(g);
  frames[9] = g;
}
// weak good (low contrast view A)
{
  const g = goodViewA(0.34);
  noiseFloor(g, 0.55);
  normalize(g);
  frames[10] = g;
}
// duplicate of view A, blurred (same view, softer)
{
  const src = goodViewA();
  const g = grid();
  const k = 1.6; // blur radius
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let s = 0, w = 0;
      for (let dy = -3; dy <= 3; dy++)
        for (let dx = -3; dx <= 3; dx++) {
          const yy = y + dy, xx = x + dx;
          if (yy < 0 || yy >= N || xx < 0 || xx >= N) continue;
          const wgt = Math.exp(-(dx * dx + dy * dy) / (2 * k * k));
          s += src[yy][xx] * wgt; w += wgt;
        }
      g[y][x] = s / w;
    }
  noiseFloor(g, 0.5);
  normalize(g);
  frames[11] = g;
}

/* --- write the MRC stack (mode 2, LE float32) --- */
const header = Buffer.alloc(1024);
header.writeInt32LE(N, 0);      // nx
header.writeInt32LE(N, 4);      // ny
header.writeInt32LE(CLASSES, 8); // nz = frames
header.writeInt32LE(2, 12);     // mode float32
header.writeInt32LE(1, 16);     // nxstart
header.writeInt32LE(1, 20);     // nystart
header.writeInt32LE(0, 24);     // nzstart
header.writeInt32LE(N, 28);     // mx
header.writeInt32LE(N, 32);     // my
header.writeInt32LE(CLASSES, 36); // mz
header.writeFloatLE(1.0, 40);   // xlen
header.writeFloatLE(1.0, 44);   // ylen
header.writeFloatLE(1.0, 48);   // zlen
header.writeInt32LE(0, 56);     // ispg
header.writeInt32LE(0, 92);     // nlabl
const body = Buffer.alloc(N * N * CLASSES * 4);
let off = 0;
for (const f of frames)
  for (const row of f)
    for (const v of row) {
      body.writeFloatLE(Math.max(0, Math.min(1, v)), off);
      off += 4;
    }
writeFileSync(OUT, Buffer.concat([header, body]));
console.log(`stack written: ${OUT} (${(1024 + body.length)} bytes, ${CLASSES} classes of ${N}x${N})`);

/* --- redistribute occupancies in the data star (realistic masses) --- */
if (DATA_STAR.endsWith("run_it200_data.star")) {
  const raw = readFileSync(DATA_STAR, "utf8");
  // per-class particle masses: good classes carry, junk starve (24 total)
  const masses = { 1: 5, 2: 1, 3: 1, 4: 4, 5: 1, 6: 1, 7: 3, 8: 2, 9: 1, 10: 1, 11: 2, 12: 2 };
  let assigned = 0;
  const clsOrder = [];
  for (const [c, m] of Object.entries(masses)) { clsOrder.push(...Array(m).fill(Number(c))); assigned += m; }
  let i = 0;
  const out = raw.replace(/^(\d+@\S+)(\s+)(\d+)(.*)$/gm,
    (m0, img, sp, cls, rest) => {
    const next = clsOrder[i % clsOrder.length]; i++;
    return `${img}${sp}${next}${rest}`;
    }
  );
  writeFileSync(DATA_STAR, out);
  console.log(`data.star occupancies redistributed (${i} rows)`);
}

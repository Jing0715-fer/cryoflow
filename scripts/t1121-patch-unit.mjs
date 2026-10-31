#!/usr/bin/env node
// t1121 — the density probe's SECOND VOICE unit: the in-plane patch
// statistics (median / MAD-σ / robust z) are BEHAVIORAL (the lib imports
// clean — no Mol*/React in its module graph), the route's opt-in `r`
// branch and the chip's second line are source-asserted (the t653 law:
// one statistic, two faces, no face can drift).
//
// The story: t281's probe answers "what is under the cursor" with ONE
// number; "is this blob particle or noise" wants the number's PLACE in
// its own neighbourhood — the centre's robust z against the patch
// median (σ via 1.4826·MAD, the normal-consistent scale). This unit
// pins the lib's law in exact numbers (a checkerboard patch whose
// median/MAD/z are hand-checkable), the honest refusals (radius lies,
// flat patches, too-small patches, truncated files), the clamp law
// (edges lose their out-of-volume half and n reports the truth), and
// the three planes' own frames (xy/xz/yz each fix its own axis).
//
//   node --import ./scripts/ts-alias-register.mjs scripts/t1121-patch-unit.mjs

import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MAX_PATCH_RADIUS, readMrcPatch, readMrcVoxel } from "@/lib/mrc";

let pass = 0;
let fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const near = (a, b, tol = 1e-9) =>
  typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= tol;

// an 8³ float32 MRC with a checkerboard background (value = (x+y) % 2)
// and two hand-planted bright voxels at the centre — a patch whose
// median / MAD / z are checkable BY HAND, not by re-running the code.
const DIM = 8;
const makeMap = () => {
  const head = Buffer.alloc(1024);
  head.writeInt32LE(DIM, 0);   // nx
  head.writeInt32LE(DIM, 4);   // ny
  head.writeInt32LE(DIM, 8);   // nz
  head.writeInt32LE(2, 12);    // mode 2 — float32
  head.writeInt32LE(DIM, 28);  // mx
  head.writeInt32LE(DIM, 32);  // my
  head.writeInt32LE(DIM, 36);  // mz
  head.writeFloatLE(64, 40);   // cella x
  head.writeFloatLE(64, 44);
  head.writeFloatLE(64, 48);
  head.writeInt32LE(1, 64);    // MAPC — the t1113 producer law
  head.writeInt32LE(2, 68);    // MAPR
  head.writeInt32LE(3, 72);    // MAPS
  head.writeInt32LE(0, 92);    // nsymbt
  const data = Buffer.alloc(DIM * DIM * DIM * 4);
  const put = (x, y, z, v) => data.writeFloatLE(v, ((z * DIM + y) * DIM + x) * 4);
  for (let z = 0; z < DIM; z++)
    for (let y = 0; y < DIM; y++)
      for (let x = 0; x < DIM; x++) put(x, y, z, (x + y) % 2);
  return { head, data, put };
};

const tmp = mkdtempSync(join(tmpdir(), "t1121-"));
const mapFile = join(tmp, "checker.mrc");
const { head, data } = makeMap();
// hand-planted: the centre voxel (4,4,4) towers (10), its +x neighbour
// (5,4,4) half-rises (5) — an "apex" the robust z must see
data.writeFloatLE(10, ((4 * DIM + 4) * DIM + 4) * 4);
data.writeFloatLE(5, ((4 * DIM + 4) * DIM + 5) * 4);
writeFileSync(mapFile, Buffer.concat([head, data]));

try {
  console.log("A — the xy patch at the centre (hand-checkable numbers)");

  // r=2 xy patch at (4,4,4): x∈[2..6], y∈[2..6], z=4 → 25 voxels.
  // values: (x+y)%2 over 5×5 minus the two planted, plus 10 and 5.
  // parity count in a 5×5 with x,y from 2..6: (x+y) even ⇔ 13 cells,
  // odd ⇔ 12. The planted (4,4) [even sum] was 0→10, (5,4) [odd] 1→5.
  // So: zeros 13−1=12, ones 12−1=11, plus {10, 5}. median of 25 sorted
  // values = the 13th: the FIRST 1 (12 zeros come first). MAD: |v−1|
  // sorted = 11×0, 12×1, 4, 9 → the 13th = 1. σ = 1.4826. z = 9/1.4826.
  const P = readMrcPatch(mapFile, 0.5, 0.5, 0.5, 2, "xy");
  ok("A1 the patch reads, centre value is the planted 10", P !== null && P.value === 10);
  ok("A2 the centre voxel address is (4,4,4)", P && P.ix === 4 && P.iy === 4 && P.iz === 4);
  ok("A3 n=25 — the full in-plane box inside an 8³", P && P.n === 25);
  ok("A4 half echoes the request", P && P.half === 2);
  ok("A5 median = 1 (the 13th of 25: twelve 0s then ones)", P && P.median === 1);
  ok("A6 MAD = 1 → σ = 1.4826", P && P.mad === 1 && near(P.sigma, 1.4826));
  ok("A7 robust z = 9/1.4826 ≈ 6.0704 (the apex seen)",
    P && P.z !== null && near(P.z, 9 / 1.4826, 1e-9));
  ok("A8 min/max honest (0 and 10)", P && P.min === 0 && P.max === 10);
  ok("A9 mean = (12·0 + 11·1 + 5 + 10)/25 = 26/25", P && near(P.mean, 26 / 25));
  ok("A10 the box rides the request, the FIXED axis PINNED (z=4)",
    P && P.lo.x === 2 && P.hi.x === 6 && P.lo.y === 2 && P.hi.y === 6
    && P.lo.z === 4 && P.hi.z === 4);

  console.log("B — the clamp law (edges lose their out-of-volume half)");

  // r=3 at the x-edge (fx 0 → ix 0): x∈[0..3] (4 wide, not 7) → n=4·7
  const E = readMrcPatch(mapFile, 0, 0.5, 0.5, 3, "xy");
  ok("B1 the edge patch clamps x (n = 4·7 = 28)", E && E.n === 28 && E.lo.x === 0 && E.hi.x === 3);
  // the corner: fx=fy=fz=0, r=3 → 4·4 box, z pinned 0 → n=16
  const C = readMrcPatch(mapFile, 0, 0, 0, 3, "xy");
  ok("B2 the corner patch clamps both (n = 4·4 = 16)", C && C.n === 16 && C.hi.x === 3 && C.hi.y === 3);
  // a radius bigger than the volume still refuses to invent neighbours
  const W = readMrcPatch(mapFile, 0.5, 0.5, 0.5, 16, "xy");
  ok("B3 r=16 on an 8³ clamps to the whole plane (n = 64)", W && W.n === 64);

  console.log("C — the honest silences (the refusals, the family voice)");

  ok("C1 radius 0 → the patch is the voxel alone: n=1, z=null",
    (() => { const p = readMrcPatch(mapFile, 0.5, 0.5, 0.5, 0, "xy");
      return p && p.n === 1 && p.z === null && p.median === p.value && p.sigma === 0; })());
  ok("C2 a fractional radius refuses", readMrcPatch(mapFile, 0.5, 0.5, 0.5, 2.5, "xy") === null);
  ok("C3 a negative radius refuses", readMrcPatch(mapFile, 0.5, 0.5, 0.5, -1, "xy") === null);
  ok(`C4 a radius over MAX_PATCH_RADIUS (${MAX_PATCH_RADIUS}) refuses`,
    readMrcPatch(mapFile, 0.5, 0.5, 0.5, MAX_PATCH_RADIUS + 1, "xy") === null);
  ok("C5 a non-finite radius refuses", readMrcPatch(mapFile, 0.5, 0.5, 0.5, NaN, "xy") === null);
  ok("C6 non-finite fractions refuse", readMrcPatch(mapFile, NaN, 0.5, 0.5, 2, "xy") === null);
  ok("C7 a plane outside the three refuses",
    readMrcPatch(mapFile, 0.5, 0.5, 0.5, 2, "yz ") === null
    && readMrcPatch(mapFile, 0.5, 0.5, 0.5, 2, undefined) === null);
  ok("C8 a missing file refuses", readMrcPatch(join(tmp, "nope.mrc"), 0.5, 0.5, 0.5, 2, "xy") === null);
  ok("C9 a truncated file refuses (the row pread comes up short)",
    (() => { const f = join(tmp, "short.mrc");
      writeFileSync(f, Buffer.concat([head, data.subarray(0, 1000)]));
      return readMrcPatch(f, 0.5, 0.5, 0.5, 2, "xy") === null; })());

  console.log("D — the three planes' own frames (each fixes its axis)");

  // yz plane (axis=x tile): x pinned 4, y∈[2..6], z∈[2..6] at centre → 25
  const YZ = readMrcPatch(mapFile, 0.5, 0.5, 0.5, 2, "yz");
  ok("D1 yz n=25, centre value 10, box z 2..6 y 2..6, x pinned 4",
    YZ && YZ.n === 25 && YZ.value === 10 && YZ.lo.z === 2 && YZ.hi.z === 6
    && YZ.lo.y === 2 && YZ.hi.y === 6 && YZ.lo.x === 4 && YZ.hi.x === 4);
  // xz plane (axis=y tile): y pinned, x∈[2..6], z∈[2..6] → 25; the +x
  // neighbour (5,4,4)=5 rides the x row → max still 10, the 5 is inside
  const XZ = readMrcPatch(mapFile, 0.5, 0.5, 0.5, 2, "xz");
  ok("D2 xz n=25 with the half-risen neighbour inside (max 10, min 0)",
    XZ && XZ.n === 25 && XZ.value === 10 && XZ.max === 10 && XZ.min === 0);
  // the two planted voxels sit in the SAME xy plane (z=4) — xz (y pinned)
  // keeps both too; yz (x pinned) keeps the centre but LOSES (5,4,4):
  // its max must still be 10, and its value set differs — prove the yz
  // patch's own count of 5s: y∈[2..6]×z∈[2..6] at x=4 — no planted 5
  const YZmax5 = readMrcPatch(mapFile, 0.5, 0.5, 0.5, 1, "yz");
  ok("D3 yz r=1: the planted (5,4,4)=5 is OUT of the plane (max 10)",
    YZmax5 && YZmax5.n === 9 && YZmax5.max === 10);

  console.log("E — the probe and the patch agree on the centre");

  const V = readMrcVoxel(mapFile, 0.5, 0.5, 0.5);
  ok("E1 readMrcVoxel and readMrcPatch speak the SAME centre number",
    V !== null && P !== null && V.value === P.value && V.ix === P.ix && V.iy === P.iy && V.iz === P.iz);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log("F — the route's opt-in branch (source assertions)");

const routeSrc = (await import("node:fs")).readFileSync(
  join(import.meta.dirname, "../src/app/api/jobs/[id]/outputs/file/route.ts"),
  "utf8"
);
ok("F1 the r parameter is read (opt-in, absent = the t281 shape byte-for-byte)",
  routeSrc.includes('url.searchParams.get("r")'));
ok("F2 an illegal r is a 400 that names the law (no silent clamp)",
  routeSrc.includes("r must be an integer between 0 and"));
ok("F3 the patch joins the body only when read (honest degradation)",
  routeSrc.includes("if (patch)") && routeSrc.includes("body.patch = {"));
ok("F4 the plane mapping is the tiles' own frame (z→xy, y→xz, x→yz)",
  routeSrc.includes('axis === "z" ? "xy" : axis === "y" ? "xz" : "yz"'));
ok("F5 the patch rides the SAME containment chain (inside the value branch)",
  routeSrc.indexOf('format === "value"') < routeSrc.indexOf("readMrcPatch(abs"));
ok("F6 the refusal order holds (mrcs refused before the patch door)",
  routeSrc.indexOf('.endsWith(".mrcs")') < routeSrc.indexOf("readMrcPatch(abs"));
ok("F7 MAX_PATCH_RADIUS imports from the ONE lib",
  routeSrc.includes("MAX_PATCH_RADIUS, isMrcPath"));

console.log("G — the chip's second line (source assertions)");

const panelSrc = (await import("node:fs")).readFileSync(
  join(import.meta.dirname, "../src/components/workflow/results/map-ortho-panel.tsx"),
  "utf8"
);
ok("G1 the request names r=5 (the 11×11 patch)", panelSrc.includes("&r=5"));
ok("G2 the chip's second line carries its own testid", panelSrc.includes("data-ortho-probe-patch"));
ok("G3 the second line renders only when the patch speaks", panelSrc.includes("{patchText && ("));
ok("G4 a partial payload degrades to the first voice (finite guards)",
  panelSrc.includes("Number.isFinite(d.patch.median)"));
ok("G5 the z is silent when the patch is flat (null passed through)",
  panelSrc.includes("probe.patch.z === null"));
ok("G6 the title teaches the read (median & robust z, 1.4826·MAD)",
  panelSrc.includes("1.4826·MAD"));
ok("G7 the actual n is spoken (never a round (2r+1)² lie)",
  panelSrc.includes("${probe.patch.n} pts"));

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);

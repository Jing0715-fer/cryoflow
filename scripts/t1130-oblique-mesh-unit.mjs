#!/usr/bin/env node
/**
 * t1130 — the OBLIQUE-SHEET MESH unit: the cut's face gets PIXELS.
 *
 * THE FEATURE (this window's main act): the t1129 face rode Mol*'s slice
 * mode 'plane' — an experimental path mol* itself never uses (zero usages
 * in the package) — and the GL side silently dropped it: the node mounted,
 * the render object said visible, the textures were full, the screen
 * showed nothing (the t1129 render diagnosis; the offline experiment
 * proved the DATA path healthy, the GL side guilty). The t1130 pivot:
 * the face is now a DENSITY MESH — a lattice mosaic of flat gray quads ON
 * the cut plane, built in the lib (voxel-voice, the t1122 patchBoxRect
 * precedent), wrapped into a mol* Shape (one GROUP per gray band — the
 * shape-group theme reads Shape.getColor, so the bands ARE the colors),
 * and applied through a custom SO.Root → SO.Shape.Provider transform
 * whose PARAMS CARRY THE GEOMETRY (BoxShape3D's own pattern — no slots,
 * no hidden state; the rev bump drives Recreate).
 *
 * THE LAWS (what this unit pins):
 *  - the tile stretch: the face wears the SAME 2–98 percentile window the
 *    ortho tiles speak (densityWindow — the mrc.ts makeGrayPng law's
 *    client twin, strided to ≤65536 reads, NaN cells skipped);
 *  - one geometry father: the lattice lives over the guide's own plane∩box
 *    polygon (buildObliqueGuidePlane's world-space trace) around the cut's
 *    own anchor (buildObliqueSheetPlane's point) — a cut and its face can
 *    never disagree about where the plane sits;
 *  - the winding: u×v = n by construction (the least-aligned world axis
 *    swings into the plane), so every quad's triangles face +n;
 *  - the honest membership: a quad is kept iff its centroid lies inside
 *    the convex trace (cross-product same-side), a NaN sample (outside
 *    the grid — the sampler's honesty) drops the quad, an empty lattice
 *    keeps the honest no-face (null, never a guessed sheet);
 *  - the σ-independence: the contour slider cuts the SURFACE, the face
 *    wears the FIELD — the pumpSheet seen-set no longer tracks σ/sign and
 *    the t1129 shared-threshold effect is retired;
 *  - the band quantization: K bands over the window, band = floor(t·K)
 *    clamped, band center = the gray ramp's own value, one shape group
 *    per band;
 *  - the wiring: the embed imports the lib's words, the transform's
 *    params carry the geometry (PD.Value), the repr child rides
 *    ShapeRepresentation3D, the retirement law (no cut → no face) is
 *    byte-identical, the ▣ title speaks the mesh division (the lib's
 *    OBLIQUE_SHEET_FACE_TITLE — the t1129 solvent-quiet confession
 *    retires with the isoLevel it confessed).
 *
 *   node --import ./scripts/ts-alias-register.mjs scripts/t1130-oblique-mesh-unit.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  OBLIQUE_SHEET_FACE_TITLE,
  buildObliqueSheetMesh,
  densityWindow,
} from "@/lib/voxel-voice";

const ROOT = path.resolve(import.meta.dirname, "..");
let pass = 0;
let fail = 0;
const ok = (cond, name) => {
  if (cond) {
    pass++;
    console.log(`ok ${pass} - ${name}`);
  } else {
    fail++;
    console.log(`NOT OK ${fail} - ${name}`);
  }
};
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

/* ===== A. densityWindow — the tile stretch law's client twin ===== */

{
  const lin = Array.from({ length: 100 }, (_, i) => i);
  const w = densityWindow({ cells: { data: lin } });
  ok(w !== null && near(w[0], 2) && near(w[1], 97), "A1 linear 0..99 → 2–98 percentile window (2, 97)");
}
{
  const withNan = Array.from({ length: 100 }, (_, i) => (i % 10 === 0 ? NaN : i));
  const w = densityWindow({ cells: { data: withNan } });
  // the filtered sample: 90 finite values [1..9, 11..19, …, 91..99];
  // pct(0.02) → idx round(0.02·89)=2 → 3; pct(0.98) → idx 87 → 97
  ok(w !== null && near(w[0], 3) && near(w[1], 97),
    "A2 NaN cells skipped — the honest window reads the 90 survivors (3, 97)");
}
{
  ok(densityWindow({ cells: { data: [1, 2, 3] } }) === null, "A3 <16 cells → null (no guessed window)");
  ok(densityWindow({ cells: {} }) === null, "A3b no data → null");
  ok(densityWindow(null) === null, "A3c null grid → null");
}
{
  ok(densityWindow({ cells: { data: new Array(64).fill(3.14) } }) === null,
    "A4 flat data (hi ≤ lo) → null (a constant window is no window)");
}
{
  const big = Array.from({ length: 262144 }, (_, i) => i);
  const w = densityWindow({ cells: { data: big } });
  ok(w !== null && w[0] === 5244 && w[1] === 256896,
    "A5 strided sample (262144 → 65536 reads, stride 4) keeps the exact percentiles (5244, 256896)");
}

/* ===== B. buildObliqueSheetMesh — hand-computed geometry ===== */

// the unit square trace, anchored at its center, +z normal
const SQUARE = [
  [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
];
const CENTER = [0.5, 0.5, 0];
const PZ = [0, 0, 1];

{
  const m = buildObliqueSheetMesh({
    polygon: SQUARE, point: CENTER, normal: PZ,
    sampler: () => 0.7, grayLo: 0, grayHi: 1, bands: 5, latticeN: 4,
  });
  ok(m !== null, "B1 unit square builds");
  ok(m.stats.kept === 16 && m.stats.dropped === 0 && m.stats.lattice === 16,
    "B1b full-square lattice: 16 quads kept, 0 dropped");
  ok(m.positions.length === 16 * 4 * 3 && m.indices.length === 16 * 2 * 3 && m.bandOfTri.length === 16 * 2,
    "B1c 64 vertices, 32 triangles, 32 band entries");
  const allBand3 = Array.from(m.bandOfTri).every((b) => b === 3);
  ok(allBand3, "B1d constant 0.7 over [0,1] in 5 bands → band 3 (floor(3.5)) everywhere");
  ok(m.bandColors[3] === ((179 << 16) | (179 << 8) | 179),
    "B1e band 3 gray = round(255·3.5/5) = 179 → 0xb3b3b3");
  // the basis on +z: u = n×(least-aligned axis = x) = (0,1,0), v = n×u = (−1,0,0)
  // first cell (i=0, j=0): c = center + (−0.375)·u + (−0.375)·v = (0.875, 0.125, 0)
  // c1 = c − 0.125u − 0.125v = (1.0, 0.0, 0)
  ok(near(m.positions[0], 1.0) && near(m.positions[1], 0.0) && near(m.positions[2], 0.0),
    "B1f first vertex = first kept quad's corner (1.0, 0.0, 0) — hand-walked");
}
{
  const m = buildObliqueSheetMesh({
    polygon: SQUARE, point: CENTER, normal: PZ,
    sampler: () => 0.7, grayLo: 0, grayHi: 1, bands: 5, latticeN: 4,
  });
  // winding: cross(c2−c1, c3−c1)·n > 0 for the first triangle
  const p = m.positions;
  const e1 = [p[3] - p[0], p[4] - p[1], p[5] - p[2]];
  const e2 = [p[6] - p[0], p[7] - p[1], p[8] - p[2]];
  const cx = e1[1] * e2[2] - e1[2] * e2[1];
  const cy = e1[2] * e2[0] - e1[0] * e2[2];
  const cz = e1[0] * e2[1] - e1[1] * e2[0];
  ok(cz > 0, "B2 first triangle's normal faces +z (u×v = n by construction, CCW)");
}
{
  // NaN for x > 0.7 — the right column of quads drops (the sampler's
  // honesty: the face only wears what it read)
  const m = buildObliqueSheetMesh({
    polygon: SQUARE, point: CENTER, normal: PZ,
    sampler: (p) => (p[0] > 0.7 ? NaN : 0.5), grayLo: 0, grayHi: 1, bands: 5, latticeN: 4,
  });
  ok(m !== null && m.stats.kept === 12 && m.stats.dropped === 4,
    "B3 NaN region dropped: 12 kept, 4 dropped (x > 0.7 column)");
}
{
  // the triangle trace: half the square's lattice survives
  const m = buildObliqueSheetMesh({
    polygon: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], point: CENTER, normal: PZ,
    sampler: () => 0.5, grayLo: 0, grayHi: 1, bands: 3, latticeN: 4,
  });
  ok(m !== null && m.stats.kept < 16 && m.stats.kept >= 4,
    `B4 triangle trace clips the lattice (${m?.stats.kept} < 16 kept)`);
}
{
  const rejects = [
    ["<3 polygon points", { polygon: [[0, 0, 0], [1, 0, 0]], point: CENTER, normal: PZ, sampler: () => 0.5, grayLo: 0, grayHi: 1 }],
    ["grayHi ≤ grayLo", { polygon: SQUARE, point: CENTER, normal: PZ, sampler: () => 0.5, grayLo: 1, grayHi: 0 }],
    ["bands < 2", { polygon: SQUARE, point: CENTER, normal: PZ, sampler: () => 0.5, grayLo: 0, grayHi: 1, bands: 1 }],
    ["latticeN < 2", { polygon: SQUARE, point: CENTER, normal: PZ, sampler: () => 0.5, grayLo: 0, grayHi: 1, latticeN: 1 }],
    ["zero normal", { polygon: SQUARE, point: CENTER, normal: [0, 0, 0], sampler: () => 0.5, grayLo: 0, grayHi: 1 }],
    ["all-NaN sampler", { polygon: SQUARE, point: CENTER, normal: PZ, sampler: () => NaN, grayLo: 0, grayHi: 1 }],
  ];
  let allNull = true;
  for (const [name, input] of rejects) {
    if (buildObliqueSheetMesh(input) !== null) { allNull = false; console.log(`   not-null: ${name}`); }
  }
  ok(allNull, "B5 rejection family: all six unusable inputs → null (the honest no-face)");
}
{
  const a = buildObliqueSheetMesh({
    polygon: SQUARE, point: CENTER, normal: [0, 0, 5],
    sampler: () => 0.7, grayLo: 0, grayHi: 1, bands: 5, latticeN: 4,
  });
  const b = buildObliqueSheetMesh({
    polygon: SQUARE, point: CENTER, normal: PZ,
    sampler: () => 0.7, grayLo: 0, grayHi: 1, bands: 5, latticeN: 4,
  });
  const same = a !== null && b !== null &&
    a.positions.length === b.positions.length &&
    Array.from(a.positions).every((v, i) => near(v, b.positions[i], 1e-5));
  ok(same, "B6 non-unit normal (0,0,5) → identical mesh (normalization inside)");
}
{
  // the +y plane: every vertex's y === the plane's y (the face never leaves
  // its plane); the trace is wound COUNTER-CLOCKWISE around +y (the guide's
  // contract — the same-side test rejects a clockwise trace)
  const m = buildObliqueSheetMesh({
    polygon: [[0, 0.5, 0], [0, 0.5, 1], [1, 0.5, 1], [1, 0.5, 0]], point: [0.5, 0.5, 0.5],
    normal: [0, 1, 0],
    sampler: () => 0.5, grayLo: 0, grayHi: 1, bands: 3, latticeN: 4,
  });
  const allY = m !== null && Array.from(m.positions).every((_, i) => i % 3 !== 1 || near(m.positions[i], 0.5, 1e-6));
  ok(allY, "B7 +y normal: every vertex sits at y = 0.5 (the face lives in its plane)");
}
{
  const m = buildObliqueSheetMesh({
    polygon: SQUARE, point: CENTER, normal: PZ,
    sampler: () => 0.5, grayLo: 0, grayHi: 1, bands: 5, latticeN: 2,
  });
  // quads order (j, i): quad(0,0) c1.x = 1.0, quad(0,1) c1.x = 0.5 — the
  // j-adjacent pair (offset 24) steps exactly one full cell (dv = 0.5)
  ok(m !== null && m.stats.kept === 4 && near(m.positions[0] - m.positions[24], 0.5, 1e-6),
    "B8 N=2 lattice: 4 quads, j-adjacent corners step one full cell (0.5)");
}
{
  // band edges: the boundary value belongs to the UPPER band (floor(t·K))
  const bandsSeen = new Set();
  for (let s = 0; s <= 20; s++) {
    const d = s / 20;
    const m = buildObliqueSheetMesh({
      polygon: SQUARE, point: CENTER, normal: PZ,
      sampler: () => d, grayLo: 0, grayHi: 1, bands: 5, latticeN: 2,
    });
    if (m) bandsSeen.add(m.bandOfTri[0]);
  }
  ok(bandsSeen.size === 5 && bandsSeen.has(0) && bandsSeen.has(4),
    "B9 sweep 0..1 covers exactly bands 0..4 (the clamp holds at both ends)");
}
{
  const m = buildObliqueSheetMesh({
    polygon: SQUARE, point: CENTER, normal: PZ,
    sampler: () => 0.3, grayLo: 0, grayHi: 1, bands: 5, latticeN: 2,
  });
  ok(m !== null && m.bandLabels[1].startsWith("0.3"),
    "B10 band 1's label speaks its mid density (0.3)");
}

/* ===== C. the wiring — source pins (the t1129 pattern) ===== */

const embed = readFileSync(path.join(ROOT, "src/components/workflow/results/molstar-embed.tsx"), "utf8");
const lib = readFileSync(path.join(ROOT, "src/lib/voxel-voice.ts"), "utf8");
const panel = readFileSync(path.join(ROOT, "src/components/workflow/results/map-ortho-panel.tsx"), "utf8");

ok(!embed.includes('mode: "plane"') && !embed.includes("mode: 'plane'"),
  "C1 the embed no longer speaks slice mode 'plane' (the GL-invisible path retired)");
ok(embed.includes('buildObliqueSheetMesh, densityWindow') && embed.includes('from "@/lib/voxel-voice"'),
  "C2 the embed imports the face's geometry words from the lib");
ok(lib.includes("export function buildObliqueSheetMesh") && lib.includes("export function densityWindow"),
  "C3 the lib mints the face's geometry words (the t1122 patchBoxRect precedent)");
ok(embed.includes("cryoflow-oblique-density-sheet"),
  "C4a the transform is named (no anonymous state nodes)");
ok((embed.match(/ShapeRepresentation3DRef/g) || []).length >= 3,
  "C4b ShapeRepresentation3DRef wired (decl + stash + apply)");
ok(!embed.includes("seenSigma"),
  "C5 the pumpSheet seen-set no longer tracks σ (the mesh face is σ-independent)");
ok(!embed.includes("the sheet shares the threshold"),
  "C6 the t1129 shared-threshold effect retired (the face wears the field, not the contour)");
ok(embed.includes("sheetArraysToShape") && embed.includes('Shape.create(') && embed.includes('"oblique-density-sheet"'),
  "C7 the shape wrapper: one group per gray band via Shape.getColor");
ok(embed.includes("UpdateResult.Recreate"),
  "C8 the update hook: rev bump → Recreate (the params carry the geometry)");
ok(embed.includes(".update(params)") && !embed.includes(".update(SheetTransform, params"),
  "C8b the update call is ONE-ARG (the offline repro t1130-transform-repro: a two-arg .update(transform, valueObject) rides the builder's second slot as an immer-style RECIPE over the old params and drove the cell to its DEFAULTS — rev 0, no geometry, 'no sheet geometry'; the values ride alone)");
ok(embed.includes("!sheetStateRef.current.on || !ob.on"),
  "C9 the retirement law byte-identical (no cut → no face)");
ok(embed.includes("(PD.Value as any)(null)"),
  "C10 the transform's params carry the geometry (PD.Value — BoxShape3D's pattern)");
ok(lib.includes("export const OBLIQUE_SHEET_FACE_TITLE") && panel.includes("OBLIQUE_SHEET_FACE_TITLE"),
  "C11 the ▣ title rides the lib's mesh-edition word");
ok(!panel.includes("solvent-quiet"),
  "C12 the t1129 solvent-quiet confession retired with the isoLevel it confessed");
ok(lib.includes("OBLIQUE_SHEET_ANNOTATION =") && embed.includes("description: OBLIQUE_SHEET_ANNOTATION"),
  "C13 the transform's description confesses the annotation word");

console.log(`\n${fail === 0 ? "ALL GREEN" : "RED"} — t1130 oblique-mesh unit: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

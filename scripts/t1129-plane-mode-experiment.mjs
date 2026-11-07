#!/usr/bin/env node
/**
 * t1129 — the OFFLINE plane-mode experiment: does Mol*'s own slice-sampling
 * produce density for the oblique sheet on the REAL Class 2 map, or does
 * the sampled image come back empty (the silent no-pixels mystery the live
 * rides hit — the sheet node mounts, the render object says visible, and
 * the screen shows nothing)?
 *
 * Parses the map with Mol*'s own CCP4 reader (the same parser the embed's
 * RawData → ParseCcp4 chain runs), builds the Volume, replicates
 * createPlaneImage's construction VERBATIM (the m/width/height/trim
 * arithmetic from molstar 5.11 slice.js) and walks getSampledImage's
 * sampling loop verbatim (trilinear interpolation through the real grid),
 * then reports: the val distribution (NaN count, non-zero count, the min/
 * max), the RGB truth, and the same walk for an AXIS plane (mode grid at
 * z=center — the path that provably renders in this app) as the control.
 * Pure CPU — no WebGL anywhere.
 *
 *   node scripts/t1129-plane-mode-experiment.mjs [map.mrc]
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseCcp4 } from "molstar/lib/mol-io/reader/ccp4/parser.js";
import { volumeFromCcp4 } from "molstar/lib/mol-model-formats/volume/ccp4.js";
import { Grid } from "molstar/lib/mol-model/volume/grid.js";
import { Vec3, Mat4 } from "molstar/lib/mol-math/linear-algebra.js";
import { Color } from "molstar/lib/mol-util/color/color.js";
import { PositionLocation } from "molstar/lib/mol-geo/util/location-iterator.js";
import { ReaderResult as Result } from "molstar/lib/mol-io/reader/result.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const MAP = process.argv[2] ?? path.join(ROOT, "data/relion/cmvwf4sad0000mcmaxky72cxr/class3d_jxji3zjn/run_it025_class002.mrc");

const buffer = readFileSync(MAP);
console.log(`map: ${path.basename(MAP)} (${buffer.length} bytes)`);

const parsed = await parseCcp4(buffer, path.basename(MAP)).run();
if (parsed.isError) { console.error("parse error:", parsed.toString()); process.exit(1); }
const volume = await volumeFromCcp4(parsed.result, {}).run();
const grid = volume.grid;
const dims = [...grid.cells.space.dimensions];
const stats = grid.stats;
console.log(`dims: ${dims.join("×")} · min ${stats.min.toPrecision(4)} · max ${stats.max.toPrecision(4)} · mean ${stats.mean.toPrecision(4)} · σ ${stats.sigma.toPrecision(3)}`);

const gridToCartn = Grid.getGridToCartesianTransform(grid);
const cartnToGrid = Mat4.invert(Mat4(), gridToCartn);
const origin = Vec3.transformMat4(Vec3(), Vec3.create(0, 0, 0), gridToCartn);
const corner = Vec3.transformMat4(Vec3(), Vec3.create(dims[0], dims[1], dims[2]), gridToCartn);
console.log(`world origin: [${origin.map(v => v.toFixed(2)).join(", ")}] · far corner: [${corner.map(v => v.toFixed(2)).join(", ")}]`);

/* ---- createPlaneImage verbatim (molstar 5.11 slice.js) ---- */
function planeImageInfo(normal, point) {
  const nn = Vec3.normalize(Vec3(), normal);
  const [mx, my, mz] = dims;
  const a = mx, b = my, c = mz;
  const resolution = Math.max(a, b, c) / Math.max(mx, my, mz);
  const scaleFactor = 1 / resolution;
  const s = Vec3.distance(Vec3.create(0, 0, 0), Vec3.create(a, b, c));
  const center = Vec3.create(a / 2, b / 2, c / 2);
  Vec3.transformMat4(center, center, gridToCartn);
  const toCenter = Vec3.sub(Vec3(), center, point);
  const distToPlane = Vec3.dot(toCenter, nn);
  const centerOnPlane = Vec3.scaleAndAdd(Vec3(), center, nn, -distToPlane);
  const m = Mat4.fromPlane(Mat4(), nn, centerOnPlane);
  const size = Vec3.set(Vec3(), s, s, s);
  Mat4.scale(m, m, size);
  const width = Math.floor(s * scaleFactor);
  const height = Math.floor(s * scaleFactor);
  const trim = { type: 3, center: Vec3.create(a / 2, b / 2, c / 2), scale: Vec3.create(a, b, c), rotation: [0, 0, 0, 1], transform: cartnToGrid };
  return { m, width, height, trim, centerOnPlane };
}

/* ---- getSampledImage's sampling loop verbatim (the CPU truth) ---- */
function sampleVolume(info) {
  const { m, width, height } = info;
  const { cells: { space } } = grid;
  const v = Vec3();
  const getTrilinearlyInterpolated = Grid.makeGetTrilinearlyInterpolated(grid, "none");
  const gridCoords = Vec3();
  const vals = new Float32Array(width * height);
  let nanCount = 0;
  let inside = 0;
  let minVal = Infinity, maxVal = -Infinity;
  for (let ih = 0; ih < height; ++ih) {
    for (let iw = 0; iw < width; ++iw) {
      const i = ih * width + iw;
      const y = (Math.min(Math.max(iw + 0.5, 0), width - 1) / width) - 0.5;
      const x = (Math.min(Math.max(ih + 0.5, 0), height - 1) / height) - 0.5;
      Vec3.set(v, x, -y, 0);
      Vec3.transformMat4(v, v, m);
      Vec3.copy(gridCoords, v);
      Vec3.transformMat4(gridCoords, gridCoords, cartnToGrid);
      const ix = Math.trunc(gridCoords[0]);
      const iy = Math.trunc(gridCoords[1]);
      const iz = Math.trunc(gridCoords[2]);
      const val = getTrilinearlyInterpolated(v);
      vals[i] = val;
      if (Number.isNaN(val)) nanCount++;
      else {
        if (val !== 0) inside++;
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
      }
    }
  }
  return { vals, nanCount, inside, minVal, maxVal, width, height };
}

/* the oblique sheet's plane: θ=45°, φ=0°, offset=0 — the block's own
   voice family; the anchor is the grid center (offset 0) */
const t = 45 * Math.PI / 180;
const n = [Math.sin(t), 0, Math.cos(t)];
const cVox = [(dims[0] - 1) / 2, (dims[1] - 1) / 2, (dims[2] - 1) / 2];
const anchor = [
  origin[0] + cVox[0] * ((corner[0] - origin[0]) / dims[0]),
  origin[1] + cVox[1] * ((corner[1] - origin[1]) / dims[1]),
  origin[2] + cVox[2] * ((corner[2] - origin[2]) / dims[2]),
];
const info = planeImageInfo(n, anchor);
console.log(`\noblique plane θ=45° φ=0° offset=0:`);
console.log(`  image ${info.width}×${info.height} · anchor [${anchor.map(v => v.toFixed(2)).join(", ")}]`);
const ob = sampleVolume(info);
console.log(`  sampled: ${ob.width * ob.height} px · NaN ${ob.nanCount} · non-zero ${ob.inside} · val range [${ob.minVal.toPrecision(4)}, ${ob.maxVal.toPrecision(4)}]`);

/* the control: the AXIS plane at z=center (mode grid's own geometry —
   the path that provably renders as the cross-section) */
const zAnchor = [origin[0], origin[1], origin[2] + (cVox[2] + 0.5) * ((corner[2] - origin[2]) / dims[2])];
const zInfo = planeImageInfo([0, 0, 1], zAnchor);
const zs = sampleVolume(zInfo);
console.log(`\ncontrol axis plane z=center:`);
console.log(`  image ${zInfo.width}×${zInfo.height} · sampled: NaN ${zs.nanCount} · non-zero ${zs.inside} · val range [${zs.minVal.toPrecision(4)}, ${zs.maxVal.toPrecision(4)}]`);

/* verdict */
const obHealthy = ob.nanCount < (ob.width * ob.height) / 2 && ob.inside > 0;
console.log(`\nVERDICT: the oblique plane's sampled image is ${obHealthy ? "HEALTHY (density present — the failure is GL-side, a Mol* render quirk)" : "EMPTY (the sampling itself yields nothing — the params/transform path is the bug)"}`);

/* ---- the isoLevel cull audit (image.frag:161 — value < uIsoLevel → discard) ---- */
function auditIso(offsetSigma) {
  const isoAbs = stats.mean + offsetSigma * stats.sigma;
  const isoNorm = Math.min(1, Math.max(0, (isoAbs - stats.min) / (stats.max - stats.min)));
  const above = [...ob.vals].filter((v) => !Number.isNaN(v)).length ? null : null;
  let kept = 0, total = 0;
  for (const raw of ob.vals) {
    if (Number.isNaN(raw)) continue;
    total++;
    const nv = (raw - stats.min) / (stats.max - stats.min);
    if (nv >= isoNorm) kept++;
  }
  let keptZ = 0, totalZ = 0;
  for (const raw of zs.vals) {
    if (Number.isNaN(raw)) continue;
    totalZ++;
    const nv = (raw - stats.min) / (stats.max - stats.min);
    if (nv >= isoNorm) keptZ++;
  }
  console.log(`iso ${offsetSigma}σ → abs ${isoAbs.toPrecision(4)} · normalized ${isoNorm.toFixed(4)} · oblique keeps ${kept}/${total} px · axis keeps ${keptZ}/${totalZ} px`);
}
for (const s of [2, 1, 0.5, 0, -0.5, -1, -1.5, -2]) auditIso(s);

// t1114 — the GridLookup3D fossil's numeric truth probe (the minimal repro).
// The stack: RangeError: Invalid typed array length: -Infinity
//   at new Uint32Array ← _build ← build ← GridLookup3DImpl
//   ← calcTopGrid ← calcInstanceGrid ← updateTransformData
//   ← createTransform ← createVolumeInstancesTransform (mol-repr/volume/visual.js)
// which passes `geometry.boundingSphere` as the invariantBoundingSphere.
// THE ROOT (caught in the t1114 autopsy, scripts/t1114-grid-autopsy.mjs):
// a zero MX/MY/MZ triple (bytes 28/32/36) makes Mol* divide the origin by
// [0,0,0] → NaN fractional box → all-NaN gridToCartesian → NaN bounding
// spheres → calcBottomGrid's Box3D.expand rides NaN/-Inf → size -Inf →
// Uint32Array(-Infinity). CURED by the third sanitizer law (cell sampling
// = data dims); this probe now proves the sane sphere passes.
import { calcInstanceGrid } from "molstar/lib/mol-math/geometry/instance-grid.js";
import { Sphere3D } from "molstar/lib/mol-math/geometry/primitives/sphere3d.js";
import { Mat4 } from "molstar/lib/mol-math/linear-algebra.js";

const probe = (name, sphere, instanceCount = 1) => {
  console.log(`\n=== ${name} ===`);
  console.log("sphere:", JSON.stringify({
    center: Array.from(sphere.center),
    radius: sphere.radius,
    isNaN: Number.isNaN(sphere.radius),
  }));
  const transform = new Float32Array(instanceCount * 16);
  for (let i = 0; i < instanceCount; i++) Mat4.toArray(Mat4.identity(), transform, i * 16);
  try {
    const grid = calcInstanceGrid(
      { instanceCount, instance: new Float32Array(instanceCount), transform, invariantBoundingSphere: sphere },
      4, 32,
    );
    console.log("no throw — cellCount:", grid.cellCount);
  } catch (err) {
    console.log("THROW:", err.constructor.name + ":", err.message);
  }
};

// the NaN sphere (what a zero-sampled map's getBoundingSphere carries)
{
  const s = Sphere3D();
  Sphere3D.set(s, [NaN, NaN, NaN], NaN);
  probe("NaN sphere (the zero-sampling disease)", s);
}
// the -Infinity radius variant (the downstream NaN arithmetic's other face)
{
  const s = Sphere3D();
  Sphere3D.set(s, [0, 0, 0], -Infinity);
  probe("-Infinity-radius sphere", s);
}
// an honest sane sphere for contrast (the cured world's shape)
{
  const s = Sphere3D();
  Sphere3D.set(s, [32, 32, 32], 55.42562584220407);
  probe("sane sphere (cured: center 32³ r 55.43)", s);
}

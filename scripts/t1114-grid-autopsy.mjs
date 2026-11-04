// t1114 — the GridLookup3D fossil's full numeric autopsy (node, no WebGL).
// Replicates the browser's isosurface visual creation on the REAL class-1
// map: sanitize (our own lib) → ParseCcp4 → VolumeFromCcp4 → the TWO
// bounding-sphere candidates (GPU TextureMesh: Grid.getBoundingSphere;
// CPU Mesh: Grid.getIsosurfaceBoundingSphere) → feed each through the REAL
// calcInstanceGrid (the crash site) and print every number.
import { readFileSync } from "node:fs";
import { sanitizeMrcHeader } from "../src/lib/mrc-axis.ts";

const mapPath = process.argv[2] || "data/relion/cmvvbb3v20000or91fwzq8sfx/class3d_4201xurr/run_it002_class001.mrc";
let bytes = new Uint8Array(readFileSync(mapPath));
const r = sanitizeMrcHeader(bytes);
console.log("[sanitizer] corrected:", r.corrected, "cured:", r.cured?.join(" · "));
bytes = r.bytes;

const ccp4Parser = await import("molstar/lib/mol-io/reader/ccp4/parser.js");
const ccp4 = await import("molstar/lib/mol-model-formats/volume/ccp4.js");
const parsed = await ccp4Parser.parse(bytes, "class001").run();
console.log("[parse] ok — header MAPC/MAPR/MAPS:", parsed.result.header.MAPC, parsed.result.header.MAPR, parsed.result.header.MAPS,
  "angles:", parsed.result.header.alpha, parsed.result.header.beta, parsed.result.header.gamma);
const volume = await ccp4.volumeFromCcp4(parsed.result, {}).run();
const grid = volume.grid;
console.log("[grid] dims:", Array.from(grid.cells.space.dimensions));
console.log("[grid] stats:", JSON.stringify({
  min: grid.stats.min, max: grid.stats.max, mean: grid.stats.mean, sigma: grid.stats.sigma,
}));
const transform = grid.transform.ref?.value ?? grid.transform;
console.log("[transform]", Array.from(transform).map((v) => (Math.abs(v) < 1e-6 ? 0 : +v.toFixed(4))).join(","));

const { Grid } = await import("molstar/lib/mol-model/volume/grid.js");
const sphereA = Grid.getBoundingSphere(grid);
console.log("\n[sphereA = Grid.getBoundingSphere (the GPU TextureMesh invariant sphere)]");
console.log("  center:", Array.from(sphereA.center).map((v) => +v.toFixed(3)).join(","),
  "radius:", sphereA.radius, "finite:", Number.isFinite(sphereA.radius));

const iso = { kind: "relative", relativeValue: 0.5 };
const absIso = iso.relativeValue * (grid.stats.max - grid.stats.min) + grid.stats.min;
console.log("\n[iso] relative(0.5) → absolute:", absIso);
const sphereB = Grid.getIsosurfaceBoundingSphere(grid, absIso);
console.log("[sphereB = getIsosurfaceBoundingSphere (the CPU Mesh invariant sphere)]");
console.log("  center:", Array.from(sphereB.center).map((v) => +v.toFixed(3)).join(","),
  "radius:", sphereB.radius, "finite:", Number.isFinite(sphereB.radius));

// the empty-surface variant: at a HIGH iso level the marching cubes yields
// zero vertices — what sphere does getIsosurfaceBoundingSphere make then?
const sphereC = Grid.getIsosurfaceBoundingSphere(grid, grid.stats.max + 1);
console.log("[sphereC = EMPTY-surface sphere (iso above max — zero vertices)]");
console.log("  center:", Array.from(sphereC.center).map((v) => +v.toFixed(3)).join(","),
  "radius:", sphereC.radius, "finite:", Number.isFinite(sphereC.radius));

const { calcInstanceGrid } = await import("molstar/lib/mol-math/geometry/instance-grid.js");
const tryGrid = (name, sphere, cellSize) => {
  console.log(`\n[calcInstanceGrid · ${name} · cellSize=${cellSize}]`);
  const n = 1;
  const t = new Float32Array(16);
  t.set(transform);
  try {
    const g = calcInstanceGrid({ instanceCount: n, instance: new Float32Array(n), transform: t, invariantBoundingSphere: sphere }, cellSize, 2000);
    console.log("  OK — cellCount:", g.cellCount);
  } catch (err) {
    console.log("  THROW:", err.constructor.name + ":", err.message);
  }
};
tryGrid("sphereA", sphereA, 200);
tryGrid("sphereA@cellSize4", sphereA, 4);
tryGrid("sphereB", sphereB, 200);
tryGrid("sphereC(empty-surface)", sphereC, 200);

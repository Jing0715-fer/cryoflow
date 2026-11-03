#!/usr/bin/env node
// t1122 — the patch footprint's unit: the box-to-tile mapping is
// BEHAVIORAL (the lib imports clean — no Mol*/React in its module graph),
// the tile's dashed outline and the panel's radius slider are
// source-asserted (the t653 law: one geometry, two faces, no face can
// drift).
//
// The story: t1121 taught the probe to SPEAK an area (median / robust z
// / n); t1122 makes it SHOW the same area — the (2r+1)² patch drawn on
// the tile as a dashed outline while the chip speaks its numbers. The
// seat: patchBoxRect (voxel-voice, the ONE lib) maps readMrcPatch's
// clamped box onto the tile's fractional frame through voxelIndexOf's
// INVERSE (an index i of dim n lives at i/(n−1)) — the box and the
// crosshair can never disagree about where a voxel lives.
//
//   node --import ./scripts/ts-alias-register.mjs scripts/t1122-probe-box-unit.mjs

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { patchBoxRect, voxelIndexOf } from "@/lib/voxel-voice";

let pass = 0;
let fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};
const near = (a, b, tol = 1e-12) =>
  typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= tol;

console.log("A — the xy patch on the z tile (the t1121 API shape, verbatim)");

// the world map's real answer: 33³, r=5 at the centre — box x 11..21,
// y 11..21, z pinned 16. The z tile's frame: h=x, v=y.
const XY = {
  lo: { x: 11, y: 11, z: 16 },
  hi: { x: 21, y: 21, z: 16 },
};
const R33 = [33, 33, 33];
const P = patchBoxRect(XY, R33, "x", "y");
ok("A1 the rect reads", P !== null);
ok("A2 left/right ride x/(dim−1): 11/32 … 21/32",
  P && near(P.left, 11 / 32) && near(P.right, 21 / 32));
ok("A3 top/bottom ride y/(dim−1): 11/32 … 21/32",
  P && near(P.top, 11 / 32) && near(P.bottom, 21 / 32));
ok("A4 width = 10/32 (the (2r+1)−1 = 10-voxel span)",
  P && near(P.right - P.left, 10 / 32));
ok("A5 the pinned axis rides along unused (no z leak into an xy rect)",
  P && P.left === P.left && typeof P.top === "number");

console.log("B — the inverse law: the box and voxelIndexOf agree");

// voxelIndexOf's inverse: an index i of dim n sits at i/(n−1). Feeding
// the rect's left edge back through voxelIndexOf must return the box's
// own lo index — one formula, two directions, no drift.
ok("B1 left → voxelIndexOf → 11 (the box's own lo.x)",
  P && voxelIndexOf(P.left, 33) === 11);
ok("B2 right → voxelIndexOf → 21 (the box's own hi.x)",
  P && voxelIndexOf(P.right, 33) === 21);
ok("B3 top → voxelIndexOf → 11 (the box's own lo.y)",
  P && voxelIndexOf(P.top, 33) === 11);

console.log("C — the tile's own frame (each plane maps its two axes)");

// the y tile (h=x, v=z) with an XZ patch: x 11..21, y PINNED 16, z 11..21
const XZ = { lo: { x: 11, y: 16, z: 11 }, hi: { x: 21, y: 16, z: 21 } };
const PY = patchBoxRect(XZ, R33, "x", "z");
ok("C1 the y tile maps h=x (11/32..21/32) and v=z (11/32..21/32)",
  PY && near(PY.left, 11 / 32) && near(PY.right, 21 / 32)
  && near(PY.top, 11 / 32) && near(PY.bottom, 21 / 32));
// the x tile (h=y, v=z) with a YZ patch: x PINNED 16, y 11..21, z 11..21
const YZ = { lo: { x: 16, y: 11, z: 11 }, hi: { x: 16, y: 21, z: 21 } };
const PX = patchBoxRect(YZ, R33, "y", "z");
ok("C2 the x tile maps h=y (11/32..21/32) and v=z (11/32..21/32)",
  PX && near(PX.left, 11 / 32) && near(PX.right, 21 / 32)
  && near(PX.top, 11 / 32) && near(PX.bottom, 21 / 32));

console.log("D — the honest silences (the refusals, the family voice)");

ok("D1 no box → null", patchBoxRect(null, R33, "x", "y") === null);
ok("D2 a box without corners → null",
  patchBoxRect({ lo: { x: 1, y: 1, z: 1 } }, R33, "x", "y") === null
  && patchBoxRect(undefined, R33, "x", "y") === null);
ok("D3 unknown dims → null (no grid, no rectangle)",
  patchBoxRect(XY, null, "x", "y") === null);
ok("D4 a degenerate dim refuses WHERE IT IS MAPPED (the t906 law on the two axes the tile uses)",
  patchBoxRect(XY, [33, 1, 33], "x", "y") === null
  && patchBoxRect(XY, [1, 33, 33], "x", "y") === null
  && patchBoxRect(XY, [33.5, 33, 33], "x", "y") === null
  && patchBoxRect(XY, [33, NaN, 33], "x", "y") === null);
ok("D4b an unused axis' degeneracy rides along (the box only claims the mapped plane)",
  patchBoxRect(XY, [33, 33, 1], "x", "y") !== null);
ok("D5 the same axis twice refuses (a tile frame is two axes)",
  patchBoxRect(XY, R33, "x", "x") === null);
ok("D6 a reversed box refuses",
  patchBoxRect({ lo: { x: 21, y: 11, z: 16 }, hi: { x: 11, y: 21, z: 16 } }, R33, "x", "y") === null);
ok("D7 an edge escaping 0..1 refuses (a box outside the grid is a lie)",
  patchBoxRect({ lo: { x: 11, y: 11, z: 16 }, hi: { x: 33, y: 21, z: 16 } }, R33, "x", "y") === null);
ok("D8 a non-finite corner refuses",
  patchBoxRect({ lo: { x: NaN, y: 11, z: 16 }, hi: { x: 21, y: 21, z: 16 } }, R33, "x", "y") === null);

console.log("E — the edge clamp still draws (an honest shrunken box)");

// at the volume edge readMrcPatch clamps: x 0..5 of a 33³ → 0/32..5/32
const EDGE = { lo: { x: 0, y: 11, z: 16 }, hi: { x: 5, y: 21, z: 16 } };
const PE = patchBoxRect(EDGE, R33, "x", "y");
ok("E1 the edge box draws from 0 (left pinned at 0)",
  PE && PE.left === 0 && near(PX && PE.right, 5 / 32));
ok("E2 the shrunken n story: the rect's span speaks the CLAMPED truth",
  PE && near(PE.right - PE.left, 5 / 32));

console.log("F — the tile's dashed footprint (source assertions)");

const panelSrc = readFileSync(
  join(import.meta.dirname, "../src/components/workflow/results/map-ortho-panel.tsx"),
  "utf8"
);
ok("F1 the outline carries its own testid", panelSrc.includes("data-ortho-probe-box"));
ok("F2 the geometry rides the ONE lib (patchBoxRect import)",
  panelSrc.includes("patchBoxRect") && panelSrc.includes('from "@/lib/voxel-voice"'));
ok("F3 the tile guards the grid (dims ?? null — no dims, no box)",
  panelSrc.includes("patchBoxRect(probe?.patch, dims ?? null, spec.hAxis, spec.vAxis)"));
ok("F4 the box is a decoration layer (aria-hidden, pointer-events-none)",
  panelSrc.includes('data-ortho-probe-box') && panelSrc.includes("border-dashed"));
ok("F5 the dashed face sits UNDER the solid crosshair (box drawn first)",
  panelSrc.indexOf("data-ortho-probe-box") < panelSrc.indexOf('data-ortho-probe="h"'));
ok("F6 a half-honest box corner nulls the whole patch (the num seat)",
  panelSrc.includes("const num = (v: unknown): number | null"));

console.log("G — the radius slider (source assertions)");

ok("G1 the request speaks the LIVE radius (no hardcoded &r=5 anymore)",
  panelSrc.includes("&r=${probeRadius}") && !panelSrc.includes("&r=5`"));
ok("G2 the slider is panel-level with its own locator",
  panelSrc.includes('data-canvas-ui="ortho-probe-radius"'));
ok("G3 the law: 1..12, step 1 (the server's 0..16 stays the last word)",
  panelSrc.includes("min={1}") && panelSrc.includes("max={12}") && panelSrc.includes("step={1}"));
ok("G4 the readout speaks the FULL patch size (2r+1)×(2r+1)",
  panelSrc.includes("{2 * probeRadius + 1}×{2 * probeRadius + 1}"));
ok("G5 every tile rides the same hand (probeRadius passed to all three)",
  (panelSrc.match(/probeRadius=\{probeRadius\}/g) || []).length === 1
  && panelSrc.includes("probeRadius: number;"));

console.log("H — the radius slider's live re-probe (t1124, source assertions)");
ok("H1 the debounce constant exists at the throttle's side",
  panelSrc.includes("const PROBE_REFETCH_MS = 180;")
  && panelSrc.indexOf("PROBE_REFETCH_MS") > panelSrc.indexOf("PROBE_THROTTLE_MS = 140"));
ok("H2 the re-probe effect's only reactive dependency is the radius",
  /useEffect\(\(\) => \{[\s\S]*?fireProbeRef\.current\(fx, fy\);[\s\S]*?\}, \[probeRadius\]\)/.test(panelSrc));
ok("H3 the position and fetcher ride post-render refs (react-hooks/refs law)",
  panelSrc.includes("const probeRef = useRef(probe);")
  && panelSrc.includes("const fireProbeRef = useRef(fireProbe);")
  && /useEffect\(\(\) => \{\s*probeRef\.current = probe;\s*fireProbeRef\.current = fireProbe;\s*\}\);/.test(panelSrc));
ok("H4 a slider drag sweeps notches but lands ONE request (trailing debounce)",
  /if \(probeTimer\.current\) clearTimeout\(probeTimer\.current\);\s*probeTimer\.current = setTimeout\(\(\) => \{\s*lastProbeAt\.current = Date\.now\(\);\s*fireProbeRef\.current\(fx, fy\);/.test(panelSrc));
ok("H5 mouse leave still silences everything (no ghost re-probe)",
  /const leaveProbe = \(\) => \{\s*if \(probeTimer\.current\) clearTimeout\(probeTimer\.current\);\s*probeAbort\.current\?\.abort\(\);\s*setProbe\(null\);/.test(panelSrc));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

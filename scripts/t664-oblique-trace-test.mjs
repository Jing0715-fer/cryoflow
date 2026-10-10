// t664 — the oblique cut's 2D shadow: obliqueTraceOnTile mirror test.
//
// The e2e (t664-e2e) asserts the DRAWN line against this same math; this
// script pins the geometry itself across the cases the demo world never
// scrubs to. The two functions are mirrored VERBATIM from
// src/components/workflow/results/map-ortho-panel.tsx (obliqueFrame +
// obliqueTraceOnTile) — the t661/t662 pattern: component code lives behind
// the Next build, the mirror keeps the math testable, and the verbatim
// copy is the contract ("keep the two in lockstep" — obliqueFrame's own
// warning to the server, inherited by every mirror since).
//
// Anchors:
//   1  the hand-checked canonical: Z tile, θ45·φ30, offset 0, pos 0.5,
//      dims 64³ — endpoints (21.13, 100) ↔ (78.87, 0), the line passes
//      through the tile CENTER (the plane owns the box center; the slice
//      at 0.5 owns it too — their intersection must).
//   2  parallel planes draw nothing: θ=0/180 on the matching tile → null.
//   3  axis-aligned normals on the OTHER tiles: θ=0 → X tile's line is
//      the horizontal mid-line (the XY plane at z-center); θ=90·φ0 →
//      the Z tile's line is the LEFT EDGE (plane x=0 meets slice z).
//   4  the plane invariant: for every (θ,φ,offset,tile,pos) in the sweep,
//      both endpoints converted back to voxel space satisfy n·p = d0 AND
//      the pinned slice coordinate — the line is WHERE THE MATH SAYS.
//   5  honesty of absence: offset ±1 (plane beyond the slice's reach),
//      a corner-grazing pass (single point), degenerate grids ([64,1,32],
//      [1,1,1], [0,64,64]) — all null, never a guessed line.

// ---- verbatim mirror: obliqueFrame (map-ortho-panel.tsx) ----
const OBLIQUE_DEG = Math.PI / 180;

function obliqueFrame(dims, thetaDeg, phiDeg, offsetFrac) {
  const [nx, ny, nz] = dims;
  const t = thetaDeg * OBLIQUE_DEG;
  const p = phiDeg * OBLIQUE_DEG;
  const normal = [
    Math.sin(t) * Math.cos(p),
    Math.sin(t) * Math.sin(p),
    Math.cos(t),
  ];
  let u;
  if (Math.abs(normal[2]) > 0.999) {
    u = [1, 0, 0];
  } else {
    const len = Math.hypot(normal[0], normal[1]);
    u = [normal[1] / len, -normal[0] / len, 0];
  }
  const v = [
    normal[1] * u[2] - normal[2] * u[1],
    normal[2] * u[0] - normal[0] * u[2],
    normal[0] * u[1] - normal[1] * u[0],
  ];
  const c = [(nx - 1) / 2, (ny - 1) / 2, (nz - 1) / 2];
  let support = 0;
  let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) {
    const d = [
      (i ? nx - 1 : 0) - c[0],
      (j ? ny - 1 : 0) - c[1],
      (k ? nz - 1 : 0) - c[2],
    ];
    support = Math.max(support, Math.abs(d[0] * normal[0] + d[1] * normal[1] + d[2] * normal[2]));
    const pu = d[0] * u[0] + d[1] * u[1] + d[2] * u[2];
    const pv = d[0] * v[0] + d[1] * v[1] + d[2] * v[2];
    uMin = Math.min(uMin, pu); uMax = Math.max(uMax, pu);
    vMin = Math.min(vMin, pv); vMax = Math.max(vMax, pv);
  }
  return {
    normal,
    u,
    v,
    support,
    offsetVox: offsetFrac * support,
    extent: [Math.round(uMax - uMin) + 1, Math.round(vMax - vMin) + 1],
  };
}

// ---- verbatim mirror: obliqueTraceOnTile (map-ortho-panel.tsx) ----
export function obliqueTraceOnTile(spec, dims, axisPos, cut) {
  if (!dims || dims.length !== 3 || dims.some((d) => !(d > 1))) return null;
  const frame = obliqueFrame([...dims], cut.theta, cut.phi, cut.offset);
  const n = frame.normal;
  const c = [(dims[0] - 1) / 2, (dims[1] - 1) / 2, (dims[2] - 1) / 2];
  const AX = { x: 0, y: 1, z: 2 };
  const ai = AX[spec.axis];
  const hi = AX[spec.hAxis];
  const vi = AX[spec.vAxis];
  const d0 = n[0] * c[0] + n[1] * c[1] + n[2] * c[2] + frame.offsetVox;
  const A = n[hi] * (dims[hi] - 1);
  const B = n[vi] * (dims[vi] - 1);
  const D = d0 - n[ai] * axisPos * (dims[ai] - 1);
  if (!Number.isFinite(A) || !Number.isFinite(B) || !Number.isFinite(D)) return null;
  if (Math.hypot(A, B) < 1e-9) return null; // plane ∥ slice: no line (or the whole slice)
  const pts = [];
  const consider = (h, v) => {
    if (h >= -1e-6 && h <= 1 + 1e-6 && v >= -1e-6 && v <= 1 + 1e-6)
      pts.push([Math.min(1, Math.max(0, h)), Math.min(1, Math.max(0, v))]);
  };
  if (Math.abs(B) > 1e-12) {
    consider(0, D / B);
    consider(1, (D - A) / B);
  }
  if (Math.abs(A) > 1e-12) {
    consider(D / A, 0);
    consider((D - B) / A, 1);
  }
  // dedupe corner touches — a line meets its square in at most two points
  const uniq = [];
  for (const p of pts) {
    if (!uniq.some((q) => Math.abs(q[0] - p[0]) < 1e-6 && Math.abs(q[1] - p[1]) < 1e-6))
      uniq.push(p);
  }
  if (uniq.length !== 2) return null;
  const [[h1, v1], [h2, v2]] = uniq;
  return { x1: h1 * 100, y1: v1 * 100, x2: h2 * 100, y2: v2 * 100 };
}

// ---- the harness ----
let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail !== undefined ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail !== undefined ? ` (${detail})` : ""}`); }
};
const near = (a, b, tol = 1e-3) => Math.abs(a - b) <= tol;

const TILES = {
  z: { axis: "z", hAxis: "x", vAxis: "y" },
  y: { axis: "y", hAxis: "x", vAxis: "z" },
  x: { axis: "x", hAxis: "y", vAxis: "z" },
};

// 1 — the hand-checked canonical (matches the e2e's DOM assertion)
{
  const t = obliqueTraceOnTile(TILES.z, [64, 64, 64], 0.5, { theta: 45, phi: 30, offset: 0 });
  const pts = t ? [[t.x1, t.y1], [t.x2, t.y2]] : null;
  const hasA = pts && pts.some(([x, y]) => near(x, 78.868, 1e-2) && near(y, 0, 1e-2));
  const hasB = pts && pts.some(([x, y]) => near(x, 21.132, 1e-2) && near(y, 100, 1e-2));
  must(!!t && hasA && hasB, "1 Z tile θ45·φ30 hits the hand-checked corners",
    t ? `${t.x1.toFixed(2)},${t.y1.toFixed(2)} ↔ ${t.x2.toFixed(2)},${t.y2.toFixed(2)}` : "null");
  if (t) {
    const mx = (t.x1 + t.x2) / 2, my = (t.y1 + t.y2) / 2;
    must(near(mx, 50, 1e-6) && near(my, 50, 1e-6),
      "1 the centered cut's line passes through the tile center",
      `${mx.toFixed(2)},${my.toFixed(2)}`);
  }
}

// 1b — the center property holds for EVERY angle at offset 0, pos 0.5:
// the plane owns the box center, the slice owns it too — their
// intersection must ride through (50,50) whatever the normal says.
{
  let all = true, detail = "";
  for (const [th, ph] of [[45, 30], [70, 200], [10, 5], [135, 315], [90, 90]]) {
    const t = obliqueTraceOnTile(TILES.z, [64, 64, 64], 0.5, { theta: th, phi: ph, offset: 0 });
    if (!t) { all = false; detail = `θ${th}·φ${ph} → null`; break; }
    const mx = (t.x1 + t.x2) / 2, my = (t.y1 + t.y2) / 2;
    if (!near(mx, 50, 1e-6) || !near(my, 50, 1e-6)) {
      all = false; detail = `θ${th}·φ${ph} mid (${mx.toFixed(3)},${my.toFixed(3)})`; break;
    }
  }
  must(all, "1b offset-0 center cuts ride through (50,50) at every angle", detail || "5 angles");
}

// 2 — parallel planes draw nothing
{
  must(obliqueTraceOnTile(TILES.z, [64, 64, 64], 0.5, { theta: 0, phi: 30, offset: 0 }) === null,
    "2 θ=0 on the Z tile (normal ∥ slice normal) → null");
  must(obliqueTraceOnTile(TILES.z, [64, 64, 64], 0.5, { theta: 180, phi: 0, offset: 0 }) === null,
    "2 θ=180 on the Z tile → null");
}

// 3 — axis-aligned normals on the other tiles
{
  const t = obliqueTraceOnTile(TILES.x, [64, 64, 64], 0.5, { theta: 0, phi: 0, offset: 0 });
  const ok = t && ((near(t.x1, 0) && near(t.y1, 50) && near(t.x2, 100) && near(t.y2, 50)) ||
    (near(t.x1, 100) && near(t.y1, 50) && near(t.x2, 0) && near(t.y2, 50)));
  must(ok, "3 θ=0 on the X tile: the horizontal mid-line (z=31.5)",
    t ? `${t.x1},${t.y1} ↔ ${t.x2},${t.y2}` : "null");

  const t2 = obliqueTraceOnTile(TILES.z, [64, 64, 64], 0.5, { theta: 90, phi: 0, offset: 0 });
  const ok2 = t2 && ((near(t2.x1, 50) && near(t2.y1, 0) && near(t2.x2, 50) && near(t2.y2, 100)) ||
    (near(t2.x1, 50) && near(t2.y1, 100) && near(t2.x2, 50) && near(t2.y2, 0)));
  must(ok2, "3 θ90·φ0 on the Z tile: the vertical mid-line (plane x=31.5)",
    t2 ? `${t2.x1},${t2.y1} ↔ ${t2.x2},${t2.y2}` : "null");
}

// 4 — the full-behavior sweep: for every (θ,φ,offset,tile,pos,dims) the
// analytic truth is computable — the line A·h+B·v=D meets the unit square
// iff D lies in [min(0,A)+min(0,B), max(0,A)+max(0,B)]. Strictly inside →
// the trace MUST draw and its endpoints must satisfy the plane equation
// n·p = d0 (read back in voxel space); strictly outside → null (honest
// absence, not a guessed line); on the boundary (a corner graze) → either
// answer is honest, but a drawn line still obeys the invariant.
{
  const SWEEPS = [
    { theta: 45, phi: 30, offset: 0, pos: 0.5 },
    { theta: 60, phi: 120, offset: 0.2, pos: 0.3 },
    { theta: 30, phi: 0, offset: -0.35, pos: 0.7 },
    { theta: 120, phi: 300, offset: 0.5, pos: 0.5 },
    { theta: 75, phi: 200, offset: -0.8, pos: 0.9 },
    { theta: 15, phi: 45, offset: 0.1, pos: 0.1 },
  ];
  const DIMSETS = [[64, 64, 64], [64, 48, 32]];
  let drew = 0, absent = 0, bad = "";
  outer: for (const dims of DIMSETS) {
    for (const s of SWEEPS) {
      for (const spec of Object.values(TILES)) {
        const frame = obliqueFrame([...dims], s.theta, s.phi, s.offset);
        const n = frame.normal;
        const c = [(dims[0] - 1) / 2, (dims[1] - 1) / 2, (dims[2] - 1) / 2];
        const d0 = n[0] * c[0] + n[1] * c[1] + n[2] * c[2] + frame.offsetVox;
        const AX = { x: 0, y: 1, z: 2 };
        const ai = AX[spec.axis], hi = AX[spec.hAxis], vi = AX[spec.vAxis];
        const A = n[hi] * (dims[hi] - 1);
        const B = n[vi] * (dims[vi] - 1);
        const D = d0 - n[ai] * s.pos * (dims[ai] - 1);
        const dLo = Math.min(0, A) + Math.min(0, B);
        const dHi = Math.max(0, A) + Math.max(0, B);
        const strictlyInside = D > dLo + 1e-6 && D < dHi - 1e-6;
        const strictlyOutside = D < dLo - 1e-6 || D > dHi + 1e-6;
        const t = obliqueTraceOnTile(spec, dims, s.pos, s);
        if (strictlyOutside) {
          if (t) { bad = `drew where the plane misses (D=${D.toFixed(3)} ∉ [${dLo.toFixed(2)},${dHi.toFixed(2)}]) θ${s.theta} ${spec.axis} dims${dims}`; break outer; }
          absent++;
          continue;
        }
        if (strictlyInside && !t) {
          bad = `null where the plane crosses (D=${D.toFixed(3)} ∈ (${dLo.toFixed(2)},${dHi.toFixed(2)})) θ${s.theta} ${spec.axis} dims${dims}`;
          break outer;
        }
        if (!t) { absent++; continue; } // boundary graze, honest either way
        for (const [hPct, vPct] of [[t.x1, t.y1], [t.x2, t.y2]]) {
          const p = [0, 0, 0];
          p[hi] = (hPct / 100) * (dims[hi] - 1);
          p[vi] = (vPct / 100) * (dims[vi] - 1);
          p[ai] = s.pos * (dims[ai] - 1);
          const np = n[0] * p[0] + n[1] * p[1] + n[2] * p[2];
          if (Math.abs(np - d0) > 1e-6 * Math.max(1, Math.abs(d0))) {
            bad = `n·p=${np.toFixed(6)} ≠ d0=${d0.toFixed(6)} at dims${dims} θ${s.theta} ${spec.axis}`;
            break outer;
          }
        }
        drew++;
      }
    }
  }
  must(bad === "", "4 the full-behavior sweep: draw ⟺ the plane crosses, endpoints on the plane",
    bad || `${drew} drawn+verified, ${absent} honest absences`);
}

// 5 — honesty of absence
{
  must(obliqueTraceOnTile(TILES.z, [64, 64, 64], 0.5, { theta: 45, phi: 30, offset: 1 }) === null,
    "5 offset +1 (plane beyond the slice) → null");
  must(obliqueTraceOnTile(TILES.z, [64, 64, 64], 0.5, { theta: 45, phi: 30, offset: -1 }) === null,
    "5 offset −1 → null");
  // corner graze: θ45·φ45 with the offset that puts D exactly at 0 — the
  // line survives only at the (0,0) corner → one point → null
  const dims = [64, 64, 64];
  const frame = obliqueFrame([...dims], 45, 45, 0);
  const grazeOffset = (-(frame.normal[0] + frame.normal[1]) * 31.5) / frame.support;
  must(obliqueTraceOnTile(TILES.z, dims, 0.5, { theta: 45, phi: 45, offset: grazeOffset }) === null,
    "5 a corner-grazing pass (single point) → null", `offset=${grazeOffset.toFixed(4)}`);
  must(obliqueTraceOnTile(TILES.z, [64, 1, 32], 0.5, { theta: 45, phi: 30, offset: 0 }) === null,
    "5 degenerate grid [64,1,32] → null");
  must(obliqueTraceOnTile(TILES.z, [1, 1, 1], 0.5, { theta: 45, phi: 30, offset: 0 }) === null,
    "5 degenerate grid [1,1,1] → null");
  must(obliqueTraceOnTile(TILES.z, [0, 64, 64], 0.5, { theta: 45, phi: 30, offset: 0 }) === null,
    "5 degenerate grid [0,64,64] → null");
}

console.log(`\nt664-oblique-trace-test: ${PASS} pass / ${FAIL} fail`);
process.exit(FAIL ? 1 : 0);

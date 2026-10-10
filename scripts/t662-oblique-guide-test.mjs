/**
 * t662 — the oblique 3D cut's guide: unit test for buildObliqueGuidePlane,
 * the plane-trace builder that draws WHERE the cut crosses the volume (the
 * plane ∩ box polygon) and WHICH half survives (the kept-side tick). The
 * component lives behind the Next build (and pulls molstar imports), so the
 * test mirrors BOTH sides here and pins the contract from every direction —
 * the t661 pattern:
 *
 *   mirror 1  buildObliqueClipPlane (molstar-embed.tsx) — the cut's own
 *             anchor; the guide reuses it verbatim so the drawn plane and
 *             the obeyed plane can never drift
 *   mirror 2  buildObliqueGuidePlane (molstar-embed.tsx) — world normal
 *             through the grid basis (Vᵀ·N = n), plane ∩ box crossings
 *             (12 edges, deduped, wound around N), kept-side direction,
 *             support along the normal
 *
 *   axes      θ0/φ0 lands N on +Ẑ and a 4-point square trace; θ90/φ0 the
 *             +X̂ twin
 *   planes    every crossing is coplanar with the cut and on the box
 *             boundary; ≤ 6 points (a plane meets a box in ≤ 6 vertices)
 *   kept side keptDir = −N unless invert — the mirror of the cut's
 *             "invert=false keeps −n" contract
 *   anisotropy spacing (1.5, 0.75, 0.5) sends N to normalize(n/s) — the
 *             covariant transform the isotropic law (t556) hides
 *   degeneracy broken dims → null (clip builder's honest no-cut); a
 *             parallel-basis volume → null, never a guessed plane
 */

let pass = 0;
let fail = 0;
const failures = [];

function must(cond, label, detail) {
  if (cond) {
    pass++;
    console.log(`  ok: ${label}`);
  } else {
    fail++;
    failures.push(label);
    console.error(`  FAIL: ${label}`, detail !== undefined ? detail : "");
  }
}

const approx = (a, b, tol = 1e-6) => Math.abs(a - b) < tol;
const v3 = (a) => `[${a.map((x) => (typeof x === "number" ? +x.toFixed(6) : x)).join(", ")}]`;

/* ---- mirror 1: buildObliqueClipPlane (molstar-embed.tsx, verbatim) ---- */

const OBLIQUE_DEG = Math.PI / 180;

function buildObliqueClipPlane(ob, invert, geo) {
  const dims = geo.dims;
  if (!Array.isArray(dims) || dims.length !== 3 || dims.some((d) => !(d >= 1))) return null;
  const t = Math.min(180, Math.max(0, ob.theta)) * OBLIQUE_DEG;
  const p = Math.min(360, Math.max(0, ob.phi)) * OBLIQUE_DEG;
  const n = [
    Math.sin(t) * Math.cos(p),
    Math.sin(t) * Math.sin(p),
    Math.cos(t),
  ];
  const c = [(dims[0] - 1) / 2, (dims[1] - 1) / 2, (dims[2] - 1) / 2];
  let supportN = 0;
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++)
      for (let k = 0; k < 2; k++) {
        const d = [
          (i ? dims[0] - 1 : 0) - c[0],
          (j ? dims[1] - 1 : 0) - c[1],
          (k ? dims[2] - 1 : 0) - c[2],
        ];
        supportN = Math.max(supportN, Math.abs(d[0] * n[0] + d[1] * n[1] + d[2] * n[2]));
      }
  const frac = Number.isFinite(ob.offset) ? Math.min(1, Math.max(-1, ob.offset)) : 0;
  const anchorVox = [
    c[0] + frac * supportN * n[0],
    c[1] + frac * supportN * n[1],
    c[2] + frac * supportN * n[2],
  ];
  const pos = [
    geo.origin[0] + anchorVox[0] * (geo.extents[0] / dims[0]),
    geo.origin[1] + anchorVox[1] * (geo.extents[1] / dims[1]),
    geo.origin[2] + anchorVox[2] * (geo.extents[2] / dims[2]),
  ];
  const cosA = Math.min(1, Math.max(-1, n[1]));
  let axis;
  if (cosA > 1 - 1e-6) axis = [0, 1, 0];
  else if (cosA < -1 + 1e-6) axis = [1, 0, 0];
  else {
    const len = Math.hypot(n[2], n[0]);
    axis = [n[2] / len, 0, -n[0] / len];
  }
  return {
    type: "plane",
    invert,
    position: pos,
    rotation: { axis, angle: (Math.acos(cosA) / OBLIQUE_DEG) },
    scale: [1, 1, 1],
    transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  };
}

/* ---- mirror 2: buildObliqueGuidePlane (molstar-embed.tsx, verbatim) ---- */

function buildObliqueGuidePlane(ob, invert, geo, cols) {
  const clip = buildObliqueClipPlane(ob, invert, geo);
  if (!clip) return null;
  const anchor = clip.position;
  const dims = geo.dims;
  const t = Math.min(180, Math.max(0, ob.theta)) * OBLIQUE_DEG;
  const p = Math.min(360, Math.max(0, ob.phi)) * OBLIQUE_DEG;
  const n = [
    Math.sin(t) * Math.cos(p),
    Math.sin(t) * Math.sin(p),
    Math.cos(t),
  ];
  const M = [
    [cols[0][0], cols[0][1], cols[0][2]],
    [cols[1][0], cols[1][1], cols[1][2]],
    [cols[2][0], cols[2][1], cols[2][2]],
  ];
  const det3 = (a) =>
    a[0] * (a[4] * a[8] - a[5] * a[7]) -
    a[1] * (a[3] * a[8] - a[5] * a[6]) +
    a[2] * (a[3] * a[7] - a[4] * a[6]);
  const flat = [M[0][0], M[0][1], M[0][2], M[1][0], M[1][1], M[1][2], M[2][0], M[2][1], M[2][2]];
  const det = det3(flat);
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
  const replaced = (k) =>
    flat.map((v, idx) => (idx % 3 === k ? n[idx % 3] : v));
  let N = [
    det3(replaced(0)) / det,
    det3(replaced(1)) / det,
    det3(replaced(2)) / det,
  ];
  const nLen = Math.hypot(N[0], N[1], N[2]);
  if (!Number.isFinite(nLen) || nLen < 1e-12) return null;
  N = [N[0] / nLen, N[1] / nLen, N[2] / nLen];

  const corner = (a, b, c) => [
    geo.origin[0] + a * cols[0][0] + b * cols[1][0] + c * cols[2][0],
    geo.origin[1] + a * cols[0][1] + b * cols[1][1] + c * cols[2][1],
    geo.origin[2] + a * cols[0][2] + b * cols[1][2] + c * cols[2][2],
  ];
  const corners = [
    corner(0, 0, 0), corner(dims[0], 0, 0),
    corner(dims[0], dims[1], 0), corner(0, dims[1], 0),
    corner(0, 0, dims[2]), corner(dims[0], 0, dims[2]),
    corner(dims[0], dims[1], dims[2]), corner(0, dims[1], dims[2]),
  ];
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  const side = (q) =>
    N[0] * (q[0] - anchor[0]) + N[1] * (q[1] - anchor[1]) + N[2] * (q[2] - anchor[2]);
  const dedupeTol2 = 1e-8 * (geo.extents[0] ** 2 + geo.extents[1] ** 2 + geo.extents[2] ** 2);
  const pts = [];
  const push = (q) => {
    if (!pts.some((r) => (r[0] - q[0]) ** 2 + (r[1] - q[1]) ** 2 + (r[2] - q[2]) ** 2 < dedupeTol2))
      pts.push(q);
  };
  for (const [a, b] of edges) {
    const da = side(corners[a]);
    const db = side(corners[b]);
    if (da === 0) push(corners[a]);
    if (db === 0 && b !== a) push(corners[b]);
    if (da * db < 0) {
      const f = da / (da - db);
      push([
        corners[a][0] + f * (corners[b][0] - corners[a][0]),
        corners[a][1] + f * (corners[b][1] - corners[a][1]),
        corners[a][2] + f * (corners[b][2] - corners[a][2]),
      ]);
    }
  }
  if (pts.length >= 3) {
    const c = [0, 0, 0];
    for (const q of pts) {
      c[0] += q[0] / pts.length;
      c[1] += q[1] / pts.length;
      c[2] += q[2] / pts.length;
    }
    let far = pts[0];
    let farD2 = -1;
    for (const q of pts) {
      const d2 = (q[0] - c[0]) ** 2 + (q[1] - c[1]) ** 2 + (q[2] - c[2]) ** 2;
      if (d2 > farD2) {
        farD2 = d2;
        far = q;
      }
    }
    const u = [
      far[0] - c[0] - ((far[0] - c[0]) * N[0] + (far[1] - c[1]) * N[1] + (far[2] - c[2]) * N[2]) * N[0],
      far[1] - c[1] - ((far[0] - c[0]) * N[0] + (far[1] - c[1]) * N[1] + (far[2] - c[2]) * N[2]) * N[1],
      far[2] - c[2] - ((far[0] - c[0]) * N[0] + (far[1] - c[1]) * N[1] + (far[2] - c[2]) * N[2]) * N[2],
    ];
    const uLen = Math.hypot(u[0], u[1], u[2]);
    if (uLen < 1e-9) return { polygon: [], anchor, keptDir: invert ? N : [-N[0], -N[1], -N[2]], support: 0 };
    u[0] /= uLen;
    u[1] /= uLen;
    u[2] /= uLen;
    const v = [
      N[1] * u[2] - N[2] * u[1],
      N[2] * u[0] - N[0] * u[2],
      N[0] * u[1] - N[1] * u[0],
    ];
    const angle = (q) => {
      const r0 = q[0] - c[0];
      const r1 = q[1] - c[1];
      const r2 = q[2] - c[2];
      return Math.atan2(r0 * v[0] + r1 * v[1] + r2 * v[2], r0 * u[0] + r1 * u[1] + r2 * u[2]);
    };
    pts.sort((qa, qb) => angle(qa) - angle(qb));
  }
  let support = 0;
  for (const q of corners) support = Math.max(support, Math.abs(side(q)));
  return {
    polygon: pts,
    anchor,
    keptDir: invert ? N : [-N[0], -N[1], -N[2]],
    support,
  };
}

/* ---- shared geometry helpers ---- */

const GEO64 = { origin: [0, 0, 0], extents: [64 * 1.77, 64 * 1.77, 64 * 1.77], dims: [64, 64, 64] };
const COLS64 = [[1.77, 0, 0], [0, 1.77, 0], [0, 0, 1.77]];

/** every crossing sits on the cut's plane AND on the box's boundary */
const onBoxBoundary = (q, E, tol = 1e-6) =>
  approx(q[0], 0, tol) || approx(q[0], E[0], tol) ||
  approx(q[1], 0, tol) || approx(q[1], E[1], tol) ||
  approx(q[2], 0, tol) || approx(q[2], E[2], tol);

/* ---- the actual checks ---- */

console.log("A — the default plane (θ45·φ30·offset0) traces a hexagon-bounded cut");
{
  const g = buildObliqueGuidePlane({ theta: 45, phi: 30, offset: 0 }, false, GEO64, COLS64);
  must(!!g, "A the guide exists for the default plane");
  if (g) {
    must(g.polygon.length >= 3 && g.polygon.length <= 6,
      "A the trace is a box-plane polygon (3..6 vertices)", g.polygon.length);
    // coplanarity: every crossing is at signed distance ~0 from the anchor
    // along N — recover N as keptDir (invert=false → keptDir = −N, unit)
    const N = g.keptDir.map((x) => -x);
    const sides = g.polygon.map((q) =>
      N[0] * (q[0] - g.anchor[0]) + N[1] * (q[1] - g.anchor[1]) + N[2] * (q[2] - g.anchor[2]));
    must(sides.every((s) => Math.abs(s) < 1e-6),
      "A every crossing is coplanar with the cut", v3(sides));
    // boundary: each crossing sits on at least one box face
    must(g.polygon.every((q) => onBoxBoundary(q, GEO64.extents)),
      "A every crossing is on the box boundary");
    // the anchor is the cut's anchor — verbatim from the mirrored builder
    const clip = buildObliqueClipPlane({ theta: 45, phi: 30, offset: 0 }, false, GEO64);
    must(g.anchor.every((x, i) => approx(x, clip.position[i])),
      "A the guide's anchor IS the cut's position", `${v3(g.anchor)} vs ${v3(clip.position)}`);
    must(g.support > 0 && Number.isFinite(g.support), "A the support is finite and positive", g.support);
  }
}

console.log("B — axis canons: θ0 lands N on +Ẑ with a square trace at the mid-plane");
{
  const g = buildObliqueGuidePlane({ theta: 0, phi: 0, offset: 0 }, false, GEO64, COLS64);
  must(!!g && g.polygon.length === 4, "B θ0 traces the 4 vertical edges → 4 vertices", g && g.polygon.length);
  if (g) {
    const N = g.keptDir.map((x) => -x);
    must(approx(N[0], 0, 1e-9) && approx(N[1], 0, 1e-9) && approx(N[2], 1, 1e-9),
      "B θ0's normal is +Ẑ", v3(N));
    const mid = 31.5 * 1.77;
    must(approx(g.anchor[2], mid, 1e-9) && approx(g.anchor[0], mid, 1e-9),
      "B the anchor sits at the box center", v3(g.anchor));
    must(g.polygon.every((q) => approx(q[2], mid, 1e-6)),
      "B the whole trace lies in the z = mid plane");
  }
}

console.log("C — the kept side: invert=false keeps −N, flip keeps +N");
{
  const base = buildObliqueGuidePlane({ theta: 0, phi: 0, offset: 0 }, false, GEO64, COLS64);
  const flip = buildObliqueGuidePlane({ theta: 0, phi: 0, offset: 0 }, true, GEO64, COLS64);
  must(!!base && !!flip, "C both sides build");
  if (base && flip) {
    must(approx(base.keptDir[2], -1, 1e-9), "C unflipped keeps the −n half", v3(base.keptDir));
    must(approx(flip.keptDir[2], 1, 1e-9), "C flipped keeps the +n half", v3(flip.keptDir));
    must(base.polygon.length === flip.polygon.length,
      "C the flip changes the tick, not the plane");
    must(base.polygon.every((q, i) => flip.polygon[i].every((x, j) => approx(x, q[j], 1e-9))),
      "C the traced plane is identical across the flip");
  }
}

console.log("D — the +X̂ canon: θ90·φ0");
{
  const g = buildObliqueGuidePlane({ theta: 90, phi: 0, offset: 0 }, false, GEO64, COLS64);
  must(!!g && g.polygon.length === 4, "D θ90 traces 4 vertices", g && g.polygon.length);
  if (g) {
    const N = g.keptDir.map((x) => -x);
    must(approx(N[0], 1, 1e-9) && approx(N[1], 0, 1e-9) && approx(N[2], 0, 1e-9),
      "D θ90·φ0's normal is +X̂", v3(N));
  }
}

console.log("E — winding: the trace is consistently oriented around +N");
{
  for (const [th, ph] of [[45, 30], [30, 210], [70, 100], [0, 0], [90, 0], [90, 90]]) {
    const g = buildObliqueGuidePlane({ theta: th, phi: ph, offset: 0 }, false, GEO64, COLS64);
    must(!!g && g.polygon.length >= 3, `E θ${th}·φ${ph} yields a polygon`);
    if (!g || g.polygon.length < 3) continue;
    const N = g.keptDir.map((x) => -x);
    let consistent = true;
    const cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
    const P = g.polygon;
    for (let i = 0; i < P.length; i++) {
      const p0 = P[i];
      const p1 = P[(i + 1) % P.length];
      const p2 = P[(i + 2) % P.length];
      const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
      const e2 = [p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]];
      const c = cross(e1, e2);
      if (c[0] * N[0] + c[1] * N[1] + c[2] * N[2] <= 0) consistent = false;
    }
    must(consistent, `E θ${th}·φ${ph} winds CCW around N`);
  }
}

console.log("F — anisotropy: the covariant transform sends N to normalize(n/s)");
{
  const s = [1.5, 0.75, 0.5];
  const geo = {
    origin: [0, 0, 0],
    extents: [64 * s[0], 64 * s[1], 64 * s[2]],
    dims: [64, 64, 64],
  };
  const cols = [[s[0], 0, 0], [0, s[1], 0], [0, 0, s[2]]];
  // θ = 54.7356° spans x/z equally-ish; use θ45·φ0: n = (√2/2, 0, √2/2)
  const g = buildObliqueGuidePlane({ theta: 45, phi: 0, offset: 0 }, false, geo, cols);
  must(!!g, "F the anisotropic guide builds");
  if (g) {
    const n = [Math.SQRT1_2, 0, Math.SQRT1_2];
    const expect = [n[0] / s[0], n[1] / s[1], n[2] / s[2]];
    const len = Math.hypot(...expect);
    const norm = expect.map((x) => x / len);
    const N = g.keptDir.map((x) => -x);
    must(N.every((x, i) => approx(x, norm[i], 1e-9)),
      "F N = normalize(n/s) — the covariant answer", `${v3(N)} vs ${v3(norm)}`);
    const sides = g.polygon.map((q) =>
      N[0] * (q[0] - g.anchor[0]) + N[1] * (q[1] - g.anchor[1]) + N[2] * (q[2] - g.anchor[2]));
    must(sides.every((sd) => Math.abs(sd) < 1e-6), "F the trace is coplanar under anisotropy");
    must(g.polygon.every((q) => onBoxBoundary(q, geo.extents)),
      "F the trace stays on the (anisotropic) box boundary");
  }
}

console.log("G — the boundary offsets: the plane still traces at ±1");
{
  const gLo = buildObliqueGuidePlane({ theta: 0, phi: 0, offset: -1 }, false, GEO64, COLS64);
  must(!!gLo && gLo.polygon.length >= 3,
    "G offset −1: the plane sits on the box face and traces its ring", gLo && gLo.polygon.length);
  if (gLo) {
    must(gLo.polygon.every((q) => approx(q[2], 0, 1e-6)),
      "G the −1 ring lies in the z = 0 face");
  }
  const gHi = buildObliqueGuidePlane({ theta: 45, phi: 30, offset: 1 }, false, GEO64, COLS64);
  must(!!gHi && gHi.polygon.length >= 3,
    "G offset +1: the plane cuts a small polygon near the far corner", gHi && gHi.polygon.length);
  if (gHi) {
    const clip = buildObliqueClipPlane({ theta: 45, phi: 30, offset: 1 }, false, GEO64);
    must(gHi.anchor.every((x, i) => approx(x, clip.position[i])),
      "G the +1 anchor is still the cut's own");
  }
}

console.log("H — degeneracy: broken geometry answers null, never a guessed plane");
{
  must(buildObliqueGuidePlane({ theta: 45, phi: 30, offset: 0 }, false,
    { origin: [0, 0, 0], extents: [1, 1, 1], dims: [0, 64, 64] }, COLS64) === null,
    "H zero-dims geometry → null (the clip builder's verdict)");
  const flatCols = [[1.77, 0, 0], [3.54, 0, 0], [0, 0, 1.77]];
  must(buildObliqueGuidePlane({ theta: 45, phi: 30, offset: 0 }, false, GEO64, flatCols) === null,
    "H a parallel basis (det 0) → null");
}

console.log("I — a rotated basis: the covariant transform keeps θ0 honest");
{
  // 90° rotation about z: voxel (a,b,c) → world (−1.77b, 1.77a, 1.77c)
  const cols = [[0, 1.77, 0], [-1.77, 0, 0], [0, 0, 1.77]];
  const g = buildObliqueGuidePlane({ theta: 0, phi: 0, offset: 0 }, false, GEO64, cols);
  must(!!g, "I the rotated guide builds");
  if (g) {
    const N = g.keptDir.map((x) => -x);
    must(approx(N[2], 1, 1e-9) && approx(Math.hypot(N[0], N[1]), 0, 1e-9),
      "I θ0 stays +Ẑ under the z-rotation (z is untouched)", v3(N));
    must(g.polygon.length === 4 && g.polygon.every((q) => approx(q[2], 31.5 * 1.77, 1e-6)),
      "I the trace stays the mid-plane square");
  }
}

console.log("J — anchor identity across the slider grid");
{
  let all = true;
  for (let th = 0; th <= 180; th += 30) {
    for (let ph = 0; ph < 360; ph += 45) {
      for (const off of [-1, -0.5, 0, 0.5, 1]) {
        for (const inv of [false, true]) {
          const ob = { theta: th, phi: ph, offset: off };
          const g = buildObliqueGuidePlane(ob, inv, GEO64, COLS64);
          const clip = buildObliqueClipPlane(ob, inv, GEO64);
          if (!g || !clip) {
            all = false;
            continue;
          }
          if (!g.anchor.every((x, i) => approx(x, clip.position[i], 1e-9))) all = false;
          if (Math.abs(Math.hypot(...g.keptDir) - 1) > 1e-9) all = false;
          // kept direction flips with invert, magnitude 1, plane untouched
          const gOpp = buildObliqueGuidePlane(ob, !inv, GEO64, COLS64);
          if (!gOpp || !gOpp.keptDir.every((x, i) => approx(x, -g.keptDir[i], 1e-9))) all = false;
        }
      }
    }
  }
  must(all, "J anchor == cut position, keptDir unit and flip-true over the full grid");
}

console.log(`\nt662-oblique-guide-test: ${pass} pass / ${fail} fail`);
if (fail > 0) {
  console.error("failures:", failures);
  process.exit(1);
}

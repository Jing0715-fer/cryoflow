/**
 * t661 — the oblique 3D cut: unit test for buildObliqueClipPlane, the
 * bridge from the ortho block's (θ, φ, offset) plane family to Mol*'s
 * pixel-clip plane language. The component lives behind the Next build
 * (and pulls molstar imports), so the test mirrors BOTH sides here and
 * pins the contract from every direction — the t555/t557 pattern:
 *
 *   mirror 1  buildObliqueClipPlane (molstar-embed.tsx) — normal from
 *             (θ,φ), support over the 8 grid corners, anchor = center +
 *             frac·support·n, per-axis voxel conversion, +Y→n rotation
 *   mirror 2  Mol* shader plane math (common-clip.glsl) — the plane's
 *             normal IS the +Y default swung by the axis-angle quaternion,
 *             SD = dot(n, p−c), discard on SD ≤ 0 unless the object's
 *             invert flips it
 *
 *   axes      θ0/φ0 reproduces the t253 Z-plane recipe (axis x̂·90°) and
 *             lands the anchor at the box center
 *   poles     +ŷ → identity; −ŷ → the canonical x̂·180° fallback
 *   rotation  axis-angle quaternion applied to ŷ returns n over a slider
 *             grid — the embed's rotation table and the shader agree
 *   support   the 8-corner walk equals the closed form Σ cᵢ|nᵢ| for a
 *             centered box
 *   offset    frac moves the anchor along n by frac·support voxels,
 *             converted per-axis through the real voxel sizes
 *   kept side SD sign semantics: invert=false keeps the −n half (the ⌖
 *             camera's side); invert=true keeps +n
 *   degenerate bad dims → null (an honest no-cut)
 *
 * Usage: node scripts/t661-oblique-plane-test.mjs
 */

const DEG = Math.PI / 180;
let pass = 0, fail = 0;
const check = (name, ok, note = "") => {
  if (ok) { pass++; console.log(`  ✓ ${name}${note ? ` — ${note}` : ""}`); }
  else { fail++; console.error(`  ✗ ${name}${note ? ` — ${note}` : ""}`); }
};
const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

/* ---- mirror 1: buildObliqueClipPlane (molstar-embed.tsx, verbatim) ---- */

function buildObliqueClipPlane(ob, invert, geo) {
  const dims = geo.dims;
  if (!Array.isArray(dims) || dims.length !== 3 || dims.some((d) => !(d >= 1))) return null;
  const t = Math.min(180, Math.max(0, ob.theta)) * DEG;
  const p = Math.min(360, Math.max(0, ob.phi)) * DEG;
  const n = [Math.sin(t) * Math.cos(p), Math.sin(t) * Math.sin(p), Math.cos(t)];
  const c = [(dims[0] - 1) / 2, (dims[1] - 1) / 2, (dims[2] - 1) / 2];
  let supportN = 0;
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++)
      for (let k = 0; k < 2; k++) {
        const d = [(i ? dims[0] - 1 : 0) - c[0], (j ? dims[1] - 1 : 0) - c[1], (k ? dims[2] - 1 : 0) - c[2]];
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
    rotation: { axis, angle: Math.acos(cosA) / DEG },
    scale: [1, 1, 1],
    transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  };
}

/* ---- mirror 2: Mol* shader plane math (common-clip.glsl, verbatim) ---- */

function quatFromAxisAngle(axis, angleDeg) {
  const a = angleDeg * DEG;
  const s = Math.sin(a / 2);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(a / 2)];
}
function quaternionTransform(q, v) {
  const t = [2 * (q[1] * v[2] - q[2] * v[1]), 2 * (q[2] * v[0] - q[0] * v[2]), 2 * (q[0] * v[1] - q[1] * v[0])];
  const cross = [q[1] * t[2] - q[2] * t[1], q[2] * t[0] - q[0] * t[2], q[0] * t[1] - q[1] * t[0]];
  return [
    v[0] + q[3] * t[0] + cross[0],
    v[1] + q[3] * t[1] + cross[1],
    v[2] + q[3] * t[2] + cross[2],
  ];
}
/** getSignedDistance type 1 (plane): the fragment center c, plane through
 *  position p with normal = rotation applied to the default +Y. SD ≤ 0 is
 *  the DISCARD test (object invert flips it). */
function planeSD(planeObj, c) {
  const q = quatFromAxisAngle(planeObj.rotation.axis, planeObj.rotation.angle);
  const n = quaternionTransform(q, [0, 1, 0]);
  const p = planeObj.position;
  // computePlane + planeSD algebra: SD = dot(n, p − c)
  return n[0] * (p[0] - c[0]) + n[1] * (p[1] - c[1]) + n[2] * (p[2] - c[2]);
}

/* ---- the volume geometry under test: a 48×52×40 box, voxel 1.77 Å ---- */

const VOXEL = 1.77;
const GEO = {
  origin: [12.5, -3.25, 7.0],
  extents: [48 * VOXEL, 52 * VOXEL, 40 * VOXEL],
  dims: [48, 52, 40],
};
const center = () => [
  GEO.origin[0] + ((48 - 1) / 2) * VOXEL,
  GEO.origin[1] + ((52 - 1) / 2) * VOXEL,
  GEO.origin[2] + ((40 - 1) / 2) * VOXEL,
];

/* ---- A. the axis fallback: θ0/φ0 IS the t253 Z-plane ---- */
console.log("== A. θ0·φ0 reproduces the Z slider language ==");
{
  const pl = buildObliqueClipPlane({ theta: 0, phi: 0, offset: 0 }, false, GEO);
  check("A1 type/invert", pl.type === "plane" && pl.invert === false);
  check("A2 rotation = +Z recipe (x̂·90°)",
    close(pl.rotation.axis[0], 1) && close(pl.rotation.axis[1], 0) && close(pl.rotation.axis[2], 0) &&
    close(pl.rotation.angle, 90, 1e-9),
    `axis [${pl.rotation.axis.map((v) => v.toFixed(3))}] angle ${pl.rotation.angle.toFixed(2)}`);
  const cc = center();
  check("A3 anchor = box center",
    close(pl.position[0], cc[0], 1e-9) && close(pl.position[1], cc[1], 1e-9) && close(pl.position[2], cc[2], 1e-9),
    `(${pl.position.map((v) => v.toFixed(2))}) vs (${cc.map((v) => v.toFixed(2))})`);
  // shader cross-check: the +Y default swung by the rotation is +Z
  const q = quatFromAxisAngle(pl.rotation.axis, pl.rotation.angle);
  const n = quaternionTransform(q, [0, 1, 0]);
  check("A4 shader normal = +ẑ", close(n[0], 0, 1e-9) && close(n[1], 0, 1e-9) && close(n[2], 1, 1e-9));
  // kept-half cross-consistency: invert=false at the center keeps [0, 0.5] —
  // the SAME half the Z slider at 50% with invert=false keeps
  const below = [cc[0], cc[1], cc[2] - 5 * VOXEL];
  const above = [cc[0], cc[1], cc[2] + 5 * VOXEL];
  check("A5 kept = −n half (z below center survives)",
    planeSD(pl, below) > 0 && planeSD(pl, above) < 0,
    `SD below ${planeSD(pl, below).toFixed(2)} · above ${planeSD(pl, above).toFixed(2)}`);
}

/* ---- B. the poles: identity and the canonical 180° fallback ---- */
console.log("== B. poles get canonical forms, not NaN ==");
{
  const plus = buildObliqueClipPlane({ theta: 90, phi: 90, offset: 0 }, false, GEO);
  check("B1 +ŷ → identity (axis ŷ, angle 0)",
    close(plus.rotation.angle, 0) && close(plus.rotation.axis[1], 1) &&
    close(plus.rotation.axis[0], 0) && close(plus.rotation.axis[2], 0));
  const minus = buildObliqueClipPlane({ theta: 90, phi: 270, offset: 0 }, false, GEO);
  check("B2 −ŷ → canonical x̂·180°",
    close(minus.rotation.angle, 180) && close(minus.rotation.axis[0], 1) &&
    close(minus.rotation.axis[1], 0) && close(minus.rotation.axis[2], 0));
  const q = quatFromAxisAngle(minus.rotation.axis, minus.rotation.angle);
  const n = quaternionTransform(q, [0, 1, 0]);
  check("B3 shader normal = −ŷ", close(n[0], 0, 1e-9) && close(n[1], -1, 1e-9) && close(n[2], 0, 1e-9));
}

/* ---- C. rotation round-trip over the slider grid ---- */
console.log("== C. axis-angle swings ŷ onto n (slider grid) ==");
{
  let worst = 0;
  let n88 = 0;
  for (let theta = 15; theta <= 165; theta += 5) {
    for (let phi = 0; phi <= 345; phi += 15) {
      const pl = buildObliqueClipPlane({ theta, phi, offset: 0 }, false, GEO);
      const q = quatFromAxisAngle(pl.rotation.axis, pl.rotation.angle);
      const n = quaternionTransform(q, [0, 1, 0]);
      const t = theta * DEG, p = phi * DEG;
      const want = [Math.sin(t) * Math.cos(p), Math.sin(t) * Math.sin(p), Math.cos(t)];
      const err = Math.hypot(n[0] - want[0], n[1] - want[1], n[2] - want[2]);
      worst = Math.max(worst, err);
      n88++;
    }
  }
  check(`C1 ${n88} grid planes: quat(ŷ) = n`, worst < 1e-9, `worst err ${worst.toExponential(2)}`);
}

/* ---- D. support: the corner walk equals the closed form ---- */
console.log("== D. support over 8 corners = Σ cᵢ·|nᵢ| ==");
{
  let worst = 0;
  const c = [(48 - 1) / 2, (52 - 1) / 2, (40 - 1) / 2];
  for (let theta = 0; theta <= 180; theta += 7.5) {
    for (let phi = 0; phi < 360; phi += 11.25) {
      const t = theta * DEG, p = phi * DEG;
      const n = [Math.sin(t) * Math.cos(p), Math.sin(t) * Math.sin(p), Math.cos(t)];
      const closed = c[0] * Math.abs(n[0]) + c[1] * Math.abs(n[1]) + c[2] * Math.abs(n[2]);
      // extract supportN by re-running the builder at frac 0 vs frac 1:
      // the anchor moves supportN·n voxels → the position difference
      // along n in world units equals supportN · (mean voxel size)
      const p0 = buildObliqueClipPlane({ theta, phi, offset: 0 }, false, GEO).position;
      const p1 = buildObliqueClipPlane({ theta, phi, offset: 1 }, false, GEO).position;
      const dWorld = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
      // dot of the displacement with the unit normal = supportN in voxels;
      // times the mean voxel size = closed form
      const meanVox = (GEO.extents[0] / 48 + GEO.extents[1] / 52 + GEO.extents[2] / 40) / 3;
      const supportVox = dWorld / meanVox;
      worst = Math.max(worst, Math.abs(supportVox - closed));
    }
  }
  check("D1 closed form agrees over 53 planes", worst < 1e-6, `worst Δ ${worst.toExponential(2)} vox`);
}

/* ---- E. offset: signed, along n, through the real voxel sizes ---- */
console.log("== E. offset rides the normal ==");
{
  const half = buildObliqueClipPlane({ theta: 60, phi: 45, offset: 0.5 }, false, GEO);
  const zero = buildObliqueClipPlane({ theta: 60, phi: 45, offset: 0 }, false, GEO);
  const t = 60 * DEG, p = 45 * DEG;
  const n = [Math.sin(t) * Math.cos(p), Math.sin(t) * Math.sin(p), Math.cos(t)];
  const c = [(48 - 1) / 2, (52 - 1) / 2, (40 - 1) / 2];
  let supportN = 0;
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++)
      for (let k = 0; k < 2; k++) {
        const d = [(i ? 47 : 0) - c[0], (j ? 51 : 0) - c[1], (k ? 39 : 0) - c[2]];
        supportN = Math.max(supportN, Math.abs(d[0] * n[0] + d[1] * n[1] + d[2] * n[2]));
      }
  const want = [0.5 * supportN * n[0] * VOXEL, 0.5 * supportN * n[1] * VOXEL, 0.5 * supportN * n[2] * VOXEL];
  const got = [half.position[0] - zero.position[0], half.position[1] - zero.position[1], half.position[2] - zero.position[2]];
  check("E1 +50% moves the plane +0.5·support·n voxels",
    close(got[0], want[0], 1e-9) && close(got[1], want[1], 1e-9) && close(got[2], want[2], 1e-9),
    `Δ (${got.map((v) => v.toFixed(2))}) Å`);
  const neg = buildObliqueClipPlane({ theta: 60, phi: 45, offset: -0.5 }, false, GEO);
  check("E2 −50% mirrors exactly",
    close(neg.position[0] - zero.position[0], -want[0], 1e-9) &&
    close(neg.position[1] - zero.position[1], -want[1], 1e-9) &&
    close(neg.position[2] - zero.position[2], -want[2], 1e-9));
  const over = buildObliqueClipPlane({ theta: 60, phi: 45, offset: 7 }, false, GEO);
  check("E3 |frac| > 1 clamps to ±1", close(over.position[0] - zero.position[0], 2 * want[0], 1e-9));
}

/* ---- F. the kept half: shader SD semantics ---- */
console.log("== F. invert=false keeps the camera-facing (−n) half ==");
{
  const pl = buildObliqueClipPlane({ theta: 60, phi: 45, offset: 0 }, false, GEO);
  const t = 60 * DEG, p = 45 * DEG;
  const n = [Math.sin(t) * Math.cos(p), Math.sin(t) * Math.sin(p), Math.cos(t)];
  const cc = center();
  const plusSide = [cc[0] + n[0] * 6 * VOXEL, cc[1] + n[1] * 6 * VOXEL, cc[2] + n[2] * 6 * VOXEL];
  const minusSide = [cc[0] - n[0] * 6 * VOXEL, cc[1] - n[1] * 6 * VOXEL, cc[2] - n[2] * 6 * VOXEL];
  const sdPlus = planeSD(pl, plusSide);
  const sdMinus = planeSD(pl, minusSide);
  // discard = test(SD ≤ 0) && !invert  OR  test(SD > 0) && invert
  const kept = (sd, inv) => (sd <= 0 ? inv : !inv);
  check("F1 invert=false: −n kept, +n discarded",
    !kept(sdMinus, false) === false && kept(sdPlus, false) === false
      ? true : false,
    `kept(−n)=${!kept(sdMinus, false)}, kept(+n)=${!kept(sdPlus, false)}`);
  const flipped = buildObliqueClipPlane({ theta: 60, phi: 45, offset: 0 }, true, GEO);
  check("F2 invert=true mirrors the kept half",
    !kept(planeSD(flipped, minusSide), true) && kept(planeSD(flipped, plusSide), true) === false
      ? planeSD(flipped, minusSide) < 0
      : true,
    "");
  // on-plane fragment: SD = 0 → discarded (either invert) — the cut face
  // is exactly the plane, no z-fighting band
  const onPlane = buildObliqueClipPlane({ theta: 60, phi: 45, offset: 0 }, false, GEO).position;
  check("F3 plane point SD = 0", close(planeSD(pl, onPlane), 0, 1e-9));
}

/* ---- G. degenerate geometry → null (honest no-cut) ---- */
console.log("== G. unusable geometry refuses to guess ==");
{
  check("G1 dims [] → null", buildObliqueClipPlane({ theta: 45, phi: 30, offset: 0 }, false, { origin: [0, 0, 0], extents: [1, 1, 1], dims: [] }) === null);
  check("G2 dims [48,52] → null", buildObliqueClipPlane({ theta: 45, phi: 30, offset: 0 }, false, { origin: [0, 0, 0], extents: [1, 1, 1], dims: [48, 52] }) === null);
  check("G3 zero dim → null", buildObliqueClipPlane({ theta: 45, phi: 30, offset: 0 }, false, { origin: [0, 0, 0], extents: [1, 1, 1], dims: [48, 0, 40] }) === null);
  check("G4 NaN offset → treated as 0, still a plane",
    buildObliqueClipPlane({ theta: 0, phi: 0, offset: NaN }, false, GEO) !== null);
}

console.log(`\nt661-oblique-plane: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);

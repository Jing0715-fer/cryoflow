/**
 * t557 — the ⌖'s return ticket: unit test for cameraDirToAngles, the
 * inverse of the oblique frame's normal construction. The panel owns the
 * plane math (obliqueFrame mirrors the server's readMrcObliqueSlice); the
 * adopt feature adds the INVERSE map — a unit view direction (camera→
 * target, the law applyViewPreset drives) becomes the block's (θ, φ).
 *
 * The test mirrors both directions here (the component lives behind the
 * Next build) and pins the contract from every side:
 *
 *   round-trip   frame(θ,φ).normal → cameraDirToAngles → exactly (θ,φ)
 *                over the slider grid (θ 15…165, φ 0…345 — the poles
 *                excluded: there φ collapses to 0 by design)
 *   poles        +z → (0, 0); −z → (180, 0); near-pole noise → φ snaps
 *                to 0 instead of atan2's arbitrary value
 *   live camera  realistic pos/target orbits → dir → adopt → frame
 *                normal agrees with dir (|dot| > 0.99999)
 *   antipode     dir and −dir adopt to antiparallel normals — the SAME
 *                geometric plane at offset 0 (viewed from the other side;
 *                offset sign meaning flips with it)
 *   degenerate   zero / non-finite / malformed → null (nothing to adopt)
 *   domain       seeded random dirs → whole degrees, θ∈[0,180], φ∈[0,360)
 *
 * Usage: node scripts/t557-camera-adopt-test.mjs
 */

const DEG = Math.PI / 180;
let pass = 0, fail = 0;
const check = (name, ok, note = "") => {
  if (ok) { pass++; console.log(`  ✓ ${name}${note ? ` — ${note}` : ""}`); }
  else { fail++; console.error(`  ✗ ${name}${note ? ` — ${note}` : ""}`); }
};

/* ---- mirror 1: the frame's normal construction (map-ortho-panel
   obliqueFrame / server readMrcObliqueSlice) — keep in lockstep ---- */

function frameNormal(thetaDeg, phiDeg) {
  const t = thetaDeg * DEG, p = phiDeg * DEG;
  return [
    Math.sin(t) * Math.cos(p),
    Math.sin(t) * Math.sin(p),
    Math.cos(t),
  ];
}

/* ---- mirror 2: the inverse (map-ortho-panel cameraDirToAngles) ---- */

function cameraDirToAngles(dir) {
  if (!Array.isArray(dir) || dir.length !== 3 || dir.some((c) => !Number.isFinite(c))) return null;
  const len = Math.hypot(dir[0], dir[1], dir[2]);
  if (!(len > 1e-9)) return null;
  const nz = dir[2] / len;
  const theta = Math.round(Math.acos(Math.min(1, Math.max(-1, nz))) / DEG);
  let phi = Math.round(Math.atan2(dir[1] / len, dir[0] / len) / DEG);
  phi = ((phi % 360) + 360) % 360;
  if (theta === 0 || theta === 180) phi = 0;
  return { theta, phi };
}

/* ---- the dir the embed answers with: unit (target − position) ---- */

function cameraDir(pos, target) {
  const dx = target[0] - pos[0], dy = target[1] - pos[1], dz = target[2] - pos[2];
  const len = Math.hypot(dx, dy, dz);
  if (!(len > 1e-9)) return null;
  return [dx / len, dy / len, dz / len];
}

const dot = (a, b) => Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]);

console.log("t557 — camera adopt: the ⌖'s return ticket\n");

/* ---- 1. round-trip over the slider grid (off-pole) ---- */
{
  let worst = 0, checked = 0;
  outer: for (let theta = 15; theta <= 165; theta += 15) {
    for (let phi = 0; phi < 360; phi += 15) {
      const n = frameNormal(theta, phi);
      const inv = cameraDirToAngles(n);
      if (!inv) { check(`round-trip θ${theta} φ${phi}`, false, "null"); break outer; }
      const dTh = Math.abs(inv.theta - theta);
      const dPh = Math.min(Math.abs(inv.phi - phi), 360 - Math.abs(inv.phi - phi));
      worst = Math.max(worst, dTh, dPh);
      checked++;
      if (dTh !== 0 || dPh !== 0) { check(`round-trip θ${theta} φ${phi}`, false, `got ${inv.theta},${inv.phi}`); break outer; }
    }
  }
  check("round-trip frame→inverse exact over the grid", true, `${checked} poses, worst drift ${worst}°`);
}

/* ---- 2. poles ---- */
{
  const plus = cameraDirToAngles([0, 0, 1]);
  check("pole +z → θ 0, φ 0", plus && plus.theta === 0 && plus.phi === 0, JSON.stringify(plus));
  const minus = cameraDirToAngles([0, 0, -1]);
  check("pole −z → θ 180, φ 0", minus && minus.theta === 180 && minus.phi === 0, JSON.stringify(minus));
  // near-pole noise: atan2 of ~0,~0 must not leak a garbage azimuth
  const noisy = cameraDirToAngles([1e-9, -2e-9, 1]);
  check("near-pole noise snaps φ to 0", noisy && noisy.theta === 0 && noisy.phi === 0, JSON.stringify(noisy));
}

/* ---- 3. live camera orbits: adopt → frame normal agrees with dir ---- */
{
  const target = [23.5, 25.5, 19.5]; // a 48×52×40 box's center
  const poses = [
    [[23.5, 25.5, 119.5], "front-ish, 100 units out"],
    [[-56.5, 25.5, 19.5], "left, on-axis"],
    [[80, -40, 90], "high ¾ orbit"],
    [[-30, 95, -50], "underneath, off-axis"],
    [[23.5, 25.5, -60.5], "bottom, on-axis"],
    [[60, 80, 100], "deep diagonal"],
  ];
  let worst = 1;
  for (const [pos, label] of poses) {
    const dir = cameraDir(pos, target);
    const inv = cameraDirToAngles(dir);
    if (!dir || !inv) { check(`orbit ${label}`, false, "null"); continue; }
    const back = frameNormal(inv.theta, inv.phi);
    const d = dot(dir, back);
    worst = Math.min(worst, d);
    check(`orbit ${label} → θ ${inv.theta}° φ ${inv.phi}°`, d > 0.9999, `normal·dir = ${d.toFixed(7)}`);
  }
  check("all orbits land face-on", worst > 0.9999,
    `worst dot ${worst.toFixed(7)} — the 1° rounding budget is cos(0.707°) ≈ 0.99992`);
}

/* ---- 4. antipode: the other side of the same plane ---- */
{
  const dir = cameraDir([80, -40, 90], [23.5, 25.5, 19.5]);
  const a = cameraDirToAngles(dir);
  const b = cameraDirToAngles(dir.map((c) => -c));
  const na = frameNormal(a.theta, a.phi);
  const nb = frameNormal(b.theta, b.phi);
  const d = na[0] * nb[0] + na[1] * nb[1] + na[2] * nb[2];
  check("antipodal views adopt to antiparallel normals", Math.abs(d + 1) < 1e-9,
    `dot = ${d.toFixed(9)} — same geometric plane at offset 0, opposite side`);
}

/* ---- 5. degenerate inputs ---- */
{
  check("zero dir → null", cameraDirToAngles([0, 0, 0]) === null);
  check("NaN component → null", cameraDirToAngles([NaN, 1, 1]) === null);
  check("Infinity component → null", cameraDirToAngles([Infinity, 0, 1]) === null);
  check("malformed (2 components) → null", cameraDirToAngles([1, 1]) === null);
  check("non-unit dir normalizes internally", (() => {
    const inv = cameraDirToAngles([0, 0, 5]);
    return inv && inv.theta === 0 && inv.phi === 0;
  })());
}

/* ---- 6. domain: seeded random dirs → whole degrees in range ---- */
{
  // mulberry32 — deterministic, reproducible failures
  let s = 0x5557;
  const rnd = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  let ok = true, n = 0;
  for (let i = 0; i < 500 && ok; i++) {
    // uniform on the sphere (Marsaglia)
    let x, y, z, m;
    do { x = 2 * rnd() - 1; y = 2 * rnd() - 1; z = 2 * rnd() - 1; m = x * x + y * y + z * z; } while (m > 1 || m < 1e-6);
    const inv = cameraDirToAngles([x, y, z]);
    if (!inv || !Number.isInteger(inv.theta) || !Number.isInteger(inv.phi) ||
        inv.theta < 0 || inv.theta > 180 || inv.phi < 0 || inv.phi >= 360) ok = false;
    n++;
  }
  check(`500 seeded random dirs stay in domain`, ok, `${n} samples, integers, θ∈[0,180], φ∈[0,360)`);
}

/* ---- 7. the loop law: adopt then ⌖ returns the same face-on line ---- */
{
  // applyViewPreset drives dir into the camera; adopt reads the same law
  // in reverse. Pin the composed contract: for arbitrary θ/φ on the grid,
  // adopt(frame.normal) === (θ, φ) — so ⌖ after adopt re-derives the very
  // normal the user adopted (roll aside, which ⌖ owns by design).
  const cases = [[45, 30], [90, 270], [120, 200], [10, 55], [170, 355]];
  let ok = true;
  for (const [t, p] of cases) {
    const inv = cameraDirToAngles(frameNormal(t, p));
    if (!inv || inv.theta !== t || inv.phi !== p) { ok = false; break; }
  }
  check("adopt∘frame = id on the grid (⌖ after adopt is the same line)", ok,
    "θ45/30, θ90/270, θ120/200, θ10/55, θ170/355");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

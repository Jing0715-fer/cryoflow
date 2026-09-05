/**
 * Rotation class — TypeScript port of scipy.spatial.transform.Rotation,
 * from github.com/Jing0715-fer/icosahedral-symmetry-expander.
 *
 * Supports a focused subset of scipy's API that the original expand3.py
 * relies on:
 *   - from_euler(seq, [a,b,c], degrees=true)  — intrinsic sequences (uppercase)
 *   - from_matrix(M)
 *   - as_euler(seq, degrees=true)
 *   - as_rotvec()
 *   - matrix multiplication via `mul`
 *
 * Default sequence is 'ZYZ' (RELION cryo-EM convention, intrinsic).
 *
 * Pure math — safe on client and server.
 */

import {
  Mat3,
  Vec3,
  matIdentity,
  matMul,
  matVec,
  rotationMatrix,
  normalize,
  norm,
  trace,
} from "./matrix";

export type EulerSequence = string; // e.g. "ZYZ", "ZXZ"

function axisIndex(ch: string): 0 | 1 | 2 {
  const c = ch.toUpperCase();
  if (c === "X") return 0;
  if (c === "Y") return 1;
  if (c === "Z") return 2;
  throw new Error(`Invalid axis character: ${ch}`);
}

function rx(t: number): Mat3 {
  const c = Math.cos(t), s = Math.sin(t);
  return [
    [1, 0, 0],
    [0, c, -s],
    [0, s, c],
  ];
}

function ry(t: number): Mat3 {
  const c = Math.cos(t), s = Math.sin(t);
  return [
    [c, 0, s],
    [0, 1, 0],
    [-s, 0, c],
  ];
}

function rz(t: number): Mat3 {
  const c = Math.cos(t), s = Math.sin(t);
  return [
    [c, -s, 0],
    [s, c, 0],
    [0, 0, 1],
  ];
}

function axisRotation(axis: 0 | 1 | 2, t: number): Mat3 {
  if (axis === 0) return rx(t);
  if (axis === 1) return ry(t);
  return rz(t);
}

const DEG2RAD = Math.PI / 180;

export class Rotation {
  matrix: Mat3;

  constructor(matrix: Mat3) {
    this.matrix = matrix;
  }

  static fromMatrix(m: Mat3): Rotation {
    return new Rotation(m);
  }

  /**
   * Construct a Rotation from intrinsic Euler angles.
   * `seq` must be uppercase (e.g. "ZYZ") to indicate intrinsic rotations.
   * Mirrors scipy's `Rotation.from_euler(seq, angles, degrees=True)`.
   */
  static fromEuler(seq: EulerSequence, angles: [number, number, number], degrees = true): Rotation {
    const [a, b, c] = angles;
    const factor = degrees ? DEG2RAD : 1;
    const i = axisIndex(seq[0]);
    const j = axisIndex(seq[1]);
    const k = axisIndex(seq[2]);
    // intrinsic: R = R_i(a) * R_j(b) * R_k(c)
    const m1 = axisRotation(i, a * factor);
    const m2 = axisRotation(j, b * factor);
    const m3 = axisRotation(k, c * factor);
    return new Rotation(matMul(matMul(m1, m2), m3));
  }

  /**
   * Compose this rotation with `other`. The result applies `other` first,
   * then `this` — exactly mirroring scipy's `R1 * R2` semantics.
   */
  mul(other: Rotation): Rotation {
    return new Rotation(matMul(this.matrix, other.matrix));
  }

  /** Apply to a (column) vector: out = R * v */
  apply(v: Vec3): Vec3 {
    return matVec(this.matrix, v);
  }

  /**
   * Convert to intrinsic Euler angles. Returns angles in degrees when
   * `degrees=true`. Implements the standard "proper Euler" / "Tait-Bryan"
   * extraction with gimbal-lock fallback, matching scipy's default behavior.
   *
   * For a sequence (i, j, k):
   *   - Proper Euler (i === k): R = R_i(α) · R_j(β) · R_i(γ), β ∈ [0, π]
   *   - Tait-Bryan (i ≠ k):    R = R_i(α) · R_j(β) · R_k(γ), β ∈ [-π/2, π/2]
   */
  asEuler(seq: EulerSequence, degrees = true): [number, number, number] {
    const m = this.matrix;
    const i = axisIndex(seq[0]);
    const j = axisIndex(seq[1]);
    const k = axisIndex(seq[2]);
    const proper = i === k;
    // The "third" axis (different from i and j) — meaningful for proper Euler
    const third = (3 - i - j) as 0 | 1 | 2;

    // Forward-cyclic test: j = (i+1) mod 3
    const isForward = (j - i + 3) % 3 === 1;

    let alpha: number, beta: number, gamma: number;

    if (proper) {
      // Proper Euler 'ABA': R = R_i(α) R_j(β) R_i(γ)
      const sign = isForward ? -1 : 1;
      const cosB = Math.max(-1, Math.min(1, m[i][i]));
      beta = Math.acos(cosB);
      const sinB = Math.sin(beta);
      if (Math.abs(sinB) < 1e-7) {
        // Gimbal lock — set γ = 0 and recover α from the (j, third) plane
        gamma = 0;
        if (cosB > 0) {
          alpha = Math.atan2(sign * m[j][third], m[j][j]);
        } else {
          alpha = Math.atan2(-sign * m[j][third], m[j][j]);
        }
      } else {
        alpha = Math.atan2(m[j][i], sign * m[third][i]);
        gamma = Math.atan2(m[i][j], -sign * m[i][third]);
      }
    } else {
      // Tait-Bryan 'ABC': R = R_i(α) R_j(β) R_k(γ), β ∈ [-π/2, π/2]
      const sign = isForward ? 1 : -1;
      const sinB = Math.max(-1, Math.min(1, sign * m[i][k]));
      beta = Math.asin(sinB);
      const cosB = Math.cos(beta);
      if (Math.abs(cosB) < 1e-7) {
        gamma = 0;
        const sinBSign = sinB > 0 ? 1 : -1;
        alpha = Math.atan2(sinBSign * m[j][i], m[j][j]);
      } else {
        alpha = Math.atan2(-sign * m[j][k], m[k][k]);
        gamma = Math.atan2(-sign * m[i][j], m[i][i]);
      }
    }

    const factor = degrees ? 180 / Math.PI : 1;
    let aDeg = alpha * factor;
    let bDeg = beta * factor;
    let gDeg = gamma * factor;

    // Normalize α and γ to (-180, 180] like scipy.
    const norm180 = (x: number): number => {
      let r = x;
      while (r > 180) r -= 360;
      while (r <= -180) r += 360;
      if (Math.abs(r - 180) < 1e-9 || Math.abs(r + 180) < 1e-9) r = -180;
      return r;
    };
    aDeg = norm180(aDeg);
    gDeg = norm180(gDeg);

    return [aDeg, bDeg, gDeg];
  }

  /**
   * Convert to a rotation vector (axis * angle). Angle is in radians.
   * Mirrors scipy's `Rotation.as_rotvec()`.
   *
   * For 180° rotations the standard axis formula (R - R^T)/(2 sin θ) is
   * 0/0, so we fall back to extracting the axis from the diagonal.
   */
  asRotvec(): Vec3 {
    const m = this.matrix;
    const tr = trace(m);
    const cosT = Math.max(-1, Math.min(1, (tr - 1) / 2));
    const angle = Math.acos(cosT);
    if (angle < 1e-9) {
      return [0, 0, 0];
    }
    if (Math.abs(angle - Math.PI) < 1e-6) {
      // Near π — recover axis from diagonal: aᵢ = √((Rᵢᵢ + 1)/2)
      const a2: Vec3 = [
        Math.max(0, (m[0][0] + 1) / 2),
        Math.max(0, (m[1][1] + 1) / 2),
        Math.max(0, (m[2][2] + 1) / 2),
      ];
      let axis: Vec3 = [Math.sqrt(a2[0]), Math.sqrt(a2[1]), Math.sqrt(a2[2])];
      if (Math.abs(m[0][1]) > 1e-9) {
        if (m[0][1] < 0) axis[1] = -axis[1];
      } else if (Math.abs(m[0][2]) > 1e-9) {
        if (m[0][2] < 0) axis[2] = -axis[2];
      }
      if (Math.abs(m[1][2]) > 1e-9) {
        const expectedSign = axis[1] * axis[2] > 0 ? 1 : -1;
        const actualSign = m[1][2] > 0 ? 1 : -1;
        if (expectedSign !== actualSign) axis[2] = -axis[2];
      }
      axis = normalize(axis);
      return [axis[0] * angle, axis[1] * angle, axis[2] * angle];
    }
    const s = 2 * Math.sin(angle);
    const axis: Vec3 = [
      (m[2][1] - m[1][2]) / s,
      (m[0][2] - m[2][0]) / s,
      (m[1][0] - m[0][1]) / s,
    ];
    const axNorm = norm(axis);
    if (axNorm < 1e-12) return [0, 0, 0];
    const ax = normalize(axis);
    return [ax[0] * angle, ax[1] * angle, ax[2] * angle];
  }

  /** Convenience: extract axis (unit vector) and angle (radians) separately. */
  asAxisAngle(): { axis: Vec3; angle: number } {
    const rv = this.asRotvec();
    const a = norm(rv);
    if (a < 1e-12) return { axis: [0, 0, 1], angle: 0 };
    return { axis: normalize(rv), angle: a };
  }

  static identity(): Rotation {
    return new Rotation(matIdentity());
  }
}

export { matMul, rotationMatrix };

/**
 * 3D vector and matrix utilities — TypeScript port of the numpy operations
 * used by the original expand3.py icosahedral symmetry tool
 * (github.com/Jing0715-fer/icosahedral-symmetry-expander).
 *
 * Pure math, no fs/process — safe to import from client and server code.
 */

export type Vec3 = [number, number, number];
export type Mat3 = [Vec3, Vec3, Vec3]; // row-major 3x3

export const EPS = 1e-9;

export function vec(x: number, y: number, z: number): Vec3 {
  return [x, y, z];
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function scale(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

export function norm(a: Vec3): number {
  return Math.sqrt(dot(a, a));
}

export function normalize(v: Vec3): Vec3 {
  const n = norm(v);
  if (n === 0) return [0, 0, 0];
  return [v[0] / n, v[1] / n, v[2] / n];
}

export function matIdentity(): Mat3 {
  return [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
}

export function matMul(a: Mat3, b: Mat3): Mat3 {
  const out: Mat3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      let s = 0;
      for (let k = 0; k < 3; k++) s += a[i][k] * b[k][j];
      out[i][j] = s;
    }
  }
  return out;
}

/** Apply matrix to column vector: out = a * v */
export function matVec(a: Mat3, v: Vec3): Vec3 {
  return [
    a[0][0] * v[0] + a[0][1] * v[1] + a[0][2] * v[2],
    a[1][0] * v[0] + a[1][1] * v[1] + a[1][2] * v[2],
    a[2][0] * v[0] + a[2][1] * v[1] + a[2][2] * v[2],
  ];
}

export function matTranspose(a: Mat3): Mat3 {
  return [
    [a[0][0], a[1][0], a[2][0]],
    [a[0][1], a[1][1], a[2][1]],
    [a[0][2], a[1][2], a[2][2]],
  ];
}

export function matEqual(a: Mat3, b: Mat3, tol = 1e-9): boolean {
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      if (Math.abs(a[i][j] - b[i][j]) > tol) return false;
  return true;
}

export function matRoundKey(a: Mat3, decimals = 8): string {
  const f = (x: number) => {
    const r = Number(x.toFixed(decimals));
    return r === 0 ? "0" : r.toString();
  };
  return a
    .map((row) => row.map(f).join(","))
    .join("|");
}

export function vecRoundKey(v: Vec3, decimals = 8): string {
  const f = (x: number) => {
    const r = Number(x.toFixed(decimals));
    return r === 0 ? "0" : r.toString();
  };
  return v.map(f).join(",");
}

/**
 * Build a rotation matrix from an axis and angle (radians).
 * Rodrigues' formula, equivalent to scipy's Rotation.from_rotvec.
 */
export function rotationMatrix(axisInput: Vec3, theta: number): Mat3 {
  const axis = normalize(axisInput);
  const a = Math.cos(theta / 2.0);
  const s = Math.sin(theta / 2.0);
  const b = -axis[0] * s;
  const c = -axis[1] * s;
  const d = -axis[2] * s;
  const aa = a * a, bb = b * b, cc = c * c, dd = d * d;
  const bc = b * c, ad = a * d, ac = a * c, ab = a * b, bd = b * d, cd = c * d;
  return [
    [aa + bb - cc - dd, 2 * (bc + ad), 2 * (bd - ac)],
    [2 * (bc - ad), aa + cc - bb - dd, 2 * (cd + ab)],
    [2 * (bd + ac), 2 * (cd - ab), aa + dd - bb - cc],
  ];
}

/** Trace of a 3x3 matrix */
export function trace(a: Mat3): number {
  return a[0][0] + a[1][1] + a[2][2];
}

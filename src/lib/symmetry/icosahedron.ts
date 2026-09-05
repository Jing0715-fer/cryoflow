/**
 * Icosahedral symmetry generation — TypeScript port of expand3.py
 * (github.com/Jing0715-fer/icosahedral-symmetry-expander).
 *
 * Generates the 60 rotational symmetries of the icosahedral group I,
 * plus the named subsets used by the original tool:
 *   - full         (60 — entire icosahedral group I)
 *   - vertex       (12 — map each vertex to a target vertex)
 *   - face         (20 — map each face center to a target face center)
 *   - edge / no_c2 (30 — map each edge midpoint to a target edge midpoint)
 *   - non_edge     (30 — compose edge rotations with the C2 stabilizer)
 *   - hemisphere   (30 — rotation axes confined to one hemisphere)
 *
 * Pure math — safe on client and server.
 */

import {
  Vec3,
  Mat3,
  matIdentity,
  matEqual,
  matRoundKey,
  vecRoundKey,
  rotationMatrix,
  normalize,
  cross,
  sub,
  add,
  scale,
  dot,
  norm,
} from "./matrix";
import { Rotation } from "./rotation";

// Golden ratio
export const PHI = (1 + Math.sqrt(5)) / 2;

// The 12 vertices of a regular icosahedron
export const VERTICES: Vec3[] = [
  [0, 1, PHI],
  [0, -1, PHI],
  [0, 1, -PHI],
  [0, -1, -PHI],
  [1, PHI, 0],
  [-1, PHI, 0],
  [1, -PHI, 0],
  [-1, -PHI, 0],
  [PHI, 0, 1],
  [-PHI, 0, 1],
  [PHI, 0, -1],
  [-PHI, 0, -1],
];

/** Normalize the key of an axis vector so that v and -v share the same key. */
function canonicalAxisKey(axis: Vec3): string {
  const rounded: Vec3 = [
    Number(axis[0].toFixed(8)),
    Number(axis[1].toFixed(8)),
    Number(axis[2].toFixed(8)),
  ];
  // Mirror to canonical half-space: prefer +x, or +y if x ~ 0
  const flip =
    rounded[0] < -1e-9 ||
    (Math.abs(rounded[0]) < 1e-9 && rounded[1] < -1e-9);
  const key = flip ? [-rounded[0], -rounded[1], -rounded[2]] : rounded;
  return vecRoundKey(key as Vec3);
}

/** Remove duplicate axes (treating v and -v as the same axis). */
export function getUniqueAxes(axesVectors: Vec3[]): Vec3[] {
  const uniqueAxes: Vec3[] = [];
  const seen = new Set<string>();
  for (const axis of axesVectors) {
    const key = canonicalAxisKey(axis);
    if (!seen.has(key)) {
      seen.add(key);
      uniqueAxes.push(axis);
    }
  }
  return uniqueAxes;
}

/**
 * Compute the triangular faces of the convex hull for the icosahedron's
 * 12 vertices. The icosahedron has 20 triangular faces: a triangle
 * (p0,p1,p2) is a hull face iff all other vertices lie strictly on the
 * same side of its plane.
 */
export function computeConvexHullFaces(vertices: Vec3[]): Vec3[][] {
  const n = vertices.length;
  const faces: Vec3[][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        const p0 = vertices[i];
        const p1 = vertices[j];
        const p2 = vertices[k];
        const nrm = normalize(cross(sub(p1, p0), sub(p2, p0)));
        if (norm(nrm) < 1e-9) continue;
        let pos = 0, neg = 0;
        for (let l = 0; l < n; l++) {
          if (l === i || l === j || l === k) continue;
          const d = dot(nrm, sub(vertices[l], p0));
          if (d > 1e-9) pos++;
          else if (d < -1e-9) neg++;
        }
        if (pos === 0 || neg === 0) {
          faces.push([p0, p1, p2]);
        }
      }
    }
  }
  return faces;
}

/** Indices of triangular faces of the icosahedron's convex hull. */
export function computeConvexHullSimplices(vertices: Vec3[]): number[][] {
  const n = vertices.length;
  const simplices: number[][] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        const p0 = vertices[i];
        const p1 = vertices[j];
        const p2 = vertices[k];
        const nrm = normalize(cross(sub(p1, p0), sub(p2, p0)));
        if (norm(nrm) < 1e-9) continue;
        let pos = 0, neg = 0;
        for (let l = 0; l < n; l++) {
          if (l === i || l === j || l === k) continue;
          const d = dot(nrm, sub(vertices[l], p0));
          if (d > 1e-9) pos++;
          else if (d < -1e-9) neg++;
        }
        if (pos === 0 || neg === 0) {
          simplices.push([i, j, k]);
        }
      }
    }
  }
  return simplices;
}

/** Unique edges of the icosahedron as pairs of vertex indices. */
export function computeEdges(vertices: Vec3[]): [number, number][] {
  const simplices = computeConvexHullSimplices(vertices);
  const edgeSet = new Set<string>();
  for (const simplex of simplices) {
    for (let i = 0; i < 3; i++) {
      const a = simplex[i];
      const b = simplex[(i + 1) % 3];
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      edgeSet.add(key);
    }
  }
  return Array.from(edgeSet).map((s) => {
    const [a, b] = s.split(",").map(Number);
    return [a, b] as [number, number];
  });
}

/** Deduplicate a list of rotation matrices by rounded matrix values. */
export function deduplicateRotations(rotations: Mat3[]): Mat3[] {
  const unique: Mat3[] = [];
  const seen = new Set<string>();
  for (const r of rotations) {
    const key = matRoundKey(r, 8);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(r);
    }
  }
  return unique;
}

/**
 * Generate all 60 rotation matrices of the icosahedral group I.
 * Composed of:
 *   - 1 identity
 *   - 24 vertex rotations (6 axes × 4 non-trivial rotations)
 *   - 20 face rotations (10 axes × 2 non-trivial rotations)
 *   - 15 edge rotations (15 axes × 1 rotation of π)
 * Total: 1 + 24 + 20 + 15 = 60
 */
export function generateIcosahedronRotations(): Mat3[] {
  const rotations: Mat3[] = [];
  rotations.push(matIdentity());

  const hull = computeConvexHullSimplices(VERTICES);

  // Vertex rotations: 6 unique axes (12 vertices in 6 opposite pairs), 4 each.
  const vertexUsed = new Set<number>();
  const vertexAxes: Vec3[] = [];
  for (let i = 0; i < VERTICES.length; i++) {
    if (vertexUsed.has(i)) continue;
    const vi = normalize(VERTICES[i]);
    vertexAxes.push(vi);
    for (let j = i + 1; j < VERTICES.length; j++) {
      if (vertexUsed.has(j)) continue;
      const vj = normalize(VERTICES[j]);
      // Opposite vertices have dot product ≈ -1
      if (Math.abs(vi[0]*vj[0] + vi[1]*vj[1] + vi[2]*vj[2] + 1) < 1e-6) {
        vertexUsed.add(j);
        break;
      }
    }
  }
  for (const axis of vertexAxes) {
    for (let k = 1; k <= 4; k++) {
      rotations.push(rotationMatrix(axis, (k * 2 * Math.PI) / 5));
    }
  }

  // Face rotations: 10 unique axes (20 faces, opposite pairs), 2 each
  const faceAxesVectors: Vec3[] = [];
  for (const simplex of hull) {
    const v1 = VERTICES[simplex[0]];
    const v2 = VERTICES[simplex[1]];
    const v3 = VERTICES[simplex[2]];
    const normal = cross(sub(v2, v1), sub(v3, v1));
    faceAxesVectors.push(normalize(normal));
  }
  const uniqueFaceAxes = getUniqueAxes(faceAxesVectors);
  for (const axis of uniqueFaceAxes) {
    for (let k = 1; k <= 2; k++) {
      rotations.push(rotationMatrix(axis, (k * 2 * Math.PI) / 3));
    }
  }

  // Edge rotations: 15 unique axes, 1 rotation (π) each
  const edges = computeEdges(VERTICES);
  const edgeAxesVectors: Vec3[] = edges.map(([a, b]) =>
    normalize(sub(VERTICES[b], VERTICES[a]))
  );
  const uniqueEdgeAxes = getUniqueAxes(edgeAxesVectors);
  for (const axis of uniqueEdgeAxes) {
    rotations.push(rotationMatrix(axis, Math.PI));
  }

  return deduplicateRotations(rotations);
}

/** Edge midpoints (normalized to unit length) of the icosahedron. */
export function computeEdgeMidpoints(): Vec3[] {
  const edges = computeEdges(VERTICES);
  return edges.map(([a, b]) => normalize(scale(add(VERTICES[a], VERTICES[b]), 0.5)));
}

/** Face centers (normalized to unit length) of the icosahedron. */
export function computeFaceCenters(): Vec3[] {
  const simplices = computeConvexHullSimplices(VERTICES);
  return simplices.map((s) => {
    const v1 = VERTICES[s[0]];
    const v2 = VERTICES[s[1]];
    const v3 = VERTICES[s[2]];
    return normalize(scale(add(add(v1, v2), v3), 1 / 3));
  });
}

/** Vertex points (normalized to unit length) of the icosahedron. */
export function computeVertexPoints(): Vec3[] {
  return VERTICES.map((v) => normalize(v));
}

/**
 * Find rotation matrices that map each source point to a fixed target point.
 * Returns one matrix per source point (30 for edges, 20 for faces, 12 for vertices).
 */
function findMappingRotations(sourcePoints: Vec3[]): Mat3[] {
  const allRotations = generateIcosahedronRotations();
  const target = sourcePoints[0];
  const found: Mat3[] = [];
  for (const source of sourcePoints) {
    for (const rot of allRotations) {
      const mapped: Vec3 = matVec3(rot, source);
      const diff = norm([mapped[0] - target[0], mapped[1] - target[1], mapped[2] - target[2]]);
      if (diff < 1e-9) {
        found.push(rot);
        break;
      }
    }
  }
  return deduplicateRotations(found);
}

function matVec3(a: Mat3, v: Vec3): Vec3 {
  return [
    a[0][0] * v[0] + a[0][1] * v[1] + a[0][2] * v[2],
    a[1][0] * v[0] + a[1][1] * v[1] + a[1][2] * v[2],
    a[2][0] * v[0] + a[2][1] * v[1] + a[2][2] * v[2],
  ];
}

/** 30 rotations that map each of 30 edge midpoints to a common target. */
export function generateEdgeToPointRotations(): Mat3[] {
  return findMappingRotations(computeEdgeMidpoints());
}

/** 20 rotations that map each of 20 face centers to a common target. */
export function generateFaceToPointRotations(): Mat3[] {
  return findMappingRotations(computeFaceCenters());
}

/** 12 rotations that map each of 12 vertices to a common target. */
export function generateVertexToPointRotations(): Mat3[] {
  return findMappingRotations(computeVertexPoints());
}

/**
 * Generate the 30 "non-edge" rotations: compose each edge-to-point rotation
 * with the 180° rotation that stabilizes the target edge midpoint.
 */
export function generateNonEdgeRotations(): Mat3[] {
  const allRotationsG = generateIcosahedronRotations();
  const edgeMidpoints = computeEdgeMidpoints();
  const target = edgeMidpoints[0];

  let stabRot180: Mat3 | null = null;
  for (const rot of allRotationsG) {
    if (matEqual(rot, matIdentity())) continue;
    const mapped = matVec3(rot, target);
    const diff = norm([mapped[0] - target[0], mapped[1] - target[1], mapped[2] - target[2]]);
    if (diff < 1e-9) {
      stabRot180 = rot;
      break;
    }
  }
  if (!stabRot180) return [];

  const S: Mat3[] = [];
  for (const source of edgeMidpoints) {
    for (const rot of allRotationsG) {
      const mapped = matVec3(rot, source);
      const diff = norm([mapped[0] - target[0], mapped[1] - target[1], mapped[2] - target[2]]);
      if (diff < 1e-9) {
        S.push(rot);
        break;
      }
    }
  }
  if (S.length !== 30) return [];

  const composed: Mat3[] = S.map((r) => {
    const out: Mat3 = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        let s = 0;
        for (let k = 0; k < 3; k++) s += stabRot180![i][k] * r[k][j];
        out[i][j] = s;
      }
    return out;
  });
  return deduplicateRotations(composed);
}

/**
 * Select 30 rotations (out of the 60 in the icosahedral group, excluding
 * identity) whose rotation axis lies in a single open hemisphere.
 *
 * See the original tool for the full decomposition: 22 axis-pair picks + 8 C2
 * picks = 30. Robust axis extraction avoids scipy's inconsistent 180° signs.
 */
export function generateHemisphereRotations(): Mat3[] {
  const all = generateIcosahedronRotations();
  const nonIdentity = all.filter((r) => !matEqual(r, matIdentity()));

  function robustAxis(r: Mat3): Vec3 {
    const rot = new Rotation(r);
    const rv = rot.asRotvec();
    const angle = norm(rv);
    if (angle < 1e-9) return [0, 0, 1];
    return normalize(rv);
  }

  function inHemisphere(ax: Vec3): boolean {
    if (ax[2] > 1e-9) return true;
    if (ax[2] < -1e-9) return false;
    return ax[1] > 1e-9;
  }

  const keyOf = (m: Mat3): string =>
    m
      .flat()
      .map((v) => {
        const r = Number(v.toFixed(4));
        return Object.is(r, -0) ? 0 : r;
      })
      .join(",");
  const transpose = (m: Mat3): Mat3 => [
    [m[0][0], m[1][0], m[2][0]],
    [m[0][1], m[1][1], m[2][1]],
    [m[0][2], m[1][2], m[2][2]],
  ];

  const allSet = new Map<string, Mat3>();
  for (const r of all) allSet.set(keyOf(r), r);

  const processed = new Set<string>();
  const pairs: { r1: Mat3; r2: Mat3 }[] = [];
  const selfInverse: Mat3[] = [];

  for (const r of nonIdentity) {
    const k = keyOf(r);
    if (processed.has(k)) continue;
    const inv = transpose(r);
    if (matEqual(r, inv)) {
      selfInverse.push(r);
      processed.add(k);
    } else {
      const invK = keyOf(inv);
      if (allSet.has(invK) && !processed.has(invK)) {
        pairs.push({ r1: r, r2: inv });
        processed.add(k);
        processed.add(invK);
      }
    }
  }

  const result: Mat3[] = [];
  for (const p of pairs) {
    const a1 = robustAxis(p.r1);
    if (inHemisphere(a1)) {
      result.push(p.r1);
    } else {
      result.push(p.r2);
    }
  }
  for (const r of selfInverse) {
    const ax = robustAxis(r);
    if (inHemisphere(ax)) {
      result.push(r);
    }
  }

  return result;
}

export type RotationType =
  | "full"
  | "edge"
  | "face"
  | "vertex"
  | "non_edge"
  | "hemisphere";

export interface GeneratedRotationInfo {
  matrix: Mat3;
  axis: Vec3;
  angleDeg: number;
  order: number; // 1, 2, 3, or 5
}

/** Decorate a list of rotation matrices with axis/angle/order metadata. */
export function describeRotations(matrices: Mat3[]): GeneratedRotationInfo[] {
  return matrices.map((m) => {
    const rot = new Rotation(m);
    const { axis, angle } = rot.asAxisAngle();
    const deg = (angle * 180) / Math.PI;
    let ax = axis;
    if (ax[0] < -1e-9 || (Math.abs(ax[0]) < 1e-9 && ax[1] < -1e-9)) {
      ax = [-ax[0], -ax[1], -ax[2]] as Vec3;
    }
    let order = 1;
    if (Math.abs(angle) < 1e-9) order = 1;
    else if (Math.abs(deg - 180) < 1) order = 2;
    else if (Math.abs(deg - 120) < 1 || Math.abs(deg - 240) < 1) order = 3;
    else if (Math.abs(deg - 72) < 1 || Math.abs(deg - 144) < 1 || Math.abs(deg - 216) < 1 || Math.abs(deg - 288) < 1) order = 5;
    return { matrix: m, axis: ax, angleDeg: deg, order };
  });
}

/** Expected rotation counts for each type (for runtime assertions). */
export const EXPECTED_ICO_COUNTS: Record<string, number> = {
  full: 60,
  vertex: 12,
  face: 20,
  edge: 30,
  non_edge: 30,
  hemisphere: 30,
};

/**
 * Generate the appropriate set of rotation matrices for a given rotation type.
 * Mirrors the dispatch logic of expand3.py's main().
 */
export function generateRotationsByType(type: RotationType): Mat3[] {
  let result: Mat3[];
  switch (type) {
    case "full":
      result = generateIcosahedronRotations();
      break;
    case "edge":
    case "no_c2": // backward-compat alias — identical to "edge"
      result = generateEdgeToPointRotations();
      break;
    case "face":
      result = generateFaceToPointRotations();
      break;
    case "vertex":
      result = generateVertexToPointRotations();
      break;
    case "non_edge":
      result = generateNonEdgeRotations();
      break;
    case "hemisphere":
      result = generateHemisphereRotations();
      break;
    default:
      throw new Error(`Invalid rotation type: ${type}`);
  }

  const expected = EXPECTED_ICO_COUNTS[type];
  if (expected !== undefined && result.length !== expected) {
    console.warn(
      `Warning: rotation type "${type}" produced ${result.length} rotations, ` +
      `expected ${expected}.`
    );
  }

  return result;
}

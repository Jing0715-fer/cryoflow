/**
 * Symmetry library — public entry point.
 *
 * Ports the group-generation core of
 * github.com/Jing0715-fer/icosahedral-symmetry-expander (icosahedral group I
 * with its named subsets full/vertex/face/edge/non_edge/hemisphere, the
 * scipy-compatible Rotation class and ZYZ Euler convention) and extends it
 * with the classical point groups Cn/Dn/T/O so that the whole module is a
 * superset of RELION's relion_particle_symmetry_expand --sym.
 *
 * Also exposes viewing-direction helpers shared by the angular-distribution
 * plots (cryoSPARC-style Mollweide) and the orientation rebalancer
 * (github.com/Jing0715-fer/Orient-Rebalancer).
 *
 * Pure math, no fs/process — client and server safe.
 */

export * from "./matrix";
export { Rotation, type EulerSequence } from "./rotation";
export {
  PHI,
  VERTICES,
  getUniqueAxes,
  computeConvexHullFaces,
  computeConvexHullSimplices,
  computeEdges,
  deduplicateRotations,
  generateIcosahedronRotations,
  computeEdgeMidpoints,
  computeFaceCenters,
  computeVertexPoints,
  generateEdgeToPointRotations,
  generateFaceToPointRotations,
  generateVertexToPointRotations,
  generateNonEdgeRotations,
  generateHemisphereRotations,
  describeRotations,
  generateRotationsByType,
  EXPECTED_ICO_COUNTS,
  type RotationType,
  type GeneratedRotationInfo,
} from "./icosahedron";
export {
  generateCyclic,
  generateDihedral,
  generateTetrahedral,
  generateOctahedral,
  generatePointGroup,
  parsePointGroup,
  directionOrbit,
  composeGroups,
  type PointGroupSpec,
  type PointGroupResult,
  type IcoSubset,
} from "./pointgroups";

import { Mat3, matVec } from "./matrix";
import { Rotation } from "./rotation";
import { generatePointGroup, type PointGroupSpec } from "./pointgroups";

/**
 * Compose a symmetry rotation onto a particle's ZYZ Euler triple:
 *   R_final = R_sym · R_original
 * (the convention of the original expand3.py / icosahedral-symmetry-expander).
 * Returns the new (rot, tilt, psi) in degrees.
 */
export function applySymmetryToEuler(
  sym: Mat3,
  rotDeg: number,
  tiltDeg: number,
  psiDeg: number
): { rot: number; tilt: number; psi: number } {
  const rOrig = Rotation.fromEuler("ZYZ", [rotDeg, tiltDeg, psiDeg], true);
  const rFinal = new Rotation(sym).mul(rOrig);
  const [rot, tilt, psi] = rFinal.asEuler("ZYZ", true);
  return { rot, tilt, psi };
}

/** Convert (rot φ, tilt θ) degrees to a viewing-direction unit vector
 *  (convention shared with Orient-Rebalancer: tilt 0 → +z, rot = azimuth). */
export function eulerToDirection(rotDeg: number, tiltDeg: number): [number, number, number] {
  const rot = (rotDeg * Math.PI) / 180;
  const tilt = (tiltDeg * Math.PI) / 180;
  return [
    Math.sin(tilt) * Math.cos(rot),
    Math.sin(tilt) * Math.sin(rot),
    Math.cos(tilt),
  ];
}

/** Fibonacci-sphere sampling — roughly uniform directions (shared with
 *  Orient-Rebalancer's binning). */
export function fibonacciSphere(n: number): Array<[number, number, number]> {
  const points: Array<[number, number, number]> = [];
  if (n <= 0) return points;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const denom = n > 1 ? n - 1 : 1;
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / denom) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * i;
    points.push([Math.cos(theta) * r, y, Math.sin(theta) * r]);
  }
  return points;
}

/** Rotate a direction vector by a group's matrices, accumulating weights —
 *  used by plots to overlay the symmetry-expanded coverage. */
export function expandDirectionCounts(
  directions: Array<{ v: [number, number, number]; count: number }>,
  matrices: Mat3[]
): Array<{ v: [number, number, number]; count: number }> {
  const out: Array<{ v: [number, number, number]; count: number }> = [];
  for (const { v, count } of directions) {
    for (const m of matrices) {
      out.push({ v: matVec(m, v) as [number, number, number], count });
    }
  }
  return out;
}

/** Group-spec shorthand for plots: null when the name is C1/unknown. */
export function plotSymmetryMatrices(group: string, icoSubset = "full"): Mat3[] | null {
  try {
    const res = generatePointGroup({ group, icoSubset } as PointGroupSpec);
    return res.count > 1 ? res.matrices : null;
  } catch {
    return null;
  }
}

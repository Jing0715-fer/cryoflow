/**
 * Point-group rotation-matrix generators for cryo-EM symmetry expansion.
 *
 * Icosahedral group I (60 elements + the named subsets) comes from
 * github.com/Jing0715-fer/icosahedral-symmetry-expander (./icosahedron.ts).
 * The classical crystallographic point groups Cn, Dn, T and O are generated
 * here with the same conventions — making this module a faithful superset of
 * RELION's relion_particle_symmetry_expand --sym (C, D, T, O, I).
 *
 * All groups are generated about the z axis as the principal axis (the RELION
 * convention: rot is the azimuth, tilt the polar angle from +z).
 *
 * Pure math — safe on client and server.
 */

import { Mat3, Vec3, matIdentity, matMul, rotationMatrix, normalize, deduplicateRotations } from "./matrix";
import { generateRotationsByType, RotationType } from "./icosahedron";

/** Generate the n rotations of the cyclic group Cn (about +z): {C(z, 2πk/n)}. */
export function generateCyclic(n: number): Mat3[] {
  const k = Math.max(1, Math.round(n));
  const out: Mat3[] = [];
  for (let i = 0; i < k; i++) {
    out.push(rotationMatrix([0, 0, 1], (i * 2 * Math.PI) / k));
  }
  return out;
}

/**
 * Generate the 2n rotations of the dihedral group Dn:
 * Cn about +z, plus n 2-fold axes perpendicular to z (in the xy plane,
 * spaced 2π/n apart, first one along +x — the standard convention).
 */
export function generateDihedral(n: number): Mat3[] {
  const k = Math.max(1, Math.round(n));
  const out: Mat3[] = [];
  for (let i = 0; i < k; i++) {
    out.push(rotationMatrix([0, 0, 1], (i * 2 * Math.PI) / k));
  }
  // perpendicular C2 axes: axis angle φ_i = i·2π/n in the xy plane
  for (let i = 0; i < k; i++) {
    const phi = (i * 2 * Math.PI) / k;
    const axis: Vec3 = [Math.cos(phi), Math.sin(phi), 0];
    out.push(rotationMatrix(axis, Math.PI));
  }
  return deduplicateRotations(out);
}

/** Generate the 12 rotations of the tetrahedral group T (chiral).
 *  4 C3 axes along the body diagonals (±1,±1,±1)/√3 + 3 C2 along x/y/z. */
export function generateTetrahedral(): Mat3[] {
  const out: Mat3[] = [];
  out.push(matIdentity());
  // C2 about the coordinate axes
  for (const axis of [[1, 0, 0], [0, 1, 0], [0, 0, 1]] as Vec3[]) {
    out.push(rotationMatrix(axis, Math.PI));
  }
  // C3 about the 4 body diagonals (one canonical representative each —
  // the ± pairs give the same rotation set)
  const diagonals: Vec3[] = [
    [1, 1, 1],
    [1, -1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
  ].map((v) => normalize(v as Vec3));
  for (const axis of diagonals) {
    out.push(rotationMatrix(axis, (2 * Math.PI) / 3));
    out.push(rotationMatrix(axis, (4 * Math.PI) / 3));
  }
  return deduplicateRotations(out);
}

/** Generate the 24 rotations of the octahedral group O (chiral).
 *  3 C4 along x/y/z (±90°, 180°), 4 C3 along the body diagonals,
 *  6 C2 along the edge-midpoint axes (±1,±1,0)/√2 family. */
export function generateOctahedral(): Mat3[] {
  const out: Mat3[] = [];
  out.push(matIdentity());
  // C4 about the coordinate axes: ±90° and 180°
  for (const axis of [[1, 0, 0], [0, 1, 0], [0, 0, 1]] as Vec3[]) {
    out.push(rotationMatrix(axis, Math.PI / 2));
    out.push(rotationMatrix(axis, Math.PI));
    out.push(rotationMatrix(axis, (3 * Math.PI) / 2));
  }
  // C3 about the 4 body diagonals
  const diagonals: Vec3[] = [
    [1, 1, 1],
    [1, 1, -1],
    [1, -1, 1],
    [-1, 1, 1],
  ].map((v) => normalize(v as Vec3));
  for (const axis of diagonals) {
    out.push(rotationMatrix(axis, (2 * Math.PI) / 3));
    out.push(rotationMatrix(axis, (4 * Math.PI) / 3));
  }
  // C2 about the 6 edge axes
  const edges: Vec3[] = [
    [1, 1, 0], [1, -1, 0], [1, 0, 1], [1, 0, -1], [0, 1, 1], [0, 1, -1],
  ].map((v) => normalize(v as Vec3));
  for (const axis of edges) {
    out.push(rotationMatrix(axis, Math.PI));
  }
  return deduplicateRotations(out);
}

/* ------------------------------------------------------------------ */
/* Unified dispatch                                                    */
/* ------------------------------------------------------------------ */

/** Icosahedral subset selection (meaningful only for the I group). */
export type IcoSubset = "full" | "vertex" | "face" | "edge" | "non_edge" | "hemisphere";

export interface PointGroupSpec {
  /** RELION-style point-group name, e.g. "C4", "D2", "T", "O", "I". */
  group: string;
  /** Icosahedral subset (I only; ignored otherwise). */
  icoSubset?: IcoSubset;
}

export interface PointGroupResult {
  matrices: Mat3[];
  /** actual element count (deduplicated) */
  count: number;
  /** human description, e.g. "icosahedral I (full, 60 rotations)" */
  description: string;
}

/** Parse a RELION-style symmetry name. Returns null when unsupported. */
export function parsePointGroup(name: string): { kind: "C" | "D" | "T" | "O" | "I"; n?: number } | null {
  const s = String(name ?? "").trim().toUpperCase();
  if (s === "C1") return { kind: "C", n: 1 };
  const cm = /^C(\d+)$/.exec(s);
  if (cm) return { kind: "C", n: Math.max(1, Math.min(24, parseInt(cm[1], 10))) };
  const dm = /^D(\d+)$/.exec(s);
  if (dm) return { kind: "D", n: Math.max(1, Math.min(12, parseInt(dm[1], 10))) };
  if (s === "T") return { kind: "T" };
  if (s === "O") return { kind: "O" };
  if (s === "I" || s === "I1") return { kind: "I" };
  return null;
}

/**
 * Generate the rotation set for a point group (the union of the
 * icosahedral-symmetry-expander feature set and relion_particle_symmetry_expand).
 *
 * For "I", the subset selects the original tool's named sets:
 *   full (60) · vertex (12) · face (20) · edge (30) · non_edge (30) · hemisphere (30)
 */
export function generatePointGroup(spec: PointGroupSpec): PointGroupResult {
  const parsed = parsePointGroup(spec.group);
  if (!parsed) {
    throw new Error(`Unsupported point group "${spec.group}" — use C1…C24, D1…D12, T, O or I`);
  }
  switch (parsed.kind) {
    case "C": {
      const mats = generateCyclic(parsed.n ?? 1);
      return {
        matrices: mats,
        count: mats.length,
        description: `cyclic C${parsed.n ?? 1} (${mats.length} rotation${mats.length > 1 ? "s" : ""})`,
      };
    }
    case "D": {
      const mats = generateDihedral(parsed.n ?? 1);
      return {
        matrices: mats,
        count: mats.length,
        description: `dihedral D${parsed.n ?? 1} (${mats.length} rotations)`,
      };
    }
    case "T": {
      const mats = generateTetrahedral();
      return { matrices: mats, count: mats.length, description: `tetrahedral T (${mats.length} rotations)` };
    }
    case "O": {
      const mats = generateOctahedral();
      return { matrices: mats, count: mats.length, description: `octahedral O (${mats.length} rotations)` };
    }
    case "I": {
      const subset = (spec.icoSubset ?? "full") as RotationType;
      const mats = generateRotationsByType(subset);
      const label =
        subset === "full" ? "full" :
        subset === "vertex" ? "vertex (12)" :
        subset === "face" ? "face (20)" :
        subset === "edge" ? "edge (30)" :
        subset === "non_edge" ? "non-edge (30)" :
        "hemisphere (30)";
      return {
        matrices: mats,
        count: mats.length,
        description: `icosahedral I · ${label} — ${mats.length} rotations`,
      };
    }
  }
}

/**
 * Apply a set of group rotations to a direction vector (for orbit overlays).
 * Returns the unique orbit {R·v} as unit vectors.
 */
export function directionOrbit(v: Vec3, matrices: Mat3[]): Vec3[] {
  const seen = new Set<string>();
  const out: Vec3[] = [];
  for (const m of matrices) {
    const r: Vec3 = [
      m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
      m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
      m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
    ];
    const key = r.map((x) => Number(x.toFixed(4))).join(",");
    if (!seen.has(key)) {
      seen.add(key);
      out.push(r);
    }
  }
  return out;
}

/** Compose two matrix lists (used by tests and multi-step expansions). */
export function composeGroups(a: Mat3[], b: Mat3[]): Mat3[] {
  const out: Mat3[] = [];
  for (const ra of a) for (const rb of b) out.push(matMul(ra, rb));
  return deduplicateRotations(out);
}

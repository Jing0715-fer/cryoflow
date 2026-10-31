/**
 * The slice panel's voxel voices (t906 — one honest address, spoken
 * everywhere a plane is named).
 *
 * The viewer spoke TWO dialects for the same plane: the 3D cross-section
 * said "50%" while the ortho tiles beneath it said "z 33/64" — the same
 * plane, two addresses, one of them useless for "how deep is this?" work
 * (a % has no voxels; a voxel index is reproducible across sessions,
 * screenshots and the map-profile CSV's native rows). The seat: ONE
 * formula and FIVE voices, all living here (the t653 law — the meaning
 * lives in lib; the embed, the ortho panel and every annotation import
 * it, so no face can drift from another).
 *
 * The laws:
 *   - the index is 1-BASED with the grid length as denominator — the
 *     ortho tiles' existing convention ("z 33/64" = voxel 33 of 64);
 *   - the ONE formula: idx = clamp(round(pos·(dim−1)), 0, dim−1) — the
 *     same round the embed's commitSlice has always applied (Mol*'s
 *     `dimension` param takes the 0-based result verbatim);
 *   - a dim is USABLE iff it is a finite integer > 1 — the honest
 *     denominator guarantee (a fractional or degenerate dim would make
 *     "33/63.5" a lie, and the % fallback is always truthful);
 *   - when the grid is unknown the voices fall back to the % — the
 *     fallback is the OLD voice, not a wrong one;
 *   - the stored truth stays the FRACTION: bookmarks, share payloads and
 *     snapshots keep {axis, pos} — the voxel voice is display-time only,
 *     derived from the fraction and the live grid (a re-voiced bookmark
 *     survives a map with different dims; a stored voxel index would not);
 *   - the boundary: the CLIP family keeps its fraction language (the clip
 *     planes are extents-fractions by the t905 interval law, and a clip
 *     box can be anchored/oblique where "voxel along axis" has no single
 *     honest address). This module speaks for the SLICE family — and,
 *     since t907, for the OBLIQUE cut's DEPTH address (voxels along the
 *     cut's own normal — the one honest position a plane without an axis
 *     can have). The clip's OBLIQUE cut and ANCHORED-BOX language stay
 *     fraction-voiced — no single honest address along an axis. Since
 *     t1120 the SLIDER language's axis rows join the voxel family: a
 *     kept interval on a NAMED axis is the same geometry the slice
 *     voices speak, so its readout rides voxelIntervalReadout.
 */

/** The one formula. Returns the 0-BASED grid index (what Mol*'s slice
 * `dimension` param and the map-profile's native rows speak), or null
 * when the dim is unusable. Pure. */
export function voxelIndexOf(pos: number, dim: number | null | undefined): number | null {
  if (typeof dim !== "number" || !Number.isFinite(dim) || !Number.isInteger(dim) || dim <= 1) {
    return null;
  }
  return Math.min(dim - 1, Math.max(0, Math.round(pos * (dim - 1))));
}

/** Map an axis letter to the grid's component index. Accepts either case
 * (the embed's state is "X"|"Y"|"Z", the ortho tiles speak lowercase). */
export function axisIndex(axis: "x" | "y" | "z" | "X" | "Y" | "Z"): 0 | 1 | 2 {
  return axis === "x" || axis === "X" ? 0 : axis === "y" || axis === "Y" ? 1 : 2;
}

/** The dim along an axis, from a dims triple that may be absent — null
 * when the grid is unknown (the voices' fallback trigger). */
export function dimAlong(
  dims: readonly number[] | null | undefined,
  axis: "x" | "y" | "z" | "X" | "Y" | "Z"
): number | null {
  const d = dims?.[axisIndex(axis)];
  return typeof d === "number" && Number.isFinite(d) ? d : null;
}

/** The ortho tile's readout voice — the byte-format the tiles have
 * spoken since the voxel readouts landed: "z 33/64" when the grid is
 * known, "z 50%" when it is not. */
export function voxelReadout(
  pos: number,
  axis: "x" | "y" | "z" | "X" | "Y" | "Z",
  dim: number | null | undefined
): string {
  const idx = voxelIndexOf(pos, dim);
  return idx === null
    ? `${axis} ${Math.round(pos * 100)}%`
    : `${axis} ${idx + 1}/${dim}`;
}

/** The 3D slider's readout voice — the slider keeps its % (it IS a
 * fraction dial) and gains the address: "33/64 · 50%", or the bare "50%"
 * when the grid is unknown. No axis prefix: the X/Y/Z buttons beside the
 * slider already name the axis. */
export function voxelSliderVoice(pos: number, dim: number | null | undefined): string {
  const idx = voxelIndexOf(pos, dim);
  return idx === null ? `${Math.round(pos * 100)}%` : `${idx + 1}/${dim} · ${Math.round(pos * 100)}%`;
}

/** The landscape header's plane-label voice — the plane's address:
 * "z 33/64" when the grid is known, the bare "50%" when it is not (the
 * call site prefixes "plane "). */
export function voxelPlaneVoice(
  pos: number,
  axis: "x" | "y" | "z" | "X" | "Y" | "Z",
  dim: number | null | undefined
): string {
  const idx = voxelIndexOf(pos, dim);
  return idx === null ? `${Math.round(pos * 100)}%` : `${axis} ${idx + 1}/${dim}`;
}

/** The screen-reader voice for the plane position — the fullest form:
 * "plane Z at voxel 33 of 64 (50%)" / "plane Z at 50%". */
export function voxelAriaText(
  pos: number,
  axis: "x" | "y" | "z" | "X" | "Y" | "Z",
  dim: number | null | undefined
): string {
  const idx = voxelIndexOf(pos, dim);
  return idx === null
    ? `plane ${axis} at ${Math.round(pos * 100)}%`
    : `plane ${axis} at voxel ${idx + 1} of ${dim} (${Math.round(pos * 100)}%)`;
}

/** The annotation/bookmark-chip voice — compact, burnable into a PNG
 * footer: "Z 33/64 (50%)" / "Z 50%". Call sites prefix "slice ". The
 * fraction rides along in parens: a PNG of a slab is reproducible from
 * EITHER dialect (the address for humans, the % for the share payload). */
export function voxelAnnotation(
  pos: number,
  axis: "x" | "y" | "z" | "X" | "Y" | "Z",
  dim: number | null | undefined
): string {
  const idx = voxelIndexOf(pos, dim);
  const pct = Math.round(pos * 100);
  return idx === null ? `${axis} ${pct}%` : `${axis} ${idx + 1}/${dim} (${pct}%)`;
}

/* ------------------------------------------------------------------ */
/* t907 — the oblique cut's depth voice: the plane nobody aligned an   */
/* axis to still has an honest address — voxels along its OWN normal.  */
/* ------------------------------------------------------------------ */

const OBLIQUE_DEG = Math.PI / 180;

/**
 * The box's support along the oblique cut's normal, in voxel units —
 * the denominator of the cut's depth address (offsetFrac · support =
 * how many voxel pitches the plane sits from the grid center along n).
 *
 * ONE father for the walk that previously lived inline in THREE places
 * (the server's readMrcObliqueSlice render truth, the panel's obliqueFrame
 * readout mirror, the embed's buildObliqueClipPlane plane builder) and was
 * about to gain a fourth for the voices. The arithmetic is the server's,
 * VERBATIM — same loop order, same expressions — so the render truth and
 * the voice truth cannot drift (the t906 B9 law: the seat rewrites no
 * history; the unit sweeps bit-exact equality against all three historic
 * copies across dims × angles).
 *
 * The angle law is the SERVER's (the render truth): non-finite θ/φ read
 * as 0, then clamp to [0,180]/[0,360] — the embed's builder propagated
 * NaN; riding this lib converges it onto the render truth (unreachable
 * from the UI, where the state is clamped at every intent).
 *
 * Returns null when the grid is unusable (not a 3-tuple of finite dims
 * ≥ 1) — the honest silence: an annotation omits the depth but keeps
 * the angles and the %. A dim of exactly 1 is LEGAL here (a flattened
 * axis contributes a zero-length corner leg; unlike voxelIndexOf there
 * is no denominator to go degenerate).
 */
/** The cut's unit normal — the ONE father of the oblique direction: the
 * panel's plane builder (obliqueFrame), the support arithmetic below and
 * the t1099 trace drag all ride this seat, so a cut and its shadow can
 * never disagree about which way is out. Clamps θ to [0,180] and φ to
 * [0,360]; non-finite reads as 0 (the builder's own law). Pure. */
export function obliqueNormal(thetaDeg: number, phiDeg: number): [number, number, number] {
  const t =
    (Number.isFinite(thetaDeg) ? Math.min(180, Math.max(0, thetaDeg)) : 0) * OBLIQUE_DEG;
  const p =
    (Number.isFinite(phiDeg) ? Math.min(360, Math.max(0, phiDeg)) : 0) * OBLIQUE_DEG;
  return [Math.sin(t) * Math.cos(p), Math.sin(t) * Math.sin(p), Math.cos(t)];
}

export function obliqueSupportVox(
  dims: readonly number[] | null | undefined,
  thetaDeg: number,
  phiDeg: number
): number | null {
  if (!Array.isArray(dims) || dims.length !== 3 || dims.some((d) => !(d >= 1))) return null;
  const n = obliqueNormal(thetaDeg, phiDeg);
  const c: [number, number, number] = [(dims[0] - 1) / 2, (dims[1] - 1) / 2, (dims[2] - 1) / 2];
  let support = 0;
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++)
      for (let k = 0; k < 2; k++) {
        const d: [number, number, number] = [
          (i ? dims[0] - 1 : 0) - c[0],
          (j ? dims[1] - 1 : 0) - c[1],
          (k ? dims[2] - 1 : 0) - c[2],
        ];
        support = Math.max(support, Math.abs(d[0] * n[0] + d[1] * n[1] + d[2] * n[2]));
      }
  return support;
}

/** The depth arithmetic the plane builder has always obeyed: the offset
 * fraction clamps to [−1, 1] (non-finite reads as 0 — the builder's own
 * law), then multiplies the support. A non-positive/non-finite support
 * reads as 0 (no box, no depth). Pure. */
export function obliqueDepthVox(offsetFrac: number, supportVox: number): number {
  const frac = Number.isFinite(offsetFrac) ? Math.min(1, Math.max(-1, offsetFrac)) : 0;
  return supportVox > 0 && Number.isFinite(supportVox) ? frac * supportVox : 0;
}

/** The offset's percent voice — the byte-format the 3D chip has spoken
 * since t661 ("+30%", "-30%", "+0%"): sign prefix only for non-negatives
 * (the minus rides in the number), Math.round, the % suffix. The clamp
 * is invisible for in-range fractions (the sweep arm proves the historic
 * unclamped bytes are bit-identical there). */
export function obliqueOffsetPctVoice(offsetFrac: number): string {
  const frac = Number.isFinite(offsetFrac) ? Math.min(1, Math.max(-1, offsetFrac)) : 0;
  return `${frac >= 0 ? "+" : ""}${Math.round(frac * 100)}%`;
}

/** The depth's voxel voice — the byte-format the 2D block's offset row
 * has spoken since t555 ("+9.6 vox", "-3.2 vox", "+0.0 vox"): toFixed(1),
 * sign prefix only for non-negatives. */
export function obliqueDepthVoice(offsetVox: number): string {
  const v = Number.isFinite(offsetVox) ? offsetVox : 0;
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)} vox`;
}

/** The annotation voice for the figure footers and the bookmark chips —
 * the cut DESCRIBED, not just oriented: "oblique cut 45°·90° · +30% ·
 * +9.6 vox · flip". The % rides for reproducibility (with dims+angles it
 * re-mints the plane), the depth for the address; when the grid is
 * unknown (supportVox null) the depth is honestly omitted and the % still
 * carries the position. The flip keeps its trailing seat (the historic
 * bytes' tail). */
export function obliqueCutAnnotation(
  cut: { theta: number; phi: number; offset: number; invert: boolean },
  supportVox: number | null
): string {
  const depth =
    supportVox === null ? null : obliqueDepthVoice(obliqueDepthVox(cut.offset, supportVox));
  return (
    `oblique cut ${cut.theta}°·${cut.phi}°` +
    ` · ${obliqueOffsetPctVoice(cut.offset)}` +
    (depth ? ` · ${depth}` : "") +
    (cut.invert ? " · flip" : "")
  );
}

/** t1129 — the cut's anchor in VOXEL space: grid center + depth·n, the ONE
 *  father of the plane's position. The embed's clip builder has carried
 *  this arithmetic inline since t661 (its bytes are unit-pinned there);
 *  the sheet builder (the cut's density face — same plane, now wearing
 *  data) mints fresh through this word, so a cut and its face can never
 *  disagree about where the plane sits. Returns null when the grid is
 *  unusable (the support's own silence — an honest no-anchor). Pure. */
export function obliqueAnchorVox(
  ob: { theta: number; phi: number; offset: number },
  dims: readonly number[] | null | undefined
): [number, number, number] | null {
  if (!Array.isArray(dims) || dims.length !== 3 || dims.some((d) => !(d >= 1))) return null;
  const supportN = obliqueSupportVox(dims, ob.theta, ob.phi);
  if (supportN === null) return null;
  const depth = obliqueDepthVox(ob.offset, supportN);
  const n = obliqueNormal(ob.theta, ob.phi);
  const c: [number, number, number] = [(dims[0] - 1) / 2, (dims[1] - 1) / 2, (dims[2] - 1) / 2];
  return [c[0] + depth * n[0], c[1] + depth * n[1], c[2] + depth * n[2]];
}

/** t1129 — the sheet's annotation word: the export footers and recorded
 *  figures already speak the cut (obliqueCutAnnotation); when the face is
 *  drawn ON that plane the figure gains this one phrase — same plane, one
 *  new fact (the data now visible on it). No arithmetic: the address is
 *  the cut's own, already spoken. */
export const OBLIQUE_SHEET_ANNOTATION = "oblique face (density on the cut plane)";

/** t1130 — the face's TITLE word, mesh edition. The t1129 face rode Mol*'s
 *  slice mode 'plane' and shared the contour's isoLevel (its title
 *  confessed "the image shares the contour σ — on maps whose peaks sit
 *  near the contour the face reads solvent-quiet"); the t1130 pivot moves
 *  the face onto a density MESH that wears the FIELD — the tiles' own 2–98
 *  stretch, quantized to gray bands — and the contour σ now cuts the
 *  SURFACE only, never the face's brightness. The title confesses the new
 *  division: one plane, two instruments, each honest about what it obeys. */
export const OBLIQUE_SHEET_FACE_TITLE =
  "▣ face — hang the density ON the cut plane as a gray mosaic (the tiles' own stretch; the σ slider cuts the surface, the face keeps the field)";

/** The clip interval's readout voice — the kept extent's voxel address:
 * "21–26/64" (1-based, inclusive — the tiles' convention), or null when
 * the grid is unknown (the call site keeps its bare percent: the
 * fallback is the OLD voice, not a wrong one). The SLIDER language's
 * axis rows only — an oblique cut or an anchored box has no honest
 * address along a named axis (the boundary paragraph above). Both ends
 * ride the ONE formula (voxelIndexOf's round), so the address agrees
 * with every plane voice the panel already speaks. Pure. */
export function voxelIntervalReadout(
  lo: number,
  hi: number,
  dim: number | null | undefined
): string | null {
  if (typeof dim !== "number" || !Number.isFinite(dim) || !Number.isInteger(dim) || dim <= 1) {
    return null;
  }
  const a = voxelIndexOf(lo, dim);
  const b = voxelIndexOf(hi, dim);
  if (a === null || b === null || b < a) return null;
  return `${a + 1}–${b + 1}/${dim}`;
}

/**
 * The patch footprint's own rectangle (t1122 — the probe's second voice
 * made VISIBLE: the (2r+1)² patch whose statistics the chip speaks,
 * drawn on the tile as an outline, so the AREA the numbers summarise is
 * literally in front of the eye).
 *
 * `box` is readMrcPatch's clamped in-plane box (volume frame, lo/hi per
 * axis — the FIXED axis is pinned to the centre and simply rides along
 * unused here); `dims` is the live grid; `hAxis`/`vAxis` are the tile's
 * own frame (the TileSpec map: z tile → h=x v=y, y tile → h=x v=z, x
 * tile → h=y v=z). The fraction is voxelIndexOf's inverse: an index i
 * of a dim-n grid sits at i/(n−1) — the same mapping that puts the
 * probe crosshair at the cursor, so the box and the lines can never
 * disagree about where a voxel lives.
 *
 * Returns null (and the tile draws nothing) when the truth is not
 * drawable: no box, unknown/unusable dims (the t906 usable-dim law —
 * finite integers > 1), the same axis twice, a reversed box, or any
 * edge escaping 0..1 — silence about it, never a wrong rectangle. Pure.
 */
export function patchBoxRect(
  box:
    | {
        lo: { x: number; y: number; z: number };
        hi: { x: number; y: number; z: number };
      }
    | null
    | undefined,
  dims: readonly [number, number, number] | null | undefined,
  hAxis: "x" | "y" | "z",
  vAxis: "x" | "y" | "z"
): { left: number; top: number; right: number; bottom: number } | null {
  if (!box || !box.lo || !box.hi) return null;
  if (!dims || dims.length !== 3) return null;
  if (hAxis === vAxis) return null;
  const hi0 = axisIndex(hAxis);
  const vi0 = axisIndex(vAxis);
  const dh = dims[hi0];
  const dv = dims[vi0];
  // the usable-dim law (t906): a fraction with a degenerate denominator
  // would place the box nowhere honest
  for (const dim of [dh, dv]) {
    if (typeof dim !== "number" || !Number.isFinite(dim) || !Number.isInteger(dim) || dim <= 1) {
      return null;
    }
  }
  // the box speaks KEY names (readMrcPatch's {x,y,z} objects), the dims
  // speak INDEX numbers (the live grid's tuple) — two shapes, one axis
  const lv = box.lo[hAxis];
  const rv = box.hi[hAxis];
  const tv = box.lo[vAxis];
  const bv = box.hi[vAxis];
  if (![lv, rv, tv, bv].every((v) => Number.isFinite(v))) return null;
  const left = lv / (dh - 1);
  const right = rv / (dh - 1);
  const top = tv / (dv - 1);
  const bottom = bv / (dv - 1);
  if (right < left || bottom < top) return null;
  if (left < 0 || top < 0 || right > 1 || bottom > 1) return null;
  return { left, top, right, bottom };
}

/** t1126 — the clamp's own voice. The chip's second line speaks the ACTUAL
 *  point count (the honest n — never a round (2r+1)² lie); when that n
 *  falls short of the full in-plane grid, the clamp itself gets ONE
 *  telegraphic micro-phrase — "of 169 full" — so an edge read explains its
 *  own shortfall at the point of reading. A full-grid read stays silent
 *  (n === full: the number already says it all), and so does every unusable
 *  input — silence, never a wrong arithmetic. Pure.
 */
export function patchClampVoice(n: number, radius: number): string | null {
  if (!Number.isFinite(n) || !Number.isFinite(radius)) return null;
  if (!Number.isInteger(radius) || radius < 0 || n < 1) return null;
  const full = (2 * radius + 1) ** 2;
  if (n >= full) return null;
  return `of ${full} full`;
}

/* ---------------- the cut's face, MESH EDITION (t1130) ---------------- */
/* The face's GEOMETRY words move into the lib (the t1122 patchBoxRect
   precedent: geometry the family shares lives where node can ride it and
   no face can drift from another). The mol*-wrapping half of the face —
   the kit, the transform, the state nodes — stays in the embed; these two
   are pure tuple math, unit-runnable without React or WebGL. */

/** The gray window the face wears — the tile stretch law's client twin.
 *  The ortho tiles speak a 2–98 percentile contrast stretch (mrc.ts's
 *  `makeGrayPng`); the face wears the SAME law: a strided sample of the
 *  grid's raw cells (≤65536 reads — the tensor order is irrelevant to a
 *  percentile) sorted to its 2nd and 98th percentile. Non-finite cells
 *  are skipped (the honest window never includes the map's NaN border).
 *  Returns null when the grid carries nothing usable — the honest no-face
 *  beats a guessed window. Pure. */
export function densityWindow(grid: unknown): [number, number] | null {
  const data = (grid as { cells?: { data?: ArrayLike<number> } } | null | undefined)?.cells?.data;
  if (!data || typeof data.length !== "number" || data.length < 16) return null;
  const stride = Math.max(1, Math.floor(data.length / 65536));
  const sample: number[] = [];
  for (let i = 0; i < data.length; i += stride) {
    const v = data[i];
    if (Number.isFinite(v)) sample.push(v);
  }
  if (sample.length < 16) return null;
  sample.sort((a, b) => a - b);
  const pct = (p: number) =>
    sample[Math.min(sample.length - 1, Math.max(0, Math.round(p * (sample.length - 1))))];
  const lo = pct(0.02);
  const hi = pct(0.98);
  return hi > lo ? [lo, hi] : null;
}

/** The cut's face as a DENSITY MESH (t1130) — the pivot off Mol*'s slice
 *  mode 'plane' (an experimental path mol* itself never uses: the node
 *  mounted, the render object said visible, the screen showed nothing —
 *  the t1129 diagnosis). The face is now a lattice mosaic of flat gray
 *  quads ON the cut plane: a N×N lattice over the plane∩box trace polygon
 *  (the guide's own world-space polygon — one geometry father), each quad
 *  sampled at its centroid through the volume's trilinear field, banded
 *  into K gray bands over the tile-stretch window (densityWindow — the
 *  tiles' 2–98 stretch), kept when the centroid lies inside the polygon.
 *  σ-INDEPENDENT by design: the contour slider cuts the SURFACE, the face
 *  wears the FIELD — the same division the ortho tiles already live by.
 *
 *  Pure tuple math — no mol* imports — so the unit can hand-compute every
 *  vertex. Returns null when the geometry is unusable (fewer than 3
 *  polygon points, a degenerate normal, an empty window, or a lattice
 *  that kept nothing — the honest no-face beats a guessed sheet). */
export interface SheetMeshInput {
  /** the plane∩box trace (buildObliqueGuidePlane's polygon — world space,
   *  wound consistently around the normal) */
  polygon: [number, number, number][];
  /** the cut's anchor on the plane (buildObliqueSheetPlane's point) */
  point: [number, number, number];
  /** the cut's unit world normal (buildObliqueSheetPlane's normal) */
  normal: [number, number, number];
  /** world point → density | NaN (Grid.makeGetTrilinearlyInterpolated's
   *  own voice — NaN outside the grid, the sampler's honesty) */
  sampler: (p: [number, number, number]) => number;
  /** the tile-stretch window (densityWindow's [lo, hi]) */
  grayLo: number;
  grayHi: number;
  /** gray band count (default 9 — odd keeps a middle band) */
  bands?: number;
  /** lattice resolution per axis (default 56 — smooth on 33³ to 400³) */
  latticeN?: number;
}

export interface SheetMeshArrays {
  /** xyz triplets, 4 per kept quad (the two triangles share them) */
  positions: Float32Array;
  /** triangle indices into positions (2 per kept quad) */
  indices: Uint32Array;
  /** gray band index per triangle (one shape group per band) */
  bandOfTri: Int32Array;
  /** band center color as 0xrrggbb gray (index = band) */
  bandColors: number[];
  /** band center density as a readable label (index = band) */
  bandLabels: string[];
  stats: { kept: number; dropped: number; lattice: number };
}

export function buildObliqueSheetMesh(input: SheetMeshInput): SheetMeshArrays | null {
  const { polygon, point, normal, sampler, grayLo, grayHi } = input;
  const K = input.bands ?? 9;
  const N = input.latticeN ?? 56;
  if (!Array.isArray(polygon) || polygon.length < 3) return null;
  if (!Number.isFinite(grayLo) || !Number.isFinite(grayHi) || grayHi <= grayLo) return null;
  if (!Number.isFinite(K) || K < 2 || !Number.isFinite(N) || N < 2) return null;
  const nLen = Math.hypot(normal[0], normal[1], normal[2]);
  if (!(nLen > 1e-9)) return null;
  const n: [number, number, number] = [normal[0] / nLen, normal[1] / nLen, normal[2] / nLen];
  // in-plane basis: swing the least-aligned world axis into the plane —
  // stable under the normal's own orientation (no arbitrary roll)
  let axis: [number, number, number] = [1, 0, 0];
  let best = Math.abs(n[0]);
  if (Math.abs(n[1]) < best) { axis = [0, 1, 0]; best = Math.abs(n[1]); }
  if (Math.abs(n[2]) < best) { axis = [0, 0, 1]; }
  let u: [number, number, number] = [
    n[1] * axis[2] - n[2] * axis[1],
    n[2] * axis[0] - n[0] * axis[2],
    n[0] * axis[1] - n[1] * axis[0],
  ];
  const uLen = Math.hypot(u[0], u[1], u[2]);
  if (!(uLen > 1e-9)) return null;
  u = [u[0] / uLen, u[1] / uLen, u[2] / uLen];
  const v: [number, number, number] = [
    n[1] * u[2] - n[2] * u[1],
    n[2] * u[0] - n[0] * u[2],
    n[0] * u[1] - n[1] * u[0],
  ];
  // the polygon in the plane's (u, v) frame, relative to the anchor
  let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
  for (const q of polygon) {
    const r: [number, number, number] = [q[0] - point[0], q[1] - point[1], q[2] - point[2]];
    const cu = r[0] * u[0] + r[1] * u[1] + r[2] * u[2];
    const cv = r[0] * v[0] + r[1] * v[1] + r[2] * v[2];
    if (cu < uMin) uMin = cu;
    if (cu > uMax) uMax = cu;
    if (cv < vMin) vMin = cv;
    if (cv > vMax) vMax = cv;
  }
  if (!(uMax > uMin) || !(vMax > vMin)) return null;
  const du = (uMax - uMin) / N;
  const dv = (vMax - vMin) / N;
  if (!(du > 0) || !(dv > 0)) return null;
  // convex membership: every edge's cross product faces the same way
  // (the polygon is wound consistently around n — the guide's contract)
  const inside = (c: [number, number, number]): boolean => {
    for (let e = 0; e < polygon.length; e++) {
      const a = polygon[e];
      const b = polygon[(e + 1) % polygon.length];
      const e0 = b[0] - a[0], e1 = b[1] - a[1], e2 = b[2] - a[2];
      const r0 = c[0] - a[0], r1 = c[1] - a[1], r2 = c[2] - a[2];
      const cx = e1 * r2 - e2 * r1;
      const cy = e2 * r0 - e0 * r2;
      const cz = e0 * r1 - e1 * r0;
      if (cx * n[0] + cy * n[1] + cz * n[2] < -1e-9) return false;
    }
    return true;
  };
  const pos: number[] = [];
  const idx: number[] = [];
  const band: number[] = [];
  let kept = 0;
  let dropped = 0;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const cu = uMin + (i + 0.5) * du;
      const cv = vMin + (j + 0.5) * dv;
      const c: [number, number, number] = [
        point[0] + cu * u[0] + cv * v[0],
        point[1] + cu * u[1] + cv * v[1],
        point[2] + cu * u[2] + cv * v[2],
      ];
      if (!inside(c)) continue;
      const d = sampler(c);
      if (!Number.isFinite(d)) { dropped++; continue; }
      const t = Math.min(1, Math.max(0, (d - grayLo) / (grayHi - grayLo)));
      const b = Math.min(K - 1, Math.floor(t * K));
      // the quad's four corners (half-cell around the centroid); winding
      // (c1,c2,c3)+(c1,c3,c4) is CCW around +n — u×v = n by construction
      const hu = du / 2, hv = dv / 2;
      const c1: [number, number, number] = [c[0] - hu * u[0] - hv * v[0], c[1] - hu * u[1] - hv * v[1], c[2] - hu * u[2] - hv * v[2]];
      const c2: [number, number, number] = [c[0] + hu * u[0] - hv * v[0], c[1] + hu * u[1] - hv * v[1], c[2] + hu * u[2] - hv * v[2]];
      const c3: [number, number, number] = [c[0] + hu * u[0] + hv * v[0], c[1] + hu * u[1] + hv * v[1], c[2] + hu * u[2] + hv * v[2]];
      const c4: [number, number, number] = [c[0] - hu * u[0] + hv * v[0], c[1] - hu * u[1] + hv * v[1], c[2] - hu * u[2] + hv * v[2]];
      const base = pos.length / 3;
      pos.push(c1[0], c1[1], c1[2], c2[0], c2[1], c2[2], c3[0], c3[1], c3[2], c4[0], c4[1], c4[2]);
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      band.push(b, b);
      kept++;
    }
  }
  if (kept === 0) return null; // the honest no-face
  const bandColors: number[] = [];
  const bandLabels: number[] = [];
  for (let i = 0; i < K; i++) {
    const g = Math.round(255 * ((i + 0.5) / K));
    bandColors.push((g << 16) | (g << 8) | g);
    bandLabels.push(grayLo + ((i + 0.5) / K) * (grayHi - grayLo));
  }
  return {
    positions: new Float32Array(pos),
    indices: new Uint32Array(idx),
    bandOfTri: new Int32Array(band),
    bandColors,
    bandLabels: bandLabels.map((mid) => `${Number(mid.toPrecision(3))} density`),
    stats: { kept, dropped, lattice: N * N },
  };
}

/** t1131 — the face's LEGEND: the gray mosaic's own color key, derived
 *  FROM the mesh arrays the scene actually wears (buildObliqueSheetMesh's
 *  bandColors/bandLabels — the legend cannot disagree with the face
 *  because it is MADE of it; a second ramp computed from the raw window
 *  would be a second father, and two fathers disagree the first time one
 *  of them changes). One swatch per band, dark → light, each carrying the
 *  band-center density word the mesh already speaks; the window's own
 *  ends ride the same 3-significant-digit voice. Serializable by design —
 *  the object crosses the event wire (OBLIQUE_SHEET_LEGEND_EVENT) to the
 *  panel's strip. Returns null when the truth is not drawable: no arrays,
 *  fewer than two bands (a one-color key explains nothing), or an invalid
 *  window — the honest no-legend beats a guessed key. Pure. */
export interface SheetLegend {
  /** band count (the swatches' length) */
  bands: number;
  /** the stretch's own ends, 3-significant-digit words */
  loLabel: string;
  hiLabel: string;
  /** css hex per band, dark → light (index = band) */
  swatches: string[];
  /** the band-center density word per swatch (index = band) */
  labels: string[];
  /** the lattice's own harvest, for the strip's confession chip */
  kept: number;
  dropped: number;
  lattice: number;
  /** the strip's aria word (role="img" speaks this) */
  aria: string;
}

export function sheetLegendOf(
  arrays: SheetMeshArrays | null | undefined,
  grayLo: number,
  grayHi: number
): SheetLegend | null {
  if (!arrays || !Array.isArray(arrays.bandColors) || arrays.bandColors.length < 2) return null;
  if (!Array.isArray(arrays.bandLabels) || arrays.bandLabels.length !== arrays.bandColors.length) {
    return null;
  }
  if (!Number.isFinite(grayLo) || !Number.isFinite(grayHi) || grayHi <= grayLo) return null;
  const K = arrays.bandColors.length;
  const fmt = (v: number) => Number(v.toPrecision(3)).toString();
  const loLabel = fmt(grayLo);
  const hiLabel = fmt(grayHi);
  return {
    bands: K,
    loLabel,
    hiLabel,
    swatches: arrays.bandColors.map((c) => `#${Number(c).toString(16).padStart(6, "0")}`),
    labels: arrays.bandLabels.map(String),
    kept: arrays.stats?.kept ?? 0,
    dropped: arrays.stats?.dropped ?? 0,
    lattice: arrays.stats?.lattice ?? 0,
    aria:
      `The face's gray key — ${K} bands from ${loLabel} to ${hiLabel} density` +
      ` (the tiles' own stretch), ${arrays.stats?.kept ?? 0} quads on the plane`,
  };
}

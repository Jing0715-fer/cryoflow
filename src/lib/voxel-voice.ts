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

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
 *     honest address). This module speaks for the SLICE family only.
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

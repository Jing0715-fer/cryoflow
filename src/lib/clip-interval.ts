/**
 * The 3D clip's kept-interval arithmetic (t905 — the cross-section tool's
 * slab seat: a clip face you can hold, not just a plane you can park).
 *
 * The clip speaks TWO languages today: the scalar sliders (one plane per
 * axis, one global invert — kept [0,v] or [v,1]) and the anchored box
 * ({lo,hi} per axis, minted when a subvolume card hands its crop to the
 * viewer). The box language was READ-ONLY in the UI — the user could
 * release it but never reshape it, and no hand could mint a SLAB (keep
 * [a,b] along an axis): a real inspection shape (a membrane slab, a
 * z-range of particles) was unreachable by hand. The seat: the sliders
 * gain a second face and BOTH languages answer to one interval editor —
 * dragging any face mints/updates the live box.
 *
 * This module owns the derivation (the t653 law: the meaning lives in
 * lib, the embed imports it, the slider's faces can never disagree with
 * the planes commitClip builds). The kept-interval laws:
 *   - a live/anchored box wins — its [lo,hi] IS the kept interval;
 *   - a scalar axis v with invert=false keeps [0,v], invert=true [v,1]
 *     (the same law the PLANE_ROTATION comment pins in commitClip);
 *   - a scalar at ≥0.999 is the ABSENT plane — the full extent [0,1]
 *     (commitClip filters planes at ≥0.999: no plane, no cut);
 *   - intervals clamp to [0,1] and order (a crossed pair swaps — the
 *     two thumbs may pass each other, the kept region never lies).
 */

export interface ClipBox {
  lo: [number, number, number];
  hi: [number, number, number];
}

/** the clip state the embed keeps — the shape this module derives from */
export interface ClipStateLike {
  invert: boolean;
  x: number;
  y: number;
  z: number;
  box: ClipBox | null;
}

const SCALAR_KEY: Record<0 | 1 | 2, "x" | "y" | "z"> = { 0: "x", 1: "y", 2: "z" };

/** The kept interval along axis i, from whichever language currently
 * speaks. Pure — the embed calls it per render and per intent. */
export function keptIntervalOf(st: ClipStateLike, i: 0 | 1 | 2): [number, number] {
  if (st.box) return [st.box.lo[i], st.box.hi[i]];
  const v = st[SCALAR_KEY[i]];
  if (v >= 0.999) return [0, 1]; // the absent plane — the axis is not cut
  return normalizeInterval(st.invert ? v : 0, st.invert ? 1 : v);
}

/** Clamp to [0,1] and order. The two thumbs may cross mid-drag; the kept
 * region is the SORTED pair, never the crossed one. */
export function normalizeInterval(a: number, b: number): [number, number] {
  const lo = Math.min(1, Math.max(0, a));
  const hi = Math.min(1, Math.max(0, b));
  return lo <= hi ? [lo, hi] : [hi, lo];
}

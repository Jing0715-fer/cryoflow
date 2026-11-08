/**
 * The camera bookmark's optical half — the ONE well both sides drink.
 *
 * t885 walked the camera-bookmarks write door and named the gallery read
 * route's raw `entry.view` relay as an observation: the write side owned
 * the whitelist, the read side trusted it. A stored row written by an
 * older era (or a hand-edited DB) could relay an unwhitelisted view
 * object to the dashboard's saved-views wall. The cure is the family
 * law the duplicate route teaches: ONE sanitizer, BOTH mouths — the
 * write route sanitizes on the way in, the gallery aggregate sanitizes
 * on the way out, and a legacy row renders (or omits its view) exactly
 * as a fresh one would. sanitizeView is idempotent on already-clean
 * views, so live rows keep rendering byte-identically.
 *
 * Moved verbatim from src/app/api/jobs/[id]/camera-bookmarks/route.ts
 * (the t889 window's one-family cure; behavior unchanged on the write
 * side — same clamps, same defaults, same honest null).
 */

/** the optical half of a saved view — contour σ (and sign), the slice
 *  plane and the clip box. A bookmark that restores only the camera
 *  brings you back to the right angle looking at the WRONG threshold;
 *  view state makes "fly back" mean the whole picture. */
export interface BookmarkView {
  sigma: number;
  sign: number;
  slice: { on: boolean; axis: string; pos: number };
  clip: { on: boolean; x: number; y: number; z: number; invert: boolean };
  /** t279 — the tri-planar focus point (the ortho browser's three plane
   *  positions at save time); optional, legacy rows never carry it */
  focus?: { x: number; y: number; z: number };
}

export const isFiniteNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

export const bounded = (v: unknown, lo: number, hi: number, fallback: number): number =>
  isFiniteNum(v) ? Math.min(hi, Math.max(lo, v)) : fallback;

export function sanitizeView(raw: unknown): BookmarkView | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const v = raw as Record<string, unknown>;
  const sl = (v.slice ?? {}) as Record<string, unknown>;
  const cp = (v.clip ?? {}) as Record<string, unknown>;
  const axis = sl.axis === "X" || sl.axis === "Y" || sl.axis === "Z" ? sl.axis : "Z";
  // t279 — the focus point rides along when present; clamped to the same
  // fractional language the ortho panel speaks, defaults are honest centres
  let focus: BookmarkView["focus"];
  const fc = v.focus as Record<string, unknown> | null | undefined;
  if (fc && typeof fc === "object" && !Array.isArray(fc)) {
    focus = {
      x: bounded(fc.x, 0, 1, 0.5),
      y: bounded(fc.y, 0, 1, 0.5),
      z: bounded(fc.z, 0, 1, 0.5),
    };
  }
  return {
    sigma: bounded(v.sigma, 0.01, 100, 2),
    sign: v.sign === -1 ? -1 : 1,
    slice: {
      on: sl.on === true,
      axis,
      pos: bounded(sl.pos, 0, 1, 0.5),
    },
    clip: {
      on: cp.on === true,
      x: bounded(cp.x, 0, 1, 1),
      y: bounded(cp.y, 0, 1, 1),
      z: bounded(cp.z, 0, 1, 1),
      invert: cp.invert === true,
    },
    ...(focus ? { focus } : {}),
  };
}

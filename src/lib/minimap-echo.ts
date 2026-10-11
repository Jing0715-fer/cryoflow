/**
 * The canvas minimap's viewport echo arithmetic (t904, the style round's
 * fourth seat — "you are always somewhere the map can say").
 *
 * The map's viewport window is honest in fit mode (the frame unions the
 * window — it is always visible). In nodes/sel mode the frame holds
 * CONTENT only, and the docblock's own words admit the cost: "a
 * far-away viewport is simply clipped at the map edge" — panning into
 * the void makes the window VANISH, and "where am I?" has no answer on
 * the map. The seat: when the true window does not intersect the frame,
 * an ECHO speaks — the window's ghost pinned at the frame edge nearest
 * the true viewport, dashed (an echo, not the window), with an arrow
 * pointing where the viewport truly is.
 *
 * The honesty law: the echo never lies about direction — the arrow's
 * vector is the TRUE direction from the ghost toward the viewport
 * center (diagonal pans point diagonally; the echo is never
 * axis-snapped into a lie). The echo retires the moment the true
 * window re-enters the frame — a partial sliver of the real window
 * already says "you are here" better than any ghost.
 *
 * This module owns the arithmetic (the t653 law: the meaning lives in
 * lib, the map imports it, the echo can never drift from the clamp the
 * framer applies). Pure world-coordinate math — no DOM, no store.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface VpEcho {
  /** the ghost's rect — the window's size (clamped to fit the frame),
   * pinned fully inside the frame at the nearest edge */
  rect: Rect;
  /** the TRUE direction from the ghost's center toward the viewport's
   * center, normalized (the arrow rides the ghost's edge) */
  dir: { dx: number; dy: number };
}

/** the ghost never fills the frame: a window bigger than this fraction
 * of the frame is drawn at the cap (an echo is a pointer, not a map) */
const GHOST_MAX_FRACTION = 0.5;

/** Compute the echo, or null when the true window already speaks:
 *  - any intersection with the frame → null (the real rect is visible,
 *    even a one-pixel sliver);
 *  - a degenerate frame (zero/negative size — the map's first paint)
 *    → null (an echo on an unmeasured map would be a guess);
 *  - a NaN/∞ viewport (a dead zoom) → null (no arithmetic on garbage).
 */
export function computeVpEcho(view: Rect, frame: Rect): VpEcho | null {
  const sane =
    [view.x, view.y, view.w, view.h, frame.x, frame.y, frame.w, frame.h].every(
      (n) => Number.isFinite(n)
    );
  if (!sane) return null;
  if (frame.w <= 0 || frame.h <= 0) return null;

  // no intersection → the echo speaks; any overlap → the truth suffices
  const overlaps =
    view.x < frame.x + frame.w &&
    view.x + view.w > frame.x &&
    view.y < frame.y + frame.h &&
    view.y + view.h > frame.y;
  if (overlaps) return null;

  // the ghost keeps the window's SIZE, clamped to the echo cap
  const w = Math.min(view.w, frame.w * GHOST_MAX_FRACTION);
  const h = Math.min(view.h, frame.h * GHOST_MAX_FRACTION);

  // pin the ghost fully inside the frame, nearest the true window
  const cx = view.x + view.w / 2;
  const cy = view.y + view.h / 2;
  let gx = Math.min(Math.max(cx - w / 2, frame.x), frame.x + frame.w - w);
  let gy = Math.min(Math.max(cy - h / 2, frame.y), frame.y + frame.h - h);

  // the honest direction: ghost center → TRUE center, normalized.
  // The pinch case (the clamped ghost exactly at the true center — only
  // reachable when the window is inside the frame, which already
  // returned null) cannot occur; the zero-length guard is defensive.
  const tdx = cx - (gx + w / 2);
  const tdy = cy - (gy + h / 2);
  const len = Math.hypot(tdx, tdy);
  if (len === 0) return null;
  const dir = { dx: tdx / len, dy: tdy / len };

  return { rect: { x: gx, y: gy, w, h }, dir };
}

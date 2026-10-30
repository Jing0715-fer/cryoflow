/**
 * The oblique trace's HAND (t1099) — the tile-side drag: grab the cut's
 * trace line on an ortho tile and slide it along its own normal.
 *
 * The t556/t661 loop gave the cut its verbs (the block's sliders, the ✂
 * mirror, the ⌖ camera jump); the trace line itself stayed a read-only
 * shadow. What no slider answers is the tomographer's native gesture:
 * the cut is RIGHT THERE on the tile — put the hand on the line and move
 * the cut deeper or shallower without naming a number. The drag rides
 * the loop's existing halves: the tile solves the offset whose line
 * passes through the pointer and speaks OBLIQUE_CLIP_EVENT (the
 * sliders' own door), the embed commits, the ACK returns and EVERY face
 * (the block's sliders included, through the t661 adoption) mirrors the
 * scene. One writer, one truth, no desync.
 *
 * The laws:
 *   - the direction and the support ride the ONE seats (voxel-voice's
 *     obliqueNormal / obliqueSupportVox) — the drag, the trace shadow
 *     (obliqueTraceOnTile) and the plane builder share every constant,
 *     so a dragged line and the cut it names are the same geometry;
 *   - the CLOSURE holds by construction: dragging to a pointer puts the
 *     line through that pointer (re-deriving the trace at the returned
 *     offset lands the pointer ON the line, to float epsilon);
 *   - the offset stays in the cut's own dialect — the returned fraction
 *     is clamped to [−1, 1], the door's own clamp (the embed re-clamps;
 *     the lib never lies about a value it refused to reach);
 *   - the honest silences: an unusable grid, a degenerate support or a
 *     plane parallel to the tile's slice (no line to grab) return null —
 *     the drag simply does not speak;
 *   - everything here is PURE and node-runnable: the hit-test and the
 *     offset solve are decided before a single event flies, so the unit
 *     can pin the whole gesture without a browser.
 */

import {
  obliqueDepthVox,
  obliqueNormal,
  obliqueSupportVox,
} from "@/lib/voxel-voice";

/** A tile frame's axes, as the tiles speak them: the slice's own axis
 * (the movement axis) and the image's two in-plane axes. */
export interface ObliqueTraceFrameAxes {
  axis: "x" | "y" | "z";
  hAxis: "x" | "y" | "z";
  vAxis: "x" | "y" | "z";
}

const AX: Record<"x" | "y" | "z", 0 | 1 | 2> = { x: 0, y: 1, z: 2 };

/** The trace's line in a tile's fraction square, restated from the
 * panel's own intersection math (A·h + B·v = D): the drag needs the
 * coefficients, not just the drawn endpoints. Returns null exactly when
 * the panel draws no line (parallel plane, unusable grid). Pure. */
export function obliqueTraceLine(
  spec: ObliqueTraceFrameAxes,
  dims: readonly [number, number, number],
  axisPos: number,
  cut: { theta: number; phi: number; offset: number }
): { A: number; B: number; D: number } | null {
  if (
    !Array.isArray(dims) ||
    dims.length !== 3 ||
    dims.some((d) => !(d > 1)) ||
    !Number.isFinite(axisPos)
  )
    return null;
  const support = obliqueSupportVox(dims, cut.theta, cut.phi);
  if (support === null || !(support > 0)) return null;
  const n = obliqueNormal(cut.theta, cut.phi);
  const c: [number, number, number] = [
    (dims[0] - 1) / 2,
    (dims[1] - 1) / 2,
    (dims[2] - 1) / 2,
  ];
  const ai = AX[spec.axis];
  const hi = AX[spec.hAxis];
  const vi = AX[spec.vAxis];
  const A = n[hi] * (dims[hi] - 1);
  const B = n[vi] * (dims[vi] - 1);
  if (!Number.isFinite(A) || !Number.isFinite(B)) return null;
  if (Math.hypot(A, B) < 1e-9) return null; // plane ∥ slice: no line
  const offsetVox = obliqueDepthVox(cut.offset, support);
  const d0 = n[0] * c[0] + n[1] * c[1] + n[2] * c[2] + offsetVox;
  const D = d0 - n[ai] * axisPos * (dims[ai] - 1);
  if (!Number.isFinite(D)) return null;
  return { A, B, D };
}

/**
 * Solve the offset whose trace line passes through the pointer. The
 * pointer rides the tile's own fraction square (h: left→right 0→1,
 * v: top→bottom 0→1 — the pick handler's dialect). Returns null when no
 * line exists to move; the returned offset is clamped to [−1, 1]. Pure —
 * the inputs are never mutated.
 */
export function obliqueTraceDragOffset(
  spec: ObliqueTraceFrameAxes,
  dims: readonly [number, number, number],
  axisPos: number,
  cut: { theta: number; phi: number; offset: number },
  pointer: { h: number; v: number }
): number | null {
  const line = obliqueTraceLine(spec, dims, axisPos, cut);
  if (!line) return null;
  const h = Number.isFinite(pointer.h) ? Math.min(1, Math.max(0, pointer.h)) : null;
  const v = Number.isFinite(pointer.v) ? Math.min(1, Math.max(0, pointer.v)) : null;
  if (h === null || v === null) return null;
  const support = obliqueSupportVox(dims, cut.theta, cut.phi);
  if (support === null || !(support > 0)) return null;
  const n = obliqueNormal(cut.theta, cut.phi);
  const c: [number, number, number] = [
    (dims[0] - 1) / 2,
    (dims[1] - 1) / 2,
    (dims[2] - 1) / 2,
  ];
  const ai = AX[spec.axis];
  const D1 = line.A * h + line.B * v;
  const d01 = D1 + n[ai] * axisPos * (dims[ai] - 1);
  const offsetVox1 = d01 - (n[0] * c[0] + n[1] * c[1] + n[2] * c[2]);
  const offset = offsetVox1 / support;
  if (!Number.isFinite(offset)) return null;
  return Math.min(1, Math.max(-1, offset));
}

/**
 * The grab test — is the pointer ON the trace line, in tile pixels? The
 * trace rides the panel's drawn endpoints (x/y in 0…100 percent of the
 * square); the pointer rides the same square in pixels. The grab radius
 * is the hand's own width in pixels (the same for every tile size — a
 * small tile is as grabbable as a large one). Pure.
 */
export function obliqueTraceHit(
  trace: { x1: number; y1: number; x2: number; y2: number },
  tilePx: { w: number; h: number },
  pointerPx: { x: number; y: number },
  grabPx: number = 14
): boolean {
  const w = Number.isFinite(tilePx.w) && tilePx.w > 0 ? tilePx.w : 0;
  const hh = Number.isFinite(tilePx.h) && tilePx.h > 0 ? tilePx.h : 0;
  if (w <= 0 || hh <= 0) return false;
  const r = Number.isFinite(grabPx) && grabPx > 0 ? grabPx : 14;
  const ax = (trace.x1 / 100) * w;
  const ay = (trace.y1 / 100) * hh;
  const bx = (trace.x2 / 100) * w;
  const by = (trace.y2 / 100) * hh;
  const px = pointerPx.x;
  const py = pointerPx.y;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (!(len2 > 0)) return Math.hypot(px - ax, py - ay) <= r;
  const t = Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len2));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy) <= r;
}

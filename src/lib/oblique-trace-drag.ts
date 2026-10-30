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
 *
 * t1100 — the trace's SECOND DOF: the endpoint turn. Grabbing near an
 * endpoint turns the cut's DIRECTION (θ, φ) instead of sliding its
 * depth. The geometry: this tile's slice pins one coordinate, so the
 * only turn that keeps the line ON this slice is a rotation of the
 * normal around the slice's own movement axis — the sister solve rides
 * the same CLOSURE dialect (turn the line to pass through the pointer;
 * re-deriving the trace at the returned angles lands the pointer ON the
 * line, to float epsilon), the same honest silences, and one new rim
 * word: when no rotation reaches the pointer the turn speaks the
 * TANGENT seat — the nearest reachable direction (maximising the
 * line's approach to the pointer), never a lie about a value it
 * refused to reach. The endpoint hit-test keeps the two gestures from
 * wrestling: the endpoints answer first (the more specific word), the
 * body keeps the slide.
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

/** Radians→degrees, the turn's unit conversion (the direction seat
 * itself stays voxel-voice's obliqueNormal — this only names angles). */
const TO_DEG = 180 / Math.PI;

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

/**
 * The endpoint's own word (t1100 — the turn's gate): is the pointer
 * within the grab radius of one of the trace's two ENDPOINTS? The body
 * belongs to the slide; the rim belongs to the turn. Same dialect as
 * obliqueTraceHit — tile pixels, the hand's own width. Pure.
 */
export function obliqueTraceEndpointHit(
  trace: { x1: number; y1: number; x2: number; y2: number },
  tilePx: { w: number; h: number },
  pointerPx: { x: number; y: number },
  grabPx: number = 14
): boolean {
  const w = Number.isFinite(tilePx.w) && tilePx.w > 0 ? tilePx.w : 0;
  const hh = Number.isFinite(tilePx.h) && tilePx.h > 0 ? tilePx.h : 0;
  if (w <= 0 || hh <= 0) return false;
  const r = Number.isFinite(grabPx) && grabPx > 0 ? grabPx : 14;
  const px = pointerPx.x;
  const py = pointerPx.y;
  return (
    Math.hypot(px - (trace.x1 / 100) * w, py - (trace.y1 / 100) * hh) <= r ||
    Math.hypot(px - (trace.x2 / 100) * w, py - (trace.y2 / 100) * hh) <= r
  );
}

/**
 * The trace's second DOF (t1100): turn the cut's direction so its line
 * on THIS slice passes through the pointer. The only turn that keeps
 * the line on the slice is a rotation of the normal around the slice's
 * own movement axis (the pinned coordinate stays pinned; the in-plane
 * projection of the normal rotates, so the line turns). Solves
 * P·cosα + Q·sinα = K for the rotation α, keeps the offset untouched,
 * and answers the NEW cut {theta, phi, offset} — the door's own detail
 * shape (OBLIQUE_CLIP_EVENT), so the loop needs no new channel.
 *
 * The laws:
 *   - the CLOSURE holds by construction inside reach: re-deriving the
 *     trace at the returned angles lands the pointer ON the line, to
 *     float epsilon;
 *   - the MINIMAL turn: two rotations reach the pointer — the answer
 *     is the one with the smaller |α| (the hand never spins the cut
 *     the long way round);
 *   - the TANGENT seat at the rim: when no rotation reaches the
 *     pointer (|K| > ρ) the answer is the nearest reachable direction
 *     — the turn that brings the line as close to the pointer as this
 *     axis allows. At the square's one degenerate point every rotation
 *     (or none) passes: the honest word is no turn at all;
 *   - the honest silences: an unusable grid, a degenerate support, or
 *     a plane parallel to this slice (the in-plane projection is zero
 *     and a rotation around the slice axis cannot lift it) return
 *     null — the turn simply does not speak;
 *   - the offset rides untouched: the turn turns, the slide slides —
 *     one gesture, one DOF, never both;
 *   - PURE and node-runnable, inputs never mutated.
 */
export function obliqueTraceTurn(
  spec: ObliqueTraceFrameAxes,
  dims: readonly [number, number, number],
  axisPos: number,
  cut: { theta: number; phi: number; offset: number },
  pointer: { h: number; v: number }
): { theta: number; phi: number; offset: number } | null {
  if (
    !Array.isArray(dims) ||
    dims.length !== 3 ||
    dims.some((d) => !(d > 1)) ||
    !Number.isFinite(axisPos)
  )
    return null;
  const h = Number.isFinite(pointer.h) ? Math.min(1, Math.max(0, pointer.h)) : null;
  const v = Number.isFinite(pointer.v) ? Math.min(1, Math.max(0, pointer.v)) : null;
  if (h === null || v === null) return null;
  const support = obliqueSupportVox(dims, cut.theta, cut.phi);
  if (support === null || !(support > 0)) return null;
  const n = obliqueNormal(cut.theta, cut.phi);
  const ai = AX[spec.axis];
  const hi = AX[spec.hAxis];
  const vi = AX[spec.vAxis];
  const uh = dims[hi] - 1;
  const uv = dims[vi] - 1;
  // a plane parallel to this slice has no line to turn, and a rotation
  // around the slice's own axis keeps the projection exactly zero —
  // the turn cannot lift it into view through this tile
  if (Math.hypot(n[hi] * uh, n[vi] * uv) < 1e-9) return null;
  const c: [number, number, number] = [
    (dims[0] - 1) / 2,
    (dims[1] - 1) / 2,
    (dims[2] - 1) / 2,
  ];
  const offsetVox = obliqueDepthVox(cut.offset, support);
  const Xh = uh * h - c[hi];
  const Xv = uv * v - c[vi];
  // the line-through-pointer condition, restated for the rotated
  // normal: n[hi]·Xh + n[vi]·Xv (at α=0) becomes P·cosα + Q·sinα
  const P = n[hi] * Xh + n[vi] * Xv;
  const Q = n[hi] * Xv - n[vi] * Xh;
  const K = offsetVox - n[ai] * (axisPos * (dims[ai] - 1) - c[ai]);
  const rho = Math.hypot(P, Q);
  let alpha: number;
  if (rho < 1e-12) {
    // the square's one degenerate point: every rotation (or none)
    // passes — the minimal honest word is no turn at all
    alpha = 0;
  } else if (Math.abs(K) > rho + 1e-12) {
    // the rim: no rotation reaches the pointer — the tangent seat,
    // the nearest reachable direction
    alpha = Math.atan2(Q, P) + (K > 0 ? 0 : Math.PI);
  } else {
    const base = Math.atan2(Q, P);
    const beta = Math.acos(Math.min(1, Math.max(-1, K / rho)));
    // two roots, base±β — keep the minimal turn (smaller |α|)
    const r1 = base + beta;
    const r2 = base - beta;
    const norm = (a: number) => {
      while (a > Math.PI) a -= 2 * Math.PI;
      while (a <= -Math.PI) a += 2 * Math.PI;
      return a;
    };
    const a1 = norm(r1);
    const a2 = norm(r2);
    alpha = Math.abs(a1) <= Math.abs(a2) ? a1 : a2;
  }
  if (!Number.isFinite(alpha)) return null;
  // rotate the normal around the movement axis (α in the (hi,vi) plane;
  // the pinned component rides untouched)
  const cos = Math.cos(alpha);
  const sin = Math.sin(alpha);
  const nn: [number, number, number] = [n[0], n[1], n[2]];
  nn[hi] = cos * n[hi] - sin * n[vi];
  nn[vi] = sin * n[hi] + cos * n[vi];
  if (!Number.isFinite(nn[0]) || !Number.isFinite(nn[1]) || !Number.isFinite(nn[2]))
    return null;
  // the direction's own dialect: θ = polar, φ = azimuth (the t557
  // inverse's own laws, clamped into the door)
  let theta = Math.acos(Math.min(1, Math.max(-1, nn[2]))) * TO_DEG;
  let phi = Math.atan2(nn[1], nn[0]) * TO_DEG;
  if (!Number.isFinite(theta) || !Number.isFinite(phi)) return null;
  theta = Math.min(180, Math.max(0, theta));
  phi = Math.min(360, Math.max(0, phi < 0 ? phi + 360 : phi));
  return { theta, phi, offset: cut.offset };
}

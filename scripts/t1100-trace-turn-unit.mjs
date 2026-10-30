#!/usr/bin/env node
// t1100 — THE TRACE'S SECOND DOF unit: grab an endpoint of the oblique
// cut's line on an ortho tile and TURN the cut (θ, φ) — the sister solve
// to t1099's slide, riding the same ONE lib, the same closure dialect,
// the same door.
//
// The gesture's meaning is BEHAVIORAL here (the t653 law — the meaning
// lives in lib, the unit imports the same seat the tile rides):
//   T the turn math (10)  — the CLOSURE (turn to a pointer puts the line
//                           through that pointer — re-deriving the line
//                           at the returned angles lands the pointer ON
//                           it, to float epsilon); the minimal turn (the
//                           hand never spins the cut the long way round,
//                           brute-forced against the whole rotation
//                           family); the offset rides untouched (the turn
//                           turns, the slide slides — one gesture, one
//                           DOF); the pinned component (the rotation is
//                           around the slice's own movement axis —
//                           n[axis] is preserved, verified through the
//                           father's own voice); the direction sense;
//                           the self-limiting sweep (every answered cut
//                           lands inside the door, never NaN); the
//                           TANGENT seat at the rim (unreachable pointer
//                           → the nearest reachable direction,
//                           brute-forced); the degenerate center (the
//                           one point every rotation shares — the honest
//                           word is no turn); the ∥ silence; purity.
//   H the endpoint hit (4) — a pointer at an endpoint grabs the rim; the
//                           body's midpoint does not (the slide owns it);
//                           the radius honors the tile's pixel size; the
//                           degenerate tile stays silent.
//   W the wiring (5)      — the tile imports the ONE lib's two new
//                           words, the rim answers FIRST (the more
//                           specific word wins, the mode rides the drag
//                           ref), the dispatch rides the sliders' own
//                           door (OBLIQUE_CLIP_EVENT, the SAME detail
//                           shape — zero new channel), the throttle is
//                           shared (one speak helper, the 120ms breath),
//                           the a11y door stays (the handles are
//                           aria-hidden decorations, the pick still
//                           yields, the sliders remain the keyboard's
//                           own way in).
//
//   node --import ./scripts/ts-alias-register.mjs scripts/t1100-trace-turn-unit.mjs

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  obliqueTraceEndpointHit,
  obliqueTraceHit,
  obliqueTraceLine,
  obliqueTraceTurn,
} from "@/lib/oblique-trace-drag";
import { obliqueNormal } from "@/lib/voxel-voice"; // the direction's ONE father (t1099's one-father law)

let pass = 0;
let fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

const ROOT = "/home/z/my-project";
const panelSrc = readFileSync(join(ROOT, "src/components/workflow/results/map-ortho-panel.tsx"), "utf8");

/* ------------------------------------------------------------------ */
/* T — the turn math                                                   */
/* ------------------------------------------------------------------ */

const DIMS = [64, 64, 64];
const CUT = { theta: 45, phi: 90, offset: 0 };
const ZTILE = { axis: "z", hAxis: "x", vAxis: "y" };
const POS = 0.5;

ok("T1 the CLOSURE: turning to a pointer puts the line through it (re-derived at the returned angles, to float epsilon)",
  (() => {
    const pts = [
      { h: 0.25, v: 0.7 }, { h: 0.8, v: 0.35 }, { h: 0.9, v: 0.9 }, { h: 0.1, v: 0.4 },
    ];
    return pts.every((p) => {
      const turned = obliqueTraceTurn(ZTILE, DIMS, POS, CUT, p);
      if (!turned) return false;
      const l2 = obliqueTraceLine(ZTILE, DIMS, POS, turned);
      if (!l2) return false;
      return Math.abs(l2.A * p.h + l2.B * p.v - l2.D) < 1e-9;
    });
  })());

ok("T2 the MINIMAL turn: the hand never spins the cut the long way round (the answer is the smaller rotation that reaches the pointer — brute-forced over the whole family)",
  (() => {
    // brute force: every rotation α ∈ (−π, π] whose line passes through
    // the pointer; the returned cut must be the one with the smallest
    // |α| (matched through the father's own voice — the nearest normal)
    const p = { h: 0.25, v: 0.7 };
    const turned = obliqueTraceTurn(ZTILE, DIMS, POS, CUT, p);
    if (!turned) return false;
    const nRet = obliqueNormal(turned.theta, turned.phi);
    const n0 = obliqueNormal(CUT.theta, CUT.phi);
    const norm = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a <= -Math.PI) a += 2 * Math.PI; return a; };
    // the z-tile's own rotation plane: axis z pins n[2]; the (x,y) pair turns
    const rot = (a) => {
      const c = Math.cos(a), s = Math.sin(a);
      return [c * n0[0] - s * n0[1], s * n0[0] + c * n0[1], n0[2]];
    };
    let best = Infinity;
    for (let i = 0; i < 7200; i++) {
      const a = -Math.PI + (i / 7200) * 2 * Math.PI;
      const nn = rot(a);
      const d = Math.hypot(nn[0] - nRet[0], nn[1] - nRet[1], nn[2] - nRet[2]);
      if (d < best) best = d;
    }
    // the grid's chord bound: the nearest member sits within half a step
    // (4.4e-4) of the answer; any direction OFF the family misses by O(0.1)
    if (best > 1e-3) return false; // the answer left the rotation family
    // among the family members whose line passes through the pointer,
    // none has a smaller |α| than the returned one
    const lRet = obliqueTraceLine(ZTILE, DIMS, POS, turned);
    if (!lRet) return false;
    let minAbs = Infinity;
    for (let i = 0; i < 7200; i++) {
      const a = -Math.PI + (i / 7200) * 2 * Math.PI;
      const nn = rot(a);
      const th = Math.acos(Math.min(1, Math.max(-1, nn[2]))) * (180 / Math.PI);
      let ph = Math.atan2(nn[1], nn[0]) * (180 / Math.PI);
      if (ph < 0) ph += 360;
      const l = obliqueTraceLine(ZTILE, DIMS, POS, { theta: th, phi: ph, offset: CUT.offset });
      if (!l) continue;
      // the grid's own resolution: the residual moves ~22 per radian and
      // the step is 8.7e-4 — a passing member lands within ~one step of
      // its root, so the honest threshold is the grid's scale (0.02 ≈ one
      // step of slope), not float eps
      if (Math.abs(l.A * p.h + l.B * p.v - l.D) < 0.02) minAbs = Math.min(minAbs, Math.abs(a));
    }
    // recover the returned cut's own α from the same grid (the minimal
    // |α| is free to be NEGATIVE — the scan owns the whole circle)
    let retAlpha = NaN;
    let bestD = Infinity;
    for (let i = 0; i < 7200; i++) {
      const a = -Math.PI + (i / 7200) * 2 * Math.PI;
      const nn = rot(a);
      const d = Math.hypot(nn[0] - nRet[0], nn[1] - nRet[1], nn[2] - nRet[2]);
      if (d < bestD) { bestD = d; retAlpha = a; }
    }
    // the tolerance owns the scale chain: the family-match bound (1e-3,
    // the grid's own chord resolution), the threshold band (~9e-4) and
    // the grid quantization (8.7e-4)
    return bestD < 1e-3 && Math.abs(retAlpha) <= minAbs + 4e-3;
  })(), "the minimal-turn seat");

ok("T3 the offset rides untouched: the turn turns, the slide slides — one gesture, one DOF, never both",
  (() => {
    const cuts = [CUT, { theta: 30, phi: 60, offset: 0.2 }, { theta: 120, phi: 200, offset: -0.4 }];
    const pts = [{ h: 0.2, v: 0.8 }, { h: 0.7, v: 0.3 }, { h: 0.9, v: 0.1 }];
    return cuts.every((cut) =>
      pts.every((p) => {
        const r = obliqueTraceTurn(ZTILE, DIMS, POS, cut, p);
        return r !== null && r.offset === cut.offset;
      })
    );
  })());

ok("T4 the rotation is around the slice's OWN movement axis: the pinned component survives (verified through the father's own voice — n[axis] is preserved, the line stays on this slice)",
  (() => {
    const tiles = [ZTILE, { axis: "x", hAxis: "y", vAxis: "z" }, { axis: "y", hAxis: "x", vAxis: "z" }];
    return tiles.every((tile) => {
      const ai = { x: 0, y: 1, z: 2 }[tile.axis];
      const n0 = obliqueNormal(CUT.theta, CUT.phi);
      const turned = obliqueTraceTurn(tile, DIMS, POS, CUT, { h: 0.3, v: 0.6 });
      if (!turned) return false;
      const n1 = obliqueNormal(turned.theta, turned.phi);
      return Math.abs(n1[ai] - n0[ai]) < 1e-9 && Math.abs(Math.hypot(...n1) - 1) < 1e-9;
    });
  })());

ok("T5 the direction sense: turning toward a pointer on one side of the line moves the line TOWARD it (the line's distance to the pointer shrinks)",
  (() => {
    const line = obliqueTraceLine(ZTILE, DIMS, POS, CUT);
    if (!line) return false;
    const dist = (l, p) => Math.abs(l.A * p.h + l.B * p.v - l.D) / Math.hypot(l.A, l.B);
    const p = { h: 0.5, v: 0.05 }; // far below the cut's line
    const l0 = dist(line, p);
    const turned = obliqueTraceTurn(ZTILE, DIMS, POS, CUT, p);
    if (!turned) return false;
    const l1 = obliqueTraceLine(ZTILE, DIMS, POS, turned);
    return l1 ? dist(l1, p) < l0 : false;
  })());

ok("T6 the self-limiting sweep: every answered cut lands inside the door (θ∈[0,180], φ∈[0,360]), never NaN — pointers × positions × cuts, the whole square swept",
  (() => {
    const cuts = [CUT, { theta: 30, phi: 60, offset: 0.2 }, { theta: 5, phi: 0, offset: 0.9 }, { theta: 175, phi: 300, offset: -0.7 }];
    const tiles = [ZTILE, { axis: "x", hAxis: "y", vAxis: "z" }, { axis: "y", hAxis: "x", vAxis: "z" }];
    for (const tile of tiles)
      for (const cut of cuts)
        for (let i = 0; i <= 6; i++)
          for (let j = 0; j <= 6; j++)
            for (const pos of [0.1, 0.5, 0.9]) {
              const r = obliqueTraceTurn(tile, DIMS, pos, cut, { h: i / 6, v: j / 6 });
              if (r === null) continue; // the honest silences stay honest
              if (!Number.isFinite(r.theta) || !Number.isFinite(r.phi)) return false;
              if (r.theta < 0 || r.theta > 180 || r.phi < 0 || r.phi > 360) return false;
            }
    return true;
  })());

ok("T7 the TANGENT seat at the rim: an unreachable pointer still speaks — the nearest reachable direction (brute-forced: no rotation brings the line closer)",
  (() => {
    // the cut pushed deep toward the rim (offset 0.9) on the x-tile: the
    // pointer at the square's far side cannot be reached by any rotation
    const XT = { axis: "x", hAxis: "y", vAxis: "z" };
    const deep = { theta: 5, phi: 0, offset: 0.9 };
    const p = { h: 0.5, v: 0.1 };
    const turned = obliqueTraceTurn(XT, DIMS, POS, deep, p);
    if (!turned) return false;
    const lRet = obliqueTraceLine(XT, DIMS, POS, turned);
    if (!lRet) return false;
    const dist = (l) => Math.abs(l.A * p.h + l.B * p.v - l.D) / Math.hypot(l.A, l.B);
    const dRet = dist(lRet);
    if (dRet < 1e-6) return false; // this pointer was REACHABLE — the rim was not exercised
    const n0 = obliqueNormal(deep.theta, deep.phi);
    let minD = Infinity;
    for (let i = 0; i < 1440; i++) {
      const a = (i / 1440) * 2 * Math.PI;
      const c = Math.cos(a), s = Math.sin(a);
      const nn = [n0[0], c * n0[1] - s * n0[2], s * n0[1] + c * n0[2]];
      const th = Math.acos(Math.min(1, Math.max(-1, nn[2]))) * (180 / Math.PI);
      let ph = Math.atan2(nn[1], nn[0]) * (180 / Math.PI);
      if (ph < 0) ph += 360;
      const l = obliqueTraceLine(XT, DIMS, POS, { theta: th, phi: ph, offset: deep.offset });
      if (l) minD = Math.min(minD, dist(l));
    }
    return dRet <= minD + 1e-6;
  })(), "the rim's nearest word");

ok("T8 the degenerate center: the one point of the square where the whole rotation family converges answers no turn at all (the minimal honest word)",
  (() => {
    const r = obliqueTraceTurn(ZTILE, DIMS, POS, CUT, { h: 0.5, v: 0.5 });
    return r !== null && r.theta === CUT.theta && r.phi === CUT.phi && r.offset === CUT.offset;
  })());

ok("T9 the ∥ silence: a plane degenerate with the tile's own slice turns none (a rotation around the slice axis cannot lift it)",
  obliqueTraceTurn(ZTILE, DIMS, POS, { theta: 0, phi: 0, offset: 0 }, { h: 0.5, v: 0.7 }) === null &&
  obliqueTraceTurn(ZTILE, DIMS, POS, { theta: 180, phi: 0, offset: 0 }, { h: 0.5, v: 0.7 }) === null);

ok("T10 purity: the degenerate dims and the non-finite pointers keep the honest silence, the inputs own no mutations",
  obliqueTraceTurn(ZTILE, [1, 1, 1], POS, CUT, { h: 0.5, v: 0.5 }) === null &&
  obliqueTraceTurn(ZTILE, [64], POS, CUT, { h: 0.5, v: 0.5 }) === null &&
  obliqueTraceTurn(ZTILE, DIMS, NaN, CUT, { h: 0.5, v: 0.5 }) === null &&
  obliqueTraceTurn(ZTILE, DIMS, POS, CUT, { h: NaN, v: 0.5 }) === null &&
  obliqueTraceTurn(ZTILE, DIMS, POS, CUT, { h: 0.5, v: Infinity }) === null &&
  CUT.offset === 0 && CUT.theta === 45 && DIMS.length === 3);

/* ------------------------------------------------------------------ */
/* H — the endpoint hit                                                */
/* ------------------------------------------------------------------ */

const TRACE = { x1: 10, y1: 20, x2: 90, y2: 80 }; // percents of the square
const TILE = { w: 400, h: 400 };

ok("H1 a pointer at an endpoint grabs the rim (both ends answer)",
  obliqueTraceEndpointHit(TRACE, TILE, { x: 400 * 0.1, y: 400 * 0.2 }) &&
  obliqueTraceEndpointHit(TRACE, TILE, { x: 400 * 0.9, y: 400 * 0.8 }));

ok("H2 the body's midpoint does not (the slide owns the body, the turn owns the rim)",
  !obliqueTraceEndpointHit(TRACE, TILE, { x: 200, y: 400 * 0.5 }) &&
  obliqueTraceHit(TRACE, TILE, { x: 200, y: 400 * 0.5 }));

ok("H3 the radius honors the tile's pixel size (a small tile is as grabbable as a large one)",
  obliqueTraceEndpointHit(TRACE, TILE, { x: 400 * 0.1 + 12, y: 400 * 0.2 }) &&
  obliqueTraceEndpointHit(TRACE, { w: 100, h: 100 }, { x: 10 + 3, y: 20 }));

ok("H4 the degenerate tile and the starving radius stay silent (a near-miss beyond the reach is a miss — the endpoint itself still answers)",
  !obliqueTraceEndpointHit(TRACE, { w: 0, h: 400 }, { x: 40, y: 80 }) &&
  !obliqueTraceEndpointHit(TRACE, TILE, { x: 400 * 0.1 + 2, y: 400 * 0.2 }, 0.5) &&
  obliqueTraceEndpointHit(TRACE, TILE, { x: 400 * 0.1, y: 400 * 0.2 }, 0.5));

/* ------------------------------------------------------------------ */
/* W — the wiring (the tile rides the ONE lib)                         */
/* ------------------------------------------------------------------ */

ok("W1 the tile imports the ONE lib's two new words — the turn is never re-derived inline",
  panelSrc.includes(`from "@/lib/oblique-trace-drag"`) &&
  panelSrc.includes("obliqueTraceTurn(") &&
  panelSrc.includes("obliqueTraceEndpointHit("));

ok("W2 the rim answers first: the endpoint test rides BEFORE the body test, the mode word rides the drag ref",
  /tracePointerDown[\s\S]{0,700}obliqueTraceEndpointHit\([\s\S]{0,400}obliqueTraceHit\(/.test(panelSrc) &&
  /mode: onEndpoint \? "turn" : "slide"/.test(panelSrc) &&
  /mode: "slide" \| "turn"/.test(panelSrc));

ok("W3 the dispatch rides the sliders' own door (the SAME OBLIQUE_CLIP_EVENT, the SAME detail shape — zero new channel; the turn speaks θ'/φ' with the offset untouched)",
  panelSrc.includes("new CustomEvent(OBLIQUE_CLIP_EVENT") &&
  /turned\s*\?\s*\{ on: true, theta: turned\.theta, phi: turned\.phi, offset: turned\.offset \}/.test(panelSrc) &&
  /\{ on: true, theta: cut\.theta, phi: cut\.phi, offset \}/.test(panelSrc));

ok("W4 the throttle is shared: one speak helper, the 120ms breath, the trailing word on release (the embed's plane rebuild deserves a breath in BOTH gestures)",
  /traceSlideTo = \(e: React\.PointerEvent<HTMLDivElement>, force = false\) => \{[\s\S]{0,900}mode === "turn"[\s\S]{0,900}>= 120/.test(panelSrc) &&
  /tracePointerUp[\s\S]{0,300}traceSlideTo\(e, true\)/.test(panelSrc));

ok("W5 the a11y door stays: the handles are aria-hidden decorations, the pick still yields, the keyboard's way in is unchanged",
  /ortho-oblique-end-[\s\S]{0,300}aria-hidden="true"/.test(panelSrc) &&
  /pickFocus[\s\S]{0,200}if \(traceDrag\.current\?\.moved\) \{/.test(panelSrc) &&
  panelSrc.includes('cursor-grabbing'));

/* ------------------------------------------------------------------ */

console.log(`\n${fail === 0 ? "GREEN" : "RED"}: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

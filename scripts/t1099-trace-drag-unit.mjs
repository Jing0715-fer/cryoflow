#!/usr/bin/env node
// t1099 — THE TRACE'S HAND unit: grab the oblique cut's line on an ortho
// tile and slide it along its own normal.
//
// The gesture's meaning is BEHAVIORAL here (the t653 law — the meaning
// lives in lib, the unit imports the same seat the tile rides):
//   D the drag math (7) — the CLOSURE (drag to a pointer puts the line
//                       through that pointer — re-deriving the line at
//                       the returned offset lands the pointer ON it, to
//                       float epsilon); the center-stability (grabbing
//                       where the line already is does not jump); the
//                       direction (the offset rides the normal's sign);
//                       the clamp (the cut's own [−1,1] dialect); the
//                       honest silences (∥ plane, unusable grid); purity.
//   H the hit-test (4)  — a point on the segment grabs; a far point does
//                       not; the radius honors the tile's pixel size;
//                       the segment clamps at its ends.
//   W the wiring (6)    — the tile imports the ONE lib (no inline
//                       re-derivation), the grab gates on the hit and
//                       the button, the dispatch rides the sliders' own
//                       door (OBLIQUE_CLIP_EVENT, the cut's θ/φ intact),
//                       the throttle + the trailing word, the pick
//                       yields once, the t661 ACK adoption closes the
//                       loop (the block mirrors the scene).
//
//   node --import ./scripts/ts-alias-register.mjs scripts/t1099-trace-drag-unit.mjs

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  obliqueTraceDragOffset,
  obliqueTraceHit,
  obliqueTraceLine,
} from "@/lib/oblique-trace-drag";

let pass = 0;
let fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

const ROOT = "/home/z/my-project";
const panelSrc = readFileSync(join(ROOT, "src/components/workflow/results/map-ortho-panel.tsx"), "utf8");

/* ------------------------------------------------------------------ */
/* D — the drag math                                                   */
/* ------------------------------------------------------------------ */

const DIMS = [64, 64, 64];
const CUT = { theta: 45, phi: 90, offset: 0 };
const ZTILE = { axis: "z", hAxis: "x", vAxis: "y" };
const POS = 0.5;

const line = obliqueTraceLine(ZTILE, DIMS, POS, CUT);
ok("D1 the CLOSURE: dragging to a pointer puts the line through it (re-derived, to float epsilon)",
  (() => {
    if (!line) return false;
    const pts = [
      { h: 0.25, v: 0.7 }, { h: 0.8, v: 0.35 }, { h: 0.5, v: 0.5 }, { h: 0.05, v: 0.62 },
    ];
    return pts.every((p) => {
      const off = obliqueTraceDragOffset(ZTILE, DIMS, POS, CUT, p);
      if (off === null) return false;
      const l2 = obliqueTraceLine(ZTILE, DIMS, POS, { ...CUT, offset: off });
      if (!l2) return false;
      return Math.abs(l2.A * p.h + l2.B * p.v - l2.D) < 1e-9;
    });
  })());

ok("D2 the center-stability: grabbing where the line already is does not jump",
  (() => {
    if (!line) return false;
    // the line's own midpoint: solve v on h = 0.5 from the ORIGINAL line
    const vMid = (line.D - line.A * 0.5) / line.B;
    const off = obliqueTraceDragOffset(ZTILE, DIMS, POS, CUT, { h: 0.5, v: vMid });
    return off !== null && Math.abs(off - CUT.offset) < 1e-9;
  })(), `line=${JSON.stringify(line)}`);

ok("D3 the direction: the offset rides the normal's sign (below the line = deeper along +n)",
  (() => {
    if (!line) return false;
    const vLine = (line.D - line.A * 0.5) / line.B;
    const above = obliqueTraceDragOffset(ZTILE, DIMS, POS, CUT, { h: 0.5, v: Math.max(0, vLine - 0.2) });
    const below = obliqueTraceDragOffset(ZTILE, DIMS, POS, CUT, { h: 0.5, v: Math.min(1, vLine + 0.2) });
    return above !== null && below !== null && above < CUT.offset && below > CUT.offset;
  })(), `line=${JSON.stringify(line)}`);

ok("D4 the cut's own dialect holds: the solved offset never leaves [−1, 1] — the geometry self-limits (the line lives in the box, the hand lives in the tile), the door's clamp is the second net",
  (() => {
    // sweep a steep cut across the whole square × the whole slice — the
    // deepest honest fact: no pointer inside the tile can throw the
    // solve past the box's own reach
    const steep = { theta: 0.5, phi: 45, offset: 0 };
    const yTile = { axis: "y", hAxis: "x", vAxis: "z" };
    let min = Infinity, max = -Infinity;
    for (let i = 0; i <= 10; i++)
      for (let j = 0; j <= 10; j++) {
        const o = obliqueTraceDragOffset(yTile, DIMS, j / 10, steep, { h: i / 10, v: j / 10 });
        if (o === null) return false;
        if (o < min) min = o;
        if (o > max) max = o;
      }
    const stdFar = obliqueTraceDragOffset(ZTILE, DIMS, POS, CUT, { h: 0.5, v: 1 });
    return max <= 1 && min >= -1 && Math.abs(stdFar - 0.5) < 1e-9;
  })());

ok("D5 the ∥ silence: a plane degenerate with the tile's own slice draws no line and drags none",
  obliqueTraceDragOffset({ axis: "z", hAxis: "x", vAxis: "y" }, DIMS, POS, { theta: 0, phi: 0, offset: 0 }, { h: 0.5, v: 0.5 }) === null &&
  obliqueTraceLine({ axis: "z", hAxis: "x", vAxis: "y" }, DIMS, POS, { theta: 0, phi: 0, offset: 0 }) === null);

ok("D6 the degenerate dims keep the honest silence (no box, no hand)",
  obliqueTraceDragOffset(ZTILE, [1, 1, 1], POS, CUT, { h: 0.5, v: 0.5 }) === null &&
  obliqueTraceLine(ZTILE, [64], POS, CUT) === null &&
  obliqueTraceDragOffset(ZTILE, DIMS, NaN, CUT, { h: 0.5, v: 0.5 }) === null &&
  obliqueTraceDragOffset(ZTILE, DIMS, POS, CUT, { h: NaN, v: 0.5 }) === null);

ok("D7 purity: the same inputs answer the same, own no references",
  obliqueTraceDragOffset(ZTILE, DIMS, POS, CUT, { h: 0.3, v: 0.6 }) ===
  obliqueTraceDragOffset(ZTILE, DIMS, POS, CUT, { h: 0.3, v: 0.6 }) &&
  CUT.offset === 0 && DIMS.length === 3);

/* ------------------------------------------------------------------ */
/* H — the hit-test                                                    */
/* ------------------------------------------------------------------ */

const TRACE = { x1: 10, y1: 20, x2: 90, y2: 80 }; // percents of the square
const TILE = { w: 400, h: 400 };

ok("H1 a point on the segment grabs (the midpoint, the quarter points)",
  obliqueTraceHit(TRACE, TILE, { x: 200, y: 400 * 0.5 }) &&
  obliqueTraceHit(TRACE, TILE, { x: 400 * 0.325, y: 400 * 0.35 }));

ok("H2 a far point does not (the opposite corner)",
  !obliqueTraceHit(TRACE, TILE, { x: 380, y: 10 }));

ok("H3 the radius honors the tile's pixel size (a small tile is as grabbable as a large one)",
  (() => {
    // the same fraction offset from the line: ~2.8% of the square
    const p = { x: 200 + 12, y: 400 * 0.5 };
    const small = { x: 50 + 3, y: 100 * 0.5 };
    return obliqueTraceHit(TRACE, TILE, p) && obliqueTraceHit(TRACE, { w: 100, h: 100 }, small);
  })());

ok("H4 the segment clamps at its ends (beyond the endpoint is a miss when the reach says so)",
  (() => {
    // a point past (x1,y1) along the line's direction but beyond grab range
    return !obliqueTraceHit(TRACE, TILE, { x: 400 * 0.02, y: 400 * 0.125 }) &&
      !obliqueTraceHit(TRACE, { w: 0, h: 400 }, { x: 10, y: 10 }) &&
      !obliqueTraceHit(TRACE, TILE, { x: 200, y: 202 }, 0.5);
  })());

/* ------------------------------------------------------------------ */
/* W — the wiring (the tile rides the ONE lib)                         */
/* ------------------------------------------------------------------ */

ok("W1 the tile imports the ONE lib — the gesture is never re-derived inline",
  panelSrc.includes(`from "@/lib/oblique-trace-drag"`) &&
  panelSrc.includes("obliqueTraceDragOffset(") &&
  panelSrc.includes("obliqueTraceHit("));

ok("W2 the grab gates on the hit and the button (a stray click never steals the pick) — the t1100 re-key: the rim's own endpoint test now answers FIRST, both hits still gate the grab (the span widened for the second DOF's gate)",
  /tracePointerDown = \(e: React\.PointerEvent<HTMLDivElement>\) => \{\s*\n\s*if \(!obliqueCut \|\| !obliqueTrace \|\| e\.button !== 0\) return;/.test(panelSrc) &&
  /tracePointerDown[\s\S]{0,800}obliqueTraceHit\(/.test(panelSrc) &&
  /tracePointerDown[\s\S]{0,500}obliqueTraceEndpointHit\(/.test(panelSrc));

ok("W3 the dispatch rides the sliders' own door (OBLIQUE_CLIP_EVENT, the cut's θ/φ intact) — the t1100 re-key: the detail is now built once per mode (the slide's own bytes unchanged, the dispatch unified), the door and the shape are the loop's own",
  /traceSlideTo[\s\S]{0,1400}\{ on: true, theta: cut\.theta, phi: cut\.phi, offset \}/.test(panelSrc) &&
  /traceSlideTo[\s\S]{0,1800}new CustomEvent\(OBLIQUE_CLIP_EVENT, \{ detail \}\)/.test(panelSrc));

ok("W4 the throttle and the trailing word (the embed's plane rebuild deserves a breath)",
  panelSrc.includes(">= 120") &&
  /tracePointerUp[\s\S]{0,300}traceSlideTo\(e, true\)/.test(panelSrc));

ok("W5 the pick yields once (the grab owns the click that ends its own drag)",
  /pickFocus[\s\S]{0,200}if \(traceDrag\.current\?\.moved\) \{/.test(panelSrc) &&
  panelSrc.includes("cursor-grabbing") &&
  panelSrc.includes('traceRiding ? "cursor-grabbing" : traceHover && "cursor-grab"'));

ok("W6 the loop's ACK half closes the truth (the block mirrors the scene — t661, no desync)",
  /const onAck = \(e: Event\) => \{[\s\S]{0,900}OBLIQUE_CLIP_STATE_EVENT[\s\S]{0,120}removeEventListener\(OBLIQUE_CLIP_STATE_EVENT/.test(panelSrc) &&
  /setOffset\(Math\.round\(Math\.min\(1, Math\.max\(-1, d\.offset\)\) \* 100\)\)/.test(panelSrc));

/* ------------------------------------------------------------------ */

console.log(`\n${fail === 0 ? "GREEN" : "RED"}: ${pass}/${pass + fail} green`);
process.exit(fail === 0 ? 0 : 1);

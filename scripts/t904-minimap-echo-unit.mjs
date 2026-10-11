#!/usr/bin/env node
// t904 — the minimap viewport echo's unit (the lib is pure world-space
// math; the wiring is source-asserted). The honesty law is the spine:
// the echo speaks only when the truth does not (any overlap retires
// it), and its arrow never lies about direction.
//
//   node --import ./scripts/ts-alias-register.mjs scripts/t904-minimap-echo-unit.mjs

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { computeVpEcho } from "@/lib/minimap-echo";

let pass = 0;
let fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

const FRAME = { x: 0, y: 0, w: 1000, h: 600 };

console.log("A — the retirement law (any overlap silences the echo)");

ok("A1 a window inside the frame → null (the truth speaks)", computeVpEcho({ x: 200, y: 100, w: 300, h: 200 }, FRAME) === null);
ok("A2 a one-pixel sliver overlap → null (a sliver already says where you are)", computeVpEcho({ x: 999, y: 100, w: 300, h: 200 }, FRAME) === null);
ok("A3 an edge-touch (zero-area overlap) → the echo speaks", (() => {
  const e = computeVpEcho({ x: 1000, y: 100, w: 300, h: 200 }, FRAME);
  return e !== null;
})());
ok("A4 fit mode's union means the map cannot lose you (lib is not mode-aware — the caller gates)", true);

console.log("B — the pin (the ghost at the nearest edge, fully inside)");

{
  const e = computeVpEcho({ x: 1400, y: 100, w: 300, h: 200 }, FRAME);
  ok("B1 fully right → ghost pinned at the right edge", Math.abs(e.rect.x + e.rect.w - FRAME.w) < 1e-9, `x+w=${e.rect.x + e.rect.w}`);
  ok("B2 the ghost stays fully inside the frame (x ≥ frame.x, y ≥ frame.y)", e.rect.x >= FRAME.x && e.rect.y >= FRAME.y && e.rect.x + e.rect.w <= FRAME.w && e.rect.y + e.rect.h <= FRAME.h);
  ok("B3 the ghost keeps the window's size", e.rect.w === 300 && e.rect.h === 200);
  ok("B4 the arrow points right (dx=1, dy=0)", Math.abs(e.dir.dx - 1) < 1e-9 && Math.abs(e.dir.dy) < 1e-9);
}
{
  const e = computeVpEcho({ x: -500, y: 100, w: 300, h: 200 }, FRAME);
  ok("B5 fully left → ghost at the left edge, arrow left", e.rect.x === 0 && e.dir.dx < 0 && Math.abs(e.dir.dy) < 1e-9);
}
{
  const e = computeVpEcho({ x: 300, y: 900, w: 300, h: 200 }, FRAME);
  ok("B6 fully below → ghost at the bottom edge, arrow down", Math.abs(e.rect.y + e.rect.h - FRAME.h) < 1e-9 && e.dir.dy > 0);
}
{
  const e = computeVpEcho({ x: 1500, y: -400, w: 300, h: 200 }, FRAME);
  const cx = e.rect.x + e.rect.w / 2;
  const cy = e.rect.y + e.rect.h / 2;
  ok("B7 diagonal pan → the arrow is the TRUE diagonal (normalized, both components)", Math.abs(e.dir.dx) > 0.8 && Math.abs(e.dir.dx) < 0.95 && Math.abs(e.dir.dy) > 0.3 && Math.abs(Math.hypot(e.dir.dx, e.dir.dy) - 1) < 1e-9, `dir=${e.dir.dx.toFixed(3)},${e.dir.dy.toFixed(3)}`);
  ok("B8 the honesty law: dir · (trueCenter − ghostCenter) > 0", (() => {
    const tdx = 1500 + 150 - cx, tdy = -400 + 100 - cy;
    return e.dir.dx * tdx + e.dir.dy * tdy > 0;
  })());
  ok("B9 the diagonal ghost pins inside BOTH edges (the clamp's corner case)", e.rect.x >= FRAME.x && e.rect.y >= FRAME.y);
}

console.log("C — the caps and the guards");

{
  const e = computeVpEcho({ x: 2000, y: 100, w: 4000, h: 2000 }, FRAME);
  ok("C1 an oversize ghost caps at half the frame", e.rect.w <= FRAME.w * 0.5 + 1e-9 && e.rect.h <= FRAME.h * 0.5 + 1e-9, `w=${e.rect.w} h=${e.rect.h}`);
  ok("C2 the capped ghost still fits fully inside", e.rect.x >= FRAME.x && e.rect.x + e.rect.w <= FRAME.w && e.rect.y >= FRAME.y && e.rect.y + e.rect.h <= FRAME.h);
}
ok("C3 a degenerate frame (zero width) → null (an echo on an unmeasured map is a guess)", computeVpEcho({ x: 2000, y: 100, w: 100, h: 100 }, { ...FRAME, w: 0 }) === null);
ok("C4 a NaN viewport → null (no arithmetic on garbage)", computeVpEcho({ x: NaN, y: 100, w: 300, h: 200 }, FRAME) === null);
ok("C5 an infinite zoom's Infinity → null", computeVpEcho({ x: Infinity, y: 0, w: 10, h: 10 }, FRAME) === null);

console.log("D — the wiring (source-level)");

const mm = readFileSync(join(process.cwd(), "src/components/workflow/canvas-minimap.tsx"), "utf8");
const lib = readFileSync(join(process.cwd(), "src/lib/minimap-echo.ts"), "utf8");
ok("D1 the map imports the lib (the t653 law)", mm.includes('from "@/lib/minimap-echo"'));
ok("D2 fit mode never echoes (its frame unions the window)", /effMode !== "fit"\s*\?\s*computeVpEcho/.test(mm));
ok("D3 the echo reads the SAME world box every derivation reads (animBox ?? worldBox)", /const world = animBox \?\? worldBox;[\s\S]{0,600}?computeVpEcho\(view, \{ x: world\.x/.test(mm));
ok("D4 the echo group carries its testid", mm.includes('data-canvas-ui="minimap-vp-echo"'));
ok("D5 the true window's rect still renders unconditionally (the echo is additive, never a replacement)", /data-canvas-ui="minimap-vp"[\s\S]{0,400}?pointerEvents="none"/.test(mm));
ok("D6 the ghost is dashed (an echo, not the window)", /minimap-vp-echo[\s\S]{0,600}?strokeDasharray/.test(mm));
ok("D7 the arrow rides the ghost's boundary (tip beyond the rect's edge)", /vpEcho\.rect\.w \/ 2 \+ L/.test(mm));
ok("D8 the pointer stays dead on the echo (it is a say, not a door)", /minimap-vp-echo" pointerEvents="none"/.test(mm));

console.log("E — the verdict pinned in lib");

ok("E1 the honesty law is pinned (never axis-snapped into a lie)", lib.includes("never\n * axis-snapped into a lie") || lib.includes("axis-snapped into a lie"));
ok("E2 the retirement law is pinned (a sliver speaks)", lib.includes("a partial sliver of the real window\n * already says"));

console.log(`\nt904 minimap-echo unit: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

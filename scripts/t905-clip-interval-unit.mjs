#!/usr/bin/env node
// t905 — the clip slab seat's unit: the kept-interval arithmetic is
// BEHAVIORAL (the lib imports clean — no Mol* in its module graph), the
// embed wiring is source-asserted (the t653 law: the faces the user drags
// and the planes commitClip builds can never disagree).
//
//   node --import ./scripts/ts-alias-register.mjs scripts/t905-clip-interval-unit.mjs

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { keptIntervalOf, normalizeInterval } from "@/lib/clip-interval";

let pass = 0;
let fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

console.log("A — normalizeInterval (the clamp + order law)");

ok("A1 clamps above 1", JSON.stringify(normalizeInterval(0.2, 1.7)) === "[0.2,1]");
ok("A2 clamps below 0", JSON.stringify(normalizeInterval(-0.5, 0.4)) === "[0,0.4]");
ok("A3 a crossed pair sorts (the thumbs may pass, the region never lies)", JSON.stringify(normalizeInterval(0.8, 0.3)) === "[0.3,0.8]");
ok("A4 equal faces stay (a collapsed slab = the plane cut)", JSON.stringify(normalizeInterval(0.5, 0.5)) === "[0.5,0.5]");

console.log("B — keptIntervalOf (the box wins; the scalar laws)");

const scalar = (x, y, z, invert = false) => ({ invert, x, y, z, box: null });
ok("B1 the live box's interval IS the kept interval", (() => {
  const st = { invert: false, x: 1, y: 1, z: 1, box: { lo: [0.1, 0, 0.3], hi: [0.9, 1, 0.6] } };
  return JSON.stringify(keptIntervalOf(st, 0)) === "[0.1,0.9]" && JSON.stringify(keptIntervalOf(st, 2)) === "[0.3,0.6]";
})());
ok("B2 scalar invert=false keeps [0,v]", JSON.stringify(keptIntervalOf(scalar(0.4, 1, 1), 0)) === "[0,0.4]");
ok("B3 scalar invert=true keeps [v,1]", JSON.stringify(keptIntervalOf(scalar(0.4, 1, 1, true), 0)) === "[0.4,1]");
ok("B4 the scalar at ≥0.999 is the ABSENT plane — full extent", JSON.stringify(keptIntervalOf(scalar(1, 1, 1), 0)) === "[0,1]" && JSON.stringify(keptIntervalOf(scalar(0.999, 1, 1, true), 0)) === "[0,1]");
ok("B5 each axis reads its own scalar", JSON.stringify(keptIntervalOf(scalar(0.3, 0.7, 1), 1)) === "[0,0.7]" && JSON.stringify(keptIntervalOf(scalar(0.3, 0.7, 1), 2)) === "[0,1]");
ok("B6 the invert flag does not touch a box (the region is the truth)", (() => {
  const st = { invert: true, x: 1, y: 1, z: 1, box: { lo: [0.2, 0.2, 0.2], hi: [0.8, 0.8, 0.8] } };
  return JSON.stringify(keptIntervalOf(st, 1)) === "[0.2,0.8]";
})());

console.log("C — the embed wiring (the seat's seams)");

const emb = readFileSync(join(process.cwd(), "src/components/workflow/results/molstar-embed.tsx"), "utf8");
ok("C1 the embed imports the lib (the t653 law)", emb.includes('from "@/lib/clip-interval"'));
ok("C2 the interval intent exists beside the box intent", /const applyClipAxisInterval = \(axis: 0 \| 1 \| 2, rawLo: number, rawHi: number\)/.test(emb));
ok("C3 the intent composes: the other axes keep their CURRENT intervals", /i === axis \? \(\[lo, hi\] as \[number, number\]\) : keptIntervalOf\(st, i\)/.test(emb));
ok("C4 the intent mints through applyClipBoxIntent (one language downstream)", /applyClipAxisInterval[\s\S]{0,500}?applyClipBoxIntent\(/.test(emb));
ok("C5 the rows read keptIntervalOf (both branches unified)", /const \[lo, hi\] = keptIntervalOf\(clipStateRef\.current, axisIdx\)/.test(emb));
ok("C6 the slider carries TWO faces (value=[lo,hi])", /value=\{\[lo, hi\]\}/.test(emb));
ok("C7 the read-only readout retired (no boxLive fiction)", !emb.includes("boxLive"));
ok("C8 the slab hint speaks (the scalar branch's discoverability)", emb.includes("two faces per axis — drag either to keep a slab"));
ok("C9 the live box header speaks (the reshape affordance)", emb.includes("kept box — drag any face to reshape"));
ok("C10 the interval readout carries its testids", /clip-interval-\$\{ax\.toLowerCase\(\)\}/.test(emb));
ok("C11 the release button survives (the honest unclip)", emb.includes('data-testid="clip-box-release"'));
ok("C12 the reset badge rides the interval language (full extent)", /applyClipAxisInterval\(axisIdx, 0, 1\)/.test(emb));

console.log("D — the lib's verdict pinned");

const lib = readFileSync(join(process.cwd(), "src/lib/clip-interval.ts"), "utf8");
ok("D1 the slab gap is named (the box language was read-only)", lib.includes("READ-ONLY in the UI"));
ok("D2 the absent-plane law is pinned (≥0.999 ≡ full)", lib.includes("the ABSENT plane"));
ok("D3 the crossed-thumbs law is pinned (the sorted pair)", lib.includes("never lies"));

console.log(`\nt905 clip-interval unit: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

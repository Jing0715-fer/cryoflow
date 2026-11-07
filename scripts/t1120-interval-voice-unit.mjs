#!/usr/bin/env node
// t1120 — the interval readout's voxel voice: the lib word is BEHAVIORAL
// (voxel-voice imports clean — no Mol* in its module graph), the embed
// wiring is source-asserted (the t653 law: the readout the user reads
// and the word the lib mints can never disagree). The ONE formula law:
// both ends ride voxelIndexOf's round — no second arithmetic anywhere.
//
//   node --import ./scripts/ts-alias-register.mjs scripts/t1120-interval-voice-unit.mjs

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { voxelIntervalReadout, voxelIndexOf } from "@/lib/voxel-voice";

let pass = 0;
let fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

console.log("A — voxelIntervalReadout (the address law)");

// A1 the middle of the box: lo=0.5 → idx round(0.5·63)=32 → "33";
//    hi=0.75 → round(47.25)=47 → "48" — 1-based inclusive, ONE formula
ok("A1 mid slab speaks 33–48/64",
  voxelIntervalReadout(0.5, 0.75, 64) === "33–48/64",
  String(voxelIntervalReadout(0.5, 0.75, 64)));

// A2 the full extent still speaks at lib level (the call site's full row
//    keeps its — dash; the word itself is honest about 0..1)
ok("A2 full extent speaks 1–64/64",
  voxelIntervalReadout(0.0, 1.0, 64) === "1–64/64",
  String(voxelIntervalReadout(0.0, 1.0, 64)));

// A3 unknown grid → null (the bare percent stays the honest fallback)
ok("A3 null dim → null", voxelIntervalReadout(0.2, 0.8, null) === null);

// A4 degenerate / fractional / NaN dims → null (the honest denominator
//    guarantee — "33/63.5" is a lie the family never speaks)
ok("A4 dim 1 → null", voxelIntervalReadout(0.2, 0.8, 1) === null);
ok("A5 dim 1.5 → null", voxelIntervalReadout(0.2, 0.8, 1.5) === null);
ok("A6 dim NaN → null", voxelIntervalReadout(0.2, 0.8, NaN) === null);

// A7 inverted ends → null (the call site normalizes; the word refuses)
ok("A7 inverted → null", voxelIntervalReadout(0.9, 0.1, 64) === null);

// A8 the clamp: lo=−0.2 clamps to plane 1; hi=0.5 → 33
ok("A8 negative lo clamps to 1–33/64",
  voxelIntervalReadout(-0.2, 0.5, 64) === "1–33/64",
  String(voxelIntervalReadout(-0.2, 0.5, 64)));

// A9 a razor slab (lo === hi) is a single plane: "33–33/64"
ok("A9 zero-width slab speaks 33–33/64",
  voxelIntervalReadout(0.5, 0.5, 64) === "33–33/64",
  String(voxelIntervalReadout(0.5, 0.5, 64)));

// A10 a tiny grid (dim 2) rounds honestly: 0.001→1, 0.999→2
ok("A10 dim-2 grid speaks 1–2/2",
  voxelIntervalReadout(0.001, 0.999, 2) === "1–2/2",
  String(voxelIntervalReadout(0.001, 0.999, 2)));

// A11 the ONE formula law: the word's ends agree with voxelIndexOf
//     exactly, on a sweep of fractions
let sweep = true;
for (let i = 0; i <= 20; i++) {
  const lo = i / 40, hi = 1 - i / 50;
  const d = 37;
  const expect = `${voxelIndexOf(lo, d) + 1}–${voxelIndexOf(hi, d) + 1}/${d}`;
  if (voxelIntervalReadout(lo, hi, d) !== expect) { sweep = false; break; }
}
ok("A11 21-point sweep agrees with voxelIndexOf", sweep);

console.log("B — the wiring (source-asserted, the t653 law)");

const emb = readFileSync(join(process.cwd(), "src/components/workflow/results/molstar-embed.tsx"), "utf8");
const lib = readFileSync(join(process.cwd(), "src/lib/voxel-voice.ts"), "utf8");

ok("B1 the embed imports the word from the family lib",
  emb.includes("voxelIntervalReadout") && /voxelIntervalReadout[\s\S]{0,120}from "@\/lib\/voxel-voice"/.test(emb.replace(/\r\n/g, "\n")));
ok("B2 the readout row rides the voice (not a re-mint)",
  emb.includes("voxelIntervalReadout(lo, hi, clipBox()?.dims?.[axisIdx] ?? null)"));
ok("B3 the full row keeps its — dash (the old voice is the fallback)",
  emb.includes('{full ? (') && emb.includes('"—"'));
ok("B4 the testids survive (the t905 contract)",
  /clip-interval-\$\{ax\.toLowerCase\(\)\}/.test(emb));
ok("B5 the boundary paragraph speaks the refined law",
  lib.includes("t1120 the SLIDER language's axis rows join the voxel family"));
ok("B6 the oblique/box languages stay fraction-voiced (the boundary's core)",
  lib.includes("ANCHORED-BOX language stay"));
ok("B7 the word rides the ONE formula (voxelIndexOf inside)",
  /export function voxelIntervalReadout[\s\S]*?voxelIndexOf\(lo, dim\)[\s\S]*?voxelIndexOf\(hi, dim\)/.test(lib));

console.log(`\nt1120 interval-voice unit: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

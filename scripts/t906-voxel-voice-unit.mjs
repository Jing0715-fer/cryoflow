#!/usr/bin/env node
// t906 — the voxel voice's unit: the address arithmetic is BEHAVIORAL
// (the lib imports clean — no Mol*/React in its module graph), the embed
// and the ortho panel wiring are source-asserted (the t653 law: one
// formula, five voices, no face can drift from another).
//
//   node --import ./scripts/ts-alias-register.mjs scripts/t906-voxel-voice-unit.mjs

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { axisIndex, dimAlong, voxelAriaText, voxelAnnotation, voxelIndexOf, voxelPlaneVoice, voxelReadout, voxelSliderVoice } from "@/lib/voxel-voice";

let pass = 0;
let fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

console.log("A — voxelIndexOf (the ONE formula)");

ok("A1 round-half: pos 0.5 of 64 → index 32 (the 33rd voxel)", voxelIndexOf(0.5, 64) === 32);
ok("A2 the ends: pos 0 → 0, pos 1 → dim−1", voxelIndexOf(0, 64) === 0 && voxelIndexOf(1, 64) === 63);
ok("A3 clamps an out-of-range pos (the honest guard)", voxelIndexOf(1.2, 64) === 63 && voxelIndexOf(-0.1, 64) === 0);
ok("A4 mid positions ride the same round commitSlice always spoke", voxelIndexOf(0.25, 64) === 16 && voxelIndexOf(0.98, 64) === 62);
ok("A5 unusable dims refuse: null / undefined / 1 / 0 / NaN", voxelIndexOf(0.5, null) === null && voxelIndexOf(0.5, undefined) === null && voxelIndexOf(0.5, 1) === null && voxelIndexOf(0.5, 0) === null && voxelIndexOf(0.5, NaN) === null);
ok("A6 a fractional dim refuses (a fractional denominator is a lie)", voxelIndexOf(0.5, 63.5) === null);

console.log("B — the five voices (byte-format arms)");

ok("B1 the tile's voice is byte-identical to its historic format", voxelReadout(0.5, "z", 64) === "z 33/64");
ok("B2 the tile's fallback keeps the old % voice", voxelReadout(0.5, "z", null) === "z 50%");
ok("B3 the slider speaks the combined form; fallback is the bare %", voxelSliderVoice(0.5, 64) === "33/64 · 50%" && voxelSliderVoice(0.5, null) === "50%");
ok("B4 the plane label speaks the address; fallback the bare %", voxelPlaneVoice(0.5, "Z", 64) === "Z 33/64" && voxelPlaneVoice(0.5, "Z", null) === "50%");
ok("B5 the aria text is the fullest form; fallback keeps the old voice", voxelAriaText(0.5, "Z", 64) === "plane Z at voxel 33 of 64 (50%)" && voxelAriaText(0.5, "Z", null) === "plane Z at 50%");
ok("B6 the annotation is compact and burnable; fallback the old voice", voxelAnnotation(0.5, "Z", 64) === "Z 33/64 (50%)" && voxelAnnotation(0.5, "Z", null) === "Z 50%");
ok("B7 the axis case is the caller's voice (pass-through)", voxelReadout(0.5, "Z", 64) === "Z 33/64" && voxelReadout(0.5, "x", 64) === "x 33/64");
ok("B8 the edges speak 1/64 and 64/64 (1-based, denominator = dim)", voxelReadout(0, "z", 64) === "z 1/64" && voxelReadout(1, "z", 64) === "z 64/64");
ok("B9 the convention sweep agrees with the tile's historic formula", (() => {
  // the exact expression the tile spoke before the seat — every pos/dim
  // pair in the sweep must agree (drift here would rewrite history)
  for (const dim of [2, 8, 64, 192, 256]) {
    for (let i = 0; i <= 20; i++) {
      const pos = i / 20;
      const legacy = Math.round(pos * (dim - 1));
      if (voxelIndexOf(pos, dim) !== Math.min(dim - 1, Math.max(0, legacy))) return false;
      if (voxelReadout(pos, "z", dim) !== `z ${legacy + 1}/${dim}`) return false;
    }
  }
  return true;
})());

console.log("C — axisIndex / dimAlong (the address's coordinates)");

ok("C1 the letter→index map speaks both cases", axisIndex("x") === 0 && axisIndex("X") === 0 && axisIndex("y") === 1 && axisIndex("Y") === 1 && axisIndex("z") === 2 && axisIndex("Z") === 2);
ok("C2 dimAlong reads the right component", dimAlong([64, 65, 66], "z") === 66 && dimAlong([64, 65, 66], "X") === 64);
ok("C3 dimAlong honestly refuses an absent grid", dimAlong(null, "z") === null && dimAlong(undefined, "z") === null && dimAlong([64], "z") === null);

console.log("D — the embed wiring (the seat's seams)");

const emb = readFileSync(join(process.cwd(), "src/components/workflow/results/molstar-embed.tsx"), "utf8");
ok("D1 the embed imports the lib (the t653 law)", emb.includes('from "@/lib/voxel-voice"'));
ok("D2 the dims mirror exists — state AND ref", /const \[gridDims, setGridDims\] = useState<\[number, number, number\] \| null>\(null\)/.test(emb) && /const gridDimsRef = useRef<\[number, number, number\] \| null>\(null\)/.test(emb));
ok("D3 the load path mirrors the dims (the first-Volume walk, readout-only)", /mirror the grid dims \(readout-only\)/.test(emb) && /gridDimsRef\.current = triple/.test(emb) && /setGridDims\(triple\)/.test(emb));
ok("D4 commitSlice rides the ONE formula (the inline clamp is gone)", emb.includes("voxelIndexOf(st.pos, dims[axisIdx]) ?? 0") && !emb.includes("Math.round(st.pos * (dims[axisIdx] - 1))"));
ok("D5 the slider readout rides the voice (the bare % render is gone)", emb.includes("voxelSliderVoice(slicePos, sliceAxDim)") && !emb.includes("{Math.round(slicePos * 100)}%"));
ok("D6 the aria text rides the voice", emb.includes("aria-valuetext={voxelAriaText(slicePos, sliceAxis, sliceAxDim)}"));
ok("D7 the plane label rides the voice (the old label is gone)", emb.includes("plane {voxelPlaneVoice(slicePos, sliceAxis, sliceAxDim)}") && !emb.includes("plane {Math.round(slicePos * 100)}%"));
ok("D8 the bookmark chip re-voices display-time (the live grid, not the snapshot)", emb.includes("voxelAnnotation(v.slice.pos, v.slice.axis, dimAlong(gridDims, v.slice.axis))"));
ok("D9 BOTH annotation builders ride the REF (closure-safe at capture time)", (emb.match(/dimAlong\(gridDimsRef\.current, st\.axis\)/g) || []).length === 2);
ok("D10 the stored truth stays the fraction (the snapshot type is untouched)", emb.includes("slice: { on: boolean; axis: SliceAxis; pos: number }"));
ok("D11 the clip boundary holds: the clip annotation keeps its fraction language", emb.includes("`clip ${axes.join(\" \")}${cp.invert ? \" · flip\" : \"\"}`"));
ok("D12 the active-axis dim is ONE derivation feeding every voice", /const sliceAxDim: number \| null = gridDims \? dimAlong\(gridDims, sliceAxis\) : null;/.test(emb));

console.log("E — the ortho panel wiring (the tile rides the same lib)");

const panel = readFileSync(join(process.cwd(), "src/components/workflow/results/map-ortho-panel.tsx"), "utf8");
ok("E1 the panel imports the lib", panel.includes('import { voxelReadout } from "@/lib/voxel-voice"'));
ok("E2 the inline formula is gone (no second father)", !panel.includes("Math.max(0, (dim ?? 0) - 1)"));
ok("E3 the readout rides the lib", panel.includes("const readout = voxelReadout(pos, spec.axis, dim);"));
ok("E4 the panel's docblock still speaks the convention", panel.includes("real voxel indices"));

console.log("F — the lib's verdict pinned");

const lib = readFileSync(join(process.cwd(), "src/lib/voxel-voice.ts"), "utf8");
ok("F1 the two-dialect gap is named (the 3D said %, the tiles said voxels)", lib.includes('said "50%"'));
ok("F2 the stored-truth law is pinned (the fraction survives, the voice is display-time)", lib.includes("the stored truth stays the FRACTION"));
ok("F3 the clip boundary is pinned (the clip family keeps fractions)", lib.includes("keeps its fraction language"));
ok("F4 the honest-denominator law is pinned (fractional dims refuse)", lib.includes("a fractional or degenerate dim would make"));

console.log(`\nt906 voxel-voice unit: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

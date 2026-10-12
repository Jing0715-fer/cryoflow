#!/usr/bin/env node
/* t870 diagnostic — dissect the footer band's true pixel structure */
import sharp from "sharp";
const p = process.argv[2] || "shots-qa/t870-export-1.png";
const { data, info } = await sharp(p).raw().toBuffer({ resolveWithObject: true });
const w = info.width, h = info.height, ch = info.channels;
const px = (x, y) => { const i = (y * w + x) * ch; return [data[i], data[i + 1], data[i + 2]]; };
const eq = (a, c, tol = 10) => Math.abs(a[0]-c[0]) <= tol && Math.abs(a[1]-c[1]) <= tol && Math.abs(a[2]-c[2]) <= tol;
const BG = [0x0b,0x12,0x20];
// footer band y 574..638. Find non-bg column extents + colour families.
const fams = {
  border: [0x33,0x45,0x55], bar: [0x64,0x74,0x8b], tick: [0x47,0x55,0x69],
  mean: [0xe2,0xe8,0xf0], cut: [0x22,0xd3,0xee], text: [0x94,0xa3,0xb8],
};
const counts = {};
for (const k of Object.keys(fams)) counts[k] = new Array(w).fill(0);
let nonbgMin = 1e9, nonbgMax = -1;
for (let y = 574; y < 638; y++)
  for (let x = 0; x < w; x++) {
    const c = px(x, y);
    if (!eq(c, BG, 8)) { if (x < nonbgMin) nonbgMin = x; if (x > nonbgMax) nonbgMax = x; }
    for (const k of Object.keys(fams)) if (eq(c, fams[k], 14)) counts[k][x]++;
  }
console.log(`doc ${w}x${h}; footer non-bg extent x ${nonbgMin}..${nonbgMax}`);
for (const k of Object.keys(fams)) {
  const cols = counts[k].map((n, x) => ({ x, n })).filter((e) => e.n >= 3);
  const runs = [];
  let s = -1;
  for (let i = 0; i <= w; i++) {
    const on = i < w && counts[k][i] >= 3;
    if (on && s < 0) s = i;
    if (!on && s >= 0) { runs.push([s, i-1]); s = -1; }
  }
  console.log(`${k}: total=${counts[k].reduce((a,b)=>a+b,0)} runs>=3px: ${runs.length > 24 ? runs.length + " (first 24: " + JSON.stringify(runs.slice(0,24)) + ")" : JSON.stringify(runs)}`);
}
// vertical extent of the border-ish columns at the found bands
for (const x of [nonbgMin, nonbgMax]) {
  let ys = [];
  for (let y = 574; y < 638; y++) if (!eq(px(x, y), BG, 8)) ys.push(y);
  console.log(`column x=${x}: non-bg rows ${ys[0]}..${ys[ys.length-1]} (${ys.length}px)`);
}
// a horizontal colour sample through the band
const ySample = 606;
let out = [];
for (let x = 560; x < 800; x += 4) { const c = px(x, ySample); out.push(`${x}:${c.map(v=>v.toString(16).padStart(2,"0")).join("")}`); }
console.log(`row y=${ySample} samples: ${out.join(" ")}`);

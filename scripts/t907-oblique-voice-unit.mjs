#!/usr/bin/env node
// t907 — the oblique depth voice's unit: the cut's position has ONE
// honest address (voxels along its own normal) and the seat's arithmetic
// is BEHAVIORAL — the shared walk (obliqueSupportVox) must be bit-exact
// against ALL THREE historic inline copies (the server's render truth,
// the panel's readout mirror, the embed's plane builder) for every
// in-range angle; the voices must speak the byte-formats the 2D slider
// and the 3D chip have always spoken; the embed and the panel wiring are
// source-asserted (the t653 law: one father, every face rides it, the
// server's render truth stays untouched).
//
//   node --import ./scripts/ts-alias-register.mjs scripts/t907-oblique-voice-unit.mjs

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  obliqueCutAnnotation,
  obliqueDepthVox,
  obliqueDepthVoice,
  obliqueOffsetPctVoice,
  obliqueSupportVox,
  voxelIndexOf,
} from "@/lib/voxel-voice";

let pass = 0;
let fail = 0;
const ok = (label, cond, extra) => {
  if (cond) { pass++; console.log(`  ok: ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${extra ? ` — ${extra}` : ""}`); }
};

const ROOT = "/home/z/my-project";
const embedSrc = readFileSync(join(ROOT, "src/components/workflow/results/molstar-embed.tsx"), "utf8");
const panelSrc = readFileSync(join(ROOT, "src/components/workflow/results/map-ortho-panel.tsx"), "utf8");
const mrcSrc = readFileSync(join(ROOT, "src/lib/mrc.ts"), "utf8");

/* ------------------------------------------------------------------ */
/* the three HISTORIC inline walks, verbatim (pre-t907 transcriptions) */
/* ------------------------------------------------------------------ */

const DEG = Math.PI / 180;

// 1 — the server's readMrcObliqueSlice (mrc.ts, the render truth):
// non-finite angles read as 0, then clamp.
function serverWalk(nx, ny, nz, thetaDeg, phiDeg) {
  const t = Number.isFinite(thetaDeg) ? Math.min(180, Math.max(0, thetaDeg)) * DEG : 0;
  const p = Number.isFinite(phiDeg) ? Math.min(360, Math.max(0, phiDeg)) * DEG : 0;
  const normal = [Math.sin(t) * Math.cos(p), Math.sin(t) * Math.sin(p), Math.cos(t)];
  const c = [(nx - 1) / 2, (ny - 1) / 2, (nz - 1) / 2];
  const corner = (i, j, k) => [i ? nx - 1 : 0, j ? ny - 1 : 0, k ? nz - 1 : 0];
  let supportN = 0;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) {
    const co = corner(i, j, k);
    const d = [co[0] - c[0], co[1] - c[1], co[2] - c[2]];
    supportN = Math.max(supportN, Math.abs(d[0] * normal[0] + d[1] * normal[1] + d[2] * normal[2]));
  }
  return supportN;
}

// 2 — the panel's obliqueFrame historic inline (raw angles, no clamp —
// unreachable from the block: the state law keeps the angles in-range).
function panelWalkHistoric(nx, ny, nz, thetaDeg, phiDeg) {
  const t = thetaDeg * DEG;
  const p = phiDeg * DEG;
  const normal = [Math.sin(t) * Math.cos(p), Math.sin(t) * Math.sin(p), Math.cos(t)];
  const c = [(nx - 1) / 2, (ny - 1) / 2, (nz - 1) / 2];
  let support = 0;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) for (let k = 0; k < 2; k++) {
    const d = [(i ? nx - 1 : 0) - c[0], (j ? ny - 1 : 0) - c[1], (k ? nz - 1 : 0) - c[2]];
    support = Math.max(support, Math.abs(d[0] * normal[0] + d[1] * normal[1] + d[2] * normal[2]));
  }
  return support;
}

// 3 — the embed's buildObliqueClipPlane historic inline (clamped angles,
// no finite check — NaN propagated into a garbage plane; riding the lib
// converged it onto the render truth's law).
function builderWalkHistoric(nx, ny, nz, thetaDeg, phiDeg) {
  const t = Math.min(180, Math.max(0, thetaDeg)) * DEG;
  const p = Math.min(360, Math.max(0, phiDeg)) * DEG;
  const n = [Math.sin(t) * Math.cos(p), Math.sin(t) * Math.sin(p), Math.cos(t)];
  const c = [(nx - 1) / 2, (ny - 1) / 2, (nz - 1) / 2];
  let supportN = 0;
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++)
      for (let k = 0; k < 2; k++) {
        const d = [(i ? nx - 1 : 0) - c[0], (j ? ny - 1 : 0) - c[1], (k ? nz - 1 : 0) - c[2]];
        supportN = Math.max(supportN, Math.abs(d[0] * n[0] + d[1] * n[1] + d[2] * n[2]));
      }
  return supportN;
}

console.log("A — the shared walk: bit-exact against all three historic copies");
const DIMS = [[64, 64, 64], [13, 52, 27], [128, 128, 256], [2, 3, 5], [1, 64, 64], [5, 1, 1]];
const THETAS = [];
for (let t = 0; t <= 180; t += 15) THETAS.push(t);
const PHIS = [];
for (let p = 0; p <= 360; p += 20) PHIS.push(p);
let walked = 0;
let mismatch = null;
outer:
for (const [nx, ny, nz] of DIMS) {
  for (const t of THETAS) {
    for (const p of PHIS) {
      const lib = obliqueSupportVox([nx, ny, nz], t, p);
      const s = serverWalk(nx, ny, nz, t, p);
      const ph = panelWalkHistoric(nx, ny, nz, t, p);
      const bh = builderWalkHistoric(nx, ny, nz, t, p);
      walked++;
      if (lib !== s) { mismatch = `lib ${lib} !== server ${s} @ dims ${nx},${ny},${nz} θ${t} φ${p}`; break outer; }
      if (lib !== ph) { mismatch = `lib ${lib} !== panel-historic ${ph} @ dims ${nx},${ny},${nz} θ${t} φ${p}`; break outer; }
      if (lib !== bh) { mismatch = `lib ${lib} !== builder-historic ${bh} @ dims ${nx},${ny},${nz} θ${t} φ${p}`; break outer; }
    }
  }
}
ok(`the walk is bit-identical (===) across ${walked} dims×θ×φ cases`, mismatch === null, mismatch);

ok("non-finite θ reads as 0 (the SERVER's law — the render truth's)",
  obliqueSupportVox([64, 64, 64], NaN, 30) === serverWalk(64, 64, 64, NaN, 30)
  && obliqueSupportVox([64, 64, 64], 45, Infinity) === serverWalk(64, 64, 64, 45, Infinity));
ok("out-of-range angles clamp (θ 200 → 180, φ −20 → 0)",
  obliqueSupportVox([64, 64, 64], 200, 30) === obliqueSupportVox([64, 64, 64], 180, 30)
  && obliqueSupportVox([64, 64, 64], 45, -20) === obliqueSupportVox([64, 64, 64], 45, 0));
ok("the poles are honest (θ 0: exact half the z extent; θ 180: the same within cos(π_float)'s ε — the render obeys the same walk, the noise IS the truth)",
  obliqueSupportVox([64, 64, 64], 0, 0) === 31.5
  && Math.abs(obliqueSupportVox([64, 64, 64], 180, 0) - 31.5) < 1e-9);
ok("a dim of 1 is legal (a flattened axis contributes a zero leg)",
  obliqueSupportVox([1, 64, 64], 45, 0) !== null && obliqueSupportVox([1, 64, 64], 45, 0) > 0);
ok("null/short/bad dims refuse (the honest silence)",
  obliqueSupportVox(null, 45, 30) === null
  && obliqueSupportVox(undefined, 45, 30) === null
  && obliqueSupportVox([64, 64], 45, 30) === null
  && obliqueSupportVox([0, 64, 64], 45, 30) === null
  && obliqueSupportVox([NaN, 64, 64], 45, 30) === null);

console.log("B — the depth arithmetic (the builder's own law, now the lib's)");
ok("the plain multiply is bit-exact vs the historic inline expression",
  obliqueDepthVox(0.3, 31.5) === 0.3 * 31.5
  && obliqueDepthVox(-0.25, 90.5) === -0.25 * 90.5
  && obliqueDepthVox(1, 31.5) === 1 * 31.5);
ok("the fraction clamps to [−1, 1] (the builder's law)",
  obliqueDepthVox(1.5, 10) === 10 && obliqueDepthVox(-2, 10) === -10);
ok("non-finite fraction reads as 0 (the builder's law)",
  obliqueDepthVox(NaN, 10) === 0 && obliqueDepthVox(Infinity, 10) === 0);
ok("no box, no depth (support 0 / negative / non-finite → 0)",
  obliqueDepthVox(0.5, 0) === 0 && obliqueDepthVox(0.5, -3) === 0 && obliqueDepthVox(0.5, NaN) === 0);
ok("±0 unify (0 === -0; the anchor and the bytes cannot tell the difference)",
  obliqueDepthVox(-0.5, 0) === -0.5 * 0);

console.log("C — the voices' bytes (the formats the faces have always spoken)");
ok("obliqueOffsetPctVoice: the 3D chip's historic bytes",
  obliqueOffsetPctVoice(0.3) === "+30%"
  && obliqueOffsetPctVoice(-0.3) === "-30%"
  && obliqueOffsetPctVoice(0) === "+0%"
  && obliqueOffsetPctVoice(-0.001) === "0%");
ok("obliqueOffsetPctVoice: the clamp is invisible in-range, real out-of-range",
  obliqueOffsetPctVoice(0.999) === "+100%"
  && obliqueOffsetPctVoice(1) === "+100%"
  && obliqueOffsetPctVoice(1.5) === "+100%"
  && obliqueOffsetPctVoice(-1) === "-100%"
  && obliqueOffsetPctVoice(NaN) === "+0%");
ok("obliqueDepthVoice: the 2D slider row's historic bytes",
  obliqueDepthVoice(9.6) === "+9.6 vox"
  && obliqueDepthVoice(-3.2) === "-3.2 vox"
  && obliqueDepthVoice(0) === "+0.0 vox"
  && obliqueDepthVoice(9.96) === "+10.0 vox"
  && obliqueDepthVoice(63.06) === "+63.1 vox"
  && obliqueDepthVoice(NaN) === "+0.0 vox");
ok("obliqueCutAnnotation: the full form (angles · % · depth · flip)",
  obliqueCutAnnotation({ theta: 45, phi: 90, offset: 0.3, invert: true }, 32) === "oblique cut 45°·90° · +30% · +9.6 vox · flip");
ok("obliqueCutAnnotation: no flip keeps the tail off",
  obliqueCutAnnotation({ theta: 45, phi: 90, offset: 0.3, invert: false }, 32) === "oblique cut 45°·90° · +30% · +9.6 vox");
ok("obliqueCutAnnotation: null support honestly omits the depth, keeps the % (the position still rides)",
  obliqueCutAnnotation({ theta: 45, phi: 90, offset: 0.3, invert: false }, null) === "oblique cut 45°·90° · +30%"
  && obliqueCutAnnotation({ theta: 45, phi: 90, offset: 0.3, invert: true }, null) === "oblique cut 45°·90° · +30% · flip");
ok("obliqueCutAnnotation: negative depth speaks its sign",
  obliqueCutAnnotation({ theta: 0, phi: 0, offset: -0.1, invert: false }, 63) === "oblique cut 0°·0° · -10% · -6.3 vox");

console.log("D — the seams (source-asserted against the living tree)");
// the embed's four voice sites + the builder's lib ride
ok("E1 the 3D chip's readout rides the pct voice + the depth suffix",
  embedSrc.includes("{obliqueOffsetPctVoice(obliqueClip.offset)}{obliqueDepthSuffix()}")
  && embedSrc.includes("const obliqueDepthSuffix = () => {"));
ok("E2 the bookmark chip speaks the offset the restore obeys",
  embedSrc.includes("cut {v.oblique.theta}°·{v.oblique.phi}° · {obliqueOffsetPctVoice(v.oblique.offset)}"));
ok("E3 both figure footers ride the annotation voice with the shared walk",
  (embedSrc.match(/annotations\.push\(obliqueCutAnnotation\(ob, obliqueSupportVox\(gridDimsRef\.current, ob\.theta, ob\.phi\)\)\)/g) || []).length === 2);
ok("E4 the builder's inline walk is GONE (one father; no fourth copy)",
  !embedSrc.includes("let supportN = 0;")
  && embedSrc.includes("const supportN = obliqueSupportVox(dims, ob.theta, ob.phi);")
  && embedSrc.includes("const depth = obliqueDepthVox(ob.offset, supportN);"));
ok("E5 the anchor rides the lib's depth (bit-identical order: (frac·support)·n)",
  embedSrc.includes("c[0] + depth * n[0]"));
// the panel's rides
ok("E6 the panel's obliqueFrame rides the shared walk + the depth arithmetic",
  panelSrc.includes("const support = obliqueSupportVox(dims, thetaDeg, phiDeg) ?? 0;")
  && panelSrc.includes("offsetVox: obliqueDepthVox(offsetFrac, support),")
  && !panelSrc.includes("support = Math.max(support,"));
ok("E7 the panel's offset row rides the two voices (byte-identical format)",
  panelSrc.includes("{obliqueOffsetPctVoice(offset / 100)} · {obliqueDepthVoice(frame.offsetVox)}"));
ok("E8 the export dialogue speaks the LIVE readings (always honest) with the prov glyph prefixing while it holds",
  panelSrc.includes("${ob.live.theta}°·${ob.live.phi}° · ${obliqueOffsetPctVoice(ob.live.offset / 100)} · ${obliqueDepthVoice(ob.offsetVox)}")
  && panelSrc.includes('prov.kind === "jump" ? "⌖" : "⤸"'));
ok("E9 the tile's alt voice gained the address (prose keeps its θ/φ form)",
  panelSrc.includes("offset ${obliqueOffsetPctVoice(offset / 100)} (${obliqueDepthVoice(frame.offsetVox)})"));
// the render truth's independence
ok("E10 the server's readMrcObliqueSlice keeps its own walk (the render truth untouched — the voice converges TO it, not the reverse)",
  mrcSrc.includes("supportN = Math.max(supportN, Math.abs(d[0] * normal[0] + d[1] * normal[1] + d[2] * normal[2]));"));
// the boundaries
ok("E11 the t906 slice family is untouched (voxelIndexOf's law stands — and the A4 lesson holds: 0.98·63 rounds to 62, NOT 63; the arm that said 63 lied twice now)",
  voxelIndexOf(0.5, 64) === 32 && voxelIndexOf(0.98, 64) === 62);
ok("E12 the clip family keeps its fraction language (the t905 boundary — no oblique voice in the clip sites)",
  embedSrc.includes("`${ax.toUpperCase()} ${Math.round(cp[ax] * 100)}%`")
  && !embedSrc.includes("obliqueCutAnnotation(cp"));

console.log("E — the verdicts pinned");
ok("F1 the depth is the ONE honest position for a plane without an axis (the % is a share of an angle-dependent support)",
  obliqueSupportVox([64, 64, 64], 0, 0) !== obliqueSupportVox([64, 64, 64], 45, 0)
  && obliqueOffsetPctVoice(0.3) === obliqueOffsetPctVoice(0.3));
ok("F2 the stored truth stays the FRACTION (bookmarks keep {theta, phi, offset, invert}; the voices are display-time)",
  embedSrc.includes("oblique: {") && embedSrc.includes("theta: obliqueClipRef.current.theta"));
ok("F3 the voices refuse nothing — they fall back (null support omits depth, keeps %; bad dims refuse the walk, not the cut)",
  obliqueCutAnnotation({ theta: 10, phi: 20, offset: 0, invert: false }, null) === "oblique cut 10°·20° · +0%");

console.log(`\nt907 oblique-voice unit: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

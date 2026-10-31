#!/usr/bin/env node
/**
 * t1129 — the OBLIQUE-SHEET unit: the cut's FACE.
 *
 * THE FEATURE (this unit's birth — the new-feature pool's biggest live
 * item, scouted this window): the oblique cut (t661) opens the isosurface
 * along an arbitrary plane, but the plane itself carries no pixels — the
 * eye sees the opening, never the data it reveals. Mol* 5.11's slice
 * representation takes mode 'plane' (point + normal in the mesh's
 * cartesian space), so the cut can WEAR the data it crosses: a density
 * sheet ON the cutting plane — the face the surface opens to reveal. The
 * 2D oblique tile and the 3D cut already spoke the same geometry; the
 * face is the third voice on that one plane.
 *
 * THE LAWS (what this unit pins):
 *  - ONE number: the face's point IS the cut's anchor — the lib's
 *    obliqueAnchorVox (center + depth·n, minted this window) drives the
 *    sheet builder, and the F band sweeps it bit-exact against the clip
 *    builder's own anchor walk (t662 mirror pattern, current bytes) — a
 *    cut and its face can never disagree about where the plane sits;
 *  - the invert invariance: the flip chooses which HALF-SPACE the surface
 *    keeps, the boundary plane itself does not move — the sheet builder's
 *    signature has no invert, the face is identical from both sides;
 *  - the retirement law: no cut, no face — the node only mounts while
 *    the cut is on, and the axis-slice sweep (deleteAllSlices) must not
 *    eat it (both are "Slice" cells; the sheet's own ref opts it out);
 *  - one truth per plane: the ACK wire (OBLIQUE_CLIP_STATE_EVENT) gains
 *    the face's LIVE truth (preference AND cut both on) — the panel's ▣
 *    is pressed exactly when a face is actually showing; the sheet's
 *    intent rides its OWN wire (OBLIQUE_SHEET_EVENT — the cut's event
 *    keeps its {on,theta,phi,offset} shape);
 *  - the shared threshold: the face's isoValue rides the SAME contour
 *    (signRef·sigmaRef) the isosurface and the axis slice speak, and the
 *    σ/sign effect re-pumps it;
 *  - the ride-along: saved views carry the face INSIDE the cut's own
 *    branch (sheet?: boolean — an explicit true revives, every other
 *    shape restores off, legacy views never promised a face);
 *  - the figure confesses: the export footers and recorded figures push
 *    OBLIQUE_SHEET_ANNOTATION when the face was on (one new fact, the
 *    address is the cut's own).
 *
 *   node --import ./scripts/ts-alias-register.mjs scripts/t1129-oblique-sheet-unit.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  OBLIQUE_SHEET_ANNOTATION,
  obliqueAnchorVox,
  obliqueDepthVox,
  obliqueNormal,
  obliqueSupportVox,
} from "@/lib/voxel-voice";

const ROOT = path.resolve(import.meta.dirname, "..");
let pass = 0;
let fail = 0;
const ok = (cond, name) => {
  if (cond) {
    pass++;
    console.log(`ok ${pass} - ${name}`);
  } else {
    fail++;
    console.log(`NOT OK ${fail} - ${name}`);
  }
};
const count = (hay, needle) => hay.split(needle).length - 1;

const embed = readFileSync(path.join(ROOT, "src/components/workflow/results/molstar-embed.tsx"), "utf8");
const panel = readFileSync(path.join(ROOT, "src/components/workflow/results/map-ortho-panel.tsx"), "utf8");
const lib = readFileSync(path.join(ROOT, "src/lib/voxel-voice.ts"), "utf8");

/* the sheet-builder slice: from its export to the next doc block */
const sheetFnStart = embed.indexOf("export function buildObliqueSheetPlane");
const sheetFnEnd = embed.indexOf("/** The cut's 3D guide", sheetFnStart);
const sheetFn = sheetFnStart >= 0 && sheetFnEnd > sheetFnStart ? embed.slice(sheetFnStart, sheetFnEnd) : "";

/* A band — the lib's anchor word (real imports, real arithmetic) */
ok(typeof obliqueAnchorVox === "function", "A1 the anchor word is minted in the lib (the ONE father of the plane position)");
ok(count(lib, "export function obliqueAnchorVox(") === 1, "A2 the anchor word is minted exactly once");
{
  const c = [31.5, 31.5, 31.5];
  const a0 = obliqueAnchorVox({ theta: 45, phi: 90, offset: 0 }, [64, 64, 64]);
  ok(!!a0 && a0[0] === c[0] && a0[1] === c[1] && a0[2] === c[2], "A3 offset 0 anchors the grid center (the zero-depth law)");
}
{
  // the ONE-walk sweep: anchor == center + depth·n, bit-exact, across
  // dims × angles × offsets (the depth arithmetic rides the same lib)
  let bad = 0;
  let samples = 0;
  for (const dims of [[64, 64, 64], [96, 96, 64], [200, 200, 200], [1, 64, 64]]) {
    for (const theta of [0, 30, 90, 120, 180]) {
      for (const phi of [0, 45, 180, 270, 359]) {
        for (const offset of [-1, -0.3, 0, 0.42, 1]) {
          const sup = obliqueSupportVox(dims, theta, phi);
          const a = obliqueAnchorVox({ theta, phi, offset }, dims);
          if (sup === null || !a) { bad++; continue; }
          const depth = obliqueDepthVox(offset, sup);
          const n = obliqueNormal(theta, phi);
          const c = [(dims[0] - 1) / 2, (dims[1] - 1) / 2, (dims[2] - 1) / 2];
          const want = [c[0] + depth * n[0], c[1] + depth * n[1], c[2] + depth * n[2]];
          samples++;
          if (!(Object.is(a[0], want[0]) && Object.is(a[1], want[1]) && Object.is(a[2], want[2]))) bad++;
        }
      }
    }
  }
  ok(bad === 0 && samples === 500, `A4 the anchor walk is ONE arithmetic across dims×angles×offsets (500 samples, ${bad} bad)`);
}
{
  // monotone along +n: growing the offset moves the anchor along the cut's
  // own normal, never sideways
  const dims = [64, 64, 64];
  const n = obliqueNormal(60, 210);
  const lo = obliqueAnchorVox({ theta: 60, phi: 210, offset: -0.5 }, dims);
  const hi = obliqueAnchorVox({ theta: 60, phi: 210, offset: 0.5 }, dims);
  const step = lo && hi ? [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]] : null;
  ok(!!step && step[0] > 0 === n[0] > 0 && step[1] > 0 === n[1] > 0 && step[2] > 0 === n[2] > 0 && Math.hypot(...step) > 0,
    "A5 growing the offset walks the anchor along +n (the depth's own direction)");
}
{
  const a = obliqueAnchorVox({ theta: 45, phi: 90, offset: 0.5 }, [64, 64, NaN]);
  const b = obliqueAnchorVox({ theta: 45, phi: 90, offset: 0.5 }, [64, 64]);
  const c = obliqueAnchorVox({ theta: 45, phi: 90, offset: 0.5 }, null);
  ok(a === null && b === null && c === null, "A6 unusable dims → the honest null (no guessed anchor)");
  const center = obliqueAnchorVox({ theta: 45, phi: 90, offset: Number.NaN }, [64, 64, 64]);
  ok(!!center && center[0] === 31.5 && center[1] === 31.5 && center[2] === 31.5, "A7 non-finite offset reads 0-depth → the center (the builder's own law)");
  const clamped = obliqueAnchorVox({ theta: 45, phi: 90, offset: 5 }, [64, 64, 64]);
  const atOne = obliqueAnchorVox({ theta: 45, phi: 90, offset: 1 }, [64, 64, 64]);
  ok(!!clamped && !!atOne && Object.is(clamped[0], atOne[0]) && Object.is(clamped[1], atOne[1]) && Object.is(clamped[2], atOne[2]),
    "A8 the offset clamp holds (|frac| ≤ 1 → +5 lands where +1 lands)");
}
ok(OBLIQUE_SHEET_ANNOTATION === "oblique face (density on the cut plane)", "A9 the annotation word's exact bytes (one new fact, the address is the cut's own)");

/* B band — the sheet builder in the embed (bytes) */
ok(count(embed, "export function buildObliqueSheetPlane(") === 1, "B1 the sheet builder is minted once, next to the cut's own");
ok(count(sheetFn, "obliqueAnchorVox(ob, dims)") === 1, "B2 the sheet's point rides the lib's anchor word (ONE number)");
ok(count(sheetFn, "obliqueNormal(ob.theta, ob.phi)") === 1, "B3 the sheet's normal is the cut's own voxel normal");
ok(
  count(sheetFn, "geo.origin[0] + anchorVox[0] * (geo.extents[0] / dims[0])") === 1 &&
    count(sheetFn, "geo.origin[1] + anchorVox[1] * (geo.extents[1] / dims[1])") === 1 &&
    count(sheetFn, "geo.origin[2] + anchorVox[2] * (geo.extents[2] / dims[2])") === 1,
  "B4 the conversion is the clip builder's own walk (origin + vox·(extents/dims))"
);
ok(count(sheetFn, "return null") >= 2, "B5 the honest nulls stand (unusable dims, unusable anchor)");
ok(!/invert/.test(sheetFn), "B6 invert is deliberately ABSENT — the flip keeps half-spaces, the boundary plane does not move");

/* C band — the commit/pump/intent family (bytes) */
ok(count(embed, 'mode: "plane" as const') === 1, "C1 the sheet node is born 'plane' (Mol* slice's arbitrary-plane mode)");
ok(count(embed, "plane: { point: sheet.point, normal: sheet.normal }") === 1, "C2 the plane params speak point + normal (createPlaneImage's own dialect)");
ok(count(embed, "isoValue: IsoValue.relative(signRef.current * sigmaRef.current)") === 1, "C3 the face shares the contour (signRef·sigmaRef — the isosurface's own threshold)");
ok(count(embed, "if (!sheetStateRef.current.on || !ob.on)") === 1, "C4 the retirement law (no cut, no face) gates the commit");
ok(count(embed, "const sheetIntentRef = useRef(applySheetIntent);") === 1, "C5 the intent rides the stale-closure ref (the slice/clip listeners' own law)");
ok(count(embed, "window.addEventListener(OBLIQUE_SHEET_EVENT, onObliqueSheet)") === 1, "C6 the sheet's own wire is listened to once");
ok(
  count(embed, "sheet: sheetStateRef.current.on && obliqueClipRef.current.on") === 2,
  "C7 BOTH appliers ACK the face's LIVE truth (the ▣ presses exactly when a face shows)"
);
ok(count(embed, "void pumpSheet();") >= 2, "C8 every cut intent re-pumps the face (the sheet follows its plane)");
ok(
  count(embed, "if (!sheetStateRef.current.on) return;\n    void pumpSheet();") === 1,
  "C9 the σ/sign effect re-pumps the face (the shared threshold's own shadow)"
);
ok(count(embed, "const [sheetOn, setSheetOn] = useState(false);") === 1, "C10 the sheet's preference state is minted once");
ok(count(embed, "const sheetCellRef = sheetRef.current?.transform?.ref ?? null;") === 1, "C11 the axis-slice sweep opts the face out (both are Slice cells; the ref decides)");

/* D band — the panel's ▣ face toggle (bytes) */
ok(count(panel, 'export const OBLIQUE_SHEET_EVENT = "cryoflow:oblique-sheet";') === 1, "D1 the sheet's wire is minted once in the panel (the event family's home)");
ok(count(panel, 'data-canvas-ui="ortho-oblique-sheet3d"') === 1, "D2 the ▣ face toggle exists (the cut block's fourth verb)");
ok(count(panel, "disabled={!cut3d}") === 1, "D3 the face needs the cut (disabled until ✂ is on — no plane, no face)");
ok(
  count(panel, "▣ face — hang the density ON the cut plane") === 1 &&
    count(panel, "the image shares the contour σ — on maps whose peaks sit near the contour the face reads solvent-quiet") === 1 &&
    count(panel, "▣ face — the density sheet needs the cut: press ✂ first") === 1,
  "D4 the title's voices (the offer + the gate + the contour boundary — the offline audit's honest confession: image.frag:161 culls value<isoLevel, so a map whose peaks sit near the contour reads a quiet face)"
);
ok(count(panel, "setSheet3d(d.sheet === true)") === 1, "D5 the ACK corrects the ▣ (the live truth rides the same wire as the cut's)");
ok(count(panel, "new CustomEvent(OBLIQUE_SHEET_EVENT, { detail: { on: next } })") === 1, "D6 the click speaks {on} over the sheet's own wire");
ok(count(panel, "aria-pressed={sheet3d}") === 1, "D7 the ▣ speaks pressed-state (the toggle family's a11y law)");

/* E band — the bookmark ride-along (bytes) */
ok(
  count(embed, "sheet: sheetStateRef.current.on,") >= 1 &&
    embed.indexOf("sheet: sheetStateRef.current.on,") > embed.indexOf("oblique: {") &&
    embed.indexOf("sheet: sheetStateRef.current.on,") < embed.indexOf("}),\n  });\n\n  /** gentle duplicate-name guard"),
  "E1 the capture carries the face INSIDE the cut's own branch"
);
ok(count(embed, "applySheetIntent({ on: v.oblique.sheet === true });") === 1, "E2 the restore revives the face inside the cut's own branch");
ok(
  count(embed, "oblique?: { on: boolean; theta: number; phi: number; offset: number; invert: boolean; sheet?: boolean };") === 1,
  "E3 the view type grows sheet?: boolean (explicit true only — legacy views never promised a face)"
);

/* F band — the ONE-number law, mirrored (t662 pattern, CURRENT bytes):
 * the clip builder's anchor walk vs the sheet builder's lib-minted walk —
 * the face sits EXACTLY where the cut cuts, bit-exact, across the sweep */
const OBLIQUE_DEG = Math.PI / 180;
function clipAnchorPoint(ob, geo) {
  const dims = geo.dims;
  if (!Array.isArray(dims) || dims.length !== 3 || dims.some((d) => !(d >= 1))) return null;
  const t = Math.min(180, Math.max(0, ob.theta)) * OBLIQUE_DEG;
  const p = Math.min(360, Math.max(0, ob.phi)) * OBLIQUE_DEG;
  const n = [Math.sin(t) * Math.cos(p), Math.sin(t) * Math.sin(p), Math.cos(t)];
  const c = [(dims[0] - 1) / 2, (dims[1] - 1) / 2, (dims[2] - 1) / 2];
  const supportN = obliqueSupportVox(dims, ob.theta, ob.phi);
  if (supportN === null) return null;
  const depth = obliqueDepthVox(ob.offset, supportN);
  const anchorVox = [c[0] + depth * n[0], c[1] + depth * n[1], c[2] + depth * n[2]];
  return [
    geo.origin[0] + anchorVox[0] * (geo.extents[0] / dims[0]),
    geo.origin[1] + anchorVox[1] * (geo.extents[1] / dims[1]),
    geo.origin[2] + anchorVox[2] * (geo.extents[2] / dims[2]),
  ];
}
function buildObliqueSheetPlaneMirror(ob, geo) {
  const dims = geo.dims;
  if (!Array.isArray(dims) || dims.length !== 3 || dims.some((d) => !(d >= 1))) return null;
  const anchorVox = obliqueAnchorVox(ob, dims);
  if (!anchorVox) return null;
  const point = [
    geo.origin[0] + anchorVox[0] * (geo.extents[0] / dims[0]),
    geo.origin[1] + anchorVox[1] * (geo.extents[1] / dims[1]),
    geo.origin[2] + anchorVox[2] * (geo.extents[2] / dims[2]),
  ];
  return { point, normal: obliqueNormal(ob.theta, ob.phi) };
}
{
  let bad = 0;
  let samples = 0;
  const GEOS = [
    { origin: [0, 0, 0], extents: [64, 64, 64], dims: [64, 64, 64] },
    { origin: [-12.5, 4, 3], extents: [96, 96, 64], dims: [96, 96, 64] },
    { origin: [10, -3, 7], extents: [120, 100, 80], dims: [120, 100, 80] },
  ];
  for (const geo of GEOS) {
    for (const theta of [0, 37, 90, 143, 180]) {
      for (const phi of [0, 63, 180, 291, 360]) {
        for (const offset of [-1, -0.55, 0, 0.28, 1]) {
          const cut = clipAnchorPoint({ theta, phi, offset }, geo);
          const face = buildObliqueSheetPlaneMirror({ theta, phi, offset }, geo);
          samples++;
          if (!cut || !face) { bad++; continue; }
          const same =
            Object.is(cut[0], face.point[0]) &&
            Object.is(cut[1], face.point[1]) &&
            Object.is(cut[2], face.point[2]);
          const nl = Math.hypot(face.normal[0], face.normal[1], face.normal[2]);
          if (!same || Math.abs(nl - 1) > 1e-12) bad++;
        }
      }
    }
  }
  ok(bad === 0 && samples === 375, `F1 the face sits EXACTLY where the cut cuts (375 samples, bit-exact, ${bad} bad)`);
  ok(
    Math.abs(Math.hypot(...buildObliqueSheetPlaneMirror({ theta: 63, phi: 291, offset: 0.3 }, GEOS[1]).normal) - 1) < 1e-12,
    "F2 the face's normal is unit (the cut's own direction, unnormalized inputs ride the lib's clamp)"
  );
  ok(
    buildObliqueSheetPlaneMirror({ theta: 45, phi: 90, offset: 0.4 }, { origin: [0, 0, 0], extents: [64, 64, 64], dims: [64, 0, 64] }) === null &&
      buildObliqueSheetPlaneMirror({ theta: 45, phi: 90, offset: 0.4 }, { origin: [0, 0, 0], extents: [64, 64, 64], dims: "no" }) === null,
    "F3 the honest no-face: unusable geometry returns null (no guessed sheet)"
  );
}

console.log(`\n${fail === 0 ? "ALL GREEN" : "RED"} — t1129 oblique-sheet unit: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);

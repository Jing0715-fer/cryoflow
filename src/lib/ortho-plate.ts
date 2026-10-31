/**
 * The walk's PRINTER (t1103) — the ortho plate's paper plan.
 *
 * The three tiles live in the Mol* modal and paper never sees them (the
 * Task 70 step-aside law: modals are screen state). What the scientist
 * still needs on paper is the figure the tiles make: the three sections
 * at the focus point, the σ contour the 3D view is drawn at, the live
 * cut's own reading, per-tile voxel addresses. The plate (the panel's
 * print-only face) renders that figure; this lib owns its WORDS.
 *
 * The laws:
 *   - the voices ride the ONE seats (voxel-voice): a tile's caption is
 *     `voxelReadout`'s own bytes ("z 33/64", or the honest "z 52%" when
 *     the grid is unknown), the σ line is the header chip's own dialect
 *     ("iso −2.35 σ"), and the cut's line is `obliqueCutAnnotation`'s
 *     own figure-footer voice ("oblique cut 45°·90° · +30% · +9.6 vox")
 *     — the plate never re-states a formula another face already speaks;
 *   - the honest silences: no grid → no dims line (and the cut's depth
 *     word honestly omitted — the annotation voice's own law); no σ
 *     reported yet → no σ line (the chip must not lie, the plate won't
 *     either); no live cut → no cut line. An all-silent meta row still
 *     prints (empty string), it just says nothing;
 *   - PURE and node-runnable: the whole document's words are decided
 *     before a single pixel prints — the unit can pin every line
 *     without a browser, and the plate's paper can never drift from
 *     the screen's own voices.
 */

import {
  obliqueCutAnnotation,
  obliqueSupportVox,
  voxelReadout,
} from "@/lib/voxel-voice";

/** Everything the plate's words need — the panel's own state, verbatim. */
export interface OrthoPlateInput {
  /** the tri-planar focus point (fraction per axis) */
  positions: { x: number; y: number; z: number };
  /** the grid's shape from the outputs listing — null when unknown */
  dims: readonly [number, number, number] | null;
  /** the σ contour the 3D view is drawn at — null until the embed speaks */
  sigma: { sign: 1 | -1; sigma: number } | null;
  /** the live oblique cut — null while the clip is off */
  oblique: { theta: number; phi: number; offset: number } | null;
}

export interface OrthoPlatePlan {
  /** "64 × 64 × 64 vox" — the box's own shape, or null when unknown */
  dimsLine: string | null;
  /** "iso −2.35 σ" — the chip's own dialect, or null when unreported */
  sigmaLine: string | null;
  /** the cut's annotation voice, or null when no cut is live */
  cutLine: string | null;
  /** per-axis caption readouts, the readout seat's own bytes */
  readouts: { x: string; y: string; z: string };
}

const AXES = ["x", "y", "z"] as const;

/**
 * Plan the plate's words. Pure — the input is never mutated (the cut is
 * copied before the annotation voice rides it: the plate's line never
 * carries a flip word the screen state did not speak).
 */
export function planOrthoPlate(input: OrthoPlateInput): OrthoPlatePlan {
  const dims = input.dims;
  const dimsLine =
    Array.isArray(dims) &&
    dims.length === 3 &&
    dims.every((d) => Number.isFinite(d) && d > 0)
      ? `${dims[0]} × ${dims[1]} × ${dims[2]} vox`
      : null;
  const sigmaLine =
    input.sigma && Number.isFinite(input.sigma.sigma)
      ? `iso ${input.sigma.sign < 0 ? "-" : ""}${input.sigma.sigma.toFixed(2)} σ`
      : null;
  const supportVox =
    input.oblique && dims
      ? obliqueSupportVox(dims, input.oblique.theta, input.oblique.phi)
      : null;
  const cutLine = input.oblique
    ? obliqueCutAnnotation(
        {
          theta: input.oblique.theta,
          phi: input.oblique.phi,
          offset: input.oblique.offset,
          invert: false,
        },
        supportVox
      )
    : null;
  const readouts = {
    x: voxelReadout(input.positions.x, "x", dims ? dims[0] : null),
    y: voxelReadout(input.positions.y, "y", dims ? dims[1] : null),
    z: voxelReadout(input.positions.z, "z", dims ? dims[2] : null),
  };
  return { dimsLine, sigmaLine, cutLine, readouts };
}

/** The plate's meta row — the three lines joined in the header chip's
 * quiet order (shape · contour · cut), empty string when all silent. */
export function orthoPlateMetaLine(plan: OrthoPlatePlan): string {
  return [plan.dimsLine, plan.sigmaLine, plan.cutLine]
    .filter((line): line is string => line !== null)
    .join(" · ");
}

/** The plate's tile request — the SAME URL law the triptych export and
 * the screen tiles speak (axis + pos toFixed(3)): the paper's pixels and
 * the screen's pixels are the same server truth, never two renderings. */
export function orthoPlateTileUrl(
  jobId: string,
  path: string,
  axis: "x" | "y" | "z",
  pos: number
): string {
  const p = Number.isFinite(pos) ? Math.min(1, Math.max(0, pos)) : 0.5;
  return `/api/jobs/${jobId}/outputs/file?path=${encodeURIComponent(
    path
  )}&format=png&axis=${axis}&pos=${p.toFixed(3)}`;
}

/* ------------------------------------------------------------------ */
/* t1104 — the walk's SECOND PAGE: the oblique walk's paper edition.   */
/* The screen's walk button answers the cut through the box along its  */
/* own normal; the plate's second page answers it on paper — six       */
/* frames face to face, the cut's annotation voice introducing them.   */
/* The page rides the SAME laws the first page rides: the words are    */
/* the ONE seats' own bytes (the cut line is page 1's planned cutLine, */
/* never a re-statement; the captions are the t907 voices' own pct     */
/* and depth words, the honest silence included), and the geometry     */
/* rides the walk's own lib (planObliqueFilmstrip + obliqueFilmstrip   */
/*Urls — the panel composes them; this lib only composes WORDS).      */
/* ------------------------------------------------------------------ */

/**
 * The walk page's meta line — page 1's own cut line (the annotation
 * voice's bytes, passed through — never recomputed) joined with the
 * walk's own extent ("6 frames, face to face" — the ladder's own law
 * phrase). A null cut line still names the extent: the frames carry
 * their own position voices, the page honestly says nothing about a
 * cut it cannot see.
 */
export function orthoPlateWalkMetaLine(
  cutLine: string | null,
  frames: number
): string {
  const extent = `${frames} frames, face to face`;
  return cutLine ? `${cutLine} · ${extent}` : extent;
}

/**
 * A walk frame's caption — the pct voice joined with the depth voice
 * when the grid can claim voxels ("+20% · +2.9 vox"); an unusable grid
 * walks on the pct alone (the honest silence is the voice's own, never
 * re-invented here).
 */
export function orthoWalkFrameCaption(frame: {
  pctLabel: string;
  depthLabel: string | null;
}): string {
  return frame.depthLabel
    ? `${frame.pctLabel} · ${frame.depthLabel}`
    : frame.pctLabel;
}

/* ------------------------------------------------------------------ */
/* t1105 — the plate's σ LEG: the map's density distribution joins     */
/* page 1. The t291 export already speaks this figure (the PNG foot-   */
/* er's log-bar miniature with the σ ruler and the cyan cut) — the     */
/* plate is the second paper edition of the same truth, so the DRAWING */
/* law moves here as one pure seat: the bars are log10(1+c) scaled     */
/* (the t291 bytes, restated verbatim and pinned by the unit), the σ   */
/* ruler keeps μ strongest and ±1σ ±2σ quiet, and the cut line rides   */
/* the contour with the same off-scale honesty (clamped to the band,   */
/* faded — never invented past the edge). The inks are the strip's     */
/* own LIGHT edition (t284's HIST_* light constants): paper is always  */
/* light, so the paper leg and the screen strip can never disagree     */
/* about whose distribution this is. The data rides the t291 fetch law */
/* (format=histogram, 8s honest timeout, server-cached per map); a     */
/* null or degenerate payload returns null — the leg honestly stays    */
/* home, the plate prints without the band.                           */
/* ------------------------------------------------------------------ */

/** The paper inks — the strip's light edition restated (the unit pins
 *  the bytes; the strip stays the father, this is the paper's copy). */
export const PLATE_HIST_INKS = {
  bar: "rgba(8,145,178,0.62)",
  tick: "rgba(0,0,0,0.30)",
  mean: "rgba(0,0,0,0.55)",
  cut: "#0891b2",
  text: "rgba(0,0,0,0.45)",
} as const;

/** The histogram payload the paper leg draws — the t291 fetch's own
 *  shape (bins + moments + the render window), verbatim. */
export interface PlateHistPayload {
  bins: number[];
  mean: number;
  std: number;
  lo: number;
  hi: number;
}

/** The planned band geometry, in the SVG's own viewBox units. */
export interface PlateHistPlan {
  bars: { x: number; y: number; w: number; h: number }[];
  /** the σ ruler: μ strongest, ±1σ ±2σ quiet — only in-range ticks */
  ticks: { x: number; strong: boolean }[];
  /** the contour line: clamped into the band, `onScale: false` = the
   *  honest fade (the value lives outside the render window) */
  cut: { x: number; onScale: boolean } | null;
  /** the caption's numbers: the window the bars cover */
  lo: number;
  hi: number;
  w: number;
  h: number;
}

/**
 * Plan the plate's distribution band. Pure — nothing is mutated, every
 * coordinate is decided before a pixel prints. Returns null for a null
 * payload or any degenerate one (no bins, no spread, non-positive σ):
 * the honest absence is the leg's own law, not an error.
 */
export function planPlateHistogram(
  hist: PlateHistPayload | null,
  cut: { sign: 1 | -1; sigma: number } | null,
  w = 600,
  h = 72
): PlateHistPlan | null {
  if (!hist) return null;
  const { bins, mean, std, lo, hi } = hist;
  if (!Array.isArray(bins) || bins.length === 0) return null;
  if (!(std > 0) || !(hi > lo)) return null;
  if (!Number.isFinite(mean)) return null;

  const padL = 8;
  const padR = 8;
  const padT = 6;
  const padB = 6;
  const px0 = padL;
  const px1 = w - padR;
  const py0 = padT;
  const py1 = h - padB;
  const span = hi - lo;
  const xOf = (v: number) => px0 + ((v - lo) / span) * (px1 - px0);

  // the σ ruler — the t291 law: μ strongest, ±1σ ±2σ quiet, out-of-band
  // ticks silently skipped (the ruler never invents a tick past the edge)
  const ticks: { x: number; strong: boolean }[] = [];
  for (const s of [-2, -1, 0, 1, 2]) {
    const gx = xOf(mean + s * std);
    if (gx < px0 || gx > px1) continue;
    ticks.push({ x: gx, strong: s === 0 });
  }

  // log-scaled bars — the t291 bytes: log10(1+c) over log10(1+max),
  // the zero-count bins skipped, the all-zero guard clamps to 1
  let maxC = 0;
  for (const c of bins) if (c > maxC) maxC = c;
  if (maxC <= 0) maxC = 1;
  const logMax = Math.log10(1 + maxC);
  const n = bins.length;
  const bw = (px1 - px0) / n;
  const bars: { x: number; y: number; w: number; h: number }[] = [];
  for (let i = 0; i < n; i++) {
    const c = bins[i];
    if (c <= 0) continue;
    const bh = ((py1 - py0) * Math.log10(1 + c)) / logMax;
    bars.push({
      x: px0 + i * bw,
      y: py1 - bh,
      w: Math.max(0.5, bw - 1),
      h: bh,
    });
  }

  // the contour — clamped into the band, the off-scale case fades
  // (the same honesty the live strip and the t291 export draw)
  let cutPlan: { x: number; onScale: boolean } | null = null;
  if (cut && Number.isFinite(cut.sigma)) {
    const v = mean + cut.sign * cut.sigma * std;
    cutPlan = {
      x: Math.min(px1, Math.max(px0, xOf(v))),
      onScale: v >= lo && v <= hi,
    };
  }

  return { bars, ticks, cut: cutPlan, lo, hi, w, h };
}

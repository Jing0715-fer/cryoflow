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

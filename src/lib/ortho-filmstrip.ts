/**
 * The ortho walks (t1098) — the t1096 oblique walk's SIBLINGS: one axis,
 * swept face to face through the box, exported as ONE document.
 *
 * The oblique walk swept the cut's own normal; the axis walks sweep the
 * box's own axes — z, y, x — the planes the ortho tiles already browse.
 * What no single tile position answers is the same tomographer's question
 * the oblique walk answered for the cut: is the slab homogeneous along
 * THIS axis, does the density fall off toward the faces, is there an
 * internal boundary the current plane happened to straddle. The walk is
 * the axis becoming a film strip: N frames at even positions from 0
 * (one face) to 1 (the other), each rendered by the SAME server truth
 * the tile's live view rides (renderMrcOrthoPng, via the standing
 * outputs/file door), each SIGNED with the tile's own voice (the t906
 * plane voice — "z 33/64" when the grid is known, "z 50%" when it is
 * not; one father, no face drifts).
 *
 * The laws (the oblique walk's own, re-derived in the axis dialect):
 *   - the ladder is face to face INCLUSIVE: pos(0) = 0, pos(N−1) = 1,
 *     even steps between (the walk owns the axis's whole support —
 *     every plane the tile's slider could visit);
 *   - the URL bytes obey the TILE's own src law: axis lowercase, pos
 *     toFixed(3) — the strip's frames and the tile's live view are the
 *     same request shape, so a frame and the screen can never disagree
 *     (the tile's src builds `pos=${rendered.toFixed(3)}`; this lib
 *     speaks the identical bytes);
 *   - the voice rides the ONE plane-voice seat (voxelPlaneVoice) — an
 *     unusable grid still walks (the % carries the position), it just
 *     cannot claim a voxel address; the honest silence is the voice's
 *     own fallback, no new one is invented here;
 *   - everything here is PURE and node-runnable: the plan, the URLs and
 *     the filename are decided before a single fetch flies, so the unit
 *     can pin the whole document's geometry without a browser.
 */

import { voxelPlaneVoice } from "@/lib/voxel-voice";

/** The walk's frame count — six steps across the box: the two faces,
 * two quarter-planes and the center pair. The oblique walk's own count:
 * fewer reads like a shrug, more like a contact sheet; six fits a
 * document row at reading size. */
export const ORTHO_FILMSTRIP_FRAMES = 6;

export type OrthoAxis = "x" | "y" | "z";

export interface OrthoFilmstripFrame {
  /** position along the axis, 0…1 — the server's own param and the
   * tile's slider dialect (fraction of the box's extent). */
  pos: number;
  /** the frame's plane voice ("z 33/64", "z 50%") — the tile's own
   * readout dialect, always present (the % fallback is built in). */
  planeLabel: string;
}

export interface OrthoFilmstripPlan {
  axis: OrthoAxis;
  /** voxels along the walked axis, or null when the grid is unknown
   * (the voice's own fallback trigger). */
  dim: number | null;
  frames: OrthoFilmstripFrame[];
}

/**
 * Plan the walk: the face-to-face position ladder for `frames` stops
 * (≥ 2, non-integers and < 2 fall back to the six-frame default), each
 * stop voiced through the tile's own plane voice. Pure — the input
 * values are never mutated and the output owns no reference to them.
 */
export function planOrthoFilmstrip(
  axis: OrthoAxis,
  dim: number | null | undefined,
  frames: number = ORTHO_FILMSTRIP_FRAMES
): OrthoFilmstripPlan {
  const stops =
    Number.isInteger(frames) && frames >= 2 ? frames : ORTHO_FILMSTRIP_FRAMES;
  const dimVox =
    typeof dim === "number" && Number.isFinite(dim) && dim > 0 ? dim : null;
  const out: OrthoFilmstripFrame[] = [];
  for (let k = 0; k < stops; k++) {
    const pos = k / (stops - 1);
    out.push({
      pos,
      planeLabel: voxelPlaneVoice(pos, axis, dimVox),
    });
  }
  return { axis, dim: dimVox, frames: out };
}

/**
 * The walk's request series — the TILE's own src law, one URL per
 * frame. The params ride in plan order: a frame's URL and its label
 * describe the SAME plane by construction.
 */
export function orthoFilmstripUrls(
  jobId: string,
  path: string,
  plan: OrthoFilmstripPlan
): string[] {
  return plan.frames.map(
    (f) =>
      `/api/jobs/${jobId}/outputs/file?path=${encodeURIComponent(path)}` +
      `&format=png&axis=${plan.axis}&pos=${f.pos.toFixed(3)}`
  );
}

/**
 * The document's name — "ortho-filmstrip-<axis>-<map>-<stamp>.png", the
 * same naming grammar the oblique walk speaks (base stripped of its map
 * extension, the moment's HHMMSS stamp), the axis named where the
 * oblique names its cut.
 */
export function orthoFilmstripFilename(
  path: string,
  axis: OrthoAxis,
  stamp: string
): string {
  const base = path.split("/").pop() || path;
  return `ortho-filmstrip-${axis}-${base.replace(/\.(mrc|mrcs)$/i, "")}-${stamp}.png`;
}

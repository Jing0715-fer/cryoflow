/**
 * The oblique cut's WALK (t1096) — one cut, swept face to face through
 * the box along its own normal, exported as ONE document.
 *
 * The t556 tetraptych exports the cut's PRESENT reading; the t907 voices
 * describe its depth. What no face could do is answer "what does the
 * density look like THROUGH here?" in one gesture — the question every
 * tomographer asks of a cut: is the slab homogeneous, does the density
 * fall off toward the faces, is there an internal boundary the single
 * slice happened to straddle. The walk is the cut's own axis becoming a
 * film strip: N frames at even offsets from −100% (one face) to +100%
 * (the other), each rendered by the SAME server truth the block's live
 * view rides (readMrcObliqueSlice, via the standing outputs/file door),
 * each SIGNED with the voices it inherits (t906/t907 — the pct voice and
 * the voxel depth voice; one father, no face drifts).
 *
 * The laws:
 *   - the ladder is face to face INCLUSIVE: frac(0) = −1, frac(N−1) = +1,
 *     even steps between (the walk owns the box's whole support along n —
 *     the same support obliqueSupportVox computes for the depth voices);
 *   - the URL bytes obey the block's own src law: plane=oblique, θ/φ
 *     toFixed(1), offset toFixed(3) — the strip's frames and the block's
 *     live view are the same request shape, so a frame and the screen
 *     can never disagree about what was rendered;
 *   - the depth voice rides ONLY when the grid is usable (supportVox !=
 *     null) — the honest silence: an unusable grid still walks (the %
 *     carries the position), it just cannot claim voxels;
 *   - everything here is PURE and node-runnable: the plan, the URLs and
 *     the filename are decided before a single fetch flies, so the unit
 *     can pin the whole document's geometry without a browser.
 */

import {
  obliqueDepthVox,
  obliqueDepthVoice,
  obliqueOffsetPctVoice,
  obliqueSupportVox,
} from "@/lib/voxel-voice";

/** The walk's frame count — six steps across the box: the ends, two
 * quarter-planes and the center pair. Fewer reads like a shrug, more
 * like a contact sheet; six fits a document row at reading size. */
export const FILMSTRIP_FRAMES = 6;

export interface ObliqueFilmstripFrame {
  /** offset fraction along the normal, −1…+1 — the server's own param. */
  frac: number;
  /** the block's slider dialect: signed percent, −100…+100. */
  offsetPct: number;
  /** the frame's pct voice ("+20%", "−60%", "+0%") — always present. */
  pctLabel: string;
  /** the frame's depth voice ("+2.9 vox") — null when the grid is
   * unusable (the honest silence the t907 voices already speak). */
  depthLabel: string | null;
}

export interface ObliqueFilmstripPlan {
  theta: number;
  phi: number;
  /** the box's support along the normal in voxel units, or null when
   * the grid is unusable (the voices' own fallback trigger). */
  supportVox: number | null;
  frames: ObliqueFilmstripFrame[];
}

/**
 * Plan the walk: the face-to-face offset ladder for `frames` stops (≥ 2,
 * non-integers and < 2 fall back to the six-frame default), each stop
 * voiced through the t907 seat. Pure — the input values are never
 * mutated and the output owns no reference to them.
 */
export function planObliqueFilmstrip(
  theta: number,
  phi: number,
  dims: readonly number[] | null | undefined,
  frames: number = FILMSTRIP_FRAMES
): ObliqueFilmstripPlan {
  const stops =
    Number.isInteger(frames) && frames >= 2 ? frames : FILMSTRIP_FRAMES;
  const supportVox = obliqueSupportVox(dims, theta, phi);
  const out: ObliqueFilmstripFrame[] = [];
  for (let k = 0; k < stops; k++) {
    const frac = -1 + (2 * k) / (stops - 1);
    const depthLabel =
      supportVox === null
        ? null
        : obliqueDepthVoice(obliqueDepthVox(frac, supportVox));
    out.push({
      frac,
      offsetPct: Math.round(frac * 100),
      pctLabel: obliqueOffsetPctVoice(frac),
      depthLabel,
    });
  }
  return { theta, phi, supportVox, frames: out };
}

/**
 * The walk's request series — the block's own src law, one URL per
 * frame. The params ride in plan order: a frame's URL and its label
 * describe the SAME plane by construction.
 */
export function obliqueFilmstripUrls(
  jobId: string,
  path: string,
  plan: ObliqueFilmstripPlan
): string[] {
  return plan.frames.map(
    (f) =>
      `/api/jobs/${jobId}/outputs/file?path=${encodeURIComponent(path)}` +
      `&format=png&plane=oblique&theta=${plan.theta.toFixed(1)}` +
      `&phi=${plan.phi.toFixed(1)}&offset=${f.frac.toFixed(3)}`
  );
}

/**
 * The document's name — "oblique-filmstrip-<map>-<stamp>.png", the same
 * naming grammar the triptych speaks (base stripped of its map
 * extension, the moment's HHMMSS stamp).
 */
export function obliqueFilmstripFilename(path: string, stamp: string): string {
  const base = path.split("/").pop() || path;
  return `oblique-filmstrip-${base.replace(/\.(mrc|mrcs)$/i, "")}-${stamp}.png`;
}

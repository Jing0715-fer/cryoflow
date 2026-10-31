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
 * The walk's "you are here" (t1108) — the t1107 seat's frac edition:
 * the frame whose plane stands nearest the cut's own offset. The walk
 * sweeps the box's whole support along the normal, and a reader holding
 * the document (paper page 2 or the export) needs to find the plane the
 * cut is actually sitting on: the mark ties the walk back to the live
 * block without a second offset dialect. The law is the ortho seat's
 * own, re-derived in the oblique dialect (the sibling walk libs mirror
 * their laws, never share code — the t1098 precedent): the FIRST frame
 * at the minimal distance wins — the default offset 0 is the exact
 * midpoint of −0.2/+0.2, and the tie resolves toward the face the walk
 * reads first (left to right, the document's own direction — the lower
 * index). A null/undefined or non-finite offset and an empty frame list
 * return null — no mark, no invented plane. Pure.
 */
export function obliqueWalkCurrentIndex(
  frames: ReadonlyArray<{ frac: number }>,
  offset: number | null | undefined
): number | null {
  if (typeof offset !== "number" || !Number.isFinite(offset)) return null;
  let best: number | null = null;
  let bestD = Infinity;
  for (let i = 0; i < frames.length; i++) {
    const d = Math.abs(frames[i].frac - offset);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
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

/* ------------------------------------------------------------------ */
/* t1111 — the direction DIAL: the cut's azimuth ladder. The offset    */
/* walk sweeps the box along the normal (the seats above); the         */
/* direction dial sweeps AROUND the box — six azimuth stations at      */
/* even 60° steps, the cut's second degree of freedom gaining its own  */
/* invitation face. The laws mirror the family (the sibling walks      */
/* mirror their laws, never share code — the t1098 precedent): the     */
/* ladder is even and ascending, φ=360 is honestly absent (it IS       */
/* φ=0 — the circle's own wrap, the ladder excludes the duplicate),    */
/* and the mark's distance is ANGULAR (min(|a−b|, 360−|a−b|)) — 350°   */
/* stands nearer 0° than 300°, a straight difference would lie. Pure   */
/* and node-runnable: the stations and the mark are decided before a   */
/* single click flies.                                                 */
/* ------------------------------------------------------------------ */

/** The dial's station count — six azimuths around the box (0…300 at
 *  60° steps). Fewer reads like a shrug, more like a protractor; six
 *  fits the slider's neighborhood at chip size. */
export const DIRECTION_STATIONS = 6;

export interface ObliqueDirectionStop {
  /** the station's azimuth in whole degrees, 0…300 ascending. */
  phi: number;
  /** the station's voice ("φ 60°") — the chip's own bytes, the one
   * father for every face that names a station. */
  label: string;
}

/**
 * A station's voice — "φ 60°". The φ prefix is the voice's own
 * disambiguation: the θ slider next door speaks degrees too, and a
 * bare "60°" chip would read as either. Pure — one string.
 */
export function obliqueAzimuthVoice(phiDeg: number): string {
  const phi =
    typeof phiDeg === "number" && Number.isFinite(phiDeg)
      ? Math.round(phiDeg)
      : 0;
  return `φ ${phi}°`;
}

/**
 * Plan the direction dial: the azimuth ladder for `stops` stations
 * (≥ 2, non-integers and < 2 fall back to the six-station default),
 * evenly spaced over the full circle with the wrap law applied — the
 * end station is the start (φ=360 ≡ φ=0), so the last stop is a full
 * step BEFORE 360 and the ladder never names the same plane twice.
 * Pure — the output owns no reference to any input.
 */
export function planObliqueDirectionWalk(
  stops: number = DIRECTION_STATIONS
): ObliqueDirectionStop[] {
  const n =
    Number.isInteger(stops) && stops >= 2 ? stops : DIRECTION_STATIONS;
  const step = 360 / n;
  const out: ObliqueDirectionStop[] = [];
  for (let k = 0; k < n; k++) {
    const phi = Math.round(k * step);
    out.push({ phi, label: obliqueAzimuthVoice(phi) });
  }
  return out;
}

/**
 * The direction walk's request series (t1112) — the paper's fourth page
 * asks for the same truth the offset walk's page asks for, with the
 * walk's varying axis rotated: page 2 holds (θ, φ) and varies the
 * offset; the direction walk holds the cut's own θ and offset and
 * varies φ across the stations. The bytes obey the block's own src law
 * verbatim (plane=oblique, θ/φ toFixed(1), offset toFixed(3)) — a
 * paper frame and the live view are the same request shape, so a
 * station's frame and the screen can never disagree about what was
 * rendered. The sibling walks mirror their laws, never share code
 * (the t1098 precedent): this seat is obliqueFilmstripUrls' azimuth
 * edition, not a parameterized merge. Pure.
 */
export function obliqueDirectionWalkUrls(
  jobId: string,
  path: string,
  theta: number,
  offset: number,
  stops: ReadonlyArray<{ phi: number }>
): string[] {
  const th = Number.isFinite(theta) ? theta : 0;
  const off = Number.isFinite(offset) ? offset : 0;
  return stops.map(
    (s) =>
      `/api/jobs/${jobId}/outputs/file?path=${encodeURIComponent(path)}` +
      `&format=png&plane=oblique&theta=${th.toFixed(1)}` +
      `&phi=${s.phi.toFixed(1)}&offset=${off.toFixed(3)}`
  );
}

/**
 * The direction dial's "you are here" (t1111) — the t1108 seat's
 * ANGULAR edition: the stop whose azimuth stands nearest the cut's
 * own, measured around the circle (min(|a−b|, 360−|a−b|)) — the wrap
 * law the straight difference cannot speak. The family's tie law
 * rides unchanged: the FIRST stop at the minimal distance wins, so a
 * hand exactly between two stations reads the lower index (the
 * circle's reading direction — 30° sits between φ 0° and φ 60° and
 * rings φ 0°). A null/undefined or non-finite azimuth and an empty
 * stop list return null — no mark, no invented direction. Out-of-
 * range values are not policed: the wrap distance answers them the
 * circle's own way (361° ≡ 1°), the sliders clamp upstream. Pure.
 */
export function obliqueDirectionWalkCurrentIndex(
  stops: ReadonlyArray<{ phi: number }>,
  phi: number | null | undefined
): number | null {
  if (typeof phi !== "number" || !Number.isFinite(phi)) return null;
  let best: number | null = null;
  let bestD = Infinity;
  for (let i = 0; i < stops.length; i++) {
    const raw = Math.abs(stops[i].phi - phi) % 360;
    const d = Math.min(raw, 360 - raw);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

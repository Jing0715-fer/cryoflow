/**
 * CryoFlow — the resolution arc domain module (t456).
 *
 * The compare family's FIFTH question — and the second that pairs one
 * run with ITSELF (t454 asked "did the classification settle"; this one
 * asks "is the refinement still sharpening"). A gold-standard refinement
 * writes `_rlnCurrentResolution` into every round's model star
 * (data_model_general — the FSC 0.143 crossing of that iteration); read
 * across the run's own rounds, those estimates ARE the refinement's arc:
 * 28 Å of fog sharpening toward 4 Å of map, with diminishing returns.
 *
 * The laws (domain-local):
 *   - THE ARC IS THE ESTIMATE PER ROUND: one number per iteration, read
 *     from the round's half1 model star (gold dialect) or plain model
 *     star (non-gold). Rounds without the column don't exist for the
 *     arc — an old-stub world's rounds simply never join (the arc reads
 *     what the run actually wrote, never invents).
 *   - LOWER IS BETTER, AND THE VERDICT KNOWS IT: the plateau law watches
 *     the last few round-to-round improvements — when the estimate stops
 *     moving more than the threshold, more iterations will not sharpen
 *     the map (RELION's own auto-refine stops for exactly this reason;
 *     the manual dialect has no such criterion, so the verdict says it).
 *   - THE VERDICT READS; THE VERB CONTINUES (t455's law, second home):
 *     the arc's slope informs the decision; the continue verb (the same
 *     row the convergence verdict fires) extends the arc when the
 *     refinement is manual and still improving — and says nothing when
 *     auto-refine owns the run.
 */

import { findPair, parseStar } from "@/lib/starfile";
import { roundLabel } from "@/lib/convergence";

/** The per-round estimate a model star carries (data_model_general). */
export function parseCurrentResolution(text: string): number | null {
  try {
    const v = parseFloat(findPair(parseStar(text), "_rlnCurrentResolution") ?? "");
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

export interface ResolutionPoint {
  iteration: number;
  resolution: number;
  /** Which model star spoke: the gold half1 or the plain model. */
  source: "half1" | "model";
}

/** The arc: sorted by round, deduped by round (the last speaker wins —
 *  a continued run rewrites nothing, but a defensive merge stays honest). */
export function resolutionArcOf(
  points: readonly ResolutionPoint[],
): ResolutionPoint[] {
  const byRound = new Map<number, ResolutionPoint>();
  for (const p of points) {
    if (!Number.isFinite(p.resolution) || p.resolution <= 0) continue;
    byRound.set(p.iteration, p);
  }
  return [...byRound.values()].sort((a, b) => a.iteration - b.iteration);
}

/* ------------------------------------------------------------------ */
/* The plateau law — the verdict's own criterion                       */
/* ------------------------------------------------------------------ */

/** Å. Below this, a round-to-round move is noise, not progress. */
export const PLATEAU_ANGSTROM = 0.3;
/** How many of the LAST round-to-round moves the law watches. */
export const PLATEAU_WINDOW = 3;

export interface ArcVerdict {
  word: "still improving" | "plateaued" | "still moving";
  /** The evidence line: WHICH rounds moved (or didn't), by how much. */
  detail: string;
}

/**
 * The plateau law: watch the last WINDOW round-to-round improvements; if
 * every one of them moved less than PLATEAU_ANGSTROM, the refinement has
 * plateaued — more iterations will not sharpen the map. A move at or
 * above the threshold keeps the run alive, and the LAST move's sign
 * picks the word: sharpening ("still improving") or worsening ("still
 * moving" — mid-run sampling jumps breathe the estimate; the detail says
 * so instead of lying with a positive word). Null below three points
 * (two moves) — a verdict needs evidence, not a guess.
 */
export function arcVerdict(arc: readonly ResolutionPoint[]): ArcVerdict | null {
  if (arc.length < 3) return null;
  const moves: { from: ResolutionPoint; to: ResolutionPoint; delta: number }[] = [];
  for (let i = arc.length - PLATEAU_WINDOW; i < arc.length; i++) {
    const from = arc[i - 1];
    const to = arc[i];
    if (!from || !to) continue;
    moves.push({ from, to, delta: from.resolution - to.resolution });
  }
  if (moves.length === 0) return null;
  const last = moves[moves.length - 1];
  if (moves.every((m) => Math.abs(m.delta) < PLATEAU_ANGSTROM)) {
    const first = moves[0];
    return {
      word: "plateaued",
      detail:
        `the last ${moves.length} moves were all under ${PLATEAU_ANGSTROM} Å ` +
        `(${roundLabel(first.from.iteration)} → ${roundLabel(last.to.iteration)} gained ` +
        `${moves.reduce((s, m) => s + m.delta, 0).toFixed(1)} Å) — more iterations will not sharpen it`,
    };
  }
  if (last.delta >= 0) {
    return {
      word: "still improving",
      detail:
        `the estimate is still sharpening — ${roundLabel(last.from.iteration)} → ` +
        `${roundLabel(last.to.iteration)} gained ${last.delta.toFixed(1)} Å`,
    };
  }
  return {
    word: "still moving",
    detail:
      `the estimate is still moving — ${roundLabel(last.from.iteration)} → ` +
      `${roundLabel(last.to.iteration)} worsened by ${Math.abs(last.delta).toFixed(1)} Å ` +
      `(mid-run sampling schedules breathe the estimate; the run is not settled)`,
  };
}

/** The one-round highlight: the biggest sharpening step in the arc. */
export function biggestJump(
  arc: readonly ResolutionPoint[],
): { from: ResolutionPoint; to: ResolutionPoint; delta: number } | null {
  let best: { from: ResolutionPoint; to: ResolutionPoint; delta: number } | null = null;
  for (let i = 1; i < arc.length; i++) {
    const from = arc[i - 1];
    const to = arc[i];
    const delta = from.resolution - to.resolution;
    if (!best || delta > best.delta) best = { from, to, delta };
  }
  return best;
}

/** "28.0 Å → 4.2 Å over 16 rounds" — the arc's own headline. */
export function arcSummary(arc: readonly ResolutionPoint[]): string | null {
  if (arc.length === 0) return null;
  const first = arc[0];
  const last = arc[arc.length - 1];
  const best = arc.reduce((b, p) => (p.resolution < b.resolution ? p : b), arc[0]);
  return (
    `${first.resolution.toFixed(1)} Å → ${last.resolution.toFixed(1)} Å over ` +
    `${arc.length} round${arc.length === 1 ? "" : "s"} — best ${best.resolution.toFixed(1)} Å at ${roundLabel(best.iteration)}`
  );
}

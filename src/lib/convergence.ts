/**
 * CryoFlow — the convergence domain module (t454).
 *
 * t439 built the CTF A/B verdict (two runs), t440 generalized the brain,
 * t452 gave the verdict its first consumer verb, t453 opened the class
 * domain (two runs, occupancy share, gained/lost/held). This module is
 * the FOURTH question — and the first one that does NOT compare two
 * runs. It compares ONE run with ITSELF at two iterations: "did my
 * classification converge, or are classes still re-shuffling particles?"
 * The classes route has answered per-round occupancy since ?iter= existed;
 * the iterations route lists the rounds; this module owns the dialect and
 * the census that turns two rounds into a convergence reading.
 *
 * The laws (domain-local):
 *   - ROUNDS SPEAK RELION'S PAD: "Round 025" — the same zero-padded
 *     dialect the class rows speak ("Class 007"); a round label and a
 *     class label are both ids, never prose.
 *   - THE DEFAULT PAIR IS THE RUN'S WHOLE ARC: earliest round vs latest
 *     round — the question "did it converge" is asked over the whole
 *     journey first; the pickers let the user ask it of any two rounds.
 *   - THE CENSUS COUNTS MOTION, NOT QUALITY: a class whose share moved
 *     more than the threshold between rounds is "still moving" —
 *     direction is irrelevant to convergence (a class that LOST half its
 *     particles is exactly as un-settled as one that gained). The census
 *     names the biggest mover so the reading is actionable.
 *   - THE VERDICT READS, IT NEVER WIRES: convergence has no consumer
 *     verb — "select the settled classes" would conflate settled with
 *     good, and "continue with more iterations" is not this app's verb
 *     yet. The face says so, in its own footer, instead of staying
 *     silent about the missing rider.
 */

import type { Delta } from "@/lib/paired-compare";

/** "Round 25" → "Round 025" — RELION's zero-padded iteration dialect
 *  (the same pad the class rows use; three digits fit RELION's own
 *  itNNN file names, which is where these numbers come from). */
export function roundLabel(round: number): string {
  return `Round ${String(round).padStart(3, "0")}`;
}

/** The default A/B pair: the run's WHOLE ARC. Sorted + deduped first —
 *  the route's round list is already ascending, but a list that isn't
 *  must never produce an "earlier" default that isn't. Null below two
 *  distinct rounds (the door hides, the face never hand-waves). */
export function defaultRoundPair(
  iterations: number[],
): { a: number; b: number } | null {
  const rounds = [...new Set(iterations)].sort((x, y) => x - y);
  if (rounds.length < 2) return null;
  return { a: rounds[0], b: rounds[rounds.length - 1] };
}

/* ------------------------------------------------------------------ */
/* The moving census — the convergence reading's own health check.     */
/* ------------------------------------------------------------------ */

/** Default motion threshold in percentage points of the population. */
export const MOVING_PP = 1;

export interface MovingCensusOpts {
  /** The two rounds being compared (for the sentence's own context). */
  aRound: number;
  bRound: number;
  /** Motion threshold in pp (defaults to MOVING_PP). */
  threshold?: number;
}

/** "Convergence census: 3 of 50 classes moved more than 1.0 pp between
 *  Round 000 and Round 025 (biggest: Class 012, +2.4 pp) — the
 *  assignment is mostly settled." The three endings, by settled share:
 *    - 0 movers            → "the assignment has settled"
 *    - ≥90% held           → "the assignment is mostly settled"
 *    - else                → "the assignment is still re-shuffling"
 *  Null on an empty electorate (the trust line hides, it never
 *  hand-waves). Direction is irrelevant to convergence: |Δ| is the
 *  motion, and the biggest mover speaks with its sign so the reading
 *  says WHO moved and WHERE they went. */
export function movingCensus(
  deltas: Delta[],
  opts: MovingCensusOpts,
): string | null {
  if (deltas.length === 0) return null;
  const threshold = opts.threshold ?? MOVING_PP;
  const movers = deltas.filter((d) => Math.abs(d.delta) > threshold);
  const n = deltas.length;
  const settledShare = (n - movers.length) / n;
  const ending =
    movers.length === 0
      ? "the assignment has settled"
      : settledShare >= 0.9
        ? "the assignment is mostly settled"
        : "the assignment is still re-shuffling";
  const biggest = [...deltas].sort(
    (x, y) => Math.abs(y.delta) - Math.abs(x.delta),
  )[0];
  const biggestNote =
    movers.length > 0 && biggest
      ? ` (biggest: ${biggest.name}, ${biggest.delta > 0 ? "+" : ""}${biggest.delta.toFixed(1)} pp)`
      : "";
  return (
    `Convergence census: ${movers.length} of ${n} classes moved more than ` +
    `${threshold.toFixed(1)} pp between ${roundLabel(opts.aRound)} and ` +
    `${roundLabel(opts.bRound)}${biggestNote} — ${ending}.`
  );
}

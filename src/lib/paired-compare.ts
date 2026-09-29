/**
 * CryoFlow — the paired-compare core (t440).
 *
 * t439 built the CTF A/B verdict: pair two runs' per-micrograph rows by
 * name, speak a direction-aware verdict. t440 generalizes the brain —
 * MotionCorr asks the same question with different numbers ("did my new
 * parameters reduce motion?"), and a second hand-rolled copy of the
 * join/verdict machinery would have been a lie of architecture. This
 * module is the DOMAIN-FREE core: it knows about names, numbers,
 * directions and verdicts — never about micrograph physics.
 *
 * The laws (inherited verbatim from t439, now stated once):
 *   - PAIRED OR SILENT: a row present in only one run cannot vote —
 *     unpaired rows are reported (onlyA / onlyB), never folded in.
 *   - DIRECTION IS THE LENS'S OWN: a lens carries higherIsBetter; the
 *     verdict never assumes "bigger = better".
 *   - TIES ARE TIES: identical values speak "unchanged" — a tie is a
 *     finding, not a failure.
 *   - THE READING LAYER SPEAKS SIGNS: fmtDelta's sign IS the news.
 *
 * Domain modules (ctf-compare.ts, motion-compare.ts) own their row
 * shapes and lens specs; dialogs are only faces.
 */

/** One comparison lens over a run's rows. `value` picks the number;
 *  everything else is how the verdict and the face speak it. */
export interface LensSpec<R> {
  key: string;
  label: string;
  /** Unit suffix spoken after values ("", " Å", " µm", " px"). */
  unit: string;
  higherIsBetter: boolean;
  /** Decimal digits for this lens's values. */
  digits: number;
  value(row: R): number;
}

/** The paired join: two runs meet on the row's name. Whatever the join
 *  keeps is the whole electorate — unpaired rows are counted and NAMED
 *  in the summary, never folded into the verdict. */
export interface Pair<A, B> {
  name: string;
  a: A;
  b: B;
}

export interface Join<A, B> {
  pairs: Pair<A, B>[];
  onlyA: string[];
  onlyB: string[];
}

export function joinByName<A extends { name: string }, B extends { name: string }>(
  runA: A[],
  runB: B[],
): Join<A, B> {
  const byNameB = new Map(runB.map((r) => [r.name, r]));
  const pairs: Pair<A, B>[] = [];
  const onlyA: string[] = [];
  const seenB = new Set<string>();
  for (const a of runA) {
    const b = byNameB.get(a.name);
    if (b) {
      pairs.push({ name: a.name, a, b });
      seenB.add(a.name);
    } else {
      onlyA.push(a.name);
    }
  }
  const onlyB = runB.filter((r) => !seenB.has(r.name)).map((r) => r.name);
  return { pairs, onlyA, onlyB };
}

/** One row's delta under one lens: b − a, interpreted by the lens's own
 *  direction. */
export interface Delta {
  name: string;
  a: number;
  b: number;
  delta: number;
  kind: "improved" | "regressed" | "tied";
}

export function pairedDeltas<R>(pairs: Pair<R, R>[], lens: LensSpec<R>): Delta[] {
  return pairs.map(({ name, a, b }) => {
    const va = lens.value(a);
    const vb = lens.value(b);
    const delta = vb - va;
    const improving = lens.higherIsBetter ? delta > 0 : delta < 0;
    const regressing = lens.higherIsBetter ? delta < 0 : delta > 0;
    return {
      name,
      a: va,
      b: vb,
      delta,
      kind: improving ? "improved" : regressing ? "regressed" : "tied",
    };
  });
}

/** numpy median: even counts average the middle pair. */
export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface Verdict {
  improved: number;
  regressed: number;
  tied: number;
  medianDelta: number;
}

export function verdict(deltas: Delta[]): Verdict {
  const improved = deltas.filter((d) => d.kind === "improved").length;
  const regressed = deltas.filter((d) => d.kind === "regressed").length;
  const tied = deltas.filter((d) => d.kind === "tied").length;
  return {
    improved,
    regressed,
    tied,
    medianDelta: deltas.length ? median(deltas.map((d) => d.delta)) : NaN,
  };
}

/** The named witnesses: the k biggest movers on each side, magnitude-
 *  first (a verdict is counts; a verdict you can ACT on is names). */
export interface Movers {
  improvers: Delta[];
  regressors: Delta[];
}

const MOVERS_CAP = 5;

export function topMovers(deltas: Delta[]): Movers {
  const byMagnitude = (x: Delta, y: Delta) =>
    Math.abs(y.delta) - Math.abs(x.delta);
  const improvers = deltas
    .filter((d) => d.kind === "improved")
    .sort(byMagnitude)
    .slice(0, MOVERS_CAP);
  const regressors = deltas
    .filter((d) => d.kind === "regressed")
    .sort(byMagnitude)
    .slice(0, MOVERS_CAP);
  return { improvers, regressors };
}

/** The verdict's vocabulary (t453): the micrograph domains' words are
 *  the DEFAULT — occupancy (class-compare.ts) overrides them, because a
 *  class that gained particles did not "improve"; the population moved.
 *  Five fields: chip/series verbs + mover-list nouns. */
export interface VerdictWords {
  better: string;
  worse: string;
  same: string;
  betterNoun: string;
  worseNoun: string;
}

export const DEFAULT_WORDS: VerdictWords = {
  better: "improved",
  worse: "regressed",
  same: "unchanged",
  betterNoun: "improvements",
  worseNoun: "regressions",
};

/** "+0.031" / "−1.24" — the sign IS the news. */
export function fmtDelta(value: number, digits: number): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(digits)}`;
}

/* ------------------------------------------------------------------ */
/* The verdict's text face (t469).                                     */
/* ------------------------------------------------------------------ */

/** The verdict counts the dialog's chips speak, rendered as ONE
 *  agent-readable block — compare_jobs narrates from this, so the
 *  agent's words are the same counts the face draws (t468's "the agent
 *  reads the user's face" law, verdict edition). The vocabulary is the
 *  caller's (gained/lost for occupancy, improved/regressed default);
 *  the sign is fmtDelta's; unpaired rows speak as non-voters, never as
 *  votes (PAIRED OR SILENT, surfaced). */
export function pairVerdictText(args: {
  domainLabel: string;
  nameA: string;
  nameB: string;
  lensLabel: string;
  unit: string;
  digits: number;
  higherIsBetter: boolean;
  words: VerdictWords;
  verdict: Verdict;
  movers: Movers;
  onlyA: string[];
  onlyB: string[];
  /** How many named movers to speak per side (default 3). */
  moverCap?: number;
}): string {
  const cap = args.moverCap ?? 3;
  const v = args.verdict;
  const paired = v.improved + v.regressed + v.tied;
  const direction = args.higherIsBetter ? "higher is better" : "lower is better";
  const lines: string[] = [];
  lines.push(
    `${args.domainLabel} A/B — "${args.nameA}" vs "${args.nameB}", lens ${args.lensLabel} (${direction}).`,
  );
  lines.push(
    `${paired} paired row${paired === 1 ? "" : "s"}: ${v.improved} ${args.words.better}, ${v.regressed} ${args.words.worse}, ${v.tied} ${args.words.same}. Median delta ${fmtDelta(v.medianDelta, args.digits)}${args.unit}.`,
  );
  const named = (deltas: Delta[]): string => {
    if (deltas.length === 0) return "none.";
    const spoken = deltas
      .slice(0, cap)
      .map((d) => `${d.name} (${fmtDelta(d.delta, args.digits)}${args.unit})`)
      .join(", ");
    return deltas.length > cap
      ? `${spoken} — and ${deltas.length - cap} more.`
      : `${spoken}.`;
  };
  lines.push(`Biggest ${args.words.betterNoun}: ${named(args.movers.improvers)}`);
  lines.push(`Biggest ${args.words.worseNoun}: ${named(args.movers.regressors)}`);
  if (args.onlyA.length > 0 || args.onlyB.length > 0) {
    lines.push(
      `Unpaired (cannot vote): ${args.onlyA.length} only in A · ${args.onlyB.length} only in B.`,
    );
  }
  return lines.join("\n");
}

/** Scatter domains: both axes share one symmetric range so the identity
 *  line is a true 45° visual — an off-domain stretch would tilt the
 *  eye's reference. A perfect tie pads so the cloud still draws. */
export function scatterDomain(deltas: Delta[]): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const d of deltas) {
    min = Math.min(min, d.a, d.b);
    max = Math.max(max, d.a, d.b);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 0.1;
    return [min - pad, max + pad];
  }
  const pad = (max - min) * 0.05;
  return [min - pad, max + pad];
}

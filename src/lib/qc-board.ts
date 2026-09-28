/**
 * CryoFlow — micrograph QC board arithmetic (client-safe, pure).
 *
 * The QC board is the at-a-glance surface the charts cannot be: one tile
 * per micrograph, colored by how the micrograph compares to ITS OWN PACK.
 * Nothing here speaks absolute quality thresholds — a 4 Å worst-fit is
 * fine for a 15 Å map and hopeless for a 2 Å map — so the buckets are
 * computed from the distribution itself (the same law the drift chart's
 * mean+σ offender tone already established, generalized to quantiles):
 *
 *   offender = the worst decile of the pack (≥ p90 on a higher-is-worse
 *              metric) — the tiles a user would exclude first;
 *   watch    = the next quarter (≥ p75) — worth a look, not an exclusion;
 *   healthy  = everything else.
 *
 * Every metric is normalized to "higher is worse" internally (FOM is
 * negated) so ONE quantile law serves all metrics. Thresholds are
 * returned alongside the buckets — the legend renders the ACTUAL numbers
 * instead of a vague gradient, and the app's honesty laws hold: nothing
 * is fabricated, an empty pack yields an empty board.
 */

export type QcBucket = "healthy" | "watch" | "offender";

export type CtfMetric = "resolution" | "astigmatism" | "fom";
export type MotionMetric = "total";

export interface QcThresholds {
  /** values ≥ watchAt (on the higher-is-worse scale) land in "watch". */
  watchAt: number;
  /** values ≥ offenderAt land in "offender". */
  offenderAt: number;
}

export interface QcRow<M> {
  micrograph: M;
  /** the metric value on the HIGHER-IS-WORSE scale (fom arrives negated). */
  worse: number;
  /** the value as the user's metric reads (fom back to 0–1). */
  value: number;
  bucket: QcBucket;
}

/** p-quantile by linear interpolation (numpy "linear" method) on a sorted
 *  copy — the same interpolation the histograms the app already draws use.
 *  An empty array answers NaN; callers self-hide before that. */
export function quantile(values: number[], p: number): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return s[lo];
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

function bucketOf(worse: number, t: QcThresholds): QcBucket {
  if (worse >= t.offenderAt) return "offender";
  if (worse >= t.watchAt) return "watch";
  return "healthy";
}

function boardFrom<M>(
  micrographs: M[],
  worseOf: (m: M) => number,
  valueOf: (m: M) => number,
  tiebreakName: (m: M) => string
): { rows: QcRow<M>[]; thresholds: QcThresholds } {
  const worsing = micrographs.map(worseOf);
  const thresholds: QcThresholds = {
    watchAt: quantile(worsing, 0.75),
    offenderAt: quantile(worsing, 0.9),
  };
  // the flat-pack pass: when EVERY micrograph carries the same value, the
  // quantiles collapse onto that value and the naive arithmetic would
  // paint the whole pack rose — the one reading the legend cannot defend.
  // Nothing "stands out" in a flat pack, so nothing is flagged: all
  // healthy (the thresholds still speak in the legend, honestly).
  const flat = worsing.every((v) => v === worsing[0]);
  const rows = micrographs
    .map((m) => {
      const worse = worseOf(m);
      return {
        micrograph: m,
        worse,
        value: valueOf(m),
        bucket: flat ? ("healthy" as QcBucket) : bucketOf(worse, thresholds),
      };
    })
    .sort((a, b) => b.worse - a.worse || tiebreakName(a.micrograph).localeCompare(tiebreakName(b.micrograph)));
  return { rows, thresholds };
}

/** CTF board rows for one metric. FOM is better-when-higher, so it rides
 *  the scale negated for bucketing/sorting while `value` still reads the
 *  user's 0–1. The FULL CtfMicrograph rides each row (tiles show the
 *  defocus pair as context, not just the sorted metric). */
export function ctfBoard(
  micrographs: {
    name: string;
    defocusU: number;
    defocusV: number;
    astigmatism: number;
    fom: number;
    maxResolution: number;
  }[],
  metric: CtfMetric
): {
  rows: QcRow<{
    name: string;
    defocusU: number;
    defocusV: number;
    astigmatism: number;
    fom: number;
    maxResolution: number;
  }>[];
  thresholds: QcThresholds;
} {
  const worseOf =
    metric === "resolution"
      ? (m: { maxResolution: number }) => m.maxResolution
      : metric === "astigmatism"
        ? (m: { astigmatism: number }) => m.astigmatism
        : (m: { fom: number }) => -m.fom; // higher FOM is better
  const valueOf =
    metric === "fom"
      ? (m: { fom: number }) => m.fom
      : (m: { astigmatism: number; maxResolution: number }) =>
          metric === "astigmatism" ? m.astigmatism : m.maxResolution;
  return boardFrom(micrographs, worseOf, valueOf, (m) => m.name);
}

/** Motion board rows — total accumulated drift (higher is worse), the
 *  same quantity the drift chart's bars speak. */
export function motionBoard(
  micrographs: { name: string; total: number; early: number; late: number }[]
): { rows: QcRow<{ name: string; total: number; early: number; late: number }>[]; thresholds: QcThresholds } {
  return boardFrom(
    micrographs,
    (m) => m.total,
    (m) => m.total,
    (m) => m.name
  );
}

/** Metric presentation — value text + unit for the tile's corner chip.
 *  Resolution speaks Å with one decimal, astigmatism µm with two (the
 *  summary line's own precision), FOM three decimals (a 0–1 FOM at one
 *  decimal is a wall of 0.0s). */
export function fmtQcValue(metric: CtfMetric | MotionMetric, value: number): string {
  if (metric === "resolution") return `${value.toFixed(1)} Å`;
  if (metric === "astigmatism") return `${value.toFixed(2)} µm`;
  if (metric === "fom") return value.toFixed(3);
  return `${value.toFixed(1)} Å`; // motion total drift
}

export const QC_METRIC_LABEL: Record<CtfMetric | MotionMetric, string> = {
  resolution: "Worst fit",
  astigmatism: "Astigmatism",
  fom: "FOM",
  total: "Total drift",
};

/** The quantile law, in words for the legend — the pack's OWN lines with
 *  their provenance named. With tie-heavy (quantized) data the two lines
 *  can coincide and the offender count can exceed a tenth of the pack —
 *  the phrasing never promises a count, it names the lines (p90/p75) and
 *  their numbers; the header speaks the actual counts. */
export function qcLegendText(thresholds: QcThresholds, metric: CtfMetric | MotionMetric): string {
  return `offenders ≥ ${fmtQcValue(metric, thresholds.offenderAt)} (p90) · watch ≥ ${fmtQcValue(metric, thresholds.watchAt)} (p75) — lines are this run's own distribution`;
}

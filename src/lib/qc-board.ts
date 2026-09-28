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

/** The picking board's two lenses. "count" reads pick density (higher is
 *  worse — over-picking is the junk-contamination failure mode; the empty
 *  extreme is handled by its own absolute law below). "pickFom" reads the
 *  per-micrograph MEDIAN autopick FOM (lower is worse — a pack of timid
 *  picks means the threshold or the reference is off), so it rides the
 *  scale negated like the CTF's FOM lens. */
export type PickMetric = "count" | "pickFom";

/** One micrograph's picking summary — the shape the picks route answers
 *  and the tile's second row always shows. `fom` is the median of the
 *  per-pick FOMs (null when the mic carries no picks or no FOM column). */
export interface PickQcEntry {
  name: string;
  count: number;
  fom: number | null;
}

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

/** Picking board rows. THREE laws beyond the shared quantile arithmetic:
 *
 *  1. THE EMPTY LAW — a micrograph with 0 picks is an absolute offender
 *     in BOTH lenses, regardless of quantiles. This is the domain-honest
 *     exception to "no absolute thresholds": among a pack of 17–25 picks
 *     an empty micrograph sits at p0 and the naive arithmetic would call
 *     it healthy, while it is in fact the FIRST tile a cryo-EM user looks
 *     at (a real micrograph always has particles to find — 0 picks means
 *     the picker failed it, not that it is clean). Empties sort first
 *     (worse = +Infinity) and their value renders as the honest 0.
 *     Quantiles are computed over the non-empty pack only — empties do
 *     not drag the lines (they are not evidence about pick density).
 *
 *  2. THE UNRANKABLE LAW (FOM lens) — a non-empty mic whose coord star
 *     carried no FOM column has no evidence to rank; it lands healthy
 *     with value NaN (the tile speaks "—"), sorts last (worse =
 *     -Infinity), and never blocks the FOM lens for the pack.
 *
 *  3. THE FLAT-PACK LAW, scoped — when every RANKABLE micrograph carries
 *     the same value nothing stands out and the rankable rows all stay
 *     healthy; empties are STILL offenders (their law is absolute, not
 *     relative), and an all-empty pack paints every tile offender with
 *     NaN thresholds (the legend speaks "—").
 *
 *  The FOM median excludes null per-pick FOMs; a mic whose picks are ALL
 *  null-FOM is unrankable, not zero-FOM. */
export function pickingBoard(
  entries: PickQcEntry[],
  metric: PickMetric
): { rows: QcRow<PickQcEntry>[]; thresholds: QcThresholds } {
  const rankable = entries.filter((m) =>
    metric === "count" ? m.count > 0 : m.fom != null
  );
  const worseOf = (m: PickQcEntry): number =>
    metric === "count" ? m.count : -(m.fom as number); // lower FOM is worse
  const valueOf = (m: PickQcEntry): number =>
    metric === "count" ? m.count : (m.fom as number);
  const worsing = rankable.map(worseOf);
  const thresholds: QcThresholds = {
    watchAt: quantile(worsing, 0.75),
    offenderAt: quantile(worsing, 0.9),
  };
  const flat =
    worsing.length > 0 && worsing.every((v) => v === worsing[0]);
  const rows = entries
    .map((m) => {
      const isEmpty = m.count === 0;
      const rankableMic = metric === "count" ? m.count > 0 : m.fom != null;
      if (isEmpty) {
        // the empty law: absolute offender, sorted to the top; the VALUE
        // still reads the user's truth (0 picks / no FOM evidence)
        return {
          micrograph: m,
          worse: Infinity,
          value: valueOf(m),
          bucket: "offender" as QcBucket,
        };
      }
      if (!rankableMic) {
        // the unrankable law: healthy, honest "—", last
        return {
          micrograph: m,
          worse: -Infinity,
          value: NaN,
          bucket: "healthy" as QcBucket,
        };
      }
      const worse = worseOf(m);
      return {
        micrograph: m,
        worse,
        value: valueOf(m),
        bucket: flat ? ("healthy" as QcBucket) : bucketOf(worse, thresholds),
      };
    })
    .sort(
      (a, b) =>
        b.worse - a.worse ||
        a.micrograph.name.localeCompare(b.micrograph.name)
    );
  return { rows, thresholds };
}

/** Median of one micrograph's per-pick FOMs — null FOMs are excluded (a
 *  missing column is not a zero confidence), an empty result is null (the
 *  unrankable law). Even counts average the middle pair (numpy median). */
export function medianPickFom(foms: (number | null)[]): number | null {
  const v = foms.filter((f): f is number => f != null).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 === 1 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

/** Metric presentation — value text + unit for the tile's corner chip.
 *  Resolution speaks Å with one decimal, astigmatism µm with two (the
 *  summary line's own precision), FOM three decimals (a 0–1 FOM at one
 *  decimal is a wall of 0.0s), pick counts are integers. NaN (the
 *  unrankable law) renders as "—" for every metric — a value the pack
 *  cannot rank must not masquerade as 0.0. */
export function fmtQcValue(metric: CtfMetric | MotionMetric | PickMetric, value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (metric === "resolution") return `${value.toFixed(1)} Å`;
  if (metric === "astigmatism") return `${value.toFixed(2)} µm`;
  if (metric === "fom" || metric === "pickFom") return value.toFixed(3);
  if (metric === "count") return String(Math.round(value));
  return `${value.toFixed(1)} Å`; // motion total drift
}

export const QC_METRIC_LABEL: Record<CtfMetric | MotionMetric | PickMetric, string> = {
  resolution: "Worst fit",
  astigmatism: "Astigmatism",
  fom: "FOM",
  total: "Total drift",
  count: "Picks",
  pickFom: "FOM",
};

/** The quantile law, in words for the legend — the pack's OWN lines with
 *  their provenance named. With tie-heavy (quantized) data the two lines
 *  can coincide and the offender count can exceed a tenth of the pack —
 *  the phrasing never promises a count, it names the lines (p90/p75) and
 *  their numbers; the header speaks the actual counts.
 *
 *  t433 — DIRECTION-AWARE PRESENTATION. The thresholds live on the
 *  higher-is-worse scale, but the legend must speak the USER's metric:
 *  for the negated lenses (fom/pickFom — lower is worse) presenting the
 *  stored number verbatim printed a negative "FOM" and a ≥ that reads
 *  "everyone is an offender" (the t432 bench pinned only the resolution
 *  lens, so this slipped through). Linear-interpolation quantiles are
 *  exact under negation — Q(−X, p) = −Q(X, 1−p) — so the user-side
 *  offender line IS the pack's p10 and the watch line its p25, with ≤ as
 *  the direction. The higher-is-worse lenses keep ≥ p90 / ≥ p75. */
export function qcLegendText(thresholds: QcThresholds, metric: CtfMetric | MotionMetric | PickMetric): string {
  if (metric === "fom" || metric === "pickFom") {
    return `offenders ≤ ${fmtQcValue(metric, -thresholds.offenderAt)} (p10) · watch ≤ ${fmtQcValue(metric, -thresholds.watchAt)} (p25) — lines are this run's own distribution`;
  }
  return `offenders ≥ ${fmtQcValue(metric, thresholds.offenderAt)} (p90) · watch ≥ ${fmtQcValue(metric, thresholds.watchAt)} (p75) — lines are this run's own distribution`;
}

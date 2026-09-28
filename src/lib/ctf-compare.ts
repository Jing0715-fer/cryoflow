/**
 * CryoFlow — the CTF A/B verdict (t439).
 *
 * One cryo-EM question the app could not answer until now: "I changed a
 * preprocessing parameter (or re-picked, or re-aligned) — did the CTF
 * fits actually get BETTER?" The FSC face has its overlay (fsc-compare,
 * t62); the preprocessing face — where iteration happens most — had only
 * a params diff, which answers "what did I change", never "what did it
 * do". This module is the comparison's BRAIN: pair two runs' per-
 * micrograph fits by micrograph name and speak a verdict per metric
 * lens, direction-aware.
 *
 * The honesty laws this module keeps:
 *   - PAIRED OR SILENT: a micrograph present in only one run cannot
 *     vote — it is reported as unpaired (only-in-A / only-in-B), never
 *     silently dropped and never counted as improved or regressed.
 *   - DIRECTION IS THE LENS'S OWN: FOM higher is better; max-resolution
 *     (Å) LOWER is better (fitting further); astigmatism lower is
 *     better. The verdict never says "bigger = better".
 *   - DEFONOCUS IS NOT A VERDICT: defocus is the micrograph's physics,
 *     not the fit's quality — it appears only as an agreement line (how
 *     closely the two runs measured the same micrograph), never in the
 *     improved/regressed counts.
 *   - TIES ARE TIES: byte-identical inputs (the demo twin) produce zero
 *     deltas and speak "no change" — a tie is a finding, not a failure.
 *
 * Pure, React-free, bench-able — the dialog is only the face.
 */

/** The subset of the ctf route's per-micrograph row the compare reads.
 *  Structurally a superset-compatible slice of CtfMicrograph — the
 *  dialog feeds route rows straight in. */
export interface CtfRunRow {
  name: string;
  defocusU: number;
  defocusV: number;
  astigmatism: number;
  fom: number;
  maxResolution: number;
}

export type CtfLens = "fom" | "maxres" | "astig";

export interface CtfLensSpec {
  key: CtfLens;
  label: string;
  /** Unit suffix spoken after values ("", " Å", " µm"). */
  unit: string;
  higherIsBetter: boolean;
  /** Decimal digits for this lens's values. */
  digits: number;
  value(row: CtfRunRow): number;
}

export const CTF_LENSES: Record<CtfLens, CtfLensSpec> = {
  fom: {
    key: "fom",
    label: "FOM",
    unit: "",
    higherIsBetter: true,
    digits: 3,
    value: (r) => r.fom,
  },
  maxres: {
    key: "maxres",
    label: "Fit limit",
    unit: " Å",
    // Å shrink as fits reach further — the lower, the better
    higherIsBetter: false,
    digits: 2,
    value: (r) => r.maxResolution,
  },
  astig: {
    key: "astig",
    label: "Astigmatism",
    unit: " µm",
    higherIsBetter: false,
    digits: 3,
    value: (r) => r.astigmatism,
  },
};

/** The paired join: two runs meet on the micrograph name. Whatever the
 *  join keeps is the whole electorate — unpaired rows are counted and
 *  NAMED in the summary, never folded into the verdict. */
export interface CtfPair {
  name: string;
  a: CtfRunRow;
  b: CtfRunRow;
}

export interface CtfJoin {
  pairs: CtfPair[];
  onlyA: string[];
  onlyB: string[];
}

export function joinCtfRuns(runA: CtfRunRow[], runB: CtfRunRow[]): CtfJoin {
  const byNameB = new Map(runB.map((r) => [r.name, r]));
  const pairs: CtfPair[] = [];
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

/** One micrograph's delta under one lens: b − a, interpreted by the
 *  lens's own direction. */
export interface CtfDelta {
  name: string;
  a: number;
  b: number;
  delta: number;
  kind: "improved" | "regressed" | "tied";
}

export function pairedDeltas(pairs: CtfPair[], lens: CtfLensSpec): CtfDelta[] {
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

/** numpy median: even counts average the middle pair (the qc-board's
 *  medianPickFom law, same arithmetic, different ore). */
export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface CtfVerdict {
  improved: number;
  regressed: number;
  tied: number;
  medianDelta: number;
}

export function verdict(deltas: CtfDelta[]): CtfVerdict {
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
export interface CtfMovers {
  improvers: CtfDelta[];
  regressors: CtfDelta[];
}

const MOVERS_CAP = 5;

export function topMovers(deltas: CtfDelta[]): CtfMovers {
  const byMagnitude = (x: CtfDelta, y: CtfDelta) =>
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

/** The agreement line: median |Δ defocus| across pairs (µm). Two runs
 *  estimating the same micrograph should MEASURE the same box — a big
 *  disagreement indicts the pairing (or the physics), not the params. */
export function defocusAgreement(pairs: CtfPair[]): number {
  if (pairs.length === 0) return NaN;
  const deltas = pairs.map(({ a, b }) =>
    Math.abs((a.defocusU + a.defocusV) / 2 - (b.defocusU + b.defocusV) / 2),
  );
  return median(deltas);
}

/** "+0.031" / "−1.24" — the sign IS the news. */
export function fmtDelta(value: number, digits: number): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(digits)}`;
}

/** Scatter domains: both axes share one symmetric range so the identity
 *  line is a true 45° visual — an off-domain stretch would tilt the
 *  eye's reference. A floor of a small positive keeps log-less zero
 *  spreads readable. */
export function scatterDomain(deltas: CtfDelta[]): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const { a, b } of deltas.map((d) => ({ a: d.a, b: d.b }))) {
    min = Math.min(min, a, b);
    max = Math.max(max, a, b);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) {
    // a perfect tie on every pair (the demo twin): pad so the cloud and
    // the identity line still draw
    const pad = Math.abs(min) * 0.1 || 0.1;
    return [min - pad, max + pad];
  }
  const pad = (max - min) * 0.05;
  return [min - pad, max + pad];
}

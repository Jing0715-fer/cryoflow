/**
 * CryoFlow — the report families' shared home (t197).
 *
 * Two human-facing report builders lived inside their instrument panels:
 * buildSweepReport (t194, hpc-queue-sim) and buildProfileReport (t195,
 * molstar-embed). The session QC report is their SECOND consumer — and a
 * lib is the only home that keeps it honest on both fronts:
 *   • doctrine — knowledge with two consumers must live in ONE place
 *     (the mdCell promotion precedent: twins fork, imports don't);
 *   • bundle hygiene — importing either panel into the report page would
 *     drag Mol* / the whole HPC panel into a document dialog's chunk.
 * The math moves VERBATIM — this is a change of address, not a rewrite.
 *
 * buildSessionReport (t197) is the binding father: it composes the
 * families' outputs VERBATIM and never parses them (parse-of-parse is a
 * second derivation waiting to drift). It adds only the pipeline glance
 * and honest empty states. Like every builder in this family it carries
 * NO timestamp — the same session state always yields the same bytes;
 * the filename carries the export stamp.
 */

import { mdCell } from "@/lib/md";

/* ------------------------------------------------------------------ */
/* Sweep family — moved verbatim from hpc-queue-sim.tsx (t194).        */
/* ------------------------------------------------------------------ */

/** The brief a sweep row needs — every field comes from the profile. */
export interface SweepProfile {
  id: string; name: string; gpuModel: string;
  gpusPerNode: number; nodes: number; arrayConcurrency: number; gpuSpeedup: number;
}
export interface SweepRow {
  p: SweepProfile;
  r?: { makespanMin: number; gpuUtilization: number; avgWaitMin: number; totalGpuHours: number };
  err?: string;
}

export const fmtMin = (m: number): string => {
  if (!Number.isFinite(m) || m < 0) return "—";
  if (m >= 60) return `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, "0")}m`;
  return m >= 10 ? `${Math.round(m)}m` : `${(Math.round(m * 10) / 10).toFixed(1)}m`;
};

/**
 * The sweep's exit into prose (t194): the Markdown HUMAN twin of the
 * machine CSV. Same father — the sweep rows — but a different grammar:
 * the CSV speaks raw minutes and snake_case for spreadsheets; the
 * report speaks verdict, table and failures for people. ONE builder
 * feeds clipboard + download + the data-md carrier, and it derives
 * from the rows, NEVER from the CSV string — parsing your own export
 * to write a summary is a second derivation waiting to drift.
 *
 * t197: the "Generated <stamp>" line is gone — the report is a function
 * of the race alone (the same rows always yield the same bytes; the
 * filename carries the stamp, the doctrine t195 declared for profiles).
 */
export const buildSweepReport = (rows: SweepRow[], bestId: string | null): string => {
  const ok = rows.filter((r) => r.r);
  const failed = rows.filter((r) => !r.r);
  const best = ok.find((r) => r.p.id === bestId) ?? null;
  const worst = ok.reduce<SweepRow | null>(
    (w, r) => (!w || r.r!.makespanMin > w.r!.makespanMin ? r : w),
    null,
  );
  const lines: string[] = [];
  lines.push("# HPC sweep — cluster profile comparison", "");
  // The verdict — one sentence a human can act on, margins included.
  if (best?.r && worst?.r && worst.r.makespanMin > best.r.makespanMin) {
    const margin = Math.max(0, Math.round((1 - best.r.makespanMin / worst.r.makespanMin) * 100));
    lines.push(
      `${ok.length} of ${rows.length} profiles simulated on the same workflow graph. ` +
      `**${best.p.name}** wins with a ${fmtMin(best.r.makespanMin)} makespan — ` +
      `${margin}% faster than the slowest contestant (${fmtMin(worst.r.makespanMin)}) — ` +
      `at a cost of ${(Math.round(best.r.totalGpuHours * 10) / 10).toFixed(1)} GPU-hours.`,
    );
  } else if (best?.r) {
    lines.push(
      `${ok.length} of ${rows.length} profiles simulated on the same workflow graph. ` +
      `**${best.p.name}** wins with a ${fmtMin(best.r.makespanMin)} makespan at a cost of ` +
      `${(Math.round(best.r.totalGpuHours * 10) / 10).toFixed(1)} GPU-hours.`,
    );
  } else {
    lines.push(`${rows.length} profiles entered the race; none finished — see the failures below.`);
  }
  lines.push("");
  // The race table — human units (1h 03m, %), winner's makespan bold.
  lines.push("| # | Profile | GPU | Shape | Speedup | Status | Makespan | Utilization | Avg wait | GPU-hours |");
  lines.push("|--:|---------|-----|-------|--------:|--------|---------:|------------:|---------:|----------:|");
  rows.forEach((row, i) => {
    lines.push(
      [
        String(i + 1),
        row.p.name,
        row.p.gpuModel,
        `${row.p.nodes}×${row.p.gpusPerNode}`,
        `×${row.p.gpuSpeedup}`,
        row.r ? "ok" : "error",
        row.r
          ? row.p.id === bestId
            ? `**${fmtMin(row.r.makespanMin)}**`
            : fmtMin(row.r.makespanMin)
          : "—",
        row.r ? `${Math.round(row.r.gpuUtilization * 100)}%` : "—",
        row.r ? fmtMin(row.r.avgWaitMin) : "—",
        row.r ? `${(Math.round(row.r.totalGpuHours * 10) / 10).toFixed(1)}` : "—",
      ]
        .map(mdCell)
        .map((c) => `| ${c} `)
        .join("") + "|",
    );
  });
  // Failed profiles stay visible — a report that drops a contestant lies.
  if (failed.length > 0) {
    lines.push("");
    lines.push("Failed profiles (kept visible, never silently dropped):", "");
    for (const f of failed) lines.push(`- ${f.p.name} — ${f.err ?? "unavailable"}`);
  }
  lines.push("");
  lines.push(
    "> GPU-hours ≈ cost proxy — the fastest cluster is not always the cheapest. " +
    "The machine twin of this report is the CSV export (raw minutes, snake_case).",
  );
  return lines.join("\n") + "\n";
};

export const sweepReportFilename = (): string =>
  `hpc-sweep-report-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.md`;

/* ------------------------------------------------------------------ */
/* Profile family — moved verbatim from molstar-embed.tsx (t195/t196). */
/* ------------------------------------------------------------------ */

/** one adopted comparison terrain the report can speak about */
export interface ReportOverlay { name: string; bins: number[] }

/** Resample `bins` onto `n` evenly spaced FRACTION stations (0..1) with
 *  linear interpolation — comparison terrains align on the shared fraction
 *  scale, never on bin index (a 64³ main map and a 32³ half-map are two
 *  different rulers over the same depth; t193's doctrine in numbers). */
export const resampleByFraction = (bins: number[], n: number): number[] => {
  if (bins.length === 0) return [];
  if (bins.length === 1) return Array.from({ length: n }, () => bins[0]);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / Math.max(1, n - 1)) * (bins.length - 1);
    const lo = Math.floor(t);
    const hi = Math.min(bins.length - 1, lo + 1);
    out.push(bins[lo] + (bins[hi] - bins[lo]) * (t - lo));
  }
  return out;
};

/** Pearson correlation — the shape-agreement number r. Affine-invariant,
 *  so self-scaling each terrain (the visual's own contract) changes
 *  nothing: the shape is the signal, not absolute ρ. A flat line has no
 *  shape — NaN, and the verdict says so instead of inventing a number. */
export const pearson = (a: number[], b: number[]): number => {
  const n = Math.min(a.length, b.length);
  if (n < 2) return NaN;
  let sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { sa += a[i]; sb += b[i]; }
  const ma = sa / n, mb = sb / n;
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma, db = b[i] - mb;
    cov += da * db; va += da * da; vb += db * db;
  }
  if (va === 0 || vb === 0) return NaN;
  return cov / Math.sqrt(va * vb);
};

export const agreementVerdict = (r: number): string =>
  Number.isNaN(r) ? "flat — no shape to compare"
  : r >= 0.85 ? "agrees"
  : r >= 0.5 ? "partial"
  : "diverges";

/** t215: the NUMBER under the string. pctAt used to own this arithmetic
 *  inline; the Δ winner column needs the position as a number, and a
 *  parse-back of the formatted string would fork the well. One formula,
 *  two surfaces: pctAt (the paper's words) and peakPctNumOf (the lens's
 *  numbers) both drink here. */
export const pctNumAt = (bins: number[], i: number): number =>
  (i / Math.max(1, bins.length - 1)) * 100;

export const pctAt = (bins: number[], i: number): string =>
  `${pctNumAt(bins, i).toFixed(1)}%`;

/** The argmax over the raw landscape (strict >, first max wins — the
 *  exact loop buildProfileReport has always run). Exported so every
 *  surface that quotes a peak drinks from the SAME well. */
export const peakIndexOf = (bins: number[]): number => {
  let peak = 0;
  for (let i = 1; i < bins.length; i++) if (bins[i] > bins[peak]) peak = i;
  return peak;
};

/** The peak's address, quoted as a fraction of depth — ONE formula for
 *  "where the mass concentrates" (the deep report's Peak bullet and the
 *  inventory's Peak column both call this; t214: one truth, two
 *  surfaces — the roster is comparable, not just traversable). */
export const peakPctOf = (bins: number[]): string => pctAt(bins, peakIndexOf(bins));

/** t215: the same peak, as a NUMBER rounded to the paper's own 1-decimal
 *  grid. Rounding happens HERE — before any subtraction — so a reader
 *  recomputing Δ from the printed cells gets the printed delta (a delta
 *  computed from unrounded positions could drift 0.1 off the paper's
 *  own arithmetic; the cells are the well, not the raw bins). */
export const peakPctNumOf = (bins: number[]): number =>
  Number(pctNumAt(bins, peakIndexOf(bins)).toFixed(1));

/** t215: the deviation lens. Each inventory row's peak read against the
 *  winner's own — the reference row speaks +0.0, a null (row or
 *  reference still measuring / refused) means the lens cannot speak
 *  yet and the cell says — (the pending doctrine, per column). The
 *  delta is derived from the ROUNDED cells, so the paper's arithmetic
 *  is the reader's arithmetic. One definition; the dialog's door aria
 *  and the amber outlier lens import it — twins fork, imports don't. */
export const deltaVsWinner = (rowPct: number | null, winnerPct: number | null): string | null => {
  if (rowPct == null || winnerPct == null) return null;
  const d = Number((rowPct - winnerPct).toFixed(1));
  return `${d < 0 ? "-" : "+"}${Math.abs(d).toFixed(1)}`;
};

/** t218: the roster speaks CSV — the inventory as a machine
 *  grid for spreadsheets and scripts. Same father as the paper: peak_pct
 *  sits on the SAME 1-decimal grid the paper prints, delta_winner is
 *  deltaVsWinner ITSELF (the CSV never re-derives the deviation — twins
 *  fork, imports don't), and t221's shape_r is the inventory's own
 *  Agreement r number (2-decimal, the paper's grammar; blank while
 *  unmeasured). A pending peak speaks an empty cell: "still
 *  measuring" in CSV grammar is blank, never a guess. Cells are quoted
 *  only when they must be (RFC 4180 — names may carry commas). */
export type InventoryCsvRow = {
  jobName: string;
  mainName: string;
  volumeCount: number;
  peak: string | null;
  peakPct: number | null;
  shapeR?: number | null;
  weakest?: { label: string; r: number; from: number } | null;
};
export const inventoryCsv = (rows: InventoryCsvRow[] | null): string | null => {
  if (!rows || rows.length === 0) return null;
  const winnerPct = rows[0]?.peakPct ?? null;
  const quote = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const line = (parts: string[]) => parts.map(quote).join(",");
  const body = rows.map((o) => {
    const peak = o.peakPct != null ? o.peakPct.toFixed(1) : "";
    const delta = deltaVsWinner(o.peakPct, winnerPct) ?? "";
    const rCell = o.shapeR != null ? o.shapeR.toFixed(2) : "";
    const wCell = o.weakest ? weakestCellOf(o.weakest) : "";
    return line([o.jobName, o.mainName, String(o.volumeCount), peak, delta, rCell, wCell]);
  });
  return [line(["job", "main_map", "volumes", "peak_pct", "delta_winner", "shape_r", "thinnest"]), ...body].join("\n");
};

/** The ONE scan both lenses read (t220: twins fork, imports don't —
 *  a second scan is a second father for the verdict, and the two lenses
 *  must never disagree about who led the field). Walks the rows once,
 *  tracking the strictly-largest |Δ| on the 1-decimal grid with the
 *  epsilon discipline (t215: comparisons, never a unary comparator),
 *  and collects EVERY row that shares it. The winner's own +0.0 can
 *  never lead (a > 1e-9 gate); unmeasured rows are invisible to the
 *  scan (— stays —). abs is the shared magnitude on the same grid. */
type CrownScan = { abs: number; indices: number[] };
const crownScan = (rows: { peakPct: number | null }[]): CrownScan => {
  const w = rows[0]?.peakPct ?? null;
  if (w == null) return { abs: 0, indices: [] };
  let bestAbs = 0;
  let indices: number[] = [];
  rows.forEach((r, i) => {
    if (r.peakPct == null) return;
    const a = Math.abs(Number((r.peakPct - w).toFixed(1)));
    if (a > bestAbs + 1e-9) {
      bestAbs = a;
      indices = [i];
    } else if (Math.abs(a - bestAbs) <= 1e-9 && a > 1e-9) {
      indices.push(i);
    }
  });
  return { abs: bestAbs, indices };
};

/** t215: WHO is the outlier? The row whose |Δ| is strictly the largest
 *  AND strictly greater than zero — a tie for the crown is no crown
 *  (a contested superlative is a guess, and the lens never guesses).
 *  Returns the row index, or -1 when the world is tied / unmeasured.
 *  t220: the scan is SHARED with contestedCrown — one walk of the rows
 *  feeds both lenses, so the amber edge and the paper's tie note can
 *  never be two opinions. */
export const outlierRowIdx = (rows: { peakPct: number | null }[]): number => {
  const { abs, indices } = crownScan(rows);
  return indices.length === 1 && abs > 1e-9 ? indices[0] : -1;
};

/** t220: silence has TWO meanings, and a lens that cannot tell them
 *  apart leaves the reader guessing. When every measured row agrees
 *  with the winner, zero amber is the truth and needs no footnote; but
 *  when two or more rows SHARE the strictly-largest |Δ| — the same map
 *  imported twice under two names, a duplicated job, two fathers of one
 *  shape — outlierRowIdx returns -1 and the reader sees an unexplained
 *  absence. contestedCrown speaks that case: it returns the shared
 *  magnitude and the indices of every row tied for the crown, so the
 *  paper can NAME the standoff instead of leaving silence. Returns null
 *  when the world has a unique outlier (the amber edge already speaks)
 *  or no divergence at all (nothing to explain). Same scan, same grid,
 *  same epsilon — a sibling lens, not a second opinion. */
export const contestedCrown = (
  rows: { peakPct: number | null }[],
): { abs: number; indices: number[] } | null => {
  const { abs, indices } = crownScan(rows);
  return indices.length > 1 ? { abs, indices } : null;
};

/** t221: shape agreement — the inventory gives every owner the winner's
 *  own comparison arithmetic. The deep report speaks Agreement r for the
 *  winner's maps (main vs its overlays, t195/t206); this helper speaks
 *  the SAME statistic for an owner's main landscape against the WINNER's:
 *  both resampled to the finer of the two grids on the shared fraction
 *  scale (the finer ruler preserves more shape), one Pearson number.
 *  Fail-soft, the family contract: a missing landscape, an empty one or
 *  a flat field (zero variance → non-finite r) earns null — the cell
 *  says —, it never guesses. The winner's own row rides the same path
 *  (a landscape against itself) and lands at 1.00 the honest way: no
 *  special case, no second father. */
export const shapeAgreement = (
  winnerBins: number[] | null | undefined,
  ownerBins: number[] | null | undefined,
): number | null => {
  if (!winnerBins || !ownerBins || winnerBins.length === 0 || ownerBins.length === 0) return null;
  const n = Math.max(winnerBins.length, ownerBins.length);
  const r = pearson(resampleByFraction(winnerBins, n), resampleByFraction(ownerBins, n));
  return Number.isFinite(r) ? r : null;
};

/** t222: the weakest band, as the inventory's grid speaks it — the r
 *  column's natural next question is WHERE the shape does not follow,
 *  and the answer is the same quarter-band cut the deep report's Local
 *  agreement table speaks (localAgreement + weakestBand, the family
 *  machinery — composed here, never re-derived). One grammar for the
 *  fact everywhere: a SHORT band name and the band's own r on the
 *  2-decimal grid: Q2 (-0.62). The short name is NOT string surgery on
 *  the label — the label is prose ("Q2 (25–50%)", the taught dialect);
 *  the quarter INDEX comes from the band's own `from` coordinate (the
 *  t202 lesson: the address lives in the numbers, never in a parsed
 *  string — t210's X5 patrols this). Null (unmeasured,
 *  flat everywhere, too short to cut) prints the honest dash. The
 *  reference row rides the same path — its thinnest quarter is perfect,
 *  and the cell says so: Q1 (1.00). */
export const weakestCellOf = (w: { label: string; r: number; from: number } | null | undefined): string => {
  if (!w || !Number.isFinite(w.r)) return "\u2014";
  const q = Math.min(4, Math.max(1, Math.round(w.from * 4) + 1));
  return `Q${q} (${w.r.toFixed(2)})`;
};

/** t223: the shape portrait — the roster's first PICTURE. The Agreement r
 *  column compresses a landscape into one number; the portrait lets the
 *  reader SEE the shape it was compressed from: the owner's main
 *  landscape as a polyline in a W×H box. The normalization answers the
 *  SAME question pearson answers — shape, not magnitude (each landscape
 *  is max-normalized to the full box height; a 2× denser map with the
 *  same geometry draws the same line, exactly as it correlates to 1.00).
 *  The x axis rides the shared fraction scale (resampleByFraction,
 *  t195's doctrine — two grids are two rulers over the same depth), so
 *  an owner and the winner can be laid over each other honestly: the
 *  caller draws both paths in one box and the separation (or the
 *  coincidence) is visible without a single number. Fail-soft, the
 *  family contract: null/empty in → null out; a flat field (max ≤ 0)
 *  has no shape to draw → null — the cell says —, it never guesses.
 *  The path lives in the LOGIC layer (twins fork, imports don't): the
 *  dialog renders it, the probes can re-derive it, the paper's bytes
 *  stay free of pictures (pictures live on the wire, not in markdown). */
export const sparklinePath = (
  bins: number[] | null | undefined,
  w: number,
  h: number,
  stations = 48,
): string | null => {
  if (!bins || bins.length === 0) return null;
  const pts = resampleByFraction(bins, Math.max(2, stations));
  const max = Math.max(...pts);
  if (!(max > 0)) return null;
  return pts
    .map((v, i) => {
      const x = (i / (pts.length - 1)) * w;
      const y = h - (v / max) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
};

/** Every PAIR of comparison terrains, correlated on the shared fraction
 *  scale with both resampled to the FINER of the two grids (the finer
 *  ruler preserves more shape; t195's fraction doctrine, pairwise).
 *  half1 vs half2 is THE cryo-EM QC pair: two independent reconstructions
 *  built from disjoint halves of the data — where they agree the density
 *  is real, which is exactly the question FSC asks. Overlay-vs-main says
 *  "does this map follow the reconstruction"; pairwise says "do the
 *  halves corroborate each other". t206: a global r can hide a localized
 *  parting of ways — each pair also names its WEAKEST quarter band (the
 *  same equal-count cut as localAgreement, applied between the pair),
 *  so the report and the wall can print WHERE the corroboration is thin.
 *  A pair too short to cut (n < 4) or flat across every band earns no
 *  address: `weakest` stays absent and the honest dash answers. */
export const pairwiseAgreement = (overlays: ReportOverlay[]): { a: string; b: string; r: number; weakest?: { label: string; r: number; from: number; to: number } }[] => {
  const out: { a: string; b: string; r: number; weakest?: { label: string; r: number; from: number; to: number } }[] = [];
  for (let i = 0; i < overlays.length; i++) {
    for (let j = i + 1; j < overlays.length; j++) {
      const n = Math.max(overlays[i].bins.length, overlays[j].bins.length);
      const a = resampleByFraction(overlays[i].bins, n);
      const b = resampleByFraction(overlays[j].bins, n);
      // t206: the pair's own weakest band — the localAgreement cut, the
      // pair as its own two maps (NOT against the main landscape)
      let weakest: { label: string; r: number; from: number; to: number } | undefined;
      if (n >= 4) {
        for (let k = 0; k < 4; k++) {
          const lo = Math.floor((k * n) / 4);
          const hi = Math.floor(((k + 1) * n) / 4);
          const r = pearson(a.slice(lo, hi), b.slice(lo, hi));
          if (!Number.isFinite(r)) continue;
          if (!weakest || r < weakest.r) weakest = { label: QUARTER_LABELS[k], r, from: lo / n, to: hi / n };
        }
      }
      out.push({
        a: overlays[i].name,
        b: overlays[j].name,
        r: pearson(a, b),
        weakest,
      });
    }
  }
  return out;
};

/* ---- Local agreement (t198): the divergence earns an ADDRESS. ---- */

/** The four nominal quarter bands of the shared 0–100% fraction scale.
 *  Equal-COUNT cuts of the shared grid, so the labels are the bands'
 *  nominal fraction ranges (off by at most one plane when the count
 *  does not divide by four). */
export const QUARTER_LABELS = ["Q1 (0–25%)", "Q2 (25–50%)", "Q3 (50–75%)", "Q4 (75–100%)"];

/** One quarter band's verdict. `label` is the human vocabulary (the
 *  report prints it verbatim); `from`/`to` are the band's ACTUAL extent
 *  on the shared 0–100% fraction scale — the machine-readable address
 *  the equal-count cut really produced (off by at most one plane from
 *  the nominal label when the count does not divide by four). t202:
 *  the wall's chip navigates by from/to and never parses the label —
 *  the coordinate lives beside the vocabulary, not inside it. t205:
 *  the report prints the coordinate BESIDE the vocabulary too (the
 *  Depth column) — the paper and the wall now quote the same address,
 *  each in its own dialect (the table quotes it, nothing parses it). */
export interface LocalBand { label: string; r: number; from: number; to: number }

/** LOCAL shape agreement: the shared fraction axis cut into four
 *  equal-count bands, each correlated independently. A global r can
 *  hide a localized betrayal — a map can agree over most of the depth
 *  and part ways in a single band (a mask edge, a noise shelf). The
 *  weakest band is the ADDRESS of the disagreement: t193's doctrine
 *  ("where the lines part ways lives the noise") now comes with a
 *  street number. Both sides are resampled to the finer grid — the
 *  same ruler pairwiseAgreement drinks from — and every band is judged
 *  on its OWN variance, so a band with no shape says NaN ("—") instead
 *  of inventing a correlation. ONE father: the report table and the
 *  wall's weakest-quarter chips both drink from this cup. */
export const localAgreement = (mainBins: number[], overlayBins: number[]): LocalBand[] => {
  const n = Math.max(mainBins.length, overlayBins.length);
  if (n < 4) return []; // four bands need at least four planes to exist
  const a = resampleByFraction(mainBins, n);
  const b = resampleByFraction(overlayBins, n);
  const out: LocalBand[] = [];
  for (let k = 0; k < 4; k++) {
    // equal-count cuts [floor(k*n/4), floor((k+1)*n/4)) — disjoint,
    // exhaustive, no shared boundary plane between neighbours
    const lo = Math.floor((k * n) / 4);
    const hi = Math.floor(((k + 1) * n) / 4);
    out.push({
      label: QUARTER_LABELS[k],
      r: pearson(a.slice(lo, hi), b.slice(lo, hi)),
      // the band's true fraction extent: bin i covers [i/n, (i+1)/n)
      from: lo / n,
      to: hi / n,
    });
  }
  return out;
};

/** The weakest band by r — the address to inspect. NaN bands (flat, or
 *  too short to have shape) are not ranked; when every band is flat
 *  there IS no weakest and the caller says so instead of inventing
 *  one (the flat-map doctrine, local). */
export const weakestBand = (bands: LocalBand[]): LocalBand | null => {
  let w: LocalBand | null = null;
  for (const b of bands) {
    if (!Number.isFinite(b.r)) continue;
    if (!w || b.r < w.r) w = b;
  }
  return w;
};

/* ---- The r profile (t200): the agreement earns a CONTOUR. ---- */

export interface RProfile { window: number; rs: number[] }

/** CONTINUOUS local shape agreement: a sliding window (n/8 planes,
 *  clamped to 4..16) walked across the shared fraction scale over
 *  STATIONS evenly spaced by window CENTRE, correlated independently
 *  at every stop. The quarter bands (localAgreement) give a betrayal
 *  its BAND; the r profile gives it a CONTOUR — the sparkline on the
 *  wall is this array drawn left to right, stations at k/(STEPS-1).
 *  NaN stations (a flat window has no shape) are honest holes, never
 *  zeros. ONE father: the wall's sparkline drinks from this cup — the
 *  REPORT keeps the quarter table, because the contour is a visual
 *  instrument and visual instruments don't enter reports (the t193
 *  CSV-export doctrine's report chapter: overlay terrains are on the
 *  wall, the numbers stay in the tables). */
export const RPROFILE_STEPS = 24;

export const rProfile = (mainBins: number[], overlayBins: number[]): RProfile => {
  const n = Math.max(mainBins.length, overlayBins.length);
  if (n < 4) return { window: 0, rs: [] };
  const a = resampleByFraction(mainBins, n);
  const b = resampleByFraction(overlayBins, n);
  const w = Math.min(16, Math.max(4, Math.round(n / 8)));
  const rs: number[] = [];
  for (let k = 0; k < RPROFILE_STEPS; k++) {
    const centre = Math.round((k / (RPROFILE_STEPS - 1)) * (n - 1));
    const lo = Math.max(0, Math.min(n - w, centre - Math.floor(w / 2)));
    rs.push(pearson(a.slice(lo, lo + w), b.slice(lo, lo + w)));
  }
  return { window: w, rs };
};

/**
 * ONE builder for the map's QC summary (t195): clipboard, download and
 * the data-md carrier all drink from this single cup, and it derives
 * from the profile ROWS exactly like buildProfileCsv does — it NEVER
 * parses the CSV (parse-of-parse is a second derivation waiting to
 * drift, t194's doctrine). The report is a function of the LANDSCAPE
 * and the ADOPTED COMPARISON TERRAINS — never the playhead — so
 * scrubbing never retires it, and the same landscape always yields the
 * same bytes (no timestamps inside; the filename carries the stamp).
 */
export const buildProfileReport = (opts: {
  mapName: string;
  jobId: string;
  axis: string;
  bins: number[];
  overlays: ReportOverlay[];
  pendingOverlays: number;
}): string => {
  const { mapName, jobId, axis, bins, overlays, pendingOverlays } = opts;
  const n = bins.length;
  const peak = peakIndexOf(bins);
  let trough = 0;
  for (let i = 1; i < n; i++) {
    if (bins[i] < bins[trough]) trough = i;
  }
  const max = bins[peak], min = bins[trough];
  const span = max - min;
  const lines: string[] = [];
  lines.push(`## Map QC summary — ${mdCell(mapName)}`);
  lines.push("");
  lines.push(`Job \`${mdCell(jobId)}\` · mean-density landscape along **${axis.toUpperCase()}** (${n} bins).`);
  lines.push("");
  lines.push(`- **Peak** mean ρ at plane ${peak} (**${pctAt(bins, peak)}** of depth) — where the specimen's mass concentrates on this axis`);
  lines.push(`- **Trough** at plane ${trough} (${pctAt(bins, trough)})`);
  lines.push(`- **Span** across planes: ${span.toFixed(4)} (max ${max.toFixed(4)}, min ${min.toFixed(4)})`);
  lines.push("");
  lines.push(`### Comparison maps (${overlays.length})`);
  lines.push("");
  if (overlays.length > 0) {
    lines.push("| Map | Bins | Peak at | Agreement r | Verdict |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const o of overlays) {
      const r = pearson(resampleByFraction(o.bins, n), bins);
      const pk = o.bins.reduce((bi, v, i, arr) => (v > arr[bi] ? i : bi), 0);
      lines.push(
        `| ${mdCell(o.name)} | ${o.bins.length} | ${pctAt(o.bins, pk)} | ${Number.isNaN(r) ? "—" : r.toFixed(2)} | ${agreementVerdict(r)} |`
      );
    }
    lines.push("");
    lines.push("Where a comparison line follows the main landscape, the density is consistent between maps; where it parts ways lives noise or masking. Agreement r is the Pearson correlation on the shared 0–100% fraction scale — each terrain self-scaled to its own map's stats (the shape is the signal, not absolute ρ).");
    // t198: the LOCAL agreement table — a global r can hide a band-local
    // betrayal, so each quarter of the fraction scale is correlated
    // independently and the weakest quarter names the ADDRESS to inspect.
    if (overlays.length > 0) {
      lines.push("");
      lines.push("### Local agreement");
      lines.push("");
      lines.push(`| Map | ${QUARTER_LABELS.join(" | ")} | Weakest | Depth (fraction) |`);
      lines.push("| --- | --- | --- | --- | --- | --- | --- |");
      for (const o of overlays) {
        const bands = localAgreement(bins, o.bins);
        const w = weakestBand(bands);
        const cell = (b: LocalBand | undefined) => (b && Number.isFinite(b.r) ? b.r.toFixed(2) : "—");
        // t205: the coordinate beside the vocabulary — the Depth column
        // quotes the band's ACTUAL from/to (the same numbers the wall's
        // bracket door jumps to), in the strip's own 2dp dialect; a flat
        // verdict has no address, so the cell stays honest ("—").
        const depth = w ? `${w.from.toFixed(2)}–${w.to.toFixed(2)}` : "—";
        lines.push(
          `| ${mdCell(o.name)} | ${cell(bands[0])} | ${cell(bands[1])} | ${cell(bands[2])} | ${cell(bands[3])} | ${w ? `${w.label} (${w.r.toFixed(2)})` : "flat — no local shape"} | ${depth} |`
        );
      }
      lines.push("");
      lines.push("A global r can hide a localized betrayal — a map can agree over most of the depth and part ways in a single band (a mask edge, a noise shelf). Each quarter of the shared fraction scale is correlated independently, and the weakest quarter is the address to inspect; the Depth column quotes that address as fractions (the same numbers the viewer's bracket door jumps to). Where the half-maps disagree with each other in one band only, suspect that band, not the reconstruction.");
    }
    if (overlays.length > 1) {
      lines.push("");
      lines.push("### Pairwise agreement");
      lines.push("");
      // t206: the Depth column rides AFTER Verdict, exactly as the Local
      // table's own Depth column rides after Weakest — the pair's weakest
      // band quoted as fractions (the strip's 2dp dialect); a pair too
      // short to cut or flat across every band keeps the honest dash.
      lines.push("| Map A | Map B | Agreement r | Verdict | Depth (fraction) |");
      lines.push("| --- | --- | --- | --- | --- |");
      for (const p of pairwiseAgreement(overlays)) {
        const pdepth = p.weakest ? `${p.weakest.from.toFixed(2)}–${p.weakest.to.toFixed(2)}` : "—";
        lines.push(`| ${mdCell(p.a)} | ${mdCell(p.b)} | ${Number.isNaN(p.r) ? "—" : p.r.toFixed(2)} | ${agreementVerdict(p.r)} | ${pdepth} |`);
      }
      lines.push("");
      lines.push("Two half-maps come from disjoint halves of the data — where they agree with EACH OTHER, the density is real (this is the question FSC asks). Maps that follow the main landscape but not each other deserve a second look. The Depth column quotes where each pair's corroboration is thinnest — the same fractions the viewer's bracket doors jump to, measured between the pair itself.");
    }
    // t209: the dialect learns to introduce itself — one section that
    // teaches the whole depth dialect the report speaks (the fraction
    // scale, the equal-count knife, the three tables' division of
    // labour) AND answers the one question the tables cannot ask
    // themselves: why the Comparison table carries no Depth column.
    // Its address already lives one section down, in Local agreement —
    // a depth printed twice has two fathers and drifts apart. The
    // section rides the same overlays guard as the tables it teaches
    // (no addresses, nothing to read, no lesson) and sits BEFORE the
    // export footer, so the paper ends by teaching, then by naming
    // its own provenance.
    if (overlays.length > 0) {
      lines.push("");
      lines.push("### Reading the depth addresses");
      lines.push("");
      lines.push("Every depth in this report is a fraction of the map's thickness along the axis (0 = the front face, 1 = the back face), never an Å position — the landscape is mean density per plane, contour-independent, describing the whole map. The quarter bands are cut by an equal-count knife: each quarter holds the same number of measured planes, so a weak quarter names a real place, not a sparse one. The tables divide the labour — Comparison summarizes each map with one global r; Local addresses (the weakest quarter, quoted as depth); Pairwise corroborates (each pair measured as its own two maps). The Comparison table deliberately carries no Depth column: its address is already quoted in the Local agreement section below — a depth printed twice has two fathers and drifts apart. In the viewer, every one of these addresses is a door: press the chip or the bracket and the plane lands on the band's centre.");
    }
  } else {
    lines.push("None adopted yet — adopt half-maps or masked variants through Layers and they appear here. Where their lines follow the main landscape the density is real; where they part ways lives the noise.");
  }
  if (pendingOverlays > 0) {
    lines.push("");
    lines.push(`_${pendingOverlays} comparison map${pendingOverlays === 1 ? " is" : "s are"} still measuring — its landscape has not arrived, and this summary does not guess it._`);
  }
  lines.push("");
  lines.push("_Exported from CryoFlow's slice instrument — the mean-density landscape is contour-independent and describes the whole map, not the current isosurface._");
  return lines.join("\n");
};

export const profileReportFilename = (axis: string): string =>
  `map-qc-report-${axis}-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.md`;

/* ------------------------------------------------------------------ */
/* The session binding (t197) — the families meet in one document.     */
/* ------------------------------------------------------------------ */

/** The session's last HPC sweep — what the session report binds. One
 *  slot: a new race replaces the previous one wholesale. */
export interface SessionSweepState {
  rows: SweepRow[];
  bestId: string | null;
}

/** Job-status counts for the prologue's pipeline glance. */
export interface PipelineGlance {
  total: number;
  succeeded: number;
  running: number;
  failed: number;
  /** idle + submitted + anything the canvas can host — waiting for work */
  waiting: number;
}

/**
 * ONE father for the session QC report (t197): the document that binds
 * the report families under a single cover. It NEVER parses the family
 * outputs — the map section and the sweep annex are embedded VERBATIM
 * (the session report does not re-translate the families' translations;
 * it binds them), and the pipeline glance is derived from the counts the
 * caller measured, never from any other section's bytes. No timestamps:
 * the same session state yields the same bytes, the filename carries the
 * stamp. Every family that has nothing to say gets an honest empty
 * state that teaches where its numbers come from — a report that invents
 * a section's content lies just as much as one that drops it.
 */
export const buildSessionReport = (opts: {
  projectName: string | null;
  pipeline: PipelineGlance | null;
  mapQc: { jobId: string; report: string } | null;
  mapPending: boolean;
  mapError: boolean;
  /** t212: every completed job that owns a true 3D volume, in walk order.
   *  The deep profiles above speak only the newest owner — the inventory
   *  is how the paper admits the rest of the session exists. Null when
   *  the walk has not settled (pending/error); the section honest-absents
   *  when the world owns no volumes at all. t221: each row also carries
   *  its Agreement r vs the winner (null until BOTH landscapes are in —
   *  the dialog computes it where the bins live; the paper cell says —). */
  mapInventory: { jobId: string; jobName: string; mainName: string; volumeCount: number; peak: string | null; peakPct: number | null; shapeR?: number | null; weakest?: { label: string; r: number; from: number } | null }[] | null;
  sweep: string | null;
}): string => {
  const { projectName, pipeline, mapQc, mapPending, mapError, mapInventory, sweep } = opts;
  const lines: string[] = [];
  lines.push("# CryoFlow session QC report");
  lines.push("");
  if (pipeline && pipeline.total > 0) {
    lines.push(
      `Project **${mdCell(projectName ?? "untitled")}** · ${pipeline.total} job${pipeline.total === 1 ? "" : "s"} — ` +
      `${pipeline.succeeded} succeeded · ${pipeline.running} running · ${pipeline.failed} failed · ${pipeline.waiting} waiting.`
    );
  } else {
    lines.push(`Project **${mdCell(projectName ?? "untitled")}** · the canvas has no jobs yet.`);
  }
  lines.push("");
  lines.push("## Pipeline at a glance");
  lines.push("");
  if (pipeline && pipeline.total > 0) {
    lines.push(`- **${pipeline.succeeded}** succeeded job${pipeline.succeeded === 1 ? "" : "s"} feed this report's QC sections;`);
    lines.push(`- **${pipeline.running}** running · **${pipeline.failed}** failed — failures stay counted here, never dropped;`);
    lines.push(`- **${pipeline.waiting}** waiting (idle or submitted) — no verdict exists for work that has not run.`);
  } else {
    lines.push("No jobs on the canvas yet — add nodes, run them, and their verdicts will gather here.");
  }
  lines.push("");
  lines.push("## Map QC");
  lines.push("");
  if (mapQc) {
    lines.push(mapQc.report.trimEnd());
  } else if (mapPending) {
    lines.push("_Still measuring this session's maps — the landscape has not arrived, and this summary does not guess it._");
  } else if (mapError) {
    lines.push("_The map landscape could not be measured (the profile API refused, or the maps are gone) — this summary does not guess it._");
  } else {
    lines.push("None of this session's jobs has 3D maps yet — run a 3D reconstruction and its maps will be profiled here automatically (no viewer required).");
  }
  lines.push("");
  if (mapInventory && mapInventory.length > 0) {
    lines.push("### Session map inventory");
    lines.push("");
    // t213: the roster's rows are doors. t210 taught the strip that a
    // name on a bracket should never be a dead end; the same lesson now
    // lives on the paper — on the report PAGE each row hands you to that
    // job's results (openJob: workspace hops, then the inspector). The
    // exported bytes stay plain Markdown — a door needs a page to open.
    // t214: the roster speaks its numbers. The Peak column quotes each
    // owner's main map EXACTLY the way the deep report quotes the winner
    // (pctAt on the raw landscape, the same code path) — the inventory is
    // comparable, not just traversable (t213's doors). "—" means still
    // measuring or the profile refused: the pending doctrine, the cell
    // does not guess. The door clause (t213) and the fold clause (t212)
    // keep their exact bytes — front-wave probes pin them.
    // t215: the comparison becomes readable. The Δ winner column reads
    // every peak against the winner's own (deltaVsWinner — the SAME
    // helper the door aria quotes): the reference row speaks +0.0, its
    // dash obeys the same law, and the lens never guesses. On the PAGE
    // the row farthest from the winner wears the amber edge — a lens,
    // not a verdict; the exported bytes keep the numbers and let the
    // reader judge.
    lines.push("Every job in this session that owns a true 3D volume, newest walk first. The deep profiles above ride the newest owner; this inventory keeps every other owner visible — no map hides below the fold (the t211 lesson: a walk that stops at the first winner leaves the rest of the world unseen). Each row is a door — press it and the page hands you to that job's results (the t210 lesson carried onto the report: a name on a roster should never be a dead end). The Peak column quotes each owner's main map exactly the way the deep report quotes the winner — where the mass concentrates along the shared axis, as a fraction of depth; — means still measuring, never a guess. The Δ winner column reads every peak against the winner's own — the reference row speaks +0.0, its dash obeys the same law, and the lens never guesses; on the page the row farthest from the winner wears the amber edge (a lens, not a verdict — the exported bytes keep the numbers and let the reader judge). The Agreement r column gives every owner the winner's own comparison arithmetic — the same Pearson correlation on the shared 0–100% fraction scale, each owner's main landscape read against the winner's on the finer of the two grids; the reference row lands at 1.00 through the same path, and — means still measuring or a flat field, never a guess. The Weakest column answers the r column's next question — WHERE the shape does not follow: the same quarter-band cut the deep report's Local agreement table speaks, thinnest band first, Q1–Q4 with the band's own r; the reference row's thinnest quarter is perfect and the cell says so.");
    lines.push("");
    // t221: the roster speaks shape. The Agreement r column gives every
    // owner the winner's own comparison arithmetic — the SAME Pearson on
    // the shared 0–100% fraction scale the deep report prints for the
    // winner's maps (shapeAgreement, imported machinery: resample to the
    // finer grid, one number; the winner's row lands at 1.00 through the
    // same path, no special case). — means still measuring or a flat
    // field; the cell never guesses. shapeR travels in the row (the
    // dialog computes it where the landscapes live); the CSV sibling
    // grows the same fact as shape_r — numbers travel, verdicts don't.
    const winnerPct = mapInventory[0]?.peakPct ?? null;
    lines.push("| Job | Main map | Volumes | Peak | Δ winner | Agreement r | Weakest |");
    lines.push("|-----|----------|---------|------|----------|-------------|---------|");
    for (const o of mapInventory) {
      const delta = deltaVsWinner(o.peakPct, winnerPct);
      const rCell = o.shapeR;
      lines.push(`| ${mdCell(o.jobName)} | ${mdCell(o.mainName)} | ${o.volumeCount} | ${o.peak ?? "—"} | ${delta ?? "—"} | ${rCell != null ? rCell.toFixed(2) : "—"} | ${weakestCellOf(o.weakest)} |`);
    }
    lines.push("");
    // t220: the lens explains its own silences. When the crown is
    // contested (contestedCrown — the SAME scan the amber edge reads,
    // so the page and the paper can never disagree) the zero-amber
    // table gets a footnote naming every contender and the shared |Δ|.
    // The note lives in the MARKDOWN — the exported bytes and the
    // clipboard copy carry the explanation, not just the page (the
    // t218 CSV stays numbers-only: the roster's machine grid speaks
    // facts, the lens's verdicts travel with the paper). In a world
    // with a unique outlier or no divergence this line is never born —
    // front-wave probes' paper bytes are untouched.
    const crown = contestedCrown(mapInventory);
    if (crown) {
      const andList = (names: string[]): string =>
        names.length <= 1
          ? names.join("")
          : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
      const contenders = crown.indices
        .map((i) => mapInventory[i]?.jobName)
        .filter((n): n is string => !!n);
      lines.push(
        `> The outlier lens is silent here: ${andList(contenders)} tie for the largest |Δ| (${crown.abs.toFixed(1)} vs winner) — a tie for the crown is no crown, so no row wears the amber edge.`,
      );
      lines.push("");
    }
  }
  lines.push("## Scheduling sweep");
  lines.push("");
  if (sweep) {
    lines.push(sweep.trimEnd());
  } else {
    lines.push("No sweep raced this session — open the HPC queue panel and run *Compare profiles*; the winner's verdict will be bound here verbatim.");
  }
  lines.push("");
  lines.push("_Bound from this session's live state — the pipeline glance, the map landscape and the sweep verdict each keep their own provenance. The filename carries the export stamp._");
  return lines.join("\n");
};

export const sessionReportFilename = (): string =>
  `session-qc-report-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.md`;

/** t218: the CSV sibling of the report filename — same timestamp grammar,
 *  a different extension (the roster's machine grid travels under its
 *  own name, not the report's). */
export const inventoryCsvFilename = (): string =>
  `session-map-inventory-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.csv`;

/** t237: the portable-HTML sibling of the report filename — the echo
 *  (buildSessionReportHtml) travels under the report's own name with a
 *  .html dress; same timestamp grammar as its md/CSV siblings. */
export const sessionReportHtmlFilename = (): string =>
  `session-qc-report-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.html`;

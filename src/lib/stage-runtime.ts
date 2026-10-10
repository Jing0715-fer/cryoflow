/**
 * CryoFlow — per-stage wall-clock runtime statistics (CLIENT, pure).
 *
 * The analytics panel already speaks three lenses (particle flow,
 * resolution ladder, session timeline) but none answers the question a
 * scientist asks after the third full pipeline run: "which STAGE type
 * eats my wall clock?" The session timeline draws every run's window,
 * but per-RUN bars don't aggregate — eighteen bars don't tell you that
 * 3D classification is 40% of everything.
 *
 * stageRuntime() groups completed runs by job type and aggregates their
 * measured windows (the SAME well the timeline bars and the CSVs drink
 * from — walkTimeline's ms, never the raw j.duration that reads 0/stale
 * while a run is going). Per type: run count, median, p90, summed total,
 * and the share of the whole project's summed runtime. The bottleneck is
 * the heaviest type by TOTAL (what ate the clock), not by median (what
 * is slow per run) — both numbers live on the row.
 *
 * Percentile grammar: nearest-rank (ceil(p/100 · n), 1-indexed) on an
 * ascending sort — deterministic, interpolation-free, trivially
 * assertable. median is the classic (odd n → middle, even n → mean of
 * the two middles). A single-run stage has median = p90 = its only run.
 */

import { fmtDuration } from "./duration";

export interface StageRuntimeRow {
  /** Job type key (e.g. "class3d"). */
  type: string;
  /** Human label from the workflow's type table (falls back to the key). */
  label: string;
  /** Completed runs of this type in scope. */
  n: number;
  medianMs: number;
  p90Ms: number;
  /** Summed measured wall time — the share bar's numerator. */
  totalMs: number;
  /** totalMs / Σ(all rows' totalMs), 0–100 rounded to one decimal. */
  sharePct: number;
}

export interface StageRuntime {
  /** Sorted desc by totalMs (the heaviest stage first). */
  rows: StageRuntimeRow[];
  /** The heaviest stage — null when fewer than two distinct types ran
   *  (with one type "bottleneck" is a tautology, not an insight). */
  bottleneck: StageRuntimeRow | null;
  /** Σ of all rows' totalMs — the share bar's denominator. */
  totalMs: number;
  /** Σ of all rows' n. */
  runs: number;
}

export interface StageRuntimeInput {
  type: string;
  label: string;
  /** Measured window (walkTimeline's ms — the well law). */
  ms: number;
}

/** Nearest-rank percentile on an ASCENDING-sorted array. */
export function percentileSorted(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return NaN;
  const rank = Math.ceil((p / 100) * sortedAsc.length);
  return sortedAsc[Math.min(sortedAsc.length, Math.max(1, rank)) - 1];
}

/** Classic median: odd n → middle, even n → mean of the two middles. */
export function medianOf(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return NaN;
  return n % 2 === 1 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

export function stageRuntime(inputs: StageRuntimeInput[]): StageRuntime {
  const byType = new Map<string, number[]>();
  const labelByType = new Map<string, string>();
  for (const { type, label, ms } of inputs) {
    if (!Number.isFinite(ms) || ms <= 0) continue; // junk windows never speak
    const bucket = byType.get(type);
    if (bucket) bucket.push(ms);
    else byType.set(type, [ms]);
    if (!labelByType.has(type)) labelByType.set(type, label || type);
  }
  const totalMs = [...byType.values()].reduce((sum, xs) => sum + xs.reduce((a, b) => a + b, 0), 0);
  const rows: StageRuntimeRow[] = [...byType.entries()].map(([type, xs]) => {
    const sorted = [...xs].sort((a, b) => a - b);
    const total = xs.reduce((a, b) => a + b, 0);
    return {
      type,
      label: labelByType.get(type) ?? type,
      n: xs.length,
      medianMs: medianOf(xs),
      p90Ms: percentileSorted(sorted, 90),
      totalMs: total,
      sharePct: totalMs > 0 ? Math.round((total / totalMs) * 1000) / 10 : 0,
    };
  });
  rows.sort((a, b) => b.totalMs - a.totalMs || a.type.localeCompare(b.type));
  return {
    rows,
    bottleneck: rows.length >= 2 ? (rows[0] ?? null) : null,
    totalMs,
    runs: rows.reduce((sum, r) => sum + r.n, 0),
  };
}

/* ------------------------------------------------------------------ */
/* The machine face — the runtime table as a spreadsheet-ready grid    */
/* ------------------------------------------------------------------ */

/** RFC-4180-ish cell escaping (the panel's own grammar, mirrored): quote
 *  when a special character is present; double embedded quotes. */
const csvCell = (v: unknown): string => {
  const s = String(v ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** stageRuntimeCsvFilename — mirrors timelineRunsCsvFilename's timestamp
 *  grammar, under the runtime block's own flag (never masquerading as the
 *  other grids' names). */
export const stageRuntimeCsvFilename = (): string =>
  `runtime-by-stage-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.csv`;

/**
 * The runtime block's CSV: one row per stage type — machine columns
 * (ms, exact) next to the human words (fmtDuration), so a spreadsheet
 * can sort on numbers while a human reads the same cell the panel
 * prints. Sorted as the panel prints (heaviest first).
 */
export function stageRuntimeCsv(rt: StageRuntime): string | null {
  if (rt.rows.length === 0) return null;
  const header = [
    "type",
    "type_label",
    "runs",
    "median_ms",
    "median",
    "p90_ms",
    "p90",
    "total_ms",
    "total",
    "share_pct",
  ];
  const lines = [header.join(",")];
  for (const r of rt.rows) {
    lines.push(
      [
        csvCell(r.type),
        csvCell(r.label),
        r.n,
        r.medianMs,
        csvCell(fmtDuration(r.medianMs)),
        r.p90Ms,
        csvCell(fmtDuration(r.p90Ms)),
        r.totalMs,
        csvCell(fmtDuration(r.totalMs)),
        r.sharePct,
      ].join(",")
    );
  }
  return lines.join("\r\n") + "\r\n";
}

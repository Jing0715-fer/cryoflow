"use client";

/**
 * CryoFlow — Orientation Rebalancer run report panel.
 *
 * Before/after statistics (particles, anisotropy, uniformity, 3DFSC-style
 * resolution estimates) + the per-bin trim chart: for every populated
 * Fibonacci-sphere bin a horizontal bar whose full length is countBefore and
 * whose solid tail is countAfter — the trimmed slice is exactly what the
 * Orient-Rebalancer removed.
 *
 * Data: /api/jobs/[id]/rebalance (rebalance_report.json written by the
 * engine-native rebalance job).
 */

import { useEffect, useState } from "react";
import { Scale, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface RebalanceReportResponse {
  jobId: string;
  params: {
    numBins: number;
    percentile: number;
    exclusionCriterion: string;
    mode: string;
    resolutionWeight: number;
    seed: number;
  };
  criterion: string;
  stats: {
    totalBefore: number;
    totalAfter: number;
    removed: number;
    removedPercent: number;
    binsTrimmed: number;
    effectiveBins: number;
    anisotropyBefore: number;
    anisotropyAfter: number;
    meanResolutionBefore: number;
    meanResolutionAfter: number;
    medianResolutionBefore: number;
    medianResolutionAfter: number;
    resolutionCVBefore: number;
    resolutionCVAfter: number;
    countUniformityBefore: number;
    countUniformityAfter: number;
  };
  bins: Array<{
    index: number;
    countBefore: number;
    countAfter: number;
    threshold: number;
    removed: number;
    resolutionBefore: number;
    resolutionAfter: number;
    cx: number;
    cy: number;
    cz: number;
  }>;
  reportFile: string;
}

/** One before→after stat tile. Improving metrics tint emerald, degrading rose. */
function Delta({
  label,
  before,
  after,
  format,
  better,
  hint,
}: {
  label: string;
  before: number;
  after: number;
  format: (v: number) => string;
  better: "up" | "down";
  hint?: string;
}) {
  const delta = after - before;
  const improved = better === "up" ? delta > 0.005 : delta < -0.005;
  const degraded = better === "up" ? delta < -0.005 : delta > 0.005;
  const Trend = improved ? TrendingUp : degraded ? TrendingDown : null;
  return (
    <div
      className="rounded-lg border bg-card p-3"
      title={hint}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 flex items-baseline gap-1.5 font-mono text-sm tabular-nums">
        <span className="text-muted-foreground">{format(before)}</span>
        <span aria-hidden="true" className="text-muted-foreground/50">→</span>
        <span
          className={cn(
            "font-semibold",
            improved && "text-emerald-600 dark:text-emerald-400",
            degraded && "text-rose-600 dark:text-rose-400",
            !improved && !degraded && "text-foreground"
          )}
        >
          {format(after)}
        </span>
        {Trend ? (
          <Trend
            className={cn(
              "size-3.5 self-center",
              improved ? "text-emerald-500" : "text-rose-500"
            )}
            aria-hidden="true"
          />
        ) : null}
      </p>
    </div>
  );
}

export function RebalanceReport({
  jobId,
  className,
}: {
  jobId: string;
  className?: string;
}) {
  const [data, setData] = useState<RebalanceReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}/rebalance`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as RebalanceReportResponse;
        if (!cancelled) {
          setData(body);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  if (error && !data) return null; // enhancement panel — stay silent pre-run
  if (!data) return null;
  const s = data.stats;
  if (s.totalBefore === 0) return null;

  const maxBefore = Math.max(...data.bins.map((b) => b.countBefore), 1);
  const topBins = data.bins.slice(0, 24); // chart legibility cap

  return (
    <section
      aria-label="Orientation rebalance report"
      className={cn(
        "rounded-lg border border-cyan-600/25 bg-gradient-to-b from-cyan-600/5 to-transparent p-3",
        className
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Scale className="h-3.5 w-3.5 text-cyan-600" aria-hidden="true" />
          Rebalance report
        </span>
        <span className="rounded-full border border-cyan-600/30 bg-cyan-600/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-cyan-700 dark:text-cyan-300">
          {data.params.percentile}% percentile · {data.criterion} exclusion
        </span>
        <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
          {s.effectiveBins} bins · {s.binsTrimmed} trimmed
        </span>
        <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
          mode {data.params.mode}
        </span>
      </div>

      {/* before → after headline stats */}
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <Delta
          label="Particles"
          before={s.totalBefore}
          after={s.totalAfter}
          format={(v) => v.toLocaleString()}
          better="up"
          hint="kept particles after per-bin percentile trimming"
        />
        <Delta
          label="Removed"
          before={0}
          after={s.removed}
          format={(v) => (v === 0 ? "—" : `${v.toLocaleString()} (${s.removedPercent.toFixed(1)}%)`)}
          better="down"
          hint="particles excluded from over-populated orientation bins"
        />
        <Delta
          label="Anisotropy"
          before={s.anisotropyBefore}
          after={s.anisotropyAfter}
          format={(v) => v.toFixed(2)}
          better="down"
          hint="max/min per-bin 3DFSC estimate — 1.00 = isotropic"
        />
        <Delta
          label="Count uniformity"
          before={s.countUniformityBefore}
          after={s.countUniformityAfter}
          format={(v) => v.toFixed(3)}
          better="up"
          hint="1 − CV of bin counts — 1.00 = every bin equally populated"
        />
        <Delta
          label="Mean 3DFSC est."
          before={s.meanResolutionBefore}
          after={s.meanResolutionAfter}
          format={(v) => `${v.toFixed(2)} Å`}
          better="down"
          hint="distribution-based estimate, not a two-half-map directional FSC"
        />
        <Delta
          label="Resolution CV"
          before={s.resolutionCVBefore}
          after={s.resolutionCVAfter}
          format={(v) => v.toFixed(3)}
          better="down"
          hint="spread of per-bin resolution estimates (lower = flatter field)"
        />
      </div>

      {/* per-bin trim chart: full bar = before, solid tail = after */}
      {topBins.length > 0 ? (
        <div className="space-y-1">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Top orientation bins — trimmed slices are the removed particles
          </p>
          {topBins.map((b) => {
            const beforeW = Math.max((b.countBefore / maxBefore) * 100, 3);
            const afterW = Math.max((b.countAfter / maxBefore) * 100, b.countAfter > 0 ? 2 : 0);
            return (
              <div key={b.index} className="group flex items-center gap-2">
                <span
                  className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground"
                  title={`bin ${b.index} · direction [${b.cx.toFixed(2)}, ${b.cy.toFixed(2)}, ${b.cz.toFixed(2)}] · threshold ${b.threshold}`}
                >
                  bin {b.index}
                </span>
                <div
                  className="relative h-4 flex-1 overflow-hidden rounded-sm bg-muted/60"
                  role="progressbar"
                  aria-label={`orientation bin ${b.index}: ${b.countBefore} before, ${b.countAfter} after`}
                  aria-valuenow={b.countAfter}
                  aria-valuemin={0}
                  aria-valuemax={b.countBefore}
                >
                  {/* before (full) */}
                  <div
                    className="absolute inset-y-0 rounded-sm bg-gradient-to-r from-cyan-500/25 to-cyan-500/15"
                    style={{ width: `${beforeW}%` }}
                  />
                  {/* after (kept) */}
                  <div
                    className={cn(
                      "absolute inset-y-0 rounded-sm bg-gradient-to-r",
                      b.removed > 0
                        ? "from-amber-500/70 to-amber-600/50"
                        : "from-teal-500/70 to-teal-600/50"
                    )}
                    style={{ width: `${afterW}%` }}
                  />
                  <span className="absolute inset-y-0 left-1.5 flex items-center text-[9.5px] font-medium tabular-nums text-foreground/70 group-hover:text-foreground">
                    {b.countAfter.toLocaleString()} / {b.countBefore.toLocaleString()}
                    {b.removed > 0 ? (
                      <span className="ml-1 text-rose-600/90 dark:text-rose-400/90">
                        −{b.removed.toLocaleString()}
                      </span>
                    ) : null}
                  </span>
                </div>
                <span
                  className="w-16 shrink-0 font-mono text-[9.5px] tabular-nums text-muted-foreground/80"
                  title={`3DFSC estimate ${b.resolutionBefore.toFixed(2)} → ${b.resolutionAfter.toFixed(2)} Å`}
                >
                  {b.resolutionBefore.toFixed(1)}→{b.resolutionAfter.toFixed(1)} Å
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground/80">
        3DFSC values are a distribution-based estimate (saturating count→Å model), not a true
        two-half-map directional FSC — mirroring the Orient-Rebalancer technical documentation.
      </p>
    </section>
  );
}

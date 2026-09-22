"use client";

/**
 * CryoFlow — accumulated-motion panel for MotionCorr jobs: one horizontal
 * stacked bar per micrograph (teal = early drift, amber = late drift),
 * sorted worst-first so the offender is the FIRST thing on screen, with
 * the pack's mean as the reference line and a per-micrograph detail table.
 *
 * Data: /api/jobs/[id]/motion parses corrected_micrographs.star
 * (_rlnAccumulatedMotionTotal / Early / Late, Å).
 *
 * Why stacked early/late and not just the total: the two halves have
 * different remedies. A big EARLY component means the stage settled late
 * (uneven ice / stage hysteresis) — trimming the first frames helps. A
 * big LATE component means the sample kept moving (beam-induced motion) —
 * dose weighting helps. The color split makes the diagnosis visible
 * before the user opens any table.
 */

import { useEffect, useMemo, useState } from "react";
import { Activity, ChevronDown, TriangleAlert } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  cn,
} from "@/lib/utils";
import { fetchJsonRetry } from "@/lib/retry-fetch";
import {
  motionRenderable,
  motionRows,
  type MotionResponse,
} from "@/lib/chart-rows";
import { ChartExportButtons } from "./chart-export-buttons";

const TEAL = "#14b8a6";
const AMBER = "#f59e0b";

/** drift tone: the app's health buckets against the pack's own scale —
 *  a micrograph is an offender when it drifts ≥ mean + 2σ of ITS run. */
function driftTone(total: number, mean: number, sd: number): string {
  if (total >= mean + 2 * sd) return "text-rose-700 dark:text-rose-300";
  if (total >= mean + 1 * sd) return "text-amber-700 dark:text-amber-300";
  return "text-emerald-700 dark:text-emerald-300";
}

export function MotionDriftChart({ jobId, className }: { jobId: string; className?: string }) {
  const [data, setData] = useState<MotionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tableOpen, setTableOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const body = await fetchJsonRetry<MotionResponse>(`/api/jobs/${jobId}/motion`);
        if (!cancelled && motionRenderable(body.micrographs?.length ?? 0)) setData(body);
      } catch {
        /* silent — self-hiding panel */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const stats = useMemo(() => {
    const ms = data?.micrographs ?? [];
    if (ms.length === 0) return null;
    const totals = ms.map((m) => m.total);
    const mean = totals.reduce((a, v) => a + v, 0) / totals.length;
    const sd = Math.sqrt(totals.reduce((a, v) => a + (v - mean) ** 2, 0) / totals.length);
    const worst = ms.reduce((a, b) => (b.total > a.total ? b : a));
    return { mean, sd, worst, threshold: mean + 2 * sd, offenders: ms.filter((m) => m.total >= mean + 2 * sd).length };
  }, [data]);

  const chartData = useMemo(() => {
    const ms = data?.micrographs ?? [];
    return [...ms]
      .sort((a, b) => b.total - a.total)
      .slice(0, 24)
      .map((m) => ({
        name: m.name.length > 22 ? m.name.slice(0, 21) + "…" : m.name,
        total: m.total,
        early: Math.max(0, Math.min(m.early, m.total)),
        late: Math.max(0, m.total - m.early),
        offender: stats ? m.total >= stats.threshold : false,
      }));
  }, [data, stats]);

  const rows = useMemo(() => motionRows(data), [data]);

  if (error) return null;
  if (!data) return null;

  const summary = data.summary;

  return (
    <div
      data-motion-panel=""
      className={cn("rounded-xl border bg-card print:break-inside-avoid", className)}
    >
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <Activity className="size-4 text-teal-600 dark:text-teal-400" aria-hidden />
        <h3 className="text-sm font-semibold">Accumulated motion</h3>
        {stats && stats.offenders > 0 ? (
          <span
            data-motion-offender-badge=""
            className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
          >
            <TriangleAlert className="size-3" aria-hidden />
            {stats.offenders} outlier{stats.offenders > 1 ? "s" : ""} ≥ {stats.threshold.toFixed(1)} Å
          </span>
        ) : null}
        <span className="text-xs text-muted-foreground">
          {summary ? `${summary.count} micrographs · mean ${summary.meanTotal.toFixed(1)} Å` : "corrected_micrographs.star"}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <ChartExportButtons
            name="motion-drift"
            getRows={() => (rows.length > 0 ? rows : null)}
          />
          <button
            type="button"
            onClick={() => setTableOpen((v) => !v)}
            aria-expanded={tableOpen}
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={tableOpen ? "Collapse detail table" : "Expand detail table"}
          >
            <ChevronDown className={cn("size-4 transition-transform", tableOpen && "rotate-180")} aria-hidden />
          </button>
        </div>
      </div>

      <div className="px-2 pb-2 pt-3" data-motion-chart="">
        <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 22 + 40)}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 60, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" opacity={0.5} />
            <XAxis
              type="number"
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickFormatter={(v: number) => `${v}`}
              label={{ value: "accumulated drift (Å)", position: "insideBottomRight", offset: -2, fontSize: 10 }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={130}
              stroke="var(--muted-foreground)"
              fontSize={10}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.4 }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--popover-foreground)",
              }}
              formatter={(value: number | string, name: string) => [
                typeof value === "number" ? `${value.toFixed(2)} Å` : String(value),
                name === "early" ? "early drift" : "late drift",
              ]}
            />
            <ReferenceLine
              x={stats?.mean ?? 0}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 3"
              label={{ value: `mean ${stats ? stats.mean.toFixed(1) : "0"} Å`, fontSize: 10, position: "top" }}
            />
            <Bar dataKey="early" stackId="drift" fill={TEAL} radius={[0, 0, 0, 0]} />
            <Bar dataKey="late" stackId="drift" fill={AMBER} radius={[0, 3, 3, 0]}>
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.offender ? "#f43f5e" : AMBER} fillOpacity={entry.offender ? 0.95 : 0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="px-2 pb-1 text-[11px] text-muted-foreground">
          teal = early frames (stage settling) · amber/rose = late frames (beam-induced) · rose bar = outlier at mean + 2σ
        </p>
      </div>

      {tableOpen ? (
        <div className="border-t px-4 py-3" data-motion-table="">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-2 font-medium">Micrograph</th>
                <th className="py-1 pr-2 text-right font-medium">Total (Å)</th>
                <th className="py-1 pr-2 text-right font-medium">Early (Å)</th>
                <th className="py-1 text-right font-medium">Late (Å)</th>
              </tr>
            </thead>
            <tbody>
              {(data.micrographs ?? [])
                .slice()
                .sort((a, b) => b.total - a.total)
                .map((m) => (
                  <tr key={m.relPath || m.name} className="border-t border-border/60">
                    <td className={cn("py-1 pr-2 font-mono", stats && driftTone(m.total, stats.mean, stats.sd))}>{m.name}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{m.total.toFixed(1)}</td>
                    <td className="py-1 pr-2 text-right tabular-nums">{m.early.toFixed(1)}</td>
                    <td className="py-1 text-right tabular-nums">{m.late.toFixed(1)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

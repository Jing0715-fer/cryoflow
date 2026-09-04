"use client";

/**
 * CryoFlow — per-iteration resolution evolution chart (CryoSPARC-style
 * "iteration plot" for refining jobs).
 *
 * Data: /api/jobs/[id]/resolution scans run_itXXX_(half1_)?model.star for
 * _rlnCurrentResolution. The Y axis is INVERTED (best resolution on top) so
 * the curve climbing = refinement improving — the intuitive direction.
 */

import { useEffect, useMemo, useState } from "react";
import { Crosshair, TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

const TEAL = "#14b8a6";

interface ResolutionPoint {
  iteration: number;
  resolution: number;
}

interface ResolutionResponse {
  points: ResolutionPoint[];
  current: number | null;
  best: number | null;
}

export function ResolutionChart({
  jobId,
  running,
  className,
}: {
  jobId: string;
  /** live jobs poll every 30 s so the curve extends itself. */
  running?: boolean;
  className?: string;
}) {
  const [data, setData] = useState<ResolutionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}/resolution`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as ResolutionResponse;
        if (!cancelled) {
          setData(body);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "failed");
      }
    };
    void load();
    if (!running) return () => { cancelled = true; };
    const t = setInterval(() => void load(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [jobId, running]);

  const { points, yDomain } = useMemo(() => {
    const pts = data?.points ?? [];
    if (pts.length === 0) return { points: [], yDomain: null as [number, number] | null };
    const values = pts.map((p) => p.resolution);
    let max = Math.max(...values);
    let min = Math.min(...values);
    // pad so a single point / flat curve still renders nicely
    if (max - min < 1) {
      max += 0.5;
      min = Math.max(0.5, min - 0.5);
    } else {
      max += (max - min) * 0.08;
      min = Math.max(0, min - (max - min) * 0.08);
    }
    return { points: pts, yDomain: [max, min] as [number, number] }; // reversed axis
  }, [data]);

  if (error && !data) return null; // silent — the chart is an enhancement
  if (points.length < 1) return null;

  const current = data?.current ?? null;
  const best = data?.best ?? null;
  const lastIter = points[points.length - 1].iteration;

  return (
    <section
      aria-label="Resolution evolution"
      className={cn(
        "rounded-lg border border-teal-600/25 bg-gradient-to-b from-teal-600/5 to-transparent p-3",
        className
      )}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <TrendingUp className="h-3.5 w-3.5 text-teal-600" aria-hidden="true" />
          Resolution evolution
          <span className="font-normal text-muted-foreground/70">({points.length} iterations)</span>
        </span>
        {current != null && (
          <span className="inline-flex items-center gap-1 rounded-full border border-teal-600/30 bg-teal-600/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-teal-700 dark:text-teal-300">
            <Crosshair className="h-3 w-3" aria-hidden="true" />
            now {current.toFixed(2)} Å
          </span>
        )}
        {best != null && Math.abs(best - (current ?? best)) > 0.005 && (
          <span className="rounded-full border border-emerald-600/30 bg-emerald-600/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
            best {best.toFixed(2)} Å
          </span>
        )}
        {running && (
          <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-teal-600 dark:text-teal-400">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-teal-500" />
            </span>
            live
          </span>
        )}
      </div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 6, right: 12, bottom: 2, left: -14 }}>
            <defs>
              <linearGradient id="resFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={TEAL} stopOpacity={0.28} />
                <stop offset="100%" stopColor={TEAL} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" opacity={0.5} />
            <XAxis
              dataKey="iteration"
              type="number"
              domain={["dataMin", "dataMax"]}
              allowDecimals={false}
              tick={{ fontSize: 10 }}
              stroke="currentColor"
              className="text-muted-foreground"
              height={20}
              label={{
                value: "iteration",
                position: "insideBottomRight",
                offset: -2,
                fontSize: 10,
                fill: "currentColor",
              }}
            />
            <YAxis
              domain={yDomain ?? undefined}
              tick={{ fontSize: 10 }}
              stroke="currentColor"
              className="text-muted-foreground"
              tickFormatter={(v: number) => v.toFixed(1)}
              width={46}
              label={{
                value: "Å (better ↑)",
                angle: -90,
                position: "insideLeft",
                offset: 22,
                fontSize: 10,
                fill: "currentColor",
              }}
            />
            <Tooltip
              formatter={(value: number | string) => [`${Number(value).toFixed(2)} Å`, "resolution"]}
              labelFormatter={(label: number | string) =>
                `iteration ${Number(label)}${Number(label) === lastIter ? " (latest)" : ""}`
              }
              contentStyle={{ fontSize: 11, borderRadius: 6, padding: "4px 8px" }}
            />
            {best != null && best < (yDomain?.[0] ?? Infinity) && (
              <ReferenceLine
                y={best}
                stroke="#10b981"
                strokeDasharray="5 4"
                opacity={0.6}
                label={{ value: `best ${best.toFixed(2)} Å`, fill: "#10b981", fontSize: 10, position: "insideTopRight" }}
              />
            )}
            <Area
              type="monotone"
              dataKey="resolution"
              stroke={TEAL}
              strokeWidth={2}
              fill="url(#resFill)"
              dot={{ r: 1.5, fill: TEAL, strokeWidth: 0 }}
              activeDot={{ r: 4, fill: TEAL }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

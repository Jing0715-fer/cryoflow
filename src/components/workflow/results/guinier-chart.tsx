"use client";

/**
 * CryoFlow — Guinier plot for PostProcess jobs.
 *
 * ln|F| versus 1/d²: the straight-line falloff validates the applied
 * B-factor; curvature at low resolution flags mask artefacts. RELION
 * writes the table as postprocess.guinier; the B-factor itself comes
 * from the job log ("Applied B-factor of …").
 *
 * Data: /api/jobs/[id]/guinier. Self-hides until postprocess has run
 * (empty response → null render, so the panel appears exactly when the
 * pipeline reaches its final step).
 */

import { useEffect, useMemo, useState } from "react";
import { TrendingDown } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

const TEAL = "#14b8a6";
const AMBER = "#f59e0b";

interface GuinierPoint {
  x: number;
  lnAmp: number | null;
  lnAmpSharpened: number | null;
}

interface GuinierResponse {
  jobId: string;
  sourceFile: string | null;
  points: GuinierPoint[];
  bfactor: number | null;
}

export function GuinierChart({
  jobId,
  running,
  className,
}: {
  jobId: string;
  running?: boolean;
  className?: string;
}) {
  const [data, setData] = useState<GuinierResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}/guinier`, { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as GuinierResponse;
        if (!cancelled) setData(body);
      } catch {
        /* silent — enhancement only */
      }
    };
    void load();
    if (!running) return () => {
      cancelled = true;
    };
    const t = setInterval(() => void load(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [jobId, running]);

  const points = useMemo(
    () =>
      (data?.points ?? [])
        .map((p) => ({
          ...p,
          lnAmp: p.lnAmp != null && Number.isFinite(p.lnAmp) ? p.lnAmp : null,
          lnAmpSharpened:
            p.lnAmpSharpened != null && Number.isFinite(p.lnAmpSharpened)
              ? p.lnAmpSharpened
              : null,
        }))
        .filter((p) => Number.isFinite(p.x) && p.x > 0 && p.lnAmp != null),
    [data]
  );

  if (!data || points.length < 4) return null; // silent until postprocess runs

  const hasSharpened = points.some((p) => p.lnAmpSharpened != null);
  const bf = data.bfactor;

  return (
    <section
      aria-label="Guinier plot"
      className={cn(
        "rounded-lg border border-amber-500/25 bg-gradient-to-b from-amber-500/5 to-transparent p-3",
        className
      )}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <TrendingDown className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
          Guinier plot
          <span className="font-normal text-muted-foreground/70">
            ({points.length} shells)
          </span>
        </span>
        {bf != null ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-600/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-amber-700 dark:text-amber-300">
            B-factor {bf.toFixed(1)} Å²
          </span>
        ) : null}
        {running ? (
          <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-teal-600 dark:text-teal-400">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-teal-500" />
            </span>
            live
          </span>
        ) : null}
      </div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 6, right: 14, bottom: 2, left: -14 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" opacity={0.5} />
            <XAxis
              dataKey="x"
              type="number"
              domain={["dataMin", "dataMax"]}
              tick={{ fontSize: 10 }}
              tickFormatter={(v: number) => v.toFixed(3)}
              stroke="currentColor"
              className="text-muted-foreground"
              height={20}
              label={{
                value: "1/d² (Å⁻²) → higher res",
                position: "insideBottomRight",
                offset: -2,
                fontSize: 10,
                fill: "currentColor",
              }}
            />
            <YAxis
              tick={{ fontSize: 10 }}
              stroke="currentColor"
              className="text-muted-foreground"
              tickFormatter={(v: number) => v.toFixed(1)}
              width={46}
              label={{
                value: "ln|F|",
                angle: -90,
                position: "insideLeft",
                offset: 22,
                fontSize: 10,
                fill: "currentColor",
              }}
            />
            <Tooltip
              formatter={(value: number | string, name: string) => {
                const label = name === "lnAmp" ? "masked ln|F|" : "sharpened ln|F|";
                return [Number(value).toFixed(3), label];
              }}
              labelFormatter={(label: number | string) => {
                const x = Number(label);
                const d = x > 0 ? Math.sqrt(1 / x) : 0;
                return `${x.toFixed(4)} Å⁻²${d > 0 ? ` (≈ ${d.toFixed(1)} Å)` : ""}`;
              }}
              contentStyle={{ fontSize: 11, borderRadius: 6, padding: "4px 8px" }}
            />
            <Line
              type="monotone"
              dataKey="lnAmp"
              stroke={TEAL}
              strokeWidth={1.8}
              dot={false}
              isAnimationActive={false}
              name="lnAmp"
            />
            {hasSharpened ? (
              <Line
                type="monotone"
                dataKey="lnAmpSharpened"
                stroke={AMBER}
                strokeWidth={1.8}
                strokeDasharray="4 3"
                dot={false}
                isAnimationActive={false}
                name="lnAmpSharpened"
              />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground">
        straight falloff validates the B-factor · teal = masked amplitudes
        {hasSharpened ? " · amber dashed = after sharpening" : ""}
      </p>
    </section>
  );
}

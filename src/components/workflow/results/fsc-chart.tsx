"use client";

/**
 * CryoFlow — FSC (Fourier Shell Correlation) curve chart.
 *
 * Data comes from /api/jobs/[id]/outputs/star parsing of postprocess.star
 * (data_fsc loop: resolution in Å + corrected FSC). Renders a recharts
 * LineChart with the 0.143 threshold reference and resolution badges.
 */

import { useMemo } from "react";
import {
  BadgeCheck,
  Gauge,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fscResolutionAtThreshold, type FscData } from "@/lib/starfile";
import { cn } from "@/lib/utils";

const TEAL = "#14b8a6";
const AMBER = "#d97706";

/** Points above this Å value (first shells / 999 Å placeholder) distort the axis. */
const MAX_DISPLAY_ANGSTROM = 30;

interface FscChartProps {
  fsc: { resolution: number[]; correlation: number[] };
  /** RELION's own reported value (_rlnFinalResolution), when available. */
  finalResolution?: number | null;
  className?: string;
}

export function FscChart({ fsc, finalResolution, className }: FscChartProps) {
  const { points, crossing } = useMemo(() => {
    const pts: { res: number; corr: number }[] = [];
    for (let i = 0; i < fsc.resolution.length; i++) {
      const res = fsc.resolution[i];
      const corr = fsc.correlation[i];
      if (Number.isFinite(res) && Number.isFinite(corr) && res <= MAX_DISPLAY_ANGSTROM) {
        pts.push({ res, corr });
      }
    }
    pts.sort((a, b) => a.res - b.res);
    const crossing = fscResolutionAtThreshold(
      { resolution: fsc.resolution, correlation: fsc.correlation, correlationColumn: "" },
      0.143
    );
    return { points: pts, crossing };
  }, [fsc]);

  if (points.length < 2) return null;

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Gauge className="h-3.5 w-3.5 text-teal-600" aria-hidden="true" />
          Fourier Shell Correlation
        </span>
        {crossing !== null && (
          <span className="inline-flex items-center gap-1 rounded-full border border-teal-600/30 bg-teal-600/10 px-2 py-0.5 text-[11px] font-semibold text-teal-700 dark:text-teal-300">
            <BadgeCheck className="h-3 w-3" aria-hidden="true" />
            ≈ {crossing.toFixed(2)} Å @ FSC 0.143
          </span>
        )}
        {typeof finalResolution === "number" && Number.isFinite(finalResolution) && (
          <span className="rounded-full border border-violet-600/30 bg-violet-600/10 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:text-violet-300">
            RELION: {finalResolution.toFixed(2)} Å
          </span>
        )}
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 4, right: 10, bottom: 2, left: -18 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" opacity={0.5} />
            <XAxis
              dataKey="res"
              type="number"
              domain={["dataMin", "dataMax"]}
              tick={{ fontSize: 10 }}
              stroke="currentColor"
              className="text-muted-foreground"
              tickFormatter={(v: number) => v.toFixed(0)}
              label={{ value: "Resolution (Å)", position: "insideBottomRight", offset: -2, fontSize: 10, fill: "currentColor" }}
              height={22}
            />
            <YAxis
              domain={[-0.25, 1]}
              tick={{ fontSize: 10 }}
              stroke="currentColor"
              className="text-muted-foreground"
              tickFormatter={(v: number) => v.toFixed(2)}
              width={44}
            />
            <Tooltip
              formatter={(value: number | string) => [Number(value).toFixed(3), "FSC"]}
              labelFormatter={(label: number | string) => `${Number(label).toFixed(2)} Å`}
              contentStyle={{ fontSize: 11, borderRadius: 6, padding: "4px 8px" }}
            />
            <ReferenceLine
              y={0.143}
              stroke={AMBER}
              strokeDasharray="5 4"
              label={{ value: "FSC 0.143", fill: AMBER, fontSize: 10, position: "insideTopRight" }}
            />
            <ReferenceLine y={0} stroke="currentColor" className="text-border" opacity={0.4} />
            <Line
              type="monotone"
              dataKey="corr"
              stroke={TEAL}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: TEAL }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

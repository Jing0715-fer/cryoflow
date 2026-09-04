"use client";

/**
 * CryoFlow — Fourier-shell correlation (FSC) curve chart.
 *
 * The "final report card" of a cryo-EM reconstruction: correlation between
 * the two independently-refined half maps as a function of spatial
 * frequency. The 0.143 crossing gives the gold-standard resolution.
 *
 * Data: /api/jobs/[id]/fsc
 *  - model source  : gold-standard unmasked half-map FSC (teal, live while refining)
 *  - postprocess   : masked+corrected FSC (amber), phase-randomized noise (dashed)
 *
 * X axis: resolution in Å, REVERSED so the high-resolution end (right) is
 * "further along" — the conventional cryo-EM orientation.
 */

import { useEffect, useMemo, useState } from "react";
import { Crosshair, Waves } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

const TEAL = "#14b8a6";
const AMBER = "#f59e0b";
const NOISE = "#71717a";

interface FscShell {
  freq: number;
  res: number;
  fsc: number;
  correctedFsc?: number;
  phaseRandomizedFsc?: number;
}

interface FscResponse {
  source: "postprocess" | "model" | null;
  sourceFile: string | null;
  shells: FscShell[];
  resolutionAt143: number | null;
  resolutionAt05: number | null;
}

export function FscChart({
  jobId,
  running,
  className,
}: {
  jobId: string;
  /** live jobs poll every 30 s so the curve tracks the refinement. */
  running?: boolean;
  className?: string;
}) {
  const [data, setData] = useState<FscResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}/fsc`, { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as FscResponse;
        if (!cancelled) setData(body);
      } catch {
        /* silent — enhancement only */
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

  // clip 999-sentinel / non-finite rows, keep resolution ascending;
  // jobs whose FSC column is all zeros (e.g. VDAM initialmodel) stay hidden
  const shells = useMemo(
    () =>
      (data?.shells ?? [])
        .filter((s) => Number.isFinite(s.fsc) && Number.isFinite(s.res) && s.res < 900 && s.res > 0)
        .sort((a, b) => a.res - b.res), // low-res (large Å) → high-res (right)
    [data]
  );

  if (!data || shells.length < 4) return null; // silent for 2D / not-yet-3D jobs
  if (shells.filter((s) => s.fsc > 0.05).length < 4) return null;

  const isPost = data.source === "postprocess";
  const res143 = data.resolutionAt143;
  const res05 = data.resolutionAt05;

  return (
    <section
      aria-label="Fourier-shell correlation"
      className={cn(
        "rounded-lg border border-teal-600/25 bg-gradient-to-b from-teal-600/5 to-transparent p-3",
        className
      )}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <Waves className="h-3.5 w-3.5 text-teal-600" aria-hidden="true" />
          FSC curve
          <span className="font-normal text-muted-foreground/70">
            ({shells.length} shells{isPost ? ", postprocess" : ", half-maps"})
          </span>
        </span>
        {res143 != null && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-600/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-amber-700 dark:text-amber-300">
            <Crosshair className="h-3 w-3" aria-hidden="true" />
            0.143 → {res143.toFixed(2)} Å
          </span>
        )}
        {res05 != null && (
          <span className="rounded-full border border-muted-foreground/25 bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
            0.5 → {res05.toFixed(2)} Å
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
          <LineChart data={shells} margin={{ top: 6, right: 14, bottom: 2, left: -14 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" opacity={0.5} />
            <XAxis
              dataKey="res"
              type="number"
              domain={["dataMin", "dataMax"]}
              reversed
              scale="log"
              allowDataOverflow
              tick={{ fontSize: 10 }}
              tickFormatter={(v: number) => v.toFixed(0)}
              stroke="currentColor"
              className="text-muted-foreground"
              height={20}
              label={{
                value: "resolution (Å) → higher res",
                position: "insideBottomRight",
                offset: -2,
                fontSize: 10,
                fill: "currentColor",
              }}
            />
            <YAxis
              domain={[-0.1, 1]}
              tick={{ fontSize: 10 }}
              stroke="currentColor"
              className="text-muted-foreground"
              tickFormatter={(v: number) => v.toFixed(1)}
              width={46}
              label={{
                value: "FSC",
                angle: -90,
                position: "insideLeft",
                offset: 22,
                fontSize: 10,
                fill: "currentColor",
              }}
            />
            <Tooltip
              formatter={(value: number | string, name: string) => {
                const label =
                  name === "fsc" ? "half-map FSC" :
                  name === "correctedFsc" ? "masked FSC" : "phase-rand noise";
                return [Number(value).toFixed(3), label];
              }}
              labelFormatter={(label: number | string) =>
                `${Number(label).toFixed(2)} Å (1/${(1 / Math.max(Number(label), 1e-6)).toFixed(3)} Å⁻¹)`
              }
              contentStyle={{ fontSize: 11, borderRadius: 6, padding: "4px 8px" }}
            />
            {/* gold-standard 0.143 criterion */}
            <ReferenceLine
              y={0.143}
              stroke={AMBER}
              strokeDasharray="5 4"
              opacity={0.75}
              label={{
                value: "0.143",
                fill: AMBER,
                fontSize: 10,
                position: "insideTopLeft",
              }}
            />
            {/* half-bit 0.5 criterion */}
            <ReferenceLine
              y={0.5}
              stroke={NOISE}
              strokeDasharray="2 4"
              opacity={0.45}
              label={{ value: "0.5", fill: NOISE, fontSize: 10, position: "insideTopLeft" }}
            />
            {/* resolution crossing marker on the main curve */}
            {res143 != null && (
              <ReferenceDot
                x={res143}
                y={0.143}
                r={4}
                fill={AMBER}
                stroke="white"
                strokeWidth={1.5}
                isFront
              />
            )}
            <Line
              type="monotone"
              dataKey="fsc"
              stroke={TEAL}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: TEAL }}
              isAnimationActive={false}
            />
            {isPost && (
              <Line
                type="monotone"
                dataKey="correctedFsc"
                stroke={AMBER}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: AMBER }}
                connectNulls
                isAnimationActive={false}
              />
            )}
            {isPost && (
              <Line
                type="monotone"
                dataKey="phaseRandomizedFsc"
                stroke={NOISE}
                strokeWidth={1.25}
                strokeDasharray="4 3"
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* legend */}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-0.5 w-4 rounded bg-teal-500" />
          {isPost ? "unmasked FSC" : "gold-standard FSC"}
        </span>
        {isPost && (
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 rounded bg-amber-500" />
            masked + corrected
          </span>
        )}
        {isPost && (
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-0.5 w-4 rounded bg-zinc-400" style={{ backgroundImage: "linear-gradient(90deg, currentColor 55%, transparent 45%)", backgroundSize: "6px 100%" }} />
            phase-randomized
          </span>
        )}
        <span className="ml-auto font-mono text-[10px] text-muted-foreground/70">
          {data.sourceFile}
        </span>
      </div>
    </section>
  );
}

"use client";

/**
 * CryoFlow — Topaz training-progress chart (topaztrain inspector).
 *
 * Data: /api/jobs/[id]/topaz-training parses the run's run.out (RELION
 * pipes topaz's per-epoch console output there) plus any training log in
 * the workdir. Train loss = teal solid, test loss = amber dashed.
 * Self-hides when the log has no recognizable progress (pre-run, or a
 * topaz version whose output shape the parser cannot read).
 */

import { useEffect, useMemo, useState } from "react";
import { GraduationCap, TrendingDown } from "lucide-react";
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
import { fetchJsonRetry } from "@/lib/retry-fetch";

const TEAL = "#14b8a6";
const AMBER = "#f59e0b";

interface TopazEpochDTO {
  it: number;
  trainLoss: number | null;
  testLoss: number | null;
  precision: number | null;
  recall: number | null;
  testPrecision: number | null;
  testRecall: number | null;
}

interface TopazTrainingResponse {
  epochs: TopazEpochDTO[];
  source: string | null;
}

export function TopazTrainingChart({
  jobId,
  running,
  className,
}: {
  jobId: string;
  /** live jobs poll every 20 s so the curve extends itself. */
  running?: boolean;
  className?: string;
}) {
  const [data, setData] = useState<TopazTrainingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const body = await fetchJsonRetry<TopazTrainingResponse>(
          `/api/jobs/${jobId}/topaz-training`
        );
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
    const t = setInterval(() => void load(), 20_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [jobId, running]);

  // chart rows carry both curves; recharts skips nulls with connectNulls
  const rows = useMemo(
    () =>
      (data?.epochs ?? [])
        .filter((e) => e.trainLoss != null || e.testLoss != null)
        .map((e) => ({
          it: e.it,
          trainLoss: e.trainLoss,
          testLoss: e.testLoss,
        })),
    [data]
  );

  const bestTest = useMemo(() => {
    const vals = (data?.epochs ?? [])
      .map((e) => e.testLoss)
      .filter((v): v is number => v != null);
    return vals.length ? Math.min(...vals) : null;
  }, [data]);

  if (error && !data) return null; // silent — the chart is an enhancement
  if (rows.length < 2) return null; // a single epoch is not a curve

  const last = rows[rows.length - 1];
  const finalLoss = last.testLoss ?? last.trainLoss;
  const first = rows[0];
  const firstLoss = first.trainLoss ?? first.testLoss;

  return (
    <section
      aria-label="Topaz training progress"
      className={cn(
        "animate-rise rounded-lg border border-fuchsia-600/25 bg-gradient-to-b from-fuchsia-600/5 to-transparent p-3",
        className
      )}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <GraduationCap className="h-3.5 w-3.5 text-fuchsia-600" aria-hidden="true" />
          Topaz training progress
          <span className="font-normal text-muted-foreground/70">({rows.length} epochs)</span>
        </span>
        {finalLoss != null && (
          <span className="inline-flex items-center gap-1 rounded-full border border-fuchsia-600/30 bg-fuchsia-600/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-fuchsia-700 dark:text-fuchsia-300">
            <TrendingDown className="h-3 w-3" aria-hidden="true" />
            final loss {finalLoss.toFixed(3)}
          </span>
        )}
        {firstLoss != null && finalLoss != null && firstLoss > 0 && (
          <span className="rounded-full border border-emerald-600/30 bg-emerald-600/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
            ↓{Math.max(0, (1 - finalLoss / firstLoss) * 100).toFixed(0)}%
          </span>
        )}
        {bestTest != null && (
          <span className="rounded-full border border-amber-600/30 bg-amber-600/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-amber-700 dark:text-amber-300">
            best test {bestTest.toFixed(3)}
          </span>
        )}
        {data?.source && (
          <span
            className="ml-auto max-w-40 truncate font-mono text-[10px] text-muted-foreground/70"
            title={`parsed from ${data.source}`}
          >
            {data.source}
          </span>
        )}
        {running && (
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-fuchsia-600 dark:text-fuchsia-400">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-fuchsia-400 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-fuchsia-500" />
            </span>
            live
          </span>
        )}
      </div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 6, right: 12, bottom: 2, left: -14 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" opacity={0.5} />
            <XAxis
              dataKey="it"
              type="number"
              domain={["dataMin", "dataMax"]}
              allowDecimals={false}
              tick={{ fontSize: 10 }}
              stroke="currentColor"
              className="text-muted-foreground"
              height={20}
              label={{
                value: "epoch",
                position: "insideBottomRight",
                offset: -2,
                fontSize: 10,
                fill: "currentColor",
              }}
            />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fontSize: 10 }}
              stroke="currentColor"
              className="text-muted-foreground"
              tickFormatter={(v: number) => v.toFixed(2)}
              width={46}
              label={{
                value: "loss",
                angle: -90,
                position: "insideLeft",
                offset: 18,
                fontSize: 10,
                fill: "currentColor",
              }}
            />
            <Tooltip
              formatter={(value: number | string, name: string) => [
                Number(value).toFixed(4),
                name === "trainLoss" ? "train loss" : "test loss",
              ]}
              labelFormatter={(label: number | string) =>
                `epoch ${Number(label)}${Number(label) === last.it ? " (latest)" : ""}`
              }
              contentStyle={{ fontSize: 11, borderRadius: 6, padding: "4px 8px" }}
            />
            <Line
              type="monotone"
              dataKey="trainLoss"
              stroke={TEAL}
              strokeWidth={2}
              dot={{ r: 1.5, fill: TEAL, strokeWidth: 0 }}
              activeDot={{ r: 4, fill: TEAL }}
              connectNulls
              isAnimationActive={false}
              name="trainLoss"
            />
            <Line
              type="monotone"
              dataKey="testLoss"
              stroke={AMBER}
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={{ r: 1.5, fill: AMBER, strokeWidth: 0 }}
              activeDot={{ r: 4, fill: AMBER }}
              connectNulls
              isAnimationActive={false}
              name="testLoss"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
        train = topaz&apos;s objective on the work set · test = held-out{" "}
        {(data?.epochs?.[0]?.testPrecision != null ||
          (data?.epochs?.[0]?.testLoss != null) ||
          data?.epochs?.[0]?.it === 0)
          ? "cross-validation picks"
          : "picks"}
        {" "}— a falling test curve that later climbs means the model is overfitting the training picks.
      </p>
    </section>
  );
}

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
import {
  topazRenderable,
  topazRows,
  topazSeries,
  type TopazTrainingResponse,
} from "@/lib/chart-rows";
import { ChartExportButtons } from "./chart-export-buttons";

const TEAL = "#14b8a6";
const AMBER = "#f59e0b";
const EMERALD = "#10b981";
const ROSE = "#f43f5e";

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
  // two chart views: loss curves (default) and precision/recall on a 0–1
  // axis. The P/R switch only appears when the log actually carries
  // picking metrics — older topaz versions log loss only.
  const [mode, setMode] = useState<"loss" | "pr">("loss");

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

  // chart rows carry both curve families; recharts skips nulls with
  // connectNulls, so each view just reads its own keys
  // series derivation single-sourced in lib/chart-rows (t110: the palette
  // exports the same epochs through the same function)
  const rows = useMemo(() => topazSeries(data), [data]);

  /** epochs with at least one picking metric — gates the P/R toggle */
  const hasPR = useMemo(
    () =>
      (data?.epochs ?? []).some(
        (e) =>
          e.precision != null || e.recall != null ||
          e.testPrecision != null || e.testRecall != null
      ),
    [data]
  );

  const bestTest = useMemo(() => {
    const vals = (data?.epochs ?? [])
      .map((e) => e.testLoss)
      .filter((v): v is number => v != null);
    return vals.length ? Math.min(...vals) : null;
  }, [data]);

  if (error && !data) return null; // silent — the chart is an enhancement
  // gate single-sourced in lib/chart-rows (a single epoch is not a curve)
  if (!topazRenderable(rows)) return null;

  const last = rows[rows.length - 1];
  const first = rows[0];
  const finalLoss = last.testLoss ?? last.trainLoss;
  const firstLoss = first.trainLoss ?? first.testLoss;
  // latest picking metrics — surfaced as badges only in P/R view
  const finalPR: [number | null, number | null] =
    mode === "pr" ? [last.precision ?? last.testPrecision, last.recall ?? last.testRecall] : [null, null];

  return (
    <section
      aria-label="Topaz training progress"
      data-chart-export-root
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
        {finalPR[0] != null && (
          <span className="rounded-full border border-emerald-600/30 bg-emerald-600/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
            P {(finalPR[0] * 100).toFixed(0)}%
          </span>
        )}
        {finalPR[1] != null && (
          <span className="rounded-full border border-rose-600/30 bg-rose-600/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-rose-700 dark:text-rose-300">
            R {(finalPR[1] * 100).toFixed(0)}%
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
        <ChartExportButtons
          name="Topaz training"
          getRows={() => topazRows(data)}
          className="ml-auto"
        />
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
            {mode === "loss" ? (
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
            ) : (
              <YAxis
                domain={[0, 1]}
                tick={{ fontSize: 10 }}
                stroke="currentColor"
                className="text-muted-foreground"
                tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                width={46}
                label={{
                  value: "P / R",
                  angle: -90,
                  position: "insideLeft",
                  offset: 14,
                  fontSize: 10,
                  fill: "currentColor",
                }}
              />
            )}
            <Tooltip
              formatter={(value: number | string, name: string) => {
                const labels: Record<string, string> = {
                  trainLoss: "train loss",
                  testLoss: "test loss",
                  precision: "precision",
                  recall: "recall",
                  testPrecision: "test precision",
                  testRecall: "test recall",
                };
                const v = Number(value);
                // P/R read as percentages, loss at full precision
                return [name.endsWith("Loss") ? v.toFixed(4) : `${(v * 100).toFixed(1)}%`, labels[name] ?? name];
              }}
              labelFormatter={(label: number | string) =>
                `epoch ${Number(label)}${Number(label) === last.it ? " (latest)" : ""}`
              }
              contentStyle={{ fontSize: 11, borderRadius: 6, padding: "4px 8px" }}
            />
            {/* all six curves stay mounted; `hide` swaps the view — recharts
                walks direct children, so a fragment-wrapped conditional
                branch would silently drop the Lines (recharts 2.15 + React 19) */}
            <Line
              type="monotone"
              dataKey="trainLoss"
              hide={mode !== "loss"}
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
              hide={mode !== "loss"}
              stroke={AMBER}
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={{ r: 1.5, fill: AMBER, strokeWidth: 0 }}
              activeDot={{ r: 4, fill: AMBER }}
              connectNulls
              isAnimationActive={false}
              name="testLoss"
            />
            <Line
              type="monotone"
              dataKey="precision"
              hide={mode !== "pr"}
              stroke={EMERALD}
              strokeWidth={2}
              dot={{ r: 1.5, fill: EMERALD, strokeWidth: 0 }}
              activeDot={{ r: 4, fill: EMERALD }}
              connectNulls
              isAnimationActive={false}
              name="precision"
            />
            <Line
              type="monotone"
              dataKey="recall"
              hide={mode !== "pr"}
              stroke={ROSE}
              strokeWidth={2}
              dot={{ r: 1.5, fill: ROSE, strokeWidth: 0 }}
              activeDot={{ r: 4, fill: ROSE }}
              connectNulls
              isAnimationActive={false}
              name="recall"
            />
            <Line
              type="monotone"
              dataKey="testPrecision"
              hide={mode !== "pr"}
              stroke={EMERALD}
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
              activeDot={{ r: 4, fill: EMERALD }}
              connectNulls
              isAnimationActive={false}
              name="testPrecision"
            />
            <Line
              type="monotone"
              dataKey="testRecall"
              hide={mode !== "pr"}
              stroke={ROSE}
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
              activeDot={{ r: 4, fill: ROSE }}
              connectNulls
              isAnimationActive={false}
              name="testRecall"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* view switch — only when the log carries picking metrics */}
      {hasPR && (
        <div className="mt-1.5 flex items-center gap-2">
          <div
            role="group"
            aria-label="Chart metric view"
            className="inline-flex overflow-hidden rounded-full border border-fuchsia-600/30"
          >
            {([
              ["loss", "loss"],
              ["pr", "precision / recall"],
            ] as const).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={
                  "px-2.5 py-0.5 text-[10px] font-semibold transition-colors " +
                  (mode === m
                    ? "bg-fuchsia-600 text-white"
                    : "bg-transparent text-muted-foreground hover:bg-fuchsia-600/10 hover:text-fuchsia-700 dark:hover:text-fuchsia-300")
                }
              >
                {label}
              </button>
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground/70">
            {mode === "pr" && "solid = work set · dashed = held-out test picks"}
          </span>
        </div>
      )}
      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
        {mode === "loss" ? (
          <>
            train = topaz&apos;s objective on the work set · test = held-out{" "}
            {(data?.epochs?.[0]?.testPrecision != null ||
              (data?.epochs?.[0]?.testLoss != null) ||
              data?.epochs?.[0]?.it === 0)
              ? "cross-validation picks"
              : "picks"}
            {" "}— a falling test curve that later climbs means the model is overfitting the training picks.
          </>
        ) : (
          <>
            precision = fraction of picked particles that are real · recall = fraction of true
            particles found — climbing curves mean the model is learning to pick; the dashed
            test curves are the honest estimate on held-out picks.
          </>
        )}
      </p>
    </section>
  );
}

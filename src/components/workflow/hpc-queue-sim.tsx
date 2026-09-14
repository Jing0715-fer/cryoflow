"use client";

/**
 * CryoFlow — HPC queue simulation panel (the /api/hpc/simulate UI consumer).
 *
 * The simulate route replays the ACTIVE project's real job graph through a
 * Slurm-shaped scheduler (priority-FIFO + afterok dependency edges + GPU
 * pool first-fit + array shards) using REAL measured sandbox durations
 * scaled by the profile's GPU speedup. This panel is its face: a compact
 * run form (cluster shape + GPU speedup), a KPI band (makespan, GPU
 * utilization, average wait, GPU-hours) and a Gantt of the schedule.
 *
 * Contract notes carried over from sibling panels:
 * - "Server view shown": numeric inputs are re-synced from the RESPONSE
 *   after every run (the server clamps to its contract ranges — what the
 *   UI displays is what the server kept, never what was sent). A subtle
 *   footnote flags when a clamp happened.
 * - "One job, one row": array shards land as multiple segments on the
 *   job's row (they share one slurmId family), so the Gantt reads like
 *   sacct --start output rather than a shard dump.
 * - Durations are project-wide and live: extracted micrograph/particle
 *   counts and measured run durations from engine-state feed the model.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { GanttChart, Loader2, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { jobType } from "@/lib/workflow";

interface SimBar {
  key: string; type: string; slurmId: string;
  start: number; end: number; gpus: number; nodes: string[];
}
interface SimEvent { t: number; key: string; slurmId: string; state: string; detail?: string }
interface SimResponse {
  project: { id: string; name: string; jobs: number; edges: number };
  cluster: { gpus: number; nodes: number; arrayConcurrency: number };
  speedup: number;
  data: { micrographs: number; particles: number };
  events: SimEvent[];
  bars: SimBar[];
  makespanMin: number;
  gpuUtilization: number;
  avgWaitMin: number;
  totalGpuHours: number;
  clusterGpus: number;
  note?: string;
  error?: string;
}
interface SimParams { clusterGpus: number; nodes: number; arrayConcurrency: number; gpuSpeedup: number }

/** Per-type bar triplets — same badge language as the sibling HPC panels. */
const TYPE_COLOR: Record<string, string> = {
  import: "bg-sky-500/25 border-sky-500/40 text-sky-700 dark:text-sky-300",
  motioncorr: "bg-cyan-500/25 border-cyan-500/40 text-cyan-700 dark:text-cyan-300",
  ctf: "bg-teal-500/25 border-teal-500/40 text-teal-700 dark:text-teal-300",
  extract: "bg-violet-500/25 border-violet-500/40 text-violet-700 dark:text-violet-300",
  select: "bg-amber-500/25 border-amber-500/40 text-amber-700 dark:text-amber-300",
  class2d: "bg-fuchsia-500/25 border-fuchsia-500/40 text-fuchsia-700 dark:text-fuchsia-300",
  class3d: "bg-indigo-500/25 border-indigo-500/40 text-indigo-700 dark:text-indigo-300",
  refine3d: "bg-rose-500/25 border-rose-500/40 text-rose-700 dark:text-rose-300",
  postprocess: "bg-emerald-500/25 border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
  maskcreate: "bg-green-500/25 border-green-500/40 text-green-700 dark:text-green-300",
};
const FALLBACK_COLOR = "bg-slate-500/25 border-slate-500/40 text-slate-700 dark:text-slate-300";

const fmtMin = (m: number): string => {
  if (!Number.isFinite(m) || m < 0) return "—";
  if (m >= 60) return `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, "0")}m`;
  return m >= 10 ? `${Math.round(m)}m` : `${(Math.round(m * 10) / 10).toFixed(1)}m`;
};

/** One compact labelled numeric input (server clamp ranges as min/max). */
function NumField(props: {
  label: string; value: number; min: number; max: number; title: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5" title={props.title}>
      <span className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
        {props.label}
      </span>
      <input
        type="number"
        className="h-7 w-[4.5rem] rounded-md border bg-background px-2 text-[11px] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={props.value}
        min={props.min}
        max={props.max}
        aria-label={props.label}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) props.onChange(Math.round(n));
        }}
      />
    </label>
  );
}

export function HpcQueueSim({ gpusPerNode }: { gpusPerNode?: number }) {
  const [open, setOpen] = React.useState(false);
  const [sim, setSim] = React.useState<SimResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [clamped, setClamped] = React.useState(false);
  const [params, setParams] = React.useState<SimParams>({
    clusterGpus: 8, nodes: 4, arrayConcurrency: 8, gpuSpeedup: 25,
  });
  // Prefill the GPU pool from the selected profile's node shape — but a
  // value the user typed is theirs; the prefill only speaks when untouched.
  const gpusTouched = React.useRef(false);

  React.useEffect(() => {
    if (gpusTouched.current || !gpusPerNode || gpusPerNode < 1) return;
    setParams((p) => ({ ...p, clusterGpus: Math.min(64, gpusPerNode) }));
  }, [gpusPerNode]);

  const run = async () => {
    setLoading(true);
    setError(null);
    setOpen(true);
    const sent: SimParams = { ...params };
    try {
      const r = await fetch("/api/hpc/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sent),
      });
      const d = (await r.json()) as SimResponse;
      if (!r.ok) {
        setError(d?.error ?? `HTTP ${r.status}`);
      } else {
        setSim(d);
        // Server view shown — the echo is the truth about the cluster shape.
        const echoed: SimParams = {
          clusterGpus: d.cluster?.gpus ?? sent.clusterGpus,
          nodes: d.cluster?.nodes ?? sent.nodes,
          arrayConcurrency: d.cluster?.arrayConcurrency ?? sent.arrayConcurrency,
          gpuSpeedup: d.speedup ?? sent.gpuSpeedup,
        };
        setClamped(
          echoed.clusterGpus !== sent.clusterGpus ||
          echoed.nodes !== sent.nodes ||
          echoed.arrayConcurrency !== sent.arrayConcurrency ||
          echoed.gpuSpeedup !== sent.gpuSpeedup,
        );
        setParams(echoed);
      }
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  };

  // One row per job (first-appearance order = scheduling order), array
  // shards grouped as segments on the shared row.
  const rows = React.useMemo(() => {
    if (!sim?.bars?.length) return [] as { key: string; type: string; segs: SimBar[] }[];
    const order: string[] = [];
    const byKey = new Map<string, SimBar[]>();
    for (const b of sim.bars) {
      let list = byKey.get(b.key);
      if (!list) { list = []; byKey.set(b.key, list); order.push(b.key); }
      list.push(b);
    }
    return order.map((key) => {
      const segs = (byKey.get(key) ?? []).slice().sort((a, b) => a.start - b.start);
      return { key, type: segs[0]?.type ?? "", segs };
    });
  }, [sim]);

  const pendingEpisodes = sim?.events?.filter((e) => e.state === "PENDING").length ?? 0;
  const makespan = sim?.makespanMin ?? 0;

  return (
    <section
      aria-label="Queue simulation"
      className="mt-1 space-y-3 border-t pt-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <GanttChart className="size-4 text-primary" aria-hidden="true" />
        <span className="text-xs font-medium">Queue simulation</span>
        <span className="text-[10.5px] text-muted-foreground">
          projects how the whole workflow schedules on this cluster class —
          real graph, real edges, real measured durations
        </span>
        <div className="flex-1" />
        <Button
          size="sm"
          variant="outline"
          onClick={() => void run()}
          disabled={loading}
          aria-label="Run queue simulation"
        >
          {loading
            ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            : <Play className="size-3.5" aria-hidden="true" />}
          {sim || loading ? "Re-run" : "Run"}
        </Button>
      </div>

      {open ? (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <NumField
              label="GPUs" value={params.clusterGpus} min={1} max={64}
              title="GPU pool size (1–64) — the scheduler first-fits bars onto this pool"
              onChange={(v) => { gpusTouched.current = true; setParams((p) => ({ ...p, clusterGpus: v })); }}
            />
            <NumField
              label="Nodes" value={params.nodes} min={1} max={16}
              title="Node count (1–16) — one bar lands per node regardless of its GPU share"
              onChange={(v) => setParams((p) => ({ ...p, nodes: v }))}
            />
            <NumField
              label="Array conc." value={params.arrayConcurrency} min={1} max={64}
              title="Array job concurrency (1–64) — how many shards of one array job may run at once"
              onChange={(v) => setParams((p) => ({ ...p, arrayConcurrency: v }))}
            />
            <NumField
              label="GPU speedup" value={params.gpuSpeedup} min={1} max={500}
              title="Cluster-class GPU speedup vs the sandbox (×1–×500) — scales measured GPU-job durations"
              onChange={(v) => setParams((p) => ({ ...p, gpuSpeedup: v }))}
            />
            {clamped ? (
              <span className="pb-1 text-[10px] italic text-amber-600 dark:text-amber-400" role="status">
                clamped to the server&apos;s contract ranges
              </span>
            ) : null}
          </div>

          {error ? (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/[0.06] p-3 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          ) : sim ? (
            <>
              <div className="grid grid-cols-4 gap-2" aria-label="Simulation KPIs">
                {[
                  { k: "Makespan", v: fmtMin(sim.makespanMin) },
                  { k: "GPU util", v: `${Math.round(sim.gpuUtilization * 100)}%` },
                  { k: "Avg wait", v: fmtMin(sim.avgWaitMin) },
                  {
                    k: "GPU hours",
                    v: `${sim.totalGpuHours >= 10 ? Math.round(sim.totalGpuHours) : (Math.round(sim.totalGpuHours * 10) / 10).toFixed(1)}h`,
                  },
                ].map((cell) => (
                  <div key={cell.k} className="rounded-md border bg-muted/30 px-2.5 py-1.5">
                    <div className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">{cell.k}</div>
                    <div className="text-sm font-semibold tabular-nums" aria-label={`${cell.k} ${cell.v}`}>{cell.v}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                <span>{sim.project.jobs} jobs · {sim.project.edges} deps</span>
                <span>{sim.data.micrographs} micrographs · {sim.data.particles.toLocaleString()} particles</span>
                {pendingEpisodes > 0 ? (
                  <span className="text-amber-600 dark:text-amber-400">
                    {pendingEpisodes} pending episode{pendingEpisodes === 1 ? "" : "s"} (Resources)
                  </span>
                ) : null}
              </div>

              {rows.length ? (
                <div
                  className="max-h-64 space-y-1 overflow-y-auto rounded-md border bg-muted/20 p-3"
                  aria-label="Simulated schedule (Gantt)"
                >
                  <div className="flex items-center gap-2" aria-hidden="true">
                    <div className="w-28 shrink-0" />
                    <div className="relative h-3.5 flex-1 text-[8.5px] tabular-nums text-muted-foreground">
                      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                        <span
                          key={f}
                          className={cn(
                            "absolute top-0",
                            f === 0 && "left-0",
                            f === 0.25 && "left-1/4 -translate-x-1/2",
                            f === 0.5 && "left-1/2 -translate-x-1/2",
                            f === 0.75 && "left-3/4 -translate-x-1/2",
                            f === 1 && "left-full -translate-x-full",
                          )}
                        >
                          {fmtMin(makespan * f)}
                        </span>
                      ))}
                    </div>
                  </div>
                  {rows.map((row) => {
                    const spec = jobType(row.type);
                    const label = spec?.label ?? row.type;
                    const color = TYPE_COLOR[row.type] ?? FALLBACK_COLOR;
                    return (
                      <div key={row.key} className="flex items-center gap-2">
                        <div
                          className="w-28 shrink-0 truncate text-[9.5px] text-muted-foreground"
                          title={`${label} (${row.segs[0]?.slurmId ?? ""})`}
                        >
                          {label}
                        </div>
                        <div className="relative h-[18px] flex-1 overflow-hidden rounded bg-background/60">
                          {[0.25, 0.5, 0.75].map((f) => (
                            <div
                              key={f}
                              className="absolute inset-y-0 w-px bg-foreground/[0.06]"
                              style={{ left: `${f * 100}%` }}
                              aria-hidden="true"
                            />
                          ))}
                          {row.segs.map((s) => {
                            const span = makespan > 0 ? ((s.end - s.start) / makespan) * 100 : 0;
                            return (
                              <div
                                key={s.slurmId + String(s.start)}
                                className={cn(
                                  "absolute inset-y-0.5 flex items-center overflow-hidden rounded-[3px] border px-1",
                                  color,
                                )}
                                style={{
                                  left: `${makespan > 0 ? (s.start / makespan) * 100 : 0}%`,
                                  width: `${Math.max(0.6, span)}%`,
                                }}
                                title={`${s.slurmId} · ${label} · ${s.gpus > 0 ? `${s.gpus}×GPU` : "CPU"} · ${fmtMin(s.end - s.start)} · ${s.nodes.join(", ")}`}
                              >
                                {s.gpus > 0 && span >= 8 ? (
                                  <span className="text-[8.5px] font-semibold tabular-nums">{s.gpus}G</span>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-md border bg-muted/30 p-3 text-[11px] text-muted-foreground">
                  Nothing to schedule — the active graph has no jobs.
                </div>
              )}

              {sim.note ? (
                <p className="line-clamp-2 text-[10px] leading-relaxed text-muted-foreground" title={sim.note}>
                  {sim.note}
                </p>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

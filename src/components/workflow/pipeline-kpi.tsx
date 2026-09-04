"use client";

/**
 * CryoFlow — pipeline KPI bar (floating, top-left of the workflow canvas).
 *
 * One glance project health: pipeline completion ring, particle count,
 * live reconstruction resolution, and the currently-running job. Data comes
 * from the store (jobs) + one lightweight resolution/FSC poll against the
 * active reconstruction job.
 */

import { useEffect, useMemo, useState } from "react";
import { Activity, Crosshair, Loader2, Medal, Snowflake, Trophy } from "lucide-react";
import { useWorkflowStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface ResResponse {
  current: number | null;
  best: number | null;
}
interface FscResponse {
  resolutionAt143: number | null;
}

/** EMPIAR-10017 / EMD-2824 published resolution — the target line. */
const TARGET_ANGSTROM = 4.2;

function KpiItem({
  children,
  title,
  className,
}: {
  children: React.ReactNode;
  title: string;
  className?: string;
}) {
  return (
    <span
      title={title}
      className={cn("flex items-center gap-1.5 whitespace-nowrap", className)}
    >
      {children}
    </span>
  );
}

/** tiny completion ring (SVG) — stroke-dashoffset driven progress arc */
function ProgressRing({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? done / total : 0;
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex size-6 shrink-0" title={`${done}/${total} jobs completed`}>
      <svg viewBox="0 0 24 24" className="size-6 -rotate-90">
        <circle cx="12" cy="12" r={r} fill="none" strokeWidth="3" className="stroke-muted" />
        <circle
          cx="12"
          cy="12"
          r={r}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          className="stroke-emerald-500 transition-[stroke-dashoffset] duration-500"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
    </span>
  );
}

export function PipelineKpi() {
  const jobs = useWorkflowStore((s) => s.jobs);

  const stats = useMemo(() => {
    const total = jobs.length;
    const completed = jobs.filter((j) => j.status === "completed").length;
    const failed = jobs.filter((j) => j.status === "failed").length;
    const runningJob = jobs.find((j) => j.status === "running") ?? null;

    // particle count from the select job's result text ("3500 of 5539 …")
    let particles: number | null = null;
    const selectJob = jobs.find((j) => /select/i.test(j.type) && j.status === "completed");
    if (selectJob) {
      const m = (selectJob.result ?? "").match(/(\d+)\s+of\s+(\d+)/);
      if (m) particles = Number(m[1]);
    }

    // active reconstruction: prefer postprocess (final FSC), then any running
    // refine, then the latest completed refine3d
    const refines = jobs.filter((j) => /refine3d|class3d|multibody/i.test(j.type));
    const post = jobs.find((j) => /postprocess/i.test(j.type) && j.status === "completed");
    const activeRefine =
      refines.find((j) => j.status === "running") ??
      [...refines].reverse().find((j) => j.status === "completed") ??
      null;

    return { total, completed, failed, runningJob, particles, post, activeRefine };
  }, [jobs]);

  // resolution source: postprocess FSC (0.143) > refine current resolution
  const resSource = stats.post ?? stats.activeRefine;
  const wantFsc = Boolean(stats.post);
  const [res, setRes] = useState<{ jobId: string; value: number } | null>(null);
  const isLive = Boolean(stats.runningJob) && !stats.post;

  useEffect(() => {
    if (!resSource) return;
    let cancelled = false;
    const load = async () => {
      try {
        if (wantFsc) {
          const r = await fetch(`/api/jobs/${resSource.id}/fsc`, { cache: "no-store" });
          if (!r.ok) return;
          const d = (await r.json()) as FscResponse;
          if (!cancelled && d.resolutionAt143 != null) {
            setRes({ jobId: resSource.id, value: d.resolutionAt143 });
          }
        } else {
          const r = await fetch(`/api/jobs/${resSource.id}/resolution`, { cache: "no-store" });
          if (!r.ok) return;
          const d = (await r.json()) as ResResponse;
          if (!cancelled && d.current != null) {
            setRes({ jobId: resSource.id, value: d.current });
          }
        }
      } catch {
        /* silent */
      }
    };
    void load();
    if (!isLive) return () => { cancelled = true; };
    const t = setInterval(() => void load(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [resSource?.id, wantFsc, isLive, resSource]);

  if (stats.total === 0) return null;
  // stale guard: only show the resolution of the CURRENT source job
  const resValue = res && resSource && res.jobId === resSource.id ? res.value : null;

  const fmtNum = (n: number) =>
    n >= 10000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString();

  return (
    <div
      data-canvas-ui="pipeline-kpi"
      aria-label="Pipeline overview"
      className="card-lift absolute left-3 top-3 z-20 flex max-w-[calc(100%-90px)] flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border bg-card/90 px-3 py-1.5 shadow-sm backdrop-blur-md"
    >
      {/* pipeline completion */}
      <KpiItem title="Pipeline completion" className="text-xs font-semibold tabular-nums">
        <ProgressRing done={stats.completed} total={stats.total} />
        <span className={stats.failed > 0 ? "text-foreground" : "text-foreground"}>
          {stats.completed}
          <span className="text-muted-foreground">/{stats.total}</span>
        </span>
      </KpiItem>

      <span className="h-4 w-px bg-border" aria-hidden="true" />

      {/* particle count */}
      {stats.particles != null && (
        <KpiItem title="Particles fed into 2D/3D classification" className="text-xs tabular-nums">
          <Snowflake className="size-3.5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" />
          <span className="font-medium">{fmtNum(stats.particles)}</span>
          <span className="hidden text-muted-foreground sm:inline">particles</span>
        </KpiItem>
      )}

      {/* live resolution */}
      {resValue != null && (
        <>
          <span className="h-4 w-px bg-border" aria-hidden="true" />
          <KpiItem
            title={wantFsc ? "Final FSC 0.143 resolution" : "Current reconstruction resolution"}
            className="rounded-full border border-amber-600/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-amber-700 dark:text-amber-300"
          >
            <Crosshair className="size-3 shrink-0" aria-hidden="true" />
            {resValue.toFixed(2)} Å
            {isLive && (
              <span className="relative ml-0.5 flex size-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-amber-500" />
              </span>
            )}
          </KpiItem>
          {/* target verdict — shown once the final FSC resolution is known */}
          {wantFsc && resValue != null && (
            <KpiItem
              title={`EMPIAR-10017 published: 4.2 Å (EMD-2824) — this map: ${resValue.toFixed(2)} Å`}
              className={
                resValue <= TARGET_ANGSTROM
                  ? "rounded-full border border-emerald-600/40 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300"
                  : "rounded-full border border-rose-600/30 bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:text-rose-300"
              }
            >
              {resValue <= TARGET_ANGSTROM ? (
                <>
                  <Trophy className="size-3 shrink-0" aria-hidden="true" />
                  target ≤{TARGET_ANGSTROM} Å met
                </>
              ) : (
                <>
                  <Medal className="size-3 shrink-0" aria-hidden="true" />
                  above {TARGET_ANGSTROM} Å target
                </>
              )}
            </KpiItem>
          )}
        </>
      )}

      {/* running job */}
      {stats.runningJob && (
        <>
          <span className="h-4 w-px bg-border" aria-hidden="true" />
          <KpiItem
            title={`${stats.runningJob.name} — running`}
            className="rounded-full border border-teal-600/30 bg-teal-600/10 px-2 py-0.5 text-[11px] font-semibold text-teal-700 dark:text-teal-300"
          >
            <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden="true" />
            <Activity className="hidden size-3 shrink-0 sm:block" aria-hidden="true" />
            <span className="max-w-[120px] truncate">{stats.runningJob.name}</span>
            <span className="tabular-nums">{Math.round(stats.runningJob.progress ?? 0)}%</span>
          </KpiItem>
        </>
      )}
    </div>
  );
}

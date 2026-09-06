"use client";

/**
 * CryoFlow — pipeline analytics for the active-project spotlight.
 *
 * Two at-a-glance views built from the jobs the user already ran:
 *
 *  • Particle flow — how the particle count evolves down the pipeline
 *    (micrographs → picked → extracted → selected → classified →
 *    expanded → rebalanced). Counts are parsed from the engine's own
 *    result strings (stable, app-generated formats) and drawn as
 *    proportional bars with delta chips — a "where did my particles go"
 *    funnel without touching the STAR files again.
 *
 *  • Resolution ladder — every 3D job that reports a resolution
 *    (refine3d / class3d / postprocess), showing the gold-standard
 *    0.143 crossing next to RELION's own reported value, fetched from
 *    the same /fsc endpoints the inspector charts use.
 *
 * Self-hides until there is at least something to say (≥ 2 flow rows or
 * ≥ 1 resolution milestone) so empty/draft projects stay clean.
 */

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Award, Crosshair, Filter, Waves } from "lucide-react";
import type { JobDTO } from "@/lib/types";
import { jobType } from "@/lib/workflow";
import { TypeIcon } from "./icons";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Particle-flow parsing                                               */
/* ------------------------------------------------------------------ */

interface FlowRow {
  key: string;
  label: string;
  count: number;
  /** optional annotation ("×4 D2", "kept 92%") */
  note?: string;
  type: string;
}

/** number with thin thousand separators as printed by the engine ("13,752") */
function num(s: string): number {
  const v = Number(s.replace(/[,\s]/g, ""));
  return Number.isFinite(v) ? v : NaN;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * Extract the particle-flow stage a finished job represents. Result
 * strings are produced by our own RELION engine wrappers (lib/relion/
 * engine.ts finalize paths) — the shapes below mirror those verbatim.
 */
function flowRowOf(job: JobDTO): FlowRow | null {
  if (job.status !== "completed" || !job.result) return null;
  const r = job.result;
  const row = (key: string, label: string, count: number, note?: string): FlowRow | null =>
    Number.isFinite(count) && count > 0 ? { key, label, count, note, type: job.type } : null;

  if (/^import$/i.test(job.type)) {
    const m = r.match(/(\d[\d,]*)\s+micrographs? imported/i);
    return m ? row("micrographs", "Micrographs", num(m[1])) : null;
  }
  if (/autopick|manualpick/i.test(job.type)) {
    const m = r.match(/(\d[\d,]*)\s+particles?\s+picked/i);
    return m ? row("picked", "Picked", num(m[1])) : null;
  }
  if (/^extract/i.test(job.type)) {
    const m = r.match(/(\d[\d,]*)\s+particles?\s+extracted/i);
    return m ? row("extracted", "Extracted", num(m[1])) : null;
  }
  if (/^select(?!2d)/i.test(job.type)) {
    const m = r.match(/(\d[\d,]*)\s+of\s+(\d[\d,]*)\s+particles?\s+selected/i);
    if (m) {
      const kept = num(m[1]);
      const total = num(m[2]);
      const pct = total > 0 ? Math.round((kept / total) * 100) : null;
      return row("selected", "Selected", kept, pct != null && pct < 100 ? `kept ${pct}%` : undefined);
    }
    return null;
  }
  if (/class2d|class3d/i.test(job.type)) {
    const m = r.match(/·\s*(\d[\d,]*)\s+particles?/i);
    return m ? row("classified", "Classified", num(m[1])) : null;
  }
  if (/symexpand/i.test(job.type)) {
    const m = r.match(/=\s*(\d[\d,]*)\s+particles?\s+\((\w+)\)/i);
    const f = r.match(/(\d[\d,]*)\s*[×x]\s*(\d[\d,]*)/);
    return m
      ? row("expanded", "Expanded", num(m[1]), f ? `×${Number(f[2].replace(/,/g, ""))} symmetry` : undefined)
      : null;
  }
  if (/rebalance/i.test(job.type)) {
    const m = r.match(/(\d[\d,]*)\s+of\s+(\d[\d,]*)\s+particles?\s+kept/i);
    if (m) {
      const kept = num(m[1]);
      const total = num(m[2]);
      const pct = total > 0 ? Math.round((kept / total) * 100) : null;
      return row("rebalanced", "Rebalanced", kept, pct != null ? `kept ${pct}%` : undefined);
    }
    return null;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Resolution milestones                                               */
/* ------------------------------------------------------------------ */

interface Milestone {
  jobId: string;
  name: string;
  type: string;
  /** gold-standard 0.143 crossing (raw half-map agreement) */
  at143: number | null;
  /** RELION's own reported estimate (postprocess.star / model.star) */
  reported: number | null;
  label: string | null;
}

/** 3D job types whose /fsc endpoint carries a resolution story. */
const REPORTING_TYPES = /refine3d|class3d|postprocess|initialmodel|multibody/i;

function useResolutionMilestones(jobs: JobDTO[]): Milestone[] {
  const reporting = useMemo(
    () => jobs.filter((j) => j.status === "completed" && REPORTING_TYPES.test(j.type)),
    [jobs]
  );
  const signature = useMemo(
    () => reporting.map((j) => `${j.id}:${j.status}`).join("|"),
    [reporting]
  );
  const [milestones, setMilestones] = useState<Milestone[]>([]);

  useEffect(() => {
    if (reporting.length === 0) {
      setMilestones([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const out = await Promise.all(
        reporting.map(async (j): Promise<Milestone> => {
          try {
            const res = await fetch(`/api/jobs/${j.id}/fsc`, { cache: "no-store" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const body = (await res.json()) as {
              resolutionAt143: number | null;
              reportedResolution: number | null;
              reportedLabel: string | null;
            };
            return {
              jobId: j.id,
              name: j.name,
              type: j.type,
              at143: body.resolutionAt143,
              reported: body.reportedResolution,
              label: body.reportedLabel,
            };
          } catch {
            return { jobId: j.id, name: j.name, type: j.type, at143: null, reported: null, label: null };
          }
        })
      );
      if (!cancelled) setMilestones(out.filter((m) => m.at143 != null || m.reported != null));
    })();
    return () => {
      cancelled = true;
    };
  }, [signature]);

  return milestones;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function PipelineAnalytics({ jobs }: { jobs: JobDTO[] }) {
  const flow = useMemo(
    () => jobs.map(flowRowOf).filter((r): r is FlowRow => r != null),
    [jobs]
  );
  const milestones = useResolutionMilestones(jobs);

  if (flow.length < 2 && milestones.length === 0) return null;

  const maxCount = flow.length > 0 ? Math.max(...flow.map((r) => r.count)) : 1;

  return (
    <section
      aria-label="Pipeline analytics"
      className="animate-rise rounded-xl border bg-gradient-to-b from-muted/40 to-transparent p-4"
    >
      <div className="mb-3 flex items-center gap-1.5">
        <Filter className="size-3.5 text-primary" aria-hidden="true" />
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Pipeline analytics
        </p>
        <span className="text-[10px] text-muted-foreground/60">
          live from your finished jobs
        </span>
      </div>

      <div className={cn("grid gap-5", milestones.length > 0 && flow.length >= 2 && "lg:grid-cols-2")}>
        {/* particle flow funnel ------------------------------------------ */}
        {flow.length >= 2 && (
          <div>
            <p className="mb-2 flex items-center gap-1 text-[11px] font-medium text-foreground/80">
              <Filter className="size-3 text-teal-600" aria-hidden="true" />
              Particle flow
            </p>
            <div className="space-y-1.5">
              {flow.map((row, i) => {
                const spec = jobType(row.type);
                const prev = i > 0 ? flow[i - 1].count : null;
                const delta = prev != null ? row.count - prev : null;
                const w = Math.max(8, Math.round((row.count / maxCount) * 100));
                return (
                  <div key={row.key} className="group/flow flex items-center gap-2">
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded ring-1 ring-inset",
                        spec?.color.soft,
                        spec?.color.border
                      )}
                      title={row.label}
                      aria-hidden="true"
                    >
                      <TypeIcon name={spec?.icon ?? "Boxes"} className={cn("size-3", spec?.color.text)} />
                    </span>
                    <span className="w-20 shrink-0 truncate text-[11px] font-medium text-foreground/85">
                      {row.label}
                    </span>
                    <div className="relative h-4 min-w-0 flex-1 overflow-hidden rounded-full bg-muted/70">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-teal-600/70 to-teal-500/45 transition-[width] duration-700 ease-out group-hover/flow:from-teal-600 group-hover/flow:to-teal-500/70"
                        style={{ width: `${w}%` }}
                      />
                    </div>
                    <span className="w-16 shrink-0 text-right text-[11px] font-semibold tabular-nums">
                      {fmt(row.count)}
                    </span>
                    {delta != null && delta !== 0 ? (
                      <span
                        className={cn(
                          "w-14 shrink-0 text-right text-[10px] font-semibold tabular-nums",
                          delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                        )}
                        title={
                          delta > 0
                            ? "count grew (e.g. symmetry expansion duplicates particles by design)"
                            : "count shrank (selection/classification removed particles)"
                        }
                      >
                        {delta > 0 ? "+" : "−"}
                        {fmt(Math.abs(delta))}
                      </span>
                    ) : (
                      <span className="w-14 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* resolution ladder ---------------------------------------------- */}
        {milestones.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1 text-[11px] font-medium text-foreground/80">
              <Waves className="size-3 text-violet-600" aria-hidden="true" />
              Resolution ladder
            </p>
            <div className="flex flex-wrap items-center gap-1">
              {milestones.map((m, i) => {
                const best =
                  m.reported != null && (m.at143 == null || m.reported <= m.at143)
                    ? m.reported
                    : (m.at143 ?? m.reported);
                return (
                  <div key={m.jobId} className="flex items-center gap-1">
                    {i > 0 && <ArrowRight className="size-3 text-muted-foreground/40" aria-hidden="true" />}
                    <div
                      className={cn(
                        "rounded-lg border bg-card px-2.5 py-1.5 shadow-sm",
                        m.reported != null && m.reported === best
                          ? "border-violet-500/40 ring-1 ring-violet-500/15"
                          : "border-amber-500/30"
                      )}
                      title={`${m.name}${m.label ? ` · ${m.label}` : ""}`}
                    >
                      <p className="max-w-28 truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {m.name.replace(/ \d+$/, "")}
                      </p>
                      <p className="flex items-baseline gap-1">
                        <span
                          className={cn(
                            "text-sm font-bold tabular-nums",
                            m.reported != null && m.reported === best
                              ? "text-violet-700 dark:text-violet-300"
                              : "text-amber-700 dark:text-amber-300"
                          )}
                        >
                          {best?.toFixed(2)} Å
                        </span>
                        {m.reported != null && m.at143 != null && Math.abs(m.reported - m.at143) > 0.5 && (
                          <span className="text-[9px] font-medium tabular-nums text-muted-foreground">
                            (0.143: {m.at143.toFixed(1)})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-1.5 flex items-center gap-1 text-[10px] leading-relaxed text-muted-foreground/70">
              <Award className="size-3 shrink-0 text-violet-500/70" aria-hidden="true" />
              violet = RELION-reported · amber = 0.143 gold-standard crossing
              <Crosshair className="ml-1 size-3 shrink-0 text-amber-500/70" aria-hidden="true" />
              lower is better
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

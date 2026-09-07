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

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Award,
  Check,
  ClipboardCopy,
  Crosshair,
  Download,
  Filter,
  Waves,
} from "lucide-react";
import type { JobDTO } from "@/lib/types";
import { jobType } from "@/lib/workflow";
import { useWorkflowStore } from "@/lib/store";
import { toast } from "@/hooks/use-toast";
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
/* Export helpers (copy summary · CSV download)                        */
/* ------------------------------------------------------------------ */

/** RFC-4180-ish CSV cell escaping: quote when special chars are present. */
function csvCell(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadText(filename: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // revoke on the next tick — Chrome ignores an immediate revoke
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function PipelineAnalytics({ jobs }: { jobs: JobDTO[] }) {
  const workspaces = useWorkflowStore((s) => s.workspaces);
  const projectName = useWorkflowStore((s) => s.project?.name);
  /** null = all workspaces; otherwise a workspace id ("" = legacy unassigned). */
  const [wsFilter, setWsFilter] = useState<string | null>(null);
  /** brief ✓ state on the copy-summary button */
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // only workspaces that actually hold jobs get a chip — keeps the row
  // honest when a workspace exists but is empty (or was deleted)
  const wsOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const j of jobs) {
      const key = j.workspaceId ?? "";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([id, count]) => ({
        id,
        count,
        name:
          workspaces.find((w) => w.id === id)?.name ??
          (id === "" ? "Unassigned" : id.slice(0, 8)),
      }))
      .sort((a, b) => b.count - a.count);
  }, [jobs, workspaces]);

  const scoped = useMemo(
    () => (wsFilter == null ? jobs : jobs.filter((j) => (j.workspaceId ?? "") === wsFilter)),
    [jobs, wsFilter]
  );

  const flow = useMemo(
    () => scoped.map(flowRowOf).filter((r): r is FlowRow => r != null),
    [scoped]
  );
  const milestones = useResolutionMilestones(scoped);

  // clear the copied-✓ timer on unmount (never setState after unmount)
  useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    []
  );

  /** Human label of the current scope chip ("all workspaces" / ws name). */
  const scopeLabel =
    wsFilter == null
      ? "all workspaces"
      : (workspaces.find((w) => w.id === wsFilter)?.name ??
        (wsFilter === "" ? "Unassigned" : wsFilter.slice(0, 8)));

  /** Plain-text summary of everything this section shows, clipboard-ready. */
  const buildSummary = (): string => {
    const lines: string[] = [];
    const nCompleted = scoped.filter((j) => j.status === "completed").length;
    const nFailed = scoped.filter((j) => j.status === "failed").length;
    lines.push(`CryoFlow — ${projectName ?? "project"} pipeline summary`);
    lines.push(
      `Scope: ${scopeLabel} · ${scoped.length} jobs (${nCompleted} completed, ${nFailed} failed)`
    );
    if (flow.length >= 2) {
      lines.push("");
      lines.push("Particle flow:");
      for (const r of flow) {
        lines.push(`  ${r.label}: ${fmt(r.count)}${r.note ? ` (${r.note})` : ""}`);
      }
    }
    if (milestones.length > 0) {
      lines.push("");
      lines.push("Resolution ladder:");
      for (const m of milestones) {
        const best =
          m.reported != null && (m.at143 == null || m.reported <= m.at143)
            ? m.reported
            : (m.at143 ?? m.reported);
        lines.push(`  ${m.name}: ${best?.toFixed(2)} Å${m.label ? ` (${m.label})` : ""}`);
      }
    }
    lines.push("");
    lines.push(`Generated ${new Date().toLocaleString()}`);
    return lines.join("\n");
  };

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(buildSummary());
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1600);
      toast({
        title: "Summary copied",
        description: `Pipeline summary (${scopeLabel}) is on your clipboard`,
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Clipboard is unavailable in this browser context",
        variant: "destructive",
      });
    }
  };

  /** Full job inventory of the current scope → timestamped CSV download. */
  const exportCsv = () => {
    const wsName = (id: string | null | undefined) =>
      // null/"" both mean the legacy "Unassigned" bucket (same as the chips)
      id == null || id === ""
        ? "Unassigned"
        : (workspaces.find((w) => w.id === id)?.name ?? id);
    const header = [
      "name",
      "type",
      "type_label",
      "workspace",
      "status",
      "progress_pct",
      "result",
      "created_at",
      "updated_at",
    ];
    const rows = scoped.map((j) => [
      j.name,
      j.type,
      jobType(j.type)?.label ?? j.type,
      wsName(j.workspaceId),
      j.status,
      j.progress,
      j.result ?? "",
      j.createdAt,
      j.updatedAt,
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
    const stamp = new Date().toISOString().slice(0, 10);
    const safe = (projectName ?? "project")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    downloadText(`cryoflow-${safe}-jobs-${stamp}.csv`, csv, "text/csv;charset=utf-8");
    toast({
      title: "CSV exported",
      description: `${rows.length} jobs · scope: ${scopeLabel}`,
    });
  };

  const hasContent = flow.length >= 2 || milestones.length > 0;
  // Unfiltered + nothing to say → stay out of the way entirely (the
  // original honest-hide contract). BUT a scoped view with no data must
  // KEEP the section chrome: hiding the chips alongside the body would
  // lock the user out of switching back to "all" (they could never see
  // the section again without leaving the dashboard).
  if (!hasContent && wsFilter == null) return null;

  const maxCount = flow.length > 0 ? Math.max(...flow.map((r) => r.count)) : 1;

  return (
    <section
      aria-label="Pipeline analytics"
      className="animate-rise rounded-xl border bg-gradient-to-b from-muted/40 to-transparent p-4"
    >
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <Filter className="size-3.5 text-primary" aria-hidden="true" />
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Pipeline analytics
        </p>
        <span className="text-[10px] text-muted-foreground/60">
          live from your finished jobs
        </span>
        {/* export toolbar + per-workspace scope chips — only when the project
            really spans more than one workspace, otherwise the filter is noise */}
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-0.5" role="group" aria-label="Export analytics">
            <button
              type="button"
              onClick={() => void copySummary()}
              title="Copy a plain-text summary of the funnel, resolution ladder and job counts"
              aria-label="Copy pipeline summary"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {copied ? (
                <Check className="size-3.5 text-emerald-600" aria-hidden="true" />
              ) : (
                <ClipboardCopy className="size-3.5" aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={exportCsv}
              title="Download the job inventory (current scope) as CSV"
              aria-label="Export jobs as CSV"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Download className="size-3.5" aria-hidden="true" />
            </button>
          </div>
          {wsOptions.length > 1 && (
            <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filter analytics by workspace">
            <button
              type="button"
              onClick={() => setWsFilter(null)}
              aria-pressed={wsFilter == null}
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors",
                wsFilter == null
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
              )}
            >
              all · {jobs.length}
            </button>
            {wsOptions.map((w) => (
              <button
                key={w.id || "unassigned"}
                type="button"
                // NB: the legacy-unassigned chip's id is "" — keep it as-is
                // ("" !== null); coercing it with || would fold the chip
                // into the "all" filter
                onClick={() => setWsFilter(w.id)}
                aria-pressed={wsFilter === w.id}
                title={`Scope the analytics to the “${w.name}” workspace`}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors",
                  wsFilter === w.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                )}
              >
                {w.name} · {w.count}
              </button>
            ))}
            </div>
          )}
        </div>
      </div>

      <div className={cn("grid gap-5", milestones.length > 0 && flow.length >= 2 && "lg:grid-cols-2")}>
        {/* scoped empty state — only when a chip filter carved away every
            flow row AND no resolution milestone answers for this scope */}
        {!hasContent && (
          <p className="py-2 text-xs text-muted-foreground">
            No pipeline data in the “{scopeLabel}” scope yet — finished jobs with particle counts
            or resolutions will appear here. Switch to another workspace or “all” above.
          </p>
        )}
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

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
  ChartGantt,
  Check,
  ClipboardCopy,
  Crosshair,
  Download,
  Filter,
  Waves,
} from "lucide-react";
import { fmtClock, fmtDuration } from "@/lib/duration";
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

/** tick ladder: the coarsest step that still yields ≤ ~5 ticks on the axis */
function niceStepMs(spanMs: number): number {
  const sec = spanMs / 1000;
  for (const s of [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400, 43200, 86400]) {
    if (sec / s <= 5) return s * 1000;
  }
  return 86_400 * 1000;
}

/** compact axis-offset label: "45s" · "3m" · "2h" */
function fmtOffset(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.round(m / 60)}h`;
}

/** precise offset for summary rows: fmtDuration says "—" at zero, but the
 *  first run's offset IS zero — "+—" reads as a glitch, "+0s" reads as data */
function fmtOffsetPrecise(ms: number): string {
  return ms <= 0 ? "0s" : fmtDuration(ms);
}

export function PipelineAnalytics({ jobs }: { jobs: JobDTO[] }) {
  const workspaces = useWorkflowStore((s) => s.workspaces);
  const projectName = useWorkflowStore((s) => s.project?.name);
  const revealJob = useWorkflowStore((s) => s.revealJob);
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

  /* Task 123 — session timeline: the run window each job actually occupied.
   *
   * The axis is REAL run data: the engine stamps startedAt when a job flips
   * to running and writes the measured elapsed into duration on completion,
   * so [startedAt, startedAt + duration] is the honest window (updatedAt is
   * NOT — every poll merge touches it, all rows would share one instant).
   * Jobs the engine never started (seeded / idle) have no window and stay
   * off the bars; the footer counts them instead of pretending. A live run
   * stretches to "now" — a 5s ticker only exists while one is running,
   * otherwise the axis is frozen data and costs no timers. */
  const anyRunning = scoped.some((j) => j.status === "running");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!anyRunning) return;
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, [anyRunning]);

  const runs = useMemo(() => {
    const rows = scoped
      .filter(
        (j) =>
          j.startedAt &&
          (j.status === "completed" || j.status === "failed" || j.status === "running")
      )
      .map((j) => {
        const start = new Date(j.startedAt as string).getTime();
        const end =
          j.status === "running" ? Math.max(now, start + 1000) : start + Math.max(1000, j.duration);
        return { job: j, start, end, ms: Math.max(1000, end - start) };
      })
      .filter((r) => Number.isFinite(r.start) && r.end > r.start)
      .sort((a, b) => a.start - b.start || a.job.name.localeCompare(b.job.name));
    if (rows.length === 0) return { rows, t0: 0, span: 0, ticks: [] as number[] };
    const t0 = rows[0].start;
    const span = Math.max(rows[rows.length - 1].end - t0, 1000);
    const step = niceStepMs(span);
    const ticks: number[] = [];
    for (let t = 0; t <= span + 1; t += step) ticks.push(t);
    return { rows, t0, span, ticks };
  }, [scoped, now]);

  /** jobs the engine never started — the timeline's honest absentees */
  const neverRan = scoped.filter((j) => !j.startedAt).length;

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
    if (runs.rows.length > 0) {
      lines.push("");
      lines.push(`Session timeline (${runs.rows.length} runs, ${fmtOffset(runs.span)} span):`);
      for (const r of runs.rows) {
        // row offsets keep fmtDuration's composite precision ("1m 28s") —
        // the axis-tick fmtOffset collapses sub-minute runs into the same
        // minute label, which would read "+1m → +1m (completed, 8s)"
        lines.push(
          `  ${r.job.name}: +${fmtOffsetPrecise(r.start - runs.t0)} → +${fmtOffsetPrecise(r.end - runs.t0)} (${r.job.status}, ${fmtDuration(r.ms)})`
        );
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

  const hasContent = flow.length >= 2 || milestones.length > 0 || runs.rows.length > 0;
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
            really spans more than one workspace, otherwise the filter is noise.
            Both groups are interactive chrome: .no-print (Task 80 follow-up). */}
        <div className="no-print ml-auto flex items-center gap-2">
          <div className="flex items-center gap-0.5" role="group" aria-label="Export analytics">
            <button
              type="button"
              onClick={() => void copySummary()}
              title="Copy a plain-text summary of the funnel, resolution ladder, session timeline and job counts"
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
            // .no-print (Task 80 follow-up): interactive slice toggles —
            // on paper they read as "Unassigned · 1" junk and collide with
            // the dashboard roster's own Unassigned badge text
            <div className="no-print flex flex-wrap items-center gap-1" role="group" aria-label="Filter analytics by workspace">
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
                    <button
                      type="button"
                      onClick={() => revealJob(m.jobId)}
                      className={cn(
                        "cursor-pointer rounded-lg border bg-card px-2.5 py-1.5 text-left shadow-sm transition-colors hover:border-violet-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                        m.reported != null && m.reported === best
                          ? "border-violet-500/40 ring-1 ring-violet-500/15"
                          : "border-amber-500/30"
                      )}
                      title={`${m.name}${m.label ? ` · ${m.label}` : ""} — click to reveal on the canvas`}
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
                    </button>
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
        {/* session timeline ------------------------------------------------
            Full-width third view: one row per engine run, x = wall-clock
            window [startedAt → +measured duration]. Rows are REVEAL buttons
            (Task 124): click lands on the job in the canvas. Column
            arithmetic is shared with the axis overlay: icon 36 + gap 8 +
            name 112 + gap 8 = 164px track origin; duration 56 + gap 8 +
            reveal icon 12 + gap 8 = 84px right inset — keep the six numbers
            in sync with the rows below. */}
        {runs.rows.length > 0 && (
          <div
            className="mt-5 border-t pt-4"
            data-canvas-ui="analytics-timeline"
            data-tl-count={runs.rows.length}
          >
            <p className="mb-2 flex items-center gap-1 text-[11px] font-medium text-foreground/80">
              <ChartGantt className="size-3 text-amber-600" aria-hidden="true" />
              Session timeline
              <span className="font-normal text-muted-foreground">
                · {runs.rows.length} run{runs.rows.length === 1 ? "" : "s"} across {fmtOffset(runs.span)}
              </span>
            </p>
            <div className="max-h-72 overflow-y-auto pr-1 print:max-h-none print:overflow-visible">
              <div className="relative">
                {/* axis hairlines: behind every row, aligned to the track */}
                <div className="pointer-events-none absolute inset-y-0 left-[164px] right-[84px]" aria-hidden="true">
                  {runs.ticks.map((t) => (
                    <span
                      key={t}
                      className="absolute inset-y-0 w-px bg-border/45"
                      style={{ left: `${(t / runs.span) * 100}%` }}
                    />
                  ))}
                </div>
                {runs.rows.map((r) => {
                  const x = ((r.start - runs.t0) / runs.span) * 100;
                  const w = Math.max((r.ms / runs.span) * 100, 0.75);
                  const spec = jobType(r.job.type);
                  return (
                    <button
                      type="button"
                      key={r.job.id}
                      className="group relative flex w-full cursor-pointer items-center gap-2 rounded py-[3px] text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                      data-tl-row=""
                      data-status={r.job.status}
                      onClick={() => revealJob(r.job.id)}
                      title={`Reveal ${r.job.name} on the canvas — ${r.job.status}, ran ${fmtDuration(r.ms)}`}
                    >
                      <span className="flex w-9 shrink-0 justify-end">
                        <span
                          className={cn(
                            "flex size-4.5 items-center justify-center rounded ring-1 ring-inset",
                            spec?.color.soft,
                            spec?.color.border
                          )}
                          title={r.job.name}
                          aria-hidden="true"
                        >
                          <TypeIcon name={spec?.icon ?? "Boxes"} className="size-2.5" />
                        </span>
                      </span>
                      <span
                        className="w-28 shrink-0 truncate text-[10.5px] text-muted-foreground"
                        title={r.job.name}
                      >
                        {r.job.name}
                      </span>
                      <div className="relative h-4 min-w-0 flex-1">
                        <span
                          className={cn(
                            "absolute top-1/2 h-2.5 -translate-y-1/2 rounded-[3px] transition-[left,width] duration-500 ease-out [print-color-adjust:exact] [-webkit-print-color-adjust:exact]",
                            r.job.status === "running"
                              ? "animate-soft-pulse bg-amber-500"
                              : r.job.status === "failed"
                                ? "bg-rose-500/85"
                                : "bg-emerald-500/80"
                          )}
                          style={{ left: `${x}%`, width: `${w}%` }}
                          data-tl-bar=""
                          title={`${r.job.name} — started ${fmtClock(r.job.startedAt as string)}, ran ${fmtDuration(r.ms)}, ${r.job.status}`}
                        />
                      </div>
                      <span className="w-14 shrink-0 text-right font-mono text-[9.5px] tabular-nums text-muted-foreground">
                        {fmtDuration(r.ms)}
                      </span>
                      {/* reveal affordance: fades in on row hover, never on
                          paper (the paper has nowhere to arrive) */}
                      <Crosshair
                        className="size-3 shrink-0 text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100 print:hidden"
                        aria-hidden="true"
                      />
                    </button>
                  );
                })}
              </div>
              {/* relative-time axis labels, same insets as the hairlines */}
              <div className="relative mt-1 ml-[164px] h-3 mr-[84px]" aria-hidden="true">
                {runs.ticks.map((t) => (
                  <span
                    key={t}
                    className="absolute top-0 -translate-x-1/2 font-mono text-[8.5px] tabular-nums text-muted-foreground/60"
                    style={{ left: `${(t / runs.span) * 100}%` }}
                  >
                    {fmtOffset(t)}
                  </span>
                ))}
              </div>
            </div>
            {neverRan > 0 && (
              <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground/70" data-tl-never="">
                {neverRan} of {scoped.length} job{scoped.length === 1 ? "" : "s"} in scope never
                started — bars cover engine runs only (startedAt → measured wall time)
              </p>
            )}
          </div>
        )}
    </section>
  );
}

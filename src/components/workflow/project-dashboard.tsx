"use client";

/**
 * CryoFlow — Project Dashboard (standalone management view).
 *
 * A full-page alternative to the sidebar "Projects" tab: global KPIs across
 * every project, a searchable project grid with per-project stats and
 * actions, and an active-project spotlight with the live pipeline stage
 * rail + job table. Clicking anything work-flow related deep-links back
 * into the canvas view (switch project → open canvas → select/inspect job).
 */

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock,
  FolderGit2,
  LayoutDashboard,
  Loader2,
  Pencil,
  Plus,
  Search,
  Snowflake,
  Trash2,
  TriangleAlert,
  Workflow,
} from "lucide-react";
import { useWorkflowStore } from "@/lib/store";
import { withLiveStats } from "@/lib/live-stats";
import { KpiSparkline } from "./kpi-sparkline";
import type { JobDTO, ProjectSummaryDTO } from "@/lib/types";
import { jobType } from "@/lib/workflow";
import { TypeIcon } from "./icons";
import { PipelineAnalytics } from "./pipeline-analytics";
import { StatusBadge, estimateEta, formatEta, trackEtaBaseline } from "./job-card";
import { NewProjectDialog } from "./project-panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types + small helpers                                                */
/* ------------------------------------------------------------------ */

interface ProjectStats {
  total: number;
  running: number;
  /** waiting for an upstream job (amber, not failed) */
  pending?: number;
  completed: number;
  failed: number;
}

/** ProjectSummaryDTO + the extra fields GET /api/projects actually returns. */
interface ProjectCard extends ProjectSummaryDTO {
  createdAt?: string;
  stats?: ProjectStats;
}

function fmtAgo(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "—";
  }
}

/**
 * Project grid sort keys. "oldest" == the server's default createdAt-asc
 * order; everything else is a client-side sort over the (already fetched)
 * cards. The choice persists per browser (localStorage, defensively
 * sanitized on read) — an iterative session shouldn't re-sort every visit.
 */
type ProjectSortKey = "oldest" | "newest" | "name" | "jobs" | "done";

const PROJECT_SORTS: { key: ProjectSortKey; label: string }[] = [
  { key: "oldest", label: "Oldest first" },
  { key: "newest", label: "Newest first" },
  { key: "name", label: "Name A–Z" },
  { key: "jobs", label: "Most jobs" },
  { key: "done", label: "Most complete" },
];

const SORT_KEY = "cryoflow:projects-sort";

function loadSortKey(): ProjectSortKey {
  try {
    const raw = localStorage.getItem(SORT_KEY);
    return PROJECT_SORTS.some((s) => s.key === raw) ? (raw as ProjectSortKey) : "oldest";
  } catch {
    return "oldest"; // private mode / storage disabled — server order
  }
}

function sortProjects(list: ProjectCard[], key: ProjectSortKey): ProjectCard[] {
  const out = [...list];
  // every branch ends with an id tie-break — duplicate project NAMES are
  // legal (two "demo" projects are a normal sight), and an unstable order
  // across visits makes the grid feel haunted
  const tie = (a: ProjectCard, b: ProjectCard) => a.id.localeCompare(b.id);
  switch (key) {
    case "newest":
      out.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? "") || tie(a, b));
      break;
    case "name":
      out.sort(
        (a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || tie(a, b)
      );
      break;
    case "jobs":
      out.sort((a, b) => (b.stats?.total ?? 0) - (a.stats?.total ?? 0) || tie(a, b));
      break;
    case "done":
      // completion RATIO first (0.5/1 beats 0/1000), total count as the
      // tiebreaker (2/2 outranks 1/1 — more delivered work overall);
      // empty projects (-1) sink below everything so the grid leads with
      // genuinely finished pipelines
      out.sort((a, b) => {
        const ra =
          (a.stats?.total ?? 0) > 0 ? (a.stats?.completed ?? 0) / (a.stats?.total ?? 1) : -1;
        const rb =
          (b.stats?.total ?? 0) > 0 ? (b.stats?.completed ?? 0) / (b.stats?.total ?? 1) : -1;
        if (rb !== ra) return rb - ra;
        const ta = (a.stats?.total ?? 0) - (b.stats?.total ?? 0);
        return ta !== 0 ? -ta : tie(a, b);
      });
      break;
    default:
      break; // "oldest" — keep the fetched (createdAt asc) order
  }
  return out;
}

const STATUS_DOT: Record<string, string> = {
  idle: "bg-muted-foreground/40",
  pending: "bg-amber-500",
  running: "bg-teal-500 animate-pulse",
  completed: "bg-emerald-500",
  failed: "bg-rose-500",
};

/* ------------------------------------------------------------------ */
/* KPI band                                                             */
/* ------------------------------------------------------------------ */

function KpiCard({
  icon,
  value,
  label,
  sub,
  tone,
  spark,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
  sub?: string;
  tone: string;
  /** optional 14-day trend sparkline — inherits the card tone (currentColor) */
  spark?: React.ReactNode;
}) {
  return (
    <div className="card-lift relative flex items-center gap-3 overflow-hidden rounded-xl border bg-card p-4">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
          tone
        )}
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="min-w-0 leading-tight">
        <p className="text-xl font-semibold tabular-nums tracking-tight">{value}</p>
        <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {sub ? <p className="truncate text-[10px] text-muted-foreground/70">{sub}</p> : null}
      </div>
      {/* sparkline as a bottom-right watermark: decorative trend that never
          squeezes the text column (in-flow placement truncated "TOTAL JOBS"
          to "TO…" at lg width) — pointer-events-none so it can't block */}
      {spark ? (
        <div className="pointer-events-none absolute bottom-1.5 right-2.5 opacity-80">
          {spark}
        </div>
      ) : null}
    </div>
  );
}

/** Shape of GET /api/activity — the KPI sparkline feed. */
interface ActivityFeed {
  days: string[];
  total: number[];
  completed: number[];
  createdInWindow: number;
  completedInWindow: number;
  /** global mode only — cumulative project count per day */
  projects?: number[];
  projectsInWindow?: number;
}

/* ------------------------------------------------------------------ */
/* Project grid card                                                    */
/* ------------------------------------------------------------------ */

function DashboardProjectCard({
  project,
  isActive,
  isPending,
  onlyProject,
  onOpen,
  onRequestDelete,
}: {
  project: ProjectCard;
  isActive: boolean;
  isPending: boolean;
  onlyProject: boolean;
  onOpen: () => void;
  onRequestDelete: () => void;
}) {
  const renameProject = useWorkflowStore((s) => s.renameProject);
  const allProjects = useWorkflowStore((s) => s.projects);
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(project.name);
  const [renaming, setRenaming] = React.useState(false);

  // gentle, non-blocking: renaming to another project's name is legal but
  // makes cards/exports ambiguous — hint while typing (same contract as the
  // create dialog's amber hint)
  const renameDup =
    editing &&
    name.trim() !== project.name &&
    name.trim().length > 0 &&
    allProjects.some(
      (p) => p.id !== project.id && p.name.trim().toLowerCase() === name.trim().toLowerCase()
    );

  const stats = project.stats;
  const total = stats?.total ?? 0;
  const done = stats?.completed ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const tomo = project.mode === "tomo";

  // per-project 14-day creation trend — refetched when the job count moves
  // (same live-stats trigger the KPI band uses). Decorative: a failed or
  // pending fetch simply leaves the card without its spark.
  const [spark, setSpark] = React.useState<React.ReactNode>(null);
  React.useEffect(() => {
    let cancelled = false;
    fetch(`/api/activity?days=14&projectId=${project.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: ActivityFeed) => {
        if (cancelled || !Array.isArray(data?.days) || data.days.length < 2) return;
        const allDone = total > 0 && done >= total;
        setSpark(
          <KpiSparkline
            values={data.total}
            days={data.days}
            unit="jobs"
            width={72}
            height={20}
            className={allDone ? "text-emerald-500" : "text-muted-foreground/60"}
          />
        );
      })
      .catch(() => {
        /* decorative — hide on failure */
      });
    return () => {
      cancelled = true;
    };
  }, [project.id, total, done]);

  const commitRename = () => {
    const trimmed = name.trim();
    if (!editing || renaming) return setEditing(false);
    if (!trimmed || trimmed === project.name) {
      setEditing(false);
      return;
    }
    setRenaming(true);
    void renameProject(project.id, trimmed.slice(0, 80)).finally(() => {
      setRenaming(false);
      setEditing(false);
    });
  };

  return (
    <div
      className={cn(
        "card-lift group relative flex flex-col overflow-hidden rounded-xl border bg-card p-4 transition-shadow hover:shadow-md",
        isActive ? "border-primary/50 ring-1 ring-primary/25" : "border-border"
      )}
    >
      {/* engine accent strip */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-teal-600 via-teal-400 to-teal-600"
      />

      <div className="flex items-start gap-2">
        <span
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 ring-1 ring-inset ring-teal-500/30 dark:text-teal-400"
          aria-hidden="true"
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FolderGit2 className="size-4" />
          )}
        </span>

        {editing ? (
          <Input
            value={name}
            maxLength={80}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitRename();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setEditing(false);
              }
            }}
            aria-label="Project name"
            className="h-8 text-sm font-medium"
          />
        ) : (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold" title={project.name}>
              {project.name}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {project.createdAt ? `created ${fmtAgo(project.createdAt)}` : "—"}
            </p>
          </div>
        )}

        {isActive && !editing && (
          <Badge className="h-5 shrink-0 px-1.5 text-[9px] font-semibold uppercase tracking-wider">
            Active
          </Badge>
        )}
      </div>

      {/* rename-collision nudge — compact so the card only grows a few px
          while editing, and only when the typed name actually collides */}
      {renameDup && (
        <p className="mt-1.5 flex items-start gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] leading-snug text-amber-700 dark:text-amber-400">
          <TriangleAlert className="mt-px size-3 shrink-0" aria-hidden="true" />
          <span>
            Another project is already named “{name.trim()}” — Enter still
            renames (sort order breaks ties by creation).
          </span>
        </p>
      )}

      {/* badges + stats */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge
          variant="outline"
          className="h-5 border-teal-500/40 bg-teal-500/10 px-1.5 text-[9px] font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400"
        >
          RELION
        </Badge>
        <Badge
          variant="outline"
          className={cn(
            "h-5 px-1.5 text-[9px] font-semibold uppercase tracking-wider",
            tomo
              ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          )}
        >
          {tomo ? "TOMO" : "SPA"}
        </Badge>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] tabular-nums text-muted-foreground">
          <Boxes className="size-3" aria-hidden="true" />
          {total} jobs
          {(stats?.running ?? 0) > 0 && (
            <span className="flex items-center gap-0.5 text-teal-600 dark:text-teal-400">
              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              {stats?.running}
            </span>
          )}
          {(stats?.pending ?? 0) > 0 && (
            <span
              className="flex items-center gap-0.5 text-amber-600 dark:text-amber-400"
              title={`${stats?.pending} pending — waiting for an upstream job`}
            >
              <Clock className="size-3" aria-hidden="true" />
              {stats?.pending}
            </span>
          )}
          {(stats?.failed ?? 0) > 0 && (
            <span className="flex items-center gap-0.5 text-rose-600 dark:text-rose-400">
              <CircleAlert className="size-3" aria-hidden="true" />
              {stats?.failed}
            </span>
          )}
        </span>
      </div>

      {/* completion progress + per-project trend spark (in-flow right slot —
          a watermark here would sit on the rename/delete buttons) */}
      <div className="mt-3 flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between text-[10px] font-medium text-muted-foreground">
            <span className="uppercase tracking-wider">Completion</span>
            <span className="tabular-nums">
              {done}/{total} · {pct}%
            </span>
          </div>
          <Progress value={pct} className="h-1.5" />
        </div>
        {spark ? <div className="shrink-0 pb-0.5">{spark}</div> : null}
      </div>

      {/* actions */}
      <div className="mt-4 flex items-center gap-1.5">
        <Button
          size="sm"
          className="h-8 flex-1 gap-1.5 text-xs"
          onClick={onOpen}
          disabled={isPending}
        >
          <Workflow className="size-3.5" aria-hidden="true" />
          {isActive ? "Open workflow" : "Switch & open"}
        </Button>
        {!editing && (
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            <Button
              variant="outline"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setName(project.name);
                setEditing(true);
              }}
              aria-label={`Rename ${project.name}`}
              title="Rename project"
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={onRequestDelete}
              disabled={onlyProject}
              aria-label={`Delete ${project.name}`}
              title={
                onlyProject
                  ? "Cannot delete the last project — create another one first"
                  : "Delete project"
              }
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Active project spotlight                                             */
/* ------------------------------------------------------------------ */

function StageChip({ job, onClick }: { job: JobDTO; onClick: () => void }) {
  const spec = jobType(job.type);
  const running = job.status === "running" && job.startedAt != null;
  const eta = running ? estimateEta(job.id, job.startedAt, job.progress) : null;
  // baseline recording is an effect (storage write), the read above is pure
  React.useEffect(() => {
    if (running) trackEtaBaseline(job.id, job.startedAt, job.progress);
  }, [running, job.id, job.startedAt, job.progress]);

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${job.name} — ${job.status}${job.result ? ` · ${job.result}` : ""}`}
      className={cn(
        "group/stage flex shrink-0 items-center gap-2 rounded-lg border bg-card px-2.5 py-2 text-left transition-all hover:shadow-sm",
        job.status === "running"
          ? "border-teal-500/50 ring-1 ring-teal-500/25"
          : job.status === "completed"
            ? "border-emerald-500/40"
            : job.status === "failed"
              ? "border-rose-500/40"
              : "border-border"
      )}
    >
      <span className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[job.status] ?? "bg-muted-foreground/40")} aria-hidden="true" />
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-md ring-1 ring-inset",
          spec?.color.soft,
          spec?.color.border
        )}
        aria-hidden="true"
      >
        <TypeIcon name={spec?.icon ?? "Boxes"} className={cn("size-3.5", spec?.color.text)} />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block max-w-36 truncate text-[11px] font-semibold">{job.name}</span>
        <span className="block text-[10px] text-muted-foreground">
          {job.status === "running"
            ? `${Math.round(job.progress)}%${eta != null ? ` · ${formatEta(eta)}` : ""}`
            : job.status === "completed"
              ? job.result?.slice(0, 26) ?? "done"
              : job.status}
        </span>
      </span>
    </button>
  );
}

function JobRow({ job, onOpen }: { job: JobDTO; onOpen: () => void }) {
  const spec = jobType(job.type);
  const running = job.status === "running" && job.startedAt != null;
  const eta = running ? estimateEta(job.id, job.startedAt, job.progress) : null;
  React.useEffect(() => {
    if (running) trackEtaBaseline(job.id, job.startedAt, job.progress);
  }, [running, job.id, job.startedAt, job.progress]);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group/row flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-secondary/60"
      title={`Open ${job.name}`}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
          spec?.color.soft,
          spec?.color.border
        )}
        aria-hidden="true"
      >
        <TypeIcon name={spec?.icon ?? "Boxes"} className={cn("size-4", spec?.color.text)} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-xs font-semibold">{job.name}</span>
          <StatusBadge status={job.status} />
        </span>
        {job.status === "running" ? (
          <span className="mt-1 flex items-center gap-2">
            <Progress value={job.progress} className="h-1 flex-1 overflow-hidden" />
            <span className="shrink-0 text-[10px] font-semibold tabular-nums text-teal-600 dark:text-teal-400">
              {Math.round(job.progress)}%{eta != null ? ` · ${formatEta(eta)}` : ""}
            </span>
          </span>
        ) : (
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
            {job.result ?? (job.status === "idle" ? "not started" : "—")}
          </span>
        )}
      </span>
      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover/row:translate-x-0.5"
        aria-hidden="true"
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Recent activity feed (cross-project)                                 */
/* ------------------------------------------------------------------ */

/** Shape of GET /api/activity/recent — the latest-touched jobs across ALL
 *  projects. This is the "where did I leave off" strip: a job you ran in
 *  another project this morning shows up here without hunting through the
 *  project grid. */
interface RecentJob {
  id: string;
  name: string;
  type: string;
  status: string;
  progress: number;
  updatedAt: string;
  projectId: string | null;
  projectName: string | null;
}

function RecentActivityFeed({ activeProjectId }: { activeProjectId: string | null }) {
  const setView = useWorkflowStore((s) => s.setView);
  const select = useWorkflowStore((s) => s.select);
  const inspect = useWorkflowStore((s) => s.inspect);
  const switchProject = useWorkflowStore((s) => s.switchProject);
  const jobCount = useWorkflowStore((s) => s.jobs.length);
  const [recent, setRecent] = React.useState<RecentJob[] | null>(null);

  // refetch on mount and whenever the active project's job list moves
  // (run/complete/reorder) — the feed mirrors the same freshness trigger
  // the KPI band uses, so both tell the same story
  React.useEffect(() => {
    let alive = true;
    fetch("/api/activity/recent?limit=8")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { jobs?: RecentJob[] }) => {
        if (alive) setRecent(Array.isArray(d.jobs) ? d.jobs : []);
      })
      .catch(() => {
        /* feed is a convenience, not a dependency — render nothing on failure */
        if (alive) setRecent(null);
      });
    return () => {
      alive = false;
    };
  }, [jobCount]);

  // live tick: while any feed row is running, poll every 4 s so the
  // progress bars sweep and status flips land without a manual refresh;
  // the moment nothing is running the interval dissolves (a static feed
  // must not keep the network warm)
  const hasLive = (recent ?? []).some((j) => j.status === "running");
  React.useEffect(() => {
    if (!hasLive) return;
    const iv = window.setInterval(() => {
      fetch("/api/activity/recent?limit=8")
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((d: { jobs?: RecentJob[] }) => {
          setRecent(Array.isArray(d.jobs) ? d.jobs : []);
        })
        .catch(() => {
          /* keep the last good frame — the next tick retries */
        });
    }, 4000);
    return () => window.clearInterval(iv);
  }, [hasLive]);

  const open = async (j: RecentJob) => {
    // same deep-link semantics as the spotlight: idle jobs get the canvas
    // selection (params editing), anything else opens its results panel;
    // cross-project rows switch the active project first (await load so
    // the job actually exists in the store before we point at it)
    const isLocal = j.projectId != null && j.projectId === activeProjectId;
    if (!isLocal && j.projectId) {
      await switchProject(j.projectId);
    }
    setView("canvas");
    if (j.status === "idle") select(j.id);
    else inspect(j.id);
  };

  if (recent !== null && recent.length === 0) return null;

  return (
    <section
      aria-label="Recent activity across all projects"
      className="card-lift rounded-xl border bg-card px-4 py-3.5 sm:px-5"
    >
      <div className="mb-2 flex items-center gap-2">
        <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-sm font-semibold tracking-tight">Recent activity</h2>
        <span className="text-[11px] text-muted-foreground">across all projects</span>
      </div>
      {recent === null ? (
        <div className="flex flex-wrap gap-1.5" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="h-9 flex-1 basis-56 animate-pulse rounded-lg bg-muted/60" />
          ))}
        </div>
      ) : (
        <div className="grid gap-1 sm:grid-cols-2 xl:grid-cols-4">
          {recent.map((j) => {
            const spec = jobType(j.type);
            const isLocal = j.projectId != null && j.projectId === activeProjectId;
            return (
              <button
                key={j.id}
                type="button"
                onClick={() => void open(j)}
                className="group/row flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-secondary/60"
                title={`Open ${j.name}${!isLocal && j.projectName ? ` in ${j.projectName}` : ""}`}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
                    spec?.color.soft,
                    spec?.color.border
                  )}
                  aria-hidden="true"
                >
                  <TypeIcon name={spec?.icon ?? "Boxes"} className={cn("size-3.5", spec?.color.text)} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[11px] font-semibold">{j.name}</span>
                    <StatusBadge status={j.status} />
                  </span>
                  <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                    {!isLocal && j.projectName ? `${j.projectName} · ` : ""}
                    {formatDistanceToNow(new Date(j.updatedAt), { addSuffix: true })}
                  </span>
                  {j.status === "running" && (
                    <span
                      className="mt-1 flex items-center gap-1.5"
                      aria-label={`Progress ${Math.round(j.progress * 100)}%`}
                    >
                      <span className="h-[3px] min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className="progress-shimmer relative block h-full rounded-full bg-teal-600 transition-[width] duration-700 ease-out"
                          style={{ width: `${Math.min(100, Math.max(2, j.progress * 100))}%` }}
                        />
                      </span>
                      <span className="w-7 shrink-0 text-right font-mono text-[9px] tabular-nums text-muted-foreground">
                        {Math.round(j.progress * 100)}%
                      </span>
                    </span>
                  )}
                </span>
                <ChevronRight
                  className="size-3.5 shrink-0 text-muted-foreground/40 transition-transform group-hover/row:translate-x-0.5"
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ActiveProjectSpotlight() {
  const project = useWorkflowStore((s) => s.project);
  const jobs = useWorkflowStore((s) => s.jobs);
  const setView = useWorkflowStore((s) => s.setView);
  const inspect = useWorkflowStore((s) => s.inspect);
  const select = useWorkflowStore((s) => s.select);

  if (!project) return null;

  const sorted = [...jobs].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const running = sorted.filter((j) => j.status === "running");
  const completed = sorted.filter((j) => j.status === "completed");
  const failed = sorted.filter((j) => j.status === "failed");
  const pending = sorted.filter((j) => j.status === "pending");
  const pct = sorted.length > 0 ? Math.round((completed.length / sorted.length) * 100) : 0;

  const openJob = (job: JobDTO) => {
    setView("canvas");
    if (job.status === "idle") select(job.id);
    else inspect(job.id);
  };

  return (
    <section
      aria-label="Active project spotlight"
      className="card-lift overflow-hidden rounded-xl border bg-card"
    >
      {/* gradient banner */}
      <div className="relative overflow-hidden border-b bg-gradient-to-r from-teal-500/10 via-primary/5 to-transparent px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <Snowflake className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold tracking-tight">{project.name}</h2>
          <Badge
            variant="outline"
            className="h-5 px-1.5 text-[9px] font-semibold uppercase tracking-wider"
          >
            Active
          </Badge>
          <span className="ml-auto text-[11px] text-muted-foreground">
            {completed.length}/{sorted.length} jobs completed · {pct}%
          </span>
        </div>
        <div className="mt-2.5">
          <Progress value={pct} className="h-1.5" />
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {/* stage rail */}
        <div className="mb-2 flex items-center gap-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Pipeline stages
          </p>
          <span className="text-[10px] tabular-nums text-muted-foreground/70">
            {sorted.length}
          </span>
          {running.length > 0 && (
            <Badge
              variant="outline"
              className="ml-auto h-4.5 gap-1 border-teal-500/40 bg-teal-500/10 px-1.5 text-[9px] font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400"
            >
              <Loader2 className="size-2.5 animate-spin" aria-hidden="true" />
              {running.length} running
            </Badge>
          )}
          {pending.length > 0 && (
            <Badge
              variant="outline"
              className={cn(
                "h-4.5 gap-1 border-amber-500/40 bg-amber-500/10 px-1.5 text-[9px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400",
                running.length === 0 && "ml-auto"
              )}
            >
              <Clock className="size-2.5" aria-hidden="true" />
              {pending.length} pending
            </Badge>
          )}
          {failed.length > 0 && (
            <Badge
              variant="outline"
              className={cn(
                "h-4.5 gap-1 border-rose-500/40 bg-rose-500/10 px-1.5 text-[9px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400",
                running.length === 0 && pending.length === 0 && "ml-auto"
              )}
            >
              <CircleAlert className="size-2.5" aria-hidden="true" />
              {failed.length} failed
            </Badge>
          )}
        </div>

        {sorted.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
            No jobs yet — open the workflow and add the first job.
          </p>
        ) : (
          <div className="flex items-stretch gap-1 overflow-x-auto pb-1 nice-scroll">
            {sorted.map((j, i) => (
              <React.Fragment key={j.id}>
                {i > 0 && (
                  <span
                    className="flex items-center text-muted-foreground/40"
                    aria-hidden="true"
                  >
                    <ChevronRight className="size-3.5" />
                  </span>
                )}
                <StageChip job={j} onClick={() => openJob(j)} />
              </React.Fragment>
            ))}
          </div>
        )}

        {/* divider */}
        <div className="my-4 h-px bg-border" />

        {/* live pipeline analytics (particle flow + resolution ladder) */}
        <PipelineAnalytics jobs={sorted} />

        {/* divider */}
        <div className="my-4 h-px bg-border" />

        {/* job list */}
        <div className="mb-2 flex items-center gap-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Jobs
          </p>
          <span className="text-[10px] tabular-nums text-muted-foreground/70">
            newest first
          </span>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto h-7 gap-1 px-2 text-[11px]"
            onClick={() => setView("canvas")}
          >
            <Workflow className="size-3.5" aria-hidden="true" />
            Open workflow
            <ArrowRight className="size-3" aria-hidden="true" />
          </Button>
        </div>
        <div className="max-h-80 space-y-0.5 overflow-y-auto pr-1 nice-scroll">
          {[...sorted].reverse().map((j) => (
            <JobRow key={j.id} job={j} onOpen={() => openJob(j)} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard root                                                       */
/* ------------------------------------------------------------------ */

export function ProjectDashboard() {
  const projectsRaw = useWorkflowStore((s) => s.projects) as ProjectCard[];
  const project = useWorkflowStore((s) => s.project);
  const jobs = useWorkflowStore((s) => s.jobs);
  const system = useWorkflowStore((s) => s.system);
  const switchProject = useWorkflowStore((s) => s.switchProject);
  const setView = useWorkflowStore((s) => s.setView);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<ProjectCard | null>(  null);
  const [deleting, setDeleting] = React.useState(false);
  const [pendingSwitch, setPendingSwitch] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [activity, setActivity] = React.useState<ActivityFeed | null>(null);
  // grid sort — initialized from persisted choice on mount (localStorage
  // read stays out of render per #13 discipline: state init via lazy
  // initializer is fine, it's not a side effect, but storage may not exist
  // during SSR so the effect below re-syncs on the client)
  const [sortKey, setSortKey] = React.useState<ProjectSortKey>("oldest");

  React.useEffect(() => {
    setSortKey(loadSortKey());
  }, []);

  const changeSort = (key: ProjectSortKey) => {
    setSortKey(key);
    try {
      localStorage.setItem(SORT_KEY, key);
    } catch {
      /* storage full/disabled — the session-local choice still applies */
    }
  };

  const deleteProject = useWorkflowStore((s) => s.deleteProject);

  const activeId = project?.id ?? null;
  const onlyProject = projectsRaw.length <= 1;

  // The /api/projects stats snapshot only refreshes on full load() — without
  // this overlay the KPI band lags behind every job mutation (template adds
  // 10 jobs → "Total jobs" stays put until F5). Active project gets live
  // numbers computed from the store's job list (server-identical buckets).
  const projects = React.useMemo(
    () => withLiveStats(projectsRaw, activeId, jobs) as ProjectCard[],
    [projectsRaw, activeId, jobs]
  );

  const totals = React.useMemo(() => {
    let total = 0,
      running = 0,
      pending = 0,
      completed = 0,
      failed = 0;
    for (const p of projects) {
      total += p.stats?.total ?? 0;
      running += p.stats?.running ?? 0;
      pending += p.stats?.pending ?? 0;
      completed += p.stats?.completed ?? 0;
      failed += p.stats?.failed ?? 0;
    }
    return { total, running, pending, completed, failed };
  }, [projects]);

  // KPI sparkline feed — global (all projects) per-day counts. Refetched on
  // mount and whenever the job count changes (template adds / deletes), so
  // the trend tracks the same live-stats layer the numbers come from.
  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/activity?days=14")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: ActivityFeed) => {
        if (!cancelled && Array.isArray(data?.days) && data.days.length > 1) setActivity(data);
      })
      .catch(() => {
        /* sparklines are decorative — a failed fetch just hides them */
      });
    return () => {
      cancelled = true;
    };
  }, [totals.total, totals.completed]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, query]);

  // sort AFTER filter — the count line shows "N / M" for the filtered set
  // and the grid renders the same set in the chosen order
  const sortedProjects = React.useMemo(() => sortProjects(filtered, sortKey), [filtered, sortKey]);

  const openProject = (p: ProjectCard) => {
    if (pendingSwitch) return;
    if (p.id === activeId) {
      setView("canvas");
      return;
    }
    setPendingSwitch(p.id);
    void switchProject(p.id)
      .then(() => setView("canvas"))
      .finally(() => setPendingSwitch(null));
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    await deleteProject(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto nice-scroll">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {/* page header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
              <LayoutDashboard className="size-3.5" aria-hidden="true" />
              Project management
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight sm:text-2xl">
              Dashboard
            </h1>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
              Every cryo-EM workspace at a glance — engine, progress and live pipeline
              health. Open any project to build on its workflow canvas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects…"
                aria-label="Search projects by name"
                className="h-9 w-44 pl-8 text-xs sm:w-56"
              />
            </div>
            <Select value={sortKey} onValueChange={(v) => changeSort(v as ProjectSortKey)}>
              <SelectTrigger
                aria-label="Sort projects"
                className="h-9 w-[7.5rem] text-xs sm:w-36"
                title="Sort the project grid"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_SORTS.map((s) => (
                  <SelectItem key={s.key} value={s.key} className="text-xs">
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" className="h-9 gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" aria-hidden="true" />
              New project
            </Button>
          </div>
        </div>

        {/* KPI band */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <KpiCard
            icon={<FolderGit2 className="size-5" />}
            value={projects.length}
            label="Projects"
            sub={
              activity && activity.projectsInWindow
                ? `+${activity.projectsInWindow} in the last 14 days`
                : onlyProject
                  ? "single workspace"
                  : `${projects.length - 1} others beside active`
            }
            tone="bg-primary/10 text-primary ring-primary/25"
            spark={
              activity?.projects ? (
                <KpiSparkline
                  values={activity.projects}
                  days={activity.days}
                  unit="projects"
                  className="text-primary/70"
                />
              ) : undefined
            }
          />
          <KpiCard
            icon={<Boxes className="size-5" />}
            value={totals.total}
            label="Total jobs"
            sub={
              activity && activity.createdInWindow > 0
                ? `+${activity.createdInWindow} in the last 14 days`
                : "across all projects"
            }
            tone="bg-secondary text-muted-foreground ring-border"
            spark={
              activity ? (
                <KpiSparkline
                  values={activity.total}
                  days={activity.days}
                  unit="jobs"
                  className="text-muted-foreground"
                />
              ) : undefined
            }
          />
          <KpiCard
            icon={<Loader2 className={cn("size-5", totals.running > 0 && "animate-spin")} />}
            value={totals.running}
            label="Running"
            sub={
              totals.pending > 0
                ? `${totals.pending} pending upstream`
                : totals.running > 0
                  ? "live engines active"
                  : "nothing in flight"
            }
            tone="bg-teal-500/10 text-teal-600 ring-teal-500/30 dark:text-teal-400"
          />
          <KpiCard
            icon={<CheckCircle2 className="size-5" />}
            value={totals.completed}
            label="Completed"
            sub={
              activity && activity.completedInWindow > 0
                ? `+${activity.completedInWindow} in the last 14 days`
                : totals.failed > 0
                  ? `${totals.failed} failed`
                  : "zero failures"
            }
            tone="bg-emerald-500/10 text-emerald-600 ring-emerald-500/30 dark:text-emerald-400"
            spark={
              activity ? (
                <KpiSparkline
                  values={activity.completed}
                  days={activity.days}
                  unit="completed"
                  className="text-emerald-500"
                />
              ) : undefined
            }
          />
          <KpiCard
            icon={<Snowflake className="size-5" />}
            value={system?.found ? (system.version ?? "RELION") : "—"}
            label="Active engine"
            sub={
              system?.found
                ? system.execution === "wsl"
                  ? `WSL bridge${system.wsl.distro ? ` · ${system.wsl.distro}` : ""}${(system.installs.length ?? 0) > 1 ? ` · +${system.installs.length - 1} install(s)` : ""}`
                  : `real RELION runs${(system.installs.length ?? 0) > 1 ? ` · +${system.installs.length - 1} install(s)` : ""}`
                : "RELION not detected"
            }
            tone="bg-primary/10 text-primary ring-primary/25"
          />
        </div>

        {/* cross-project recent activity — the "where did I leave off" strip */}
        <div className="mt-6">
          <RecentActivityFeed activeProjectId={activeId} />
        </div>

        {/* active project spotlight */}
        <div className="mt-6">
          <ActiveProjectSpotlight />
        </div>

        {/* projects grid */}
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight">All projects</h2>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {filtered.length}
              {filtered.length !== projects.length ? ` / ${projects.length}` : ""}
            </span>
          </div>

          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-14 text-center">
              <div className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <FolderGit2 className="size-5" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium">No projects yet</p>
              <p className="max-w-xs text-[11px] leading-relaxed text-muted-foreground">
                Create your first cryo-EM workspace to start building a pipeline.
              </p>
              <Button size="sm" className="mt-1 gap-1" onClick={() => setCreateOpen(true)}>
                <Plus className="size-3.5" aria-hidden="true" />
                New project
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="rounded-xl border border-dashed py-10 text-center text-xs text-muted-foreground">
              No project matches “{query.trim()}”.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {sortedProjects.map((p) => (
                <DashboardProjectCard
                  key={p.id}
                  project={p}
                  isActive={p.id === activeId}
                  isPending={pendingSwitch === p.id}
                  onlyProject={onlyProject}
                  onOpen={() => openProject(p)}
                  onRequestDelete={() => setDeleteTarget(p)}
                />
              ))}
            </div>
          )}
        </div>

        {/* footnote */}
        <p className="mt-8 text-center text-[10px] text-muted-foreground/60">
          Project dashboards persist per browser session — switching here never interrupts
          running jobs.
        </p>
      </div>

      {/* dialogs */}
      <NewProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteTarget?.name ?? ""}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the project with all of its jobs, connections and saved
              parameters. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {deleting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
              Delete project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

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
  FolderGit2,
  LayoutDashboard,
  Loader2,
  Pencil,
  Plus,
  Search,
  Snowflake,
  Trash2,
  Workflow,
} from "lucide-react";
import { useWorkflowStore } from "@/lib/store";
import type { JobDTO, ProjectSummaryDTO } from "@/lib/types";
import { jobType } from "@/lib/workflow";
import { TypeIcon } from "./icons";
import { StatusBadge, estimateEta, formatEta } from "./job-card";
import { NewProjectDialog } from "./project-panel";
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

const STATUS_DOT: Record<string, string> = {
  idle: "bg-muted-foreground/40",
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
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
  sub?: string;
  tone: string;
}) {
  return (
    <div className="card-lift flex items-center gap-3 rounded-xl border bg-card p-4">
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
    </div>
  );
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
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(project.name);
  const [renaming, setRenaming] = React.useState(false);

  const stats = project.stats;
  const total = stats?.total ?? 0;
  const done = stats?.completed ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const relion = project.engine === "relion";
  const tomo = project.mode === "tomo";

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
        className={cn(
          "absolute inset-x-0 top-0 h-1",
          relion
            ? "bg-gradient-to-r from-teal-600 via-teal-400 to-teal-600"
            : "bg-gradient-to-r from-slate-400 via-slate-300 to-slate-400"
        )}
      />

      <div className="flex items-start gap-2">
        <span
          className={cn(
            "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
            relion
              ? "bg-teal-500/10 text-teal-600 ring-teal-500/30 dark:text-teal-400"
              : "bg-secondary text-muted-foreground ring-border"
          )}
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

      {/* badges + stats */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge
          variant="outline"
          className={cn(
            "h-5 px-1.5 text-[9px] font-semibold uppercase tracking-wider",
            relion
              ? "border-teal-500/40 bg-teal-500/10 text-teal-600 dark:text-teal-400"
              : "border-slate-400/40 bg-slate-500/10 text-slate-600 dark:text-slate-400"
          )}
        >
          {relion ? "RELION" : "SIM"}
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
          {(stats?.failed ?? 0) > 0 && (
            <span className="flex items-center gap-0.5 text-rose-600 dark:text-rose-400">
              <CircleAlert className="size-3" aria-hidden="true" />
              {stats?.failed}
            </span>
          )}
        </span>
      </div>

      {/* completion progress */}
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[10px] font-medium text-muted-foreground">
          <span className="uppercase tracking-wider">Completion</span>
          <span className="tabular-nums">
            {done}/{total} · {pct}%
          </span>
        </div>
        <Progress value={pct} className="h-1.5" />
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
  const eta =
    job.status === "running" && job.startedAt
      ? estimateEta(job.id, job.startedAt, job.progress)
      : null;

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
  const eta =
    job.status === "running" && job.startedAt
      ? estimateEta(job.id, job.startedAt, job.progress)
      : null;

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
          {failed.length > 0 && (
            <Badge
              variant="outline"
              className={cn(
                "h-4.5 gap-1 border-rose-500/40 bg-rose-500/10 px-1.5 text-[9px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400",
                running.length === 0 && "ml-auto"
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
  const projects = useWorkflowStore((s) => s.projects) as ProjectCard[];
  const project = useWorkflowStore((s) => s.project);
  const switchProject = useWorkflowStore((s) => s.switchProject);
  const setView = useWorkflowStore((s) => s.setView);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<ProjectCard | null>(  null);
  const [deleting, setDeleting] = React.useState(false);
  const [pendingSwitch, setPendingSwitch] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");

  const deleteProject = useWorkflowStore((s) => s.deleteProject);

  const activeId = project?.id ?? null;
  const onlyProject = projects.length <= 1;

  const totals = React.useMemo(() => {
    let total = 0,
      running = 0,
      completed = 0,
      failed = 0;
    for (const p of projects) {
      total += p.stats?.total ?? 0;
      running += p.stats?.running ?? 0;
      completed += p.stats?.completed ?? 0;
      failed += p.stats?.failed ?? 0;
    }
    return { total, running, completed, failed };
  }, [projects]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, query]);

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
            sub={onlyProject ? "single workspace" : `${projects.length - 1} others beside active`}
            tone="bg-primary/10 text-primary ring-primary/25"
          />
          <KpiCard
            icon={<Boxes className="size-5" />}
            value={totals.total}
            label="Total jobs"
            sub="across all projects"
            tone="bg-secondary text-muted-foreground ring-border"
          />
          <KpiCard
            icon={<Loader2 className={cn("size-5", totals.running > 0 && "animate-spin")} />}
            value={totals.running}
            label="Running"
            sub={totals.running > 0 ? "live engines active" : "nothing in flight"}
            tone="bg-teal-500/10 text-teal-600 ring-teal-500/30 dark:text-teal-400"
          />
          <KpiCard
            icon={<CheckCircle2 className="size-5" />}
            value={totals.completed}
            label="Completed"
            sub={totals.failed > 0 ? `${totals.failed} failed` : "zero failures"}
            tone="bg-emerald-500/10 text-emerald-600 ring-emerald-500/30 dark:text-emerald-400"
          />
          <KpiCard
            icon={<Snowflake className="size-5" />}
            value={project?.engine === "relion" ? "RELION" : "SIM"}
            label="Active engine"
            sub={project?.engine === "relion" ? "real RELION runs" : "time simulation"}
            tone="bg-primary/10 text-primary ring-primary/25"
          />
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
              {filtered.map((p) => (
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

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
  ChevronsDown,
  ChevronsUp,
  CircleAlert,
  Clock,
  FolderGit2,
  FolderInput,
  Layers,
  LayoutDashboard,
  Loader2,
  Minus,
  Pencil,
  Plus,
  Search,
  Snowflake,
  StickyNote,
  Trash2,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Workflow,
  Filter,
  Mountain,
  X,
} from "lucide-react";
import { useWorkflowStore } from "@/lib/store";
import { parseClassNotes, hasJudgment } from "@/lib/class-notes";
import { withLiveStats } from "@/lib/live-stats";
import { PENDING_VIEW_KEY } from "@/lib/view-link";
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
import { toast } from "@/hooks/use-toast";
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
  onClick,
  pressed,
  hint,
  kbd,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
  label: string;
  sub?: string;
  tone: string;
  /** optional 14-day trend sparkline — inherits the card tone (currentColor) */
  spark?: React.ReactNode;
  /** when present the whole card drills down into the grid — rendered as a
   *  real button so keyboard users get the same affordance for free */
  onClick?: () => void;
  /** active filter state for clickable cards (aria-pressed) */
  pressed?: boolean;
  /** one-line hint under the label — what clicking will do */
  hint?: string;
  /** dashboard drill-down shortcut digit — corner badge replaces the hover
   *  chevron and wires aria-keyshortcuts on the button */
  kbd?: string;
}) {
  const interactive = typeof onClick === "function";
  const body = (
    <>
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
        {/* truncate is a SCREEN economy — on paper the card has room and no
            hover to recover hidden text, so labels/subs unwrap to full
            width (Task 85: the paper contract expands what the screen
            clips); title keeps screen hover recovery honest */}
        <p
          title={label}
          className="truncate print:whitespace-normal print:overflow-visible text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
        >
          {label}
        </p>
        {sub ? (
          <p
            title={sub}
            className="truncate print:whitespace-normal print:overflow-visible text-[10px] text-muted-foreground/70"
          >
            {sub}
          </p>
        ) : null}
      </div>
      {/* sparkline as a bottom-right watermark: decorative trend that never
          squeezes the text column (in-flow placement truncated "TOTAL JOBS"
          to "TO…" at lg width) — pointer-events-none so it can't block */}
      {spark ? (
        <div className="pointer-events-none absolute bottom-1.5 right-2.5 opacity-80">
          {spark}
        </div>
      ) : null}
      {/* drill-down affordances: a corner chevron whispers "clickable", the
          pressed dot states "this card IS the active filter" — both sit
          above the spark watermark so they never fight for attention */}
      {interactive && !pressed ? (
        kbd ? (
          // shortcut badge: faintly visible at rest (discoverability — the
          // chevron was hover-only), brightens on hover; inherits border
          // color from currentColor so it reads on every card tone
          <kbd
            className="no-print pointer-events-none absolute right-1.5 top-1.5 rounded border px-1 text-[9px] font-semibold leading-[14px] text-muted-foreground/40 transition-colors motion-reduce:transition-none group-hover/kpi:text-muted-foreground/80"
            aria-hidden="true"
          >
            {kbd}
          </kbd>
        ) : (
          <ChevronRight
            className="no-print pointer-events-none absolute right-1.5 top-1.5 size-3 text-muted-foreground/0 transition-colors motion-reduce:transition-none group-hover/kpi:text-muted-foreground/60"
            aria-hidden="true"
          />
        )
      ) : null}
      {pressed ? (
        // no-print: "this filter is ON" is live screen state — a paper
        // reader can't press anything, and a stamped pulse dot would read
        // as a defect in the toner
        <span
          className="no-print pointer-events-none absolute right-2 top-2 flex items-center gap-0.5"
          aria-hidden="true"
        >
          <span className="size-1.5 animate-pulse rounded-full bg-primary motion-reduce:animate-none" />
          <Filter className="size-2.5 text-primary" />
        </span>
      ) : null}
    </>
  );

  const shell = cn(
    "card-lift group/kpi relative flex items-center gap-3 overflow-hidden rounded-xl border bg-card p-4 text-left transition-[box-shadow,border-color,background-color]",
    interactive
      ? pressed
        ? "cursor-pointer border-primary/50 ring-1 ring-primary/30"
        : "cursor-pointer hover:border-primary/40 hover:shadow-md"
      : "border-border"
  );

  if (!interactive) return <div className={shell}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={Boolean(pressed)}
      aria-keyshortcuts={kbd}
      title={hint ?? "Filter the project grid below"}
      className={cn(shell, "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1")}
    >
      {body}
    </button>
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
      <div className="no-print mt-4 flex items-center gap-1.5">
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
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 hover-none:opacity-100">
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
/* Saved-views gallery (cross-project)                                  */
/* ------------------------------------------------------------------ */

/** Shape of GET /api/views/gallery — every 3D view bookmark across all
 *  projects. The "my inspection work" shelf: an angle hunted in one
 *  project shows up here without remembering which job it lived on. */
interface GalleryBookmark {
  id: string;
  name: string;
  ts: number;
  thumb?: string;
  view?: {
    sigma?: number;
    slice?: { on?: boolean; axis?: string; pos?: number };
    clip?: { on?: boolean; x?: number; y?: number; z?: number };
  };
}

interface GalleryEntry {
  projectId: string | null;
  projectName: string | null;
  jobId: string;
  jobName: string;
  jobType: string;
  jobStatus: string;
  updatedAt: string;
  bookmarks: GalleryBookmark[];
}

/** mini optical chips — the same three-tone language as the viewer's
 *  bookmark rows (muted σ / teal slice / amber clip), sized for a wall */
function GalleryViewChips({ b }: { b: GalleryBookmark }) {
  const v = b.view;
  if (!v || typeof v.sigma !== "number") {
    return (
      <span className="rounded bg-muted px-1 py-px font-mono text-[8px] font-medium text-muted-foreground">
        pose
      </span>
    );
  }
  return (
    <>
      <span className="rounded bg-muted px-1 py-px font-mono text-[8px] font-medium tabular-nums text-muted-foreground">
        {v.sigma.toFixed(2)} σ
      </span>
      {v.slice?.on && (
        <span className="rounded bg-teal-600/10 px-1 py-px font-mono text-[8px] font-medium text-teal-700 dark:text-teal-400">
          slice {(v.slice.axis ?? "Z").toUpperCase()}
        </span>
      )}
      {v.clip?.on && (
        <span className="rounded bg-amber-600/10 px-1 py-px font-mono text-[8px] font-medium text-amber-700 dark:text-amber-400">
          clip
        </span>
      )}
    </>
  );
}

function SavedViewsGallery({ activeProjectId }: { activeProjectId: string | null }) {
  const switchProject = useWorkflowStore((s) => s.switchProject);
  const setView = useWorkflowStore((s) => s.setView);
  const inspect = useWorkflowStore((s) => s.inspect);
  const select = useWorkflowStore((s) => s.select);
  const jobCount = useWorkflowStore((s) => s.jobs.length);
  const [views, setViews] = React.useState<GalleryEntry[] | null>(null);
  // the wall is a glance by default (12 cards); "Show all" expands it to
  // the full flat list without leaving the dashboard — state survives
  // refetches, and a shrinking collection just renders fewer cards
  const [showAllViews, setShowAllViews] = React.useState(false);

  // same freshness trigger as the recent feed: mount + whenever the
  // active project's job list moves (a saved view appearing/disappearing
  // rides the same commit path as a job mutation)
  React.useEffect(() => {
    let alive = true;
    fetch("/api/views/gallery")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { views?: GalleryEntry[] }) => {
        if (alive)
          setViews(
            Array.isArray(d.views) ? d.views.filter((v) => v.bookmarks.length > 0) : []
          );
      })
      .catch(() => {
        /* the wall is a convenience, not a dependency — hide on failure */
        if (alive) setViews(null);
      });
    return () => {
      alive = false;
    };
  }, [jobCount]);

  if (views === null || views.length === 0) return null;

  const total = views.reduce((n, v) => n + v.bookmarks.length, 0);
  const flat: Array<{ v: GalleryEntry; b: GalleryBookmark }> = [];
  for (const v of views) for (const b of v.bookmarks) flat.push({ v, b });
  // 12 cards keep the section a glance, not a scroll; the overflow button
  // says honestly how many more exist and expands in place (the viewer
  // bookmark lists remain the full-featured home for every view)
  const WALL_CAP = 12;
  const wall = showAllViews ? flat : flat.slice(0, WALL_CAP);

  const jump = async (v: GalleryEntry, b: GalleryBookmark) => {
    // one-shot handoff: the viewer consumes this once its bookmark list
    // has loaded and flies to the view (fresh intent overwrites stale)
    try {
      sessionStorage.setItem(
        PENDING_VIEW_KEY,
        JSON.stringify({ jobId: v.jobId, bookmarkId: b.id })
      );
    } catch {
      /* private mode — the deep link still lands on the job */
    }
    if (v.projectId && v.projectId !== activeProjectId) {
      await switchProject(v.projectId);
    }
    setView("canvas");
    if (v.jobStatus === "idle") select(v.jobId);
    else inspect(v.jobId);
  };

  return (
    <section
      aria-label="Saved 3D views across all projects"
      className="card-lift rounded-xl border bg-card px-4 py-3.5 sm:px-5"
    >
      <div className="mb-2 flex items-center gap-2">
        <Mountain className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-sm font-semibold tracking-tight">Saved views</h2>
        <span className="text-[11px] text-muted-foreground">
          {total} bookmark{total === 1 ? "" : "s"} · {views.length} job{views.length === 1 ? "" : "s"} · click to jump
        </span>
      </div>
      <div id="saved-views-wall" data-atomic-grid className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {wall.map(({ v, b }) => {
          const spec = jobType(v.jobType);
          return (
            <button
              key={`${v.jobId}:${b.id}`}
              type="button"
              onClick={() => void jump(v, b)}
              title={`Open “${b.name}” — jumps to ${v.jobName}${v.projectName ? ` in ${v.projectName}` : ""} and restores the view in the 3D viewer`}
              className="group/card flex min-w-0 items-center gap-2.5 rounded-lg border bg-card p-2 text-left transition-all motion-reduce:transition-none hover:border-primary/40 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <span
                className="relative h-11 w-16 shrink-0 overflow-hidden rounded-md border bg-muted"
                aria-hidden="true"
              >
                {b.thumb ? (
                  <img src={b.thumb} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Mountain className="absolute inset-0 m-auto size-4 text-muted-foreground/40" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[11px] font-semibold" title={b.name}>
                    {b.name}
                  </span>
                  <GalleryViewChips b={b} />
                </span>
                <span className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-muted-foreground">
                  <span
                    className={cn(
                      "flex size-3.5 shrink-0 items-center justify-center rounded ring-1 ring-inset",
                      spec?.color.soft,
                      spec?.color.border
                    )}
                    aria-hidden="true"
                  >
                    <TypeIcon name={spec?.icon ?? "Boxes"} className={cn("size-2.5", spec?.color.text)} />
                  </span>
                  <span className="truncate">
                    {v.jobName}
                    {v.projectName ? ` · ${v.projectName}` : ""}
                  </span>
                </span>
              </span>
              <ChevronRight
                className="size-3.5 shrink-0 text-muted-foreground/40 transition-transform group-hover/card:translate-x-0.5"
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
      {flat.length > WALL_CAP && (
        <button
          type="button"
          onClick={() => setShowAllViews((v) => !v)}
          aria-expanded={showAllViews}
          aria-controls="saved-views-wall"
          title={
            showAllViews
              ? "Collapse the wall back to the first 12 cards"
              : `Expand the wall to all ${flat.length} saved views — ${flat.length - WALL_CAP} more sit behind the cap`
          }
          className="mt-2 inline-flex items-center gap-1 rounded text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          {showAllViews ? (
            <ChevronsUp className="size-3" aria-hidden="true" />
          ) : (
            <ChevronsDown className="size-3" aria-hidden="true" />
          )}
          {showAllViews ? "Show less" : `Show all ${flat.length} bookmarks`}
        </button>
      )}
    </section>
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

/**
 * Task 82 — "carries a human judgment" spans BOTH annotation granularities:
 * the job note (a margin note on the step, Task 73) and select2d class
 * notes (margin notes on the decisions INSIDE the step, Task 80). The
 * Noted chip, the Noted filter slice and the dashboard 5-key all read
 * this one predicate, so pointer, filter and keyboard can never disagree
 * about what "noted" means.
 * (Task 83: the predicate itself now lives in lib/class-notes.ts — the
 * canvas spotlight lens and the header spotlight chip read the same
 * source, so the dashboard and the canvas cannot drift apart.)
 */

function JobRow({ job, onOpen }: { job: JobDTO; onOpen: () => void }) {
  const spec = jobType(job.type);
  const running = job.status === "running" && job.startedAt != null;
  const eta = running ? estimateEta(job.id, job.startedAt, job.progress) : null;
  React.useEffect(() => {
    if (running) trackEtaBaseline(job.id, job.startedAt, job.progress);
  }, [running, job.id, job.startedAt, job.progress]);

  const workspaces = useWorkflowStore((s) => s.workspaces);
  const moveJob = useWorkflowStore((s) => s.moveJob);
  const wsName = workspaces.find((w) => w.id === job.workspaceId)?.name ?? null;
  const defaultWs = workspaces[0] ?? null;
  // An orphan is a pre-workspace-era job (or one whose workspace row was
  // removed server-side): it shows in this roster but sits on NO canvas, so
  // deep-linking would land on an invisible card. Only meaningful once the
  // project HAS workspaces — in a workspace-less project the canvas renders
  // every job, so there is nothing to explain.
  const orphan = !job.workspaceId && workspaces.length > 0;
  const [adopting, setAdopting] = React.useState(false);
  // class-level annotations (Task 80) aggregated at row level (Task 82):
  // a select2d job whose classes carry margin notes shows an amber count
  // pill next to the status. The icon-only job-note twin reads "this STEP
  // is annotated"; the count pill reads "the decisions INSIDE the step are
  // annotated". Tolerant parse — a corrupted param must never take the
  // roster down (same contract as the gallery and the palette).
  const classNotes = Object.entries(parseClassNotes(job.params.classNotes));
  const open = () => {
    if (orphan) {
      toast({
        title: "Not on any canvas",
        description: `${job.name} predates workspaces — adopt it into ${defaultWs?.name ?? "a workspace"} to see it on the workflow canvas.`,
      });
      return;
    }
    onOpen();
  };
  const adopt = async () => {
    if (!defaultWs || adopting) return;
    setAdopting(true);
    const ok = await moveJob(job.id, defaultWs.id);
    setAdopting(false);
    if (ok) {
      toast({
        title: `Adopted into ${defaultWs.name}`,
        description: `${job.name} is now visible on that canvas.`,
      });
    }
  };

  // The row used to be a single <button>; the adopt action would nest a
  // button inside it (invalid HTML, hydration warnings) — so the row is a
  // div and the open affordance is an inner button, with adopt as sibling.
  return (
    // data-roster-row: the semantic-unit hook (Task 80 lesson — count ROWS,
    // not buttons or children) — the roster's table scaffolding makes
    // "direct children" fragile, so suites anchor here instead
    <div
      data-roster-row=""
      className="group/row flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-secondary/60"
    >
      <button
        type="button"
        onClick={open}
        title={orphan ? "Adopt this job to see it on a canvas" : `Open ${job.name}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left"
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
            {job.note ? (
              // the row-level twin of the canvas badge (Task 73): amber
              // StickyNote, full text on hover, .no-print — the dashboard's
              // paper flow is a management summary, the annotation's official
              // paper channel stays the canvas sheet's excerpt line
              <span
                data-row-note-badge
                role="img"
                aria-label="Job has a note"
                title={job.note}
                className="no-print shrink-0 text-amber-500 dark:text-amber-400"
              >
                <StickyNote className="size-3" aria-hidden="true" />
              </span>
            ) : null}
            {classNotes.length > 0 ? (
              // .no-print: same paper rationale as the job-note badge — the
              // paper roster is a management summary; the notes' official
              // channels stay the gallery editor and the palette (80/81).
              <span
                data-row-classnotes-badge
                data-row-classnotes-count={classNotes.length}
                role="img"
                aria-label={`${classNotes.length} class${classNotes.length === 1 ? "" : "es"} noted`}
                title={`Class notes on ${classNotes.map(([k]) => `Class ${k}`).join(", ")}`}
                className="no-print flex h-4 shrink-0 items-center gap-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 text-[9px] font-semibold tabular-nums text-amber-600 dark:text-amber-400"
              >
                <StickyNote className="size-2.5" aria-hidden="true" />
                {classNotes.length}
              </span>
            ) : null}
            {wsName ? (
              // workspace attribution (Task 77): the roster spans every
              // workspace of the project while the canvas renders ONE —
              // without this chip "which canvas is it on?" is a guessing
              // game. A row FACT (not interactive chrome), so unlike the
              // filter row it prints.
              <span
                data-row-ws={wsName}
                title={`Workspace: ${wsName}`}
                className="flex h-4 shrink-0 items-center gap-0.5 rounded-full border border-border/70 bg-muted/40 px-1.5 text-[9px] font-medium text-muted-foreground"
              >
                <Layers className="size-2.5" aria-hidden="true" />
                <span className="max-w-20 truncate">{wsName}</span>
              </span>
            ) : null}
            {orphan ? (
              <span
                data-row-orphan
                role="img"
                aria-label="Job not assigned to any workspace"
                title={`Not on any canvas — adopt it into ${defaultWs?.name ?? "a workspace"} to make it visible`}
                className="flex h-4 shrink-0 items-center gap-0.5 rounded-full border border-dashed border-amber-500/50 bg-amber-500/5 px-1.5 text-[9px] font-semibold text-amber-600 dark:text-amber-400"
              >
                <TriangleAlert className="size-2.5" aria-hidden="true" />
                Unassigned
              </span>
            ) : null}
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
      </button>
      {orphan && defaultWs ? (
        // one-click fix for the "dashboard says it exists, the canvas can't
        // see it" inconsistency: the orphan moves into the project's default
        // workspace (the same home deleted workspaces fall back to), and the
        // row's badge flips from dashed Unassigned to the workspace name.
        // .no-print: a paper roster can't adopt anything.
        <button
          type="button"
          data-adopt
          aria-label={`Adopt into ${defaultWs.name}`}
          title={`Move to ${defaultWs.name} — makes the job visible on that canvas`}
          onClick={adopt}
          disabled={adopting}
          className="no-print flex h-5 shrink-0 items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 text-[9px] font-semibold uppercase tracking-wider text-amber-600 transition-colors hover:bg-amber-500/20 disabled:opacity-50 dark:text-amber-400"
        >
          {adopting ? (
            <Loader2 className="size-2.5 animate-spin" aria-hidden="true" />
          ) : (
            <FolderInput className="size-2.5" aria-hidden="true" />
          )}
          Adopt
        </button>
      ) : null}
      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover/row:translate-x-0.5"
        aria-hidden="true"
      />
    </div>
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

/** Tiny progress-history sparkline for a running feed row — answers "is it
 *  actually moving or quietly stalled" at a glance, without opening the
 *  job. Normalized to the OBSERVED window (not 0–100): a slow steady crawl
 *  should read as a slope, not a flat line at the bottom. Latest point is
 *  emphasized — that is where the job is now.
 *
 *  Tooltip: the native `title` only works on hover devices, so a tap /
 *  pointer-down pops a small inverted chip (samples seen, first→latest
 *  progress, trend arrow) that auto-dismisses — touch users get the same
 *  "what am I looking at" answer hover users do. */
function ProgressSparkline({ values, samples }: { values: number[]; samples: number }) {
  const [tip, setTip] = React.useState(false);
  const tipTimer = React.useRef<number | null>(null);
  const popTip = () => {
    setTip(true);
    if (tipTimer.current) window.clearTimeout(tipTimer.current);
    tipTimer.current = window.setTimeout(() => setTip(false), 2000);
  };
  const hideTip = () => {
    setTip(false);
    if (tipTimer.current) {
      window.clearTimeout(tipTimer.current);
      tipTimer.current = null;
    }
  };
  React.useEffect(() => hideTip, []); // unmount — never setState after

  const W = 40;
  const H = 12;
  const PAD = 1.5;
  let pts: string[] = [];
  if (values.length >= 2) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(max - min, 0.02); // ≥2% window so one-step jumps don't pin to the edges
    pts = values.map((v, i) => {
      const x = PAD + (i / (values.length - 1)) * (W - PAD * 2);
      const y = H - PAD - ((v - min) / span) * (H - PAD * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
  }
  const last = pts.length > 0 ? pts[pts.length - 1].split(",").map(Number) : null;
  // progress values are FRACTIONS (0–1) — every percent label here scales ×100
  const pct = (v: number) => Math.round(v * 100);
  const firstV = values[0];
  const lastV = values[values.length - 1];
  const delta = values.length >= 2 && firstV != null && lastV != null ? lastV - firstV : null;
  const Trend = delta == null || Math.abs(delta) < 0.005 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
  const tipText =
    values.length >= 2
      ? `${samples} samples · ${pct(firstV)}%→${pct(lastV)}%`
      : `${samples} sample${samples === 1 ? "" : "s"} so far`;
  return (
    <span
      className="relative inline-flex shrink-0 text-teal-600 dark:text-teal-400"
      title={`Progress history — last ${samples} sample${samples === 1 ? "" : "s"}, oldest → newest`}
      role="img"
      aria-label={`Progress history, ${tipText}`}
      onPointerDown={(e) => {
        // the row is a navigation button — a tap on the trend must pop the
        // chip, not yank the user off the dashboard mid-glance
        e.stopPropagation();
        popTip();
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseLeave={hideTip}
    >
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="block">
        {pts.length >= 2 ? (
          <>
            <polyline
              points={pts.join(" ")}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.45}
              strokeWidth={1}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {last && <circle cx={last[0]} cy={last[1]} r={1.7} fill="currentColor" />}
          </>
        ) : (
          <circle cx={W / 2} cy={H / 2} r={1.5} fill="currentColor" className="animate-pulse" />
        )}
      </svg>
      {tip && (
        <span
          className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-md bg-foreground px-1.5 py-0.5 font-mono text-[9px] font-medium tabular-nums text-background shadow-md"
          role="status"
        >
          {tipText}
          {delta != null && (
            <span
              className={cn(
                "inline-flex items-center gap-px",
                delta > 0 && "text-emerald-500 dark:text-emerald-400",
                delta < 0 && "text-red-500 dark:text-red-400",
                Math.abs(delta) < 0.005 && "opacity-60",
              )}
            >
              <Trend className="size-2.5" />
              {delta >= 0 ? "+" : ""}
              {Math.round(delta * 100)}%
            </span>
          )}
        </span>
      )}
    </span>
  );
}

function RecentActivityFeed({ activeProjectId }: { activeProjectId: string | null }) {
  const setView = useWorkflowStore((s) => s.setView);
  const select = useWorkflowStore((s) => s.select);
  const inspect = useWorkflowStore((s) => s.inspect);
  const switchProject = useWorkflowStore((s) => s.switchProject);
  const jobCount = useWorkflowStore((s) => s.jobs.length);
  const [recent, setRecent] = React.useState<RecentJob[] | null>(null);
  // per-job progress history (client-side, lives as long as the feed does):
  // each fetch folds the fresh progress values in, so the sparkline in a
  // running row shows the trend ACROSS polls, not just the current frame
  const [hist, setHist] = React.useState<Map<string, number[]>>(() => new Map());

  /** fold one fetch frame into the history — appends each job's progress,
   *  prunes rows that left the feed, and restarts the series when progress
   *  moves BACKWARDS (re-run after completion), which would otherwise draw
   *  a misleading sawtooth */
  const absorb = (jobs: RecentJob[]) => {
    setHist((prev) => {
      const next = new Map<string, number[]>();
      for (const j of jobs) {
        const prevArr = prev.get(j.id) ?? [];
        const last = prevArr[prevArr.length - 1];
        const arr = last != null && j.progress < last - 0.05 ? [j.progress] : [...prevArr, j.progress].slice(-24);
        next.set(j.id, arr);
      }
      return next;
    });
  };

  // refetch on mount and whenever the active project's job list moves
  // (run/complete/reorder) — the feed mirrors the same freshness trigger
  // the KPI band uses, so both tell the same story
  React.useEffect(() => {
    let alive = true;
    fetch("/api/activity/recent?limit=8")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { jobs?: RecentJob[] }) => {
        if (alive) {
          setRecent(Array.isArray(d.jobs) ? d.jobs : []);
          absorb(Array.isArray(d.jobs) ? d.jobs : []);
        }
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
          const arr = Array.isArray(d.jobs) ? d.jobs : [];
          setRecent(arr);
          absorb(arr);
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
                      <ProgressSparkline values={hist.get(j.id) ?? []} samples={(hist.get(j.id) ?? []).length} />
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

/** status filter chip for the spotlight Jobs list — single-select, the
 *  count rides along so the chips double as a mini status bar; active chip
 *  fills with the status tone, inactive stays a ghost outline */
function StatusFilterChip({
  label,
  n,
  active,
  tone,
  onClick,
  kbd,
  icon,
  dataFilter,
}: {
  label: string;
  n: number;
  active: boolean;
  tone?: "teal" | "amber" | "emerald" | "rose";
  onClick: () => void;
  /** matching dashboard shortcut digit — tiny inline badge + aria */
  kbd?: string;
  /** optional leading glyph — the Noted chip carries the StickyNote mark
   *  so the eye reads "annotation filter", not a sixth status */
  icon?: React.ReactNode;
  /** e2e hook — stable identity for a chip regardless of label copy */
  dataFilter?: string;
}) {
  const toneCls =
    tone === "teal"
      ? "border-teal-500/40 bg-teal-500/10 text-teal-600 dark:text-teal-400"
      : tone === "amber"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : tone === "emerald"
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : tone === "rose"
            ? "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400"
            : "border-foreground/25 bg-foreground text-background";
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-keyshortcuts={kbd}
      data-filter={dataFilter}
      onClick={onClick}
      title={`Show ${label.toLowerCase()} job${n === 1 ? "" : "s"} only${kbd ? ` — or press ${kbd}` : ""}`}
      className={cn(
        "h-5 rounded-full border px-1.5 text-[9px] font-semibold uppercase tracking-wider transition-colors",
        active ? toneCls : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {icon}
      {label} <span className="tabular-nums opacity-70">{n}</span>
      {kbd ? (
        // currentColor border keeps the badge legible in both the active
        // tone and the muted rest state; hidden on the smallest screens
        // where the tap targets are thumb-reachable anyway
        <kbd
          className="ml-0.5 hidden rounded-[3px] border px-[3px] text-[8px] font-bold normal-case leading-[11px] sm:inline-block"
          aria-hidden="true"
        >
          {kbd}
        </kbd>
      ) : null}
    </button>
  );
}

function ActiveProjectSpotlight({
  jobFilter,
  setJobFilter,
}: {
  jobFilter: JobFilter;
  setJobFilter: React.Dispatch<React.SetStateAction<JobFilter>>;
}) {
  const project = useWorkflowStore((s) => s.project);
  const jobs = useWorkflowStore((s) => s.jobs);
  const workspaces = useWorkflowStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkflowStore((s) => s.activeWorkspaceId);
  const switchWorkspace = useWorkflowStore((s) => s.switchWorkspace);
  const setView = useWorkflowStore((s) => s.setView);
  const inspect = useWorkflowStore((s) => s.inspect);
  const select = useWorkflowStore((s) => s.select);
  // status filter for the Jobs list — chips double as a mini status bar;
  // "all" is the default so the section reads exactly as before until used.
  // "noted" (Task 76) is the property filter: it answers "which jobs carry
  // a human judgment" — since Task 82 that spans BOTH granularities (job
  // notes AND class notes, via hasJudgment). "unassigned" (Task 77) is the
  // location filter: it answers "which rows live on NO canvas" — the
  // cleanup queue for orphans. State lives in ProjectDashboard (Task 78)
  // so keys 5/6 can drive it.

  if (!project) return null;

  const sorted = [...jobs].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const running = sorted.filter((j) => j.status === "running");
  const completed = sorted.filter((j) => j.status === "completed");
  const failed = sorted.filter((j) => j.status === "failed");
  const pending = sorted.filter((j) => j.status === "pending");
  const idleCount = sorted.filter((j) => j.status === "idle").length;
  const noted = sorted.filter(hasJudgment);
  // orphans only exist as a PROBLEM once the project has workspaces (before
  // that the canvas renders every job, so nothing is invisible) — same
  // condition the row badge uses
  const unassigned = workspaces.length > 0 ? sorted.filter((j) => !j.workspaceId) : [];
  const visibleJobs =
    jobFilter === "all"
      ? sorted
      : jobFilter === "noted"
        ? noted
        : jobFilter === "unassigned"
          ? unassigned
          : sorted.filter((j) => j.status === jobFilter);
  const pct = sorted.length > 0 ? Math.round((completed.length / sorted.length) * 100) : 0;

  const openJob = (job: JobDTO) => {
    // deep-link repair (Task 77): the canvas renders ONE workspace — a row
    // from another workspace must switch the canvas first, or the view lands
    // on an inspector over a card that isn't there. Orphans have no
    // workspace to switch to; JobRow intercepts their click with guidance
    // before onOpen is ever reached.
    if (job.workspaceId && job.workspaceId !== activeWorkspaceId) {
      switchWorkspace(job.workspaceId);
    }
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
        {/* Task 84: the whole label row is screen chrome — on paper the
            roster's identity (Jobs · N · newest first) is carried by the
            REAL <thead> band inside the table below, which repeats on every
            printed page. Printing both would say "Jobs" twice on page 1. */}
        <div className="no-print mb-2 flex items-center gap-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Jobs
          </p>
          <span className="text-[10px] tabular-nums text-muted-foreground/70">
            newest first
          </span>
          <Button
            size="sm"
            variant="outline"
            // .no-print (Task 79): navigation CTA — paper has no view to
            // switch to, the roster itself is the document
            className="no-print ml-auto h-7 gap-1 px-2 text-[11px]"
            onClick={() => setView("canvas")}
          >
            <Workflow className="size-3.5" aria-hidden="true" />
            Open workflow
            <ArrowRight className="size-3" aria-hidden="true" />
          </Button>
        </div>
        {sorted.length > 0 && (
          // .no-print: filter chips are interactive chrome — on paper the
          // job list reads as a plain roster, not a filtered slice (a print
          //out that says "Noted 2" without the lens would be confusing)
          <div className="no-print mb-1.5 flex flex-wrap items-center gap-1" role="group" aria-label="Filter jobs by status">
            <StatusFilterChip label="All" n={sorted.length} active={jobFilter === "all"} onClick={() => setJobFilter("all")} />
            {running.length > 0 && (
              <StatusFilterChip label="Running" n={running.length} tone="teal" active={jobFilter === "running"} onClick={() => setJobFilter("running")} />
            )}
            {pending.length > 0 && (
              <StatusFilterChip label="Pending" n={pending.length} tone="amber" active={jobFilter === "pending"} onClick={() => setJobFilter("pending")} />
            )}
            {completed.length > 0 && (
              <StatusFilterChip label="Completed" n={completed.length} tone="emerald" active={jobFilter === "completed"} onClick={() => setJobFilter("completed")} />
            )}
            {failed.length > 0 && (
              <StatusFilterChip label="Failed" n={failed.length} tone="rose" active={jobFilter === "failed"} onClick={() => setJobFilter("failed")} />
            )}
            {idleCount > 0 && (
              <StatusFilterChip label="Idle" n={idleCount} active={jobFilter === "idle"} onClick={() => setJobFilter("idle")} />
            )}
            {noted.length > 0 && (
              <StatusFilterChip
                label="Noted"
                n={noted.length}
                tone="amber"
                active={jobFilter === "noted"}
                onClick={() => setJobFilter(jobFilter === "noted" ? "all" : "noted")}
                dataFilter="noted"
                kbd="5"
                icon={<StickyNote className="size-2.5" aria-hidden="true" />}
              />
            )}
            {unassigned.length > 0 && (
              <StatusFilterChip
                label="Unassigned"
                n={unassigned.length}
                tone="amber"
                active={jobFilter === "unassigned"}
                onClick={() => setJobFilter(jobFilter === "unassigned" ? "all" : "unassigned")}
                dataFilter="unassigned"
                kbd="6"
                icon={<TriangleAlert className="size-2.5" aria-hidden="true" />}
              />
            )}
          </div>
        )}
        <div className="max-h-80 overflow-y-auto pr-1 nice-scroll">
          {visibleJobs.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
              No {jobFilter === "all" ? "" : `${jobFilter} `}jobs in this project yet.
            </p>
          ) : (
            /* Task 84 — the roster is a REAL table. On screen the table
               scaffolding is neutralized to plain blocks (globals.css), so
               the rows look exactly as they did as a div list; in print the
               scaffolding becomes a genuine table, and ONLY a genuine <thead>
               repeats across pages (probe t84-table-probe2: display:table
               divs and generated tables do NOT repeat their header groups —
               that is why this stayed suspended through Tasks 79-83). The
               band carries the roster's identity (count + sort order) on
               every printed page; on screen it is hidden and the label row
               above speaks instead. */
            <table data-roster-table className="w-full">
              <thead data-roster-head className="hidden print:table-header-group">
                <tr>
                  <th
                    colSpan={1}
                    className="border-b border-border px-2.5 pb-1.5 pt-0 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    Jobs · {visibleJobs.length} · newest first
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...visibleJobs].reverse().map((j) => (
                  <tr key={j.id}>
                    <td>
                      <JobRow job={j} onOpen={() => openJob(j)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Dashboard root                                                       */
/* ------------------------------------------------------------------ */

/** grid drill-down filter — which slice of the project grid a KPI card
 *  click reveals. Presence-based ("has ≥1 running job"), not per-job: the
 *  grid's unit is the project. */
type GridFilter = "all" | "running" | "completed" | "failed";

/** spotlight Jobs-list filter (Task 76/78) — "noted" and "unassigned" are
 *  property filters, the rest are statuses. Hoisted to ProjectDashboard so
 *  the 5/6 dashboard keys can drive it (same owner as the 1–4 grid keys). */
type JobFilter =
  | "all"
  | "running"
  | "pending"
  | "completed"
  | "failed"
  | "idle"
  | "noted"
  | "unassigned";

export function ProjectDashboard() {
  const projectsRaw = useWorkflowStore((s) => s.projects) as ProjectCard[];
  const project = useWorkflowStore((s) => s.project);
  const jobs = useWorkflowStore((s) => s.jobs);
  const workspaces = useWorkflowStore((s) => s.workspaces);
  const system = useWorkflowStore((s) => s.system);
  const switchProject = useWorkflowStore((s) => s.switchProject);
  const setView = useWorkflowStore((s) => s.setView);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<ProjectCard | null>(  null);
  const [deleting, setDeleting] = React.useState(false);
  const [pendingSwitch, setPendingSwitch] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [activity, setActivity] = React.useState<ActivityFeed | null>(null);
  // KPI drill-down: which presence filter the project grid is narrowed by.
  // Clicking the Running/Completed KPI card toggles it AND scrolls the grid
  // into view — the summary above and the detail below act as one surface.
  const [gridFilter, setGridFilter] = React.useState<GridFilter>("all");
  const gridRef = React.useRef<HTMLDivElement | null>(null);
  const [gridFlash, setGridFlash] = React.useState(false);
  // grid sort — initialized from persisted choice on mount (localStorage
  // read stays out of render per #13 discipline: state init via lazy
  // initializer is fine, it's not a side effect, but storage may not exist
  // during SSR so the effect below re-syncs on the client)
  const [sortKey, setSortKey] = React.useState<ProjectSortKey>("oldest");

  // spotlight Jobs-list filter — hoisted from ActiveProjectSpotlight so the
  // 5/6 keys below drive the SAME state the chips render (keyboard and
  // pointer share one source of truth)
  const [jobFilter, setJobFilter] = React.useState<JobFilter>("all");

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
    let base = q ? projects.filter((p) => p.name.toLowerCase().includes(q)) : projects;
    if (gridFilter === "running") base = base.filter((p) => (p.stats?.running ?? 0) > 0);
    else if (gridFilter === "completed") base = base.filter((p) => (p.stats?.completed ?? 0) > 0);
    else if (gridFilter === "failed") base = base.filter((p) => (p.stats?.failed ?? 0) > 0);
    return base;
  }, [projects, query, gridFilter]);

  // presence counts per project — the chip counts next to the grid header
  const presence = React.useMemo(
    () => ({
      running: projects.filter((p) => (p.stats?.running ?? 0) > 0).length,
      completed: projects.filter((p) => (p.stats?.completed ?? 0) > 0).length,
      failed: projects.filter((p) => (p.stats?.failed ?? 0) > 0).length,
    }),
    [projects]
  );

  /** KPI → grid drill-down: apply the filter, then bring the grid into view
   *  with a one-shot highlight ring so the eye lands where the effect is. */
  const drillToGrid = (f: GridFilter) => {
    setGridFilter(f);
    requestAnimationFrame(() => {
      gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setGridFlash(true);
      window.setTimeout(() => setGridFlash(false), 1400);
    });
  };
  const toggleGridFilter = (f: Exclude<GridFilter, "all">) =>
    drillToGrid(gridFilter === f ? "all" : f);

  // Grid filter keyboard shortcuts (1–4) + Jobs-list filter keys (5/6,
  // Task 78): each key mirrors its visible counterpart — 1 the whole grid
  // (Projects KPI), 2/3/4 the running/completed/failed drill-downs (KPI
  // cards and presence chips), 5 the Noted property filter, 6 the
  // Unassigned location filter. 5/6 toggle: the key again returns to all —
  // and both are HONEST DEAD KEYS when their slice is empty (no phantom
  // empty state; the chip is hidden at zero and the key does nothing).
  // The ref indirection keeps the window subscription stable while the
  // handler reads fresh state every render.
  const shortcutsRef = React.useRef<(e: KeyboardEvent) => void>(() => {});
  React.useEffect(() => {
    shortcutsRef.current = (e: KeyboardEvent) => {
      // browsers own Ctrl/Cmd+digit (tab switching) — never fight them
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key;
      if (key !== "1" && key !== "2" && key !== "3" && key !== "4" && key !== "5" && key !== "6") return;
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.closest("input, textarea, select, [contenteditable='true']") != null ||
          target.isContentEditable)
      ) {
        return;
      }
      // an open dialog / menu owns the keyboard — same guard as page.tsx
      if (
        document.querySelector(
          '[role="dialog"][data-state="open"], [role="menu"][data-state="open"]'
        )
      )
        return;
      if (projectsRaw.length === 0) return;
      if (key === "1") drillToGrid("all");
      else if (key === "2") toggleGridFilter("running");
      else if (key === "3") toggleGridFilter("completed");
      else if (key === "4") toggleGridFilter("failed");
      else if (key === "5") {
        // same predicate the Noted chip filters by — job notes AND class
        // notes (Task 82): one definition, two entry points
        if (jobs.some(hasJudgment)) {
          setJobFilter((f) => (f === "noted" ? "all" : "noted"));
        }
      } else if (key === "6") {
        // same condition the Unassigned chip uses: orphans only exist as a
        // filterable slice once the project HAS workspaces
        if (workspaces.length > 0 && jobs.some((j) => !j.workspaceId)) {
          setJobFilter((f) => (f === "unassigned" ? "all" : "unassigned"));
        }
      }
    };
  });
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => shortcutsRef.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

        {/* KPI band — Running / Completed cards are live drill-downs into the
            grid below (pressed = that filter is on); Projects reals the grid
            and clears; Total jobs & engine stay informational (no project
            dimension to reveal) */}
        <div data-atomic-grid className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
            onClick={() => drillToGrid("all")}
            kbd="1"
            hint="Show the whole project grid — clears any status filter (press 1)"
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
            onClick={() => toggleGridFilter("running")}
            pressed={gridFilter === "running"}
            kbd="2"
            hint={
              gridFilter === "running"
                ? "Filter on — click or press 2 to show every project again"
                : "Show only projects with running jobs — or press 2"
            }
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
            onClick={() => toggleGridFilter("completed")}
            pressed={gridFilter === "completed"}
            kbd="3"
            hint={
              gridFilter === "completed"
                ? "Filter on — click or press 3 to show every project again"
                : "Show only projects with completed jobs — or press 3"
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

        {/* cross-project saved views — the "my inspection work" shelf */}
        <div className="mt-6">
          <SavedViewsGallery activeProjectId={activeId} />
        </div>

        {/* active project spotlight */}
        <div className="mt-6">
          <ActiveProjectSpotlight jobFilter={jobFilter} setJobFilter={setJobFilter} />
        </div>

        {/* projects grid */}
        <div
          ref={gridRef}
          className={cn(
            "mt-6 scroll-mt-4 rounded-xl transition-shadow duration-700 motion-reduce:transition-none",
            gridFlash && "ring-2 ring-primary/40 ring-offset-4 ring-offset-background"
          )}
        >
          <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <h2 className="text-sm font-semibold tracking-tight">All projects</h2>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {filtered.length}
              {filtered.length !== projects.length ? ` / ${projects.length}` : ""}
            </span>
            {/* presence chips — same visual language as the spotlight's job
                filters, but the unit is the project; counts show how many
                projects carry each kind of work */}
            {projects.length > 0 && (
              <div className="ml-auto flex items-center gap-1" role="group" aria-label="Filter projects by job presence">
                <StatusFilterChip
                  label="All"
                  n={projects.length}
                  active={gridFilter === "all"}
                  onClick={() => setGridFilter("all")}
                  kbd="1"
                />
                {presence.running > 0 && (
                  <StatusFilterChip
                    label="Running"
                    n={presence.running}
                    tone="teal"
                    active={gridFilter === "running"}
                    onClick={() => toggleGridFilter("running")}
                    kbd="2"
                  />
                )}
                {presence.completed > 0 && (
                  <StatusFilterChip
                    label="Completed"
                    n={presence.completed}
                    tone="emerald"
                    active={gridFilter === "completed"}
                    onClick={() => toggleGridFilter("completed")}
                    kbd="3"
                  />
                )}
                {presence.failed > 0 && (
                  <StatusFilterChip
                    label="Failed"
                    n={presence.failed}
                    tone="rose"
                    active={gridFilter === "failed"}
                    onClick={() => toggleGridFilter("failed")}
                    kbd="4"
                  />
                )}
              </div>
            )}
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
            query.trim() ? (
              <p className="rounded-xl border border-dashed py-10 text-center text-xs text-muted-foreground">
                No project matches “{query.trim()}”.
              </p>
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-10 text-center">
                <p className="text-xs text-muted-foreground">
                  No project with {gridFilter} jobs right now.
                </p>
                <Button size="sm" variant="outline" className="h-7 gap-1 text-[11px]" onClick={() => setGridFilter("all")}>
                  <X className="size-3" aria-hidden="true" />
                  Clear filter
                </Button>
              </div>
            )
          ) : (
            <div data-atomic-grid className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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

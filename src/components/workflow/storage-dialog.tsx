"use client";

/**
 * StorageDialog — t436: the project storage overview.
 *
 * "How much disk is this project using, and which run is the whale?"
 * The per-job cleanup dialog (t331) speaks bytes but lives inside one
 * job's inspector; this panel lifts the whole project into one view —
 * physical truth walked from data/relion/<projectId>/ (the DB is only
 * metadata here: an orphaned run directory still shows, flagged).
 *
 * Honesty surfaces:
 *   - categories are extension-honest (a .mrc is a Map regardless of
 *     which job wrote it) — the legend says so, the hints explain;
 *   - a truncated walk says "numbers are floors" (the cap is real);
 *   - orphans wear amber and cannot jump to an inspector (there is
 *     none — no job record points at that directory);
 *   - the numbers are stamped with their fetch time and the panel
 *     never pretends to auto-refresh: the disk changes under the user,
 *     the Refresh button is the truth.
 *
 * Row click → that job's inspector (where the per-job Clean button
 * lives — this panel is the map, the inspector is the shovel).
 *
 * t437 — the lens gets teeth: the category chips are now doors. Clicking
 * one drills from the run level to the FILE level (the heaviest files of
 * that category, the route walks them out), with the same row grammar —
 * a bar in the category's color, an inspector jump for rows whose run
 * has a record, amber honesty for the ones that don't.
 *
 * t441 — the shovel comes to visit: the map stops being a bystander.
 *   - an eraser door on every run row (runs table AND the lens's feeding-
 *     runs view) opens the SAME tiered CleanupDialog in place — the run
 *     is the planner's unit, so the door lives on run rows only;
 *   - after a clean the board re-walks and prints the delta as the WALK's
 *     own account (before/after totals, never the planner's word), with
 *     the compared walk's fetch time named so a stale snapshot cannot
 *     quietly inflate the claim;
 *   - the lens grows a second view: feeding RUNS (who holds this
 *     category's bytes, heaviest first) beside the whale FILES.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Eraser,
  HardDrive,
  Loader2,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { useWorkflowStore } from "@/lib/store";
import {
  STORAGE_CATEGORIES,
  fmtBytes,
  type StorageCategoryId,
} from "@/lib/relion/disk-usage";
import {
  formatCleanReceipt,
  isCleanableStatus,
  runsForCategory,
  walkDelta,
} from "@/lib/storage-clean";
import type { JobDTO } from "@/lib/types";
import { CleanupDialog } from "./cleanup-dialog";

/** the route's response contract, mirrored client-side (the family keeps
 *  route types out of client imports — same shape as PicksBoardResponse) */
interface StorageJobRow {
  jobId: string | null;
  name: string;
  type: string;
  status: string;
  dirName: string;
  bytes: number;
  files: number;
  categories: Record<StorageCategoryId, { bytes: number; files: number }>;
  truncated: boolean;
  exists: boolean;
}

interface StorageFileRow {
  path: string;
  bytes: number;
  category: StorageCategoryId;
  dirName: string;
}

interface StorageTopFileRow extends StorageFileRow {
  jobId: string | null;
  jobName: string | null;
}

interface StorageResponse {
  projectId: string;
  projectName: string;
  totalBytes: number;
  totalFiles: number;
  jobs: StorageJobRow[];
  byCategory: Record<StorageCategoryId, { bytes: number; files: number }>;
  topFiles: StorageTopFileRow[];
  truncated: boolean;
  hasRuns: boolean;
  generatedAt: string;
}

/** deterministic category palette — teal family for the cryo surfaces,
 *  violet for the stacks (the whales), neutrals for the paper trail */
const CATEGORY_COLORS: Record<StorageCategoryId, string> = {
  maps: "bg-teal-500",
  stacks: "bg-violet-500",
  tables: "bg-sky-500",
  logs: "bg-slate-400 dark:bg-slate-600",
  plots: "bg-amber-500",
  other: "bg-zinc-400 dark:bg-zinc-600",
};

const CATEGORY_TEXT: Record<StorageCategoryId, string> = {
  maps: "text-teal-700 dark:text-teal-300",
  stacks: "text-violet-700 dark:text-violet-300",
  tables: "text-sky-700 dark:text-sky-300",
  logs: "text-slate-600 dark:text-slate-400",
  plots: "text-amber-700 dark:text-amber-300",
  other: "text-zinc-600 dark:text-zinc-400",
};

type JobSort = "heaviest" | "name";

/**
 * t441 — the eraser door on a run row: opens the SAME tiered CleanupDialog
 * the inspector hosts. The door mirrors the server's own live-run law as a
 * courtesy pre-filter (a running/pending run's files are being written);
 * the dialog's planner remains the authority. Rose on hover — the shovel
 * is the one destructive affordance on this board, and it should look it.
 */
function CleanDoor({
  name,
  status,
  onOpen,
}: {
  name: string;
  status: string;
  onOpen: () => void;
}) {
  const blocked = !isCleanableStatus(status);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      disabled={blocked}
      onClick={onOpen}
      className="size-7 shrink-0 rounded-md text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
      aria-label={
        blocked
          ? `${name} is ${status} — cleanup waits until it finishes`
          : `Clean ${name} intermediates`
      }
      title={
        blocked
          ? `${name} is still ${status} — its files are being written; Clean waits for the run to finish`
          : `Clean ${name}'s intermediates — the tiered preview opens right here, no inspector trip needed`
      }
    >
      <Eraser className="size-3.5" aria-hidden="true" />
    </Button>
  );
}

function sortJobs(
  jobs: StorageResponse["jobs"],
  key: JobSort
): StorageResponse["jobs"] {
  const sorted = [...jobs];
  if (key === "name") {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
  } else {
    // the API's own order (bytes desc, dirName tiebreak) — stable reuse
    sorted.sort((a, b) => b.bytes - a.bytes || a.dirName.localeCompare(b.dirName));
  }
  return sorted;
}

export default function StorageDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const project = useWorkflowStore((s) => s.project);
  const inspect = useWorkflowStore((s) => s.inspect);
  const [data, setData] = React.useState<StorageResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [jobSort, setJobSort] = React.useState<JobSort>("heaviest");
  /** t437: the file lens — a category chip clicked through to the file
   *  level. null = the runs table (the map of runs); a category id = that
   *  category's heaviest files. Survives a Refresh (it is a view, not
   *  data) but is forgotten when the dialog closes. */
  const [lens, setLens] = React.useState<StorageCategoryId | null>(null);
  /** t441: the lens's second view — whale FILES (the heaviest individual
   *  files) or feeding RUNS (who holds this category's bytes). A view,
   *  not data: survives a Refresh, forgotten on close with the lens. */
  const [lensView, setLensView] = React.useState<"files" | "runs">("files");
  /** t441: the clean bridge — the run whose tiered cleanup is open, the
   *  pre-clean walk (total + fetch time) the receipt compares against,
   *  and the receipt line itself. All forgotten when the dialog closes. */
  const storeJobs = useWorkflowStore((s) => s.jobs);
  const [cleanJob, setCleanJob] = React.useState<JobDTO | null>(null);
  const preClean = React.useRef<{ total: number; walkedAt: string } | null>(null);
  const [receipt, setReceipt] = React.useState<string | null>(null);

  const projectId = project?.id ?? null;

  const load = React.useCallback(async (): Promise<number | null> => {
    if (!projectId) return null;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/storage`);
      const body: unknown = await res.json();
      if (!res.ok || (body as { error?: string }).error) {
        setError(
          (body as { error?: string }).error ?? `HTTP ${res.status}`
        );
        setData(null);
        return null;
      } else {
        const fresh = body as StorageResponse;
        setData(fresh);
        return fresh.totalBytes;
      }
    } catch {
      setError("The storage walk failed — is the server reachable?");
      setData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    if (open && projectId) void load();
    if (!open) {
      // a closed dialog forgets the snapshot — next open walks the disk afresh
      setData(null);
      setError(null);
      setLens(null);
      setLensView("files");
      setReceipt(null);
      preClean.current = null;
      setCleanJob(null);
    }
  }, [open, projectId, load]);

  /* ---- the clean bridge (t441): the shovel comes to visit the map ----
   * The door hands the run to the SAME tiered CleanupDialog the inspector
   * hosts (one eraser in this app, never a second one); the receipt waits
   * for the fresh walk and speaks only in the walk's own arithmetic. */
  const openClean = React.useCallback(
    (jobId: string) => {
      const job = storeJobs.find((j) => j.id === jobId) ?? null;
      if (!job) return;
      preClean.current = data
        ? {
            total: data.totalBytes,
            walkedAt: new Date(data.generatedAt).toLocaleTimeString(),
          }
        : null;
      setCleanJob(job);
    },
    [storeJobs, data]
  );

  const handleCleaned = React.useCallback(async () => {
    const job = cleanJob;
    const before = preClean.current;
    preClean.current = null;
    const after = await load();
    if (!job) return;
    if (after === null) {
      setReceipt(
        `Cleaned ${job.name} — the fresh walk failed; Refresh re-counts when the board answers`
      );
      return;
    }
    setReceipt(
      formatCleanReceipt(
        job.name,
        walkDelta(before?.total ?? null, after),
        before?.walkedAt
      )
    );
  }, [cleanJob, load]);

  const jobs = data ? sortJobs(data.jobs, jobSort) : [];
  const maxBytes = jobs.length > 0 ? Math.max(...jobs.map((j) => j.bytes), 1) : 1;
  const totalBytes = data?.totalBytes ?? 0;
  const catList = data
    ? STORAGE_CATEGORIES.map((meta) => ({
        ...meta,
        ...(data.byCategory[meta.id] ?? { bytes: 0, files: 0 }),
        share: totalBytes > 0 ? ((data.byCategory[meta.id]?.bytes ?? 0) / totalBytes) * 100 : 0,
      }))
    : [];

  /* ---- the file lens (t437): the active category's heaviest files ---- */
  const lensFiles = React.useMemo(
    () => (data && lens ? data.topFiles.filter((f) => f.category === lens) : []),
    [data, lens]
  );
  const lensMeta = lens ? (catList.find((c) => c.id === lens) ?? null) : null;
  /** t441: the feeding-runs view — one category, sorted by who holds it. */
  const lensRuns = React.useMemo(
    () => (data && lens ? runsForCategory(data.jobs, lens) : []),
    [data, lens]
  );
  const lensRunsMaxBytes =
    lensRuns.length > 0 ? Math.max(...lensRuns.map((r) => r.catBytes), 1) : 1;
  const lensMaxBytes =
    lensFiles.length > 0 ? Math.max(...lensFiles.map((f) => f.bytes), 1) : 1;
  const lensTotalFiles = lens && data ? (data.byCategory[lens]?.files ?? 0) : 0;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b bg-gradient-to-r from-primary/[0.07] to-transparent px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <HardDrive className="size-4 text-primary" aria-hidden="true" />
            Project storage
          </DialogTitle>
          <DialogDescription>
            What {project?.name ?? "this project"} keeps on disk — the whales first.
            Categories are read from file extensions; the walk is the physical truth.
            Eraser doors clean a run in place; the numbers re-walk after.
          </DialogDescription>
        </DialogHeader>

        <div className="nice-scroll flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <div className="flex flex-col items-start gap-3 rounded-lg border border-rose-500/30 bg-rose-500/[0.06] p-4">
              <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
              <Button variant="outline" size="sm" onClick={() => void load()}>
                <RotateCcw className="size-3.5" aria-hidden="true" /> Try again
              </Button>
            </div>
          ) : !data ? (
            <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Walking the run directories…
            </div>
          ) : (
            <>
              {/* ---- the summary: total + fetched-at + refresh ---- */}
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Total on disk
                  </p>
                  <p className="text-2xl font-semibold tabular-nums tracking-tight">
                    {fmtBytes(data.totalBytes)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {data.totalFiles.toLocaleString()} file{data.totalFiles === 1 ? "" : "s"} across{" "}
                    {data.jobs.length} run director{data.jobs.length === 1 ? "y" : "ies"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    fetched {new Date(data.generatedAt).toLocaleTimeString()}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void load()}
                    disabled={loading}
                    aria-label="Refresh storage numbers"
                  >
                    <RefreshCw
                      className={`size-3.5${loading ? " animate-spin" : ""}`}
                      aria-hidden="true"
                    />
                    Refresh
                  </Button>
                </div>
              </div>

              {/* ---- t441: the clean receipt — the walk's own account of
                   the last clean. Printed only from the fresh reload, so
                   the line is always about the numbers now on screen. */}
              {receipt && (
                <p
                  data-storage-receipt=""
                  className="mt-3 flex items-start gap-2 rounded-lg border border-teal-500/30 bg-teal-500/[0.06] px-3 py-2 text-xs text-teal-700 dark:text-teal-300"
                >
                  <Eraser className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  {receipt}
                </p>
              )}

              {/* ---- the category lens: one stacked bar + lens chips ----
                   t437: a chip is now a door — clicking it drills from the
                   run level into the file level of that category. The bar
                   dims every segment the lens is not looking at. */}
              {totalBytes > 0 ? (
                <div className="mt-4">
                  <div
                    className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
                    role="img"
                    aria-label="Disk usage by file category"
                  >
                    {catList.map(
                      (c) =>
                        c.share > 0 && (
                          <div
                            key={c.id}
                            className={`${CATEGORY_COLORS[c.id]} transition-opacity duration-300 ${
                              lens && lens !== c.id ? "opacity-25" : "opacity-100"
                            }`}
                            style={{ width: `${c.share}%` }}
                            title={`${c.label} — ${fmtBytes(c.bytes)} (${c.share.toFixed(0)}%)`}
                          />
                        )
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1">
                    {catList.map(
                      (c) =>
                        c.bytes > 0 && (
                          <button
                            key={c.id}
                            type="button"
                            aria-pressed={lens === c.id}
                            onClick={() => setLens(lens === c.id ? null : c.id)}
                            className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs transition-colors ${
                              CATEGORY_TEXT[c.id]
                            } ${
                              lens === c.id
                                ? "bg-muted font-semibold ring-1 ring-inset ring-border"
                                : lens
                                  ? "opacity-60 hover:opacity-100 hover:bg-muted/40"
                                  : "hover:bg-muted/40"
                            }`}
                            title={`${c.hint} — click to drill into the heaviest ${c.label.toLowerCase()} files`}
                          >
                            <span
                              className={`inline-block size-2 rounded-full ${CATEGORY_COLORS[c.id]}`}
                              aria-hidden="true"
                            />
                            {c.label} {fmtBytes(c.bytes)}
                            <span className="text-muted-foreground">
                              ({c.share.toFixed(0)}%)
                            </span>
                          </button>
                        )
                    )}
                  </div>
                </div>
              ) : (
                <p className="mt-4 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                  {data.hasRuns
                    ? "The run directories are all empty — nothing to weigh yet."
                    : "This project has not run anything on this machine yet — no bytes to report."}
                </p>
              )}

              {/* ---- the per-run table (the lens's home view) ---- */}
              {!lens && jobs.length > 0 && (
                <div className="mt-5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Runs
                    </p>
                    <div className="flex items-center gap-1" role="group" aria-label="Sort runs">
                      {(["heaviest", "name"] as const).map((key) => (
                        <Button
                          key={key}
                          variant="ghost"
                          size="sm"
                          aria-pressed={jobSort === key}
                          className={`h-6 px-2 text-[11px] capitalize ${
                            jobSort === key
                              ? "border border-primary/50 bg-primary/[0.06] text-primary"
                              : "border border-transparent text-muted-foreground"
                          }`}
                          onClick={() => setJobSort(key)}
                        >
                          {key === "heaviest" ? "Heaviest first" : "By name"}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <ul className="mt-2 divide-y divide-border/60">
                    {jobs.map((job) => {
                      const orphan = job.jobId === null;
                      const cleanRowJob =
                        !orphan && job.jobId
                          ? storeJobs.find((j) => j.id === job.jobId)
                          : undefined;
                      const top = STORAGE_CATEGORIES.map((m) => ({
                        id: m.id,
                        ...(job.categories[m.id] ?? { bytes: 0, files: 0 }),
                      }))
                        .filter((c) => c.bytes > 0)
                        .sort((a, b) => b.bytes - a.bytes)[0];
                      return (
                        <li key={job.dirName} className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={orphan}
                            onClick={() => {
                              if (!job.jobId) return;
                              inspect(job.jobId);
                              onOpenChange(false);
                            }}
                            className={`flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors ${
                              orphan
                                ? "cursor-default bg-amber-500/[0.05]"
                                : "hover:bg-muted/40"
                            }`}
                            title={
                              orphan
                                ? "No job record points at this directory — a deleted job's leftover, an older server's run, or a shared asset directory (like the project's micrograph store)"
                                : `Open ${job.name}'s inspector — or use the eraser to clean it in place`
                            }
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {job.name}
                                {orphan && (
                                  <span className="ml-2 rounded border border-amber-500/40 bg-amber-500/10 px-1 py-px text-[10px] font-medium text-amber-700 dark:text-amber-300">
                                    no job record
                                  </span>
                                )}
                              </p>
                              <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                                {job.dirName} · {job.type} · {job.status}
                              </p>
                            </div>
                            <div className="w-28 shrink-0 sm:w-36">
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-primary/70"
                                  style={{ width: `${Math.max((job.bytes / maxBytes) * 100, job.bytes > 0 ? 2 : 0)}%` }}
                                />
                              </div>
                              <p className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">
                                {top ? (
                                  <>
                                    mostly <span className={CATEGORY_TEXT[top.id]}>{top.id}</span>
                                  </>
                                ) : (
                                  "—"
                                )}
                              </p>
                            </div>
                            <div className="w-20 shrink-0 text-right sm:w-24">
                              <p className="text-sm font-medium tabular-nums">
                                {fmtBytes(job.bytes)}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {job.files.toLocaleString()} file{job.files === 1 ? "" : "s"}
                              </p>
                            </div>
                          </button>
                          {cleanRowJob && (
                            <CleanDoor
                              name={job.name}
                              status={cleanRowJob.status}
                              onOpen={() => {
                                if (!job.jobId) return;
                                openClean(job.jobId);
                              }}
                            />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* ---- the file lens (t437): one category's heaviest files ----
                   The runs table names the whale RUNS; this names the whale
                   FILES inside them — the actual bytes a Clean would free.
                   Same row grammar as the runs table: a bar in the lens's
                   own color, a jump to the inspector where the shovel
                   lives, amber honesty for rows with no job record. */}
              {lens && lensMeta && (
                <div className="mt-5" aria-label={`${lensMeta.label} file lens`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {lensView === "files" ? "Files" : "Runs"} · {lensMeta.label}
                    </p>
                    <div className="flex items-center gap-1">
                      {/* t441: the lens's second view — the same category
                          read by RUN (who feeds the whale) instead of by
                          FILE (the whale's teeth). Same grammar as the
                          runs-table sort pair. */}
                      <div
                        className="flex items-center gap-1"
                        role="group"
                        aria-label={`${lensMeta.label} lens view`}
                      >
                        {(["files", "runs"] as const).map((v) => (
                          <Button
                            key={v}
                            variant="ghost"
                            size="sm"
                            aria-pressed={lensView === v}
                            className={`h-6 px-2 text-[11px] ${
                              lensView === v
                                ? "border border-primary/50 bg-primary/[0.06] text-primary"
                                : "border border-transparent text-muted-foreground"
                            }`}
                            onClick={() => setLensView(v)}
                          >
                            {v === "files" ? "Whale files" : "Feeding runs"}
                          </Button>
                        ))}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 border border-transparent px-2 text-[11px] text-muted-foreground"
                        onClick={() => setLens(null)}
                      >
                        <ArrowLeft className="size-3" aria-hidden="true" />
                        All runs
                      </Button>
                    </div>
                  </div>

                  <div className="mt-2 rounded-lg border border-border/70 bg-muted/20 p-3">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span
                        className={`inline-block size-2.5 shrink-0 self-center rounded-full ${CATEGORY_COLORS[lens]}`}
                        aria-hidden="true"
                      />
                      <p className="text-sm font-semibold">{lensMeta.label}</p>
                      <p className="text-sm tabular-nums text-muted-foreground">
                        {fmtBytes(lensMeta.bytes)} · {lensMeta.share.toFixed(0)}% of the project
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{lensMeta.hint}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {lensView === "files"
                        ? lensFiles.length === 0
                          ? "no files above zero bytes — the lens is empty"
                          : lensTotalFiles > lensFiles.length
                            ? `the heaviest ${lensFiles.length} of ${lensTotalFiles.toLocaleString()} file${
                                lensTotalFiles === 1 ? "" : "s"
                              } — the whales' whales`
                            : `all ${lensTotalFiles.toLocaleString()} file${
                                lensTotalFiles === 1 ? "" : "s"
                              } in this category`
                        : lensRuns.length === 0
                          ? "no run holds bytes here yet — the lens is empty"
                          : `${lensRuns.length} run${lensRuns.length === 1 ? "" : "s"} feed${
                              lensRuns.length === 1 ? "s" : ""
                            } this category — heaviest first`}
                    </p>

                    {lensView === "files" ? (
                      lensFiles.length > 0 ? (
                      <ul className="mt-2 divide-y divide-border/60">
                        {lensFiles.map((f) => {
                          const orphan = f.jobId === null;
                          return (
                            <li key={f.path}>
                              <button
                                type="button"
                                disabled={orphan}
                                onClick={() => {
                                  if (!f.jobId) return;
                                  inspect(f.jobId);
                                  onOpenChange(false);
                                }}
                                className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors ${
                                  orphan
                                    ? "cursor-default bg-amber-500/[0.05]"
                                    : "hover:bg-muted/40"
                                }`}
                                title={
                                  orphan
                                    ? "No job record points at this file's run directory — nothing to inspect"
                                    : `Open ${f.jobName}'s inspector (its Clean intermediates button lives there)`
                                }
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-mono text-xs" title={f.path}>
                                    {f.path}
                                  </p>
                                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                    {orphan ? (
                                      <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1 py-px text-[10px] font-medium text-amber-700 dark:text-amber-300">
                                        no job record · {f.dirName}
                                      </span>
                                    ) : (
                                      f.jobName
                                    )}
                                  </p>
                                </div>
                                <div className="w-24 shrink-0 sm:w-32">
                                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                    <div
                                      className={`h-full rounded-full ${CATEGORY_COLORS[lens]}`}
                                      style={{
                                        width: `${Math.max((f.bytes / lensMaxBytes) * 100, 2)}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                                <div className="w-20 shrink-0 text-right sm:w-24">
                                  <p className="text-sm font-medium tabular-nums">
                                    {fmtBytes(f.bytes)}
                                  </p>
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                      ) : (
                        <p className="mt-2 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                          Nothing above zero bytes in this category — the disk
                          moved on since the fetch; Refresh re-walks it.
                        </p>
                      )
                    ) : lensRuns.length > 0 ? (
                      <ul
                        className="mt-2 divide-y divide-border/60"
                        aria-label={`Runs holding ${lensMeta.label.toLowerCase()} bytes`}
                      >
                        {lensRuns.map((r) => {
                          const orphan = r.jobId === null;
                          const cleanRowJob =
                            !orphan && r.jobId
                              ? storeJobs.find((j) => j.id === r.jobId)
                              : undefined;
                          return (
                            <li key={r.dirName} className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={orphan}
                                onClick={() => {
                                  if (!r.jobId) return;
                                  inspect(r.jobId);
                                  onOpenChange(false);
                                }}
                                className={`flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors ${
                                  orphan
                                    ? "cursor-default bg-amber-500/[0.05]"
                                    : "hover:bg-muted/40"
                                }`}
                                title={
                                  orphan
                                    ? `No job record points at this directory — ${r.dirName} holds ${fmtBytes(r.catBytes)} of the ${lensMeta.label.toLowerCase()} but has no inspector`
                                    : `Open ${r.name}'s inspector — ${fmtBytes(r.catBytes)} of ${lensMeta.label.toLowerCase()} lives here`
                                }
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">
                                    {r.name}
                                    {orphan && (
                                      <span className="ml-2 rounded border border-amber-500/40 bg-amber-500/10 px-1 py-px text-[10px] font-medium text-amber-700 dark:text-amber-300">
                                        no job record
                                      </span>
                                    )}
                                  </p>
                                  <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">
                                    {r.dirName} · {r.type} · {r.status}
                                  </p>
                                </div>
                                <div className="w-24 shrink-0 sm:w-32">
                                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                    <div
                                      className={`h-full rounded-full ${CATEGORY_COLORS[lens]}`}
                                      style={{
                                        width: `${Math.max((r.catBytes / lensRunsMaxBytes) * 100, 2)}%`,
                                      }}
                                    />
                                  </div>
                                  <p className="mt-1 text-right text-[11px] tabular-nums text-muted-foreground">
                                    {lensMeta.bytes > 0
                                      ? `${((r.catBytes / lensMeta.bytes) * 100).toFixed(0)}% of the lens`
                                      : "—"}
                                  </p>
                                </div>
                                <div className="w-20 shrink-0 text-right sm:w-24">
                                  <p className="text-sm font-medium tabular-nums">
                                    {fmtBytes(r.catBytes)}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {r.catFiles.toLocaleString()} file{r.catFiles === 1 ? "" : "s"}
                                  </p>
                                </div>
                              </button>
                              {cleanRowJob && (
                                <CleanDoor
                                  name={r.name}
                                  status={cleanRowJob.status}
                                  onOpen={() => {
                                    if (!r.jobId) return;
                                    openClean(r.jobId);
                                  }}
                                />
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="mt-2 rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                        Nothing above zero bytes in this category — the disk
                        moved on since the fetch; Refresh re-walks it.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {data.truncated && (
                <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-3 text-xs text-amber-700 dark:text-amber-300">
                  The walk hit its entry cap — the numbers above are floors, not totals.
                </p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {/* t441 — the visiting shovel: the SAME tiered CleanupDialog the
        inspector hosts, mounted only while a run is on the table. Its
        onCleaned triggers the fresh walk and the walk's own receipt. */}
    {cleanJob && (
      <CleanupDialog
        job={cleanJob}
        open
        onOpenChange={(v) => {
          if (!v) setCleanJob(null);
        }}
        onCleaned={() => void handleCleaned()}
      />
    )}
    </>
  );
}

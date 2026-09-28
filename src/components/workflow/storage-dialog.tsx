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
import { HardDrive, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import { useWorkflowStore } from "@/lib/store";
import {
  STORAGE_CATEGORIES,
  fmtBytes,
  type StorageCategoryId,
} from "@/lib/relion/disk-usage";

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

interface StorageResponse {
  projectId: string;
  projectName: string;
  totalBytes: number;
  totalFiles: number;
  jobs: StorageJobRow[];
  byCategory: Record<StorageCategoryId, { bytes: number; files: number }>;
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

  const projectId = project?.id ?? null;

  const load = React.useCallback(async () => {
    if (!projectId) return;
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
      } else {
        setData(body as StorageResponse);
      }
    } catch {
      setError("The storage walk failed — is the server reachable?");
      setData(null);
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
    }
  }, [open, projectId, load]);

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

  return (
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

              {/* ---- the category lens: one stacked bar + chips ---- */}
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
                            className={CATEGORY_COLORS[c.id]}
                            style={{ width: `${c.share}%` }}
                            title={`${c.label} — ${fmtBytes(c.bytes)} (${c.share.toFixed(0)}%)`}
                          />
                        )
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    {catList.map(
                      (c) =>
                        c.bytes > 0 && (
                          <span
                            key={c.id}
                            className={`inline-flex items-center gap-1.5 text-xs ${CATEGORY_TEXT[c.id]}`}
                            title={c.hint}
                          >
                            <span
                              className={`inline-block size-2 rounded-full ${CATEGORY_COLORS[c.id]}`}
                              aria-hidden="true"
                            />
                            {c.label} {fmtBytes(c.bytes)}
                            <span className="text-muted-foreground">
                              ({c.share.toFixed(0)}%)
                            </span>
                          </span>
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

              {/* ---- the per-run table ---- */}
              {jobs.length > 0 && (
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
                      const top = STORAGE_CATEGORIES.map((m) => ({
                        id: m.id,
                        ...(job.categories[m.id] ?? { bytes: 0, files: 0 }),
                      }))
                        .filter((c) => c.bytes > 0)
                        .sort((a, b) => b.bytes - a.bytes)[0];
                      return (
                        <li key={job.dirName}>
                          <button
                            type="button"
                            disabled={orphan}
                            onClick={() => {
                              if (!job.jobId) return;
                              inspect(job.jobId);
                              onOpenChange(false);
                            }}
                            className={`flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors ${
                              orphan
                                ? "cursor-default bg-amber-500/[0.05]"
                                : "hover:bg-muted/40"
                            }`}
                            title={
                              orphan
                                ? "No job record points at this directory — it was left behind by a deleted job or an older server"
                                : `Open ${job.name}'s inspector (its Clean intermediates button lives there)`
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
                        </li>
                      );
                    })}
                  </ul>
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
  );
}

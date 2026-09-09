"use client";

/**
 * CryoFlow — workflow import preview dialog.
 *
 * Importing a workflow JSON used to be a silent one-step "file → canvas"
 * — fine until you wanted the graph in a DIFFERENT workspace than the one
 * you happen to be looking at (the pre-dialog import was hard-wired to the
 * active workspace). This dialog inserts the missing decision point:
 *
 *   1. A human summary of the file BEFORE anything is created — job/link
 *      counts, where it was exported from, when — plus an amber banner for
 *      version-compatibility warnings (newer exporter / migrated file).
 *   2. A target-workspace picker listing every workspace of the ACTIVE
 *      project with live per-workspace stats. Importing into a workspace
 *      that isn't the active one automatically follows the import (the
 *      canvas switches over and fit-views the fresh content).
 *
 * Since Task 86 the picker accepts MULTIPLE files, so the dialog is a
 * QUEUE: one summary row per staged file (per-file warning chips), one
 * destructive row per parse failure (the error travels with the file so
 * the user knows exactly which file to fix), and a single shared
 * workspace picker + confirm — the confirm sends one POST per file and
 * one aggregate toast (with a spanning Undo) lands at the end.
 *
 * Mounted ONCE (page.tsx), triggered from both import entry points (canvas
 * context menu + command palette) via the shared `importPreview` store
 * slot — files are parsed client-side first (parseWorkflowFiles), so the
 * dialog only ever shows validated data; the server re-validates
 * everything on confirm.
 */

import * as React from "react";
import {
  ArrowDownToLine,
  Boxes,
  CheckCircle2,
  Copy,
  FileJson,
  FileX2,
  Link2,
  TriangleAlert,
} from "lucide-react";
import { useWorkflowStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function fmtDate(iso: string): string {
  if (!iso) return "unknown date";
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "unknown date";
  }
}

/** Tooltip copy for the per-file duplicate chip (grammar for 1 vs N). */
function dupTitle(n: number, wsName: string): string {
  return n === 1
    ? `1 job name already exists in ${wsName} — importing creates a duplicate`
    : `${n} job names already exist in ${wsName} — importing creates duplicates`;
}

export function ImportWorkflowDialog() {
  const preview = useWorkflowStore((s) => s.importPreview);
  const closePreview = useWorkflowStore((s) => s.closeImportPreview);
  const workspaces = useWorkflowStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkflowStore((s) => s.activeWorkspaceId);
  const doImport = useWorkflowStore((s) => s.importWorkflowBatch);
  // Task 95 — duplicate guard reads the project's live job list
  const jobs = useWorkflowStore((s) => s.jobs);

  const open = preview !== null;
  const entries = preview?.entries ?? [];
  const failures = preview?.failures ?? [];
  const totalJobs = entries.reduce((acc, e) => acc + e.file.jobs.length, 0);

  const [targetWs, setTargetWs] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Task 95 — duplicate guard: job names that already exist in the
  // SELECTED target workspace. Re-importing the same export currently
  // creates silent copies; the per-file chip + confirm suffix move that
  // knowledge BEFORE the confirm. Keyed on targetWs so switching the
  // picker re-evaluates — the same file is a duplicate in one workspace
  // and fresh in another (which is exactly why this warns instead of
  // blocking: a deliberate copy into another workspace is legitimate).
  const existingNames = React.useMemo(() => {
    const set = new Set<string>();
    if (targetWs) for (const j of jobs) if (j.workspaceId === targetWs) set.add(j.name);
    return set;
  }, [jobs, targetWs]);
  const dupCount = (entry: (typeof entries)[number]) =>
    entry.file.jobs.reduce((acc, j) => acc + (existingNames.has(j.name) ? 1 : 0), 0);
  const dupJobTotal = entries.reduce((acc, e) => acc + dupCount(e), 0);
  const targetWsName =
    workspaces.find((w) => w.id === targetWs)?.name ?? "the target workspace";

  // Re-derive the picker default on every open: the active workspace at
  // the time of the pick. Kept in local state so the user's explicit
  // choice survives store updates while the dialog is open. Also re-fetch
  // the workspace list — a workspace created elsewhere (another tab, a
  // just-confirmed rename) must be pickable the moment the dialog opens.
  const refreshWorkspaces = useWorkflowStore((s) => s.refreshWorkspaces);
  React.useEffect(() => {
    if (open) {
      setTargetWs(activeWorkspaceId);
      setBusy(false);
      void refreshWorkspaces();
    }
  }, [open, activeWorkspaceId, refreshWorkspaces]);

  const confirm = async () => {
    if (entries.length === 0 || !targetWs || busy) return;
    setBusy(true);
    try {
      await doImport(entries, targetWs);
      // close AFTER the await so a failed request leaves the dialog up
      // with the user's choice intact (the store only toasts the error)
      closePreview();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) closePreview();
      }}
    >
      <DialogContent className="max-w-md gap-4" data-canvas-ui="import-workflow-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ArrowDownToLine className="size-4 text-teal-600" aria-hidden="true" />
            Import workflow{entries.length === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription>
            Recreate the exported graph{entries.length === 1 ? "" : "s"} as idle jobs —
            nothing runs until you start it.
          </DialogDescription>
        </DialogHeader>

        {entries.length > 0 ? (
          <div className="grid gap-3">
            {/* staged queue: one summary row per file, failures inline */}
            <div
              className="grid max-h-44 gap-1 overflow-y-auto nice-scroll rounded-lg border bg-muted/20 p-1.5"
              data-testid="import-queue"
              aria-label="Files staged for import"
            >
              {entries.map((entry, i) => {
                const origin =
                  entry.file.project || entry.file.workspace
                    ? `${entry.file.project || "?"} · ${entry.file.workspace || "?"}`
                    : null;
                return (
                  <div
                    key={`${entry.fileName}-${i}`}
                    className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5"
                    data-testid="import-queue-row"
                    data-queue-file-name={entry.fileName}
                  >
                    <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <FileJson className="size-3.5" aria-hidden="true" />
                    </div>
                    <span className="min-w-0 flex-1">
                      <span
                        className="block truncate text-xs font-semibold"
                        title={entry.fileName}
                        data-testid="import-file-name"
                      >
                        {entry.fileName}
                      </span>
                      <span
                        className="mt-0.5 block truncate text-[10px] leading-tight text-muted-foreground"
                        title={origin ?? undefined}
                      >
                        {entry.file.jobs.length} job{entry.file.jobs.length === 1 ? "" : "s"} ·{" "}
                        {entry.file.edges.length} link{entry.file.edges.length === 1 ? "" : "s"}
                        {origin ? ` · from ${origin}` : ` · exported ${fmtDate(entry.file.exportedAt)}`}
                      </span>
                    </span>
                    {/* Task 95 — duplicate guard: computed per selected target workspace */}
                    {(() => {
                      const dup = dupCount(entry);
                      return dup > 0 ? (
                        <span
                          className="flex h-4 shrink-0 items-center gap-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 text-[9px] font-semibold text-amber-600 dark:text-amber-400"
                          role="status"
                          title={dupTitle(dup, targetWsName)}
                          data-testid="import-row-dup"
                          aria-label="Duplicate warning"
                        >
                          <Copy className="size-2.5" aria-hidden="true" />
                          {dup} dup
                        </span>
                      ) : null;
                    })()}
                    {entry.warning ? (
                      <span
                        className="flex h-4 shrink-0 items-center gap-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 text-[9px] font-semibold text-amber-600 dark:text-amber-400"
                        role="status"
                        title={entry.warning}
                        data-testid="import-row-warning"
                        aria-label="Version warning"
                      >
                        <TriangleAlert className="size-2.5" aria-hidden="true" />
                        v{entry.file.version}
                      </span>
                    ) : null}
                  </div>
                );
              })}
              {failures.map((fail, i) => (
                <div
                  key={`${fail.fileName}-fail-${i}`}
                  className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5"
                  data-testid="import-queue-fail"
                  data-queue-file-name={fail.fileName}
                  title={fail.error}
                >
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
                    <FileX2 className="size-3.5" aria-hidden="true" />
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">
                      {fail.fileName}
                    </span>
                    <span className="mt-0.5 block truncate text-[10px] leading-tight text-destructive/90">
                      {fail.error}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-destructive/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-destructive">
                    skipped
                  </span>
                </div>
              ))}
            </div>

            {/* aggregate banner — the box/links counts of the WHOLE batch */}
            {entries.length > 1 && (
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Boxes className="size-3.5 shrink-0" aria-hidden="true" />
                <span data-testid="import-queue-count">
                  {entries.length} files · {totalJobs} jobs queued — imported in one batch,
                  undone in one click
                </span>
              </div>
            )}

            {/* target workspace picker */}
            <div className="grid gap-1.5">
              <p className="text-xs font-semibold">
                Target workspace{entries.length > 1 ? " (all files)" : ""}
              </p>
              <div
                className="grid max-h-44 gap-1 overflow-y-auto nice-scroll rounded-lg border p-1.5"
                role="radiogroup"
                aria-label="Target workspace"
              >
                {workspaces.length === 0 ? (
                  <p className="p-2 text-[11px] text-muted-foreground">
                    No workspaces in this project yet — the import will create a default one.
                  </p>
                ) : (
                  workspaces.map((w) => {
                    const active = targetWs === w.id;
                    const isActiveWs = w.id === activeWorkspaceId;
                    const stats = w.stats;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setTargetWs(w.id)}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition-all",
                          active
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-transparent hover:bg-muted/60"
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-3.5 shrink-0 items-center justify-center rounded-full border transition-colors",
                            active ? "border-primary" : "border-muted-foreground/40"
                          )}
                        >
                          <span
                            className={cn(
                              "size-1.5 rounded-full transition-transform",
                              active ? "scale-100 bg-primary" : "scale-0 bg-transparent"
                            )}
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-medium">{w.name}</span>
                            {isActiveWs && (
                              <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-px text-[9px] font-semibold text-primary">
                                current
                              </span>
                            )}
                          </span>
                          {stats && (
                            <span className="mt-0.5 block text-[10px] leading-tight text-muted-foreground">
                              {stats.total} job{stats.total === 1 ? "" : "s"}
                              {stats.completed > 0 ? ` · ${stats.completed} completed` : ""}
                              {stats.running > 0 ? ` · ${stats.running} running` : ""}
                            </span>
                          )}
                        </span>
                        {active && (
                          <CheckCircle2
                            className="size-3.5 shrink-0 text-primary"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
              {targetWs && targetWs !== activeWorkspaceId && (
                <p className="text-[10px] leading-tight text-muted-foreground">
                  The canvas will switch to {workspaces.find((w) => w.id === targetWs)?.name ?? "that workspace"} after the import.
                </p>
              )}
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" size="sm" onClick={closePreview} disabled={busy}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => void confirm()}
            disabled={busy || !targetWs || entries.length === 0}
          >
            <ArrowDownToLine className="size-3.5" aria-hidden="true" />
            {busy
              ? "Importing…"
              : entries.length > 0
                ? `Import ${entries.length} workflow${entries.length === 1 ? "" : "s"} · ${totalJobs} jobs${dupJobTotal > 0 ? ` · ${dupJobTotal} dup` : ""}`
                : "Nothing to import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

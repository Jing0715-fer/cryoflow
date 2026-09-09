"use client";

/**
 * CryoFlow — sibling compare picker (the params diff's list-style entries).
 *
 * Task 88 built this as the diff's THIRD entry, private to the job
 * inspector: the twin run lives off-screen or in another workspace, so
 * instead of selecting two cards you pick the sibling from a list, each row
 * previewed by a diff chip. Task 89 generalizes the picker itself into a
 * single source when the dashboard roster became the FOURTH entry — a
 * survey surface is exactly where "compare run 1 vs run 2" is asked most,
 * and two private copies of the sibling list would sooner or later disagree
 * about ordering, link exclusion, or chip text (the "泛化只是可达性问题"
 * trilogy, chapter three: the reachability wire was the easy part; the
 * shared component is what keeps the entries telling one story).
 *
 * What stays per-surface is only the trigger's dialect:
 *  - variant="labeled"  → inspector header: a labeled ghost button
 *  - variant="icon"     → roster rows: an icon-only button that fades in on
 *                         row hover (the caller supplies the reveal classes
 *                         via triggerClassName — this component stays
 *                         context-free about hover choreography)
 * Everything that constitutes BEHAVIOR is shared: sibling filter (same
 * type, not self, no linked copies), same-workspace-first ordering, the
 * cross-workspace chip, the preview chips, and the dialog anchoring the
 * picked-from job on the left (teal).
 */

import React from "react";
import { GitCompareArrows } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useWorkflowStore } from "@/lib/store";
import type { JobDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { summarizeParamDiff } from "./results/fsc-params-diff";
import { ParamsDiffDialog } from "./params-diff-dialog";

/** the shared diff brain's minimal job shape (ParamDiffJob) */
const asDiffJob = (j: Pick<JobDTO, "id" | "name" | "type" | "params">) => ({
  jobId: j.id,
  name: j.name,
  type: j.type,
  params: (j.params ?? {}) as Record<string, unknown>,
});

/** status dots mirror StatusBadge's palette so a row reads before its text */
const STATUS_DOT: Record<string, string> = {
  running: "bg-teal-500 animate-soft-pulse",
  pending: "bg-amber-500 animate-soft-pulse",
  completed: "bg-emerald-500",
  failed: "bg-rose-500",
};

/** per-sibling preview chip, computed from the SAME classifyParamRows brain
 *  as the dialog table — "1 differ" in the picker always means exactly one
 *  changed row inside the dialog it opens, never a private taxonomy */
export function SiblingDiffChip({
  current,
  sibling,
  idPrefix = "inspector",
}: {
  current: JobDTO;
  sibling: JobDTO;
  /** testid namespace — mirrors the picker's, so probes scope chips per surface */
  idPrefix?: string;
}) {
  const s = summarizeParamDiff([asDiffJob(current), asDiffJob(sibling)]);
  if (s.total === 0 || s.allSame) {
    return (
      <span
        data-testid={`${idPrefix}-sibling-diff`}
        data-diff-kind="same"
        className="shrink-0 rounded-full border border-border bg-background px-1.5 py-px text-[9px] font-semibold text-muted-foreground"
      >
        {s.total === 0 ? "no params" : "identical"}
      </span>
    );
  }
  return (
    <span
      data-testid={`${idPrefix}-sibling-diff`}
      data-diff-kind="differs"
      className="flex h-4 shrink-0 items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 text-[9px] font-semibold text-amber-700 dark:text-amber-400"
      title={
        s.partial > 0
          ? `${s.changed} parameter(s) differ, ${s.partial} one-sided — opens the side-by-side table`
          : `${s.changed} parameter(s) differ — opens the side-by-side table`
      }
    >
      {s.changed > 0 && <span>{s.changed} differ</span>}
      {s.changed > 0 && s.partial > 0 && <span className="text-muted-foreground/70">·</span>}
      {s.partial > 0 && <span className="text-muted-foreground">{s.partial} one-sided</span>}
    </span>
  );
}

export function SiblingComparePicker({
  job,
  variant = "labeled",
  idPrefix = "inspector",
  triggerClassName,
}: {
  job: JobDTO;
  /** labeled = inspector header button; icon = roster row's hover affordance */
  variant?: "labeled" | "icon";
  /** testid namespace — two surfaces must never fight over one hook */
  idPrefix?: string;
  /** extra classes for the trigger (e.g. the roster row's hover-reveal) */
  triggerClassName?: string;
}) {
  const jobs = useWorkflowStore((s) => s.jobs);
  const workspaces = useWorkflowStore((s) => s.workspaces);
  const activeWs = useWorkflowStore((s) => s.activeWorkspaceId);
  const [open, setOpen] = React.useState(false);
  const [compareWith, setCompareWith] = React.useState<JobDTO | null>(null);

  // the diff table's contract is a SAME-TYPE pair; linked copies are
  // excluded as siblings — a link's params mirror its original, and
  // comparing a mirror to a real run reads as noise (the header's
  // "Go to original" already covers that story)
  const siblings = React.useMemo(
    () =>
      jobs
        .filter(
          (j) => j.type === job.type && j.id !== job.id && j.linkedJobId == null
        )
        // same-workspace runs first (the natural "run 1 vs run 2" story),
        // cross-workspace after; run order (createdAt) within each group
        .sort((a, b) => {
          const aLocal = (a.workspaceId ?? null) === (activeWs ?? null) ? 0 : 1;
          const bLocal = (b.workspaceId ?? null) === (activeWs ?? null) ? 0 : 1;
          return aLocal - bLocal || a.createdAt.localeCompare(b.createdAt);
        }),
    [jobs, job.type, job.id, activeWs]
  );

  // the anchor job can change underneath the picker at any moment (the
  // inspector hops via breadcrumb/lineage; a roster row can be re-rendered
  // for a different job) — a stale compareWith from the previous job must
  // never open
  React.useEffect(() => {
    setCompareWith(null);
    setOpen(false);
  }, [job.id]);

  // no twin run → no entry (same guard doctrine as the canvas toolbar)
  if (siblings.length === 0) return null;

  const crossWsCount = siblings.filter(
    (sib) => (sib.workspaceId ?? null) !== (activeWs ?? null)
  ).length;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {variant === "icon" ? (
            <Button
              variant="ghost"
              size="icon"
              data-testid={`${idPrefix}-compare-button`}
              data-sibling-count={siblings.length}
              className={cn(
                "size-6 rounded-md text-muted-foreground/70 hover:bg-muted hover:text-foreground",
                triggerClassName
              )}
              aria-label={`Compare parameters with another ${job.type} job (${siblings.length} sibling${siblings.length === 1 ? "" : "s"}${crossWsCount > 0 ? `, ${crossWsCount} in other workspaces` : ""})`}
              title={`Compare launch parameters with another ${job.type} job — ${siblings.length} sibling${siblings.length === 1 ? "" : "s"} available`}
            >
              <GitCompareArrows className="size-3.5" aria-hidden="true" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              data-testid={`${idPrefix}-compare-button`}
              data-sibling-count={siblings.length}
              className={cn(
                "h-7 gap-1.5 px-2.5 text-xs text-muted-foreground hover:bg-background hover:text-foreground",
                triggerClassName
              )}
              title={`Compare launch parameters with another ${job.type} job`}
            >
              <GitCompareArrows className="size-3.5" aria-hidden="true" />
              <span>Compare</span>
            </Button>
          )}
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-80 p-1.5"
          data-testid={`${idPrefix}-compare-popover`}
        >
          <p className="px-1.5 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Compare with a {job.type} sibling
          </p>
          <div className="grid max-h-56 gap-0.5 overflow-y-auto nice-scroll">
            {siblings.map((sib) => {
              const wsName = workspaces.find((w) => w.id === sib.workspaceId)?.name;
              const crossWs = (sib.workspaceId ?? null) !== (activeWs ?? null);
              return (
                <button
                  key={sib.id}
                  type="button"
                  data-testid={`${idPrefix}-compare-option`}
                  data-sibling-name={sib.name}
                  onClick={() => {
                    setCompareWith(sib);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      STATUS_DOT[sib.status] ?? "bg-slate-400"
                    )}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                    {sib.name}
                  </span>
                  {crossWs && wsName ? (
                    <span
                      className="max-w-24 shrink-0 truncate rounded border border-border bg-muted/60 px-1 py-px text-[9px] font-medium text-muted-foreground"
                      title={`Runs in workspace “${wsName}”`}
                    >
                      {wsName}
                    </span>
                  ) : null}
                  <SiblingDiffChip current={job} sibling={sib} idPrefix={idPrefix} />
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      <ParamsDiffDialog
        // the picked-from job anchors LEFT (teal) — the picker is always
        // "this job vs that one", so the baseline is where the ask began
        jobs={compareWith ? [job, compareWith] : []}
        open={compareWith != null}
        onOpenChange={(o) => {
          if (!o) setCompareWith(null);
        }}
      />
    </>
  );
}

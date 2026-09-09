"use client";

/**
 * CryoFlow — params diff dialog (canvas multi-select entry, Task 87;
 * inspector sibling-picker entry + column swap, Task 88).
 *
 * The FSC compare dialog already answers "which reconstruction is better?"
 * with its curves — and its A/B parameter table (FscParamsDiff) carries the
 * provenance side. But the same question is asked constantly about jobs
 * with NO FSC to plot: "what actually differs between MotionCorr run 1 and
 * run 2?", "did I change anything in this extract before re-running it?".
 * This dialog generalizes the diff: select exactly two jobs of the SAME
 * type on the canvas, hit Compare in the bulk-selection toolbar, and the
 * launch parameters land side by side. Task 88 adds the third entry: the
 * job inspector's "Compare" button lists same-type siblings (same-workspace
 * first, cross-workspace after) with a per-sibling diff preview chip.
 *
 * Deliberately a thin shell: FscParamsDiff owns the row taxonomy (changed
 * / partial / same), the differences-only default and the humanized keys —
 * one diff brain, N surfaces (curve provenance + standalone comparison +
 * picker preview chips), the same doctrine as parseWorkflowFiles: every
 * reader of a result reads the same one.
 *
 * Column colors are FIXED per position (teal for the left column, amber for
 * the right) — unlike the FSC dialog there are no curves to match, so the
 * swatches just need to be tell-apart-able and consistent between header
 * and any future legend. The swap button flips the COLUMN ORDER while the
 * colors stay positional: whoever the user wants as baseline lands left,
 * teal, without the picker ever having to care about pick order again.
 */

import { useState } from "react";
import { ArrowLeftRight, GitCompareArrows, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FscParamsDiff } from "./results/fsc-params-diff";
import type { JobDTO } from "@/lib/types";

/** the two column colors, in column order (left first) */
const COLUMN_COLORS = ["#0d9488", "#d97706"];

export function ParamsDiffDialog({
  jobs,
  open,
  onOpenChange,
}: {
  /** exactly two same-type jobs, in presentation order (left column first) */
  jobs: Pick<JobDTO, "id" | "name" | "type" | "params">[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // column swap (Task 88): the canvas entry opens in pick order, the
  // inspector entry anchors the inspected job left — but whichever pair
  // arrives, the user may want the OTHER job as the left/baseline column.
  // Swapping reverses the presentation order while colors stay positional.
  const pairKey = `${jobs[0]?.id ?? ""}|${jobs[1]?.id ?? ""}`;
  const [swapped, setSwapped] = useState(false);
  // a new pair always opens unswapped — the default is each entry's
  // natural order, not a leftover flip from the previous comparison.
  // Render-time adjust (React's blessed alternative to set-state-in-effect):
  // resetting here avoids one swapped-flash frame that an effect would paint
  const [seenPair, setSeenPair] = useState(pairKey);
  if (seenPair !== pairKey) {
    setSeenPair(pairKey);
    setSwapped(false);
  }

  if (jobs.length !== 2) return null;
  const ordered = swapped ? [jobs[1], jobs[0]] : jobs;
  const diffJobs = ordered.map((j) => ({
    jobId: j.id,
    name: j.name,
    type: j.type,
    params: (j.params ?? {}) as Record<string, unknown>,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg gap-3"
        data-canvas-ui="params-diff-dialog"
        data-testid="params-diff-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <GitCompareArrows className="size-4 text-teal-600" aria-hidden="true" />
            Compare parameters
            <Button
              variant="ghost"
              size="sm"
              className="ml-1 h-6 w-6 gap-0 rounded-md p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => setSwapped((v) => !v)}
              aria-label="Swap column order"
              aria-pressed={swapped}
              data-testid="params-diff-swap"
              title="Swap the left/right columns — colors stay with their position (teal = left)"
            >
              <ArrowLeftRight className="size-3.5" aria-hidden="true" />
            </Button>
          </DialogTitle>
          <DialogDescription>
            Launch parameters of the two selected {jobs[0].type} jobs, side by
            side — left column:{" "}
            <span className="font-medium text-foreground">{ordered[0].name}</span>.
          </DialogDescription>
        </DialogHeader>

        <FscParamsDiff
          jobs={diffJobs}
          colorOf={(jobId) =>
            COLUMN_COLORS[diffJobs.findIndex((j) => j.jobId === jobId)] ?? "#71717a"
          }
        />

        <p
          className="flex items-start gap-1.5 text-[10px] leading-snug text-muted-foreground"
          data-testid="params-diff-footnote"
        >
          <Info className="mt-px size-3 shrink-0" aria-hidden="true" />
          <span>
            Idle copies can still be edited — open either job from the canvas
            to tweak the parameter that differs, then re-run it.
          </span>
        </p>
      </DialogContent>
    </Dialog>
  );
}

"use client";

/**
 * CryoFlow — params diff dialog (canvas multi-select entry, Task 87).
 *
 * The FSC compare dialog already answers "which reconstruction is better?"
 * with its curves — and its A/B parameter table (FscParamsDiff) carries the
 * provenance side. But the same question is asked constantly about jobs
 * with NO FSC to plot: "what actually differs between MotionCorr run 1 and
 * run 2?", "did I change anything in this extract before re-running it?".
 * This dialog generalizes the diff: select exactly two jobs of the SAME
 * type on the canvas, hit Compare in the bulk-selection toolbar, and the
 * launch parameters land side by side.
 *
 * Deliberately a thin shell: FscParamsDiff owns the row taxonomy (changed
 * / partial / same), the differences-only default and the humanized keys —
 * one diff brain, two surfaces (curve provenance + standalone comparison),
 * the same doctrine as parseWorkflowFiles: every reader of a result reads
 * the same one.
 *
 * Column colors are FIXED per position (teal for the first-picked job,
 * amber for the second) — unlike the FSC dialog there are no curves to
 * match, so the swatches just need to be tell-apart-able and consistent
 * between header and any future legend.
 */

import { GitCompareArrows, Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FscParamsDiff } from "./results/fsc-params-diff";
import type { JobDTO } from "@/lib/types";

/** the two column colors, in pick order */
const COLUMN_COLORS = ["#0d9488", "#d97706"];

export function ParamsDiffDialog({
  jobs,
  open,
  onOpenChange,
}: {
  /** exactly two same-type jobs, in pick order (first click = left column) */
  jobs: Pick<JobDTO, "id" | "name" | "type" | "params">[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (jobs.length !== 2) return null;
  const diffJobs = jobs.map((j) => ({
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
          </DialogTitle>
          <DialogDescription>
            Launch parameters of the two selected {jobs[0].type} jobs, side by
            side — left column is the first-picked job.
          </DialogDescription>
        </DialogHeader>

        <FscParamsDiff
          jobs={diffJobs}
          colorOf={(jobId) =>
            COLUMN_COLORS[jobs.findIndex((j) => j.id === jobId)] ?? "#71717a"
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

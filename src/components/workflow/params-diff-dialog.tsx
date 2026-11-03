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
 * Task 89 wires the fourth: the dashboard roster's rows carry the same
 * picker as a hover-revealed icon — the survey surface, where siblings
 * across ALL workspaces are visible at once. Entries 3 and 4 share one
 * picker module (sibling-compare-picker.tsx); only the trigger differs.
 * Task 90 closes the loop with a per-column "Open" affordance: the compare
 * story ends at "this parameter differs" and the NEXT action is always
 * "go tweak the idle twin, re-run" — from the canvas entry both jobs are
 * already visible, but from the inspector/roster entries they may live in
 * another workspace entirely. Each column button carries its positional
 * color dot (teal/amber, same doctrine as the table columns: color follows
 * POSITION, not identity, so it survives the swap).
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
 *
 * Task 766 lets the dialog's description speak the kind vocabulary's
 * words: the prose already names the pair's shared type ("the two
 * selected {type} jobs" — the picker's guard guarantees same-type, so
 * ONE mention speaks for both columns), and the dots sit inline right
 * after the type word — the t760 prose law (the description is a <p>,
 * a block flex would break the sentence; the seat's physics is its
 * witness), the family's THIRTEENTH testid address. Unknown types keep
 * the bare sentence (the undefined law's fifth face).
 *
 * t904 — the swap REMEMBERS (the style round's third seat): the reset
 * on a pair change was deliberately anti-noise (a leftover flip from
 * the PREVIOUS comparison), but it also forgot the user's OWN choice
 * for THIS pair — swap B left, compare elsewhere, come back, swap
 * again, every visit. The chosen baseline now rides
 * src/lib/pair-baseline.ts (the t653 law — the storage law lives in
 * lib): stored as the BASELINE JOB ID (never a boolean — the pair
 * arrives in either order across the three entries, a boolean keyed to
 * arrival order would silently invert), keyed by the SORTED pair (one
 * pair, one entry), restored at the pair change, written at the swap
 * gesture (the #13 law — no localStorage writes in render paths; one
 * write per gesture, like the t638 bucket). No whisper seats here —
 * the restore is self-evident (the left column IS the baseline), and
 * the lib's docblock pins the verdict.
 */

import { useState } from "react";
import { ArrowLeftRight, GitCompareArrows, Info, SquareArrowOutUpRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils"; // t1087 — the pressed face joins the conditional-class law
import { useWorkflowStore } from "@/lib/store";
import { baselineFor, rememberBaseline } from "@/lib/pair-baseline";
import { FscParamsDiff } from "./results/fsc-params-diff";
import type { JobDTO } from "@/lib/types";
import { jobType, pourKindsOf, PORT_COLORS } from "@/lib/workflow"; // t766 — the kind vocabulary's TWENTY-SIXTH reader joins the diff dialog
import { usePrintedDate } from "@/lib/use-now"; // t1093 — the paper's clock (the t232 law: paper clocks do not hydrate)

/** the two column colors, in column order (left first) */
const COLUMN_COLORS = ["#0d9488", "#d97706"];

export function ParamsDiffDialog({
  jobs,
  open,
  onOpenChange,
}: {
  /** exactly two same-type jobs, in presentation order (left column first).
   *  workspaceId + status ride along for the Open affordance (Task 90) —
   *  every caller passes full JobDTOs from the store, the narrow Pick just
   *  documents what the dialog actually reads. */
  jobs: Pick<JobDTO, "id" | "name" | "type" | "params" | "workspaceId" | "status">[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // column swap (Task 88): the canvas entry opens in pick order, the
  // inspector entry anchors the inspected job left — but whichever pair
  // arrives, the user may want the OTHER job as the left/baseline column.
  // Swapping reverses the presentation order while colors stay positional.
  const pairKey = `${jobs[0]?.id ?? ""}|${jobs[1]?.id ?? ""}`;
  const [swapped, setSwapped] = useState(false);
  // a new pair opens at the REMEMBERED baseline (t904): the user's own
  // choice for THIS pair comes back (stored as the baseline job id, so
  // the arrival order cannot invert it); a pair never compared — or
  // whose remembered baseline left the pair — opens unswapped, the
  // natural order (the old anti-noise default, still the honest one).
  // Render-time adjust (React's blessed alternative to set-state-in-effect):
  // resetting here avoids one swapped-flash frame that an effect would paint
  const [seenPair, setSeenPair] = useState(pairKey);
  if (seenPair !== pairKey) {
    setSeenPair(pairKey);
    const remembered =
      jobs[0] && jobs[1] ? baselineFor(jobs[0].id, jobs[1].id) : null;
    setSwapped(remembered != null && remembered === jobs[1]?.id);
  }

  // Task 90 — the compare→edit→rerun loop-closer. Same recipe as the
  // dashboard roster's openJob (Task 77 deep-link repair): switch the
  // canvas workspace FIRST or the view lands on a card that isn't there,
  // then canvas view, then select (idle — the twin you're about to edit)
  // or inspect (completed — the run you're auditing). Hooks live ABOVE the
  // early return below — closed renders must run the same hook set.
  const switchWorkspace = useWorkflowStore((s) => s.switchWorkspace);
  const setView = useWorkflowStore((s) => s.setView);
  const select = useWorkflowStore((s) => s.select);
  const inspect = useWorkflowStore((s) => s.inspect);
  const activeWorkspaceId = useWorkflowStore((s) => s.activeWorkspaceId);
  // t1093 — the print face's paper clock (the t232 law: paper clocks do
  // NOT hydrate — useSyncExternalStore with an empty server snapshot).
  // Lives with the other hooks, ABOVE the early return (the rules-of-hooks
  // law the closed renders run too).
  const printed = usePrintedDate();
  const jumpTo = (j: (typeof jobs)[number]) => {
    onOpenChange(false);
    if (j.workspaceId && j.workspaceId !== activeWorkspaceId) {
      switchWorkspace(j.workspaceId);
    }
    setView("canvas");
    if (j.status === "idle") select(j.id);
    else inspect(j.id);
  };

  if (jobs.length !== 2) return null;
  // t766 — the pours ask rides the description's own type word: the
  // sentence already names the pair's shared type, the dots glue to the
  // word they describe (identity words first, water after)
  const spec = jobType(jobs[0].type);
  const pouring = spec ? pourKindsOf(jobs[0].type) : [];
  const ordered = swapped ? [jobs[1], jobs[0]] : jobs;
  const diffJobs = ordered.map((j) => ({
    jobId: j.id,
    name: j.name,
    type: j.type,
    params: (j.params ?? {}) as Record<string, unknown>,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* t1093 — the print face (globals.css's :has() block, the Task 114
          doctrine's FOURTH seat): data-params-diff-dialog opts this dialog
          out of the generic step-aside — a launch-params comparison IS a
          document (the diff brain's row taxonomy: changed / partial /
          same, the pair's actual values). The survey rode the step-aside
          paper first and convicted it: with this dialog open, Ctrl+P
          printed the inspector's job report and the comparison was
          unreachable on the sheet. The verbs (the column swap, the
          Task 90 open row) and the footnote offer stay chrome (the JSX
          marks them .no-print — a verb that prints is a verb that lies,
          the t945 law), and the provenance line carries the pair and
          the paper's clock. The standalone-translate kill rides the
          className (the t945 dialect: Lightning CSS folds a same-block
          translate:none into an identity transform, so the kill must be
          its own rule). */}
      <DialogContent
        data-params-diff-dialog=""
        className="sm:max-w-lg gap-3 print:[translate:none] print:[scale:none] print:[rotate:none]"
        data-canvas-ui="params-diff-dialog"
        data-testid="params-diff-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <GitCompareArrows className="size-4 text-running-600" aria-hidden="true" />
            Compare parameters
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "ml-1 h-6 w-6 gap-0 rounded-md p-0 text-muted-foreground hover:bg-muted hover:text-foreground",
                // t1093 — chrome on paper: the swap is a verb (a verb
                // that prints is a verb that lies, the t945 law); the
                // printed column order is the frozen order and the
                // provenance line speaks which job is which
                "no-print",
                // t1087 — the pressed state gets a face: aria-pressed was
                // already spoken, but only to ears; a swapped pair now
                // shows a muted wash + full-ink icon at a glance, so the
                // state survives a screenshot (the memory law's visible
                // half — the t904 store remembers, the face confirms)
                swapped && "bg-muted text-foreground"
              )}
              onClick={() => {
                const next = !swapped;
                setSwapped(next);
                // t904 — the gesture writes the memory (the #13 law: no
                // writes in render paths): the NEW left column is the
                // baseline the user chose, however the pair arrived
                if (jobs[0] && jobs[1]) {
                  rememberBaseline(jobs[0].id, jobs[1].id, next ? jobs[1].id : jobs[0].id);
                }
              }}
              aria-label="Swap column order"
              aria-pressed={swapped}
              data-testid="params-diff-swap"
              title="Swap the left/right columns — colors stay with their position (teal = left); your baseline is remembered for this pair"
            >
              <ArrowLeftRight className="size-3.5" aria-hidden="true" />
            </Button>
          </DialogTitle>
          <DialogDescription>
            Launch parameters of the two selected {jobs[0].type}
            {spec ? (
              // t766 — the description names the pair's shared type in
              // words: the prose sentence can carry the pours line, the
              // dots sit inline right after the type word — the t760
              // prose law (a block flex would break the sentence into
              // blocks; the seat's physics is its witness). The picker's
              // guard guarantees the pair is same-type, so ONE mention
              // speaks for both columns.
              <span
                className="inline-flex shrink-0 items-center gap-1"
                data-testid={`params-diff-pours-${jobs[0].type}`}
              >
                {pouring.map((k) => (
                  <span
                    key={k}
                    aria-hidden="true"
                    title={`pours ${k}`}
                    className="inline-block size-1.5 rounded-full"
                    style={{ background: PORT_COLORS[k].wire }}
                  />
                ))}
                <span className="sr-only">pours {pouring.join(", ")}</span>
              </span>
            ) : null}{" "}
            jobs, side by
            side — left column:{" "}
            <span className="font-medium text-foreground">{ordered[0].name}</span>.
          </DialogDescription>
          {/* t1093 — the paper's provenance line: the swap verb and the
              open row are chrome (no-print below) and die on paper; the
              table headers carry the names too (their own unroll — the
              fsc-params-diff half of this window), but the line speaks
              the pair AND the paper's clock in one breath, the t945
              dialect verbatim. Screen-hidden (the description and the
              headers speak the pair live). */}
          <p
            data-params-print-doc
            className="hidden print:mt-2 print:block text-[11px] text-muted-foreground"
          >
            {`Run A: ${ordered[0]?.name ?? "—"} · Run B: ${ordered[1]?.name ?? "—"} · printed ${printed}`}
          </p>
        </DialogHeader>

        <FscParamsDiff
          jobs={diffJobs}
          colorOf={(jobId) =>
            COLUMN_COLORS[diffJobs.findIndex((j) => j.jobId === jobId)] ?? "#71717a"
          }
        />

        {/* Task 90 — column-jump row. Color dots follow POSITION (teal =
           left) matching the table above, so the mapping survives a swap;
           orphans (pre-workspace-era jobs) have no canvas to land on and
           are disabled with guidance instead of silently navigating. */}
        <div
          className="flex items-center gap-1.5 no-print"
          data-testid="params-diff-openrow"
        >
          {/* t1093 — the whole row is chrome on paper: a jump button on a
              sheet closes nothing and lands nowhere (the t946 law — the
              funnel's copy row died whole). Its WHY (the footnote below)
              dies with it: the offer it explains is screen-only. */}
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Open
          </span>
          {ordered.map((j, i) => {
            const orphan = !j.workspaceId;
            return (
              <Button
                key={j.id}
                variant="ghost"
                size="sm"
                disabled={orphan}
                data-testid={`params-diff-open-${i}`}
                className="h-6 gap-1.5 rounded-md px-1.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                title={
                  orphan
                    ? "Not on any canvas — adopt it from the dashboard first"
                    : `Go to ${j.name} on the canvas`
                }
                onClick={() => jumpTo(j)}
              >
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: COLUMN_COLORS[i] }}
                  aria-hidden="true"
                />
                <SquareArrowOutUpRight className="size-3 shrink-0" aria-hidden="true" />
                <span className="max-w-44 truncate">{j.name}</span>
              </Button>
            );
          })}
        </div>

        <p
          className="flex items-start gap-1.5 text-[10px] leading-snug text-muted-foreground no-print"
          data-testid="params-diff-footnote"
        >
          <Info className="mt-px size-3 shrink-0" aria-hidden="true" />
          <span>
            {/* t1093 — the offer dies on paper (the t1092 law: the paper
                keeps what the job DID, drops what the screen OFFERS —
                "open either job from the canvas to tweak" is an
                instruction no sheet can follow; the diff's facts are the
                table above) */}
            Idle copies can still be edited — open either job from the canvas
            to tweak the parameter that differs, then re-run it.
          </span>
        </p>
      </DialogContent>
    </Dialog>
  );
}

"use client";

/**
 * CryoFlow — the continue verb row, the compare family's shared consumer
 * verb (t455; shared home t456).
 *
 * t455 built the verb inline in the class convergence dialog; t456 gave
 * the family its FIFTH question (the resolution arc) and the same verb
 * is its action too — copying the row would have been the lie the face
 * kit's law refuses. One row, two verdicts: the brain lives in
 * convergence-continue.ts (pure, bench-first), this file is the row's
 * single presentation.
 *
 * The row's laws (family law, restated):
 *   - THE VERB SPEAKS THE JOB'S OWN LANE: a cluster checkpoint continues
 *     on the cluster (the fn_cont path IS a cluster path), a local one
 *     stays local — the DTO's runRemote ledger is the last dispatch's
 *     own target.
 *   - NO CHECKPOINT, NO VERB: the row degrades to an honest why (a
 *     failed scan says so; an absent optimiser family says so) — the
 *     t454 honesty law, kept.
 *   - THE VERDICT STAYS A READING UNTIL FIRED: the caption says so; the
 *     row's one mutation is RELION's own restart idiom.
 */

import { useEffect, useMemo, useState } from "react";
import { Loader2, Play, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import type { JobDTO } from "@/lib/types";
import { useWorkflowStore } from "@/lib/store";
import {
  checkpointOf,
  continueLaneOf,
  continuePlanOf,
  continueParamWrites,
  iterKnobOf,
  moreOptionsFor,
  selfScanErrorOf,
  type ContinueSourceLite,
} from "@/lib/convergence-continue";
import { roundLabel } from "@/lib/convergence";

/** The verb's data plane — the panel picker's own route (t394). The
 *  shapes are structural mirrors (convergence-continue.ts); the route
 *  itself never throws, sources carry their own errors. */
async function fetchContinueSources(jobId: string): Promise<ContinueSourceLite[]> {
  const res = await fetch(`/api/jobs/${jobId}/continue-sources`, {
    headers: { Origin: window.location.origin },
  });
  if (!res.ok) throw new Error(`route said ${res.status}`);
  const data = (await res.json()) as { sources?: ContinueSourceLite[] };
  return data.sources ?? [];
}

export function ContinueVerbRow({
  job,
  onDone,
}: {
  job: JobDTO;
  onDone: () => void;
}) {
  const saveJob = useWorkflowStore((s) => s.saveJob);
  const runJob = useWorkflowStore((s) => s.runJob);
  const runJobRemote = useWorkflowStore((s) => s.runJobRemote);
  // the verb speaks the job's own lane — a cluster checkpoint continues
  // on the cluster (the fn_cont path IS a cluster path; a local dispatch
  // could never read it), a local one stays local
  const lane = useMemo(() => continueLaneOf(job), [job]);
  const [sources, setSources] = useState<ContinueSourceLite[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [more, setMore] = useState<number | null>(null);
  const [firing, setFiring] = useState(false);
  const [fireError, setFireError] = useState<string | null>(null);

  // mounted only while the dialog's loaded face shows — one cheap GET
  // per open, the same economy the door's ladder fetch rides
  useEffect(() => {
    let alive = true;
    fetchContinueSources(job.id)
      .then((s) => {
        if (alive) setSources(s);
      })
      .catch((err: unknown) => {
        if (alive) setLoadError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      alive = false;
    };
  }, [job.id]);

  const scanError = useMemo(() => selfScanErrorOf(sources ?? undefined), [sources]);
  const checkpoint = useMemo(() => checkpointOf(sources ?? undefined), [sources]);
  const knob = useMemo(() => iterKnobOf(job.type, job.params), [job.type, job.params]);
  const options = useMemo(() => moreOptionsFor(knob?.vdam ?? false), [knob]);
  const chosen = more ?? options[0] ?? 0;
  const plan = useMemo(
    () =>
      checkpoint
        ? continuePlanOf({ type: job.type, params: job.params, checkpoint, more: chosen })
        : null,
    [checkpoint, job.type, job.params, chosen],
  );

  const fire = async () => {
    if (!plan || firing) return;
    setFiring(true);
    setFireError(null);
    try {
      const saved = await saveJob(job.id, { params: continueParamWrites(plan) }, { silent: true });
      if (!saved.ok) {
        setFireError(saved.error ?? "the parameter write refused");
        return;
      }
      if (lane) {
        await runJobRemote(job.id, lane);
      } else {
        await runJob(job.id);
      }
      onDone(); // the canvas follows the run — the dialog steps aside
    } catch {
      setFireError("the run refused to start");
    } finally {
      setFiring(false);
    }
  };

  if (loadError) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-[11px] text-muted-foreground">
        <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
        The checkpoints could not be read ({loadError}) — the continue verb stays
        absent rather than guessing.
      </div>
    );
  }
  if (!sources) {
    return (
      <div className="flex h-10 items-center justify-center text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      </div>
    );
  }
  if (!checkpoint || !plan || !knob) {
    // t456 — a knob-less dialect speaks its own why (RELION's auto-refine
    // owns the convergence; a written --iter would be dead) — distinct
    // from the no-checkpoint why, never conflated.
    if (!knob) {
      return (
        <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-[11px] text-muted-foreground">
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
          {job.type === "refine3d"
            ? "RELION's auto-refine owns this run's convergence — it stops on its own criterion, and a written --iter would be dead. The continue verb speaks only the manual dialect."
            : "This run's dialect carries no --iter knob — the continue verb has nothing to extend."}
        </div>
      );
    }
    return (
      <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-[11px] text-muted-foreground">
        <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
        {scanError
          ? `The run directory could not be read (${scanError}) — the continue verb stays absent rather than guessing.`
          : "No complete checkpoint in this run's own directory — RELION --continue needs the optimiser.star family. The verdict stays a reading."}
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Play className="size-3.5 text-primary" aria-hidden="true" />
        <span className="text-xs font-medium text-foreground">Continue with more iterations</span>
        <div className="flex items-center gap-1" role="group" aria-label="More iterations">
          {options.map((n) => {
            const active = n === chosen;
            return (
              <Chip
                key={n}
                size="md"
                interactive
                asChild
                className={
                  active
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }
              >
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => setMore(n)}
                >
                  +{n}
                </button>
              </Chip>
            );
          })}
        </div>
      </div>
      <div className="mt-1.5 text-[11px] text-muted-foreground">
        Resumes from {roundLabel(plan.checkpoint.iteration)} — the run&apos;s newest
        complete checkpoint{plan.checkpoint.archived ? " (archived generation)" : ""}.
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">
        <span className="font-mono">
          {knob.current} + {chosen} → {plan.totalIter}
        </span>{" "}
        {plan.checkpoint.iteration === knob.current ? "iterations" : "rounds → iterations"} total
        (RELION&apos;s --iter is the TOTAL)
        {plan.clamped ? " — reaching the form's ceiling" : ""}.
      </div>
      {fireError ? (
        <div className="mt-2 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-[11px] text-destructive">
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
          {fireError}
        </div>
      ) : null}
      <div className="mt-2 flex items-center gap-3">
        <Button size="sm" className="h-7" onClick={fire} disabled={firing}>
          {firing ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Play className="size-3.5" aria-hidden="true" />
          )}
          Continue the run
        </Button>
        <p className="text-[11px] text-muted-foreground">
          Fires RELION <span className="font-mono">--continue</span> from the checkpoint —
          the verdict stays a reading until you fire it.
        </p>
      </div>
    </div>
  );
}

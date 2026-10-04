"use client";

/**
 * t565 — the AI verdict stamp card.
 *
 * judge_2d_classes stamps its verdict onto the job's record at judge
 * time (data/ai-verdicts.json — one per job, newest wins); this card
 * reads it back on the class2d Results tab. Until now the verdict was
 * chat ephemera: reset the panel and the opinion was gone. The stamp
 * pins the evidence to the job it is ABOUT — the same law the
 * selection receipt follows (t562: "the receipt lives in the product,
 * not the log"), applied to the AI's own voice.
 *
 * LAWS:
 *  - THE STAMP IS A NOTEBOOK ENTRY: the footer names the model, the
 *    pass summary and the date — it can never masquerade as engine
 *    output, and it never touches particle counts (the receipt card
 *    beside it owns those).
 *  - HONEST ABSENCE: no stamp, fetch failure, or a non-class2d job →
 *    render null. A missing opinion must not paint the tab red.
 *  - THE ORDER IS THE JUDGMENT: keep chips lead (cls asc), then maybe,
 *    then reject — the reader's eye walks the same path the rubric did.
 */

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import type { VerdictStamp } from "@/lib/ai/verdict-stamp-core";
import { cn } from "@/lib/utils";

export interface VerdictResponse {
  jobId: string;
  type: string;
  available: boolean;
  note?: string;
  status?: string;
  stamp?: VerdictStamp;
}

const VERDICT_CHIP: Record<
  VerdictStamp["classes"][number]["verdict"],
  { label: string; cls: string }
> = {
  keep: {
    label: "keep",
    cls: "border-emerald-600/30 bg-emerald-600/[0.08] text-emerald-800 dark:text-emerald-300",
  },
  maybe: {
    label: "maybe",
    cls: "border-amber-600/30 bg-amber-600/[0.08] text-amber-700 dark:text-amber-300",
  },
  reject: {
    label: "reject",
    cls: "border-border/60 bg-muted/40 text-muted-foreground/75",
  },
};

/** the reader's eye walks the rubric: keep → maybe → reject, cls asc */
function orderedClasses(stamp: VerdictStamp) {
  const rank = { keep: 0, maybe: 1, reject: 2 } as const;
  return [...stamp.classes].sort(
    (a, b) => rank[a.verdict] - rank[b.verdict] || a.cls - b.cls
  );
}

export function AiVerdictStamp({
  jobId,
  refreshKey = 0,
  prefetched,
  viaJobName,
  className,
}: {
  jobId: string;
  refreshKey?: number;
  /** t566 — when the caller already holds the response (the evidence row
   * fetches it for the availability gate), skip the self-fetch: pass the
   * response (or null while loading) and the card renders it verbatim. */
  prefetched?: VerdictResponse | null;
  /** t566 — set when the stamp rides a birth selection's tab: the opinion
   * was given about the PARENT class2d run, and the footer says so — the
   * card may never masquerade as a verdict about the job hosting it. */
  viaJobName?: string;
  /** t566 — grid placement when the card rides the evidence row. */
  className?: string;
}) {
  const [fetched, setFetched] = useState<VerdictResponse | null>(null);

  useEffect(() => {
    // t566 — a caller-supplied response replaces the self-fetch entirely.
    if (prefetched !== undefined) return;
    // one fetch per (job, refresh tick): the stamp only changes when a
    // judge re-speaks, but riding the Results tab's poll cadence keeps
    // the card in step with a fresh judge call made moments ago.
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}/ai-verdict`, {
          cache: "no-store",
        });
        const body: VerdictResponse | null = res.ok
          ? ((await res.json()) as VerdictResponse)
          : null;
        if (!cancelled) setFetched(body);
      } catch {
        // quiet absence — a missing opinion must not paint the tab red
        if (!cancelled) setFetched(null);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [jobId, refreshKey, prefetched]);

  // t566 — the effective response: the caller's when provided (even as
  // null while its fetch is in flight), our own otherwise — ONE render
  // path reads it (the empty-grid live catch: skipping the fetch without
  // feeding the render left the card an eternal null).
  const data = prefetched !== undefined ? prefetched : fetched;

  const stamp = data?.available ? data.stamp : null;
  if (!data || !stamp) return null;

  const classes = orderedClasses(stamp);
  const CHIP_CAP = 16;
  const shown = classes.slice(0, CHIP_CAP);
  const overflow = classes.length - shown.length;

  const askedLabel = stamp.at
    ? new Date(stamp.at).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <section
      aria-label="AI verdict"
      data-canvas-ui="ai-verdict-stamp"
      className={cn(
        "rounded-lg border border-violet-600/20 bg-violet-500/[0.03] p-3",
        className
      )}
    >
      {/* header: who spoke, and the shape of the opinion */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <h4 className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-foreground/80">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden="true" />
          AI verdict
          {stamp.iteration != null && (
            <span className="text-[10px] font-normal text-muted-foreground">
              it.{stamp.iteration}
            </span>
          )}
        </h4>
        <div className="flex items-center gap-1 text-[10px] tabular-nums">
          {stamp.counts.keep > 0 && (
            <span className="rounded-full border border-emerald-600/30 bg-emerald-600/[0.08] px-1.5 py-px font-medium text-emerald-700 dark:text-emerald-300">
              {stamp.counts.keep} keep
            </span>
          )}
          {stamp.counts.maybe > 0 && (
            <span className="rounded-full border border-amber-600/30 bg-amber-600/[0.08] px-1.5 py-px font-medium text-amber-700 dark:text-amber-300">
              {stamp.counts.maybe} maybe
            </span>
          )}
          {stamp.counts.reject > 0 && (
            <span className="rounded-full border border-border/60 bg-muted/50 px-1.5 py-px font-medium text-muted-foreground">
              {stamp.counts.reject} reject
            </span>
          )}
        </div>
      </div>

      {/* per-class verdict chips */}
      {classes.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {shown.map((c) => {
            const chip = VERDICT_CHIP[c.verdict];
            return (
              <span
                key={c.cls}
                title={`class ${c.cls} — ${c.verdict}${c.reason ? `: ${c.reason}` : ""}`}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] tabular-nums",
                  chip.cls
                )}
              >
                <span className={cn("font-semibold", c.verdict === "reject" && "line-through opacity-70")}>
                  class {c.cls}
                </span>
                <span>{chip.label}</span>
              </span>
            );
          })}
          {overflow > 0 && (
            <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground/75">
              +{overflow} more
            </span>
          )}
        </div>
      )}

      {/* the advice, at notebook scale */}
      {stamp.advice && (
        <p
          className="mt-2 text-[10px] leading-relaxed text-muted-foreground"
          title={stamp.advice}
        >
          {stamp.advice.length > 220 ? `${stamp.advice.slice(0, 220)}…` : stamp.advice}
        </p>
      )}

      {/* footer: the notebook's provenance — model, passes, date */}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
        {askedLabel && <span>asked {askedLabel}</span>}
        {stamp.model && (
          <>
            {askedLabel && <span aria-hidden="true">·</span>}
            <span title="The vision model that judged the class sheet">{stamp.model}</span>
          </>
        )}
        {stamp.twoPass && (
          <>
            {(askedLabel || stamp.model) && <span aria-hidden="true">·</span>}
            <span
              title="Two independent reads of the same sheet — keeps are the classes both reads agreed on"
            >
              two-pass: {stamp.twoPass.agreed} agreed
              {stamp.twoPass.torn > 0 ? `, ${stamp.twoPass.torn} → maybe` : ""}
              {stamp.twoPass.missing > 0 ? `, ${stamp.twoPass.missing} unconfirmed` : ""}
            </span>
          </>
        )}
        {!stamp.twoPass && (
          <>
            {(askedLabel || stamp.model) && <span aria-hidden="true">·</span>}
            <span title="The second read was unreadable — the first verdict stands">single read</span>
          </>
        )}
        {viaJobName && (
          <>
            <span aria-hidden="true">·</span>
            <span
              title={`This opinion was given about the parent class2d run "${viaJobName}" — this selection was born from it`}
            >
              verdict on {viaJobName}
            </span>
          </>
        )}
      </div>
    </section>
  );
}

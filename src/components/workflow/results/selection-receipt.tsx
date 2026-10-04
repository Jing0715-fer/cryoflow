"use client";

/**
 * t562 — the selection receipt card.
 *
 * The one-number strip above ("particles selected N") says WHAT happened;
 * this card tells the story the engine logged beside it: which classes
 * were kept and pruned (with their occupancy), what decided the keep set
 * (manual ticks / the occupancy rule / a birth selection), where the
 * selection was born (the AI's select_classes or a gallery gesture names
 * its source job), and when the run wrote its receipt.
 *
 * The data plane is the receipt the engine ALREADY wrote — run.out's
 * newest receipt block, parsed by /api/jobs/[id]/selection-receipt (pure
 * read, the t402b log is the primary source). Nothing here re-derives a
 * count from a star; the card can never disagree with what ran.
 *
 * Honest absence: the card renders null while the fetch is in flight and
 * forever after an {available:false} answer (a select2d that never ran
 * has no story to tell — the listing's empty-state already says so). A
 * fetch failure also stays quiet: the Results tab's own retry covers the
 * wire, and a missing receipt must not paint the tab red.
 */

import { useEffect, useState } from "react";
import { ArrowUpRight, ClipboardCheck, Sparkles } from "lucide-react";
import type { SelectionReceipt } from "@/lib/selection-receipt";
import { useWorkflowStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export interface ReceiptResponse {
  jobId: string;
  type: string;
  available: boolean;
  note?: string;
  status?: string;
  result?: string | null;
  receipt?: SelectionReceipt;
  provenance?: {
    kind: "birth" | "param" | "auto";
    birthClasses: number[] | null;
    paramClasses: number[] | null;
    sourceJobId: string | null;
    sourceJobName: string | null;
  };
}

const nfmt = (n: number): string => n.toLocaleString("en-US");

const MODE_CHIP: Record<string, { label: string; cls: string }> = {
  manual: {
    label: "manual",
    cls: "border-indigo-600/30 bg-indigo-600/[0.08] text-indigo-700 dark:text-indigo-300",
  },
  auto: {
    label: "occupancy rule",
    cls: "border-sky-600/30 bg-sky-600/[0.08] text-sky-700 dark:text-sky-300",
  },
  "first-n": {
    label: "first-N",
    cls: "border-border/60 bg-muted/50 text-muted-foreground",
  },
  unknown: {
    label: "selection",
    cls: "border-border/60 bg-muted/50 text-muted-foreground",
  },
};

/** chips per class, kept first (occupancy desc) then pruned (desc) */
function orderedClasses(receipt: SelectionReceipt) {
  const kept = receipt.classes
    .filter((c) => c.kept)
    .sort((a, b) => b.count - a.count || a.cls - b.cls);
  const pruned = receipt.classes
    .filter((c) => !c.kept)
    .sort((a, b) => b.count - a.count || a.cls - b.cls);
  return [...kept, ...pruned];
}

export function SelectionReceipt({
  jobId,
  refreshKey = 0,
  prefetched,
  className,
}: {
  jobId: string;
  refreshKey?: number;
  /** t566 — when the caller already holds the response (the evidence row
   * fetches it for the birth provenance), skip the self-fetch: pass the
   * response (or null while loading) and the card renders it verbatim. */
  prefetched?: ReceiptResponse | null;
  /** t566 — grid placement when the card rides the evidence row. */
  className?: string;
}) {
  const [fetched, setFetched] = useState<ReceiptResponse | null>(null);

  useEffect(() => {
    // t566 — a caller-supplied response replaces the self-fetch entirely:
    // the row owns the wire so the receipt endpoint is hit exactly once.
    if (prefetched !== undefined) return;
    // one fetch per (job, refresh tick): the receipt rides JobResultsLive's
    // 6s poll while a run is live (the class gallery's cadence) and freezes
    // once settled — the log's newest receipt block only changes when a run
    // writes one. `cancelled` keeps a stale fetch from landing after unmount
    // or a superseding tick.
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}/selection-receipt`, {
          cache: "no-store",
        });
        const body: ReceiptResponse | null = res.ok
          ? ((await res.json()) as ReceiptResponse)
          : null;
        if (!cancelled) setFetched(body);
      } catch {
        // quiet absence — the Results tab's own surfaces cover the wire
        if (!cancelled) setFetched(null);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [jobId, refreshKey, prefetched]);

  // t566 — the effective response: the caller's when provided (even as
  // null while its fetch is in flight), our own otherwise. ONE render
  // path reads it, so prefetched mode renders the same card verbatim
  // instead of an eternal null (the empty-grid live catch).
  const data = prefetched !== undefined ? prefetched : fetched;

  const receipt = data?.available ? data.receipt : null;
  if (!data || !receipt) return null;

  const pct =
    receipt.total && receipt.total > 0 && receipt.kept != null
      ? Math.max(0, Math.min(100, (receipt.kept / receipt.total) * 100))
      : null;
  const pctLabel = pct == null ? null : (Math.round(pct * 10) / 10).toFixed(1).replace(/\.0$/, "");

  const chip = MODE_CHIP[receipt.modeKind] ?? MODE_CHIP.unknown;
  const classes = orderedClasses(receipt);
  const CHIP_CAP = 16;
  const shown = classes.slice(0, CHIP_CAP);
  const overflow = classes.length - shown.length;

  const provenance = data.provenance;
  const fromName = provenance?.sourceJobName ?? receipt.source ?? null;

  const ranAtLabel = receipt.ranAtMs
    ? new Date(receipt.ranAtMs).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <section
      aria-label="Selection receipt"
      data-canvas-ui="selection-receipt"
      className={cn(
        "rounded-lg border border-emerald-600/20 bg-emerald-500/[0.03] p-3",
        className
      )}
    >
      {/* header: what decided the keep set + how many classes survived */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <h4 className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-foreground/80">
          <ClipboardCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          Selection receipt
          <span
            className={cn(
              "rounded-full border px-1.5 py-px text-[9px] font-medium uppercase tracking-wide",
              chip.cls
            )}
          >
            {chip.label}
          </span>
          {(receipt.birth || provenance?.kind === "birth") && (
            <span className="inline-flex items-center gap-1 rounded-full border border-violet-600/30 bg-violet-600/[0.08] px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-violet-700 dark:text-violet-300">
              <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
              born
            </span>
          )}
        </h4>
        {(receipt.keptClasses != null && receipt.totalClasses != null) && (
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {receipt.keptClasses}/{receipt.totalClasses} classes kept
          </span>
        )}
      </div>

      {/* the big numbers + the fraction bar */}
      <div className="mt-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
        <span className="text-xl font-semibold tabular-nums leading-none text-emerald-700 dark:text-emerald-400">
          {receipt.kept != null ? nfmt(receipt.kept) : "?"}
        </span>
        <span className="text-[11px] text-muted-foreground">kept of</span>
        <span className="text-sm font-medium tabular-nums leading-none text-foreground/80">
          {receipt.total != null ? nfmt(receipt.total) : "?"}
        </span>
        {pctLabel != null && (
          <span
            className="ml-auto rounded-full bg-emerald-600/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-400"
            title={`${pctLabel}% of the input particles survived the selection`}
          >
            {pctLabel}%
          </span>
        )}
      </div>
      {pct != null && (
        <div
          className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={`${pctLabel} percent of particles kept`}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-600/80 to-emerald-500 transition-[width] duration-700 ease-out motion-reduce:transition-none"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {/* per-class chips: the occupancy the keep set decided on */}
      {classes.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {shown.map((c) => (
            <span
              key={c.cls}
              title={`class ${c.cls} — ${nfmt(c.count)} particles ${c.kept ? "kept" : "pruned"}`}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] tabular-nums",
                c.kept
                  ? "border-emerald-600/30 bg-emerald-600/[0.08] text-emerald-800 dark:text-emerald-300"
                  : "border-border/60 bg-muted/40 text-muted-foreground/75"
              )}
            >
              <span className="font-semibold">class {c.cls}</span>
              <span className={c.kept ? "" : "line-through opacity-70"}>{nfmt(c.count)}</span>
            </span>
          ))}
          {overflow > 0 && (
            <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground/75">
              +{overflow} more
            </span>
          )}
        </div>
      )}
      {classes.length === 0 && receipt.modeKind === "first-n" && (
        <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
          First-N selection — the input carried no per-class rows, so the first
          {receipt.kept != null ? ` ${nfmt(receipt.kept)}` : ""} particles went through.
        </p>
      )}

      {/* footer: where the selection was born + when the receipt was written */}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
        {fromName &&
          // t567 — the door, not just the label: when the provenance names
          // a live job (id AND name — the name proves the row still exists,
          // a deleted parent offers no door), "from" opens that run's own
          // tab. A source known only as a string (receipt.source) stays
          // plain text — never a door whose destination is unverified.
          (provenance?.sourceJobId && provenance?.sourceJobName ? (
            <button
              type="button"
              data-canvas-ui="receipt-from-link"
              onClick={() =>
                void useWorkflowStore.getState().openJob(provenance.sourceJobId!)
              }
              title={
                provenance?.kind === "birth"
                  ? `The selection came baked at birth (AI select_classes or a gallery gesture) — click to open "${fromName}"`
                  : `Source run the selection rode — click to open "${fromName}"`
              }
              className={cn(
                // t570 — the door learns to move: the dotted underline no
                // longer pops, it FADES in and out symmetrically (the line
                // is always laid, its ink travels transparent → current —
                // a pure color fade, reduced-motion safe by nature), and
                // the ArrowUpRight leans up-right on hover: the arrow
                // points where you'd GO, motion as wayfinding. The nudge
                // is a transform, so it rides motion-safe; the fade and
                // tint stay unguarded (fades are color, not movement).
                "group inline-flex items-center gap-0.5 rounded px-0.5 -mx-0.5 text-left transition-colors",
                "hover:bg-emerald-600/10 hover:text-emerald-700 dark:hover:text-emerald-300",
                "underline underline-offset-2 decoration-dotted decoration-transparent hover:decoration-current",
                "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              )}
            >
              from {fromName}
              <ArrowUpRight
                className="h-2.5 w-2.5 shrink-0 opacity-60 transition-[opacity,transform] duration-200 ease-out group-hover:opacity-100 motion-safe:group-hover:translate-x-px motion-safe:group-hover:-translate-y-px"
                aria-hidden="true"
              />
            </button>
          ) : (
            <span title={provenance?.kind === "birth" ? "The selection came baked at birth (AI select_classes or a gallery gesture)" : "Source run the selection rode"}>
              from {fromName}
            </span>
          ))}
        {ranAtLabel && (
          <>
            {fromName && <span aria-hidden="true">·</span>}
            <span>ran {ranAtLabel}</span>
          </>
        )}
        {receipt.ignored.length > 0 && (
          <>
            {(fromName || ranAtLabel) && <span aria-hidden="true">·</span>}
            <span className="text-amber-600 dark:text-amber-400" title="These classes were listed but not present in the input — ignored">
              ignored: {receipt.ignored.join(", ")}
            </span>
          </>
        )}
      </div>
    </section>
  );
}

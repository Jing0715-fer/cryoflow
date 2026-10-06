"use client";

/**
 * CryoFlow — the chart panels' visible wound (t491).
 *
 * The siblings of this strip used to have no face at all: a panel whose
 * fetch died to a transient blip (dev-server OOM, a restart, a
 * first-hit compile 500) rendered `null` and the reader saw — nothing.
 * Nothing is ambiguous: it reads as "no data", though the data may be
 * fine and the server may already be back. This strip is the third
 * state those panels never had: NOT the chart, NOT the honest empty,
 * but "the load failed and you can try again".
 *
 * Visual grammar rides with interpretation-strip.tsx (same 11px amber
 * family, same icon + uppercase-label line) so a wound is recognisable
 * as part of the panel family — but it is a standalone panel-sized
 * card, because it REPLACES the whole panel when there is no data to
 * show. The Retry chip re-fires useChartResource's fetch; on success
 * the panel renders the real chart and the strip is gone.
 */

import { RefreshCw, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function ChartErrorStrip({
  label,
  detail,
  onRetry,
  className,
}: {
  /** the chart's own name, in the header's voice — "FSC curve" */
  label: string;
  /** the final failure's message (HTTP 502, "fetch failed") — shown in
   *  small mono so the wound carries its evidence, not just its mood */
  detail?: string;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <section
      data-chart-error=""
      aria-live="polite"
      aria-label={`${label} could not be loaded`}
      className={cn(
        "animate-rise flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/5 p-3 text-[11px] leading-snug text-warning-700 dark:text-warning-300",
        className
      )}
    >
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1">
        <span className="font-semibold uppercase tracking-wide opacity-80">
          {label}
        </span>
        <span className="mx-1 opacity-40">·</span>
        <span>couldn&apos;t load — the server may be busy or restarting.</span>
        {detail ? (
          <span className="ml-1 font-mono text-[10px] opacity-70">({detail})</span>
        ) : null}
      </p>
      <button
        type="button"
        data-chart-error-retry=""
        onClick={onRetry}
        aria-label={`Retry loading ${label}`}
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-warning/30 bg-warning/10 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide transition-colors hover:bg-warning/20"
      >
        <RefreshCw className="size-3" aria-hidden="true" />
        Retry
      </button>
    </section>
  );
}

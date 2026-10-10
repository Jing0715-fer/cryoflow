"use client";

import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import { isStayReceipt } from "@/lib/remote/stay-receipt";

/**
 * t429 — the stay-receipt's bring-home awareness.
 *
 * `runRemote.note` is a receipt written at sync-back time: it describes
 * what STAYED on the cluster when the run finished ("24 image file(s)
 * stayed on the cluster — fetch on demand / switch the sync policy").
 * Every bring-home leg that lands afterwards (the t289 single-file click,
 * the t424 batch bar) makes the receipt's ADVICE stale while the amber
 * urgency stays. This component re-judges the receipt against live disk
 * truth and speaks the current story:
 *
 *   - not a stay-receipt (ssh loss, stale-generation, …) → untouched amber
 *   - stay-receipt, remaining unknown yet → untouched amber (no flash)
 *   - stay-receipt, remaining > 0 → amber receipt + a modern pointer:
 *     the batch bring-home bar in Results is the one-click leg now — the
 *     receipt's "open or download one" advice predates it (t424)
 *   - stay-receipt, remaining === 0 → the resolved stamp: teal, check
 *     icon, "all brought home" — the original receipt stays below in
 *     muted type as history (it was TRUE at its moment; we don't rewrite
 *     receipts, we add the epilogue)
 *
 * The truth probe: GET /api/jobs/[id]/outputs/remote-remaining (t429) —
 * the sync route's honest remaining computation as a read-only GET. When
 * the caller already HAS a listing (the inspector's outputs data), pass
 * `remoteRemaining` and no fetch happens; otherwise pass `jobId` and the
 * component self-probes once per mount.
 */

type ProbeState = { remaining: number; total: number } | null;

export function RemoteStayNote({
  note,
  remoteRemaining,
  jobId,
}: {
  note: string;
  /** When the caller already counts the listing (inspector): null =
   * "not loaded yet" (renders amber, no flash), number = judged. Leave
   * undefined to let the component self-probe via jobId. */
  remoteRemaining?: number | null;
  jobId?: string;
}) {
  const selfProbe = remoteRemaining === undefined && jobId != null && isStayReceipt(note);
  const [probed, setProbed] = React.useState<ProbeState>(null);

  React.useEffect(() => {
    if (!selfProbe) return;
    let alive = true;
    fetch(`/api/jobs/${jobId}/outputs/remote-remaining`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { remaining?: number; total?: number } | null) => {
        if (alive && body && typeof body.remaining === "number" && typeof body.total === "number") {
          setProbed({ remaining: body.remaining, total: body.total });
        }
      })
      .catch(() => {
        /* transient — the amber receipt stays, honest enough */
      });
    return () => {
      alive = false;
    };
  }, [selfProbe, jobId]);

  const remaining = remoteRemaining !== undefined ? remoteRemaining : probed?.remaining ?? null;

  if (!isStayReceipt(note)) {
    return <PlainStayNote note={note} />;
  }

  // truth not in yet — the receipt as written (no resolved flash)
  if (remaining == null) {
    return <PlainStayNote note={note} />;
  }

  if (remaining === 0) {
    return (
      <div
        role="note"
        data-stay-note="resolved"
        className="rounded-md bg-running/[0.07] px-2 py-1.5 text-[11px] leading-relaxed text-running-700 dark:text-running-300"
      >
        <span className="flex items-start gap-1.5 font-medium">
          <CheckCircle2 className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <span>
            All brought home — nothing from this run is left on the cluster. Nothing to fetch.
          </span>
        </span>
        <span className="mt-1 block border-l-2 border-running/20 pl-2 text-[10.5px] leading-relaxed text-muted-foreground">
          At sync time: {note}
        </span>
      </div>
    );
  }

  return (
    <div role="note" data-stay-note="open" className="space-y-1">
      <p className="rounded-md bg-warning/10 px-2 py-1.5 text-[11px] leading-relaxed text-warning-700 dark:text-warning-300">
        {note}
      </p>
      <p className="flex items-center gap-1.5 px-2 text-[10.5px] leading-relaxed text-running-700 dark:text-running-300">
        <CheckCircle2 className="size-3 shrink-0" aria-hidden="true" />
        <span>
          {remaining} file{remaining === 1 ? "" : "s"} still on the cluster — Results →{" "}
          <span className="font-medium">Bring home all</span> brings them all in one click.
        </span>
      </p>
    </div>
  );
}

function PlainStayNote({ note }: { note: string }) {
  return (
    <p
      role="note"
      data-stay-note="original"
      className="rounded-md bg-warning/10 px-2 py-1.5 text-[11px] leading-relaxed text-warning-700 dark:text-warning-300"
    >
      {note}
    </p>
  );
}

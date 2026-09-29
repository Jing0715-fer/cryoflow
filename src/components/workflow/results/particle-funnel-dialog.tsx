"use client";

/**
 * CryoFlow — the particle funnel dialog (t461).
 *
 * Not the compare family's eighth question — a new face entirely: the
 * CHAIN question. The compare family pairs two runs (or a run with its
 * own rounds); this one walks the whole line a particle traveled and
 * asks "where did my particles go?" — 24 micrographs went in at the
 * top, 5,672 came out refined at the bottom, and every verb between
 * them either sheds, carries, or multiplies.
 *
 * The face's laws (family-inherited + domain-local):
 *   - THE FACE IS THE FUNNEL: not a chart — a stack of stage rows,
 *     each bar's width square-root scaled against the widest stage,
 *     and the line BETWEEN every neighboring pair spoken out loud
 *     (carry / shed / gain / transform — a growth is never written as
 *     a loss, a unit change never as a fake percentage).
 *   - THE RECEIPT IS THE LEDGER: the numbers are the engine's own
 *     counted receipts (t347's dialect). A verb whose receipt is
 *     silent (mask-create) speaks amber — "a volume verb, no
 *     particles on its receipt" — it is never dropped, never guessed.
 *   - THE CHAIN IS WALKED, NOT GUESSED: real edges, canonical stage
 *     order at branches; jobs the mainline left behind speak in the
 *     census line instead of vanishing.
 *   - THE SHAPE CONFESSES ITS SCALE: bars are sqrt-scaled and the
 *     footer says so — the numbers are the ledger, the bars are only
 *     the shape.
 *   - VERBLESS: the funnel reads; it does not mutate. A different
 *     chain comes from re-running a verb.
 *   - THE DOOR GUARDS ITSELF: nothing renders unless the host is a
 *     completed job on a funnel stage AND the route returns a chain.
 */

import { useEffect, useState } from "react";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { JobDTO } from "@/lib/types";
import { FUNNEL_ENTRY_TYPES, type FunnelLedger, type FunnelRow } from "@/lib/particle-funnel";

interface FunnelPayload extends FunnelLedger {
  jobId: string;
}

async function fetchFunnel(jobId: string): Promise<FunnelPayload | null> {
  const res = await fetch(`/api/jobs/${jobId}/funnel`, {
    headers: { Origin: window.location.origin },
  });
  if (!res.ok) throw new Error(`route said ${res.status}`);
  return (await res.json()) as FunnelPayload;
}

/* ------------------------------------------------------------------ */
/* The door — beside the family's six, the chain's own.                */
/* ------------------------------------------------------------------ */

export function ParticleFunnelEntry({ job }: { job: JobDTO }) {
  const [payload, setPayload] = useState<FunnelPayload | null>(null);
  const [open, setOpen] = useState(false);

  // One cheap GET per inspector mount — the door cannot know the chain
  // without asking (data fetching, not state syncing).
  useEffect(() => {
    if (job.status !== "completed" || !FUNNEL_ENTRY_TYPES.has(job.type)) {
      return;
    }
    let alive = true;
    fetchFunnel(job.id)
      .then((p) => {
        if (alive) setPayload(p);
      })
      .catch(() => {
        /* the door hides when the chain cannot be read */
      });
    return () => {
      alive = false;
    };
  }, [job.id, job.status, job.type]);

  if (!payload || payload.rows.length === 0) return null;
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 rounded-md text-muted-foreground/70 hover:bg-muted hover:text-foreground"
        aria-label={`Particle funnel — read where the particles went across ${payload.rows.length} stages`}
        title="Particle funnel — the chain question: where did my particles go? Every verb between the micrographs and the refined map, with the attrition spoken out loud."
        onClick={() => setOpen(true)}
      >
        <Filter className="size-3.5" aria-hidden="true" />
      </Button>
      <ParticleFunnelDialog
        open={open}
        onOpenChange={setOpen}
        job={job}
        payload={payload}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* The face — the funnel, the deltas, the census.                      */
/* ------------------------------------------------------------------ */

const UNIT_TINT: Record<string, string> = {
  micrographs: "bg-sky-500/70",
  picks: "bg-violet-500/70",
  particles: "bg-primary/80",
};

const UNIT_DOT: Record<string, string> = {
  micrographs: "bg-sky-400",
  picks: "bg-violet-400",
  particles: "bg-primary",
};

const DELTA_TONE: Record<string, string> = {
  carry: "text-muted-foreground/70",
  shed: "text-amber-700 dark:text-amber-400",
  gain: "text-teal-700 dark:text-teal-400",
  transform: "text-sky-700 dark:text-sky-400",
};

function ParticleFunnelDialog({
  open,
  onOpenChange,
  job,
  payload,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: JobDTO;
  payload: FunnelPayload;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-4 overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Filter className="size-4 text-primary" aria-hidden="true" />
            Particle funnel — {job.name}
          </DialogTitle>
          <DialogDescription>
            The chain question — where did my particles go? Every verb
            between the micrographs and the refined map, read from the
            receipts the engine wrote: what each stage kept, what it shed,
            what it multiplied.
          </DialogDescription>
        </DialogHeader>

        {/* the headline — evidence first */}
        <div className="text-xs font-medium text-foreground">{payload.headline}</div>

        {/* the funnel — the face for this domain */}
        <div className="rounded-lg border bg-card px-4 py-3">
          {payload.rows.map((row, i) => (
            <FunnelRowView key={row.jobId} row={row} index={i} />
          ))}
          {/* the closing number — the chain's postprocess receipt */}
          {payload.closing ? (
            <div className="mt-3 flex items-center gap-2 border-t pt-3 text-xs">
              <span className="rounded-full bg-teal-600/10 px-2 py-0.5 font-medium text-teal-700 dark:text-teal-400">
                closes at {payload.closing.resolution}
              </span>
              <span className="text-muted-foreground">
                FSC(0.143) — the postprocess receipt&apos;s own verdict on
                where the funnel lands.
              </span>
            </div>
          ) : (
            <div className="mt-3 border-t pt-3 text-[11px] text-muted-foreground">
              No postprocess ends this chain yet — the funnel&apos;s last
              number is where the ledger currently stops.
            </div>
          )}
        </div>

        {/* the census — the chain members the mainline left behind */}
        {payload.offMainline.length > 0 ? (
          <div className="text-[11px] text-muted-foreground">
            Off this mainline, the same chain also fed:{" "}
            {payload.offMainline.map((j, i) => (
              <span key={j.id}>
                {i > 0 ? " · " : ""}
                <span className="font-medium text-foreground/80">{j.name}</span>{" "}
                ({j.type})
              </span>
            ))}
            . The walk follows one line at each branch — these ran beside it.
          </div>
        ) : null}

        {/* the scale's confession + the honest verbless footer */}
        <div className="text-[11px] text-muted-foreground">{payload.note}</div>
        <div className="text-[11px] text-muted-foreground">
          The funnel reads the receipts; it does not mutate. A different
          chain comes from re-running a verb — each stage&apos;s own numbers
          live on its card and in the results below.
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* One stage row: the delta line that owns the edge from the previous
 * stage, then the bar (sqrt-scaled) with its count + unit + chips. */
function FunnelRowView({ row, index }: { row: FunnelRow; index: number }) {
  return (
    <div className={index === 0 ? "" : "mt-2.5"}>
      {row.delta ? (
        <div
          className={`mb-1 flex items-center gap-1.5 text-[10.5px] leading-none ${DELTA_TONE[row.delta.kind] ?? "text-muted-foreground"}`}
        >
          <span
            className={`inline-block size-1.5 rounded-full ${
              row.delta.kind === "shed"
                ? "bg-amber-400"
                : row.delta.kind === "gain"
                  ? "bg-teal-400"
                  : row.delta.kind === "transform"
                    ? "bg-sky-400"
                    : "bg-border"
            }`}
            aria-hidden="true"
          />
          {row.delta.line}
        </div>
      ) : null}
      {row.kind === "ok" ? (
        <div className="flex items-center gap-2">
          <div className="w-28 shrink-0 truncate text-right" title={`${row.name} — ${row.type}`}>
            <span className="block truncate text-[11px] font-medium text-foreground/90">
              {row.name}
            </span>
            <span className="block text-[9.5px] uppercase tracking-wide text-muted-foreground">
              {row.type}
            </span>
          </div>
          <div className="h-7 min-w-0 flex-1">
            <div
              className={`flex h-full items-center rounded-md px-2 ${UNIT_TINT[row.unit ?? "particles"] ?? "bg-primary/80"}`}
              style={{ width: `${Math.max(row.width * 100, 8)}%` }}
              role="img"
              aria-label={`${row.name}: ${row.count?.toLocaleString("en-US")} ${row.unit}`}
            >
              <span className="truncate text-[11px] font-semibold text-white/95">
                {row.count?.toLocaleString("en-US")}
              </span>
            </div>
          </div>
          <div className="flex w-32 shrink-0 flex-wrap items-center gap-1">
            <span className="text-[10px] text-muted-foreground">{row.unit}</span>
            {row.perMic != null ? (
              <span className="rounded bg-muted px-1 py-px text-[9.5px] text-muted-foreground">
                {row.perMic}/mic
              </span>
            ) : null}
            {row.classes != null ? (
              <span className="rounded bg-muted px-1 py-px text-[9.5px] text-muted-foreground">
                {row.classes} classes
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        /* the amber row — a verb the receipt said nothing countable about */
        <div className="flex items-center gap-2">
          <div className="w-28 shrink-0 truncate text-right" title={`${row.name} — ${row.type}`}>
            <span className="block truncate text-[11px] font-medium text-muted-foreground">
              {row.name}
            </span>
            <span className="block text-[9.5px] uppercase tracking-wide text-muted-foreground/70">
              {row.type}
            </span>
          </div>
          <div className="flex h-7 min-w-0 flex-1 items-center rounded-md border border-dashed border-border px-2">
            <span className="text-[10.5px] italic text-muted-foreground">
              {row.subnote ?? "a volume verb — no particles on its receipt"}
            </span>
          </div>
          <div className="w-32 shrink-0" />
        </div>
      )}
    </div>
  );
}

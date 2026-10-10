"use client";

/**
 * CryoFlow — the canvas funnel door (t462).
 *
 * The particle funnel's chain question lived behind two inspector doors
 * (refine3d / postprocess cards) only — discoverable if and only if you
 * already knew to click a card. This is the plain-sight door: a Filter
 * button in the canvas toolbar, beside the minimap and find toggles,
 * that opens the SAME dialog on the chain the canvas is looking at.
 *
 * Laws (family-inherited + door-local):
 *   - SELECTION IS THE QUESTION: one selected verb's chain wins over any
 *     global pick — the door reads what the user is looking at (the
 *     pure brain in funnelDoorCandidate owns the decision; this file
 *     only renders it, the t440 shared-vocabulary law).
 *   - THE DOOR GUARDS ITSELF, HONESTLY: a blocked decision disables the
 *     button and SPEAKS the reason in its title (unfinished selection,
 *     crowded selection, no receipts yet) — it never greys out silently
 *     and never swaps another run's funnel in behind the user's back.
 *   - EVIDENCE IN THE HANDLE: the ready title names the chain it opens
 *     AND which law picked it ("the verb you selected" vs "the deepest
 *     finished verb on the canvas") — the handle confesses its choice.
 *   - THE FETCH IS THE CLICK'S OWN: unlike the inspector door (one GET
 *     per mount), the canvas door asks the route only when clicked —
 *     the toolbar must not pay for a ledger nobody asked for. A failed
 *     read toasts; the door stays closed rather than opening on half a
 *     chain.
 *   - ONE FACE: the dialog is the inspector's ParticleFunnelDialog,
 *     exported verbatim — two doors, one room.
 */

import { useMemo, useState } from "react";
import { Filter, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useActiveWorkspaceJobs, useWorkflowStore } from "@/lib/store";
import { funnelDoorCandidate, type FunnelLedger } from "@/lib/particle-funnel";
import type { JobDTO } from "@/lib/types";
import { ParticleFunnelDialog } from "./results/particle-funnel-dialog";

type FunnelPayload = FunnelLedger & { jobId: string };

export function CanvasFunnelDoor() {
  const jobs = useActiveWorkspaceJobs();
  const selectedIds = useWorkflowStore((s) => s.selectedIds);
  const { toast } = useToast();

  const decision = useMemo(
    () => funnelDoorCandidate(jobs, selectedIds),
    [jobs, selectedIds],
  );

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [payload, setPayload] = useState<FunnelPayload | null>(null);
  const [host, setHost] = useState<JobDTO | null>(null);

  const ready = decision.kind === "ready" ? decision : null;

  const openDoor = () => {
    if (!ready || busy) return;
    const jobId = ready.job.id;
    const jobDto = jobs.find((j) => j.id === jobId) ?? null;
    setBusy(true);
    fetch(`/api/jobs/${jobId}/funnel`, {
      headers: { Origin: window.location.origin },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`route said ${res.status}`);
        return (await res.json()) as FunnelPayload;
      })
      .then((p) => {
        if (p.rows.length === 0) throw new Error("the ledger came back empty");
        setPayload(p);
        setHost(jobDto);
        setOpen(true);
      })
      .catch(() => {
        toast({
          title: "The chain can't be read right now",
          description:
            "The funnel route didn't answer with a ledger — the door stays closed rather than opening on half a chain. Try again in a moment.",
        });
      })
      .finally(() => setBusy(false));
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={openDoor}
        disabled={decision.kind === "blocked" || busy}
        aria-busy={busy}
        aria-label={
          ready
            ? `Particle funnel — read where the particles went, through ${ready.job.name}`
            : "Particle funnel — unavailable"
        }
        title={
          ready
            ? `Particle funnel — the chain question: where did my particles go? Opens the chain that runs through ${ready.job.name} — ${ready.picked === "selection" ? "the verb you selected" : "the deepest finished verb on the canvas"}.`
            : decision.kind === "blocked"
              ? decision.line
              : ""
        }
        data-canvas-ui="funnel-toggle"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Filter className="size-4" aria-hidden="true" />
        )}
      </Button>
      {host && payload ? (
        <ParticleFunnelDialog
          open={open}
          onOpenChange={setOpen}
          job={host}
          payload={payload}
        />
      ) : null}
    </>
  );
}

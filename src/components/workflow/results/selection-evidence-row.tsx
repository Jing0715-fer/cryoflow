"use client";

/**
 * t566 — the selection evidence row.
 *
 * A birth selection (the AI's select_classes or a gallery gesture) knows
 * the class2d run it came from — the receipt route's provenance carries
 * the parent's id and name. When THAT parent carries an AI verdict stamp
 * (a judge has spoken about the very classes this selection was born
 * from), the select job's Results tab shows the two cards side by side:
 * the receipt (engine numbers — WHAT was kept) leads left, the parent's
 * verdict (the judge's reasons — WHY) follows right. One job, two cards,
 * one story; narrow viewports stack them in the same order.
 *
 * LAWS:
 *  - ENGINE OUTPUT LEADS: receipt left (emerald), opinion right (violet)
 *    — the tab already reads engine-first, the row keeps that reading
 *    order instead of letting the AI's voice jump the queue.
 *  - HONEST ABSENCE: no birth provenance, or a parent without a stamp →
 *    the row degrades to the plain full-width receipt — never a lonely
 *    half-width card beside an empty grid track, never a red dot for a
 *    missing opinion.
 *  - NO DOUBLE FETCH: the row fetches the receipt once (it needs the
 *    provenance) and hands the response down as `prefetched`; the
 *    parent's verdict endpoint is hit only when a birth source exists —
 *    a param/auto selection never pays for the round trip.
 *  - THE NOTEBOOK STAYS A NOTEBOOK: the stamp renders with its
 *    "verdict on {parent}" footer note — on this tab it is borrowed
 *    evidence, and the card says whose it is.
 */

import { useEffect, useState } from "react";
import { SelectionReceipt, type ReceiptResponse } from "./selection-receipt";
import { AiVerdictStamp, type VerdictResponse } from "./ai-verdict-stamp";

interface BirthSource {
  id: string;
  name: string | null;
}

export function SelectionEvidenceRow({
  jobId,
  refreshKey = 0,
}: {
  jobId: string;
  refreshKey?: number;
}) {
  const [receipt, setReceipt] = useState<ReceiptResponse | null>(null);
  const [source, setSource] = useState<BirthSource | null>(null);
  const [stamp, setStamp] = useState<VerdictResponse | null>(null);

  const sourceId = source?.id;

  // The receipt response doubles as the provenance source: kind "birth"
  // plus the source job's id is the whole gate for the parent's opinion.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}/selection-receipt`, {
          cache: "no-store",
        });
        const body: ReceiptResponse | null = res.ok
          ? ((await res.json()) as ReceiptResponse)
          : null;
        if (cancelled) return;
        setReceipt(body);
        const prov = body?.available ? body.provenance : null;
        setSource(
          prov?.kind === "birth" && prov.sourceJobId
            ? { id: prov.sourceJobId, name: prov.sourceJobName ?? null }
            : null
        );
      } catch {
        // quiet absence — the Results tab's own surfaces cover the wire
        if (!cancelled) {
          setReceipt(null);
          setSource(null);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [jobId, refreshKey]);

  // The parent's stamp is fetched only when a birth source is known —
  // and refetched with the same cadence so a fresh judge call made
  // moments ago still lands on the paired tab.
  useEffect(() => {
    if (!sourceId) return;
    let cancelled = false;
    const run = async () => {
      try {
        const res = await fetch(`/api/jobs/${sourceId}/ai-verdict`, {
          cache: "no-store",
        });
        const body: VerdictResponse | null = res.ok
          ? ((await res.json()) as VerdictResponse)
          : null;
        if (!cancelled) setStamp(body);
      } catch {
        // quiet absence — a missing opinion must not paint the tab red
        if (!cancelled) setStamp(null);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [sourceId, refreshKey]);

  // Not paired (yet, or ever): the plain receipt, full width — the row
  // never shows a half-width card waiting for a partner that may not come.
  // The destructured guard (not a boolean) keeps `source` narrowed below.
  if (!source || !receipt?.available || !stamp?.available) {
    return (
      <SelectionReceipt
        jobId={jobId}
        refreshKey={refreshKey}
        prefetched={receipt}
      />
    );
  }

  return (
    <div
      className="grid gap-2 lg:grid-cols-5 lg:items-start"
      data-canvas-ui="selection-evidence-row"
    >
      <SelectionReceipt
        jobId={jobId}
        refreshKey={refreshKey}
        prefetched={receipt}
        className="lg:col-span-2"
      />
      <AiVerdictStamp
        jobId={source.id}
        viaJobName={source.name ?? undefined}
        refreshKey={refreshKey}
        prefetched={stamp}
        className="lg:col-span-3"
      />
    </div>
  );
}

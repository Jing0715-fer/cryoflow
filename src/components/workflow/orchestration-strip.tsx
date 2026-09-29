"use client";

/**
 * t449 — the verb's face. The subtree orchestration (t448) lived inside
 * the store as an async loop: a 13-node walk spends minutes dispatching,
 * landing, dispatching again — invisible. This strip is the walk's face:
 * the root it started from, the count so far, the node in flight with
 * its elapsed clock, the dot row (done / active / todo), and the stop
 * verb living next to the sentence it stops.
 *
 * Laws the face inherits:
 *   - one truth: the aria sentence comes from the same brain functions
 *     the bench pins (orchestrationHeadline) — the visual and the spoken
 *     word cannot drift apart;
 *   - the face renders from state, not closure memory — the loop mirrors
 *     its progress counter into subtreeOrch, so a node landing moves the
 *     dots the moment it lands;
 *   - the stop verb's contract is stated where it is clicked: stops
 *     dispatching BEFORE the next node; the one in flight finishes on
 *     its own (the loop's checkpoint, not a kill);
 *   - honesty line (ORCH_TAB_LAW): the walk lives in this tab — reload
 *     or close and the in-flight job still finishes on the cluster while
 *     the rest are never dispatched. The face says so before the user
 *     learns it the hard way.
 *
 * The ticker runs only while a walk exists (useNow(active) — an idle
 * world costs zero timers); initial 0 never enters the first frame
 * (Task 141 doctrine).
 */

import { Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatElapsed } from "@/lib/elapsed";
import { useWorkflowStore } from "@/lib/store";
import {
  ORCH_TAB_LAW,
  ORCH_TAB_LAW_RESUMED,
  orchestrationHeadline,
  orchestrationTicks,
  ticksVisible,
} from "@/lib/subtree-run";
import { useNow } from "@/lib/use-now";

export function OrchestrationStrip() {
  const orch = useWorkflowStore((s) => s.subtreeOrch);
  const stopSubtreeRun = useWorkflowStore((s) => s.stopSubtreeRun);
  const jobs = useWorkflowStore((s) => s.jobs);
  const now = useNow(Boolean(orch));

  if (!orch) return null;

  const total = orch.order.length;
  const current = orch.index < total ? orch.order[orch.index] : null;
  const currentJob = current ? jobs.find((j) => j.id === current.id) : undefined;
  const currentElapsed =
    currentJob?.status === "running" && currentJob.startedAt && now > 0
      ? formatElapsed(now - new Date(currentJob.startedAt).getTime())
      : null;

  const headline = orchestrationHeadline({
    total,
    done: orch.index,
    currentName: current?.name ?? null,
  });
  const sentence = `Re-running subtree from ${orch.rootName} — ${headline}${
    orch.stopRequested ? " — stopping after this job" : ""
  }${orch.resumed ? " — resumed after a reload" : ""}`;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={sentence}
      className="no-print animate-in fade-in slide-in-from-bottom-2 fixed bottom-5 left-1/2 z-40 -translate-x-1/2 duration-200"
    >
      <div className="card-lift-lg flex items-center gap-3 rounded-xl border bg-card/95 py-2.5 pr-2.5 pl-4 shadow-lg backdrop-blur">
        {/* the walk is alive — a breathing dot, not a static glyph */}
        <span className="relative flex size-2.5 shrink-0" aria-hidden="true">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-teal-500 opacity-60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-teal-600" />
        </span>

        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium whitespace-nowrap">
            <span className="truncate">
              Re-running subtree from <span className="font-semibold">{orch.rootName}</span>
            </span>
            {orch.resumed ? (
              <span
                className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400"
                title="This walk survived a reload — the boot picked it up from the session record."
              >
                resumed
              </span>
            ) : null}
            <span className="text-muted-foreground" aria-hidden="true">
              ·
            </span>
            <span className="tabular-nums whitespace-nowrap">
              {orch.index}/{total}
              {current ? (
                <>
                  {" · "}
                  <span className="text-foreground/80">{current.name}</span>
                  {currentElapsed ? (
                    <span className="ml-1 font-normal text-muted-foreground">{currentElapsed}</span>
                  ) : null}
                </>
              ) : null}
              {orch.stopRequested ? (
                <span className="ml-1 text-amber-600 dark:text-amber-400">· stopping…</span>
              ) : null}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
            {orch.resumed ? ORCH_TAB_LAW_RESUMED : ORCH_TAB_LAW}
          </p>
        </div>

        {/* the dot row retires past TICKS_CAP — counts alone then carry it */}
        {ticksVisible(total) ? (
          <div className="hidden items-center gap-1 md:flex" aria-hidden="true">
            {orchestrationTicks(total, orch.index).map((t, i) => (
              <span
                key={i}
                title={orch.order[i]?.name}
                className={
                  t === "done"
                    ? "size-1.5 rounded-full bg-teal-600"
                    : t === "active"
                      ? "size-2 animate-pulse rounded-full bg-teal-500"
                      : "size-1.5 rounded-full bg-border"
                }
              />
            ))}
          </div>
        ) : null}

        <Button
          size="sm"
          variant="ghost"
          disabled={orch.stopRequested}
          onClick={() => stopSubtreeRun()}
          title="Stops dispatching further jobs — the one now running finishes on its own."
          className="h-7 shrink-0 gap-1.5 px-2 text-xs"
        >
          <Square className="size-3" aria-hidden="true" />
          {orch.stopRequested ? "Stopping…" : "Stop"}
        </Button>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkflowStore } from "@/lib/store";

/* ------------------------------------------------------------------ */
/* Engine guidance — one well, many mouths                              */
/* ------------------------------------------------------------------ */
/* The API's `hint` bytes (composeNativeHint, t242) are the WELL: pure  */
/* probe evidence, byte-deterministic. Every surface that repeats the   */
/* question "why is RELION not detected?" renders one of its MOUTHS:    */
/*   · header chip popover (t242)                                       */
/*   · dashboard Active-engine card popover (t243)                      */
/* The mirror law holds across mouths: the rendered non-empty line      */
/* sequence is byte-identical to the API's — two (or three) mouths,     */
/* one well, structurally unable to drift.                              */
/*                                                                      */
/* The guidance's closing line promises "then press Re-detect — no      */
/* restart needed". A promise must not point at a door the reader       */
/* cannot reach from where they stand, so the Re-detect affordance      */
/* rides along wherever the guidance speaks (EngineReDetectRow).        */
/* ------------------------------------------------------------------ */

/**
 * The composed not-found guidance block — the amber block both mouths
 * share. A/B remedy lines keep the composer's column alignment alive
 * (whitespace-pre font-mono); wide lines borrow scroll from their own
 * band (t238 law, inside the popover too).
 */
export function EngineHintBlock({ hint }: { hint: string }) {
  return (
    <div
      className="space-y-0.5 overflow-x-auto rounded-md bg-amber-500/10 px-2 py-1.5"
      data-engine-hint
      aria-label="RELION discovery guidance"
    >
      {hint.split("\n").map((line, i) => (
        <p
          key={i}
          className={cn(
            "text-[10px] leading-relaxed",
            /^[AB]\)/.test(line.trim())
              ? "whitespace-pre font-mono text-foreground/80"
              : "text-muted-foreground"
          )}
        >
          {line}
        </p>
      ))}
    </div>
  );
}

/**
 * The "checked <time> · Re-detect" footer. Both mouths talk to the same
 * store actions, so a detection triggered from the dashboard updates the
 * header chip and vice versa — one environment, one truth.
 */
export function EngineReDetectRow() {
  const system = useWorkflowStore((s) => s.system);
  const refreshSystem = useWorkflowStore((s) => s.refreshSystem);
  const systemRefreshing = useWorkflowStore((s) => s.systemRefreshing);
  const fromCache = system?.fromCache === true;

  return (
    <div className="flex items-center justify-between gap-2">
      <p
        className="text-[10px] text-muted-foreground/70"
        title={
          fromCache
            ? "The saved detection answered instantly — a background probe is re-verifying right now"
            : undefined
        }
      >
        checked {system ? new Date(system.checkedAt).toLocaleTimeString() : "—"}
        {fromCache ? " · saved, re-checking…" : ""}
      </p>
      <button
        type="button"
        onClick={() => void refreshSystem()}
        disabled={systemRefreshing}
        className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground disabled:opacity-60"
        title="Re-run the RELION/WSL environment probe (bypasses the 60s cache)"
      >
        <RefreshCw
          className={cn("size-3", systemRefreshing && "animate-spin")}
          aria-hidden="true"
        />
        {systemRefreshing ? "detecting…" : "Re-detect"}
      </button>
    </div>
  );
}

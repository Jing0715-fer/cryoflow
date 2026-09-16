"use client";

import * as React from "react";
import { Check, Loader2, RefreshCw, Server, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkflowStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";
import type { RelionInstallClient } from "@/lib/types";

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
/* The FOUND world speaks through here too (t244): the InstallSwitcher  */
/* moved in from header.tsx so the dashboard's engine card can offer    */
/* install switching where the engine is named — the card has no dead   */
/* state in either world.                                               */
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

/* ------------------------------------------------------------------ */
/* InstallSwitcher — the found world's mouth (moved from header, t244)  */
/* ------------------------------------------------------------------ */
/* The radio list of every discovered RELION install. Rendered inside   */
/* the header chip's popover since t242's predecessor; since t244 the   */
/* dashboard's Active-engine card popover renders it too — switching    */
/* installs from where the engine is named, not only from the top bar.  */
/* Both mouths read the same store and POST the same /api/system/select */
/* — one environment, one truth, wherever the switch happens.           */

function InstallRow({
  install,
  selected,
  pending,
  onSelect,
}: {
  install: RelionInstallClient;
  selected: boolean;
  pending: boolean;
  onSelect: (id: string) => void;
}) {
  const isWsl = install.execution === "wsl";
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      title={`${install.path}${install.distro ? ` · ${install.distro}` : ""}`}
      disabled={pending || selected}
      onClick={() => onSelect(install.id)}
      className={cn(
        "group flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors",
        selected
          ? "border-teal-500/50 bg-teal-500/10"
          : "border-border bg-card hover:bg-secondary/60",
        pending && "opacity-70"
      )}
    >
      {/* selected / switching indicator */}
      <span
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded-full border",
          selected ? "border-teal-500 bg-teal-500" : "border-muted-foreground/40"
        )}
        aria-hidden="true"
      >
        {pending ? (
          <Loader2 className="size-3 animate-spin text-teal-600 dark:text-teal-400" />
        ) : (
          selected && <Check className="size-3 text-white" />
        )}
      </span>
      {/* version + mode */}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="text-xs font-semibold tabular-nums">
            RELION {install.version ?? "version ?"}
          </span>
          <Badge
            variant="outline"
            className={cn(
              "h-4 shrink-0 px-1 text-[9px] font-semibold uppercase tracking-wide",
              isWsl
                ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
                : "border-teal-500/40 bg-teal-500/10 text-teal-600 dark:text-teal-400"
            )}
          >
            {isWsl ? `WSL · ${install.distro ?? "default"}` : "native"}
          </Badge>
          {install.mpiBinary && (
            <Badge
              variant="outline"
              className="h-4 shrink-0 px-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground"
              title="relion_refine_mpi present — MPI-capable install"
            >
              MPI
            </Badge>
          )}
          {install.cached && (
            <Badge
              variant="outline"
              className="h-4 shrink-0 border-amber-500/40 bg-amber-500/10 px-1 text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400"
              title="Restored from the saved last detection — it could not be re-verified this round (e.g. WSL was cold). Re-detect re-verifies it."
            >
              saved
            </Badge>
          )}
        </span>
        <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground">
          {install.path}
        </span>
        <span className="block text-[9px] text-muted-foreground/70">
          via {install.source}
          {install.ctffindPath ? " · ctffind ✓" : " · no ctffind"}
        </span>
      </span>
      {isWsl ? (
        <Terminal className="size-3.5 shrink-0 text-cyan-600/70 dark:text-cyan-400/70" aria-hidden="true" />
      ) : (
        <Server className="size-3.5 shrink-0 text-teal-600/70 dark:text-teal-400/70" aria-hidden="true" />
      )}
    </button>
  );
}

export function InstallSwitcher() {
  const system = useWorkflowStore((s) => s.system);
  const selectRelionInstall = useWorkflowStore((s) => s.selectRelionInstall);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const installs = system?.installs ?? [];
  if (installs.length === 0) return null;

  const onSelect = async (id: string) => {
    if (pendingId) return;
    setPendingId(id);
    try {
      await selectRelionInstall(id);
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-1.5">
      <p className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>Detected installs</span>
        <span className="font-normal normal-case tracking-normal text-muted-foreground/70">
          {installs.length > 1
            ? `${installs.length} versions — click to switch`
            : system?.autoPicked
              ? "auto-selected"
              : "1 found"}
        </span>
      </p>
      <div className="max-h-40 space-y-1 overflow-y-auto pr-0.5" role="radiogroup" aria-label="RELION installs">
        {installs.map((install) => (
          <InstallRow
            key={install.id}
            install={install}
            selected={install.id === system?.selectedId}
            pending={pendingId === install.id}
            onSelect={(id) => void onSelect(id)}
          />
        ))}
      </div>
    </div>
  );
}

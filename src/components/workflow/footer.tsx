"use client";

import { useActiveWorkspaceJobs, useWorkflowStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import React from "react";
import { FIND_STATUSES, STATUS_CHIP } from "./canvas-find-bar";

export function Footer() {
  // The census counts the SAME workspace-scoped list the canvas renders —
  // a footer that counted jobs across every workspace would advertise
  // cards the viewport can never show (the find bar's own discipline).
  const jobs = useActiveWorkspaceJobs();
  const edges = useWorkflowStore((s) => s.edges);
  const project = useWorkflowStore((s) => s.project);

  const system = useWorkflowStore((s) => s.system);

  // The lens half of the census — the footer writes to the exact same
  // store fields the find bar's chips own, so every consumer (count,
  // card rings, minimap amber, cycle cursor) stays one truth.
  const findOpen = useWorkflowStore((s) => s.findOpen);
  const findQuery = useWorkflowStore((s) => s.findQuery);
  const findStatus = useWorkflowStore((s) => s.findStatus);
  const findCategory = useWorkflowStore((s) => s.findCategory);
  const openFind = useWorkflowStore((s) => s.openFind);
  const closeFind = useWorkflowStore((s) => s.closeFind);
  const setFindStatus = useWorkflowStore((s) => s.setFindStatus);

  const engineLabel = `REAL RELION${system?.version ? ` ${system.version}` : ""}${system?.execution === "wsl" ? " · WSL bridge" : ""}`;
  const modeLabel = project?.mode === "tomo" ? "tomography" : "single-particle";

  // Task 140 — the status census: counts per status over present jobs,
  // in the order the find bar's chips speak them. Presence-derived like
  // the type chips: a status the workspace doesn't have can't be a
  // filter, so a zero-count status renders nothing (the total already
  // tells you the universe).
  const census = React.useMemo(
    () =>
      FIND_STATUSES.map(({ value, label }) => ({
        value,
        label,
        count: jobs.filter((j) => j.status === value).length,
      })).filter((c) => c.count > 0),
    [jobs],
  );

  /** Toggle contract — "restore to the state you found". First click
   *  opens the lens with this status armed (layered over whatever query
   *  was already typed, if any). Second click on the armed entry undoes
   *  exactly that: if the lens holds nothing but this filter it closes
   *  entirely; if the user stacked intent on top (typed text, armed a
   *  type) only the status disarms — a click never destroys someone
   *  else's words. */
  const onCensusClick = (value: (typeof FIND_STATUSES)[number]["value"]) => {
    if (findOpen && findStatus === value) {
      if (!findQuery.trim() && findCategory === "all") closeFind();
      else setFindStatus("all");
    } else {
      openFind();
      setFindStatus(value);
    }
  };

  return (
    <footer className="no-print mt-auto flex min-h-9 shrink-0 items-center justify-between gap-4 border-t bg-background/80 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-xs text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-4">
      <p className="truncate">
        CryoFlow — light-first cryo-EM workflow UI · {project ? `${project.name} · ${modeLabel} · ${engineLabel}` : "Demo data stored in SQLite"}
      </p>
      <div className="hidden shrink-0 items-center gap-3 sm:flex">
        <span className="tabular-nums">
          {jobs.length} {jobs.length === 1 ? "job" : "jobs"} · {edges.length}{" "}
          {edges.length === 1 ? "edge" : "edges"}
        </span>
        {census.length > 0 && (
          <>
            <span aria-hidden="true" className="text-border">
              |
            </span>
            <div
              role="group"
              aria-label="Job status census — click a count to highlight those jobs on the canvas"
              className="flex items-center gap-0.5"
            >
              {census.map(({ value, label, count }) => {
                const armed = findOpen && findStatus === value;
                const chip = STATUS_CHIP[value];
                return (
                  <button
                    key={value}
                    type="button"
                    data-testid={`footer-census-${value}`}
                    aria-pressed={armed}
                    title={
                      armed
                        ? `Clear the ${label.toLowerCase()} filter`
                        : `Highlight ${count} ${label.toLowerCase()} job${count === 1 ? "" : "s"} on the canvas`
                    }
                    onClick={() => onCensusClick(value)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 tabular-nums transition-colors",
                      armed
                        ? chip.active
                        : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-1.5 rounded-full",
                        chip.dot,
                        // the world's own heartbeat, not the lens's — a
                        // running count pulses while work is moving
                        value === "running" && "animate-soft-pulse",
                      )}
                    />
                    {count}
                    <span className="hidden lg:inline">{label.toLowerCase()}</span>
                    <span className="sr-only lg:hidden">{label.toLowerCase()}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
        <span aria-hidden="true" className="text-border">
          |
        </span>
        <span>Next.js 16 · Tailwind 4 · shadcn/ui</span>
      </div>
    </footer>
  );
}

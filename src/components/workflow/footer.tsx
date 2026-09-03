"use client";

import { useWorkflowStore } from "@/lib/store";

export function Footer() {
  const jobs = useWorkflowStore((s) => s.jobs);
  const edges = useWorkflowStore((s) => s.edges);
  const project = useWorkflowStore((s) => s.project);

  const engineLabel =
    project?.engine === "relion" ? "RELION 5 real engine" : "simulation engine";
  const modeLabel = project?.mode === "tomo" ? "tomography" : "single-particle";

  return (
    <footer className="mt-auto flex min-h-9 shrink-0 items-center justify-between gap-4 border-t bg-background/80 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-xs text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-4">
      <p className="truncate">
        CryoFlow — light-first cryo-EM workflow UI · {project ? `${project.name} · ${modeLabel} · ${engineLabel}` : "Demo data stored in SQLite"}
      </p>
      <div className="hidden shrink-0 items-center gap-4 sm:flex">
        <span className="tabular-nums">
          {jobs.length} {jobs.length === 1 ? "job" : "jobs"} · {edges.length}{" "}
          {edges.length === 1 ? "edge" : "edges"}
        </span>
        <span aria-hidden="true" className="text-border">
          |
        </span>
        <span>Next.js 16 · Tailwind 4 · shadcn/ui</span>
      </div>
    </footer>
  );
}

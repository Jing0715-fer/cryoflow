"use client";

/**
 * CryoFlow — print-only document masthead.
 *
 * Hidden on screen (`hidden`), revealed only by the print media
 * (`print:block`). The interactive Header shows brand + stats, but paper
 * needs a *document* opening line: what pipeline is this, which project /
 * workspace, and when was it printed — the same way a lab printout gets a
 * dated title strip. Data comes straight from the workflow store so the
 * masthead can never drift from what is actually on the canvas.
 *
 * The `data-print-doc` hook is the QA contract (qa66 Phase B asserts the
 * element is screen-hidden and that its text reaches the printed PDF).
 */

import { useWorkflowStore } from "@/lib/store";

export function PrintDocHeader() {
  const project = useWorkflowStore((s) => s.project);
  const view = useWorkflowStore((s) => s.view);
  const jobs = useWorkflowStore((s) => s.jobs);
  const edges = useWorkflowStore((s) => s.edges);
  const workspaces = useWorkflowStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkflowStore((s) => s.activeWorkspaceId);

  const isDashboard = view === "dashboard";
  const workspaceName =
    workspaces.find((w) => w.id === activeWorkspaceId)?.name ?? null;
  const modeLabel = project?.mode === "tomo" ? "tomography" : "single-particle";

  const title = isDashboard
    ? (project?.name ?? "Project dashboard")
    : (workspaceName ?? "Workflow canvas");

  const subtitle = isDashboard
    ? "Project dashboard — all workspaces at a glance"
    : [
        project ? `Project ${project.name}` : null,
        modeLabel,
        "pipeline snapshot",
      ]
        .filter(Boolean)
        .join(" · ");

  // rendered when the masthead mounts — i.e. moments before the print
  // dialog opens reads the DOM, so "printed <date>" is honest to the minute
  const printed = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <header
      data-print-doc
      className="hidden border-b border-foreground/15 pb-3 print:block"
    >
      <div className="flex items-end justify-between gap-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            CryoFlow — pipeline snapshot
          </p>
          <h1 className="mt-1 truncate text-xl font-semibold tracking-tight">
            {title}
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <p className="shrink-0 text-right text-[11px] leading-4 tabular-nums text-muted-foreground">
          {printed}
          <br />
          {jobs.length} {jobs.length === 1 ? "job" : "jobs"} · {edges.length}{" "}
          {edges.length === 1 ? "edge" : "edges"}
        </p>
      </div>
    </header>
  );
}

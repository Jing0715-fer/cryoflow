"use client";

/**
 * CryoFlow — print-only document footer, repeated on EVERY printed page.
 *
 * `position: fixed` inside @media print makes Chromium re-paint the element
 * at the bottom of each sheet of a multi-page printout (single-page prints
 * simply get a document footer line, like a plot caption). Without it, a
 * printout that spans pages loses all document identity the moment page 1
 * separates from the stack — the fixed strip keeps "what am I looking at"
 * on every sheet. Page NUMBERS are deliberately absent: Chromium has no
 * @page margin boxes, so counter(page) cannot reach the content flow —
 * page-agnostic identity (workspace · project · date) is the honest subset.
 *
 * The footer is tiny and muted so that on flowing documents (dashboard
 * tables) the worst case is a near-invisible overlap on a full page, never
 * obscured content. Hidden on screen (`hidden`), print-only (`print:block`).
 */

import { useWorkflowStore } from "@/lib/store";

export function PrintDocFooter() {
  const project = useWorkflowStore((s) => s.project);
  const jobs = useWorkflowStore((s) => s.jobs);
  const edges = useWorkflowStore((s) => s.edges);
  const workspaces = useWorkflowStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkflowStore((s) => s.activeWorkspaceId);

  const workspaceName =
    workspaces.find((w) => w.id === activeWorkspaceId)?.name ?? null;
  const scope = workspaceName
    ? `${workspaceName} · ${project?.name ?? "project"}`
    : (project?.name ?? "CryoFlow");

  const printed = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <footer
      data-print-foot
      className="fixed inset-x-0 bottom-0 hidden items-center justify-between gap-4 border-t border-foreground/15 pt-1 text-[9px] leading-3 text-muted-foreground print:flex"
    >
      <span className="min-w-0 truncate">CryoFlow — {scope}</span>
      <span className="shrink-0 tabular-nums">
        {printed} · {jobs.length} {jobs.length === 1 ? "job" : "jobs"} ·{" "}
        {edges.length} {edges.length === 1 ? "edge" : "edges"}
      </span>
    </footer>
  );
}

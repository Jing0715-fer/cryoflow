/**
 * CryoFlow — live project stats overlay (client).
 *
 * GET /api/projects serves a per-project stats SNAPSHOT (groupBy status).
 * The store only refetches that list on full load(), so any job mutation
 * (add job, create template, delete, status flip while polling) leaves the
 * Dashboard KPI band + project cards showing stale counts until F5.
 *
 * The client already holds the project's full job list in the store — from
 * it we can compute stats with exactly the server's semantics (see
 * src/lib/projects.ts listProjectsWithStats): count by status, idle jobs
 * count toward total only. This module overlays those live numbers onto the
 * active project's entry so every stat surface breathes with the store.
 */

import type { JobDTO, ProjectSummaryDTO } from "./types";

/** Mirrors the server's ProjectStats shape (all buckets present). */
export interface LiveProjectStats {
  total: number;
  running: number;
  /** waiting for an upstream job — amber, not failed */
  pending: number;
  completed: number;
  failed: number;
}

/** One status-groupBy pass — same buckets as the server aggregate. */
export function computeJobStats(
  jobs: ReadonlyArray<Pick<JobDTO, "status">>
): LiveProjectStats {
  const stats: LiveProjectStats = {
    total: jobs.length,
    running: 0,
    pending: 0,
    completed: 0,
    failed: 0,
  };
  for (const j of jobs) {
    if (j.status === "running") stats.running += 1;
    else if (j.status === "pending") stats.pending += 1;
    else if (j.status === "completed") stats.completed += 1;
    else if (j.status === "failed") stats.failed += 1;
    // idle (and any future status) counts toward total only — server parity
  }
  return stats;
}

type WithStats = ProjectSummaryDTO & { stats?: Partial<LiveProjectStats> };

/**
 * Overlay live stats onto the active project's entry; other projects keep
 * their snapshot (their job lists aren't in the client store). Returns a new
 * array — feed it through useMemo so consumers re-render only when inputs do.
 */
export function withLiveStats<T extends WithStats>(
  projects: readonly T[],
  activeId: string | null,
  jobs: ReadonlyArray<Pick<JobDTO, "status">>
): T[] {
  if (!activeId) return [...projects];
  const live = computeJobStats(jobs);
  return projects.map((p) => (p.id === activeId ? { ...p, stats: live } : p));
}

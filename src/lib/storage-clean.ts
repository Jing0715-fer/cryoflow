/**
 * Storage board's clean bridge (t441) — the pure brains, client-safe.
 *
 * The storage overview (t436) declared itself the map and sent every
 * cleaning job to the inspector's shovel. Four windows of queueing later
 * the doctrine gains a bridge: the shovel comes to visit the map. These
 * helpers are the bridge's load-bearing pieces — the door's predicate,
 * the walk's own delta account, and the receipt's wording — kept pure so
 * the bench can hold them without a browser.
 *
 * Laws:
 *   - The door mirrors the SERVER's own live-run law (the cleanup route
 *     refuses running/pending), never invents a stricter one: the dialog
 *     is the authority, the door is a courtesy pre-filter.
 *   - The freed-bytes story belongs to the WALK, not to the planner's
 *     deletion receipt: two walks of the same project, one before the
 *     eraser and one after, and only a positive difference is claimed.
 *     A walk that grew (other activity on disk) owes nobody a story.
 *   - The receipt names WHICH walk it compares against (its fetch time)
 *     so a stale snapshot can never quietly inflate the claim.
 */

import { fmtBytes } from "@/lib/relion/disk-usage";

/**
 * The door's pre-filter: exactly the statuses the cleanup route refuses
 * (route.ts: `job.status === "running" || job.status === "pending"` — a
 * live run's iteration files are being written). Anything else —
 * completed, failed, whatever the future adds — opens the dialog and
 * lets the planner speak for itself.
 */
export function isCleanableStatus(status: string): boolean {
  return status !== "running" && status !== "pending";
}

/**
 * The walk's own account of a clean: `before` is the pre-clean walk's
 * total (null = we never saw the disk), `after` the fresh post-clean
 * walk. A positive difference is the only honest free-bytes claim; an
 * equal-or-larger after (the disk moved for other reasons too) claims
 * nothing.
 */
export function walkDelta(before: number | null, after: number): number {
  if (before === null || after >= before) return 0;
  return before - after;
}

/**
 * The receipt line's text — the shovel's answer to the map. When the
 * walk shrank, the line names the walk it compared against (its fetch
 * time, when known) so the reader can judge the snapshot's freshness
 * themselves.
 */
export function formatCleanReceipt(
  jobName: string,
  deltaBytes: number,
  walkedAt?: string
): string {
  if (deltaBytes <= 0) {
    return `Cleaned ${jobName} — the fresh walk came back unchanged`;
  }
  const anchor = walkedAt ? `the ${walkedAt} walk` : "the last walk";
  return `Cleaned ${jobName} — ${fmtBytes(deltaBytes)} lighter than ${anchor}`;
}

/**
 * The lens's second view (t441): one category, sorted by WHO feeds it.
 * Takes the storage response's job rows (any structural superset — the
 * dialog passes its own StorageJobRow) and returns the rows whose share
 * of `cat` is above zero, heaviest first, dirName as the stable
 * tiebreak — the API's own ordering dialect. Orphans ride along (the
 * shared asset store is often exactly the whale); the caller renders
 * their amber honesty.
 */
export interface CategoryRunRow<K extends string = string> {
  jobId: string | null;
  dirName: string;
  categories: Partial<Record<K, { bytes: number; files: number }>>;
}

export function runsForCategory<K extends string, T extends CategoryRunRow<K>>(
  jobs: T[],
  cat: K
): Array<T & { catBytes: number; catFiles: number }> {
  return jobs
    .map((j) => ({
      ...j,
      catBytes: j.categories[cat]?.bytes ?? 0,
      catFiles: j.categories[cat]?.files ?? 0,
    }))
    .filter((j) => j.catBytes > 0)
    .sort((a, b) => b.catBytes - a.catBytes || a.dirName.localeCompare(b.dirName));
}

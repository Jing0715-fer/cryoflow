/**
 * CryoFlow — staleness wavefront (t444): the graph knows what the
 * statuses don't say.
 *
 * The quiet gap Task 443's honesty note named: after a downstream
 * adoption or an upstream re-run, the children's results are still
 * "completed" — built on an upstream that no longer exists. Nothing in
 * the app says so; the receipt toast fades and the canvas lies by
 * looking finished. This module derives the truth from the graph the
 * app already holds — zero schema change, zero persistence.
 *
 * THE WAVEFRONT LAW: a job is stale exactly when one of its DIRECT
 * upstreams re-ran AFTER this result was produced — a finished upstream
 * whose startedAt is newer than the child's own startedAt. Only direct
 * upstreams are examined, and that is the whole trick: re-running a
 * child refreshes ITS startedAt, which makes ITS downstream stale in
 * turn — the wave propagates along the chain one re-run at a time,
 * never ahead of the work actually done. A grandchild built before its
 * parent's re-run is stale only once the parent re-runs; labeling it
 * earlier would claim a rebuild that hasn't happened.
 *
 * WHY startedAt (and not updatedAt): t282's no-op suppression keeps
 * updatedAt honest about EDITS, and edits are exactly the noise this
 * law must ignore — dragging a card, tweaking a param for later both
 * bump updatedAt without touching the result's provenance. startedAt
 * changes only when a run actually starts, which is precisely the
 * event "this output is from a different era than mine". A re-run that
 * ends in failure still refreshes startedAt — the upstream is churning
 * and the child's result predates the churn; the badge says so either
 * way.
 *
 * ADOPTION FITS FOR FREE: re-parenting a child to a younger run (the
 * twin) makes the new upstream's startedAt newer than the child's —
 * stale, correctly, because the child has never consumed the twin's
 * output. Adopting BACK to the original restores an upstream older
 * than the child — the badge disappears, correctly, because the
 * child's result WAS produced from that original. The timestamp law
 * and the provenance truth agree in both directions without a single
 * stored byte.
 *
 * Pure brain: no React, no store, no fetch — the same law as
 * adopt-branch.ts (t443).
 */

/** The slices the law needs — JobDTO and EdgeDTO satisfy these. */
export interface StaleJobLike {
  id: string;
  name: string;
  status: string;
  startedAt: string | null;
}

export interface StaleEdgeLike {
  fromJobId: string;
  toJobId: string;
}

/** One job's staleness: who moved on, and when (for the tooltip). */
export interface StaleInfo {
  /** finished direct upstreams that re-ran after this result */
  upstreamIds: string[];
  /** the newest upstream start among them — the badge's "since" */
  since: string;
}

export type StaleReport = Map<string, StaleInfo>;

/** Terminal states — a run that FINISHED can supersede a child's era.
 *  running/pending upstreams are mid-churn: the wave lands when they
 *  finish, not while they run (labeling early would warn about a
 *  rebuild that may still fail). */
const TERMINAL = new Set(["completed", "failed"]);

/**
 * ISO-8601 strings from the same clock compare lexicographically in
 * time order; a missing half never wins (null startedAt → not stale —
 * no evidence is no verdict).
 */
function newerThan(a: string, b: string): boolean {
  return a > b;
}

export function findStaleJobs(jobs: StaleJobLike[], edges: StaleEdgeLike[]): StaleReport {
  const byId = new Map(jobs.map((j) => [j.id, j]));
  const report: StaleReport = new Map();

  // group edges by child once; the per-job lookup stays O(in-degree)
  const incoming = new Map<string, string[]>();
  for (const e of edges) {
    const list = incoming.get(e.toJobId);
    if (list) list.push(e.fromJobId);
    else incoming.set(e.toJobId, [e.fromJobId]);
  }

  for (const job of jobs) {
    // a job with no result era of its own cannot be "behind" anything
    if (job.startedAt == null) continue;
    if (job.status !== "completed") continue;

    let newest: string | null = null;
    const upstreamIds: string[] = [];

    for (const upId of incoming.get(job.id) ?? []) {
      const up = byId.get(upId);
      if (!up) continue;
      if (!TERMINAL.has(up.status)) continue;
      if (up.startedAt == null) continue;
      if (!newerThan(up.startedAt, job.startedAt)) continue;
      upstreamIds.push(upId);
      if (newest == null || newerThan(up.startedAt, newest)) newest = up.startedAt;
    }

    if (upstreamIds.length > 0 && newest != null) {
      report.set(job.id, { upstreamIds, since: newest });
    }
  }

  return report;
}

/**
 * The spoken form. ONE sentence that is true in every scenario the
 * law fires on: an upstream re-ran (the result predates the re-run),
 * or adoption re-parented the child to a younger run (the result
 * predates the twin's run — the twin never "re-ran", so the sentence
 * never says it did). Names over ids — a badge that says "job cmul…"
 * tells the user nothing; the CALLER resolves names (it owns the job
 * list) and passes them aligned with `info.upstreamIds` — a missing
 * name falls back to the raw id rather than a blank. The `since`
 * timestamp renders in the caller's locale; the lib hands over the
 * raw instant.
 */
export function describeStaleness(
  info: StaleInfo,
  names: string[],
): { short: string; long: string; since: string } {
  const resolved = info.upstreamIds.map((id, i) => names[i] ?? id);
  const who =
    resolved.length === 1
      ? resolved[0]
      : resolved.length === 2
        ? resolved.join(" and ")
        : `${resolved.slice(0, -1).join(", ")} and ${resolved[resolved.length - 1]}`;
  return {
    short: `Predates ${who}'s latest run`,
    long: `This result was produced before ${who}'s latest run — the upstream output has moved on since. Re-run this job to catch up.`,
    since: info.since,
  };
}

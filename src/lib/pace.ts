/**
 * CryoFlow — pipeline pace arithmetic (SERVER+CLIENT, pure).
 *
 * The pace face answers "how fast does this pipeline actually run?":
 * per-stage durations, the chain's wall time, the median run. The math
 * lives here (zero imports, plain functions only — the unit-lift law:
 * `src/lib/elapsed.ts` doctrine) so the API route, the dialog and the
 * unit's lifted oracle all run the SAME arithmetic and cannot drift.
 *
 * THE DATA CONTRACT (what the world actually stores):
 *   - a COMPLETED job's `duration` is the REAL elapsed milliseconds —
 *     the engine overwrites the simulated default at completion
 *     (engine.ts: `duration: Math.max(1000, elapsed)`);
 *   - a FAILED diagnosis face carries `startedAt: null` and a simulated
 *     `duration` — a run that never started claims NO time. The pace
 *     face lists failures honestly but never turns their numbers into
 *     clock time;
 *   - a RUNNING job's live elapsed is a CLIENT concern (the ticker) —
 *     the arithmetic here takes a snapshot-shaped input.
 */

/**
 * Median of a non-empty number array (mean of the two middles on even
 * counts). Returns null for an empty array — no run, no median.
 */
export function medianOf(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * The pace computation. `jobs` is the project's job rows shaped to
 * { id, name, type, status, duration, startedAt } (startedAt an ISO
 * string or null). Returns:
 *   totals  — the counts + the aggregate clock facts;
 *   stages  — per-type aggregates in FIRST-RUN order (the chain's own
 *             order, not alphabetical — the face reads as the pipeline);
 *   rows    — the completed jobs in chain order (the table's source),
 *             each carrying its derived finishedAt;
 *   failed  — the failed jobs in creation order (names only, no clock).
 */
export function computePace(jobs) {
  const list = Array.isArray(jobs) ? jobs : [];
  const completed = list.filter((j) => j.status === "completed");
  const failed = list.filter((j) => j.status === "failed");
  const running = list.filter((j) => j.status === "running");
  const idle = list.filter((j) => j.status !== "completed" && j.status !== "failed" && j.status !== "running");

  // chain order: started-at ascending; runs without a clock go last
  // (honest — an unknown start sorts after every known one, it does not
  // pretend to be first)
  const byStart = [...completed].sort((a, b) => {
    const ta = a.startedAt ? Date.parse(a.startedAt) : Infinity;
    const tb = b.startedAt ? Date.parse(b.startedAt) : Infinity;
    return ta - tb;
  });

  const rows = byStart.map((j) => ({
    id: j.id,
    name: j.name,
    type: j.type,
    durationMs: j.duration,
    startedAt: j.startedAt,
    finishedAt:
      j.startedAt != null && Number.isFinite(j.duration)
        ? new Date(Date.parse(j.startedAt) + j.duration).toISOString()
        : null,
  }));

  // per-type aggregates, first-seen order preserved — the filter walk is
  // O(types × jobs), and a project's job count is hundreds at most
  const seen = byStart
    .map((j) => j.type)
    .filter((type, i, all) => all.indexOf(type) === i);
  const stages = seen.map((type) => {
    const ds = byStart.filter((j) => j.type === type).map((j) => j.duration);
    return {
      type,
      count: ds.length,
      totalMs: ds.reduce((sum, d) => sum + d, 0),
      medianMs: medianOf(ds),
      minMs: Math.min(...ds),
      maxMs: Math.max(...ds),
    };
  });

  const durations = byStart.map((j) => j.duration);
  const starts = byStart.map((j) => (j.startedAt ? Date.parse(j.startedAt) : null)).filter((t) => t != null);
  const finishes = rows.map((r) => (r.finishedAt ? Date.parse(r.finishedAt) : null)).filter((t) => t != null);
  const wallMs =
    starts.length > 0 && finishes.length > 0 ? Math.max(...finishes) - Math.min(...starts) : null;

  const totals = {
    completed: completed.length,
    failed: failed.length,
    running: running.length,
    idle: idle.length,
    totalMs: durations.reduce((sum, d) => sum + d, 0),
    wallMs,
    medianMs: medianOf(durations),
  };

  return {
    totals,
    stages,
    rows,
    failed: failed.map((j) => ({ id: j.id, name: j.name, type: j.type })),
  };
}

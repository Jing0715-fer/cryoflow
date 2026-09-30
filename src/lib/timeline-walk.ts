/**
 * CryoFlow — the session timeline's honest-window well (t504).
 *
 * The analytics page's Gantt picked this arithmetic for its own bars
 * (Task 123): the engine stamps startedAt when a job flips to running
 * and writes the measured elapsed into duration on completion, so
 * [startedAt, startedAt + duration] is the honest window
 * (updatedAt is NOT a window — every poll merge touches it, and all
 * rows would share one instant). The agent's time read
 * (get_session_timeline, t504) walks the SAME law, so a time question
 * answered by the model can never disagree with the bars about when
 * anything ran. Arithmetic with two consumers lives in ONE place
 * (twins fork, imports don't) — this well is IMPORT-FREE so both a
 * client component and the server's tool executor can drink it
 * without dragging node fs into the browser bundle.
 *
 * A live run stretches to "now": its window has no end yet, so the
 * caller passes its reading of the current instant and the walk pins
 * the open end there (never below start+1000 — the engine's own floor
 * for a written duration). Failed runs keep their windows: time spent
 * failing is real time. Jobs the engine never started (seeded / idle /
 * submitted) have NO window and are counted, never invented.
 *
 * The sort is the bars' own order: start ascending, name breaking ties
 * — a timeline answered in a different order is a timeline lied about.
 */

/** The minimal shape the walk reads — structural, so a JobDTO passes
 *  as-is and a prisma row passes after nothing more than existing (a
 *  Date startedAt is honest input; the walk converts, never guesses). */
export interface TimelineJobShape {
  id: string;
  name: string;
  status: string;
  /** ISO string (client rows) or Date (server rows) — null = the
   *  engine never started this job. */
  startedAt: string | Date | null;
  /** Measured elapsed in ms as the engine wrote it. */
  duration: number;
}

/** One run's honest window — `job` rides along verbatim so consumers
 *  keep their own dialects (the bars print the row's name; the tool
 *  prints its id). */
export interface TimelineRow<T> {
  job: T;
  /** epoch ms — the window's open and close */
  start: number;
  end: number;
  ms: number;
}

/** The statuses whose windows are REAL time (Task 123's predicate,
 *  verbatim): a completed run's measured duration, a failed run's
 *  time-to-failure, a running job's life so far. Everything else
 *  (idle/pending/submitted) never started — no window exists. */
export const TIMELINE_RUN_STATUSES: readonly string[] = ["completed", "failed", "running"];

/** The engine's own floor for a written duration (engine.ts's write
 *  side uses the same 1000) — a window is never shorter than this,
 *  whatever the clock says. */
export const TIMELINE_MIN_WINDOW_MS = 1000;

export interface TimelineWalk<T> {
  rows: TimelineRow<T>[];
  /** first window's start (epoch ms) — 0 when nobody ran */
  t0: number;
  /** last window's end minus t0, floored at the minimum window — the
   *  axis the bars draw and the tool quotes as the session's span */
  span: number;
  /** jobs the engine never started — the timeline's honest absentees
   *  (counted here, off the bars, and the tool says the number) */
  neverStarted: number;
}

/** The walk itself — Task 123's useMemo arithmetic, lifted verbatim
 *  (filter by startedAt + run status, honest ends, finite filter,
 *  start-then-name sort, t0/span from the extremes). `now` is
 *  injected: the bars pass their 5s ticker's reading, the tool passes
 *  Date.now() — same law, two clocks, one truth. */
export function walkTimeline<T extends TimelineJobShape>(
  jobs: readonly T[],
  now: number,
): TimelineWalk<T> {
  const neverStarted = jobs.filter((j) => !j.startedAt).length;
  const rows = jobs
    .filter(
      (j) =>
        j.startedAt &&
        (TIMELINE_RUN_STATUSES as readonly string[]).includes(j.status),
    )
    .map((j) => {
      const start = new Date(j.startedAt as string | Date).getTime();
      const end =
        j.status === "running"
          ? Math.max(now, start + TIMELINE_MIN_WINDOW_MS)
          : start + Math.max(TIMELINE_MIN_WINDOW_MS, j.duration);
      return { job: j, start, end, ms: Math.max(TIMELINE_MIN_WINDOW_MS, end - start) };
    })
    .filter((r) => Number.isFinite(r.start) && r.end > r.start)
    .sort((a, b) => a.start - b.start || a.job.name.localeCompare(b.job.name));
  if (rows.length === 0) return { rows, t0: 0, span: 0, neverStarted };
  const t0 = rows[0].start;
  const span = Math.max(rows[rows.length - 1].end - t0, TIMELINE_MIN_WINDOW_MS);
  return { rows, t0, span, neverStarted };
}

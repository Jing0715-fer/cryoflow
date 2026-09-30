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

/** One reading of the ledger over the walk's windows (t505): the busy
 *  total and the leaders' order. The walk's own chronological rows are
 *  NEVER touched — the bars and the tool's per-run roster speak
 *  start-ascending, and "how long in total" / "which step was the
 *  heaviest" are DIFFERENT readings of the same windows, so this is
 *  where that arithmetic lives now (twins fork, imports don't): the
 *  agent's get_session_timeline (t504) and the session report's
 *  "Pipeline at a glance" time lines (t505) both drink this one well.
 *  The busy sum counts every window — parallel runs double-count, and
 *  every face that quotes it says so in its own dialect. The leaders
 *  are a stable ms-descending copy: equal windows keep their start
 *  order (the earlier run wins the tie), and leaders[0] is the longest
 *  single step. */
export interface TimelineLedger<T> {
  /** every window summed — parallel runs double-count (the caller says so) */
  busyMs: number;
  /** the rows' ms-descending copy — leaders[0] is the heaviest run */
  leaders: TimelineRow<T>[];
}

export function timelineLedger<T>(rows: readonly TimelineRow<T>[]): TimelineLedger<T> {
  return {
    busyMs: rows.reduce((acc, r) => acc + r.ms, 0),
    leaders: [...rows].sort((a, b) => b.ms - a.ms),
  };
}

/** One window's share of the span (t506): a percentage with one decimal
 *  ("12.3"). The tool's per-run roster (t504) and the timeline's CSV
 *  machine face (t506) are the two readers — ONE arithmetic, so a
 *  spreadsheet and the model can never disagree about who took how
 *  much of the session. A zero span (nobody ran) shares zero. */
export function timelineSharePct(ms: number, spanMs: number): number {
  if (spanMs <= 0) return 0;
  return Math.round((ms / spanMs) * 1000) / 10;
}

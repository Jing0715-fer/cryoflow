/**
 * CryoFlow — the critical path (t681).
 *
 * The analytics faces answer "when did each run happen" (the session
 * timeline) and "which stage TYPE eats the wall clock" (runtime by
 * stage) — but not the DAG-level question a scientist asks at the
 * whiteboard: WHICH CHAIN of dependencies decided when the pipeline
 * could finish? A dozen jobs ran beside the answer; the finish itself
 * was set by one walk from the first card to the last.
 *
 * This module is that walk, pure and React-free. It drinks the SAME
 * well as the bars and the runtime table (timeline-walk's honest
 * windows — never raw duration, never updatedAt) and reads the store's
 * own edges, so the chain can never disagree with the canvas about
 * what connects to what.
 *
 * The semantics are a RETROSPECTIVE critical path, not a scheduling
 * one: start from the run that finished last (the pipeline's actual
 * finisher) and walk backwards, at each step following the
 * latest-finishing upstream — the dependency that could have held the
 * door. What the walk returns is the chain the pipeline's finish
 * actually waited on, root → finisher, each step carrying its gap:
 * how long this step started after its driver finished (positive =
 * the pipeline waited for a human or for nothing — honest idle;
 * negative = the step launched before its driver finished, overlap
 * the canvas allows and the face speaks plainly).
 *
 * The graph is acyclic by construction (graph-cycle.ts stands guard at
 * every door that lands an edge), so every backward walk terminates —
 * the guard below is belt-and-braces for a malformed world, not a
 * license. Dangling edge endpoints are ignored (the script doctrine's
 * rule): a chain is spoken about only among runs the window well knows.
 */

import type { TimelineRow } from "./timeline-walk";

/** Minimal edge shape the walk reads — the store's EdgeDTO passes as-is. */
export interface CriticalEdge {
  fromJobId: string;
  toJobId: string;
}

/** One step of the chain, in root → finisher walking order. */
export interface CriticalStep<T> {
  job: T;
  /** epoch ms — the step's honest window (verbatim from the walk's row) */
  start: number;
  end: number;
  ms: number;
  /** start − driver.end. null for the chain root (nothing drove it);
   *  positive = started this long after the driver finished; negative =
   *  launched before the driver finished (overlap). */
  gapBeforeMs: number | null;
}

export interface CriticalPathWalk<T> {
  /** root → finisher — the chain the finish waited on */
  chain: CriticalStep<T>[];
  /** finisher.end − root.start — what the chain spanned */
  spanMs: number;
  /** Σ chain windows — time the chain spent running */
  busyMs: number;
  /** spanMs − busyMs — the chain's idle (negative when steps overlap) */
  gapMs: number;
}

/** The later of two runs: end first, then start, then name — the same
 *  determinism the walk sorts by (start asc, name asc), reversed here
 *  so "the later run wins" without ever flipping a coin. */
function laterOf<T extends { id: string; name: string }>(
  a: TimelineRow<T>,
  b: TimelineRow<T>,
): TimelineRow<T> {
  if (a.end !== b.end) return a.end > b.end ? a : b;
  if (a.start !== b.start) return a.start > b.start ? a : b;
  return a.job.name.localeCompare(b.job.name) <= 0 ? a : b;
}

export function criticalPath<T extends { id: string; name: string }>(
  rows: readonly TimelineRow<T>[],
  edges: readonly CriticalEdge[],
): CriticalPathWalk<T> | null {
  if (rows.length === 0) return null;
  const byId = new Map<string, TimelineRow<T>>();
  for (const r of rows) byId.set(r.job.id, r);
  // whose finish could have gated mine — only edges whose BOTH endpoints
  // have windows (dangling endpoints ignored, same rule as graph-cycle)
  const preds = new Map<string, TimelineRow<T>[]>();
  for (const e of edges) {
    const from = byId.get(e.fromJobId);
    const to = byId.get(e.toJobId);
    if (!from || !to) continue;
    const arr = preds.get(to.job.id);
    if (arr) arr.push(from);
    else preds.set(to.job.id, [from]);
  }

  // entry = the run that finished last — the pipeline's finisher
  let entry = rows[0];
  for (const r of rows) entry = laterOf(entry, r);

  // walk backwards: each step's driver is its latest-finishing upstream
  const rev: CriticalStep<T>[] = [];
  let cur: TimelineRow<T> = entry;
  let guard = rows.length + 1; // acyclic by construction — belt-and-braces
  while (cur && guard-- > 0) {
    const ps = preds.get(cur.job.id);
    const driver = ps && ps.length > 0 ? ps.reduce(laterOf) : undefined;
    rev.push({
      job: cur.job,
      start: cur.start,
      end: cur.end,
      ms: cur.ms,
      gapBeforeMs: driver ? cur.start - driver.end : null,
    });
    if (!driver) break;
    cur = driver;
  }
  const chain = rev.reverse();
  const busyMs = chain.reduce((acc, s) => acc + s.ms, 0);
  return {
    chain,
    spanMs: Math.max(entry.end - chain[0].start, 0),
    busyMs,
    gapMs: Math.max(entry.end - chain[0].start, 0) - busyMs,
  };
}

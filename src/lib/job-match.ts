/**
 * CryoFlow — the ONE definition of "does this job match that query".
 *
 * t653 — the matcher moves out of canvas-find-bar into lib: three
 * consumers share it (the find bar's count, canvas.tsx's ring/dim set,
 * canvas-minimap's dots — the latter two through jobMatchesFind's ids),
 * and "one matcher, many consumers" is now enforced by the import graph
 * instead of by an export's comment. The find bar keeps the UI; the
 * meaning of a match lives here.
 *
 * Match semantics, strongest first:
 *   1. substring — the long-standing contract, byte-identical to the
 *      includes era. "ctf" finds "CTF Estimation" the way it always did.
 *   2. subsequence — the abbreviation dialect (t653). A RELION operator
 *      types "cls2" for Class2D, "ref3d" for Refine3D, "ctffnd" for
 *      CtfFind; includes() has never heard any of them. A subsequence
 *      match — every character of the query found in order inside the
 *      text — answers all three. Guarded to q.length >= 2: a single
 *      character is a substring question, not a pattern, and fuzzying
 *      the whole canvas alight over one stray letter would turn the
 *      ring/dim world into noise.
 *
 * The predicate answers a SET question (which cards ring), not a
 * ranking question — boolean, no scores. The command palette's cmdk
 * scoring is its own dialect and stays there; the dashboard lens's
 * cross-project feed matches server-side by contract and is not this
 * function's jurisdiction.
 */

import { jobType } from "@/lib/workflow";
import type { JobDTO, JobStatus } from "@/lib/types";

/** Every character of `q`, in order, inside `text` (case-insensitive).
 * Greedy left-to-right scan is the classic subsequence test — the
 * earliest anchor leaves the longest tail for the rest of the query. */
export function subsequenceMatch(q: string, text: string): boolean {
  const t = text.toLowerCase();
  let at = 0;
  for (let i = 0; i < q.length; i++) {
    at = t.indexOf(q[i].toLowerCase(), at);
    if (at === -1) return false;
    at++;
  }
  return true;
}

/** Case-insensitive substring, then (t653) subsequence for abbreviations
 * of two characters or more. The hit set of every query that matched
 * before t653 still matches; the dialect queries are the only growth. */
export function jobMatchesQuery(job: JobDTO, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  const label = jobType(job.type)?.label ?? job.type;
  if (job.name.toLowerCase().includes(q)) return true;
  if (label.toLowerCase().includes(q)) return true;
  if (q.length >= 2) {
    if (subsequenceMatch(q, job.name)) return true;
    if (subsequenceMatch(q, label)) return true;
  }
  return false;
}

/** The FULL find predicate — status gate first, then the text gate.
 * With a status chip active and an empty query every job of that
 * status matches (the chip alone is a lens); with no chip the empty
 * query matches nothing (Task 134's contract, unchanged here and
 * unchanged by the fuzzy dialect — emptiness never fuzzy-matches). */
export function jobMatchesFind(
  job: JobDTO,
  query: string,
  status: JobStatus | "all",
  category: string | "all" = "all"
): boolean {
  if (status !== "all" && job.status !== status) return false;
  // Task 138 — the type half: the match's job type must belong to the
  // armed palette category (workflow stage). An unknown type has no
  // category, so an armed stage lens honestly excludes it.
  if (category !== "all" && jobType(job.type)?.category !== category) return false;
  if (!query.trim()) return status !== "all" || category !== "all";
  return jobMatchesQuery(job, query);
}

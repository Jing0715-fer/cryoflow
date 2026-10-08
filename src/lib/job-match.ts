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
 * ranking question — boolean, no scores. t655 adds the WHY: jobMatchWhy
 * returns the same ladder as geometry (source text + character spans),
 * and jobMatchesQuery is its boolean view — the ring and the character
 * highlight are one computation, so they can never disagree. The command
 * palette's cmdk
 * scoring is its own dialect and stays there; the dashboard lens's
 * cross-project feed matches server-side by contract and is not this
 * function's jurisdiction.
 *
 * t722 — the PARAM dialect. "Which jobs ever ran mask = 20?" has been
 * unanswerable since forever: the text ladder reads only the card's own
 * name and type label, while the params grid — the part of a job a
 * RELION operator actually tunes — is invisible to it. The preset family
 * (t713-t717) made parameters assets; this dialect is the asset's
 * lookup. An explicit `key:value` query (the FIRST colon splits; the
 * value may carry more colons — a path is a value) is the strongest
 * ladder rung and an EXCLUSIVE one: the user has stated what kind of
 * question this is, so a `mask:20` query never falls back to text
 * matching (and a job named "mask:20" has bigger problems than this
 * ladder). Values match by EXACT stringified equality — mask:20 means
 * twenty, not two hundred; the whole value, case-insensitively. Keys
 * match by substring ("mask" finds "mask_diameter"), because a key name
 * is a suggestion the operator half-remembers. One value per key, one
 * winner per job: when several params match, the lexicographically
 * smallest key wins — determinism over JSON insertion order. The why
 * face of a param hit has EMPTY spans on purpose: nothing on the card's
 * surface claims credit for a value living in the params grid — the
 * badge in the find bar is the why (the chip-is-the-why tradition).
 */

import { jobType } from "@/lib/workflow";
import type { JobDTO, JobStatus } from "@/lib/types";

/** t655 — WHY a job matched, as geometry: which text won (the card's own
 * name or its type label) and which character spans light up. The
 * predicate and its explanation are the same computation —
 * jobMatchesQuery is now `jobMatchWhy(...) != null`, so the hit set and
 * the highlight can never drift apart (one function, two answers).
 * Spans are [start, end) pairs in ascending order, non-overlapping.
 *
 * t722 — the union grows a param member: source "param" carries the
 * winning key/value pair and ALWAYS an empty spans array — a value in
 * the params grid has no character on the card's surface to wash, so
 * the honest geometry is none. Card renderers switch on source and
 * simply don't match "param", which is exactly right: the ring alone
 * claims the card, and the find bar's badge tells the human story. */
export type MatchWhy =
  | {
      source: "name" | "label";
      spans: ReadonlyArray<readonly [number, number]>;
    }
  | { source: "param"; key: string; valueText: string; spans: [] };

/** t722 — parse the explicit param dialect: `key:value`. The FIRST colon
 * splits (a value may be a path and carry colons of its own); both sides
 * must be non-empty, so "mask:" (still typing) and ":20" (no key) are
 * NOT param queries and fall through to the text ladder untouched.
 * Only a trimmed query containing a colon is dialect — a bare "mask 20"
 * is a name question like it always was. Returns the key/value as
 * TYPED (case preserved — the badge echoes the user's own words); the
 * matcher lowercases for comparison. */
export function parseParamQuery(
  query: string,
): { key: string; value: string } | null {
  const q = query.trim();
  const at = q.indexOf(":");
  if (at === -1) return null;
  const key = q.slice(0, at);
  const value = q.slice(at + 1);
  if (!key || !value) return null;
  return { key, value };
}

/** Merge ascending, adjacent-or-equal anchor indices into [start, end)
 * spans — "C l" (0,1) and "s s 2" (3,4,5) render as two washes, not
 * five one-character islands. */
function mergeAnchors(idx: number[]): ReadonlyArray<readonly [number, number]> {
  const spans: [number, number][] = [];
  for (const at of idx) {
    const last = spans[spans.length - 1];
    if (last && at <= last[1]) last[1] = at + 1;
    else spans.push([at, at + 1]);
  }
  return spans;
}

/** Where every character of `q` anchors inside `text` (case-insensitive,
 * greedy left-to-right — the SAME walk subsequenceMatch has always
 * taken), or null when the chain breaks. Anchors index the lowercased
 * text; every job name in this universe is lowercase-length-stable, so
 * they are the original's coordinates too, and the card's renderer
 * defensively falls back to plain text should a span ever escape it. */
export function subsequenceSpans(
  q: string,
  text: string,
): ReadonlyArray<readonly [number, number]> | null {
  const t = text.toLowerCase();
  let at = 0;
  const idx: number[] = [];
  for (let i = 0; i < q.length; i++) {
    at = t.indexOf(q[i].toLowerCase(), at);
    if (at === -1) return null;
    idx.push(at);
    at++;
  }
  return mergeAnchors(idx);
}

/** Every character of `q`, in order, inside `text` (case-insensitive).
 * t655 — now a VIEW over subsequenceSpans: the boolean and the geometry
 * are one walk, so they cannot disagree. */
export function subsequenceMatch(q: string, text: string): boolean {
  return subsequenceSpans(q, text) !== null;
}

/** The value dialect (t722): a param value is stringified the way JS
 * already writes it — numbers verbatim (20 → "20"), booleans as
 * true/false, strings as themselves — and compared WHOLE and
 * case-insensitively after trimming both sides. No substring, no
 * prefix: mask:20 means twenty, not two hundred. A number that JS
 * writes in exponent form (String(0.000001) → "1e-6") is matched by
 * the text JS writes, not the text a human might — the honest
 * boundary of reusing one stringifier. */
function paramValueText(value: unknown): string {
  if (typeof value === "string") return value;
  return String(value);
}

/** WHY does this job match the param query — the "param" rung's own
 * geometry. Keys match by case-insensitive substring ("mask" finds
 * "mask_diameter" — a key name is a suggestion the operator
 * half-remembers); values by exact stringified equality. Among the
 * params that match, the lexicographically smallest key wins —
 * determinism over JSON insertion order, so the badge names the same
 * key on every machine for the same query. Null when nothing matches. */
function paramMatchWhy(
  job: JobDTO,
  pq: { key: string; value: string },
): MatchWhy | null {
  const keyNeedle = pq.key.toLowerCase();
  const valueNeedle = pq.value.trim().toLowerCase();
  let winner: { key: string; valueText: string } | null = null;
  // ?? {} — a job arriving without a params record (hand-written fixture,
  // legacy row) simply has no values to answer with; it fails the rung
  // like any other non-match instead of throwing through the ladder.
  for (const [key, value] of Object.entries(job.params ?? {})) {
    if (!key.toLowerCase().includes(keyNeedle)) continue;
    const valueText = paramValueText(value);
    if (valueText.trim().toLowerCase() !== valueNeedle) continue;
    if (winner === null || key < winner.key) {
      winner = { key, valueText };
    }
  }
  if (!winner) return null;
  return { source: "param", key: winner.key, valueText: winner.valueText, spans: [] };
}

/** WHY does this job match — the match ladder as geometry. t722: an
 * explicit `key:value` query is the STRONGEST rung and takes the job
 * exclusively — the user has stated the kind of question, and text
 * fallback would blur the why ("why did THIS ring?" must have one
 * answer). Otherwise the exact priority order the predicate has always
 * used: name substring, label substring, then (q.length >= 2) the name
 * dialect, then the label dialect. Null on no match. The card
 * highlights WHAT THIS RETURNS: name spans wash the card's own title,
 * label spans wash the type row, a param hit washes nothing (the find
 * bar's badge is the why) — an explanation is only honest when it
 * points at the text that won. */
export function jobMatchWhy(job: JobDTO, query: string): MatchWhy | null {
  const pq = parseParamQuery(query);
  if (pq) return paramMatchWhy(job, pq);
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const label = jobType(job.type)?.label ?? job.type;
  const nameAt = job.name.toLowerCase().indexOf(q);
  if (nameAt !== -1) return { source: "name", spans: [[nameAt, nameAt + q.length]] };
  const labelAt = label.toLowerCase().indexOf(q);
  if (labelAt !== -1) return { source: "label", spans: [[labelAt, labelAt + q.length]] };
  if (q.length >= 2) {
    const nameSeq = subsequenceSpans(q, job.name);
    if (nameSeq) return { source: "name", spans: nameSeq };
    const labelSeq = subsequenceSpans(q, label);
    if (labelSeq) return { source: "label", spans: labelSeq };
  }
  return null;
}

/** Case-insensitive substring, then (t653) subsequence for abbreviations
 * of two characters or more. The hit set of every query that matched
 * before t653 still matches; the dialect queries are the only growth.
 * t655 — a VIEW over jobMatchWhy: the predicate is its geometry. */
export function jobMatchesQuery(job: JobDTO, query: string): boolean {
  return jobMatchWhy(job, query) !== null;
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

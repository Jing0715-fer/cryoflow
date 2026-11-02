/**
 * contour-history — the σ door's memory (t1147).
 *
 * Every cryo-EM map has its own characteristic noise floor, and the level
 * a user tunes BY EYE for one map is worth more than the canonical presets
 * (1/2/3/5σ — already in the viewer) the next open will offer. This lib is
 * that memory: a per-job, versioned, capped list of the levels the user
 * SETTLED on (a drag that never committed remembers nothing — the settle
 * is the memory's unit), remembered across viewer opens through the same
 * localStorage mirror pattern the overlays and the camera bookmarks ride.
 *
 * The persistence doctrine's own shape (the t1135 world-ledger laws,
 * scaled to this memory):
 *   • the envelope is VERSIONED — a foreign version drops the WHOLE
 *     memory (untrusted shapes are never guessed into levels);
 *   • one off-shape row (a non-number, a NaN, an Infinity) drops the
 *     WHOLE memory — a list that contains one untrustworthy level is
 *     untrustworthy as a list;
 *   • over-cap is NOT a shape violation — the head survives (the list is
 *     newest-first, so the head IS the memory's meaning; the tail is the
 *     fat that aged out);
 *   • a refusing store degrades to FALSE — the memory is cosmetic, it
 *     must never throw through a quota wall;
 *   • absence is never written — an empty memory removes its key rather
 *     than persisting an empty envelope.
 *
 * PURE: no window, no localStorage import — the storage is a PARAMETER
 * (the SSR face passes null; the tests construct fakes — the t1142
 * server-tier shape).
 */

/** The chips' ceiling — five recent levels, newest first. */
export const CONTOUR_HISTORY_CAP = 5;

/** Two levels nearer than this are THE SAME level (the float-equality law). */
export const CONTOUR_HISTORY_EPSILON = 1e-6;

const CONTOUR_HISTORY_VERSION = 1;

/**
 * The per-job key — the house pattern (the overlays' `cryoflow.mol-overlays:${jobId}`
 * and the camera bookmarks' per-job keys are this shape's precedents).
 */
export function contourHistoryKey(jobId: string): string {
  return `cryoflow.contour-history:${jobId}`;
}

/**
 * pushContourLevel — the ONE recency father: dedup (the epsilon law,
 * a re-picked level MOVES TO THE FRONT — recency, not duplication),
 * newest first, capped. Pure: the input array is never mutated.
 * A non-finite push is refused (the memory never holds a NaN).
 */
export function pushContourLevel(
  history: number[],
  sigma: number,
  cap: number = CONTOUR_HISTORY_CAP
): number[] {
  if (!Number.isFinite(sigma)) return history;
  const deduped = history.filter((l) => Math.abs(l - sigma) > CONTOUR_HISTORY_EPSILON);
  return [sigma, ...deduped].slice(0, cap);
}

/** The ONE text father — the exact bytes the mirror stores. */
export function contourHistoryEnvelope(levels: number[]): string {
  return JSON.stringify({ v: CONTOUR_HISTORY_VERSION, levels });
}

/**
 * parseContourHistory — the ONE trust decision. Absent/empty is the
 * honest absence ([]); bad-json / foreign-version / non-array levels /
 * ONE off-shape row all drop the WHOLE memory ([]); over-cap truncates
 * to the head (the newest survive — the tail aged out).
 */
export function parseContourHistory(
  raw: string | null | undefined,
  cap: number = CONTOUR_HISTORY_CAP
): number[] {
  if (raw == null || raw === "") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object") return [];
  if ((parsed as { v?: unknown }).v !== CONTOUR_HISTORY_VERSION) return [];
  const levels = (parsed as { levels?: unknown }).levels;
  if (!Array.isArray(levels)) return [];
  const clean: number[] = [];
  for (const row of levels) {
    if (typeof row !== "number" || !Number.isFinite(row)) return [];
    clean.push(row);
  }
  return clean.slice(0, cap);
}

/** The storage face — the SSR face passes null; the tests construct fakes. */
export type ContourStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * readContourHistory — a null storage (SSR) or an unreadable key is the
 * honest absence ([]), never a throw.
 */
export function readContourHistory(storage: ContourStorage | null, jobId: string): number[] {
  if (!storage || typeof jobId !== "string" || jobId.length === 0) return [];
  let raw: string | null = null;
  try {
    raw = storage.getItem(contourHistoryKey(jobId));
  } catch {
    return [];
  }
  return parseContourHistory(raw);
}

/**
 * writeContourHistory — the quota-guarded write: a refusing store returns
 * FALSE (the memory is cosmetic — it degrades, it never throws). An empty
 * memory REMOVES the key (absence is never written as an empty envelope)
 * and still answers true (the absence was honored, not refused).
 */
export function writeContourHistory(
  storage: ContourStorage | null,
  jobId: string,
  levels: number[]
): boolean {
  if (!storage || typeof jobId !== "string" || jobId.length === 0) return false;
  try {
    if (!levels || levels.length === 0) {
      storage.removeItem(contourHistoryKey(jobId));
      return true;
    }
    storage.setItem(contourHistoryKey(jobId), contourHistoryEnvelope(levels));
    return true;
  } catch {
    return false;
  }
}

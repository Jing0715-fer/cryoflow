/**
 * The params-diff dialog's per-pair baseline memory (t904, the style
 * round's third seat — "whoever the user wants as baseline lands left,
 * teal" made to LAST).
 *
 * The dialog's swap is per-pair state that resets when a different pair
 * opens — deliberately: a leftover flip from the PREVIOUS comparison is
 * noise. But the reset also forgets the user's OWN choice for THIS pair:
 * swap job B to the left, go compare another pair, come back — the
 * baseline is gone, the user swaps again, every visit. The seat: the
 * chosen baseline (the job the user wants LEFT) is remembered per pair
 * and restored when the pair reopens.
 *
 * The memory stores the BASELINE JOB ID, never a swapped boolean: the
 * pair can arrive in either order (pick order on the canvas, the
 * inspector's anchor-left, the roster's sort), and "I want B as
 * baseline" means the same thing in both — a boolean keyed to arrival
 * order would silently INVERT when the order flips. The pair key is the
 * sorted id pair, so one pair speaks one entry regardless of arrival.
 *
 * No whisper seats here (the t901/t902 family's verdict, pinned): the
 * restore is self-evident — the left column IS the user's baseline,
 * visible the moment the dialog opens. The family whispers when
 * remembered state fails to restore INVISIBLY (fewer curves, a moved
 * window); a swap that comes back as the user left it says nothing
 * because nothing was taken.
 *
 * This module owns the storage law (the t653 law): SSR-guarded reads,
 * gesture-time writes only (the #13 law — no localStorage writes in
 * render paths), a bounded map (24 entries, insertion-order eviction —
 * the statcache's own cap discipline; abandoned pairs age out).
 */

const KEY = "cryoflow.paramsDiffBaseline.v1";
const MAX_ENTRIES = 24;

/** pairKey — ORDER-INSENSITIVE: sorted ids, so whichever way the pair
 * arrives, the memory is the same entry */
export function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|");
}

/** Read the whole baseline map (SSR-guarded: server callers and first
 * renders before hydration get an empty map, the honest "nothing
 * remembered yet"). A corrupt bucket reads as empty — a broken memory
 * must never take the dialog down. */
export function readBaselines(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof k === "string" && k.includes("|") && typeof v === "string") out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** The remembered baseline for one pair, or null (nothing remembered,
 * or the memory names a job that is not in the pair anymore — a stale
 * entry is an honest null, not a guess). */
export function baselineFor(
  idA: string,
  idB: string,
  baselines: Record<string, string> = readBaselines()
): string | null {
  const stored = baselines[pairKey(idA, idB)];
  if (stored === idA || stored === idB) return stored;
  return null;
}

/** Remember the user's baseline for this pair (the job they want LEFT).
 * Gesture-time only — the swap button's onClick, never a render path.
 * Bounded: past MAX_ENTRIES the OLDEST entry evicts (insertion-order
 * eviction — the statcache's discipline); writing an existing pair
 * refreshes its recency. */
export function rememberBaseline(idA: string, idB: string, baselineId: string): void {
  if (typeof window === "undefined") return;
  if (baselineId !== idA && baselineId !== idB) return; // a baseline outside the pair is not a memory
  try {
    const map = readBaselines();
    const k = pairKey(idA, idB);
    delete map[k]; // re-insert below → recency refresh
    map[k] = baselineId;
    const entries = Object.entries(map);
    if (entries.length > MAX_ENTRIES) {
      entries.splice(0, entries.length - MAX_ENTRIES);
    }
    window.localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* quota/private-mode — the memory is best-effort by design; the
       dialog's default (natural order) is always honest */
  }
}

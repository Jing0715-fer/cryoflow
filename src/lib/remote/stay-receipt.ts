/**
 * CryoFlow — the sync-receipt dialect and its compact renderings (t431).
 *
 * The stay receipt ("N image file(s) stayed on the cluster — …") is a
 * HISTORY: the engine wrote it once at sync-back time, and it stays true
 * for its own moment even after a later bring-home empties the cluster
 * side. t429 taught the inspector and the panel to add a homecoming
 * epilogue (RemoteStayNote) on top of the untouched receipt; t431 extends
 * the same honesty to the COMPACT surfaces (canvas card, minimap title,
 * dashboard tiles) where the receipt's stale urgency drowns the payload
 * sentence ("96 particles extracted") that is the card's real job.
 *
 * Rules of the dialect (sync-policy.ts is the author):
 *   - every leftover segment contains "stayed on the cluster";
 *   - a receipt that ALSO warns about an EARLIER run is not fully
 *     resolved by a bring-home (the refused leftovers predate this
 *     run) — isStayReceipt keeps those out of the resolved chapter, and
 *     compact rendering leaves them untouched for the same reason;
 *   - segments are joined with " — ", and the receipt rides the SUCCESS
 *     result as a final " — <receipt>" suffix (remote-run.ts t367), so
 *     the cut point is the " — " boundary immediately before the first
 *     "<N> file(s) …" segment.
 *
 * This module is pure string work — client-safe, zero I/O. The truth
 * number (how many manifest entries are still absent) comes from the
 * server's remoteRemaining annotation on the job DTO (lib/remote/
 * remote-remaining.ts); an absent annotation means "truth not loaded"
 * and every helper here is a pass-through — the t429 no-flicker law.
 */

/** The sync receipt dialects that literally claim files "stayed on the
 * cluster" (sync-policy.ts + remote-run.ts wordings). The stale-generation
 * verdict mixes in via " — " segments; a note that ALSO warns about an
 * EARLIER run is not fully resolved by bring-home, so it stays amber.
 * (Moved here from remote-stay-note.tsx in t431 — the dialect now serves
 * text surfaces as well as the note component.) */
export function isStayReceipt(note: string): boolean {
  return note.includes("stayed on the cluster") && !note.includes("EARLIER run");
}

/**
 * The receipt's lead-in as it appears inside a result string: a segment
 * boundary followed by the leftover count. sync-policy.ts's three
 * wordings all start "<N> [image |bulky ]file(s) stayed on the cluster".
 * The stale-generation segment ("<N> file(s) in the workdir were left
 * behind by an EARLIER run") never reaches this cut — isStayReceipt
 * rejects any text mentioning an EARLIER run first, because a bring-home
 * cannot resolve leftovers that predate this run's dispatch.
 */
const STAY_TAIL_RE =
  /\s+—\s+\d+ (?:image |bulky )?file\(s\) stayed on the cluster[\s\S]*$/;

/**
 * The result text with the receipt tail cut off — the payload sentence
 * ("96 particles extracted") and nothing else. Returns null when the
 * text is not a stay receipt (callers fall back to the input untouched).
 */
export function stayReceiptHead(text: string): string | null {
  if (!isStayReceipt(text)) return null;
  const m = STAY_TAIL_RE.exec(text);
  if (!m) return null;
  return text.slice(0, m.index).replace(/[—\s]+$/, "") || null;
}

/**
 * Compact rendering of a result string for space-constrained surfaces.
 *
 *   remaining === undefined | null  → text untouched (truth not loaded —
 *                                     the no-flicker law; never guess)
 *   not a stay receipt              → text untouched
 *   remaining === 0                 → "<payload> · all brought home"
 *   remaining > 0                   → "<payload> · <N> still on cluster"
 *
 * The REMOTE[...] envelope (if any) is NOT stripped here — surfaces that
 * strip it do so before calling (displayResult); surfaces that keep it
 * (minimap titles) pass the full text and keep their envelope.
 */
export function compactStayReceipt(
  text: string,
  remaining?: number | null
): string {
  if (remaining === undefined || remaining === null) return text;
  const head = stayReceiptHead(text);
  if (head === null) return text;
  return remaining === 0
    ? `${head} · all brought home`
    : `${head} · ${remaining} still on cluster`;
}

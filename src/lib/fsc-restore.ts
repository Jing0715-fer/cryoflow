/**
 * The FSC compare dialog's restore arithmetic — the meaning behind the
 * persisted selection's reopen (t901).
 *
 * The dialog persists its picked jobs per project (localStorage) and
 * restores them on reopen. The restore is not always faithful: the
 * launcher joins FIRST (its card is demonstrably showing a curve), so
 * the MAX_CURVES cap eats the SAVED tail, and persisted ids whose jobs
 * left the index are dropped outright. Remembered state that fails to
 * restore is INVISIBLE — the dialog just shows fewer curves — so the
 * component whispers the edit (the t899 grammar's third seat: the house
 * mono voice at whisper level; silence is the honest voice at an exact
 * restore; the user's first pick takes ownership).
 *
 * This module owns the arithmetic so it can be unit-receipted (the
 * t653 law: the meaning lives in lib, the UI imports it, the matcher
 * can never drift from the marker).
 */

/** how many curves one overlay can hold before it becomes spaghetti —
 * mirrored from the component's export to keep one ceiling; the
 * component re-exports the UI-side constant and passes it here */
export const RESTORE_CURVE_CAP = 6;

/** a persisted id the restore could not seat, with the world's reason */
export type RestoreEdit = { id: string; reason: "vanished" | "cap" };

/**
 * Seat the launcher, then the persisted ids, in order, under the cap.
 *
 * - the launcher is ALWAYS seated (it demonstrably has a curve — its
 *   card is showing it), even if it was never persisted;
 * - a saved id already seated (the launcher re-persisted) is a no-op,
 *   not an edit — the set dedupes;
 * - a saved id past the cap is an EDIT with reason "cap" (the cap ate
 *   the SAVED tail because the launcher jumped the queue);
 * - a saved id outside `known` is an EDIT with reason "vanished" (the
 *   job was deleted, or lost its FSC source — the index's own mouth).
 */
export function collectRestoreEdits(
  saved: string[],
  known: Set<string>,
  launcherId: string,
  cap: number = RESTORE_CURVE_CAP
): { picked: Set<string>; edits: RestoreEdit[] } {
  const picked = new Set<string>([launcherId]);
  const edits: RestoreEdit[] = [];
  for (const id of saved) {
    if (picked.has(id)) continue; // already seated (e.g. the launcher itself) — no edit
    if (picked.size >= cap) {
      edits.push({ id, reason: "cap" });
      continue;
    }
    if (known.has(id)) picked.add(id);
    else edits.push({ id, reason: "vanished" });
  }
  return { picked, edits };
}

/**
 * The whisper's reason clause — counts by reason, one line, the
 * vocabulary the rows themselves speak ("no longer in the index" is
 * the discovery's own failure word; the cap names its ceiling).
 * An empty edit list returns "" (the component never renders the
 * whisper for it — silence is the exact-restore voice).
 */
export function restoreEditSummary(
  edits: RestoreEdit[],
  cap: number = RESTORE_CURVE_CAP
): string {
  const vanished = edits.filter((e) => e.reason === "vanished").length;
  const capped = edits.length - vanished;
  const parts: string[] = [];
  if (vanished > 0) parts.push(`${vanished} no longer in the index`);
  if (capped > 0) parts.push(`${capped} over the ${cap}-curve cap`);
  return parts.join(" · ");
}

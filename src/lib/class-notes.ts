/**
 * CryoFlow — class-note param helpers (shared by gallery + palette).
 *
 * Class notes are the class-level annotation layer (Task 80): per-class
 * margin notes stored as the select2d `classNotes` param — a JSON map
 * { "3": "text" } through the same debounced channel as selectedClasses.
 * Both the gallery (editor) and the command palette (retrieval) must agree
 * on exactly what counts as a note, so the parse lives here once.
 */

/** Hard cap mirrored by the gallery's textarea maxLength. */
export const CLASS_NOTE_MAX = 300;

/**
 * Tolerantly parse a classNotes param into a { cls: text } record.
 * Anything that is not a plain object — malformed JSON, arrays, null,
 * non-string values — degrades to "no notes" rather than throwing:
 * a corrupted param must never take down the gallery or the palette.
 * Empty/whitespace-only values are pruned (a cleared note is absent).
 */
export function parseClassNotes(raw: unknown): Record<string, string> {
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw) as unknown;
    } catch {
      return {};
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim().length > 0) out[k] = v;
  }
  return out;
}

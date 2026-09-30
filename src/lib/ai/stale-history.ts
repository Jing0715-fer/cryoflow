/**
 * CryoFlow — the old answer's birthday (t502).
 *
 * The live incident (t501's three-act drama): the panel restored a
 * persisted session, the user asked a question, and the model answered
 * from the tool results ALREADY in history — never re-measuring. Old
 * readings wore the costume of current truth, and three layers of "old"
 * (old process, old build, old session) had to be peeled apart before
 * the diagnosis landed. The cure has two faces and one threshold:
 *  - the MODEL face: on a new user turn over a session whose tool
 *    results have aged past the window, the system prompt carries a
 *    STALE HISTORY REMINDER (the prompt is rebuilt every request and
 *    never stored — the transcript stays plain, the t483 door law
 *    holds);
 *  - the HUMAN face: the panel floats a one-time banner over a restored
 *    transcript with aged measurements (ephemeral React state — not an
 *    event, not persisted).
 *
 * One pure module, both consumers drink here: the same age earns the
 * same answer about it, on both sides of the wire.
 */

/** Tool results older than this are history, not readings (10 minutes:
 *  a live tool loop is seconds old; a lunch break is genuinely old). */
export const STALE_HISTORY_MS = 10 * 60 * 1000;

/**
 * True when the transcript carries tool results whose NEWEST reading is
 * older than the window. `now` is injected so both faces ask about the
 * same moment; structural typing keeps this module import-free (client
 * and server both drink here — fs and db must never ride along).
 */
export function hasAgedToolHistory(
  messages: { role: string; at?: number }[],
  now: number,
): boolean {
  let newest = -1;
  for (const m of messages) {
    if (m.role === "tool" && typeof m.at === "number" && m.at > newest) newest = m.at;
  }
  if (newest < 0) return false;
  return now - newest > STALE_HISTORY_MS;
}

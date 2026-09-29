/**
 * CryoFlow — the continue intent's card-face words. t473.
 *
 * t471 wrote the continue plan (fn_cont) through the agent's continue_run
 * and the panel's "Continue from here" picker — and the receipt's own
 * leftover said the quiet part: after a plan is written, the CANVAS card
 * and the context menu say nothing. The panel's Run button speaks (t397:
 * the emerald face, the History glyph, the title law) but the job can sit
 * on the canvas for hours — pending, refused, waiting — with a loaded
 * continue target nobody can see. The wipe-vs-continue distinction is the
 * project's hardest safety line; a face that only speaks inside an open
 * panel is a face most users never read.
 *
 * This module is the shared word table for every canvas face of the
 * intent (card chip, context-menu label, hover preview) — one grammar, so
 * the card can never say "continue from Round 12" while the menu says
 * "Re-run" (a re-run is the wipe-shaped world and must never be one click
 * away from a loaded continue target's label).
 */

/**
 * The round the checkpoint path points at (run_it012 → 12). RELION's
 * iteration directories are the run's own clock — the number is the
 * honest headline. No run_itNNN in the path (a hand-typed file, a
 * different naming scheme) → null: the faces then say "from a checkpoint"
 * instead of inventing a round.
 */
export function continueRoundOf(fnCont: string): number | null {
  const m = /run_it(\d+)/i.exec(fnCont);
  if (!m) return null;
  const n = Number.parseInt(m[1] ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** The path's last two segments — enough to recognize, short enough to title. */
function pathTail(fnCont: string): string {
  const parts = fnCont.split("/").filter(Boolean);
  return parts.slice(-2).join("/") || fnCont;
}

/**
 * The short face (context-menu label, preview chip): the round when the
 * path names one, the honest generic when it doesn't.
 */
export function continueIntentShort(fnCont: string): string {
  const round = continueRoundOf(fnCont);
  return round !== null ? `Continue from Round ${round}` : "Continue from checkpoint";
}

/**
 * The full sentence (chip/aria titles): what the next Run will do, what is
 * preserved, where the choice lives, how to un-choose it. The same facts
 * the panel button's title has spoken since t397 — the card repeats the
 * product's own words, never a private dialect.
 */
export function continueIntentSentence(fnCont: string): string {
  const round = continueRoundOf(fnCont);
  const tail = pathTail(fnCont);
  const where = round !== null ? `Round ${round} (${tail})` : `a checkpoint (${tail})`;
  return (
    `Next Run will CONTINUE from ${where} — the run_it* iteration family is preserved, not wiped. ` +
    `Set in the panel's "Continue from here"; clear it to start fresh.`
  );
}

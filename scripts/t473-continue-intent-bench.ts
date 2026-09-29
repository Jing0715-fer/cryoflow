/**
 * t473 — the run button speaks its intent (the continue-intent word table).
 *
 * t471 wrote the continue plan and its own leftover said the quiet part:
 * after the plan lands, the canvas card and the context menu say NOTHING
 * — a loaded continue target could sit next to a menu item that reads
 * "Re-run", the wipe-shaped word, one click away from the resume the user
 * (or the agent, in t471's live run) meant. The panel button has spoken
 * since t397; this window gives the intent ONE shared grammar and puts it
 * on every canvas face.
 *
 * This bench pins the word table (src/lib/continue-intent.ts):
 *  T1  round extraction — run_itNNN is RELION's own clock; no match →
 *      null (the faces say "from a checkpoint" instead of inventing one)
 *  T2  the short face — the round when the path names one, the honest
 *      generic when it doesn't
 *  T3  the full sentence — what the next Run will do, what is preserved,
 *      where the choice lives, how to un-choose it (the panel button's
 *      own facts; the card never invents a private dialect)
 *  T4  the grammar discipline — deep/odd paths keep the last two
 *      segments, run_it0 is a real round (not falsy-dropped), uppercase
 *      variants still parse
 *
 * Run: bun run scripts/t473-continue-intent-bench.ts
 */

export {}; // module marker — the top-level await below needs it

let pass = 0;
let fail = 0;
const must = (cond: boolean, name: string) => {
  if (cond) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}`);
  }
};

const { continueRoundOf, continueIntentShort, continueIntentSentence } = await import(
  "../src/lib/continue-intent"
);

/* ------------------------------------------------------------------ */
/* T1 — round extraction                                                */
/* ------------------------------------------------------------------ */

console.log("T1 — round extraction (RELION's own clock)");

must(continueRoundOf("/data/proc/QA-Class2D-Source/run_it012") === 12, "T1a run_it012 → 12 (no zero padding in the face)");
must(continueRoundOf("/data/proc/J999/80/run_it000") === 0, "T1b run_it000 → 0 (Round 0 is a real round, never falsy-dropped)");
must(continueRoundOf("run_it7") === 7, "T1c bare relative path still parses");
must(continueRoundOf("/data2/qa/Run_IT005/optimiser.star") === 5, "T1d uppercase RUN_IT variant parses");
must(continueRoundOf("/data/proc/relion_it012_model.star") === null, "T1e bare it012 in a FILE name is not a run directory — null");
must(continueRoundOf("") === null, "T1f empty string → null");
must(continueRoundOf("/data/proc/run_it/optimiser.star") === null, "T1g run_it without digits → null (no invented round)");
must(continueRoundOf("/deep/nest/levels/here/run_it123456/star") === 123456, "T1h deep nesting with a big round still parses");

/* ------------------------------------------------------------------ */
/* T2 — the short face                                                  */
/* ------------------------------------------------------------------ */

console.log("T2 — the short face");

must(continueIntentShort("/data/proc/X/run_it012") === "Continue from Round 12", "T2a round path → 'Continue from Round 12'");
must(continueIntentShort("/data/proc/X/optimiser.star") === "Continue from checkpoint", "T2b path without a round → the honest generic");
must(continueIntentShort("") === "Continue from checkpoint", "T2c empty → the honest generic");
must(!continueIntentShort("/a/run_it003/b").includes("re-run") && !continueIntentShort("/a/run_it003/b").includes("Re-run"), "T2d the short face never carries the wipe-shaped word");

/* ------------------------------------------------------------------ */
/* T3 — the full sentence                                               */
/* ------------------------------------------------------------------ */

console.log("T3 — the full sentence (the panel button's own facts)");

{
  const s = continueIntentSentence("/data2/qa/QA-Class2D-Source/run_it012");
  must(s.includes("CONTINUE from Round 12"), "T3a the verb and the round are named");
  must(s.includes("(QA-Class2D-Source/run_it012)"), "T3b the path's last two segments ride along (recognizable, short)");
  must(s.includes("run_it* iteration family is preserved, not wiped"), "T3c the preservation fact is the sentence's spine");
  must(s.includes('Set in the panel\'s "Continue from here"'), "T3d the choice's home is named (the panel field, verbatim)");
  must(s.includes("clear it to start fresh"), "T3e the un-choosing path is named");
}
{
  const s = continueIntentSentence("/data/proc/optimiser.star");
  must(s.includes("CONTINUE from a checkpoint"), "T3f no round → 'a checkpoint' with the tail");
  must(s.includes("(proc/optimiser.star)"), "T3g the tail still rides along");
}
{
  const a = continueIntentSentence("/a/run_it003");
  const b = continueIntentSentence("/b/run_it003");
  must(a.includes("Round 3") && b.includes("Round 3"), "T3h the same round reads the same across different roots");
}

/* ------------------------------------------------------------------ */
/* T4 — grammar discipline                                              */
/* ------------------------------------------------------------------ */

console.log("T4 — grammar discipline");

{
  const s = continueIntentSentence("/x/run_it012");
  must(!/\bround\b/.test(s) || s.includes("Round 12"), "T4a the word 'Round' is always capitalized as a label");
  must(s.length < 220, "T4b the sentence stays title-worthy (<220 chars)");
}
{
  const tail = continueIntentSentence("/").slice(0, 0) || "";
  must(tail === "" && continueRoundOf("/") === null, "T4c a degenerate root path is safe (null, no crash)");
  must(continueIntentShort("/").includes("checkpoint"), "T4d degenerate path → the generic face, never 'Round NaN'");
}

console.log(`\nt473: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);

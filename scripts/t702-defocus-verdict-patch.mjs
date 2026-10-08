#!/usr/bin/env node
/**
 * t702 — the defocus verdict patch: one fact, four layers, moved in lockstep.
 *
 * The t702 narrative census convicted the defocus family claim: the world's
 * own artifact (micrographs_ctf.star) proves the family spans
 * [12722.7, 14850.9] A — top 14.9k — and carries an explicit CtfAstigmatism
 * column (68.5-257.8 A). The seed's arithmetic (qa-t531 L852) truncated the
 * top to "14.6k" and the t701 narrative amplified it with "astigmatism free"
 * — both under-provable by the law's standard (a story may only tell what
 * the world can prove).
 *
 * The fact lives in four layers that must move TOGETHER, because the head
 * echo contract (run.log line 1 == "seeded by ... — " + record.result) is a
 * structural invariant of the narrative layer:
 *   1. scripts/qa-t531-old-world-seed.mjs L852  (the seed's own voice —
 *      future re-seeds write the honest number)
 *   2. data/engine-state.json ctffind record.result
 *   3. ctffind_0ctffind/run.log line 1          (the head echo)
 *   4. ctffind's narrative line + scripts/t701-story-enrichment-patch.mjs
 *      (the story and its author, kept consistent)
 *
 * This is an AMENDMENT, not a clobber: the head's structure, prefix and
 * role are untouched — only the false digit moves, and the echo contract
 * never breaks (the census asserts it before and after). Idempotent by
 * exact-string guards: each replacement fires only when the old string is
 * present; a second run is a no-op.
 */
import { readFileSync, writeFileSync } from "node:fs";

const OLD_RESULT = "10 micrographs CTF-fitted — defocus family 14.6-12.7k Å";
const NEW_RESULT = "10 micrographs CTF-fitted — defocus family 14.9-12.7k Å";
const OLD_STORY =
  "[seeded]   10 micrographs fitted; defocus family 14.6k - 12.7k A (a tight, well-behaved population), astigmatism free.";
const NEW_STORY =
  "[seeded]   10 micrographs fitted; defocus family 14.9k - 12.7k A (a tight, well-behaved population, astigmatism under 300 A).";

let fail = 0;
function amend(file, pairs) {
  let text = readFileSync(file, "utf8");
  let touched = 0;
  for (const [oldS, newS] of pairs) {
    if (text.includes(newS)) continue; // already amended
    if (!text.includes(oldS)) {
      console.log(`  FAIL: ${file} carries neither the old nor the new string: ${JSON.stringify(oldS.slice(0, 60))}`);
      fail++;
      continue;
    }
    text = text.split(oldS).join(newS);
    touched++;
  }
  if (touched) {
    writeFileSync(file, text, "utf8");
    console.log(`  amended: ${file} (${touched} replacement${touched > 1 ? "s" : ""})`);
  } else {
    console.log(`  skip (already amended): ${file}`);
  }
}

console.log("== t702 defocus verdict patch — one fact, four layers, lockstep ==");

amend("/home/z/my-project/scripts/qa-t531-old-world-seed.mjs", [[OLD_RESULT, NEW_RESULT]]);
amend("/home/z/my-project/scripts/t701-story-enrichment-patch.mjs", [
  ["(14.6–12.7k Å)", "(14.9–12.7k Å)"],
  [OLD_STORY, NEW_STORY],
]);
amend("/home/z/my-project/data/relion/cmuwipe6350000demoproject/ctffind_0ctffind/run.log", [
  [OLD_RESULT, NEW_RESULT], // head echo
  [OLD_STORY, NEW_STORY],   // narrative line
]);
amend("/home/z/my-project/data/engine-state.json", [[OLD_RESULT, NEW_RESULT]]);

console.log("== patch done ==");
process.exit(fail === 0 ? 0 : 1);

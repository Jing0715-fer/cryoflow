/**
 * t466 — the walk speaks bench.
 *
 * Task 103's arrow walk was mute at the two moments the user cannot see
 * what happened. The hints live in a pure brain (arrow-walk.ts) so the
 * UI cannot drift from the words; every assertion below pins one law:
 *
 *   T1 — direction names: the four walk keys map to their words; anything
 *        else (plain letter, modified key, empty) is null — the caller
 *        routes non-walk keys elsewhere and the hint never lies.
 *   T2 — the entry hint: the title NAMES the landed card verbatim (the
 *        user's question is "where am I now"); the description teaches
 *        the three companion gestures — hop, extend, clear — in one
 *        breath, each key named as the shortcuts dialog spells it.
 *   T3 — the dead-end hint: all four directions name themselves in the
 *        title; the description offers both recoveries (another arrow,
 *        or anchor the walk with Shift+click); the selection's fate is
 *        spoken ("stays as it was") — silence about the selection would
 *        read as "it moved somewhere I can't see".
 *   T4 — the two hints never collide: distinct titles, distinct jobs —
 *        an entry toast must never read as a dead end (and vice versa),
 *        whichever lands first on screen.
 *
 * World contract: pure functions — no store, no fetch, no fs, no React.
 * Run: bun run scripts/t466-walk-hints-bench.ts
 */

import {
  walkDirectionName,
  arrowWalkEntryHint,
  arrowWalkDeadEndHint,
} from "../src/lib/arrow-walk";

let pass = 0;
let fail = 0;
function must(cond: boolean, label: string) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.log(`  FAIL — ${label}`);
  }
}

/* ------------------------------------------------------------------ */
/* T1 — direction names                                                */
/* ------------------------------------------------------------------ */

{
  console.log("T1 — walkDirectionName");
  must(walkDirectionName("ArrowLeft") === "left", "T1 ArrowLeft → left");
  must(walkDirectionName("ArrowRight") === "right", "T1 ArrowRight → right");
  must(walkDirectionName("ArrowUp") === "up", "T1 ArrowUp → up");
  must(walkDirectionName("ArrowDown") === "down", "T1 ArrowDown → down");
  must(walkDirectionName("a") === null, "T1 a plain letter is not a walk key");
  must(walkDirectionName("Arrow") === null, "T1 a bare Arrow prefix is not a walk key");
  must(walkDirectionName("") === null, "T1 the empty key is not a walk key");
}

/* ------------------------------------------------------------------ */
/* T2 — the entry hint                                                 */
/* ------------------------------------------------------------------ */

{
  console.log("T2 — arrowWalkEntryHint");
  const h = arrowWalkEntryHint("2D Classification (tutorial)");
  must(h.title === "Arrow walk — 2D Classification (tutorial)", "T2 the title names the landed card verbatim");
  must(h.title.startsWith("Arrow walk — "), "T2 the title carries the walk's name first");
  must(h.description.includes("Arrows hop"), "T2 the hop gesture is taught");
  must(h.description.includes("Shift+Arrow grows the selection"), "T2 the extend gesture is taught");
  must(h.description.includes("Escape clears it"), "T2 the clear gesture is taught");
  must(h.description.includes("entered the graph here"), "T2 the entry moment is named — this is where the walk began");
  const other = arrowWalkEntryHint("MotionCorr 1");
  must(other.title === "Arrow walk — MotionCorr 1", "T2 every job gets its own name in the title");
}

/* ------------------------------------------------------------------ */
/* T3 — the dead-end hint                                              */
/* ------------------------------------------------------------------ */

{
  console.log("T3 — arrowWalkDeadEndHint");
  for (const d of ["left", "right", "up", "down"] as const) {
    const h = arrowWalkDeadEndHint(d);
    must(h.title === `Arrow walk — nothing to the ${d}`, `T3 the ${d} dead end names its direction`);
  }
  const h = arrowWalkDeadEndHint("right");
  must(h.description.includes("No card lies in that direction"), "T3 the fact leads the sentence");
  must(h.description.includes("the selection stays as it was"), "T3 the selection's fate is spoken, never left to guess");
  must(h.description.includes("Try another arrow"), "T3 the first recovery is named");
  must(h.description.includes("Shift+click a card to anchor the walk there"), "T3 the anchor recovery is named with its real gesture");
}

/* ------------------------------------------------------------------ */
/* T4 — the two hints never collide                                    */
/* ------------------------------------------------------------------ */

{
  console.log("T4 — the two moments speak differently");
  const entry = arrowWalkEntryHint("Post-process (tutorial)");
  const dead = arrowWalkDeadEndHint("right");
  must(entry.title !== dead.title, "T4 an entry toast never reads as a dead end");
  must(!entry.title.includes("nothing"), "T4 an entry is not a nothing — the walk found a home");
  must(!dead.title.includes("entered"), "T4 a dead end is not an entry — no card was found");
  must(entry.description !== dead.description, "T4 the two teachings stay separate sentences");
}

/* ------------------------------------------------------------------ */

console.log(`\nt466 walk-hints bench: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

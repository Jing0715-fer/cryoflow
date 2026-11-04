// t1173 — THE EXCLUDE DIALECT UNIT: the movies star's name column becomes
// first-class in the loser's-list filter.
//
// The vein: this window's film wired the Exclude Micrographs filter
// BETWEEN Import and Motion Correction (the flow the INPUTS table has
// always promised: excludemg is a motioncorr source) — and the filter
// parsed the import's movies star as ZERO rows. `_rlnMicrographMovieName`
// (the data_movies dialect) was invisible to a parser locked to
// `_rlnMicrographName` (the corrected_micrographs.star dialect): the
// filter excluded nothing ("0 of 0 kept · 1 list name matched nothing" —
// an honest log of a deaf read), the subset MotionCorr downstream ran the
// FULL 24-movie list with identical values, the A/B verdict went
// all-tied, and the compare dialog's exclude rider vanished — the film's
// F3 red, traced all the way home to a one-column blindness.
//
// The cure: the t440 liberal-match law carried one door upstream — real
// name first (`_rlnMicrographName`), the movies variant as the fallback
// (`_rlnMicrographMovieName`). The basename law (exact-first,
// basename-second) already absorbs the path-prefix drift between the
// list's bare names and the rows' prefixed paths.
//
// The module is pure (the t326/t327 recipe): it imports the extract-gate
// STAR parser and nothing else, so this seat rides the unit-runner lane
// and the same law runs on the server, in the browser and here.
//
// scripts/unit-runner.mjs scripts/t1173-exclude-dialect-unit.mjs
//

import {
  filterMicrographStar,
  parseExcludeNames,
  baseNameOf,
} from "@/lib/exclude-list";

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = "/home/z/my-project";
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
/** strip block + line comments so prose quoting a poison never flaps a pin */
function codeOf(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

let pass = 0;
let fail = 0;
function ok(name, cond, detail) {
  if (cond) {
    pass += 1;
    console.log(`  ok ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/* the film's exact world: the import's movies star (optics block +
 * data_movies with _rlnMicrographMovieName rows, paths prefixed) */
const moviesStar = () => `data_optics

loop_
_rlnOpticsGroup #1
_rlnOpticsGroupName #2
_rlnMicrographPixelSize #3
1 optGroup1 1.77

data_movies

loop_
_rlnMicrographMovieName #1
_rlnOpticsGroup #2
${Array.from({ length: 24 }, (_, i) => `micrographs/mic_${String(i + 1).padStart(3, "0")}.mrc 1`).join("\n")}
`;

/* the filter's original home: the corrected star (data_micrographs with
 * _rlnMicrographName rows) */
const correctedStar = () => `data_optics

loop_
_rlnOpticsGroup #1
1 optGroup1 1.77

data_micrographs

loop_
_rlnMicrographName #1
_rlnAccumMotionTotal #2
${Array.from({ length: 24 }, (_, i) => `MotionCorr/micrographs/mic_${String(i + 1).padStart(3, "0")}.mrc ${(2.2 + 0.3 * (i % 4)).toFixed(2)}`).join("\n")}
`;

const rowsOf = (text, label) =>
  text.split("\n").filter((l) => l.includes(label));

// ── A — the movies dialect (the cure's own face) ────────────────────────

{
  const rep = filterMicrographStar(moviesStar(), ["mic_004.mrc"]);
  ok("A1 the movies star parses as 24 rows (not zero)", rep.total === 24, `total=${rep.total}`);
  ok("A2 the basename law drops mic_004 from the prefixed rows", rep.dropped === 1 && rep.kept === 23, `kept=${rep.kept} dropped=${rep.dropped}`);
  ok("A3 the receipt names nothing missing", rep.missing.length === 0, rep.missing.join(",") || "none");
  ok("A4 the filtered text carries 23 movie rows and mic_004 is gone", rowsOf(rep.text, "mic_").length === 23 && !rep.text.includes("mic_004.mrc"), `rows=${rowsOf(rep.text, "mic_").length}`);
  ok("A5 the optics block rides through untouched (a filter is not an editor)", rep.text.includes("data_optics") && rep.text.includes("_rlnOpticsGroupName"));
  ok("A6 the data_movies block keeps its own header and columns", rep.text.includes("data_movies") && rep.text.includes("_rlnMicrographMovieName"));
}

// ── B — the corrected dialect (the original behavior, unchanged) ────────

{
  const rep = filterMicrographStar(correctedStar(), ["mic_004.mrc"]);
  ok("B1 the corrected star parses as 24 rows", rep.total === 24, `total=${rep.total}`);
  ok("B2 the drop law holds on the corrected dialect", rep.dropped === 1 && rep.kept === 23, `kept=${rep.kept}`);
  ok("B3 the motion column rides through with its row", (() => {
    const row = rep.text.split("\n").find((l) => l.includes("mic_005.mrc"));
    return !!row && row.trim().split(/\s+/).length === 2;
  })(), "mic_005 keeps its total column");
}

// ── C — the name laws, both directions ──────────────────────────────────

{
  // a full-path list entry kills the bare-named row and its exact twin
  const rep = filterMicrographStar(moviesStar(), ["micrographs/mic_007.mrc"]);
  ok("C1 an excluded full path kills its prefixed row", rep.dropped === 1 && !rep.text.includes("mic_007.mrc"));
  // a different file sharing the directory never dies
  const rep2 = filterMicrographStar(moviesStar(), ["mic_999.mrc"]);
  ok("C2 a list name that matches nothing is REPORTED, never guessed", rep2.dropped === 0 && rep2.missing.length === 1 && rep2.missing[0] === "mic_999.mrc");
  ok("C3 baseNameOf speaks both slash dialects", baseNameOf("a/b/c.mrc") === "c.mrc" && baseNameOf("a\\b\\c.mrc") === "c.mrc");
  ok("C4 the list parser collapses duplicates and empties (a list is a set)", JSON.stringify(parseExcludeNames("mic_001.mrc, mic_001.mrc;;\n mic_002.mrc")) === JSON.stringify(["mic_001.mrc", "mic_002.mrc"]));
}

// ── D — the determinism law (same params, same rows) ────────────────────

{
  const a = filterMicrographStar(moviesStar(), ["mic_004.mrc"]);
  const b = filterMicrographStar(moviesStar(), ["mic_004.mrc"]);
  ok("D1 the filter is deterministic (same input, byte-identical output)", a.text === b.text && a.kept === b.kept);
}

// ── E — the drinking layer's own words (the t923 law, motioncorr row) ───

// The dialect read is half the promise; the OTHER half is the resolver's
// from-list (the t923 law: "the resolver's from-list is the same law at
// the drinking layer"). This window's film rode import → excludemg →
// MotionCorr with BOTH halves honest EXCEPT the table — the filter kept
// 23 of 24 and the resolver still fell through to the raw import star
// (the motioncorr row's from-list knew only "import"), so the subset run
// drank the full list with identical values. A from-list that drops
// excludemg again flaps here.
const engineSrc = codeOf(read("src/lib/relion/engine.ts"));
ok("E1 the motioncorr from-list names excludemg (the t923 law carried down)", /motioncorr: \[\s*\{[\s\S]*?from: \["import", "excludemg"\]/.test(engineSrc));
ok("E2 the ctffind from-list keeps its excludemg (the t923 original stands)", /ctffind: \[\s*\{[\s\S]*?from: \["import", "motioncorr", "excludemg"\]/.test(engineSrc));

console.log(`\n  ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

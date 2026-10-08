// t653 — the matcher unit probe: lib/job-match.ts is the ONE home of
// "does this job match that query", and this probe pins its semantics
// BEFORE the UI e2e walks the real canvas.
//
//   A  subsequenceMatch — the fuzzy primitive itself (order, case,
//      repetition).
//   B  jobMatchesQuery — includes regression (the old contract, byte
//      identical), then the t653 dialect growth (abbreviations), then
//      the guards (order, length, emptiness).
//   C  jobMatchesFind — Task 134's empty-query contract and the status
//      gate survive the fuzzy dialect untouched.
// t733 jiti codemod — Node ≥24 ESM no longer resolves extensionless
// imports; jiti (in-tree) loads the REAL lib for live-fire, with the
// project's @/ alias wired so lib-internal @/ imports resolve too.
// In-place (not hoisted): the probe's own execution order is law.
import { createJiti } from "jiti";
import * as __path from "node:path";
const __jiti = createJiti(import.meta.url, {
  alias: { "@": __path.resolve(import.meta.dirname, "..", "src") },
});
const { jobMatchesQuery, jobMatchesFind, subsequenceMatch } = await __jiti.import("../src/lib/job-match");

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};
const job = (name, type) => ({ id: "j", name, type, status: "completed" });

// ---------- A: the primitive ----------
console.log("A subsequenceMatch:");
must(subsequenceMatch("cls2", "Class2D") === true, "A cls2 ⊂ Class2D (the operator dialect)");
must(subsequenceMatch("ref3d", "Refine3D") === true, "A ref3d ⊂ Refine3D");
must(subsequenceMatch("ctffnd", "CtfFind") === true, "A ctffnd ⊂ CtfFind (dropped letters)");
must(subsequenceMatch("ac", "abc") === true, "A ac ⊂ abc (gaps allowed — the non-continuous essence)");
must(subsequenceMatch("cb", "abc") === false, "A query order binds: cb ⊄ abc (c sits at the end, b is behind it)");
must(subsequenceMatch("cz", "abc") === false, "A missing char breaks the chain (cz ⊄ abc)");
must(subsequenceMatch("ca2", "2D Classification") === false, "A order is binding: ca2 ⊄ 2D Classification (the 2 precedes the c)");
must(subsequenceMatch("2dc", "2D Classification") === true, "A 2dc ⊂ 2D Classification (in order)");

// ---------- B: the query predicate ----------
console.log("B jobMatchesQuery:");
// includes regression — every query that matched before t653 still does
must(jobMatchesQuery(job("CTF estimation", "ctffind"), "ctf") === true, "B includes: ctf → CTF estimation (name substring)");
must(jobMatchesQuery(job("own motioncorr", "ctffind"), "ctf") === true, "B includes: ctf → label CTF Estimation (type substring)");
must(jobMatchesQuery(job("2D classification", "class2d"), "class") === true, "B includes: class → 2D classification");
must(jobMatchesQuery(job("anything", "import"), "") === false, "B empty query matches nothing");
// dialect growth — what includes() never heard
must(jobMatchesQuery(job("2D classification", "class2d"), "2dc") === true, "B fuzzy: 2dc → 2D classification (new hit, no substring exists)");
must(jobMatchesQuery(job("Class2D", "class2d"), "cls2") === true, "B fuzzy: cls2 → Class2D");
must(jobMatchesQuery(job("Refine3D", "refine3d"), "ref3d") === true, "B fuzzy: ref3d → Refine3D");
must(jobMatchesQuery(job("abc", "import"), "ac") === true, "B fuzzy growth proof: ac → abc (substring false — the gap makes the hit)");
// guards
must(jobMatchesQuery(job("2D classification", "class2d"), "ca2") === false, "B order guard: ca2 stays silent (0 hits in the canonical world)");
must(jobMatchesQuery(job("abc", "import"), "x") === false, "B single char, absent → false");
must(jobMatchesQuery(job("abc", "import"), "b") === true, "B single char via substring still works");

// ---------- C: the find predicate gates ----------
console.log("C jobMatchesFind:");
must(jobMatchesFind(job("2D classification", "class2d"), "", "all", "all") === false, "C Task 134: empty query, no chip → nothing");
must(jobMatchesFind(job("2D classification", "class2d"), "", "completed", "all") === true, "C chip alone is a lens: empty query + status matches");
must(jobMatchesFind(job("2D classification", "class2d"), "2dc", "running", "all") === false, "C status gate outranks the fuzzy hit");
must(jobMatchesFind(job("2D classification", "class2d"), "2dc", "completed", "all") === true, "C fuzzy hit rides through a passing gate");
must(jobMatchesFind(job("2D classification", "class2d"), "2dc", "all", "class2d") === true, "C category gate passes for the matching stage");
must(jobMatchesFind(job("2D classification", "class2d"), "2dc", "all", "motion") === false, "C category gate honestly excludes the non-member");

console.log(`\nt653-match-unit: ${PASS} pass / ${FAIL} fail`);
process.exit(FAIL ? 1 : 0);

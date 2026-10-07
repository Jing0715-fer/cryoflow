// t655 — the WHY unit probe: lib/job-match.ts now answers TWO questions
// with ONE walk — "does this job match" (jobMatchesQuery) and "WHY does
// it match" (jobMatchWhy: which text won, which character spans light
// up). This probe pins the geometry BEFORE the UI e2e walks the canvas.
//
//   A  subsequenceSpans — the geometry primitive (merge law, coverage
//      law, order binding) and its boolean view subsequenceMatch.
//   B  jobMatchWhy — the ladder as geometry (name → label → dialects),
//      priority order byte-identical to the predicate's.
//   C  the drift-proof law: predicate ⟺ why != null across a corpus,
//      plus the marked-concat law (the marks literally spell the query)
//      and the chip-alone honesty (ring without why).
import {
  jobMatchWhy,
  jobMatchesQuery,
  jobMatchesFind,
  subsequenceMatch,
  subsequenceSpans,
} from "../src/lib/job-match";
import { jobType } from "../src/lib/workflow";

let PASS = 0, FAIL = 0;
const must = (cond, label, detail) => {
  if (cond) { PASS++; console.log(`  ok: ${label}${detail ? ` (${detail})` : ""}`); }
  else { FAIL++; console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`); }
};
const job = (name, type) => ({ id: "j", name, type, status: "completed" });
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** The marked-concat law: slicing the winning text along the spans and
 *  lowercasing must spell the query back — the highlight IS the match. */
const markedConcat = (why, text) =>
  why.spans.map(([s, e]) => text.slice(s, e).toLowerCase()).join("");

// ---------- A: the geometry primitive ----------
console.log("A subsequenceSpans:");
must(eq(subsequenceSpans("ctf", "CTF Estimation"), [[0, 3]]),
  "A includes-shaped walk: ctf → one contiguous span");
must(eq(subsequenceSpans("cls2", "Class2D"), [[0, 2], [3, 4], [5, 6]]),
  "A merge law: cls2 in Class2D → 'Cl' + 's' + '2' — three washes, gaps honest");
must(eq(subsequenceSpans("aa", "aabb"), [[0, 2]]),
  "A adjacent anchors fuse: aa → [0,2)");
must(subsequenceSpans("cb", "abc") === null,
  "A order binds: cb gets no geometry from abc");
must(subsequenceSpans("cz", "abc") === null,
  "A broken chain → null (geometry, like the boolean, refuses)");
must(eq(subsequenceSpans("ctffnd", "CtfFind"), [[0, 4], [5, 7]]),
  "A dropped letters: ctffnd → 'CtfF' + 'nd'");
// coverage law — every query char anchors exactly once, so the marked
// area's total length IS the query's length (no extra, no missing)
{
  const cases = [["cls2", "Class2D"], ["2dc", "2D Classification"], ["ref3d", "Refine3D"], ["ctf", "CTF Estimation"]];
  let allCover = true;
  for (const [q, text] of cases) {
    const spans = subsequenceSpans(q, text);
    if (!spans || spans.reduce((n, [s, e]) => n + (e - s), 0) !== q.length) allCover = false;
  }
  must(allCover, "A coverage law: span lengths sum to the query length");
}
// the boolean is a VIEW of the geometry — one walk, two answers
{
  const corpus = [["cls2", "Class2D"], ["cb", "abc"], ["ac", "abc"], ["2dc", "2D Classification"], ["ca2", "2D Classification"], ["x", "abc"]];
  const agree = corpus.every(([q, text]) => subsequenceMatch(q, text) === (subsequenceSpans(q, text) !== null));
  must(agree, "A subsequenceMatch ≡ (subsequenceSpans ≠ null) — one walk");
}

// ---------- B: the why ladder ----------
console.log("B jobMatchWhy:");
{
  const why = jobMatchWhy(job("CTF estimation", "ctffind"), "ctf");
  must(why?.source === "name" && eq(why.spans, [[0, 3]]),
    "B name includes → name spans (the contiguous case)");
  const whyLabel = jobMatchWhy(job("own motioncorr", "ctffind"), "ctf");
  must(whyLabel?.source === "label" && whyLabel.spans.length === 1,
    "B label includes → label spans (the why points at the TYPE row)");
  must(markedConcat(whyLabel, jobTypeLabel("ctffind")) === "ctf",
    "B label marks spell the query (concat law on the label)");
  const whyName = jobMatchWhy(job("2D classification", "class2d"), "2dc");
  must(whyName?.source === "name" && eq(whyName.spans, [[0, 2], [3, 4]]),
    "B name dialect: 2dc → '2D' + 'C' (two washes, gap honest)");
  const whyOnlyLabel = jobMatchWhy(job("Isolation 2", "class2d"), "cls");
  must(whyOnlyLabel?.source === "label" &&
       markedConcat(whyOnlyLabel, jobTypeLabel("class2d")) === "cls",
    "B label dialect: cls lives in the type label, not this name");
  must(jobMatchWhy(job("anything", "import"), "") === null,
    "B empty query → no why (nothing to explain)");
  must(jobMatchWhy(job("abc", "import"), "x") === null,
    "B absent single char → no why");
  must(jobMatchWhy(job("abc", "import"), "b")?.source === "name",
    "B single char via substring gets a why");
  // priority: the ladder is the PREDICATE's ladder, unchanged
  must(jobMatchWhy(job("Motion 2", "motioncorrection"), "motion")?.source === "name",
    "B priority: name includes beats label includes");
  must(jobMatchWhy(job("MyClass2D pick", "class2d"), "cls2")?.source === "name",
    "B priority: name dialect beats label dialect");
}
function jobTypeLabel(type) {
  // the same expression the lib and the card both speak
  return jobType(type)?.label ?? type;
}

// ---------- C: the drift-proof law ----------
console.log("C predicate ⟺ why:");
{
  const names = ["2D classification", "CTF estimation", "Motion Correction 2",
    "own motioncorr", "Class2D", "Refine3D", "abc", "pick particles", "Particle picking 1"];
  const types = ["class2d", "ctffind", "motioncorrection", "refine3d", "import"];
  const queries = ["", "ctf", "cls2", "2dc", "ref3d", "motion", "ca2", "ac", "x", "pa", "king", "  ctf  "];
  let checked = 0, drifted = 0, concatBroken = 0;
  for (const name of names) for (const type of types) for (const q of queries) {
    const j = job(name, type);
    const match = jobMatchesQuery(j, q);
    const why = jobMatchWhy(j, q);
    checked++;
    if (match !== (why !== null)) drifted++;
    if (why) {
      const text = why.source === "name" ? name : jobTypeLabel(type);
      if (markedConcat(why, text) !== q.trim().toLowerCase()) concatBroken++;
    }
  }
  must(drifted === 0, `C hit set and why agree everywhere (${checked} cells, 0 drift)`);
  must(concatBroken === 0, "C concat law: every why spells its query back");
}
must(jobMatchesFind(job("2D classification", "class2d"), "", "completed", "all") === true &&
     jobMatchWhy(job("2D classification", "class2d"), "") === null,
  "C chip alone is a lens — ring WITHOUT why (the chip is the why)");
must(jobMatchesFind(job("2D classification", "class2d"), "2dc", "completed", "all") === true &&
     jobMatchWhy(job("2D classification", "class2d"), "2dc")?.source === "name",
  "C gated fuzzy hit carries its why through the gate");
// the old predicate contract still stands, byte for byte (t653's anchors re-run)
must(jobMatchesQuery(job("CTF estimation", "ctffind"), "ctf") === true, "C t653 anchor: ctf → CTF estimation");
must(jobMatchesQuery(job("2D classification", "class2d"), "ca2") === false, "C t653 anchor: ca2 stays silent");
must(jobMatchesQuery(job("abc", "import"), "ac") === true, "C t653 anchor: ac ⊂ abc (the gap makes the hit)");

console.log(`\nt655-match-unit: ${PASS} pass / ${FAIL} fail`);
process.exit(FAIL ? 1 : 0);

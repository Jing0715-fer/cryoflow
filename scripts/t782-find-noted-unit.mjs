/**
 * t782-find-noted-unit — the find lens grows its FOURTH orthogonal
 * dimension: the noted chip (the judgment gate as a queryable ring).
 *
 * The lens spoke text ∧ status ∧ stage; the judgment dimension lived
 * everywhere EXCEPT the lens — the palette's Notes group lists judged
 * jobs, the header chip counts them, the dashboard filters them, the
 * note spotlight (N) dims their complement — but "motion, but only the
 * judged ones, still running" had no single lens. t782 arms the SAME
 * hasJudgment predicate as a toggle chip: one predicate, no second
 * copy, five consumers (find bar / canvas ring set / minimap dots /
 * inspector's param why / the lens's own count). The spotlight is the
 * ambient dim of the predicate; the chip is its queryable ring —
 * coexisting, not competing.
 *
 *   A  the store's wiring — findNoted lives beside findStatus/findCategory
 *      (same ephemerality law: closeFind resets all four lens fields,
 *      nothing enters undo or storage), the setter, the false default.
 *   B  the predicate — the noted gate rides AFTER the category gate and
 *      BEFORE the empty-query law, the law grows the fourth rung (a chip
 *      alone is a lens in EVERY dimension), the import is the ONE
 *      hasJudgment (class-notes' own), and the default false keeps every
 *      older call site honest without knowing.
 *   C  the chip's face — rung 3 on the cascade stair (180ms base, same
 *      step clock), the testid, aria-pressed toggle semantics (not
 *      radio), the note family's amber active hue (the color the app
 *      already speaks for judgments — canvas badge / palette capsule /
 *      spotlight icon), the t585 activation voice (post-arm only), and
 *      the honest-zero four-way (an armed noted chip with zero hits says
 *      "no matches" — the lens is on, the world has nothing).
 *   D  the consumers — canvas ring set, minimap dots, inspector's param
 *      why: all five call sites pass findNoted, all three armed-lens
 *      early returns grow the fourth rung, every deps array carries it
 *      (the row can never claim a match the card does not ring).
 *   E  the ledger — no second hasJudgment import anywhere in the find
 *      stack, the verdict notes lead their blocks (raw channel), the
 *      cascade budget still holds (rung 3 lands + settles inside 720ms),
 *      and the spotlight coexistence is on the record.
 *
 * Run:  node scripts/t782-find-noted-unit.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

let pass = 0;
let fail = 0;
const fails = [];
const ok = (cond, label) => {
  if (cond) pass++;
  else {
    fail++;
    fails.push(label);
  }
};
const eq = (a, b, label) => ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

const read = (p) => readFileSync(path.join(ROOT, p), "utf8");
const strip = (s) =>
  s
    .split("\n")
    .map((l) => {
      const i = l.indexOf("//");
      return i >= 0 ? l.slice(0, i) : l;
    })
    .join("\n");
const norm = (s) => s.replace(/\s+/g, " ");

const storeRaw = read("src/lib/store.ts");
const store = strip(storeRaw);
const jmRaw = read("src/lib/job-match.ts");
const jm = strip(jmRaw);
const fbRaw = read("src/components/workflow/canvas-find-bar.tsx");
const fb = strip(fbRaw);
const fbRawN = norm(fbRaw);
const cvRaw = read("src/components/workflow/canvas.tsx");
const cv = strip(cvRaw);
const mmRaw = read("src/components/workflow/canvas-minimap.tsx");
const mm = strip(mmRaw);
const inspRaw = read("src/components/workflow/job-inspector.tsx");
const insp = strip(inspRaw);

/* ------------------------------------------------------------------ */
/* A — the store's wiring                                              */
/* ------------------------------------------------------------------ */

// A1 — the field lives beside its siblings (the lens state block)
ok(/findNoted: boolean;/.test(store), "A1 the findNoted field is declared");
ok(/findNoted: false,/.test(store), "A1 the default is false (the lens starts quiet)");

// A2 — the ephemerality law: closeFind resets ALL FOUR lens fields
ok(/closeFind: \(\) => set\(\{ findOpen: false, findQuery: "", findStatus: "all", findCategory: "all", findNoted: false \}\)/.test(store),
  "A2 closeFind resets the noted half with its siblings");

// A3 — the setter
ok(/setFindNoted: \(n\) => set\(\{ findNoted: n \}\)/.test(store), "A3 the setter writes the boolean");
ok(/setFindNoted: \(n: boolean\) => void;/.test(store), "A3 the setter is declared in the interface");

// A4 — the field doc keeps the one-predicate doctrine on the record
ok(/the SAME hasJudgment predicate the palette's/.test(norm(storeRaw)),
  "A4 the store doc names the one-predicate doctrine");

/* ------------------------------------------------------------------ */
/* B — the predicate                                                   */
/* ------------------------------------------------------------------ */

// B1 — the signature: notedOnly rides LAST with a false default (older
// call sites stay honest without knowing)
ok(/export function jobMatchesFind\(\n  job: JobDTO,\n  query: string,\n  status: JobStatus \| "all",\n  category: string \| "all" = "all",\n  notedOnly: boolean = false\n\): boolean \{/.test(jm),
  "B1 the signature grows notedOnly (last, default false)");

// B2 — the gate rides after category, before the empty-query law
const notedGateAt = jm.indexOf('if (notedOnly && !hasJudgment(job)) return false;');
const categoryGateAt = jm.indexOf("if (category !== \"all\" && jobType(job.type)?.category !== category) return false;");
const emptyLawAt = jm.indexOf("if (!query.trim()) return");
ok(notedGateAt > 0 && categoryGateAt > 0 && emptyLawAt > 0, "B2 all three gates are locatable");
ok(notedGateAt > categoryGateAt && notedGateAt < emptyLawAt,
  "B2 the noted gate sits between the category gate and the empty-query law");

// B3 — the empty-query law grows the fourth rung (a chip alone is a
// lens in every dimension)
ok(/if \(!query\.trim\(\)\) return status !== "all" \|\| category !== "all" \|\| notedOnly;/.test(jm),
  "B3 the empty-query law admits the noted chip alone");

// B4 — the ONE predicate: the import comes from class-notes (the
// judgment's own home), and the find stack imports it exactly once
eq((jm.match(/from "@\/lib\/class-notes"/g) || []).length, 1,
  "B4 job-match imports class-notes exactly once (no second copy)");
ok(/import \{ hasJudgment \} from "@\/lib\/class-notes";/.test(jm),
  "B4 the import is the named hasJudgment (not a re-derivation)");

// B5 — the doc keeps the question on the record (raw channel)
ok(/which steps did I have opinions about/.test(norm(jmRaw)),
  "B5 the predicate's doc names the question the chip answers");

/* ------------------------------------------------------------------ */
/* C — the chip's face                                                 */
/* ------------------------------------------------------------------ */

// C1 — the rung: rung 3 on the stair, 180ms base, same step clock
ok(/data-find-rung="3"/.test(fb), "C1 the noted row is rung 3");
ok(/"--find-d": "180ms"/.test(fb), "C1 the row lands 180ms into the cascade");
ok(/const NOTE_CHIP_BASE_MS = 180 \+ ROW_TRAVEL_MS;/.test(fb),
  "C1 the chip stair rides the same step clock");

// C2 — the registry: one row, one chip, the toggle testid
eq((fb.match(/data-testid="canvas-find-note-row"/g) || []).length, 1,
  "C2 exactly one note row");
eq((fb.match(/data-testid="canvas-find-noted"/g) || []).length, 1,
  "C2 exactly one noted chip");

// C3 — toggle semantics: aria-pressed (not radio), honest title pair
ok(/aria-pressed=\{findNoted\}/.test(fb), "C3 the chip is a toggle (aria-pressed)");
ok(/title=\{findNoted \? "Clear the noted filter" : "Only jobs that carry a note or class judgment"\}/.test(fb),
  "C3 the title pair is honest both ways");

// C4 — the amber is the note family's own, at the t728 WHISPER volume:
// the find stack's amber is a wash (the 5% fill + the 40% border — the
// LINE_EXEMPT signature) with NO text-color pair (the t647 ink residue
// the codemod migrated away); the chip borrows the judged wash, never a
// second dialect. The census (t650) carries the row exemption.
ok(/border-amber-500\/40 bg-amber-500\/5 text-foreground/.test(fb),
  "C4 the active hue is the judged wash at whisper volume (the t728 signature)");
ok(!/text-amber-600 dark:text-amber-400/.test(fb),
  "C4 no ink-pair residue on the chip (the t647 law holds)");

// C5 — the t585 voice: activation answers post-arm only, keyed note:noted
ok(/chipSetKeys\.has\("note:noted"\)/.test(fb), "C5 the voice key is note:noted");
ok(/if \(!enterArmed && next\) \{/.test(fb), "C5 activation answers post-arm only (the release is quiet)");

// C6 — the StickyNote icon is decor (the word is the substance)
ok(/<StickyNote className="size-3" aria-hidden="true" \/>/.test(fb),
  "C6 the sticky-note icon is aria-hidden decor");

// C7 — the honest zero grows the fourth rung
ok(/findQuery\.trim\(\) \|\| findStatus !== "all" \|\| findCategory !== "all" \|\| findNoted/.test(fb),
  "C7 an armed noted chip with zero hits says no matches");

// C8 — the row is a group with its own name (the a11y grammar)
ok(/aria-label="Filter matches by note"/.test(fb), "C8 the row's group label");

/* ------------------------------------------------------------------ */
/* D — the consumers                                                   */
/* ------------------------------------------------------------------ */

// D1 — the find bar's own memo: five args, five deps
ok(/jobMatchesFind\(j, findQuery, findStatus, findCategory, findNoted\)/.test(fb),
  "D1 the find bar's memo passes the noted gate");
ok(/\[findOpen, findQuery, findStatus, findCategory, findNoted, jobs\]/.test(fb),
  "D1 the find bar's deps carry findNoted");

// D2 — the canvas ring set: same args, same deps, the armed test four-way
ok(/jobMatchesFind\(j, findQuery, findStatus, findCategory, findNoted\)/.test(cv),
  "D2 the canvas ring set passes the noted gate");
ok(/if \(!findOpen \|\| \(!q && findStatus === "all" && findCategory === "all" && !findNoted\)\) return null;/.test(cv),
  "D2 the canvas's armed-lens test admits the noted chip");
ok(/\[findOpen, findQuery, findStatus, findCategory, findNoted, jobs\]/.test(cv),
  "D2 the canvas's deps carry findNoted");

// D3 — the minimap dots: the same three-part update
ok(/jobMatchesFind\(j, findQuery, findStatus, findCategory, findNoted\)/.test(mm),
  "D3 the minimap passes the noted gate");
ok(/!findNoted\)\) return null;/.test(mm),
  "D3 the minimap's armed-lens test admits the noted chip");
ok(/\[findOpen, findQuery, findStatus, findCategory, findNoted, jobs\]/.test(mm),
  "D3 the minimap's deps carry findNoted");

// D4 — the inspector's param why: the full gate's law (the row can
// never claim a match the card does not ring)
ok(/jobMatchesFind\(job, findQuery, findStatus, findCategory, findNoted\)/.test(insp),
  "D4 the inspector's param why passes the noted gate");
ok(/\[job, findOpen, findQuery, findStatus, findCategory, findNoted\]/.test(insp),
  "D4 the inspector's deps carry findNoted");

// D5 — the store subscriptions: all three consumers read the same slice
eq((cv.match(/const findNoted = useWorkflowStore\(\(s\) => s\.findNoted\);/g) || []).length, 1,
  "D5 the canvas subscribes once");
eq((mm.match(/const findNoted = useWorkflowStore\(\(st\) => st\.findNoted\);/g) || []).length, 1,
  "D5 the minimap subscribes once");
eq((insp.match(/const findNoted = useWorkflowStore\(\(s\) => s\.findNoted\);/g) || []).length, 1,
  "D5 the inspector subscribes once");

/* ------------------------------------------------------------------ */
/* E — the ledger                                                      */
/* ------------------------------------------------------------------ */

// E1 — the lens's own memos contain ZERO direct hasJudgment reads (the
// gate lives in the predicate — the consumers' own pre-existing
// hasJudgment uses [the canvas spotlight's dim set] are separate
// features and stay untouched; the FIND path must not re-derive)
const cvMemo = cv.slice(cv.indexOf("const findMatchIds = React.useMemo("), cv.indexOf("[findOpen, findQuery, findStatus, findCategory, findNoted, jobs]"));
const mmMemo = mm.slice(mm.indexOf("const findMatchIds = React.useMemo("), mm.indexOf("[findOpen, findQuery, findStatus, findCategory, findNoted, jobs]"));
ok(cvMemo.includes("jobMatchesFind") && !cvMemo.includes("hasJudgment"),
  "E1 the canvas's find memo gates through the predicate (no re-derivation)");
ok(mmMemo.includes("jobMatchesFind") && !mmMemo.includes("hasJudgment"),
  "E1 the minimap's find memo gates through the predicate");
ok(!insp.slice(insp.indexOf("const paramWhy = React.useMemo("), insp.indexOf("[job, findOpen, findQuery, findStatus, findCategory, findNoted]")).includes("hasJudgment"),
  "E1 the inspector's param-why memo gates through the predicate");

// E2 — the verdict notes lead their blocks (raw channel)
ok(/the noted half of the find lens: when true, only jobs that/.test(norm(storeRaw)),
  "E2 the store field's verdict note leads");
ok(/the noted gate: when the noted chip is armed, only jobs/.test(norm(jmRaw)),
  "E2 the predicate's verdict note leads");
ok(/the NOTED half of the lens: the fourth orthogonal/.test(fbRawN),
  "E2 the chip row's verdict note leads");
ok(/the noted rung stair: one rung past the type row/.test(fbRawN),
  "E2 the timing constant's verdict note leads");

// E3 — the cascade budget still holds: rung 3 lands at 180+220=400ms,
// one chip settles by 400+160=560 < 720ms (the budget comment's math)
ok(/const NOTE_CHIP_BASE_MS = 180 \+ ROW_TRAVEL_MS;/.test(fb) && 180 + 220 + 160 < 720,
  "E3 rung 3 lands and settles inside the 720ms budget");

// E4 — the spotlight coexistence is on the record (raw channel)
ok(/the spotlight \(N\) is the ambient dim of the same predicate/.test(norm(fbRaw)) ||
   /coexisting, not/.test(norm(fbRaw)),
  "E4 the chip/spotlight coexistence note is on the record");

// E5 — the toggle has no third state (the chip writes booleans only —
// no "all" sentinel sneaks into the noted dimension)
ok(!/findNoted === "all"|findNoted: "all"/.test(store + fb + jm),
  "E5 the noted dimension stays a boolean (no all-sentinel drift)");

/* ------------------------------------------------------------------ */

console.log(`t782-find-noted-unit: ${pass} pass / ${fail} fail`);
if (fail) {
  fails.forEach((f) => console.log("  FAIL:", f));
  process.exit(1);
}

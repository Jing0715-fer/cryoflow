/**
 * t454 bench — the convergence verdict: one run vs its OWN rounds.
 *
 * Pure-brain assertions only (the face is React; the brain is laws):
 *   CV1 round dialect     — "Round 025" (RELION's pad, ids never prose)
 *   CV2 default pair      — the whole arc (earliest vs latest, sorted,
 *                           deduped, null below two distinct rounds)
 *   CV3 moving census     — motion counted, not quality; |Δ| is the
 *                           truth; the ending matches the settled share;
 *                           the biggest mover speaks with its sign
 *   CV4 pairing + drift   — the shared core joins by "Class 007" and
 *                           the share lens speaks percentage points
 *   CV5 vocabulary        — the convergence face inherits the class
 *                           family's words (gained/lost/held)
 *   CV6 filter plan       — the exclude rider's plan speaks the MINTED
 *                           FILTER's ports; today they coincide with
 *                           run B's shape (equivalence pinned)
 */

import {
  CLASS_LENSES,
  CLASS_WORDS,
  classRunRow,
} from "../src/lib/class-compare";
import {
  joinByName,
  pairedDeltas,
  verdict,
  type Delta,
} from "../src/lib/paired-compare";
import { planAdoption } from "../src/lib/adopt-branch";
import {
  MOVING_PP,
  defaultRoundPair,
  movingCensus,
  roundLabel,
} from "../src/lib/convergence";

let pass = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string) {
  if (cond) {
    pass++;
  } else {
    failures.push(label);
    console.error(`  ✗ ${label}`);
  }
}
function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  ok(a === b, `${label} — expected ${b}, got ${a}`);
}

/* ---------------------------------------------------------------- */
/* CV1 — the round dialect: a round label is an id, never prose.     */
/* ---------------------------------------------------------------- */
console.log("CV1 — round dialect");
eq(roundLabel(0), "Round 000", "CV1a zero pads to three");
eq(roundLabel(7), "Round 007", "CV1b single digit padded");
eq(roundLabel(25), "Round 025", "CV1c two digits padded");
eq(roundLabel(200), "Round 200", "CV1d three digits unpadded");
eq(roundLabel(1425), "Round 1425", "CV1e wider rounds keep growing");

/* ---------------------------------------------------------------- */
/* CV2 — the default pair is the run's WHOLE ARC.                    */
/* ---------------------------------------------------------------- */
console.log("CV2 — default pair");
eq(defaultRoundPair([0, 1, 2, 3, 4, 5, /* ... */ 25]), { a: 0, b: 25 }, "CV2a whole arc earliest vs latest");
eq(defaultRoundPair([25, 5, 10]), { a: 5, b: 25 }, "CV2b unsorted input sorted");
eq(defaultRoundPair([5, 5, 10, 10, 25]), { a: 5, b: 25 }, "CV2c duplicates deduped");
eq(defaultRoundPair([7]), null, "CV2d one round has no arc");
eq(defaultRoundPair([]), null, "CV2e empty ladder no arc");
ok(defaultRoundPair([3, 3]) === null, "CV2f two identical rounds are still one round");

/* ---------------------------------------------------------------- */
/* CV3 — the moving census: motion counted, not quality.             */
/* ---------------------------------------------------------------- */
console.log("CV3 — moving census");
function delta(name: string, d: number): Delta {
  return { name, a: 10, b: 10 + d, delta: d, kind: d > 0 ? "improved" : d < 0 ? "regressed" : "tied" };
}
eq(movingCensus([], { aRound: 0, bRound: 25 }), null, "CV3a empty electorate hides the line");
const settled = [delta("Class 001", 0), delta("Class 002", 0.2), delta("Class 003", -0.5)];
ok(
  movingCensus(settled, { aRound: 0, bRound: 25 })?.endsWith("the assignment has settled.") ?? false,
  "CV3b zero movers → has settled",
);
ok(
  !(movingCensus(settled, { aRound: 0, bRound: 25 }) ?? "").includes("biggest"),
  "CV3c no movers → no biggest named",
);
const mostlySettled = [
  ...Array.from({ length: 47 }, (_, i) => delta(`Class ${String(i + 1).padStart(3, "0")}`, 0)),
  delta("Class 048", 1.4),
  delta("Class 049", -2.2),
  delta("Class 050", 0.8),
];
const ms = movingCensus(mostlySettled, { aRound: 0, bRound: 25 }) ?? "";
ok(ms.startsWith("Convergence census: 2 of 50 classes moved more than 1.0 pp between Round 000 and Round 025"), "CV3d census counts and names the rounds");
ok(ms.includes("(biggest: Class 049, -2.2 pp)"), "CV3e biggest mover by |Δ|, with its sign");
ok(ms.endsWith("the assignment is mostly settled."), "CV3f ≥90% held → mostly settled");
const shuffling = [
  ...Array.from({ length: 20 }, (_, i) => delta(`Class ${String(i + 1).padStart(3, "0")}`, 0)),
  ...Array.from({ length: 30 }, (_, i) => delta(`Class ${String(i + 31).padStart(3, "0")}`, 1.5 + i * 0.1)),
];
ok(
  movingCensus(shuffling, { aRound: 0, bRound: 25 })?.endsWith("the assignment is still re-shuffling.") ?? false,
  "CV3g many movers → still re-shuffling",
);
/* threshold law: strictly GREATER — a class that moved exactly the
 * threshold has not crossed it */
const exact = [delta("Class 001", 1.0), delta("Class 002", 0)];
ok(
  movingCensus(exact, { aRound: 0, bRound: 25 })?.startsWith("Convergence census: 0 of 2") ?? false,
  "CV3h exactly-at-threshold is not moving (strict >)",
);
ok(
  movingCensus(exact, { aRound: 0, bRound: 25, threshold: 0.5 })?.startsWith("Convergence census: 1 of 2") ?? false,
  "CV3i custom threshold respected",
);
eq(MOVING_PP, 1, "CV3j the default threshold is 1 pp");

/* ---------------------------------------------------------------- */
/* CV4 — pairing + drift: the shared core joins by "Class 007".      */
/* ---------------------------------------------------------------- */
console.log("CV4 — pairing and drift");
/* two rounds of one run: early round has class 5 still empty (absent
 * from the occupancy), later round has it populated; class 9's share
 * collapses while class 2's grows — real convergence shapes */
const early = [
  classRunRow({ cls: 1, count: 24, fraction: 0.25 }),
  classRunRow({ cls: 2, count: 24, fraction: 0.25 }),
  classRunRow({ cls: 3, count: 48, fraction: 0.5 }),
];
const late = [
  classRunRow({ cls: 1, count: 12, fraction: 0.125 }),
  classRunRow({ cls: 2, count: 36, fraction: 0.375 }),
  classRunRow({ cls: 3, count: 48, fraction: 0.5 }),
  classRunRow({ cls: 5, count: 4, fraction: 0.0425 }), // not 0.5-0.125-0.375... fraction need not sum across fixtures
];
const join = joinByName(early, late);
eq(join.pairs.length, 3, "CV4a three classes paired");
eq(join.onlyB, ["Class 005"], "CV4b the late-born class is named, never folded in");
const deltas = pairedDeltas(join.pairs, CLASS_LENSES.share);
eq(deltas.map((d) => d.delta), [-12.5, 12.5, 0], "CV4c share deltas speak percentage points");
const v = verdict(deltas);
eq([v.improved, v.regressed, v.tied], [1, 1, 1], "CV4d verdict: 1 gained · 1 lost · 1 held");
eq(v.medianDelta, 0, "CV4e median delta of [-12.5, 0, 12.5] is 0");
/* the census over the REAL delta shape — the late-born class cannot
 * vote, so the electorate is the paired three */
const census = movingCensus(deltas, { aRound: 0, bRound: 25 }) ?? "";
ok(census.includes("2 of 3 classes moved more than 1.0 pp"), "CV4f census counts only the paired electorate");
ok(census.includes("(biggest: Class 001, -12.5 pp)"), "CV4g the collapsing class is the biggest mover");
ok(census.endsWith("the assignment is still re-shuffling."), "CV4h a 2/3-moving pack is re-shuffling");

/* ---------------------------------------------------------------- */
/* CV5 — the vocabulary law: convergence inherits the class family's */
/* words (gained/lost/held — never improved/regressed).              */
/* ---------------------------------------------------------------- */
console.log("CV5 — vocabulary");
eq(CLASS_WORDS.better, "gained", "CV5a gained");
eq(CLASS_WORDS.worse, "lost", "CV5b lost");
eq(CLASS_WORDS.same, "held", "CV5c held");
eq(CLASS_WORDS.betterNoun, "gains", "CV5d gains noun");
eq(CLASS_WORDS.worseNoun, "losses", "CV5e losses noun");

/* ---------------------------------------------------------------- */
/* CV6 — the exclude rider's plan speaks the MINTED FILTER's ports.  */
/* ---------------------------------------------------------------- */
console.log("CV6 — filter-shaped exclusion plan");
const PLAN_A = "A", PLAN_B = "B", PLAN_CHILD = "child";
const planEdges = [
  { id: "e1", fromJobId: PLAN_A, toJobId: PLAN_CHILD, fromPort: "micrographs", toPort: "micrographs" },
];
const planJobs = [
  { id: PLAN_A, type: "ctffind", name: "A run" },
  { id: PLAN_B, type: "ctffind", name: "B run" },
  { id: PLAN_CHILD, type: "autopick", name: "the downstream" },
];
/* ctffind and excludemg both declare one output: micrographs — the
 * two shapes MUST coincide today (the t452 rider computed against B's
 * shape by accident of this coincidence; t454 pins it deliberately) */
const portsOf = (type: string) =>
  type === "ctffind" ? ["micrographs"] : type === "excludemg" ? ["micrographs"] : [];
const bShaped = planAdoption({
  edges: planEdges, jobs: planJobs, fromRunId: PLAN_A, toRunId: PLAN_B,
  outputPortsOf: portsOf,
});
const filterShaped = planAdoption({
  edges: planEdges, jobs: planJobs, fromRunId: PLAN_A, toRunId: PLAN_B,
  outputPortsOf: (type) =>
    type === "ctffind" ? portsOf("excludemg") : portsOf(type),
});
eq(bShaped.moves.length, 1, "CV6a B-shaped plan moves the wire");
eq(filterShaped.moves.length, 1, "CV6b filter-shaped plan moves the same wire");
eq(filterShaped.moves[0]?.edge.id, bShaped.moves[0]?.edge.id, "CV6c the two shapes move the SAME edge (equivalence pinned)");
/* and if a port ever drifts, the filter shape refuses honestly instead
 * of promising a wire the filter cannot feed */
const driftedShaped = planAdoption({
  edges: planEdges, jobs: planJobs, fromRunId: PLAN_A, toRunId: PLAN_B,
  outputPortsOf: (type) =>
    type === "ctffind" ? ["renamed_output"] : portsOf(type),
});
eq(driftedShaped.moves.length, 0, "CV6d a drifted port refuses instead of over-promising");
eq(driftedShaped.refused.length, 1, "CV6e the refusal is named");
eq(driftedShaped.refused[0]?.reason, "port", "CV6f the refusal reason is the port guard");

/* ---------------------------------------------------------------- */
console.log(`\nt454 bench: ${pass} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.error(failures.map((f) => `  FAIL ${f}`).join("\n"));
  process.exit(1);
}

/**
 * t453 bench — the third domain: the class occupancy verdict.
 *
 * Pure-brain assertions only (the face is React; the brain is laws):
 *   C1 naming law      — "Class 007" IS the id (pad + parse round-trip)
 *   C2 share lens      — fractions speak percentages, direction owned
 *   C3 core join       — the shared join/deltas answer gained/lost/held
 *   C4 census          — the concentration line states, never judges
 *   C5 vocabulary      — CLASS_WORDS law + DEFAULT_WORDS untouched
 *   C6 select payload  — gained rows → sorted deduped class numbers
 */

import {
  CLASS_DEFAULT_LENS,
  CLASS_LENSES,
  CLASS_WORDS,
  TOP_CONCENTRATION,
  USABLE_SHARE,
  classRowName,
  classRunRow,
  concentrationCensus,
  gainedClassNumbers,
  type ClassRunRow,
} from "../src/lib/class-compare";
import {
  DEFAULT_WORDS,
  joinByName,
  pairedDeltas,
  verdict,
  type Pair,
} from "../src/lib/paired-compare";
import { planAdoption } from "../src/lib/adopt-branch";

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
/* C1 — the naming law: the name IS the id.                          */
/* ---------------------------------------------------------------- */
console.log("C1 — naming law");
eq(classRowName(1), "Class 001", "C1a pad to three");
eq(classRowName(7), "Class 007", "C1b pad preserves the digit");
eq(classRowName(50), "Class 050", "C1c two digits still padded");
eq(classRowName(123), "Class 123", "C1d three digits unpadded");
const row = classRunRow({ cls: 7, count: 42, fraction: 0.21 });
eq(row.name, "Class 007", "C1e classRunRow speaks the dialect");
eq(row.cls, 7, "C1f the number rides along");
eq(row.count, 42, "C1g count rides along");
eq(row.fraction, 0.21, "C1h fraction rides along");

/* ---------------------------------------------------------------- */
/* C2 — the share lens.                                              */
/* ---------------------------------------------------------------- */
console.log("C2 — share lens");
const share = CLASS_LENSES[CLASS_DEFAULT_LENS];
ok(share === CLASS_LENSES.share, "C2a default lens IS the share lens");
eq(share.value(row), 21, "C2b fraction speaks as percentage");
eq(share.value(classRunRow({ cls: 1, count: 0, fraction: 0 })), 0, "C2c empty class speaks zero");
eq(share.unit, "%", "C2d unit is the percent sign");
eq(share.digits, 1, "C2e one decimal digit");
eq(share.higherIsBetter, true, "C2f more share = gained (direction owned)");
eq(share.label, "Occupancy share", "C2g the lens has a spoken name");

/* ---------------------------------------------------------------- */
/* C3 — the core join answers gained/lost/held.                      */
/* ---------------------------------------------------------------- */
console.log("C3 — core join on class rows");
const runA: ClassRunRow[] = [
  classRunRow({ cls: 1, count: 60, fraction: 0.6 }),
  classRunRow({ cls: 2, count: 30, fraction: 0.3 }),
  classRunRow({ cls: 3, count: 10, fraction: 0.1 }),
];
const runB: ClassRunRow[] = [
  classRunRow({ cls: 1, count: 72, fraction: 0.72 }),
  classRunRow({ cls: 2, count: 8, fraction: 0.08 }),
  classRunRow({ cls: 3, count: 20, fraction: 0.2 }),
];
const join = joinByName(runA, runB);
eq(join.pairs.length, 3, "C3a three classes pair by name");
eq(join.onlyA, [], "C3b no unpaired rows in A");
const deltas = pairedDeltas(join.pairs, share);
eq(deltas.find((d) => d.name === "Class 001")?.kind, "improved", "C3c gaining class improved (kind stays core's)");
eq(deltas.find((d) => d.name === "Class 002")?.kind, "regressed", "C3d starving class regressed");
eq(deltas.find((d) => d.name === "Class 003")?.kind, "improved", "C3e share mover judged by delta");
eq(deltas[0].delta > 0, true, "C3f delta speaks b − a in share points");
const v = verdict(deltas);
eq(v.improved, 2, "C3g census counts gains");
eq(v.regressed, 1, "C3h census counts losses");

/* unpaired classes are reported, never folded in (the core's law) */
const runB2: ClassRunRow[] = [
  classRunRow({ cls: 1, count: 72, fraction: 0.72 }),
  classRunRow({ cls: 4, count: 28, fraction: 0.28 }),
];
const join2 = joinByName(runA, runB2);
eq(join2.pairs.length, 1, "C3i only matching classes vote");
eq(join2.onlyB, ["Class 004"], "C3j the new class is NAMED, not folded");
eq(join2.onlyA, ["Class 002", "Class 003"], "C3k A's vanished classes named too");

/* ---------------------------------------------------------------- */
/* C4 — the concentration census.                                    */
/* ---------------------------------------------------------------- */
console.log("C4 — concentration census");
const pairs: Pair<ClassRunRow, ClassRunRow>[] = join.pairs.map((p) => ({
  name: p.name,
  a: p.a,
  b: p.b,
}));
const line = concentrationCensus(pairs);
ok(line !== null, "C4a paired electorate speaks");
if (line) {
  ok(
    line.startsWith("Concentration census: the top 5 classes hold"),
    `C4b opening names the census — got: ${line.slice(0, 48)}`,
  );
  // A's top-5 (all there is): 0.6+0.3+0.1 = 100.0%; B: 0.72+0.2+0.08 = 100.0%
  ok(line.includes("100.0% → 100.0%"), "C4c full-pack world speaks both shares");
  ok(line.includes("classes above the 1% bar: 3 → 3"), "C4d usable counts both sides");
  ok(line.includes("across 3 paired classes"), "C4e the electorate size is spoken");
  ok(line.endsWith("the distribution's own health check."), "C4f the census closes as a health check");
}
/* partial populations: the census reads each side's OWN top */
const partialA = [classRunRow({ cls: 1, count: 500, fraction: 0.5 }), classRunRow({ cls: 2, count: 300, fraction: 0.3 }), classRunRow({ cls: 3, count: 200, fraction: 0.2 })];
const partialB = [classRunRow({ cls: 1, count: 300, fraction: 0.3 }), classRunRow({ cls: 2, count: 100, fraction: 0.1 }), classRunRow({ cls: 3, count: 600, fraction: 0.6 })];
const partialPairs: Pair<ClassRunRow, ClassRunRow>[] = [
  { name: "Class 001", a: partialA[0], b: partialB[0] },
  { name: "Class 002", a: partialA[1], b: partialB[1] },
  { name: "Class 003", a: partialA[2], b: partialB[2] },
];
const line2 = concentrationCensus(partialPairs);
ok(line2 !== null, "C4g partial world speaks");
if (line2) {
  // top-5 = whole pack on both sides: A 100%, B 100%; usable (≥1%): 3 → 3
  ok(line2.includes("100.0% → 100.0%"), "C4h own-top sums the whole pack");
  ok(line2.includes("across 3 paired classes"), "C4i electorate stated");
}
eq(TOP_CONCENTRATION, 5, "C4j the census window is five");
eq(USABLE_SHARE, 0.01, "C4k the usability bar is one percent");
eq(concentrationCensus([]), null, "C4l empty electorate hides the line");

/* ---------------------------------------------------------------- */
/* C5 — the vocabulary law.                                          */
/* ---------------------------------------------------------------- */
console.log("C5 — vocabulary law");
eq(CLASS_WORDS.better, "gained", "C5a occupancy gains");
eq(CLASS_WORDS.worse, "lost", "C5b occupancy loses");
eq(CLASS_WORDS.same, "held", "C5c ties are held");
eq(CLASS_WORDS.betterNoun, "gains", "C5d the mover list speaks gains");
eq(CLASS_WORDS.worseNoun, "losses", "C5e the mover list speaks losses");
eq(DEFAULT_WORDS.better, "improved", "C5f the micrograph default untouched");
eq(DEFAULT_WORDS.worse, "regressed", "C5g the micrograph default untouched");
eq(DEFAULT_WORDS.same, "unchanged", "C5h the micrograph default untouched");
eq(DEFAULT_WORDS.betterNoun, "improvements", "C5i the default's movers untouched");
eq(DEFAULT_WORDS.worseNoun, "regressions", "C5j the default's movers untouched");

/* ---------------------------------------------------------------- */
/* C6 — the select verb's payload.                                   */
/* ---------------------------------------------------------------- */
console.log("C6 — select payload");
eq(
  gainedClassNumbers([{ name: "Class 007" }, { name: "Class 003" }, { name: "Class 007" }]),
  [3, 7],
  "C6a sorted, deduped — a set, never a log",
);
eq(gainedClassNumbers([{ name: "Class 012" }]), [12], "C6b pad strips off");
eq(
  gainedClassNumbers([{ name: "mic_002.mrc" }, { name: "unrelated" }]),
  [],
  "C6c foreign names parse to nothing",
);
eq(gainedClassNumbers([]), [], "C6d empty gains speak empty");

/* ---------------------------------------------------------------- */
/* C7 — the select rider's plan speaks the SELECTION's port shape.    */
/* ---------------------------------------------------------------- */
console.log("C7 — selection-shaped adoption plan");
const PLAN_A = "A", PLAN_B = "B", PLAN_SEL = "sel", PLAN_CHILD = "child";
const planEdges = [
  { id: "e1", fromJobId: PLAN_A, toJobId: PLAN_CHILD, fromPort: "classAverages", toPort: "classes" },
  { id: "e2", fromJobId: PLAN_A, toJobId: PLAN_CHILD, fromPort: "particles", toPort: "particles" },
];
const planJobs = [
  { id: PLAN_A, type: "class2d", name: "A run" },
  { id: PLAN_B, type: "class2d", name: "B run" },
  { id: PLAN_SEL, type: "select2d", name: "the selection" },
  { id: PLAN_CHILD, type: "select2d", name: "the downstream" },
];
const portsOf = (type: string) =>
  type === "class2d" ? ["classAverages", "particles"] : type === "select2d" ? ["particles"] : [];
/* the WRONG shape: plan computed against run B (both ports) — promises 2 */
const wrongPlan = planAdoption({
  edges: planEdges, jobs: planJobs, fromRunId: PLAN_A, toRunId: PLAN_B,
  outputPortsOf: portsOf,
});
eq(wrongPlan.moves.length, 2, "C7a B-shaped plan over-promises (2 moves)");
/* the RIGHT shape: the rider adopts the MINTED SELECTION (one output:
 * particles) — the classAverages wire is refused honestly, the
 * particles wire moves */
const selectPlan = planAdoption({
  edges: planEdges, jobs: planJobs, fromRunId: PLAN_A, toRunId: PLAN_B,
  outputPortsOf: (type) =>
    type === "class2d" ? portsOf("select2d") : portsOf(type),
});
eq(selectPlan.moves.length, 1, "C7b selection-shaped plan moves only the particles wire");
eq(selectPlan.moves[0]?.edge.id, "e2", "C7c the moved wire IS the particles one");
eq(selectPlan.refused.length, 1, "C7d the classAverages wire is refused");
eq(selectPlan.refused[0]?.reason, "port", "C7e the refusal reason is the port guard");

/* ---------------------------------------------------------------- */
console.log(`\nt453 bench: ${pass} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.error(failures.map((f) => `  FAIL ${f}`).join("\n"));
  process.exit(1);
}

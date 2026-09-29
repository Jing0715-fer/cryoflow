/**
 * t456 bench — the resolution arc: one refinement vs its OWN estimates.
 *
 * Pure-brain assertions only (the face is React; the brain is laws):
 *   RA1 the star read      — data_model_general._rlnCurrentResolution from
 *                            both dialects (half1 gold / plain), missing
 *                            column → null, garbage → null, never throws
 *   RA2 the arc            — sorted by round, deduped (last speaker
 *                            wins), non-positive estimates dropped
 *   RA3 the plateau law    — the last moves all under the threshold →
 *                            "plateaued"; the last move sharpening →
 *                            "still improving"; the last move worsening
 *                            → "still moving"; below three points → null
 *   RA4 the headline       — the arc's own summary + the biggest jump
 *   RA5 the refine3d knob  — the verb's reach: manual dialect carries
 *                            iterations (default 15, ceiling 50);
 *                            auto-refine owns its convergence (no knob)
 */

import { parseStar } from "../src/lib/starfile";
import {
  arcSummary,
  arcVerdict,
  biggestJump,
  parseCurrentResolution,
  PLATEAU_ANGSTROM,
  resolutionArcOf,
  type ResolutionPoint,
} from "../src/lib/resolution-arc";
import { ceilingFor, continuePlanOf, iterKnobOf } from "../src/lib/convergence-continue";

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
/* RA1 — the star read: the model star's own estimate.               */
/* ---------------------------------------------------------------- */
console.log("RA1 — parse current resolution");
const GOLD_HALF1 = [
  "data_model_general",
  "",
  "_rlnReferenceImage run_classes.mrcs",
  "_rlnCurrentResolution 4.21",
  "",
  "data_model_half1",
  "",
  "loop_",
  "_rlnResolution #1",
  "_rlnAngstromResolution #2",
  "_rlnGoldStandardFsc #3",
  "",
  "0.050000 20.00 0.9000",
  "0.240000 4.17 0.1420",
].join("\n");
eq(parseCurrentResolution(GOLD_HALF1), 4.21, "RA1a the gold half1 general block");
eq(
  parseCurrentResolution("\ndata_model_general\n\n_rlnReferenceImage run_classes.mrcs\n_rlnCurrentResolution 12.40\n"),
  12.4,
  "RA1b the plain model star",
);
eq(parseCurrentResolution("\ndata_model_general\n\n_rlnReferenceImage run_classes.mrcs\n"), null, "RA1c no column — no estimate");
eq(parseCurrentResolution("_rlnCurrentResolution not-a-number"), null, "RA1d garbage — null, never NaN");
eq(parseCurrentResolution(""), null, "RA1e empty text — null");
ok(parseStar(GOLD_HALF1) !== null, "RA1f the parser survives the full gold shape");

/* ---------------------------------------------------------------- */
/* RA2 — the arc: sorted, deduped, honest.                           */
/* ---------------------------------------------------------------- */
console.log("RA2 — arc assembly");
const raw: ResolutionPoint[] = [
  { iteration: 12, resolution: 5.9, source: "half1" },
  { iteration: 3, resolution: 12.1, source: "half1" },
  { iteration: 12, resolution: 5.8, source: "half1" }, // a rewritten round
  { iteration: 7, resolution: 8.2, source: "model" },
  { iteration: 1, resolution: -4, source: "half1" }, // junk never joins
];
eq(
  resolutionArcOf(raw).map((p) => [p.iteration, p.resolution]),
  [[3, 12.1], [7, 8.2], [12, 5.8]],
  "RA2a sorted by round, last speaker wins, junk dropped entirely",
);
eq(resolutionArcOf([{ iteration: 0, resolution: 0, source: "model" }]), [], "RA2b non-positive estimates are not arc points");
eq(resolutionArcOf([]), [], "RA2c empty in, empty out");

/* ---------------------------------------------------------------- */
/* RA3 — the plateau law: three words, one criterion.                */
/* ---------------------------------------------------------------- */
console.log("RA3 — plateau law");
function pt(iteration: number, resolution: number): ResolutionPoint {
  return { iteration, resolution, source: "half1" };
}
const plateauArc = [pt(0, 28), pt(10, 4.2), pt(12, 4.1), pt(14, 4.05), pt(16, 4.0)];
const pv = arcVerdict(plateauArc);
eq(pv?.word, "plateaued", "RA3a three sub-threshold moves → plateaued");
ok((pv?.detail ?? "").includes("more iterations will not sharpen it"), "RA3b the plateau detail says the honest thing");

const improvingArc = [pt(0, 28), pt(5, 12), pt(10, 6), pt(12, 5.9), pt(14, 5.2)];
eq(arcVerdict(improvingArc)?.word, "still improving", "RA3c the last move sharpened → still improving");

const movingArc = [pt(0, 28), pt(5, 12), pt(10, 6), pt(12, 5.9), pt(14, 6.5)];
eq(arcVerdict(movingArc)?.word, "still moving", "RA3d the last move worsened → still moving (not a lying positive word)");
ok((arcVerdict(movingArc)?.detail ?? "").includes("worsened by 0.6"), "RA3e the worsening detail names the move");

eq(arcVerdict([pt(0, 28), pt(1, 27)]), null, "RA3f two points — no verdict (a guess needs evidence)");
ok(PLATEAU_ANGSTROM === 0.3, "RA3g the house threshold");

/* ---------------------------------------------------------------- */
/* RA4 — the headline + the jump.                                    */
/* ---------------------------------------------------------------- */
console.log("RA4 — summary and jump");
const arc = [pt(0, 28), pt(5, 12.5), pt(10, 6), pt(15, 4.2)];
eq(
  arcSummary(arc),
  "28.0 Å → 4.2 Å over 4 rounds — best 4.2 Å at Round 015",
  "RA4a the arc's own headline",
);
eq(arcSummary([]), null, "RA4b no arc — no headline");
const jump = biggestJump(arc);
eq(
  jump ? [jump.from.iteration, jump.to.iteration, Number(jump.delta.toFixed(1))] : null,
  [0, 5, 15.5],
  "RA4c the biggest jump is the first descent",
);
eq(biggestJump([pt(0, 5)]), null, "RA4d one point — no jump");

/* ---------------------------------------------------------------- */
/* RA5 — the refine3d knob: the verb's reach.                        */
/* ---------------------------------------------------------------- */
console.log("RA5 — refine3d knob");
eq(
  iterKnobOf("refine3d", {}),
  { key: "iterations", current: 15, vdam: false },
  "RA5a the manual dialect — iterations, default 15",
);
eq(iterKnobOf("refine3d", { iterations: 20 }), { key: "iterations", current: 20, vdam: false }, "RA5b a moved knob reads");
eq(iterKnobOf("refine3d", { autoRefine: "true" }), null, "RA5c auto-refine owns its convergence — no knob");
eq(ceilingFor("refine3d", false), 50, "RA5d the form's own ceiling 50");
const plan = continuePlanOf({
  type: "refine3d",
  params: { iterations: 15 },
  checkpoint: { path: "/w/refine3d_aaa1/run_it015_optimiser.star", iteration: 15, archived: false },
  more: 5,
});
eq(plan?.totalIter, 20, "RA5e 15 + 5 → 20 (the RELION total)");
eq(plan?.paramKey, "iterations", "RA5f the curated epochs key");
eq(plan?.clamped, false, "RA5g within the ceiling");

/* ---------------------------------------------------------------- */
console.log(`\nt456 bench: ${pass} passed, ${failures.length} failed`);
if (failures.length > 0) {
  console.error(failures.map((f) => `  FAIL ${f}`).join("\n"));
  process.exit(1);
}

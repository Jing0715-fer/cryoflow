/**
 * t459 bench — the second arc: the fifth question reads the
 * classifications.
 *
 *   A1 (arcPresentationOf): the dialect table — refine3d speaks gold
 *      ("FSC 0.143 estimate", the crossing between random halves); the
 *      classifications speak serial ("the model's own estimate" — no
 *      halves ride a 2D/3D classification, and borrowing the
 *      gold-standard's name would lie about the evidence); every other
 *      type gets null — no model-star family, no door.
 *   A2 (the arc lib on serial fixtures): the plateau law and the
 *      summary were built on refine3d-shaped data; a classification's
 *      arc (26 rounds, mock's own diminishing-returns shape) must read
 *      the same — the law watches MOVES, not job types.
 *   A3 (mixed-source tolerance): a workdir can speak both dialects
 *      (a gold run's join phase writes plain models after half1
 *      models) — the dedupe keeps one point per round, last speaker
 *      wins, sorted by round.
 *   A4 (the stub's serial star, byte-honest): parseCurrentResolution
 *      reads the mock's own model_general_text bytes — the same shape
 *      a real RELION writes (data_model_general._rlnCurrentResolution)
 *      — and a star WITHOUT the column answers null, never zero.
 *
 * World contract: pure functions only — no store, no fetch, no fs.
 */

import {
  arcPresentationOf,
  arcSummary,
  arcVerdict,
  biggestJump,
  parseCurrentResolution,
  resolutionArcOf,
  type ResolutionPoint,
} from "../src/lib/resolution-arc";

let pass = 0;
let fail = 0;
function must(cond: boolean, label: string): void {
  if (cond) {
    pass += 1;
  } else {
    fail += 1;
    console.error(`  FAIL — ${label}`);
  }
}

/* ================= A1 — the dialect table ================= */
console.log("A1 — arcPresentationOf: each type speaks its own name");
{
  const gold = arcPresentationOf("refine3d");
  must(gold !== null && gold.dialect === "gold", "A1a the refinement reads gold");
  must(gold !== null && gold.noun === "refinement", "A1b the door's noun is the refinement's");
  must(gold !== null && gold.estimateLabel === "FSC 0.143 estimate", "A1c the gold axis names the 0.143 crossing");

  for (const t of ["class2d", "class3d"]) {
    const serial = arcPresentationOf(t);
    must(serial !== null && serial.dialect === "serial", `A1d ${t} reads serial`);
    must(serial !== null && serial.noun === "classification", `A1e ${t}'s noun is the classification's`);
    must(
      serial !== null && serial.estimateLabel === "the model's own estimate",
      `A1f ${t}'s axis never borrows the gold-standard's name`
    );
  }

  for (const t of ["import", "extract", "select", "postprocess", "motioncorr", "initialmodel", ""]) {
    must(arcPresentationOf(t) === null, `A1g ${t || "(empty)"} gets no arc door`);
  }
}

/* ================= A2 — the law on serial data ================= */
console.log("A2 — the plateau law reads a classification's arc unchanged");
{
  // the mock's own shape: 3.2 + 24.8·exp(-it/6.5), 26 rounds (it0..it25)
  const arc: ResolutionPoint[] = [];
  for (let it = 0; it <= 25; it++) {
    arc.push({ iteration: it, resolution: 3.2 + 24.8 * Math.exp(-it / 6.5), source: "model" });
  }
  const verdict = arcVerdict(arc);
  must(verdict !== null && verdict.word === "plateaued", "A2a the tail of the mock's own shape is a plateau");
  must(verdict !== null && verdict.detail.includes("more iterations will not sharpen it"), "A2b the plateau says its anti-burn line");

  const improving: ResolutionPoint[] = [
    { iteration: 0, resolution: 28.0, source: "model" },
    { iteration: 1, resolution: 20.0, source: "model" },
    { iteration: 2, resolution: 14.0, source: "model" },
  ];
  const v2 = arcVerdict(improving);
  must(v2 !== null && v2.word === "still improving", "A2c a steep serial tail is still improving");

  const jump = biggestJump(arc);
  must(jump !== null && jump.from.iteration === 0 && jump.to.iteration === 1, "A2d the biggest jump is the first move (exp shape)");

  const summary = arcSummary(arc);
  const lastRes = 3.2 + 24.8 * Math.exp(-25 / 6.5);
  must(
    summary !== null && summary.includes(`28.0 Å → ${lastRes.toFixed(1)} Å over 26 rounds`),
    "A2e the summary speaks the serial arc's own headline (derived from the shape, not the comment)"
  );
}

/* ================= A3 — mixed sources, one arc ================= */
console.log("A3 — resolutionArcOf: both dialects may speak; one point per round");
{
  const mixed: ResolutionPoint[] = [
    { iteration: 12, resolution: 9.9, source: "model" }, // a join-phase plain model
    { iteration: 10, resolution: 12.0, source: "half1" },
    { iteration: 10, resolution: 11.0, source: "model" }, // same round, later speaker
    { iteration: 11, resolution: 10.5, source: "half1" },
  ];
  const arc = resolutionArcOf(mixed);
  must(arc.length === 3, "A3a four points, three rounds — the dedupe holds");
  must(arc[0].iteration === 10 && arc[0].resolution === 11.0 && arc[0].source === "model", "A3b the last speaker wins on the duplicated round");
  must(arc.map((p) => p.iteration).join(",") === "10,11,12", "A3c the arc is sorted by round");
}

/* ================= A4 — the stub's serial star, byte-honest ================= */
console.log("A4 — parseCurrentResolution: the serial model star speaks");
{
  // byte-shaped after the mock's model_general_text (t456 fidelity):
  // general block WITHOUT the FSC loop (the continue branch's plain model)
  const serialStar =
    "\ndata_model_general\n\n_rlnReferenceImage run_classes.mrcs\n_rlnCurrentResolution 7.11\n";
  must(parseCurrentResolution(serialStar) === 7.11, "A4a the serial general block's estimate parses");

  const withLoop =
    "\ndata_model_general\n\n_rlnReferenceImage run_classes.mrcs\n_rlnCurrentResolution 28.00\n" +
    "\ndata_model_half1\n\nloop_\n_rlnResolution #1\n_rlnAngstromResolution #2\n_rlnGoldStandardFsc #3\n" +
    "0.006000 166.67 0.9900\n";
  must(parseCurrentResolution(withLoop) === 28.0, "A4b the estimate rides even when a later loop block follows");

  const noColumn = "\ndata_model_general\n\n_rlnReferenceImage run_classes.mrcs\n";
  must(parseCurrentResolution(noColumn) === null, "A4c a star without the column answers null (an old stub's round never joins)");

  must(parseCurrentResolution("not a star at all") === null, "A4d garbage answers null, never throws");
}

/* ================= verdict ================= */
console.log(`\nt459 classification-arc bench: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

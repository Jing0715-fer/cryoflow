/**
 * t440 bench — the Motion A/B and the generalized core.
 *
 *   M1 (MOTION_LENSES): three lenses, one direction — less motion is
 *      better; the accessors pick total/early/late off the row.
 *   M2 (the domain's signature story): B can win the TOTAL headline
 *      while quietly losing the LATE half — the two lenses must be free
 *      to disagree, because the late half is what the picker inherits.
 *   M3 (the core serves both domains): joinByName + verdict + movers
 *      over motion rows — same laws, different ore (px units, ↓ better).
 *   M4 (CTF spec untouched): the slimmed ctf-compare still answers with
 *      its own directions — the generalization moved nothing.
 *
 * World contract: pure functions only — no store, no fetch, no fs.
 */

import { CTF_LENSES, type CtfRunRow } from "../src/lib/ctf-compare";
import { MOTION_LENSES, type MotionRunRow } from "../src/lib/motion-compare";
import {
  joinByName,
  pairedDeltas,
  topMovers,
  verdict,
} from "../src/lib/paired-compare";

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

let seq = 0;
function mrow(name: string, total: number, early: number, late: number): MotionRunRow {
  seq += 1;
  return { name, total, early, late };
}

/* ================= M1 — the motion lenses ================= */
console.log("M1 — MOTION_LENSES: one direction, three questions");
{
  must(MOTION_LENSES.total.value(mrow("m", 3.2, 1.1, 2.1)) === 3.2, "M1a total accessor");
  must(MOTION_LENSES.early.value(mrow("m", 3.2, 1.1, 2.1)) === 1.1, "M1b early accessor");
  must(MOTION_LENSES.late.value(mrow("m", 3.2, 1.1, 2.1)) === 2.1, "M1c late accessor");
  must(
    !MOTION_LENSES.total.higherIsBetter &&
      !MOTION_LENSES.early.higherIsBetter &&
      !MOTION_LENSES.late.higherIsBetter,
    "M1d all three: less is better",
  );
  must(MOTION_LENSES.total.unit === " px" && MOTION_LENSES.total.digits === 2, "M1e px dialect");
}

/* ================= M2 — the signature divergence ================= */
console.log("M2 — B wins the headline, loses the late half");
{
  const A = [mrow("mic_001", 4.0, 1.0, 3.0)];
  const B = [mrow("mic_001", 3.0, 1.4, 1.6)];
  const join = joinByName(A, B);
  const total = pairedDeltas(join.pairs, MOTION_LENSES.total);
  const late = pairedDeltas(join.pairs, MOTION_LENSES.late);
  must(total[0].kind === "improved" && Math.abs(total[0].delta - (-1.0)) < 1e-9, "M2a total 4.0→3.0 improved");
  must(late[0].kind === "improved", "M2b late 3.0→1.6 also improved — no divergence here yet");
  // correction: 3.0 → 1.6 is LOWER, so under lower-is-better it is an
  // improvement. The real divergence story needs B's LATE to RISE:
  const B2 = [mrow("mic_001", 3.0, 1.4, 3.4)];
  const join2 = joinByName(A, B2);
  const total2 = pairedDeltas(join2.pairs, MOTION_LENSES.total);
  const late2 = pairedDeltas(join2.pairs, MOTION_LENSES.late);
  must(total2[0].kind === "improved", "M2c total improved (4.0→3.0)");
  must(late2[0].kind === "regressed", "M2d late regressed (3.0→3.4) — the lenses disagree, honestly");
}

/* ================= M3 — the core serves motion rows ================= */
console.log("M3 — core over motion rows: laws unchanged");
{
  const A = [mrow("a", 4.0, 1.0, 3.0), mrow("b", 5.0, 2.0, 3.0), mrow("c", 4.5, 1.5, 3.0)];
  const B = [mrow("a", 3.0, 1.0, 2.0), mrow("b", 6.0, 2.0, 4.0), mrow("d", 4.0, 1.0, 3.0)];
  const join = joinByName(A, B);
  must(join.pairs.length === 2 && join.onlyA[0] === "c" && join.onlyB[0] === "d", "M3a paired or silent");
  const deltas = pairedDeltas(join.pairs, MOTION_LENSES.total);
  const v = verdict(deltas);
  must(v.improved === 1 && v.regressed === 1, "M3b census by kind");
  must(Math.abs(v.medianDelta - 0) < 1e-9, "M3c median of (−1.0, +1.0) = 0 — the honest nothing");
  const movers = topMovers(deltas);
  must(movers.improvers[0].name === "a" && movers.regressors[0].name === "b", "M3d movers named per kind");
}

/* ================= M4 — the CTF spec still speaks CTF ================= */
console.log("M4 — CTF lenses untouched by the generalization");
{
  const ctfRow: CtfRunRow = {
    name: "mic_001",
    defocusU: 2.0,
    defocusV: 2.1,
    astigmatism: 0.20,
    fom: 0.40,
    maxResolution: 6.0,
  };
  must(CTF_LENSES.fom.higherIsBetter === true, "M4a FOM still higher-better");
  must(CTF_LENSES.maxres.higherIsBetter === false, "M4b fit limit still lower-better");
  must(CTF_LENSES.astig.value(ctfRow) === 0.20, "M4c astig accessor intact");
  // the two domains' specs are structurally independent — a motion row
  // is not a CTF row, and the lens types keep them apart at compile time
  must(MOTION_LENSES.total.label !== CTF_LENSES.fom.label, "M4d lenses speak their own names");
}

/* ---------------- verdict ---------------- */
console.log(`\nt440 motion-compare bench: ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

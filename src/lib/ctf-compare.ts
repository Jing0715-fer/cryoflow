/**
 * CryoFlow — the CTF domain's compare lenses (t439, slimmed t440).
 *
 * The verdict engine moved to lib/paired-compare.ts (t440's
 * generalization — MotionCorr asks the same question with different
 * numbers). What lives here is only what is genuinely CTF: the row
 * shape the ctf route speaks, the three quality lenses with their
 * directions, and the defocus agreement line.
 *
 * The lens directions, restated once:
 *   FOM            higher is better — the ctffind figure of merit (0–1)
 *   Fit limit (Å)  LOWER is better — the number shrinks as fits reach
 *                  further
 *   Astigmatism    lower is better — |U − V| in µm
 *
 * Defocus is NOT a verdict lens: it is the micrograph's physics, not
 * the fit's quality. It appears only as an agreement line (how closely
 * the two runs measured the same micrograph) — a big disagreement
 * indicts the pairing, not the parameters.
 */

import { median, type LensSpec } from "./paired-compare";

/** The subset of the ctf route's per-micrograph row the compare reads.
 *  Structurally a superset-compatible slice of CtfMicrograph — the
 *  dialog feeds route rows straight in. */
export interface CtfRunRow {
  name: string;
  defocusU: number;
  defocusV: number;
  astigmatism: number;
  fom: number;
  maxResolution: number;
}

export type CtfLens = "fom" | "maxres" | "astig";

export const CTF_LENSES: Record<CtfLens, LensSpec<CtfRunRow>> = {
  fom: {
    key: "fom",
    label: "FOM",
    unit: "",
    higherIsBetter: true,
    digits: 3,
    value: (r) => r.fom,
  },
  maxres: {
    key: "maxres",
    label: "Fit limit",
    unit: " Å",
    // Å shrink as fits reach further — the lower, the better
    higherIsBetter: false,
    digits: 2,
    value: (r) => r.maxResolution,
  },
  astig: {
    key: "astig",
    label: "Astigmatism",
    unit: " µm",
    higherIsBetter: false,
    digits: 3,
    value: (r) => r.astigmatism,
  },
};

/** The agreement line: median |Δ defocus| across pairs (µm). Two runs
 *  estimating the same micrograph should MEASURE the same box — a big
 *  disagreement indicts the pairing (or the physics), not the params. */
export function defocusAgreement(
  pairs: { a: CtfRunRow; b: CtfRunRow }[],
): number {
  if (pairs.length === 0) return NaN;
  const deltas = pairs.map(({ a, b }) =>
    Math.abs((a.defocusU + a.defocusV) / 2 - (b.defocusU + b.defocusV) / 2),
  );
  return median(deltas);
}

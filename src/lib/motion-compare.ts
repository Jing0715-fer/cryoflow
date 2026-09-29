/**
 * CryoFlow — the MotionCorr domain's compare lenses (t440).
 *
 * The A/B question's second domain: "I changed a MotionCorr parameter
 * (b-factor, dose grouping, stagger) — did the ALIGNMENTS actually get
 * steadier?" The motion route speaks one row per micrograph: total
 * accumulated motion with its early/late split, in ÅNGSTRÖM (RELION
 * 3.1+ writes _rlnAccumMotionTotal in Å — t469 fixed the lenses that
 * used to say " px" while the rows carried Å). All three
 * speak one direction — LESS motion is better — but each answers a
 * different question:
 *
 *   Total  the whole-run steadiness — the headline
 *   Early  the first frames (dose-weighting noise lives here)
 *   Late   the last frames (drift creep shows here) — a run can win on
 *          total while quietly losing the late half, and the late half
 *          is what the picker inherits
 *
 * The verdict engine is lib/paired-compare.ts (shared with the CTF
 * domain); this module only owns the row shape and the lens directions.
 */

import type { LensSpec } from "./paired-compare";

/** The subset of the motion route's per-micrograph row the compare
 *  reads — structurally compatible with MotionMicrograph. */
export interface MotionRunRow {
  name: string;
  /** total accumulated motion, Å */
  total: number;
  /** early-frames motion, Å */
  early: number;
  /** late-frames motion, Å */
  late: number;
}

export type MotionLens = "total" | "early" | "late";

export const MOTION_LENSES: Record<MotionLens, LensSpec<MotionRunRow>> = {
  total: {
    key: "total",
    label: "Total drift",
    unit: " Å",
    higherIsBetter: false,
    digits: 2,
    value: (r) => r.total,
  },
  early: {
    key: "early",
    label: "Early drift",
    unit: " Å",
    higherIsBetter: false,
    digits: 2,
    value: (r) => r.early,
  },
  late: {
    key: "late",
    label: "Late drift",
    unit: " Å",
    higherIsBetter: false,
    digits: 2,
    value: (r) => r.late,
  },
};

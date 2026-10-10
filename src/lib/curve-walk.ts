/**
 * CryoFlow — the curve walk's shared probe map (t503).
 *
 * The session report's curve-verdicts walk picked these probes for its
 * own paper (t490); the agent's verdicts read (get_curve_verdicts, t503)
 * walks the SAME roster with the SAME probe map, so a verdict question
 * answered by the model can never disagree with the paper's table about
 * who was asked. Constants with two consumers live in ONE place (twins
 * fork, imports don't) — and this place must stay IMPORT-FREE at
 * runtime (the report dialog is a client component; a constant lib that
 * drags in node fs would break the browser bundle). The CurveKind import
 * is type-only — types erase before any bundle is built. Server
 * consumers who need the actual curve DATA drink from lib/chart-data.ts
 * (t486's one well: the routes and the agent's get_job_curves already
 * share it).
 */

import type { CurveKind } from "@/lib/qc-report";

/**
 * Which curve kinds each job TYPE is probed for — the paper's own
 * budget's own map: a PostProcess writes the FSC + Guinier pair, a 3D
 * run (refine/class3d/class2d/initialmodel/multibody) may carry an FSC
 * (model star — t486 proved a 2D class can) and the angular distribution
 * of its data star, CtfFind speaks CTF fits, MotionCorr speaks drift,
 * a picker-training job speaks topaz epochs. The ROUTE is the honest
 * second gate: a probe whose workdir holds no such curve answers an
 * empty body and is skipped — the map only decides where to ASK, never
 * what to SAY. Types outside the map never spend a probe.
 */
export const CURVE_PROBES_BY_TYPE: [RegExp, CurveKind[]][] = [
  [/postprocess/, ["fsc", "guinier"]],
  [/refine3d|class3d|class2d|initialmodel|multibody/, ["fsc", "angdist"]],
  [/ctffind/, ["ctf"]],
  [/motioncorr/, ["motion"]],
  [/topaz/, ["topaz"]],
];

/** The kinds one job type is probed for — the walk's own lookup, born
 *  here so the dialog's probe loop and the agent's walk read the same
 *  line. A type outside the map probes nothing (an empty list is the
 *  honest answer, never a guess). */
export const probesForType = (type: string): CurveKind[] =>
  CURVE_PROBES_BY_TYPE.find(([re]) => re.test(type))?.[1] ?? [];

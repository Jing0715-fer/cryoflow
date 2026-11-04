/**
 * The TARGET FACT's one home — the published mark and the distance
 * verdict (t1087).
 *
 * The KPI band's verdict pill has carried the mark since t1052; its
 * arithmetic lived inline (the TARGET_ANGSTROM const, the distance
 * computed once per title tail, the met comparison a third time). The
 * well hoists ONE verdict (the met bit and the distance from a single
 * subtraction) and hands every mouth its words from here: the pill's
 * glance dialects (the title's tail, the face's labels) and the agent's
 * ear (get_job_curves' fsc read) drink the same arithmetic — a question
 * asked of the eye and of the ear can never disagree. The cryo-EM
 * worker's own question ("how far to the paper's mark?") now has one
 * answerer.
 *
 * The mouths' dialects: the eye's title says "inside/above the bar"
 * (the FSC chart's own mark is a bar on the plot); the ear's clause
 * NAMES the mark (a spoken line has no chart to point at). One
 * arithmetic, one passport, two dialects.
 */

/** EMPIAR-10017 / EMD-2824 published resolution — the target line. */
export const TARGET_ANGSTROM = 4.2;

/** the published passport — the provenance every mouth quotes verbatim */
export const TARGET_PASSPORT = "EMPIAR-10017 published: 4.2 Å (EMD-2824)";

export interface TargetVerdict {
  /** the map reached the published mark */
  met: boolean;
  /** |resolution − mark| — the mouths render it at two decimals */
  distance: number;
}

/** the ONE arithmetic — a single subtraction feeds every mouth */
export function targetVerdict(resolution: number): TargetVerdict {
  return {
    met: resolution <= TARGET_ANGSTROM,
    distance: Math.abs(resolution - TARGET_ANGSTROM),
  };
}

/** the pill's title tail — the glance dialect's own sentence (t1052's
 *  words, now spoken from the one home) */
export function targetTitleTail(v: TargetVerdict): string {
  return v.met
    ? `${v.distance.toFixed(2)} Å inside the bar`
    : `${v.distance.toFixed(2)} Å above the bar — push the refinement and the medal turns gold`;
}

/** the ear's clause — the agent's fsc read appends it (the mark NAMED:
 *  "the bar" is the chart's own dialect, a spoken line has no chart) */
export function targetEarClause(v: TargetVerdict): string {
  return `${v.distance.toFixed(2)} Å ${v.met ? "inside" : "above"} the EMPIAR-10017 published mark (${TARGET_ANGSTROM} Å, EMD-2824)`;
}

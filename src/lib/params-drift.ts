/**
 * CryoFlow — recipe drift (t445): the self-edit half of "is this result
 * current?".
 *
 * The wavefront (t444) answers the UPSTREAM half: an upstream re-ran, so
 * this result predates the input it was built on. But there is a second,
 * quieter way a completed result falls behind: the user edits THIS job's
 * own params and never re-runs. The status still says "completed", the
 * wavefront is silent (nothing upstream moved — startedAt's law only
 * hears runs), and the canvas shows a finished card whose recipe no
 * longer matches its result. t444's honesty note named this exactly:
 * 「上游改参未跑」场景时间律不覆盖——那是 params-diff 面的辖区.
 *
 * THE SNAPSHOT LAW: the engine writes ranParams — the params JSON AS THEY
 * WERE AT DISPATCH — in the same db.job.update that writes startedAt
 * (dispatch.ts's local lane, remote-run.ts's cluster lane; both faces of
 * a real dispatch commit there). Only a real run refreshes the evidence,
 * mirroring t444's startedAt discipline: edits must never pollute the
 * proof. A null ranParams is NO EVIDENCE — the job has not run since the
 * snapshot law landed, and a null verdict is an honest verdict (the demo
 * world and every pre-t445 result stay badge-free, zero visual
 * regression).
 *
 * THE VERDICT LAW: a job is drifted exactly when it is COMPLETED, its
 * ranParams is non-null, and the current params differ from the snapshot.
 * failed jobs stay silent — their status already says "re-run me";
 * running/pending are mid-churn (the dispatch snapshot was just taken —
 * a verdict there would fire against the run in progress); idle has no
 * result to answer for. Re-run → the snapshot refreshes → the badge
 * clears. Reset → the route nulls the snapshot with the result (evidence
 * hygiene — the run it describes no longer exists).
 *
 * ADOPTION FITS FOR FREE: adoption re-wires upstreams but never touches
 * this job's own params — no drift is invented, and none is owed.
 *
 * Pure brain: no React, no store, no fetch — the same law as
 * staleness.ts (t444).
 */

/** The slice the law needs — JobDTO satisfies this. */
export interface DriftJobLike {
  id: string;
  status: string;
  /** the CURRENT recipe (parsed params object) */
  params: Record<string, unknown>;
  /** the recipe AT DISPATCH (parsed ranParams object; null/undefined =
   *  no evidence — the JobDTO field is optional, both absences mean the
   *  same honest nothing) */
  ranParams?: Record<string, unknown> | null;
}

/** One job's drift: WHICH settings moved (sorted — a stable sentence). */
export interface DriftInfo {
  /** keys present in the current params or the snapshot whose value
   *  differs (added/removed keys count — the recipe changed), sorted */
  changedKeys: string[];
}

export type DriftReport = Map<string, DriftInfo>;

/**
 * Order-insensitive equality for params maps. Key order must never
 * matter (the PATCH merge rebuilds objects; JSON round-trips do not
 * promise order). Values compare STRICTLY — ParamValue is a flat scalar
 * union, so 1 and "1" are different recipes, not formatting variants of
 * one. Objects/arrays inside (defensive: the schema is flat today)
 * compare recursively with the same rules; two missing keys are equal
 * (absence is a value here — {a:1} and {a:1,b:undefined-ish-absent} are
 * the same recipe because the merge pipeline never stores absent keys).
 */
export function paramsEqual(
  a: Record<string, unknown>,
  b: Record<string, unknown>
): boolean {
  const aKeys = Object.keys(a).filter((k) => a[k] !== undefined);
  const bKeys = Object.keys(b).filter((k) => b[k] !== undefined);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    const va = a[k];
    const vb = b[k];
    if (va === vb) continue;
    // NaN never occurs in JSON; number === number is exact (1 and 1.0
    // are the same number). Different TYPES are different recipes.
    if (
      va !== null &&
      vb !== null &&
      typeof va === "object" &&
      typeof vb === "object" &&
      !Array.isArray(va) === !Array.isArray(vb)
    ) {
      if (
        !paramsEqual(
          va as Record<string, unknown>,
          vb as Record<string, unknown>
        )
      )
        return false;
      continue;
    }
    if (Array.isArray(va) && Array.isArray(vb)) {
      if (va.length !== vb.length) return false;
      for (let i = 0; i < va.length; i++) {
        const ea = va[i];
        const eb = vb[i];
        if (
          ea === eb ||
          (ea !== null &&
            eb !== null &&
            typeof ea === "object" &&
            typeof eb === "object" &&
            paramsEqual(
              ea as Record<string, unknown>,
              eb as Record<string, unknown>
            ))
        )
          continue;
        return false;
      }
      continue;
    }
    return false;
  }
  return true;
}

/**
 * The drift verdict, one job at a time (the shared brain the report
 * builder and the bench both call): completed + evidence + a differing
 * recipe. null ranParams → null verdict (no evidence is no verdict).
 */
export function driftFor(job: DriftJobLike): DriftInfo | null {
  if (job.status !== "completed") return null;
  const snapshot = job.ranParams;
  if (snapshot == null) return null;
  if (paramsEqual(job.params, snapshot)) return null;
  const changedKeys: string[] = [];
  const keys = new Set([
    ...Object.keys(job.params).filter((k) => job.params[k] !== undefined),
    ...Object.keys(snapshot).filter((k) => snapshot[k] !== undefined),
  ]);
  for (const k of keys) {
    const inBoth =
      Object.prototype.hasOwnProperty.call(job.params, k) &&
      Object.prototype.hasOwnProperty.call(snapshot, k);
    if (!inBoth) {
      changedKeys.push(k);
      continue;
    }
    const one: Record<string, unknown> = { [k]: job.params[k] };
    const two: Record<string, unknown> = { [k]: snapshot[k] };
    if (!paramsEqual(one, two)) changedKeys.push(k);
  }
  if (changedKeys.length === 0) return null; // unreachable via paramsEqual, but the guard keeps the law local
  return { changedKeys: changedKeys.sort() };
}

/** The whole-project verdict: one drift entry per drifted job. */
export function findDriftedJobs(jobs: DriftJobLike[]): DriftReport {
  const report: DriftReport = new Map();
  for (const job of jobs) {
    const info = driftFor(job);
    if (info) report.set(job.id, info);
  }
  return report;
}

/**
 * The spoken form. ONE sentence that is true in every scenario the law
 * fires on: the result was produced with a recipe that no longer matches
 * the current settings (the user edited after the run). It never claims
 * the settings are BETTER — it claims they are DIFFERENT, which is the
 * only thing the evidence can say.
 */
export function describeDrift(info: DriftInfo): {
  short: string;
  long: string;
  keys: string;
} {
  const n = info.changedKeys.length;
  const keys =
    n === 0 ? "" : info.changedKeys.join(", ");
  return {
    short: "Recipe changed since this run",
    long: `This result was cooked with a different recipe — ${n} ${
      n === 1 ? "setting" : "settings"
    } changed since. Re-run to apply the current settings.`,
    keys,
  };
}

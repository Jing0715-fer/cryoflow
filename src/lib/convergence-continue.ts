/**
 * CryoFlow — the convergence verdict's continue verb (t455).
 *
 * t454 delivered the convergence reading and ended it with an honest
 * verbless footer: "convergence is a reading, not a mutation — continue
 * with more iterations is not this app's verb yet." The scouting that
 * followed found the verb's machinery had been in place all along:
 * t394's continue-sources (self/upstream rounds, the completeness law,
 * the `newest` suggestion flag), t397's explicit fn_cont override, t402's
 * continue argv diet. What was missing was ONE button on the verdict face
 * that wires the reading to the machinery. This module is that button's
 * brain — pure, bench-first, and a precise MIRROR of the engine's own
 * continue law (engine.ts):
 *
 *   - THE ARC'S HEAD IS THE CHECKPOINT: a continue continues the run's
 *     own arc from its newest COMPLETE round (the API's `newest` flag —
 *     the same suggestion the panel picker offers). The dialog's selected
 *     A/B pair is a READING choice, never a continue target: continuing
 *     from an older round would silently discard the rounds after it.
 *   - `--iter` IS THE TOTAL (RELION's own restart semantics, the option
 *     table's help verbatim): "if 10 iterations have been performed
 *     previously and one restarts to perform an additional 5, the number
 *     given here should be 10+5=15." The verb writes current + more.
 *   - THE MIRROR IS EXACT: class2d's algorithm dialect (the t386 select
 *     vs the raw do_em/do_grad pair — `algorithm === "vdam" || (algorithm
 *     !== "em" && doGrad && !doEm)`, engine's exact predicate) decides
 *     which knob carries --iter; VDAM counts mini-batches (default 200),
 *     EM counts epochs (default 25); class3d counts epochs (default 25).
 *     The verb WRITES the curated key (the engine's FIRST read — the
 *     write wins over any RELION-twin row), because the PATCH route
 *     silently drops keys outside the spec's params, and the aliased
 *     twins (nr_iter_em / nr_iter_grad / nr_iter) are not in it.
 *   - THE CEILING IS THE FORM'S OWN: the curated specs cap the knobs
 *     (class2d EM 50, class2d VDAM 500, class3d 100). The verb clamps the
 *     total there and SAYS SO — a clamped plan is an honest plan, not a
 *     surprise.
 *   - NO CHECKPOINT, NO VERB: when the run's directory holds no complete
 *     optimiser family (or the scan itself failed), the verb stays
 *     absent and the face says WHY — the t454 honesty law, kept.
 *
 * This file is PURE (no React, no node imports): the convergence dialog
 * is a client component and continue-sources.ts speaks node:fs — so the
 * source shapes are mirrored here structurally, never imported.
 */

/* ------------------------------------------------------------------ */
/* The checkpoint — the arc's head, chosen the way the picker chooses  */
/* ------------------------------------------------------------------ */

/** Structural mirror of continue-sources' ContinueRoundEntry (client
 *  cannot import the server module — the shape, not the file, is law). */
export interface ContinueEntryLite {
  iteration: number;
  /** run_itNNN_optimiser.star — the absolute --continue target. */
  path: string;
  complete: boolean;
  /** The source's own suggestion: the newest COMPLETE round. */
  newest: boolean;
}

/** Structural mirror of ContinueSource (relation/lane honesty only). */
export interface ContinueSourceLite {
  relation: "self" | "upstream";
  /** t395 — a .cryoflow_prev generation: still a legal target, but the
   *  LIVE tree outranks it when both exist. */
  archived?: boolean;
  /** t396 — found through the derived workdir (run record cleared). */
  derived?: boolean;
  /** The scan itself failed — the verb must say why, not pretend. */
  error?: string;
  entries: ContinueEntryLite[];
}

export interface ContinueCheckpoint {
  path: string;
  iteration: number;
  /** TRUE when the checkpoint came from an archived generation (the
   *  live tree held no complete round) — the verb's caption says so. */
  archived: boolean;
}

/**
 * The continue checkpoint: the newest complete round of THIS run's own
 * arc. Self sources only (upstream optimisers are the panel picker's
 * world — the verdict continues its own run), live over archived
 * (t395's honesty keeps archived legal, but the arc's live head is the
 * natural continue point), entries newest-first (the analyzer's own
 * order). `newest` is trusted but verified: the first complete entry in
 * the list wins even if a future API drifts the flag.
 */
export function checkpointOf(
  sources: readonly ContinueSourceLite[] | undefined,
): ContinueCheckpoint | null {
  if (!sources || sources.length === 0) return null;
  const self = sources.filter((s) => s.relation === "self" && !s.error);
  const live = self.filter((s) => !s.archived);
  for (const tier of [live, self]) {
    for (const s of tier) {
      const hit = s.entries.find((e) => e.complete);
      if (hit) {
        return { path: hit.path, iteration: hit.iteration, archived: s.archived === true };
      }
    }
  }
  return null;
}

/** The self scan's failure line, when the arc exists but cannot be
 *  read (the degraded row's honest why). Null = the scan simply found
 *  no self source at all. */
export function selfScanErrorOf(
  sources: readonly ContinueSourceLite[] | undefined,
): string | null {
  if (!sources) return null;
  const withError = sources.find((s) => s.relation === "self" && s.error);
  return withError?.error ?? null;
}

/* ------------------------------------------------------------------ */
/* The --iter knob — the engine's own law, mirrored exactly            */
/* ------------------------------------------------------------------ */

export type IterClass = "class2d" | "class3d";

export interface IterKnob {
  /** The key the verb WRITES (always the curated key — the PATCH allow
   *  list and the engine's first read agree on it). */
  key: string;
  /** The knob's current value under the engine's own read chain. */
  current: number;
  /** class2d only — VDAM counts mini-batches, EM counts epochs. */
  vdam: boolean;
}

function boolParam(params: Record<string, unknown>, key: string): boolean {
  return String(params[key] ?? "false") === "true";
}

function numParam(params: Record<string, unknown>, key: string, fallback: number): number {
  const v = params[key];
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

/** The engine's class2d VDAM predicate (engine.ts, verbatim mirror):
 *  the t386 select speaks first; a row with only the raw do_em/do_grad
 *  pair (template imports, API-set rows) falls to the pair. Rows that
 *  predate the t374 merge carry neither — the curated historical
 *  default (EM) keeps them. */
export function class2dUsesVdam(params: Record<string, unknown>): boolean {
  const algorithm = typeof params.algorithm === "string" ? params.algorithm : "";
  if (algorithm === "vdam") return true;
  const doEm = boolParam(params, "do_em");
  const doGrad = boolParam(params, "do_grad");
  return algorithm !== "em" && doGrad && !doEm;
}

/**
 * Which knob carries --iter for a completed classification run, and what
 * it currently says. Null on a type the verdict never reads (the door
 * already gates class2d/class3d — this is the belt to its braces).
 *
 * t456 — refine3d joins: RELION's auto-refine owns its own convergence
 * (no --iter rides the argv, a written value would be dead) so an
 * auto-refine row has NO knob — the verb stays absent for it. The manual
 * dialect (`--iter` from the curated `iterations`, default 15) is the
 * verb's to extend.
 */
export function iterKnobOf(
  type: string,
  params: Record<string, unknown>,
): IterKnob | null {
  if (type === "class2d") {
    if (class2dUsesVdam(params)) {
      // engine: num(job, "miniBatches", num(job, "nr_iter_grad", 200))
      const current = numParam(params, "miniBatches", numParam(params, "nr_iter_grad", 200));
      return { key: "miniBatches", current, vdam: true };
    }
    // engine: num(job, "iterations", 25)
    return { key: "iterations", current: numParam(params, "iterations", 25), vdam: false };
  }
  if (type === "class3d") {
    // engine: num(job, "iterations", 25)
    return { key: "iterations", current: numParam(params, "iterations", 25), vdam: false };
  }
  if (type === "refine3d") {
    // engine flagAutoRefine: String(params.autoRefine ?? "false") === "true"
    if (String(params.autoRefine ?? "false") === "true") return null;
    // engine (manual dialect): --iter from num(job, "iterations", 15)
    return { key: "iterations", current: numParam(params, "iterations", 15), vdam: false };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* The totals — RELION's restart arithmetic, clamped to the form       */
/* ------------------------------------------------------------------ */

/** RELION's restart law: --iter is the TOTAL. "if 10 iterations have
 *  been performed previously and one restarts to perform an additional
 *  5 … the number given here should be 10+5=15" (the option table's
 *  help, verbatim). */
export function totalIterationsOf(current: number, more: number): number {
  return current + more;
}

/**
 * The curated form's own ceiling for the knob (workflow.ts spec, the
 * number the form's stepper respects): class2d EM 50, class2d VDAM 500,
 * class3d 100, refine3d 50. Unknown shapes clamp nowhere (Infinity) — the
 * verb would rather run unclamped than invent a limit the spec does not
 * carry.
 */
export function ceilingFor(type: string, vdam: boolean): number {
  if (type === "class2d") return vdam ? 500 : 50;
  if (type === "class3d") return 100;
  if (type === "refine3d") return 50;
  return Number.POSITIVE_INFINITY;
}

/* ------------------------------------------------------------------ */
/* The stepper — the verb's +N choices                                 */
/* ------------------------------------------------------------------ */

/** EM epochs are hours each; VDAM mini-batches are minutes. The chips
 *  speak the two domains' own scales — one law, two vocabularies. */
export const MORE_OPTIONS_EM: readonly number[] = [5, 10, 25];
export const MORE_OPTIONS_VDAM: readonly number[] = [50, 100, 200];

export function moreOptionsFor(vdam: boolean): readonly number[] {
  return vdam ? MORE_OPTIONS_VDAM : MORE_OPTIONS_EM;
}

/* ------------------------------------------------------------------ */
/* The plan — everything the fire button needs, nothing it doesn't     */
/* ------------------------------------------------------------------ */

export interface ContinuePlan {
  /** The fn_cont write (the --continue target). */
  fnCont: string;
  /** The --iter knob's write key (curated). */
  paramKey: string;
  /** The --iter write value: current + more, clamped to the ceiling. */
  totalIter: number;
  /** TRUE when the ceiling bit the request — the button's caption says
   *  "reaching the form's ceiling" instead of pretending +N rode whole. */
  clamped: boolean;
  /** The checkpoint the run resumes from (for the row's face). */
  checkpoint: ContinueCheckpoint;
}

/**
 * Assemble the continue plan: checkpoint + knob + RELION's total law +
 * the form's ceiling. Null `more` (no chip chosen) assembles with the
 * FIRST chip — the verb never makes the user pick twice. Null on an
 * impossible combination (no knob, no checkpoint) — the caller shows
 * the degraded face instead.
 */
export function continuePlanOf(args: {
  type: string;
  params: Record<string, unknown>;
  checkpoint: ContinueCheckpoint;
  more: number;
}): ContinuePlan | null {
  const knob = iterKnobOf(args.type, args.params);
  if (!knob) return null;
  const ceiling = ceilingFor(args.type, knob.vdam);
  const raw = totalIterationsOf(knob.current, args.more);
  const totalIter = Math.min(raw, ceiling);
  return {
    fnCont: args.checkpoint.path,
    paramKey: knob.key,
    totalIter,
    clamped: totalIter < raw,
    checkpoint: args.checkpoint,
  };
}

/** The param writes the fire button hands saveJob: fn_cont + the knob. */
export function continueParamWrites(plan: ContinuePlan): Record<string, number | string> {
  return { fn_cont: plan.fnCont, [plan.paramKey]: plan.totalIter };
}

/* ------------------------------------------------------------------ */
/* The lane — the verb speaks the job's own world                      */
/* ------------------------------------------------------------------ */

/** Structural mirror of the DTO's RemoteRunInfo ledger (the fields the
 *  fire needs; the full contract's membership test already ran when the
 *  run wrote it — remoteInfoFor refuses incomplete records). */
export interface RunRemoteLedger {
  connectionId: string;
  module?: string | null;
  mode?: string | null;
}

/** The dispatch target the verb fires with, or null for the local lane. */
export interface RemoteTargetLite {
  connectionId: string;
  module: string | null;
  mode: "slurm" | "direct";
}

/**
 * THE VERB SPEAKS THE JOB'S OWN LANE. The fn_cont the verb writes is a
 * path in the coordinate system of the run that WROTE the round (the
 * continue-sources law: a cluster round speaks a cluster path) — a local
 * dispatch could never read a cluster checkpoint, so continuing one
 * locally is not a preference, it is a category error. The DTO's
 * runRemote ledger IS the last dispatch's target: present → the run
 * continues on that cluster (same connection, module, Slurm mode); absent
 * → the bare local lane (project-binding fallback included) is the job's
 * world.
 */
export function continueLaneOf(
  job: { runRemote?: RunRemoteLedger | null } | null | undefined,
): RemoteTargetLite | null {
  const ledger = job?.runRemote;
  if (!ledger || typeof ledger.connectionId !== "string" || ledger.connectionId === "") {
    return null;
  }
  return {
    connectionId: ledger.connectionId,
    module: typeof ledger.module === "string" && ledger.module !== "" ? ledger.module : null,
    mode: ledger.mode === "slurm" ? "slurm" : "direct",
  };
}

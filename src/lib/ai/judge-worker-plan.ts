/**
 * CryoFlow — the judge worker's PLANNER (pure, server-safe, testable bare).
 *
 * t574 — the verdict arrives before you ask. The judge itself has existed
 * since t565 (2D) / t573 (3D) as an on-demand tool: ask the assistant and
 * a two-pass VLM opinion gets stamped onto the job. The worker closes the
 * loop the other way — a finished classification no longer waits for
 * someone to think of asking. This module owns the POLICY half (which
 * completed jobs deserve a judge this tick) as a pure function so the
 * bench can pin every gate without a database, a VLM, or a clock that
 * actually ticks.
 *
 * The shell (judge-worker.ts) owns the fs/db/time half; the split follows
 * the verdict-stamp-core / verdict-stamps doctrine: pure core, thin shell.
 */

/** The classifications the judge can speak about. */
export const JUDGEABLE_TYPES = ["class2d", "class3d"] as const;

export type JudgeableType = (typeof JUDGEABLE_TYPES)[number];

/** Shape the worker feeds the planner — exactly what db.job.findMany returns. */
export interface JudgeScanJob {
  id: string;
  type: string;
  status: string;
  /** Soft-link mirror: read-only by law — its ORIGINAL is the judgeable one. */
  linkedJobId: string | null;
  /** Date from Prisma; ms here because the planner stays JSON-pure. */
  updatedAtMs: number;
}

export interface JudgePlanContext {
  /** Jobs completed since this moment (exclusive) are candidates. */
  watermarkMs: number;
  /** The auto-judge toggle (settings.autoJudge; default true upstream). */
  autoJudge: boolean;
  /** False when no assistant is configured — a judge cannot exist. */
  providerOk: boolean;
  /** Stamp ids already on file — one opinion per job, newest wins. */
  stampedIds: ReadonlySet<string>;
}

/**
 * The politeness ceiling: a judge is a two-pass VLM call measured in tens
 * of seconds. One candidate per tick turns a completion storm into a
 * queue; the backlog drains at one verdict per tick and nothing hammers
 * the provider.
 */
export const MAX_JUDGES_PER_TICK = 1;

/**
 * The worker's tick cadence. Background correctness does not need the
 * sweep's 1.2s — a judge lands within one tick of completion and that is
 * the whole contract. Floor/ceiling mirror the reaper's clamp (t525's
 * encoded lesson: no busy loop, no coma).
 */
export const DEFAULT_JUDGE_TICK_MS = 30_000;

export function clampJudgeTickMs(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_JUDGE_TICK_MS;
  return Math.min(600_000, Math.max(10_000, Math.round(n)));
}

/**
 * The planner: which of these jobs does the worker judge THIS tick?
 *
 * Gates, in order of cheapness:
 *   1. policy dead-lifts — autoJudge off or provider unconfigured → nobody;
 *   2. type — only class2d/class3d (the judge's jurisdiction);
 *   3. status — completed only (the judge reads final outputs);
 *   4. links — a mirror's opinion belongs to its ORIGINAL, and the
 *      stamp route resolves findEffectiveJob anyway: skip mirrors so the
 *      original gets exactly one stamp instead of the pair fighting over
 *      newest-wins;
 *   5. freshness — updatedAt must postdate the watermark. The stamp
 *      existence check below is the per-job memory; the watermark is the
 *      per-ERA memory that keeps a first boot from re-judging the whole
 *      back catalog (and a restart from judging years of history);
 *   6. already-stamped — one opinion per job. A RESET then re-run keeps
 *      its old stamp deliberately: the worker never overwrites a human
 *      or model verdict that someone may have read (the chat judge's
 *      re-ask remains the explicit overwrite path);
 *   7. oldest first — the queue is fair, not LIFO;
 *   8. capped — MAX_JUDGES_PER_TICK, the politeness ceiling.
 *
 * Pure: no clock (the caller supplies the watermark), no fs, no db.
 */
export function planJudgeCandidates(
  jobs: ReadonlyArray<JudgeScanJob>,
  ctx: JudgePlanContext
): JudgeScanJob[] {
  if (!ctx.autoJudge || !ctx.providerOk) return [];
  const fresh = jobs
    .filter((j) => (JUDGEABLE_TYPES as readonly string[]).includes(j.type))
    .filter((j) => j.status === "completed")
    .filter((j) => !j.linkedJobId)
    .filter((j) => j.updatedAtMs > ctx.watermarkMs)
    .filter((j) => !ctx.stampedIds.has(j.id))
    .sort((a, b) => a.updatedAtMs - b.updatedAtMs);
  return fresh.slice(0, MAX_JUDGES_PER_TICK);
}

/**
 * t533 — the GLOBAL reaper: reconcile stops being the active project's
 * privilege.
 *
 * The t532 exam ledger convicted the old law: a remote job's finalize is
 * only OBSERVED when a jobs GET polls its project. The examiner script had
 * to keep polling by hand or the ten-ring chain froze at the finish line —
 * refine3d sat "running" in the DB for hours while the cluster accounting
 * already said COMPLETED, because the active pointer had moved on and
 * nobody was driving the tick. 「驱动 tick 的人才看得见完成」 is a bug, not
 * a doctrine: a headless server (no browser), a hidden tab (15s cadence)
 * or an inactive world must not need a human heartbeat to heal.
 *
 * The reaper is the fix candidate the ledger named: a background timer
 * that, every CRYOFLOW_GLOBAL_RECONCILE_MS (default 15s), sweeps ALL
 * projects' running+pending jobs through the exact same machinery the GET
 * route uses —
 *
 *   1. reconcileRealJobs   — local finalize / progress (ledger-driven),
 *   2. reconcileRemoteJobs — one batched SSH poll per connection (its own
 *      pollState throttle coalesces with GET-driven sweeps, so the reaper
 *      and the route can never storm a login node),
 *   3. the transition leg  — rows this tick flipped to COMPLETED fire
 *      autoStartPendingDownstream (same-tick dispatch for local flips;
 *      remote verdicts land on the next tick's retry leg, the same
 *      next-tick property the GET route has),
 *   4. the pending retry leg (t324's promise, globalized) — every 20s,
 *      pending jobs whose upstreams are completed in the DB re-attempt
 *      dispatch; on boot this doubles as the orphaned-pending recovery
 *      for EVERY world, not just the active one.
 *
 * Mount points (both idempotent via a globalThis singleton, so dev-mode
 * dual module instances still share one interval):
 *   - instrumentation.register(): +8s after boot, dynamic import (the
 *     static graph would delay the listener — the file's own law);
 *   - GET /api/jobs: defensive static mount (route already owns the
 *     heavy graph; covers runtimes where the boot hook didn't fire).
 *
 * The reaper NEVER dies loudly: a tick's failure is swallowed (the next
 * tick re-tries); the interval is unref'd so it cannot hold the process;
 * CRYOFLOW_NO_REAPER=1 is the escape hatch (watchdog's CRYOFLOW_NO_WATCHDOG
 * symmetry). Re-entrancy guard: a slow SSH tick skips the beats it
 * overlaps — the pollState adaptive floors already make the sweep polite.
 */
import { db } from "@/lib/db";
import { reconcileRealJobs, readRuns } from "@/lib/relion/engine";
import { autoStartPendingDownstream } from "@/lib/relion/dispatch";
import { reconcileRemoteJobs } from "@/lib/remote/remote-run";

/** t324 cadence, globalized — pending consumers re-attempt every 20s. */
const PENDING_RETRY_MS = 20_000;

/** Default background beat: 15s (GET live is 1.2s; idle 8s — background
 * correctness does not need the UI's cadence, it needs EXISTENCE). */
const DEFAULT_TICK_MS = 15_000;

/** The t525 window's lesson, encoded: a background timer must never
 * become a busy loop (5s floor — the SSH floors themselves are 2.5-4s)
 * nor a coma (5min ceiling — a stuck operator typo must not silently
 * freeze every world). */
export function clampReconcileMs(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number.parseInt(String(raw ?? ""), 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TICK_MS;
  return Math.min(300_000, Math.max(5_000, Math.round(n)));
}

/**
 * The transition leg's diff: ids whose status moved to "completed" between
 * the tick's BEFORE snapshot and its AFTER reconcile. Both local finalize
 * (reconcileRealJobs) and the remote sweep's orphan heal can complete a
 * row — including a PENDING row (the heal's conditional flip accepts
 * running|pending), so the before-set is running ∪ pending, not just
 * running. Pure — the bench pins it.
 */
export function completedFlips(
  before: ReadonlyArray<{ id: string; status: string }>,
  after: ReadonlyArray<{ id: string; status: string }>
): string[] {
  const wasStuck = new Set(
    before.filter((j) => j.status === "running" || j.status === "pending").map((j) => j.id)
  );
  return after.filter((j) => j.status === "completed" && wasStuck.has(j.id)).map((j) => j.id);
}

/**
 * The retry leg's planner: which COMPLETED upstream ids deserve a
 * autoStartPendingDownstream poke this round. Pure — the bench pins it.
 * Links are excluded upstream of this call (a link never runs itself);
 * the same upstream feeding several pending consumers fires once —
 * autoStartPendingDownstream BFS-walks every downstream branch anyway.
 */
export function planPendingRetries(
  pendingIds: ReadonlyArray<string>,
  edges: ReadonlyArray<{ fromJobId: string; toJobId: string }>,
  completedUpstreamIds: ReadonlySet<string>
): string[] {
  const wanted = new Set(pendingIds);
  const triggers = new Set<string>();
  for (const e of edges) {
    if (!wanted.has(e.toJobId)) continue;
    if (completedUpstreamIds.has(e.fromJobId)) triggers.add(e.fromJobId);
  }
  return [...triggers];
}

export interface ReaperTickVerdict {
  /** running+pending rows examined across ALL projects this tick. */
  examined: number;
  /** rows that flipped to completed this tick (each fired a dispatch poke). */
  flips: number;
  /** completed upstreams poked by the pending retry leg. */
  retried: number;
}

let lastPendingRetryAt = 0;

/** One background beat. Exported for benches and manual triggers — the
 * interval itself lives in ensureGlobalReconciler. */
export async function globalReconcileTick(): Promise<ReaperTickVerdict> {
  const t0 = Date.now();
  const stuck = await db.job.findMany({
    where: { status: { in: ["running", "pending"] } },
    orderBy: { createdAt: "asc" },
  });
  const verdict: ReaperTickVerdict = { examined: stuck.length, flips: 0, retried: 0 };

  // t625 — the accounting backfill's rows are TERMINAL (the stop receipt's
  // failed row) and thus invisible to the stuck query — but the LEDGER FILE
  // knows exactly which ids carry the open question. Computed BEFORE the
  // empty-world early return: a quiet night (no running/pending rows
  // anywhere) is exactly when the stop receipts have settled and their
  // open questions still need the ledger's answer. A plain JSON read + an
  // indexed fetch — no SSH until the consult itself. Their heals
  // deliberately do NOT enter the transition leg's before-set: a
  // stop-receipt row healing to completed must not fire downstream
  // dispatch (the stop's intent stands; the ledger's word only heals the
  // row).
  const accountingIds = Object.values(readRuns())
    .filter((r) => r.done && r.remote?.accountingPending)
    .map((r) => r.jobId);
  const accountingRows = accountingIds.length
    ? await db.job.findMany({ where: { id: { in: accountingIds } } }).catch(() => [])
    : [];

  if (stuck.length === 0 && accountingRows.length === 0) return verdict;

  // 1. local finalize + progress (ledger-driven, DB-conditional flips).
  const localFinal = await reconcileRealJobs(stuck).catch(() => stuck);
  const sweepInput = [
    ...localFinal,
    ...accountingRows.filter((r) => !stuck.some((s) => s.id === r.id)),
  ];

  // 2. the remote sweep — await it (no UI is waiting on this beat; a slow
  // wire delays the TICK, and the re-entrancy guard skips the beats it
  // overlaps). Its per-connection pollState throttle coalesces with any
  // GET-driven sweep already in flight.
  let sweptFinal = sweepInput;
  try {
    sweptFinal = await reconcileRemoteJobs(sweepInput);
  } catch {
    /* the sweep's verdicts land on the next beat — never die loudly */
  }

  // 3. the transition leg: this beat's completed flips fire dispatch.
  const flips = completedFlips(stuck, sweptFinal);
  verdict.flips = flips.length;
  for (const id of flips) {
    void autoStartPendingDownstream(id).catch(() => 0);
  }

  // 4. the pending retry leg (t324, globalized): pending jobs whose
  // upstreams are completed in the DB re-attempt every 20s. On boot the
  // empty lastPendingRetryAt makes the FIRST beat attempt recovery for
  // every orphaned pending row of every world.
  const pendingIds = sweptFinal
    .filter((j) => j.status === "pending" && !j.linkedJobId)
    .map((j) => j.id);
  if (pendingIds.length > 0 && Date.now() - lastPendingRetryAt >= PENDING_RETRY_MS) {
    lastPendingRetryAt = Date.now();
    const edges = await db.edge
      .findMany({
        where: { toJobId: { in: pendingIds } },
        select: { fromJobId: true, toJobId: true },
      })
      .catch(() => []);
    const upstreamIds = [...new Set(edges.map((e) => e.fromJobId))];
    const upstreams = upstreamIds.length
      ? await db.job
          .findMany({
            where: { id: { in: upstreamIds }, status: "completed" },
            select: { id: true },
          })
          .catch(() => [])
      : [];
    const triggers = planPendingRetries(
      pendingIds,
      edges,
      new Set(upstreams.map((u) => u.id))
    );
    verdict.retried = triggers.length;
    for (const id of triggers) {
      void autoStartPendingDownstream(id).catch(() => 0);
    }
  }

  // a productive beat says its name — an all-quiet beat stays silent so a
  // long-lived server's log stays readable (the GET route's own logs are
  // the noisy twin; this one only speaks when something MOVED).
  if (verdict.flips > 0 || verdict.retried > 0) {
    console.log(
      `[reaper] tick: examined=${verdict.examined} flips=${verdict.flips} retried=${verdict.retried} (${Date.now() - t0}ms)`
    );
  }
  return verdict;
}

type ReaperGlobal = typeof globalThis & {
  __cryoflowReaper?: ReturnType<typeof setInterval>;
};

/**
 * Mount the reaper (idempotent): the globalThis holder survives dev-mode
 * module re-instantiation, so instrumentation's dynamic import and the
 * jobs route's static import can never double-mount. The first beat fires
 * immediately — boot recovery for every orphaned pending row starts at
 * mount, not at the first interval lapse.
 */
export function ensureGlobalReconciler(): void {
  if (process.env.CRYOFLOW_NO_REAPER === "1") return;
  const g = globalThis as ReaperGlobal;
  if (g.__cryoflowReaper) return;
  let ticking = false;
  const beat = async (): Promise<void> => {
    if (ticking) return;
    ticking = true;
    try {
      await globalReconcileTick();
    } catch {
      /* the reaper never dies loudly — the next beat re-tries */
    } finally {
      ticking = false;
    }
  };
  const ms = clampReconcileMs(process.env.CRYOFLOW_GLOBAL_RECONCILE_MS);
  const timer = setInterval(() => void beat(), ms);
  // unref: a background correctness loop must never hold the process open
  // (prod-3001.sh's orphan-launch and the dev lane both expect clean exits)
  timer.unref?.();
  g.__cryoflowReaper = timer;
  console.log(`[reaper] global reconciler mounted (every ${Math.round(ms / 1000)}s)`);
  void beat();
}

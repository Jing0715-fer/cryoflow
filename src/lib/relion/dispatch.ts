/**
 * CryoFlow — run dispatch (server only).
 * Routes POST /api/jobs/[id]/run and the EMPIAR seed through here: the REAL
 * RELION engine is the only engine (the time-based simulation was retired).
 */

import type { Job } from "@prisma/client";
import { db } from "@/lib/db";
import {
  parseJobParams,
  runRealJob,
  isRunAlive,
  liveRunCount,
  type UpstreamRef,
  type WaitKind,
} from "./engine";

/** Placeholder duration for real runs (the exit handler overwrites it). */
const REAL_DURATION_HINT = 60_000;

/**
 * Jobs whose startJob is CURRENTLY executing (between the running flip and
 * the spawn / waiting verdict). Sync check-and-add at function entry closes
 * the double-spawn race window: two concurrent triggers (auto-start + poll
 * sweep, double Run click) both passed isRunAlive before either spawned.
 */
const starting = new Set<string>();

/**
 * Auto-start never pushes live RELION processes past this count — a stampede
 * guard for this 4GB box (fan-outs like Import → {CTF, ManualPick} still run
 * concurrently; anything beyond waits for the next completion retrigger).
 */
const AUTO_START_MAX_LIVE = 3;

export interface StartOutcome {
  job: Job;
  /** Present when the real engine failed honestly at start-up. */
  error?: string;
  /** Present when the job went PENDING instead of running — an upstream
   * job failed or is still running. Not an error: the job will start as
   * soon as its inputs exist (the user re-runs it, or the upstream finishes). */
  waiting?: WaitKind;
  /** Present when the job's process is already alive — nothing was started.
   * The route maps this to HTTP 409 instead of failing the job. */
  busy?: string;
}

/**
 * Full upstream lineage of a job, in INPUT-PRIORITY order: BFS layer by
 * layer (direct parents first, then grandparents, ...), newest-first within
 * a layer. resolveInputs scans this array in order and takes the first job
 * that (a) is an allowed provider for the requirement and (b) has the
 * output — so a closer curated chain (e.g. class2d) beats a raw extract
 * further up the graph. Cycles and duplicate visits are guarded.
 *
 * SOFT LINKS: a linked job row (linkedJobId set) resolves to its ROOT
 * original — the lineage contains the original's id/type/params (so
 * resolveInputs finds the original's run outputs) and the BFS continues
 * through the ORIGINAL's parents, exactly as RELION's pipeliner does when
 * a downstream job references another job's output node.
 */
export async function lineageFor(jobId: string): Promise<UpstreamRef[]> {
  const lineage: UpstreamRef[] = [];
  const seen = new Set<string>([jobId]);
  let frontier: string[] = [jobId];

  while (frontier.length > 0) {
    const edges = await db.edge.findMany({ where: { toJobId: { in: frontier } } });
    const nextIds = edges
      .map((e) => e.fromJobId)
      .filter((id) => !seen.has(id));
    if (nextIds.length === 0) break;
    const rows = await db.job.findMany({
      where: { id: { in: nextIds } },
      orderBy: { createdAt: "desc" },
    });
    // next frontier starts empty; rows resolved through links push the
    // ORIGINAL's id so the following BFS layer walks the original's parents
    const nextFrontier: string[] = [];
    for (const row of rows) {
      // resolve link chain → root original (links mirror another job)
      const root = await resolveLinkRoot(row);
      // REGRESSION FIX: check the dedupe BEFORE marking the row visited.
      // The old order (seen.add(row.id) → seen.has(root.id)) short-circuited
      // every NON-LINK row (root === row → just-marked → skipped), leaving
      // the lineage empty for directly-wired jobs — resolveInputs then failed
      // every fresh run with "Waiting for upstream output". Link runs and
      // --continue resumes masked it during the workspace-arch E2E.
      if (seen.has(root.id)) continue; // root already contributed (another link or an earlier layer)
      seen.add(row.id);
      if (root.id !== row.id) seen.add(root.id); // link row: dedupe future links to the same original
      lineage.push({
        id: root.id,
        type: root.type,
        params: parseJobParams(root.params),
        status: root.status,
        name: root.name,
      });
      nextFrontier.push(root.id);
    }
    frontier = nextFrontier;
  }
  return lineage;
}

/** Follow a job's soft-link chain to its ROOT original row (cycle-safe). */
async function resolveLinkRoot(job: Job): Promise<Job> {
  if (!job.linkedJobId) return job;
  const seen = new Set<string>([job.id]);
  let current = job;
  for (let hop = 0; hop < 16 && current.linkedJobId; hop++) {
    const target = await db.job.findUnique({ where: { id: current.linkedJobId } });
    if (!target || seen.has(target.id)) break;
    seen.add(target.id);
    current = target;
  }
  return current;
}

/**
 * Start (or restart) a job on the REAL RELION engine: fetch upstream jobs via
 * edges, mark running, then hand over to runRealJob (natives complete
 * synchronously; RELION spawns are tracked by the exit handler).
 */
export async function startJob(job: Job): Promise<StartOutcome> {
  // ---- in-flight guard (synchronous — closes the double-spawn race) ----
  if (starting.has(job.id)) {
    return { job, busy: "a start for this job is already in flight" };
  }
  starting.add(job.id);
  try {
    // ---- REAL engine -----------------------------------------------------
    // Liveness guard: refuse to spawn a second tree for a job whose previous
    // process is still alive (double-click Run, two tabs, or the command
    // palette all bypass the UI's disabled button). Two mpirun trees in one
    // workdir corrupt checkpoints and OOM this 4GB box.
    const busy = isRunAlive(job.id);
    if (busy) {
      return { job, busy };
    }

    // Build the FULL upstream lineage (BFS through edges, direct first) —
    // RELION GUI semantics: a job wired e.g. InitialModel → Refine3D inherits
    // its particles.star from anywhere up the chain, not just direct parents.
    const upstream = await lineageFor(job.id);

    const startedAtMs = Date.now();
    let updated = await db.job.update({
      where: { id: job.id },
      data: {
        status: "running",
        startedAt: new Date(startedAtMs),
        progress: 0,
        result: null,
        duration: REAL_DURATION_HINT,
      },
    });

    const outcome = await runRealJob(
      {
        id: job.id,
        projectId: job.projectId,
        type: job.type,
        params: parseJobParams(job.params),
      },
      upstream
    );

    if (!outcome.ok) {
      if (outcome.waiting) {
        // upstream failed / still running / never ran → PENDING (amber), not
        // failed: a failed import no longer cascades red CTF/extract/… errors
        // down the pipeline. The result line says exactly what to fix. The
        // job auto-starts the moment its inputs become ready (see below).
        updated = await db.job.update({
          where: { id: job.id },
          data: { status: "pending", progress: 0, result: outcome.error },
        });
        return { job: updated, waiting: outcome.waiting };
      }
      // honest failure (RELION missing / bad params / external missing)
      updated = await db.job.update({
        where: { id: job.id },
        data: { status: "failed", progress: 0, result: outcome.error ?? "failed" },
      });
      return { job: updated, error: outcome.error };
    }

    if (outcome.native) {
      // engine-native job completed synchronously
      updated = await db.job.update({
        where: { id: job.id },
        data: {
          status: "completed",
          progress: 100,
          result: outcome.result ?? "completed",
          duration: Math.max(500, Date.now() - startedAtMs),
        },
      });
      // its outputs just landed → pending downstream jobs auto-start now
      void autoStartPendingDownstream(job.id);
      return { job: updated };
    }

    return { job: updated };
  } finally {
    starting.delete(job.id);
  }
}

/**
 * Auto-start the PENDING downstream consumers of a (just completed) trigger
 * job — RELION pipeliner semantics: "run as soon as inputs are ready", no
 * manual re-click. Fired from:
 *  - the engine's exit handler (async RELION run reached exit 0),
 *  - startJob's native-completion branch (synchronous jobs, e.g. Import),
 *  - the jobs GET transition sweep (catch-all for restarts / missed hooks).
 *
 * Idempotent and self-gating: startJob re-runs resolveInputs, so a consumer
 * whose inputs are STILL incomplete just flips back to pending (message
 * refreshed); failed/idle/running/link jobs are skipped entirely; the
 * in-flight + liveness guards make concurrent triggers safe.
 */
export async function autoStartPendingDownstream(triggerJobId: string): Promise<number> {
  try {
    const trigger = await db.job.findUnique({ where: { id: triggerJobId } });
    if (!trigger || trigger.status !== "completed") return 0;

    // BFS DOWNSTREAM from the trigger (direct children first) — order matters:
    // nearest consumers attempt first, so an early start takes the live-run
    // budget before far-away branches.
    const order: string[] = [];
    const seen = new Set<string>([triggerJobId]);
    let frontier = [triggerJobId];
    while (frontier.length > 0) {
      const edges = await db.edge.findMany({ where: { fromJobId: { in: frontier } } });
      const next: string[] = [];
      for (const e of edges) {
        if (seen.has(e.toJobId)) continue;
        seen.add(e.toJobId);
        order.push(e.toJobId);
        next.push(e.toJobId);
      }
      frontier = next;
    }
    if (order.length === 0) return 0;

    const rows = await db.job.findMany({ where: { id: { in: order } } });
    const byId = new Map(rows.map((r) => [r.id, r]));

    let started = 0;
    for (const id of order) {
      const row = byId.get(id);
      if (!row) continue;
      if (row.linkedJobId) continue; // links are read-only mirrors — never run
      if (row.status !== "pending") continue; // only jobs the user opted into
      if (liveRunCount() >= AUTO_START_MAX_LIVE) break; // stampede guard
      const outcome = await startJob(row);
      if (!outcome.error && !outcome.waiting && !outcome.busy) started += 1;
    }
    if (started > 0) {
      console.log(`dispatch: auto-started ${started} pending downstream job(s) after "${trigger.name}" completed`);
    }
    return started;
  } catch (err) {
    console.error("dispatch: downstream auto-start failed:", err);
    return 0;
  }
}

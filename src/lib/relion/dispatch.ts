/**
 * CryoFlow — run dispatch (server only).
 * Routes POST /api/jobs/[id]/run and the EMPIAR seed through here: the REAL
 * RELION engine is the only engine (the time-based simulation was retired).
 */

import type { Job } from "@prisma/client";
import { db } from "@/lib/db";
import { parseJobParams, runRealJob, isRunAlive, type UpstreamRef } from "./engine";

/** Placeholder duration for real runs (the exit handler overwrites it). */
const REAL_DURATION_HINT = 60_000;

export interface StartOutcome {
  job: Job;
  /** Present when the real engine failed honestly at start-up. */
  error?: string;
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
      lineage.push({ id: root.id, type: root.type, params: parseJobParams(root.params) });
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
    // honest failure (RELION missing / upstream missing / external missing)
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
    return { job: updated };
  }

  return { job: updated };
}

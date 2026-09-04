/**
 * CryoFlow — run dispatch (server only).
 * Routes POST /api/jobs/[id]/run and the EMPIAR seed through here:
 * decides between the sim engine (time-based) and the REAL RELION engine.
 */

import type { Job } from "@prisma/client";
import { db } from "@/lib/db";
import { jobType } from "@/lib/workflow";
import { jitteredDuration } from "@/lib/seed";
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
    for (const row of rows) {
      seen.add(row.id);
      lineage.push({ id: row.id, type: row.type, params: parseJobParams(row.params) });
    }
    frontier = rows.map((r) => r.id);
  }
  return lineage;
}

/**
 * Start (or restart) a job.
 *  - engineKind "relion": fetch upstream jobs via edges, mark running,
 *    then hand over to runRealJob (natives complete synchronously).
 *  - engineKind "sim": legacy time-based simulation with duration jitter.
 */
export async function startJob(job: Job, engineKind: "sim" | "relion"): Promise<StartOutcome> {
  if (engineKind !== "relion") {
    const base = jobType(job.type)?.duration ?? job.duration;
    const updated = await db.job.update({
      where: { id: job.id },
      data: {
        status: "running",
        startedAt: new Date(),
        progress: 0,
        result: null,
        duration: jitteredDuration(base),
      },
    });
    return { job: updated };
  }

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

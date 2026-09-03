/**
 * CryoFlow — run dispatch (server only).
 * Routes POST /api/jobs/[id]/run and the EMPIAR seed through here:
 * decides between the sim engine (time-based) and the REAL RELION engine.
 */

import type { Job } from "@prisma/client";
import { db } from "@/lib/db";
import { jobType } from "@/lib/workflow";
import { jitteredDuration } from "@/lib/seed";
import { parseJobParams, runRealJob } from "./engine";

/** Placeholder duration for real runs (the exit handler overwrites it). */
const REAL_DURATION_HINT = 60_000;

export interface StartOutcome {
  job: Job;
  /** Present when the real engine failed honestly at start-up. */
  error?: string;
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
  const inEdges = await db.edge.findMany({ where: { toJobId: job.id } });
  const upstreamIds = inEdges.map((e) => e.fromJobId);
  const upstreamRows =
    upstreamIds.length > 0
      ? await db.job.findMany({
          where: { id: { in: upstreamIds } },
          orderBy: { createdAt: "asc" },
        })
      : [];
  const upstream = upstreamRows.map((u) => ({
    id: u.id,
    type: u.type,
    params: parseJobParams(u.params),
  }));

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

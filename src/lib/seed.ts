/**
 * CryoFlow — server-side helpers: project seeding + DTO mapping.
 * No "use client": this module only runs inside API route handlers.
 */

import { db } from "@/lib/db";
import type { Edge, Job, Project } from "@prisma/client";
import { defaultParams, jobType, resultFor } from "@/lib/workflow";
import type { EdgeDTO, JobDTO, ProjectDTO } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* DTO mappers                                                          */
/* ------------------------------------------------------------------ */

function parseParams(raw: string): Record<string, number | string> {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, number | string>;
    }
  } catch {
    // fall through to {}
  }
  return {};
}

export function toJobDTO(job: Job): JobDTO {
  return {
    id: job.id,
    projectId: job.projectId,
    type: job.type,
    name: job.name,
    x: job.x,
    y: job.y,
    status: job.status,
    progress: job.progress,
    params: parseParams(job.params),
    result: job.result,
    duration: job.duration,
    startedAt: job.startedAt ? job.startedAt.toISOString() : null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

export function toEdgeDTO(edge: Edge): EdgeDTO {
  return { id: edge.id, fromJobId: edge.fromJobId, toJobId: edge.toJobId };
}

export function toProjectDTO(project: Project): ProjectDTO {
  return {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt.toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* Simulated run progress (time-based)                                  */
/* ------------------------------------------------------------------ */

/**
 * For every running job derive progress from startedAt + duration.
 * Jobs that reached 100% are persisted as completed (with their result)
 * and the updated row is returned in place of the stale one.
 */
export async function reconcileRunning(jobs: Job[]): Promise<Job[]> {
  const now = Date.now();
  const out: Job[] = [];
  for (const job of jobs) {
    if (job.status !== "running" || !job.startedAt) {
      out.push(job);
      continue;
    }
    const elapsed = now - job.startedAt.getTime();
    const progress = Math.min(100, (elapsed / job.duration) * 100);
    if (progress >= 100) {
      const updated = await db.job.update({
        where: { id: job.id },
        data: {
          status: "completed",
          progress: 100,
          result: resultFor(job.type, job.id),
        },
      });
      out.push(updated);
    } else {
      out.push({ ...job, progress });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Seeding                                                              */
/* ------------------------------------------------------------------ */

/** Duration jitter: ±15% around the catalog value. */
export function jitteredDuration(base: number): number {
  return Math.round(base * (0.85 + Math.random() * 0.3));
}

/**
 * Idempotent: returns the first project, creating the demo project
 * (β-Galactosidase Tutorial) with a small starter workflow on first call.
 */
export async function ensureProject(): Promise<Project> {
  const existing = await db.project.findFirst({
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  const project = await db.project.create({
    data: { name: "β-Galactosidase Tutorial" },
  });

  const importJob = await db.job.create({
    data: {
      projectId: project.id,
      type: "import",
      name: "Import Movies 1",
      x: 16,
      y: 220,
      status: "completed",
      progress: 100,
      params: JSON.stringify(defaultParams("import")),
      duration: jitteredDuration(jobType("import")?.duration ?? 2500),
    },
  });
  // result depends on the generated id → set after create
  await db.job.update({
    where: { id: importJob.id },
    data: { result: resultFor("import", importJob.id) },
  });

  const motionJob = await db.job.create({
    data: {
      projectId: project.id,
      type: "motion",
      name: "Motion Correction 1",
      x: 280,
      y: 220,
      status: "idle",
      params: JSON.stringify(defaultParams("motion")),
      duration: jitteredDuration(jobType("motion")?.duration ?? 9000),
    },
  });

  const ctfJob = await db.job.create({
    data: {
      projectId: project.id,
      type: "ctf",
      name: "CTF Estimation 1",
      x: 544,
      y: 220,
      status: "idle",
      params: JSON.stringify(defaultParams("ctf")),
      duration: jitteredDuration(jobType("ctf")?.duration ?? 5000),
    },
  });

  await db.edge.createMany({
    data: [
      { projectId: project.id, fromJobId: importJob.id, toJobId: motionJob.id },
      { projectId: project.id, fromJobId: motionJob.id, toJobId: ctfJob.id },
    ],
  });

  return project;
}

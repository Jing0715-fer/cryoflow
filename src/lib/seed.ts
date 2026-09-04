/**
 * CryoFlow — server-side helpers: project seeding + DTO mapping.
 * No "use client": this module only runs inside API route handlers.
 */

import { db } from "@/lib/db";
import type { Edge, Job, Project } from "@prisma/client";
import { defaultParams, jobType, resultFor } from "@/lib/workflow";
import type { EdgeDTO, JobDTO, ProjectDTO } from "@/lib/types";
import { registerProject, getActiveProject } from "@/lib/projects";
import { readRuns } from "@/lib/relion/engine";

/* ------------------------------------------------------------------ */
/* DTO mappers                                                          */
/* ------------------------------------------------------------------ */

function parseParams(raw: string): Record<string, number | string | boolean> {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, number | string | boolean>;
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
    workspaceId: job.workspaceId,
    linkedJobId: job.linkedJobId,
  };
}

export function toEdgeDTO(edge: Edge): EdgeDTO {
  return { id: edge.id, fromJobId: edge.fromJobId, toJobId: edge.toJobId };
}

export function toProjectDTO(project: Project, mode = "spa", engine = "sim"): ProjectDTO {
  return {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt.toISOString(),
    mode,
    engine,
  };
}

/* ------------------------------------------------------------------ */
/* Simulated run progress (time-based)                                  */
/* ------------------------------------------------------------------ */

/**
 * For every running job derive progress from startedAt + duration.
 * Jobs that reached 100% are persisted as completed (with their result)
 * and the updated row is returned in place of the stale one.
 * REAL-engine jobs (engine-state.json record) are skipped — they are
 * reconciled by reconcileRealJobs() first.
 */
export async function reconcileRunning(jobs: Job[]): Promise<Job[]> {
  const runs = readRuns();
  const now = Date.now();
  const out: Job[] = [];
  for (const job of jobs) {
    if (job.status !== "running" || !job.startedAt) {
      out.push(job);
      continue;
    }
    if (runs[job.id]) {
      out.push(job); // real engine owns this run
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
 * Idempotent demo seeding: ONLY when the DB has no projects at all.
 * Creates the sim β-Galactosidase demo (import → motioncorr → ctffind)
 * and registers it as the active sim project in data/projects.json.
 */
export async function ensureProject(): Promise<Project | null> {
  const count = await db.project.count();
  if (count > 0) return null;

  const project = await db.project.create({
    data: { name: "β-Galactosidase Tutorial (demo)" },
  });
  registerProject(project.id, { mode: "spa", engine: "sim" }, true);

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
      duration: jitteredDuration(jobType("import")?.duration ?? 2000),
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
      type: "motioncorr",
      name: "Motion Correction 1",
      x: 280,
      y: 220,
      status: "idle",
      params: JSON.stringify(defaultParams("motioncorr")),
      duration: jitteredDuration(jobType("motioncorr")?.duration ?? 9000),
    },
  });

  const ctfJob = await db.job.create({
    data: {
      projectId: project.id,
      type: "ctffind",
      name: "CTF Estimation 1",
      x: 544,
      y: 220,
      status: "idle",
      params: JSON.stringify(defaultParams("ctffind")),
      duration: jitteredDuration(jobType("ctffind")?.duration ?? 5000),
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

/**
 * Seeds the demo project when the DB is empty, then resolves the ACTIVE
 * project (+ mode/engine meta). Single entry point for list endpoints.
 */
export async function ensureActiveProject(): Promise<
  { project: Project; meta: { mode: "spa" | "tomo"; engine: "sim" | "relion" } } | null
> {
  await ensureProject();
  return getActiveProject();
}

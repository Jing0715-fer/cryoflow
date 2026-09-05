/**
 * CryoFlow — server-side helpers: project seeding + DTO mapping.
 * No "use client": this module only runs inside API route handlers.
 */

import { existsSync } from "fs";
import { db } from "@/lib/db";
import type { Edge, Job, Project } from "@prisma/client";
import { defaultParams, jobType } from "@/lib/workflow";
import type { EdgeDTO, JobDTO, ProjectDTO } from "@/lib/types";
import { registerProject, getActiveProject } from "@/lib/projects";

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

export function toProjectDTO(project: Project, mode = "spa", engine: "relion" = "relion"): ProjectDTO {
  return {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt.toISOString(),
    mode,
    engine,
  };
}

/* ------------------------------------------------------------------ */
/* Seeding (real RELION engine — the simulation was retired)            */
/* ------------------------------------------------------------------ */

/** Sandbox demo dataset — pre-filled only when the bundle actually exists. */
const EMPIAR_DEMO_DIR = "/home/z/empiar-10017/micrographs";

/**
 * Idempotent demo seeding: ONLY when the DB has no projects at all.
 * Creates the β-Galactosidase tutorial (import → motioncorr → ctffind) as
 * IDLE jobs on the REAL RELION engine — Run executes actual RELION
 * binaries; nothing is pre-completed or faked. The import's micrographs
 * path is pre-filled with the sandbox EMPIAR-10017 bundle when present.
 */
export async function ensureProject(): Promise<Project | null> {
  const count = await db.project.count();
  if (count > 0) return null;

  const project = await db.project.create({
    data: { name: "β-Galactosidase Tutorial (demo)" },
  });
  registerProject(project.id, { mode: "spa", engine: "relion" }, true);

  const importParams = { ...defaultParams("import") };
  if (existsSync(EMPIAR_DEMO_DIR)) {
    importParams.micrographsPath = EMPIAR_DEMO_DIR;
  }

  const importJob = await db.job.create({
    data: {
      projectId: project.id,
      type: "import",
      name: "Import Movies 1",
      x: 16,
      y: 220,
      status: "idle",
      params: JSON.stringify(importParams),
      duration: jobType("import")?.duration ?? 2000,
    },
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
      duration: jobType("motioncorr")?.duration ?? 9000,
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
      duration: jobType("ctffind")?.duration ?? 5000,
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
  { project: Project; meta: { mode: "spa" | "tomo"; engine: "relion" } } | null
> {
  await ensureProject();
  return getActiveProject();
}

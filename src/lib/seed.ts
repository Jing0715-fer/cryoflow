/**
 * CryoFlow — server-side helpers: project seeding + DTO mapping.
 * No "use client": this module only runs inside API route handlers.
 */

import { existsSync } from "fs";
import { db } from "@/lib/db";
import type { Edge, Job, Project } from "@prisma/client";
import { defaultParams, jobType } from "@/lib/workflow";
import type { EdgeDTO, JobDTO, ProjectDTO } from "@/lib/types";
import { registerProject, getActiveProject, projectRemoteRef } from "@/lib/projects";

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
    note: job.note,
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
    // t300 — the cluster binding rides every project DTO (null for local
    // projects and for bindings whose connection was deleted — the honest
    // degraded state, resolved fresh from the registry on each build)
    remote: projectRemoteRef(project.id),
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
 *
 * t371 — IN-PROCESS SINGLE-FLIGHT: a cold server's first page load fires
 * every list endpoint concurrently (jobs/project/projects/edges/
 * workspaces all call ensureActiveProject), and the count-then-create
 * guard is not atomic — all N calls can read count=0 and each mint the
 * FULL tutorial (the field shape caught live: THREE identically-named
 * "β-Galactosidase Tutorial (demo)" projects on one fresh sandbox,
 * 3 jobs each). The single-flight promise makes concurrent callers
 * SHARE one seed run inside this process; the count guard stays for
 * sequential arrivals after it resolves (idempotent as always).
 */
let seedInFlight: Promise<Project | null> | null = null;

export function ensureProject(): Promise<Project | null> {
  if (!seedInFlight) {
    seedInFlight = seedProjectOnce().finally(() => {
      seedInFlight = null;
    });
  }
  return seedInFlight;
}

async function seedProjectOnce(): Promise<Project | null> {
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

  // t371 — the seed's own blind spot: these three cards were minted with
  // workspaceId NULL, and the first ensureDefaultWorkspace call (any job
  // creation, any workspace-creating action) then installs a "Main" the
  // seed cards can never join — useActiveWorkspaceJobs filters them out
  // and a FRESH INSTALL's canvas goes BLANK after its first refresh (the
  // field shape seen live: seed → one POST → Main exists → reload → 0
  // cards, data intact but invisible). The seed now homes its cards into
  // the default workspace ITSELF, so the canvas is stable from the very
  // first paint, whatever later actions mint.
  const mainWorkspaceId = await ensureDefaultWorkspace(project.id);
  const seedJobIds = [importJob.id, motionJob.id, ctfJob.id];
  for (const id of seedJobIds) {
    await db.job.update({ where: { id }, data: { workspaceId: mainWorkspaceId } });
  }

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

/**
 * Projects seeded before the workspace layer (or via legacy import paths)
 * can carry ZERO workspace rows — every job-creating route would then 500
 * ("No workspace available") exactly when a new user presses their first
 * action (job add, pipeline template). Heal on demand: return the first
 * workspace, or create the default "Main" one (order 0).
 *
 * t371 — the ORPHAN SWEEP rides the same call: a job whose workspaceId is
 * NULL is invisible in EVERY workspace (useActiveWorkspaceJobs filters by
 * exact id), so an install that seeded before this fix shows a split
 * canvas — the NEW card lands visible while the seed trio stays gone.
 * Every caller of this function is a job-CREATING route, the exact moment
 * that split would otherwise become visible: the sweep re-homes the
 * project's orphans into the default workspace in one idempotent pass
 * (zero rows touched once no NULLs remain — Prisma updateMany with a
 * non-matching where costs one indexed count, not a scan-and-write).
 */
export async function ensureDefaultWorkspace(projectId: string): Promise<string> {
  const existing = await db.workspace.findFirst({
    where: { projectId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });
  const wsId = existing
    ? existing.id
    : (
        await db.workspace.create({
          data: { projectId, name: "Main", order: 0 },
          select: { id: true },
        })
      ).id;
  await db.job.updateMany({
    where: { projectId, workspaceId: null },
    data: { workspaceId: wsId },
  });
  return wsId;
}

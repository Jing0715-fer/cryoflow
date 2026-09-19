/**
 * CryoFlow — project meta store (server only).
 *
 * The Prisma schema is frozen, so per-project mode (spa/tomo) and the
 * active-project pointer live in data/projects.json. The engine concept was
 * RETIRED: every project runs the REAL RELION engine — legacy "sim" entries
 * are healed to "relion" on read so old state files keep working.
 */

import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type { Project } from "@prisma/client";
import { db } from "@/lib/db";
import { DATA_DIR } from "@/lib/paths";
import { getConnection } from "@/lib/remote/connections";
import type { ProjectRemoteRef, RemoteRunTarget } from "@/lib/remote/types";
import type { ProjectSummaryDTO } from "./types";

const FILE = path.join(DATA_DIR, "projects.json");

export type ProjectMode = "spa" | "tomo";
/** Legacy alias — the only engine is the real RELION one. */
export type ProjectEngine = "relion";

export interface ProjectMeta {
  mode: ProjectMode;
  engine: ProjectEngine;
  /**
   * t300 — remote project binding: the connection whose cluster holds this
   * project's INPUT data (movies/micrographs picked by browsing the cluster)
   * and where its jobs are meant to be submitted. Absent/null = a local
   * project (data on this machine, exactly as before). The id is validated
   * against the connections registry at the API door; here it is stored as
   * given so a temporarily-missing connection degrades honestly (the UI
   * shows "connection gone" instead of silently unbinding).
   */
  remote?: { connectionId: string } | null;
}

/** Normalize legacy sim entries (and unknown values) → "relion". */
function normalizeEngine(value: unknown): "relion" {
  return value === "relion" || value === "sim" ? "relion" : "relion";
}

export interface ProjectsFile {
  active: string | null;
  projects: Record<string, ProjectMeta>;
}

export function readProjectsFile(): ProjectsFile {
  try {
    const raw = readFileSync(FILE, "utf8");
    const parsed = JSON.parse(raw) as ProjectsFile;
    if (parsed && typeof parsed === "object" && Array.isArray(parsed.projects) === false && parsed.projects) {
      return { active: parsed.active ?? null, projects: parsed.projects };
    }
  } catch {
    // ENOENT / corrupt → fresh state
  }
  return { active: null, projects: {} };
}

export function writeProjectsFile(file: ProjectsFile): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(file, null, 2));
}

/** Register (or update) a project's meta; optionally make it active. */
export function registerProject(
  id: string,
  meta: ProjectMeta,
  makeActive = false
): void {
  const file = readProjectsFile();
  file.projects[id] = meta;
  if (makeActive || !file.active) file.active = id;
  writeProjectsFile(file);
}

export function getProjectMeta(id: string): ProjectMeta | null {
  const meta = readProjectsFile().projects[id];
  if (!meta) return null;
  // legacy "sim" entries heal on read (engine is always the real RELION one)
  return {
    mode: meta.mode === "tomo" ? "tomo" : "spa",
    engine: "relion",
    ...(meta.remote?.connectionId ? { remote: { connectionId: meta.remote.connectionId } } : {}),
  };
}

/**
 * t300 — bind (or unbind) a project's data location to a saved cluster
 * connection. `connectionId === null` clears the binding (back to local);
 * existence is NOT re-validated here (the API route owns that check — this
 * module stays decoupled from the registry's write paths).
 */
export function setProjectRemote(id: string, connectionId: string | null): boolean {
  const file = readProjectsFile();
  const meta = file.projects[id];
  if (!meta) return false;
  const next: ProjectMeta = {
    ...meta,
    remote: connectionId ? { connectionId } : null,
  };
  file.projects[id] = next;
  writeProjectsFile(file);
  return true;
}

/**
 * t300 — resolve a project's cluster binding to a secret-free UI projection.
 * null when the project is local OR the bound connection no longer exists
 * (the honest degraded state — the UI names it, never hides it).
 */
export function projectRemoteRef(id: string): ProjectRemoteRef | null {
  const meta = readProjectsFile().projects[id];
  const connId = meta?.remote?.connectionId;
  if (!connId) return null;
  const conn = getConnection(connId);
  if (!conn) return null;
  return {
    connectionId: conn.id,
    name: conn.name || `${conn.username}@${conn.host}`,
    host: conn.host,
    port: conn.port,
    username: conn.username,
  };
}

/**
 * t317 — the project binding as a RUN TARGET (the connection's own saved
 * defaults: module, mode, partition). This is the "project binding is the
 * second source of remote-ness" doctrine as one shared shape — the
 * auto-start passthrough (t315) and the manual bare-POST run door (t317)
 * must speak the EXACT same target, so neither hand-rolls it.
 *
 * Module fallback mirrors the run dialog's default (remote-run-button):
 * the connection's defaultModule, else the FIRST probed module — a
 * module-less sbatch would die 127 (relion_refine not on PATH) after a
 * full staging round. Null when the project is local or its connection
 * is gone (ghost binding — callers degrade honestly).
 */
export function projectRemoteTarget(projectId: string): RemoteRunTarget | null {
  const meta = readProjectsFile().projects[projectId];
  const connId = meta?.remote?.connectionId;
  if (!connId) return null;
  const conn = getConnection(connId);
  if (!conn) return null;
  return {
    connectionId: connId,
    module: conn.defaultModule ?? conn.lastProbe?.relionModules?.[0] ?? null,
    mode: conn.useSlurm ? "slurm" : "direct",
    ...(conn.useSlurm && typeof conn.slurmPartition === "string" && conn.slurmPartition
      ? { partition: conn.slurmPartition }
      : {}),
  };
}

export function setActiveProject(id: string): boolean {
  const file = readProjectsFile();
  if (!file.projects[id]) return false;
  file.active = id;
  writeProjectsFile(file);
  return true;
}

/**
 * Resolve the active project (Prisma row + meta). Defaults:
 *  - active missing/stale → first project by createdAt
 *  - projects without meta / legacy sim entries → { mode: 'spa', engine: 'relion' }
 * The file is healed in-place when defaults were applied.
 * Returns null when the DB has no projects at all.
 */
export async function getActiveProject(): Promise<{ project: Project; meta: ProjectMeta } | null> {
  let file = readProjectsFile();
  let dirty = false;

  let project: Project | null = null;
  if (file.active) {
    project = await db.project.findUnique({ where: { id: file.active } });
  }
  if (!project) {
    project = await db.project.findFirst({ orderBy: { createdAt: "asc" } });
    if (project) {
      file.active = project.id;
      dirty = true;
    }
  }

  if (!project) return null;

  let meta = file.projects[project.id];
  if (!meta || meta.engine !== "relion") {
    // missing meta OR legacy "sim" entry → real engine (heal in place);
    // t300 — a legacy row's remote binding (if any) survives the heal
    meta = {
      mode: meta?.mode === "tomo" ? "tomo" : "spa",
      engine: "relion",
      ...(meta?.remote?.connectionId ? { remote: { connectionId: meta.remote.connectionId } } : {}),
    };
    file.projects[project.id] = meta;
    dirty = true;
  }
  if (dirty) {
    // heal in place (preserve other entries)
    writeProjectsFile(file);
  }
  return { project, meta };
}

/** Job statistics for a project (computed via one groupBy aggregate). */
export interface ProjectStats {
  total: number;
  running: number;
  /** Waiting for an upstream job (failed or still running) — amber, not failed. */
  pending: number;
  completed: number;
  failed: number;
}

/**
 * ProjectSummaryDTO extended with the extra fields the projects API serves
 * (createdAt + stats). ProjectSummaryDTO itself is frozen, so callers cast.
 */
export interface ProjectSummaryWithStats extends ProjectSummaryDTO {
  createdAt: string;
  stats: ProjectStats;
}

const emptyStats = (): ProjectStats => ({ total: 0, running: 0, pending: 0, completed: 0, failed: 0 });

/**
 * Remove a project's meta from data/projects.json. When the deleted project
 * was the active one, `active` is fixed to the first remaining project (by
 * createdAt) or null when nothing remains.
 */
export async function removeProjectMeta(id: string): Promise<void> {
  const file = readProjectsFile();
  if (file.projects[id]) {
    const next = { ...file.projects };
    delete next[id];
    file.projects = next;
  }
  if (file.active === id) {
    const first = await db.project.findFirst({
      where: { id: { not: id } },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    file.active = first?.id ?? null;
  }
  writeProjectsFile(file);
}

/** All projects with meta + createdAt + job stats merged (for the project panel). */
export async function listProjectsWithMeta(): Promise<ProjectSummaryWithStats[]> {
  const rows = await db.project.findMany({ orderBy: { createdAt: "asc" } });
  const file = readProjectsFile();
  // One aggregate set: job counts grouped by projectId + status.
  const grouped = await db.job.groupBy({
    by: ["projectId", "status"],
    _count: { _all: true },
  });
  const statsBy = new Map<string, ProjectStats>();
  for (const g of grouped) {
    const s = statsBy.get(g.projectId) ?? emptyStats();
    s.total += g._count._all;
    if (g.status === "running") s.running = g._count._all;
    else if (g.status === "pending") s.pending = g._count._all;
    else if (g.status === "completed") s.completed = g._count._all;
    else if (g.status === "failed") s.failed = g._count._all;
    statsBy.set(g.projectId, s);
  }
  return rows.map((p) => {
    const legacy = file.projects[p.id];
    const meta = {
      mode: legacy?.mode === "tomo" ? "tomo" : "spa",
      engine: normalizeEngine(legacy?.engine),
    };
    return {
      id: p.id,
      name: p.name,
      mode: meta.mode,
      engine: meta.engine,
      remote: projectRemoteRef(p.id),
      createdAt: p.createdAt.toISOString(),
      stats: statsBy.get(p.id) ?? emptyStats(),
    };
  });
}

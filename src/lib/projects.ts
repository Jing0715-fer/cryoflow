/**
 * CryoFlow — project meta store (server only).
 *
 * The Prisma schema is frozen, so per-project mode (spa/tomo) and engine
 * (sim/relion) + the active-project pointer live in data/projects.json.
 */

import { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type { Project } from "@prisma/client";
import { db } from "@/lib/db";
import type { ProjectSummaryDTO } from "./types";

const DATA_DIR = "/home/z/my-project/data";
const FILE = path.join(DATA_DIR, "projects.json");

export type ProjectMode = "spa" | "tomo";
export type ProjectEngine = "sim" | "relion";

export interface ProjectMeta {
  mode: ProjectMode;
  engine: ProjectEngine;
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
  return readProjectsFile().projects[id] ?? null;
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
 *  - projects without meta → { mode: 'spa', engine: 'sim' }
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
  if (!meta) {
    meta = { mode: "spa", engine: "sim" };
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

const emptyStats = (): ProjectStats => ({ total: 0, running: 0, completed: 0, failed: 0 });

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
    else if (g.status === "completed") s.completed = g._count._all;
    else if (g.status === "failed") s.failed = g._count._all;
    statsBy.set(g.projectId, s);
  }
  return rows.map((p) => {
    const meta = file.projects[p.id] ?? { mode: "spa", engine: "sim" };
    return {
      id: p.id,
      name: p.name,
      mode: meta.mode,
      engine: meta.engine,
      createdAt: p.createdAt.toISOString(),
      stats: statsBy.get(p.id) ?? emptyStats(),
    };
  });
}

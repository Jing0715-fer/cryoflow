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

/** All projects with meta merged (for the header switcher). */
export async function listProjectsWithMeta(): Promise<
  { id: string; name: string; mode: string; engine: string }[]
> {
  const rows = await db.project.findMany({ orderBy: { createdAt: "asc" } });
  const file = readProjectsFile();
  return rows.map((p) => {
    const meta = file.projects[p.id] ?? { mode: "spa", engine: "sim" };
    return { id: p.id, name: p.name, mode: meta.mode, engine: meta.engine };
  });
}

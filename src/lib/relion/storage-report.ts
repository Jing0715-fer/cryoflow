import { existsSync, readdirSync } from "fs";
import path from "path";
import { db } from "@/lib/db";
import { getRun } from "@/lib/relion/engine";
import { RELION_DIR } from "@/lib/paths";
import {
  STORAGE_CATEGORIES,
  TopFilesCollector,
  type StorageCategoryId,
  type StorageFileRow,
} from "@/lib/relion/disk-usage";
import {
  WALK_MAX_ENTRIES,
  emptyDirUsage,
  walkDirUsage,
  type DirUsage,
} from "@/lib/relion/disk-walk";

interface RowMeta {
  jobId: string | null;
  name: string;
  type: string;
  status: string;
}

export interface StorageJobRow extends RowMeta {
  /** the physical directory name under data/relion/<projectId>/ */
  dirName: string;
  bytes: number;
  files: number;
  categories: Record<StorageCategoryId, { bytes: number; files: number }>;
  truncated: boolean;
  exists: boolean;
}

export interface StorageResponse {
  projectId: string;
  projectName: string;
  totalBytes: number;
  totalFiles: number;
  jobs: StorageJobRow[];
  byCategory: Record<StorageCategoryId, { bytes: number; files: number }>;
  /** t437: the heaviest files per category (TOP_FILES_PER_CATEGORY each) —
   *  the lens drill-down's data. Job metadata joined where the file's run
   *  directory has a record; orphans carry nulls and stay un-jumpable. */
  topFiles: StorageTopFileRow[];
  truncated: boolean;
  /** physical directory present at all (false = this project never ran) */
  hasRuns: boolean;
  generatedAt: string;
}

export interface StorageTopFileRow extends StorageFileRow {
  jobId: string | null;
  jobName: string | null;
}

/**
 * computeStorageReport — t436: the project storage overview's ONE well.
 *
 * The physical truth first: everything under data/relion/<projectId>/
 * is walked (per jobDir, symlink-honest, entry-capped — the t331 walk
 * dialect), because the disk fills regardless of what the DB believes.
 * The DB join is metadata only: a jobDir whose run record / job row is
 * gone still shows up, flagged as an orphan (type "orphan") — the disk's
 * leftovers are visible here, not hidden.
 *
 * Mirror links (Job.linkedJobId) never double-count: storage reports the
 * PHYSICAL location — a job mirroring a run from another project has its
 * workdir under that other project's directory and simply does not join
 * here.
 *
 * t511 — lifted VERBATIM from the storage route's GET body so the paper
 * face (the Storage dialog, via the route) and the agent face
 * (get_storage_report) drink the same cup: twins fork, imports don't.
 * Returns null when the project row itself is gone (honest absence);
 * genuine walk/db failures throw — the callers word those themselves.
 */
export async function computeStorageReport(id: string): Promise<StorageResponse | null> {
  const project = await db.project.findUnique({ where: { id } });
  if (!project) {
    return null;
  }

  const projectDir = path.join(RELION_DIR, id);
  const hasRuns = existsSync(projectDir);
  const dirNames = hasRuns
    ? readdirSync(projectDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.isSymbolicLink())
        .map((d) => d.name)
        .sort()
    : [];

  // DB join is metadata: dirName ← basename(workdir) of this project's
  // own run records. A mirror link's workdir lives under another
  // project's directory — it must not steal another run's row here.
  const jobs = await db.job.findMany({ where: { projectId: id } });
  const byDirName = new Map<string, RowMeta & { jobId: string }>();
  for (const job of jobs) {
    const record = getRun(job.id);
    const workdir = record?.workdir;
    if (!workdir) continue;
    if (path.dirname(workdir) !== projectDir) continue;
    const dirName = path.basename(workdir);
    if (!byDirName.has(dirName)) {
      byDirName.set(dirName, {
        jobId: job.id,
        name: job.name,
        type: job.type,
        status: job.status,
      });
    }
  }

  const rows: StorageJobRow[] = [];
  const collector = new TopFilesCollector();
  const byCategory: Record<StorageCategoryId, { bytes: number; files: number }> = {
    maps: { bytes: 0, files: 0 },
    stacks: { bytes: 0, files: 0 },
    tables: { bytes: 0, files: 0 },
    logs: { bytes: 0, files: 0 },
    plots: { bytes: 0, files: 0 },
    other: { bytes: 0, files: 0 },
  };
  let totalBytes = 0;
  let totalFiles = 0;
  let truncated = false;

  const pushRow = (dirName: string, usage: DirUsage, meta: RowMeta | null) => {
    const row: StorageJobRow = {
      jobId: meta?.jobId ?? null,
      name: meta?.name ?? dirName,
      type: meta?.type ?? "orphan",
      status: meta?.status ?? "unknown",
      dirName,
      bytes: usage.bytes,
      files: usage.files,
      categories: usage.categories,
      truncated: usage.truncated,
      exists: usage.exists,
    };
    rows.push(row);
    totalBytes += usage.bytes;
    totalFiles += usage.files;
    truncated = truncated || usage.truncated;
    for (const cat of STORAGE_CATEGORIES) {
      byCategory[cat.id].bytes += usage.categories[cat.id].bytes;
      byCategory[cat.id].files += usage.categories[cat.id].files;
    }
  };

  // a metadata lookup that survives the loop below (byDirName is
  // consumed by it) — the file lens joins against this snapshot
  const metaByDir = new Map(byDirName);

  for (const dirName of dirNames) {
    const usage = walkDirUsage(path.join(projectDir, dirName), {
      onFile: (f) =>
        collector.add({
          path: `${dirName}/${f.relPath}`,
          bytes: f.bytes,
          category: f.category,
          dirName,
        }),
    });
    pushRow(dirName, usage, byDirName.get(dirName) ?? null);
    byDirName.delete(dirName);
  }
  // jobs with a record but no physical directory yet — zero rows so the
  // panel answers for every job, not only the ones that ran
  for (const [dirName, meta] of byDirName) {
    pushRow(dirName, emptyDirUsage(), meta);
  }

  rows.sort((a, b) => b.bytes - a.bytes || a.dirName.localeCompare(b.dirName));

  const topFiles: StorageTopFileRow[] = collector.snapshot().map((f) => {
    const meta = metaByDir.get(f.dirName) ?? null;
    return { ...f, jobId: meta?.jobId ?? null, jobName: meta?.name ?? null };
  });

  const body: StorageResponse = {
    projectId: id,
    projectName: project.name,
    totalBytes,
    totalFiles,
    jobs: rows,
    byCategory,
    topFiles,
    truncated: truncated || dirNames.length > WALK_MAX_ENTRIES,
    hasRuns,
    generatedAt: new Date().toISOString(),
  };
  return body;
}

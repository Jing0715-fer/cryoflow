/**
 * disk-walk.ts — t436: the server-side usage walk. Split from
 * disk-usage.ts (the client-safe lens) so the browser never bundles
 * node's fs — see the t436 convergence-run lesson in disk-usage.ts.
 *
 * The walk is symlink-honest exactly like the cleanup walker (t331): a
 * link is LISTED (counted, 0 bytes) and NEVER followed — the input-data
 * doors (t318) must not turn into a walk that circles or double-counts
 * the shared movie bundle. Files that vanish mid-walk are skipped, not
 * errors (the disk is live).
 */

import { readdirSync, statSync } from "fs";
import path from "path";
import { classifyStorageFile, type StorageCategoryId } from "./disk-usage";

/* ------------------------------------------------------------------ */
/* The walk                                                             *//* ------------------------------------------------------------------ */

export interface DirUsage {
  /** symlink entries count here (0 bytes each) but are never followed */
  bytes: number;
  /** every listed entry: files + links + (not) directories */
  files: number;
  categories: Record<StorageCategoryId, { bytes: number; files: number }>;
  /** the WALK_MAX_ENTRIES cap was hit — the panel must say so */
  truncated: boolean;
  /** the directory did not exist at walk time (job never ran locally) */
  exists: boolean;
}

export const WALK_MAX_ENTRIES = 20_000;

function emptyCategories(): Record<StorageCategoryId, { bytes: number; files: number }> {
  return {
    maps: { bytes: 0, files: 0 },
    stacks: { bytes: 0, files: 0 },
    tables: { bytes: 0, files: 0 },
    logs: { bytes: 0, files: 0 },
    plots: { bytes: 0, files: 0 },
    other: { bytes: 0, files: 0 },
  };
}

export function emptyDirUsage(): DirUsage {
  return { bytes: 0, files: 0, categories: emptyCategories(), truncated: false, exists: false };
}

/**
 * Recursive usage walk of one directory. Depth-capped (a workdir is
 * shallow by construction; the cap is a seatbelt, not a design load).
 * `maxEntries` is injectable so the bench can drill the truncation law
 * without building a 20k-file tree.
 */
export function walkDirUsage(
  absDir: string,
  opts: { maxDepth?: number; maxEntries?: number } = {}
): DirUsage {
  const maxDepth = opts.maxDepth ?? 12;
  const maxEntries = opts.maxEntries ?? WALK_MAX_ENTRIES;
  const usage = emptyDirUsage();
  let seen = 0;

  const visit = (dir: string, depth: number): void => {
    if (usage.truncated || depth > maxDepth) return;
    let dirents: import("fs").Dirent[];
    try {
      dirents = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // unreadable branch — the rest of the walk continues
    }
    for (const d of dirents) {
      if (usage.truncated) return;
      if (seen >= maxEntries) {
        usage.truncated = true;
        return;
      }
      seen += 1;
      const child = path.join(dir, d.name);
      if (d.isSymbolicLink()) {
        // a link is a door, not data — counted, 0 bytes, never followed
        usage.files += 1;
        usage.categories.other.files += 1;
        continue;
      }
      if (d.isDirectory()) {
        visit(child, depth + 1);
        continue;
      }
      if (!d.isFile()) continue;
      let size = 0;
      try {
        size = statSync(child).size;
      } catch {
        continue; // vanished mid-walk — the disk is live
      }
      const cat = classifyStorageFile(d.name);
      usage.bytes += size;
      usage.files += 1;
      usage.categories[cat].bytes += size;
      usage.categories[cat].files += 1;
    }
  };

  try {
    readdirSync(absDir); // existence probe — one readdir, same shape as walkLocalRunFiles
    usage.exists = true;
  } catch {
    return usage; // never ran here / already cleaned away — honest zero
  }
  visit(absDir, 0);
  return usage;
}

/**
 * disk-usage.ts — t436: the arithmetic behind the project storage overview.
 *
 * WHY a project-wide storage panel at all: the per-job cleanup dialog
 * (t331) already speaks bytes, but it lives inside ONE job's inspector —
 * "how much disk is this whole project using, and which run is the
 * heaviest" had to be answered by opening inspectors one by one. Cryo-EM
 * disks fill quietly: movies and particle stacks are the whales, and the
 * user finds out from the OS, not from the product.
 *
 * The lens is EXTENSION-HONEST, not job-type-clever: a .mrc file is
 * counted as a map whether it came from PostProcess or Initial Model,
 * because the panel reports what is on disk, not what a job intended.
 * The per-job row carries the job's own name/type for the human context;
 * the category totals never pretend to know more than the extension
 * shows.
 *
 * The walk is symlink-honest exactly like the cleanup walker (t331): a
 * link is LISTED (counted, 0 bytes) and NEVER followed — the input-data
 * doors (t318) must not turn into a walk that circles or double-counts
 * the shared movie bundle. Files that vanish mid-walk are skipped, not
 * errors (the disk is live).
 *
 * World contract: pure fs + strings. The route does the DB join; this
 * module never sees prisma, so the bench can run world-free.
 */

import { readdirSync, statSync } from "fs";
import path from "path";

/* ------------------------------------------------------------------ */
/* Categories — the extension lens                                      */
/* ------------------------------------------------------------------ */

export type StorageCategoryId =
  | "maps"
  | "stacks"
  | "tables"
  | "logs"
  | "plots"
  | "other";

export interface StorageCategoryMeta {
  id: StorageCategoryId;
  label: string;
  /** one line of honesty: what lands in this bucket */
  hint: string;
}

export const STORAGE_CATEGORIES: StorageCategoryMeta[] = [
  { id: "maps", label: "Maps", hint: ".mrc / .map volumes — half maps, sharpened maps, models" },
  { id: "stacks", label: "Stacks", hint: ".mrcs stacks — movies and particle images, the usual whales" },
  { id: "tables", label: "Tables", hint: ".star tables — particles, classifications, postprocess" },
  { id: "logs", label: "Logs", hint: ".out / .err / .log / .txt — run logs and notes" },
  { id: "plots", label: "Plots", hint: ".eps / .png / .jpg / .svg / .pdf — charts and thumbnails" },
  { id: "other", label: "Other", hint: "everything the extension lens cannot name" },
];

/** RELION's own binary-compressed suffixes share the volume bucket. */
function extensionOf(relPath: string): string {
  const base = relPath.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return ""; // ".star" hidden files still named; "no-ext" → ""
  return base.slice(dot + 1).toLowerCase();
}

const MAP_EXTS = new Set(["mrc", "map"]); // .mrc.gz / .map.gz ride the double-extension branch above
const STACK_EXTS = new Set(["mrcs"]);
const TABLE_EXTS = new Set(["star"]);
const LOG_EXTS = new Set(["out", "err", "log", "txt"]);
const PLOT_EXTS = new Set(["eps", "png", "jpg", "jpeg", "svg", "pdf"]);

/** One rule for every file the walk can meet. `other` is the honest rest. */
export function classifyStorageFile(relPath: string): StorageCategoryId {
  const lower = relPath.toLowerCase();
  // double extensions first — extensionOf only sees the LAST segment, so
  // "postprocess.mrc.gz" would otherwise land in `other` as a ".gz"
  if (lower.endsWith(".mrc.gz") || lower.endsWith(".map.gz")) return "maps";
  const ext = extensionOf(relPath);
  if (MAP_EXTS.has(ext)) return "maps";
  if (STACK_EXTS.has(ext)) return "stacks";
  if (TABLE_EXTS.has(ext)) return "tables";
  if (LOG_EXTS.has(ext)) return "logs";
  if (PLOT_EXTS.has(ext)) return "plots";
  return "other";
}

/* ------------------------------------------------------------------ */
/* Formatting — the cleanup dialog's dialect, lifted verbatim           */
/* ------------------------------------------------------------------ */

/** 1024 base, "N B" / one decimal KB·MB / two decimals GB — the same
 * dialect the cleanup dialog (t331) already taught the user. One formatter
 * per app: two byte formats on one screen is a lie about precision. */
export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/* ------------------------------------------------------------------ */
/* The walk                                                             */
/* ------------------------------------------------------------------ */

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

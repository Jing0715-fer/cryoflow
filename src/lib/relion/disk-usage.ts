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
 * The walk (symlink-honest: a link is LISTED at 0 bytes and NEVER
 * followed — the t318 input-data doors must not become a walk that
 * circles) lives in disk-walk.ts, with its truncation and depth laws.
 *
 * World contract: pure strings. This module is CLIENT-SAFE — the storage
 * dialog imports it, so it must never touch node's fs (the t436
 * convergence run caught exactly that mixing: "Can't resolve 'fs'" in
 * the client chunk). The server-side walk lives in disk-walk.ts; the
 * route does the DB join.
 */

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
/* The file lens — t437: heaviest files per category                    */
/* ------------------------------------------------------------------ */

/** One walked file, as the storage panel's lens presents it. `path` is
 *  relative to the PROJECT directory (the first segment is the run
 *  directory's name) so the panel can show it without knowing where the
 *  project lives on disk. */
export interface StorageFileRow {
  path: string;
  bytes: number;
  category: StorageCategoryId;
  /** the top-level directory under data/relion/<projectId>/ this file
   *  lives in — the route joins the job record onto it */
  dirName: string;
}

/** How many file rows the lens shows per category. The runs table answers
 *  "which RUN is the whale"; the lens answers "which FILE is" — eight is
 *  enough to name the whales' whales without shipping the whole walk. */
export const TOP_FILES_PER_CATEGORY = 8;

/**
 * Keeps the heaviest K files per category while the walk streams by.
 *
 * Why a bounded collector at all: a project walk can meet tens of
 * thousands of files, and the lens needs only a handful per category —
 * holding every row just to sort it once would spend memory on rows
 * nobody asked for. The trim is PERIODIC (bucket > 3K → sort + slice),
 * which is amortized O(1) per add and always correct: a trim keeps the
 * then-top K, and any later file big enough to belong still beats the
 * kept floor, so the final snapshot is the true top K.
 *
 * World contract: pure strings and numbers — CLIENT-SAFE, same law as
 * the rest of this module. The walk (disk-walk.ts) feeds it; the route
 * joins the job metadata.
 */
export class TopFilesCollector {
  private buckets = new Map<StorageCategoryId, StorageFileRow[]>();

  constructor(private readonly k: number = TOP_FILES_PER_CATEGORY) {}

  add(file: StorageFileRow): void {
    if (file.bytes <= 0) return; // a 0-byte entry (a counted link, an empty file) is never a whale
    let bucket = this.buckets.get(file.category);
    if (!bucket) {
      bucket = [];
      this.buckets.set(file.category, bucket);
    }
    bucket.push(file);
    if (bucket.length > this.k * 3) {
      bucket.sort((a, b) => b.bytes - a.bytes);
      bucket.length = this.k;
    }
  }

  /** flat list, heaviest first — K per category that ever saw a file */
  snapshot(): StorageFileRow[] {
    const rows: StorageFileRow[] = [];
    for (const bucket of this.buckets.values()) {
      bucket.sort((a, b) => b.bytes - a.bytes);
      rows.push(...bucket.slice(0, this.k));
    }
    rows.sort((a, b) => b.bytes - a.bytes);
    return rows;
  }
}

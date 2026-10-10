/**
 * storage-run-lens.ts — t458: the run lens, the storage board's third view.
 *
 * The board's grammar so far read the disk by CATEGORY first: the map
 * (t436) weighs the runs, the category lens (t437) drills into one
 * category's whale files and feeding runs. But a run IS also a natural
 * first question — "what does Extract (tutorial) actually keep on
 * disk?" — and answering it today means opening the inspector and
 * reading the cleanup planner's tiers, which speaks deletion, not
 * composition. The run lens is the mirror image of the category lens:
 * either dimension first, the same file-level terminus.
 *
 *   project → category (t437) → files
 *   project → run      (t458) → categories → files
 *
 * Laws this module keeps (the family's honesty, restated where it bites):
 *   - PHYSICAL TRUTH: a run's census is what the walk measured, not what
 *     the job intended — an orphan directory (no job record) rides the
 *     census with the same dignity; its doors are the caller's business.
 *   - THE PALETTE HAS AN ORDER: segments and chips come out in
 *     STORAGE_CATEGORIES' own order (maps → stacks → tables → logs →
 *     plots → other), never by size — rows that share an order are
 *     comparable at a glance, and size-ordered palettes jitter.
 *   - THE WHALE LINE SPEAKS FOR THE WALK: it names the heaviest run and
 *     its share of the total the walk measured; a zero walk (or an empty
 *     census) says nothing at all.
 *   - THE LEDGER IS A WHALE LEDGER: the walk ships at most
 *     TOP_FILES_PER_CATEGORY files per category, so a run whose files
 *     are all small may appear here with ZERO file rows while its
 *     directory plainly holds files. That absence is a fact about the
 *     ledger, not a lie about the run — the caller renders it as
 *     "unlisted", amber and honest, never as an empty directory.
 *
 * World contract: pure strings and numbers — CLIENT-SAFE, same law as
 * storage-clean.ts and disk-usage.ts. No store, no fetch, no fs.
 */

import {
  STORAGE_CATEGORIES,
  fmtBytes,
  type StorageCategoryId,
} from "@/lib/relion/disk-usage";

/* ------------------------------------------------------------------ */
/* The census — every run, weighed                                     */
/* ------------------------------------------------------------------ */

/**
 * The shape the run lens reads. Structural on purpose: the storage
 * route's job rows satisfy it outright (extra fields ride along), and
 * the bench can hold it with bare fixtures — the dialog's StorageJobRow
 * is never imported here (route types stay out of client brains).
 */
export interface RunLensRow {
  jobId: string | null;
  name: string;
  dirName: string;
  bytes: number;
  files: number;
  categories: Partial<Record<StorageCategoryId, { bytes: number; files: number }>>;
}

export interface RunCensusEntry<T extends RunLensRow> {
  row: T;
  /** this run's share of the project total, 0–100 (one decimal is the caller's) */
  share: number;
  /** the run's heaviest category, or null when the run holds no bytes */
  topCategory: StorageCategoryId | null;
}

/**
 * The whole-board run census: every run heaviest-first (the API's own
 * dialect — bytes desc, dirName tiebreak), each with its share of the
 * project total and its top category. Orphans ride along with the same
 * dignity as anyone else; a run holding zero bytes keeps its entry
 * (share 0, topCategory null) so the census and the runs table can
 * never disagree about WHO EXISTS.
 */
export function runCensus<T extends RunLensRow>(
  jobs: T[],
  totalBytes: number
): Array<RunCensusEntry<T>> {
  const sorted = [...jobs].sort(
    (a, b) => b.bytes - a.bytes || a.dirName.localeCompare(b.dirName)
  );
  return sorted.map((row) => {
    let topCategory: StorageCategoryId | null = null;
    let topBytes = 0;
    for (const meta of STORAGE_CATEGORIES) {
      const bytes = row.categories[meta.id]?.bytes ?? 0;
      if (bytes > topBytes) {
        topBytes = bytes;
        topCategory = meta.id;
      }
    }
    return {
      row,
      share:
        totalBytes > 0 && row.bytes > 0 ? (row.bytes / totalBytes) * 100 : 0,
      topCategory,
    };
  });
}

/**
 * The summary block's whale line — the one-sentence answer to "where is
 * the disk going". Names the heaviest run, its bytes in the house
 * dialect, and its share of the walk's total. Null when there is
 * nothing to say: no runs, or a walk that measured zero bytes (the
 * line never divides by zero and never names a zero-byte whale).
 */
export function whaleLine<T extends RunLensRow>(
  census: Array<RunCensusEntry<T>>,
  totalBytes: number
): string | null {
  const top = census[0];
  if (!top || totalBytes <= 0 || top.row.bytes <= 0) return null;
  // the house dialect, verbatim from the one formatter (a second byte
  // format on one screen is a lie about precision — disk-usage's law)
  return `The heaviest run — ${top.row.name} — holds ${fmtBytes(top.row.bytes)}, ${top.share.toFixed(0)}% of the project.`;
}

/* ------------------------------------------------------------------ */
/* One run, broken down                                                */
/* ------------------------------------------------------------------ */

export interface RunCategorySlice {
  id: StorageCategoryId;
  bytes: number;
  files: number;
  /** this category's share of the RUN's own bytes, 0–100 */
  share: number;
}

/**
 * One run's category breakdown: every slice above zero bytes, in the
 * palette's own order (STORAGE_CATEGORIES), each with its share of the
 * run's total. The run's bytes are the sum of its own slices by
 * definition of the walk — so the shares always reassemble the run.
 */
export function categoriesOfRun(job: RunLensRow): RunCategorySlice[] {
  const slices: RunCategorySlice[] = [];
  for (const meta of STORAGE_CATEGORIES) {
    const slice = job.categories[meta.id];
    if (!slice || slice.bytes <= 0) continue;
    slices.push({
      id: meta.id,
      bytes: slice.bytes,
      files: slice.files,
      share: job.bytes > 0 ? (slice.bytes / job.bytes) * 100 : 0,
    });
  }
  return slices;
}

export interface StackSegment {
  id: StorageCategoryId;
  /** width hint, percent of the WIDEST run on the board (0–100] */
  pct: number;
}

/**
 * A run row's stacked bar: one segment per above-zero category, in the
 * palette's own order, each sized as a share of the board's widest run
 * (maxBytes) so every row's bar length stays comparable with its
 * neighbors — the same grammar the single-color bars already spoke,
 * colored by where the bytes live.
 */
export function runStackSegments(
  categories: RunLensRow["categories"],
  maxBytes: number
): StackSegment[] {
  if (maxBytes <= 0) return [];
  const segments: StackSegment[] = [];
  for (const meta of STORAGE_CATEGORIES) {
    const bytes = categories[meta.id]?.bytes ?? 0;
    if (bytes <= 0) continue;
    segments.push({ id: meta.id, pct: (bytes / maxBytes) * 100 });
  }
  return segments;
}

/* ------------------------------------------------------------------ */
/* One run's file ledger                                               */
/* ------------------------------------------------------------------ */

/**
 * The shape the ledger reads — the route's top-file rows satisfy it
 * outright. `path` is optional here only so bare bench fixtures can
 * omit it; the dialog's rows carry it (and `jobId`/`jobName` ride
 * along untouched — generic T, the runsForCategory dialect).
 */
export interface RunLedgerFile {
  path?: string;
  bytes: number;
  category: StorageCategoryId;
  dirName: string;
}

/**
 * One run's file ledger: the walk's whale rows that live in THIS run's
 * directory, optionally narrowed to one category, heaviest first (the
 * route already sorted the flat list; a dirName filter preserves that
 * order, but the sort is restated so the contract survives any future
 * route reshuffle). Generic: the caller's richer row type rides along.
 */
export function filesForRun<T extends RunLedgerFile>(
  topFiles: T[],
  dirName: string,
  cat?: StorageCategoryId
): T[] {
  return topFiles
    .filter((f) => f.dirName === dirName && (!cat || f.category === cat))
    .sort((a, b) => b.bytes - a.bytes);
}

/**
 * Why the ledger panel looks the way it does — three honest states:
 *   - "ledger":   rows are on screen; the honesty line says whether
 *                 that is all of the run's files or only its whales;
 *   - "unlisted": the run plainly holds files (files > 0) but none
 *                 made the whale ledger — amber note, never an empty
 *                 directory claim;
 *   - "empty":    the walk counted zero files in the directory — the
 *                 panel may say the directory IS empty.
 */
export type RunLedgerState = "ledger" | "unlisted" | "empty";

export function runLedgerState(
  job: { files: number },
  ledgerCount: number
): RunLedgerState {
  if (ledgerCount > 0) return "ledger";
  return job.files > 0 ? "unlisted" : "empty";
}

/**
 * The ledger's honesty line (the "ledger" state only): when every file
 * the walk counted made the ledger, it says so; when the ledger shows
 * only some, it names both numbers — a partial list that stayed silent
 * about being partial would read as the whole directory.
 */
export function runLedgerLine(ledgerCount: number, diskFiles: number): string {
  if (diskFiles <= 0) return "the walk counted no files in this directory";
  if (ledgerCount >= diskFiles) {
    return `all ${diskFiles.toLocaleString()} file${
      diskFiles === 1 ? "" : "s"
    } on disk made the ledger`;
  }
  return `the heaviest ${ledgerCount} of ${diskFiles.toLocaleString()} file${
    diskFiles === 1 ? "" : "s"
  } on disk — the ledger keeps only each category's whales`;
}

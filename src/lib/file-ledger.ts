/**
 * File ledger export — the t1030 seat of the t1019/t1028/t1029 grammar
 * chain. The job inspector's Files tab carries the workdir's file ledger
 * as a real table (File / Kind / Details / Size, the View and Get columns
 * being RENDERED doors); its bytes could not leave — the reader could
 * screenshot nothing and copy nothing machine-shaped. The builder below
 * is the ledger's ONE father: the paper's cells and the CSV's cells drink
 * the same wells (the kind labels, the details word, the bytes word), and
 * the row KEYS are the paper's OWN head words (the t1019 grammar — the
 * CSV header is the truth on camera).
 *
 * The two door-facing laws this builder carries:
 *   • the t1029 one-grammar law — the CSV speaks the paper's words AND
 *     the paper's cells, cell for cell (the "1,234 rows" word, the
 *     "128³ voxels" word, the "1.5 MB" word); a rendered column never
 *     joins the file (View/Get are doors, not data — the t223 law).
 *   • the t1029 name-address law's ledger shape — file NAMES collide
 *     across runs (every refine emits a run_class001.mrc), so the File
 *     cell speaks the PATH, the listing's unique address (the same word
 *     the paper's cell prints as its machine line); the name rides
 *     inside it as the path's tail.
 */

import type { CsvRow } from "@/lib/chart-export";

/** the ledger's own kind vocabulary — the paper's words (the inspector's
 *  KIND_META reads its labels from HERE: one vocabulary, two faces). */
export type LedgerKind = "mrc" | "star" | "text" | "image";

export const LEDGER_KIND_LABELS: Record<LedgerKind, string> = {
  mrc: "MRC",
  star: "STAR",
  text: "TEXT",
  image: "PLOT",
};

/** the paper's own head words — the row keys below repeat them and the
 *  t1030 unit pins the two faces together. */
export const LEDGER_HEAD = ["File", "Kind", "Details", "Size"] as const;

/** one ledger file — the shape /api/jobs/[id]/outputs walks (the fields
 *  the paper's cells print; remote markers and labels ride along but
 *  only the four head words reach the file). */
export interface LedgerFile {
  path: string;
  name: string;
  kind: LedgerKind;
  size: number;
  slices?: number;
  label?: string;
  rows?: number;
}

/** the Details column's word — the paper's cell computes it inline today
 *  and the CSV re-derivation would be a second father, so the expression
 *  lives HERE and both faces call it (the t215 pctNumAt precedent: one
 *  formula, two surfaces). An .mrcs speaks images, a plain .mrc speaks
 *  the voxel cube, a rowed file speaks its row count with the paper's
 *  own toLocaleString grouping, and an unreadable file speaks — (the
 *  still-measuring word, never a guess). */
export const fileDetailsCell = (f: LedgerFile): string => {
  if (f.kind === "mrc") {
    return f.name.toLowerCase().endsWith(".mrcs")
      ? `${f.slices ?? "?"} images`
      : `${f.slices ?? "?"}³ voxels`;
  }
  if (typeof f.rows === "number") {
    return `${f.rows.toLocaleString()} rows`;
  }
  return "—";
};

/** the Size column's word — the inspector's own byte grammar (whole B,
 *  one-decimal KB/MB, two-decimal GB), extracted so the paper's cell and
 *  the CSV's cell pour from the same well (the seed twin this lib buries:
 *  the component's private copy retired to this import). */
export const ledgerBytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

/** the ledger's rows — the viewed listing in, the paper's own cells out.
 *  Null for an empty view (the doors' hasRows keeps the honest disabled
 *  face — a zero-row file helps nobody). The keys are LEDGER_HEAD: the
 *  CSV header is the paper's own head, the t1019 grammar at the ledger. */
export const fileLedgerRows = (files: LedgerFile[] | null): CsvRow[] | null => {
  if (!files || files.length === 0) return null;
  return files.map((f) => ({
    File: f.path,
    Kind: LEDGER_KIND_LABELS[f.kind] ?? f.kind,
    Details: fileDetailsCell(f),
    Size: ledgerBytes(f.size),
  }));
};

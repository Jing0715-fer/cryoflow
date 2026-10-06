"use client";

/**
 * CryoFlow — STAR table viewer (first/biggest loop block of a RELION
 * STAR file), fetched from /api/jobs/[id]/outputs/star.
 *
 * t492 — the resilience well's second act. This table lives in a dialog
 * the user explicitly OPENED (results-view's STAR chip), so unlike the
 * enhancement panels it may NOT self-hide on failure — a blank dialog
 * is a lie. But its two failure kinds get two different faces, exactly
 * as classifyFetchFailure rules:
 *   - wounded (transient: server busy / restarting / network blip) →
 *     the amber ChartErrorStrip with a Retry chip; the server may
 *     simply come back, so the load is retryable;
 *   - empty (definitive 4xx: the file is gone, the path was refused,
 *     it was never a STAR) → the destructive verdict, kept from the
 *     pre-well days — retrying a 404 would say the same thing twice.
 * The verdict's evidence travels in the hook's `error` even on empty
 * (t492: the reason for an absence is still information).
 *
 * t651 — the table becomes OPERABLE:
 *   - column sort: three-state cycle (native → asc → desc → native) on
 *     every header; numeric-aware sampling (a column whose sampled
 *     cells mostly parseFloat sorts by value, with NaN/empty always at
 *     the tail — a missing defocus is not "minus infinity"); ties
 *     fall back to the file's native order, so equal keys never
 *     shimmer between clicks.
 *   - aria-sort is the a11y contract: the sorted header announces its
 *     direction, the header IS a button (keyboard reachable), the
 *     arrow is decorative (aria-hidden).
 *   - export TSV: the loop block AS DATA from the server's export lane
 *     (?export=tsv, full parsed rows — the 100-row preview is a view
 *     budget, not the file's truth). The sort state is deliberately
 *     NOT exported: sorting is a view aid, the file's native order is
 *     the artifact. Direct <a download> navigation rides the guard's
 *     'none' lane (file-route precedent).
 *
 * t652 — the table reads its own SHAPE (column-width adaptation):
 *   - alignment is typed: a numeric column (the same isNumericColumn
 *     sampling that drives the sort) right-aligns its cells AND its
 *     header — angles, defoci and FOMs become decimal-adjacent and
 *     scannable down the column; string columns (paths, names) keep
 *     the left edge. The row index joins the numeric grammar.
 *   - truncation is never a dead end: a cell longer than the cap keeps
 *     its visible slice but hands the FULL value to title + a help
 *     cursor, and the footer names the affordance — but only when some
 *     cell actually truncated (an honest hint: absent when nothing was
 *     cut). Census t652: the demo world's widest cell is 44 chars
 *     (micrographs.star MicrographName), so in the seeded world the
 *     cap never fires — it is hardening for real user files whose
 *     paths run past a hundred characters.
 */

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Download, Table2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { JobDTO } from "@/lib/types";
import { useChartResource } from "@/lib/use-chart-resource";
import { cn } from "@/lib/utils";
import { ChartErrorStrip } from "./chart-error-strip";

interface StarResponse {
  columns: string[];
  rows: string[][];
  rowCount: number;
  truncated: boolean;
  note?: string;
  fsc?: { resolution: number[]; correlation: number[]; finalResolution?: number };
}

/** Shorten _rlnSomeVeryLongColumnName for the header cell (title keeps the original). */
function shortColumn(col: string): string {
  return col.replace(/^_rln/, "").replace(/([a-z])([A-Z])/g, "$1 $2");
}

/** t652 — the cell cap: past this a cell's visible text is a slice and
 * the full value rides in title (hover to reveal). The demo world's
 * widest cell is 44 chars — this is real-file hardening, not a live
 * behavior there. */
const CELL_CAP = 72;

/** Truncate for display; `full` is non-null exactly when the value was
 * cut (the caller then owes the user a hover reveal). */
function truncateCell(cell: string): { text: string; full: string | null } {
  if (cell.length <= CELL_CAP) return { text: cell, full: null };
  return { text: cell.slice(0, CELL_CAP) + "…", full: cell };
}

type SortDir = "asc" | "desc";

/** t651 — numeric-column detection by sampling: REALION STAR columns are
 * overwhelmingly numeric (defocus, angles, resolutions), but a stray
 * "_rlnMicrographName" string column must NOT collapse to 0s. A column
 * whose sampled cells mostly parseFloat sorts by value; everything else
 * compares as locale strings. */
function isNumericColumn(rows: string[][], col: number): boolean {
  if (rows.length === 0) return false;
  const sample = rows.slice(0, 50);
  let numeric = 0;
  let filled = 0;
  for (const row of sample) {
    const cell = row[col] ?? "";
    if (cell.trim() === "") continue;
    filled++;
    if (Number.isFinite(parseFloat(cell))) numeric++;
  }
  return filled > 0 && numeric / filled >= 0.8;
}

/** t652 — the ALIGNMENT predicate is stricter than the sort's, and on
 * purpose: the two answer different questions. "Can these cells be
 * compared as numbers?" (sort, above) tolerates a numeric PREFIX —
 * "0000001@extract/particles.mrcs" sorts by its particle index, which
 * is the meaningful key. "Does this column READ as numbers?"
 * (alignment, below) may not right-align a 39-character path that
 * happens to start with digits — so a cell qualifies only when it is
 * WHOLLY a number (Number(), not parseFloat). One word, two
 * semantics, two verdicts. */
function isNumericAlignColumn(rows: string[][], col: number): boolean {
  if (rows.length === 0) return false;
  const sample = rows.slice(0, 50);
  let numeric = 0;
  let filled = 0;
  for (const row of sample) {
    const cell = row[col] ?? "";
    if (cell.trim() === "") continue;
    filled++;
    if (Number.isFinite(Number(cell))) numeric++;
  }
  return filled > 0 && numeric / filled >= 0.8;
}

/** t651 — the comparator: NaN/empty ride the tail in BOTH directions
 * (an absence is not a value); ties break on the file's native index
 * so equal keys hold still across re-renders. */
function makeSorter(
  rows: string[][],
  col: number,
  dir: SortDir,
  numeric: boolean
): string[][] {
  const keyed = rows.map((row, i) => ({ row, i, cell: row[col] ?? "" }));
  const flip = dir === "asc" ? 1 : -1;
  keyed.sort((a, b) => {
    const av = a.cell.trim();
    const bv = b.cell.trim();
    const aEmpty = av === "";
    const bEmpty = bv === "";
    if (aEmpty && bEmpty) return a.i - b.i;
    if (aEmpty) return 1; // empties always tail, even descending
    if (bEmpty) return -1;
    if (numeric) {
      const an = parseFloat(av);
      const bn = parseFloat(bv);
      const aNaN = !Number.isFinite(an);
      const bNaN = !Number.isFinite(bn);
      if (aNaN && bNaN) return a.i - b.i;
      if (aNaN) return 1;
      if (bNaN) return -1;
      if (an !== bn) return (an - bn) * flip;
      return a.i - b.i;
    }
    const cmp = av.localeCompare(bv);
    if (cmp !== 0) return cmp * flip;
    return a.i - b.i;
  });
  return keyed.map((k) => k.row);
}

export function StarTable({ job, path }: { job: JobDTO; path: string }) {
  const { status, data, error, retry } = useChartResource<StarResponse>(
    `/api/jobs/${job.id}/outputs/star?path=${encodeURIComponent(path)}&rows=100`
  );

  // t651 — the sort state: null = native order; a column index + dir
  // once the user has engaged a header. Three-state cycle per header.
  const [sort, setSort] = useState<{ col: number; dir: SortDir } | null>(null);

  const numericCols = useMemo(
    () => new Set((data?.columns ?? []).map((_, c) => c).filter((c) => data && isNumericColumn(data.rows, c))),
    [data]
  );

  // t652 — the alignment grammar reads its own, stricter census (see
  // isNumericAlignColumn): this is the predicate that decides which
  // columns' headers and cells right-align.
  const alignNumericCols = useMemo(
    () => new Set((data?.columns ?? []).map((_, c) => c).filter((c) => data && isNumericAlignColumn(data.rows, c))),
    [data]
  );

  const viewRows = useMemo(() => {
    if (!data) return [];
    if (!sort || sort.col >= data.columns.length) return data.rows;
    return makeSorter(data.rows, sort.col, sort.dir, numericCols.has(sort.col));
  }, [data, sort, numericCols]);

  // t652 — the footer hint only speaks when it has something to say:
  // if no cell was cut, "hover to reveal" would be instructions for a
  // problem that does not exist.
  const hasTruncated = useMemo(
    () => viewRows.some((row) => row.some((cell) => (cell ?? "").length > CELL_CAP)),
    [viewRows]
  );

  const exportHref = `/api/jobs/${job.id}/outputs/star?path=${encodeURIComponent(path)}&export=tsv`;

  // transient — retryable, the server may simply be busy
  if (status === "wounded") {
    return <ChartErrorStrip label="STAR table" detail={error ?? undefined} onRetry={retry} />;
  }

  // definitive 4xx — the user opened this dialog on purpose, so the
  // verdict keeps a face (the old destructive grammar); a Retry chip
  // would be a lie here.
  if (status === "empty") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {error ?? "This file can't be read as a STAR table."}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-1.5">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    );
  }

  if (data.columns.length === 0) {
    return (
      <p className="px-1 py-4 text-center text-xs text-muted-foreground">
        {data.note ?? "No table found in this STAR file."}
      </p>
    );
  }

  const cycleSort = (col: number) => {
    setSort((cur) => {
      if (!cur || cur.col !== col) return { col, dir: "asc" };
      if (cur.dir === "asc") return { col, dir: "desc" };
      return null; // back to the file's native order
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-mono">{path}</span>
        <span className="ml-auto">
          {data.columns.length} columns
          {data.note ? ` · ${data.note}` : ""}
        </span>
      </div>
      <div className="max-h-96 overflow-auto rounded-md border">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="border-b bg-muted/95 px-2 py-1.5 text-right font-mono text-[10px] font-semibold text-muted-foreground backdrop-blur">
                #
              </th>
              {data.columns.map((col, c) => {
                const active = sort?.col === c;
                const ariaSort = active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined;
                return (
                  <th
                    key={col}
                    title={col}
                    aria-sort={ariaSort}
                    className={cn(
                      "whitespace-nowrap border-b bg-muted/95 px-2 py-1.5 font-mono text-[10px] font-semibold backdrop-blur",
                      alignNumericCols.has(c) ? "text-right" : "text-left",
                      active ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => cycleSort(c)}
                      className={cn(
                        "-mx-1 inline-flex items-center gap-0.5 rounded px-1 py-0.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        active && "bg-accent/60"
                      )}
                    >
                      {shortColumn(col)}
                      {active ? (
                        sort!.dir === "asc" ? (
                          <ArrowUp className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                        ) : (
                          <ArrowDown className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                        )
                      ) : null}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {viewRows.map((row, i) => (
              <tr key={i} className={cn(i % 2 === 1 && "bg-muted/40", "hover:bg-accent/50")}>
                <td className="px-2 py-1 text-right font-mono text-[11px] text-muted-foreground/70">{i + 1}</td>
                {row.map((cell, j) => {
                  const numeric = alignNumericCols.has(j);
                  const t = truncateCell(cell ?? "");
                  return (
                    <td
                      key={j}
                      title={t.full ?? undefined}
                      className={cn(
                        "whitespace-nowrap px-2 py-1 font-mono text-[11px] text-foreground/90",
                        numeric ? "text-right" : "text-left",
                        t.full && "cursor-help"
                      )}
                    >
                      {t.text}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span>
          showing {viewRows.length} of {data.rowCount} rows
          {data.truncated ? " (truncated)" : ""}
          {sort ? ` · sorted by ${shortColumn(data.columns[sort.col])} ${sort.dir}` : ""}
          {hasTruncated ? " · hover truncated cells (…) for the full value" : ""}
        </span>
        <a
          href={exportHref}
          download
          title="Export the full loop block as TSV (the file's native order — sorting is a view aid)"
          className="ml-auto inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <Download className="h-3 w-3" aria-hidden="true" />
          TSV
        </a>
      </div>
    </div>
  );
}

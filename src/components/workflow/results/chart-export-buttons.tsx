"use client";

import * as React from "react";
import { Check, Copy, FileSpreadsheet, ImageDown, ImageUp, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  chartPngBlob,
  copyPngToClipboard,
  copyTextToClipboard,
  downloadCsv,
  exportChartPng,
  fileSlug,
  rowsToTsv,
  type CsvRow,
} from "@/lib/chart-export";

/**
 * The export affordance every results chart carries in its header, split by
 * DESTINATION: downloads land on disk as files (CSV / 2× PNG), copies land
 * on the clipboard as paste-ready payloads (TSV for spreadsheets / PNG for
 * docs and slides). One raster pipeline feeds both PNG destinations; one
 * row getter feeds both data destinations — four doors, one truth.
 *
 * Locates the PNG root by walking up from itself to the nearest
 * [data-chart-export-root] — charts pass a name and a row getter, nothing
 * else. Empty data stays honest: the data buttons disable (a zero-row file
 * helps nobody) while the PNG buttons stay enabled (an empty-axes frame is
 * still a real snapshot of what the user sees).
 */

const COPIED_MS = 1600;

export function ChartExportButtons({
  name,
  getRows,
  className,
}: {
  /** filename fragment — slugged; the human label appears in toasts */
  name: string;
  /** the chart's rendered rows; null/empty while data is missing */
  getRows: () => CsvRow[] | null;
  className?: string;
}) {
  const [busy, setBusy] = React.useState<"csv" | "png" | "tsv" | "png-clip" | null>(null);
  const [copied, setCopied] = React.useState<"tsv" | "png" | null>(null);
  const copyTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const selfRef = React.useRef<HTMLSpanElement | null>(null);
  const slug = fileSlug(name);

  const flashCopied = (which: "tsv" | "png") => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
    setCopied(which);
    copyTimer.current = setTimeout(() => setCopied(null), COPIED_MS);
  };
  React.useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  const onCsv = () => {
    const rows = getRows();
    if (!rows || rows.length === 0) return;
    setBusy("csv");
    try {
      downloadCsv(`cryoflow-${slug}`, rows);
      toast({
        title: `${name} exported`,
        description: `${rows.length} row${rows.length === 1 ? "" : "s"} → cryoflow-${slug}.csv`,
      });
    } finally {
      setBusy(null);
    }
  };

  const onPng = async () => {
    setBusy("png");
    try {
      const rootEl = selfRef.current?.closest<HTMLElement>("[data-chart-export-root]") ?? null;
      const ok = await exportChartPng(rootEl, `cryoflow-${slug}`);
      if (ok) {
        toast({ title: `${name} exported`, description: `cryoflow-${slug}.png (2× snapshot)` });
      } else {
        toast({
          title: `${name} is not ready`,
          description: "The chart has not rendered yet — try again once the curve appears.",
          variant: "destructive",
        });
      }
    } finally {
      setBusy(null);
    }
  };

  const onTsvCopy = async () => {
    const rows = getRows();
    if (!rows || rows.length === 0) return;
    setBusy("tsv");
    try {
      const ok = await copyTextToClipboard(rowsToTsv(rows));
      if (ok) {
        flashCopied("tsv");
        toast({
          title: `${name} copied`,
          description: `${rows.length} row${rows.length === 1 ? "" : "s"} as TSV — paste straight into a spreadsheet`,
        });
      } else {
        toast({
          title: `${name} could not be copied`,
          description: "Clipboard access was blocked — use the CSV download instead.",
          variant: "destructive",
        });
      }
    } finally {
      setBusy(null);
    }
  };

  const onPngCopy = async () => {
    setBusy("png-clip");
    try {
      const rootEl = selfRef.current?.closest<HTMLElement>("[data-chart-export-root]") ?? null;
      const blob = await chartPngBlob(rootEl);
      if (!blob) {
        toast({
          title: `${name} is not ready`,
          description: "The chart has not rendered yet — try again once the curve appears.",
          variant: "destructive",
        });
        return;
      }
      const ok = await copyPngToClipboard(blob);
      if (ok) {
        flashCopied("png");
        toast({
          title: `${name} copied`,
          description: "2× PNG on the clipboard — paste into docs or slides",
        });
      } else {
        toast({
          title: `${name} could not be copied`,
          description: "Clipboard access was blocked — use the PNG download instead.",
          variant: "destructive",
        });
      }
    } finally {
      setBusy(null);
    }
  };

  const rows = getRows();
  const hasRows = !!rows && rows.length > 0;

  const btnCls =
    "inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-40";

  return (
    <span
      ref={selfRef}
      className={cn("inline-flex items-center gap-0.5 print:hidden", className)}
      data-canvas-ui="chart-export"
      data-chart-name={name}
      data-has-rows={hasRows ? "1" : "0"}
      data-copy-state={copied ?? "idle"}
    >
      <button
        type="button"
        onClick={onCsv}
        disabled={!hasRows || busy !== null}
        title={
          hasRows
            ? `Download the data behind this chart as CSV (cryoflow-${slug}.csv)`
            : "No data to export yet"
        }
        aria-label={`Export ${name} as CSV`}
        data-canvas-ui="chart-export-csv"
        className={btnCls}
      >
        {busy === "csv" ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <FileSpreadsheet className="size-3.5" aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        onClick={() => void onPng()}
        disabled={busy !== null}
        title={`Snapshot this chart as a 2× PNG (cryoflow-${slug}.png)`}
        aria-label={`Export ${name} as PNG`}
        data-canvas-ui="chart-export-png"
        className={btnCls}
      >
        {busy === "png" ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <ImageDown className="size-3.5" aria-hidden="true" />
        )}
      </button>
      {/* downloads land on disk, copies land on the clipboard — a hairline
          keeps the two destination families readable at a glance */}
      <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-border" />
      <button
        type="button"
        onClick={() => void onTsvCopy()}
        disabled={!hasRows || busy !== null}
        title={
          copied === "tsv"
            ? "Copied — paste it wherever you need it"
            : hasRows
              ? "Copy the data behind this chart as TSV — paste straight into a spreadsheet"
              : "No data to copy yet"
        }
        aria-label={`Copy ${name} data as TSV`}
        data-canvas-ui="chart-export-csv-copy"
        className={cn(btnCls, copied === "tsv" && "text-primary")}
      >
        {busy === "tsv" ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : copied === "tsv" ? (
          <Check className="size-3.5" aria-hidden="true" />
        ) : (
          <Copy className="size-3.5" aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        onClick={() => void onPngCopy()}
        disabled={busy !== null}
        title={
          copied === "png"
            ? "Copied — paste it wherever you need it"
            : "Copy this chart as a 2× PNG image — paste into docs or slides"
        }
        aria-label={`Copy ${name} as PNG image`}
        data-canvas-ui="chart-export-png-copy"
        className={cn(btnCls, copied === "png" && "text-primary")}
      >
        {busy === "png-clip" ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : copied === "png" ? (
          <Check className="size-3.5" aria-hidden="true" />
        ) : (
          <ImageUp className="size-3.5" aria-hidden="true" />
        )}
      </button>
    </span>
  );
}

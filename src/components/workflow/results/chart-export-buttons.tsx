"use client";

import * as React from "react";
import { FileSpreadsheet, ImageDown, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { downloadCsv, exportChartPng, fileSlug, type CsvRow } from "@/lib/chart-export";

/**
 * The export affordance every results chart carries in its header: CSV of
 * the chart's own rows + PNG of the chart's own SVG. Locates the PNG root
 * by walking up from itself to the nearest [data-chart-export-root] —
 * charts pass a name and a row getter, nothing else.
 *
 * Empty data stays honest: the CSV button disables (a zero-row file helps
 * nobody) while PNG stays enabled (an empty-axes frame is still a real
 * snapshot of what the user sees).
 */
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
  const [busy, setBusy] = React.useState<"csv" | "png" | null>(null);
  const selfRef = React.useRef<HTMLSpanElement | null>(null);
  const slug = fileSlug(name);

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

  const rows = getRows();
  const hasRows = !!rows && rows.length > 0;

  return (
    <span
      ref={selfRef}
      className={cn("inline-flex items-center gap-0.5 print:hidden", className)}
      data-canvas-ui="chart-export"
      data-chart-name={name}
      data-has-rows={hasRows ? "1" : "0"}
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
        className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-40"
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
        className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-40"
      >
        {busy === "png" ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <ImageDown className="size-3.5" aria-hidden="true" />
        )}
      </button>
    </span>
  );
}

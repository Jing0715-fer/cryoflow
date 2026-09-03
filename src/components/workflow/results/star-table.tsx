"use client";

/**
 * CryoFlow — STAR table viewer (first/biggest loop block of a RELION
 * STAR file), fetched from /api/jobs/[id]/outputs/star.
 */

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Table2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { JobDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

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

export function StarTable({ job, path }: { job: JobDTO; path: string }) {
  const [data, setData] = useState<StarResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setData(null);
    try {
      const res = await fetch(
        `/api/jobs/${job.id}/outputs/star?path=${encodeURIComponent(path)}&rows=100`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setData((await res.json()) as StarResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load STAR file");
    }
  }, [job.id, path]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {error}
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
              <th className="border-b bg-muted/95 px-2 py-1.5 text-left font-mono text-[10px] font-semibold text-muted-foreground backdrop-blur">
                #
              </th>
              {data.columns.map((col) => (
                <th
                  key={col}
                  title={col}
                  className="whitespace-nowrap border-b bg-muted/95 px-2 py-1.5 text-left font-mono text-[10px] font-semibold text-muted-foreground backdrop-blur"
                >
                  {shortColumn(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr key={i} className={cn(i % 2 === 1 && "bg-muted/40", "hover:bg-accent/50")}>
                <td className="px-2 py-1 font-mono text-[11px] text-muted-foreground/70">{i + 1}</td>
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className="whitespace-nowrap px-2 py-1 font-mono text-[11px] text-foreground/90"
                  >
                    {cell.length > 72 ? cell.slice(0, 72) + "…" : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-right text-[11px] text-muted-foreground">
        showing {data.rows.length} of {data.rowCount} rows
        {data.truncated ? " (truncated)" : ""}
      </p>
    </div>
  );
}

"use client";

/**
 * CryoFlow — class occupancy panel for 2D/3D classification jobs
 * (CryoSPARC-style "class distribution"): one horizontal bar per class with
 * particle count + share, best class highlighted, sorted by class number.
 *
 * Data: /api/jobs/[id]/classes counts _rlnClassNumber in the highest
 * run_itXXX_data.star.
 */

import { useEffect, useMemo, useState } from "react";
import { PieChart } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClassOccupancy {
  cls: number;
  count: number;
  fraction: number;
}

interface ClassesResponse {
  classes: ClassOccupancy[];
  total: number;
  iteration: number | null;
}

export function ClassDistributionChart({
  jobId,
  className,
}: {
  jobId: string;
  className?: string;
}) {
  const [data, setData] = useState<ClassesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}/classes`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as ClassesResponse;
        if (!cancelled) {
          setData(body);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const { classes, best } = useMemo(() => {
    const list = data?.classes ?? [];
    let bestCls: number | null = null;
    let bestCount = -1;
    for (const c of list) {
      if (c.count > bestCount) {
        bestCount = c.count;
        bestCls = c.cls;
      }
    }
    return { classes: list, best: bestCls };
  }, [data]);

  if (error && !data) return null; // enhancement, stay silent
  if (classes.length === 0) return null;

  const maxFraction = Math.max(...classes.map((c) => c.fraction), 0.001);
  const total = data?.total ?? 0;

  return (
    <section
      aria-label="Class distribution"
      className={cn(
        "rounded-lg border border-teal-600/25 bg-gradient-to-b from-teal-600/5 to-transparent p-3",
        className
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          <PieChart className="h-3.5 w-3.5 text-teal-600" aria-hidden="true" />
          Class distribution
          <span className="font-normal text-muted-foreground/70">
            ({classes.length} classes · {total.toLocaleString()} particles)
          </span>
        </span>
        {best != null && (
          <span className="rounded-full border border-emerald-600/30 bg-emerald-600/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
            best class {best} · {(maxFraction * 100).toFixed(1)}%
          </span>
        )}
      </div>

      <div className="space-y-1">
        {classes.map((c) => {
          const isBest = c.cls === best;
          const width = Math.max((c.fraction / maxFraction) * 100, 2);
          return (
            <div key={c.cls} className="group flex items-center gap-2">
              <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                class {c.cls}
              </span>
              <div
                className="relative h-4 flex-1 overflow-hidden rounded-sm bg-muted/60"
                role="progressbar"
                aria-label={`class ${c.cls} occupancy`}
                aria-valuenow={Math.round(c.fraction * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={cn(
                    "h-full rounded-sm transition-[width] duration-500",
                    isBest
                      ? "bg-gradient-to-r from-emerald-500/80 to-teal-500/70"
                      : "bg-gradient-to-r from-teal-500/60 to-teal-600/40"
                  )}
                  style={{ width: `${width}%` }}
                />
                <span className="absolute inset-y-0 left-1.5 flex items-center text-[9.5px] font-medium tabular-nums text-foreground/70 group-hover:text-foreground">
                  {c.count.toLocaleString()} · {(c.fraction * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

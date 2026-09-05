"use client";

/**
 * CryoFlow — 2D class selection gallery (the "select good classes" step).
 *
 * The RELION equivalent is a Subset Selection display: class averages on a
 * grid, click classes on/off, downstream jobs only see the survivors. Here
 * the gallery lives in the 2D Class Selection job's parameter panel:
 *   - thumbnails: one slice per class from the Class2D run's
 *     run_unmasked_classes.mrcs (server renders each slice → PNG)
 *   - occupancy bars: /api/jobs/<class2d>/classes counts
 *   - "auto" mode: classes with occupancy ≥ cutoff × best are pre-kept
 *   - manual mode: every click rewrites selectedClasses ("1,2,5") which
 *     auto-saves through the params debounce and feeds the engine run
 */

import { useEffect, useMemo, useState } from "react";
import { Grid2x2Check, Loader2, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EdgeDTO, JobDTO } from "@/lib/types";
import { useWorkflowStore } from "@/lib/store";

interface ClassOccupancy {
  cls: number;
  count: number;
  fraction: number;
}

interface ClassesResponse {
  classes: ClassOccupancy[];
  total: number;
  iteration: number | null;
  classesFile?: string | null;
  classesSlices?: number | null;
}

export function ClassGallery({
  job,
  value,
  cutoff,
  onChange,
}: {
  job: JobDTO;
  /** current selectedClasses param ("auto" | "1,2,5") */
  value: string;
  /** occupancyCutoff param (auto mode) */
  cutoff: number;
  onChange: (next: string) => void;
}) {
  const jobs = useWorkflowStore((s) => s.jobs);
  const edges = useWorkflowStore((s) => s.edges);

  // upstream Class2D job: any incoming edge whose source is a 2D
  // classification run — prefer a completed one when several exist
  const upstream = useMemo(() => {
    const sources = edges
      .filter((e: EdgeDTO) => e.toJobId === job.id)
      .map((e: EdgeDTO) => jobs.find((j) => j.id === e.fromJobId))
      .filter((j): j is JobDTO => j != null && (j.type === "class2d" || j.type === "select2d"));
    return sources.find((j) => j.status === "completed") ?? sources[0] ?? null;
  }, [edges, jobs, job.id]);

  const [data, setData] = useState<ClassesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!upstream) {
      setData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/jobs/${upstream.id}/classes`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as ClassesResponse;
        if (!cancelled) {
          setData(body);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [upstream?.id, upstream?.status]);

  const classes = data?.classes ?? [];
  const isAuto = value.trim() === "auto" || value.trim() === "";

  // effective kept set: "auto" → occupancy rule; manual → parsed list
  const { kept, maxCount } = useMemo(() => {
    const max = Math.max(0, ...classes.map((c) => c.count));
    if (isAuto) {
      const set = new Set(
        classes.filter((c) => c.count >= cutoff * max).map((c) => c.cls)
      );
      return { kept: set, maxCount: max };
    }
    const set = new Set(
      value
        .split(/[,;\s]+/)
        .map((s) => parseInt(s, 10))
        .filter((n) => Number.isFinite(n) && n > 0)
    );
    return { kept: set, maxCount: max };
  }, [classes, isAuto, cutoff, value]);

  const keptCount = classes.filter((c) => kept.has(c.cls)).reduce((a, c) => a + c.count, 0);
  const total = data?.total ?? 0;
  const classesFile = data?.classesFile ?? null;

  const toggle = (cls: number) => {
    // first click in auto mode starts manual editing FROM the auto set —
    // exactly how RELION's subset display feels (auto = suggestion)
    const next = new Set(kept);
    if (next.has(cls)) next.delete(cls);
    else next.add(cls);
    onChange([...next].sort((a, b) => a - b).join(","));
  };

  // ---------------- empty / loading states ----------------
  if (!upstream) {
    return (
      <section
        aria-label="Class selection gallery"
        className="mb-3 rounded-lg border border-dashed bg-secondary/30 p-4 text-center"
      >
        <Grid2x2Check className="mx-auto mb-1.5 size-5 text-muted-foreground" aria-hidden="true" />
        <p className="text-xs font-medium">No 2D classification connected</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          Wire a 2D Classification job&apos;s outputs into this job&apos;s input ports —
          the class gallery appears here once results exist.
        </p>
      </section>
    );
  }

  if (upstream.status !== "completed") {
    return (
      <section
        aria-label="Class selection gallery"
        className="mb-3 rounded-lg border border-dashed bg-secondary/30 p-4 text-center"
      >
        <Grid2x2Check className="mx-auto mb-1.5 size-5 text-muted-foreground" aria-hidden="true" />
        <p className="text-xs font-medium">
          {upstream.status === "running" ? "2D classification is running…" : "Classification not finished yet"}
        </p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
          Source: {upstream.name} — the gallery opens automatically when its class averages land.
        </p>
        {loading && (
          <Loader2 className="mx-auto mt-2 size-4 animate-spin text-teal-600" aria-hidden="true" />
        )}
      </section>
    );
  }

  if (loading && !data) {
    return (
      <section
        aria-label="Class selection gallery"
        className="mb-3 flex items-center justify-center gap-2 rounded-lg border bg-secondary/30 p-4 text-xs text-muted-foreground"
      >
        <Loader2 className="size-4 animate-spin text-teal-600" aria-hidden="true" />
        Loading class averages…
      </section>
    );
  }

  if (error && !data) {
    return (
      <section
        aria-label="Class selection gallery"
        className="mb-3 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-4 text-center"
      >
        <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
          Class gallery unavailable ({error})
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          The run still works with the current parameters.
        </p>
      </section>
    );
  }

  if (classes.length === 0) {
    return (
      <section
        aria-label="Class selection gallery"
        className="mb-3 rounded-lg border border-dashed bg-secondary/30 p-4 text-center text-xs text-muted-foreground"
      >
        No class assignments found in {upstream.name}.
      </section>
    );
  }

  // ---------------- the gallery ----------------
  return (
    <section aria-label="Class selection gallery" className="mb-3 rounded-lg border bg-card">
      {/* header */}
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <Grid2x2Check className="size-3.5 shrink-0 text-teal-600" aria-hidden="true" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Class gallery
        </span>
        <span className="truncate font-mono text-[10px] text-muted-foreground" title={upstream.name}>
          {upstream.name}
          {data?.iteration != null ? ` · iter ${data.iteration}` : ""}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => onChange("auto")}
            aria-pressed={isAuto}
            title={`Auto: keep classes with occupancy ≥ ${cutoff.toFixed(2)} × best class`}
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors",
              isAuto
                ? "bg-teal-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-teal-600/15 hover:text-teal-700 dark:hover:text-teal-300"
            )}
          >
            <Sparkles className="mr-1 inline size-2.5" aria-hidden="true" />
            Auto
          </button>
          <button
            type="button"
            onClick={() => onChange(classes.map((c) => c.cls).join(","))}
            aria-pressed={!isAuto && kept.size === classes.length}
            title="Keep every class"
            className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-teal-600/15 hover:text-teal-700 dark:hover:text-teal-300"
          >
            All
          </button>
          <button
            type="button"
            onClick={() => onChange("1")}
            title="Clear manual selection (keep only class 1 as a starting point)"
            className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-rose-500/15 hover:text-rose-600 dark:hover:text-rose-300"
          >
            None
          </button>
        </div>
      </div>

      {/* the grid */}
      <div
        className={cn(
          "grid gap-2 p-2",
          "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        )}
        style={{ maxHeight: "26rem", overflowY: "auto" }}
      >
        {classes.map((c) => {
          const on = kept.has(c.cls);
          const share = maxCount > 0 ? c.count / maxCount : 0;
          return (
            <button
              key={c.cls}
              type="button"
              onClick={() => toggle(c.cls)}
              aria-pressed={on}
              aria-label={`Toggle class ${c.cls} (${c.count} particles, ${Math.round(c.fraction * 100)}%)`}
              className={cn(
                "group relative overflow-hidden rounded-lg border text-left transition-all",
                on
                  ? "border-teal-500 ring-1 ring-teal-500/40"
                  : "border-border opacity-80 hover:opacity-100 hover:border-teal-500/40"
              )}
            >
              {/* thumbnail — class k is slice k-1 of the averages stack */}
              {classesFile ? (
                <img
                  src={`/api/jobs/${upstream.id}/outputs/file?path=${encodeURIComponent(classesFile)}&format=png&montage=0&slice=${c.cls - 1}`}
                  alt={`Class ${c.cls} average`}
                  loading="lazy"
                  className="aspect-square w-full bg-zinc-950 object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                  }}
                />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center bg-zinc-950 text-[10px] text-zinc-500">
                  no image
                </div>
              )}

              {/* keep badge */}
              <span
                className={cn(
                  "absolute left-1.5 top-1.5 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums shadow-sm",
                  on ? "bg-teal-600 text-white" : "bg-black/60 text-zinc-200"
                )}
              >
                {on ? "✓" : ""}
                {c.cls}
              </span>

              {/* occupancy footer */}
              <div className="space-y-1 bg-background/95 px-2 py-1.5">
                <div className="flex items-center justify-between gap-1">
                  <span className="flex items-center gap-1 font-mono text-[10px] tabular-nums text-muted-foreground">
                    <Users className="size-2.5" aria-hidden="true" />
                    {c.count.toLocaleString()}
                  </span>
                  <span className="font-mono text-[10px] font-semibold tabular-nums">
                    {Math.round(c.fraction * 100)}%
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", on ? "bg-teal-500" : "bg-zinc-400")}
                    style={{ width: `${Math.max(2, Math.round(share * 100))}%` }}
                  />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* footer: effective selection */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t bg-secondary/30 px-3 py-2 text-[11px]">
        <span className="font-semibold">
          {isAuto ? (
            <>
              <Sparkles className="mr-1 inline size-2.5 text-teal-600" aria-hidden="true" />
              Auto selection
            </>
          ) : (
            "Manual selection"
          )}
        </span>
        <span className="text-muted-foreground">
          {isAuto ? `occupancy ≥ ${cutoff.toFixed(2)} × best` : `classes ${[...kept].sort((a, b) => a - b).join(", ") || "—"}`}
        </span>
        <span className="ml-auto rounded-md bg-teal-600/10 px-1.5 py-0.5 font-mono font-semibold tabular-nums text-teal-700 dark:text-teal-300">
          {keptCount.toLocaleString()} / {total.toLocaleString()} particles
          <span className="ml-1 font-normal opacity-70">
            ({total > 0 ? Math.round((100 * keptCount) / total) : 0}%)
          </span>
        </span>
      </div>
    </section>
  );
}

"use client";

/**
 * CryoFlow — class snapshots per iteration, live and after (t350).
 *
 * The user's asks, one component:
 *   「中间过程的结果没有实时展示，希望每一轮的 2D 分类的结果图都要能
 *    及时在本地客户端中显示出来」 — while a REMOTE classification runs,
 *   poll /api/jobs/<id>/iterations (one SSH round, cluster-side awk count)
 *   and show the newest class averages as they land (each iteration's
 *   stack renders to small PNGs on first sight; the MB-scale stack itself
 *   never stays in the local mirror).
 *   「像 cryosparc 一样，每一类的颗粒都有一个单独的 star 文件……直接
 *    选择想要的类进行后续步骤」 — once the job is COMPLETED the same
 *   grid becomes a picker: check classes, choose a downstream type, and
 *   the platform creates the consumer job wired to the source with the
 *   selection in its params (dispatch resolves the per-class stars and
 *   auto-joinstars multiple classes — no manual subset selection).
 */

import React from "react";
import { Check, Loader2, RefreshCw, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useWorkflowStore } from "@/lib/store";
import type { JobDTO, EdgeDTO } from "@/lib/types";

const LIVE_TYPES = new Set(["class2d", "class3d", "refine3d", "initialmodel"]);

interface ClassEntry {
  cls: number;
  count: number;
  fraction: number;
}

interface IterationsResponse {
  remote?: boolean;
  iterations: number[];
  latest: number | null;
  classes: ClassEntry[];
  total: number;
  classesFile: string | null;
  classesSlices: number | null;
  error?: string;
}

/** downstream types offered by source type (the honest set: every pick
 * must be dispatchable with the source's own outputs) */
const DOWNSTREAM: Record<string, Array<{ type: string; label: string }>> = {
  class2d: [
    { type: "initialmodel", label: "Initial Model" },
    { type: "class2d", label: "2D Classification (re-classify)" },
  ],
  class3d: [
    { type: "initialmodel", label: "Initial Model" },
    { type: "refine3d", label: "3D Auto-Refine" },
    { type: "class2d", label: "2D Classification" },
  ],
};

export function ClassIterationGallery({ job, refreshKey = 0 }: { job: JobDTO; refreshKey?: number }) {
  const [data, setData] = React.useState<IterationsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [downstream, setDownstream] = React.useState<string>("");
  const [creating, setCreating] = React.useState(false);
  const running = job.status === "running" || job.status === "pending";

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${job.id}/iterations`, { cache: "no-store" });
      if (!res.ok) {
        setData(null);
        return;
      }
      setData((await res.json()) as IterationsResponse);
    } catch {
      /* network blip — the next poll retries */
    } finally {
      setLoading(false);
    }
  }, [job.id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // running job: poll (the payload itself is 12s-TTL'd server-side, so the
  // cadence here never storms the cluster wire)
  React.useEffect(() => {
    if (!running) return;
    const t = setInterval(() => void load(), 12_000);
    return () => clearInterval(t);
  }, [running, load]);

  // finished job: re-read when the inspector's refresh signal fires
  const firstKey = React.useRef(refreshKey);
  React.useEffect(() => {
    if (refreshKey !== firstKey.current) void load();
  }, [refreshKey, load]);

  const showPicker =
    (job.type === "class2d" || job.type === "class3d") &&
    job.status === "completed" &&
    (data?.classes?.length ?? 0) > 0;
  const options = showPicker ? DOWNSTREAM[job.type] ?? [] : [];
  React.useEffect(() => {
    if (options.length > 0 && !options.some((o) => o.type === downstream)) {
      setDownstream(options[0].type);
    }
  }, [options, downstream]);

  if (!LIVE_TYPES.has(job.type)) return null;

  const toggle = (cls: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cls)) next.delete(cls);
      else next.add(cls);
      return next;
    });
  };

  const createDownstream = async () => {
    if (selected.size === 0 || !downstream) return;
    setCreating(true);
    try {
      // place the consumer under the source on the canvas (the source's own
      // position keeps the lineage readable; the server wires the edge)
      const { jobs } = useWorkflowStore.getState();
      const source = jobs.find((j) => j.id === job.id);
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: downstream,
          x: (source?.x ?? 200) + 60,
          y: (source?.y ?? 320) + 200,
          classStarSelection: { jobId: job.id, classes: [...selected].sort((a, b) => a - b) },
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const body = (await res.json()) as { job: JobDTO; edge?: EdgeDTO };
      const st = useWorkflowStore.getState();
      useWorkflowStore.setState({
        jobs: [...st.jobs, body.job],
        selectedId: body.job.id,
        selectedIds: [body.job.id],
        ...(body.edge && !st.edges.some((e) => e.id === body.edge!.id)
          ? { edges: [...st.edges, body.edge] }
          : {}),
      });
      toast({
        title: "Downstream job created",
        description: `${body.job.name} — consumes class ${[...selected].sort((a, b) => a - b).join(", ")}${
          selected.size > 1 ? ` (auto-joined into one star at dispatch)` : ""
        }. Run it when ready.`,
      });
      setSelected(new Set());
    } catch (err) {
      toast({
        title: "Could not create the downstream job",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        Reading iteration snapshots…
      </div>
    );
  }

  if (!data || (data.classes.length === 0 && !data.classesFile)) {
    if (data?.error) {
      return (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-4 py-3 text-xs text-rose-600 dark:text-rose-400">
          Class snapshots unavailable — {data.error}
        </div>
      );
    }
    return running ? (
      <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        No iteration snapshots on the cluster yet — the first Expectation round is still running (the
        first {`run_it###_classes.mrcs`} appears when round 1 completes).
      </div>
    ) : null;
  }

  const latest = data.latest;
  const sliceTotal = data.classesSlices ?? data.classes.length;

  return (
    <section
      aria-label="Class snapshots per iteration"
      className="rounded-lg border border-border/60 bg-card"
      data-class-iteration-gallery=""
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs">
          <Users className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          <span className="font-medium">Class snapshots</span>
          {latest != null && (
            <span className="font-mono text-[10px] text-muted-foreground">iteration {String(latest).padStart(3, "0")}</span>
          )}
          {data.total > 0 && (
            <span className="font-mono text-[10px] text-muted-foreground">
              {data.total.toLocaleString()} particles assigned
            </span>
          )}
          {running && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 motion-reduce:animate-none" aria-hidden="true" />
              live
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void load()}
          className="h-7 gap-1.5 px-2 text-[11px]"
          aria-label="Refresh class snapshots"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      {/* class grid — latest iteration's averages */}
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {data.classes.map((c) => {
          const sliceIndex = c.cls - 1;
          const hasImage = data.classesFile != null && sliceIndex < sliceTotal;
          const isSelected = selected.has(c.cls);
          return (
            <button
              key={c.cls}
              type="button"
              onClick={showPicker ? () => toggle(c.cls) : undefined}
              className={cn(
                "group relative overflow-hidden rounded-md border bg-background text-left transition-colors",
                showPicker ? "cursor-pointer hover:border-primary/50" : "cursor-default",
                showPicker && isSelected && "border-primary ring-2 ring-primary/30"
              )}
              aria-pressed={showPicker ? isSelected : undefined}
              aria-label={`Class ${c.cls}: ${c.count} particles (${(c.fraction * 100).toFixed(1)}%)${
                showPicker ? " — click to select for the next step" : ""
              }`}
            >
              <div className="aspect-square w-full bg-muted/40">
                {hasImage ? (
                  <img
                    src={`/api/jobs/${job.id}/iterations/image?file=${encodeURIComponent(data.classesFile!)}&slice=${sliceIndex}`}
                    alt={`Class ${c.cls} average`}
                    className="h-full w-full object-contain"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                    no image
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                <span className="font-mono text-[10px] text-muted-foreground">class {c.cls}</span>
                <span className="font-mono text-[10px] font-medium">{(c.fraction * 100).toFixed(1)}%</span>
              </div>
              <div className="h-0.5 w-full bg-muted">
                <div className="h-full bg-primary/70" style={{ width: `${Math.min(100, c.fraction * 100)}%` }} />
              </div>
              {showPicker && (
                <span
                  className={cn(
                    "absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded border transition-colors",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background/80 text-transparent group-hover:border-primary/50"
                  )}
                  aria-hidden="true"
                >
                  <Check className="h-3 w-3" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {showPicker && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border/60 px-4 py-2.5">
          <span className="text-xs text-muted-foreground">
            {selected.size > 0
              ? `${selected.size} class${selected.size === 1 ? "" : "es"} selected · ${selected
                  .size} per-class star${selected.size === 1 ? "" : "s"} feed the next job${selected.size > 1 ? " (auto-joined)" : ""}`
              : "Pick the classes worth keeping — the next job runs on exactly those particles (no subset-selection step)"}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <label className="sr-only" htmlFor="downstream-type">
              Downstream job type
            </label>
            <select
              id="downstream-type"
              value={downstream}
              onChange={(e) => setDownstream(e.target.value)}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs"
            >
              {options.map((o) => (
                <option key={o.type} value={o.type}>
                  {o.label}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              onClick={() => void createDownstream()}
              disabled={creating || selected.size === 0}
              className="h-8 gap-1.5 px-3 text-xs"
              aria-busy={creating}
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
              Continue with {selected.size > 0 ? `${selected.size} class${selected.size === 1 ? "" : "es"}` : "selection"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

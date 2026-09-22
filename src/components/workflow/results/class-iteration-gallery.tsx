"use client";

/**
 * CryoFlow — class snapshots per iteration, live and after (t350 + t354).
 *
 * The user's asks, one component:
 *   「中间过程的结果没有实时展示，希望每一轮的 2D 分类的结果图都要能
 *    及时在本地客户端中显示出来」 (t350) — while a REMOTE classification
 *    runs, poll /api/jobs/<id>/iterations (one SSH round, cluster-side awk
 *    count) and show the newest class averages as they land (each
 *    iteration's stack renders to small PNGs on first sight; the MB-scale
 *    stack itself never stays in the local mirror).
 *   「每一轮的 2D 结果生成一张图片，可以在本地的 UI 中查看」 (t354) —
 *    EVERY round now has its own SHEET: one grid image of that iteration's
 *    whole class-average stack, the way relion_display would show it. A
 *    chips bar picks the round (the newest is followed live while the job
 *    runs), the sheet is pulled lazily on first view, and clicking it opens
 *    the enlarged lightbox with round-to-round keyboard navigation.
 *   「像 cryosparc 一样，每一类的颗粒都有一个单独的 star 文件……直接
 *    选择想要的类进行后续步骤」 — once the job is COMPLETED the class
 *    grid becomes a picker: check classes, choose a downstream type, and
 *    the platform creates the consumer job wired to the source with the
 *    selection in its params (dispatch resolves the per-class stars and
 *    auto-joinstars multiple classes — no manual subset selection).
 */

import React from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, Maximize2, RefreshCw, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useWorkflowStore } from "@/lib/store";
import type { JobDTO, EdgeDTO } from "@/lib/types";

const LIVE_TYPES = new Set(["class2d", "class3d", "refine3d", "initialmodel"]);

/** the stack-name dialect the server validates against (STACK_NAME_RE) */
const STACK_NAME_RE = /^(?:run_it|_it)(\d+)_(?:unmasked_)?classes\.mrcs?$/i;

interface ClassEntry {
  cls: number;
  count: number;
  fraction: number;
}

interface StackEntry {
  iter: number;
  file: string;
}

interface IterationsResponse {
  remote?: boolean;
  iterations: number[];
  latest: number | null;
  classes: ClassEntry[];
  total: number;
  classesFile: string | null;
  classesSlices: number | null;
  /** t354 — every round that has a sheet (or a stack) to view */
  stacks?: StackEntry[];
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

const pad3 = (n: number) => String(n).padStart(3, "0");

export function ClassIterationGallery({ job, refreshKey = 0 }: { job: JobDTO; refreshKey?: number }) {
  const [data, setData] = React.useState<IterationsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [downstream, setDownstream] = React.useState<string>("");
  const [creating, setCreating] = React.useState(false);
  // t354 — the round the sheet shows (null = follow the newest, live)
  const [viewIter, setViewIter] = React.useState<number | null>(null);
  const [sheetLoaded, setSheetLoaded] = React.useState(false);
  const [sheetError, setSheetError] = React.useState<string | null>(null);
  const [sheetRetry, setSheetRetry] = React.useState(0);
  const [zoomOpen, setZoomOpen] = React.useState(false);
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

  // t354 — the rounds with a sheet; tolerate a payload without `stacks`
  // by deriving one entry from the legacy classesFile field
  const stacks: StackEntry[] = React.useMemo(() => {
    if (data?.stacks && data.stacks.length > 0) return data.stacks;
    if (data?.classesFile) {
      const it = Number(STACK_NAME_RE.exec(data.classesFile)?.[1] ?? 0);
      return [{ iter: it, file: data.classesFile }];
    }
    return [];
  }, [data]);
  const newest = stacks.length > 0 ? stacks[stacks.length - 1] : null;
  // pinned rounds fall back to the newest when their chip disappears
  // (a re-dispatch resets the cluster's iteration numbering)
  const current =
    (viewIter != null ? stacks.find((s) => s.iter === viewIter) : undefined) ?? newest;

  // the sheet target changed → fresh loading state (the img remounts via key)
  React.useEffect(() => {
    setSheetLoaded(false);
    setSheetError(null);
  }, [current?.file]);

  // keep the selected chip visible as the bar grows / rounds land
  React.useEffect(() => {
    if (current == null) return;
    document
      .querySelector(`[data-iter-chip="${current.iter}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [current?.iter]);

  // lightbox round navigation — arrows step through the chips, Esc is the
  // Dialog's own; the handler lives on the content so it only fires open
  const stepRound = React.useCallback(
    (dir: 1 | -1) => {
      if (current == null) return;
      const idx = stacks.findIndex((s) => s.iter === current.iter);
      const next = stacks[idx + dir];
      if (next) setViewIter(next.iter);
    },
    [current, stacks]
  );

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

  if (!data || (data.classes.length === 0 && !data.classesFile && stacks.length === 0)) {
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
  const sheetUrl =
    current != null
      ? `/api/jobs/${job.id}/iterations/sheet?file=${encodeURIComponent(current.file)}${
          sheetRetry > 0 ? `&_r=${sheetRetry}` : ""
        }`
      : null;
  const pinnedBehind =
    current != null && newest != null && current.iter !== newest.iter;

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
          {stacks.length > 0 && (
            <span className="font-mono text-[10px] text-muted-foreground">
              {stacks.length} round{stacks.length === 1 ? "" : "s"}
            </span>
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

      {/* t354 — one chip per iteration round; the sheet follows the newest
          while running (viewIter=null) and pins when the user picks a round */}
      {stacks.length > 0 && current != null && (
        <div
          className="flex items-center gap-1.5 overflow-x-auto border-b border-border/60 px-4 py-2"
          role="tablist"
          aria-label="Iteration rounds"
        >
          {stacks.map((s) => {
            const isCurrent = s.iter === current.iter;
            const isNewest = newest != null && s.iter === newest.iter;
            return (
              <button
                key={s.iter}
                type="button"
                role="tab"
                aria-selected={isCurrent}
                data-iter-chip={s.iter}
                onClick={() => setViewIter(s.iter)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                  isCurrent
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/70 bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                it {pad3(s.iter)}
                {running && isNewest && (
                  <span
                    className={cn(
                      "h-1.5 w-1.5 animate-pulse rounded-full motion-reduce:animate-none",
                      isCurrent ? "bg-primary-foreground" : "bg-emerald-500"
                    )}
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
          {pinnedBehind && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewIter(null)}
              className="ml-1 h-6 shrink-0 gap-1 rounded-full px-2 text-[10px]"
              aria-label="Jump back to the latest iteration"
            >
              latest
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
            </Button>
          )}
        </div>
      )}

      {/* t354 — the selected round's SHEET: the whole iteration as ONE grid
          image, pulled lazily on first view (running and finished alike) */}
      {current != null && sheetUrl != null && (
        <div className="p-4" data-sheet-view={current.iter}>
          <button
            type="button"
            onClick={() => setZoomOpen(true)}
            className="group relative block w-full cursor-zoom-in rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            aria-label={`Open iteration ${pad3(current.iter)} class sheet enlarged`}
          >
            {!sheetLoaded && !sheetError && (
              <div className="flex min-h-48 w-full items-center justify-center rounded-md border border-border/60 bg-muted/30">
                <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  Fetching iteration {pad3(current.iter)} from the cluster…
                </span>
              </div>
            )}
            {sheetError != null ? (
              <div className="flex min-h-32 w-full flex-col items-center justify-center gap-2 rounded-md border border-rose-500/30 bg-rose-500/5 px-4 py-6 text-center">
                <span className="text-[11px] text-rose-600 dark:text-rose-400">{sheetError}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-[11px]"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSheetError(null);
                    setSheetLoaded(false);
                    setSheetRetry((n) => n + 1);
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                  Retry
                </Button>
              </div>
            ) : (
              <img
                key={sheetUrl}
                src={sheetUrl}
                alt={`All class averages of iteration ${pad3(current.iter)} in one grid`}
                onLoad={() => setSheetLoaded(true)}
                onError={() =>
                  setSheetError(
                    `could not load the sheet for iteration ${pad3(current.iter)} — the stack may not exist on the cluster`
                  )
                }
                className={cn(
                  "mx-auto max-h-[520px] w-auto max-w-full rounded-md border border-border/60 object-contain transition-opacity duration-300",
                  sheetLoaded ? "opacity-100" : "absolute inset-0 opacity-0"
                )}
              />
            )}
            {sheetLoaded && (
              <span
                className="pointer-events-none absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md bg-background/80 text-foreground opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100"
                aria-hidden="true"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </span>
            )}
          </button>
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            iteration {pad3(current.iter)} · every class average of this round in one sheet
            {running && current.iter === newest?.iter ? " · updates each round" : ""}
          </p>
        </div>
      )}

      {/* class grid — the LATEST round's averages + occupancy (the picker
          once the job completed; numbers come from the newest data star) */}
      {data.classes.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 border-t border-border/60 p-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
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
          {data.classes.length > 0 && latest != null && (
            <p className="px-4 pb-3 text-[10px] text-muted-foreground">
              class grid · latest completed round (it {pad3(latest)}) — occupancy from its data star
            </p>
          )}
        </>
      )}

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

      {/* t354 — the enlarged sheet: round-to-round arrows, keyboard ←/→ */}
      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent
          className="max-h-[94vh] max-w-[min(96vw,1400px)] overflow-hidden sm:max-w-[min(96vw,1400px)]"
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") stepRound(-1);
            else if (e.key === "ArrowRight") stepRound(1);
          }}
        >
          <DialogTitle className="flex items-center gap-2 text-sm">
            Class sheet — iteration {current != null ? pad3(current.iter) : "—"}
            <span className="font-mono text-[10px] font-normal text-muted-foreground">
              {stacks.length} round{stacks.length === 1 ? "" : "s"} available
            </span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Every class average of this iteration round in one grid. Use the arrow buttons or the
            left and right arrow keys to step between rounds.
          </DialogDescription>
          <div className="flex items-stretch gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-auto w-8 shrink-0"
              onClick={() => stepRound(-1)}
              disabled={current == null || stacks[0]?.iter === current.iter}
              aria-label="Previous iteration round"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            {sheetUrl != null && (
              <img
                src={sheetUrl}
                alt={`All class averages of iteration ${current != null ? pad3(current.iter) : ""} in one grid`}
                className="max-h-[74vh] w-auto max-w-full flex-1 rounded-md border border-border/60 object-contain"
              />
            )}
            <Button
              variant="outline"
              size="icon"
              className="h-auto w-8 shrink-0"
              onClick={() => stepRound(1)}
              disabled={current == null || stacks[stacks.length - 1]?.iter === current.iter}
              aria-label="Next iteration round"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

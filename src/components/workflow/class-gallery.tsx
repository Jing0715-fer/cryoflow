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

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Grid2x2Check,
  Loader2,
  Maximize2,
  Sparkles,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EdgeDTO, JobDTO } from "@/lib/types";
import { useWorkflowStore } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

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

  // ---------------- triage views (sort + kept-only) ----------------
  // Real 2D runs spawn 50–200 classes; triage means finding the good ones
  // fast (occupancy sort) and reviewing decisions without the noise
  // (kept-only). Both are VIEW state — they never rewrite the selection.
  const [sortMode, setSortMode] = useState<"class" | "occupancy">("class");
  const [keptOnly, setKeptOnly] = useState(false);

  const rankByCls = useMemo(() => {
    const ordered = [...classes].sort((a, b) => b.count - a.count || a.cls - b.cls);
    return new Map(ordered.map((c, i) => [c.cls, i + 1]));
  }, [classes]);

  /** what the grid shows: kept-only filter applied first, then the sort */
  const visible = useMemo(() => {
    const base = keptOnly ? classes.filter((c) => kept.has(c.cls)) : classes;
    if (sortMode === "class") return [...base].sort((a, b) => a.cls - b.cls);
    // occupancy = rank order (count desc, ties by class number)
    return [...base].sort((a, b) => (rankByCls.get(a.cls) ?? 0) - (rankByCls.get(b.cls) ?? 0));
  }, [classes, kept, keptOnly, sortMode, rankByCls]);

  // ---------------- lightbox (zoom inspection) ----------------
  /** class under inspection in the lightbox — cls number, null = closed.
   *  Navigation walks the VISIBLE order, so ← / → mean what the grid shows. */
  const [zoom, setZoom] = useState<number | null>(null);

  /* ---------- roving tabindex (grid keyboard navigation) ----------
   * A class grid can hold dozens of toggle buttons — tabbing through all
   * of them is a graveyard walk. WAI-ARIA roving pattern: exactly ONE card
   * is in the tab order (tabIndex 0), the arrows move focus between cards
   * geometrically (row/col neighbours of the responsive grid, no column
   * count guessing), Home/End jump to the ends. The zoom sibling stays
   * tabbable so keyboard users still reach the lightbox. */
  const cardRefs = useRef(new Map<number, HTMLButtonElement>());
  const [activeCls, setActiveCls] = useState<number | null>(null);
  useEffect(() => {
    // the active card may vanish (kept-only toggle, sort switch, new data)
    // — re-anchor the roving anchor to the first visible card
    if (activeCls != null && !visible.some((v) => v.cls === activeCls)) {
      setActiveCls(visible[0]?.cls ?? null);
    }
  }, [visible, activeCls]);
  const onGridKeyDown = (e: React.KeyboardEvent) => {
    const NAV = ["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Home", "End"];
    if (!NAV.includes(e.key)) return;
    const cur = document.activeElement as HTMLButtonElement | null;
    const entries = visible
      .map((v) => ({ cls: v.cls, el: cardRefs.current.get(v.cls) }))
      .filter((en): en is { cls: number; el: HTMLButtonElement } => Boolean(en.el));
    if (entries.length === 0) return;
    const rects = entries.map((en) => ({ ...en, r: en.el.getBoundingClientRect() }));
    const curEntry =
      rects.find((en) => en.el === cur) ??
      rects.find((en) => en.cls === activeCls) ??
      rects[0];
    const cx = curEntry.r.left + curEntry.r.width / 2;
    const cy = curEntry.r.top + curEntry.r.height / 2;
    const rowTol = curEntry.r.height / 2;
    const colTol = curEntry.r.width / 2;
    let target: (typeof rects)[number] | undefined;
    switch (e.key) {
      case "ArrowRight":
        target = rects
          .filter((en) => en.r.left > curEntry.r.left + 1 && Math.abs(en.r.top + en.r.height / 2 - cy) < rowTol)
          .sort((a, b) => a.r.left - b.r.left)[0];
        break;
      case "ArrowLeft":
        target = rects
          .filter((en) => en.r.left < curEntry.r.left - 1 && Math.abs(en.r.top + en.r.height / 2 - cy) < rowTol)
          .sort((a, b) => b.r.left - a.r.left)[0];
        break;
      case "ArrowDown":
        target = rects
          .filter((en) => en.r.top > curEntry.r.top + 1 && Math.abs(en.r.left + en.r.width / 2 - cx) < colTol)
          .sort((a, b) => a.r.top - b.r.top)[0];
        break;
      case "ArrowUp":
        target = rects
          .filter((en) => en.r.top < curEntry.r.top - 1 && Math.abs(en.r.left + en.r.width / 2 - cx) < colTol)
          .sort((a, b) => b.r.top - a.r.top)[0];
        break;
      case "Home":
        target = rects[0];
        break;
      case "End":
        target = rects[rects.length - 1];
        break;
    }
    // arrows must never scroll the grid — an edge cell simply holds focus
    e.preventDefault();
    if (target && target.cls !== curEntry.cls) {
      setActiveCls(target.cls);
      target.el.focus();
    }
  };
  const zoomIdx = zoom == null ? -1 : visible.findIndex((c) => c.cls === zoom);
  const zoomClass = zoomIdx >= 0 ? visible[zoomIdx] : null;

  // wrap-around navigation inside the lightbox
  const stepZoom = (dir: 1 | -1) => {
    if (zoomIdx < 0 || visible.length === 0) return;
    const next = visible[(zoomIdx + dir + visible.length) % visible.length];
    setZoom(next.cls);
  };

  // preload the two neighbours so ← / → feels instant — class stacks are
  // small (a few dozen KB per slice), prefetching is effectively free
  useEffect(() => {
    if (zoomIdx < 0 || !classesFile) return;
    for (const d of [1, -1] as const) {
      const n = visible[(zoomIdx + d + visible.length) % visible.length];
      if (!n) continue;
      const img = new Image();
      img.src = `/api/jobs/${upstream.id}/outputs/file?path=${encodeURIComponent(classesFile)}&format=png&montage=0&slice=${n.cls - 1}`;
    }
  }, [zoomIdx, classesFile, visible]);

  // ← / → inside the dialog walk the classes; Radix handles focus trap
  const onLightboxKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      // consume Esc HERE: the canvas-level window handler would otherwise
      // also fire (Radix's document listener doesn't stop propagation) and
      // deselect the job behind the panel — closing the lightbox must not
      // close the gallery the user is mid-selection in
      e.preventDefault();
      e.stopPropagation();
      setZoom(null);
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      stepZoom(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      stepZoom(-1);
    } else if (e.key === "Enter" || e.key === " ") {
      // the keep/discard toggle is the dialog's primary action — make it
      // reachable without hunting for the button (Space scrolls otherwise)
      if (e.target instanceof HTMLElement && ["BUTTON", "INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
      e.preventDefault();
      if (zoomClass) toggle(zoomClass.cls);
    }
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

      {/* view bar: sort + kept-only — triage tools for large K runs */}
      <div
        className="flex flex-wrap items-center gap-1.5 border-b bg-secondary/20 px-3 py-1.5"
        data-canvas-ui="class-viewbar"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Sort
        </span>
        {(["class", "occupancy"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setSortMode(m)}
            aria-pressed={sortMode === m}
            data-canvas-ui={`sort-${m}`}
            title={m === "class" ? "RELION order — by class number" : "Biggest classes first — triage by occupancy"}
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors",
              sortMode === m
                ? "bg-zinc-700 text-white dark:bg-zinc-300 dark:text-zinc-900"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {m === "class" ? "Class #" : "Occupancy"}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setKeptOnly((v) => !v)}
          aria-pressed={keptOnly}
          data-canvas-ui="kept-only"
          title={keptOnly ? "Show every class again" : "Show only the kept classes — review your picks"}
          className={cn(
            "ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors",
            keptOnly
              ? "bg-teal-600 text-white"
              : "bg-muted text-muted-foreground hover:bg-teal-600/15 hover:text-teal-700 dark:hover:text-teal-300"
          )}
        >
          Kept only{kept.size > 0 ? ` · ${kept.size}` : ""}
        </button>
        {visible.length !== classes.length && (
          <span
            className="ml-auto rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-primary"
            data-canvas-ui="class-visible-count"
          >
            showing {visible.length} of {classes.length}
          </span>
        )}
      </div>

      {/* the grid */}
      <div
        data-canvas-ui="class-grid"
        role="listbox"
        aria-label="Class selection grid — arrow keys move between classes, Enter toggles"
        onKeyDown={onGridKeyDown}
        className={cn(
          "grid gap-2 p-2",
          "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        )}
        style={{ maxHeight: "26rem", overflowY: "auto" }}
      >
        {/* visible can never be empty here: an emptied selection aliases
            back to auto ("" ≡ "auto"), so kept-only always has the auto set
            to show — the guaranteed non-emptiness is what lets the lightbox
            navigate without an out-of-range guard */}
        {visible.map((c) => {
          const on = kept.has(c.cls);
          const share = maxCount > 0 ? c.count / maxCount : 0;
          return (
            <div key={c.cls} className="group/cell relative">
            <button
              ref={(el) => {
                if (el) cardRefs.current.set(c.cls, el);
                else cardRefs.current.delete(c.cls);
              }}
              tabIndex={c.cls === (activeCls ?? visible[0]?.cls) ? 0 : -1}
              type="button"
              onClick={() => { setActiveCls(c.cls); toggle(c.cls); }}
              aria-pressed={on}
              aria-label={`Toggle class ${c.cls} (${c.count} particles, ${Math.round(c.fraction * 100)}%)`}
              className={cn(
                "group relative overflow-hidden rounded-lg border text-left transition-all",
                "focus-visible:ring-2 focus-visible:ring-teal-500/60 focus-visible:outline-none",
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

            {/* zoom affordance — a SIBLING of the toggle button (buttons
                cannot nest): overlays the thumbnail's top-right corner on
                hover/focus-within, opens the inspection lightbox */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setZoom(c.cls);
              }}
              aria-label={`Zoom class ${c.cls} — inspect the average full size`}
              title="Inspect full size (← / → to browse)"
              data-canvas-ui="class-zoom"
              className={cn(
                "absolute right-1.5 top-1.5 z-10 grid size-6 place-items-center rounded-md",
                "bg-black/55 text-zinc-100 shadow-sm backdrop-blur-sm",
                "opacity-0 transition-opacity duration-150",
                "group-hover/cell:opacity-100 group-focus-within/cell:opacity-100 focus-visible:opacity-100",
                "hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
              )}
            >
              <Maximize2 className="size-3" aria-hidden="true" />
            </button>
          </div>
          );
        })}
      </div>

      {/* footer: effective selection */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t bg-secondary/30 px-3 py-2 text-[11px]" data-canvas-ui="class-gallery-footer">
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

      {/* ---------------- inspection lightbox ---------------- */}
      <Dialog
        open={zoomClass != null}
        onOpenChange={(o) => {
          if (!o) setZoom(null);
        }}
      >
        <DialogContent
          className="max-w-2xl gap-0 overflow-hidden p-0"
          onKeyDown={onLightboxKey}
          aria-describedby={undefined}
        >
          {zoomClass && (
            <>
              <DialogTitle asChild>
                <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
                  <span
                    className={cn(
                      "grid size-6 place-items-center rounded-md font-mono text-xs font-bold tabular-nums",
                      kept.has(zoomClass.cls)
                        ? "bg-teal-600 text-white"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {zoomClass.cls}
                  </span>
                  <span className="text-sm font-semibold" data-canvas-ui="lightbox-title">
                    Class {zoomClass.cls}
                  </span>
                  {kept.has(zoomClass.cls) ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-teal-600/10 px-2 py-0.5 text-[11px] font-semibold text-teal-700 dark:text-teal-300">
                      <Check className="size-3" aria-hidden="true" />
                      kept
                    </span>
                  ) : (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      discarded
                    </span>
                  )}
                  <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
                    rank #{rankByCls.get(zoomClass.cls) ?? "?"} · {Math.round(zoomClass.fraction * 100)}%
                  </span>
                </div>
              </DialogTitle>
              <DialogDescription className="sr-only">
                Full-size view of class {zoomClass.cls} — {zoomClass.count} particles. Use the arrow
                keys to browse classes, Enter or Space to toggle keeping it.
              </DialogDescription>

              {/* the average — same slice URL as the grid thumbnail, just
                  given room to breathe (render is ≤384 px wide server-side) */}
              <div className="bg-zinc-950 p-4">
                {classesFile ? (
                  <img
                    key={zoomClass.cls}
                    src={`/api/jobs/${upstream.id}/outputs/file?path=${encodeURIComponent(classesFile)}&format=png&montage=0&slice=${zoomClass.cls - 1}`}
                    alt={`Class ${zoomClass.cls} average, full size`}
                    className="mx-auto aspect-square max-h-[26rem] w-auto max-w-full rounded-md object-contain"
                  />
                ) : (
                  <div className="grid aspect-square max-h-64 place-items-center text-xs text-zinc-500">
                    no image available
                  </div>
                )}
              </div>

              {/* footer: browse + decide */}
              <div className="flex flex-wrap items-center gap-2 border-t bg-secondary/30 px-4 py-3">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => stepZoom(-1)}
                    aria-label="Previous class"
                    title="Previous class (←)"
                    className="grid size-7 place-items-center rounded-md border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => stepZoom(1)}
                    aria-label="Next class"
                    title="Next class (→)"
                    className="grid size-7 place-items-center rounded-md border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ChevronRight className="size-4" aria-hidden="true" />
                  </button>
                  <span
                    className="ml-1 font-mono text-xs tabular-nums text-muted-foreground"
                    data-canvas-ui="lightbox-counter"
                  >
                    {zoomIdx + 1} / {visible.length}
                  </span>
                </div>

                <span className="ml-auto flex items-center gap-1.5 font-mono text-xs tabular-nums text-muted-foreground">
                  <Users className="size-3" aria-hidden="true" />
                  {zoomClass.count.toLocaleString()} particles
                </span>

                <button
                  type="button"
                  onClick={() => toggle(zoomClass.cls)}
                  aria-pressed={kept.has(zoomClass.cls)}
                  data-canvas-ui="lightbox-keep"
                  title={kept.has(zoomClass.cls) ? "Remove this class from the selection" : "Add this class to the selection (Enter)"}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    kept.has(zoomClass.cls)
                      ? "bg-teal-600 text-white hover:bg-teal-700"
                      : "border bg-background text-foreground hover:bg-accent"
                  )}
                >
                  {kept.has(zoomClass.cls) ? "Keep class" : "Discarded — keep?"}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

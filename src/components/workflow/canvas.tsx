"use client";

import * as React from "react";
import { useCallback } from "react";
import { Link2, RotateCcw, Wand2, X, ZoomIn, ZoomOut } from "lucide-react";
import {
  CANVAS_H,
  CANVAS_W,
  CARD_H,
  CARD_W,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
  jobType,
  portY,
} from "@/lib/workflow";
import { useWorkflowStore, type PendingFrom } from "@/lib/store";
import type { JobDTO } from "@/lib/types";
import { EdgesLayer } from "./edges-layer";
import { PipelineKpi } from "./pipeline-kpi";
import { CanvasMinimap } from "./canvas-minimap";
import { JobCard } from "./job-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

function CanvasSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center p-8">
      <div className="grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton
            key={i}
            className="h-24 rounded-xl"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

interface PanState {
  pointerId: number;
  lastX: number;
  lastY: number;
  startX: number;
  startY: number;
  moved: boolean;
  /** pending delta since the last rAF flush (pointer events arrive at
   *  device rate — 125–250Hz — but we only render once per frame) */
  pendX: number;
  pendY: number;
}

/**
 * Temporary "live wire" following the cursor while a connection is pending
 * (click-click mode or drag-to-connect). Rendered inside the workspace so
 * it scales with the zoom. Supports both wiring directions: "out" wires
 * start at an output port (right edge), "in" wires start at an input port
 * (left edge). The job-card pulse rings already signal the compatible
 * ports on the other side.
 */
const LiveWire = React.memo(function LiveWire({
  rootRef,
  jobs,
}: {
  rootRef: React.RefObject<HTMLDivElement | null>;
  jobs: JobDTO[];
}) {
  const pendingFrom = useWorkflowStore((s) => s.pendingFrom);
  const [cursor, setCursor] = React.useState<{ x: number; y: number } | null>(null);

  React.useEffect(() => {
    setCursor(null);
    const el = rootRef.current;
    if (!el || !pendingFrom) return;
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const vp = useWorkflowStore.getState().viewport;
      setCursor({
        x: (e.clientX - rect.left - vp.x) / vp.zoom,
        y: (e.clientY - rect.top - vp.y) / vp.zoom,
      });
    };
    el.addEventListener("pointermove", onMove);
    return () => el.removeEventListener("pointermove", onMove);
  }, [pendingFrom, rootRef]);

  if (!pendingFrom || !cursor) return null;
  const job = jobs.find((j) => j.id === pendingFrom.jobId);
  if (!job) return null;
  const spec = jobType(job.type);

  // "out" wires anchor at an output port (right edge); "in" wires anchor
  // at an input port (left edge) and are dragged backwards to an output
  let sx: number;
  let sy: number;
  if (pendingFrom.dir === "in") {
    const inIdx = Math.max(0, spec?.inputs.findIndex((p) => p.name === pendingFrom.port) ?? 0);
    const nIn = Math.max(1, spec?.inputs.length ?? 0);
    sx = job.x;
    sy = job.y + portY(inIdx, nIn);
  } else {
    const outIdx = Math.max(0, spec?.outputs.findIndex((p) => p.name === pendingFrom.port) ?? 0);
    const nOut = Math.max(1, spec?.outputs.length ?? 0);
    sx = job.x + CARD_W;
    sy = job.y + portY(outIdx, nOut);
  }

  // control-point reach — mirrors the bezier geometry used by EdgesLayer
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const reach = Math.max(56, Math.abs(cursor.x - sx) * 0.42);
  // wire direction: "in" wires drag BACKWARD from an input port, so their
  // bezier control points mirror the "out" case
  const pendingDirIn = pendingFrom.dir === "in";

  return (
    <svg
      width={CANVAS_W}
      height={CANVAS_H}
      className="pointer-events-none absolute left-0 top-0"
      aria-hidden="true"
    >
      <circle cx={sx} cy={sy} r={4} fill="var(--primary)" opacity={0.9} />
      <path
        d={
          pendingDirIn
            ? `M ${r2(sx)} ${r2(sy)} C ${r2(sx - reach)} ${r2(sy)}, ${r2(cursor.x + reach)} ${r2(cursor.y)}, ${r2(cursor.x)} ${r2(cursor.y)}`
            : `M ${r2(sx)} ${r2(sy)} C ${r2(sx + reach)} ${r2(sy)}, ${r2(cursor.x - reach)} ${r2(cursor.y)}, ${r2(cursor.x)} ${r2(cursor.y)}`
        }
        stroke="var(--primary)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray="7 5"
        opacity={0.8}
        fill="none"
        className="edge-flow"
      />
      <circle cx={cursor.x} cy={cursor.y} r={3} fill="var(--primary)" opacity={0.55} />
    </svg>
  );
});

export function WorkflowCanvas() {
  const jobs = useWorkflowStore((s) => s.jobs);
  const edges = useWorkflowStore((s) => s.edges);
  const selectedId = useWorkflowStore((s) => s.selectedId);
  const inspectId = useWorkflowStore((s) => s.inspectId);
  const inspect = useWorkflowStore((s) => s.inspect);
  const pendingFrom = useWorkflowStore((s) => s.pendingFrom);
  const viewport = useWorkflowStore((s) => s.viewport);
  const paletteDrag = useWorkflowStore((s) => s.paletteDrag);
  const loading = useWorkflowStore((s) => s.loading);
  const select = useWorkflowStore((s) => s.select);
  const cancelConnect = useWorkflowStore((s) => s.cancelConnect);
  const setViewport = useWorkflowStore((s) => s.setViewport);
  const panBy = useWorkflowStore((s) => s.panBy);
  const applyLayout = useWorkflowStore((s) => s.applyLayout);
  const layoutEpoch = useWorkflowStore((s) => s.layoutEpoch);

  const rootRef = React.useRef<HTMLDivElement>(null);
  const panRef = React.useRef<PanState | null>(null);
  const panRafRef = React.useRef(0);

  React.useEffect(
    () => () => {
      if (panRafRef.current) cancelAnimationFrame(panRafRef.current);
    },
    []
  );

  /** rAF flush — one viewport update per frame regardless of mouse Hz */
  const flushPan = useCallback(() => {
    panRafRef.current = 0;
    const p = panRef.current;
    if (!p || (p.pendX === 0 && p.pendY === 0)) return;
    const { pendX, pendY } = p;
    p.pendX = 0;
    p.pendY = 0;
    panBy(pendX, pendY);
  }, [panBy]);

  /** Frame a workflow bounding box in the viewport (shared by auto-arrange,
   *  the initial-load fit and the focus button). */
  const frameBounds = useCallback(
    (viewW: number, viewH: number, minX: number, minY: number, maxX: number, maxY: number) => {
      const bw = maxX - minX;
      const bh = maxY - minY;
      const zoom = clamp(
        Math.min(viewW / (bw + 96), viewH / (bh + 96), 1),
        ZOOM_MIN,
        1
      );
      setViewport({
        x: (viewW - bw * zoom) / 2 - minX * zoom,
        y: (viewH - bh * zoom) / 2 - minY * zoom,
        zoom: +zoom.toFixed(3),
      });
    },
    [setViewport]
  );

  // inspector "Focus" button: center the requested job in the viewport
  const focusEpoch = useWorkflowStore((s) => s.focusEpoch);
  React.useEffect(() => {
    if (!focusEpoch) return;
    const { focusJobId, jobs } = useWorkflowStore.getState();
    const job = jobs.find((j) => j.id === focusJobId);
    const rect = rootRef.current?.getBoundingClientRect();
    if (!job || !rect) return;
    // a readable zoom: bump very low zooms up so the card is legible
    const zoom = clamp(Math.max(useWorkflowStore.getState().viewport.zoom, 0.7), ZOOM_MIN, 1);
    setViewport({
      x: rect.width / 2 - (job.x + CARD_W / 2) * zoom,
      y: rect.height / 2 - (job.y + CARD_H / 2) * zoom,
      zoom,
    });
  }, [focusEpoch]);

  // The viewport is a pure CSS transform on the workspace — the section must
  // NEVER itself be scrolled. Browsers DO programmatically scroll
  // overflow-hidden ancestors when restoring focus to off-screen elements
  // (e.g. Radix dialogs returning focus to a job card), which would
  // double-offset the view. Pin the section's scroll to 0 whenever that
  // happens.
  React.useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const pin = () => {
      if (el.scrollLeft !== 0 || el.scrollTop !== 0) el.scrollTo(0, 0);
    };
    el.addEventListener("scroll", pin, { passive: true });
    pin();
    return () => el.removeEventListener("scroll", pin);
  }, []);

  // after one-click auto-arrange: frame the whole workflow in the viewport
  React.useEffect(() => {
    if (!layoutEpoch) return;
    const cur = useWorkflowStore.getState().jobs;
    const rect = rootRef.current?.getBoundingClientRect();
    if (cur.length === 0 || !rect) return;
    const minX = Math.min(...cur.map((j) => j.x));
    const maxX = Math.max(...cur.map((j) => j.x + CARD_W));
    const minY = Math.min(...cur.map((j) => j.y));
    const maxY = Math.max(...cur.map((j) => j.y + CARD_H));
    frameBounds(rect.width, rect.height, minX, minY, maxX, maxY);
  }, [layoutEpoch, frameBounds]);

  // frame the workflow ONCE after the initial load (the store viewport resets
  // on reload; without this the canvas would boot showing empty space) —
  // and AGAIN whenever the active project changes: the store resets the
  // viewport to {0,0,1} on switch, so a wide pipeline would otherwise sit
  // top-left and out of view until the user hits zoom-to-fit
  const fittedProject = React.useRef<string | null>(null);
  const projectKey = jobs.length > 0 ? jobs[0].projectId : null;
  React.useEffect(() => {
    if (loading || jobs.length === 0) return;
    if (fittedProject.current === projectKey) return;
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    fittedProject.current = projectKey;
    const minX = Math.min(...jobs.map((j) => j.x));
    const maxX = Math.max(...jobs.map((j) => j.x + CARD_W));
    const minY = Math.min(...jobs.map((j) => j.y));
    const maxY = Math.max(...jobs.map((j) => j.y + CARD_H));
    frameBounds(rect.width, rect.height, minX, minY, maxX, maxY);
  }, [loading, jobs, frameBounds, projectKey]);

  // "Ready" hint: idle job whose upstream (any incoming edge) is completed.
  const completedIds = React.useMemo(
    () => new Set(jobs.filter((j) => j.status === "completed").map((j) => j.id)),
    [jobs]
  );
  const readyIds = React.useMemo(() => {
    const ready = new Set<string>();
    for (const e of edges) {
      if (completedIds.has(e.toJobId) === false && completedIds.has(e.fromJobId)) {
        ready.add(e.toJobId);
      }
    }
    return ready;
  }, [edges, completedIds]);

  const pendingFromType = React.useMemo(
    () => (pendingFrom ? (jobs.find((j) => j.id === pendingFrom.jobId)?.type ?? null) : null),
    [pendingFrom, jobs]
  );
  const pendingJob = pendingFrom ? jobs.find((j) => j.id === pendingFrom.jobId) : undefined;
  const pendingDirIn = pendingFrom?.dir === "in";
  const pendingPortLabel = pendingFrom
    ? (jobType(pendingJob?.type ?? "")?.[
        pendingDirIn ? "inputs" : "outputs"
      ].find((p) => p.name === pendingFrom.port)?.label ??
      pendingFrom.port)
    : "";

  /* ---------------- wheel zoom (zoom-to-cursor, non-passive) -------- */

  React.useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); // React onWheel is passive — hence the raw listener
      const rect = el.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const s = useWorkflowStore.getState();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const nextZoom = clamp(s.viewport.zoom * factor, ZOOM_MIN, ZOOM_MAX);
      // keep the workspace point under the cursor fixed
      const px = (cx - s.viewport.x) / s.viewport.zoom;
      const py = (cy - s.viewport.y) / s.viewport.zoom;
      s.setViewport({
        x: cx - px * nextZoom,
        y: cy - py * nextZoom,
        zoom: nextZoom,
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const zoomAroundCenter = (targetZoom: number) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) {
      setViewport({ zoom: targetZoom });
      return;
    }
    const s = useWorkflowStore.getState();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const nz = clamp(targetZoom, ZOOM_MIN, ZOOM_MAX);
    const px = (cx - s.viewport.x) / s.viewport.zoom;
    const py = (cy - s.viewport.y) / s.viewport.zoom;
    setViewport({ x: cx - px * nz, y: cy - py * nz, zoom: nz });
  };

  /* ---------------- left-drag pan ----------------------------------- */
  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    // Guard: only react to pointer events that physically started inside this
    // canvas DOM subtree. Portaled overlays (context menus, dialogs, hover
    // cards) are DOM children of <body> but React-tree descendants of this
    // <section>, so their pointerdown bubbles here through React and the
    // setPointerCapture below would hijack the subsequent click (menu items
    // would never receive pointerup/click — the classic "menu doesn't
    // respond" bug).
    if (target !== e.currentTarget && !e.currentTarget.contains(target)) return;
    if (target.closest("[data-job]")) return; // cards handle their own drag
    if (target.closest("[data-canvas-ui]")) return; // overlays keep their events
    panRef.current = {
      pointerId: e.pointerId,
      lastX: e.clientX,
      lastY: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      pendX: 0,
      pendY: 0,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const p = panRef.current;
    if (!p || e.pointerId !== p.pointerId) return;
    const dx = e.clientX - p.lastX;
    const dy = e.clientY - p.lastY;
    p.lastX = e.clientX;
    p.lastY = e.clientY;
    if (!p.moved && Math.hypot(e.clientX - p.startX, e.clientY - p.startY) >= 4) {
      p.moved = true;
    }
    if (!p.moved) return;
    // accumulate and flush once per frame — a 125Hz mouse would otherwise
    // trigger 125 viewport re-renders per second
    p.pendX += dx;
    p.pendY += dy;
    if (panRafRef.current === 0) {
      panRafRef.current = requestAnimationFrame(flushPan);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLElement>) => {
    const p = panRef.current;
    if (!p || e.pointerId !== p.pointerId) return;
    if (panRafRef.current) {
      cancelAnimationFrame(panRafRef.current);
      panRafRef.current = 0;
    }
    panRef.current = null;
    // settle any pending sub-frame delta before the state goes away
    if (p.pendX !== 0 || p.pendY !== 0) {
      const { pendX, pendY } = p;
      p.pendX = 0;
      p.pendY = 0;
      panBy(pendX, pendY);
    }
    if (p.moved) return;
    // click without movement on the background
    const s = useWorkflowStore.getState();
    if (s.pendingFrom) s.cancelConnect();
    else s.select(null);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLElement>) => {
    const p = panRef.current;
    if (!p || e.pointerId !== p.pointerId) return;
    panRef.current = null;
    if (panRafRef.current) {
      cancelAnimationFrame(panRafRef.current);
      panRafRef.current = 0;
    }
  };

  const zoom = viewport.zoom;

  /* ---------------- background context menu ------------------------- */

  const zoomToFit = () => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect || jobs.length === 0) return;
    const minX = Math.min(...jobs.map((j) => j.x));
    const maxX = Math.max(...jobs.map((j) => j.x + CARD_W));
    const minY = Math.min(...jobs.map((j) => j.y));
    const maxY = Math.max(...jobs.map((j) => j.y + CARD_H));
    frameBounds(rect.width, rect.height, minX, minY, maxX, maxY);
  };

  const resetView = () => setViewport({ x: 0, y: 0, zoom: 1 });

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <section
          ref={rootRef}
          data-canvas="viewport"
          aria-label="Workflow canvas"
          className="no-drag-select relative min-w-0 flex-1 touch-none overflow-hidden bg-background active:cursor-grabbing cursor-grab"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
      {loading && jobs.length === 0 ? (
        <CanvasSkeleton />
      ) : (
        <div
          data-canvas="workspace"
          className="canvas-grid absolute left-0 top-0"
          style={{
            width: CANVAS_W,
            height: CANVAS_H,
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            // keep the dot grid at a constant ~22px on screen
            backgroundSize: `${(22 / zoom).toFixed(2)}px ${(22 / zoom).toFixed(2)}px`,
          }}
        >
          <EdgesLayer edges={edges} jobs={jobs} />
          <LiveWire rootRef={rootRef} jobs={jobs} />
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              selected={selectedId === job.id}
              zoom={zoom}
              pendingFrom={pendingFrom}
              pendingFromType={pendingFromType}
              isReady={
                job.status === "idle" && readyIds.has(job.id) && !completedIds.has(job.id)
              }
              inspected={inspectId === job.id}
              onSelect={select}
              onInspect={inspect}
              onDragCommit={moveJobCommitProxy}
              onStartConnect={setPendingFromProxy}
              onCancelConnect={cancelConnect}
              onConnect={connectProxy}
            />
          ))}
        </div>
      )}

      {/* Pipeline overview KPI bar (top-left) */}
      <PipelineKpi />

      {/* Bird's-eye navigation map (bottom-right) */}
      <CanvasMinimap rootRef={rootRef} />

      {/* Drop hint while dragging a job type from the palette */}
      {paletteDrag && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-3 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-primary/40 bg-primary/5"
        >
          <p className="card-lift rounded-full bg-card/95 px-3 py-1.5 text-xs font-medium text-primary">
            Drop to place {jobType(paletteDrag)?.label ?? paletteDrag}
          </p>
        </div>
      )}

      {/* Connect-mode hint */}
      {pendingFrom && pendingJob && (
        <div
          data-canvas-ui="connect-hint"
          className="card-lift absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium shadow-sm"
        >
          <Link2 className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span className="whitespace-nowrap">
            Linking <span className="text-primary">{pendingJob.name}</span>
            <span className="hidden text-muted-foreground sm:inline">
              {" "}
              · {pendingPortLabel} ·{" "}
              {pendingDirIn
                ? "drop on a matching output port ◉"
                : "click a matching input port"}{" "}
              · ESC to cancel
            </span>
          </span>
          <button
            type="button"
            onClick={cancelConnect}
            aria-label="Cancel connection"
            className="rounded-full p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && jobs.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-xl border border-dashed bg-card/60 px-6 py-5 text-center backdrop-blur-sm">
            <p className="text-sm font-medium">The canvas is empty</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Drag a job type from the palette onto the canvas to start building
              your workflow.
            </p>
          </div>
        </div>
      )}

      {/* Zoom controls + auto-arrange */}
      <div
        data-canvas-ui="zoom-controls"
        className="card-lift absolute bottom-3 left-3 z-30 flex items-center gap-0.5 rounded-lg border bg-card/95 p-1 backdrop-blur"
      >
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => zoomAroundCenter(zoom - ZOOM_STEP)}
          disabled={zoom <= ZOOM_MIN}
          aria-label="Zoom out"
        >
          <ZoomOut className="size-4" />
        </Button>
        <span className="w-11 text-center text-xs font-medium tabular-nums text-muted-foreground">
          {Math.round(zoom * 100)}%
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => zoomAroundCenter(zoom + ZOOM_STEP)}
          disabled={zoom >= ZOOM_MAX}
          aria-label="Zoom in"
        >
          <ZoomIn className="size-4" />
        </Button>
        <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => setViewport({ x: 0, y: 0, zoom: 1 })}
          aria-label="Reset view"
          title="Reset zoom and pan"
        >
          <RotateCcw className="size-4" />
        </Button>
        <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => void applyLayout()}
          aria-label="Auto-arrange workflow"
          title="Auto-arrange workflow"
        >
          <Wand2 className="size-4" />
        </Button>
      </div>
        </section>
      </ContextMenuTrigger>

      {/* background menu — right-click empty canvas (cards open their own) */}
      <ContextMenuContent className="w-56">
        <ContextMenuLabel>
          Canvas · {jobs.length} job{jobs.length === 1 ? "" : "s"}
        </ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={zoomToFit} disabled={jobs.length === 0}>
          <ZoomIn />
          Zoom to fit workflow
        </ContextMenuItem>
        <ContextMenuItem onClick={resetView}>
          <RotateCcw />
          Reset view (100%)
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => void applyLayout()}
          disabled={jobs.length === 0}
        >
          <Wand2 />
          Tidy layout
        </ContextMenuItem>
        {pendingFrom ? (
          <ContextMenuItem onClick={cancelConnect}>
            <X />
            Cancel pending connection
          </ContextMenuItem>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  );
}

/* ------------------------------------------------------------------ */
/* Stable store-action proxies (props for memoized JobCards)           */
/* ------------------------------------------------------------------ */

const moveJobCommitProxy = (id: string, x: number, y: number) => {
  void useWorkflowStore.getState().moveJobCommit(id, x, y);
};
const setPendingFromProxy = (pending: PendingFrom) => {
  useWorkflowStore.getState().setPendingFrom(pending);
};
const connectProxy = (from: string, to: string, fromPort: string, toPort: string) => {
  void useWorkflowStore.getState().connect(from, to, fromPort, toPort);
};

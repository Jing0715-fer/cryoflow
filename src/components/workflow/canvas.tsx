"use client";

import * as React from "react";
import { Link2, RotateCcw, ZoomIn, ZoomOut, X } from "lucide-react";
import {
  CANVAS_W,
  CANVAS_H,
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_STEP,
} from "@/lib/workflow";
import { useWorkflowStore } from "@/lib/store";
import { EdgesLayer } from "./edges-layer";
import { JobCard } from "./job-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

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

export function WorkflowCanvas() {
  const jobs = useWorkflowStore((s) => s.jobs);
  const edges = useWorkflowStore((s) => s.edges);
  const selectedId = useWorkflowStore((s) => s.selectedId);
  const pendingFrom = useWorkflowStore((s) => s.pendingFrom);
  const zoom = useWorkflowStore((s) => s.zoom);
  const loading = useWorkflowStore((s) => s.loading);
  const setZoom = useWorkflowStore((s) => s.setZoom);
  const select = useWorkflowStore((s) => s.select);
  const setPendingFrom = useWorkflowStore((s) => s.setPendingFrom);
  const cancelConnect = useWorkflowStore((s) => s.cancelConnect);
  const moveJobCommit = useWorkflowStore((s) => s.moveJobCommit);
  const connect = useWorkflowStore((s) => s.connect);

  const scrollRef = React.useRef<HTMLDivElement>(null);

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

  const handleBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.target as HTMLElement;
    if (!el.dataset.canvas) return;
    if (pendingFrom) cancelConnect();
    else select(null);
  };

  const resetView = () => {
    setZoom(1);
    scrollRef.current?.scrollTo({ left: 0, top: 0, behavior: "smooth" });
  };

  return (
    <section
      aria-label="Workflow canvas"
      className="relative min-w-0 flex-1 overflow-hidden"
    >
      {loading && jobs.length === 0 ? (
        <CanvasSkeleton />
      ) : (
        <div
          ref={scrollRef}
          data-canvas="scroll"
          className="h-full w-full overflow-auto bg-background"
          onClick={handleBackgroundClick}
        >
          <div
            data-canvas="sizer"
            className="relative"
            style={{ width: CANVAS_W * zoom, height: CANVAS_H * zoom }}
          >
            <div
              data-canvas="workspace"
              className="canvas-grid absolute left-0 top-0"
              style={{
                width: CANVAS_W,
                height: CANVAS_H,
                transform: `scale(${zoom})`,
                transformOrigin: "0 0",
              }}
            >
              <EdgesLayer edges={edges} jobs={jobs} />
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  selected={selectedId === job.id}
                  zoom={zoom}
                  pendingFrom={pendingFrom}
                  isReady={
                    job.status === "idle" &&
                    readyIds.has(job.id) &&
                    !completedIds.has(job.id)
                  }
                  onSelect={select}
                  onDragCommit={moveJobCommit}
                  onStartConnect={setPendingFrom}
                  onConnect={connect}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Connect-mode hint */}
      {pendingFrom && (
        <div className="card-lift absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs font-medium shadow-sm">
          <Link2 className="size-3.5 text-primary" aria-hidden="true" />
          <span className="whitespace-nowrap">
            Select a target job&rsquo;s input port
            <span className="hidden text-muted-foreground sm:inline">
              {" "}
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
              Add a job type from the palette to start building your workflow.
            </p>
          </div>
        </div>
      )}

      {/* Zoom controls */}
      <div className="card-lift absolute bottom-3 left-3 z-30 flex items-center gap-0.5 rounded-lg border bg-card/95 p-1 backdrop-blur">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => setZoom(clamp(+(zoom - ZOOM_STEP).toFixed(2), ZOOM_MIN, ZOOM_MAX))}
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
          onClick={() => setZoom(clamp(+(zoom + ZOOM_STEP).toFixed(2), ZOOM_MIN, ZOOM_MAX))}
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
          onClick={resetView}
          aria-label="Reset view"
          title="Reset zoom and scroll position"
        >
          <RotateCcw className="size-4" />
        </Button>
      </div>
    </section>
  );
}

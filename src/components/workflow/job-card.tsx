"use client";

import * as React from "react";
import { CANVAS_W, CANVAS_H, CARD_W, CARD_H, jobType } from "@/lib/workflow";
import { useWorkflowStore } from "@/lib/store";
import type { JobDTO } from "@/lib/types";
import { TypeIcon } from "./icons";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Shared bits (also used by the details panel)                        */
/* ------------------------------------------------------------------ */

export const STATUS_STYLES: Record<string, string> = {
  idle: "border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-400",
  running:
    "border-teal-400/60 text-teal-700 dark:border-teal-500/50 dark:text-teal-300",
  completed:
    "border-emerald-400/60 text-emerald-700 dark:border-emerald-500/50 dark:text-emerald-300",
  failed: "border-rose-400/60 text-rose-700 dark:border-rose-500/50 dark:text-rose-300",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 gap-1 rounded-full px-2 text-[10px] font-medium capitalize",
        STATUS_STYLES[status] ?? STATUS_STYLES.idle
      )}
    >
      {status === "running" && (
        <span className="animate-soft-pulse inline-block size-1.5 rounded-full bg-teal-500" />
      )}
      {status === "completed" && (
        <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
      )}
      {status}
    </Badge>
  );
}

export function MiniProgress({
  value,
  running,
  label,
}: {
  value: number;
  running?: boolean;
  label: string;
}) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={label}
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
    >
      <div
        className={cn(
          "h-full rounded-full bg-primary transition-[width] duration-500 ease-out",
          running && "progress-shimmer"
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Job card                                                            */
/* ------------------------------------------------------------------ */

interface JobCardProps {
  job: JobDTO;
  selected: boolean;
  zoom: number;
  pendingFrom: string | null;
  isReady: boolean;
  onSelect: (id: string) => void;
  onDragCommit: (id: string, x: number, y: number) => void;
  onStartConnect: (id: string) => void;
  onConnect: (from: string, to: string) => void;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  moved: boolean;
}

export const JobCard = React.memo(function JobCard({
  job,
  selected,
  zoom,
  pendingFrom,
  isReady,
  onSelect,
  onDragCommit,
  onStartConnect,
  onConnect,
}: JobCardProps) {
  const spec = jobType(job.type);

  const cardRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<DragState | null>(null);
  const rafRef = React.useRef(0);
  const suppressClickRef = React.useRef(false);

  const connectMode = pendingFrom != null;
  const isSource = pendingFrom === job.id;

  React.useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-port]")) return; // ports handle their own events
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: job.x,
      origY: job.y,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    if (!d.moved) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (cardRef.current) {
        cardRef.current.style.transform = `translate(${dx / zoom}px, ${dy / zoom}px)`;
      }
      // Edges follow the card in real time (transient store slice — no re-render of cards)
      useWorkflowStore
        .getState()
        .setDragLive({ id: job.id, dx: dx / zoom, dy: dy / zoom });
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    dragRef.current = null;
    cancelAnimationFrame(rafRef.current);
    if (cardRef.current) cardRef.current.style.transform = "";
    // clear live offset first; the optimistic commit below updates x/y in the
    // same React batch, so connected edges land on the final position with no snap-back
    useWorkflowStore.getState().setDragLive(null);
    if (d.moved) {
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      const nx = Math.min(Math.max(d.origX + dx / zoom, 0), CANVAS_W - CARD_W);
      const ny = Math.min(Math.max(d.origY + dy / zoom, 0), CANVAS_H - CARD_H);
      suppressClickRef.current = true;
      onDragCommit(job.id, Math.round(nx), Math.round(ny));
    }
  };

  const handleClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onSelect(job.id);
  };

  const handleInputPortClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pendingFrom && pendingFrom !== job.id) onConnect(pendingFrom, job.id);
  };

  const handleOutputPortClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isSource) onStartConnect(job.id);
  };

  return (
    <div
      className="absolute"
      style={{ left: job.x, top: job.y, width: CARD_W, height: CARD_H }}
    >
      {/* Card body (clipped, so the color bar follows the rounded corners) */}
      <div
        ref={cardRef}
        role="button"
        tabIndex={0}
        aria-label={`${job.name}, ${job.status}`}
        className={cn(
          "card-lift no-drag-select absolute inset-0 cursor-grab overflow-hidden rounded-xl border bg-card active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          selected ? "border-primary ring-2 ring-primary/60" : "hover:border-primary/50"
        )}
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(job.id);
          }
        }}
      >
        {/* Category color bar */}
        <div
          className={cn("absolute inset-y-0 left-0 w-1 opacity-80", spec?.color.bg)}
          aria-hidden="true"
        />

        <div className="flex h-full flex-col justify-center gap-1.5 pl-4 pr-3">
          {/* Row 1: icon + name */}
          <div className="flex items-center gap-1.5">
            <TypeIcon
              name={spec?.icon ?? "Boxes"}
              className={cn("size-4 shrink-0", spec?.color.text)}
            />
            <p className="truncate text-sm font-medium leading-none" title={job.name}>
              {job.name}
            </p>
          </div>

          {/* Row 2: status + type */}
          <div className="flex items-center gap-1.5">
            <StatusBadge status={job.status} />
            <span className="truncate text-[11px] text-muted-foreground">
              {spec?.key ?? job.type}
            </span>
          </div>

          {/* Row 3: progress / result / ready hint */}
          <div className="h-4">
            {job.status === "running" ? (
              <MiniProgress value={job.progress} running label={`${job.name} progress`} />
            ) : job.status === "completed" ? (
              <p className="truncate text-[11px] leading-4 text-muted-foreground" title={job.result ?? undefined}>
                {job.result}
              </p>
            ) : job.status === "failed" ? (
              <p
                className="truncate text-[11px] leading-4 text-rose-600 dark:text-rose-400"
                title={job.result ?? "Run failed — check logs"}
              >
                {job.result ?? "Run failed — check logs"}
              </p>
            ) : isReady ? (
              <p className="flex items-center gap-1 text-[11px] leading-4 text-emerald-700 dark:text-emerald-300">
                <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
                Ready
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Input port (left edge) */}
      <button
        data-port="in"
        type="button"
        aria-label={`Input port of ${job.name}`}
        className={cn(
          "port-dot absolute -left-2 top-1/2 z-10 size-3 -translate-y-1/2 rounded-full border-2 bg-background",
          spec?.color.border,
          connectMode && !isSource && "animate-pulse ring-2 ring-primary ring-offset-1"
        )}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={handleInputPortClick}
      />

      {/* Output port (right edge) */}
      <button
        data-port="out"
        type="button"
        aria-label={`Output port of ${job.name}`}
        className={cn(
          "port-dot absolute -right-2 top-1/2 z-10 size-3 -translate-y-1/2 rounded-full border-2 bg-background",
          spec?.color.border,
          connectMode && !isSource && "animate-pulse ring-2 ring-primary ring-offset-1",
          isSource && "scale-125 border-primary bg-primary"
        )}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={handleOutputPortClick}
      />
    </div>
  );
});

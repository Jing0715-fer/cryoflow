"use client";

import * as React from "react";
import {
  CANVAS_H,
  CANVAS_W,
  CARD_H,
  CARD_W,
  PORT_COLORS,
  jobType,
  portY,
  portsCompatible,
} from "@/lib/workflow";
import { useWorkflowStore, type PendingFrom } from "@/lib/store";
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
  /** Pending connection source ({jobId, port}) or null. */
  pendingFrom: PendingFrom | null;
  /** Type key of the pending source job (for port compatibility pulses). */
  pendingFromType: string | null;
  isReady: boolean;
  onSelect: (id: string) => void;
  onDragCommit: (id: string, x: number, y: number) => void;
  onStartConnect: (pending: PendingFrom) => void;
  onCancelConnect: () => void;
  onConnect: (from: string, to: string, fromPort: string, toPort: string) => void;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  moved: boolean;
}

/** Drag-to-connect state on an output port. */
interface PortDragState {
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
  /** Pending connection already active on this exact port when pressed. */
  wasPending: boolean;
  port: string;
}

/**
 * Structure (fixes the "port circles lag behind" bug):
 *
 *   outer (absolute, data-job, left/top, CARD_W x CARD_H)
 *     wrapper (absolute inset-0, touch-action none, receives the drag
 *              transform so the card body AND its ports move together)
 *       card body (rounded, clipped, keyboard focusable)
 *       input/output port buttons (positioned on the wrapper edges)
 */
export const JobCard = React.memo(function JobCard({
  job,
  selected,
  zoom,
  pendingFrom,
  pendingFromType,
  isReady,
  onSelect,
  onDragCommit,
  onStartConnect,
  onCancelConnect,
  onConnect,
}: JobCardProps) {
  const spec = jobType(job.type);
  const inputs = spec?.inputs ?? [];
  const outputs = spec?.outputs ?? [];

  const cardRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<DragState | null>(null);
  const portDragRef = React.useRef<PortDragState | null>(null);
  const rafRef = React.useRef(0);
  const [dragging, setDragging] = React.useState(false);

  const isSource = pendingFrom?.jobId === job.id;

  React.useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  /* ---------------- card drag (whole node incl. ports) ------------- */

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
    if (!d.moved && Math.abs(dx) + Math.abs(dy) > 3) {
      d.moved = true;
      setDragging(true);
    }
    if (!d.moved) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (cardRef.current) {
        cardRef.current.style.transform = `translate(${dx / zoom}px, ${dy / zoom}px)`;
      }
      // Edges follow the card in real time (transient store slice —
      // no re-render of the cards themselves).
      useWorkflowStore
        .getState()
        .setDragLive({ id: job.id, dx: dx / zoom, dy: dy / zoom });
    });
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>, d: DragState) => {
    cancelAnimationFrame(rafRef.current);
    if (cardRef.current) cardRef.current.style.transform = "";
    // clear live offset first; the optimistic commit below updates x/y in
    // the same React batch, so connected edges land with no snap-back.
    useWorkflowStore.getState().setDragLive(null);
    setDragging(false); // no-op re-render when it was already false
    if (d.moved) {
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      const nx = Math.min(Math.max(d.origX + dx / zoom, 0), CANVAS_W - CARD_W);
      const ny = Math.min(Math.max(d.origY + dy / zoom, 0), CANVAS_H - CARD_H);
      onDragCommit(job.id, Math.round(nx), Math.round(ny));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    dragRef.current = null;
    if (d.moved) {
      endDrag(e, d);
    } else {
      // plain click on the card body → select
      onSelect(job.id);
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    dragRef.current = null;
    endDrag(e, { ...d, moved: false });
  };

  /* ---------------- ports: connect flows --------------------------- */

  /** Click-click: click a compatible input port to finish the connection. */
  const handleInPortClick = (e: React.MouseEvent, portName: string) => {
    e.stopPropagation();
    if (!pendingFrom || pendingFrom.jobId === job.id) return;
    onConnect(pendingFrom.jobId, job.id, pendingFrom.port, portName);
  };

  /**
   * Drag-to-connect (preferred): press an output port, drag onto an input
   * port anywhere on the canvas, release. A plain click keeps the pending
   * connection alive for the click-click flow; clicking the source port
   * again cancels it.
   */
  const handleOutPortPointerDown = (e: React.PointerEvent<HTMLButtonElement>, portName: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const wasPending = pendingFrom?.jobId === job.id && pendingFrom.port === portName;
    portDragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      wasPending,
      port: portName,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (!wasPending) onStartConnect({ jobId: job.id, port: portName });
  };

  const handleOutPortPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = portDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 4) {
      d.moved = true;
    }
  };

  const handleOutPortPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = portDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    portDragRef.current = null;
    if (d.moved) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const portEl = el?.closest("[data-port]") as HTMLElement | null;
      const portId = portEl?.dataset.port;
      const targetJobId = (portEl?.closest("[data-job]") as HTMLElement | null)?.dataset.job;
      if (portId?.startsWith("in:") && targetJobId && targetJobId !== job.id) {
        // store validates port compatibility + cycles and clears pending on success
        onConnect(job.id, targetJobId, d.port, portId.slice(3));
        return;
      }
      // drag missed a valid target → cancel the pending connection
      onCancelConnect();
    } else if (d.wasPending) {
      // clicked the pending source port again → cancel
      onCancelConnect();
    }
    // else: first click on an output port → keep pending (click-click mode)
  };

  const handleOutPortPointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = portDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    portDragRef.current = null;
  };

  /** Keyboard fallback for the output ports (Enter / Space). */
  const handleOutPortKeyDown = (e: React.KeyboardEvent, portName: string) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (pendingFrom?.jobId === job.id && pendingFrom.port === portName) {
      onCancelConnect();
    } else {
      onStartConnect({ jobId: job.id, port: portName });
    }
  };

  /* ---------------- render ------------------------------------------ */

  const portLabelChip = (label: string) => (
    <span className="pointer-events-none absolute bottom-full left-1/2 mb-0.5 -translate-x-1/2 whitespace-nowrap rounded border bg-card px-1.5 py-0.5 text-[10px] font-medium text-card-foreground opacity-0 shadow-sm transition-opacity duration-100 group-hover/port:opacity-100">
      {label}
    </span>
  );

  return (
    <div
      data-job={job.id}
      className="absolute"
      style={{
        left: job.x,
        top: job.y,
        width: CARD_W,
        height: CARD_H,
        zIndex: selected ? 30 : dragging ? 20 : 10,
      }}
    >
      {/* transform host: card body + ports move together (zero lag) */}
      <div
        ref={cardRef}
        className="absolute inset-0"
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {/* Card body (clipped so the color bar follows the rounded corners) */}
        <div
          role="button"
          tabIndex={0}
          aria-label={`${job.name} — ${spec?.label ?? job.type}, ${job.status}`}
          className={cn(
            "card-lift no-drag-select absolute inset-0 cursor-grab overflow-hidden rounded-xl border bg-card outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing",
            selected ? "border-primary ring-2 ring-primary/60" : "hover:border-primary/50"
          )}
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
                <p
                  className="truncate text-[11px] leading-4 text-muted-foreground"
                  title={job.result ?? undefined}
                >
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

        {/* Input ports (left edge, hollow) */}
        {inputs.map((p, i) => {
          const compatible =
            pendingFrom != null &&
            !isSource &&
            pendingFromType != null &&
            portsCompatible(pendingFromType, pendingFrom.port, job.type, p.name);
          return (
            <button
              key={p.name}
              data-port={`in:${p.name}`}
              type="button"
              aria-label={`${p.label} — input port of ${job.name}`}
              className="group/port absolute z-10 flex size-4 cursor-crosshair items-center justify-center outline-none focus-visible:rounded-full focus-visible:ring-2 focus-visible:ring-ring"
              style={{ left: -8, top: portY(i, inputs.length) - 8 }}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => handleInPortClick(e, p.name)}
            >
              <span
                className={cn(
                  "block size-3 rounded-full border-2 bg-background transition-[scale,box-shadow] duration-100 group-hover/port:scale-125",
                  spec?.color.border,
                  compatible && "animate-pulse ring-2 ring-primary ring-offset-1 ring-offset-background"
                )}
              />
              {portLabelChip(p.label)}
            </button>
          );
        })}

        {/* Output ports (right edge, filled with the port-kind color) */}
        {outputs.map((p, i) => {
          const isPendingSource = isSource && pendingFrom?.port === p.name;
          return (
            <button
              key={p.name}
              data-port={`out:${p.name}`}
              type="button"
              aria-label={`${p.label} — output port of ${job.name}`}
              className="group/port absolute z-10 flex size-4 cursor-crosshair items-center justify-center outline-none focus-visible:rounded-full focus-visible:ring-2 focus-visible:ring-ring"
              style={{ right: -8, top: portY(i, outputs.length) - 8 }}
              onPointerDown={(e) => handleOutPortPointerDown(e, p.name)}
              onPointerMove={handleOutPortPointerMove}
              onPointerUp={handleOutPortPointerUp}
              onPointerCancel={handleOutPortPointerCancel}
              onKeyDown={(e) => handleOutPortKeyDown(e, p.name)}
            >
              <span
                className={cn(
                  "block size-3 rounded-full border-2 border-transparent transition-[scale,box-shadow,background-color,border-color] duration-100 group-hover/port:scale-125",
                  p.kind ? PORT_COLORS[p.kind].dot : "bg-slate-500",
                  isPendingSource && "scale-125 border-primary bg-primary"
                )}
              />
              {portLabelChip(p.label)}
            </button>
          );
        })}
      </div>
    </div>
  );
});

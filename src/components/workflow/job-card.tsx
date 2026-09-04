"use client";

import * as React from "react";
import {
  Check,
  ClipboardCopy,
  Copy,
  Loader2,
  Locate,
  Maximize2,
  Play,
  RotateCcw,
  SquarePen,
  Trash2,
} from "lucide-react";
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
import type { JobDTO, JobTypeSpec, ParamValue } from "@/lib/types";
import { TypeIcon } from "./icons";
import { Badge } from "@/components/ui/badge";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  className,
}: {
  value: number;
  running?: boolean;
  label: string;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={label}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
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
/* Running-job ETA (localStorage progress baseline → incremental rate)  */
/* ------------------------------------------------------------------ */

/**
 * ETA from the observed pace of THIS session: the first time we see a run
 * (jobId+startedAt) we store a progress baseline; once progress advances we
 * extrapolate remaining = Δtime/Δprogress × (100−progress). This stays
 * honest across --continue resumes (startedAt resets, progress doesn't) —
 * a naive elapsed÷progress badly underestimates those.
 */
const ETA_KEY = "cryoflow-eta-baselines";

interface EtaBaseline {
  startedAt: string;
  p0: number;
  at: number;
}

function readBaselines(): Record<string, EtaBaseline> {
  try {
    const raw = localStorage.getItem(ETA_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, EtaBaseline>) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** Milliseconds left, or null when not yet estimable (no observed pace). */
export function estimateEta(jobId: string, startedAt: string | null, progress: number): number | null {
  if (!startedAt || !Number.isFinite(progress) || progress < 5 || progress >= 100) return null;
  if (typeof window === "undefined") return null;
  const now = Date.now();
  const baselines = readBaselines();
  let b = baselines[jobId];
  // fresh run, resumed run, or progress regressed (reset) → new baseline
  if (!b || b.startedAt !== startedAt || b.p0 > progress + 0.01) {
    b = { startedAt, p0: progress, at: now };
    try {
      baselines[jobId] = b;
      localStorage.setItem(ETA_KEY, JSON.stringify(baselines));
    } catch {
      /* private mode etc. — pace tracking simply won't persist */
    }
    return null; // no pace observed yet
  }
  const dP = progress - b.p0;
  const dT = now - b.at;
  if (dP >= 0.5 && dT > 20_000) {
    const remaining = (dT / dP) * (100 - progress);
    return remaining > 30_000 ? remaining : null;
  }
  return null; // progress hasn't moved since the baseline — keep waiting
}

/** "~3h 5m" / "~12m" / "~45s" style compact ETA text. */
export function formatEta(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 90) return `~${s}s`;
  const m = Math.round(s / 60);
  if (m < 90) return `~${m}m`;
  const h = Math.floor(m / 60);
  return `~${h}h ${m % 60}m`;
}

/** Hydration-safe "now" gate — ETA only renders after mount. */
export function useMounted(): boolean {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return mounted;
}

/* ------------------------------------------------------------------ */
/* Right-click context menu (wraps the whole card)                     */
/* ------------------------------------------------------------------ */

/**
 * Right-click / Shift+F10 menu on a job card. Mirrors the interactions the
 * card + inspector already expose (open · focus · run · reset · duplicate ·
 * delete) so power users never need to hunt for buttons. Store actions are
 * pulled straight from the zustand store — no prop drilling.
 */
function JobCardMenu({
  job,
  onSelect,
  onInspect,
  children,
}: {
  job: JobDTO;
  onSelect: (id: string) => void;
  onInspect: (id: string) => void;
  children: React.ReactNode;
}) {
  const runJob = useWorkflowStore((s) => s.runJob);
  const resetJob = useWorkflowStore((s) => s.resetJob);
  const deleteJob = useWorkflowStore((s) => s.deleteJob);
  const duplicateJob = useWorkflowStore((s) => s.duplicateJob);
  const focusJob = useWorkflowStore((s) => s.focusJob);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState(false);

  const idle = job.status === "idle";
  const running = job.status === "running";

  const copyId = () => {
    void navigator.clipboard.writeText(job.id).then(() => {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 1400);
    });
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-60">
        <ContextMenuLabel className="flex items-center gap-2 pr-3">
          <span className="truncate font-semibold">{job.name}</span>
          <span className="ml-auto shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {job.status}
          </span>
        </ContextMenuLabel>
        <ContextMenuSeparator />

        <ContextMenuItem
          onClick={() => (idle ? onSelect(job.id) : onInspect(job.id))}
        >
          {idle ? <SquarePen /> : <Maximize2 />}
          {idle ? "Edit parameters" : "Open inspector"}
          <ContextMenuShortcut>Enter</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => focusJob(job.id)}>
          <Locate />
          Focus on canvas
        </ContextMenuItem>

        <ContextMenuSeparator />
        <ContextMenuItem
          disabled={running || busy}
          onClick={() => {
            setBusy(true);
            void runJob(job.id).finally(() => setBusy(false));
          }}
        >
          {busy ? <Loader2 className="animate-spin" /> : <Play />}
          {idle ? "Run job" : running ? "Running…" : "Re-run"}
        </ContextMenuItem>
        {!idle && !running ? (
          <ContextMenuItem
            onClick={() => void resetJob(job.id).then(() => onSelect(job.id))}
          >
            <RotateCcw />
            Reset &amp; edit
          </ContextMenuItem>
        ) : null}
        <ContextMenuItem onClick={() => void duplicateJob(job.id)}>
          <Copy />
          Duplicate
        </ContextMenuItem>
        <ContextMenuItem onClick={copyId}>
          {copiedId ? <Check /> : <ClipboardCopy />}
          {copiedId ? "Copied!" : "Copy job ID"}
        </ContextMenuItem>

        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
          <Trash2 />
          Delete…
        </ContextMenuItem>
      </ContextMenuContent>

      {/* delete confirm — cascades edges, so require an explicit OK */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {job.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the job and every connection attached to it. Files
              already written to the workdir stay on disk.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep job</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => void deleteJob(job.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ContextMenu>
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
  /** True while this job is open in the large inspector modal. */
  inspected: boolean;
  onSelect: (id: string) => void;
  /** Opens the large inspector modal (submitted jobs only). */
  onInspect: (id: string) => void;
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

/** Drag-to-connect state on a port (output ports drag out→in, input ports drag in→out). */
interface PortDragState {
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
  /** Pending connection already active on this exact port when pressed. */
  wasPending: boolean;
  port: string;
  /** "out": pressed an output port · "in": pressed an input port ·
   *  "complete": pressed a port while a pending wire from ANOTHER job
   *  targets this port kind — plain click finishes that connection. */
  mode: "out" | "in" | "complete";
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
/* ------------------------------------------------------------------ */
/* Hover preview — n8n-style peek without leaving the canvas           */
/* ------------------------------------------------------------------ */

function paramPreviewValue(v: ParamValue | undefined): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v === "boolean") return v ? "on" : "off";
  if (typeof v === "number")
    return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return String(v);
}

/** Key parameters for the hover card — numeric levers first (they drive
 *  the run), capped at 3 rows, label from the GUI schema. */
function previewParams(job: JobDTO, spec: JobTypeSpec | undefined) {
  const seen = new Set<string>();
  const rows: { label: string; value: string }[] = [];
  const ordered = [...(spec?.params ?? [])].sort((a, b) => {
    const an = typeof job.params[a.key] === "number" ? 0 : 1;
    const bn = typeof job.params[b.key] === "number" ? 0 : 1;
    return an - bn;
  });
  for (const p of ordered) {
    if (seen.has(p.key)) continue;
    const v = paramPreviewValue(job.params[p.key]);
    if (v == null) continue;
    seen.add(p.key);
    rows.push({ label: p.label.replace(/\s*\(.*?\)\s*/g, "").trim(), value: v });
    if (rows.length >= 3) break;
  }
  return rows;
}

function JobCardPreview({
  job,
  spec,
  etaText,
}: {
  job: JobDTO;
  spec: JobTypeSpec | undefined;
  etaText: string | null;
}) {
  const params = previewParams(job, spec);
  return (
    <HoverCardContent
      side="top"
      align="start"
      sideOffset={10}
      className="w-60 p-0 overflow-hidden"
    >
      <div className="border-b bg-muted/40 px-3 py-2">
        <p className="truncate text-xs font-semibold">{job.name}</p>
        <p className="truncate text-[10px] text-muted-foreground">
          {spec?.label ?? job.type}
        </p>
      </div>
      <div className="space-y-2 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <StatusBadge status={job.status} />
          {job.status === "running" ? (
            <span className="text-[10px] font-semibold tabular-nums text-teal-600 dark:text-teal-400">
              {Math.round(job.progress)}%
              {etaText ? ` · ${etaText} left` : ""}
            </span>
          ) : null}
        </div>
        {job.status === "running" ? (
          <MiniProgress value={job.progress} running label={`${job.name} progress`} />
        ) : null}
        {(job.status === "completed" || job.status === "failed") && job.result ? (
          <p
            className={cn(
              "line-clamp-2 rounded border px-2 py-1.5 text-[10.5px] leading-snug",
              job.status === "failed"
                ? "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            )}
            title={job.result}
          >
            {job.result}
          </p>
        ) : null}
        {params.length > 0 ? (
          <div className="space-y-1">
            {params.map((p) => (
              <div
                key={p.label}
                className="flex items-baseline justify-between gap-2 text-[10.5px]"
              >
                <span className="truncate text-muted-foreground">{p.label}</span>
                <span className="shrink-0 font-mono font-medium tabular-nums">{p.value}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <p className="border-t bg-muted/30 px-3 py-1.5 text-[9.5px] text-muted-foreground">
        {job.status === "idle"
          ? "Click to edit parameters · right-click for actions"
          : "Click to open the inspector · right-click for actions"}
      </p>
    </HoverCardContent>
  );
}

export const JobCard = React.memo(function JobCard({
  job,
  selected,
  zoom,
  pendingFrom,
  pendingFromType,
  isReady,
  inspected,
  onSelect,
  onInspect,
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

  // Running-job ETA (client-only gate keeps SSR output hydration-safe)
  const mounted = useMounted();
  const etaText = React.useMemo(() => {
    if (!mounted || job.status !== "running") return null;
    const eta = estimateEta(job.id, job.startedAt, job.progress);
    return eta != null ? formatEta(eta) : null;
  }, [mounted, job.status, job.id, job.startedAt, job.progress]);

  React.useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  /* ---------------- card drag (whole node incl. ports) ------------- */

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    // Ignore events from portaled overlays (hover-card previews etc.) that
    // are React-tree descendants of this div but live in <body> DOM-wise —
    // otherwise the capture below hijacks their clicks (see canvas.tsx).
    if (target !== e.currentTarget && !e.currentTarget.contains(target)) return;
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
      // plain click on the card body — idle jobs open the editing panel,
      // submitted jobs (running/completed/failed) open the big inspector
      if (job.status === "idle") onSelect(job.id);
      else onInspect(job.id);
    }
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    dragRef.current = null;
    endDrag(e, { ...d, moved: false });
  };

  /* ---------------- ports: connect flows --------------------------- */

  /**
   * Pointer resolution helper: which [data-port] did the pointer land on?
   * Returns null unless it is a port of ANOTHER job.
   */
  const resolveReleasePort = (
    e: React.PointerEvent
  ): { jobId: string; kind: "in" | "out"; port: string } | null => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const portEl = el?.closest("[data-port]") as HTMLElement | null;
    const portId = portEl?.dataset.port;
    const targetJobId = (portEl?.closest("[data-job]") as HTMLElement | null)?.dataset.job;
    if (!portId || !targetJobId || targetJobId === job.id) return null;
    if (portId.startsWith("in:")) return { jobId: targetJobId, kind: "in", port: portId.slice(3) };
    if (portId.startsWith("out:")) return { jobId: targetJobId, kind: "out", port: portId.slice(4) };
    return null;
  };

  /* -------- output ports: drag out→in, click-click, complete in→out --- */

  const handleOutPortPointerDown = (e: React.PointerEvent<HTMLButtonElement>, portName: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    // pending wire started from an INPUT port of another job → pressing this
    // output port may finish it (plain click) instead of starting a new wire
    const completesIn =
      pendingFrom?.dir === "in" && pendingFrom.jobId !== job.id;
    const wasPending =
      !completesIn && pendingFrom?.jobId === job.id && pendingFrom.port === portName;
    portDragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      wasPending,
      port: portName,
      mode: completesIn ? "complete" : "out",
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (!wasPending && !completesIn) {
      onStartConnect({ jobId: job.id, port: portName, dir: "out" });
    }
  };

  const handlePortPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = portDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 5) {
      d.moved = true;
    }
  };

  const handleOutPortPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = portDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    portDragRef.current = null;
    if (d.mode === "complete") {
      // finish a pending input→output wire from another job
      if (!d.moved && pendingFrom) {
        onConnect(pendingFrom.jobId, job.id, d.port, pendingFrom.port);
        return;
      }
      if (d.moved) {
        // dragging away from this output port = classic out→in wiring
        const rel = resolveReleasePort(e);
        if (rel?.kind === "in") {
          onConnect(job.id, rel.jobId, d.port, rel.port);
          return;
        }
      }
      onCancelConnect();
      return;
    }
    if (d.moved) {
      const rel = resolveReleasePort(e);
      if (rel?.kind === "in") {
        // store validates port compatibility + cycles and clears pending on success
        onConnect(job.id, rel.jobId, d.port, rel.port);
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

  /** Keyboard fallback for the output ports (Enter / Space). */
  const handleOutPortKeyDown = (e: React.KeyboardEvent, portName: string) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (pendingFrom?.dir === "in" && pendingFrom.jobId !== job.id) {
      // finish a pending input→output wire from another job
      onConnect(pendingFrom.jobId, job.id, portName, pendingFrom.port);
    } else if (pendingFrom?.jobId === job.id && pendingFrom.port === portName) {
      onCancelConnect();
    } else {
      onStartConnect({ jobId: job.id, port: portName, dir: "out" });
    }
  };

  /* -------- input ports: drag in→out, click-click, complete out→in --- */

  const handleInPortPointerDown = (e: React.PointerEvent<HTMLButtonElement>, portName: string) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    // pending wire started from an OUTPUT port of another job → pressing this
    // input port may finish it (plain click / drag-to-it) instead of starting
    // a reverse wire
    const completesOut =
      pendingFrom != null && pendingFrom.dir !== "in" && pendingFrom.jobId !== job.id;
    const wasPending =
      !completesOut &&
      pendingFrom?.jobId === job.id &&
      pendingFrom.port === portName &&
      pendingFrom.dir === "in";
    portDragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      wasPending,
      port: portName,
      mode: completesOut ? "complete" : "in",
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (!wasPending && !completesOut) {
      onStartConnect({ jobId: job.id, port: portName, dir: "in" });
    }
  };

  const handleInPortPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = portDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    portDragRef.current = null;
    if (d.mode === "complete") {
      // finish a pending output→input wire from another job
      if (!d.moved && pendingFrom) {
        onConnect(pendingFrom.jobId, job.id, pendingFrom.port, d.port);
        return;
      }
    }
    if (d.moved) {
      // reverse wiring: released over an output port of another job
      const rel = resolveReleasePort(e);
      if (rel?.kind === "out") {
        onConnect(rel.jobId, job.id, rel.port, d.port);
        return;
      }
      // released on empty canvas / an invalid port → cancel
      onCancelConnect();
    } else if (d.wasPending) {
      // clicked the pending input port again → cancel
      onCancelConnect();
    }
    // else: plain click keeps the pending wire alive (click-click mode —
    // click a compatible output port next)
  };

  /** Keyboard fallback for the input ports (Enter / Space). */
  const handleInPortKeyDown = (e: React.KeyboardEvent, portName: string) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (pendingFrom && pendingFrom.dir !== "in" && pendingFrom.jobId !== job.id) {
      // finish a pending output→input wire from another job
      onConnect(pendingFrom.jobId, job.id, pendingFrom.port, portName);
    } else if (
      pendingFrom?.jobId === job.id &&
      pendingFrom.port === portName &&
      pendingFrom.dir === "in"
    ) {
      onCancelConnect();
    } else {
      onStartConnect({ jobId: job.id, port: portName, dir: "in" });
    }
  };

  const handlePortPointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = portDragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    portDragRef.current = null;
  };

  /* ---------------- render ------------------------------------------ */

  const portLabelChip = (label: string) => (
    <span className="pointer-events-none absolute bottom-full left-1/2 mb-0.5 -translate-x-1/2 whitespace-nowrap rounded border bg-card px-1.5 py-0.5 text-[10px] font-medium text-card-foreground opacity-0 shadow-sm transition-opacity duration-100 group-hover/port:opacity-100">
      {label}
    </span>
  );

  return (
    <JobCardMenu job={job} onSelect={onSelect} onInspect={onInspect}>
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
            selected
              ? "border-primary ring-2 ring-primary/60"
              : inspected
                ? "border-teal-500 ring-2 ring-teal-500/70"
                : "hover:border-primary/50 hover:shadow-md",
            job.status === "running" &&
              !selected &&
              !inspected &&
              "border-teal-400/60 dark:border-teal-500/50"
          )}
          title={
            job.status === "idle"
              ? "Click to edit parameters"
              : job.status === "running"
                ? "Click to open the live inspector (log · results)"
                : "Click to open the results inspector"
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (job.status === "idle") onSelect(job.id);
              else onInspect(job.id);
            }
          }}
        >
          {/* Category color bar */}
          <div
            className={cn("absolute inset-y-0 left-0 w-1 opacity-80", spec?.color.bg)}
            aria-hidden="true"
          />

          {/* n8n-style completion check badge (top-right corner) */}
          {job.status === "completed" && (
            <span
              aria-hidden="true"
              title="Completed"
              className="absolute right-2 top-2 flex size-4.5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold leading-none text-white shadow-sm"
            >
              <svg viewBox="0 0 10 10" className="size-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1.5 5.2 L3.8 7.5 L8.5 2.5" />
              </svg>
            </span>
          )}
          {/* n8n-style failure badge (top-right corner) */}
          {job.status === "failed" && (
            <span
              aria-hidden="true"
              title="Failed"
              className="absolute right-2 top-2 flex size-4.5 items-center justify-center rounded-full bg-rose-500 text-[11px] font-bold leading-none text-white shadow-sm"
            >
              !
            </span>
          )}

          <div className="flex h-full flex-col justify-center gap-1.5 py-3 pl-4 pr-8">
            {/* Row 1: icon chip + name (hover → n8n-style preview card) */}
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-md ring-1 ring-inset",
                  spec?.color.soft,
                  spec?.color.border
                )}
                aria-hidden="true"
              >
                <TypeIcon
                  name={spec?.icon ?? "Boxes"}
                  className={cn("size-3.5", spec?.color.text)}
                />
              </span>
              <HoverCard openDelay={500} closeDelay={150}>
                <HoverCardTrigger asChild>
                  <p
                    className="truncate text-sm font-semibold tracking-tight leading-none"
                    title={job.name}
                  >
                    {job.name}
                  </p>
                </HoverCardTrigger>
                <JobCardPreview job={job} spec={spec} etaText={etaText} />
              </HoverCard>
            </div>

            {/* Row 2: status + type */}
            <div className="flex items-center gap-1.5">
              <StatusBadge status={job.status} />
              <span className="truncate text-[11px] text-muted-foreground">
                {spec?.key ?? job.type}
              </span>
            </div>

            {/* Row 3: progress + ETA / result / ready hint */}
            <div className="h-4">
              {job.status === "running" ? (
                <div className="flex items-center gap-1.5">
                  <MiniProgress
                    value={job.progress}
                    running
                    label={`${job.name} progress`}
                    className="flex-1"
                  />
                  {etaText ? (
                    <span
                      className="shrink-0 text-[9.5px] font-medium tabular-nums text-teal-600 dark:text-teal-400"
                      title={`Progress ${Math.round(job.progress)}% — ${etaText} remaining (estimate from current pace)`}
                    >
                      {etaText}
                    </span>
                  ) : (
                    <span className="w-7 shrink-0 text-right text-[9.5px] font-semibold tabular-nums text-muted-foreground">
                      {Math.round(job.progress)}%
                    </span>
                  )}
                </div>
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

        {/* Input ports (left edge, hollow) — press & drag backwards to an
            output port, plain-click for click-click, or complete a pending
            out→in wire from another job */}
        {inputs.map((p, i) => {
          const compatible =
            pendingFrom != null &&
            pendingFrom.dir !== "in" &&
            !isSource &&
            pendingFromType != null &&
            portsCompatible(pendingFromType, pendingFrom.port, job.type, p.name);
          const isPendingIn =
            isSource && pendingFrom?.port === p.name && pendingFrom.dir === "in";
          return (
            <button
              key={p.name}
              data-port={`in:${p.name}`}
              data-port-compatible={compatible ? "true" : undefined}
              type="button"
              aria-label={`${p.label} — input port of ${job.name}`}
              className="group/port absolute z-10 flex size-4 cursor-crosshair items-center justify-center outline-none focus-visible:rounded-full focus-visible:ring-2 focus-visible:ring-ring"
              style={{ left: -8, top: portY(i, inputs.length) - 8 }}
              onPointerDown={(e) => handleInPortPointerDown(e, p.name)}
              onPointerMove={handlePortPointerMove}
              onPointerUp={handleInPortPointerUp}
              onPointerCancel={handlePortPointerCancel}
              onKeyDown={(e) => handleInPortKeyDown(e, p.name)}
            >
              <span
                className={cn(
                  "block size-3 rounded-full border-2 bg-background transition-[scale,box-shadow] duration-100 group-hover/port:scale-125",
                  spec?.color.border,
                  compatible &&
                    "animate-pulse scale-110 ring-2 ring-primary/60 ring-offset-1 ring-offset-background",
                  isPendingIn && "scale-125 border-primary ring-2 ring-primary/60"
                )}
              />
              {portLabelChip(p.label)}
            </button>
          );
        })}

        {/* Output ports (right edge, filled with the port-kind color) — drag
            onto an input port, plain-click for click-click, or complete a
            pending in→out wire from another job */}
        {outputs.map((p, i) => {
          const isPendingSource = isSource && pendingFrom?.port === p.name;
          const compatible =
            pendingFrom?.dir === "in" &&
            !isSource &&
            pendingFromType != null &&
            portsCompatible(job.type, p.name, pendingFromType, pendingFrom.port);
          return (
            <button
              key={p.name}
              data-port={`out:${p.name}`}
              data-port-compatible={compatible ? "true" : undefined}
              type="button"
              aria-label={`${p.label} — output port of ${job.name}`}
              className="group/port absolute z-10 flex size-4 cursor-crosshair items-center justify-center outline-none focus-visible:rounded-full focus-visible:ring-2 focus-visible:ring-ring"
              style={{ right: -8, top: portY(i, outputs.length) - 8 }}
              onPointerDown={(e) => handleOutPortPointerDown(e, p.name)}
              onPointerMove={handlePortPointerMove}
              onPointerUp={handleOutPortPointerUp}
              onPointerCancel={handlePortPointerCancel}
              onKeyDown={(e) => handleOutPortKeyDown(e, p.name)}
            >
              <span
                className={cn(
                  "block size-3 rounded-full border-2 border-transparent transition-[scale,box-shadow,background-color,border-color] duration-100 group-hover/port:scale-125",
                  p.kind ? PORT_COLORS[p.kind].dot : "bg-slate-500",
                  compatible &&
                    "animate-pulse scale-110 ring-2 ring-primary/60 ring-offset-1 ring-offset-background",
                  isPendingSource && "scale-125 border-primary bg-primary"
                )}
              />
              {portLabelChip(p.label)}
            </button>
          );
        })}
      </div>
      </div>
    </JobCardMenu>
  );
});

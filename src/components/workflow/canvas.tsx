"use client";

import * as React from "react";
import { useCallback } from "react";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  Bookmark,
  BookmarkPlus,
  Check,
  ChevronDown,
  CircleDashed,
  Copy,
  Download,
  FileJson,
  FileUp,
  GitCompareArrows,
  History,
  ImageUp,
  ArrowRight,
  Waypoints,
  LayoutTemplate,
  Link2,
  Loader2,
  RotateCcw,
  Trash2,
  Map as MapIcon,
  Move,
  Undo2,
  Redo2,
  Wand2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  CARD_H,
  CARD_W,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
  jobType,
  portY,
} from "@/lib/workflow";
import { hasJudgment } from "@/lib/class-notes";
import { pendingWirePath } from "@/lib/edge-geom";
import { copyCanvasPng, exportCanvasPng, fmtBytes } from "@/lib/canvas-export";
import {
  buildWorkflowFile,
  downloadWorkflowJson,
  workflowFileName,
} from "@/lib/workflow-io";
import { useWorkflowStore, useActiveWorkspaceJobs, useActiveWorkspaceEdges, type PendingFrom, type HistoryEntry, type HistoryEntryKind } from "@/lib/store";
import { beginGroupDrag, endGroupDrag, moveGroupDrag } from "@/lib/group-drag";
import type { JobDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { EdgesLayer } from "./edges-layer";
import { PipelineKpi } from "./pipeline-kpi";
import { CanvasMinimap } from "./canvas-minimap";
import { JobCard } from "./job-card";
import { ParamsDiffDialog } from "./params-diff-dialog";
import { useDropImport, DropImportOverlay } from "./drop-import";
import { stageWorkflowFiles } from "@/lib/import-stage";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { capturePointer } from "@/lib/pointer";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

/** padding around the live-wire's anchor+cursor box — generous so the
 *  rubber band keeps drawing while the cursor roams the infinite canvas */
const WIRE_PAD = 900;

/**
 * Temporary "live wire" following the cursor while a connection is pending
 * (click-click mode or drag-to-connect). Rendered inside the workspace so
 * it scales with the zoom. Supports both wiring directions: "out" wires
 * start at an output port (right edge), "in" wires start at an input port
 * (left edge). The job-card pulse rings already signal the compatible
 * ports on the other side. The SVG box hugs the anchor+cursor bbox with a
 * viewBox that keeps workspace coordinates (infinite canvas).
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

  const bx = Math.min(sx, cursor.x) - WIRE_PAD;
  const by = Math.min(sy, cursor.y) - WIRE_PAD;
  const bw = Math.abs(cursor.x - sx) + 2 * WIRE_PAD;
  const bh = Math.abs(cursor.y - sy) + 2 * WIRE_PAD;

  return (
    <svg
      width={bw}
      height={bh}
      viewBox={`${bx} ${by} ${bw} ${bh}`}
      className="pointer-events-none absolute left-0 top-0"
      style={{ left: bx, top: by, overflow: "visible" }}
      aria-hidden="true"
    >
      <circle cx={sx} cy={sy} r={4} fill="var(--primary)" opacity={0.9} />
      <path
        d={pendingWirePath(sx, sy, cursor.x, cursor.y, pendingFrom.dir === "in" ? "in" : "out")}
        stroke="var(--primary)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="7 5"
        opacity={0.8}
        fill="none"
        className="edge-flow"
      />
      <circle cx={cursor.x} cy={cursor.y} r={3} fill="var(--primary)" opacity={0.55} />
    </svg>
  );
});

/* ------------------------------------------------------------------ */
/* History panel rows (Task 125): kind icons + run disclosure groups   */
/* ------------------------------------------------------------------ */

type HistoryRowKind = HistoryEntryKind | "other";

const HISTORY_KIND_META: Record<HistoryRowKind, { icon: typeof Move; noun: string; className: string }> = {
  move: { icon: Move, noun: "move", className: "text-muted-foreground" },
  tidy: { icon: Wand2, noun: "auto-arrange", className: "text-muted-foreground" },
  delete: { icon: Trash2, noun: "delete", className: "text-rose-500/90" },
  other: { icon: CircleDashed, noun: "edit", className: "text-muted-foreground" },
};

const historyKindOf = (e: HistoryEntry): HistoryRowKind =>
  e.kind && HISTORY_KIND_META[e.kind] ? e.kind : "other";

interface HistoryRun {
  kind: HistoryRowKind;
  start: number;
  end: number;
  labels: string[];
}

/** Consecutive same-kind runs over one rendered row order. A pair of
 *  moves is normal work — only HISTORY_GROUP_MIN+ collapses. */
const HISTORY_GROUP_MIN = 3;

function historyRuns(kinds: HistoryRowKind[], labels: string[]): HistoryRun[] {
  const runs: HistoryRun[] = [];
  for (let i = 0; i < kinds.length; i++) {
    const last = runs[runs.length - 1];
    if (last && last.kind === kinds[i]) {
      last.end = i;
      last.labels.push(labels[i]);
    } else {
      runs.push({ kind: kinds[i], start: i, end: i, labels: [labels[i]] });
    }
  }
  return runs;
}

/** Task 125 — the panel's body. Lives at module level so its expansion
 *  state unmounts with the popover: every open starts collapsed, a fresh
 *  overview instead of stale UI state. Rows never parse display labels —
 *  the entry's structural kind (store.ts sets it at every push site)
 *  drives icons and grouping. Jump semantics stay with the canvas
 *  (onBack/onForward carry the guard + jumping wrapper). */
function HistoryRows({
  past,
  future,
  jumping,
  onBack,
  onForward,
}: {
  past: HistoryEntry[];
  future: HistoryEntry[];
  jumping: boolean;
  onBack: (steps: number) => void;
  onForward: (steps: number) => void;
}) {
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const toggleRun = (k: string) => setExpanded((s) => ({ ...s, [k]: !s[k] }));

  const pastRuns = historyRuns(past.map(historyKindOf), past.map((e) => e.label));
  // the NEXT redo displays first (closest to Now) — runs follow DISPLAY order
  const futureRendered = [...future].reverse();
  const futureRuns = historyRuns(futureRendered.map(historyKindOf), futureRendered.map((e) => e.label));

  return (
    <>
      <ul>
        {pastRuns.map((run, rr) => {
          const key = `p${run.start}-${run.end}:${run.kind}`;
          const grouped = run.labels.length >= HISTORY_GROUP_MIN;
          const open = grouped && !!expanded[key];
          const Meta = HISTORY_KIND_META[run.kind];
          return (
            <React.Fragment key={`pr:${rr}`}>
              {grouped && (
                <li>
                  <button
                    type="button"
                    disabled={jumping}
                    aria-expanded={open}
                    className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                    data-canvas-ui="history-group"
                    data-history-kind={run.kind}
                    data-run-count={run.labels.length}
                    onClick={() => toggleRun(key)}
                    title={run.labels.join(" · ")}
                  >
                    <span className="flex w-4 shrink-0 justify-center">
                      <ChevronDown className={`size-3 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
                    </span>
                    <Meta.icon className={`size-3.5 shrink-0 ${Meta.className}`} />
                    <span className="truncate font-medium">
                      {run.labels.length}× {Meta.noun}
                    </span>
                  </button>
                </li>
              )}
              {(!grouped || open) &&
                past.slice(run.start, run.end + 1).map((entry, k) => {
                  const i = run.start + k;
                  const target = past.length - 1 - i;
                  return (
                    <li key={`p:${i}:${entry.label}`}>
                      <button
                        type="button"
                        disabled={jumping}
                        className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                        data-canvas-ui="history-row"
                        data-history-kind="past"
                        data-history-index={i}
                        onClick={() => onBack(target)}
                        title={
                          target === 0
                            ? "You are here"
                            : `Jump back — undo ${target} step${target === 1 ? "" : "s"} after this`
                        }
                      >
                        <span className="w-4 shrink-0 text-right font-mono text-[9px] tabular-nums text-muted-foreground">
                          {i + 1}
                        </span>
                        <Meta2Icon entry={entry} />
                        <span className="truncate">{entry.label}</span>
                      </button>
                    </li>
                  );
                })}
            </React.Fragment>
          );
        })}
      </ul>
      <div className="my-1 flex items-center gap-1.5 px-1" data-canvas-ui="history-now">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">now</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <ul>
        {futureRuns.map((run, rr) => {
          const key = `f${run.start}-${run.end}:${run.kind}`;
          const grouped = run.labels.length >= HISTORY_GROUP_MIN;
          const open = grouped && !!expanded[key];
          const Meta = HISTORY_KIND_META[run.kind];
          return (
            <React.Fragment key={`fr:${rr}`}>
              {grouped && (
                <li>
                  <button
                    type="button"
                    disabled={jumping}
                    aria-expanded={open}
                    className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs italic text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                    data-canvas-ui="history-group"
                    data-history-kind={run.kind}
                    data-run-count={run.labels.length}
                    onClick={() => toggleRun(key)}
                    title={run.labels.join(" · ")}
                  >
                    <span className="flex w-4 shrink-0 justify-center">
                      <ChevronDown className={`size-3 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
                    </span>
                    <Meta.icon className={`size-3.5 shrink-0 ${Meta.className}`} />
                    <span className="truncate font-medium">
                      {run.labels.length}× {Meta.noun}
                    </span>
                  </button>
                </li>
              )}
              {(!grouped || open) &&
                futureRendered.slice(run.start, run.end + 1).map((entry, k) => {
                  const r = run.start + k;
                  const i = future.length - 1 - r; // array index — the NEXT redo is r === 0
                  const target = future.length - i;
                  return (
                    <li key={`f:${i}:${entry.label}`}>
                      <button
                        type="button"
                        disabled={jumping}
                        className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs italic text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
                        data-canvas-ui="history-row"
                        data-history-kind="future"
                        data-history-index={i}
                        onClick={() => onForward(target)}
                        title={`Jump forward — redo ${target} step${target === 1 ? "" : "s"} up to this`}
                      >
                        <span className="w-4 shrink-0 text-right font-mono text-[9px] tabular-nums text-muted-foreground/60">
                          {past.length + i + 1}
                        </span>
                        <Meta2Icon entry={entry} />
                        <span className="truncate">{entry.label}</span>
                      </button>
                    </li>
                  );
                })}
            </React.Fragment>
          );
        })}
      </ul>
    </>
  );
}

/** The row's kind icon — a leaf helper so past/future maps stay flat. */
function Meta2Icon({ entry }: { entry: HistoryEntry }) {
  const Meta = HISTORY_KIND_META[historyKindOf(entry)];
  const Icon = Meta.icon;
  return <Icon className={`size-3.5 shrink-0 ${Meta.className}`} />;
}

/* ------------------------------------------------------------------ */
/* Floating selection toolbar (multi-select ≥ 2)                       */
/* ------------------------------------------------------------------ */

const ALIGN_ITEMS = [
  { mode: "left", icon: AlignStartVertical, label: "Left edges" },
  { mode: "hcenter", icon: AlignCenterVertical, label: "Horizontal centers" },
  { mode: "right", icon: AlignEndVertical, label: "Right edges" },
  { mode: "top", icon: AlignStartHorizontal, label: "Top edges" },
  { mode: "vcenter", icon: AlignCenterHorizontal, label: "Vertical centers" },
  { mode: "bottom", icon: AlignEndHorizontal, label: "Bottom edges" },
] as const;

/**
 * Task 129 — post-apply connection suggestions. An applied template
 * lands as a wired island; this chip proposes the wires to its new
 * neighbors (free boundary inputs × same-workspace free outputs),
 * lists every pair EXPLICITLY, and wires only on Connect — a
 * suggestion never connects anything by itself. Rows toggle inclusion
 * (the excluded ones dim), the whole chip dismisses; navigation and
 * vanished endpoints clear it silently.
 */
const TemplateSuggestionsChip = React.memo(function TemplateSuggestionsChip() {
  const suggestions = useWorkflowStore((s) => s.templateSuggestions);
  const activeWorkspaceId = useWorkflowStore((s) => s.activeWorkspaceId);
  const jobs = useWorkflowStore((s) => s.jobs);
  const [busy, setBusy] = React.useState(false);
  const [excluded, setExcluded] = React.useState<Set<string>>(new Set());

  // a new batch (different pairs) resets per-row inclusion — excluded
  // rows belong to the batch they were excluded from
  const batchKey = suggestions
    ? suggestions.items.map((i) => `${i.fromJobId}>${i.toJobId}`).join(",")
    : "";
  React.useEffect(() => {
    setExcluded(new Set());
  }, [batchKey]);

  // three silent exits: another workspace's batch, every endpoint already
  // applied, or an endpoint vanished (job deleted) — a chip pointing at a
  // ghost would be a lie the canvas renders
  const alive = React.useMemo(() => {
    if (!suggestions || suggestions.workspaceId !== (activeWorkspaceId ?? "")) return null;
    const ids = new Set(jobs.map((j) => j.id));
    const items = suggestions.items.filter((i) => ids.has(i.fromJobId) && ids.has(i.toJobId));
    return items.length > 0 ? items : null;
  }, [suggestions, activeWorkspaceId, jobs]);

  if (!alive) return null;
  const included = alive.filter((i) => !excluded.has(`${i.fromJobId}>${i.toJobId}`));
  const connectIncluded = () => {
    setBusy(true);
    void useWorkflowStore
      .getState()
      .applyTemplateSuggestions(included)
      .finally(() => setBusy(false));
  };

  return (
    <div
      data-canvas-ui="template-suggestions"
      className="card-lift animate-rise absolute bottom-14 left-1/2 z-30 w-[min(420px,calc(100%-24px))] -translate-x-1/2 rounded-lg border bg-card/95 p-2 shadow-md backdrop-blur"
    >
      <div className="flex items-center gap-1.5">
        <Waypoints className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
        <p className="flex-1 text-[11px] font-semibold text-muted-foreground">
          {alive.length === 1 ? "1 suggested wire" : `${alive.length} suggested wires`}
          <span className="ml-1.5 font-normal text-muted-foreground/70">
            from the applied template — click a row to skip it
          </span>
        </p>
        <button
          type="button"
          onClick={() => useWorkflowStore.getState().dismissTemplateSuggestions()}
          aria-label="Dismiss connection suggestions"
          title="Dismiss — wire by hand instead"
          className="rounded-full p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          data-testid="template-suggestions-dismiss"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>
      <ul className="mt-1.5 grid gap-0.5">
        {alive.map((i) => {
          const key = `${i.fromJobId}>${i.toJobId}`;
          const on = !excluded.has(key);
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() =>
                  setExcluded((prev) => {
                    const next = new Set(prev);
                    if (next.has(key)) next.delete(key);
                    else next.add(key);
                    return next;
                  })
                }
                aria-pressed={on}
                title={on ? "Click to skip this wire" : "Click to include this wire"}
                className={cn(
                  "flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] transition-colors",
                  on ? "bg-muted/40 hover:bg-muted/70" : "text-muted-foreground/50 line-through decoration-border hover:bg-muted/40"
                )}
                data-testid="template-suggestion-row"
                data-suggestion-key={key}
              >
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    on ? "bg-primary" : "bg-border"
                  )}
                  aria-hidden="true"
                />
                <span className="max-w-[38%] truncate font-medium" title={i.fromName}>
                  {i.fromName}
                </span>
                <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground">
                  {i.fromPort}
                </span>
                <ArrowRight className="size-3 shrink-0 text-primary" aria-hidden="true" />
                <span className="max-w-[38%] truncate font-medium" title={i.toName}>
                  {i.toName}
                </span>
                <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground">
                  {i.toPort}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-1.5 flex justify-end">
        <Button
          size="sm"
          className="h-6 gap-1 px-2.5 text-[11px]"
          onClick={connectIncluded}
          disabled={busy || included.length === 0}
          title="Wire the included suggestions through the same endpoint a manual drag uses"
          data-testid="template-suggestions-connect"
        >
          {busy ? (
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          ) : (
            <Link2 className="size-3" aria-hidden="true" />
          )}
          {included.length === alive.length
            ? `Connect ${included.length}`
            : `Connect ${included.length} of ${alive.length}`}
        </Button>
      </div>
    </div>
  );
});

/**
 * Appears above the selection's bounding box whenever 2+ cards of the
 * ACTIVE workspace are selected. Screen-space chrome: hidden while a
 * rubber band is being drawn (the band owns the gesture) and driven by
 * store bulk actions. Delete routes through a local confirm dialog —
 * the same destructive guard every other delete path uses.
 */
const SelectionToolbar = React.memo(function SelectionToolbar({
  rootRef,
  hidden,
}: {
  rootRef: React.RefObject<HTMLDivElement | null>;
  hidden: boolean;
}) {
  const selectedIds = useWorkflowStore((s) => s.selectedIds);
  const jobs = useActiveWorkspaceJobs();
  const wsEdges = useActiveWorkspaceEdges();
  const viewport = useWorkflowStore((s) => s.viewport);
  const alignSelected = useWorkflowStore((s) => s.alignSelected);
  const distributeSelected = useWorkflowStore((s) => s.distributeSelected);
  const duplicateSelected = useWorkflowStore((s) => s.duplicateSelected);
  const deleteSelected = useWorkflowStore((s) => s.deleteSelected);
  const saveSelectionTemplate = useWorkflowStore((s) => s.saveSelectionTemplate);
  const [confirmDel, setConfirmDel] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  // Task 127 — save-the-selection-as-template naming dialog
  const [tplOpen, setTplOpen] = React.useState(false);
  const [tplName, setTplName] = React.useState("");
  const [tplBusy, setTplBusy] = React.useState(false);
  // Task 87: two same-type jobs unlock the params comparison — the dialog
  // reads the selection in PICK order (first click = left column), which
  // selectedIds preserves and the jobs-list filter would scramble
  const [compareOpen, setCompareOpen] = React.useState(false);
  // canvas layout size, measured outside render (refs are off-limits there)
  const [canvasSize, setCanvasSize] = React.useState<{ w: number; h: number }>({ w: 0, h: 0 });
  React.useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const update = () => setCanvasSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [rootRef]);

  const sel = React.useMemo(
    () => (selectedIds.length > 1 ? jobs.filter((j) => selectedIds.includes(j.id)) : []),
    [selectedIds, jobs]
  );
  // pick-order pair for the diff dialog (selectedIds order, not job order)
  const pickOrderPair = React.useMemo(
    () =>
      sel.length === 2 && sel[0].type === sel[1].type
        ? selectedIds
            .map((id) => sel.find((j) => j.id === id))
            .filter((j): j is (typeof sel)[number] => j != null)
        : null,
    [sel, selectedIds]
  );
  // Task 127 — wires whose BOTH endpoints are in the selection (the count
  // shown in the save dialog, and what the snapshot will carry)
  const internalWireCount = React.useMemo(() => {
    const ids = new Set(sel.map((j) => j.id));
    return wsEdges.filter((e) => ids.has(e.fromJobId) && ids.has(e.toJobId)).length;
  }, [sel, wsEdges]);

  if (hidden || sel.length < 2) return null;

  const zoom = viewport.zoom;
  const minX = Math.min(...sel.map((j) => j.x));
  const maxX = Math.max(...sel.map((j) => j.x + CARD_W));
  const minY = Math.min(...sel.map((j) => j.y));
  const maxY = Math.max(...sel.map((j) => j.y + CARD_H));
  const cx = viewport.x + ((minX + maxX) / 2) * zoom;
  const bboxTop = viewport.y + minY * zoom;
  const bboxBottom = viewport.y + maxY * zoom;
  // keep the (≤ ~360px) toolbar inside the canvas: clamp the anchor
  const clampedCx = canvasSize.w > 0 ? clamp(cx, 190, Math.max(190, canvasSize.w - 190)) : cx;
  // prefer floating above the bbox; fall through to below, then pin top
  const ty =
    bboxTop - 46 >= 8
      ? bboxTop - 46
      : Math.min(bboxBottom + 10, Math.max(8, (canvasSize.h || 400) - 56));
  const runningCount = sel.filter((j) => j.status === "running").length;
  const namePreview = sel
    .slice(0, 3)
    .map((j) => `“${j.name}”`)
    .join(", ");

  return (
    <div className="pointer-events-none absolute z-40" style={{ left: clampedCx, top: ty }}>
      <div
        data-canvas-ui="selection-toolbar"
        className="card-lift pointer-events-auto flex -translate-x-1/2 animate-rise items-center gap-0.5 rounded-lg border bg-card/95 p-1 shadow-md backdrop-blur"
        role="toolbar"
        aria-label={`${sel.length} jobs selected — align, distribute${pickOrderPair ? ", compare" : ""}, duplicate or delete`}
      >
        <span className="whitespace-nowrap px-2 text-[11px] font-semibold tabular-nums text-muted-foreground">
          {sel.length} selected
        </span>
        <span className="h-4 w-px bg-border" aria-hidden="true" />
        {pickOrderPair && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={() => setCompareOpen(true)}
              aria-label="Compare parameters"
              title="Compare the two selected jobs' launch parameters side by side"
              data-testid="toolbar-compare-params"
            >
              <GitCompareArrows className="size-3.5" />
            </Button>
            <span className="h-4 w-px bg-border" aria-hidden="true" />
          </>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs font-medium">
              <AlignCenterVertical className="size-3.5" aria-hidden="true" />
              Align
              <ChevronDown className="size-3 opacity-60" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {ALIGN_ITEMS.map(({ mode, icon: Icon, label }) => (
              <DropdownMenuItem key={mode} onClick={() => alignSelected(mode)}>
                <Icon aria-hidden="true" />
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs font-medium"
              title={sel.length < 3 ? "Distribution needs at least 3 jobs" : undefined}
            >
              <AlignHorizontalDistributeCenter className="size-3.5" aria-hidden="true" />
              Distribute
              <ChevronDown className="size-3 opacity-60" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={() => distributeSelected("h")}>
              <AlignHorizontalDistributeCenter aria-hidden="true" />
              Distribute horizontally
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => distributeSelected("v")}>
              <AlignVerticalDistributeCenter aria-hidden="true" />
              Distribute vertically
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="h-4 w-px bg-border" aria-hidden="true" />
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => {
            // a sensible seed name — the user edits it in the dialog
            setTplName(`${sel.length}-job pipeline`);
            setTplOpen(true);
          }}
          aria-label="Save selection as template"
          title="Save the selection as a reusable template — types, positions, parameters and internal wires; apply it later from the template presets dialog"
          data-testid="toolbar-save-template"
        >
          <LayoutTemplate className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void duplicateSelected().finally(() => setBusy(false));
          }}
          aria-label="Duplicate selection"
          title="Duplicate the selection — wires BETWEEN the copies are recreated, everything stays idle"
        >
          <Copy className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300"
          onClick={() => setConfirmDel(true)}
          aria-label="Delete selection"
          title="Delete the selection (with every wire attached)"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {/* Task 87: two same-type jobs → side-by-side launch params */}
      <ParamsDiffDialog
        jobs={pickOrderPair ?? []}
        open={compareOpen}
        onOpenChange={setCompareOpen}
      />

      {/* Task 127 — name-and-save the selection as a reusable template.
          The dialog steals focus for typing; Enter saves, Esc cancels. */}
      <Dialog open={tplOpen} onOpenChange={setTplOpen}>
        <DialogContent className="max-w-sm gap-3" data-canvas-ui="save-template-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <LayoutTemplate className="size-4 text-primary" aria-hidden="true" />
              Save selection as template
            </DialogTitle>
            <DialogDescription>
              {sel.length} jobs · {internalWireCount} internal wire{internalWireCount === 1 ? "" : "s"} —
              types, positions, parameters and wiring are snapshotted. Apply it later from the
              template presets dialog, in any workspace of this project.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={tplName}
            onChange={(e) => setTplName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !tplBusy && tplName.trim()) {
                setTplBusy(true);
                void saveSelectionTemplate(tplName).finally(() => {
                  setTplBusy(false);
                  setTplOpen(false);
                });
              }
            }}
            placeholder="e.g. Tuned 2D branch"
            maxLength={80}
            autoFocus
            data-testid="save-template-name"
            aria-label="Template name"
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setTplOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={tplBusy || !tplName.trim()}
              onClick={() => {
                setTplBusy(true);
                void saveSelectionTemplate(tplName).finally(() => {
                  setTplBusy(false);
                  setTplOpen(false);
                });
              }}
              data-testid="save-template-confirm"
            >
              {tplBusy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <LayoutTemplate className="size-3.5" aria-hidden="true" />}
              Save template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* bulk delete confirm — mirrors the single-job guard (page.tsx /
          job-card.tsx): cascades wires, so require an explicit OK */}
      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {sel.length} jobs?</AlertDialogTitle>
            <AlertDialogDescription>
              {namePreview}
              {sel.length > 3 ? ` and ${sel.length - 3} more` : ""} — this removes every
              wire attached to them. Files already written to the workdirs stay on disk.
              {runningCount > 0 && ` ${runningCount} running process${runningCount === 1 ? " will be stopped" : "es will be stopped"}.`}{" "}
              You'll get a short window to undo from the toast afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-400"
              onClick={() => {
                setConfirmDel(false);
                void deleteSelected();
              }}
            >
              Delete {sel.length} jobs
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});

export function WorkflowCanvas() {
  // workspace-scoped view: only the active workspace's jobs render, wires
  // draw where BOTH endpoints are visible (cross-workspace data flows
  // through linked copies — see store.linkJobTo)
  const jobs = useActiveWorkspaceJobs();
  const edges = useActiveWorkspaceEdges();
  const selectedId = useWorkflowStore((s) => s.selectedId);
  // Task 115 — the injected @page size is the CANVAS sheet's contract; when
  // the job inspector is open the paper is the job REPORT and the report
  // picks its own geometry (playwright landscape:false, printer default).
  // Chromium maps "size: A4 landscape" onto whatever paper the API asks
  // for — without this branch a portrait report print came out 792×612.
  const inspectId = useWorkflowStore((s) => s.inspectId);
  const inspect = useWorkflowStore((s) => s.inspect);
  const pendingFrom = useWorkflowStore((s) => s.pendingFrom);
  const viewport = useWorkflowStore((s) => s.viewport);
  const paletteDrag = useWorkflowStore((s) => s.paletteDrag);
  const loading = useWorkflowStore((s) => s.loading);
  const select = useWorkflowStore((s) => s.select);
  const selectedIds = useWorkflowStore((s) => s.selectedIds);
  const toggleSelect = useWorkflowStore((s) => s.toggleSelect);
  const cancelConnect = useWorkflowStore((s) => s.cancelConnect);
  const setViewport = useWorkflowStore((s) => s.setViewport);
  const panBy = useWorkflowStore((s) => s.panBy);
  const applyLayout = useWorkflowStore((s) => s.applyLayout);
  const layoutEpoch = useWorkflowStore((s) => s.layoutEpoch);
  const historyPast = useWorkflowStore((s) => s.historyPast);
  const historyFuture = useWorkflowStore((s) => s.historyFuture);
  const undoHistory = useWorkflowStore((s) => s.undo);
  const redoHistory = useWorkflowStore((s) => s.redo);
  const minimapOpen = useWorkflowStore((s) => s.minimapOpen);
  const setMinimapOpen = useWorkflowStore((s) => s.setMinimapOpen);
  const undoSteps = useWorkflowStore((s) => s.undoSteps);
  const redoSteps = useWorkflowStore((s) => s.redoSteps);

  // history panel (local open state — the panel is a transient surface,
  // not a persisted preference)
  const [historyOpen, setHistoryOpen] = React.useState(false);
  // Task 106 — a batch jump runs n sequential server-synced steps; while
  // one is in flight every row locks (a second click would interleave two
  // batches and scramble the order the user asked for)
  const [jumping, setJumping] = React.useState(false);
  // Task 125 — the jump verbs the history rows share: guard + jumping
  // wrapper live here so HistoryRows stays a pure renderer.
  const jumpBack = (target: number) => {
    if (target <= 0) return;
    setJumping(true);
    void undoSteps(target).finally(() => setJumping(false));
  };
  const jumpForward = (target: number) => {
    if (target <= 0) return;
    setJumping(true);
    void redoSteps(target).finally(() => setJumping(false));
  };

  const rootRef = React.useRef<HTMLDivElement>(null);
  const panRef = React.useRef<PanState | null>(null);
  const panRafRef = React.useRef(0);

  /* ------------- fit-to-paper (print) bounds ------------------------- */
  /**
   * The paper contract (Task 72): printing the canvas yields the WHOLE
   * pipeline fitted to a single landscape sheet — never the current
   * viewport slice (which truncates card names and drops off-screen
   * jobs), and never multi-page, because absolutely-positioned cards do
   * NOT fragment across pages in Chromium — they clip (probe-verified:
   * overflow pages rendered 0.00% ink and far cards vanished). So the
   * print stylesheet re-lays the workspace out as a static, sized box at
   * scale(--pz) with the world's min corner pulled to the content-box
   * origin; these custom properties carry the geometry. Recomputed on
   * every jobs change — a style-object update, no layout work on screen.
   *
   * Budgets take the tighter axis of Letter/A4 landscape content boxes
   * at 12 mm margins (see printFit) minus the printed masthead and
   * per-page footer bands. No zoom floor by design:
   * "tiny but complete" beats "readable but cropped" for a snapshot map.
   */
  const printFit = React.useMemo(() => {
    const PAD = 40; // breathing room around the card union
    // Budgets take the TIGHTER axis of the two common papers so the fit
    // holds whether the printer defaults to Letter or A4: width from
    // Letter landscape (965px content at 12 mm), height from A4 landscape
    // (703px) — both minus a safety hair.
    const PAPER_W = 960;
    const PAPER_H = 700;
    const MASTHEAD_H = 160; // app brand bar + print doc masthead
    const FOOTER_H = 36; // per-page print footer strip
    if (jobs.length === 0) {
      return { minx: 0, miny: 0, w: 0, h: 0, z: 1 };
    }
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const j of jobs) {
      x0 = Math.min(x0, j.x);
      y0 = Math.min(y0, j.y);
      x1 = Math.max(x1, j.x + CARD_W);
      y1 = Math.max(y1, j.y + CARD_H);
    }
    x0 -= PAD;
    y0 -= PAD;
    x1 += PAD;
    y1 += PAD;
    const w = x1 - x0;
    const h = y1 - y0;
    const z = Math.min(1, PAPER_W / w, (PAPER_H - MASTHEAD_H - FOOTER_H) / h);
    return { minx: x0, miny: y0, w, h, z };
  }, [jobs]);


  /* ------------- rubber-band select (Shift + drag) ------------------ */
  /** Canvas-LOCAL rect of the band being drawn (null = idle). Lives in
   *  state so both the ants overlay and the live hit test re-render. */
  const [band, setBand] = React.useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const bandRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    /** touch-originated band (long-press) — lifting WITHOUT a real drag
     *  cancels instead of committing, so a mode-switch tap never nukes the
     *  user's selection (desktop shift-click keeps its clear semantics) */
    fromTouch?: boolean;
    moved?: boolean;
    lx?: number;
    ly?: number;
  } | null>(null);

  /* ------- touch long-press → rubber-band (no Shift on touch) -------- */
  /** A touch on the background starts as a pan AND a 420 ms timer. If the
   *  finger is still (≤9 px drift) when it fires, the pan converts to a
   *  band; any real movement earlier cancels the timer and the pan
   *  continues untouched. 420 ms sits just under Chrome's own long-press
   *  contextmenu (~500 ms) so the conversion owns the gesture first. */
  const LP_PRESS_MS = 420;
  const LP_CANCEL_SLOP = 9;
  const lpTimerRef = React.useRef<number | null>(null);
  const lpRef = React.useRef<{ pointerId: number; x: number; y: number } | null>(null);
  /** small expanding ring shown at the finger while the press is pending */
  const [lpHint, setLpHint] = React.useState<{ x: number; y: number } | null>(null);
  const clearLongPress = () => {
    if (lpTimerRef.current != null) {
      clearTimeout(lpTimerRef.current);
      lpTimerRef.current = null;
    }
    lpRef.current = null;
    setLpHint(null);
  };

  /** Capture-phase contextmenu swallow for the tick right after a band
   *  conversion — the browser fires its own long-press menu and Radix's
   *  canvas menu would open mid-gesture. Native capture listener beats
   *  both the browser default and React's synthetic handler at the root. */
  const suppressNextContextMenu = (ev: Event) => {
    ev.preventDefault();
    ev.stopPropagation();
  };

  /* ---------------- two-finger pinch zoom (touch) --------------------- */
  /** Every background touch registers here; the SECOND concurrent finger
   *  converts the gesture to a pinch (disarming long-press, pan and any
   *  young band). The workspace point under the initial midpoint stays
   *  glued to the CURRENT midpoint, so pinch-zoom and two-finger pan are
   *  one continuous gesture — the standard maps/Figma feel. */
  const touchesRef = React.useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = React.useRef<{
    a: number;
    b: number;
    startDist: number;
    startZoom: number;
    /** workspace coords under the initial midpoint (the zoom anchor) */
    wx: number;
    wy: number;
  } | null>(null);
  const pinchRafRef = React.useRef(0);
  const pinchLatestRef = React.useRef<{ midX: number; midY: number; dist: number } | null>(null);
  /** floating "63%" chip pinned to the two fingers' midpoint while a pinch
   *  is live — mobile-maps affordance; rAF-paced like the zoom itself.
   *  The two constants keep the chip fully on-canvas when fingers slide
   *  past the edge: half the widest chip ("1000%" mono ≈ 52px) and the
   *  chip's top offset above the midpoint (1.5× its ~16px height + pad). */
  const PINCH_HINT_HALF_W = 26;
  const PINCH_HINT_TOP = 32;
  const [pinchHint, setPinchHint] = React.useState<{ x: number; y: number } | null>(null);

  const applyPinch = React.useCallback(() => {
    pinchRafRef.current = 0;
    const pin = pinchRef.current;
    const cur = pinchLatestRef.current;
    if (!pin || !cur) return;
    const nz = clamp((pin.startZoom * cur.dist) / pin.startDist, ZOOM_MIN, ZOOM_MAX);
    setViewport({
      x: cur.midX - pin.wx * nz,
      y: cur.midY - pin.wy * nz,
      zoom: nz,
    });
    // the bubble floats above the fingers' midpoint; capture keeps the
    // gesture alive when a finger slides past the canvas edge, but the
    // raw midpoint would drag the chip out of view — clamp it on-canvas
    const W = rootRef.current?.clientWidth ?? 0;
    const H = rootRef.current?.clientHeight ?? 0;
    const minX = PINCH_HINT_HALF_W + 6;
    setPinchHint({
      x: clamp(cur.midX, minX, Math.max(minX, W - PINCH_HINT_HALF_W - 6)),
      y: clamp(cur.midY, PINCH_HINT_TOP, Math.max(PINCH_HINT_TOP, H - 8)),
    });
  }, [setViewport]);

  const endPinch = () => {
    pinchRef.current = null;
    pinchLatestRef.current = null;
    setPinchHint(null);
    if (pinchRafRef.current) {
      cancelAnimationFrame(pinchRafRef.current);
      pinchRafRef.current = 0;
    }
  };

  /** Called on the second background touch: snapshot both fingers, seed
   *  the anchor, capture both pointers so moves keep arriving even if a
   *  finger slides off the canvas edge. */
  const beginPinch = (secondId: number) => {
    const t = touchesRef.current;
    const ids = [...t.keys()].filter((id) => id !== secondId);
    const firstId = ids[0];
    const a = firstId != null ? t.get(firstId) : undefined;
    const b = t.get(secondId);
    if (!a || !b) return;
    const s = useWorkflowStore.getState();
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    pinchRef.current = {
      a: firstId,
      b: secondId,
      startDist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      startZoom: s.viewport.zoom,
      wx: (midX - s.viewport.x) / s.viewport.zoom,
      wy: (midY - s.viewport.y) / s.viewport.zoom,
    };
    // neither finger is captured yet (the first down armed a plain pan but
    // capturePointer already ran for it — re-capture is harmless); capture
    // both so the gesture survives fingers crossing the canvas border
    try {
      rootRef.current?.setPointerCapture(firstId);
    } catch {
      /* pointer gone or captured elsewhere — gesture still works on-canvas */
    }
  };

  /** Jobs enclosed by the band (intersect semantics), workspace coords. */
  const bandIds = React.useMemo(() => {
    if (!band) return null;
    const wx1 = (Math.min(band.x1, band.x2) - viewport.x) / viewport.zoom;
    const wx2 = (Math.max(band.x1, band.x2) - viewport.x) / viewport.zoom;
    const wy1 = (Math.min(band.y1, band.y2) - viewport.y) / viewport.zoom;
    const wy2 = (Math.max(band.y1, band.y2) - viewport.y) / viewport.zoom;
    const hit = new Set<string>();
    for (const j of jobs) {
      if (j.x < wx2 && j.x + CARD_W > wx1 && j.y < wy2 && j.y + CARD_H > wy1) {
        hit.add(j.id);
      }
    }
    return hit;
  }, [band, viewport, jobs]);

  React.useEffect(
    () => () => {
      if (panRafRef.current) cancelAnimationFrame(panRafRef.current);
      if (lpTimerRef.current != null) clearTimeout(lpTimerRef.current);
      if (pinchRafRef.current) cancelAnimationFrame(pinchRafRef.current);
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
    // Task 124 — arrivals GLIDE, gestures stay instant: the transition class
    // lives only for this programmatic jump (wheel/pan never add it, so the
    // transform stays raw under the user's hand); the timer retracts it
    // right after the cubic-bezier lands
    const ws = rootRef.current?.querySelector("[data-canvas='workspace']");
    ws?.classList.add("viewport-glide");
    const retract = setTimeout(() => ws?.classList.remove("viewport-glide"), 520);
    setViewport({
      x: rect.width / 2 - (job.x + CARD_W / 2) * zoom,
      y: rect.height / 2 - (job.y + CARD_H / 2) * zoom,
      zoom,
    });
    return () => clearTimeout(retract);
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

  // Viewport ownership on trigger changes (Task 98). One effect owns the
  // decision, with two triggers and a clear priority:
  //   layoutEpoch changed (import landed / auto-arrange) → ALWAYS re-fit,
  //     on the same workspace or after an auto-switch — the fresh content
  //     must be framed, a remembered view would frame the wrong world;
  //   workspace/project changed → restore the remembered viewport if this
  //     (project:workspace) pair has one (Task 98: coming BACK to a
  //     workspace lands you where you left it), else fit (first visit).
  // Poll ticks replace the `jobs` array reference every few seconds — the
  // two refs make those re-runs no-ops (nothing actually changed).
  const activeWorkspaceId = useWorkflowStore((s) => s.activeWorkspaceId);
  const projectKey = jobs.length > 0 ? jobs[0].projectId : null;
  const fitKey = projectKey ? `${projectKey}:${activeWorkspaceId ?? "-"}` : null;
  const fittedKeyRef = React.useRef<string | null>(null);
  // adopts the CURRENT layoutEpoch on first render: a fresh mount (reload,
  // or dashboard ⇄ canvas remount) must NOT read as "epoch changed" — the
  // restore decision on mount belongs to the keyChanged branch below
  // (hydrated memory → restore, else first-visit fit). A fixed -1 here made
  // every mount fit-again even when a remembered view existed (Task 99 bug).
  const fittedEpochRef = React.useRef<number | null>(null);
  if (fittedEpochRef.current === null) fittedEpochRef.current = layoutEpoch;
  React.useEffect(() => {
    if (loading || jobs.length === 0) return;
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    const epochChanged = fittedEpochRef.current !== layoutEpoch;
    const keyChanged = fittedKeyRef.current !== fitKey;
    if (!epochChanged && !keyChanged) return;
    fittedEpochRef.current = layoutEpoch;
    fittedKeyRef.current = fitKey;
    const frameAll = () => {
      const minX = Math.min(...jobs.map((j) => j.x));
      const maxX = Math.max(...jobs.map((j) => j.x + CARD_W));
      const minY = Math.min(...jobs.map((j) => j.y));
      const maxY = Math.max(...jobs.map((j) => j.y + CARD_H));
      frameBounds(rect.width, rect.height, minX, minY, maxX, maxY);
    };
    if (epochChanged) {
      // import/arrange wins over memory — and the fit lands in memory via
      // the store's write-through, so "where I left it" becomes the fit
      frameAll();
      return;
    }
    const remembered = fitKey ? useWorkflowStore.getState().viewportMemory[fitKey] : undefined;
    if (remembered) {
      setViewport(remembered);
      return;
    }
    frameAll();
  }, [loading, jobs, frameBounds, fitKey, layoutEpoch, setViewport]);

  // "Ready" hint: idle job whose upstream (any incoming edge, possibly in
  // ANOTHER workspace — links included) is completed.
  const allJobs = useWorkflowStore((s) => s.jobs);
  // Note spotlight lens (Task 75, predicate upgraded in Task 83): cards
  // without human judgment dim as one unit — the class lives on the
  // positioned [data-job] root so body, badge and ports recede together
  // (print is exempt via the globals.css override). hasJudgment is the
  // SAME predicate the dashboard Noted chip and the header count read:
  // a card annotated only through class notes must not go dark while
  // the lens claims to spotlight "noted" work.
  const noteSpotlight = useWorkflowStore((s) => s.noteSpotlight);
  const allEdges = useWorkflowStore((s) => s.edges);
  const completedIds = React.useMemo(
    () => new Set(allJobs.filter((j) => j.status === "completed").map((j) => j.id)),
    [allJobs]
  );
  const readyIds = React.useMemo(() => {
    const ready = new Set<string>();
    for (const e of allEdges) {
      if (completedIds.has(e.toJobId) === false && completedIds.has(e.fromJobId)) {
        ready.add(e.toJobId);
      }
    }
    return ready;
  }, [allEdges, completedIds]);

  const pendingFromType = React.useMemo(
    () => (pendingFrom ? (jobs.find((j) => j.id === pendingFrom.jobId)?.type ?? null) : null),
    [pendingFrom, jobs]
  );
  const workspaces = useWorkflowStore((s) => s.workspaces);
  const activeWorkspaceName = React.useMemo(
    () => workspaces.find((w) => w.id === activeWorkspaceId)?.name ?? null,
    [workspaces, activeWorkspaceId]
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
      // trackpad pinch arrives as ctrl+wheel with small deltas — map it to a
      // smooth exponential zoom instead of the discrete mouse-wheel factor
      // (deltaY < 0 = fingers apart = zoom in, same sign as the wheel)
      const factor = e.ctrlKey
        ? Math.exp(-e.deltaY * 0.014)
        : e.deltaY < 0
          ? 1.1
          : 1 / 1.1;
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

  /* ---------------- left-drag pan / shift-drag band ---------------- */
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
    const rect = e.currentTarget.getBoundingClientRect();
    // touch: register every background finger. A SECOND concurrent finger
    // converts whatever is running (pan / pending long-press / young band)
    // into a pinch — the one gesture touch has that desktop lacks.
    if (e.pointerType === "touch") {
      touchesRef.current.set(e.pointerId, {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      if (pinchRef.current) return; // 3rd+ finger rides along — ignored
      if (touchesRef.current.size >= 2 && !pinchRef.current) {
        clearLongPress();
        if (panRafRef.current) {
          cancelAnimationFrame(panRafRef.current);
          panRafRef.current = 0;
        }
        panRef.current = null; // pending sub-frame deltas are negligible
        if (bandRef.current) {
          // a band younger than the second finger discards quietly — the
          // selection stays untouched (committing mid-gesture would surprise)
          bandRef.current = null;
          setBand(null);
        }
        capturePointer(e); // second finger travels with the root too
        beginPinch(e.pointerId);
        return;
      }
    }
    if (e.shiftKey) {
      // Shift + background drag = rubber-band select (plain drag keeps
      // panning so existing muscle memory is untouched; a shift-click
      // without movement falls out below as "clear selection")
      bandRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX - rect.left,
        startY: e.clientY - rect.top,
      };
      capturePointer(e);
      return;
    }
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
    capturePointer(e);
    // touch background press: ALSO arm a long-press — if the finger holds
    // still, the pan converts to a rubber-band (there is no Shift on touch).
    // A second pointer (pinch) or an early drag disarms it below.
    if (e.pointerType === "touch") {
      const lp = { pointerId: e.pointerId, x: e.clientX - rect.left, y: e.clientY - rect.top };
      lpRef.current = lp;
      setLpHint({ x: lp.x, y: lp.y });
      lpTimerRef.current = window.setTimeout(() => {
        lpTimerRef.current = null;
        const p = panRef.current;
        if (!lpRef.current || !p || p.pointerId !== lp.pointerId || p.moved) {
          lpRef.current = null;
          setLpHint(null);
          return;
        }
        // convert: the not-yet-moved pan dies, the band is born anchored
        // at the original touch point (not wherever the finger drifted)
        panRef.current = null;
        bandRef.current = {
          pointerId: lp.pointerId,
          startX: lp.x,
          startY: lp.y,
          fromTouch: true,
          moved: false,
          lx: lp.x,
          ly: lp.y,
        };
        setBand({ x1: lp.x, y1: lp.y, x2: lp.x, y2: lp.y });
        lpRef.current = null;
        setLpHint(null);
        try {
          navigator.vibrate?.(12);
        } catch {
          /* no haptics — the ring hint already fired */
        }
        // the browser's own long-press contextmenu lands ~80 ms later and
        // would open the canvas menu mid-gesture — swallow exactly that one
        rootRef.current?.addEventListener("contextmenu", suppressNextContextMenu, {
          once: true,
          capture: true,
        });
      }, LP_PRESS_MS);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    // keep the touch registry fresh; while a pinch is live it consumes the
    // moves of its two fingers (rAF-coalesced like pan) and nothing else runs
    if (e.pointerType === "touch" && touchesRef.current.has(e.pointerId)) {
      const trect = e.currentTarget.getBoundingClientRect();
      touchesRef.current.set(e.pointerId, {
        x: e.clientX - trect.left,
        y: e.clientY - trect.top,
      });
      const pin = pinchRef.current;
      if (pin && (e.pointerId === pin.a || e.pointerId === pin.b)) {
        const a = touchesRef.current.get(pin.a);
        const b = touchesRef.current.get(pin.b);
        if (a && b) {
          pinchLatestRef.current = {
            midX: (a.x + b.x) / 2,
            midY: (a.y + b.y) / 2,
            dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
          };
          if (pinchRafRef.current === 0) {
            pinchRafRef.current = requestAnimationFrame(applyPinch);
          }
        }
        return;
      }
    }
    // real movement while the long-press is pending = it's a pan — disarm
    const lp = lpRef.current;
    if (lp && e.pointerId === lp.pointerId && lpTimerRef.current != null) {
      const lprect = e.currentTarget.getBoundingClientRect();
      if (Math.hypot(e.clientX - lprect.left - lp.x, e.clientY - lprect.top - lp.y) > LP_CANCEL_SLOP) {
        clearLongPress();
      }
    }
    const b = bandRef.current;
    if (b && e.pointerId === b.pointerId) {
      const rect = e.currentTarget.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      // a touch band that never really dragged cancels on lift instead of
      // committing — track the first real displacement here
      if (b.fromTouch && !b.moved && Math.hypot(cx - (b.lx ?? b.startX), cy - (b.ly ?? b.startY)) >= 3) {
        b.moved = true;
      }
      b.lx = cx;
      b.ly = cy;
      setBand({
        x1: b.startX,
        y1: b.startY,
        x2: cx,
        y2: cy,
      });
      return;
    }
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
    touchesRef.current.delete(e.pointerId);
    const pin = pinchRef.current;
    if (pin && (e.pointerId === pin.a || e.pointerId === pin.b)) {
      // one finger lifted = pinch over. The remaining finger does NOT resume
      // pan (pointer identity changed mid-gesture) and this up must not fall
      // through to the "click on background" semantics below.
      endPinch();
      return;
    }
    const b = bandRef.current;
    if (b && e.pointerId === b.pointerId) {
      bandRef.current = null;
      // touch long-press that never dragged = mode-switch tap — cancel
      // quietly, DON'T commit an empty band over the user's selection
      if (b.fromTouch && !b.moved) {
        setBand(null);
        return;
      }
      // commit whatever the band enclosed — an empty result (shift-click on
      // bare canvas, or a band over empty space) clears the selection
      const ids = bandIds ? [...bandIds] : [];
      setBand(null);
      useWorkflowStore.getState().selectMany(ids);
      return;
    }
    const p = panRef.current;
    if (!p || e.pointerId !== p.pointerId) return;
    // a touch that lifted before the long-press matured is just a pan-tap
    if (lpRef.current?.pointerId === e.pointerId) clearLongPress();
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
    touchesRef.current.delete(e.pointerId);
    const pin = pinchRef.current;
    if (pin && (e.pointerId === pin.a || e.pointerId === pin.b)) {
      endPinch();
      return;
    }
    if (lpRef.current?.pointerId === e.pointerId) clearLongPress();
    const b = bandRef.current;
    if (b && e.pointerId === b.pointerId) {
      bandRef.current = null;
      setBand(null);
      return;
    }
    const p = panRef.current;
    if (!p || e.pointerId !== p.pointerId) return;
    panRef.current = null;
    if (panRafRef.current) {
      cancelAnimationFrame(panRafRef.current);
      panRafRef.current = 0;
    }
  };

  const zoom = viewport.zoom;

  /* ---------------- named viewport bookmarks (Task 100) -------------- */
  // bookmarks live in the store (hydrated from localStorage at boot, saved
  // synchronously on the explicit save/delete actions — never per-frame).
  // Rows sort by hotkey slot first (Task 101): seats 1–9 read top-to-bottom
  // like the keys they map to; unnumbered (slots were full) trail behind.
  const wsBookmarks = useWorkflowStore((s) => s.viewportBookmarks);
  const saveViewportBookmark = useWorkflowStore((s) => s.saveViewportBookmark);
  const deleteViewportBookmark = useWorkflowStore((s) => s.deleteViewportBookmark);
  const project = useWorkflowStore((s) => s.project);
  const [bookmarksOpen, setBookmarksOpen] = React.useState(false);
  const [bookmarkName, setBookmarkName] = React.useState("");
  // bookmark key mirrors the store actions' derivation (project?.id, NOT
  // jobs[0].projectId): bookmarks are a per-(project:workspace) USER asset —
  // they must survive deleting the last job, unlike fitKey which frames
  // content and therefore needs jobs to exist
  const bookmarkWsKey = `${project?.id ?? "-"}:${activeWorkspaceId ?? "-"}`;
  const namedViews = wsBookmarks[bookmarkWsKey] ?? {};
  const namedList = Object.entries(namedViews).sort(([an, a], [bn, b]) => {
    const sa = a.slot ?? Number.MAX_SAFE_INTEGER;
    const sb = b.slot ?? Number.MAX_SAFE_INTEGER;
    if (sa !== sb) return sa - sb;
    return an.localeCompare(bn);
  });

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

  const resetView = () => {
    // infinite canvas: "100%" also recenters on the content bbox (the
    // origin (0,0) is just an arbitrary point once coordinates can go
    // negative — centering avoids resetting into empty space)
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect || jobs.length === 0) {
      setViewport({ x: 0, y: 0, zoom: 1 });
      return;
    }
    const cx = (Math.min(...jobs.map((j) => j.x)) + Math.max(...jobs.map((j) => j.x + CARD_W))) / 2;
    const cy = (Math.min(...jobs.map((j) => j.y)) + Math.max(...jobs.map((j) => j.y + CARD_H))) / 2;
    setViewport({ x: rect.width / 2 - cx, y: rect.height / 2 - cy, zoom: 1 });
  };

  // ---- PNG poster doors (download + clipboard share ONE raster) ---------
  // posterBusy discriminates the two doors so each button can spin its own
  // icon while BOTH stay disabled — the raster is a shared resource and a
  // second concurrent capture would just burn the font cache for nothing.
  const [posterBusy, setPosterBusy] = React.useState<"download" | "copy" | null>(null);
  const [copiedPng, setCopiedPng] = React.useState(false);
  const copiedTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(
    () => () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    },
    [],
  );
  const posterMeta = useCallback(
    () => ({
      projectName: useWorkflowStore.getState().project?.name ?? "project",
      workspaceName: activeWorkspaceName ?? "workspace",
      jobs,
      edges,
      cardW: CARD_W,
      cardH: CARD_H,
    }),
    [jobs, edges, activeWorkspaceName],
  );
  const handleExportPng = useCallback(async () => {
    if (posterBusy) return;
    setPosterBusy("download");
    try {
      const res = await exportCanvasPng(posterMeta());
      toast({
        title: "Canvas exported",
        description: `${res.fileName} · ${res.width}\u00d7${res.height} px \u00b7 ${fmtBytes(res.bytes)}`,
      });
    } catch (err) {
      toast({
        title: "Export failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setPosterBusy(null);
    }
  }, [posterBusy, posterMeta]);
  const handleCopyPng = useCallback(async () => {
    if (posterBusy) return;
    setPosterBusy("copy");
    try {
      const ok = await copyCanvasPng(posterMeta());
      if (ok) {
        if (copiedTimer.current) clearTimeout(copiedTimer.current);
        setCopiedPng(true);
        copiedTimer.current = setTimeout(() => setCopiedPng(false), 1600);
        toast({
          title: "Canvas copied",
          description: "Poster PNG on the clipboard — paste into docs or slides",
        });
      } else {
        toast({
          title: "Canvas could not be copied",
          description: "Clipboard access was blocked — use the PNG download instead.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Copy failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setPosterBusy(null);
    }
  }, [posterBusy, posterMeta]);

  // ---- workflow JSON export/import --------------------------------------
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const handleExportJson = useCallback(() => {
    const s = useWorkflowStore.getState();
    const file = buildWorkflowFile(
      jobs,
      edges,
      s.project?.name ?? "project",
      activeWorkspaceName ?? "workspace"
    );
    if (!file) {
      toast({ title: "Nothing to export", description: "The canvas is empty." });
      return;
    }
    downloadWorkflowJson(file, workflowFileName(activeWorkspaceName ?? "workspace"));
    toast({
      title: "Workflow exported",
      description: `${file.jobs.length} jobs · ${file.edges.length} links — import it into any workspace to recreate the graph (idle)`,
    });
  }, [jobs, edges, activeWorkspaceName]);

  // Multi-file since Task 86: the picker stages ANY number of JSON files.
  // Task 92: the post-parse choreography (all-invalid toast / preview
  // dialog hand-off) is stageWorkflowFiles — shared with the palette and
  // the canvas drop form, so all three entry points stay one contract.
  const onImportFilePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ""; // allow re-picking the same file later
    if (files.length === 0) return;
    void stageWorkflowFiles(files);
  }, []);

  // Task 92 — third import form: drop files anywhere on the canvas. The
  // section's pointer handlers never see this gesture (HTML5 DnD ≠ pointer
  // events), so card dragging and panning are untouched.
  const { dropProps, active: dropActive, fileCount: dropFileCount, folderDrag: dropFolder } = useDropImport(stageWorkflowFiles);

  return (
    <ContextMenu>
      {/* Pipeline paper is wide, not tall: the canvas view prints to a
          LANDSCAPE sheet (the fit-to-paper budget in globals.css assumes
          it). A <style> tag because @page cannot be scoped by selectors —
          this element only mounts in the canvas view, so dashboard prints
          keep their portrait default. WITH the job inspector open the
          report is the document (Task 114) and the landscape size stands
          down — margins only, so the report's own paper wins (Task 115). */}
      <style media="print">{inspectId == null ? `@page { size: A4 landscape; margin: 12mm; }` : `@page { margin: 12mm; }`}</style>
      <ContextMenuTrigger asChild>
        <section
          ref={rootRef}
          data-canvas="viewport"
          aria-label="Workflow canvas"
          className="no-drag-select canvas-grid relative min-w-0 flex-1 touch-none overflow-hidden bg-background active:cursor-grabbing cursor-grab"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          {...dropProps}
          style={{
            // infinite dot grid — painted on the viewport itself so it
            // covers the whole screen wherever the (unbounded) workspace
            // is panned; position tracks the pan so dots stay glued to
            // workspace points, size keeps ~22px on screen at any zoom
            backgroundSize: `${(22 / zoom).toFixed(2)}px ${(22 / zoom).toFixed(2)}px`,
            backgroundPosition: `${viewport.x}px ${viewport.y}px`,
            // rubber-band gesture gets a precision cursor (overrides the
            // grab cursor while the band is being drawn)
            cursor: band ? "crosshair" : undefined,
            // fit-to-paper geometry — consumed by the @media print rules
            // in globals.css; screen layout ignores these. Lives on the
            // SECTION (not the workspace): custom properties inherit
            // DOWNWARD, and the section's own print rules read them too.
            "--print-minx": `${printFit.minx}px`,
            "--print-miny": `${printFit.miny}px`,
            "--print-w": `${printFit.w}px`,
            "--print-h": `${printFit.h}px`,
            "--print-z": printFit.z,
          } as React.CSSProperties}
        >
      {loading && jobs.length === 0 ? (
        <CanvasSkeleton />
      ) : (
        <div
          data-canvas="workspace"
          className="absolute left-0 top-0"
          style={{
            width: 0,
            height: 0,
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            // (fit-to-paper geometry lives on the parent section — custom
            // properties inherit downward to this div's print rules)
          }}
        >
          <EdgesLayer edges={edges} jobs={jobs} />
          <LiveWire rootRef={rootRef} jobs={jobs} />
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              dimmed={noteSpotlight && !hasJudgment(job)}
              selected={selectedIds.includes(job.id)}
              primary={selectedId === job.id}
              bandMatch={bandIds?.has(job.id) ?? false}
              zoom={zoom}
              pendingFrom={pendingFrom}
              pendingFromType={pendingFromType}
              isReady={
                job.status === "idle" && readyIds.has(job.id) && !completedIds.has(job.id)
              }
              inspected={inspectId === job.id}
              onSelect={select}
              onToggleSelect={toggleSelectProxy}
              onInspect={inspect}
              onDragCommit={moveJobCommitProxy}
              onGroupDragCommit={groupDragCommitProxy}
              onStartConnect={setPendingFromProxy}
              onCancelConnect={cancelConnect}
              onConnect={connectProxy}
            />
          ))}
        </div>
      )}

      {/* Pipeline overview KPI bar (top-left) */}
      <PipelineKpi />

      {/* Rubber-band selection rectangle (marching ants) */}
      {band && (
        <svg
          className="pointer-events-none absolute inset-0 z-20"
          width="100%"
          height="100%"
          aria-hidden="true"
        >
          <rect
            x={Math.min(band.x1, band.x2)}
            y={Math.min(band.y1, band.y2)}
            width={Math.abs(band.x2 - band.x1)}
            height={Math.abs(band.y2 - band.y1)}
            rx={4}
            className="band-ants"
            fill="var(--primary)"
            fillOpacity={0.05}
            stroke="var(--primary)"
            strokeOpacity={0.85}
            strokeWidth={1.5}
            strokeDasharray="7 5"
          />
        </svg>
      )}

      {/* touch long-press affordance — an expanding ring at the finger so
          the gesture's 420 ms arm time reads as intent, not lag */}
      {lpHint && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute z-20"
          style={{ left: lpHint.x, top: lpHint.y }}
        >
          <span className="lp-pulse absolute block size-12 rounded-full border-2 border-primary/70 bg-primary/10" />
        </span>
      )}

      {/* live zoom % bubble pinned between the pinching fingers */}
      {pinchHint && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[150%]"
          style={{ left: pinchHint.x, top: pinchHint.y }}
        >
          <span className="block rounded-full bg-primary px-2 py-0.5 font-mono text-[10px] font-bold leading-none text-primary-foreground shadow-md ring-1 ring-background/60">
            {Math.round(viewport.zoom * 100)}%
          </span>
        </span>
      )}

      {/* Bulk-selection toolbar (align · distribute · duplicate · delete) */}
      <SelectionToolbar rootRef={rootRef} hidden={band != null} />

      {/* Task 129 — post-apply connection suggestions (bottom-center chip) */}
      <TemplateSuggestionsChip />

      {/* Bird's-eye navigation map (bottom-right) — visibility is a
          session-local store switch so the M key, the toolbar toggle and
          the map itself all agree on one source of truth (Task 105) */}
      {minimapOpen && <CanvasMinimap rootRef={rootRef} />}

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
          <div className="max-w-md rounded-xl border border-dashed bg-card/60 px-6 py-5 text-center backdrop-blur-sm animate-rise">
            <p className="text-sm font-medium">
              {allJobs.length > 0
                ? `“${activeWorkspaceName ?? "This workspace"}” is empty`
                : "The canvas is empty"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {allJobs.length > 0
                ? "Drag job types in, or right-click a job in another workspace → “Copy as link to…” to continue that pipeline here."
                : "Drag a job type from the palette onto the canvas, or scaffold the whole single-particle workflow in one click:"}
            </p>
            {allJobs.length === 0 && (
              <Button
                size="sm"
                className="pointer-events-auto mt-3 gap-1.5"
                onClick={() => useWorkflowStore.getState().setTemplatePresetsOpen(true)}
                title="Create 10 pre-wired jobs (import → motion correction → CTF → picking → extraction → 2D → initial model → refine → mask → postprocess) — pick a parameter preset or use the defaults"
              >
                <Wand2 className="size-3.5" aria-hidden="true" />
                Scaffold standard SPA pipeline
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Zoom controls + auto-arrange */}
      <div
        data-canvas-ui="zoom-controls"
        className="no-print card-lift absolute bottom-3 left-3 z-30 flex items-center gap-0.5 rounded-lg border bg-card/95 p-1 backdrop-blur"
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
          onClick={resetView}
          aria-label="Reset view"
          title="Reset zoom and recenter on the workflow"
        >
          <RotateCcw className="size-4" />
        </Button>
        <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
        {/* Task 105 — minimap toggle: the map is discoverable by default;
            hiding it is one keypress (M) or this button away, and the
            active state reads from the same store the M branch flips. */}
        <Button
          variant="ghost"
          size="icon"
          className={`size-7 ${minimapOpen ? "text-primary" : ""}`}
          onClick={() => setMinimapOpen(!minimapOpen)}
          aria-pressed={minimapOpen}
          aria-label="Toggle minimap"
          title="Toggle the world-overview map (M)"
          data-canvas-ui="minimap-toggle"
        >
          <MapIcon className="size-4" />
        </Button>
        <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
        {/* Task 104 — undo/redo live next to the tools they reverse: the
            buttons read the SAME stacks the keyboard walks, so a toast
            expiry never leaves the UI guessing. Disabled = the stack's
            honest empty state, not a hidden feature. */}
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => void undoHistory()}
          disabled={historyPast.length === 0}
          aria-label="Undo"
          title={
            historyPast.length > 0
              ? `Undo: ${historyPast[historyPast.length - 1].label} — ${historyPast.length} step${historyPast.length === 1 ? "" : "s"} in history (Ctrl+Z)`
              : "Nothing to undo (Ctrl+Z)"
          }
          data-canvas-ui="undo-btn"
        >
          <Undo2 className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => void redoHistory()}
          disabled={historyFuture.length === 0}
          aria-label="Redo"
          title={
            historyFuture.length > 0
              ? `Redo: ${historyFuture[historyFuture.length - 1].label} (Ctrl+Shift+Z or Ctrl+Y)`
              : "Nothing to redo (Ctrl+Shift+Z or Ctrl+Y)"
          }
          data-canvas-ui="redo-btn"
        >
          <Redo2 className="size-4" />
        </Button>
        <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
        {/* Task 106 — the history panel: the linear stack made visible.
            Rows are the ENTRIES (transitions), the Now divider is the
            present; clicking a past row undoes everything after it,
            clicking a future row redoes up to it. The trigger picks up
            text-primary while undone work is parked in the future — the
            same "this button holds something" dialect as the bookmark
            icon's fill. */}
        <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`size-7 ${historyFuture.length > 0 ? "text-primary" : ""}`}
              aria-label="History"
              title="Walk the undo/redo timeline entry by entry"
              data-canvas-ui="history-trigger"
            >
              <History className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-2" data-canvas-ui="history-panel">
            <div className="flex items-baseline justify-between px-1 pb-1.5">
              <span className="text-xs font-semibold">History</span>
              <span className="text-[10px] tabular-nums text-muted-foreground" data-canvas-ui="history-count">
                {historyPast.length + historyFuture.length} steps
              </span>
            </div>
            {historyPast.length + historyFuture.length === 0 ? (
              <p className="px-1 py-3 text-[11px] leading-4 text-muted-foreground" data-canvas-ui="history-empty">
                No history yet — moves, aligns, tidies and deletes land here. Click a step to jump back to it.
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto" data-canvas-ui="history-list">
                <HistoryRows
                  past={historyPast}
                  future={historyFuture}
                  jumping={jumping}
                  onBack={jumpBack}
                  onForward={jumpForward}
                />
              </div>
            )}
          </PopoverContent>
        </Popover>
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
        <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
        {/* named viewport bookmarks — a bookmark is a USER-CREATED asset
            (localStorage, cross-session), unlike the per-workspace memory
            (sessionStorage, per-tab). Same toolbar dialect as the rest:
            ghost icon + Popover panel. */}
        <Popover open={bookmarksOpen} onOpenChange={setBookmarksOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Viewport bookmarks"
              title="Save / jump to named views (kept across sessions)"
              data-canvas-ui="viewport-bookmarks-trigger"
            >
              <Bookmark className={`size-4 ${namedList.length > 0 ? "fill-current text-primary" : ""}`} />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-2" data-canvas-ui="viewport-bookmarks-panel">
            <div className="flex items-baseline justify-between px-1 pb-1.5">
              <span className="text-xs font-semibold">Saved views</span>
              <span className="text-[10px] tabular-nums text-muted-foreground">now {Math.round(zoom * 100)}%</span>
            </div>
            <div className="flex gap-1 pb-1">
              <Input
                value={bookmarkName}
                onChange={(e) => setBookmarkName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && bookmarkName.trim()) {
                    if (saveViewportBookmark(bookmarkName)) setBookmarkName("");
                  }
                }}
                placeholder="Name this view…"
                aria-label="Bookmark name"
                className="h-7 text-xs"
                maxLength={60}
                data-canvas-ui="viewport-bookmark-input"
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                disabled={!bookmarkName.trim()}
                aria-label="Save current view"
                data-canvas-ui="viewport-bookmark-save"
                onClick={() => {
                  if (saveViewportBookmark(bookmarkName)) setBookmarkName("");
                }}
              >
                <BookmarkPlus className="size-4" />
              </Button>
            </div>
            {namedList.length === 0 ? (
              <p className="px-1 py-2 text-xs text-muted-foreground" data-canvas-ui="viewport-bookmark-empty">
                No saved views here yet — name the current view to keep it.
              </p>
            ) : (
              <ul className="max-h-44 overflow-y-auto">
                {namedList.map(([name, bm]) => (
                  // key binds the SNAPSHOT (name + rounded zoom), not just the
                  // name: a same-name overwrite — local or synced from another
                  // tab via the storage event — remounts the row, replaying the
                  // entrance animation so "this view changed" is visible
                  // without any wording. Slot is excluded: overwrite keeps the
                  // seat (Task 101), re-seating must not flash.
                  <li
                    key={`${name}:${Math.round(bm.viewport.zoom * 100)}`}
                    className="group flex items-center gap-1 rounded px-1 animate-in fade-in slide-in-from-left-1 duration-200"
                    data-canvas-ui="viewport-bookmark-row"
                  >
                    {bm.slot != null && (
                      <kbd
                        className="shrink-0 rounded border bg-muted px-1 font-mono text-[10px] leading-4 text-muted-foreground"
                        title={`Press ${bm.slot} on the canvas to jump here`}
                        data-canvas-ui="viewport-bookmark-slot"
                      >
                        {bm.slot}
                      </kbd>
                    )}
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center justify-between rounded px-1.5 py-1 text-left text-xs hover:bg-accent"
                      onClick={() => {
                        setViewport(bm.viewport);
                        setBookmarksOpen(false);
                      }}
                      title={`Jump to "${name}"`}
                    >
                      <span className="truncate font-medium">{name}</span>
                      <span className="ml-2 shrink-0 tabular-nums text-muted-foreground">{Math.round(bm.viewport.zoom * 100)}%</span>
                    </button>
                    <button
                      type="button"
                      className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                      aria-label={`Delete bookmark ${name}`}
                      data-canvas-ui="viewport-bookmark-delete"
                      onClick={() => deleteViewportBookmark(name)}
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {namedList.length > 0 && (
              <p className="border-t px-1 pb-0.5 pt-1.5 text-[10px] leading-4 text-muted-foreground" data-canvas-ui="viewport-bookmark-hint">
                Keys 1–9 jump straight to a numbered view — the seat stays with its name even after deletions.
              </p>
            )}
          </PopoverContent>
        </Popover>
        <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => void handleExportPng()}
          disabled={posterBusy !== null || jobs.length === 0}
          aria-label="Export canvas as PNG"
          title="Export the whole workflow as a poster PNG (content-fit, with footer)"
        >
          {posterBusy === "download" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn("size-7", copiedPng && "text-primary")}
          onClick={() => void handleCopyPng()}
          disabled={posterBusy !== null || jobs.length === 0}
          aria-label="Copy canvas as PNG image"
          data-canvas-ui="canvas-export-png-copy"
          data-copy-state={copiedPng ? "png" : "idle"}
          title={
            copiedPng
              ? "Copied — paste it wherever you need it"
              : "Copy the whole workflow as a poster PNG — paste into docs or slides"
          }
        >
          {posterBusy === "copy" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : copiedPng ? (
            <Check className="size-4" />
          ) : (
            <ImageUp className="size-4" />
          )}
        </Button>
      </div>

      {/* workflow JSON import — hidden picker opened from the context menu;
          multiple since Task 86 (any number of files staged per session) */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        multiple
        className="hidden"
        onChange={onImportFilePick}
        aria-label="Import workflow JSON files"
        tabIndex={-1}
      />

      {/* Task 92 — drop-import veil. Rendered last so it paints above the
          canvas layers; pointer-events-none keeps the drop event free to
          land on the section itself. */}
      {dropActive && <DropImportOverlay count={dropFileCount} folder={dropFolder} />}
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
        <ContextMenuItem onClick={() => void handleExportPng()} disabled={jobs.length === 0 || posterBusy !== null}>
          <Download />
          Export canvas as PNG
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => void handleCopyPng()}
          disabled={jobs.length === 0 || posterBusy !== null}
          data-canvas-ui="canvas-menu-png-copy"
        >
          <ImageUp />
          Copy canvas as PNG image
        </ContextMenuItem>
        <ContextMenuItem onClick={handleExportJson} disabled={jobs.length === 0}>
          <FileJson />
          Export workflow as JSON
        </ContextMenuItem>
        <ContextMenuItem onClick={() => fileInputRef.current?.click()}>
          <FileUp />
          Import workflow from JSON…
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
const groupDragCommitProxy = (moves: { id: string; x: number; y: number }[]) => {
  void useWorkflowStore.getState().moveJobsCommit(moves);
};
const toggleSelectProxy = (id: string) => {
  useWorkflowStore.getState().toggleSelect(id);
};
const setPendingFromProxy = (pending: PendingFrom) => {
  useWorkflowStore.getState().setPendingFrom(pending);
};
const connectProxy = (from: string, to: string, fromPort: string, toPort: string) => {
  void useWorkflowStore.getState().connect(from, to, fromPort, toPort);
};

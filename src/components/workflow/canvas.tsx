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
  Route,
  Search,
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
  PORT_COLORS,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
  jobType,
  outputKindOf,
  portY,
} from "@/lib/workflow";
import { hasJudgment } from "@/lib/class-notes";
import { walkTimeline } from "@/lib/timeline-walk"; // t682 — the chain drinks the same honest-window well
import { criticalPath } from "@/lib/critical-path"; // t682 — the walk the fifth face speaks
import { fmtDuration } from "@/lib/duration";
import { pendingWirePath } from "@/lib/edge-geom";
import { CanvasFindBar } from "./canvas-find-bar";
import { jobMatchWhy, jobMatchesFind, type MatchWhy } from "@/lib/job-match"; // t653 — one matcher, three consumers, one home; t655 — the why rides the same lib
import { CanvasFunnelDoor } from "./canvas-funnel-door";
import { copyCanvasPng, exportCanvasPng, fmtBytes } from "@/lib/canvas-export";
import {
  buildWorkflowFile,
  downloadWorkflowJson,
  workflowFileName,
} from "@/lib/workflow-io";
import { useWorkflowStore, useActiveWorkspaceJobs, useActiveWorkspaceEdges, type PendingFrom, type HistoryEntry, type HistoryEntryKind, type Viewport } from "@/lib/store";
import { beginGroupDrag, endGroupDrag, moveGroupDrag } from "@/lib/group-drag";
import { nearestNeighbor, type NavDir } from "@/lib/canvas-nav"; // t775 — the arrow-key navigator: the geometry brain lives in the lib, the canvas resolves and moves the DOM focus
import type { JobDTO, PortKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { EdgesLayer } from "./edges-layer";
import { PipelineKpi } from "./pipeline-kpi";
import { CanvasMinimap } from "./canvas-minimap";
import { JobCard } from "./job-card";
import { STATUS_FLOOR, type StatusWord } from "@/lib/status-style"; // t647 — the floor map lives with the word law
import { TypeIcon } from "./icons";
import { ParamsDiffDialog } from "./params-diff-dialog";
import { useDropImport, DropImportOverlay } from "./drop-import";
import { stageWorkflowFiles } from "@/lib/import-stage";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
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

/** t364 — how many cards one reveal frame mounts (see WorkflowCanvas): a
 *  landing canvas streams in ~20 cards per frame instead of one giant
 *  commit, and a list that grows by ≤ this many renders immediately (one
 *  added card must never stagger). */
const REVEAL_CHUNK = 20;

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

/** t588 — when the glide class retracts after a programmatic arrival: the
 *  transition runs 0.48s, the extra 40ms is slack so the class never
 *  peels off mid-bezier (t124's original 520 margin, now named — both
 *  the focus effect and the bookmark arrivals share the one number). */
const GLIDE_RETRACT_MS = 520;

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

  // t742 — the live wire wears its ink BEFORE it exists: the pending port
  // already knows what data will flow (outputKindOf asks the same book the
  // committed wires read), so the preview line paints the kind's resting
  // wire hex while it is still being dragged. Wiring is the moment the
  // user declares what flows — the color should answer immediately, not
  // after the commit. A port without a word (no kind) stays bare primary:
  // the wire-ink law's bare face — honest colorlessness, not a borrowed
  // hue (t738's wordless chip, met again at the wire's birthplace).

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
  const liveKind = outputKindOf(job.type, pendingFrom.port);
  const ink = liveKind ? PORT_COLORS[liveKind].wire : undefined;

  return (
    <svg
      width={bw}
      height={bh}
      viewBox={`${bx} ${by} ${bw} ${bh}`}
      className="pointer-events-none absolute left-0 top-0"
      style={{ left: bx, top: by, overflow: "visible" }}
      aria-hidden="true"
    >
      <circle cx={sx} cy={sy} r={4} fill={ink ?? "var(--primary)"} opacity={0.9} />
      <path
        d={pendingWirePath(sx, sy, cursor.x, cursor.y, pendingFrom.dir === "in" ? "in" : "out")}
        stroke={ink ?? "var(--primary)"}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.8}
        fill="none"
        className="edge-flow"
      />
      <circle cx={cursor.x} cy={cursor.y} r={3} fill={ink ?? "var(--primary)"} opacity={0.55} />
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
  delete: { icon: Trash2, noun: "delete", className: "text-danger-500/90" },
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
  // t789 — the confirmed-delete flag: onCloseAutoFocus fires on BOTH exits;
  // only the confirmed one redirects the keyboard to the canvas.
  const deletedRef = React.useRef(false);
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
          className="size-7 text-danger-600 hover:bg-danger-500/10 hover:text-danger-700 dark:text-danger-400 dark:hover:text-danger-300"
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
        <AlertDialogContent
          onCloseAutoFocus={(e) => {
            if (!deletedRef.current) return; // cancel — Radix hands back to the toolbar button
            e.preventDefault();
            deletedRef.current = false;
            rootRef.current?.focus(); // t789 — the relay: the keyboard stands where the cards were
          }}
        >
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
            {/* Task 177 token truce: rose-600 → the unified --destructive
                (the dialog confirms in page.tsx and the toast already wear
                it — one red, both themes, no hardcoded hue left) */}
            <AlertDialogAction
              className="h-10 bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40"
              onClick={() => {
                deletedRef.current = true; // t789 — the confirmed path
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
  // t775 — the arrow-key navigator's brain: from the focused card, find the
  // nearest card in the arrow's direction (the lib owns the geometry) and
  // move the DOM focus there. Focus transfer is the WHOLE gesture — arrows
  // never select, never inspect (the Enter/Space contract owns acting; t773's
  // door lineage, keyboard edition). The querySelector reads the card's
  // data-card-btn anchor — the one honest focus target a card owns. The
  // jobs array is the SAME subscription the render loop already holds —
  // zero extra store passes, and the callback identity follows the array
  // the memo comparator already watches (no new re-render channel).
  const navigateCard = React.useCallback(
    (fromId: string, dir: NavDir) => {
      const target = nearestNeighbor(jobs, fromId, dir);
      if (!target) return;
      document.querySelector<HTMLElement>(`[data-card-btn="${target}"]`)?.focus();
    },
    [jobs]
  );
  // t737 — the legend's focus: the kind word currently focused from the
  // toolbar's legend (null when none). Ephemeral view state, same family
  // as the hover channel — deliberately not store material.
  const [legendKind, setLegendKind] = React.useState<PortKind | null>(null);
  // t739 — the legend's hover card: which word's index card is open (null
  // when none). Same ephemeral family as legendKind, and the two answer
  // different questions: hover READS the list, click FOCUSES the wires —
  // the card is the TOC's index page, the focus is the reading lamp.
  const [legendHover, setLegendHover] = React.useState<PortKind | null>(null);
  // t737 — the legend face's roster: the kinds the CURRENT world's wires
  // actually wear, derived from the same book the wires themselves read
  // (outputKindOf + PORT_COLORS), in the book's own order. A legend of
  // colors this canvas never paints would be a lie; the roster is the
  // world's own chromatography. Each entry carries its wire count — the
  // title teaches how MANY wires speak that word. t739 — each entry also
  // carries its wire ROWS (from-name → to-name), the index page the hover
  // card prints; and the roster speaks the CANVAS's caliber: a wire
  // belongs only when BOTH endpoints are visible jobs — the same law
  // edges-layer paints by (cross-workspace flows leave the roster with
  // their missing target). The legend indexes the drawn canvas, not the
  // ledger: what isn't painted has no entry to teach from.
  const legend = React.useMemo(() => {
    const counts = new Map<PortKind, number>();
    const rows = new Map<PortKind, { from: string; to: string }[]>();
    const byId = new Map(jobs.map((j) => [j.id, j] as const));
    for (const e of edges) {
      if (!e.fromPort) continue;
      const from = byId.get(e.fromJobId);
      if (!from) continue;
      const to = e.toJobId ? byId.get(e.toJobId) : undefined;
      if (!to) continue;
      const k = outputKindOf(from.type, e.fromPort);
      if (!k) continue;
      counts.set(k, (counts.get(k) ?? 0) + 1);
      const list = rows.get(k) ?? [];
      list.push({ from: from.name, to: to.name });
      rows.set(k, list);
    }
    return (Object.keys(PORT_COLORS) as PortKind[])
      .filter((k) => counts.has(k))
      .map((k) => ({
        kind: k,
        wires: counts.get(k) ?? 0,
        rows: rows.get(k) ?? [],
      }));
  }, [edges, jobs]);
  // t737 — Escape lets the focus go: the legend's question is a view
  // state, and one keypress retreats. Mounted only while a focus is live.
  React.useEffect(() => {
    if (legendKind == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLegendKind(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [legendKind]);
  // t364 — the LANDING commit stays interruptible + progressive. When the
  // initial data load (or a workspace switch / workflow import) lands a big
  // canvas, mounting every card in ONE synchronous render pass blocked the
  // main thread exactly while the user was trying to look at the app — the
  // "opening the page stutters" report. Two levers, composed:
  //   · useDeferredValue — the card layer re-renders at transition priority:
  //     the shell paints first and pan/zoom/keys stay responsive while the
  //     concurrent pass renders (steady-state polls stay free — the deferred
  //     value only lags on real change, and memoized cards skip unchanged
  //     rows anyway);
  //   · chunked reveal — a landing that GROWS the list by more than a chunk
  //     mounts cards ~20 per frame instead of one giant pop, so early cards
  //     are visible while the rest stream in.
  // Everything interactive (fit, print, export, find, LiveWire) keeps the
  // FRESH lists; only the workspace render layer consumes these.
  const deferredJobs = React.useDeferredValue(jobs);
  const deferredEdges = React.useDeferredValue(edges);
  // t571 — the hover channel: which canvas card the pointer is over, so
  // the edges layer can light the wires that touch it ("what feeds this
  // job?"). Ephemeral VIEW state — lives here, not in the store: it has
  // no meaning outside the canvas render tree, dies with it, and would
  // only add a store tick to every pointer crossing. The setter identity
  // is stable, so the memoized JobCards never re-render from hover; only
  // the edges layer (the consumer) re-renders, and its geometry memo
  // doesn't (deps are edges/jobs — only the stroke choices recompute).
  const [hoveredJobId, setHoveredJobId] = React.useState<string | null>(null);
  const [revealCount, setRevealCount] = React.useState<number | null>(null);
  const [seenCount, setSeenCount] = React.useState(0);
  if (deferredJobs.length !== seenCount) {
    // t364 — adjust state DURING render (React's sanctioned prev-state
    // pattern): a landing FROM EMPTY arms the progressive reveal BEFORE the
    // big list ever commits, so the first visible frame already shows the
    // first chunk — arming from an effect would be one commit too late (all
    // N cards mount, then 80 of them unmount and stream back in). Growth of
    // a NON-empty canvas mounts immediately instead: a slice would blink
    // cards the user already has (an import's +30 must never unmount the
    // existing 40).
    if (seenCount === 0 && deferredJobs.length > REVEAL_CHUNK) {
      setRevealCount(REVEAL_CHUNK);
    }
    setSeenCount(deferredJobs.length);
  }
  React.useEffect(() => {
    if (revealCount === null) return;
    if (revealCount >= deferredJobs.length) {
      setRevealCount(null); // caught up (or the list shrank past us) — all in
      return;
    }
    const t = window.setTimeout(() => {
      setRevealCount((r) =>
        r === null ? deferredJobs.length : Math.min(r + REVEAL_CHUNK, deferredJobs.length)
      );
    }, 16);
    return () => window.clearTimeout(t);
  }, [revealCount, deferredJobs.length]);
  const renderJobs =
    revealCount === null ? deferredJobs : deferredJobs.slice(0, revealCount);
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
  // Task 134 — the find lens: the bar owns the input; the canvas derives
  // the match set with the SAME exported predicate the bar counts with
  // (one matcher, two consumers) to ring matches amber and dim the rest.
  // Task 135 — the predicate is the FULL one (status gate + text gate):
  // a chip with no query is itself a lens, so the canvas follows it too.
  const findOpen = useWorkflowStore((s) => s.findOpen);
  const findQuery = useWorkflowStore((s) => s.findQuery);
  const findStatus = useWorkflowStore((s) => s.findStatus);
  const findCategory = useWorkflowStore((s) => s.findCategory);
  const findNoted = useWorkflowStore((s) => s.findNoted);
  const openFind = useWorkflowStore((s) => s.openFind);
  const closeFind = useWorkflowStore((s) => s.closeFind);
  const findMatchIds = React.useMemo(() => {
    const q = findQuery.trim();
    if (!findOpen || (!q && findStatus === "all" && findCategory === "all" && !findNoted)) return null;
    const ids = new Set<string>();
    for (const j of jobs) if (jobMatchesFind(j, findQuery, findStatus, findCategory, findNoted)) ids.add(j.id);
    return ids;
  }, [findOpen, findQuery, findStatus, findCategory, findNoted, jobs]);
  // t655 — the WHY map, computed from the same world the ring set is:
  // for every ringing card, which text won (name or type label) and which
  // character spans wash. Stable identity per query (one memo, one map),
  // so the card memo comparator sees a new prop only when the lens
  // actually moves. Empty-query chip lenses and textless gates yield no
  // why — a card can ring without any character claiming credit, and
  // that honesty is the feature (the chip is the why, t653).
  const findWhyMap = React.useMemo(() => {
    if (findMatchIds == null || findMatchIds.size === 0) return null;
    const m = new Map<string, MatchWhy>();
    for (const j of jobs) {
      if (!findMatchIds.has(j.id)) continue;
      const why = jobMatchWhy(j, findQuery);
      if (why) m.set(j.id, why);
    }
    return m;
  }, [findMatchIds, jobs, findQuery]);
  // The lens only engages with a live query AND at least one match — a
  // zero-match search must not blank the canvas (the count chip carries
  // the "no matches" honestly instead).
  const findLens = findMatchIds != null && findMatchIds.size > 0;

  // Task 579 — the ripple: matches answer in READING ORDER. The lens
  // counts over the same workspace-ordered list the canvas renders (the
  // memo above); the halo wave takes its beat from that same order —
  // index × 24ms, capped at 12 steps so a wide match set is a snap, not
  // a slow parade. Only NEWLY-matched cards ignite (persisting matches
  // keep their settled ring — refining the query must not re-strobe the
  // whole lens); a null prev means the lens just OPENED, and the full
  // set replays — re-entrance is re-arrival, the t572 law. useEffect +
  // ref (not a render-time memo) so Strict Mode's double render can't
  // consume the diff twice.
  const prevFindMatchRef = React.useRef<Set<string> | null>(null);
  const [findFlash, setFindFlash] = React.useState<Map<string, number> | null>(null);
  React.useEffect(() => {
    if (findMatchIds == null || findMatchIds.size === 0) {
      prevFindMatchRef.current = findMatchIds ?? null;
      setFindFlash((f) => (f == null ? f : null));
      return;
    }
    const prev = prevFindMatchRef.current;
    prevFindMatchRef.current = findMatchIds;
    const flash = new Map<string, number>();
    let step = 0;
    for (const j of jobs) {
      if (!findMatchIds.has(j.id)) continue;
      if ((prev == null || !prev.has(j.id)) && step <= 12) {
        flash.set(j.id, Math.min(step, 12) * 24);
      }
      step++;
    }
    setFindFlash((f) => (flash.size === 0 ? (f == null ? f : null) : flash));
  }, [findMatchIds, jobs]);

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

  // t789 — the delete relay's landing pad: a confirmed delete hands the
  // keyboard to the canvas itself (t783's tab stop — the keyboard's
  // landmark), so the user is standing where the card used to be,
  // one Tab away from the next card and one Shift+F10 from the menu.
  // Stable identity — the card memo comparator watches it.
  const handFocusToCanvas = React.useCallback(() => {
    rootRef.current?.focus();
  }, []);

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

  /** Pure fit geometry — WHERE the camera must sit so the bounds are
   *  framed. No voice, no write: the computation is shared by the instant
   *  (systemic) fits and the tidy arrival (t593), because the answer's
   *  MOUTH is the caller's, never the geometry's (t590's boundary, now
   *  with two mouths). */
  const computeFrame = useCallback(
    (viewW: number, viewH: number, minX: number, minY: number, maxX: number, maxY: number) => {
      const bw = maxX - minX;
      const bh = maxY - minY;
      const zoom = clamp(
        Math.min(viewW / (bw + 96), viewH / (bh + 96), 1),
        ZOOM_MIN,
        1
      );
      // Task 175 — when the ZOOM floor bites (the world is wider/taller
      // than the view can contain even at ZOOM_MIN), centering CROPS BOTH
      // edges: the fit put the leftmost column at screen x=215 — under
      // the palette rail and clipped by the section's overflow-hidden.
      // t170's C5b found the first recorded job unclickable there, and a
      // first-load user just finds cards MISSING. Anchor the origin
      // corner instead (the 96px budget split into a 48px pad): when the
      // content fits, centering still wins (its pad ≥ 48 by definition);
      // when the floor hides the far sides, the near corner stays
      // reachable — panning can always get to what the floor cropped.
      return {
        x: Math.max(48, (viewW - bw * zoom) / 2) - minX * zoom,
        y: Math.max(48, (viewH - bh * zoom) / 2) - minY * zoom,
        zoom: +zoom.toFixed(3),
      };
    },
    []
  );

  /** Frame a workflow bounding box in the viewport (shared by auto-arrange,
   *  the initial-load fit, the memory restore and the fit COMMAND). The
   *  voice boundary lives at the callers, not here (t590): the fit command
   *  ticks (it is a scale command like ± and reset), while the systemic
   *  callers stay silent — a birth, a remembered restore or a systemic
   *  world rebuild is not an event (t585's arming-edge law, t587's
   *  surface definition). The tidy rebuild is the exception that proves
   *  the boundary: it IS the user's finger, so it answers — through the
   *  arrival dialogue, never through this helper (t593). */
  const frameBounds = useCallback(
    (viewW: number, viewH: number, minX: number, minY: number, maxX: number, maxY: number) => {
      setViewport(computeFrame(viewW, viewH, minX, minY, maxX, maxY));
    },
    [setViewport, computeFrame]
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
    // Task 124 — arrivals GLIDE, gestures stay instant. t588 — the jump
    // rides the shared arrival dialogue (hold + glide + coda tick) so the
    // readout lands WITH the world; the glide class and its retract timer
    // live in beginGlideArrival, wheel/pan never touch any of it.
    beginGlideArrival({
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
  React.useLayoutEffect(() => {
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
      // t593 — the rebuild's answer is drawn by WHO bumped the epoch, not
      // by the epoch itself. The tidy is the user's finger: the world
      // answers — the wire skeleton re-forms at the destination (edges
      // read the store and are correct immediately), and every moved card
      // FLIPs home onto it while the camera rides the arrival dialogue.
      // Import landings and template applies (layoutKind null) stay
      // systemic: a world arriving from a file is a birth, not a gesture.
      // useLayoutEffect, not useEffect — the FLIP's inverted frame must
      // be pinned before the first paint, or the new seats flash for a
      // frame before the flight begins.
      const st = useWorkflowStore.getState();
      if (st.layoutKind === "command") {
        const flipFrom = st.layoutFlipFrom;
        st.consumeLayoutCommand(); // consume-once (the t588 relay law)
        beginGlideArrival(
          computeFrame(
            rect.width,
            rect.height,
            Math.min(...jobs.map((j) => j.x)),
            Math.min(...jobs.map((j) => j.y)),
            Math.max(...jobs.map((j) => j.x + CARD_W)),
            Math.max(...jobs.map((j) => j.y + CARD_H))
          )
        );
        // Per-frame wire-following EXISTS for drags (the [data-e] patch
        // loop), but duplicating that machinery for a 12-card
        // choreography is a different window. Cards converging onto the
        // skeleton read as intentional: detach, fly, meet.
        const ws = rootRef.current?.querySelector<HTMLElement>("[data-canvas='workspace']");
        if (
          ws &&
          flipFrom.length > 0 &&
          !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        ) {
          const flying: HTMLElement[] = [];
          for (const f of flipFrom) {
            const el = ws.querySelector<HTMLElement>(`[data-job="${f.id}"]`);
            if (!el) continue;
            const j = jobs.find((jd) => jd.id === f.id);
            if (!j) continue;
            const dx = f.x - j.x;
            const dy = f.y - j.y;
            if (!dx && !dy) continue;
            el.style.transform = `translate(${dx}px, ${dy}px)`;
            flying.push(el);
          }
          if (flying.length > 0) {
            void ws.offsetWidth; // pin the inverted frame before playing
            ws.setAttribute("data-flip-play", "");
            for (const el of flying) el.style.transform = "";
            if (flipRetractRef.current) clearTimeout(flipRetractRef.current);
            flipRetractRef.current = setTimeout(() => {
              flipRetractRef.current = null;
              ws.removeAttribute("data-flip-play");
              for (const el of flying) el.style.transform = ""; // drag channel clean
            }, GLIDE_RETRACT_MS);
          }
        }
        return;
      }
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
    // computeFrame is a stable [] callback; beginGlideArrival is omitted
    // to match the focus effect's local convention (it reads getState()).
  }, [loading, jobs, frameBounds, fitKey, layoutEpoch, setViewport, computeFrame]);

  /* ---------------- t598 — the card birth ---------------- */

  // The birth's timing words. The family's entrance figure: a 240ms rise
  // (palette/dash), a 24ms staircase (t579 ripple, t584 chips) walked in
  // store order — for an import the pipeline assembles in execution
  // order — capped at 12 steps so a 50-card import reads as "the world
  // materializes" instead of a roll call. Retire budget: 12×24 + 240 +
  // 120 slack = 648ms — the attributes must outlive the last card's
  // landing, exactly the t584 settle-budget discipline.
  const CARD_BIRTH_STEP_MS = 24;
  const CARD_BIRTH_MAX_STEPS = 12;
  const CARD_BIRTH_RETIRE_MS =
    CARD_BIRTH_MAX_STEPS * CARD_BIRTH_STEP_MS + 240 + 120;
  const birthSeq = useWorkflowStore((s) => s.birthSeq);
  const birthIds = useWorkflowStore((s) => s.birthIds);
  const birthEdgeIds = useWorkflowStore((s) => s.birthEdgeIds);
  const birthRetractRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(
    () => () => {
      if (birthRetractRef.current) clearTimeout(birthRetractRef.current);
    },
    []
  );
  // Marks mounted born-cards BEFORE their first paint (useLayoutEffect —
  // the entrance's from-frame must be pinned, the t593 FLIP doctrine: the
  // world's answer starts honest on frame one or it lies). The card layer
  // renders at TRANSITION priority (useDeferredValue + the reveal
  // staircase, t571-era machinery): the newborn mounts one commit AFTER
  // the urgent store pass — so the effect rides renderJobs (the layer's
  // OWN channel, t595's mechanism-follows-channel law), re-running on
  // every deferred commit until the cards are actually in the DOM, and
  // pins them before THAT paint. t599 — the wires ride the same cascade:
  // edges mount on the deferredEdges pass, and cards and wires walk ONE
  // staircase (payload order, one rhythm — the world materializes and
  // connects in a single breath). Per-id consume: a switched-workspace
  // import's newborns mount on the LATER commit (the switch), so
  // unmarked ids survive in the payload until found or the window
  // retires. History restores, poll replaces and adoption loads never
  // arm — their silence is by construction, not by filtering here.
  React.useLayoutEffect(() => {
    if (birthIds.length === 0 && birthEdgeIds.length === 0) return;
    const ws = rootRef.current?.querySelector<HTMLElement>("[data-canvas='workspace']");
    if (!ws) return;
    const found: string[] = [];
    const foundEdges: string[] = [];
    let step = 0;
    for (const id of birthIds) {
      const el = ws.querySelector<HTMLElement>(`[data-job="${id}"]`);
      if (!el || el.hasAttribute("data-born")) continue;
      el.setAttribute("data-born", "");
      el.style.setProperty(
        "--card-d",
        `${Math.min(step, CARD_BIRTH_MAX_STEPS) * CARD_BIRTH_STEP_MS}ms`
      );
      found.push(id);
      step += 1;
    }
    for (const id of birthEdgeIds) {
      const el = ws.querySelector<HTMLElement>(`[data-edge-id="${id}"]`);
      if (!el || el.hasAttribute("data-edge-born")) continue;
      el.setAttribute("data-edge-born", "");
      el.style.setProperty(
        "--card-d",
        `${Math.min(step, CARD_BIRTH_MAX_STEPS) * CARD_BIRTH_STEP_MS}ms`
      );
      foundEdges.push(id);
      step += 1;
    }
    if (found.length === 0 && foundEdges.length === 0) return;
    void ws.offsetWidth; // pin the entrance's from-frame before playing
    ws.setAttribute("data-birth-play", "");
    useWorkflowStore.getState().consumeBirths(found, foundEdges);
    if (birthRetractRef.current) clearTimeout(birthRetractRef.current);
    birthRetractRef.current = setTimeout(() => {
      birthRetractRef.current = null;
      ws.removeAttribute("data-birth-play");
      for (const el of Array.from(ws.querySelectorAll<HTMLElement>("[data-born]"))) {
        el.removeAttribute("data-born");
        el.style.removeProperty("--card-d");
      }
      for (const el of Array.from(ws.querySelectorAll<HTMLElement>("[data-edge-born]"))) {
        el.removeAttribute("data-edge-born");
        el.style.removeProperty("--card-d");
      }
    }, CARD_BIRTH_RETIRE_MS);
  }, [birthSeq, birthIds, birthEdgeIds, renderJobs, deferredEdges, activeWorkspaceId]);

  // "Ready" hint: idle job whose upstream (any incoming edge, possibly in
  // ANOTHER workspace — links included) is completed.
  const allJobs = useWorkflowStore((s) => s.jobs);

  /* ---------------- t601 — the card's last breath ---------------- */

  // The exit's timing words mirror the entrance's (the 24ms staircase,
  // a slower 400ms fade — leaving is more deliberate than arriving);
  // the constants live in the store next to the ghost builder they
  // parameterize (DEATH_STEP_MS / DEATH_FADE_MS). Retire budget:
  // 12×24 + 400 + 120 = 808ms — the attributes must outlive the last
  // ghost's exhale, the t584 settle-budget discipline.
  const CARD_DEATH_RETIRE_MS = 12 * 24 + 400 + 120;
  const deathSeq = useWorkflowStore((s) => s.deathSeq);
  const deathGhosts = useWorkflowStore((s) => s.deathGhosts);
  // The RENDER face rides the card layer's own deferral (the t595
  // mechanism-follows-channel law, death edition): the cards mount on
  // the deferred pass (useDeferredValue, t571 machinery), so a dead
  // card also UNMOUNTS one deferred commit after the urgent truth — a
  // ghost mounted on the urgent pass would overlap its own corpse for
  // a frame or two. Deferred, the ghost mounts in the SAME commit the
  // card actually leaves: one commit, one body. The effects below keep
  // the urgent subscription — supersede and retire timing are about
  // truth, not paint.
  const renderDeathGhosts = React.useDeferredValue(deathGhosts);
  const deathSweepRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(
    () => () => {
      if (deathSweepRef.current) clearTimeout(deathSweepRef.current);
    },
    []
  );
  // The render face of resurrection: a ghost whose card is live again is
  // skipped THE SAME COMMIT the card returns (the effect below prunes
  // the store data a beat later) — no frame of haunting, not even one.
  const breathingGhosts = renderDeathGhosts.filter(
    (g) => !allJobs.some((j) => j.id === g.id)
  );
  // Two duties, both OUTSIDE the paint path (the ghost elements carry
  // their own mount-time animation with `both` fill — the from-frame is
  // pinned by CSS, no attribute dance needed): ① resurrection
  // supersedes the breath — a ghost whose card is live again (Ctrl+Z
  // mid-fade) is pruned at once, TWO memories of one seat would be a
  // haunting; ② the window closes — the sweep is bornAt-based, so a
  // poll tick re-running this effect recomputes the remaining window
  // instead of pushing it (a timer re-armed on every jobs change would
  // never close under a 1.2s run-cadence poll).
  React.useEffect(() => {
    if (deathGhosts.length === 0) return;
    const aliveIds = deathGhosts
      .map((g) => g.id)
      .filter((id) => allJobs.some((j) => j.id === id));
    if (aliveIds.length > 0) {
      useWorkflowStore.getState().pruneDeathGhosts(aliveIds);
      return; // the prune re-triggers this effect via deathGhosts
    }
    const now = Date.now();
    const youngest = Math.max(...deathGhosts.map((g) => g.bornAt));
    const remaining = CARD_DEATH_RETIRE_MS - (now - youngest);
    if (remaining <= 0) {
      useWorkflowStore.getState().retireDeathGhosts();
      return;
    }
    if (deathSweepRef.current) clearTimeout(deathSweepRef.current);
    deathSweepRef.current = setTimeout(() => {
      deathSweepRef.current = null;
      useWorkflowStore.getState().retireDeathGhosts();
    }, remaining);
  }, [deathSeq, deathGhosts, allJobs]);
  // Note spotlight lens (Task 75, predicate upgraded in Task 83): cards
  // without human judgment dim as one unit — the class lives on the
  // positioned [data-job] root so body, badge and ports recede together
  // (print is exempt via the globals.css override). hasJudgment is the
  // SAME predicate the dashboard Noted chip and the header count read:
  // a card annotated only through class notes must not go dark while
  // the lens claims to spotlight "noted" work.
  const noteSpotlight = useWorkflowStore((s) => s.noteSpotlight);
  const allEdges = useWorkflowStore((s) => s.edges);

  /* ---------------- t602 — the wire's own last breath ---------------- */

  // The loner's exit rides the organ's air (ghost-wire-exit is shared):
  // a lone wire has no gravity to sink with, it only fades — 400ms on
  // the same mirror bezier, no staircase (each click is its own command;
  // the t601 staircases serve ONE command taking multiple bodies).
  // Retire budget: 0 delay + 400 + 120 = 520ms — the attributes must
  // outlive the exhale, the t584 settle-budget discipline.
  const EDGE_DEATH_RETIRE_MS = 400 + 120;
  const deathEdgeSeq = useWorkflowStore((s) => s.deathEdgeSeq);
  const deathEdgeGhosts = useWorkflowStore((s) => s.deathEdgeGhosts);
  // The render face rides the WIRES' own deferral: the edges layer mounts
  // on the deferred pass (deferredEdges — the t595 mechanism-follows-channel
  // law), so the wire also UNMOUNTS one deferred commit after the urgent
  // truth — a loner mounted urgent would overlap its own corpse for a
  // frame or two. Deferred, the ghost mounts in the SAME commit the wire
  // actually leaves: one commit, one body (the t601 law, loner edition).
  const renderDeathEdgeGhosts = React.useDeferredValue(deathEdgeGhosts);
  const deathEdgeSweepRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(
    () => () => {
      if (deathEdgeSweepRef.current) clearTimeout(deathEdgeSweepRef.current);
    },
    []
  );
  // The render face of revival: a loner whose wire is live again (a
  // failed DELETE's restore) is skipped THE SAME COMMIT the wire returns
  // (the effect below prunes the store data a beat later) — no frame of
  // haunting, not even one. The urgent truth decides (t601): revival and
  // retire are about truth, not paint.
  const breathingEdgeGhosts = renderDeathEdgeGhosts.filter(
    (g) => !allEdges.some((e) => e.id === g.id)
  );
  // Two duties, both OUTSIDE the paint path (the ghost elements carry
  // their own mount-time animation with `both` fill): ① a revival
  // supersedes the breath at once; ② the window closes bornAt-based, so
  // a poll tick re-running this effect recomputes the remaining window
  // instead of pushing it (a timer re-armed on every edges change would
  // never close under the 1.2s run-cadence poll).
  React.useEffect(() => {
    if (deathEdgeGhosts.length === 0) return;
    const aliveIds = deathEdgeGhosts
      .map((g) => g.id)
      .filter((id) => allEdges.some((e) => e.id === id));
    if (aliveIds.length > 0) {
      useWorkflowStore.getState().pruneDeathEdgeGhosts(aliveIds);
      return; // the prune re-triggers this effect via deathEdgeGhosts
    }
    const now = Date.now();
    const youngest = Math.max(...deathEdgeGhosts.map((g) => g.bornAt));
    const remaining = EDGE_DEATH_RETIRE_MS - (now - youngest);
    if (remaining <= 0) {
      useWorkflowStore.getState().retireDeathEdgeGhosts();
      return;
    }
    if (deathEdgeSweepRef.current) clearTimeout(deathEdgeSweepRef.current);
    deathEdgeSweepRef.current = setTimeout(() => {
      deathEdgeSweepRef.current = null;
      useWorkflowStore.getState().retireDeathEdgeGhosts();
    }, remaining);
  }, [deathEdgeSeq, deathEdgeGhosts, allEdges]);
  // Task 164 — the context radius. The lens used to be a binary flood:
  // every unjudged card sank to the same deep dim, which kept the judged
  // islands but erased WHERE they sit in the pipeline. Now the unjudged
  // cards ONE edge away from a judged card (either direction — the work
  // that fed it AND the work it fed) hold an intermediate tier, and only
  // the remainder carries the deep dim; the tier boundary itself draws
  // the judged subgraph's outline. computed over ALL edges + ALL jobs
  // (not the workspace slice) so judgment flows through the whole
  // pipeline graph; the canvas only renders this workspace's cards.
  const judgedIds = React.useMemo(
    () => new Set(allJobs.filter((j) => hasJudgment(j)).map((j) => j.id)),
    [allJobs]
  );
  const contextIds = React.useMemo(() => {
    const ctx = new Set<string>();
    if (!noteSpotlight) return ctx;
    for (const e of allEdges) {
      const fromJ = judgedIds.has(e.fromJobId);
      const toJ = judgedIds.has(e.toJobId);
      if (fromJ && !toJ) ctx.add(e.toJobId);
      if (toJ && !fromJ) ctx.add(e.fromJobId);
    }
    return ctx;
  }, [noteSpotlight, allEdges, judgedIds]);
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

  /* t682 — the critical path lens: the same walk the analytics panel's
   * fifth face speaks, computed over the WHOLE project graph (allJobs +
   * allEdges — the spotlight's radius rides the same whole-graph law),
   * so the lens can never disagree with the face about which cards are
   * the story. Running rows wait outside the chain (a live run has no
   * end yet — the face's own filter); `now` is the memo's reading of
   * the instant, and its only consumer (a running row's stretched end)
   * is discarded by that filter, so the reading stays honest for
   * everything the chain keeps. The lens flag lives in the store (the
   * spotlight's law — a viewing lens, not a document property); the
   * chain itself is derived, never stored. */
  const criticalLens = useWorkflowStore((s) => s.criticalLens);
  const criticalWalk = React.useMemo(() => {
    const w = walkTimeline(allJobs, Date.now());
    return criticalPath(
      w.rows.filter((r) => r.job.status !== "running"),
      allEdges
    );
  }, [allJobs, allEdges]);
  const chainIds = React.useMemo(
    () =>
      criticalLens && criticalWalk
        ? new Set(criticalWalk.chain.map((s) => s.job.id))
        : null,
    [criticalLens, criticalWalk]
  );
  const chainEdgeIds = React.useMemo(
    () =>
      criticalLens && criticalWalk
        ? new Set(
            criticalWalk.chain
              .map((s) => s.viaEdgeId)
              .filter((x): x is string => x != null)
          )
        : null,
    [criticalLens, criticalWalk]
  );

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
      releaseArrivalHold(); // t588 — the hand owns the number again
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

  /* t587 — the readout's voice: the odometer tick. The zoom % span is the
   *  toolbar's live gauge, and a gauge should speak when the world rescales
   *  under a COMMAND — the two step buttons, reset and fit-to-content
   *  (every entry surface routes through these three fns: toolbar ±/reset,
   *  context menu reset + fit; t590 wired the third throat).
   *  What never ticks, by design:
   *  - wheel / pinch: continuous gestures — the digits themselves changing
   *    ARE the continuous voice; re-firing an entrance per frame is the
   *    "disarm became an event" anti-pattern (t585's ghost, zoom edition).
   *  - the SYSTEMIC fits (frameBounds callers): the initial-load fit is
   *    the readout's birth, the memory restore is where it left off, the
   *    auto-arrange fit is a world rebuild — none is an event (t585's
   *    arming-edge law, generalized in t590).
   *  - bookmark / focus arrivals ride the DIALOGUE (t588): the world
   *    glides (Task 124), the readout holds the value the world is at,
   *    and the drum rolls ONCE when the world lands — see the arrival
   *    block below. t587 called a glide and a tick different sentences;
   *    the dialogue is how they answer each other.
   *  The tick rides a React key remount (the find-tick idiom): nonce up →
   *  new span → the one-shot animation plays once and the element rests.
   *  Direction is the mechanical-odometer metaphor: the value growing
   *  rolls the drum UP (the new digit enters from below, +2px), the value
   *  shrinking drops it in from above (−2px). Comparison runs on the
   *  ROUNDED percent — the readout only speaks when its own text changes
   *  ("no change, no sound" also swallows clamped no-ops for free). */
  const [zoomTick, setZoomTick] = React.useState<{ n: number; dy: number } | null>(null);
  const tickZoomReadout = React.useCallback((fromZoom: number, toZoom: number) => {
    const from = Math.round(fromZoom * 100);
    const to = Math.round(toZoom * 100);
    if (to === from) return;
    setZoomTick((t) => ({ n: (t?.n ?? 0) + 1, dy: to > from ? 2 : -2 }));
  }, []);

  /* t588 — the arrival dialogue. Bookmark and focus arrivals GLIDE
   *  (Task 124), and this block teaches the readout to answer: while the
   *  transition travels, the gauge HOLDS the value the world is at — the
   *  state jumped at launch, but the number must not arrive before the
   *  world does ("the number arrives when the world does"). At the
   *  retract moment the drum rolls once (the t587 odometer), from the
   *  held value to the landed value — silent when the rounded percent
   *  did not change (a pan-only arrival keeps "no change, no sound").
   *  - Commands (± / reset) keep the t587 voice: instant world, tick at
   *    launch. A zoom command mid-glide releases the hold first — the
   *    newest voice wins, and the landing goes silent (it already
   *    spoke). The wheel releases too: the hand owns the number.
   *  - prefers-reduced-motion: the world teleports (the glide class is
   *    CSS-gated off), so the number travels with it — no hold, no coda
   *    (the tick is a motion-family voice; JS reads the same media query
   *    the CSS gate uses).
   *  - Rapid re-arrival mid-flight: the hold keeps the FIRST value (the
   *    displayed number never changed), one retract timer serves the
   *    whole chain, and the coda speaks once for the whole journey. */
  const [heldZoom, setHeldZoom] = React.useState<number | null>(null);
  const heldZoomRef = React.useRef<number | null>(null);
  const glideRetractRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  // t593 — the card FLIP's retract timer, serving the SAME window as the
  // camera's glideRetractRef: one journey, one rhythm (GLIDE_RETRACT_MS).
  const flipRetractRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const releaseArrivalHold = React.useCallback(() => {
    if (heldZoomRef.current == null) return;
    heldZoomRef.current = null;
    setHeldZoom(null);
  }, []);
  const beginGlideArrival = React.useCallback(
    (target: Partial<Viewport>) => {
      const s = useWorkflowStore.getState();
      const ws = rootRef.current?.querySelector("[data-canvas='workspace']");
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        // motion off: the world teleports, the number travels with it —
        // no hold, no coda (the tick is a motion-family voice)
        setViewport(target);
        return;
      }
      const displayed = heldZoomRef.current ?? s.viewport.zoom;
      heldZoomRef.current = displayed;
      setHeldZoom(displayed);
      ws?.classList.add("viewport-glide");
      if (glideRetractRef.current) clearTimeout(glideRetractRef.current);
      setViewport(target);
      glideRetractRef.current = setTimeout(() => {
        glideRetractRef.current = null;
        ws?.classList.remove("viewport-glide");
        const from = heldZoomRef.current ?? useWorkflowStore.getState().viewport.zoom;
        heldZoomRef.current = null;
        setHeldZoom(null);
        tickZoomReadout(from, useWorkflowStore.getState().viewport.zoom);
      }, GLIDE_RETRACT_MS);
    },
    [setViewport, tickZoomReadout],
  );
  // unmount: never leave a retract timer firing into a dead DOM
  React.useEffect(
    () => () => {
      if (glideRetractRef.current) clearTimeout(glideRetractRef.current);
      if (flipRetractRef.current) clearTimeout(flipRetractRef.current);
    },
    [],
  );

  // t588 — the keyboard slot relay (1–9): the store hands over the
  // target, the canvas performs the arrival (consume-once — a canvas
  // remount must not re-glide to a stale target)
  const arrivalEpoch = useWorkflowStore((s) => s.arrivalEpoch);
  React.useEffect(() => {
    if (!arrivalEpoch) return;
    const { arrivalTarget, consumeViewportArrival } = useWorkflowStore.getState();
    if (!arrivalTarget) return;
    consumeViewportArrival();
    beginGlideArrival(arrivalTarget);
  }, [arrivalEpoch, beginGlideArrival]);

  const zoomAroundCenter = (targetZoom: number) => {
    releaseArrivalHold(); // t588 — a command mid-glide reclaims the number
    const rect = rootRef.current?.getBoundingClientRect();
    const s = useWorkflowStore.getState();
    if (!rect) {
      tickZoomReadout(s.viewport.zoom, targetZoom);
      setViewport({ zoom: targetZoom });
      return;
    }
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const nz = clamp(targetZoom, ZOOM_MIN, ZOOM_MAX);
    const px = (cx - s.viewport.x) / s.viewport.zoom;
    const py = (cy - s.viewport.y) / s.viewport.zoom;
    tickZoomReadout(s.viewport.zoom, nz);
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
    // t737 — a background click also releases the legend's focus: asking
    // the world a new question lets the old answer go.
    setLegendKind(null);
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
    // t590 — the third scale command finds its voice. "Zoom to fit" is a
    // rescale of the view (t589's "places glide, scales command"), so it
    // joins ± and reset in the t587 family: instant world, tick at
    // launch, and "no change, no sound" swallows an already-fitted zoom
    // for free. Mid-glide the command reclaims the number first (the
    // newest voice wins); the pending arrival coda goes silent on its
    // own — after the fit, from == to, so the retract reads no change.
    releaseArrivalHold();
    const from = useWorkflowStore.getState().viewport.zoom;
    const minX = Math.min(...jobs.map((j) => j.x));
    const maxX = Math.max(...jobs.map((j) => j.x + CARD_W));
    const minY = Math.min(...jobs.map((j) => j.y));
    const maxY = Math.max(...jobs.map((j) => j.y + CARD_H));
    frameBounds(rect.width, rect.height, minX, minY, maxX, maxY);
    tickZoomReadout(from, useWorkflowStore.getState().viewport.zoom);
  };

  const resetView = () => {
    // infinite canvas: "100%" also recenters on the content bbox (the
    // origin (0,0) is just an arbitrary point once coordinates can go
    // negative — centering avoids resetting into empty space)
    releaseArrivalHold(); // t588 — a command mid-glide reclaims the number
    const rect = rootRef.current?.getBoundingClientRect();
    // the gauge speaks only when its number changes: a second reset at
    // 100% re-centers silently (t587 — "no change, no sound")
    tickZoomReadout(useWorkflowStore.getState().viewport.zoom, 1);
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

  // t783 — the background menu's keyboard face. The canvas menu answered
  // right-click only: a keyboard user Tabbing to a card and pressing the
  // Menu key / Shift+F10 reached the CARD's menu (when the browser
  // synthesized the contextmenu at all), but the canvas's own menu — zoom
  // to fit, reset, tidy, export, import — had no keyboard path because the
  // section was unreachable (no tabIndex) and no handler translated the
  // keys. Two moves, one mechanism:
  //   · tabIndex={0} on the section — the canvas becomes a real tab stop
  //     (a named landmark keyboard users can reach) and the natural focus
  //     target after any click on empty canvas, which is where a pointer
  //     user's right-click already lands;
  //   · this handler — the Menu key / Shift+F10 pressed ON the section
  //     preventDefaults the browser's own synthesis (whose coordinates are
  //     unpredictable) and dispatches a synthetic contextmenu at the
  //     section's center — the SAME event type a physical right-click
  //     produces, so Radix opens the SAME menu through the SAME path. One
  //     mechanism, two inputs; no second menu implementation to drift.
  // The target guard keeps bubbling honest: when a CARD holds the focus
  // its keydown bubbles up to this section, but the card's menu is the
  // card's to open — the background menu only answers for itself.
  const onCanvasKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key !== "ContextMenu" && !(e.key === "F10" && e.shiftKey)) return;
    e.preventDefault();
    const r = rootRef.current?.getBoundingClientRect();
    if (!r) return;
    rootRef.current?.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: r.left + r.width / 2,
        clientY: r.top + r.height / 2,
        button: 2,
      }),
    );
  };

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
          tabIndex={0}
          className="no-drag-select canvas-grid relative min-w-0 flex-1 touch-none overflow-hidden bg-background active:cursor-grabbing cursor-grab outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          {...dropProps}
          onKeyDown={onCanvasKeyDown}
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
          <EdgesLayer
            edges={deferredEdges}
            jobs={renderJobs}
            judgedIds={noteSpotlight ? judgedIds : null}
            hoveredJobId={hoveredJobId}
            chainIds={chainIds}
            chainEdgeIds={chainEdgeIds}
            legendKind={legendKind}
          />
          <LiveWire rootRef={rootRef} jobs={jobs} />
          {/* t601 — the death breath's ghost layer: frozen memories of the
              cards a finger's delete is taking, rendered BELOW the living
              cards (a ghost never covers the living) and above the wires.
              Each ghost mounts ALREADY dying — the CSS animation runs on
              mount with `both` fill, so the from-frame (the card as it
              was) is pinned with no attribute dance, and the mirror
              bezier carries it out. Wires are the body's organs: each
              fades on its card's step (the frozen d — geometry captured
              in the same commit the store lost the endpoints). The whole
              layer is pointer-events-none and aria-hidden: the dead
              cannot be interacted with, and screen readers already saw
              the removal announced via the store truth. t602 — the layer
              also hosts the LONERS: wires killed alone (the hover X on
              the wire itself, the I/O tab's remove chip) breathe in the
              same svg and the same air, marked data-ghost-loner. */}
          {(breathingGhosts.length > 0 || breathingEdgeGhosts.length > 0) && (
            <div
              data-death-ghost-layer=""
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0"
            >
              <svg
                width={1}
                height={1}
                className="absolute left-0 top-0"
                style={{ overflow: "visible" }}
              >
                {/* t602 — the loners breathe FIRST (below the organs): the
                    body's death is the louder memory. Same ghost gray,
                    same air; the staircase does not apply — each click is
                    its own command, so the breath starts at once. */}
                {breathingEdgeGhosts.map((g) => (
                  <path
                    key={g.id}
                    data-ghost-wire={g.id}
                    data-ghost-loner=""
                    d={g.d}
                    fill="none"
                    stroke="color-mix(in oklch, var(--foreground) 32%, transparent)"
                    strokeWidth={2.25}
                    strokeLinecap="round"
                    style={{ "--death-cd": "0ms" } as React.CSSProperties}
                  />
                ))}
                {breathingGhosts.flatMap((g) =>
                  g.wires.map((w) => (
                    <path
                      key={w.id}
                      data-ghost-wire={w.id}
                      d={w.d}
                      fill="none"
                      stroke="color-mix(in oklch, var(--foreground) 32%, transparent)"
                      strokeWidth={2.25}
                      strokeLinecap="round"
                      style={
                        { "--death-cd": `${w.step * 24}ms` } as React.CSSProperties
                      }
                    />
                  ))
                )}
              </svg>
              {breathingGhosts.map((g) => {
                const spec = jobType(g.type);
                return (
                  <div
                    key={g.id}
                    data-dying={g.id}
                    className="absolute overflow-hidden rounded-xl border bg-card"
                    style={
                      {
                        left: g.x,
                        top: g.y,
                        width: CARD_W,
                        height: CARD_H,
                        zIndex: 5,
                        "--death-cd": `${g.step * 24}ms`,
                      } as React.CSSProperties
                    }
                  >
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 w-1 opacity-80",
                        spec?.color.bg
                      )}
                    />
                    <div className="flex h-full flex-col justify-center gap-1 py-2.5 pl-4 pr-3.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-md ring-1 ring-inset",
                            spec?.color.soft,
                            spec?.color.border
                          )}
                        >
                          <TypeIcon
                            name={spec?.icon ?? "Boxes"}
                            className={cn("size-3.5", spec?.color.text)}
                          />
                        </span>
                        <p className="truncate text-sm font-semibold tracking-tight leading-none opacity-90">
                          {g.name}
                        </p>
                      </div>
                    </div>
                    <div
                      className={cn(
                        "absolute inset-x-0 bottom-0 h-[3px]",
                        STATUS_FLOOR[g.status as StatusWord] ?? STATUS_FLOOR.idle
                      )}
                    />
                  </div>
                );
              })}
            </div>
          )}
          {renderJobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onDeleteFocus={handFocusToCanvas}
              dimmed={
                (noteSpotlight && !hasJudgment(job) && !contextIds.has(job.id)) ||
                (findLens && !findMatchIds!.has(job.id)) ||
                (chainIds != null && !chainIds.has(job.id))
              }
              spotlightContext={noteSpotlight && !hasJudgment(job) && contextIds.has(job.id)}
              findMatch={findLens && findMatchIds!.has(job.id)}
              findWhy={findWhyMap?.get(job.id)}
              findFlashDelay={findFlash?.get(job.id)}
              selected={selectedIds.includes(job.id)}
              primary={selectedId === job.id}
              bandMatch={bandIds?.has(job.id) ?? false}
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
              onHoverChange={setHoveredJobId}
              onCardNavigate={navigateCard}
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

      {/* Task 134 — canvas find bar (Ctrl/⌘+F): ambient match lens; the
          connect hint owns the same top-center slot while a wire is
          pending, so the bar stands down for it */}
      <CanvasFindBar />

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
      {/* data-canvas-ui on the card: handlePointerDown captures every
          pointerdown that isn't inside [data-job]/[data-canvas-ui] — an
          un-marked empty-state card had its Scaffold button's clicks
          hijacked by the canvas's pointer capture (the click event fired
          on the SECTION, never on the button — "clicking does nothing").
          The portaled-overlay guard in handlePointerDown documents this
          exact failure mode for menus; the in-canvas empty state is the
          same bug in a non-portaled costume. */}
      {!loading && jobs.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            data-canvas-ui="empty-state"
            className="max-w-md rounded-xl border border-dashed bg-card/60 px-6 py-5 text-center backdrop-blur-sm animate-rise"
          >
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

      {/* t682 — the critical path lens's reading, in plain sight: the same
          numbers the fifth face speaks (steps · span · finisher), riding
          above the toolbar while the lens is ON. pointer-events-none —
          the chip informs, it never steals a canvas gesture; the toggle
          (button or P) is the only hand that moves it. */}
      {criticalLens && criticalWalk && (
        <div
          data-canvas-ui="critical-chip"
          data-critical-steps={criticalWalk.chain.length}
          data-critical-span={criticalWalk.spanMs}
          className="no-print animate-rise pointer-events-none absolute bottom-14 left-3 z-30 flex items-center gap-1.5 rounded-lg border bg-card/95 px-2.5 py-1.5 text-xs shadow-sm backdrop-blur"
        >
          <Route className="size-3.5 text-primary" aria-hidden="true" />
          <span className="font-semibold">Critical path</span>
          <span className="text-muted-foreground">
            · {criticalWalk.chain.length} step{criticalWalk.chain.length === 1 ? "" : "s"} ·{" "}
            {fmtDuration(criticalWalk.spanMs)} span
          </span>
          <span
            className="ml-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-px text-[9.5px] font-semibold text-primary"
            data-critical-finisher={criticalWalk.chain[criticalWalk.chain.length - 1].job.id}
          >
            ends with: {criticalWalk.chain[criticalWalk.chain.length - 1].job.name}
          </span>
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
        <span
          key={zoomTick?.n ?? 0}
          data-zoom-tick={zoomTick ? "" : undefined}
          style={
            zoomTick
              ? ({ "--zoom-tick-y": `${zoomTick.dy}px` } as React.CSSProperties)
              : undefined
          }
          className="w-11 text-center text-xs font-medium tabular-nums text-muted-foreground"
        >
          {/* t588 — during an arrival glide the gauge shows the HELD value
              (where the world IS), not the state's target: the number
              arrives when the world does. Commands bypass the hold. */}
          {Math.round((heldZoom ?? zoom) * 100)}%
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
          className={`size-7 max-lg:hidden ${minimapOpen ? "text-primary" : ""}`}
          onClick={() => setMinimapOpen(!minimapOpen)}
          aria-pressed={minimapOpen}
          aria-label="Toggle minimap"
          title="Toggle the world-overview map (M)"
          data-canvas-ui="minimap-toggle"
        >
          <MapIcon className="size-4" />
        </Button>
        <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
        {/* Task 134 — find lens toggle, same dialect as the minimap
            toggle: one keypress (⌘/Ctrl+F) and this button agree on one
            source of truth; active state reads the store. */}
        <Button
          variant="ghost"
          size="icon"
          className={`size-7 ${findOpen ? "text-primary" : ""}`}
          onClick={() => (findOpen ? closeFind() : openFind())}
          aria-pressed={findOpen}
          aria-label="Find jobs on canvas"
          title="Find jobs by name or type (⌘/Ctrl+F)"
          data-canvas-ui="find-toggle"
        >
          <Search className="size-4" />
        </Button>
        <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
        {/* Task 462 — the funnel's plain-sight door: the chain question
            ("where did my particles go?") leaves the inspector-only
            world — one Filter button beside the map and find toggles,
            its decision (selection-first, crown fallback, honest
            blocks) owned by the pure brain in particle-funnel.ts. */}
        <CanvasFunnelDoor />
        <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
        {/* t682 — the critical path lens toggle, the toolbar's fourth lens
            (map · find · funnel · chain): one keypress (P) and this button
            agree on one store flag, the minimap/find dialect. Disabled
            when no chain exists (no finished runs — a lens with nothing
            to show is an honest dead button, the undo family's law). */}
        <Button
          variant="ghost"
          size="icon"
          className={`size-7 ${criticalLens ? "text-primary" : ""}`}
          onClick={() => useWorkflowStore.getState().toggleCriticalLens()}
          disabled={criticalWalk == null}
          aria-pressed={criticalLens}
          aria-label="Toggle critical path lens"
          title="Toggle the critical path lens (P) — keep the chain that set the finish at full ink, dim everything else"
          data-canvas-ui="critical-toggle"
        >
          <Route className="size-4" />
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
                      <Kbd
                        className="shrink-0 bg-muted text-[10px] leading-4 text-muted-foreground"
                        title={`Press ${bm.slot} on the canvas to jump here`}
                        data-canvas-ui="viewport-bookmark-slot"
                      >
                        {bm.slot}
                      </Kbd>
                    )}
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center justify-between rounded px-1.5 py-1 text-left text-xs hover:bg-accent"
                      onClick={() => {
                        // t588 — the row click is an ARRIVAL, not a
                        // teleport: same dialogue as the slot keys (hold,
                        // glide, coda tick) via the one shared helper
                        beginGlideArrival(bm.viewport);
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
        <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
        {/* t737 — the legend face: the kind vocabulary's table of contents,
            living in the toolbar's tail. The words shown are the ones the
            CURRENT world's wires actually wear (the same book —
            outputKindOf + PORT_COLORS — the wires themselves read), in the
            book's own order. Clicking a word FOCUSES its wires: every
            other kind recedes on the --dim-wire rung (selection's dim
            grammar, borrowed by a question instead of a job), and a second
            click / Escape / a background click let it go. The dot is the
            wire's resting hex (t734's dialect — inline style, since the
            color table lives in lib where tailwind's JIT never looks);
            the word rides from 2xl up (the two-size law: compact face =
            dot only, full face = dot + word).
            t739 — the TOC grows an index page: hovering (or keyboard-
            focusing) a word opens ITS card — that word's wires listed as
            "from → to" rows (the hover card's own name law, borrowed from
            the wire card's title), the click/Escape hint riding the card's
            footer instead of the native title (the card and the tooltip
            should never say the same thing twice). The card is a view —
            pointer-events-none so it can't catch its own mouse, condition-
            rendered so the DOM stays quiet until asked, and anchored
            bottom-full (the toolbar lives on the canvas floor; the card
            floats up into the world it describes). */}
        <div
          data-canvas-ui="kind-legend"
          className="hidden items-center gap-1 pl-0.5 lg:flex"
          role="group"
          aria-label="Data kinds flowing on the canvas wires"
        >
          {legend.map(({ kind: k, wires, rows }) => {
            const active = legendKind === k;
            const open = legendHover === k;
            return (
              <div key={k} className="relative flex">
                <button
                  type="button"
                  onClick={() => setLegendKind(active ? null : k)}
                  onMouseEnter={() => setLegendHover(k)}
                  onMouseLeave={() =>
                    setLegendHover((cur) => (cur === k ? null : cur))
                  }
                  onFocus={() => setLegendHover(k)}
                  onBlur={() =>
                    setLegendHover((cur) => (cur === k ? null : cur))
                  }
                  aria-pressed={active}
                  aria-describedby={open ? `kind-legend-card-${k}` : undefined}
                  title={`${k} data on ${wires} wire${wires === 1 ? "" : "s"}`}
                  data-canvas-ui="kind-legend-item"
                  data-kind={k}
                  className={cn(
                    "flex items-center gap-1.5 rounded px-1.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                    active && "bg-accent text-foreground"
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: PORT_COLORS[k].wire }}
                  />
                  <span className="hidden 2xl:inline">{k}</span>
                </button>
                {open && (
                  <div
                    id={`kind-legend-card-${k}`}
                    role="tooltip"
                    data-canvas-ui="kind-legend-card"
                    data-kind={k}
                    className="pointer-events-none absolute bottom-full left-0 z-40 mb-1.5 w-max max-w-64 rounded-md border bg-popover p-2 text-xs shadow-md"
                  >
                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                      <span
                        aria-hidden="true"
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: PORT_COLORS[k].wire }}
                      />
                      <span>{k}</span>
                      <span className="font-normal text-muted-foreground">
                        · {wires} wire{wires === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {rows.map((r, i) => (
                        <div key={i} className="truncate text-muted-foreground">
                          {r.from} <span aria-hidden="true" className="text-border">→</span> {r.to}
                        </div>
                      ))}
                    </div>
                    <div className="mt-1.5 border-t pt-1.5 text-[10px] text-muted-foreground">
                      click to focus · Esc to clear
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
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

"use client";

/**
 * CryoFlow — global workflow state (zustand).
 */

import * as React from "react";
import { create } from "zustand";
import { toast, type ToastActionElement } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { CARD_W, CARD_H, WORLD_MIN, WORLD_MAX, ZOOM_MAX, ZOOM_MIN, jobType, portsCompatible } from "./workflow";
import { autoLayout } from "./layout";
import type {
  EdgeDTO,
  JobDTO,
  ProjectDTO,
  ProjectSummaryDTO,
  SystemStatusClient,
  TemplateOverrides,
  WorkspaceDTO,
} from "./types";
import type { ImportFailure, ImportPreviewEntry } from "./workflow-io";

/**
 * Pending connection: the port being wired.
 * - dir "out" (default): wire started from an output port — click/drop on an
 *   input port of another job to finish.
 * - dir "in": wire started from an input port (reverse wiring) — click/drop
 *   on an output port of another job to finish.
 */
export interface PendingFrom {
  jobId: string;
  port: string;
  dir?: "out" | "in";
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/** sessionStorage key for the viewport memory (Task 99). Lives exactly as
 *  long as the tab: a reload (F5, accidental or deliberate) keeps the view,
 *  closing the tab burns it — never touches localStorage, never leaks
 *  across tabs or sessions. */
const VIEWPORT_MEMORY_KEY = "cryoflow.viewportMemory.v1";

/** Debounce window for sessionStorage writes: pan emits a state update per
 *  pointer move, and sessionStorage IO is synchronous — trailing-debounce
 *  so the disk sees ONE write per gesture, ~400ms after it ends. */
const VIEWPORT_MEMORY_PERSIST_MS = 400;

let viewportMemoryPersistTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleViewportMemoryPersist(memory: Record<string, Viewport>) {
  if (typeof window === "undefined") return;
  if (viewportMemoryPersistTimer) clearTimeout(viewportMemoryPersistTimer);
  viewportMemoryPersistTimer = setTimeout(() => {
    viewportMemoryPersistTimer = null;
    try {
      window.sessionStorage.setItem(VIEWPORT_MEMORY_KEY, JSON.stringify(memory));
    } catch {
      // private mode / quota — memory stays in-RAM, reload just re-fits
    }
  }, VIEWPORT_MEMORY_PERSIST_MS);
}

/** Seed the memory from sessionStorage (same tab only, see key doc). Every
 *  entry is shape-checked — corrupted or stale-shaped data is dropped, not
 *  trusted (zoom must be finite; the canvas clamps on restore anyway). */
function hydrateViewportMemory(): Record<string, Viewport> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(VIEWPORT_MEMORY_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, Viewport> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (!v || typeof v !== "object") continue;
      const { x, y, zoom } = v as Record<string, unknown>;
      if (
        typeof x === "number" && Number.isFinite(x) &&
        typeof y === "number" && Number.isFinite(y) &&
        typeof zoom === "number" && Number.isFinite(zoom)
      ) {
        out[k] = { x, y, zoom };
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** localStorage key for NAMED VIEWPORT BOOKMARKS (Task 100). Unlike the
 *  viewport memory above (ephemeral, per-tab), a bookmark is a USER-CREATED
 *  asset — it must outlive the tab AND the session, so it lives in
 *  localStorage. Writes only happen on explicit save/delete actions
 *  (low-frequency), never per-frame — Task 13 #13 stays retired.
 *
 *  v2 (Task 101): each entry carries a STABLE HOTKEY SLOT (1–9, or null
 *  when all nine are taken). The slot is assigned at creation and NEVER
 *  renumbered — deleting bookmark #3 must not turn #4 into #3: muscle
 *  memory is a contract. Re-saving under the same name keeps its slot
 *  (an overwrite updates the snapshot, not the seat). */
const VIEWPORT_BOOKMARKS_KEY = "cryoflow.viewportBookmarks.v2";
/** Pre-slot-format key — migrated once at hydrate, then removed. */
const VIEWPORT_BOOKMARKS_KEY_V1 = "cryoflow.viewportBookmarks.v1";
/** Hotkey slots: digits 1–9 map to the first nine saved views. */
const MAX_BOOKMARK_SLOTS = 9;

/** A named view: the saved viewport plus its permanent hotkey seat
 *  (1–9), or null when the slots were full at save time (panel-click
 *  only — the row simply shows no number chip). */
export interface ViewportBookmark {
  viewport: Viewport;
  slot: number | null;
}

function persistViewportBookmarks(
  bookmarks: Record<string, Record<string, ViewportBookmark>>
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VIEWPORT_BOOKMARKS_KEY, JSON.stringify(bookmarks));
  } catch {
    // private mode / quota — bookmarks stay in-RAM for this session
  }
}

/** Lowest free hotkey slot across a workspace's bookmarks, or null when
 *  all nine are taken. "Free" = no existing bookmark holds it — deleting
 *  a bookmark releases its seat for the NEXT new save, while survivors
 *  keep theirs (stability over compactness). */
function lowestFreeSlot(named: Record<string, ViewportBookmark>): number | null {
  const taken = new Set(
    Object.values(named)
      .map((b) => b.slot)
      .filter((s): s is number => typeof s === "number")
  );
  for (let s = 1; s <= MAX_BOOKMARK_SLOTS; s++) {
    if (!taken.has(s)) return s;
  }
  return null;
}

/** Validate one stored bookmark (v2 shape). Every viewport must be
 *  all-finite and the slot an integer in 1..9 or null — anything else
 *  drops the whole entry (corrupt data is never trusted). */
function parseViewportBookmark(v: unknown): ViewportBookmark | null {
  if (!v || typeof v !== "object") return null;
  const { viewport, slot } = v as Record<string, unknown>;
  if (!viewport || typeof viewport !== "object") return null;
  const { x, y, zoom } = viewport as Record<string, unknown>;
  if (
    !(typeof x === "number" && Number.isFinite(x)) ||
    !(typeof y === "number" && Number.isFinite(y)) ||
    !(typeof zoom === "number" && Number.isFinite(zoom))
  ) {
    return null;
  }
  if (
    slot !== null &&
    !(typeof slot === "number" && Number.isInteger(slot) && slot >= 1 && slot <= MAX_BOOKMARK_SLOTS)
  ) {
    return null;
  }
  return { viewport: { x, y, zoom }, slot };
}

/** Seed the bookmarks from localStorage (cross-session, see key doc).
 *  Reads v2; if only the v1 pre-slot format exists, migrates it: slots
 *  are assigned by stored key order (insertion order — the best guess
 *  available), capped at nine, then v2 is written and v1 removed. */
function hydrateViewportBookmarks(): Record<string, Record<string, ViewportBookmark>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(VIEWPORT_BOOKMARKS_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return {};
      const out: Record<string, Record<string, ViewportBookmark>> = {};
      for (const [wsKey, named] of Object.entries(parsed as Record<string, unknown>)) {
        if (!named || typeof named !== "object") continue;
        const names: Record<string, ViewportBookmark> = {};
        for (const [name, v] of Object.entries(named as Record<string, unknown>)) {
          const bookmark = parseViewportBookmark(v);
          if (bookmark) names[name] = bookmark;
        }
        if (Object.keys(names).length > 0) out[wsKey] = names;
      }
      return out;
    }
    // v1 migration — plain name → viewport, no slots. Key insertion order
    // is the only history we have, so seat order = stored order.
    const rawV1 = window.localStorage.getItem(VIEWPORT_BOOKMARKS_KEY_V1);
    if (!rawV1) return {};
    const parsedV1: unknown = JSON.parse(rawV1);
    if (!parsedV1 || typeof parsedV1 !== "object") return {};
    const out: Record<string, Record<string, ViewportBookmark>> = {};
    let dirty = false;
    for (const [wsKey, named] of Object.entries(parsedV1 as Record<string, unknown>)) {
      if (!named || typeof named !== "object") continue;
      const names: Record<string, ViewportBookmark> = {};
      let seat = 1;
      for (const [name, v] of Object.entries(named as Record<string, unknown>)) {
        if (!v || typeof v !== "object") continue;
        const { x, y, zoom } = v as Record<string, unknown>;
        if (
          typeof x === "number" && Number.isFinite(x) &&
          typeof y === "number" && Number.isFinite(y) &&
          typeof zoom === "number" && Number.isFinite(zoom)
        ) {
          names[name] = { viewport: { x, y, zoom }, slot: seat <= MAX_BOOKMARK_SLOTS ? seat : null };
          seat++;
        }
      }
      if (Object.keys(names).length > 0) out[wsKey] = names;
    }
    if (Object.keys(out).length > 0) {
      persistViewportBookmarks(out);
      dirty = true;
    }
    if (dirty || window.localStorage.getItem(VIEWPORT_BOOKMARKS_KEY_V1) !== null) {
      window.localStorage.removeItem(VIEWPORT_BOOKMARKS_KEY_V1);
    }
    return out;
  } catch {
    return {};
  }
}

/** Pre-delete capture carried by the delete toast's Undo action (Task 97).
 *  Jobs hold the FULL pre-delete DTOs — status/progress/result/note included —
 *  because restore re-creates the rows verbatim; edges hold the deleted
 *  jobs' wires (both endpoints: restored↔restored and restored↔survivor). */
export interface DeleteSnapshot {
  jobs: JobDTO[];
  edges: EdgeDTO[];
}

interface WorkflowState {
  jobs: JobDTO[];
  edges: EdgeDTO[];
  project: ProjectDTO | null;
  /** All projects (for the project management panel). */
  projects: ProjectSummaryDTO[];
  /** Workspaces of the ACTIVE project (sidebar tab + header switcher). */
  workspaces: WorkspaceDTO[];
  /** Canvas filter: only jobs of this workspace render. Null while loading. */
  activeWorkspaceId: string | null;
  /** Which top-level view is active: the node canvas or the project dashboard. */
  view: "canvas" | "dashboard";
  /** RELION environment status (refreshed on load). */
  system: SystemStatusClient | null;
  /** True while a forced re-detect is in flight (Re-detect button spinner). */
  systemRefreshing: boolean;
  selectedId: string | null;
  /** Multi-selection membership (rubber band / shift-click / Ctrl+A). The
   *  PRIMARY selection in selectedId drives the edit panel, the F focus
   *  shortcut and the minimap ring — it is always a member of selectedIds
   *  when non-null. Bulk ops (align/distribute/duplicate/delete/drag)
   *  operate on the whole set. */
  selectedIds: string[];
  /** Job opened in the large inspector modal (submitted jobs only). */
  inspectId: string | null;
  pendingFrom: PendingFrom | null;
  /** Pan + zoom of the free canvas viewport. */
  viewport: Viewport;
  /** Per-(project:workspace) viewport memory (tab-session scope): what the
   *  canvas restores when the user comes BACK to a workspace or RELOADS the
   *  page. Written through on every viewport change and debounced into
   *  sessionStorage (same tab only); closing the tab deliberately burns it. */
  viewportMemory: Record<string, Viewport>;
  /** Named viewport bookmarks (Task 100), keyed (project:workspace) → name →
   *  { viewport, slot } — the user's SAVED views with their stable hotkey
   *  seats (Task 101: slot 1–9 assigned at creation, never renumbered).
   *  Hydrated from localStorage, persisted synchronously on explicit
   *  save/delete only. */
  viewportBookmarks: Record<string, Record<string, ViewportBookmark>>;
  /** Job type key being dragged from the palette (drop target hint). */
  paletteDrag: string | null;
  /** Increments on every one-click auto-arrange (canvas fit-views on change). */
  layoutEpoch: number;
  /** Job to center the canvas on (inspector "Focus" button). */
  focusJobId: string | null;
  /** Increments per focus request so the canvas effect re-fires. */
  focusEpoch: number;
  /** One-shot deep link from the command palette's Class notes group
   *  (Task 81): "open THIS class's note editor". The job panel consumes it
   *  (switches to the params tab, the gallery opens the lightbox on the
   *  class) and clears it — never observed twice. */
  pendingClassFocus: { jobId: string; cls: number } | null;
  requestClassFocus: (jobId: string, cls: number) => void;
  consumeClassFocus: () => void;
  /** SPA template presets dialog open (triggered from the canvas empty
   *  state, the command palette or the help popover — mounted once). */
  templatePresetsOpen: boolean;
  /** Keyboard-shortcuts dialog ("?" anywhere, the help popover, or the
   *  command palette) — single source of truth so all three entries stay
   *  in sync. */
  shortcutsOpen: boolean;
  /** Note spotlight (Task 75) — when true, canvas cards WITHOUT a human
   *  judgment dim toward the background so the scientist's annotations
   *  (job notes, Task 73; class notes, Task 80/83) jump out at a glance.
   *  "Judgment" = hasJudgment in lib/class-notes.ts — the same predicate
   *  the header chip count and the dashboard Noted filter read. In-memory
   *  only, like the selection: the spotlight is
   *  a viewing lens, not a document property — nobody expects "which cards
   *  were dimmed last session" to survive a reload. Toggled from the
   *  header chip, the command palette, or the N key. */
  noteSpotlight: boolean;
  /** Parsed workflow files awaiting confirmation in the import dialog —
   *  the dialog shows a QUEUE (one summary row per file, plus per-file
   *  parse failures) + one shared target-workspace picker before any
   *  network call happens (mounted once, like the presets dialog).
   *  Multi-file since Task 86: one picker session can stage any number. */
  importPreview: {
    entries: ImportPreviewEntry[];
    failures: ImportFailure[];
  } | null;
  loading: boolean;
  error: string | null;
  /** True while a card is being dragged — polling pauses so no re-render
   *  ever interrupts the drag loop (the card + wires are patched via DOM). */
  dragActive: boolean;

  load: () => Promise<void>;
  /** Force a fresh RELION/WSL environment probe (bypasses the 60s cache). */
  refreshSystem: () => Promise<void>;
  /** Switch the active RELION install (multi-version switcher). */
  selectRelionInstall: (installId: string) => Promise<boolean>;
  switchProject: (id: string) => Promise<void>;
  createProject: (input: { name: string; mode: string }) => Promise<boolean>;
  renameProject: (id: string, name: string) => Promise<boolean>;
  deleteProject: (id: string) => Promise<boolean>;
  /** Re-fetch the workspace list of the ACTIVE project (keeps the current
   *  selection when it still exists; otherwise falls back to the first). */
  refreshWorkspaces: () => Promise<void>;
  switchWorkspace: (id: string) => void;
  createWorkspace: (name: string) => Promise<boolean>;
  renameWorkspace: (id: string, name: string) => Promise<boolean>;
  deleteWorkspace: (id: string) => Promise<boolean>;
  /** Cross-workspace MOVE (PATCH workspaceId) — the job keeps its edges;
   *  wires render wherever BOTH endpoints are visible. */
  moveJob: (id: string, workspaceId: string) => Promise<boolean>;
  /** Cross-workspace COPY-as-link (POST /api/jobs {linkedJobId}) — the new
   *  node mirrors the original and downstream jobs consume its outputs. */
  linkJobTo: (id: string, workspaceId: string) => Promise<void>;
  fetchLog: (jobId: string) => Promise<string | null>;
  addJob: (type: string, params?: Record<string, number | string | boolean>) => Promise<void>;
  addJobAt: (
    type: string,
    x: number,
    y: number,
    params?: Record<string, number | string | boolean>
  ) => Promise<void>;
  /** One-click standard SPA pipeline: 10 pre-wired jobs into the ACTIVE
   *  workspace (below existing content), optional parameter overrides,
   *  nothing run. */
  createTemplate: (overrides?: TemplateOverrides) => Promise<void>;
  /** Recreate one or more exported cryoflow-workflow/1 files (a POST
   *  /api/workflow-import PER file, sequential so merges never race) —
   *  target workspace selectable (defaults to the active one, must belong
   *  to the active project — the server rejects anything else); server
   *  re-validates types, params and port wiring per file; ONE summary
   *  toast at the end carries the aggregate counts, per-file failures and
   *  a single Undo spanning every file's created jobs (Task 86). */
  importWorkflowBatch: (
    entries: ImportPreviewEntry[],
    workspaceId?: string
  ) => Promise<void>;
  /** Undo a just-imported batch: delete the created jobs (cascade removes
   *  their fresh edges), optionally step the canvas back to the workspace
   *  the user was on when the import auto-switched. Idempotent and honest —
   *  jobs that already left "idle" are KEPT and reported. */
  undoImport: (createdIds: string[], restoreWorkspaceId: string | null, switched: boolean) => Promise<void>;
  /** Undo a job deletion (Task 97): the toast's Undo action carries the
   *  pre-delete snapshot — jobs are restored under their ORIGINAL ids via
   *  /api/jobs/restore (same-id re-attaches the surviving workdir/outputs),
   *  then wires are re-POSTed one by one (the sidecar file is a
   *  read-modify-write store — parallel restores could lose edges). */
  undoDelete: (snapshot: DeleteSnapshot) => Promise<void>;
  setTemplatePresetsOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  toggleNoteSpotlight: () => void;
  /** Stage parsed files for the import dialog (replaces any earlier
   *  staging — one picker session at a time). */
  openImportPreview: (entries: ImportPreviewEntry[], failures: ImportFailure[]) => void;
  closeImportPreview: () => void;
  moveJobCommit: (id: string, x: number, y: number) => Promise<void>;
  applyLayout: () => Promise<void>;
  saveJob: (
    id: string,
    patch: {
      name?: string;
      params?: Record<string, number | string | boolean>;
      /** free-text margin annotation (≤500 chars, "" clears → server null) */
      note?: string;
    },
    opts?: { silent?: boolean }
  ) => Promise<{ ok: boolean; error?: string }>;
  runJob: (id: string) => Promise<boolean>;
  /** POST /stop — SIGTERM→SIGKILL the job's process tree; re-run resumes
   *  refine-family jobs from their checkpoint via RELION --continue. */
  stopJob: (id: string) => Promise<void>;
  resetJob: (id: string) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
  /** Clone a job (params + position offset) as a fresh idle draft. */
  duplicateJob: (id: string) => Promise<void>;
  connect: (from: string, to: string, fromPort?: string, toPort?: string) => Promise<void>;
  removeEdge: (id: string) => Promise<void>;
  pollTick: () => Promise<void>;

  select: (id: string | null) => void;
  /** Shift-click toggle: add/remove a card from the multi-selection (the
   *  toggled card becomes primary when it joins; leaving promotes the
   *  last remaining card to primary). */
  toggleSelect: (id: string) => void;
  /** Commit a rubber-band result (empty array clears). Keeps the current
   *  primary when it survives inside the new selection. */
  selectMany: (ids: string[]) => void;
  /** Ctrl/Cmd+A — select every card of the ACTIVE workspace. */
  selectAll: () => void;
  /** Delete every selected job (plus their edges) — parallel server calls,
   *  ONE optimistic state update, one toast. */
  deleteSelected: () => Promise<void>;
  /** Duplicate every selected job; edges BETWEEN the copies are recreated
   *  so a wired sub-pipeline comes back as a wired sub-pipeline. */
  duplicateSelected: () => Promise<void>;
  /** Commit a group drag: one optimistic update + one bulk layout PATCH. */
  moveJobsCommit: (moves: { id: string; x: number; y: number }[]) => Promise<void>;
  /** Snap the selection onto a shared edge/center line. */
  alignSelected: (
    mode: "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom"
  ) => void;
  /** Even out the gaps between 3+ selected cards along one axis. */
  distributeSelected: (axis: "h" | "v") => void;
  /** Open the big job inspector (submitted jobs); null closes it. */
  inspect: (id: string | null) => void;
  /** Switch the top-level view (canvas ⇄ project dashboard). */
  setView: (view: "canvas" | "dashboard") => void;
  setPendingFrom: (pending: PendingFrom | null) => void;
  cancelConnect: () => void;
  setViewport: (patch: Partial<Viewport>) => void;
  panBy: (dx: number, dy: number) => void;
  /** Save the current viewport under a name for THIS (project:workspace) —
   *  same-name saves overwrite (a bookmark is a named snapshot, not a log)
   *  and KEEP the existing hotkey slot; new names take the lowest free
   *  slot (Task 101), or none when all nine are taken. */
  saveViewportBookmark: (name: string) => boolean;
  deleteViewportBookmark: (name: string) => void;
  /** Jump straight to the saved view holding hotkey `slot` (1–9) for THIS
   *  (project:workspace) — Task 101. Routes through setViewport (zoom clamp
   *  gate); false when no bookmark holds the seat — an honest dead key, no
   *  phantom jump (mirrors the dashboard's empty-slice dead filters). */
  jumpToViewportBookmark: (slot: number) => boolean;
  setDragActive: (active: boolean) => void;
  setPaletteDrag: (type: string | null) => void;
  /** Center the canvas on a job ("Focus" from the inspector). */
  focusJob: (id: string) => void;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data?.error ?? `Request failed (${res.status})`);
  }
  return data;
}

/**
 * Workspace membership EXACTLY as the canvas visibility rule computes it
 * (useActiveWorkspaceJobs): legacy NULL-workspace jobs normalize to "".
 * Every selection guard (selectAll / deleteSelected / duplicateSelected /
 * alignSelected / distributeSelected) MUST use this same predicate — a
 * strict `j.workspaceId === ws` disagreeing with visibility produces cards
 * that are visible but silently undeletable (Bug #33).
 */
function jobInWorkspace(j: { workspaceId?: string | null }, ws: string | null): boolean {
  return (j.workspaceId ?? "") === ws;
}

/** Client-side cycle check: would edge from→to create a cycle? */
function wouldCreateCycle(edges: EdgeDTO[], from: string, to: string): boolean {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const list = adj.get(e.fromJobId) ?? [];
    list.push(e.toJobId);
    adj.set(e.fromJobId, list);
  }
  const seen = new Set<string>();
  const stack = [to];
  while (stack.length > 0) {
    const cur = stack.pop() as string;
    if (cur === from) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const next of adj.get(cur) ?? []) stack.push(next);
  }
  return false;
}

/** Reference-stable job comparison for pollTick: when nothing changed we
 *  keep the OLD object references so every React.memo'd card (and the
 *  memo'd edge layer) skips re-rendering — polls become zero-cost. */
function jobEquals(a: JobDTO, b: JobDTO): boolean {
  return (
    a.id === b.id &&
    a.type === b.type &&
    a.name === b.name &&
    a.x === b.x &&
    a.y === b.y &&
    a.status === b.status &&
    a.progress === b.progress &&
    a.result === b.result &&
    a.duration === b.duration &&
    a.startedAt === b.startedAt &&
    a.updatedAt === b.updatedAt &&
    a.engine === b.engine &&
    a.hasLog === b.hasLog &&
    (a.workspaceId ?? null) === (b.workspaceId ?? null) &&
    (a.linkedJobId ?? null) === (b.linkedJobId ?? null) &&
    (a.linkedName ?? null) === (b.linkedName ?? null) &&
    (a.linkCount ?? 0) === (b.linkCount ?? 0) &&
    JSON.stringify(a.params) === JSON.stringify(b.params)
  );
}

function errToast(msg: string) {
  toast({ title: "Something went wrong", description: msg, variant: "destructive" });
}

/* ------------------------------------------------------------------ */
/* Debounced param auto-save — flush registry                           */
/* ------------------------------------------------------------------ */

/** One pending param flush per job (registered by the params panel while
 *  its debounced auto-save timer runs). runJob() awaits it first so a Run
 *  never races the 700 ms debounce window and starts with stale DB params. */
const paramFlushers = new Map<string, () => Promise<void>>();

export function registerParamFlusher(
  jobId: string,
  flush: () => Promise<void>
): () => void {
  paramFlushers.set(jobId, flush);
  return () => {
    // deregister only when THIS registration is still the live one (a newer
    // mount for the same job may have replaced it)
    if (paramFlushers.get(jobId) === flush) paramFlushers.delete(jobId);
  };
}

async function flushJobParams(jobId: string): Promise<void> {
  const flush = paramFlushers.get(jobId);
  if (flush) await flush();
}

/** Poll /api/system until the server's background re-detect lands — the
 *  header RELION chip quietly upgrades from "saved" (fromCache) to fresh
 *  without any user action. Stops early if someone re-detected/switched. */
async function pollSystemUntilFresh(): Promise<void> {
  const delays = [3000, 8000, 20000, 45000];
  for (const delay of delays) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    const current = useWorkflowStore.getState().system;
    if (!current?.fromCache) return;
    try {
      const sys = await api<SystemStatusClient>("/api/system");
      // don't fight an in-flight manual re-detect / install switch
      if (!useWorkflowStore.getState().systemRefreshing) {
        useWorkflowStore.setState({ system: sys });
      }
      if (!sys.fromCache) return;
    } catch {
      return; // transient — the Re-detect button remains the escape hatch
    }
  }
}

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

/** One pollTick at a time (see the guard inside pollTick). */
let pollInFlight = false;

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  jobs: [],
  edges: [],
  project: null,
  projects: [],
  workspaces: [],
  activeWorkspaceId: null,
  view: "canvas",
  system: null,
  systemRefreshing: false,
  selectedId: null,
  selectedIds: [],
  inspectId: null,
  pendingFrom: null,
  viewport: { x: 0, y: 0, zoom: 1 },
  viewportMemory: hydrateViewportMemory(),
  viewportBookmarks: hydrateViewportBookmarks(),
  paletteDrag: null,
  layoutEpoch: 0,
  focusJobId: null,
  pendingClassFocus: null,
  focusEpoch: 0,
  templatePresetsOpen: false,
  shortcutsOpen: false,
  noteSpotlight: false,
  importPreview: null,
  loading: true,
  error: null,
  dragActive: false,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const [p, j, e, sys, projs, ws] = await Promise.all([
        api<{ project: ProjectDTO | null }>("/api/project"),
        api<{ jobs: JobDTO[] }>("/api/jobs"),
        api<{ edges: EdgeDTO[] }>("/api/edges"),
        api<SystemStatusClient>("/api/system").catch(() => null),
        api<{ projects: ProjectSummaryDTO[] }>("/api/projects").catch(() => ({ projects: [] })),
        api<{ workspaces: WorkspaceDTO[] }>("/api/workspaces").catch(() => ({ workspaces: [] })),
      ]);
      // keep the current workspace when it still exists (e.g. project-level
      // reloads), otherwise land on the project's first workspace
      const currentWs = get().activeWorkspaceId;
      const wsList = ws.workspaces;
      const activeWs =
        currentWs && wsList.some((w) => w.id === currentWs)
          ? currentWs
          : (wsList[0]?.id ?? null);
      set({
        project: p.project ?? null,
        jobs: j.jobs,
        edges: e.edges,
        system: sys,
        projects: projs.projects,
        workspaces: wsList,
        activeWorkspaceId: activeWs,
        loading: false,
      });
      // RELION status came from the SAVED detection — the server is
      // re-verifying in the background; poll until the fresh probe lands so
      // the chip upgrades automatically (no re-detect click needed).
      if (sys?.fromCache) void pollSystemUntilFresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load project";
      set({ loading: false, error: msg });
      errToast(msg);
    }
  },

  refreshWorkspaces: async () => {
    try {
      const { workspaces } = await api<{ workspaces: WorkspaceDTO[] }>("/api/workspaces");
      const current = get().activeWorkspaceId;
      set({
        workspaces,
        activeWorkspaceId:
          current && workspaces.some((w) => w.id === current)
            ? current
            : (workspaces[0]?.id ?? null),
      });
    } catch {
      /* transient — the panel keeps showing the previous list */
    }
  },

  switchWorkspace: (id) => {
    if (get().activeWorkspaceId === id) return;
    // leaving the old canvas: clear selection/pending wire so the new
    // workspace doesn't start with stale state from the previous one
    set({ activeWorkspaceId: id, selectedId: null, selectedIds: [], pendingFrom: null });
  },

  createWorkspace: async (name) => {
    try {
      const { workspace } = await api<{ workspace: WorkspaceDTO }>("/api/workspaces", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ name }),
      });
      set({ workspaces: [...get().workspaces, workspace] });
      toast({ title: "Workspace created", description: workspace.name });
      return true;
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to create workspace");
      return false;
    }
  },

  renameWorkspace: async (id, name) => {
    try {
      await api<{ workspace: WorkspaceDTO }>(`/api/workspaces/${id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ name }),
      });
      set({
        workspaces: get().workspaces.map((w) => (w.id === id ? { ...w, name } : w)),
      });
      return true;
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to rename workspace");
      return false;
    }
  },

  deleteWorkspace: async (id) => {
    try {
      const { movedCount, fallback } = await api<{
        ok: boolean;
        movedCount: number;
        fallback: string;
      }>(`/api/workspaces/${id}`, { method: "DELETE" });
      toast({
        title: "Workspace deleted",
        description:
          movedCount > 0
            ? `${movedCount} job${movedCount === 1 ? "" : "s"} moved to "${fallback}"`
            : undefined,
      });
      await get().refreshWorkspaces();
      return true;
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to delete workspace");
      return false;
    }
  },

  moveJob: async (id, workspaceId) => {
    const { jobs, workspaces } = get();
    const job = jobs.find((j) => j.id === id);
    const target = workspaces.find((w) => w.id === workspaceId);
    if (!job || !target || job.workspaceId === workspaceId) return false;
    // optimistic: the job leaves this canvas immediately
    const restIds = get().selectedIds.filter((x) => x !== id);
    const keepPrimary = get().selectedId === id ? (restIds[0] ?? null) : get().selectedId;
    set({
      jobs: jobs.map((j) => (j.id === id ? { ...j, workspaceId } : j)),
      selectedId: keepPrimary,
      selectedIds: keepPrimary ? restIds : [],
    });
    try {
      await api(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ workspaceId }),
      });
      toast({
        title: "Job moved",
        description: `${job.name} → workspace "${target.name}" — its wires now render where both endpoints live`,
      });
      return true;
    } catch (err) {
      // revert the optimistic move
      set({ jobs: get().jobs.map((j) => (j.id === id ? { ...j, workspaceId: job.workspaceId } : j)) });
      errToast(err instanceof Error ? err.message : "Failed to move job");
      return false;
    }
  },

  linkJobTo: async (id, workspaceId) => {
    const { workspaces, viewport, jobs } = get();
    const source = jobs.find((j) => j.id === id);
    const target = workspaces.find((w) => w.id === workspaceId);
    if (!source || !target) return;
    // place the link at the current viewport center of the TARGET canvas
    const x = clamp(
      Math.round(-viewport.x + 480 / viewport.zoom - CARD_W / 2),
      WORLD_MIN,
      WORLD_MAX - CARD_W
    );
    const y = clamp(
      Math.round(-viewport.y + 360 / viewport.zoom - CARD_H / 2),
      WORLD_MIN,
      WORLD_MAX - CARD_H
    );
    try {
      const { job } = await api<{ job: JobDTO }>("/api/jobs", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          type: source.type,
          linkedJobId: source.id,
          workspaceId,
          x,
          y,
        }),
      });
      // append the link AND bump the original's referenced-count badge in
      // the same optimistic batch (a poll may never fire when nothing runs)
      set({
        jobs: [...get().jobs, job].map((j) =>
          j.id === id ? { ...j, linkCount: (j.linkCount ?? 0) + 1 } : j
        ),
        activeWorkspaceId: workspaceId,
        selectedId: job.id,
        selectedIds: [job.id],
        pendingFrom: null,
      });
      get().focusJob(job.id);
      toast({
        title: "Linked copy created",
        description: `“${job.name}” in "${target.name}" — wire downstream jobs to it; they consume the original's outputs`,
      });
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to copy as link");
    }
  },

  refreshSystem: async () => {
    if (get().systemRefreshing) return;
    set({ systemRefreshing: true });
    try {
      const sys = await api<SystemStatusClient>("/api/system?force=1");
      set({ system: sys });
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to re-detect RELION environment");
    } finally {
      set({ systemRefreshing: false });
    }
  },

  selectRelionInstall: async (installId) => {
    try {
      const { status } = await api<{ status: SystemStatusClient }>(
        "/api/system/select",
        {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify({ installId }),
        }
      );
      set({ system: status });
      const install = status.installs.find((i) => i.id === installId);
      toast({
        title: "RELION install switched",
        description: install
          ? `RELION ${install.version ?? "?"} · ${install.execution === "wsl" ? `WSL (${install.distro ?? "default"})` : "native"} — new runs use it immediately`
          : installId,
      });
      return true;
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to switch RELION install");
      return false;
    }
  },

  switchProject: async (id) => {
    try {
      await api<{ ok: boolean }>("/api/projects/switch", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ id }),
      });
      set({
        selectedId: null,
        selectedIds: [],
        inspectId: null,
        pendingFrom: null,
        viewport: { x: 0, y: 0, zoom: 1 },
        activeWorkspaceId: null, // load() lands on the project's first workspace
      });
      await get().load();
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to switch project");
    }
  },

  createProject: async (input) => {
    try {
      await api<{ ok: boolean }>("/api/projects", {
        method: "POST",
        headers: JSON_HEADERS,
        // engine is always the real RELION one — no field needed anymore
        body: JSON.stringify({ name: input.name, mode: input.mode }),
      });
      await get().load();
      toast({ title: "Project created", description: input.name });
      return true;
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to create project");
      return false;
    }
  },

  renameProject: async (id, name) => {
    try {
      await api<{ ok: boolean }>(`/api/projects/${id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ name }),
      });
      await get().load();
      return true;
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to rename project");
      return false;
    }
  },

  deleteProject: async (id) => {
    try {
      await api<{ ok: boolean }>(`/api/projects/${id}`, { method: "DELETE" });
      set({ selectedId: null, selectedIds: [], inspectId: null, pendingFrom: null });
      await get().load();
      toast({ title: "Project deleted" });
      return true;
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to delete project");
      return false;
    }
  },

  fetchLog: async (jobId) => {
    try {
      const data = await api<{ tail: string }>(`/api/jobs/${jobId}/log`);
      return data.tail;
    } catch {
      return null;
    }
  },

  addJob: async (type, params) => {
    // legacy keyboard path: place in the middle of the current viewport
    const { viewport } = get();
    const x = clamp(-viewport.x + 480 / viewport.zoom - CARD_W / 2, WORLD_MIN, WORLD_MAX - CARD_W);
    const y = clamp(-viewport.y + 360 / viewport.zoom - CARD_H / 2, WORLD_MIN, WORLD_MAX - CARD_H);
    await get().addJobAt(type, x, y, params);
  },

  addJobAt: async (type, x, y, params) => {
    const spec = jobType(type);
    if (!spec) {
      errToast(`Unknown job type: ${type}`);
      return;
    }
    const cx = clamp(Math.round(x - CARD_W / 2), WORLD_MIN, WORLD_MAX - CARD_W);
    const cy = clamp(Math.round(y - CARD_H / 2), WORLD_MIN, WORLD_MAX - CARD_H);
    try {
      const { job } = await api<{ job: JobDTO }>("/api/jobs", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          type,
          x: cx,
          y: cy,
          workspaceId: get().activeWorkspaceId ?? undefined,
          // preset overrides (command palette "Add with preset") — the server
          // scalar-filters against the type's schema, so stale/unknown keys
          // degrade to spec defaults instead of erroring
          ...(params && Object.keys(params).length > 0 ? { params } : {}),
        }),
      });
      set({ jobs: [...get().jobs, job], selectedId: job.id, selectedIds: [job.id] });
      toast({
        title: "Job added",
        description: `${job.name} placed on the canvas`,
      });
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to add job");
    }
  },

  createTemplate: async (overrides) => {
    try {
      const data = await api<{ jobs: JobDTO[]; edges: EdgeDTO[] }>("/api/pipeline-template", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          workspaceId: get().activeWorkspaceId ?? undefined,
          // only send when present — keeps the request shape stable for the
          // defaults path (and the server treats absent == spec defaults)
          ...(overrides && Object.values(overrides).some((v) => v != null)
            ? { overrides }
            : {}),
        }),
      });
      const have = new Set(get().jobs.map((j) => j.id));
      const haveEdges = new Set(get().edges.map((e) => e.id));
      set({
        jobs: [...get().jobs, ...data.jobs.filter((j) => !have.has(j.id))],
        edges: [...get().edges, ...data.edges.filter((e) => !haveEdges.has(e.id))],
        layoutEpoch: get().layoutEpoch + 1, // canvas fit-views the new content
      });
      const presetBits = overrides?.symmetry ? ` · symmetry ${overrides.symmetry}` : "";
      toast({
        title: "Standard SPA pipeline created",
        description: `${data.jobs.length} pre-wired jobs${presetBits} — set the Import source, then run it to chain-start the rest`,
      });
      // the route may have provisioned the legacy seed's missing "Main"
      // workspace — refresh the sidebar/header lists so they show it
      void get().refreshWorkspaces();
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to create the pipeline template");
    }
  },

  importWorkflowBatch: async (entries, workspaceId) => {
    // explicit target (import dialog) wins; absent = the active workspace
    const targetWsId = workspaceId ?? get().activeWorkspaceId ?? undefined;
    // remembered for undo — where the canvas was before an auto-switch
    const wsBeforeImport = get().activeWorkspaceId;
    // sequential POSTs, not Promise.all: each success merges into the
    // store (read-modify-write on jobs/edges), and parallel merges would
    // read the same base and drop each other's jobs. Order also keeps
    // per-file fit-view churn to a single final layoutEpoch bump per
    // import — the LAST merge's epoch is the one the canvas fits to.
    const createdIds: string[] = [];
    let totalJobs = 0;
    let totalEdges = 0;
    const failedFiles: string[] = [];
    for (const entry of entries) {
      try {
        const data = await api<{ jobs: JobDTO[]; edges: EdgeDTO[] }>("/api/workflow-import", {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify({
            workspaceId: targetWsId,
            jobs: entry.file.jobs,
            edges: entry.file.edges,
          }),
        });
        const have = new Set(get().jobs.map((j) => j.id));
        const haveEdges = new Set(get().edges.map((e) => e.id));
        set({
          jobs: [...get().jobs, ...data.jobs.filter((j) => !have.has(j.id))],
          edges: [...get().edges, ...data.edges.filter((e) => !haveEdges.has(e.id))],
          layoutEpoch: get().layoutEpoch + 1, // fit-view the imported graph
        });
        createdIds.push(...data.jobs.map((j) => j.id));
        totalJobs += data.jobs.length;
        totalEdges += data.edges.length;
      } catch {
        // one bad file must not sink the batch — the summary toast names
        // every failure so the user knows exactly what to re-export
        failedFiles.push(entry.fileName);
      }
    }
    if (createdIds.length === 0) {
      errToast(
        failedFiles.length === entries.length
          ? `Import failed — none of the ${entries.length} workflow${entries.length === 1 ? "" : "s"} could be imported`
          : "Import failed — no jobs were created"
      );
      return;
    }
    // Follow the import when it landed in another workspace — the canvas
    // fit-views the new content via layoutEpoch, so switching here shows
    // exactly what was just imported instead of leaving the user to find
    // it. Switched ONCE for the whole batch (not per file).
    let switched = false;
    if (targetWsId && targetWsId !== get().activeWorkspaceId) {
      set({ activeWorkspaceId: targetWsId, selectedId: null, selectedIds: [], pendingFrom: null });
      switched = true;
    }
    const wsName =
      get().workspaces.find((w) => w.id === targetWsId)?.name ?? "the selected workspace";
    const okCount = entries.length - failedFiles.length;
    const where = `${switched ? " (canvas switched there)" : ""}`;
    // toast real estate is a summary, not a ledger: past three files the
    // names stop being scannable — name the first three honestly and point
    // at the rest; the import dialog's queue (before confirm) always showed
    // every failure in full, so the full truth was never hidden
    const failedLabel =
      failedFiles.length > 3
        ? `${failedFiles.slice(0, 3).join(", ")} + ${failedFiles.length - 3} more`
        : failedFiles.join(", ");
    const desc = failedFiles.length
      ? `${okCount} of ${entries.length} imported — ${totalJobs} jobs · ${totalEdges} links in ${wsName}${where}; failed: ${failedLabel}`
      : `${okCount} workflow${okCount === 1 ? "" : "s"} — ${totalJobs} jobs · ${totalEdges} links recreated in ${wsName}${where}; nothing runs until you start it`;
    toast({
      title: failedFiles.length ? "Partially imported" : "Workflows imported",
      description: desc,
      // wrong-project/wrong-workspace imports are the classic slip — keep
      // the toast up long enough to matter and offer a one-tap undo
      duration: 12_000,
      action: createdIds.length
        ? (React.createElement(
            ToastAction,
            {
              altText: "Undo the import",
              onClick: () =>
                void get().undoImport(createdIds, wsBeforeImport ?? null, switched),
            },
            "Undo"
          ) as unknown as ToastActionElement)
        : undefined,
    });
    void get().refreshWorkspaces();
  },

  undoImport: async (createdIds, restoreWorkspaceId, switched) => {
    // only jobs that are still untouched idle imports get deleted — if the
    // user already started one (or it's gone entirely), keep it and say so
    const undoable = createdIds.filter(
      (id) => {
        const j = get().jobs.find((x) => x.id === id);
        return !!j && j.status === "idle" && !j.linkedJobId;
      }
    );
    if (undoable.length === 0) {
      toast({
        title: "Nothing to undo",
        description: "The imported jobs already changed — they are kept as they are.",
      });
      return;
    }
    const results = await Promise.allSettled(
      undoable.map((id) => api(`/api/jobs/${id}`, { method: "DELETE" }))
    );
    const ok = undoable.filter((_, i) => results[i].status === "fulfilled");
    if (ok.length === 0) {
      errToast("Undo failed — none of the imported jobs could be deleted");
      return;
    }
    const okSet = new Set(ok);
    const selectedId = get().selectedId;
    set({
      jobs: get().jobs.filter((j) => !okSet.has(j.id)),
      // fresh import edges only connect created jobs — filtering by
      // endpoints covers them (DB cascades the rest)
      edges: get().edges.filter((e) => !okSet.has(e.fromJobId) && !okSet.has(e.toJobId)),
      selectedIds: get().selectedIds.filter((id) => !okSet.has(id)),
      selectedId: selectedId && okSet.has(selectedId) ? null : selectedId,
      // step the canvas back to where the user was before the auto-switch
      ...(switched && restoreWorkspaceId != null
        ? { activeWorkspaceId: restoreWorkspaceId, pendingFrom: null }
        : {}),
    });
    toast({
      title: "Import undone",
      description:
        ok.length === createdIds.length
          ? `${ok.length} job${ok.length === 1 ? "" : "s"} removed${switched ? " — canvas switched back" : ""}`
          : `${ok.length} of ${createdIds.length} jobs removed — the rest already changed and were kept`,
    });
    void get().refreshWorkspaces();
  },

  undoDelete: async (snapshot) => {
    // defensive: jobs that somehow reappeared (another undo already ran) are
    // skipped — the server's id-collision guard is the real backstop
    const jobs = snapshot.jobs.filter((j) => !get().jobs.some((x) => x.id === j.id));
    if (jobs.length === 0) {
      toast({
        title: "Nothing to undo",
        description: "The deleted jobs are already back on the canvas.",
      });
      return;
    }
    let res: { restored: { id: string; coerced: boolean }[]; failed: { id: string; error: string }[] };
    try {
      res = await api("/api/jobs/restore", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ jobs }),
      });
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Undo failed — the jobs could not be restored");
      return;
    }
    const restoredIds = new Set(res.restored.map((r) => r.id));
    if (restoredIds.size === 0) {
      toast({
        title: "Nothing to undo",
        description: "None of the deleted jobs could be restored — they may already be back.",
      });
      return;
    }
    // re-wire sequentially: the sidecar edge file is a read-modify-write
    // store, parallel POSTs could drop edges; wires to survivors restore
    // too (one endpoint restored, the other never left)
    const alive = (id: string) => restoredIds.has(id) || get().jobs.some((j) => j.id === id);
    let edgeOk = 0;
    let edgeFail = 0;
    const restoredEdges: EdgeDTO[] = [];
    for (const e of snapshot.edges) {
      if (!alive(e.fromJobId) || !alive(e.toJobId)) {
        edgeFail += 1;
        continue;
      }
      try {
        await api("/api/edges", {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify({
            fromJobId: e.fromJobId,
            toJobId: e.toJobId,
            fromPort: e.fromPort,
            toPort: e.toPort,
          }),
        });
        restoredEdges.push(e);
        edgeOk += 1;
      } catch {
        edgeFail += 1;
      }
    }
    // optimistic append — status coercion (running→idle) mirrors the server
    const coercedIds = new Set(res.restored.filter((r) => r.coerced).map((r) => r.id));
    const backJobs = snapshot.jobs
      .filter((j) => restoredIds.has(j.id))
      .map((j) => (coercedIds.has(j.id) ? { ...j, status: "idle", progress: 0 } : j));
    set({
      jobs: [...get().jobs, ...backJobs],
      edges: [...get().edges, ...restoredEdges],
    });
    const refused = res.failed.length;
    const coercedCount = coercedIds.size;
    const bits: string[] = [
      `${restoredIds.size} of ${jobs.length} job${jobs.length === 1 ? "" : "s"} back on the canvas`,
    ];
    if (edgeOk > 0) bits.push(`${edgeOk} wire${edgeOk === 1 ? "" : "s"} reconnected`);
    if (edgeFail > 0) bits.push(`${edgeFail} wire${edgeFail === 1 ? "" : "s"} could not be reconnected`);
    if (coercedCount > 0)
      bits.push("the interrupted run came back as idle — start it again when ready");
    if (refused > 0) bits.push(`${refused} could not be restored`);
    toast({
      title:
        restoredIds.size === jobs.length && refused === 0
          ? "Delete undone"
          : "Partially undone",
      description: bits.join(" · "),
      variant: refused > 0 && restoredIds.size === 0 ? "destructive" : undefined,
    });
    void get().refreshWorkspaces();
  },

  moveJobCommit: async (id, x, y) => {
    // optimistic
    set({ jobs: get().jobs.map((j) => (j.id === id ? { ...j, x, y } : j)) });
    try {
      await api(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ x, y }),
      });
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to save position");
    }
  },

  applyLayout: async () => {
    const { jobs, edges } = get();
    if (jobs.length === 0) return;
    const positions = autoLayout(
      jobs.map((j) => ({ id: j.id, type: j.type })),
      edges.map((e) => ({ fromJobId: e.fromJobId, toJobId: e.toJobId }))
    );
    const updates = [...positions.entries()].map(([id, p]) => ({ id, x: p.x, y: p.y }));
    set({
      jobs: get().jobs.map((j) => ({ ...j, ...(positions.get(j.id) ?? {}) })),
      layoutEpoch: get().layoutEpoch + 1,
    });
    try {
      await api("/api/jobs/layout", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ updates }),
      });
      toast({ title: "Workflow tidied", description: `${updates.length} jobs auto-arranged` });
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to save layout");
    }
  },

  saveJob: async (id, patch, opts) => {
    const silent = opts?.silent === true;
    try {
      const { job } = await api<{ job: JobDTO }>(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify(patch),
      });
      set({ jobs: get().jobs.map((j) => (j.id === id ? job : j)) });
      if (!silent) toast({ title: "Saved", description: `${job.name} updated` });
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save job";
      if (!silent) errToast(msg);
      return { ok: false, error: msg };
    }
  },

  runJob: async (id) => {
    // flush any pending (debounced) parameter edits FIRST so the run starts
    // with exactly what the user sees in the form
    try {
      await flushJobParams(id);
    } catch {
      /* flush failure is non-fatal — the run uses the last saved params */
    }
    try {
      const data = await api<{ job: JobDTO; error?: string; waiting?: string }>(`/api/jobs/${id}/run`, {
        method: "POST",
      });
      set({ jobs: get().jobs.map((j) => (j.id === id ? data.job : j)) });
      if (data.waiting) {
        // job went PENDING — an upstream job failed or is still running;
        // not an error, the result line explains what to fix/re-run. It
        // auto-starts the moment the upstream inputs land — no re-click.
        toast({
          title: "Job waiting as pending",
          description:
            (data.job.result ?? "Waiting for its upstream job to produce outputs.") +
            " It starts automatically once ready.",
        });
        // show the waiting reason where the user is looking
        set({ inspectId: id, selectedId: null, selectedIds: [] });
        return false;
      }
      if (data.error) {
        // honest real-engine failure — surfaced via the job result too
        toast({
          title: "Real engine refused to start",
          description: data.error,
          variant: "destructive",
        });
        return false;
      }
      toast({ title: "Job started", description: `${data.job.name} is now running` });
      // CryoSPARC-style: submitting a job opens its inspector page
      set({ inspectId: id, selectedId: null, selectedIds: [] });
      return true;
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to run job");
      return false;
    }
  },

  stopJob: async (id) => {
    try {
      const data = await api<{ job: JobDTO; stopped: boolean; message: string }>(
        `/api/jobs/${id}/stop`,
        { method: "POST" }
      );
      set({ jobs: get().jobs.map((j) => (j.id === id ? data.job : j)) });
      toast({
        title: data.stopped ? "Job stopped" : "Job already idle",
        description: data.message,
      });
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to stop job");
    }
  },

  resetJob: async (id) => {
    try {
      const { job } = await api<{ job: JobDTO }>(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ status: "idle" }),
      });
      set({ jobs: get().jobs.map((j) => (j.id === id ? job : j)) });
      toast({ title: "Job reset", description: `${job.name} returned to idle` });
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to reset job");
    }
  },

  deleteJob: async (id) => {
    // snapshot BEFORE the delete — the toast's Undo action carries the full
    // pre-delete world (job DTO + attached wires) for /api/jobs/restore
    const snapJob = get().jobs.find((j) => j.id === id);
    const snapshot: DeleteSnapshot | null = snapJob
      ? {
          jobs: [snapJob],
          edges: get().edges.filter((e) => e.fromJobId === id || e.toJobId === id),
        }
      : null;
    try {
      await api(`/api/jobs/${id}`, { method: "DELETE" });
      // drop the job from the multi-selection too; when the PRIMARY card is
      // the one going away, promote the first remaining selected card
      const restIds = get().selectedIds.filter((x) => x !== id);
      const primary = get().selectedId === id ? (restIds[0] ?? null) : get().selectedId;
      set({
        jobs: get().jobs.filter((j) => j.id !== id),
        edges: get().edges.filter((e) => e.fromJobId !== id && e.toJobId !== id),
        selectedId: primary,
        selectedIds: primary ? restIds : [],
        inspectId: get().inspectId === id ? null : get().inspectId,
        pendingFrom: get().pendingFrom?.jobId === id ? null : get().pendingFrom,
      });
      toast({
        title: "Job deleted",
        // name the job — "removed from the workflow" said nothing about WHICH
        description: snapJob
          ? `${snapJob.name} removed from the workflow`
          : "Removed from the workflow",
        // wrong-card deletes are the classic slip — the undo window is the
        // safety net the confirm dialog now promises (Task 97)
        duration: 20_000,
        action: snapshot
          ? (React.createElement(
              ToastAction,
              { altText: "Undo the delete", onClick: () => void get().undoDelete(snapshot) },
              "Undo"
            ) as unknown as ToastActionElement)
          : undefined,
      });
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to delete job");
    }
  },

  duplicateJob: async (id) => {
    const src = get().jobs.find((j) => j.id === id);
    if (!src) return;
    const x = clamp(src.x + 48, WORLD_MIN, WORLD_MAX - CARD_W);
    const y = clamp(src.y + 40, WORLD_MIN, WORLD_MAX - CARD_H);
    try {
      const { job } = await api<{ job: JobDTO }>("/api/jobs", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          type: src.type,
          x,
          y,
          name: `${src.name} (copy)`,
          params: src.params,
        }),
      });
      set({
        jobs: [...get().jobs, job],
        selectedId: job.id,
        selectedIds: [job.id],
        inspectId: null,
      });
      toast({
        title: "Job duplicated",
        description: `${job.name} placed beside the original — edit & connect it, then run`,
      });
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to duplicate job");
    }
  },

  connect: async (from, to, fromPort, toPort) => {
    const { edges, jobs } = get();
    if (from === to) return;
    const fromJob = jobs.find((j) => j.id === from);
    const toJob = jobs.find((j) => j.id === to);
    if (fromPort && toPort && fromJob && toJob) {
      if (!portsCompatible(fromJob.type, fromPort, toJob.type, toPort)) {
        toast({
          title: "Port mismatch",
          description: "That output cannot feed this input",
          variant: "destructive",
        });
        return;
      }
    }
    if (
      edges.some(
        (e) => e.fromJobId === from && e.toJobId === to && e.fromPort === fromPort && e.toPort === toPort
      )
    ) {
      toast({ title: "Already connected", description: "That edge already exists" });
      return;
    }
    if (wouldCreateCycle(edges, from, to)) {
      toast({
        title: "Connection refused",
        description: "Would create a cycle",
        variant: "destructive",
      });
      return;
    }
    try {
      const { edge } = await api<{ edge: EdgeDTO }>("/api/edges", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ fromJobId: from, toJobId: to, fromPort, toPort }),
      });
      set({ edges: [...get().edges, edge], pendingFrom: null });
      const fromName = fromJob?.name ?? "Job";
      const toName = toJob?.name ?? "job";
      toast({ title: "Connected", description: `${fromName} → ${toName}` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to connect";
      toast({ title: "Connection refused", description: msg, variant: "destructive" });
    }
  },

  removeEdge: async (id) => {
    try {
      await api(`/api/edges/${id}`, { method: "DELETE" });
      set({ edges: get().edges.filter((e) => e.id !== id) });
      toast({ title: "Edge removed" });
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to remove edge");
    }
  },

  pollTick: async () => {
    // never fight an active card drag with a re-render — the drag loop owns
    // the screen until the pointer goes up
    if (get().dragActive) return;
    // in-flight guard: the 1.2 s interval keeps firing while a slow GET
    // (dev-compile windows, heavy reconcile) is still in the air — without
    // this, overlapping responses can land OUT OF ORDER and a stale jobs
    // array overwrites a fresher one (status flicker / regressions)
    if (pollInFlight) return;
    pollInFlight = true;
    const prev = get().jobs;
    try {
      const { jobs } = await api<{ jobs: JobDTO[] }>("/api/jobs");
      // reference stability: reuse the previous object for every job whose
      // fields did not change (JSON.parse gives brand-new refs each time)
      let changed = prev.length !== jobs.length;
      const merged = prev.length === jobs.length
        ? jobs.map((j, i) => {
            const old = prev[i];
            if (old && old.id === j.id && jobEquals(old, j)) return old;
            changed = true;
            return j;
          })
        : jobs;
      if (!changed) return; // identical tick — zero re-renders
      set({ jobs: merged });
      // announce transitions running → completed / failed, and pending →
      // running (the AUTO-START engine kicked a downstream job once its
      // upstream inputs landed — nobody clicked Run for this)
      for (const job of merged) {
        const before = prev.find((p) => p.id === job.id);
        if (before?.status !== "running") {
          if (before?.status === "pending" && job.status === "running") {
            toast({
              title: `${job.name} auto-started`,
              description: "Upstream inputs became ready — running now",
            });
          }
          continue;
        }
        if (job.status === "completed") {
          toast({
            title: `${job.name} completed`,
            description: job.result ?? undefined,
          });
        } else if (job.status === "failed") {
          toast({
            title: `${job.name} failed`,
            description: job.result ?? undefined,
            variant: "destructive",
          });
        }
      }
    } catch {
      // polling errors are transient — keep the interval alive
    } finally {
      pollInFlight = false;
    }
  },

  select: (id) => set({ selectedId: id, selectedIds: id ? [id] : [] }),

  toggleSelect: (id) => {
    const ids = get().selectedIds;
    if (ids.includes(id)) {
      const rest = ids.filter((x) => x !== id);
      const nextPrimary =
        get().selectedId === id ? (rest[rest.length - 1] ?? null) : get().selectedId;
      set({ selectedIds: rest, selectedId: nextPrimary });
    } else {
      set({ selectedIds: [...ids, id], selectedId: id });
    }
  },

  selectMany: (ids) => {
    const unique = [...new Set(ids)];
    if (unique.length === 0) {
      set({ selectedId: null, selectedIds: [] });
      return;
    }
    const prev = get().selectedId;
    set({
      selectedIds: unique,
      selectedId: prev && unique.includes(prev) ? prev : unique[unique.length - 1],
    });
  },

  selectAll: () => {
    const ws = get().activeWorkspaceId;
    const ids = get().jobs.filter((j) => jobInWorkspace(j, ws)).map((j) => j.id);
    if (ids.length === 0) return;
    const prev = get().selectedId;
    set({
      selectedIds: ids,
      selectedId: prev && ids.includes(prev) ? prev : ids[0],
    });
  },

  deleteSelected: async () => {
    const ws = get().activeWorkspaceId;
    const ids = get().selectedIds.filter((id) =>
      get().jobs.some((j) => j.id === id && jobInWorkspace(j, ws))
    );
    if (ids.length === 0) return;
    // snapshot BEFORE the deletes — only jobs that actually delete are
    // undoable (refused ones never left, they must not be restored)
    const idSet = new Set(ids);
    const snapshot: DeleteSnapshot = {
      jobs: get().jobs.filter((j) => idSet.has(j.id)),
      edges: get().edges.filter((e) => idSet.has(e.fromJobId) || idSet.has(e.toJobId)),
    };
    const results = await Promise.allSettled(
      ids.map((id) => api(`/api/jobs/${id}`, { method: "DELETE" }))
    );
    const deleted = ids.filter((_, i) => results[i].status === "fulfilled");
    const failed = ids.length - deleted.length;
    const deletedSet = new Set(deleted);
    // the undo payload covers the FULFILLED deletions only
    const undoSnapshot: DeleteSnapshot = {
      jobs: snapshot.jobs.filter((j) => deletedSet.has(j.id)),
      edges: snapshot.edges,
    };
    const undoAction = undoSnapshot.jobs.length
      ? (React.createElement(
          ToastAction,
          { altText: "Undo the delete", onClick: () => void get().undoDelete(undoSnapshot) },
          "Undo"
        ) as unknown as ToastActionElement)
      : undefined;
    if (deleted.length > 0) {
      const delSet = new Set(deleted);
      const prevInspect = get().inspectId;
      const prevPending = get().pendingFrom;
      set({
        jobs: get().jobs.filter((j) => !delSet.has(j.id)),
        edges: get().edges.filter((e) => !delSet.has(e.fromJobId) && !delSet.has(e.toJobId)),
        selectedId: null,
        selectedIds: [],
        inspectId: prevInspect != null && delSet.has(prevInspect) ? null : prevInspect,
        pendingFrom: prevPending && delSet.has(prevPending.jobId) ? null : prevPending,
      });
    }
    if (failed > 0) {
      toast({
        title: `Deleted ${deleted.length} · ${failed} refused`,
        description: "Some jobs could not be deleted — they are still on the canvas",
        variant: "destructive",
        duration: 20_000,
        action: undoAction,
      });
    } else {
      toast({
        title: `Deleted ${deleted.length} job${deleted.length === 1 ? "" : "s"}`,
        description:
          deleted.length === 1
            ? "Removed from the workflow"
            : "Removed from the workflow with every wire attached to them",
        duration: 20_000,
        action: undoAction,
      });
    }
  },

  duplicateSelected: async () => {
    const ws = get().activeWorkspaceId;
    const sel = get().jobs.filter(
      (j) => get().selectedIds.includes(j.id) && jobInWorkspace(j, ws) && !j.linkedJobId
    );
    if (sel.length === 0) return;
    const skippedLinks = get().selectedIds.length - sel.length;
    const idSet = new Set(sel.map((j) => j.id));
    try {
      // phase 1 — copy the jobs in parallel (each POST scalar-filters its
      // params against the type schema server-side, same as single add)
      const copies = await Promise.all(
        sel.map((src) =>
          api<{ job: JobDTO }>("/api/jobs", {
            method: "POST",
            headers: JSON_HEADERS,
            body: JSON.stringify({
              type: src.type,
              x: clamp(src.x + 48, WORLD_MIN, WORLD_MAX - CARD_W),
              y: clamp(src.y + 40, WORLD_MIN, WORLD_MAX - CARD_H),
              name: `${src.name} (copy)`,
              params: src.params,
              // copies live where their source lives — the API defaults to
              // the project's first workspace otherwise, which could teleport
              // the copy into a workspace the user never looks at
              workspaceId: src.workspaceId ?? undefined,
            }),
          }).then(({ job }) => ({ srcId: src.id, job }))
        )
      );
      // phase 2 — rewire edges BETWEEN the copies (order needs the full
      // id map, hence the second pass); one bad wire never loses the batch
      const idMap = new Map(copies.map(({ srcId, job }) => [srcId, job.id]));
      const internal = get().edges.filter(
        (e) => idSet.has(e.fromJobId) && idSet.has(e.toJobId)
      );
      const rewired: EdgeDTO[] = [];
      for (const e of internal) {
        const from = idMap.get(e.fromJobId);
        const to = idMap.get(e.toJobId);
        if (!from || !to) continue;
        try {
          const { edge } = await api<{ edge: EdgeDTO }>("/api/edges", {
            method: "POST",
            headers: JSON_HEADERS,
            body: JSON.stringify({
              fromJobId: from,
              toJobId: to,
              fromPort: e.fromPort,
              toPort: e.toPort,
            }),
          });
          rewired.push(edge);
        } catch {
          // skip this wire — the copies still exist and can be wired by hand
        }
      }
      const newJobs = copies.map((c) => c.job);
      set({
        jobs: [...get().jobs, ...newJobs],
        edges: [...get().edges, ...rewired],
        selectedIds: newJobs.map((j) => j.id),
        selectedId: newJobs[newJobs.length - 1]?.id ?? null,
        inspectId: null,
      });
      toast({
        title: `Duplicated ${newJobs.length} job${newJobs.length === 1 ? "" : "s"}`,
        description: [
          internal.length
            ? `${internal.length} internal link${internal.length === 1 ? "" : "s"} rewired between the copies`
            : "no internal links to rewire",
          skippedLinks > 0 ? `${skippedLinks} linked cop${skippedLinks === 1 ? "y" : "ies"} skipped` : null,
          "everything stays idle until you run it",
        ]
          .filter(Boolean)
          .join(" — "),
      });
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to duplicate the selection");
    }
  },

  moveJobsCommit: async (moves) => {
    if (moves.length === 0) return;
    const map = new Map(moves.map((m) => [m.id, m]));
    set({
      jobs: get().jobs.map((j) => {
        const m = map.get(j.id);
        return m ? { ...j, x: m.x, y: m.y } : j;
      }),
    });
    try {
      await api("/api/jobs/layout", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ updates: moves }),
      });
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to save positions");
    }
  },

  alignSelected: (mode) => {
    const ws = get().activeWorkspaceId;
    const sel = get().jobs.filter(
      (j) => get().selectedIds.includes(j.id) && jobInWorkspace(j, ws)
    );
    if (sel.length < 2) return;
    const minX = Math.min(...sel.map((j) => j.x));
    const maxX = Math.max(...sel.map((j) => j.x + CARD_W));
    const minY = Math.min(...sel.map((j) => j.y));
    const maxY = Math.max(...sel.map((j) => j.y + CARD_H));
    const moves = sel.map((j) => {
      let x = j.x;
      let y = j.y;
      if (mode === "left") x = minX;
      else if (mode === "right") x = maxX - CARD_W;
      else if (mode === "hcenter") x = (minX + maxX) / 2 - CARD_W / 2;
      else if (mode === "top") y = minY;
      else if (mode === "bottom") y = maxY - CARD_H;
      else y = (minY + maxY) / 2 - CARD_H / 2;
      return {
        id: j.id,
        x: Math.round(clamp(x, WORLD_MIN, WORLD_MAX - CARD_W)),
        y: Math.round(clamp(y, WORLD_MIN, WORLD_MAX - CARD_H)),
      };
    });
    void get().moveJobsCommit(moves);
    const target: Record<typeof mode, string> = {
      left: "left edges",
      hcenter: "horizontal centers",
      right: "right edges",
      top: "top edges",
      vcenter: "vertical centers",
      bottom: "bottom edges",
    };
    toast({
      title: `Aligned ${sel.length} job${sel.length === 1 ? "" : "s"}`,
      description: `Snapped to a shared line along their ${target[mode]}`,
    });
  },

  distributeSelected: (axis) => {
    const ws = get().activeWorkspaceId;
    const sel = get().jobs.filter(
      (j) => get().selectedIds.includes(j.id) && jobInWorkspace(j, ws)
    );
    if (sel.length < 3) {
      toast({
        title: "Pick at least 3 jobs",
        description: "Distribution needs a first, a middle and a last",
      });
      return;
    }
    const size = axis === "h" ? CARD_W : CARD_H;
    const sorted = [...sel].sort((a, b) => (axis === "h" ? a.x - b.x : a.y - b.y));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const start = axis === "h" ? first.x : first.y;
    const end = (axis === "h" ? last.x : last.y) + size;
    const span = end - start - size * sorted.length;
    if (span <= 0) {
      toast({
        title: "Nothing to distribute",
        description: "The selection is already tighter than its own footprint",
      });
      return;
    }
    const gap = span / (sorted.length - 1);
    let cursor = start;
    const moves = sorted.map((j) => {
      const pos = Math.round(cursor);
      cursor += size + gap;
      return axis === "h" ? { id: j.id, x: pos, y: j.y } : { id: j.id, x: j.x, y: pos };
    });
    void get().moveJobsCommit(moves);
    toast({
      title: `Distributed ${sorted.length} jobs`,
      description: `Even ~${Math.round(gap)}px gaps along the ${
        axis === "h" ? "horizontal" : "vertical"
      } axis — endpoints stay put`,
    });
  },

  inspect: (id) => {
    if (id !== null) {
      // inspector replaces the right-side editing panel
      set({ inspectId: id, selectedId: null });
    } else {
      set({ inspectId: null });
    }
  },
  setView: (view) => set({ view }),
  setPendingFrom: (pending) => set({ pendingFrom: pending }),
  cancelConnect: () => set({ pendingFrom: null }),
  // Every viewport change is remembered under the (project:workspace) key —
  // the canvas' switch effect restores it when the user comes BACK to a
  // workspace instead of always zoom-to-fit (first visit still fits), and
  // the hydrate seed restores it across a reload in the same tab.
  // Tab-session scope only: sessionStorage (debounced — pan is per-frame),
  // never localStorage, closing the tab deliberately burns it.
  setViewport: (patch) =>
    set((s) => {
      const next = {
        ...s.viewport,
        ...patch,
        zoom: clamp(patch.zoom ?? s.viewport.zoom, ZOOM_MIN, ZOOM_MAX),
      };
      const key = `${s.project?.id ?? "-"}:${s.activeWorkspaceId ?? "-"}`;
      const memory = { ...s.viewportMemory, [key]: next };
      scheduleViewportMemoryPersist(memory);
      return { viewport: next, viewportMemory: memory };
    }),
  panBy: (dx, dy) =>
    set((s) => {
      const next = { ...s.viewport, x: s.viewport.x + dx, y: s.viewport.y + dy };
      const key = `${s.project?.id ?? "-"}:${s.activeWorkspaceId ?? "-"}`;
      const memory = { ...s.viewportMemory, [key]: next };
      scheduleViewportMemoryPersist(memory);
      return { viewport: next, viewportMemory: memory };
    }),
  // Bookmark = a named snapshot of the CURRENT viewport for THIS
  // (project:workspace). Explicit user action → synchronous localStorage
  // write is fine (low-frequency); trimmed empty names are refused (the UI
  // disables save, this is the belt to that braces). Same name overwrites
  // AND keeps its hotkey seat — the slot is part of the bookmark's
  // identity, re-saving a view must not silently move its key (Task 101).
  saveViewportBookmark: (name) => {
    const trimmed = name.trim().slice(0, 60);
    if (!trimmed) return false;
    set((s) => {
      const key = `${s.project?.id ?? "-"}:${s.activeWorkspaceId ?? "-"}`;
      const existing = s.viewportBookmarks[key]?.[trimmed];
      const slot = existing ? existing.slot : lowestFreeSlot(s.viewportBookmarks[key] ?? {});
      const forWs = {
        ...(s.viewportBookmarks[key] ?? {}),
        [trimmed]: { viewport: { ...s.viewport }, slot },
      };
      const bookmarks = { ...s.viewportBookmarks, [key]: forWs };
      persistViewportBookmarks(bookmarks);
      return { viewportBookmarks: bookmarks };
    });
    return true;
  },
  deleteViewportBookmark: (name) =>
    set((s) => {
      const key = `${s.project?.id ?? "-"}:${s.activeWorkspaceId ?? "-"}`;
      const forWs = { ...(s.viewportBookmarks[key] ?? {}) };
      delete forWs[name];
      const bookmarks = { ...s.viewportBookmarks };
      if (Object.keys(forWs).length > 0) bookmarks[key] = forWs;
      else delete bookmarks[key];
      persistViewportBookmarks(bookmarks);
      return { viewportBookmarks: bookmarks };
    }),
  jumpToViewportBookmark: (slot) => {
    // key derivation mirrors save/delete EXACTLY — one rule, four sites.
    // The jump lands via setViewport, so the jump is also written through
    // to the session memory ("where I am now") and zoom clamps to range.
    const s = get();
    const key = `${s.project?.id ?? "-"}:${s.activeWorkspaceId ?? "-"}`;
    const named = s.viewportBookmarks[key];
    if (!named) return false;
    const hit = Object.values(named).find((b) => b.slot === slot);
    if (!hit) return false;
    s.setViewport(hit.viewport);
    return true;
  },
  setDragActive: (active) => set({ dragActive: active }),
  setPaletteDrag: (type) => set({ paletteDrag: type }),
  requestClassFocus: (jobId, cls) => set({ pendingClassFocus: { jobId, cls } }),
  consumeClassFocus: () => set({ pendingClassFocus: null }),
  setTemplatePresetsOpen: (open) => set({ templatePresetsOpen: open }),
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
  toggleNoteSpotlight: () => set((s) => ({ noteSpotlight: !s.noteSpotlight })),

  openImportPreview: (entries, failures) =>
    set({ importPreview: { entries, failures } }),
  closeImportPreview: () => set({ importPreview: null }),

  focusJob: (id) =>
    set((s) => ({
      focusJobId: id,
      focusEpoch: s.focusEpoch + 1,
      // the modal would cover the canvas — close it so the user sees the focus
      inspectId: null,
    })),
}));

/* ------------------------------------------------------------------ */
/* Workspace-scoped derivations (shared by canvas, minimap, KPI bar)    */
/* ------------------------------------------------------------------ */

/**
 * Jobs of the ACTIVE workspace (reference-stable across polls — the store's
 * jobs array keeps unchanged object refs, so this memo survives poll ticks
 * and memoized cards keep skipping re-renders).
 */
export function useActiveWorkspaceJobs(): JobDTO[] {
  const jobs = useWorkflowStore((s) => s.jobs);
  const activeWorkspaceId = useWorkflowStore((s) => s.activeWorkspaceId);
  return React.useMemo(
    () =>
      activeWorkspaceId == null
        ? jobs
        : jobs.filter((j) => (j.workspaceId ?? "") === activeWorkspaceId),
    [jobs, activeWorkspaceId]
  );
}

/** Edges whose BOTH endpoints live in the active workspace (the render rule:
 *  a wire only draws where both of its jobs are visible — cross-workspace
 *  data flow goes through linked copies instead). */
export function useActiveWorkspaceEdges(): EdgeDTO[] {
  const edges = useWorkflowStore((s) => s.edges);
  const jobs = useWorkflowStore((s) => s.jobs);
  const activeWorkspaceId = useWorkflowStore((s) => s.activeWorkspaceId);
  return React.useMemo(() => {
    if (activeWorkspaceId == null) return edges;
    const visible = new Set(
      jobs.filter((j) => (j.workspaceId ?? "") === activeWorkspaceId).map((j) => j.id)
    );
    return edges.filter((e) => visible.has(e.fromJobId) && visible.has(e.toJobId));
  }, [edges, jobs, activeWorkspaceId]);
}

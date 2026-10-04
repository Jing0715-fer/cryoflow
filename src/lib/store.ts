"use client";

/**
 * CryoFlow — global workflow state (zustand).
 */

import * as React from "react";
import { create } from "zustand";
import { toast, type ToastActionElement } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { CARD_W, CARD_H, WORLD_MIN, WORLD_MAX, ZOOM_MAX, ZOOM_MIN, jobType, portsCompatible, nextStepsFor } from "./workflow";
import {
  upstreamEdgesOf,
  faithfulWires,
  withoutAutoEdge,
  extractClassSelection,
  twinSpot,
} from "./duplicate-run";
import { describeAdoption, planAdoption } from "./adopt-branch";
import { findStaleJobs, type StaleReport } from "./staleness";
import { findDriftedJobs, type DriftReport } from "./params-drift";
import { twinName, twinNamesFor } from "./twin-name";
import {
  INHERITED_PREFIX,
  describeSubtreeRun,
  handoffReceiptSentence,
  orchGuardSentence,
  planSubtreeRun,
  resumeFrontierReason,
  resumeScan,
  resumeToastDescription,
  resumeToastTitle,
  stopReceiptSentence,
  type SubtreeNode,
  type SubtreeOrchState,
} from "./subtree-run";
import {
  ORCH_HB_MS,
  claimSubtreeOrch,
  clearSubtreeOrch,
  heartbeatSubtreeOrch,
  importLegacySubtreeOrch,
  readSubtreeOrch,
  saveSubtreeOrch,
  saveSubtreeOrchIfOwner,
} from "./subtree-orch-session";
import { getTabId } from "./tab-identity";
import { autoLayout } from "./layout";
import { formatElapsed } from "./elapsed";
import type {
  CustomTemplatePayload,
  CustomTemplateSummary,
  EdgeDTO,
  JobDTO,
  JobStatus,
  ParamValue,
  ProjectDTO,
  ProjectSummaryDTO,
  SystemStatusClient,
  TemplateOverrides,
  WorkspaceDTO,
} from "./types";
import type { ImportFailure, ImportPreviewEntry } from "./workflow-io";
import type { TemplateSuggestion } from "./template-suggest";
import type { SessionSweepState } from "./qc-report";
import type { RemoteRunTarget } from "@/lib/remote/types";
import { suggestTemplateConnections } from "./template-suggest";
import {
  buildTemplateBundle,
  buildTemplateFile,
  downloadTemplateBundleJson,
  downloadTemplateJson,
  parseTemplateFiles,
  templateBundleFileName,
  templateFileName,
} from "./template-io";

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

/** localStorage key for the PIPELINE KPI FOLD (Task 153). The fold is a
 *  SPATIAL preference — the user reclaimed canvas from an overlay whose
 *  width grows with the world (Task 143 forensics) — and a reload must
 *  not un-reclaim it: every reload re-running the Task 143 occlusion
 *  the user already fixed is the same bug served daily. It persists
 *  alongside the dashboard sort and the export scale (the
 *  view-preference family), NOT with the find lens (whose contract IS
 *  to close clean). Writes only happen on the explicit chevron action
 *  — never per-frame, Task 13 #13 stays retired. */
const KPI_COLLAPSED_KEY = "cryoflow.kpiCollapsed.v1";
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

/** Seed the KPI fold from localStorage (cross-session, Task 153). Only
 *  the exact string "true" arms the fold — anything else (missing,
 *  "false", corrupt, hand-edited) falls back to the expanded default:
 *  the honest unknown is the unfolded bar, which hides nothing. */
function hydrateKpiCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(KPI_COLLAPSED_KEY);
    if (raw === "true") return true;
    return false;
  } catch {
    return false;
  }
}

/** Persist the KPI fold on the explicit chevron action (Task 153).
 *  Storage stays an echo of user intent, not of render state — a
 *  hydration that merely READ the seed writes nothing back. */
function persistKpiCollapsed(collapsed: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KPI_COLLAPSED_KEY, String(collapsed));
  } catch {
    // private mode / quota — the fold stays in-RAM for this session
  }
}

const SELECTED_JOB_KEY = "cryoflow.selectedJob.v1";

/** Read the session-position seed (Task 157). Reads only — no format
 *  whitelist can name a job id, so the seed stays a BARE string and the
 *  real trust gate is the apply step in load(): a seed that does not
 *  resolve to a job on the active canvas is ignored. The honest unknown
 *  is "no selection", never a crash. */
function hydrateSelectedJob(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SELECTED_JOB_KEY);
    if (raw == null) return null;
    const trimmed = raw.trim();
    return trimmed === "" ? null : trimmed;
  } catch {
    return null;
  }
}

/** Echo a committed selection transition to storage (Task 157). The
 *  two-way door writes the honest none as an EMPTY STRING rather than
 *  deleting: "explicitly deselected" is a fact about the user's session,
 *  and absence must not be misread by a future hydration as "never
 *  selected". Corrupt/garbage values are pointless to police here — the
 *  apply gate in load() drops anything that resolves to no job. */
function persistSelectedJob(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SELECTED_JOB_KEY, id ?? "");
  } catch {
    // private mode / quota — the position stays in-RAM for this session
  }
}

const ACTIVE_WS_KEY = "cryoflow.activeWorkspace.v1";

/** Read the workspace-position seed (Task 159). The selection (Task 157)
 *  is only HALF of "where you were": the canvas you stood on is the other
 *  half, and it used to be forgotten on every reload — boot always landed
 *  on the project's first workspace, which ALSO silently defeated the
 *  selection seed whenever the selected job lived elsewhere (its trust
 *  gate resolves against the booted canvas). Same shape as the selection
 *  seed: a BARE string, reads only — no format whitelist can name a
 *  workspace id, so the real trust gate is the apply step in load(): a
 *  seed that does not resolve to a workspace of THIS project is ignored. */
function hydrateActiveWorkspace(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_WS_KEY);
    if (raw == null) return null;
    const trimmed = raw.trim();
    return trimmed === "" ? null : trimmed;
  } catch {
    return null;
  }
}

/** Echo a committed workspace transition to storage (Task 159). The echo
 *  lives at the GESTURES that move the user — switchWorkspace (the funnel
 *  every tab/palette/jump path goes through) plus the three set() sites
 *  that relocate the canvas as part of a user action (link-copy, import
 *  auto-switch, undo's step back). Boot landing and fallbacks stay
 *  SILENT: a fresh boot writes nothing (Task 157's negative oracle), and
 *  a stale seed — the workspace was deleted, or the user last worked in
 *  another project — fails the apply gate and honestly lands on the
 *  first workspace. Empty string, not a delete: same two-way door. */
function persistActiveWorkspace(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVE_WS_KEY, id ?? "");
  } catch {
    // private mode / quota — the position stays in-RAM for this session
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

/**
 * t452 — the free-slot walk to the RIGHT of a source card (the
 * addLinkedStep pitch, extracted so the compare dialog's exclude verb can
 * mint its filter in the same visual grammar): first column to the right,
 * walk down, then the next column over; a dense neighborhood falls back
 * below-right and lets the user drag. World-bounded on every axis.
 */
function placeRightOf(src: { x: number; y: number }, jobs: { x: number; y: number }[]): { x: number; y: number } {
  const occupied = (px: number, py: number) =>
    jobs.some((j) => px < j.x + CARD_W && px + CARD_W > j.x && py < j.y + CARD_H && py + CARD_H > j.y);
  const strideX = CARD_W + 100; // layout.ts pitch (GAP_X)
  const strideY = CARD_H + 48; // layout.ts pitch (GAP_Y)
  const clampW = (v: number) => Math.min(Math.max(v, WORLD_MIN), WORLD_MAX - CARD_W);
  const clampH = (v: number) => Math.min(Math.max(v, WORLD_MIN), WORLD_MAX - CARD_H);
  for (let col = 0; col < 3; col++) {
    for (let row = 0; row < 8; row++) {
      const px = clampW(src.x + (col + 1) * strideX);
      const py = clampH(src.y + row * strideY);
      if (!occupied(px, py)) return { x: px, y: py };
    }
  }
  return { x: clampW(src.x + strideX), y: clampH(src.y + 8 * strideY) };
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

/** Parse a raw v2 payload (the exact string localStorage holds) into the
 *  bookmark map. The SINGLE parse path for both boot hydrate and the
 *  cross-tab storage listener — two parse implementations would drift,
 *  and a bookmark trusted by one tab must be trusted by every tab. */
function parseViewportBookmarksRaw(
  raw: string | null
): Record<string, Record<string, ViewportBookmark>> {
  if (!raw) return {};
  try {
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
  } catch {
    return {};
  }
}

/** Seed the bookmarks from localStorage (cross-session, see key doc).
 *  Reads v2; if only the v1 pre-slot format exists, migrates it: slots
 *  are assigned by stored key order (insertion order — the best guess
 *  available), capped at nine, then v2 is written and v1 removed. */
function hydrateViewportBookmarks(): Record<string, Record<string, ViewportBookmark>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(VIEWPORT_BOOKMARKS_KEY);
    if (raw) return parseViewportBookmarksRaw(raw);
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

/** One user-initiated, server-synced workflow mutation with its faithful
 *  inverse (Task 104). The delete toast's Undo closure (Task 97) pioneered
 *  the pattern — the history stack generalizes it: each entry captures the
 *  before/after DTOs it needs and performs its own server sync, so undo and
 *  redo survive toast expiry, workspace switches and poll merges.
 *  Only mutations whose inverse is id-stable qualify: position commits
 *  (PATCH by job id) and deletes (restore re-creates rows VERBATIM).
 *  Adds and edge edits churn server-generated ids — they stay outside the
 *  stack and kill the redo branch instead (invalidateRedo). */
export type HistoryEntryKind = "move" | "tidy" | "delete";

export interface HistoryEntry {
  label: string;
  /** Task 125 — what the mutation WAS, set at every push site; the history
   *  panel icons and groups rows by this instead of parsing display labels
   *  (the label is prose for humans, kind is structure for views). */
  kind: HistoryEntryKind;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

/** Linear stack depth. 50 entries of before/after position maps and delete
 *  snapshots are bytes; the cap exists so an all-day session can never
 *  grow it unbounded. */
const HISTORY_CAP = 50;

interface WorkflowState {
  jobs: JobDTO[];
  /** t393 — the last-seen /api/jobs version token. pollTick sends it as
   *  ?v= and an unmoved canvas answers {unchanged:true} (~40 bytes) — the
   *  no-op heartbeats (idle 8s, hidden tab 15s, the gaps between progress
   *  steps at 1.2s) stop re-paying the serialization/wire/parse/merge
   *  chain for an array that did not move. Maintained by load() and
   *  pollTick (the two full-list ingests); optimistic flows leave it
   *  stale ON PURPOSE — their server write flips the version, so the
   *  very next tick goes full and re-syncs. Hashed per project id
   *  server-side, so a project switch can never alias another project's
   *  token. */
  jobsVersion: string | null;
  edges: EdgeDTO[];
  project: ProjectDTO | null;
  /** All projects (for the project management panel). */
  projects: ProjectSummaryDTO[];
  /** Workspaces of the ACTIVE project (sidebar tab + header switcher). */
  workspaces: WorkspaceDTO[];
  /** Canvas filter: only jobs of this workspace render. Null while loading.
   *  Task 159: the booted value is the session POSITION — the canvas the
   *  user closed the tab on is restored once at the first landing (gated
   *  on resolving to a workspace of this project), and gestures that move
   *  the user echo it to storage. */
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
   *  operate on the whole set. Task 157: the primary is also the session
   *  POSITION — it outlives the reload (boot restores it once, on the
   *  first data landing, gated by the canvas's own membership rule) and
   *  every committed transition echoes it to storage (module tail). */
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
  /** The session's LAST HPC sweep (t197): the session QC report binds it
   *  verbatim. One slot — a finished race replaces the previous one
   *  wholesale; a race that never started writes nothing. In-memory by
   *  design: a race is session state, a reload is a new session, and the
   *  report's empty state says exactly that. */
  lastSweep: SessionSweepState | null;
  setLastSweep: (s: SessionSweepState | null) => void;
  consumeClassFocus: () => void;
  /** SPA template presets dialog open (triggered from the canvas empty
   *  state, the command palette or the help popover — mounted once). */
  templatePresetsOpen: boolean;
  /** Task 129 — wires proposed after a template apply: the applied body
   *  lands as an island; these pair its free boundary inputs with
   *  same-workspace donors' free outputs (pure engine in
   *  lib/template-suggest.ts). The chip renders them ONLY for the
   *  workspace the apply landed in; any navigation clears them. */
  templateSuggestions: { workspaceId: string; items: TemplateSuggestion[] } | null;
  /** Wire every suggestion through POST /api/edges (the manual drag's
   *  endpoint — the server re-validates each pair); surviving edges
   *  merge, refusals drop, one aggregate toast. */
  applyTemplateSuggestions: (items: TemplateSuggestion[]) => Promise<void>;
  dismissTemplateSuggestions: () => void;
  /** Task 127 — user-saved sub-pipeline snippets (project-scoped). The
   *  list lives in the store so the presets dialog, the selection toolbar
   *  and future entry points all read one source; save/apply/delete keep
   *  it in sync server-first. */
  customTemplates: CustomTemplateSummary[];
  loadCustomTemplates: () => Promise<void>;
  /** Snapshot the current selection (types / relative positions / params
   *  + internal wires) into a named reusable template. */
  saveSelectionTemplate: (name: string) => Promise<boolean>;
  /** Re-instantiate a saved snippet below the active workspace's content. */
  applyCustomTemplate: (id: string) => Promise<boolean>;
  deleteCustomTemplate: (id: string) => Promise<void>;
  /** Task 128 — download a saved template as a cryoflow-template/1 .json
   *  file (the share leg of save → apply → share). */
  exportCustomTemplate: (id: string) => Promise<boolean>;
  /** Task 132 — rename a shelf row (PATCH ?id=); the payload and the
   *  shelf's reading order stay untouched. Resolves false on failure
   *  (row stays editable for a retry). */
  renameCustomTemplate: (id: string, name: string) => Promise<boolean>;
  /** Task 130 — download EVERY template on the shelf as ONE bundle file
   *  (cryoflow-template-bundle/1); returns false when the shelf is empty
   *  or the fetch failed. */
  exportAllCustomTemplates: () => Promise<boolean>;
  /** Task 130 — forget every template in the project (the clear-shelf
   *  leg). Optimistic clear + rollback on failure; resolves to the
   *  deleted count (0 when nothing was removed). */
  clearCustomTemplates: () => Promise<number>;
  /** Task 128 — import shared template files into this project's shelf:
   *  client pre-parse (template-io) → authoritative POST per entry →
   *  aggregate toast. Returns { imported, failed } for callers/tests. */
  importCustomTemplateFiles: (
    files: File[]
  ) => Promise<{ imported: number; failed: number; firstError?: string }>;
  /** Keyboard-shortcuts dialog ("?" anywhere, the help popover, or the
   *  command palette) — single source of truth so all three entries stay
   *  in sync. */
  shortcutsOpen: boolean;
  /** t482 — the full help guide dialog: the popover stays the canvas
   *  quick start, the guide carries the whole manual (one source, two
   *  doors: the popover CTA and the command palette). */
  helpGuideOpen: boolean;
  /** t419 — the AI assistant panel (right Sheet): open state + the
   *  one-shot pending prompt (the class gallery's "AI 分析" button opens
   *  the panel WITH a question — consumed once by the panel, never
   *  observed twice; same contract as pendingClassFocus). In-memory by
   *  design: a chat panel is a session surface, not a document property. */
  aiAssistantOpen: boolean;
  setAiAssistantOpen: (open: boolean) => void;
  aiPendingPrompt: string | null;
  /** t503 — the summon sequence. Every openAiAssistant() call bumps it,
  *  even when the window is ALREADY open: the header door must always
  *  visibly answer. The panel re-raises itself (moves its portal to the
  *  front of body) on every bump — the user's bug was the buried
  *  assistant (a dialog that opened later stacked above it) where the
  *  button's set({open: true}) was a no-op and nothing surfaced. */
  aiSummonSeq: number;
  /** Open the assistant, optionally carrying a question to send immediately. */
  openAiAssistant: (prompt?: string) => void;
  /** One-shot: returns the pending prompt and clears it. */
  consumeAiPendingPrompt: () => string | null;
  /** t419 — pull the server's edge truth into the store. The assistant
   *  creates wires SERVER-SIDE (its tools run in the API route), and the
   *  poll only refreshes jobs — without this the canvas would not show
   *  AI-drawn wires until a reload. */
  refreshEdges: () => Promise<void>;
  /** t419 — the AI provider settings dialog (gear inside the assistant,
   *  or the panel's needs-setup banner). */
  aiSettingsOpen: boolean;
  setAiSettingsOpen: (open: boolean) => void;
  /** Task 105 — world-overview minimap visibility (bottom-right corner).
   *  Session-local by design: a collapsed tool is a UI mood, not a user
   *  asset — default open on every fresh session keeps the map discover-
   *  able and keeps localStorage free of yet another key. */
  minimapOpen: boolean;
  setMinimapOpen: (open: boolean) => void;
  /** Note spotlight (Task 75; three-tier stage since Task 164) — when
   *  true, canvas cards WITHOUT a human judgment recede so the
   *  scientist's annotations (job notes, Task 73; class notes,
   *  Task 80/83) jump out at a glance. The recession is tiered: cards
   *  ONE edge away from a judged card hold a lighter context tier (the
   *  pipeline that fed — or was fed by — the judged work stays
   *  readable), everything beyond that 1-hop radius takes the deep
   *  dim; wires touching a judged card keep full ink (edges-layer).
   *  "Judgment" = hasJudgment in lib/class-notes.ts — the same predicate
   *  the header chip count and the dashboard Noted filter read. In-memory
   *  only, like the selection: the spotlight is
   *  a viewing lens, not a document property — nobody expects "which cards
   *  were dimmed last session" to survive a reload. Toggled from the
   *  header chip, the command palette, or the N key. */
  noteSpotlight: boolean;
  /** Task 134 — canvas find bar (Ctrl/⌘+F). Two ephemeral fields:
   *  whether the floating find bar is open, and the live query typed
   *  into it. Matching cards ring amber; everything else recedes with
   *  the same dim the note spotlight uses; Enter/Shift+Enter cycle the
   *  viewport through matches via focusJob (arrival flash included).
   *  In-memory only, like the selection and the spotlight: a find is a
   *  viewing lens over the CURRENT canvas, not a document property —
   *  closing the bar clears the query, and nobody expects a stale
   *  highlight to survive a reload. Deliberately NOT in the undo
   *  history: nothing on the canvas changed. */
  findOpen: boolean;
  findQuery: string;
  /** Task 135 — the status half of the find lens: "all" (no filter) or
   *  one JobStatus the matches must carry. Orthogonal to the text query:
   *  with a query it narrows those matches, alone it IS the lens ("show
   *  me every running job"). Same ephemerality as the query — closing
   *  the bar resets it, nothing enters undo or storage. */
  findStatus: JobStatus | "all";
  /** Task 138 — the type half of the find lens: "all" or one palette
   *  category key (workflow stage: motion / ctf / refine / …) the match's
   *  job type must belong to. Third orthogonal dimension — text ∧ status
   *  ∧ stage combine, none overrides another. Chips only surface the
   *  categories actually present in the workspace; a stage that doesn't
   *  exist can't be a filter. Same ephemerality as findStatus. */
  findCategory: string | "all";
  /** Task 144 — whether the floating pipeline-KPI bar is folded into its
   *  compact pill (completion ring + count + the live runner chip). The
   *  bar is a lawful overlay, but its width grows with the world (live
   *  particle counts, resolution pills) and a boot-fit canvas can hide a
   *  whole card under it (Task 143 forensics) — the fold is the user's
   *  way to reclaim the canvas without losing the glance.
   *  Task 153 — the fold is a SPATIAL preference, not lens state: it
   *  outlives the reload (hydrated from localStorage at boot, persisted
   *  on the explicit chevron action) so a reclaimed canvas stays
   *  reclaimed. Never enters undo; the find lens stays ephemeral — its
   *  contract is to close clean, the fold's contract is to stay put. */
  kpiCollapsed: boolean;
  /** t444 — the staleness wavefront, derived in the STORE (not the
   *  canvas render): one findStaleJobs per jobs/edges commit, via the
   *  post-commit subscription at the module tail. Cards subscribe to
   *  their own slice (stable object refs between commits) — the update
   *  reaches each card through zustand's useSyncExternalStore channel,
   *  immune to the canvas render path's memo/deferral bailouts. */
  staleMap: StaleReport;
  /** t445 — the recipe drift verdict, same channel as the wavefront:
   *  one findDriftedJobs per jobs commit, post-commit at the module
   *  tail; cards read their own slice through the subscription (the
   *  canvas render path's memo/deferral bailouts never see it). */
  driftMap: DriftReport;
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
  createProject: (input: { name: string; mode: string; remoteConnectionId?: string | null }) => Promise<boolean>;
  renameProject: (id: string, name: string) => Promise<boolean>;
  deleteProject: (id: string) => Promise<boolean>;
  /** POST /api/projects/[id]/duplicate — clone as a RERUN-READY TEMPLATE:
   *  params/notes/coordinates/wiring carried, statuses reset to idle,
   *  soft links severed, active pointer untouched. Full load() after, so
   *  the card wall + KPIs move in the same frame as the toast. */
  duplicateProject: (id: string) => Promise<boolean>;
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
  /** t383 — the card context menu's "Add next step…" quick action: create
   *  a job of `type` placed in the free slot to the RIGHT of `sourceId`
   *  (same workspace), auto-wired through the first compatible port pair.
   *  One toast tells the whole story; the new card lands selected and
   *  focused so the "quick" in quick action is literal. */
  addLinkedStep: (sourceId: string, type: string) => Promise<void>;
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
  /** t478 — the storage drawer's restore door: the grave's OWN server-side
   *  row snapshot feeds the restore (job_id in, no client-built body), the
   *  restored ids leave the client tombstone filter (the t370 law), and a
   *  full load() re-draws the canvas. Returns a user-facing line either
   *  way — the drawer renders it, never invents one. */
  restoreFromGraveyard: (jobId: string) => Promise<{ ok: boolean; message: string }>;
  /** Task 104 — linear history. In-memory only: a reload starts a fresh
   *  history by design (the same honesty as the per-tab viewport memory —
   *  an undo stack that survives reload would resurrect state the user
   *  may have left deliberately). */
  historyPast: HistoryEntry[];
  historyFuture: HistoryEntry[];
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  /** Task 106 — batch jumps for the history panel: run n undos/redos
   *  SEQUENTIALLY (each awaits its server sync — two concurrent PATCH/\n   *  restore round-trips would race the optimistic job maps) and stop
   *  early if the stack empties. Silent by design: the panel's live rows
   *  are the feedback surface, a toast per step would be noise. */
  undoSteps: (n: number) => Promise<void>;
  redoSteps: (n: number) => Promise<void>;
  /** The delete toasts' Undo button runs its OWN entry, not the stack top:
   *  after later mutations the linear stack has branched, and a buried
   *  entry must be undone out-of-band with the divergent tail discarded. */
  undoEntry: (entry: HistoryEntry) => Promise<void>;
  /** Any user mutation without a faithful inverse (add / duplicate /
   *  import / edge edit) kills the redo branch — redo is only valid
   *  immediately after undos, before new work diverges the world. */
  invalidateRedo: () => void;
  /** Server-cascade delete + local cleanup with NO toasts and NO history —
   *  the shared core of user deletes (single + bulk) and history redo
   *  (Task 104). Returns the ids whose DELETE round-tripped. */
  removeJobsRaw: (
    ids: string[],
    opts?: { keepSelection?: boolean }
  ) => Promise<{ deleted: string[]; error: string | null }>;
  setTemplatePresetsOpen: (open: boolean) => void;
  setShortcutsOpen: (open: boolean) => void;
  setHelpGuideOpen: (open: boolean) => void;
  toggleNoteSpotlight: () => void;
  /** Task 134 — open the find bar (Ctrl/⌘+F, command palette, or the
   *  toolbar button). Opening focuses the input (the bar owns that
   *  effect); reopening while open is a no-op so the shortcut is
   *  idempotent rather than a toggle (Ctrl+F twice ≠ close). */
  openFind: () => void;
  /** Close the bar and CLEAR the query — an ephemeral lens leaves no
   *  residue; reopening starts fresh like the browser's own find. */
  closeFind: () => void;
  setFindQuery: (q: string) => void;
  /** Task 135 — set/clear the status filter of the find lens. */
  setFindStatus: (s: JobStatus | "all") => void;
  /** Task 138 — arm/disarm the type-half lens (palette category key or
   *  "all"). Radio semantics live in the chip row; the store just holds
   *  the armed key. */
  setFindCategory: (c: string | "all") => void;
  /** Task 144 — fold/unfold the pipeline KPI bar (explicit chevron on
   *  the bar itself; no hover-expansion surprises). */
  setKpiCollapsed: (c: boolean) => void;
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
  /**
   * POST /run — start (or restart) a job. A BARE call (no opts) rides the
   * route's t317 project-binding fallback: in a remote-bound project the
   * job dispatches to the cluster (the toast says so via the response's
   * runRemote). opts.local === true is the EXPLICIT local door (the panel's
   * ▾ "Run on this machine") — it meets the engine's honest cluster-resident
   * refusal instead of spawning through the WSL bridge.
   */
  runJob: (id: string, opts?: { local?: boolean; quiet?: boolean }) => Promise<boolean>;
  /** POST /run with { remote } — dispatch the job to an SSH cluster
   *  connection (module load relion/x, direct nohup run). Same response
   *  dialect as runJob (409 busy kinds, waiting/staging, honest engine
   *  errors) with cluster-flavored toasts. */
  runJobRemote: (id: string, target: RemoteRunTarget, opts?: { quiet?: boolean }) => Promise<boolean>;
  /** t448 — the wavefront's verb: re-run this job and every DOWNSTREAM
   *  node in topological order, one node at a time — each dispatch lands
   *  (terminal status) before the next fires, so a child never starts
   *  inside its parent's churn. `target` null = local lane. Stops at the
   *  first refusal; the receipt names the frontier. */
  runSubtree: (rootId: string, target: RemoteRunTarget | null) => Promise<boolean>;
  /** t449 — the verb's face: the live walk the strip renders (run order,
   *  progress counter, stop request). Exactly one at a time; null when
   *  idle. The loop mirrors its progress into this state so the face
   *  renders from truth, not from closure memory. */
  subtreeOrch: SubtreeOrchState | null;
  /** t449 — the stop verb: request the walk to halt BEFORE the next
   *  dispatch. The job now running finishes on its own; the receipt
   *  counts what re-ran. A request on an idle world is a no-op. */
  stopSubtreeRun: () => void;
  /** t450 — the walk's second breath: re-enter a walk whose record
   *  survived the reload. Consumes the record once, scans the live world
   *  against the persisted order (completed nodes count, missing nodes
   *  are named and skipped, a failed node is the frontier, an armed stop
   *  dispatches nothing) and continues the walk with the SAME cluster
   *  target. Silent when no record exists.
   *  t451 — the record lives in the workspace's shared memory now: the
   *  claim law (one walk, one heir) arbitrates — this tab's own record
   *  resumes instantly; a dead owner's walk is ADOPTED (claimed, then
   *  resurrected by the same world-truth scan); a LIVE owner's walk is
   *  left alone (silent — the walk is on another tab's face). */
  resumeSubtreeOrch: () => Promise<void>;
  /** POST /stop — SIGTERM→SIGKILL the job's process tree; re-run resumes
   *  refine-family jobs from their checkpoint via RELION --continue. */
  stopJob: (id: string) => Promise<void>;
  resetJob: (id: string) => Promise<void>;
  /** t447 — rename a job (PATCH name); cosmetic, history-free, optimistic
   *  with a surgical rollback (only this job's name reverts — a poll that
   *  landed mid-flight keeps its updates). Returns false when refused. */
  renameJob: (id: string, name: string) => Promise<boolean>;
  deleteJob: (id: string) => Promise<void>;
  /** Clone a run as a fresh idle draft — t442: the twin inherits the
   *  params AND the upstream wiring (a parallel branch, not a bare
   *  template), sits in the free slot of the column to the right, and
   *  waits unstarted for the user's edits (the POST never dispatches).
   *  opts.openInspector lands the user in the twin's own editor — the
   *  A/B loop's first stop. */
  duplicateJob: (id: string, opts?: { openInspector?: boolean }) => Promise<void>;
  /** t443 — branch adoption: the A/B verdict's verb. Re-wires every
   *  downstream wire of `fromRunId` to start at `toRunId` instead — the
   *  children stop consuming the loser and start consuming the winner
   *  in ONE gesture (one optimistic set, one receipt toast; statuses
   *  stay — the receipt carries the re-run duty). Refusals (cycles,
   *  port mismatches) and already-wired children are reported, never
   *  silently folded. */
  adoptDownstream: (fromRunId: string, toRunId: string) => Promise<void>;
  /** t452 — the verdict's consumer face (「把输家微图喂给 exclude 清单」,
   *  the t439 leftover): mints an Exclude Micrographs job consuming
   * `toRunId` with `names` baked into its param, then re-wires
   * `fromRunId`'s downstream onto the FILTER (adoption with an
   * intermediate stop). One gesture, one receipt — the graph shows the
   * verdict as wiring, not as a memory. */
  adoptWithExclude: (fromRunId: string, toRunId: string, names: string[]) => Promise<void>;
  /** t453 — the class verdict's consumer verb: mints a 2D Class
   *  Selection consuming `toRunId` with the gained class numbers baked
   *  into `selectedClasses` (the list the dialog spoke IS the selection
   *  the engine makes), wires BOTH of the selection's mouths (class
   *  averages + classified particles) from `toRunId`'s outputs, then
   *  re-wires `fromRunId`'s downstream onto the SELECTION. Port pairs
   *  are found by kind, never assumed: a host missing a mouth refuses
   *  honestly before anything is minted. */
  adoptWithSelect: (fromRunId: string, toRunId: string, classNumbers: number[]) => Promise<void>;
  /** t558 — the Topaz train→pick handoff: mint an Auto-picking job in
   *  Topaz mode with the training's own dials carried over, wire the
   *  trained model into it, and inherit the training job's micrographs
   *  source. The engine's "connect into Auto-picking (Topaz mode)"
   *  receipt becomes a button instead of a manual wiring chore. */
  pickWithTopazModel: (fromJobId: string) => Promise<void>;
  /** t559 — the denoise→pick handoff (the gesture family's second cut):
   *  mint an Auto-picking job in Topaz mode wired to the denoised stack
   *  itself — the official topaz flow runs denoise → pick on the SAME
   *  images, and the denoised star keeps the micrograph schema so the
   *  pick consumes it unchanged. The general Topaz model picks it until
   *  a trained one exists. */
  pickWithDenoisedStack: (fromJobId: string) => Promise<void>;
  connect: (
    from: string,
    to: string,
    fromPort?: string,
    toPort?: string,
    /** t442 — quiet mode: duplication wires N edges in one gesture and
     *  the receipt belongs to the DUPLICATION toast (t146's aggregate
     *  law), not to N per-wire announcements. Errors still speak. */
    opts?: { quiet?: boolean }
  ) => Promise<void>;
  removeEdge: (id: string) => Promise<void>;
  pollTick: () => Promise<void>;

  select: (id: string | null) => void;
  /** Shift-click toggle: add/remove a card from the multi-selection (the
   *  toggled card becomes primary when it joins; leaving promotes the
   *  last remaining card to primary). */
  toggleSelect: (id: string) => void;
  /** Arrow-key graph navigation (Task 103): land the anchor on `id`.
   *  Plain arrow REPLACES the selection with the target; Shift+Arrow adds
   *  the target and promotes it to primary (walking a chain grows the
   *  selection). Unlike toggleSelect this never removes — re-visiting an
   *  already-selected card just re-anchors on it. */
  stepArrowFocus: (id: string, extend: boolean) => void;
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
  moveJobsCommit: (
    moves: { id: string; x: number; y: number }[],
    opts?: { history?: boolean }
  ) => Promise<void>;
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
  /** Task 124 — one-click arrival from the dashboard surfaces (timeline rows,
   *  ladder chips): canvas view + selection + centered viewport in one
   *  semantic. Deliberately NOT the deep-link "open" dialect (idle→select /
   *  submitted→inspect): reveal is about WHERE the job is, not opening its
   *  editors — and focusJob's inspectId-clear keeps the two honest apart. */
  revealJob: (id: string) => void;
  /** Task 126 — the ONE deep-link landing every dashboard card shares
   *  (spotlight rows, recent activity, saved-view gallery, palette jump).
   *  Three jobs in order: ghost guard; landing repair; then the open
   *  dialect — idle → select + focus (centered arrival with the params
   *  panel), submitted → results inspector. focusJob clears inspectId by
   *  design, so the inspector branch must NOT call it (same contract as
   *  the palette's jumpToJob).
   *
   *  The guard and the repair have a CROSS-PROJECT leg the store can't see
   *  alone: jobs in the store belong to the ACTIVE project, so a
   *  recent-activity or gallery row pointing at another project will not
   *  be found here — that is not a ghost, it is a landing request. Callers
   *  that own the row's home project pass it as the hint; with a hint the
   *  action switches projects first and re-reads the job from the fresh
   *  load (switchProject lands on the project's FIRST workspace, so the
   *  home-workspace hop happens AFTER the await). Without a hint a missing
   *  id stays a ghost — same-project callers (spotlight, palette) never
   *  need the switch. */
  openJob: (
    id: string,
    hint?: { projectId?: string | null }
  ) => Promise<void>;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    // t359 — carry the HTTP status ON the thrown error (the message
    // contract is unchanged). The optimistic wire flows below need to tell
    // "already persisted by an earlier attempt" (409) and "already gone
    // server-side" (404) apart from real failures.
    const err = new Error(data?.error ?? `Request failed (${res.status})`) as Error & {
      status?: number;
    };
    err.status = res.status;
    throw err;
  }
  return data;
}

// t407 — the boot race, witnessed live: on a box where the dev server can
// die mid-compile (the 4GB OOM regime — t405/t406), a first-visit route can
// answer with a KILLED CONNECTION instead of a status code, and load()'s
// bare `.catch` fallbacks then boot the app with an EMPTY projects or
// workspaces list — the palette's Projects group silently vanishes, the
// project panel shows nothing, and NOTHING retries (pollTick only polls
// /api/jobs), so the state persists until the user manually reloads. The
// suite-side doctrine (t310's fetchSteady, the healer's connection-layer
// retries) now lands in the product: apiSteady retries ONLY the connection
// layer — fetch's own voice for "never reached the server / the server died
// mid-flight" is a TypeError; an HTTP error status (carried on Error.status
// by api) is an honest answer from a live server and is NEVER retried.
async function apiSteady<T>(url: string, attempts = 3): Promise<T> {
  let lastErr: unknown = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await api<T>(url);
    } catch (err) {
      if (err instanceof TypeError) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, 1200 * (i + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastErr ?? new Error("apiSteady: unreachable");
}

/**
 * t359 — optimistic wire bookkeeping (see connect/removeEdge).
 *
 * `unconfirmedEdges` — client-minted edge ids whose POST /api/edges is
 * still in the air. A removeEdge() on one of them must NOT fire a DELETE
 * (the row does not exist yet — the 404 would look like success while the
 * in-flight POST is about to resurrect the wire as a ghost the UI no
 * longer shows); instead the id is marked doomed and the POST's landing
 * path fires the DELETE itself, when the row is real.
 * `doomedCreates` — exactly those marked ids.
 */
const unconfirmedEdges = new Set<string>();
const doomedCreates = new Set<string>();

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

/** Task 157 — the session-position seed applies ONCE per page load. A
 *  later load() (the manual reload button re-runs it) must never fight
 *  the user's LIVE selection by re-imposing an old boot seed: after the
 *  first application the seed is spent, and reloads preserve whatever is
 *  selected right now. */
let selectionSeedApplied = false;

/** Task 159 — same once-per-page-load rule for the workspace seed: the
 *  first landing folds it into the active workspace, later load()s keep
 *  whatever canvas the user is on right now. */
let wsSeedApplied = false;

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
 *  memo'd edge layer) skips re-rendering — polls become zero-cost.
 *  Exported for the t432 bench — the predicate IS the contract (a field
 *  missing here is a stale-UI bug, so the bench pins the real function,
 *  never a copy). */
export function jobEquals(a: JobDTO, b: JobDTO): boolean {
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
    a.note === b.note && // Task 164: judged-ness flows from this field — the header count, the lens tiers and the dashboard chip all read it; a poll that swallowed a note change would freeze all three (updatedAt happens to bump on every PATCH today, but the equality predicate must not DEPEND on that courtesy)
    a.engine === b.engine &&
    a.hasLog === b.hasLog &&
    (a.workspaceId ?? null) === (b.workspaceId ?? null) &&
    (a.linkedJobId ?? null) === (b.linkedJobId ?? null) &&
    (a.linkedName ?? null) === (b.linkedName ?? null) &&
    (a.linkCount ?? 0) === (b.linkCount ?? 0) &&
    JSON.stringify(a.params) === JSON.stringify(b.params) &&
    // t431 — the homecoming annotation is COMPUTED per response, not
    // stored: a bring-home flips it WITHOUT touching the row (updatedAt
    // never moves), so the equality predicate must compare it explicitly
    // or the reference-stability merge swallows the flip and the canvas
    // keeps the stale "home" chip forever.
    JSON.stringify(a.remoteRemaining ?? null) ===
      JSON.stringify(b.remoteRemaining ?? null) &&
    // t432 — runRemote rides the same contract class: it is projected from
    // the runs LEDGER per response (remoteInfoFor), not from the DB row,
    // and three of its mutations land with NO compared-field movement:
    // ① staging grows stagedBytes per file while the row sits at running/0
    //   (the panel host line would freeze its "Staging inputs… X MB" meter),
    // ② slurmState flips PENDING→RUNNING before the first RELION log write
    //   PATCHes progress (the inspector's "Queued on the cluster" banner
    //   would stay long after sbatch actually started),
    // ③ a bring-home rewrites ledger note/syncedFiles/syncMs without
    //   touching the row at all (t429 proved updatedAt never moves) — the
    //   panel's stay note would keep the stale receipt forever.
    // Every projected field is UI-consumed (host line, slurm strip, stay
    // note) and none is a per-poll heartbeat (outputProbeAt never rides the
    // DTO), so a whole-object compare costs nothing in render churn.
    JSON.stringify(a.runRemote ?? null) === JSON.stringify(b.runRemote ?? null)
  );
}

function errToast(msg: string) {
  toast({ title: "Something went wrong", description: msg, variant: "destructive" });
}

/* ------------------------------------------------------------------ */
/* Position-write in-flight guard (t383)                                */
/* ------------------------------------------------------------------ */

/**
 * The delayed-drag race, convicted: moveJobCommit/applyLayout set the
 * optimistic position locally and PATCH in the background, but a poll GET
 * that STARTED before the PATCH lands AFTER the optimistic set — its
 * response still carries the OLD x/y, the reference-stability merge takes
 * the server object wholesale, and the card snaps BACK to its pre-drag
 * spot until the NEXT poll finally shows the persisted position. Drag a
 * card, watch it rubber-band; auto-arrange, watch the tidy layout flicker
 * apart then reassemble. On a dev server (route compiles stretch the GET
 * window to seconds) this reads as "拖动/排版延时生效".
 *
 * Two windows, two guards (an in-flight hold alone has a hole: a poll that
 * outlives the PATCH's confirmation still carries stale coordinates):
 *
 *  1. IN-FLIGHT — from the optimistic set until the request settles, the
 *     job id is refcount-held in `posWritesInFlight`; a response landing
 *     while the hold is live can never be fresher than the local truth.
 *  2. GENERATION — every CONFIRMED write bumps `posWriteGen` for its ids.
 *     A poll snapshots the generation when it STARTS; when its response
 *     lands, any job whose generation has advanced since the snapshot
 *     predates the latest confirmed write → local x/y wins. Protection
 *     ends exactly when a poll that started AFTER the confirmation lands
 *     (its snapshot equals the current generation — its data is fresh).
 *
 * A FAILED write bumps nothing and releases its hold, so the next poll
 * re-syncs to the server truth — the pre-t383 behavior, with the error
 * toast already speaking for it.
 */
const posWritesInFlight = new Map<string, number>(); // id → refcount
const posWriteGen = new Map<string, number>(); // id → gen of last CONFIRMED write

/** Hold the local position of `ids` while their write is in the air. */
function holdPositions(ids: string[]): () => void {
  for (const id of ids) posWritesInFlight.set(id, (posWritesInFlight.get(id) ?? 0) + 1);
  let released = false;
  return () => {
    if (released) return; // idempotent — a double release must not steal a sibling write's hold
    released = true;
    for (const id of ids) {
      const n = (posWritesInFlight.get(id) ?? 1) - 1;
      if (n <= 0) posWritesInFlight.delete(id);
      else posWritesInFlight.set(id, n);
    }
  };
}

/** Mark `ids`' positions as freshly persisted — stale polls now yield. */
function confirmPositions(ids: string[]): void {
  for (const id of ids) posWriteGen.set(id, (posWriteGen.get(id) ?? 0) + 1);
}

/** Snapshot the generation BEFORE a fetch — the response's freshness seal. */
function snapshotPosGen(): Map<string, number> {
  return new Map(posWriteGen);
}

/**
 * Stamp the newest local positions over a fetched job list wherever the
 * response cannot be trusted to know them yet: the write is still in the
 * air, or it confirmed after `genStart` was taken (this response started
 * before the confirmation). Reads the LIVE store — a re-drag during the
 * fetch window is the truth, not the first drag's optimistic value.
 */
function preserveHeldPositions<T extends { id: string; x: number; y: number }>(
  fetched: T[],
  genStart: Map<string, number>
): T[] {
  if (posWritesInFlight.size === 0 && posWriteGen.size === 0) return fetched;
  const live = useWorkflowStore.getState().jobs;
  const byId = new Map(live.map((j) => [j.id, j] as const));
  return fetched.map((j) => {
    const genMoved = (posWriteGen.get(j.id) ?? 0) > (genStart.get(j.id) ?? 0);
    if (!posWritesInFlight.has(j.id) && !genMoved) return j;
    const local = byId.get(j.id);
    if (!local || (local.x === j.x && local.y === j.y)) return j;
    return { ...j, x: local.x, y: local.y };
  });
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

/**
 * t448 — the subtree orchestration's landing wait. The world's own 1.2s
 * pollTick keeps the store's jobs fresh; this helper rides that channel
 * (zero extra fetches) and resolves the moment the node reaches ANY
 * non-churn status — completed, failed, idle (a stop is a landing too:
 * the user intervened, the orchestration must not fight them). The
 * per-node budget is generous (real cluster jobs legitimately run long);
 * the timeout's status reads as still-churning so the frontier receipt
 * says the truth: the node never landed, the rest did not re-run.
 */
const SUBTREE_POLL_MS = 1200;
const SUBTREE_NODE_BUDGET_MS = 20 * 60 * 1000;

async function awaitSubtreeTerminal(id: string): Promise<{ status: string; timedOut: boolean }> {
  const deadline = Date.now() + SUBTREE_NODE_BUDGET_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, SUBTREE_POLL_MS));
    const j = useWorkflowStore.getState().jobs.find((x) => x.id === id);
    const status = j?.status ?? "unknown";
    if (status !== "pending" && status !== "running") {
      return { status, timedOut: false };
    }
  }
  return { status: "running", timedOut: true };
}

/**
 * t450 — the walk executor, shared by both entrances. runSubtree enters
 * it with a fresh plan (startIndex 0); resumeSubtreeOrch enters it with
 * the persisted plan from the world's own scan (startIndex = the first
 * live non-completed node). The loop itself is entrance-agnostic:
 * dispatch → wait terminal → next, the stop checkpoint lands BETWEEN
 * nodes, every index bump mirrors into the state AND the session record
 * (the record is what a reload resurrects), and the try/finally retires
 * the face and the record on every exit — whatever the ending.
 *
 * t451 — the walk's inheritance. While this tab walks, it owns the
 * shared record and pings it every ORCH_HB_MS (the heartbeat is what
 * tells a sibling tab this owner is alive). Three inheritance laws
 * join the loop:
 *   - the abdication checkpoint: BETWEEN nodes, before any dispatch —
 *     if the record's owner moved (a sibling claimed while this tab
 *     slept), the walker stands down with a hand-off receipt; the walk
 *     itself continues on the heir's face;
 *   - the mirror save is owner-conditional — a dispossessed walker's
 *     older progress must never overwrite the heir's record;
 *   - the exit's clear is owner-conditional (inside clearSubtreeOrch)
 *     — a dead walk retires its own record, never the heir's claim.
 */
async function walkSubtreeNodes(
  order: readonly SubtreeNode[],
  startIndex: number,
  initialDone: number,
  target: RemoteRunTarget | null,
  opts?: { firstNodeAwaitOnly?: boolean }
): Promise<{
  done: number;
  total: number;
  userStopped: boolean;
  handedOff: boolean;
  frontier: { name: string; reason: string } | null;
}> {
  const total = order.length;
  let done = initialDone;
  let userStopped = false;
  let handedOff = false;
  let frontier: { name: string; reason: string } | null = null;
  // the owner's pulse: while this tab walks it pings the shared record
  // every ORCH_HB_MS — silence past ORCH_STALE_MS is exactly what lets
  // a sibling tab know the owner died
  const hb = setInterval(() => {
    heartbeatSubtreeOrch();
  }, ORCH_HB_MS);
  try {
    for (let i = startIndex; i < order.length; i++) {
      const node = order[i];
      // the stop verb's checkpoint: the request lands BETWEEN nodes —
      // the job now running finishes on its own; the next never fires.
      // A stop asked during a run that then FAILS never reaches here —
      // the frontier receipt speaks for the failure instead.
      if (useWorkflowStore.getState().subtreeOrch?.stopRequested) {
        userStopped = true;
        break;
      }
      // t451 — the abdication checkpoint: the record's owner moved
      // while this tab waited (a sibling claimed after the heartbeat
      // went stale — background throttling, a dead closure the tab
      // never noticed). Standing down IS the graceful branch: the
      // heir's walk continues; this tab's receipt says so. Without it
      // two walkers would race the next dispatch and the loser would
      // die on the per-job 409 door with a lying frontier line.
      const rec = readSubtreeOrch();
      if (rec && rec.owner !== getTabId()) {
        handedOff = true;
        break;
      }
      // t450 — a resumed walk whose resume node is mid-flight (the
      // in-flight dispatch SURVIVED the reload on the cluster side)
      // must AWAIT it, never re-dispatch it: a second dispatch under a
      // live run is refused by the 409 already-live door — caught live
      // in the first resurrection fire. Await-only goes straight to the
      // landing wait; the stop checkpoint above still applies first.
      const firstNodeAwaitOnly = i === startIndex && opts?.firstNodeAwaitOnly === true;
      let accepted = firstNodeAwaitOnly;
      if (!firstNodeAwaitOnly) {
        // quiet lanes: the per-node send doors stay silent (no toast, no
        // camera steering) — the orchestration's ONE receipt speaks for the
        // whole gesture (t146 aggregation law)
        try {
          accepted = target
            ? await useWorkflowStore.getState().runJobRemote(node.id, target, { quiet: true })
            : await useWorkflowStore.getState().runJob(node.id, { local: true, quiet: true });
        } catch (err) {
          frontier = {
            name: node.name,
            reason: err instanceof Error ? err.message : "its lane refused the dispatch",
          };
          break;
        }
        if (!accepted) {
          const j = useWorkflowStore.getState().jobs.find((x) => x.id === node.id);
          frontier = {
            name: node.name,
            reason: j?.result?.slice(0, 140) || "its lane refused the dispatch",
          };
          break;
        }
      }
      // the landing law: a child never starts inside its parent's churn —
      // wait for THIS node's terminal state before the next dispatch
      const landed = await awaitSubtreeTerminal(node.id);
      if (landed.status !== "completed") {
        frontier = {
          name: node.name,
          reason: landed.timedOut
            ? "still running after 20 min — the subtree stopped waiting; its downstream did not re-run"
            : landed.status === "failed"
              ? "the run failed"
              : `stopped while ${landed.status}`,
        };
        break;
      }
      done += 1;
      // the face renders from state, not closure memory — mirror the
      // counter into the store AND the session record (the record is
      // what a reload resurrects; a stale index would re-dispatch landed
      // nodes — harmless under the scan, but the face would lie).
      // t451 — the mirror save is owner-conditional: if a sibling tab
      // claimed the walk while this tab awaited the landing, this
      // walker's older progress must never overwrite the heir's record;
      // the abdication checkpoint above retires the walker next loop.
      const orch = useWorkflowStore.getState().subtreeOrch;
      if (orch) {
        const next = { ...orch, index: done };
        useWorkflowStore.setState({ subtreeOrch: next });
        saveSubtreeOrchIfOwner(next, target);
      }
    }
  } finally {
    clearInterval(hb);
    // every exit retires the face AND the record — the walk is over,
    // whatever its ending; a dead walk must never resurrect.
    // clearSubtreeOrch is owner-conditional (t451): a dispossessed
    // walker's exit must never erase the heir's fresh claim.
    useWorkflowStore.setState({ subtreeOrch: null });
    clearSubtreeOrch();
  }
  return { done, total, userStopped, handedOff, frontier };
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

/**
 * t370 — client-side TOMBSTONES for freshly deleted jobs. The field
 * report: delete a job while a same-type job is being created and the
 * deleted card vanishes → REAPPEARS → vanishes again. pollInFlight above
 * only stops OVERLAPPING client fetches; it cannot stop a GET /api/jobs
 * that STARTED before the DELETE committed from landing AFTER it — that
 * response still lists the deleted job, the reference-stability merge
 * re-adds it (the card reappears), and the NEXT poll removes it again
 * (the card vanishes: the flicker). Every id that leaves the canvas
 * through a server-confirmed DELETE (removeJobsRaw — single, bulk, redo
 * — plus the import-undo lane) is recorded here for TOMBSTONE_TTL_MS and
 * filtered out of EVERY full server-list ingest (pollTick's merge,
 * load()'s replacement). The TTL is the honesty valve: a poll response
 * older than 15s can no longer have been in flight when the delete
 * committed, so a server that STILL returns the id after that is telling
 * the truth (a delete that failed server-side despite the 200) and the
 * tombstone must not become a censor. undoDelete clears the ids it
 * restores, so an intentional comeback is never filtered.
 */
const recentlyDeletedJobs = new Map<string, number>();
const TOMBSTONE_TTL_MS = 15_000;

/** t370 — record ids whose DELETE just succeeded. Refreshes the
 *  timestamp on a repeat: a redo re-deletes, and the new delete deserves
 *  a fresh window of its own. */
function tombstoneJobIds(ids: Iterable<string>): void {
  const now = Date.now();
  for (const id of ids) recentlyDeletedJobs.set(id, now);
}

/** t370 — the restore path's half of the contract: ids coming back on
 *  PURPOSE (undoDelete → /api/jobs/restore) leave the tombstone
 *  immediately, or the next poll's filter would eat the cards the
 *  restore just put back on the canvas. */
function reviveJobIds(ids: Iterable<string>): void {
  for (const id of ids) recentlyDeletedJobs.delete(id);
}

/** t370 — the ingest filter: drop tombstoned ids from a FULL server
 *  jobs list before it replaces or merges into the store. Expired
 *  entries are pruned here so the TTL check rides every ingest (a
 *  tombstone can never outlive its truth window, even when pollTick is
 *  on the hidden-tab 15s cadence). The array is returned AS-IS when
 *  nothing is tombstoned — the common path stays zero-cost. */
function withoutResurrectedJobs<T extends { id: string }>(jobs: T[]): T[] {
  if (recentlyDeletedJobs.size === 0) return jobs;
  const now = Date.now();
  for (const [id, at] of recentlyDeletedJobs) {
    if (now - at > TOMBSTONE_TTL_MS) recentlyDeletedJobs.delete(id);
  }
  if (recentlyDeletedJobs.size === 0) return jobs;
  return jobs.filter((j) => !recentlyDeletedJobs.has(j.id));
}

/** Task 145 — the fact suffix for completion announcements: how long the
 *  job ran before it finished (or died). The announcement is the moment
 *  the elapsed fact becomes final — the same formatElapsed dialect the
 *  card, footer, roster and tab already speak, now on the toast. A job
 *  with no startedAt (the never-engine-backed fixture shape) gets NO
 *  suffix: formatElapsed would honestly clamp NaN to "0s", but "ran for
 *  0s" is a lie of precision — the honest form of "unknown" is silence
 *  (无起点无读数, the t142 doctrine, now at announcement level). Clock
 *  skew (startedAt in the future) reads as silence too, never backwards. */
const announceElapsed = (job: JobDTO): string => {
  if (!job.startedAt) return "";
  const ms = Date.now() - new Date(job.startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  return ` · ${formatElapsed(ms)}`;
};

/** Task 149 — the announcement's destination resolver, shared by the
 *  View bridge and every digest roster line. The door opens into the
 *  RIGHT world: a finisher in workspace B announced while the user sits
 *  in A must switch the lens before opening the inspector, or the
 *  inspector names a card the canvas doesn't show. */
const announceNavigate = (get: () => WorkflowState, jobId: string) => {
  const job = get().jobs.find((j) => j.id === jobId);
  if (job?.workspaceId && get().activeWorkspaceId !== job.workspaceId) {
    get().switchWorkspace(job.workspaceId);
  }
  get().setView("canvas");
  get().inspect(jobId);
};

/** Task 145 — the announcement's one-tap follow-up: jump straight into
 *  the finished job's inspector. The toast is transient; the action is
 *  the bridge from hearing the news to reading the results. */
const announceViewAction = (get: () => WorkflowState, jobId: string, name: string): ToastActionElement =>
  React.createElement(
    ToastAction,
    {
      altText: `Open ${name}'s results`,
      onClick: () => announceNavigate(get, jobId),
    },
    "View"
  ) as unknown as ToastActionElement;

/** Task 151 — the alarm hands you a direct road. A failed job's news
 *  already carries a View bridge (go read what happened); the Retry
 *  bridge beside it starts the rerun immediately (startJob IS a legal
 *  restart for a failed job — only linked copies and live processes are
 *  refused). Reading first is the careful path, retrying is the
 *  impatient one — the alarm offers both, View left (read), Retry right
 *  (act, nearest the edge). The rerun's own toast ("Job started" or the
 *  engine's honest refusal) arrives right after and takes the slot —
 *  the news flow moves on, as it always does. */
const announceRetryAction = (get: () => WorkflowState, jobId: string, name: string): ToastActionElement =>
  React.createElement(
    ToastAction,
    {
      altText: `Retry ${name}`,
      onClick: () => {
        void get().runJob(jobId);
      },
    },
    "Retry"
  ) as unknown as ToastActionElement;

/** Task 149 — the digest roster becomes a directory of doors. Task 146's
 *  ruling stands: the digest as a WHOLE has no single destination, so it
 *  carries no View bridge. But each roster LINE names exactly one job —
 *  a line click has exactly one destination, so every line is its own
 *  door (the summary is not a door; it is the foyer with the directory).
 *  The "… and N more" tail is a census line, not a name — it stays
 *  inert. Buttons get a quiet hover tint, a pressed state, and a
 *  keyboard-visible focus ring that follows the toast's variant (the
 *  destructive digest's doors glow white on rose, not ink on rose). */
const announceRoster = (
  get: () => WorkflowState,
  shown: Array<{ job: JobDTO; text: string }>,
  tail?: string,
) =>
  React.createElement(
    React.Fragment,
    null,
    shown.map(({ job, text }, i) =>
      React.createElement(
        "span",
        { key: i, className: "block" },
        React.createElement(
          "button",
          {
            type: "button",
            onClick: () => announceNavigate(get, job.id),
            "aria-label": `Open ${job.name}`,
            className:
              "-mx-2 -my-0.5 block w-full cursor-pointer rounded px-2 py-0.5 text-left transition-colors hover:bg-foreground/10 active:bg-foreground/15 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring group-[.destructive]:hover:bg-white/15 group-[.destructive]:active:bg-white/20 group-[.destructive]:focus-visible:ring-white/70 motion-reduce:transition-none",
          },
          text,
        ),
      ),
    ),
    tail ? React.createElement("span", { className: "block" }, tail) : null,
  );

/** Task 150 — the kickoff's causal line. The engine's auto-start IS the
 *  edges table (autoStartPendingDownstream BFS-es downstream over the
 *  very same wires the canvas draws), so the announcement can NAME the
 *  upstream by reading the data the cause was written in. The direct
 *  cause wins: an upstream that finished in THIS sweep is why this job
 *  started; otherwise an upstream whose status already reads completed
 *  (the auto-start premise — inputs ready means upstream done). If
 *  nothing verifiable is found, return null and the notice falls back
 *  to its generic line. The announcement never guesses: a named cause
 *  the data cannot back is a lie with a name in it. */
const kickoffUpstream = (
  get: () => WorkflowState,
  jobId: string,
  merged: JobDTO[],
  finishedIds: Set<string>,
): string | null => {
  const inbound = get().edges.filter((e) => e.toJobId === jobId);
  const byId = (id: string) => merged.find((j) => j.id === id);
  const justNow = inbound
    .map((e) => byId(e.fromJobId))
    .find((j) => j && finishedIds.has(j.id));
  if (justNow) return justNow.name;
  const done = inbound
    .map((e) => byId(e.fromJobId))
    .find((j) => j?.status === "completed");
  return done ? done.name : null;
};

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  jobs: [],
  edges: [],
  staleMap: new Map(),
  driftMap: new Map(),
  project: null,
  projects: [],
  workspaces: [],
  activeWorkspaceId: null,
  view: "canvas",
  system: null,
  systemRefreshing: false,
  subtreeOrch: null,
  selectedId: null,
  selectedIds: [],
  inspectId: null,
  historyPast: [],
  historyFuture: [],
  pendingFrom: null,
  viewport: { x: 0, y: 0, zoom: 1 },
  viewportMemory: hydrateViewportMemory(),
  viewportBookmarks: hydrateViewportBookmarks(),
  paletteDrag: null,
  layoutEpoch: 0,
  focusJobId: null,
  pendingClassFocus: null,
  lastSweep: null,
  focusEpoch: 0,
  templatePresetsOpen: false,
  templateSuggestions: null,
  customTemplates: [],
  shortcutsOpen: false,
  helpGuideOpen: false,
  aiAssistantOpen: false,
  aiPendingPrompt: null,
  aiSummonSeq: 0,
  aiSettingsOpen: false,
  minimapOpen: true,
  noteSpotlight: false,
  findOpen: false,
  findQuery: "",
  findStatus: "all",
  findCategory: "all",
  kpiCollapsed: hydrateKpiCollapsed(),
  importPreview: null,
  loading: true,
  error: null,
  dragActive: false,
  jobsVersion: null,

  load: async () => {
    set({ loading: true, error: null });
    // t383 — the load's freshness seal, taken before the fetches: a
    // position write that confirms while these GETs are in the air must
    // not be clobbered by this load's (older) snapshot
    const loadGenStart = snapshotPosGen();
    try {
      const [p, j, e, sys, projs, ws] = await Promise.all([
        api<{ project: ProjectDTO | null }>("/api/project"),
        // t393 — the version token lands with the boot's full pull (load
        // never sends ?v= — the first poll after boot rides this token)
        api<{ jobs: JobDTO[]; version?: string }>("/api/jobs"),
        api<{ edges: EdgeDTO[] }>("/api/edges"),
        apiSteady<SystemStatusClient>("/api/system").catch(() => null),
        // t407 — the boot-race branches: these low-frequency routes carry the
        // coldest first compiles, so on the OOM regime their first boot is the
        // one most likely to meet a server that dies mid-compile. apiSteady
        // retries the connection layer before the catch fallback may speak.
        apiSteady<{ projects: ProjectSummaryDTO[] }>("/api/projects").catch(() => ({ projects: [] })),
        apiSteady<{ workspaces: WorkspaceDTO[] }>("/api/workspaces").catch(() => ({ workspaces: [] })),
      ]);
      // keep the current workspace when it still exists (e.g. project-level
      // reloads), otherwise land on the project's first workspace
      const currentWs = get().activeWorkspaceId;
      const wsList = ws.workspaces;
      let activeWs =
        currentWs && wsList.some((w) => w.id === currentWs)
          ? currentWs
          : (wsList[0]?.id ?? null);
      // Task 159 — the workspace is the other half of the session
      // position: the canvas you closed the tab on is where you reopen.
      // The seed applies ONCE at the first landing, and the trust gate is
      // reality itself: it must resolve to a workspace in THIS project's
      // list — deleted workspace, other project, hand-edited garbage all
      // resolve nowhere, and the honest unknown is the first workspace.
      // Folding it in BEFORE the set() (and before the selection seed
      // below) is what makes the Task 157 gate resolve against the
      // RESTORED canvas — a selection in the second workspace used to be
      // silently defeated by booting on the first.
      if (!wsSeedApplied) {
        wsSeedApplied = true;
        const wsSeed = hydrateActiveWorkspace();
        const seedWs = wsSeed ? wsList.find((w) => w.id === wsSeed) : null;
        if (seedWs) activeWs = seedWs.id;
      }
      // t370 — the second full-list ingest (besides pollTick): load()
      // replaces the whole jobs array, and it runs at moments that can
      // sit INSIDE a delete's tombstone window (boot, the manual reload
      // button, project switch/create/duplicate). The same filter keeps
      // a stale response (or a server that lost the delete) from
      // resurrecting a card the user just removed; the seed lookup below
      // reads the filtered list so a tombstoned id cannot win the
      // selection either.
      const landedJobs = preserveHeldPositions(
        withoutResurrectedJobs(j.jobs),
        loadGenStart
      );
      set({
        project: p.project ?? null,
        jobs: landedJobs,
        // t393 — adopt the boot pull's token (a project switch's load is
        // the one ingest that can move the canvas to a DIFFERENT project's
        // data — the token must turn over here so the next pollTick
        // compares against the right project's version)
        jobsVersion: j.version ?? null,
        edges: e.edges,
        system: sys,
        projects: projs.projects,
        workspaces: wsList,
        activeWorkspaceId: activeWs,
        loading: false,
      });
      // Task 157 — session position: the FIRST data landing may restore
      // the selection the user closed the tab with. The seed is a bare
      // string, so the trust gate is reality itself: it applies only if
      // it resolves to a job ON THIS CANVAS — the same jobInWorkspace
      // predicate the canvas renders by (Bug #33's lesson: visibility
      // and selection must agree). A seed that resolves nowhere —
      // deleted job, another workspace, hand-edited garbage — is
      // ignored: the honest unknown is no selection, and this boot
      // writes nothing to storage either way.
      if (!selectionSeedApplied) {
        selectionSeedApplied = true;
        const seed = hydrateSelectedJob();
        // t370 — the seed resolves against the FILTERED list (see
        // landedJobs): a just-deleted id the stale response still carries
        // must not steal the selection
        const seedJob = seed
          ? landedJobs.find((x) => x.id === seed && jobInWorkspace(x, activeWs))
          : null;
        if (seedJob) set({ selectedId: seedJob.id, selectedIds: [seedJob.id] });
      }
      // RELION status came from the SAVED detection — the server is
      // re-verifying in the background; poll until the fresh probe lands so
      // the chip upgrades automatically (no re-detect click needed).
      if (sys?.fromCache) void pollSystemUntilFresh();
      // t450 — the walk's second breath: the world's truth is in the store,
      // the session record (if any) may now resurrect its walk. Fire and
      // forget — the walk manages its own receipts from here.
      void get().resumeSubtreeOrch();
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
    // Task 159: this is the funnel every switch gesture goes through
    // (sidebar rows, header switcher, command palette, jump bridges) —
    // the echo lives HERE once, not at each caller. The early return
    // above keeps it a real-transition echo (真变化才写).
    persistActiveWorkspace(id);
    // leaving the old canvas: clear selection/pending wire so the new
    // workspace doesn't start with stale state from the previous one
    // (Task 129: apply-suggestions belong to the workspace they landed in)
    set({
      activeWorkspaceId: id,
      selectedId: null,
      selectedIds: [],
      pendingFrom: null,
      templateSuggestions: null,
    });
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
      // Task 159: the canvas follows the link's destination — a user
      // action that moves the user, so the position echoes too
      persistActiveWorkspace(workspaceId);
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
        templateSuggestions: null, // suggestions are workspace-born, never cross projects
        viewport: { x: 0, y: 0, zoom: 1 },
        // Task 159: deliberately SILENT — no echo here. The stale seed
        // (the old project's workspace) fails the apply gate against the
        // next project's list, and switching BACK to this project finds
        // the seed intact: the per-project position survives the round
        // trip for free, gated by reality at every boot.
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
        // engine is always the real RELION one — no field needed anymore;
        // t300 — remoteConnectionId binds the project's DATA to a saved
        // cluster (remote project: browse + run on that cluster)
        body: JSON.stringify({
          name: input.name,
          mode: input.mode,
          ...(input.remoteConnectionId ? { remoteConnectionId: input.remoteConnectionId } : {}),
        }),
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

  duplicateProject: async (id) => {
    try {
      const res = await api<{
        ok: boolean;
        project: { id: string; name: string };
        counts: { workspaces: number; jobs: number; edges: number };
      }>(`/api/projects/${id}/duplicate`, { method: "POST" });
      await get().load();
      toast({
        title: "Project duplicated",
        description: `${res.project.name} · ${res.counts.jobs} jobs, ${res.counts.edges} edges (reset to idle)`,
      });
      return true;
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to duplicate project");
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
      // a fresh card has no faithful inverse (recreating it would mint a
      // new id) — the redo branch dies here (Task 104)
      get().invalidateRedo();
      toast({
        title: "Job added",
        description: `${job.name} placed on the canvas`,
      });
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to add job");
    }
  },

  addLinkedStep: async (sourceId, type) => {
    const s = get();
    const src = s.jobs.find((j) => j.id === sourceId);
    const specT = jobType(type);
    if (!src || !specT) {
      errToast("That job is gone — refresh and try again");
      return;
    }
    // the wire: first compatible port pair (evaluated against the source's
    // LIVE params, so an Import set to Movies wires movies → MotionCorr,
    // never a micrographs port that isn't there)
    const step = nextStepsFor(src.type, src.params).find((x) => x.type === type);
    if (!step) {
      errToast(`${specT.label} cannot consume this job's outputs`);
      return;
    }
    // placement: the column to the RIGHT of the source card (RELION's
    // visual grammar — pipelines flow left→right), first free slot walking
    // DOWN, then the next column over; same pitch as auto-arrange so the
    // result looks tidied, and world-bounded on every axis
    const occupied = (px: number, py: number) =>
      get().jobs.some(
        (j) =>
          px < j.x + CARD_W && px + CARD_W > j.x && py < j.y + CARD_H && py + CARD_H > j.y
      );
    const strideX = CARD_W + 100; // layout.ts pitch (GAP_X)
    const strideY = CARD_H + 48; // layout.ts pitch (GAP_Y)
    const clampW = (v: number) => Math.min(Math.max(v, WORLD_MIN), WORLD_MAX - CARD_W);
    const clampH = (v: number) => Math.min(Math.max(v, WORLD_MIN), WORLD_MAX - CARD_H);
    let x = 0;
    let y = 0;
    let found = false;
    for (let col = 0; col < 3 && !found; col++) {
      for (let row = 0; row < 8 && !found; row++) {
        const px = clampW(src.x + (col + 1) * strideX);
        const py = clampH(src.y + row * strideY);
        if (!occupied(px, py)) {
          x = px;
          y = py;
          found = true;
        }
      }
    }
    if (!found) {
      // dense neighborhood — fall back to below-right and let the user drag
      x = clampW(src.x + strideX);
      y = clampH(src.y + 8 * strideY);
    }
    try {
      const { job } = await api<{ job: JobDTO }>("/api/jobs", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          type,
          x,
          y,
          // the card's OWN workspace — a link copy in another workspace
          // grows its continuation THERE (that is what links are for)
          workspaceId: src.workspaceId ?? undefined,
        }),
      });
      set({ jobs: [...get().jobs, job], selectedId: job.id, selectedIds: [job.id] });
      get().invalidateRedo();
      // the wire — connect() validates ports, guards cycles, draws the
      // optimistic edge immediately (t359) and persists in the background
      await get().connect(src.id, job.id, step.fromPort, step.toPort);
      // arrival: focus frames the new card (the source may live far from
      // the viewport center) without stealing the params panel's context
      get().focusJob(job.id);
      toast({
        title: `${specT.label} added`,
        description: `Wired ${src.name} → ${job.name} (${step.caption})`,
      });
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to add the next step");
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
      get().invalidateRedo();
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
      // Task 159: the canvas follows the import — a user action that
      // moves the user, so the position echoes too
      persistActiveWorkspace(targetWsId);
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
    // the import minted brand-new job ids — the redo branch dies here
    get().invalidateRedo();
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
    // t370 — the import-undo lane deletes by itself (not via
    // removeJobsRaw), so it records its own tombstones: an in-flight poll
    // that started before these DELETEs committed would resurrect the
    // just-imported cards the same way it resurrects a plain delete
    tombstoneJobIds(ok);
    const okSet = new Set(ok);
    const selectedId = get().selectedId;
    // Task 159: stepping the canvas back is the undo gesture's motion —
    // echo it, or the seed would say the user still stands on the undone
    // import's workspace
    if (switched && restoreWorkspaceId != null) persistActiveWorkspace(restoreWorkspaceId);
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
    // out-of-band undo — the recorded future can no longer be trusted
    get().invalidateRedo();
    void get().refreshWorkspaces();
  },

  /** Task 104 — the shared bare delete: server cascade + local cleanup,
   *  no toasts, no history. keepSelection preserves the single-delete
   *  promotion semantics (bulk delete clears outright, as it always has). */
  removeJobsRaw: async (ids, opts) => {
    const alive = ids.filter((id) => get().jobs.some((j) => j.id === id));
    if (alive.length === 0) return { deleted: [], error: null };
    const results = await Promise.allSettled(
      alive.map((id) => api(`/api/jobs/${id}`, { method: "DELETE" }))
    );
    const deleted = alive.filter((_, i) => results[i].status === "fulfilled");
    if (deleted.length === 0) {
      const rej = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
      const reason = rej?.reason;
      return {
        deleted,
        error: reason instanceof Error ? reason.message : "Failed to delete job",
      };
    }
    const delSet = new Set(deleted);
    // t370 — tombstone every id that actually left: a GET /api/jobs that
    // started before these DELETEs committed can still land carrying
    // them, and without the tombstone the poll's merge would resurrect
    // the cards (the delete-flicker field report). Every caller — single
    // delete, bulk delete, the redo of an undone delete — flows through
    // here, so one recording point covers the whole delete family.
    tombstoneJobIds(deleted);
    // keepSelection: when the PRIMARY card goes away, promote the first
    // remaining selected card (the single-delete behavior since Task 97)
    const restIds = get().selectedIds.filter((x) => !delSet.has(x));
    const selId = get().selectedId;
    const prevInspect = get().inspectId;
    const prevPending = get().pendingFrom;
    const primary =
      opts?.keepSelection && selId != null && delSet.has(selId)
        ? (restIds[0] ?? null)
        : selId;
    set({
      jobs: get().jobs.filter((j) => !delSet.has(j.id)),
      edges: get().edges.filter((e) => !delSet.has(e.fromJobId) && !delSet.has(e.toJobId)),
      selectedId: opts?.keepSelection ? primary : null,
      selectedIds: opts?.keepSelection ? restIds : [],
      inspectId: prevInspect != null && delSet.has(prevInspect) ? null : prevInspect,
      pendingFrom: prevPending && delSet.has(prevPending.jobId) ? null : prevPending,
    });
    return { deleted, error: null };
  },

  undo: async () => {
    const past = get().historyPast;
    const entry = past[past.length - 1];
    if (!entry) {
      toast({
        title: "Nothing to undo",
        description: "The canvas is already at its oldest remembered state",
      });
      return;
    }
    // pop FIRST: re-entrant undos (a double Ctrl+Z racing the async work)
    // must never run the same entry twice
    set({ historyPast: past.slice(0, -1) });
    await entry.undo();
    set({ historyFuture: [...get().historyFuture, entry] });
  },

  redo: async () => {
    const future = get().historyFuture;
    const entry = future[future.length - 1];
    if (!entry) {
      toast({
        title: "Nothing to redo",
        description: "Every undone change is already back on the canvas",
      });
      return;
    }
    set({ historyFuture: future.slice(0, -1) });
    await entry.redo();
    set({ historyPast: [...get().historyPast, entry].slice(-HISTORY_CAP) });
  },

  /** Task 106 — the history panel's time machine: n sequential single
   *  steps through the SAME undo()/redo() paths the keyboard walks (one
   *  implementation of the inverse semantics, zero drift). Early exit on
   *  an empty stack keeps a stale count from toasting "Nothing to undo"
   *  n times. */
  undoSteps: async (n) => {
    for (let k = 0; k < n; k++) {
      if (get().historyPast.length === 0) return;
      await get().undo();
    }
  },

  redoSteps: async (n) => {
    for (let k = 0; k < n; k++) {
      if (get().historyFuture.length === 0) return;
      await get().redo();
    }
  },

  undoEntry: async (entry) => {
    const past = get().historyPast;
    const i = past.indexOf(entry);
    if (i >= 0) {
      if (i === past.length - 1) {
        // the common case — the toast is fresh, the entry is the stack top:
        // walk the plain linear path so future/redo stays coherent
        await get().undo();
        return;
      }
      // buried under newer work — the linear stack has branched. Undo this
      // entry out-of-band and discard the divergent tail: a linear stack
      // cannot represent a branch, and pretending otherwise would apply
      // the wrong inverse to the wrong world
      await entry.undo();
      set({ historyPast: past.slice(0, i), historyFuture: [] });
      return;
    }
    const future = get().historyFuture;
    if (future.includes(entry)) {
      // already undone from the keyboard — the toast button arrived late;
      // run it anyway (undoDelete's own guard makes it a polite no-op)
      // and retire the entry so it can never fire twice
      await entry.undo();
      set({ historyFuture: future.filter((e) => e !== entry) });
      return;
    }
    // entry unknown to the stack (history reset, imported world) — bare
    // undo, and the recorded future can no longer be trusted
    await entry.undo();
    set({ historyFuture: [] });
  },

  invalidateRedo: () => set({ historyFuture: [] }),

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
    let res: {
      restored: { id: string; coerced: boolean }[];
      failed: { id: string; error: string }[];
      /** t341 — the server tombstone's own work: ids whose run record came
       *  back, and the wires the SERVER re-attached (the client skips
       *  re-posting those) */
      recordRestored?: string[];
      edges?: { fromJobId: string; toJobId: string; fromPort?: string; toPort?: string }[];
    };
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
    // t370 — the restored ids leave the client tombstone NOW: they are
    // coming back on purpose, and the next poll's ingest filter must not
    // eat the cards this restore is about to put on the canvas. Refused
    // ids (res.failed) stay tombstoned — they never came back.
    reviveJobIds(restoredIds);
    // re-wire sequentially: the sidecar edge file is a read-modify-write
    // store, parallel POSTs could drop edges; wires to survivors restore
    // too (one endpoint restored, the other never left)
    const alive = (id: string) => restoredIds.has(id) || get().jobs.some((j) => j.id === id);
    // t341 — the server's tombstone already re-attached its wires; the
    // client snapshot only posts what the SERVER did not (a re-post would
    // collide on the unique pair and used to count as a failure)
    const serverWired = new Set((res.edges ?? []).map((e) => `${e.fromJobId}->${e.toJobId}`));
    let edgeOk = 0;
    let edgeFail = 0;
    const restoredEdges: EdgeDTO[] = [];
    for (const e of snapshot.edges) {
      if (!alive(e.fromJobId) || !alive(e.toJobId)) {
        edgeFail += 1;
        continue;
      }
      if (serverWired.has(`${e.fromJobId}->${e.toJobId}`)) {
        // the server already re-attached this wire (ports and all) —
        // count it and render it, no POST needed
        restoredEdges.push(e);
        edgeOk += 1;
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
      } catch (err) {
        // t341 — "already exists" is a SUCCESS wearing a 409: the wire is
        // on the canvas (the server restored it between the response and
        // this post, or another undo raced us) — count it, render it
        const msg = err instanceof Error ? err.message : String(err);
        if (/already exists/i.test(msg)) {
          restoredEdges.push(e);
          edgeOk += 1;
        } else {
          edgeFail += 1;
        }
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
    const recordCount = res.recordRestored?.length ?? 0;
    const bits: string[] = [
      `${restoredIds.size} of ${jobs.length} job${jobs.length === 1 ? "" : "s"} back on the canvas`,
    ];
    if (edgeOk > 0) bits.push(`${edgeOk} wire${edgeOk === 1 ? "" : "s"} reconnected`);
    if (edgeFail > 0) bits.push(`${edgeFail} wire${edgeFail === 1 ? "" : "s"} could not be reconnected`);
    if (recordCount > 0)
      bits.push(`${recordCount} run record${recordCount === 1 ? "" : "s"} re-attached — downstream jobs can see their inputs again`);
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

  restoreFromGraveyard: async (jobId) => {
    // the grave's OWN snapshot restores server-side (POST takes a job_id,
    // never a client-built job); this side only has to observe the t370
    // law — ids coming back on PURPOSE leave the tombstone filter before
    // the next poll — and re-draw from the server, never optimistically:
    // the restore core's coercion and tombstone re-apply are the truth.
    let res: {
      restored?: { id: string; coerced: boolean }[];
      failed?: { id: string; error: string }[];
      recordRestored?: string[];
      edges?: unknown[];
    };
    try {
      res = await api("/api/jobs/deleted/restore", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ job_id: jobId }),
      });
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : "The restore failed — is the server reachable?",
      };
    }
    const restoredIds = (res.restored ?? []).map((r) => r.id);
    if (restoredIds.length === 0) {
      const why = res.failed?.[0]?.error ?? "the restore was refused";
      return { ok: false, message: why };
    }
    reviveJobIds(restoredIds);
    await get().load();
    const name = get().jobs.find((j) => j.id === restoredIds[0])?.name ?? restoredIds[0];
    const bits: string[] = [`"${name}" is back on the canvas under its original id`];
    if ((res.recordRestored?.length ?? 0) > 0) bits.push("its run record re-attached");
    if ((res.edges?.length ?? 0) > 0) bits.push(`${res.edges!.length} wire${res.edges!.length === 1 ? "" : "s"} re-attached`);
    if (res.restored?.[0]?.coerced) bits.push("it was running when deleted, so it came back idle");
    return { ok: true, message: bits.join(" — ") };
  },

  moveJobCommit: async (id, x, y) => {
    const j0 = get().jobs.find((j) => j.id === id);
    // optimistic
    set({ jobs: get().jobs.map((j) => (j.id === id ? { ...j, x, y } : j)) });
    // t383 — while this PATCH is in the air, polls must not clobber the
    // optimistic position; on success the generation bump keeps covering
    // polls that started BEFORE the confirmation (see the guard block)
    const release = holdPositions([id]);
    try {
      await api(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ x, y }),
      });
      confirmPositions([id]);
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to save position");
    } finally {
      release();
    }
    // Task 104 — the entry is pushed after the PATCH attempt so even a
    // failed save leaves an exit: undo restores the local card, and once
    // the server answers again the row follows. A drag that rounds back
    // onto the origin records nothing (there is nothing to undo).
    if (j0 && (j0.x !== x || j0.y !== y)) {
      const entry: HistoryEntry = {
        label: `Move ${j0.name}`,
        kind: "move",
        undo: async () => {
          await get().moveJobsCommit([{ id, x: j0.x, y: j0.y }], { history: false });
        },
        redo: async () => {
          await get().moveJobsCommit([{ id, x, y }], { history: false });
        },
      };
      set((s) => ({
        historyPast: [...s.historyPast, entry].slice(-HISTORY_CAP),
        historyFuture: [],
      }));
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
    const before = jobs
      .filter((j) => {
        const p = positions.get(j.id);
        return p && (p.x !== j.x || p.y !== j.y);
      })
      .map((j) => ({ id: j.id, x: j.x, y: j.y }));
    set({
      jobs: get().jobs.map((j) => ({ ...j, ...(positions.get(j.id) ?? {}) })),
      layoutEpoch: get().layoutEpoch + 1,
    });
    // t383 — the tidy write is a batch of every moved job; hold them all
    // so an in-flight poll cannot un-tidy the canvas mid-flight, and bump
    // the generation on success for polls that started before it
    const releaseTidy = holdPositions(updates.map((u) => u.id));
    try {
      await api("/api/jobs/layout", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ updates }),
      });
      confirmPositions(updates.map((u) => u.id));
      toast({ title: "Workflow tidied", description: `${updates.length} jobs auto-arranged` });
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to save layout");
    } finally {
      releaseTidy();
    }
    // Task 104 — undo the tidy: every pre-layout position comes back, but
    // WITHOUT a layoutEpoch bump. The epoch would yank the viewport into a
    // refit the user never asked for; undo restores the GRAPH, the user
    // keeps the camera.
    if (before.length > 0) {
      const entry: HistoryEntry = {
        label: "Auto-arrange",
        kind: "tidy",
        undo: async () => {
          await get().moveJobsCommit(before, { history: false });
        },
        redo: async () => {
          await get().moveJobsCommit(updates, { history: false });
        },
      };
      set((s) => ({
        historyPast: [...s.historyPast, entry].slice(-HISTORY_CAP),
        historyFuture: [],
      }));
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

  runJob: async (id, opts) => {
    // flush any pending (debounced) parameter edits FIRST so the run starts
    // with exactly what the user sees in the form
    try {
      await flushJobParams(id);
    } catch {
      /* flush failure is non-fatal — the run uses the last saved params */
    }
    try {
      // local fetch instead of api(): the 409 body carries busyKind, which
      // api() would flatten into a bare Error message — and the whole point
      // is that the two busy cases must NOT share one face.
      // t317 — opts.local is the EXPLICIT local choice (the panel's ▾ "Run
      // on this machine"): it opts OUT of the route's project-binding
      // fallback, meeting the engine's honest cluster-resident refusal
      // instead of silently spawning through the WSL bridge. A BARE POST
      // (every other door: card menu / palette / toast Retry / inspector)
      // inherits the project's cluster binding server-side.
      const res = await fetch(`/api/jobs/${id}/run`, {
        method: "POST",
        ...(opts?.local === true
          ? { headers: JSON_HEADERS, body: JSON.stringify({ local: true }) }
          : {}),
      });
      const data = (await res.json().catch(() => ({}))) as {
        job?: JobDTO;
        error?: string;
        waiting?: string;
        busyKind?: "inflight" | "live";
      };
      if (data.job) {
        const reported = data.job;
        set({ jobs: get().jobs.map((j) => (j.id === id ? reported : j)) });
      }
      if (!res.ok) {
        if (res.status === 409 && data.busyKind === "inflight") {
          // a duplicate click racing the FIRST start — that request's own
          // toast ("Job started" / waiting / failure) is already in the air
          // or about to land; saying anything here would STEAL its slot
          // under TOAST_LIMIT=1. The duplicate's silence is the courtesy:
          // the job's state lives on the card either way.
          return false;
        }
        if (res.status === 409 && data.busyKind === "live") {
          // a live process is a HEALTHY state — inform, don't alarm. (The
          // old destructive face punished the user for a job that was
          // running perfectly well.) Quiet lanes (the subtree orchestration)
          // stay silent — the frontier receipt speaks once for the gesture.
          if (!opts?.quiet)
            toast({
              title: "Already running",
              description:
                data.error ?? "A process for this job is alive — nothing was started again.",
            });
          return false;
        }
        // every other refusal (400 linked copy, 404, 500) is a REAL one —
        // the alarm stays where it belongs
        throw new Error(data?.error ?? `Request failed (${res.status})`);
      }
      const started = data.job;
      if (data.waiting) {
        // job went PENDING — an upstream job failed or is still running;
        // not an error, the result line explains what to fix/re-run. It
        // auto-starts the moment the upstream inputs land — no re-click.
        if (!opts?.quiet)
          toast({
            title: "Job waiting as pending",
            description:
              (started?.result ?? "Waiting for its upstream job to produce outputs.") +
              " It starts automatically once ready.",
          });
        // show the waiting reason where the user is looking (the quiet
        // orchestration never steers the camera — its receipt speaks)
        if (!opts?.quiet) set({ inspectId: id, selectedId: null, selectedIds: [] });
        return false;
      }
      if (data.error) {
        // honest real-engine failure — surfaced via the job result too
        if (!opts?.quiet)
          toast({
            title: "Real engine refused to start",
            description: data.error,
            variant: "destructive",
          });
        return false;
      }
      if (!opts?.quiet)
        toast(
          started?.runRemote
            ? {
                title: "Job sent to cluster",
                description: `${started?.name ?? "Job"} → ${started.runRemote.user}@${started.runRemote.host}`,
              }
            : { title: "Job started", description: `${started?.name ?? "Job"} is now running` }
        );
      // CryoSPARC-style: submitting a job opens its inspector page (the
      // quiet orchestration does NOT steer — the user is already looking
      // at the subtree's root)
      if (!opts?.quiet) set({ inspectId: id, selectedId: null, selectedIds: [] });
      return true;
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to run job");
      return false;
    }
  },

  runJobRemote: async (id, target, opts) => {
    // flush any pending (debounced) parameter edits FIRST — identical
    // rationale to runJob: the cluster run must start with exactly what
    // the user sees in the form
    try {
      await flushJobParams(id);
    } catch {
      /* flush failure is non-fatal — the run uses the last saved params */
    }
    try {
      // local fetch instead of api(): the 409 body carries busyKind and the
      // waiting/staging line — api() would flatten both into a bare Error
      const res = await fetch(`/api/jobs/${id}/run`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ remote: target }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        job?: JobDTO;
        error?: string;
        waiting?: string;
        busyKind?: "inflight" | "live";
      };
      if (data.job) {
        const reported = data.job;
        set({ jobs: get().jobs.map((j) => (j.id === id ? reported : j)) });
      }
      if (!res.ok) {
        if (res.status === 409 && data.busyKind === "inflight") {
          // duplicate click racing the FIRST dispatch — its own toast is
          // already in the air; silence here is the courtesy (runJob idiom)
          return false;
        }
        if (res.status === 409 && data.busyKind === "live") {
          // a live process is a HEALTHY state — inform, don't alarm. Quiet
          // lanes (the subtree orchestration) stay silent — the frontier
          // receipt speaks once for the gesture.
          if (!opts?.quiet)
            toast({
              title: "Already running",
              description:
                data.error ?? "A process for this job is alive — nothing was started again.",
            });
          return false;
        }
        throw new Error(data?.error ?? `Request failed (${res.status})`);
      }
      const started = data.job;
      const info = started?.runRemote ?? null;
      if (data.waiting) {
        // job went PENDING on the cluster path — upstream inputs are being
        // staged / an upstream job has not landed yet; it auto-starts the
        // moment the inputs are in place, no re-click
        if (!opts?.quiet)
          toast({
            title: "Sent to cluster",
            description:
              (started?.result ?? "Waiting for its upstream job to produce outputs.") +
              " It starts automatically once inputs are staged.",
          });
        if (!opts?.quiet) set({ inspectId: id, selectedId: null, selectedIds: [] });
        // t445 — the return value's contract is "the dispatch was
        // ACCEPTED", not "the process is running". Staging IS acceptance:
        // the cluster has the job and the pipeliner owns it now. The
        // dialog closes on acceptance — its contract is a SEND door
        // (t289), not a start watcher; live QA (t445) caught a completed
        // cluster run shining THROUGH an open dialog, because the staging
        // beat's honest `waiting` verdict read as a refusal here.
        return true;
      }
      if (data.error) {
        // honest remote-engine refusal — surfaced via the job result too
        if (!opts?.quiet)
          toast({
            title: "Cluster refused to start the job",
            description: data.error,
            variant: "destructive",
          });
        return false;
      }
      if (!opts?.quiet)
        toast({
          title: "Job sent to cluster",
          description: info
            ? `${started?.name ?? "Job"} → ${info.user}@${info.host}`
            : `${started?.name ?? "Job"} sent to the cluster`,
        });
      // same landing as runJob: the inspector follows the job (the quiet
      // orchestration does NOT steer — its receipt speaks once)
      if (!opts?.quiet) set({ inspectId: id, selectedId: null, selectedIds: [] });
      return true;
    } catch (err) {
      // the quiet lane's refusals surface through the frontier receipt —
      // the loop reads the job's own result line, which carries the same
      // honest message the server set here
      if (!opts?.quiet)
        toast({
          title: "Cluster refused to start the job",
          description: err instanceof Error ? err.message : "Failed to run job on cluster",
          variant: "destructive",
        });
      return false;
    }
  },

  runSubtree: async (rootId, target) => {
    // the brain plans from the live world — the dialog's checkbox showed a
    // plan, but the world may have drifted (a node started churning) since
    // it rendered; THIS plan is the authoritative one
    const plan = planSubtreeRun(get().jobs, get().edges, rootId);
    if (plan.order.length === 0) {
      errToast("Nothing to re-run — this job is not on the canvas");
      return false;
    }
    if (plan.blocked.length > 0) {
      // the refusal sentence names the churning node(s) — t441 walk law
      errToast(describeSubtreeRun(plan));
      return false;
    }
    // t449 — one walk at a time: two orchestrations would fight over the
    // same landing law; the second is refused by naming both roots
    const active = get().subtreeOrch;
    if (active) {
      errToast(orchGuardSentence(active.rootName));
      return false;
    }
    const total = plan.order.length;
    const orchState: SubtreeOrchState = {
      rootId,
      rootName: plan.order[0].name,
      order: plan.order,
      index: 0,
      stopRequested: false,
    };
    set({ subtreeOrch: orchState });
    // t450 — the record rides from the first breath: plan + target survive
    // the reload; the executor mirrors every index bump into it
    saveSubtreeOrch(orchState, target);
    const res = await walkSubtreeNodes(plan.order, 0, 0, target);
    if (res.userStopped) {
      // the user's stop is intent, not failure — a neutral receipt, never
      // the destructive frontier dialect
      toast({
        title: `Subtree re-run stopped — ${res.done} of ${total} re-ran`,
        description: stopReceiptSentence(res.done, total),
        duration: 20_000,
      });
      return false;
    }
    if (res.handedOff) {
      // t451 — a sibling tab claimed the walk while this one waited.
      // The walker stands down; the walk itself continues on the heir's
      // face. Intent, not failure — the neutral hand-off dialect.
      toast({
        title: `Subtree re-run handed off — ${res.done} of ${total} re-ran here`,
        description: handoffReceiptSentence(),
        duration: 20_000,
      });
      return false;
    }
    if (res.frontier) {
      toast({
        title: `Subtree stopped at ${res.frontier.name} — ${res.done} of ${total} re-ran`,
        description: res.frontier.reason,
        variant: "destructive",
        duration: 20_000,
      });
      return false;
    }
    toast({
      title: `Subtree re-ran — ${total} job${total === 1 ? "" : "s"} refreshed`,
      description:
        plan.order.length === 1
          ? `${plan.order[0].name} is up to date again`
          : `Run order: ${plan.order
              .slice(0, 4)
              .map((n) => n.name)
              .join(" → ")}${total > 4 ? ` … and ${total - 4} more` : ""}`,
      duration: 20_000,
    });
    return true;
  },

  stopSubtreeRun: () => {
    const orch = get().subtreeOrch;
    if (!orch || orch.stopRequested) return;
    const next = { ...orch, stopRequested: true };
    set({ subtreeOrch: next });
    // t450 — the armed stop rides the record too: a reload before the
    // checkpoint must still honor the user's intent (dispatch nothing).
    // t451 — the mirror is owner-conditional: a dispossessed tab's stop
    // request must never steal the heir's record back.
    const saved = readSubtreeOrch();
    if (saved && saved.owner === getTabId()) saveSubtreeOrch(next, saved.target);
  },

  resumeSubtreeOrch: async () => {
    // a live walk owns the face — belt and braces at boot AND at live
    // adoption (the heir's pulse fires this on a tab that is already
    // walking its own lane)
    if (get().subtreeOrch) return;
    // t451 one-shot legacy upgrade: a v1 session record (the
    // pre-inheritance build) imports as this tab's own walk before the
    // claim reads — the reload it was saved for lands as a plain own-resume
    importLegacySubtreeOrch();
    // t451 — the claim law (one walk, one heir) replaces the t450
    // consume-once read: the record lives in the workspace's shared
    // memory now, so "read" became "arbitrate". Own → resume instantly
    // (a reload reclaims itself); stale owner → ADOPT (claim, then the
    // same world-truth scan resurrects); live owner → silent (the walk
    // is on another tab's face — two walkers would fight the landing
    // law); no record → nothing to inherit.
    const claim = claimSubtreeOrch();
    if (claim.mode === "none" || claim.mode === "elsewhere" || !claim.saved) return;
    const saved = claim.saved;
    const { orch: rec, target } = saved;
    const jobs = get().jobs;
    const root = jobs.find((j) => j.id === rec.rootId);
    if (!root) {
      // the walk's root is gone from this world — its owner deleted it;
      // no noise. The record is ours (claimed or owned) and terminal:
      // retire it — a dead plan must never retry-loop on every load.
      clearSubtreeOrch();
      return;
    }
    const scan = resumeScan(rec.order, jobs, {
      // t451 — a completion counts as this walk's landing only when it
      // postdates the walk's own first breath: a result that predates
      // the walk (a previous run's output) must be re-run, not counted.
      // Caught live — a re-run over an already-completed subtree read
      // the old completions as fresh landings and short-circuited.
      walkStart: saved.walkStart,
    });
    // the face's order is the persisted plan minus nodes the world lost —
    // the count the receipts speak is THIS filtered total
    const order = rec.order.filter((n) => !scan.missing.some((m) => m.id === n.id));
    const total = order.length;
    if (total === 0) {
      // degenerate record — everything gone, nothing to speak about;
      // terminal, retire it (we own it)
      clearSubtreeOrch();
      return;
    }
    // an armed stop is honored without dispatching anything
    if (rec.stopRequested) {
      clearSubtreeOrch(); // terminal — the walk ends here, own or adopted
      toast({
        title: `Subtree re-run stopped — ${scan.done} of ${total} re-ran`,
        description: stopReceiptSentence(scan.done, total),
        duration: 20_000,
      });
      return;
    }
    // the whole walk landed while the tab was away — the success receipt
    // arrives late, but it arrives
    if (scan.allLanded) {
      clearSubtreeOrch(); // terminal — the walk finished on its own
      toast({
        title: `Subtree re-ran — ${total} job${total === 1 ? "" : "s"} refreshed`,
        description: resumeToastDescription(null, scan.missing),
        duration: 20_000,
      });
      return;
    }
    // the frontier found the walk dead: the resume node failed while away
    if (scan.failedFrontier) {
      clearSubtreeOrch(); // terminal — the frontier speaks, the plan retires
      toast({
        title: `Subtree stopped at ${scan.failedFrontier.name} — ${scan.done} of ${total} re-ran`,
        description: resumeFrontierReason(scan.failedFrontier),
        variant: "destructive",
        duration: 20_000,
      });
      return;
    }
    if (!scan.resumeNode) {
      clearSubtreeOrch(); // nothing left to dispatch — retire the plan
      return;
    }
    // re-enter the walk: the face wears the resumed flag (and the
    // inherited one when the resurrection crossed a tab's death); the
    // loop continues with the SAME cluster target the original gesture
    // chose
    const inherited = claim.mode === "adopted";
    set({
      subtreeOrch: {
        rootId: rec.rootId,
        rootName: root.name,
        order,
        index: scan.done,
        stopRequested: false,
        resumed: true,
        inherited,
      },
    });
    toast({
      title: resumeToastTitle(scan.done, total),
      description: `${inherited ? INHERITED_PREFIX : ""}${resumeToastDescription(
        scan.resumeNode.name,
        scan.missing
      )}`,
      duration: 20_000,
    });
    const res = await walkSubtreeNodes(order, scan.done, scan.done, target, {
      // the resume node mid-flight (it survived the reload — or the
      // previous owner's death — on the cluster side) is awaited, never
      // re-dispatched: the 409 door would refuse it and kill the
      // resumed walk at its first breath
      firstNodeAwaitOnly: scan.resumeInflight,
    });
    // post-walk receipts speak the same dialect as a fresh walk — the
    // resume point onward is THIS tab's doing
    if (res.userStopped) {
      toast({
        title: `Subtree re-run stopped — ${res.done} of ${total} re-ran`,
        description: stopReceiptSentence(res.done, total),
        duration: 20_000,
      });
      return;
    }
    if (res.handedOff) {
      // t451 — a sibling tab claimed the walk while this resumed walker
      // waited. Stand down gracefully; the walk continues on the heir.
      toast({
        title: `Subtree re-run handed off — ${res.done} of ${total} re-ran here`,
        description: handoffReceiptSentence(),
        duration: 20_000,
      });
      return;
    }
    if (res.frontier) {
      toast({
        title: `Subtree stopped at ${res.frontier.name} — ${res.done} of ${total} re-ran`,
        description: res.frontier.reason,
        variant: "destructive",
        duration: 20_000,
      });
      return;
    }
    toast({
      title: `Subtree re-ran — ${total} job${total === 1 ? "" : "s"} refreshed`,
      description:
        total === 1
          ? `${order[0]?.name ?? "The job"} is up to date again`
          : `Run order: ${order
              .slice(0, 4)
              .map((n) => n.name)
              .join(" → ")}${total > 4 ? ` … and ${total - 4} more` : ""}`,
      duration: 20_000,
    });
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

  renameJob: async (id, name) => {
    // the server's own law (1–60 after trim) mirrored client-side so honest
    // typing never sees the 400 — same contract as the note textarea
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 60) {
      errToast("Job name must be 1–60 characters");
      return false;
    }
    const prev = get().jobs.find((j) => j.id === id);
    if (!prev) return false;
    if (prev.name === trimmed) return true; // a no-op rename is not an error
    // optimistic — the canvas says the new name the moment Enter lands;
    // a refusal rolls back surgically (only THIS job's name — a poll that
    // landed mid-flight keeps every update it delivered)
    set({ jobs: get().jobs.map((j) => (j.id === id ? { ...j, name: trimmed } : j)) });
    try {
      const { job } = await api<{ job: JobDTO }>(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ name: trimmed }),
      });
      set({ jobs: get().jobs.map((j) => (j.id === id ? job : j)) });
      return true;
    } catch (err) {
      set({ jobs: get().jobs.map((j) => (j.id === id ? { ...j, name: prev.name } : j)) });
      errToast(err instanceof Error ? err.message : "Failed to rename job");
      return false;
    }
  },

  deleteJob: async (id) => {
    // snapshot BEFORE the delete — the undo stack entry carries the full
    // pre-delete world (job DTO + attached wires) for /api/jobs/restore
    const snapJob = get().jobs.find((j) => j.id === id);
    const snapshot: DeleteSnapshot | null = snapJob
      ? {
          jobs: [snapJob],
          edges: get().edges.filter((e) => e.fromJobId === id || e.toJobId === id),
        }
      : null;
    const { deleted, error } = await get().removeJobsRaw([id], { keepSelection: true });
    if (deleted.length === 0) {
      errToast(error ?? "Failed to delete job");
      return;
    }
    // Task 104 — the toast Undo button and Ctrl+Z share ONE entry: the
    // button routes through undoEntry (which detects whether this entry is
    // still the stack top), so the two paths can never fight over state
    const entry: HistoryEntry | null =
      snapshot && snapJob
        ? {
            label: `Delete ${snapJob.name}`,
            kind: "delete",
            undo: async () => {
              await get().undoDelete(snapshot);
            },
            redo: async () => {
              await get().removeJobsRaw([id], { keepSelection: true });
            },
          }
        : null;
    if (entry) {
      set((s) => ({
        historyPast: [...s.historyPast, entry].slice(-HISTORY_CAP),
        historyFuture: [],
      }));
    }
    toast({
      title: "Job deleted",
      // name the job — "removed from the workflow" said nothing about WHICH
      description: snapJob
        ? `${snapJob.name} removed from the workflow`
        : "Removed from the workflow",
      // wrong-card deletes are the classic slip — the undo window is the
      // safety net the confirm dialog now promises (Task 97), and since
      // Task 104 it outlives the toast: Ctrl+Z walks the same entry later
      duration: 20_000,
      action: entry
        ? (React.createElement(
            ToastAction,
            { altText: "Undo the delete", onClick: () => void get().undoEntry(entry) },
            "Undo"
          ) as unknown as ToastActionElement)
        : undefined,
    });
  },

  duplicateJob: async (id, opts) => {
    const src = get().jobs.find((j) => j.id === id);
    if (!src) return;
    // t442 — the twin's seat: the free slot of the column to the RIGHT
    // (a parallel branch at the original's height, not a card stacked on it)
    const spot = twinSpot(
      get().jobs.map((j) => ({ x: j.x, y: j.y })),
      { x: src.x, y: src.y },
      { w: CARD_W, h: CARD_H, strideX: CARD_W + 100, strideY: CARD_H + 48 },
      { min: WORLD_MIN, max: WORLD_MAX }
    );
    // t442 — the recipe comes with its feeding wires. Only the pairs the
    // canvas could draw TODAY; a source whose params moved on strands its
    // old wires and the receipt says so.
    const jobsById = new Map(get().jobs.map((j) => [j.id, j] as const));
    const { wires, stranded } = faithfulWires(upstreamEdgesOf(get().edges, id), (e) => {
      if (!e.fromPort || !e.toPort) return true; // portless legacy wires — the tool draws them
      const fromType = jobsById.get(e.fromJobId)?.type;
      return fromType ? portsCompatible(fromType, e.fromPort, src.type, e.toPort) : false;
    });
    // the gallery selection rides INSIDE params (an object the server's
    // scalar filter would drop) — lifted top-level, the server re-validates it
    const classSelection = extractClassSelection(src.params);
    try {
      const { job, edge: autoEdge } = await api<{
        job: JobDTO;
        edge?: EdgeDTO;
      }>("/api/jobs", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          type: src.type,
          x: spot.x,
          y: spot.y,
          // t447 — the twin's name is the family's lowest free slot, not a
          // fresh "(copy)" stamp: duplicating a copy yields a SIBLING
          // ("X (copy) 2"), and a name the world already holds is skipped
          name: twinName(src.name, get().jobs.map((j) => j.name)),
          params: src.params,
          ...(classSelection ? { classStarSelection: classSelection } : {}),
        }),
      });
      set({
        jobs: [...get().jobs, job],
        selectedId: job.id,
        selectedIds: [job.id],
        // the old default stands: without openInspector the inspector steps
        // aside (canvas view); the twin's door lands the user in its editor
        inspectId: null,
      });
      if (opts?.openInspector) get().inspect(job.id);
      get().invalidateRedo(); // duplicate mints a new id — no faithful redo
      // the manual wiring list drops the gallery wire the server already drew
      const manual = withoutAutoEdge(wires, autoEdge);
      for (const w of manual) {
        await get().connect(w.fromJobId, job.id, w.fromPort ?? undefined, w.toPort ?? undefined, {
          quiet: true,
        });
      }
      const wired = manual.length + (autoEdge ? 1 : 0);
      toast({
        title: "Run duplicated",
        description:
          `${job.name} — params copied, ${wired} upstream wire${wired === 1 ? "" : "s"} drawn, twin waiting unstarted` +
          (stranded > 0
            ? ` — ${stranded} stranded wire${stranded === 1 ? "" : "s"} skipped (its ports no longer match)`
            : ""),
      });
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to duplicate job");
    }
  },

  adoptDownstream: async (fromRunId, toRunId) => {
    const { edges, jobs } = get();
    // the brain plans from the live world; the store only applies
    const plan = planAdoption({
      edges,
      jobs: jobs.map((j) => ({ id: j.id, type: j.type, name: j.name })),
      fromRunId,
      toRunId,
      outputPortsOf: (type) => (jobType(type)?.outputs ?? []).map((p) => p.name),
    });
    if (plan.moves.length === 0) {
      // nothing to apply — still speak (the dialog guards, but the
      // action is callable from anywhere and silence would lie)
      const { title, detail } = describeAdoption(plan, "run A", "run B");
      toast({ title, description: detail });
      return;
    }
    const nameA = jobs.find((j) => j.id === fromRunId)?.name ?? "run A";
    const nameB = jobs.find((j) => j.id === toRunId)?.name ?? "run B";

    // ONE optimistic set: the loser's wires leave and the winner's
    // arrive in the same frame — a half-adopted graph is a lie the
    // canvas would draw (t359's wire-draws-now law, batch shape)
    const moveIds = new Set(plan.moves.map((m) => m.edge.id));
    const newEdges: EdgeDTO[] = plan.moves.map((m) => ({
      id: crypto.randomUUID(),
      fromJobId: toRunId,
      toJobId: m.edge.toJobId,
      fromPort: m.edge.fromPort ?? undefined,
      toPort: m.edge.toPort ?? undefined,
    }));
    set({
      edges: [...edges.filter((e) => !moveIds.has(e.id)), ...newEdges],
    });
    get().invalidateRedo(); // wire edits have no id-stable inverse

    // persistence: each move is POST-new-then-DELETE-old. POST first:
    // if the server refuses (cycle/port drift since planning), the old
    // wire is still real — rollback is honest. DELETE after: a failure
    // leaves BOTH wires live server-side, so the old edge is restored
    // to the store (UI truth = server truth) and the receipt names it.
    const failures: string[] = [];
    for (const [i, m] of plan.moves.entries()) {
      const ne = newEdges[i];
      try {
        const { edge } = await api<{ edge: EdgeDTO }>("/api/edges", {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify({
            id: ne.id,
            fromJobId: ne.fromJobId,
            toJobId: ne.toJobId,
            fromPort: ne.fromPort,
            toPort: ne.toPort,
          }),
        });
        // the server stays the truth for ports/id (same swap rule as connect)
        if (
          edge.id !== ne.id ||
          edge.fromPort !== ne.fromPort ||
          edge.toPort !== ne.toPort
        ) {
          set({ edges: get().edges.map((e) => (e.id === ne.id ? edge : e)) });
        }
        try {
          await api(`/api/edges/${m.edge.id}`, { method: "DELETE" });
        } catch {
          // the old wire refuses to die — show it again, name the residue
          set({ edges: [...get().edges, m.edge as EdgeDTO] });
          failures.push(m.child.name);
        }
      } catch {
        set({ edges: get().edges.filter((e) => e.id !== ne.id) });
        failures.push(m.child.name);
      }
    }

    // t444 — THE REFETCH CLOSES THE RACE: the optimistic set + per-move
    // POST/DELETE round trips leave a window where a concurrent poll or a
    // failed DELETE's restore can leave the store disagreeing with the
    // server (the live QA caught exactly that: edges moved server-side,
    // the canvas kept the old wiring until reload). One GET afterwards
    // re-pins UI truth to server truth — the same move connect()'s 409
    // branch makes. Failure stays silent: the optimistic state is already
    // near-correct, and the next poll converges anyway.
    try {
      const fresh = await api<{ edges: EdgeDTO[] }>("/api/edges");
      console.log("[adopt] refetch edges:", fresh.edges.length, "moves:", plan.moves.length, "failures:", failures.length);
      set({ edges: fresh.edges });
    } catch {
      /* the optimistic state stands; the next poll converges */
    }

    const { title, detail } = describeAdoption(plan, nameA, nameB, failures);
    toast({
      title,
      description: detail,
      variant: failures.length > 0 ? "destructive" : undefined,
    });
  },

  adoptWithExclude: async (fromRunId, toRunId, names) => {
    const { jobs } = get();
    const runB = jobs.find((j) => j.id === toRunId);
    if (!runB || !jobs.some((j) => j.id === fromRunId)) {
      errToast("That run is gone — refresh and try again");
      return;
    }
    if (names.length === 0) {
      errToast("No micrographs to exclude — the verdict's regression list is empty");
      return;
    }
    // the wire: the first port pair where run B's output kind fits the
    // filter's micrographs mouth (the compare domains only ever offer
    // completed motioncorr/ctffind runs, but the law is ports, not trust)
    const exSpec = jobType("excludemg");
    let fromPort: string | undefined;
    let toPort: string | undefined;
    for (const o of jobType(runB.type)?.outputs ?? []) {
      for (const i of exSpec?.inputs ?? []) {
        if (o.kind && i.accepts?.includes(o.kind)) {
          fromPort = o.name;
          toPort = i.name;
          break;
        }
      }
      if (fromPort) break;
    }
    if (!fromPort || !toPort) {
      errToast(`${runB.name} has no micrographs output for an exclude filter`);
      return;
    }
    try {
      // mint the filter: the names are baked at birth — the list the
      // dialog spoke IS the list the engine will filter by (one law,
      // exclude-list.ts), and the param stays editable for hand tuning
      const place = placeRightOf(runB, jobs);
      const { job: excludeJob } = await api<{ job: JobDTO }>("/api/jobs", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          type: "excludemg",
          x: place.x,
          y: place.y,
          workspaceId: runB.workspaceId ?? undefined,
          params: { excludeNames: names.join(", ") },
        }),
      });
      set({
        jobs: [...get().jobs, excludeJob],
        selectedId: excludeJob.id,
        selectedIds: [excludeJob.id],
      });
      get().invalidateRedo();
      get().focusJob(excludeJob.id);
      // the wire run B → filter (connect validates, draws optimistically,
      // persists — the t359 law the duplication already rides)
      await get().connect(runB.id, excludeJob.id, fromPort, toPort);
      // the adoption: run A's downstream re-parents onto the FILTER —
      // its own receipt names the filter as the new provider (the graph
      // shows the verdict as wiring, not as a memory)
      await get().adoptDownstream(fromRunId, excludeJob.id);
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to mint the exclude job");
    }
  },

  adoptWithSelect: async (fromRunId, toRunId, classNumbers) => {
    const { jobs } = get();
    const runB = jobs.find((j) => j.id === toRunId);
    if (!runB || !jobs.some((j) => j.id === fromRunId)) {
      errToast("That run is gone — refresh and try again");
      return;
    }
    if (classNumbers.length === 0) {
      errToast("No classes to select — the verdict's gains list is empty");
      return;
    }
    // the wires: EVERY select2d mouth must find a source among run B's
    // outputs — the scan is by kind, never assumed (class2d answers
    // both mouths: classAverages → classes, particles → particles). A
    // host missing a mouth refuses honestly BEFORE anything is minted:
    // a half-wired selection on the canvas is a lie the graph would
    // keep telling.
    const selSpec = jobType("select2d");
    const runBOuts = jobType(runB.type)?.outputs ?? [];
    const wirePairs: { fromPort: string; toPort: string }[] = [];
    for (const input of selSpec?.inputs ?? []) {
      const accepts = input.accepts ?? [];
      const out = runBOuts.find((o) => o.kind && accepts.includes(o.kind));
      if (!out) {
        errToast(
          `${runB.name} has no output feeding the selection's ${input.name} input`,
        );
        return;
      }
      wirePairs.push({ fromPort: out.name, toPort: input.name });
    }
    try {
      // mint the selection: the gained classes are baked at birth — the
      // list the dialog spoke IS the list the engine selects by (one
      // law), and the param stays editable for hand tuning
      const place = placeRightOf(runB, jobs);
      const { job: selectJob } = await api<{ job: JobDTO }>("/api/jobs", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          type: "select2d",
          x: place.x,
          y: place.y,
          workspaceId: runB.workspaceId ?? undefined,
          params: { selectedClasses: classNumbers.join(", ") },
        }),
      });
      set({
        jobs: [...get().jobs, selectJob],
        selectedId: selectJob.id,
        selectedIds: [selectJob.id],
      });
      get().invalidateRedo();
      get().focusJob(selectJob.id);
      // the wires run B → selection (both mouths; quiet — the adoption's
      // receipt is the gesture's voice, per-wire toasts would be noise)
      for (const pair of wirePairs) {
        await get().connect(runB.id, selectJob.id, pair.fromPort, pair.toPort, {
          quiet: true,
        });
      }
      // the adoption: run A's downstream re-parents onto the SELECTION —
      // its own receipt names the selection as the new provider (the
      // graph shows the verdict as wiring, not as a memory)
      await get().adoptDownstream(fromRunId, selectJob.id);
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to mint the class selection");
    }
  },

  pickWithTopazModel: async (fromJobId) => {
    const { jobs, edges } = get();
    const train = jobs.find((j) => j.id === fromJobId);
    if (!train || train.type !== "topaztrain") {
      errToast("That job is gone — refresh and try again");
      return;
    }
    if (train.status !== "completed") {
      errToast("The model isn't trained yet — wait for the run to complete");
      return;
    }
    // the micrographs mouth must be feedable BEFORE anything is minted:
    // the pick consumes the SAME stream the training did (the denoised
    // stack, in the official flow) — a half-wired pick on the canvas is
    // a lie the graph would keep telling (the adoptWithSelect law).
    const feed = edges.find((e) => e.toJobId === train.id && e.toPort === "micrographs");
    const source = feed ? jobs.find((j) => j.id === feed.fromJobId) : undefined;
    if (!feed || !source) {
      errToast("The training job has no micrographs source to inherit — wire one in first");
      return;
    }
    try {
      const place = placeRightOf(train, jobs);
      // the recipe carries over: Topaz mode + the training's own dials —
      // the pick starts where the training ended, every knob editable
      const params: Record<string, ParamValue> = {
        pickingMethod: "Topaz",
        topazNrParticles: train.params.topazNrParticles ?? 200,
        topazThreshold: train.params.topazThreshold ?? -6,
        topazDiameter: train.params.topazDiameter ?? 180,
        topazDownscale: train.params.topazDownscale ?? -1,
        topazWorkers: train.params.topazWorkers ?? 1,
        topazArgs: train.params.topazArgs ?? "",
      };
      const { job: pick } = await api<{ job: JobDTO }>("/api/jobs", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          type: "autopick",
          x: place.x,
          y: place.y,
          workspaceId: train.workspaceId ?? undefined,
          params,
        }),
      });
      set({
        jobs: [...get().jobs, pick],
        selectedId: pick.id,
        selectedIds: [pick.id],
      });
      get().invalidateRedo();
      get().focusJob(pick.id);
      // the wires, quiet — the card's toast is the gesture's voice:
      // model → Topaz mode, micrographs follow the training input
      await get().connect(train.id, pick.id, "model", "topazModel", { quiet: true });
      await get().connect(source.id, pick.id, feed.fromPort, "micrographs", { quiet: true });
      toast({
        title: "Topaz Pick minted",
        description:
          "Auto-picking (Topaz mode) wired to the trained model, micrographs inherited from the training input — review the params and run.",
      });
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to mint the Topaz pick");
    }
  },

  /** t559 — the denoise→pick handoff. Same family form as
   *  pickWithTopazModel, one wire fewer: the denoised stack IS the
   *  micrographs source (the output star keeps the micrograph schema),
   *  so the minted pick needs no inheritance — its one mouth feeds
   *  straight from the denoise output, and the topazModel mouth stays
   *  honestly empty (the general model picks until a trained one
   *  exists — that's the train→pick card's job, t558). */
  pickWithDenoisedStack: async (fromJobId) => {
    const { jobs } = get();
    const denoise = jobs.find((j) => j.id === fromJobId);
    if (!denoise || denoise.type !== "topazdenoise") {
      errToast("That job is gone — refresh and try again");
      return;
    }
    if (denoise.status !== "completed") {
      errToast("The denoised stack isn't ready yet — wait for the run to complete");
      return;
    }
    try {
      const place = placeRightOf(denoise, jobs);
      // the pick starts where the denoise ended for the knobs the two
      // stages share (downscale, workers); the pick's own dials keep
      // their spec defaults — nothing here is inherited on faith
      const params: Record<string, ParamValue> = {
        pickingMethod: "Topaz",
        topazNrParticles: 300,
        topazThreshold: -6,
        topazDiameter: 180,
        topazDownscale: denoise.params.topazDownscale ?? -1,
        topazWorkers: denoise.params.topazWorkers ?? 1,
        topazArgs: "",
      };
      const { job: pick } = await api<{ job: JobDTO }>("/api/jobs", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          type: "autopick",
          x: place.x,
          y: place.y,
          workspaceId: denoise.workspaceId ?? undefined,
          params,
        }),
      });
      set({
        jobs: [...get().jobs, pick],
        selectedId: pick.id,
        selectedIds: [pick.id],
      });
      get().invalidateRedo();
      get().focusJob(pick.id);
      // one quiet wire — the card's toast is the gesture's voice
      await get().connect(denoise.id, pick.id, "micrographs", "micrographs", { quiet: true });
      toast({
        title: "Topaz Pick minted",
        description:
          "Auto-picking (Topaz mode) wired to the denoised stack — the general model picks it until you train one. Review the params and run.",
      });
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to mint the Topaz pick");
    }
  },

  connect: async (from, to, fromPort, toPort, opts) => {
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
    const fromName = fromJob?.name ?? "Job";
    const toName = toJob?.name ?? "job";
    // t359 — THE WIRE DRAWS NOW. The old flow awaited the full API round
    // trip before set(); on a dev server that round trip can sit behind a
    // cold route compile or a watcher rebuild for seconds, so the line the
    // user just drew only appeared after an HMR remount — the field
    // receipt「连线卡一会，hmr 热加载之后线才连上」. The edge id is minted
    // CLIENT-side and sent along, so the optimistic wire and the persisted
    // row share one id (a delete racing this creation hits the right row);
    // persistence runs in the background and a rejection rolls the wire
    // back with a toast.
    const optimisticId = crypto.randomUUID();
    unconfirmedEdges.add(optimisticId);
    set({
      edges: [
        ...get().edges,
        { id: optimisticId, fromJobId: from, toJobId: to, fromPort, toPort },
      ],
      pendingFrom: null,
    });
    // wire edits have no id-stable inverse (re-creating mints a new edge
    // row) — they live outside the history stack and kill the redo branch
    get().invalidateRedo();
    // t442 — quiet mode: the duplication receipt speaks for the batch;
    // per-wire announcements would bury it under N toasts
    if (!opts?.quiet) {
      toast({ title: "Connected", description: `${fromName} → ${toName}` });
    }
    try {
      const { edge } = await api<{ edge: EdgeDTO }>("/api/edges", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          id: optimisticId,
          fromJobId: from,
          toJobId: to,
          fromPort,
          toPort,
        }),
      });
      // deleted while the POST was in flight — the user already saw the
      // wire go; finish the job now that the row is real
      if (doomedCreates.delete(optimisticId)) {
        void api(`/api/edges/${edge.id}`, { method: "DELETE" }).catch(() => {});
        return;
      }
      // the server stays the truth for auto-wired ports, and for the id
      // when a legacy caller skipped ours — swap only on a real difference
      if (
        edge.id !== optimisticId ||
        edge.fromPort !== fromPort ||
        edge.toPort !== toPort
      ) {
        set({
          edges: get().edges.map((e) => (e.id === optimisticId ? edge : e)),
        });
      }
    } catch (err) {
      const doomed = doomedCreates.delete(optimisticId);
      if (doomed) {
        // the wire was deleted while its POST was in flight — the delete
        // already stood optimistically; never resurrect it
      } else if ((err as Error & { status?: number }).status === 409) {
        // the row IS there — an earlier attempt persisted it but its
        // response never made it back (dev-server compile window, reload).
        // Adopt the server's truth instead of rolling back into a store
        // that would keep hiding a live wire.
        try {
          const fresh = await api<{ edges: EdgeDTO[] }>("/api/edges");
          set({ edges: fresh.edges });
        } catch {
          set({ edges: get().edges.filter((e) => e.id !== optimisticId) });
          toast({
            title: "Connection refused",
            description: err instanceof Error ? err.message : "Failed to connect",
            variant: "destructive",
          });
        }
      } else {
        set({ edges: get().edges.filter((e) => e.id !== optimisticId) });
        const msg = err instanceof Error ? err.message : "Failed to connect";
        toast({ title: "Connection refused", description: msg, variant: "destructive" });
      }
    } finally {
      unconfirmedEdges.delete(optimisticId);
    }
  },

  removeEdge: async (id) => {
    const victim = get().edges.find((e) => e.id === id);
    if (!victim) return; // already gone (a second click on a dying chip)
    // t359 — THE WIRE VANISHES NOW (same receipt as connect: never make
    // the visible canvas wait on an API round trip); persistence runs in
    // the background and a real failure restores it with a toast.
    set({ edges: get().edges.filter((e) => e.id !== id) });
    get().invalidateRedo();
    toast({ title: "Edge removed" });
    if (unconfirmedEdges.has(id)) {
      // its POST is still in the air — a DELETE now would 404 against a row
      // that does not exist yet and the landing POST would resurrect the
      // wire as a ghost; mark it doomed and let connect()'s landing path
      // fire the delete when the row is real
      doomedCreates.add(id);
      return;
    }
    try {
      await api(`/api/edges/${id}`, { method: "DELETE" });
      // 404 = the row was already gone server-side — the wire IS removed,
      // exactly what was asked; anything else restores it
    } catch (err) {
      if ((err as Error & { status?: number }).status !== 404) {
        set({ edges: [...get().edges, victim] });
        errToast(err instanceof Error ? err.message : "Failed to remove edge");
      }
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
    // t383 — the freshness seal: this poll may only apply positions for
    // writes that were already CONFIRMED when it started (see the guard
    // block at the top of the file)
    const genStart = snapshotPosGen();
    try {
      // t393 — the version token rides the poll: an unmoved canvas answers
      // ~40 bytes and this tick is over before the merge chain ever runs
      // (no parse of a full array, no tombstone/held-position passes, no
      // reference-stability compare — the server already proved the exact
      // body identical). The first tick after boot sends null → full body
      // → the token lands. A token from ANOTHER project can never alias
      // (the hash mixes the project id server-side).
      const token = get().jobsVersion;
      const data = await api<{
        jobs?: JobDTO[];
        version?: string;
        unchanged?: boolean;
      }>(token ? `/api/jobs?v=${encodeURIComponent(token)}` : "/api/jobs");
      if (data.unchanged) return; // identical tick on the wire — zero work downstream
      const fetched = data.jobs ?? [];
      const version = data.version ?? null;
      // t370 — the tombstone filter runs BEFORE the reference-stability
      // merge: this GET may have STARTED before a delete committed (the
      // pollInFlight guard only stops overlaps, not stale responses), and
      // the merge below would happily re-add the deleted id — the
      // vanish → reappear → vanish flicker of the field report. Filtering
      // first also keeps the identical-tick fast path honest: prev (the
      // post-delete store) and the filtered list agree, so the tick stays
      // a zero-render no-op instead of resurrecting and re-deleting.
      const jobs = withoutResurrectedJobs(fetched);
      // t383 — a poll that started before a drag/tidy write (or while it
      // was in the air) carries PRE-write positions; stamping the newest
      // local x/y back over them turns the stale response into a no-op
      // instead of the snapback-rubber-band (the delayed-drag race)
      const jobsHeld = preserveHeldPositions(jobs, genStart);
      // reference stability: reuse the previous object for every job whose
      // fields did not change (JSON.parse gives brand-new refs each time)
      let changed = prev.length !== jobsHeld.length;
      const merged = prev.length === jobsHeld.length
        ? jobsHeld.map((j, i) => {
            const old = prev[i];
            if (old && old.id === j.id && jobEquals(old, j)) return old;
            changed = true;
            return j;
          })
        : jobsHeld;
      if (!changed) {
        // the body DID move (the token flipped) but nothing the UI renders
        // did — adopt the fresh token so the next no-op heartbeat is a
        // 40-byte round trip instead of another full pull (e.g. an internal
        // ledger field that never rides the DTO, like outputProbeAt,
        // changed; jobEquals correctly ignored it)
        if (version !== get().jobsVersion) set({ jobsVersion: version });
        return; // identical tick — zero re-renders
      }
      set({ jobs: merged, jobsVersion: version });
      // announce transitions running → completed / failed, and pending →
      // running (the AUTO-START engine kicked a downstream job once its
      // upstream inputs landed — nobody clicked Run for this)
      //
      // Task 146 — the avalanche cure. TOAST_LIMIT is 1, so this sweep's
      // synchronous toast loop used to silently swallow every finisher
      // but the LAST one whenever several became final in the same tick:
      // N facts landed, N-1 were never spoken. The sweep now collects
      // first and announces after — auto-started notices go out first
      // (light news; the teal breathing ring already carries the state),
      // then either a single finisher keeps its FULL announcement (fact
      // title + result + View bridge, the t145 contract verbatim) or one
      // digest toast speaks for the whole batch: title in the census
      // dialect (the glance layer says COUNTS), one roster line per
      // finisher in the very form its swallowed announcement would have
      // had (the reading layer says TIME), destructive whenever the
      // batch carries any failure (alarm outranks alive — the favicon
      // doctrine). A digest carries no View bridge: it is a summary,
      // not a door — but since Task 149 every roster LINE is its own
      // door (a line names exactly one job, so its click has exactly
      // one destination; the summary is the foyer with the directory).
      const finished: Array<{ job: JobDTO; kind: "completed" | "failed" }> = [];
      const kicked: JobDTO[] = [];
      for (const job of merged) {
        const before = prev.find((p) => p.id === job.id);
        if (before?.status !== "running") {
          if (before?.status === "pending" && job.status === "running") {
            kicked.push(job); // collect — the aggregation law below speaks for the batch
          }
          continue;
        }
        if (job.status === "completed" || job.status === "failed") {
          finished.push({ job, kind: job.status });
        }
      }
      // Task 147 — the light half of the sweep now obeys the same
      // aggregation law as the heavy half: two kickoffs in one tick used
      // to swallow the first auto-started notice exactly the way two
      // completions used to swallow their announcements. One kickoff
      // keeps its full notice (now with the same 9s expiry every other
      // news carries — a state that lives on the card's teal ring has no
      // reason to camp on the toast slot); several kickoffs get one
      // digest: census-count title, one roster line per kicked job in
      // the very form its swallowed notice would have had. No elapsed
      // lines here — a kickoff is a beginning, it has no duration to
      // read yet; no View bridge for the digest (a summary, not a door).
      // Announced BEFORE the finished news: the completion is the
      // heavyweight fact and keeps winning the TOAST_LIMIT=1 slot
      // (Task 146's ruling, preserved).
      if (kicked.length === 1) {
        // Task 150 — the notice names its cause when the wires can back
        // it: "After <upstream> completed — running now". The digest's
        // roster below keeps the bare name form (the aggregation's cost
        // is detail leaving — Task 146's ruling, unchanged).
        const up = kickoffUpstream(
          get,
          kicked[0].id,
          merged,
          new Set(finished.map((f) => f.job.id)),
        );
        toast({
          title: `${kicked[0].name} auto-started`,
          description: up
            ? `After ${up} completed — running now`
            : "Upstream inputs became ready — running now",
          duration: 9_000, // news expires — the teal breathing ring carries the state
        });
      } else if (kicked.length >= 2) {
        const ROSTER_CAP = 8;
        const all = kicked.map((job) => ({ job, text: `${job.name} auto-started` }));
        const shown = all.slice(0, ROSTER_CAP);
        const tail = all.length > ROSTER_CAP ? `… and ${all.length - ROSTER_CAP} more` : undefined;
        toast({
          title: `${kicked.length} auto-started`,
          description: announceRoster(get, shown, tail),
          duration: 9_000, // same expiry — the running census lives in footer, tab, favicon
        });
      }
      const [solo, ...rest] = finished;
      if (solo && rest.length === 0) {
        const { job, kind } = solo;
        if (kind === "completed") {
          toast({
            title: `${job.name} completed${announceElapsed(job)}`,
            description: job.result ?? undefined,
            action: announceViewAction(get, job.id, job.name),
            duration: 9_000, // news expires — the state itself lives in the chrome census (card, footer, tab)
          });
        } else {
          toast({
            title: `${job.name} failed${announceElapsed(job)}`,
            description: job.result ?? undefined,
            variant: "destructive",
            // Task 151 — the alarm's two bridges: View (go read) and
            // Retry (go act). A wrapped flex keeps the pair together on
            // the right; justify-between would otherwise split them.
            action: React.createElement(
              "div",
              { className: "flex shrink-0 gap-2" },
              announceViewAction(get, job.id, job.name),
              announceRetryAction(get, job.id, job.name),
            ),
            duration: 9_000, // same expiry; the rose alarm lives on the card and the favicon
          });
        }
      } else if (rest.length > 0) {
        const completedN = finished.filter((f) => f.kind === "completed").length;
        const failedN = finished.length - completedN;
        const parts: string[] = [];
        if (completedN) parts.push(`${completedN} completed`);
        if (failedN) parts.push(`${failedN} failed`);
        // the roster cap: a roll call must be finishable — beyond 8 lines
        // the digest counts the remainder instead of reciting it
        const ROSTER_CAP = 8;
        const all = finished.map(({ job, kind }) => ({ job, text: `${job.name} ${kind}${announceElapsed(job)}` }));
        const shown = all.slice(0, ROSTER_CAP);
        const tail = all.length > ROSTER_CAP ? `… and ${all.length - ROSTER_CAP} more` : undefined;
        toast({
          title: parts.join(" · "),
          description: announceRoster(get, shown, tail),
          variant: failedN ? "destructive" : undefined,
          duration: 9_000, // same expiry — the roster itself lives in the chrome census
        });
      }
    } catch {
      // polling errors are transient — keep the interval alive
    } finally {
      pollInFlight = false;
    }
  },

  select: (id) => set({ selectedId: id, selectedIds: id ? [id] : [] }),
  stepArrowFocus: (id, extend) =>
    set((s) =>
      extend
        ? {
            selectedId: id,
            selectedIds: s.selectedIds.includes(id)
              ? s.selectedIds
              : [...s.selectedIds, id],
          }
        : { selectedId: id, selectedIds: [id] }
    ),

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
    const { deleted } = await get().removeJobsRaw(ids);
    const failed = ids.length - deleted.length;
    const deletedSet = new Set(deleted);
    // the undo payload covers the FULFILLED deletions only
    const undoSnapshot: DeleteSnapshot = {
      jobs: snapshot.jobs.filter((j) => deletedSet.has(j.id)),
      edges: snapshot.edges,
    };
    // Task 104 — same entry shared by the toast button and Ctrl+Z
    const entry: HistoryEntry | null = undoSnapshot.jobs.length
      ? {
          label: `Delete ${undoSnapshot.jobs.length} job${undoSnapshot.jobs.length === 1 ? "" : "s"}`,
          kind: "delete",
          undo: async () => {
            await get().undoDelete(undoSnapshot);
          },
          redo: async () => {
            await get().removeJobsRaw(deleted, { keepSelection: true });
          },
        }
      : null;
    if (entry) {
      set((s) => ({
        historyPast: [...s.historyPast, entry].slice(-HISTORY_CAP),
        historyFuture: [],
      }));
    }
    const undoAction = entry
      ? (React.createElement(
          ToastAction,
          { altText: "Undo the delete", onClick: () => void get().undoEntry(entry) },
          "Undo"
        ) as unknown as ToastActionElement)
      : undefined;
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
      // t447 — batch names are reserved up front: every twin's claim blocks
      // the next one, so two same-type sources become (copy) and (copy) 2
      // instead of two identical (copy)s
      const twinNames = twinNamesFor(sel, get().jobs.map((j) => j.name));
      // phase 1 — copy the jobs in parallel (each POST scalar-filters its
      // params against the type schema server-side, same as single add)
      const copies = await Promise.all(
        sel.map((src, i) =>
          api<{ job: JobDTO }>("/api/jobs", {
            method: "POST",
            headers: JSON_HEADERS,
            body: JSON.stringify({
              type: src.type,
              x: clamp(src.x + 48, WORLD_MIN, WORLD_MAX - CARD_W),
              y: clamp(src.y + 40, WORLD_MIN, WORLD_MAX - CARD_H),
              name: twinNames[i],
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
      get().invalidateRedo();
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

  moveJobsCommit: async (moves, opts) => {
    if (moves.length === 0) return;
    const map = new Map(moves.map((m) => [m.id, m] as const));
    // before-positions must be read BEFORE the optimistic set: the drag
    // never touches the store mid-gesture (CSS transform + direct SVG
    // patching own the screen until pointer-up), so get().jobs right here
    // IS the pre-drag truth — the one snapshot undo can be faithful to
    const beforeMoves =
      opts?.history === false
        ? null
        : moves
            .map((m) => {
              const j = get().jobs.find((x) => x.id === m.id);
              return j ? { id: m.id, x: j.x, y: j.y, name: j.name } : null;
            })
            .filter((v): v is { id: string; x: number; y: number; name: string } => v !== null)
            .filter((v) => {
              const m = map.get(v.id);
              return m ? m.x !== v.x || m.y !== v.y : false;
            });
    set({
      jobs: get().jobs.map((j) => {
        const m = map.get(j.id);
        return m ? { ...j, x: m.x, y: m.y } : j;
      }),
    });
    // t383 — batch write in flight: same anti-snapback hold, refcounted;
    // success bumps the generation for every id in the batch
    const releaseMoves = holdPositions(moves.map((m) => m.id));
    try {
      await api("/api/jobs/layout", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ updates: moves }),
      });
      confirmPositions(moves.map((m) => m.id));
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to save positions");
    } finally {
      releaseMoves();
    }
    if (beforeMoves && beforeMoves.length > 0) {
      const entry: HistoryEntry = {
        label:
          beforeMoves.length === 1
            ? `Move ${beforeMoves[0].name}`
            : `Move ${beforeMoves.length} jobs`,
        kind: "move",
        undo: async () => {
          await get().moveJobsCommit(
            beforeMoves.map(({ id, x, y }) => ({ id, x, y })),
            { history: false }
          );
        },
        redo: async () => {
          await get().moveJobsCommit(moves, { history: false });
        },
      };
      set((s) => ({
        historyPast: [...s.historyPast, entry].slice(-HISTORY_CAP),
        historyFuture: [],
      }));
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
  setLastSweep: (s) => set({ lastSweep: s }),
  consumeClassFocus: () => set({ pendingClassFocus: null }),
  setTemplatePresetsOpen: (open) => set({ templatePresetsOpen: open }),

  loadCustomTemplates: async () => {
    try {
      const { templates } = await api<{ templates: CustomTemplateSummary[] }>(
        "/api/custom-template"
      );
      set({ customTemplates: templates });
    } catch {
      // transient — the dialog renders the last known list; the next open
      // retries (load is also called on every dialog mount)
    }
  },

  saveSelectionTemplate: async (name) => {
    const trimmed = name.trim().slice(0, 80);
    if (!trimmed) {
      errToast("Give the template a name first");
      return false;
    }
    const { selectedIds, jobs, edges } = get();
    // canvas order (jobs array), not pick order — a template is a SHAPE,
    // and shapes read best in the order they were laid out
    const sel = jobs.filter((j) => selectedIds.includes(j.id));
    if (sel.length === 0) {
      errToast("Select jobs on the canvas first");
      return false;
    }
    // normalize positions to the selection's bbox top-left — the saved
    // shape survives, the absolute canvas position stays free
    const minX = Math.min(...sel.map((j) => j.x));
    const minY = Math.min(...sel.map((j) => j.y));
    const idx = new Map(sel.map((j, i) => [j.id, i]));
    const payload: CustomTemplatePayload = {
      jobs: sel.map((j) => ({
        type: j.type,
        dx: Math.round(j.x - minX),
        dy: Math.round(j.y - minY),
        params: j.params,
      })),
      // only edges whose BOTH endpoints are in the selection — wires to
      // the outside world are context, not shape (the applied copy gets
      // fresh neighbors where it lands)
      edges: edges
        .filter((e) => idx.has(e.fromJobId) && idx.has(e.toJobId))
        .map((e) => ({
          from: idx.get(e.fromJobId) as number,
          to: idx.get(e.toJobId) as number,
          ...(e.fromPort ? { fromPort: e.fromPort } : {}),
          ...(e.toPort ? { toPort: e.toPort } : {}),
        })),
    };
    try {
      const { template } = await api<{ template: CustomTemplateSummary }>(
        "/api/custom-template",
        {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify({ name: trimmed, payload }),
        }
      );
      set({ customTemplates: [template, ...get().customTemplates] });
      toast({
        title: `Template “${template.name}” saved`,
        description: `${template.jobCount} jobs · ${template.edgeCount} wires — apply it from the template presets dialog`,
      });
      return true;
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to save the template");
      return false;
    }
  },

  applyCustomTemplate: async (id) => {
    try {
      const tpl = get().customTemplates.find((t) => t.id === id);
      const data = await api<{ jobs: JobDTO[]; edges: EdgeDTO[]; workspaceId: string }>(
        "/api/custom-template",
        {
          method: "PUT",
          headers: JSON_HEADERS,
          body: JSON.stringify({ id, workspaceId: get().activeWorkspaceId ?? undefined }),
        }
      );
      const have = new Set(get().jobs.map((j) => j.id));
      const haveEdges = new Set(get().edges.map((e) => e.id));
      const landedJobs = data.jobs.filter((j) => !have.has(j.id));
      const landedEdges = data.edges.filter((e) => !haveEdges.has(e.id));
      const allJobs = [...get().jobs, ...landedJobs];
      const allEdges = [...get().edges, ...landedEdges];
      set({
        jobs: allJobs,
        edges: allEdges,
        layoutEpoch: get().layoutEpoch + 1, // canvas fit-views the new content
      });
      // Task 129 — the applied body is an island: propose wires from its
      // free boundary inputs to same-workspace donors' free outputs. The
      // chip is dismissible and navigation clears it — a suggestion never
      // wires anything by itself.
      const suggestions = suggestTemplateConnections(
        landedJobs.map((j) => j.id),
        allJobs,
        allEdges
      );
      set({
        templateSuggestions:
          suggestions.length > 0
            ? { workspaceId: data.workspaceId, items: suggestions }
            : null,
      });
      get().invalidateRedo();
      toast({
        title: `Template “${tpl?.name ?? "snippet"}” applied`,
        description: `${data.jobs.length} jobs · ${data.edges.length} wire${data.edges.length === 1 ? "" : "s"} placed below this workspace's content`,
      });
      return true;
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to apply the template");
      return false;
    }
  },

  applyTemplateSuggestions: async (items) => {
    const s = get().templateSuggestions;
    if (!s || items.length === 0) return;
    // fire the batches through the manual drag's endpoint — the server
    // re-validates every pair, and a refusal (spec drift since the
    // suggestion was computed) simply drops out of the merge
    const results = await Promise.allSettled(
      items.map((it) =>
        api<{ edge: EdgeDTO }>("/api/edges", {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify({
            fromJobId: it.fromJobId,
            toJobId: it.toJobId,
            fromPort: it.fromPort,
            toPort: it.toPort,
          }),
        })
      )
    );
    const landed: EdgeDTO[] = [];
    for (const r of results) {
      // api() parses the body AND throws on non-OK — a fulfilled settle
      // already carries the edge object
      if (r.status === "fulfilled" && r.value?.edge?.id) {
        landed.push(r.value.edge);
      }
    }
    const have = new Set(get().edges.map((e) => e.id));
    const fresh = landed.filter((e) => e?.id && !have.has(e.id));
    if (fresh.length > 0) {
      set({ edges: [...get().edges, ...fresh] });
      get().invalidateRedo();
    }
    set({ templateSuggestions: null });
    const refused = items.length - fresh.length;
    toast({
      title: fresh.length > 0 ? `Connected ${fresh.length} suggested wire${fresh.length === 1 ? "" : "s"}` : "Nothing connected",
      description:
        refused > 0
          ? `${refused} suggestion${refused === 1 ? " was" : "s were"} refused (port specs may have drifted) — wire it by hand if needed`
          : "The template is wired into its neighbors",
      ...(fresh.length === 0 ? { variant: "destructive" as const } : {}),
    });
  },

  dismissTemplateSuggestions: () => set({ templateSuggestions: null }),

  deleteCustomTemplate: async (id) => {
    const victim = get().customTemplates.find((t) => t.id === id);
    // optimistic removal — a deleted row must not linger in the dialog
    set({ customTemplates: get().customTemplates.filter((t) => t.id !== id) });
    try {
      await api(`/api/custom-template?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch (err) {
      // roll back so the row stays deletable (and honest)
      if (victim) set({ customTemplates: [victim, ...get().customTemplates] });
      errToast(err instanceof Error ? err.message : "Failed to delete the template");
    }
  },

  exportCustomTemplate: async (id) => {
    try {
      const { template } = await api<{
        template: {
          id: string;
          name: string;
          payload: CustomTemplatePayload;
          createdAt: string;
          project: string;
        };
      }>(`/api/custom-template?id=${encodeURIComponent(id)}`);
      const file = buildTemplateFile(template.name, template.payload, template.project);
      downloadTemplateJson(file, templateFileName(template.name));
      toast({
        title: `Template “${template.name}” exported`,
        description: `${file.payload.jobs.length} jobs · ${file.payload.edges.length} wires — import the .json into any project's shelf`,
      });
      return true;
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to export the template");
      return false;
    }
  },

  // Task 132 — rename: PATCH returns the updated summary and the SERVER
  // name lands in the shelf (trimmed/capped by the same rules as POST);
  // the row updates in place — createdAt is untouched, so the reading
  // order never jumps under the user's eye.
  renameCustomTemplate: async (id, name) => {
    try {
      const { template } = await api<{
        template: CustomTemplateSummary;
      }>(`/api/custom-template?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      set((s) => ({
        customTemplates: s.customTemplates.map((t) =>
          t.id === id ? { ...t, name: template.name } : t
        ),
      }));
      return true;
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to rename the template");
      return false;
    }
  },

  // Task 130 — export ALL: one fetch with payloads, one bundle file. The
  // server is the truth (GET ?all=1 re-serves what POST validated); the
  // skipped count (corrupt rows the server could not parse) surfaces in
  // the toast so the bundle's contents are never silently less than the shelf.
  exportAllCustomTemplates: async () => {
    try {
      const { templates, skipped } = await api<{
        templates: {
          id: string;
          name: string;
          payload: CustomTemplatePayload;
          createdAt: string;
          project: string;
        }[];
        skipped?: number;
      }>("/api/custom-template?all=1");
      if (!templates?.length) {
        toast({
          title: "Shelf is empty",
          description: "Nothing to export — save a selection as a template first",
        });
        return false;
      }
      const bundle = buildTemplateBundle(
        templates.map((t) => buildTemplateFile(t.name, t.payload, t.project)),
        templates[0].project
      );
      downloadTemplateBundleJson(bundle, templateBundleFileName());
      toast({
        title: `${templates.length} template${templates.length === 1 ? "" : "s"} exported as one bundle`,
        description: `${skipped ? `${skipped} corrupt row${skipped === 1 ? "" : "s"} skipped · ` : ""}import the .json into any project's shelf — it expands back into individual templates`,
      });
      return true;
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to export the templates");
      return false;
    }
  },

  // Task 130 — clear the shelf: one project-scoped deleteMany. Optimistic
  // clear keeps the dialog honest instantly; a failed request rolls the
  // snapshot back so nothing disappears without the server agreeing.
  clearCustomTemplates: async () => {
    const snapshot = get().customTemplates;
    if (snapshot.length === 0) return 0;
    set({ customTemplates: [] });
    try {
      const { deleted } = await api<{ ok: boolean; deleted: number }>(
        "/api/custom-template?all=1",
        { method: "DELETE" }
      );
      toast({
        title: "Shelf cleared",
        description: `${deleted} template${deleted === 1 ? "" : "s"} removed — import a bundle or re-save from the canvas to rebuild it`,
      });
      return deleted;
    } catch (err) {
      set({ customTemplates: snapshot }); // roll back so every row stays deletable
      errToast(err instanceof Error ? err.message : "Failed to clear the templates");
      return 0;
    }
  },

  importCustomTemplateFiles: async (files) => {
    // client pre-parse — instant, specific feedback without a round-trip;
    // each entry then goes through the authoritative POST (same endpoint
    // the selection save uses, so an imported template is INDISTINGUISHABLE
    // from a hand-saved one — provenance is not a second-class citizen)
    const { entries, failures } = await parseTemplateFiles(files);
    let imported = 0;
    let firstTemplateName: string | null = null;
    for (const entry of entries) {
      try {
        const { template } = await api<{ template: CustomTemplateSummary }>(
          "/api/custom-template",
          {
            method: "POST",
            headers: JSON_HEADERS,
            body: JSON.stringify({ name: entry.file.name, payload: entry.file.payload }),
          }
        );
        set({ customTemplates: [template, ...get().customTemplates] });
        imported++;
        if (!firstTemplateName) firstTemplateName = template.name;
      } catch (err) {
        failures.push({
          fileName: entry.fileName,
          error: err instanceof Error ? err.message : "Import failed",
        });
      }
    }
    // server is the truth after a multi-POST batch — re-read once so the
    // shelf order (createdAt desc) is exactly what a reopen would show
    await get().loadCustomTemplates();

    const versionWarnings = entries
      .map((e) => e.warning)
      .filter((w): w is string => !!w);
    if (imported > 0 && failures.length === 0) {
      toast({
        title:
          imported === 1
            ? `Template “${firstTemplateName}” imported`
            : `${imported} templates imported`,
        description:
          versionWarnings[0] ??
          `${files.length === 1 ? files[0].name : `${files.length} files`} — apply from the shelf, edit or delete like any saved template`,
      });
    } else if (imported > 0) {
      toast({
        title: `Imported ${imported} · ${failures.length} failed`,
        description: failures[0]?.error ?? "Some files could not be imported",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Import failed",
        description: failures[0]?.error ?? "No readable template files",
        variant: "destructive",
      });
    }
    return { imported, failed: failures.length, firstError: failures[0]?.error };
  },

  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
  setHelpGuideOpen: (open) => set({ helpGuideOpen: open }),
  setAiAssistantOpen: (open) => set({ aiAssistantOpen: open }),
  openAiAssistant: (prompt) =>
    set((s) => ({
      aiAssistantOpen: true,
      aiSummonSeq: s.aiSummonSeq + 1,
      ...(prompt ? { aiPendingPrompt: prompt } : {}),
    })),
  consumeAiPendingPrompt: () => {
    const p = get().aiPendingPrompt;
    if (p) set({ aiPendingPrompt: null });
    return p;
  },
  refreshEdges: async () => {
    try {
      const fresh = await api<{ edges: EdgeDTO[] }>("/api/edges");
      set({ edges: fresh.edges });
    } catch {
      /* the next poll round retries the canvas truth */
    }
  },
  setAiSettingsOpen: (open) => set({ aiSettingsOpen: open }),
  setMinimapOpen: (open) => set({ minimapOpen: open }),
  toggleNoteSpotlight: () => set((s) => ({ noteSpotlight: !s.noteSpotlight })),
  openFind: () => set((s) => (s.findOpen ? s : { findOpen: true })),
  closeFind: () => set({ findOpen: false, findQuery: "", findStatus: "all", findCategory: "all" }),
  setFindQuery: (q) => set({ findQuery: q }),
  setFindStatus: (s) => set({ findStatus: s }),
  setFindCategory: (c) => set({ findCategory: c }),
  // Task 153 — the explicit chevron is the ONLY write path: storage
  // echoes user intent, never render state.
  setKpiCollapsed: (c) => {
    persistKpiCollapsed(c);
    set({ kpiCollapsed: c });
  },

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

  revealJob: (id) => {
    // guard against a stale row: the dashboard can outlive a deleted job by
    // one poll — revealing a ghost would center an empty viewport
    const job = get().jobs.find((j) => j.id === id);
    if (!job) return;
    get().setView("canvas");
    // cross-workspace rows land in the job's home workspace first (the
    // canvas renders active-workspace jobs only — same spirit as the
    // recent-activity deep link switching projects before opening);
    // switchWorkspace clears selection, so select AFTER the landing
    if ((job.workspaceId ?? "") !== (get().activeWorkspaceId ?? "")) {
      get().switchWorkspace(job.workspaceId ?? "");
    }
    get().select(id);
    get().focusJob(id);
  },

  openJob: async (id, hint) => {
    const findJob = () => get().jobs.find((j) => j.id === id);
    const homeWs = (j) => j?.workspaceId ?? "";
    // 1. landing repair. jobs in the store belong to the ACTIVE project —
    // a hit here can only need a workspace hop; a miss is either a ghost
    // or a cross-project row (the hint decides which).
    let job = findJob();
    if (job) {
      const h = homeWs(job);
      // same-project, other workspace → hop (switchWorkspace clears
      // selection, so select happens AFTER the landing, below). A
      // workspace id not in the list is an ORPHAN — the roster's adopt
      // flow already explains those; don't move them here.
      if (h && h !== (get().activeWorkspaceId ?? "") && get().workspaces.some((w) => w.id === h)) {
        get().switchWorkspace(h);
      }
    } else {
      const pid = hint?.projectId;
      if (!pid || pid === (get().project?.id ?? "")) return; // ghost
      await get().switchProject(pid);
      job = findJob();
      if (!job) return; // switched but the job vanished — a true ghost
      // switchProject landed on the project's FIRST workspace — hop to
      // the job's home workspace inside it
      const h = homeWs(job);
      if (h && h !== (get().activeWorkspaceId ?? "")) {
        get().switchWorkspace(h);
      }
    }
    get().setView("canvas");
    // 2. the open dialect — same contract as the palette's jumpToJob;
    // re-read after any load: a switch can replace the jobs array
    job = findJob();
    if (!job) return;
    if (job.status === "idle") {
      get().select(id);
      get().focusJob(id);
    } else {
      get().inspect(id);
    }
  },
}));

/* Cross-tab bookmark freshness (Task 102): a localStorage write fires a
 * `storage` event in every OTHER tab of the same origin — the writing tab
 * hears nothing, so there is no echo loop. Re-parse e.newValue and replace
 * the bookmark state wholesale: bookmark writes are synchronous, so
 * localStorage is the source of truth at event time, and the shared
 * parser revalidates every entry (corrupt payloads degrade to empty, never
 * trusted). e.key === null means another tab ran localStorage.clear() —
 * same treatment: a cleared store is cleared everywhere. The v1 migration
 * key is deliberately NOT listened for: migration happens once at hydrate
 * and writes v2, whose event carries the payload to every live tab.
 * sessionStorage (viewport memory) never fires storage events — the
 * per-tab contract from Task 99 survives untouched. */
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e: StorageEvent) => {
    if (e.key !== VIEWPORT_BOOKMARKS_KEY && e.key !== null) return;
    useWorkflowStore.setState({
      viewportBookmarks: parseViewportBookmarksRaw(e.key === null ? null : e.newValue),
    });
  });
}

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

/** Task 157 — the storage echo of the session position. Selection has
 *  17+ mutation sites across the canvas (click, arrows, marquee,
 *  Ctrl+A, add, import, delete, inspect, workspace switches) — wrapping
 *  each one invites the drift where a single forgotten site leaves a
 *  STALE seed that a reload would then faithfully restore as a ghost.
 *  So the echo lives at the ONE place every committed transition
 *  crosses: a post-commit store subscription. This is not the Task 13
 *  #13 sin — that condemned side effects DURING RENDER (useMemo); a
 *  subscription fires on state commits, between renders, and it writes
 *  only when selectedId actually changed. Storage thereby stays the
 *  echo of the position the user can SEE, whatever path moved it.
 *  Client-only: the server module load must never install it. */
if (typeof window !== "undefined") {
  let prevSelected = useWorkflowStore.getState().selectedId;
  useWorkflowStore.subscribe((s) => {
    if (s.selectedId !== prevSelected) {
      prevSelected = s.selectedId;
      persistSelectedJob(s.selectedId);
    }
  });
}

/* t444 — the staleness echo, same grammar as the selectedId echo above:
 * jobs/edges commits re-derive the wavefront ONCE, post-commit, between
 * renders; cards then read their slice through the store subscription.
 * The write only fires on a real jobs/edges change (staleMap changes
 * never re-enter this branch), so there is no loop. t445 — the same
 * commit also re-derives the drift verdict (one more pure pass over the
 * jobs it already holds); the two laws share the channel, not the
 * verdict. */
if (typeof window !== "undefined") {
  let prevJobs = useWorkflowStore.getState().jobs;
  let prevEdges = useWorkflowStore.getState().edges;
  useWorkflowStore.subscribe((s) => {
    if (s.jobs !== prevJobs || s.edges !== prevEdges) {
      prevJobs = s.jobs;
      prevEdges = s.edges;
      useWorkflowStore.setState({
        staleMap: findStaleJobs(s.jobs, s.edges),
        driftMap: findDriftedJobs(s.jobs),
      });
    }
  });
  // boot derivation: the initial load's commits pass through the same
  // subscription, but a hydrated store arriving pre-populated still
  // gets its wavefront here
  const boot = useWorkflowStore.getState();
  if (boot.jobs.length > 0) {
    useWorkflowStore.setState({
      staleMap: findStaleJobs(boot.jobs, boot.edges),
      driftMap: findDriftedJobs(boot.jobs),
    });
  }
}

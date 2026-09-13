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
import { formatElapsed } from "./elapsed";
import type {
  CustomTemplatePayload,
  CustomTemplateSummary,
  EdgeDTO,
  JobDTO,
  JobStatus,
  ProjectDTO,
  ProjectSummaryDTO,
  SystemStatusClient,
  TemplateOverrides,
  WorkspaceDTO,
} from "./types";
import type { ImportFailure, ImportPreviewEntry } from "./workflow-io";
import type { TemplateSuggestion } from "./template-suggest";
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
    a.note === b.note && // Task 164: judged-ness flows from this field — the header count, the lens tiers and the dashboard chip all read it; a poll that swallowed a note change would freeze all three (updatedAt happens to bump on every PATCH today, but the equality predicate must not DEPEND on that courtesy)
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
  focusEpoch: 0,
  templatePresetsOpen: false,
  templateSuggestions: null,
  customTemplates: [],
  shortcutsOpen: false,
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
        const seedJob = seed
          ? j.jobs.find((x) => x.id === seed && jobInWorkspace(x, activeWs))
          : null;
        if (seedJob) set({ selectedId: seedJob.id, selectedIds: [seedJob.id] });
      }
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
    const j0 = get().jobs.find((j) => j.id === id);
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

  runJob: async (id) => {
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
      const res = await fetch(`/api/jobs/${id}/run`, { method: "POST" });
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
          // running perfectly well.)
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
        toast({
          title: "Job waiting as pending",
          description:
            (started?.result ?? "Waiting for its upstream job to produce outputs.") +
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
      toast({ title: "Job started", description: `${started?.name ?? "Job"} is now running` });
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
      get().invalidateRedo(); // duplicate mints a new id — no faithful redo
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
      // wire edits have no id-stable inverse (re-creating mints a new edge
      // row) — they live outside the history stack and kill the redo branch
      get().invalidateRedo();
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
      get().invalidateRedo();
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
    try {
      await api("/api/jobs/layout", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ updates: moves }),
      });
    } catch (err) {
      errToast(err instanceof Error ? err.message : "Failed to save positions");
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

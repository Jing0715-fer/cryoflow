"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  Clock3,
  GripVertical,
  Search,
  Shapes,
  Star,
  X,
} from "lucide-react";
import { JOB_CATEGORIES, JOB_TYPES, jobType } from "@/lib/workflow";
import { useWorkflowStore } from "@/lib/store";
import { TypeIcon } from "./icons";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { capturePointer } from "@/lib/pointer";

interface PaletteDragState {
  type: string;
  pointerId: number;
  startX: number;
  startY: number;
  /** Past the 5px threshold — real drag with ghost + drop target. */
  active: boolean;
}

/** Task 155 — reordering a favorite chip. A SEPARATE drag family from
 *  drag-to-create (which owns PaletteDragState): a favorite chip is a
 *  click-to-add button first, and the two windows-level pointer flows
 *  must never share a ref — reordering a chip must never be able to
 *  drop a job onto the canvas, and vice versa. The 5px threshold is the
 *  same law as everywhere else: a pointer that never really moved is a
 *  click, and the chip's add contract survives untouched. */
interface FavDragState {
  type: string;
  pointerId: number;
  startX: number;
  startY: number;
  fromIndex: number;
  active: boolean;
}

const RECENT_KEY = "cryoflow-recent-types";
const RECENT_MAX = 6;

/** Task 133 — starred job types. Recents answer "what did I just use?",
 * favorites answer "what do I keep coming back to?" — a deliberate,
 * stable pick that survives restarts and never scrolls away. Order is
 * star order (first-starred first) — until the user drags a chip (or
 * Alt+arrows it): Task 155, the last explicit reorder WINS, and storage
 * holds the visual truth from then on. Star order remains the initial
 * arrangement and new stars still append at the tail; persistence is
 * localStorage with the same sanitize-or-default contract as recents. */
const FAV_KEY = "cryoflow-fav-types";

function readFavs(): string[] {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

function writeFavs(next: string[]): void {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify(next));
  } catch {
    /* private mode — favorites just won't persist */
  }
}

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string").slice(0, RECENT_MAX)
      : [];
  } catch {
    return [];
  }
}

function pushRecent(type: string): void {
  try {
    const next = [type, ...readRecent().filter((t) => t !== type)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* private mode — recents just won't persist */
  }
}

/**
 * Job type palette (RELION 5 catalog: 13 collapsible categories) —
 * drag-to-create onto the canvas. Keyboard fallback: Enter / Space adds the
 * job at the viewport center (legacy placement). Used in the desktop
 * sidebar and inside the mobile Sheet.
 *
 * Quick-add affordances: a "Recently used" chip row (click to add at the
 * viewport center) and "/" to focus search.
 *
 * Task 155 — the favorites row is orderable: drag a chip (or focus it and
 * press Alt+←/→) to reorder; the last explicit order wins and persists.
 * A chip is a click-to-add button first — the 5px drag threshold keeps
 * the add contract intact, the reorder drag lives in its own pointer
 * family (never drag-to-create's), and the amber caret only appears
 * where a drop would actually change the order.
 */
export function JobPalette({ onAdded }: { onAdded?: () => void }) {
  const addJob = useWorkflowStore((s) => s.addJob);

  const [query, setQuery] = React.useState("");
  // only the first category starts expanded (RELION job-browser feel)
  const [expanded, setExpanded] = React.useState<ReadonlySet<string>>(
    () => new Set(JOB_CATEGORIES.slice(0, 1).map((c) => c.key))
  );
  const [ghost, setGhost] = React.useState<{ type: string; x: number; y: number } | null>(null);
  const [recent, setRecent] = React.useState<string[]>([]);
  // Task 133 — favorites: star order, client-only until mount (hydration)
  const [favs, setFavs] = React.useState<string[]>([]);
  const [favOnly, setFavOnly] = React.useState(false);

  const dragRef = React.useRef<PaletteDragState | null>(null);
  // Task 155 — the reorder drag's OWN ref (never the drag-to-create one)
  const favDragRef = React.useRef<FavDragState | null>(null);
  // a drag that ended over the chip it started on must swallow the click
  // the browser still synthesizes — the pointer moved >5px, so it was a
  // reorder gesture, not an add
  const suppressFavClickRef = React.useRef(false);
  const [favDragType, setFavDragType] = React.useState<string | null>(null);
  // insertion caret: "the dropped chip would become index k" (0..len)
  const [favDropHint, setFavDropHint] = React.useState<number | null>(null);
  const ghostRef = React.useRef<HTMLDivElement>(null);
  const onAddedRef = React.useRef(onAdded);
  const searchRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    onAddedRef.current = onAdded;
  }, [onAdded]);

  // recents are client-only (localStorage) — load after mount to keep the
  // SSR output hydration-safe
  React.useEffect(() => {
    setRecent(readRecent());
    setFavs(readFavs());
  }, []);

  const favSet = React.useMemo(() => new Set(favs), [favs]);

  /** Star/unstar one type; the NEXT array persists (order = star order,
   *  unless a Task 155 reorder already overrode it — new stars still
   *  append at the tail of whatever order is current). */
  const toggleFavType = React.useCallback((type: string) => {
    setFavs((prev) => {
      const next = prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type];
      writeFavs(next);
      return next;
    });
  }, []);

  /** Task 155 — reorder helpers, on the EVENT path: compute the next
   *  array from the render-current favs, persist, then set. Never inside
   *  a setState updater — StrictMode double-invokes updaters and the
   *  storage write would double with it (the Task 13 #13 law, re-derived
   *  for updaters: an updater must stay pure). */
  const reorderFavs = React.useCallback(
    (fromIndex: number, insertAt: number) => {
      if (fromIndex < 0 || fromIndex >= favs.length) return;
      // normalize: after removal, an insert past the removal point slides
      // left by one; same-slot drops are a no-op (no write, no state
      // churn — a drag that lands where it started changed nothing and
      // must not pretend otherwise)
      const k = insertAt > fromIndex ? insertAt - 1 : insertAt;
      if (k === fromIndex) return;
      const next = [...favs];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(k, 0, moved);
      writeFavs(next);
      setFavs(next);
    },
    [favs]
  );

  /** Keyboard twin of the drag (Alt+Left/Right on a focused chip): the
   *  reorder must not be a pointer-only privilege. */
  const moveFav = React.useCallback(
    (fromIndex: number, dir: -1 | 1) => {
      const k = fromIndex + dir;
      if (fromIndex < 0 || k < 0 || k >= favs.length) return;
      const next = [...favs];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(k, 0, moved);
      writeFavs(next);
      setFavs(next);
    },
    [favs]
  );

  const recordAndAdd = React.useCallback(
    async (type: string) => {
      pushRecent(type);
      setRecent(readRecent());
      await addJob(type);
      onAddedRef.current?.();
    },
    [addJob]
  );

  // "/" focuses search (when not already typing somewhere)
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.closest("input, textarea, select, [contenteditable='true']") != null ||
          t.isContentEditable)
      ) {
        return;
      }
      if (document.querySelector('[role="dialog"][data-state="open"], [role="menu"][data-state="open"]')) {
        return;
      }
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  // favorites-only gate applies FIRST, then search narrows within it
  const baseTypes = favOnly ? JOB_TYPES.filter((t) => favSet.has(t.key)) : JOB_TYPES;
  const filtered = searching
    ? baseTypes.filter(
        (t) =>
          t.label.toLowerCase().includes(q) ||
          t.key.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
      )
    : baseTypes;

  /* ---------------- drag-to-create --------------------------------- */

  const cleanupDrag = () => {
    dragRef.current = null;
    setGhost(null);
    useWorkflowStore.getState().setPaletteDrag(null);
  };

  const handleItemPointerDown = (e: React.PointerEvent<HTMLButtonElement>, type: string) => {
    if (e.button !== 0) return;
    dragRef.current = {
      type,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
    };
    try {
      capturePointer(e);
    } catch {
      // capture is best-effort — the window listeners below cover the rest
    }
  };

  /** Task 155 — a favorite chip's pointerdown ARMS a reorder (never
   *  activates it): the 5px threshold decides drag-vs-click, and an
   *  un-armed pointerup lets the browser's click deliver the chip's add
   *  contract unchanged. */
  const handleFavChipPointerDown = (e: React.PointerEvent<HTMLButtonElement>, type: string) => {
    if (e.button !== 0) return;
    const fromIndex = favs.indexOf(type);
    if (fromIndex < 0) return;
    favDragRef.current = {
      type,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      fromIndex,
      active: false,
    };
  };

  React.useEffect(() => {
    /** Where would a drop at this point insert? Three answers: a chip
     *  under the pointer → its insertion index k (left of midpoint =
     *  before, right = after); a GAP inside the row → the last answer
     *  still stands (the pointer is between chips — that IS a position
     *  signal, and Task 155's first caret was a 2px flex item whose own
     *  appearance SHOVED the chips sideways and un-hit the pointer: a
     *  layout feedback loop that flickered the caret out of existence);
     *  outside the row entirely → null (a reorder is never guessed). */
    const favInsertIndex = (x: number, y: number): number | null | "inRow" => {
      const el = document.elementFromPoint(x, y);
      if (!el) return null;
      const chip = el?.closest("[data-fav-chip]") as HTMLElement | null;
      if (chip) {
        const idx = Number(chip.dataset.favChipIndex);
        if (!Number.isInteger(idx)) return null;
        const rect = chip.getBoundingClientRect();
        return x < rect.left + rect.width / 2 ? idx : idx + 1;
      }
      if (el.closest('[data-testid="palette-favs-row"]')) return "inRow";
      return null;
    };
    const cleanupFavDrag = () => {
      favDragRef.current = null;
      setFavDragType(null);
      setFavDropHint(null);
    };
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      if (!d.active) {
        if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 5) return;
        d.active = true;
        setGhost({ type: d.type, x: e.clientX, y: e.clientY });
        useWorkflowStore.getState().setPaletteDrag(d.type);
      }
      if (ghostRef.current) {
        ghostRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
      }
    };
    const onUp = (e: PointerEvent) => {
      // Task 155 first — the reorder family has its own lifecycle and
      // must never fall through into drag-to-create's drop logic
      const fd = favDragRef.current;
      if (fd && e.pointerId === fd.pointerId) {
        if (fd.active) {
          const k = favInsertIndex(e.clientX, e.clientY);
          if (typeof k === "number") {
            reorderFavs(fd.fromIndex, k);
            // the pointer moved far past the click threshold — whatever
            // click the browser synthesizes on top of this gesture is a
            // reorder's tail, not an add
            suppressFavClickRef.current = true;
          }
        }
        cleanupFavDrag();
        return;
      }
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      if (d.active) {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const canvasEl = el?.closest('[data-canvas="viewport"]');
        if (canvasEl instanceof HTMLElement) {
          const rect = canvasEl.getBoundingClientRect();
          const vp = useWorkflowStore.getState().viewport;
          const wx = (e.clientX - rect.left - vp.x) / vp.zoom;
          const wy = (e.clientY - rect.top - vp.y) / vp.zoom;
          pushRecent(d.type);
          setRecent(readRecent());
          void useWorkflowStore.getState().addJobAt(d.type, wx, wy);
          onAddedRef.current?.();
        }
      }
      cleanupDrag();
    };
    const onCancel = (e: PointerEvent) => {
      const fd = favDragRef.current;
      if (fd && e.pointerId === fd.pointerId) {
        cleanupFavDrag();
        return;
      }
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      cleanupDrag();
    };
    const onFavMove = (e: PointerEvent) => {
      const fd = favDragRef.current;
      if (!fd || e.pointerId !== fd.pointerId) return;
      if (!fd.active) {
        if (Math.hypot(e.clientX - fd.startX, e.clientY - fd.startY) < 5) return;
        fd.active = true;
        setFavDragType(fd.type);
      }
      if (fd.active) {
        const k = favInsertIndex(e.clientX, e.clientY);
        // hovering the dragged chip itself (k === fromIndex or fromIndex+1)
        // is a same-slot drop — no caret theater: the indicator appears
        // only where a drop would actually change something
        const sameSlot = typeof k === "number" && (k === fd.fromIndex || k === fd.fromIndex + 1);
        if (sameSlot) setFavDropHint(null);
        else if (k === "inRow") { /* gap between chips — the last hint stands */ }
        else setFavDropHint(k);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointermove", onFavMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointermove", onFavMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, [reorderFavs]);

  const toggleCategory = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const ghostSpec = ghost ? jobType(ghost.type) : undefined;
  const recentSpecs = recent
    .map((key) => jobType(key))
    .filter((t): t is NonNullable<typeof t> => t != null);
  const favSpecs = favs
    .map((key) => jobType(key))
    .filter((t): t is NonNullable<typeof t> => t != null);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ---- header: title + search ---- */}
      <div className="shrink-0 space-y-2.5 p-3 pb-2">
        <div className="flex items-center gap-2 px-1">
          <span
            className="flex size-6 items-center justify-center rounded-md bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-inset ring-primary/20"
            aria-hidden="true"
          >
            <Shapes className="size-3.5 text-primary" />
          </span>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Job Types
          </p>
          <button
            type="button"
            onClick={() => setFavOnly((v) => !v)}
            aria-pressed={favOnly}
            aria-label="Show favorites only"
            title={favOnly ? "Showing favorites only — click to show all" : "Show favorites only"}
            data-testid="palette-fav-filter"
            className={cn(
              "ml-auto flex size-5 items-center justify-center rounded transition-colors",
              favOnly
                ? "bg-amber-500/15 text-amber-600 ring-1 ring-inset ring-amber-500/40 dark:text-amber-400"
                : "text-muted-foreground/70 hover:bg-accent hover:text-foreground"
            )}
          >
            <Star className={cn("size-3", favOnly && "fill-amber-400 text-amber-500")} aria-hidden="true" />
          </button>
          <span
            className={cn(
              "rounded-full bg-muted/70 px-1.5 py-px text-[10px] font-medium tabular-nums text-muted-foreground",
              favOnly && "bg-amber-500/10 text-amber-700 dark:text-amber-400"
            )}
            title={`${filtered.length} of ${JOB_TYPES.length} types shown`}
          >
            {filtered.length}
          </span>
        </div>

        <div className="group/search relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within/search:text-primary" />
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                if (query) setQuery("");
                else e.currentTarget.blur();
              }
            }}
            placeholder="Search job types…"
            aria-label="Search job types"
            className="h-8 rounded-lg pl-8 pr-12 text-xs shadow-none transition-[box-shadow] focus-visible:ring-primary/40"
          />
          {!query && (
            <kbd
              className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border bg-muted/60 px-1 py-px font-mono text-[9px] leading-none text-muted-foreground/70 transition-opacity group-focus-within/search:opacity-0 sm:block"
              aria-hidden="true"
            >
              /
            </kbd>
          )}
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      </div>

      {/* ---- favorites quick-add chips (Task 133) ---- */}
      {!searching && favSpecs.length > 0 && (
        <div className="shrink-0 border-b bg-muted/25 px-3 py-2">
          <div className="mb-1.5 flex items-center gap-1.5">
            <Star className="size-3 fill-amber-400 text-amber-500" aria-hidden="true" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              Favorites
            </p>
            <span className="sr-only">— click a chip to add that job at the viewport center</span>
            <span
              className="ml-auto rounded-full bg-muted/80 px-1.5 py-px text-[9px] font-medium tabular-nums text-muted-foreground"
              data-testid="palette-favs-count"
            >
              {favSpecs.length}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5" data-testid="palette-favs-row">
            {favSpecs.map((t, i) => {
              const dragging = favDragType === t.key;
              // Task 155's insertion caret is an INSET SHADOW on the target
              // chip, not a flex item: a real element shoved the row sideways
              // when it appeared, which moved the chip from under the pointer
              // and killed the very hit that summoned it (flicker by layout
              // feedback). A shadow occupies NOTHING — the geometry the
              // pointer sees is the geometry the drop sees.
              const caretSide =
                favDropHint === i ? "before" : favDropHint === favSpecs.length && i === favSpecs.length - 1 ? "after" : null;
              return (
                <button
                  key={t.key}
                  type="button"
                  onPointerDown={(e) => handleFavChipPointerDown(e, t.key)}
                  onClick={() => {
                    if (suppressFavClickRef.current) {
                      suppressFavClickRef.current = false;
                      return;
                    }
                    void recordAndAdd(t.key);
                  }}
                  onKeyDown={(e) => {
                    if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
                      e.preventDefault();
                      moveFav(i, e.key === "ArrowLeft" ? -1 : 1);
                    }
                  }}
                  data-fav-chip=""
                  data-fav-chip-index={i}
                  data-fav-dragging={dragging ? "true" : undefined}
                  data-fav-caret={caretSide ?? undefined}
                  title={`Add ${t.label} at the viewport center — drag to reorder (Alt+←/→)`}
                  data-testid={`palette-fav-chip-${t.key}`}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-card py-1 pl-1.5 pr-2.5 text-[11px] font-medium shadow-sm transition-all hover:-translate-y-px hover:shadow active:translate-y-0",
                    "hover:border-amber-500/50 hover:ring-1 hover:ring-amber-500/25",
                    dragging && "opacity-40 translate-y-0 scale-[0.98] shadow-none",
                    caretSide === "before" &&
                      "shadow-[inset_3px_0_0_0_#f59e0b,0_0_0_1px_rgba(245,158,11,0.45)]",
                    caretSide === "after" &&
                      "shadow-[inset_-3px_0_0_0_#f59e0b,0_0_0_1px_rgba(245,158,11,0.45)]"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-4.5 items-center justify-center rounded-full",
                      t.color.soft,
                      t.color.text
                    )}
                    aria-hidden="true"
                  >
                    <TypeIcon name={t.icon} className="size-3" />
                  </span>
                  <span className="max-w-28 truncate">{t.label}</span>
                  <Star className="size-2.5 shrink-0 fill-amber-400 text-amber-500" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ---- recently used quick-add chips ---- */}
      {!searching && recentSpecs.length > 0 && (
        <div className="shrink-0 border-b bg-muted/25 px-3 py-2">
          <div className="mb-1.5 flex items-center gap-1.5">
            <Clock3 className="size-3 text-muted-foreground/80" aria-hidden="true" />
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              Recently used
            </p>
            <span className="sr-only">— click a chip to add that job at the viewport center</span>
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.removeItem(RECENT_KEY);
                } catch {
                  /* ignore */
                }
                setRecent([]);
              }}
              className="ml-auto rounded px-1 py-px text-[9px] font-medium text-muted-foreground/70 transition-colors hover:text-foreground"
              aria-label="Clear recently used list"
            >
              clear
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recentSpecs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => void recordAndAdd(t.key)}
                title={`Add ${t.label} at the viewport center`}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border bg-card py-1 pl-1.5 pr-2.5 text-[11px] font-medium shadow-sm transition-all hover:-translate-y-px hover:shadow active:translate-y-0",
                  "hover:border-primary/40 hover:ring-1 hover:ring-primary/25"
                )}
              >
                <span
                  className={cn(
                    "flex size-4.5 items-center justify-center rounded-full",
                    t.color.soft,
                    t.color.text
                  )}
                  aria-hidden="true"
                >
                  <TypeIcon name={t.icon} className="size-3" />
                </span>
                <span className="max-w-28 truncate">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ---- catalog ---- */}
      <nav
        aria-label="RELION 5 job type catalog"
        className="nice-scroll min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-1"
      >
        {favOnly && favSpecs.length === 0 && (
          <div className="px-3 py-8 text-center" data-testid="palette-favs-empty">
            <Star className="mx-auto size-5 text-muted-foreground/40" aria-hidden="true" />
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              No starred job types yet
            </p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground/70">
              Hover a row below and click its star — starred types gather up top
              and survive restarts.
            </p>
            <button
              type="button"
              onClick={() => setFavOnly(false)}
              className="mt-1.5 text-[11px] font-medium text-primary underline-offset-2 hover:underline"
            >
              Show all types
            </button>
          </div>
        )}
        {filtered.length === 0 && !(favOnly && favSpecs.length === 0) && (
          <div className="px-3 py-8 text-center">
            <Search className="mx-auto size-5 text-muted-foreground/40" aria-hidden="true" />
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              No job types match &ldquo;{query}&rdquo;
            </p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="mt-1.5 text-[11px] font-medium text-primary underline-offset-2 hover:underline"
            >
              Clear the search
            </button>
          </div>
        )}
        {JOB_CATEGORIES.map((cat) => {
          const items = filtered.filter((t) => t.category === cat.key);
          if (items.length === 0) return null;
          const isOpen = searching || expanded.has(cat.key);
          const accent = items[0]?.color;
          return (
            <div key={cat.key} className="mb-0.5">
              <button
                type="button"
                onClick={() => toggleCategory(cat.key)}
                aria-expanded={isOpen}
                title={cat.hint}
                className="group/cat sticky top-0 z-10 flex w-full items-center gap-1.5 rounded-md bg-sidebar/80 px-2 py-1.5 text-left backdrop-blur-sm transition-colors hover:bg-accent/60"
              >
                <ChevronDown
                  className={cn(
                    "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
                    !isOpen && "-rotate-90"
                  )}
                  aria-hidden="true"
                />
                <span
                  className={cn("size-1.5 shrink-0 rounded-full transition-colors", accent?.bg ?? "bg-muted-foreground/50")}
                  aria-hidden="true"
                />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80">
                  {cat.label}
                </span>
                <span className="ml-auto rounded-full bg-muted/80 px-1.5 py-px text-[10px] font-medium tabular-nums text-muted-foreground transition-transform group-hover/cat:scale-105">
                  {items.length}
                </span>
              </button>
              {/* smooth height animation — grid-rows trick */}
              <div
                className={cn(
                  "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
                  isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                )}
              >
                <div className="overflow-hidden">
                  <div className="space-y-0.5 py-1">
                    {items.map((t) => (
                      <Button
                        key={t.key}
                        variant="ghost"
                        className="group/item no-drag-select relative h-auto w-full justify-start gap-2.5 rounded-lg px-2.5 py-2 pl-3 text-left transition-all hover:translate-x-0.5 hover:rounded-md hover:bg-gradient-to-r hover:from-accent/80 hover:to-transparent"
                        onPointerDown={(e) => handleItemPointerDown(e, t.key)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            void recordAndAdd(t.key);
                          }
                        }}
                        aria-label={`Drag to canvas to add ${t.label} (or press Enter)`}
                        title={`${t.tier === "core" ? "Core (real engine)" : t.tier === "cmd" ? "Runs real RELION CLI" : "Needs external binary"} — drag onto the canvas`}
                      >
                        {/* left accent bar — grows on hover */}
                        <span
                          className={cn(
                            "absolute inset-y-2 left-0 w-0.5 rounded-full opacity-0 transition-all duration-200 group-hover/item:opacity-100",
                            t.color.bg
                          )}
                          aria-hidden="true"
                        />
                        {/* drag grip — appears on hover */}
                        <GripVertical
                          className="absolute left-0.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground/0 transition-colors duration-200 group-hover/item:text-muted-foreground/50"
                          aria-hidden="true"
                        />
                        <span
                          className={cn(
                            "flex size-7 shrink-0 items-center justify-center rounded-md ring-1 ring-inset transition-transform duration-200 group-hover/item:scale-105",
                            t.color.soft,
                            t.color.border
                          )}
                        >
                          <TypeIcon name={t.icon} className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium leading-tight">
                            {t.label}
                          </span>
                          <span className="block truncate text-[11px] leading-tight text-muted-foreground">
                            {t.description}
                          </span>
                        </span>
                        {/* Task 133 — star toggle: reserved width so the tier
                            badge never shifts; a span (not a nested button —
                            invalid DOM inside the row's button) with full
                            keyboard semantics, and pointerdown is swallowed
                            so starring never starts a drag */}
                        <span
                          role="button"
                          tabIndex={0}
                          aria-pressed={favSet.has(t.key)}
                          aria-label={favSet.has(t.key) ? `Unstar ${t.label}` : `Star ${t.label}`}
                          title={favSet.has(t.key) ? `Unstar ${t.label}` : `Star ${t.label} for quick access`}
                          data-testid={`palette-star-${t.key}`}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavType(t.key);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleFavType(t.key);
                            }
                          }}
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded transition-all",
                            favSet.has(t.key)
                              ? "text-amber-500 hover:text-amber-600 dark:text-amber-400"
                              : "opacity-0 hover:opacity-100 group-hover/item:opacity-60 focus-visible:opacity-100 hover:bg-accent"
                          )}
                        >
                          <Star
                            className={cn("size-3", favSet.has(t.key) && "fill-amber-400 text-amber-500")}
                            aria-hidden="true"
                          />
                        </span>
                        <span
                          className={cn(
                            "flex shrink-0 items-center gap-1 rounded px-1 py-px font-mono text-[8px] uppercase tracking-wide",
                            t.tier === "core" &&
                              "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                            t.tier === "cmd" && "bg-muted text-muted-foreground",
                            t.tier === "external" &&
                              "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          )}
                          aria-hidden="true"
                        >
                          <span
                            className={cn(
                              "inline-block size-1 rounded-full",
                              t.tier === "core" && "bg-emerald-500",
                              t.tier === "cmd" && "bg-muted-foreground/60",
                              t.tier === "external" && "bg-amber-500"
                            )}
                          />
                          {t.tier === "core" ? "core" : t.tier === "cmd" ? "cli" : "ext"}
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* ---- footer: tier legend ---- */}
      <div className="shrink-0 border-t bg-sidebar/60 px-3 py-2 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-2 text-[9.5px] text-muted-foreground">
          <span className="flex items-center gap-1" title="Runs on the real RELION engine">
            <span className="inline-block size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            core
          </span>
          <span className="flex items-center gap-1" title="Runs a real RELION CLI binary">
            <span className="inline-block size-1.5 rounded-full bg-muted-foreground/60" aria-hidden="true" />
            cli
          </span>
          <span className="flex items-center gap-1" title="Needs an external binary (e.g. ctffind)">
            <span className="inline-block size-1.5 rounded-full bg-amber-500" aria-hidden="true" />
            ext
          </span>
          <span className="ml-auto hidden items-center gap-1 text-muted-foreground/70 lg:flex">
            <kbd className="rounded border bg-muted/60 px-1 py-px font-mono text-[8.5px] leading-none">/</kbd>
            search
            <span className="mx-0.5 text-muted-foreground/40">·</span>
            <kbd className="rounded border bg-muted/60 px-1 py-px font-mono text-[8.5px] leading-none">⏎</kbd>
            add
          </span>
        </div>
      </div>

      {/* Drag ghost (mini card preview following the cursor) */}
      {ghost &&
        createPortal(
          <div
            ref={ghostRef}
            aria-hidden="true"
            className="card-lift pointer-events-none fixed left-0 top-0 z-50 flex items-center gap-2 rounded-lg border bg-card px-3 py-2"
            style={{
              transform: `translate3d(${ghost.x}px, ${ghost.y}px, 0) translate(-50%, -50%)`,
            }}
          >
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-md",
                ghostSpec?.color.soft,
                ghostSpec?.color.text
              )}
            >
              <TypeIcon name={ghostSpec?.icon ?? "Boxes"} className="size-3.5" />
            </span>
            <span className="whitespace-nowrap text-xs font-medium">
              {ghostSpec?.label ?? ghost.type}
            </span>
          </div>,
          document.body
        )}
    </div>
  );
}

"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  Clock3,
  GripVertical,
  Search,
  Shapes,
  X,
} from "lucide-react";
import { JOB_CATEGORIES, JOB_TYPES, jobType } from "@/lib/workflow";
import { useWorkflowStore } from "@/lib/store";
import { TypeIcon } from "./icons";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PaletteDragState {
  type: string;
  pointerId: number;
  startX: number;
  startY: number;
  /** Past the 5px threshold — real drag with ghost + drop target. */
  active: boolean;
}

const RECENT_KEY = "cryoflow-recent-types";
const RECENT_MAX = 6;

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

  const dragRef = React.useRef<PaletteDragState | null>(null);
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
  }, []);

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
  const filtered = searching
    ? JOB_TYPES.filter(
        (t) =>
          t.label.toLowerCase().includes(q) ||
          t.key.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
      )
    : JOB_TYPES;

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
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // capture is best-effort — the window listeners below cover the rest
    }
  };

  React.useEffect(() => {
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
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      cleanupDrag();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
    };
  }, []);

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
          <span
            className="ml-auto rounded-full bg-muted/70 px-1.5 py-px text-[10px] font-medium tabular-nums text-muted-foreground"
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
        {filtered.length === 0 && (
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

"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, Shapes } from "lucide-react";
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

/**
 * Job type palette (RELION 5 catalog: 13 collapsible categories) —
 * drag-to-create onto the canvas. Keyboard fallback: Enter / Space adds the
 * job at the viewport center (legacy placement). Used in the desktop
 * sidebar and inside the mobile Sheet.
 */
export function JobPalette({ onAdded }: { onAdded?: () => void }) {
  const addJob = useWorkflowStore((s) => s.addJob);

  const [query, setQuery] = React.useState("");
  // only the first category starts expanded (RELION job-browser feel)
  const [expanded, setExpanded] = React.useState<ReadonlySet<string>>(
    () => new Set(JOB_CATEGORIES.slice(0, 1).map((c) => c.key))
  );
  const [ghost, setGhost] = React.useState<{ type: string; x: number; y: number } | null>(null);

  const dragRef = React.useRef<PaletteDragState | null>(null);
  const ghostRef = React.useRef<HTMLDivElement>(null);
  const onAddedRef = React.useRef(onAdded);

  React.useEffect(() => {
    onAddedRef.current = onAdded;
  }, [onAdded]);

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

  const handleKeyAdd = async (type: string) => {
    await addJob(type);
    onAddedRef.current?.();
  };

  const toggleCategory = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const ghostSpec = ghost ? jobType(ghost.type) : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-2.5 p-3 pb-2">
        <div className="flex items-center gap-2 px-1">
          <Shapes className="size-3.5 text-primary" aria-hidden="true" />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Job Types
          </p>
          <span className="ml-auto text-[10px] tabular-nums text-muted-foreground/70">
            {JOB_TYPES.length}
          </span>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search job types…"
            aria-label="Search job types"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <p className="px-1 text-[11px] text-muted-foreground">
          Drag a job onto the canvas
        </p>
      </div>

      <nav
        aria-label="RELION 5 job type catalog"
        className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-4 pt-1"
      >
        {filtered.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            No job types match &ldquo;{query}&rdquo;.
          </p>
        )}
        {JOB_CATEGORIES.map((cat) => {
          const items = filtered.filter((t) => t.category === cat.key);
          if (items.length === 0) return null;
          const isOpen = searching || expanded.has(cat.key);
          return (
            <div key={cat.key}>
              <button
                type="button"
                onClick={() => toggleCategory(cat.key)}
                aria-expanded={isOpen}
                title={cat.hint}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent/60"
              >
                <ChevronDown
                  className={cn(
                    "size-3.5 shrink-0 text-muted-foreground transition-transform",
                    !isOpen && "-rotate-90"
                  )}
                  aria-hidden="true"
                />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80">
                  {cat.label}
                </span>
                <span className="ml-auto rounded-full bg-muted px-1.5 text-[10px] tabular-nums text-muted-foreground">
                  {items.length}
                </span>
              </button>
              {isOpen && (
                <div className="space-y-0.5 pb-1">
                  {items.map((t) => (
                    <Button
                      key={t.key}
                      variant="ghost"
                      className="no-drag-select h-auto w-full justify-start gap-2.5 px-2.5 py-2 text-left"
                      onPointerDown={(e) => handleItemPointerDown(e, t.key)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          void handleKeyAdd(t.key);
                        }
                      }}
                      aria-label={`Drag to canvas to add ${t.label} (or press Enter)`}
                      title={`${t.tier === "core" ? "Core (real engine)" : t.tier === "cmd" ? "Runs real RELION CLI" : "Needs external binary"} — drag onto the canvas`}
                    >
                      <span
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-md",
                          t.color.soft,
                          t.color.text
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
                          "shrink-0 rounded px-1 py-px font-mono text-[8px] uppercase tracking-wide",
                          t.tier === "core" &&
                            "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                          t.tier === "cmd" && "bg-muted text-muted-foreground",
                          t.tier === "external" &&
                            "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        )}
                        aria-hidden="true"
                      >
                        {t.tier === "core" ? "core" : t.tier === "cmd" ? "cli" : "ext"}
                      </span>
                    </Button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

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

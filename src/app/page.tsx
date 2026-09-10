"use client";

import * as React from "react";
import { AlertTriangle, Boxes, Layers, Plus, RefreshCw, X } from "lucide-react";
import { useWorkflowStore } from "@/lib/store";
import { Header } from "@/components/workflow/header";
import { CARD_H, CARD_W } from "@/lib/workflow";
import { useDropNavigationGuard } from "@/components/workflow/drop-import";
import { Footer } from "@/components/workflow/footer";
import { PrintDocHeader } from "@/components/workflow/print-doc-header";
import { PrintDocFooter } from "@/components/workflow/print-doc-footer";
import { JobPalette } from "@/components/workflow/palette";
import { WorkspacePanel } from "@/components/workflow/workspace-panel";
import { ProjectDashboard } from "@/components/workflow/project-dashboard";
import { WorkflowCanvas } from "@/components/workflow/canvas";
import { JobPanel } from "@/components/workflow/job-panel";
import { JobInspector } from "@/components/workflow/job-inspector";
import { CommandPalette } from "@/components/workflow/command-palette";
import { TemplatePresetsDialog } from "@/components/workflow/template-presets-dialog";
import { ImportWorkflowDialog } from "@/components/workflow/import-workflow-dialog";
import { ShortcutsDialog } from "@/components/workflow/shortcuts-dialog";
import { BULK_DELETE_EVENT } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function useMediaQuery(query: string) {
  const [matches, setMatches] = React.useState(false);
  React.useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

export default function Home() {
  const workspaces = useWorkflowStore((s) => s.workspaces);
  const selectedId = useWorkflowStore((s) => s.selectedId);
  // Task 92 — app-wide drop guard: an accidental file drop on ANY view
  // (dashboard included, where no import handler exists) must navigate the
  // tab nowhere. Canvas drop-import claims its own drops deeper in the
  // bubble path; this only swallows what nobody else wants.
  useDropNavigationGuard();
  // ⚠ selectors must return STABLE references (a fresh .filter() array per
  // call trips zustand's getServerSnapshot cache check — infinite loop)
  const allJobs = useWorkflowStore((s) => s.jobs);
  const allSelectedIds = useWorkflowStore((s) => s.selectedIds);
  const inspectId = useWorkflowStore((s) => s.inspectId);
  const select = useWorkflowStore((s) => s.select);
  const view = useWorkflowStore((s) => s.view);
  const loadError = useWorkflowStore((s) => s.error);
  // primitive selectors keep shell re-renders cheap (see anyActive below)

  const [mounted, setMounted] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  // bulk delete (multi-selection via Del/Backspace) gets its own confirm —
  // the toolbar's delete button has an equivalent one inside canvas.tsx
  const [confirmBulkDelete, setConfirmBulkDelete] = React.useState(false);
  const isXl = useMediaQuery("(min-width: 1280px)");

  // Initial data load
  React.useEffect(() => {
    void useWorkflowStore.getState().load();
  }, []);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Poll cadence — "canvas job status updates in real time":
  //  - running OR pending jobs → 1.2s (pending jobs can flip to running
  //    server-side at any moment via auto-start when their upstream lands)
  //  - fully idle → 6s heartbeat (catches orphan self-completion, engine
  //    reconciliation and other server-side state changes)
  //  - hidden tab → 15s (cheap), and one immediate tick when it becomes
  //    visible again so returning to the tab never shows stale cards
  const anyActive = useWorkflowStore(
    (s) => s.jobs.some((j) => j.status === "running" || j.status === "pending")
  );
  const [pageVisible, setPageVisible] = React.useState(true);
  React.useEffect(() => {
    const onVis = () => {
      const visible = document.visibilityState === "visible";
      setPageVisible(visible);
      if (visible) void useWorkflowStore.getState().pollTick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  React.useEffect(() => {
    const delay = !pageVisible ? 15000 : anyActive ? 1200 : 6000;
    const timer = setInterval(() => {
      void useWorkflowStore.getState().pollTick();
    }, delay);
    return () => clearInterval(timer);
  }, [anyActive, pageVisible]);

  // ESC cancels connect mode, closes the inspector, collapses the
  // multi-selection to its primary, then deselects (the right-side panel).
  // Runs ONLY when no modal owns the key: while any dialog/menu is open,
  // Radix's own layer machinery peels exactly ONE layer per Esc (capture
  // phase, before this bubble listener) — and this fallback must not ALSO
  // fire, or one Esc tears down the whole dialog stack plus the inspector
  // beneath it (observed live: Esc on the 3D viewer closed the viewer AND
  // the inspector). Mirrors the open-modal guard the Shift+D handler uses.
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // an Escape a component already CONSUMED (preventDefault) is not ours
      // to act on — the gallery lightbox closes itself this way. Checking
      // the EVENT, not the DOM: React flushes discrete events synchronously,
      // so a dialog closed by an earlier handler is already unmounted when
      // this listener runs and the dialog guard below would pass vacuously
      // (observed live: Esc in the class lightbox closed the lightbox AND
      // deselected the job, tearing down the panel beneath it).
      if (e.defaultPrevented) return;
      if (document.querySelector('[role="dialog"][data-state="open"], [role="menu"][data-state="open"]')) {
        return;
      }
      const s = useWorkflowStore.getState();
      if (s.pendingFrom) s.cancelConnect();
      else if (s.inspectId) s.inspect(null);
      else if (s.selectedIds.length > 1) s.select(s.selectedId); // collapse to the primary card
      else if (s.selectedId) s.select(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Shift+D — toggle between the workflow canvas and the project dashboard
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "D" || !e.shiftKey) return;
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.closest("input, textarea, select, [contenteditable='true']") != null ||
          target.isContentEditable)
      ) {
        return;
      }
      if (document.querySelector('[role="dialog"][data-state="open"], [role="menu"][data-state="open"]')) {
        return;
      }
      e.preventDefault();
      const s = useWorkflowStore.getState();
      s.setView(s.view === "canvas" ? "dashboard" : "canvas");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // job-card BULK context menu ("Delete N jobs…") routes here — the confirm
  // dialog (name preview + running warning) lives beside the Del-key path,
  // so both entries share one guarded exit
  React.useEffect(() => {
    const onBulkDeleteRequest = () => {
      if (useWorkflowStore.getState().selectedIds.length > 1) setConfirmBulkDelete(true);
    };
    window.addEventListener(BULK_DELETE_EVENT, onBulkDeleteRequest);
    return () => window.removeEventListener(BULK_DELETE_EVENT, onBulkDeleteRequest);
  }, []);

  /* Canvas keyboard shortcuts (n8n-style power moves):
   *   F    — center the selected job
   *   0    — reset pan/zoom
   *   1–9  — jump to a bookmarked view (Task 101, stable hotkey seats)
   *   +/−  — zoom in/out around the viewport center
   *   Del  — delete the selected job
   * Guarded: no shortcuts while typing in a form field, a sheet/dialog is
   * open (their own key handling wins), or a popover menu is active. */
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target;
      if (
        // instanceof (not just truthiness): synthetic events can target
        // document/window, which have no .closest — don't crash on them
        target instanceof HTMLElement &&
        (target.closest("input, textarea, select, [contenteditable='true']") != null ||
          target.isContentEditable)
      ) {
        return;
      }
      // any open dialog / sheet / menu owns the keyboard
      if (document.querySelector('[role="dialog"][data-state="open"], [role="menu"][data-state="open"]')) {
        return;
      }
      const s = useWorkflowStore.getState();
      const k = e.key;
      // zoom keeps the workspace point under the viewport CENTER fixed
      const zoomAtCenter = (factor: number) => {
        const el = document.querySelector('[data-canvas="viewport"]');
        const rect = el?.getBoundingClientRect();
        const vp = s.viewport;
        const next = Math.min(Math.max(vp.zoom * factor, 0.1), 2.5);
        if (!rect) {
          s.setViewport({ zoom: next });
          return;
        }
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const px = (cx - vp.x) / vp.zoom;
        const py = (cy - vp.y) / vp.zoom;
        s.setViewport({ x: cx - px * next, y: cy - py * next, zoom: next });
      };
      if (k === "f" || k === "F") {
        if (s.selectedId) {
          e.preventDefault();
          s.focusJob(s.selectedId);
        }
      } else if ((e.ctrlKey || e.metaKey) && (k === "a" || k === "A")) {
        // select-all on the canvas — text fields are already excluded by
        // the guard above, so the browser's native select never fights us
        if (s.view !== "dashboard") {
          e.preventDefault();
          s.selectAll();
        }
      } else if (k === "?") {
        // "?" is shift+/ — the typing guard above already excluded form
        // fields, and the dialog guard below the modal-open case, so the
        // sheet only ever opens from a calm surface
        e.preventDefault();
        useWorkflowStore.getState().setShortcutsOpen(true);
      } else if ((e.ctrlKey || e.metaKey) && (k === "d" || k === "D")) {
        // Figma-convention duplicate (Shift+D is taken by the view toggle):
        // one selected job → single duplicate; 2+ → the bulk path, which
        // clones the jobs and rewires their internal edges as a block.
        // preventDefault keeps the browser's bookmark dialog out of the way.
        if (s.view !== "dashboard") {
          e.preventDefault();
          if (s.selectedIds.length > 1) void s.duplicateSelected();
          else if (s.selectedId) void s.duplicateJob(s.selectedId);
        }
      } else if ((e.ctrlKey || e.metaKey) && (k === "z" || k === "Z")) {
        // Task 104 history: Ctrl+Z walks the linear undo stack back, +Shift
        // walks it forward. The typing guard upstream already gave form
        // fields their native text undo back; the dialog guard above keeps
        // an open dialog's own undo semantics undisturbed. The dashboard
        // has no canvas state to unwind — excluded like F/N/arrows.
        if (s.view !== "dashboard") {
          e.preventDefault();
          if (e.shiftKey) void s.redo();
          else void s.undo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (k === "y" || k === "Y")) {
        // the Windows-editor convention for redo — same stack, same guard
        if (s.view !== "dashboard") {
          e.preventDefault();
          void s.redo();
        }
      } else if (k === "0") {
        e.preventDefault();
        s.setViewport({ x: 0, y: 0, zoom: 1 });
      } else if (k >= "1" && k <= "9" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // bookmark hotkey jump (Task 101): digits 1–9 land on the saved
        // view holding that seat. Canvas-only scope like F/N — the
        // dashboard owns digits 1–6 for its grid filters (and browsers
        // own Ctrl/Cmd+digit for tab switching, excluded above). Dead
        // when no bookmark holds the seat: an honest dead key, the
        // store action just returns false.
        if (s.view !== "dashboard") {
          if (s.jumpToViewportBookmark(Number(k))) e.preventDefault();
        }
      } else if (k === "+" || k === "=") {
        e.preventDefault();
        zoomAtCenter(1.15);
      } else if (k === "-" || k === "_") {
        e.preventDefault();
        zoomAtCenter(1 / 1.15);
      } else if (k === "n" || k === "N") {
        // note spotlight (Task 75) — same canvas-scoped rule as F/0/+−: the
        // lens dims CARDS, so it has nothing to do while the dashboard owns
        // the screen (the header chip stays clickable there)
        if (s.view !== "dashboard") {
          e.preventDefault();
          s.toggleNoteSpotlight();
        }
      } else if (k.startsWith("Arrow") && s.view !== "dashboard") {
        // Task 103 arrow-walk: spatial navigation across the graph. The
        // anchor hops to the nearest card in the pressed direction (small
        // sideways drift penalized over raw distance); Shift extends the
        // selection instead of replacing it. Radix Select's listbox is
        // arrow-driven too — an open one owns the keys before we do.
        if (document.querySelector('[role="listbox"]')) return;
        e.preventDefault();
        const dir =
          k === "ArrowLeft" ? { x: -1, y: 0 } :
          k === "ArrowRight" ? { x: 1, y: 0 } :
          k === "ArrowUp" ? { x: 0, y: -1 } : { x: 0, y: 1 };
        const rect = document
          .querySelector('[data-canvas="viewport"]')
          ?.getBoundingClientRect();
        const anchor = s.selectedId
          ? s.jobs.find((j) => j.id === s.selectedId)
          : undefined;
        // anchor POINT: the selected card's center, or — with nothing
        // selected — the world point under the viewport center, so arrows
        // enter the graph from wherever the user is looking
        const ax = anchor
          ? anchor.x + CARD_W / 2
          : rect
            ? (rect.width / 2 - s.viewport.x) / s.viewport.zoom
            : 0;
        const ay = anchor
          ? anchor.y + CARD_H / 2
          : rect
            ? (rect.height / 2 - s.viewport.y) / s.viewport.zoom
            : 0;
        // same workspace rule as useActiveWorkspaceJobs (the derivation is
        // hook-bound; this handler reads the store imperatively)
        const wsJobs =
          s.activeWorkspaceId == null
            ? s.jobs
            : s.jobs.filter((j) => (j.workspaceId ?? "") === s.activeWorkspaceId);
        let best: (typeof wsJobs)[number] | null = null;
        let bestScore = Infinity;
        for (const j of wsJobs) {
          if (anchor && j.id === anchor.id) continue;
          const vx = j.x + CARD_W / 2 - ax;
          const vy = j.y + CARD_H / 2 - ay;
          const forward = vx * dir.x + vy * dir.y;
          if (forward <= 0) continue; // behind the anchor — not a candidate
          const len = Math.hypot(vx, vy);
          const cos = forward / len; // deviation from the pressed direction
          // HARD ±45° CONE: a down-right card 280px away must not steal the
          // walk from the next chain card 600px dead ahead — predictability
          // beats cleverness, and dead zones stay dead (no wraparound)
          if (cos < Math.SQRT1_2) continue;
          // within the cone, mild drift preference: 0° deviation costs
          // nothing, 45° costs ~59% extra distance
          const score = len * (1 + 2 * (1 - cos));
          if (score < bestScore) {
            bestScore = score;
            best = j;
          }
        }
        if (!best) return; // dead end in that direction — no wrap, honest no-op
        s.stepArrowFocus(best.id, e.shiftKey);
        // pan just enough that the new anchor is comfortably on screen —
        // never re-centering (F centers explicitly), never touching zoom
        if (rect) {
          const margin = 96;
          const sx = (best.x + CARD_W / 2) * s.viewport.zoom + s.viewport.x;
          const sy = (best.y + CARD_H / 2) * s.viewport.zoom + s.viewport.y;
          const dx =
            sx < margin
              ? margin - sx
              : sx > rect.width - margin
                ? rect.width - margin - sx
                : 0;
          const dy =
            sy < margin
              ? margin - sy
              : sy > rect.height - margin
                ? rect.height - margin - sy
                : 0;
          if (dx || dy) s.setViewport({ x: s.viewport.x + dx, y: s.viewport.y + dy });
        }
      } else if (k === "Delete" || k === "Backspace") {
        // destructive: route through the same confirmation the context menu
        // and the job panel use — a stray Backspace must not cascade-delete
        // wired jobs (and their edges) with zero friction
        if (s.selectedIds.length > 1) {
          e.preventDefault();
          setConfirmBulkDelete(true);
        } else if (s.selectedId) {
          e.preventDefault();
          setConfirmDeleteId(s.selectedId);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // panel shows only for a SINGLE-card selection — with 2+ jobs selected the
  // bulk toolbar owns the interaction and the panel would just crowd it
  const panelSheetOpen = mounted && !isXl && selectedId != null && allSelectedIds.length <= 1;
  const isDashboard = view === "dashboard";
  const deleteTarget = useWorkflowStore((s) =>
    confirmDeleteId ? s.jobs.find((j) => j.id === confirmDeleteId) : undefined
  );
  const bulkTargets = React.useMemo(
    () => (confirmBulkDelete ? allJobs.filter((j) => allSelectedIds.includes(j.id)) : []),
    [confirmBulkDelete, allJobs, allSelectedIds]
  );

  return (
    <div
      data-view={view}
      className="flex h-dvh flex-col bg-background text-foreground"
    >
      <Header />

      {/* Paper masthead: screen-hidden, print-only document opener (qa66) */}
      <div className="hidden px-6 pt-5 print:block">
        <PrintDocHeader />
      </div>
      {/* Initial-load failure banner: the canvas would otherwise show a
          misleading "empty" state with no way back except a full reload */}
      {loadError && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2 border-b border-amber-300/60 bg-amber-100/80 px-4 py-2 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/60 dark:text-amber-200"
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate font-medium">{loadError}</span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 border-amber-400/60 text-amber-900 hover:bg-amber-200/60 dark:text-amber-200 dark:hover:bg-amber-900/60"
            onClick={() => void useWorkflowStore.getState().load()}
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            Retry
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Dismiss error"
            className="size-7 text-amber-900 hover:bg-amber-200/60 dark:text-amber-200 dark:hover:bg-amber-900/60"
            onClick={() => useWorkflowStore.setState({ error: null })}
          >
            <X className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      )}

      {isDashboard ? (
        /* ---- Project dashboard view (standalone management page) ---- */
        <main className="flex min-h-0 flex-1 flex-col">
          <ProjectDashboard />
        </main>
      ) : (
        <main className="flex min-h-0 flex-1">
          {/* Desktop sidebar: job catalog + workspace navigator */}
          <aside className="no-print hidden w-72 shrink-0 flex-col border-r bg-gradient-to-b from-sidebar via-sidebar to-sidebar/70 lg:flex">
            <Tabs defaultValue="catalog" className="flex h-full min-h-0 flex-col gap-0">
              <div className="shrink-0 border-b bg-sidebar/40 p-2 backdrop-blur-sm">
                <TabsList className="grid h-9 w-full grid-cols-2 shadow-none">
                  <TabsTrigger
                    value="catalog"
                    className="gap-1.5 text-xs transition-all data-[state=active]:shadow-sm"
                  >
                    <Boxes className="size-3.5" aria-hidden="true" />
                    Catalog
                  </TabsTrigger>
                  <TabsTrigger
                    value="workspaces"
                    className="gap-1.5 text-xs transition-all data-[state=active]:shadow-sm"
                  >
                    <Layers className="size-3.5" aria-hidden="true" />
                    Workspaces
                    <Badge
                      variant="secondary"
                      className="ml-0.5 h-4 min-w-4 px-1 text-[9px] font-semibold tabular-nums"
                    >
                      {workspaces.length}
                    </Badge>
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="catalog" className="mt-0 min-h-0 flex-1">
                <JobPalette />
              </TabsContent>
              <TabsContent value="workspaces" className="mt-0 min-h-0 flex-1">
                <WorkspacePanel />
              </TabsContent>
            </Tabs>
          </aside>

          <WorkflowCanvas />

          {/* Desktop job panel — only mounted while a job is selected */}
          {selectedId != null && allSelectedIds.length <= 1 && (
            <aside className="no-print hidden w-[380px] shrink-0 animate-in border-l bg-card duration-200 slide-in-from-right-4 xl:flex xl:flex-col">
              <JobPanel />
            </aside>
          )}
        </main>
      )}

      <Footer />

      {/* Large inspector modal for submitted jobs (running/completed/failed) */}
      <JobInspector />
      <CommandPalette />
      <TemplatePresetsDialog />
      <ImportWorkflowDialog />
      <ShortcutsDialog />

      {/* Paper footer: screen-hidden, print-only, repeats on every sheet */}
      <PrintDocFooter />

      {/* Mobile: floating palette trigger (canvas view only) */}
      {!isDashboard && (
        <Button
          size="icon"
          aria-label="Add a job"
          className="no-print card-lift-lg fixed right-5 bottom-20 z-40 size-12 rounded-full shadow-lg lg:hidden"
          onClick={() => setPaletteOpen(true)}
        >
          <Plus className="size-6" />
        </Button>
      )}

      {/* Mobile / tablet palette sheet */}
      <Sheet open={paletteOpen} onOpenChange={setPaletteOpen}>
        <SheetContent
          side="left"
          className="w-72 gap-0 p-0 sm:max-w-xs"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Job types</SheetTitle>
            <SheetDescription>Add cryo-EM jobs to the canvas</SheetDescription>
          </SheetHeader>
          <JobPalette onAdded={() => setPaletteOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Mobile / tablet details sheet */}
      <Sheet
        open={panelSheetOpen}
        onOpenChange={(open) => {
          if (!open) select(null);
        }}
      >
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
          <SheetHeader className="sr-only">
            <SheetTitle>Job details</SheetTitle>
            <SheetDescription>
              Inspect parameters, run the job and manage connections
            </SheetDescription>
          </SheetHeader>
          <JobPanel />
        </SheetContent>
      </Sheet>

      {/* Keyboard-delete confirmation (the context menu + job panel use the
          same destructive-action guard) */}
      <AlertDialog
        open={confirmDeleteId != null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name ?? "this job"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the job and its connections from the workflow.
              {deleteTarget?.status === "running" && " A running process will be stopped."}{" "}
              You'll get a short window to undo from the toast afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-400"
              onClick={() => {
                const id = confirmDeleteId;
                setConfirmDeleteId(null);
                if (id) void useWorkflowStore.getState().deleteJob(id);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Keyboard bulk-delete confirmation (Del with 2+ jobs selected) */}
      <AlertDialog open={confirmBulkDelete} onOpenChange={setConfirmBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {bulkTargets.length} jobs?</AlertDialogTitle>
            <AlertDialogDescription>
              {bulkTargets
                .slice(0, 3)
                .map((j) => `“${j.name}”`)
                .join(", ")
                .concat(bulkTargets.length > 3 ? ` and ${bulkTargets.length - 3} more` : "")}{" "}
              — this removes every wire attached to them.
              {bulkTargets.some((j) => j.status === "running") &&
                " Running processes will be stopped."}{" "}
              You'll get a short window to undo from the toast afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-400"
              onClick={() => {
                setConfirmBulkDelete(false);
                void useWorkflowStore.getState().deleteSelected();
              }}
            >
              Delete {bulkTargets.length} jobs
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

"use client";

import * as React from "react";
import { AlertTriangle, Boxes, Layers, Plus, RefreshCw, X } from "lucide-react";
import { useWorkflowStore } from "@/lib/store";
import { Header } from "@/components/workflow/header";
import { Footer } from "@/components/workflow/footer";
import { JobPalette } from "@/components/workflow/palette";
import { WorkspacePanel } from "@/components/workflow/workspace-panel";
import { ProjectDashboard } from "@/components/workflow/project-dashboard";
import { WorkflowCanvas } from "@/components/workflow/canvas";
import { JobPanel } from "@/components/workflow/job-panel";
import { JobInspector } from "@/components/workflow/job-inspector";
import { CommandPalette } from "@/components/workflow/command-palette";
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
  const inspectId = useWorkflowStore((s) => s.inspectId);
  const select = useWorkflowStore((s) => s.select);
  const view = useWorkflowStore((s) => s.view);
  const loadError = useWorkflowStore((s) => s.error);
  // primitive selector: polls that change nothing never re-render the shell
  const anyRunning = useWorkflowStore((s) => s.jobs.some((j) => j.status === "running"));

  const [mounted, setMounted] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const isXl = useMediaQuery("(min-width: 1280px)");

  // Initial data load
  React.useEffect(() => {
    void useWorkflowStore.getState().load();
  }, []);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Poll while any job is running
  React.useEffect(() => {
    if (!anyRunning) return;
    const timer = setInterval(() => {
      void useWorkflowStore.getState().pollTick();
    }, 1200);
    return () => clearInterval(timer);
  }, [anyRunning]);

  // ESC cancels connect mode, closes the inspector, then deselects
  // (the right-side panel). The Radix dialog handles its own ESC first —
  // this fires only when no modal captured the key.
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const s = useWorkflowStore.getState();
      if (s.pendingFrom) s.cancelConnect();
      else if (s.inspectId) s.inspect(null);
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

  /* Canvas keyboard shortcuts (n8n-style power moves):
   *   F    — center the selected job
   *   0    — reset pan/zoom
   *   +/−  — zoom in/out around the viewport center
   *   Del  — delete the selected job
   * Guarded: no shortcuts while typing in a form field, a sheet/dialog is
   * open (their own key handling wins), or a popover menu is active. */
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
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
      } else if (k === "0") {
        e.preventDefault();
        s.setViewport({ x: 0, y: 0, zoom: 1 });
      } else if (k === "+" || k === "=") {
        e.preventDefault();
        zoomAtCenter(1.15);
      } else if (k === "-" || k === "_") {
        e.preventDefault();
        zoomAtCenter(1 / 1.15);
      } else if ((k === "Delete" || k === "Backspace") && s.selectedId) {
        // destructive: route through the same confirmation the context menu
        // and the job panel use — a stray Backspace must not cascade-delete
        // a wired job (and its edges) with zero friction
        e.preventDefault();
        setConfirmDeleteId(s.selectedId);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const panelSheetOpen = mounted && !isXl && selectedId != null;
  const isDashboard = view === "dashboard";
  const deleteTarget = useWorkflowStore((s) =>
    confirmDeleteId ? s.jobs.find((j) => j.id === confirmDeleteId) : undefined
  );

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <Header />

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
          <aside className="hidden w-72 shrink-0 flex-col border-r bg-gradient-to-b from-sidebar via-sidebar to-sidebar/70 lg:flex">
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
          {selectedId != null && (
            <aside className="hidden w-[380px] shrink-0 animate-in border-l bg-card duration-200 slide-in-from-right-4 xl:flex xl:flex-col">
              <JobPanel />
            </aside>
          )}
        </main>
      )}

      <Footer />

      {/* Large inspector modal for submitted jobs (running/completed/failed) */}
      <JobInspector />
      <CommandPalette />

      {/* Mobile: floating palette trigger (canvas view only) */}
      {!isDashboard && (
        <Button
          size="icon"
          aria-label="Add a job"
          className="card-lift-lg fixed right-5 bottom-20 z-40 size-12 rounded-full shadow-lg lg:hidden"
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
              This cannot be undone.
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
    </div>
  );
}

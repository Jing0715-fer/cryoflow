"use client";

import * as React from "react";
import { Boxes, FolderGit2, Plus } from "lucide-react";
import { useWorkflowStore } from "@/lib/store";
import { Header } from "@/components/workflow/header";
import { Footer } from "@/components/workflow/footer";
import { JobPalette } from "@/components/workflow/palette";
import { ProjectPanel } from "@/components/workflow/project-panel";
import { WorkflowCanvas } from "@/components/workflow/canvas";
import { JobPanel } from "@/components/workflow/job-panel";
import { JobInspector } from "@/components/workflow/job-inspector";
import { CommandPalette } from "@/components/workflow/command-palette";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const jobs = useWorkflowStore((s) => s.jobs);
  const projects = useWorkflowStore((s) => s.projects);
  const selectedId = useWorkflowStore((s) => s.selectedId);
  const inspectId = useWorkflowStore((s) => s.inspectId);
  const select = useWorkflowStore((s) => s.select);

  const [mounted, setMounted] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const isXl = useMediaQuery("(min-width: 1280px)");

  // Initial data load
  React.useEffect(() => {
    void useWorkflowStore.getState().load();
  }, []);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Poll while any job is running
  const anyRunning = React.useMemo(
    () => jobs.some((j) => j.status === "running"),
    [jobs]
  );
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
        e.preventDefault();
        void s.deleteJob(s.selectedId);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const panelSheetOpen = mounted && !isXl && selectedId != null;

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <Header />

      <main className="flex min-h-0 flex-1">
        {/* Desktop sidebar: job catalog + project management */}
        <aside className="hidden w-72 shrink-0 border-r bg-sidebar lg:flex lg:flex-col">
          <Tabs defaultValue="catalog" className="flex h-full min-h-0 flex-col gap-0">
            <div className="shrink-0 border-b p-2">
              <TabsList className="grid h-9 w-full grid-cols-2">
                <TabsTrigger value="catalog" className="gap-1.5 text-xs">
                  <Boxes className="size-3.5" aria-hidden="true" />
                  Catalog
                </TabsTrigger>
                <TabsTrigger value="projects" className="gap-1.5 text-xs">
                  <FolderGit2 className="size-3.5" aria-hidden="true" />
                  Projects
                  <Badge
                    variant="secondary"
                    className="ml-0.5 h-4 min-w-4 px-1 text-[9px] font-semibold tabular-nums"
                  >
                    {projects.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="catalog" className="mt-0 min-h-0 flex-1">
              <JobPalette />
            </TabsContent>
            <TabsContent value="projects" className="mt-0 min-h-0 flex-1">
              <ProjectPanel />
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

      <Footer />

      {/* Large inspector modal for submitted jobs (running/completed/failed) */}
      <JobInspector />
      <CommandPalette />

      {/* Mobile: floating palette trigger */}
      <Button
        size="icon"
        aria-label="Add a job"
        className="card-lift-lg fixed right-5 bottom-20 z-40 size-12 rounded-full shadow-lg lg:hidden"
        onClick={() => setPaletteOpen(true)}
      >
        <Plus className="size-6" />
      </Button>

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
    </div>
  );
}

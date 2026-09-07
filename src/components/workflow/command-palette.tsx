"use client";

/**
 * CryoFlow — ⌘K / Ctrl+K command palette (Linear/n8n-style).
 *
 * Three command families, all fuzzy-searchable:
 *   • Jobs      — jump: idle → edit panel, submitted → results inspector
 *   • Run       — one-shot launch for idle jobs
 *   • Job types — add any catalog type onto the canvas
 *   • Canvas    — zoom to fit · reset view · tidy layout · theme toggle
 *
 * Opens with Ctrl+K (⌘K) or the header chip, which dispatches the
 * "cryoflow:open-palette" event (keeps the dialog owner decoupled).
 */

import * as React from "react";
import { useTheme } from "next-themes";
import {
  Command as CommandIcon,
  Download,
  FileJson,
  FileUp,
  Layers,
  LayoutDashboard,
  Maximize2,
  Moon,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Wand2,
  Workflow,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { useWorkflowStore } from "@/lib/store";
import { JOB_TYPES, jobType, CARD_W, CARD_H } from "@/lib/workflow";
import { JOB_PRESETS } from "@/lib/job-presets";
import { exportCanvasPng } from "@/lib/canvas-export";
import {
  buildWorkflowFile,
  downloadWorkflowJson,
  parseWorkflowJson,
  workflowFileName,
} from "@/lib/workflow-io";
import { TypeIcon } from "./icons";

const OPEN_EVENT = "cryoflow:open-palette";

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  const jobs = useWorkflowStore((s) => s.jobs);
  const view = useWorkflowStore((s) => s.view);
  const setView = useWorkflowStore((s) => s.setView);
  const workspaces = useWorkflowStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkflowStore((s) => s.activeWorkspaceId);
  const switchWorkspace = useWorkflowStore((s) => s.switchWorkspace);

  // Ctrl+K / ⌘K from anywhere + the header chip's custom event.
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpenRequest = () => setOpen(true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_EVENT, onOpenRequest);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_EVENT, onOpenRequest);
    };
  }, []);

  const close = () => setOpen(false);

  /** idle → select + focus (edit panel); submitted → results inspector.
   *  NOTE: focusJob clears inspectId by design (the modal covers the
   *  canvas), so the inspector branch must NOT call it. */
  const jumpToJob = (id: string) => {
    const s = useWorkflowStore.getState();
    const job = s.jobs.find((j) => j.id === id);
    if (!job) return;
    if (job.status === "idle") {
      s.select(id);
      s.focusJob(id);
    } else {
      s.inspect(id);
    }
    close();
  };

  const runJob = (id: string) => {
    void useWorkflowStore.getState().runJob(id);
    close();
  };

  const addType = (type: string) => {
    void useWorkflowStore.getState().addJob(type);
    close();
  };

  /** Preset add: place the type AND apply the curated params in one shot.
   *  The new card lands selected, so the inspector shows exactly which
   *  knobs the preset moved off their defaults. */
  const addPreset = (p: (typeof JOB_PRESETS)[number]) => {
    void useWorkflowStore.getState().addJob(p.type, p.params);
    close();
  };

  const zoomToFit = () => {
    const s = useWorkflowStore.getState();
    const el = document.querySelector('[data-canvas="viewport"]');
    const rect = el?.getBoundingClientRect();
    if (!rect || s.jobs.length === 0) return;
    const minX = Math.min(...s.jobs.map((j) => j.x));
    const maxX = Math.max(...s.jobs.map((j) => j.x + CARD_W));
    const minY = Math.min(...s.jobs.map((j) => j.y));
    const maxY = Math.max(...s.jobs.map((j) => j.y + CARD_H));
    const bw = maxX - minX;
    const bh = maxY - minY;
    const zoom = Math.min(
      Math.max(Math.min(rect.width / (bw + 96), rect.height / (bh + 96), 1), 0.25),
      1
    );
    s.setViewport({
      x: (rect.width - bw * zoom) / 2 - minX * zoom,
      y: (rect.height - bh * zoom) / 2 - minY * zoom,
      zoom: +zoom.toFixed(3),
    });
    close();
  };

  const resetView = () => {
    useWorkflowStore.getState().setViewport({ x: 0, y: 0, zoom: 1 });
    close();
  };

  const tidyLayout = () => {
    void useWorkflowStore.getState().applyLayout();
    close();
  };

  const createTemplate = () => {
    void useWorkflowStore.getState().createTemplate();
    close();
  };

  const openTemplatePresets = () => {
    // close the palette first so the two dialogs never fight over focus
    close();
    useWorkflowStore.getState().setTemplatePresetsOpen(true);
  };

  const exportPng = () => {
    // same workspace render rule as the canvas (useActiveWorkspaceJobs)
    const s = useWorkflowStore.getState();
    const wsJobs =
      s.activeWorkspaceId == null
        ? s.jobs
        : s.jobs.filter((j) => (j.workspaceId ?? "") === s.activeWorkspaceId);
    const wsName = s.workspaces.find((w) => w.id === s.activeWorkspaceId)?.name;
    void exportCanvasPng({
      projectName: s.project?.name ?? "project",
      workspaceName: wsName ?? "workspace",
      jobs: wsJobs,
      edges: s.edges,
      cardW: CARD_W,
      cardH: CARD_H,
    });
    close();
  };

  const exportJson = () => {
    // same workspace-scoped graph the canvas renders (both-endpoints rule
    // for edges is applied inside buildWorkflowFile)
    const s = useWorkflowStore.getState();
    const wsJobs =
      s.activeWorkspaceId == null
        ? s.jobs
        : s.jobs.filter((j) => (j.workspaceId ?? "") === s.activeWorkspaceId);
    const wsName = s.workspaces.find((w) => w.id === s.activeWorkspaceId)?.name;
    const file = buildWorkflowFile(
      wsJobs,
      s.edges,
      s.project?.name ?? "project",
      wsName ?? "workspace"
    );
    if (!file) {
      toast({ title: "Nothing to export", description: "The canvas is empty." });
      close();
      return;
    }
    downloadWorkflowJson(file, workflowFileName(wsName ?? "workspace"));
    close();
  };

  const importJson = () => {
    close(); // the native picker takes focus — drop the palette first
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      const parsed = parseWorkflowJson(await f.text());
      if (!parsed.ok || !parsed.file) {
        toast({
          title: "Import failed",
          description: parsed.error ?? "Unreadable workflow file",
          variant: "destructive",
        });
        return;
      }
      void useWorkflowStore.getState().importWorkflow(parsed.file);
    };
    input.click();
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
    close();
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command palette"
      description="Search jobs, job types and canvas actions"
      className="sm:max-w-lg"
    >
      <CommandInput placeholder="Jump to a job, add a type, run an action…" />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>No results — try a job name or a type like “refine”.</CommandEmpty>

        {/* ---------------- jobs ---------------- */}
        <CommandGroup heading="Jobs">
          {jobs.map((j) => {
            const spec = jobType(j.type);
            return (
              <CommandItem
                key={j.id}
                value={`job ${j.name} ${j.type} ${spec?.label ?? ""} ${j.status}`}
                onSelect={() => jumpToJob(j.id)}
                className="gap-2.5"
              >
                <TypeIcon
                  name={spec?.icon ?? "boxes"}
                  className={`size-4 shrink-0 ${spec?.color.text ?? "text-muted-foreground"}`}
                />
                <span className="min-w-0 flex-1 truncate text-sm">{j.name}</span>
                <Badge
                  variant="outline"
                  className="ml-auto h-5 shrink-0 rounded-full px-1.5 text-[9px] font-medium capitalize"
                >
                  {j.status}
                </Badge>
                <CommandShortcut>↵</CommandShortcut>
              </CommandItem>
            );
          })}
        </CommandGroup>

        {/* ---------------- run (idle jobs) ---------------- */}
        {jobs.some((j) => j.status === "idle") && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Run">
              {jobs
                .filter((j) => j.status === "idle")
                .map((j) => (
                  <CommandItem
                    key={`run-${j.id}`}
                    value={`run ${j.name} ${j.type}`}
                    onSelect={() => runJob(j.id)}
                    className="gap-2.5"
                  >
                    <Play className="size-4 shrink-0 text-teal-600" />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      Run <span className="font-medium">{j.name}</span>
                    </span>
                  </CommandItem>
                ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />

        {/* ---------------- add job types ---------------- */}
        <CommandGroup heading="Add job type">
          {JOB_TYPES.map((t) => (
            <CommandItem
              key={`type-${t.key}`}
              value={`add ${t.key} ${t.label} ${t.category}`}
              onSelect={() => addType(t.key)}
              className="gap-2.5"
            >
              <TypeIcon name={t.icon} className={`size-4 shrink-0 ${t.color.text}`} />
              <span className="min-w-0 flex-1 truncate text-sm">{t.label}</span>
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                {t.category}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        {/* ---------------- add with preset ---------------- */}
        <CommandSeparator />
        <CommandGroup heading="Add with preset">
          {JOB_PRESETS.map((p) => {
            const t = jobType(p.type);
            return (
              <CommandItem
                key={`preset-${p.type}-${p.preset}`}
                value={`preset add ${p.type} ${t?.label ?? ""} ${p.preset} ${p.note}`}
                onSelect={() => addPreset(p)}
                className="gap-2.5"
              >
                <TypeIcon
                  name={t?.icon ?? "boxes"}
                  className={`size-4 shrink-0 ${t?.color.text ?? "text-muted-foreground"}`}
                />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {t?.label ?? p.type}
                  <span className="ml-1.5 font-medium">{p.preset}</span>
                </span>
                <span className="hidden shrink-0 max-w-40 truncate text-[10px] text-muted-foreground sm:inline">
                  {p.note}
                </span>
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        {/* ---------------- workspaces ---------------- */}
        {workspaces.length > 0 && (
          <CommandGroup heading="Workspaces">
            {workspaces.map((w) => (
              <CommandItem
                key={`ws-${w.id}`}
                value={`workspace ${w.name}`}
                onSelect={() => {
                  switchWorkspace(w.id);
                  setView("canvas");
                  close();
                }}
                className="gap-2.5"
              >
                <Layers className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {w.name}
                  {w.id === activeWorkspaceId && (
                    <span className="ml-1.5 text-[10px] font-medium text-primary">(active)</span>
                  )}
                </span>
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                  switch canvas
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        <CommandSeparator />

        {/* ---------------- canvas + app actions ---------------- */}
        <CommandGroup heading="Canvas & app">
          <CommandItem
            value="create standard spa pipeline template prewired workflow scaffold"
            onSelect={createTemplate}
            className="gap-2.5"
          >
            <Workflow className="size-4 shrink-0 text-teal-600" />
            <span className="flex-1 text-sm">
              Create standard SPA pipeline
              <span className="ml-1.5 text-[10px] text-muted-foreground">
                10 pre-wired jobs · import → postprocess
              </span>
            </span>
            <CommandShortcut>↵ defaults</CommandShortcut>
          </CommandItem>
          <CommandItem
            value="create spa pipeline with presets symmetry classes scaffold configure"
            onSelect={openTemplatePresets}
            className="gap-2.5"
          >
            <SlidersHorizontal className="size-4 shrink-0 text-teal-600" />
            <span className="flex-1 text-sm">
              Create SPA pipeline with presets…
              <span className="ml-1.5 text-[10px] text-muted-foreground">
                symmetry · class counts · refine mode
              </span>
            </span>
          </CommandItem>
          <CommandItem value="zoom to fit workflow view" onSelect={zoomToFit} className="gap-2.5">
            <Maximize2 className="size-4 shrink-0" />
            <span className="flex-1 text-sm">Zoom to fit workflow</span>
          </CommandItem>
          <CommandItem value="reset view pan zoom 100" onSelect={resetView} className="gap-2.5">
            <RotateCcw className="size-4 shrink-0" />
            <span className="flex-1 text-sm">Reset view (100%)</span>
            <CommandShortcut>0</CommandShortcut>
          </CommandItem>
          <CommandItem value="tidy layout arrange auto" onSelect={tidyLayout} className="gap-2.5">
            <Wand2 className="size-4 shrink-0" />
            <span className="flex-1 text-sm">Tidy layout</span>
          </CommandItem>
          <CommandItem
            value="export canvas png image download poster workflow"
            onSelect={exportPng}
            className="gap-2.5"
          >
            <Download className="size-4 shrink-0" />
            <span className="flex-1 text-sm">
              Export canvas as PNG
              <span className="ml-1.5 text-[10px] text-muted-foreground">
                content-fit poster · footer with project · workspace
              </span>
            </span>
          </CommandItem>
          <CommandItem
            value="export workflow json file share graph"
            onSelect={exportJson}
            className="gap-2.5"
          >
            <FileJson className="size-4 shrink-0" />
            <span className="flex-1 text-sm">
              Export workflow as JSON
              <span className="ml-1.5 text-[10px] text-muted-foreground">
                graph + params, portable between workspaces
              </span>
            </span>
          </CommandItem>
          <CommandItem
            value="import workflow json file load graph"
            onSelect={importJson}
            className="gap-2.5"
          >
            <FileUp className="size-4 shrink-0" />
            <span className="flex-1 text-sm">
              Import workflow from JSON…
              <span className="ml-1.5 text-[10px] text-muted-foreground">
                recreate an exported graph below existing content
              </span>
            </span>
          </CommandItem>
          <CommandItem
            value="toggle theme dark light appearance"
            onSelect={toggleTheme}
            className="gap-2.5"
          >
            <Moon className="size-4 shrink-0" />
            <span className="flex-1 text-sm">
              Switch to {resolvedTheme === "dark" ? "light" : "dark"} theme
            </span>
          </CommandItem>
          <CommandItem
            value="project dashboard management page view"
            onSelect={() => {
              setView(view === "canvas" ? "dashboard" : "canvas");
              setOpen(false);
            }}
            className="gap-2.5"
          >
            <LayoutDashboard className="size-4 shrink-0" />
            <span className="flex-1 text-sm">
              {view === "canvas" ? "Open project dashboard" : "Back to workflow canvas"}
            </span>
            <CommandShortcut>⇧D</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

/** Header chip that opens the palette (dispatches the custom event). */
export function CommandPaletteTrigger() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent(OPEN_EVENT))}
      className="flex h-8 items-center gap-1 rounded-md border bg-muted/40 px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
      aria-label="Open command palette (Ctrl+K)"
      title="Command palette — Ctrl/⌘ + K"
    >
      <CommandIcon className="size-3" aria-hidden="true" />
      <span className="hidden font-mono text-[10px] sm:inline">K</span>
    </button>
  );
}

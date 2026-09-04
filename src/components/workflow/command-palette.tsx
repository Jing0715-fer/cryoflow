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
  Maximize2,
  Moon,
  Play,
  RotateCcw,
  Wand2,
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
import { useWorkflowStore } from "@/lib/store";
import { JOB_TYPES, jobType, CARD_W, CARD_H } from "@/lib/workflow";
import { TypeIcon } from "./icons";

const OPEN_EVENT = "cryoflow:open-palette";

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  const jobs = useWorkflowStore((s) => s.jobs);

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

        <CommandSeparator />

        {/* ---------------- canvas + app actions ---------------- */}
        <CommandGroup heading="Canvas & app">
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
            value="toggle theme dark light appearance"
            onSelect={toggleTheme}
            className="gap-2.5"
          >
            <Moon className="size-4 shrink-0" />
            <span className="flex-1 text-sm">
              Switch to {resolvedTheme === "dark" ? "light" : "dark"} theme
            </span>
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

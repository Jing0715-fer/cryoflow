"use client";

/**
 * CryoFlow — ⌘K / Ctrl+K command palette (Linear/n8n-style).
 *
 * Three command families, all fuzzy-searchable:
 *   • Jobs      — jump: idle → edit panel, submitted → results inspector
 *   • Run       — one-shot launch for idle jobs
 *   • Job types — add any catalog type onto the canvas
 *   • Canvas    — zoom to fit · reset view · tidy layout · theme toggle
 *   • Export    — chart CSV for the job you're looking at, no inspector
 *                 needed (Task 110; same rows, same filename, same toast)
 *   • Copy      — the same chart rows as clipboard TSV (Task 113; one
 *                 fetch-and-derive feeds both destinations, wording mirrors
 *                 the chart domain's copy buttons)
 *
 * Opens with Ctrl+K (⌘K) or the header chip, which dispatches the
 * "cryoflow:open-palette" event (keeps the dialog owner decoupled).
 */

import * as React from "react";
import { useTheme } from "next-themes";
import {
  Command as CommandIcon,
  Copy,
  Download,
  FileJson,
  FileSpreadsheet,
  FileUp,
  GraduationCap,
  Keyboard,
  Layers,
  LayoutDashboard,
  Maximize2,
  Moon,
  Play,
  Radar,
  RadioTower,
  RotateCcw,
  SlidersHorizontal,
  StickyNote,
  TrendingDown,
  TrendingUp,
  Wand2,
  Waves,
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
import { stageWorkflowFiles } from "@/lib/import-stage";
import { hasJudgment, parseClassNotes } from "@/lib/class-notes";
import type { JobDTO } from "@/lib/types";
import { JOB_TYPES, jobType, CARD_W, CARD_H } from "@/lib/workflow";
import { JOB_PRESETS } from "@/lib/job-presets";
import { exportCanvasPng } from "@/lib/canvas-export";
import { fetchJsonRetry } from "@/lib/retry-fetch";
import { downloadCsv, fileSlug, copyTextToClipboard, rowsToTsv, type CsvRow } from "@/lib/chart-export";
import { CHART_EXPORT_TARGETS, type ChartExportTarget } from "@/lib/chart-rows";
import {
  buildWorkflowFile,
  downloadWorkflowJson,
  workflowFileName,
} from "@/lib/workflow-io";
import { TypeIcon } from "./icons";

const OPEN_EVENT = "cryoflow:open-palette";

/** Per-chart icon + accent for the Export group — the SAME icon the chart's
 *  own header carries, so a palette row is recognizably "that chart" before
 *  it is clicked (cross-surface recognition, not a new icon dialect). */
const CHART_ICONS: Record<
  string,
  { Icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  fsc: { Icon: Waves, tone: "text-teal-600" },
  guinier: { Icon: TrendingDown, tone: "text-amber-600" },
  resolution: { Icon: TrendingUp, tone: "text-teal-600" },
  ctf: { Icon: Radar, tone: "text-teal-600" },
  topaz: { Icon: GraduationCap, tone: "text-fuchsia-600" },
  angdist: { Icon: RadioTower, tone: "text-teal-600" },
};

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  const jobs = useWorkflowStore((s) => s.jobs);
  const edges = useWorkflowStore((s) => s.edges);
  const view = useWorkflowStore((s) => s.view);
  const setView = useWorkflowStore((s) => s.setView);
  const workspaces = useWorkflowStore((s) => s.workspaces);
  const activeWorkspaceId = useWorkflowStore((s) => s.activeWorkspaceId);
  const switchWorkspace = useWorkflowStore((s) => s.switchWorkspace);
  const noteSpotlight = useWorkflowStore((s) => s.noteSpotlight);
  const toggleNoteSpotlight = useWorkflowStore((s) => s.toggleNoteSpotlight);
  // Export group target (Task 110): the inspector job, else primary selection
  const inspectId = useWorkflowStore((s) => s.inspectId);
  const selectedId = useWorkflowStore((s) => s.selectedId);

  // Notes group (Task 75; predicate upgraded to hasJudgment in Task 86) —
  // the scientist's margin notes become first-class palette citizens: each
  // judged job is one row whose SEARCH VALUE carries the note TEXT (plus the
  // class note texts, fused below), so fuzzy-typing a phrase from an
  // annotation ("good class", "redo ab initio") finds the job even when its
  // name wouldn't. hasJudgment is the SAME predicate the canvas lens dims
  // by, the header chip counts and the dashboard Noted chip filters — the
  // palette was the last reader still on the raw j.note, which meant a job
  // annotated only through class notes stayed lit on canvas yet was
  // unsearchable here (cross-surface contract break, fixed).
  // Workspace-scoped, same rule the canvas lens dims by.
  const notedJobs = (
    activeWorkspaceId == null
      ? jobs
      : jobs.filter((j) => (j.workspaceId ?? "") === activeWorkspaceId)
  ).filter(hasJudgment);

  // Class notes group (Task 81) — the gallery's per-class annotations become
  // palette citizens too: one row per noted class, searchable by the note
  // TEXT, the class number and the host job's name. Scope: the same active
  // workspace the canvas lens dims by; only IDLE select2d hosts (the edit
  // panel is the only surface with a gallery) whose upstream classification
  // has actually completed — otherwise the jump would land on a panel with
  // no gallery to open, a promise the entry must not make.
  const wsScope = (j: JobDTO) =>
    activeWorkspaceId == null || (j.workspaceId ?? "") === activeWorkspaceId;
  const upstreamDone = (job: JobDTO) => {
    const sources = edges
      .filter((e) => e.toJobId === job.id)
      .map((e) => jobs.find((j) => j.id === e.fromJobId))
      .filter((j): j is JobDTO => j != null && (j.type === "class2d" || j.type === "select2d"));
    const pick = sources.find((j) => j.status === "completed") ?? sources[0];
    return pick != null && pick.status === "completed";
  };
  const notedClasses = jobs
    .filter(wsScope)
    .filter((j) => j.type === "select2d" && j.status === "idle" && upstreamDone(j))
    .flatMap((j) =>
      Object.entries(parseClassNotes(j.params?.classNotes)).map(([cls, text]) => ({
        job: j,
        cls: Number(cls),
        text,
      }))
    )
    .sort((a, b) => a.job.name.localeCompare(b.job.name) || a.cls - b.cls);
  // a 200-class run can theoretically carry hundreds of notes — cap the
  // list, keep the heading honest about the total
  const CLASS_NOTE_CAP = 12;
  const notedClassRows = notedClasses.slice(0, CLASS_NOTE_CAP);

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

  /** Class-note deep link (Task 81): land on the host job's edit panel with
   *  the lightbox open on the noted class, editor focused. The one-shot
   *  handshake rides in the store (pendingClassFocus) — the panel consumes
   *  it on arrival, so a stale request can never re-open later. */
  const jumpToClassNote = (jobId: string, cls: number) => {
    const s = useWorkflowStore.getState();
    s.select(jobId);
    s.focusJob(jobId);
    s.requestClassFocus(jobId, cls);
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

  const openShortcuts = () => {
    // same dance: the palette must yield focus before the dialog opens
    close();
    useWorkflowStore.getState().setShortcutsOpen(true);
  };

  // ---- Export chart data (Task 110) + Copy chart data (Task 113) --------
  // Target: the job the user is ALREADY looking at — the open inspector,
  // else the primary canvas selection. No target, no group: a promise the
  // palette must not make.
  const exportTargetJob =
    jobs.find((j) => j.id === (inspectId ?? selectedId)) ?? null;

  // ONE fetch-and-derive for both destinations: the rows the palette hands
  // to the CSV download are the SAME rows it hands to the TSV copy — a
  // second implementation here would be a second truth waiting to drift.
  // Throws on fetch failure (the caller toasts); an empty array is the
  // chart's own "nothing drawn yet" and stays honest in both doors.
  const fetchChartRows = async (
    t: ChartExportTarget,
    job: JobDTO,
  ): Promise<CsvRow[]> => {
    const data = await fetchJsonRetry<unknown>(t.endpoint(job.id));
    return t.rows(data);
  };

  const exportChartRows = (t: ChartExportTarget, job: JobDTO) => {
    // close first (same dance as every other entry); the toast is the
    // receipt — success names the file, an empty result stays honest
    close();
    void (async () => {
      try {
        const rows = await fetchChartRows(t, job);
        if (rows.length === 0) {
          toast({
            title: `${t.label}: no data yet`,
            description: `${job.name} has no rendered rows for this chart — it only exports what the curve draws.`,
          });
          return;
        }
        downloadCsv(`cryoflow-${fileSlug(t.label)}`, rows);
        toast({
          title: `${t.label} exported`,
          description: `${rows.length} row${rows.length === 1 ? "" : "s"} → cryoflow-${fileSlug(t.label)}.csv`,
        });
      } catch {
        toast({
          title: `${t.label} export failed`,
          description: `Could not fetch chart data for ${job.name}.`,
          variant: "destructive",
        });
      }
    })();
  };

  // The clipboard door (Task 113): same rows, paste dialect. Wording mirrors
  // the chart domain's copy buttons — one vocabulary across all surfaces.
  // The failure path points at the EXPORT group (the palette's own CSV
  // door), not at a chart button the palette never showed.
  const copyChartRows = (t: ChartExportTarget, job: JobDTO) => {
    close();
    void (async () => {
      try {
        const rows = await fetchChartRows(t, job);
        if (rows.length === 0) {
          toast({
            title: `${t.label}: no data yet`,
            description: `${job.name} has no rendered rows for this chart — there is nothing to copy.`,
          });
          return;
        }
        const ok = await copyTextToClipboard(rowsToTsv(rows));
        if (ok) {
          toast({
            title: `${t.label} copied`,
            description: `${rows.length} row${rows.length === 1 ? "" : "s"} as TSV — paste straight into a spreadsheet`,
          });
        } else {
          toast({
            title: `${t.label} could not be copied`,
            description: "Clipboard access was blocked — use the CSV export instead.",
            variant: "destructive",
          });
        }
      } catch {
        toast({
          title: `${t.label} copy failed`,
          description: `Could not fetch chart data for ${job.name}.`,
          variant: "destructive",
        });
      }
    })();
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
    // multi-file since Task 86 — same funnel the canvas picker uses;
    // Task 92: staging (all-invalid toast / preview hand-off) extracted to
    // stageWorkflowFiles, shared with the canvas input AND the canvas drop
    input.multiple = true;
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      if (files.length === 0) return;
      await stageWorkflowFiles(files);
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

        {/* ---------------- notes (annotated jobs) ---------------- */}
        {notedJobs.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup
              heading={`Notes · ${notedJobs.length} annotated job${notedJobs.length === 1 ? "" : "s"}`}
            >
              {notedJobs.map((j) => {
                const spec = jobType(j.type);
                // granularity twin (Task 82 doctrine): the StickyNote icon
                // reads "this step is noted", the amber count capsule reads
                // "judgments inside the step are noted" — same visual
                // grammar as the canvas card (Row 1) and dashboard row
                // badges, so the palette speaks the same dialect
                const classNotes = Object.entries(parseClassNotes(j.params?.classNotes));
                // index-first doctrine (Task 83): when a job carries only
                // class notes, the middle column shows the scannable class
                // INDEX (which classes are annotated) — the identity that
                // survives a truncate — instead of an empty cell
                const classIdx = classNotes.map(([k]) => `Class ${k}`).join(", ");
                // the note TEXT is the searchable payload — "note" leading
                // token makes plain "note" queries land in this group first.
                // Class note texts fuse into the payload (Task 86) so a
                // phrase from any judgment finds its HOST row here and its
                // per-annotation row in the Class notes group below. The
                // fusion is capped: a 200-class run's texts must never
                // bloat the fuzzy matcher's haystack.
                const fusedClassTexts = classNotes
                  .map(([, t]) => t)
                  .join(" ")
                  .slice(0, 240);
                return (
                  <CommandItem
                    key={`note-${j.id}`}
                    value={`note ${j.name} ${j.type} ${j.note ?? ""} ${fusedClassTexts}`}
                    onSelect={() => jumpToJob(j.id)}
                    className="gap-2.5"
                  >
                    <StickyNote className="size-4 shrink-0 text-amber-500 dark:text-amber-400" />
                    <span className="min-w-0 shrink-0 truncate text-sm font-medium">
                      {j.name}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      {j.note || `class notes on ${classIdx}`}
                    </span>
                    {classNotes.length > 0 && (
                      <span
                        data-palette-note-classbadge=""
                        data-palette-note-classcount={classNotes.length}
                        role="img"
                        aria-label={`${classNotes.length} class${classNotes.length === 1 ? "" : "es"} noted`}
                        title={`Class notes on ${classNotes.map(([k]) => `Class ${k}`).join(", ")}`}
                        className="flex h-4 shrink-0 items-center gap-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 text-[9px] font-semibold tabular-nums text-amber-600 dark:text-amber-400"
                      >
                        <StickyNote className="size-2.5" aria-hidden="true" />
                        {classNotes.length}
                      </span>
                    )}
                    <TypeIcon
                      name={spec?.icon ?? "boxes"}
                      className={`size-3.5 shrink-0 ${spec?.color.text ?? "text-muted-foreground"}`}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}

        {/* ---------------- class notes (gallery annotations) ---------------- */}
        {notedClassRows.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup
              heading={`Class notes · ${notedClasses.length} annotation${notedClasses.length === 1 ? "" : "s"}${notedClasses.length > notedClassRows.length ? ` — first ${notedClassRows.length}` : ""}`}
            >
              {notedClassRows.map(({ job, cls, text }) => {
                const spec = jobType(job.type);
                return (
                  <CommandItem
                    key={`class-note-${job.id}-${cls}`}
                    value={`class note class ${cls} ${job.name} ${job.type} ${text}`}
                    onSelect={() => jumpToClassNote(job.id, cls)}
                    className="gap-2.5"
                  >
                    <StickyNote className="size-4 shrink-0 text-amber-500 dark:text-amber-400" />
                    <span
                      data-palette-classnote-chip=""
                      className="flex h-4 shrink-0 items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 font-mono text-[9px] font-semibold tabular-nums text-amber-600 dark:text-amber-400"
                    >
                      Class {cls}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      {text}
                    </span>
                    <span className="max-w-32 shrink-0 truncate text-[11px] text-muted-foreground/70">
                      {job.name}
                    </span>
                    <TypeIcon
                      name={spec?.icon ?? "boxes"}
                      className={`size-3.5 shrink-0 ${spec?.color.text ?? "text-muted-foreground"}`}
                    />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}

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

        {/* ---------------- export chart data (Task 110) ---------------- */}
        {exportTargetJob && (
          <>
            <CommandSeparator />
            <CommandGroup heading={`Export chart data · ${exportTargetJob.name}`}>
              {CHART_EXPORT_TARGETS.map((t) => {
                const { Icon, tone } = CHART_ICONS[t.key] ?? {
                  Icon: FileSpreadsheet,
                  tone: "text-muted-foreground",
                };
                return (
                  <CommandItem
                    key={`chart-export-${t.key}`}
                    value={`export ${t.label} csv chart data ${exportTargetJob.name}`}
                    onSelect={() => exportChartRows(t, exportTargetJob)}
                    className="gap-2.5"
                  >
                    <Icon className={`size-4 shrink-0 ${tone}`} />
                    <span className="min-w-0 flex-1 truncate text-sm">{t.label}</span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                      csv · cryoflow-{fileSlug(t.label)}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {/* Task 113 — the clipboard door reaches the keyboard flow: the
                SAME rows as the export group (one fetchChartRows), paste
                dialect, Copy icon tinted with each chart's tone so a row is
                recognizably "that chart's copy" before it is clicked. PNG
                copy stays palette-excluded: it needs a mounted SVG, and the
                jump-and-scroll orchestration was rejected in Task 110. */}
            <CommandGroup heading={`Copy chart data · ${exportTargetJob.name}`}>
              {CHART_EXPORT_TARGETS.map((t) => {
                const { Icon, tone } = CHART_ICONS[t.key] ?? {
                  Icon: FileSpreadsheet,
                  tone: "text-muted-foreground",
                };
                return (
                  <CommandItem
                    key={`chart-copy-${t.key}`}
                    value={`copy ${t.label} tsv clipboard chart data ${exportTargetJob.name}`}
                    onSelect={() => copyChartRows(t, exportTargetJob)}
                    className="gap-2.5"
                    data-canvas-ui={`palette-chart-copy-${t.key}`}
                  >
                    <Copy className={`size-4 shrink-0 ${tone}`} />
                    <span className="min-w-0 flex-1 truncate text-sm">{t.label}</span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                      tsv · clipboard
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
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
            value="note spotlight annotated annotations margin lens filter dim discover"
            onSelect={() => {
              toggleNoteSpotlight();
              close();
            }}
            className="gap-2.5"
          >
            <StickyNote
              className={`size-4 shrink-0 ${
                noteSpotlight ? "text-amber-500 dark:text-amber-400" : "text-muted-foreground"
              }`}
            />
            <span className="flex-1 text-sm">
              {noteSpotlight ? "Show all jobs (spotlight off)" : "Spotlight noted jobs"}
              <span className="ml-1.5 text-[10px] text-muted-foreground">
                dim cards without a note
              </span>
            </span>
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
          <CommandItem
            value="keyboard shortcuts keys help bindings discover"
            onSelect={openShortcuts}
            className="gap-2.5"
          >
            <Keyboard className="size-4 shrink-0" />
            <span className="flex-1 text-sm">Keyboard shortcuts</span>
            <CommandShortcut>?</CommandShortcut>
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

"use client";

/**
 * CryoFlow — job details panel (RELION job-window faithful).
 *
 * Structure:
 *  - Header: identity (icon / name / close), status + engine badges,
 *    description, action row (Run / Reset / Log / Delete), live progress.
 *  - Body tabs: I/O (port-by-port connections) · Params (RELION GUI tabs
 *    with group frames — t382: every parameter visible, no folds) ·
 *    Results (JobResults viewer) · Log (inline engine log tail).
 *
 * The panel body remounts per job (key={job.id}) so every form resets when
 * switching selection.
 */

import * as React from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  Archive,
  BarChart3,
  ChevronDown,
  Server,
  Check,
  CircleAlert,
  CloudUpload,
  Database,
  FolderOpen,
  History,
  Link2,
  Loader2,
  MousePointerClick,
  Play,
  Plus,
  RotateCcw,
  RefreshCw,
  SlidersHorizontal,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import { PORT_COLORS, coerceParam, jobType, portsCompatible, tabsFor, visibleOutputs } from "@/lib/workflow";
import { registerParamFlusher, useWorkflowStore } from "@/lib/store";
import { COMMAND_TEMPLATES } from "@/lib/relion/command-templates";
import { ClassGallery } from "./class-gallery";
import { CopyButton } from "./copy-button";
import type {
  EdgeDTO,
  JobDTO,
  JobTypeSpec,
  ParamSchema,
  ParamValue,
  PortKind,
  PortSpec,
} from "@/lib/types";
import { TypeIcon } from "./icons";
import { MiniProgress, StatusBadge, isSlurmQueued } from "./job-card";
import { PathBrowserDialog } from "./path-browser-dialog";
import { JobResults } from "./results/results-view";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { HpcSbatchDialog } from "./hpc-sbatch-dialog";
import { RemoteRunButton } from "./remote-run-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckSquare, ChevronUp, ListFilter, Folder } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Panel tab — the reading position (Task 162, stay-put family)         */
/*                                                                      */
/* Task 157 restored WHICH JOB's panel is open across a reload; this    */
/* restores WHICH PAGE of it you were reading. Not a filter (switching  */
/* tabs hides nothing — the other sections are one click away) and no   */
/* lens (it changes no semantics), so it is pure POSITION: the fourth    */
/* member of the session-position family after selectedId (t157),       */
/* activeWorkspaceId (t159) and leftRailTab (t160).                     */
/*                                                                      */
/* Trust gate = the WHITELIST itself (t160's mirror idiom): the tab     */
/* space is a finite set this component renders {io, params, results,   */
/* log}, so the seed is honest only if it names one of them; hand-edited */
/* garbage, "", null all resolve to "io" — the honest unknown is the    */
/* tab the panel always booted on.                                      */
/*                                                                      */
/* Hydration idiom = lazy useState (t156's, not t160's boot effect):    */
/* PanelBody only mounts once a job resolves, and jobs load in a client */
/* effect — the component is never in the SSR HTML ("data not arrived,  */
/* UI not born"), so a lazy hydrate cannot fight the server pass.       */
/* Boot writes NOTHING: hydrate reads, only the gestures below write.   */
/* ------------------------------------------------------------------ */

const PANEL_TAB_KEY = "cryoflow.panelTab.v1";
const PANEL_TABS = ["io", "params", "results", "log"] as const;
type PanelTab = (typeof PANEL_TABS)[number];

function hydratePanelTab(): PanelTab {
  if (typeof window === "undefined") return "io";
  try {
    const raw = window.localStorage.getItem(PANEL_TAB_KEY)?.trim();
    return (PANEL_TABS as readonly string[]).includes(raw ?? "") ? (raw as PanelTab) : "io";
  } catch {
    return "io"; // private mode / quota — the honest default
  }
}

function persistPanelTab(tab: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PANEL_TAB_KEY, tab);
  } catch {
    /* private mode / quota — the tab stays in-RAM */
  }
}

/* ------------------------------------------------------------------ */
/* Empty state (transient — the panel is only mounted when a job is     */
/* selected; this covers the deleted-job window)                        */
/* ------------------------------------------------------------------ */

function PanelEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <MousePointerClick className="size-6" aria-hidden="true" />
      </div>
      <div>
        <p className="text-sm font-medium">Select a job on the canvas</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Its parameters, run controls and connections appear here.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Engine badge                                                         */
/* ------------------------------------------------------------------ */

function EngineBadge() {
  return (
    <Badge
      variant="outline"
      className="h-5 border-teal-500/40 bg-teal-500/10 px-1.5 text-[9px] font-semibold uppercase tracking-wider text-teal-600 dark:text-teal-400"
      title="Runs on the REAL RELION engine (real binaries, real data)"
    >
      RELION
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/* Remote staging bytes (info strip)                                    */
/* ------------------------------------------------------------------ */

/** " · 12.4 MB" for the staging phase line — "" when nothing staged yet. */
function formatStagedBytes(bytes?: number): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes >= 1024 ** 3) return ` · ${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return ` · ${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return ` · ${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/* ------------------------------------------------------------------ */
/* Connection chips                                                     */
/* ------------------------------------------------------------------ */

function EdgeChip({
  label,
  direction,
  onRemove,
}: {
  label: string;
  direction: "in" | "out";
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md border bg-secondary/60 py-1 pl-2 pr-1 text-xs">
      {direction === "in" ? (
        <ArrowRight className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
      ) : null}
      <span className="truncate" title={label}>
        {label}
      </span>
      {direction === "out" ? (
        <ArrowRight className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
      ) : null}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove connection ${direction === "in" ? "from" : "to"} ${label}`}
        className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* I/O tab                                                              */
/* ------------------------------------------------------------------ */

function portDotClass(port: PortSpec): string {
  const kind: PortKind | undefined =
    port.kind ?? (port.accepts?.find((a): a is PortKind => a !== "*") as PortKind | undefined);
  return PORT_COLORS[kind ?? "star"]?.dot ?? "bg-slate-400";
}

/* ------------------------------------------------------------------ */
/* "Link source…" picker (unconnected input ports)                     */
/* ------------------------------------------------------------------ */

interface SourceOption {
  jobId: string;
  jobName: string;
  fromPort: string;
  portLabel: string;
  icon: string;
  /** Port order inside the source spec (secondary sort key). */
  order: number;
}

/** Every output port of every OTHER job that can feed this input. */
function compatibleSources(job: JobDTO, port: PortSpec, jobs: JobDTO[]): SourceOption[] {
  const out: SourceOption[] = [];
  for (const j of jobs) {
    if (j.id === job.id) continue;
    const jSpec = jobType(j.type);
    if (!jSpec) continue;
    // t315 — a port hidden by its `when` (the import job's one-of-three
    // output by Node type) is not a wiring source either: the drawer lists
    // exactly the ports the canvas shows.
    const visible = visibleOutputs(jSpec, j.params);
    visible.forEach((p, order) => {
      if (portsCompatible(j.type, p.name, job.type, port.name)) {
        out.push({
          jobId: j.id,
          jobName: j.name,
          fromPort: p.name,
          portLabel: p.label,
          icon: jSpec.icon ?? "Boxes",
          order,
        });
      }
    });
  }
  // stable order: by job name, then by the source port order
  out.sort(
    (a, b) => a.jobName.localeCompare(b.jobName) || a.order - b.order
  );
  return out;
}

function LinkSourceControl({
  job,
  port,
  jobs,
}: {
  job: JobDTO;
  port: PortSpec;
  jobs: JobDTO[];
}) {
  const connect = useWorkflowStore((s) => s.connect);
  const [open, setOpen] = React.useState(false);
  const options = React.useMemo(
    () => compatibleSources(job, port, jobs),
    [job, port, jobs]
  );

  if (options.length === 0) {
    return (
      <button
        type="button"
        disabled
        title="No compatible output ports on other jobs yet"
        className="flex w-full cursor-not-allowed items-center gap-1.5 rounded-md border border-dashed px-2 py-1.5 text-left text-[11px] italic text-muted-foreground/60"
      >
        <Plus className="size-3 shrink-0" aria-hidden="true" />
        <span className="sr-only">Link a source to {port.label}</span>
        No compatible source yet
      </button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Pick an upstream job to feed this input"
          aria-label={`Link a source to ${port.label} input`}
          className="flex w-full items-center gap-1.5 rounded-md border border-dashed px-2 py-1.5 text-left text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          <Plus className="size-3 shrink-0 text-primary" aria-hidden="true" />
          <span className="sr-only">Link a source to {port.label}</span>
          Link source…
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-64 p-1"
        aria-label={`Compatible sources for ${port.label}`}
      >
        <div className="max-h-64 overflow-y-auto">
          {options.map((o) => (
            <button
              key={`${o.jobId}:${o.fromPort}`}
              type="button"
              onClick={() => {
                setOpen(false);
                void connect(o.jobId, job.id, o.fromPort, port.name);
              }}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs outline-none transition-colors hover:bg-accent focus-visible:bg-accent"
            >
              <TypeIcon name={o.icon} className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate" title={`${o.jobName} · ${o.portLabel}`}>
                {o.jobName}
                <span className="text-muted-foreground"> · {o.portLabel}</span>
              </span>
              <ArrowRight className="size-3 shrink-0 text-muted-foreground/60" aria-hidden="true" />
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PortRow({
  port,
  direction,
  edges,
  jobNameById,
  onRemove,
  footer,
}: {
  port: PortSpec;
  direction: "in" | "out";
  edges: EdgeDTO[];
  jobNameById: Map<string, string>;
  onRemove: (id: string) => void;
  /** Extra control under the chips row (e.g. "Link source…" picker). */
  footer?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-secondary/30 p-2.5">
      <div className="flex items-center gap-2">
        <span
          className={cn("size-2 shrink-0 rounded-full", portDotClass(port))}
          aria-hidden="true"
        />
        <p className="min-w-0 flex-1 truncate text-xs font-medium" title={port.label}>
          {port.label}
        </p>
        {port.multiple && (
          <span className="shrink-0 text-[10px] text-muted-foreground">
            accepts multiple inputs
          </span>
        )}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5 pl-4">
        {edges.length === 0 ? (
          <span className="inline-flex items-center rounded-md border border-dashed px-2 py-1 text-[11px] italic text-muted-foreground/70">
            {direction === "in" ? "not connected" : "no downstream jobs"}
          </span>
        ) : (
          edges.map((e) => (
            <EdgeChip
              key={e.id}
              label={
                jobNameById.get(direction === "in" ? e.fromJobId : e.toJobId) ?? "Unknown job"
              }
              direction={direction}
              onRemove={() => onRemove(e.id)}
            />
          ))
        )}
      </div>
      {footer ? <div className="mt-1.5 pl-4">{footer}</div> : null}
    </div>
  );
}

function IOTab({ job, spec }: { job: JobDTO; spec: JobTypeSpec | undefined }) {
  const edges = useWorkflowStore((s) => s.edges);
  const jobs = useWorkflowStore((s) => s.jobs);
  const removeEdge = useWorkflowStore((s) => s.removeEdge);

  const jobNameById = React.useMemo(
    () => new Map(jobs.map((j) => [j.id, j.name])),
    [jobs]
  );

  const incoming = edges.filter((e) => e.toJobId === job.id);
  const outgoing = edges.filter((e) => e.fromJobId === job.id);
  const inputs = spec?.inputs ?? [];
  const outputs = spec?.outputs ?? [];

  /** Match edges to a named port; legacy port-less edges land on the first port. */
  const edgesFor = (port: PortSpec, index: number, direction: "in" | "out"): EdgeDTO[] =>
    (direction === "in" ? incoming : outgoing).filter(
      (e) =>
        (direction === "in" ? e.toPort : e.fromPort) === port.name ||
        ((direction === "in" ? e.toPort : e.fromPort) == null && index === 0)
    );

  return (
    <div className="space-y-5 p-4">
      {/* Inputs */}
      <section aria-label="Inputs">
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Inputs
        </p>
        {inputs.length === 0 ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-dashed bg-secondary/20 p-3">
            <Database className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="text-xs font-medium">Source job</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                Data enters the pipeline here — no inputs to wire.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {inputs.map((port, i) => {
              const portEdges = edgesFor(port, i, "in");
              return (
                <PortRow
                  key={port.name}
                  port={port}
                  direction="in"
                  edges={portEdges}
                  jobNameById={jobNameById}
                  onRemove={(id) => void removeEdge(id)}
                  footer={
                    portEdges.length === 0 ? (
                      <LinkSourceControl job={job} port={port} jobs={jobs} />
                    ) : undefined
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      <Separator />

      {/* Outputs */}
      <section aria-label="Outputs">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Outputs
        </p>
        {outputs.length === 0 ? (
          <p className="text-[11px] italic text-muted-foreground/70">
            No named outputs — this job terminates the branch.
          </p>
        ) : (
          <div className="space-y-2">
            {outputs.map((port, i) => (
              <PortRow
                key={port.name}
                port={port}
                direction="out"
                edges={edgesFor(port, i, "out")}
                jobNameById={jobNameById}
                onRemove={(id) => void removeEdge(id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Params tab (RELION GUI simulation)                                   */
/* ------------------------------------------------------------------ */

/**
 * t382 — the RELION job-window ROW: one label + one control per row —
 * the label column fixed-width and right-aligned, the control filling
 * the rest — the exact geometry of RELION's gui_jobwindow.cpp (every
 * option packs as a label-left / entry-right row inside a group frame).
 * The old two-column card grid mixed col-span-2 items into ragged rows
 * and hid the expert options behind a collapsed toggle; the row layout
 * shows EVERY parameter directly (the user's 取消折叠、所有参数直接显示).
 * Hints ride the title tooltip (RELION's own affordance) so 20+ rows stay
 * scannable; advanced labels tone down one notch to keep the groups
 * readable at a glance.
 */
function ParamField({
  p,
  value,
  onChange,
  idPrefix,
  jobId,
}: {
  p: ParamSchema;
  value: ParamValue;
  onChange: (v: ParamValue) => void;
  idPrefix: string;
  /** t394 — the round picker needs the row's job id (fn_cont only). */
  jobId?: string;
}) {
  const inputId = `${idPrefix}-${p.key}`;

  return (
    <div className="grid grid-cols-[118px_minmax(0,1fr)] items-start gap-x-3 sm:grid-cols-[152px_minmax(0,1fr)]">
      <Label
        htmlFor={inputId}
        title={p.hint}
        className={cn(
          "text-xs font-normal leading-snug",
          p.advanced ? "text-muted-foreground" : "text-foreground/90",
          p.type === "bool" ? "pt-2.5" : "pt-1.5"
        )}
      >
        {p.label}
      </Label>
      <div className="min-w-0">
        {p.type === "bool" ? (
          <div className="flex h-8 items-center justify-end">
            <Switch
              id={inputId}
              checked={value === true}
              onCheckedChange={(c) => onChange(c)}
              aria-label={p.label}
            />
          </div>
        ) : p.type === "path" ? (
          <PathParamField p={p} value={value} onChange={onChange} idPrefix={idPrefix} />
        ) : p.key === "fn_cont" && jobId ? (
          // t394 — RELION's "Continue from here:" gets a real round picker
          // (dropdown + typed path + browse) instead of a blind text box
          <ContinueField
            jobId={jobId}
            inputId={inputId}
            value={value}
            onChange={onChange}
            hint={p.hint}
          />
        ) : p.type === "text" ? (
          <Input
            id={inputId}
            type="text"
            value={value === undefined || value === null ? "" : String(value)}
            title={p.hint}
            placeholder={String(p.default)}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 font-mono text-xs"
          />
        ) : p.type === "number" ? (
          <div className="relative">
            <Input
              id={inputId}
              type="number"
              value={value === undefined || value === null ? "" : String(value)}
              min={p.min}
              max={p.max}
              step={p.step}
              title={p.hint}
              onChange={(e) => onChange(e.target.value)}
              className={cn("h-8 text-xs", p.unit && "pr-10")}
            />
            {p.unit && (
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                {p.unit}
              </span>
            )}
          </div>
        ) : (
          <Select value={String(value)} onValueChange={(v) => onChange(v)}>
            <SelectTrigger id={inputId} className="h-8 text-xs" title={p.hint}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(p.options ?? []).map((opt) => (
                <SelectItem key={opt} value={opt} className="text-xs">
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}

/**
 * t300 — engine-native (local bookkeeping) job types, mirrored client-side
 * from the engine's NATIVE_TYPES: they run locally even in a REMOTE project
 * (the import writes micrographs.star with cluster paths; select/symexpand/
 * rebalance are table surgery — nothing to dispatch). Everything else in a
 * remote project dispatches to the cluster by default.
 */
const REMOTE_BOOKKEEPING_TYPES = new Set([
  "import", "mapimport", "manualpick", "select", "select2d", "symexpand", "rebalance",
  "cs2star", // t336 — the conversion runs in-process (SSH for the cluster lane)
]);

/**
 * Path-type param — one field, three RELION-import forms (like RELION's
 * "Select files by: File name pattern / Browse"):
 *   - a folder           → imports every image file inside it
 *   - a wildcard pattern → /data/movies/*.tiff — expanded by the engine at
 *                          run time (matches previewed in the browse dialog)
 *   - a multi-file list  → newline-separated absolute paths, picked with the
 *                          Files tab's checkboxes (accumulates across folders)
 */
function PathParamField({
  p,
  value,
  onChange,
  idPrefix,
}: {
  p: ParamSchema;
  value: ParamValue;
  onChange: (v: ParamValue) => void;
  idPrefix: string;
}) {
  const inputId = `${idPrefix}-${p.key}`;
  const [browsing, setBrowsing] = React.useState(false);
  // t311 — long file lists collapse to a SUMMARY by default. A 400-file pick
  // used to land in the textarea as 400 newline-separated absolute paths —
  // even capped at 4 visible rows it dominated the params tab (the user's
  // report: "不要显示所有照片的路径…会占用太多空间"). The summary keeps the
  // count + folders + first two paths on ~4 lines; "show all" restores the
  // editable textarea (editing stays possible, and re-browsing re-seeds the
  // multi-select from the full value — nothing is lost).
  const [expanded, setExpanded] = React.useState(false);
  // t300 — a REMOTE project browses the CLUSTER's filesystem for every path
  // param (movies folder, star files, reference maps…): the bound connection
  // switches the browser's backend; picked paths are cluster-absolute.
  const projectRemote = useWorkflowStore((s) => s.project?.remote ?? null);
  const remoteBrowser = projectRemote
    ? { connectionId: projectRemote.connectionId, label: projectRemote.name }
    : null;
  const raw = value === undefined || value === null ? "" : String(value);
  const trimmed = raw.trim();
  const lines = trimmed ? trimmed.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : [];
  const isPattern = lines.length === 1 && /[*?]/.test(lines[0]);
  const isFileList = lines.length > 1;
  const manyFiles = isFileList && lines.length > 8;
  const collapsed = manyFiles && !expanded;
  const folderCount = new Set(
    lines.map((l) => (l.includes("/") ? l.slice(0, l.lastIndexOf("/")) : l))
  ).size;

  return (
    // t382 — the row's Label lives in ParamField's label column now; this
    // control owns only the entry side (textarea + browse button, or the
    // t311 multi-file summary that keeps a 400-file pick off the panel)
    <div className="w-full space-y-1.5">
      <div className="flex items-start gap-1.5">
      {collapsed ? (
          <div
            className="flex-1 rounded-md border bg-secondary/30 px-2.5 py-2"
            role="group"
            aria-label={`${p.label}: ${lines.length} files selected (collapsed summary — show all for the full list)`}
          >
            <div className="flex items-center gap-1.5">
              <CheckSquare className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span className="text-xs font-medium text-primary">{lines.length} files</span>
              <span className="text-[10px] text-muted-foreground">
                · {folderCount} folder{folderCount === 1 ? "" : "s"} · imported exactly as listed
              </span>
              <button
                type="button"
                className="ml-auto inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setExpanded(true)}
                aria-label={`Show all ${lines.length} file paths`}
                title="Expand to the full editable path list"
              >
                <ChevronDown className="h-3 w-3" aria-hidden="true" />
                show all
              </button>
            </div>
            <p
              className="mt-1 truncate font-mono text-[10px] leading-relaxed text-muted-foreground"
              title={lines[0]}
            >
              {lines[0]}
            </p>
            {lines.length > 1 && (
              <p
                className="truncate font-mono text-[10px] leading-relaxed text-muted-foreground"
                title={lines[1]}
              >
                {lines[1]}
              </p>
            )}
            {lines.length > 2 && (
              <p className="text-[10px] leading-relaxed text-muted-foreground/70">
                +{lines.length - 2} more — paths are kept, only the display is collapsed
              </p>
            )}
          </div>
        ) : isFileList ? (
          <>
            <Textarea
              id={inputId}
              value={raw}
              title={p.hint}
              onChange={(e) => onChange(e.target.value)}
              rows={expanded ? Math.min(8, Math.max(4, lines.length)) : Math.min(4, Math.max(2, lines.length))}
              placeholder={"One file path per line…"}
              className="min-h-8 resize-y font-mono text-xs"
              aria-label={`${p.label} — ${lines.length} files`}
            />
            {manyFiles && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 shrink-0 px-1.5"
                onClick={() => setExpanded(false)}
                aria-label="Collapse the file list back to a summary"
                title="Collapse back to the summary"
              >
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            )}
          </>
        ) : (
          <Input
            id={inputId}
            value={raw}
            placeholder={
              remoteBrowser
                ? "Cluster folder, wildcard (…/*.mrc), or paste cluster paths"
                : "Folder, wildcard (…/*.tiff), or paste file paths"
            }
            title={p.hint}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 font-mono text-xs"
          />
        )}
        <Button
          variant="outline"
          size="sm"
          className={cn("h-8 shrink-0 gap-1 px-2", remoteBrowser && "border-violet-500/40 text-violet-600 hover:bg-violet-500/10 dark:text-violet-400")}
          onClick={() => setBrowsing(true)}
          aria-label={`Browse for ${p.label}${remoteBrowser ? " on the cluster" : ""}`}
          title={
            remoteBrowser
              ? `Browse ${projectRemote?.name ?? "the cluster"}'s filesystem over SSH — paths stay on the cluster`
              : "Browse folders, multi-select files, or preview a wildcard pattern"
          }
        >
          {remoteBrowser ? (
            <Server className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          Browse
        </Button>
      </div>
      {browsing && (
        <PathBrowserDialog
          open={browsing}
          onOpenChange={setBrowsing}
          onPick={(picked) => onChange(picked)}
          initialPath={raw}
          initialMode={p.filePick ? "files" : "folder"}
          remote={remoteBrowser}
        />
      )}
      {trimmed && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {isPattern ? (
            <>
              <ListFilter className="h-3 w-3 text-primary" aria-hidden="true" />
              <span className="font-medium text-primary">Wildcard pattern</span>
              <span aria-hidden="true">·</span>
              <span>expanded at import — every matched .mrc/.mrcs/.tif/.eer</span>
            </>
          ) : isFileList ? (
            collapsed ? (
              <span>list collapsed above — the full paths ride the import untouched</span>
            ) : (
              <>
                <CheckSquare className="h-3 w-3 text-primary" aria-hidden="true" />
                <span className="font-medium text-primary">{lines.length} files selected</span>
                <span aria-hidden="true">·</span>
                <span>imported exactly as listed</span>
              </>
            )
          ) : (
            <>
              <Folder className="h-3 w-3 text-amber-500/80" aria-hidden="true" />
              <span>
                {remoteBrowser
                  ? "Folder on the cluster — every image inside (stays there, zero upload)"
                  : "Folder — imports every image inside"}
              </span>
            </>
          )}
          <button
            type="button"
            className="ml-auto rounded px-1 text-[10px] text-muted-foreground transition-colors hover:text-destructive"
            onClick={() => onChange("")}
            aria-label={`Clear ${p.label}`}
          >
            clear
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* t394 — ContinueField: the "Continue from here:" round picker         */
/* ------------------------------------------------------------------ */

/** Client-safe mirror of /api/jobs/[id]/continue-sources' payload. */
interface ContinueRoundEntryDTO {
  iteration: number;
  name: string;
  path: string;
  size: number;
  complete: boolean;
  missing: string[];
  newest: boolean;
  mtimeMs?: number;
}

interface ContinueSourceDTO {
  jobId: string;
  jobName: string;
  jobType: string;
  relation: "self" | "upstream";
  lane: "local" | "remote";
  workdir: string;
  entries: ContinueRoundEntryDTO[];
  truncated?: boolean;
  error?: string;
  /** t395 — the newest .cryoflow_prev generation (the previous run's
   * rounds, moved aside by a re-dispatch and still on the cluster). */
  archived?: boolean;
}

function continueRoundSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size >= 1024 ** 2) return `${(size / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

/**
 * t394 — RELION's "Continue from here:" (fn_cont → --continue) as a real
 * picker: a dropdown of the rounds that actually exist — THIS job's own
 * previous run first, then its refine-family upstream runs — plus the
 * two manual doors RELION's own GUI has (type any path, or Browse the
 * filesystem). Every round is judged by the engine's own --continue
 * legality law server-side: an incomplete checkpoint (a flush that died
 * mid-write, optimiser.star without its data/model/sampling siblings) is
 * shown but disabled, with the missing names — picking it would abort
 * inside RELION ("HealpixSampling::readStar"), so the picker says so
 * instead of letting the run find out an hour in.
 *
 * Paths are lane-honest: a round written by a CLUSTER run speaks its
 * cluster-absolute path (the badge says so); a local run speaks host
 * paths. The value itself is whatever the user last chose or typed —
 * empty means "start from iteration 0" (RELION's own default).
 */
function ContinueField({
  jobId,
  inputId,
  value,
  onChange,
  hint,
}: {
  jobId: string;
  inputId: string;
  value: ParamValue;
  onChange: (v: ParamValue) => void;
  hint?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [browsing, setBrowsing] = React.useState(false);
  const [phase, setPhase] = React.useState<"idle" | "loading" | "ready" | "error">("idle");
  const [sources, setSources] = React.useState<ContinueSourceDTO[]>([]);
  const [fetchError, setFetchError] = React.useState<string | null>(null);
  const fetchedAtRef = React.useRef(0);
  // t300 — the same door every path param speaks: a REMOTE project browses
  // the CLUSTER's filesystem for the optimiser.star pick.
  const projectRemote = useWorkflowStore((s) => s.project?.remote ?? null);
  const remoteBrowser = projectRemote
    ? { connectionId: projectRemote.connectionId, label: projectRemote.name }
    : null;

  const load = React.useCallback(
    async (refresh: boolean) => {
      if (!refresh && Date.now() - fetchedAtRef.current < 8000) return;
      fetchedAtRef.current = Date.now();
      setPhase("loading");
      try {
        const res = await fetch(
          `/api/jobs/${encodeURIComponent(jobId)}/continue-sources${refresh ? "?refresh=1" : ""}`
        );
        const data = (await res.json()) as { sources?: ContinueSourceDTO[]; error?: string };
        if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
        setSources(Array.isArray(data.sources) ? data.sources : []);
        setFetchError(null);
        setPhase("ready");
      } catch (e) {
        setFetchError(e instanceof Error ? e.message : String(e));
        setPhase("error");
      }
    },
    [jobId]
  );

  const raw = value === undefined || value === null ? "" : String(value);
  const trimmed = raw.trim();

  // what the current value MEANS (the summary line): a round the picker
  // knows (job + iteration + lane), or a custom path riding --continue as-is
  const match = React.useMemo(() => {
    if (!trimmed) return null;
    for (const s of sources) {
      const e = s.entries.find((x) => x.path === trimmed);
      if (e) return { source: s, entry: e };
    }
    return null;
  }, [sources, trimmed]);

  const pickableRounds = sources.reduce((n, s) => n + s.entries.length, 0);

  return (
    <div className="w-full space-y-1">
      {/* t395/t396 — the Input owns its OWN row; the two buttons sit under
          it in a wrapping flex row. At the desktop panel's ~184px value
          column the pair wraps to two lines rather than overflow — but the
          belt-and-braces `min-w-0` + inner truncation means even a
          zero-wrap container cannot push a button past the panel edge
          (the t394 field report). RELION's own GUI stacks the same way on
          narrow panels. */}
      <Input
        id={inputId}
        type="text"
        value={raw}
        title={hint}
        placeholder="empty — start from iteration 0 · pick a round, browse, or type any optimiser.star path"
        onChange={(e) => onChange(e.target.value)}
        className="h-8 min-w-0 font-mono text-xs"
      />
      <div className="flex w-full flex-wrap items-center gap-1.5">
        <Popover
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (o) void load(false);
          }}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 min-w-0 shrink-0 gap-1 px-2"
              aria-label="Pick which previous round to continue from"
              title="Pick which previous round to continue from — this job's own previous run, and its upstream refine-family runs"
            >
              <History className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="truncate">Rounds</span>
              <ChevronDown className="h-3 w-3.5 shrink-0" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-88 p-0"
            aria-label="Rounds you can continue from"
          >
            <div className="max-h-80 overflow-y-auto">
              {phase === "loading" && (
                <div className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  Reading checkpoints…
                </div>
              )}
              {phase === "error" && (
                <div className="space-y-2 px-3 py-3">
                  <p className="flex items-start gap-1.5 text-xs text-destructive">
                    <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{fetchError ?? "could not read the rounds"}</span>
                  </p>
                  <button
                    type="button"
                    className="text-[11px] font-medium text-primary hover:underline"
                    onClick={() => void load(true)}
                  >
                    Try again
                  </button>
                </div>
              )}
              {phase === "ready" && (
                <>
                  {trimmed && (
                    <button
                      type="button"
                      onClick={() => {
                        onChange("");
                        setOpen(false);
                      }}
                      className="flex w-full items-center gap-2 border-b px-3 py-2 text-left text-xs transition-colors hover:bg-accent focus-visible:bg-accent"
                    >
                      <X className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="font-medium">Start fresh</span>
                      <span className="text-muted-foreground">— clear the field, run from iteration 0</span>
                    </button>
                  )}
                  {pickableRounds === 0 && sources.every((s) => !s.error) && (
                    <div className="px-3 py-4 text-[11px] leading-relaxed text-muted-foreground">
                      No checkpoints yet. Rounds appear here once this job (or a refine-family
                      upstream job) has run — RELION writes one{" "}
                      <span className="font-mono">run_it###_optimiser.star</span> per iteration.
                    </div>
                  )}
                  {sources.map((s) => (
                    <div key={`${s.jobId}:${s.archived ? "archived" : "live"}`} className={s.entries.length > 0 || s.error ? "border-b last:border-b-0" : ""}>
                      {(s.entries.length > 0 || s.error) && (
                        <div className="flex items-center gap-1.5 bg-secondary/40 px-3 py-1.5">
                          {s.archived ? (
                            <Archive className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                          ) : s.relation === "self" ? (
                            <History className="h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
                          ) : (
                            <Link2 className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                          )}
                          <span className="min-w-0 truncate text-[11px] font-medium" title={s.jobName}>
                            {s.archived
                              ? "This job · previous run"
                              : s.relation === "self"
                                ? "This job"
                                : `Upstream · ${s.jobName}`}
                          </span>
                          {s.lane === "remote" ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400">
                              <Server className="h-2.5 w-2.5" aria-hidden="true" />
                              cluster
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">local</span>
                          )}
                          {s.archived && (
                            <span className="shrink-0 rounded-sm bg-amber-500/15 px-1 text-[9px] font-medium text-amber-700 dark:text-amber-400">
                              archived
                            </span>
                          )}
                          {s.entries.length > 0 && (
                            <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                              {s.entries.length} round{s.entries.length === 1 ? "" : "s"}
                            </span>
                          )}
                        </div>
                      )}
                      {s.archived && !s.error && (
                        <p className="px-3 pt-1.5 text-[10px] leading-relaxed text-muted-foreground">
                          moved aside by a re-dispatch — RELION reads these paths fine; the
                          archive is kept for the next two re-dispatches
                        </p>
                      )}
                      {s.error ? (
                        <p className="px-3 py-2 text-[11px] italic text-muted-foreground">{s.error}</p>
                      ) : (
                        s.entries.map((e) => {
                          const size = continueRoundSize(e.size);
                          return (
                            <button
                              key={`${s.jobId}:${e.name}`}
                              type="button"
                              disabled={!e.complete}
                              onClick={() => {
                                onChange(e.path);
                                setOpen(false);
                              }}
                              title={
                                e.complete
                                  ? `${e.path}${size ? ` · ${size}` : ""}`
                                  : `incomplete checkpoint — missing ${e.missing.slice(0, 3).join(", ")}${e.missing.length > 3 ? "…" : ""}: a --continue from this round would abort inside RELION`
                              }
                              aria-label={
                                e.complete
                                  ? `Continue from iteration ${e.iteration} of ${s.jobName}: ${e.path}`
                                  : `Iteration ${e.iteration} of ${s.jobName} is incomplete and cannot be continued from`
                              }
                              className={cn(
                                "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs outline-none transition-colors",
                                e.complete
                                  ? "hover:bg-accent focus-visible:bg-accent"
                                  : "cursor-not-allowed opacity-55"
                              )}
                            >
                              <span className="w-12 shrink-0 font-mono text-[11px] font-semibold">
                                it {String(e.iteration).padStart(3, "0")}
                              </span>
                              {e.newest && (
                                <Badge className="h-4 rounded-sm bg-emerald-500/15 px-1 text-[9px] font-medium text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400">
                                  newest
                                </Badge>
                              )}
                              {e.complete ? (
                                <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-muted-foreground">
                                  {e.name}
                                  {size ? ` · ${size}` : ""}
                                </span>
                              ) : (
                                <span className="min-w-0 flex-1 truncate text-[10px] italic text-muted-foreground">
                                  incomplete — missing {e.missing[0]}
                                  {e.missing.length > 1 ? ` +${e.missing.length - 1}` : ""}
                                </span>
                              )}
                              {e.path === trimmed && (
                                <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                              )}
                            </button>
                          );
                        })
                      )}
                      {s.truncated && s.entries.length > 0 && (
                        <p className="px-3 pb-1.5 text-[10px] italic text-muted-foreground">
                          listing capped — older rounds may exist on the cluster
                        </p>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 border-t px-3 py-1.5">
              <p className="text-[10px] text-muted-foreground">
                typed paths ride <span className="font-mono">--continue</span> as-is
              </p>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => void load(true)}
                aria-label="Re-read the rounds from the engine and the cluster"
              >
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
                refresh
              </button>
            </div>
          </PopoverContent>
        </Popover>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-8 min-w-0 shrink-0 gap-1 px-2", remoteBrowser && "border-violet-500/40 text-violet-600 hover:bg-violet-500/10 dark:text-violet-400")}
          onClick={() => setBrowsing(true)}
          aria-label={`Browse for an optimiser.star${remoteBrowser ? " on the cluster" : ""}`}
          title={
            remoteBrowser
              ? `Browse ${projectRemote?.name ?? "the cluster"}'s filesystem over SSH for a run_it###_optimiser.star — the path stays cluster-absolute`
              : "Browse the filesystem for a run_it###_optimiser.star"
          }
        >
          {remoteBrowser ? (
            <Server className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <FolderOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          )}
          <span className="truncate">Browse</span>
        </Button>
      </div>
      {browsing && (
        <PathBrowserDialog
          open={browsing}
          onOpenChange={setBrowsing}
          onPick={(picked) => {
            // the browser speaks one path per pick in singleFile mode; a
            // stray multi-line pick keeps its first line (one continue target)
            const first = picked.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)[0] ?? "";
            onChange(first);
          }}
          initialPath={raw}
          singleFile
          title={
            remoteBrowser
              ? `Select an optimiser.star on ${projectRemote?.name ?? "the cluster"}`
              : "Select an optimiser.star"
          }
          description={
            remoteBrowser
              ? `Navigate to the run's output directory on ${projectRemote?.name ?? "the cluster"} and click a run_it###_optimiser.star — the picked path stays cluster-absolute and rides RELION's --continue as-is.`
              : "Navigate to the run's output directory and click a run_it###_optimiser.star — or type the path below and press Use this path. The value rides RELION's --continue as-is."
          }
          remote={remoteBrowser}
        />
      )}
      {trimmed && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {match ? (
            <>
              <Check className="h-3 w-3 text-primary" aria-hidden="true" />
              <span className="font-medium text-primary">
                it {String(match.entry.iteration).padStart(3, "0")}
              </span>
              <span aria-hidden="true">·</span>
              <span title={match.source.jobName}>
                {match.source.archived
                  ? "this job · archived run"
                  : match.source.relation === "self"
                    ? "this job"
                    : match.source.jobName}
              </span>
              <span aria-hidden="true">·</span>
              <span>{match.source.lane === "remote" ? "cluster path" : "local path"}</span>
              {match.entry.newest && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>newest complete round</span>
                </>
              )}
            </>
          ) : (
            <>
              <Terminal className="h-3 w-3 text-muted-foreground/80" aria-hidden="true" />
              <span>custom path — passed to RELION&apos;s --continue as typed</span>
              <button
                type="button"
                className="ml-auto rounded px-1 text-[10px] text-muted-foreground transition-colors hover:text-destructive"
                onClick={() => onChange("")}
                aria-label="Clear the continue-from path"
              >
                clear
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ParamsTab({
  job,
  spec,
  focusClass,
  onClassFocusConsumed,
}: {
  job: JobDTO;
  spec: JobTypeSpec | undefined;
  /** one-shot class-lightbox request handed down from the panel (Task 81) */
  focusClass: number | null;
  onClassFocusConsumed: () => void;
}) {
  const saveJob = useWorkflowStore((s) => s.saveJob);

  const params = spec?.params ?? [];

  const [form, setForm] = React.useState<Record<string, ParamValue>>(() => {
    const init: Record<string, ParamValue> = {};
    for (const p of params) init[p.key] = coerceParam(p, job.params[p.key]);
    return init;
  });

  // auto-save lifecycle — what the footer status line shows
  const [autoSave, setAutoSave] = React.useState<{
    phase: "idle" | "saving" | "saved" | "error";
    at: number | null;
    error?: string;
  }>({ phase: "idle", at: null });

  // RELION GUI tabs + a trailing "Additional" bucket for untabbed params
  const declaredTabs = tabsFor(spec);
  const untabbed = params.filter((p) => !p.tab);
  const allTabs =
    untabbed.length > 0 && !declaredTabs.includes("Additional")
      ? [...declaredTabs, "Additional"]
      : declaredTabs;

  const baseline = React.useCallback(
    (p: ParamSchema) => coerceParam(p, job.params[p.key]),
    [job.params]
  );

  // t381 — the RELION GUI's TOGGLE_DEACTIVATE groups as data (showIf): a
  // gated parameter only renders while its gate param equals the expected
  // value. The gate's OWN gate propagates (nested groups), values survive
  // hiding (RELION keeps deactivated options' values too), and the engine's
  // own if-chains keep hidden values off the argv.
  const gateVisible = React.useCallback(
    (p: ParamSchema): boolean => {
      const visible = (q: ParamSchema, depth: number): boolean => {
        if (!q.showIf || depth > 3) return true;
        const gate = params.find((g) => g.key === q.showIf!.param);
        if (gate && !visible(gate, depth + 1)) return false;
        const raw = form[q.showIf.param];
        const val = gate ? coerceParam(gate, raw) : raw;
        return val === q.showIf.equals;
      };
      return visible(p, 0);
    },
    [form, params]
  );

  const dirty = params.some((p) => coerceParam(p, form[p.key]) !== baseline(p));

  // latest form/dirty/commit for the async saves + unmount flush (closures
  // go stale) — synced in effects, never during render
  const formRef = React.useRef(form);
  const dirtyRef = React.useRef(dirty);
  const commitRef = React.useRef<() => Promise<void>>(async () => {});

  React.useEffect(() => {
    formRef.current = form;
    dirtyRef.current = dirty;
  }, [form, dirty]);

  const commit = React.useCallback(async () => {
    const out: Record<string, ParamValue> = {};
    for (const p of params) out[p.key] = coerceParam(p, formRef.current[p.key]);
    if (params.every((p) => coerceParam(p, job.params[p.key]) === out[p.key])) {
      // nothing actually changed vs the last saved state (e.g. an unmount
      // flush after the debounced save already landed) — skip the request
      return;
    }
    setAutoSave({ phase: "saving", at: null });
    const res = await saveJob(job.id, { params: out }, { silent: true });
    if (res.ok) {
      setAutoSave({ phase: "saved", at: Date.now() });
    } else {
      setAutoSave({ phase: "error", at: null, error: res.error });
    }
  }, [params, job.id, job.params, saveJob]);

  React.useEffect(() => {
    commitRef.current = commit;
  }, [commit]);

  // DEBOUNCED AUTO-SAVE — parameters persist on their own ~700 ms after the
  // last edit; there is no manual Save step to forget.
  React.useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => void commitRef.current(), 700);
    return () => clearTimeout(t);
  }, [form, dirty]);

  // Register a flusher for Run (store.runJob awaits it, so a run never races
  // the debounce window) and flush pending edits on unmount — a switch away
  // from the tab/panel mid-debounce must never silently drop an edit.
  React.useEffect(() => {
    const unregister = registerParamFlusher(job.id, () => commitRef.current());
    return () => {
      unregister();
      if (dirtyRef.current) void commitRef.current();
    };
    // run once per job — commitRef/dirtyRef always hold the latest values
  }, [job.id]);

  const resetForm = () => {
    const init: Record<string, ParamValue> = {};
    for (const p of params) init[p.key] = coerceParam(p, job.params[p.key]);
    setForm(init);
  };

  if (params.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <SlidersHorizontal className="size-5 text-muted-foreground" aria-hidden="true" />
        <p className="text-xs font-medium">No parameters</p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          This job type is fully driven by its inputs.
        </p>
      </div>
    );
  }

  return (
    <Tabs defaultValue={allTabs[0] ?? "params"} className="flex min-h-0 flex-1 flex-col gap-0">
      {/* Inner RELION-style tab bar */}
      <div className="shrink-0 overflow-x-auto border-b px-4 py-2">
        <TabsList className="h-7 w-max">
          {allTabs.map((t) => (
            <TabsTrigger key={t} value={t} className="h-6 px-2.5 text-[11px] whitespace-nowrap">
              {t}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {allTabs.map((t) => {
        const inTab = params.filter((p) => (p.tab ?? "Additional") === t && gateVisible(p));
        const basic = inTab.filter((p) => !p.advanced);
        const advanced = inTab.filter((p) => p.advanced);
        return (
          <TabsContent key={t} value={t} className="mt-0 min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-4 p-4">
              {/* 2D class selection: the gallery IS the parameter — clicks
                  rewrite selectedClasses through the same debounced save */}
              {spec?.key === "select2d" && t === allTabs[0] && (
                <ClassGallery
                  job={job}
                  value={String(form.selectedClasses ?? "auto")}
                  cutoff={typeof form.occupancyCutoff === "number" ? form.occupancyCutoff : 0.5}
                  onChange={(next) => setForm((f) => ({ ...f, selectedClasses: next }))}
                  notes={typeof form.classNotes === "string" ? form.classNotes : "{}"}
                  onNotesChange={(next) => setForm((f) => ({ ...f, classNotes: next }))}
                  focusClass={focusClass}
                  onClassFocusConsumed={onClassFocusConsumed}
                />
              )}
              {inTab.length === 0 && (
                <p className="px-1 py-6 text-center text-[11px] text-muted-foreground">
                  No visible parameters in this tab — the group switches (e.g. the Helix
                  toggle) gate the family on.
                </p>
              )}
              {basic.length > 0 && (
                <fieldset className="rounded-md border px-3.5 pb-3 pt-1.5">
                  <legend className="px-1.5 text-[11px] font-medium text-muted-foreground">
                    Basic options{basic.length > 0 ? ` · ${basic.length}` : ""}
                  </legend>
                  <div className="space-y-2.5">
                    {basic.map((p) => (
                      <ParamField
                        key={p.key}
                        p={p}
                        value={form[p.key] ?? p.default}
                        onChange={(v) => setForm((f) => ({ ...f, [p.key]: v }))}
                        idPrefix={`param-${job.id}`}
                        jobId={job.id}
                      />
                    ))}
                  </div>
                </fieldset>
              )}
              {advanced.length > 0 && (
                <fieldset className="rounded-md border border-border/70 px-3.5 pb-3 pt-1.5">
                  <legend className="px-1.5 text-[11px] font-medium italic text-muted-foreground">
                    Expert options · {advanced.length}
                  </legend>
                  <div className="space-y-2.5">
                    {advanced.map((p) => (
                      <ParamField
                        key={p.key}
                        p={p}
                        value={form[p.key] ?? p.default}
                        onChange={(v) => setForm((f) => ({ ...f, [p.key]: v }))}
                        idPrefix={`param-${job.id}`}
                        jobId={job.id}
                      />
                    ))}
                  </div>
                </fieldset>
              )}
            </div>
          </TabsContent>
        );
      })}

      {/* Task 170's live block lives panel-wide (below the body tabs) —
          the command summarizes io + params + the graph, not just this
          tab's content, so it must not vanish with the params tab. */}

      {/* Auto-save status bar (parameters persist themselves — no manual
          Save button to forget; Reset reverts to the last saved values) */}
      <div className="shrink-0 border-t bg-card">
        <div className="flex items-center justify-between gap-2 px-4 pt-2.5">
          <p className="text-[10px] text-muted-foreground">
            {params.length} parameters · RELION 5 defaults
          </p>
          <p
            aria-live="polite"
            className={cn(
              "flex min-w-0 items-center gap-1 text-[10px] font-medium",
              autoSave.phase === "error"
                ? "text-destructive"
                : autoSave.phase === "saved" && !dirty
                  ? "text-emerald-600 dark:text-emerald-400"
                  : dirty
                    ? "text-primary"
                    : "text-muted-foreground"
            )}
            title={autoSave.error ?? undefined}
          >
            {autoSave.phase === "saving" ? (
              <Loader2 className="size-3 shrink-0 animate-spin" aria-hidden="true" />
            ) : autoSave.phase === "error" ? (
              <CircleAlert className="size-3 shrink-0" aria-hidden="true" />
            ) : autoSave.phase === "saved" && !dirty ? (
              <Check className="size-3 shrink-0" aria-hidden="true" />
            ) : (
              <CloudUpload
                className={cn("size-3 shrink-0", dirty && "animate-pulse")}
                aria-hidden="true"
              />
            )}
            <span className="truncate">
              {autoSave.phase === "error"
                ? "auto-save failed — retrying on next edit"
                : autoSave.phase === "saving"
                  ? "saving…"
                  : dirty
                    ? "auto-saving soon…"
                    : autoSave.phase === "saved"
                      ? `auto-saved ${
                          autoSave.at ? new Date(autoSave.at).toLocaleTimeString() : ""
                        }`
                      : "auto-save on"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 p-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={resetForm}
            disabled={!dirty}
            title="Revert the form to the last auto-saved values"
          >
            <RotateCcw aria-hidden="true" />
            Reset
          </Button>
          <Button
            variant={autoSave.phase === "error" ? "destructive" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => void commit()}
            disabled={!dirty && autoSave.phase !== "error"}
            title="Save immediately — normally unnecessary (edits persist on their own), but handy after a failed auto-save"
          >
            {autoSave.phase === "saving" ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <CloudUpload aria-hidden="true" />
            )}
            {autoSave.phase === "error" ? "Retry save" : "Save now"}
          </Button>
        </div>
      </div>
    </Tabs>
  );
}

/* ------------------------------------------------------------------ */
/* Results tab                                                          */
/* ------------------------------------------------------------------ */

function ResultsTab({ job }: { job: JobDTO }) {
  const done = job.status === "completed" || job.status === "failed";
  const pending = job.status === "pending";
  return (
    <div className="space-y-3 p-3">
      {done || pending ? (
        job.result && (
          <p
            className={cn(
              "rounded-md border px-2.5 py-2 text-[11px] leading-relaxed",
              job.status === "failed"
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : pending
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            )}
            title={job.result}
          >
            {job.result}
          </p>
        )
      ) : (
        <div className="flex items-start gap-2.5 rounded-lg border border-dashed bg-secondary/20 p-3">
          <BarChart3 className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {job.status === "running"
              ? "Running — outputs appear here when the job completes."
              : "No results yet — run the job to generate outputs."}
          </p>
        </div>
      )}
      {pending && (
        <p className="rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 px-2.5 py-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
          The job did not fail — it is waiting for an upstream job. Fix and re-run
          the upstream job: this one then starts automatically once its inputs are
          ready.
        </p>
      )}
      <JobResults job={job} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Log tab (inline engine log tail)                                     */
/* ------------------------------------------------------------------ */

function LogTab({ job }: { job: JobDTO }) {
  const fetchLog = useWorkflowStore((s) => s.fetchLog);
  const [log, setLog] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const refresh = React.useCallback(async () => {
    // t391 — the spinner only owns the FIRST load (log === null): a
    // background re-fetch every 4s must not flash the toolbar twice per
    // tick, and an unchanged tail must not re-render the console at all
    // (the setState function form returns `prev` on identity → React bails).
    const first = log === null;
    if (first) setLoading(true);
    try {
      const tail = await fetchLog(job.id);
      setLog((prev) => (prev === tail ? prev : tail));
    } finally {
      if (first) setLoading(false);
    }
  }, [fetchLog, job.id, log]);

  // Fetch the tail whenever the tab mounts
  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  // Gentle auto-refresh while the job is running
  React.useEffect(() => {
    if (job.status !== "running") return;
    const timer = setInterval(() => void refresh(), 4000);
    return () => clearInterval(timer);
  }, [job.status, refresh]);

  const empty = log === null || log.trim().length === 0;

  return (
    <div className="space-y-2 p-3">
      <div className="flex items-center gap-2">
        <p className="flex-1 text-[11px] leading-tight text-muted-foreground">
          Tail of <span className="font-mono">run.out / run.err</span> from the real
          execution engine (last 80 lines).
        </p>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 px-2 text-[11px]"
          onClick={() => void refresh()}
          disabled={loading}
        >
          <RefreshCw className={cn("size-3", loading && "animate-spin")} aria-hidden="true" />
          Refresh
        </Button>
      </div>
      <pre
        className="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted/60 p-3 font-mono text-xs leading-relaxed text-foreground/90"
        aria-label="Engine log tail"
      >
        {loading && log === null
          ? "Loading log…"
          : empty
            ? "No log available (job has not run yet)."
            : log}
      </pre>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel body (remounted per job via key)                               */
/* ------------------------------------------------------------------ */

function PanelBody({ job }: { job: JobDTO }) {
  const system = useWorkflowStore((s) => s.system);
  const select = useWorkflowStore((s) => s.select);
  const saveJob = useWorkflowStore((s) => s.saveJob);
  const runJob = useWorkflowStore((s) => s.runJob);
  const resetJob = useWorkflowStore((s) => s.resetJob);
  const deleteJob = useWorkflowStore((s) => s.deleteJob);
  // class-note deep link (Task 81): the palette's Class notes group lands here
  const pendingClassFocus = useWorkflowStore((s) => s.pendingClassFocus);
  const consumeClassFocus = useWorkflowStore((s) => s.consumeClassFocus);

  const spec = jobType(job.type);
  // The engine is always the REAL RELION one (the simulation was retired).
  // RELION gating: not detected (hard block). A WSL-side install is NOT
  // blocked anymore — the built-in WSL bridge relays jobs into the distro
  // (path translation + wsl.exe wrapping), it just gets an informational note.
  const relionMissing = system !== null && !system.found;
  const relionBridged = system !== null && system.found && system.execution === "wsl";
  const relionBlocked = relionMissing;
  const relionHint = relionMissing
    ? "RELION not detected — install it (or expose it in WSL) and press Re-detect in the top bar"
    : relionBridged
      ? `RELION ${system?.version ?? ""} in WSL${system?.wsl.distro ? ` (${system.wsl.distro})` : ""} — jobs run inside the distro through the built-in WSL bridge (paths are translated automatically)`
      : "";

  const [name, setName] = React.useState(job.name);
  const [runPending, setRunPending] = React.useState(false);
  // lazy hydrate (see the Task 162 block above): the panel mounts client-side
  // only, so the seed can be read at mount without touching the SSR pass
  const [tab, setTab] = React.useState<PanelTab>(hydratePanelTab);
  // the class the palette asked to open (cleared by ParamsTab/gallery)
  const [focusCls, setFocusCls] = React.useState<number | null>(null);

  // one-shot deep link: switch to the params tab (the gallery's home) and
  // hand the class number down. Runs on mount too — a palette jump selects
  // the job and mounts this panel in the same commit.
  React.useEffect(() => {
    if (pendingClassFocus?.jobId !== job.id) return;
    // the palette jump is a gesture — it relocates the reading position,
    // so the echo follows (same reasoning as t159's linkJobTo follow)
    persistPanelTab("params");
    setTab("params");
    setFocusCls(pendingClassFocus.cls);
    consumeClassFocus();
  }, [pendingClassFocus, job.id, consumeClassFocus]);

  const commitName = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === job.name) {
      setName(job.name);
      return;
    }
    void saveJob(job.id, { name: trimmed.slice(0, 60) });
  };

  const handleRun = async () => {
    setRunPending(true);
    try {
      // t317 — { local: true }: this is the panel's LOCAL door (the main Run
      // button for local projects, the ▾ "Run on this machine" for remote
      // ones). It must stay honestly local even in a remote-bound project —
      // a bare POST would ride the route's project-binding fallback to the
      // cluster; the explicit flag meets the engine's cluster-resident
      // refusal instead (which names the cluster door).
      await runJob(job.id, { local: true });
    } finally {
      setRunPending(false);
    }
  };

  // t289 — the run-mode door. t323 — the ▾ menu is RETIRED (the user's
  // receipt: the button row felt crowded, the arrow could go): the primary
  // Run button speaks the project's own lane and the action row's server
  // icon opens the SAME dialog — one dialog, two doors, no hidden modes,
  // and no third control that repeats both. The mode is a per-run choice,
  // not a global toggle.
  const [clusterRunOpen, setClusterRunOpen] = React.useState(false);
  // t300 — a REMOTE project's primary Run IS the cluster dispatch: its
  // inputs are cluster paths (a local spawn would only fail on files this
  // machine does not have). The engine-native bookkeeping types still run
  // locally — they ARE the local half of a remote project (the import
  // writes micrographs.star with cluster paths; select/symexpand/… are
  // table surgery). A local project's primary Run stays local; the server
  // icon is the cluster door in both worlds.
  const projectRemote = useWorkflowStore((s) => s.project?.remote ?? null);
  const remotePrimaryRun =
    projectRemote != null && !REMOTE_BOOKKEEPING_TYPES.has(job.type) && job.linkedJobId == null;
  const clusterModeBlocked = job.status === "running" || job.linkedJobId != null;

  const runButton = (
    <Button
      className={cn("w-full", remotePrimaryRun && "border-violet-500/40")}
      size="sm"
      disabled={
        job.status === "running" ||
        job.linkedJobId != null ||
        (remotePrimaryRun ? false : runPending || relionBlocked)
      }
      onClick={() => {
        if (remotePrimaryRun) setClusterRunOpen(true);
        else void handleRun();
      }}
      aria-describedby={relionBlocked && !remotePrimaryRun ? "job-relion-blocked-hint" : relionBridged ? "job-relion-bridge-hint" : undefined}
      title={
        remotePrimaryRun
          ? `Remote project — dispatch to ${projectRemote?.name ?? projectRemote?.host ?? "the cluster"} (pick the node/partition + GPU count)`
          : job.linkedJobId != null
            ? "Linked copies mirror their original — run the original job instead"
            : job.status === "pending"
              ? "Run — inputs will be re-checked before the run starts"
              : undefined
      }
    >
      {runPending ? (
        <Loader2 className="animate-spin" aria-hidden="true" />
      ) : remotePrimaryRun ? (
        <Server aria-hidden="true" />
      ) : (
        <Play aria-hidden="true" />
      )}
      {/* t323 — the ▾ mode menu is RETIRED: the primary button speaks the
          project's own lane (local / cluster-primary) and the Server icon
          right of it is the cluster door; a third control that repeated
          both only crowded the row (the user's receipt). Labels stay
          one-word — the title carries the detail. */}
      {job.linkedJobId != null
        ? "Linked copy"
        : remotePrimaryRun
          ? job.status === "completed" || job.status === "failed"
            ? "Re-run on cluster"
            : "Run on cluster"
          : job.status === "completed" || job.status === "failed"
            ? "Re-run"
            : "Run"}
    </Button>
  );

  return (
    // t382 — the panel COLUMN scrolls as a whole when the viewport is
    // short: the header and the command preview stay shrink-0, the body
    // tabs carry a min-h floor (the t372 starvation fix, restored — it
    // was lost in a later round and the params area collapsed to ~59px
    // at 1280×577 with the preview eating the panel) and the tab bar
    // sticks to the top of the scroll so switching tabs never needs a
    // scroll-up first.
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto">
      {job.linkedJobId != null && (
        <div
          role="note"
          className="flex items-start gap-2 border-b border-primary/25 bg-primary/[0.06] px-4 py-2.5 text-[11px] leading-relaxed"
        >
          <Link2 className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-foreground/90">
            <span className="font-semibold">Linked copy</span> — this node mirrors
            {" "}<span className="font-semibold text-primary">{job.linkedName ?? "its original"}</span>
            {job.linkedWorkspaceName ? (
              <span className="text-muted-foreground"> (workspace “{job.linkedWorkspaceName}”)</span>
            ) : null}
            . Parameters and runs belong to the original; wire downstream jobs
            to this card and they consume its outputs.
          </p>
        </div>
      )}
      {/* Header */}
      <div className="shrink-0 space-y-3 border-b bg-gradient-to-b from-card to-card p-4">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg",
              spec?.color.soft,
              spec?.color.text
            )}
          >
            <TypeIcon name={spec?.icon ?? "Boxes"} className="size-4.5" />
          </span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                setName(job.name);
                e.currentTarget.blur();
              }
            }}
            maxLength={60}
            aria-label="Job name"
            className="h-9 flex-1 text-sm font-medium"
          />
          <Button
            variant="ghost"
            size="icon"
            className="relative size-8 shrink-0 text-muted-foreground hover:text-foreground before:absolute before:-inset-1.5 before:rounded-md before:content-['']"
            onClick={() => select(null)}
            aria-label="Close job panel"
            title="Close panel (Esc)"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <StatusBadge status={job.status} queued={isSlurmQueued(job)} />
            <EngineBadge />
          </div>
          <span className="text-[11px] text-muted-foreground">
            {spec?.group ?? "Workflow"} · {spec?.category ?? "—"} · {spec?.tier ?? "—"}
          </span>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          {spec?.description ?? "Workflow job."}
        </p>

        {/* Action row */}
        <div className="flex items-center gap-1.5">
          {/* t289 — Run + mode door. t323 — the ▾ split button is RETIRED
              (the user's receipt: the row felt crowded, the arrow could go):
              the primary Run button speaks the project's own lane and the
              Server icon button beside it is the cluster door — one dialog,
              two doors, no third control repeating both. */}
          <div className="flex min-w-0 flex-1 items-stretch">
            {relionBlocked ? (
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex min-w-0 flex-1 inline-flex">{runButton}</span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-64 text-[11px]">
                    {relionHint} — jobs will fail to start honestly.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <span className="flex min-w-0 flex-1 inline-flex">{runButton}</span>
            )}
          </div>
          <HpcSbatchDialog jobId={job.id} compact />
          {/* t289/t323 — the server icon opens the SAME dialog the primary
              Run button opens in remote-primary projects (one RemoteRunButton
              instance, dialogOnly + controlled). */}
          <Button
            variant="outline"
            size="icon"
            className="relative size-8 shrink-0 text-muted-foreground hover:text-foreground before:absolute before:-inset-1.5 before:rounded-md before:content-['']"
            disabled={clusterModeBlocked}
            onClick={() => setClusterRunOpen(true)}
            aria-label="Run on cluster (SSH)"
            title={
              job.linkedJobId != null
                ? "Linked copies mirror their original — run the original job instead"
                : "Run on cluster (SSH)"
            }
          >
            <Server className="size-4" aria-hidden="true" />
          </Button>
          <RemoteRunButton job={job} dialogOnly open={clusterRunOpen} onOpenChange={setClusterRunOpen} />
          <Button
            variant="ghost"
            size="icon"
            className="relative size-8 shrink-0 text-muted-foreground hover:text-foreground before:absolute before:-inset-1.5 before:rounded-md before:content-['']"
            onClick={() => void resetJob(job.id)}
            disabled={job.status === "running"}
            aria-label={`Reset ${job.name} to idle`}
            title="Reset job to idle — clears the run state; the run directory stays until the next Run rebuilds it"
          >
            <RotateCcw className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="relative size-8 shrink-0 text-muted-foreground hover:text-foreground before:absolute before:-inset-1.5 before:rounded-md before:content-['']"
            onClick={() => {
              // the log button is a gesture too — echo it
              persistPanelTab("log");
              setTab("log");
            }}
            aria-label={`View engine log for ${job.name}`}
            title="View engine log"
          >
            <Terminal className="size-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative size-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive before:absolute before:-inset-1.5 before:rounded-md before:content-['']"
                aria-label={`Delete ${job.name}`}
                title="Delete job"
              >
                <Trash2 className="size-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete “{job.name}”?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the job and every connection attached to it. You'll
                  get a short window to undo from the toast afterwards.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="h-10 bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40"
                  onClick={() => void deleteJob(job.id)}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Remote execution strip — mirrors the run's cluster context
            (connection + module + phase) while runRemote is attached to
            the job. Compact by contract: the card chip carries the short
            host, this is where the full story lives. */}
        {job.runRemote ? (
          <div
            role="note"
            title={`${job.runRemote.remoteWorkdir} — cluster workdir`}
            className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-teal-500/25 bg-teal-500/[0.06] px-2 py-1.5 text-[11px] text-muted-foreground"
          >
            <Server className="size-3.5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden="true" />
            <span className="font-medium text-foreground/90">
              {job.runRemote.user}@{job.runRemote.host}
            </span>
            {job.runRemote.module ? (
              <Badge
                variant="outline"
                className="h-4 px-1 font-mono text-[9.5px] font-normal text-foreground/80"
              >
                {job.runRemote.module}
              </Badge>
            ) : null}
            <span className="min-w-0 truncate">
              {job.runRemote.phase === "staging"
                ? `Staging inputs to the cluster${formatStagedBytes(job.runRemote.stagedBytes)}…`
                : `Running on the cluster${job.runRemote.pid ? ` · pid ${job.runRemote.pid}` : ""}`}
            </span>
          </div>
        ) : null}
        {job.runRemote?.note ? (
          <p
            role="note"
            className="rounded-md bg-amber-500/10 px-2 py-1.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300"
          >
            {job.runRemote.note}
          </p>
        ) : null}

        {relionBlocked && (
          <p
            id="job-relion-blocked-hint"
            className="text-[11px] leading-relaxed text-amber-600 dark:text-amber-400"
          >
            {relionHint} — jobs will fail to start honestly.
          </p>
        )}

        {relionBridged && !relionBlocked && (
          <p
            id="job-relion-bridge-hint"
            role="note"
            className="rounded-md bg-cyan-500/10 px-2 py-1.5 text-[11px] leading-relaxed text-cyan-700 dark:text-cyan-300"
          >
            {relionHint}
          </p>
        )}

        {job.status === "running" && isSlurmQueued(job) ? (
          // t322 — queued on slurm: the panel says what the scheduler says
          // (held in the queue), not "RELION process running" — no process
          // has started yet
          <p
            role="note"
            className="rounded-md bg-amber-500/10 px-2 py-1.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300"
          >
            {job.runRemote?.slurmDependsOn?.length
              ? `Queued on the cluster — Slurm holds it until ${job.runRemote.slurmDependsOn.join(", ")} lands.`
              : "Queued on the cluster — the scheduler starts it when resources free up."}{" "}
            <span className="text-muted-foreground">The bar and log wake up when it starts.</span>
          </p>
        ) : job.status === "running" && (
          <div className="space-y-1">
            <MiniProgress value={job.progress} running label={`${job.name} progress`} />
            <p className="text-right text-xs tabular-nums text-muted-foreground">
              <span>REAL · RELION process running</span>
            </p>
          </div>
        )}

        {job.status === "pending" && (
          <p
            role="note"
            className="rounded-md bg-amber-500/10 px-2 py-1.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300"
          >
            {job.result ?? "Waiting for an upstream job to produce its outputs."}{" "}
            <span className="text-muted-foreground">
              Re-run the upstream job, then Run here to re-check.
            </span>
          </p>
        )}
      </div>

      {/* Body tabs: I/O | Params | Results | Log — min-h-[340px] floor
          (t372/t382): without it a short viewport squeezes the flex-1
          tabs to crumbs between the header and the command preview,
          starving the params area (the fieldsets below need room). */}
      <Tabs
        value={tab}
        onValueChange={(t) => {
          // Task 162 — the funnel: Radix routes mouse clicks AND keyboard
          // arrow navigation through this one handler; persist-then-set
          // keeps storage an echo of what the user just saw. The whitelist
          // gate mirrors the hydrate gate — Radix only emits rendered
          // trigger values, and the gate keeps that promise checked.
          if (!(PANEL_TABS as readonly string[]).includes(t)) return;
          persistPanelTab(t);
          setTab(t as PanelTab);
        }}
        className="flex min-h-[340px] flex-1 flex-col gap-0"
      >
        <div className="sticky top-0 z-20 shrink-0 border-b bg-card px-2 py-1.5">
          <TabsList className="h-8 w-full">
            <TabsTrigger value="io" className="h-6 gap-1 px-2 text-[11px]">
              <ArrowLeftRight className="size-3.5" aria-hidden="true" />
              I/O
            </TabsTrigger>
            <TabsTrigger value="params" className="h-6 gap-1 px-2 text-[11px]">
              <SlidersHorizontal className="size-3.5" aria-hidden="true" />
              Params
            </TabsTrigger>
            <TabsTrigger value="results" className="h-6 gap-1 px-2 text-[11px]">
              <BarChart3 className="size-3.5" aria-hidden="true" />
              Results
            </TabsTrigger>
            <TabsTrigger value="log" className="h-6 gap-1 px-2 text-[11px]">
              <Terminal className="size-3.5" aria-hidden="true" />
              Log
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="io" className="mt-0 min-h-0 flex-1 overflow-y-auto">
          <IOTab job={job} spec={spec} />
        </TabsContent>
        <TabsContent value="params" className="mt-0 flex min-h-0 flex-1 flex-col">
          <ParamsTab
            job={job}
            spec={spec}
            focusClass={focusCls}
            onClassFocusConsumed={() => setFocusCls(null)}
          />
        </TabsContent>
        <TabsContent value="results" className="mt-0 min-h-0 flex-1 overflow-y-auto">
          <ResultsTab job={job} />
        </TabsContent>
        <TabsContent value="log" className="mt-0 min-h-0 flex-1 overflow-y-auto">
          <LogTab job={job} />
        </TabsContent>
      </Tabs>

      {/* Task 170 — the launch contract, panel-wide: visible on every tab
          (the command summarizes io + params + the graph, not just one
          tab's content). The params tab is where an idle job's user SHAPE
          it, but the preview belongs to the whole panel. Template
          instantly, the read-only route's real argv when it lands, the
          engine's own refusal when inputs can't resolve yet. Reflects
          the SAVED parameters (autosave makes the drift transient). */}
      <CommandPreviewCompact job={job} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel root                                                           */
/* ------------------------------------------------------------------ */

export function JobPanel() {
  const jobs = useWorkflowStore((s) => s.jobs);
  const selectedId = useWorkflowStore((s) => s.selectedId);
  const job = selectedId ? (jobs.find((j) => j.id === selectedId) ?? null) : null;

  if (!job) return <PanelEmpty />;
  return <PanelBody key={job.id} job={job} />;
}

/* ------------------------------------------------------------------ */
/* Command preview (Task 170) — the launch contract in the params tab   */
/* ------------------------------------------------------------------ */

/** Shape of GET /api/jobs/[id]/command — same contract the inspector's
 *  preview section consumes; the two surfaces render different chrome
 *  over the SAME truth (there is no second dialect to drift). */
interface CommandPreviewResponse {
  native?: boolean;
  argv?: string[];
  command?: string;
  missing?: string;
  wait?: string;
  error?: string;
  template?: string | null;
}

/** One fetch per job id, aborted on switch/unmount — shared shape with
 *  the inspector's preview (kept as a local hook: the two surfaces also
 *  differ in lifecycle, panel selection vs dialog mount). */
function useCommandPreview(jobId: string): CommandPreviewResponse | null {
  const [preview, setPreview] = React.useState<CommandPreviewResponse | null>(null);
  React.useEffect(() => {
    const ctl = new AbortController();
    setPreview(null);
    fetch(`/api/jobs/${jobId}/command`, { signal: ctl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<CommandPreviewResponse>) : null))
      .then((d) => {
        if (!ctl.signal.aborted) setPreview(d);
      })
      .catch(() => {
        /* aborted or network hiccup — the template default stands */
      });
    return () => ctl.abort();
  }, [jobId]);
  return preview;
}

/**
 * The compact preview: caption + dark console + copy, sized for the
 * panel column. Best-truth-first — the template (client-safe constant)
 * shows instantly; the route's rendered argv replaces it; the engine's
 * own missing/wait/error message rides above as the honest blocker.
 * The contract shown is the SAVED one (autosave makes any in-form drift
 * transient — the route reads the persisted job row).
 */
function CommandPreviewCompact({ job }: { job: JobDTO }) {
  const template =
    COMMAND_TEMPLATES[job.type] ??
    "engine-native: this job type carries no canonical template";
  const preview = useCommandPreview(job.id);

  const shown = preview?.command ?? template;
  const isRealArgv = preview?.command != null;
  const blocker = preview?.missing ?? preview?.error ?? null;

  const caption = isRealArgv
    ? "preview — identical builder to the launch"
    : preview === null
      ? "reading the launch contract…"
      : blocker
        ? "not launched yet — the shape it will run:"
        : "not launched yet";

  return (
    <div
      data-canvas-ui="command-preview-panel"
      className="shrink-0 space-y-1.5 border-t bg-muted/30 px-4 py-3"
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Command preview
        </p>
        <p className="truncate text-[10px] text-muted-foreground">
          {caption}
        </p>
      </div>
      {blocker ? (
        <p
          data-canvas-ui="command-blocker"
          className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10.5px] leading-relaxed text-amber-700 dark:text-amber-300"
        >
          {blocker}
        </p>
      ) : null}
      <div
        data-log-console=""
        data-print-atomic=""
        data-canvas-ui="command-preview"
        className="flex items-start gap-2 rounded-md border bg-zinc-950 p-2 dark:bg-zinc-900"
      >
        <pre
          data-canvas-ui="command-preview-text"
          className="m-0 min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-zinc-300"
        >
          {shown}
        </pre>
        <CopyButton text={shown} />
      </div>
    </div>
  );
}

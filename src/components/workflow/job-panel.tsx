"use client";

/**
 * CryoFlow — job details panel (RELION job-window faithful).
 *
 * Structure:
 *  - Header: identity (icon / name / close), status + engine badges,
 *    description, action row (Run / Reset / Log / Delete), live progress.
 *  - Body tabs: I/O (port-by-port connections) · Params (RELION GUI tabs
 *    with expert collapsibles) · Results (JobResults viewer) · Log (inline
 *    engine log tail).
 *
 * The panel body remounts per job (key={job.id}) so every form resets when
 * switching selection.
 */

import * as React from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  Check,
  ChevronsDownUp,
  CircleAlert,
  CloudUpload,
  Database,
  FolderOpen,
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
import { PORT_COLORS, coerceParam, jobType, portsCompatible, tabsFor } from "@/lib/workflow";
import { registerParamFlusher, useWorkflowStore } from "@/lib/store";
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
import { MiniProgress, StatusBadge } from "./job-card";
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
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckSquare, ListFilter, Folder } from "lucide-react";
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
    jSpec.outputs.forEach((p, order) => {
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
    <div className="space-y-4 p-3">
      {/* Inputs */}
      <section aria-label="Inputs">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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

function ParamField({
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
  const wide = p.type === "select" || p.type === "bool" || p.type === "path";

  return (
    <div className={cn("space-y-1.5", wide && "col-span-2")}>
      {p.type === "bool" ? (
        <div
          className="flex items-center justify-between gap-3 rounded-lg border bg-secondary/40 px-3 py-2"
          title={p.hint}
        >
          <Label htmlFor={inputId} className="text-xs font-normal leading-snug">
            {p.label}
          </Label>
          <Switch
            id={inputId}
            checked={value === true}
            onCheckedChange={(c) => onChange(c)}
            aria-label={p.label}
          />
        </div>
      ) : p.type === "path" ? (
        <PathParamField p={p} value={value} onChange={onChange} idPrefix={idPrefix} />
      ) : p.type === "number" ? (
        <>
          <Label htmlFor={inputId} className="text-xs" title={p.hint}>
            {p.label}
          </Label>
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
        </>
      ) : (
        <>
          <Label htmlFor={inputId} className="text-xs" title={p.hint}>
            {p.label}
          </Label>
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
        </>
      )}
    </div>
  );
}

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
  const raw = value === undefined || value === null ? "" : String(value);
  const trimmed = raw.trim();
  const lines = trimmed ? trimmed.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : [];
  const isPattern = lines.length === 1 && /[*?]/.test(lines[0]);
  const isFileList = lines.length > 1;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId} className="text-xs" title={p.hint}>
        {p.label}
      </Label>
      <div className="flex items-start gap-1.5">
        {isFileList ? (
          <Textarea
            id={inputId}
            value={raw}
            title={p.hint}
            onChange={(e) => onChange(e.target.value)}
            rows={Math.min(4, Math.max(2, lines.length))}
            placeholder={"One file path per line…"}
            className="min-h-8 resize-y font-mono text-xs"
            aria-label={`${p.label} — ${lines.length} files`}
          />
        ) : (
          <Input
            id={inputId}
            value={raw}
            placeholder="Folder, wildcard (…/*.tiff), or paste file paths"
            title={p.hint}
            onChange={(e) => onChange(e.target.value)}
            className="h-8 font-mono text-xs"
          />
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-8 shrink-0 gap-1 px-2"
          onClick={() => setBrowsing(true)}
          aria-label={`Browse for ${p.label}`}
          title="Browse folders, multi-select files, or preview a wildcard pattern"
        >
          <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
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
            <>
              <CheckSquare className="h-3 w-3 text-primary" aria-hidden="true" />
              <span className="font-medium text-primary">{lines.length} files selected</span>
              <span aria-hidden="true">·</span>
              <span>imported exactly as listed</span>
            </>
          ) : (
            <>
              <Folder className="h-3 w-3 text-amber-500/80" aria-hidden="true" />
              <span>Folder — imports every image inside</span>
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

function ParamsTab({ job, spec }: { job: JobDTO; spec: JobTypeSpec | undefined }) {
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
      <div className="shrink-0 overflow-x-auto border-b px-3 py-2">
        <TabsList className="h-7 w-max">
          {allTabs.map((t) => (
            <TabsTrigger key={t} value={t} className="h-6 px-2.5 text-[11px] whitespace-nowrap">
              {t}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {allTabs.map((t) => {
        const inTab = params.filter((p) => (p.tab ?? "Additional") === t);
        const basic = inTab.filter((p) => !p.advanced);
        const advanced = inTab.filter((p) => p.advanced);
        return (
          <TabsContent key={t} value={t} className="mt-0 min-h-0 flex-1 overflow-y-auto">
            <div className="p-3">
              <div className="grid grid-cols-2 gap-3">
                {basic.map((p) => (
                  <ParamField
                    key={p.key}
                    p={p}
                    value={form[p.key] ?? p.default}
                    onChange={(v) => setForm((f) => ({ ...f, [p.key]: v }))}
                    idPrefix={`param-${job.id}`}
                  />
                ))}
              </div>
              {basic.length === 0 && advanced.length > 0 && (
                <p className="text-[11px] italic text-muted-foreground/70">
                  All parameters in this tab are expert options.
                </p>
              )}
              {advanced.length > 0 && (
                <Collapsible className="mt-3">
                  <CollapsibleTrigger className="group/collapsible flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground">
                    <ChevronsDownUp
                      className="size-3.5 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180"
                      aria-hidden="true"
                    />
                    Expert options
                    <span className="ml-auto tabular-nums text-muted-foreground/70">
                      {advanced.length}
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="grid grid-cols-2 gap-3">
                      {advanced.map((p) => (
                        <ParamField
                          key={p.key}
                          p={p}
                          value={form[p.key] ?? p.default}
                          onChange={(v) => setForm((f) => ({ ...f, [p.key]: v }))}
                          idPrefix={`param-${job.id}`}
                        />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>
          </TabsContent>
        );
      })}

      {/* Auto-save status bar (parameters persist themselves — no manual
          Save button to forget; Reset reverts to the last saved values) */}
      <div className="shrink-0 border-t bg-card">
        <div className="flex items-center justify-between gap-2 px-3 pt-2">
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
    setLoading(true);
    try {
      const tail = await fetchLog(job.id);
      setLog(tail);
    } finally {
      setLoading(false);
    }
  }, [fetchLog, job.id]);

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
  const [tab, setTab] = React.useState("io");

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
      await runJob(job.id);
    } finally {
      setRunPending(false);
    }
  };

  const runButton = (
    <Button
      className="w-full"
      size="sm"
      disabled={job.status === "running" || runPending || relionBlocked || job.linkedJobId != null}
      onClick={() => void handleRun()}
      aria-describedby={relionBlocked ? "job-relion-blocked-hint" : relionBridged ? "job-relion-bridge-hint" : undefined}
      title={
        job.linkedJobId != null
          ? "Linked copies mirror their original — run the original job instead"
          : undefined
      }
    >
      {runPending ? (
        <Loader2 className="animate-spin" aria-hidden="true" />
      ) : (
        <Play aria-hidden="true" />
      )}
      {job.linkedJobId != null
        ? "Linked copy — run the original"
        : job.status === "completed" || job.status === "failed"
          ? "Re-run"
          : job.status === "pending"
            ? "Run (re-check inputs)"
            : "Run Job"}
    </Button>
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
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
            className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => select(null)}
            aria-label="Close job panel"
            title="Close panel (Esc)"
          >
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <StatusBadge status={job.status} />
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
          {relionBlocked ? (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex-1 inline-flex" title={relionHint}>
                    {runButton}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-64 text-[11px]">
                  {relionHint} — jobs will fail to start honestly.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <span className="flex-1 inline-flex">{runButton}</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => void resetJob(job.id)}
            disabled={job.status === "running"}
            aria-label={`Reset ${job.name} to idle`}
            title="Reset job to idle"
          >
            <RotateCcw className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => setTab("log")}
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
                className="size-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
                  This removes the job and every connection attached to it. This
                  action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => void deleteJob(job.id)}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

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

        {job.status === "running" && (
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

      {/* Body tabs: I/O | Params | Results | Log */}
      <Tabs
        value={tab}
        onValueChange={setTab}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <div className="shrink-0 border-b px-2 py-1.5">
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
          <ParamsTab job={job} spec={spec} />
        </TabsContent>
        <TabsContent value="results" className="mt-0 min-h-0 flex-1 overflow-y-auto">
          <ResultsTab job={job} />
        </TabsContent>
        <TabsContent value="log" className="mt-0 min-h-0 flex-1 overflow-y-auto">
          <LogTab job={job} />
        </TabsContent>
      </Tabs>
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

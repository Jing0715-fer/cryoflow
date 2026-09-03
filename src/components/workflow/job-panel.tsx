"use client";

import * as React from "react";
import {
  ArrowRight,
  Loader2,
  MousePointerClick,
  Play,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { jobType } from "@/lib/workflow";
import { useWorkflowStore } from "@/lib/store";
import type { JobDTO, ParamValue } from "@/lib/types";
import { TypeIcon } from "./icons";
import { MiniProgress, StatusBadge } from "./job-card";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Empty state                                                         */
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
      <ul className="mt-2 max-w-[240px] space-y-2 text-left">
        {[
          "Drag cards to lay out the pipeline",
          "Click ports to wire jobs together",
          "Run jobs and watch progress live",
        ].map((tip) => (
          <li
            key={tip}
            className="flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground"
          >
            <span className="mt-1 size-1 shrink-0 rounded-full bg-primary/70" />
            {tip}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Connection chips                                                    */
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
/* Panel body (remounted per job via key)                              */
/* ------------------------------------------------------------------ */

function PanelBody({ job }: { job: JobDTO }) {
  const jobs = useWorkflowStore((s) => s.jobs);
  const edges = useWorkflowStore((s) => s.edges);
  const saveJob = useWorkflowStore((s) => s.saveJob);
  const runJob = useWorkflowStore((s) => s.runJob);
  const resetJob = useWorkflowStore((s) => s.resetJob);
  const deleteJob = useWorkflowStore((s) => s.deleteJob);
  const removeEdge = useWorkflowStore((s) => s.removeEdge);

  const spec = jobType(job.type);

  const [name, setName] = React.useState(job.name);
  const [runPending, setRunPending] = React.useState(false);
  const [form, setForm] = React.useState<Record<string, ParamValue>>(() => {
    const init: Record<string, ParamValue> = {};
    for (const p of spec?.params ?? []) {
      init[p.key] = job.params[p.key] ?? p.default;
    }
    return init;
  });

  const jobNameById = React.useMemo(
    () => new Map(jobs.map((j) => [j.id, j.name])),
    [jobs]
  );

  const commitName = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === job.name) {
      setName(job.name);
      return;
    }
    void saveJob(job.id, { name: trimmed.slice(0, 60) });
  };

  /** Coerce a raw form value into its schema-typed value. */
  const normalize = (type: "number" | "select", raw: ParamValue | undefined): ParamValue => {
    if (type === "number") {
      const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? ""));
      return Number.isFinite(n) ? n : NaN;
    }
    return raw ?? "";
  };

  const commitParams = () => {
    const params: Record<string, ParamValue> = {};
    for (const p of spec?.params ?? []) {
      const v = normalize(p.type, form[p.key]);
      params[p.key] = Number.isNaN(v) ? p.default : v;
    }
    void saveJob(job.id, { params });
  };

  const handleRun = async () => {
    setRunPending(true);
    try {
      await runJob(job.id);
    } finally {
      setRunPending(false);
    }
  };

  const incoming = edges.filter((e) => e.toJobId === job.id);
  const outgoing = edges.filter((e) => e.fromJobId === job.id);

  const dirty =
    spec?.params.some((p) => {
      const current = job.params[p.key] ?? p.default;
      const edited = normalize(p.type, form[p.key]);
      return Number.isNaN(edited) || current !== edited;
    }) ?? false;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto">
      {/* Header */}
      <div className="shrink-0 space-y-3 border-b bg-gradient-to-b from-card to-card p-4 pb-4">
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
              }
            }}
            maxLength={60}
            aria-label="Job name"
            className="h-9 flex-1 text-sm font-medium"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <StatusBadge status={job.status} />
          <span className="text-[11px] text-muted-foreground">
            {spec?.group ?? "Workflow"}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {spec?.description}
        </p>
      </div>

      {/* Parameters */}
      <div className="shrink-0 space-y-4 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Parameters
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(spec?.params ?? []).map((p) => {
            const inputId = `param-${job.id}-${p.key}`;
            const wide = p.type === "select";
            return (
              <div key={p.key} className={cn("space-y-1.5", wide && "col-span-2")}>
                <Label htmlFor={inputId} className="text-xs font-medium">
                  {p.label}
                </Label>
                {p.type === "number" ? (
                  <div className="relative">
                    <Input
                      id={inputId}
                      type="number"
                      value={form[p.key] ?? ""}
                      min={p.min}
                      max={p.max}
                      step={p.step}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, [p.key]: e.target.value }))
                      }
                      className={cn("h-8 text-xs", p.unit && "pr-10")}
                    />
                    {p.unit && (
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        {p.unit}
                      </span>
                    )}
                  </div>
                ) : (
                  <Select
                    value={String(form[p.key] ?? p.default)}
                    onValueChange={(v) => setForm((f) => ({ ...f, [p.key]: v }))}
                  >
                    <SelectTrigger id={inputId} className="h-8 text-xs">
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
                {p.hint && (
                  <p className="text-[10px] text-muted-foreground">{p.hint}</p>
                )}
              </div>
            );
          })}
        </div>
        <Button
          variant="outline"
          className="w-full"
          onClick={commitParams}
          disabled={!dirty}
        >
          Save Parameters
        </Button>
      </div>

      <Separator />

      {/* Run */}
      <div className="shrink-0 space-y-2.5 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Execution
        </p>
        <Button
          className="w-full"
          disabled={job.status === "running" || runPending}
          onClick={() => void handleRun()}
        >
          {runPending ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Play aria-hidden="true" />
          )}
          {job.status === "completed" || job.status === "failed"
            ? "Re-run"
            : "Run Job"}
        </Button>
        {job.status === "running" && (
          <div className="space-y-1">
            <MiniProgress value={job.progress} running label={`${job.name} progress`} />
            <p className="text-right text-xs tabular-nums text-muted-foreground">
              {Math.round(job.progress)}% ·{" "}
              {(Math.max(0, (job.duration * (100 - job.progress)) / 100) / 1000).toFixed(1)}s
              left
            </p>
          </div>
        )}
        <Button
          variant="ghost"
          className="w-full text-muted-foreground"
          onClick={() => void resetJob(job.id)}
          disabled={job.status === "running"}
        >
          <RotateCcw aria-hidden="true" />
          Reset
        </Button>
      </div>

      <Separator />

      {/* Connections */}
      <div className="shrink-0 space-y-3 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Connections
        </p>
        <div className="space-y-2.5">
          <div>
            <p className="mb-1.5 text-[11px] text-muted-foreground">
              Incoming ({incoming.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {incoming.length === 0 ? (
                <p className="text-[11px] italic text-muted-foreground/70">None</p>
              ) : (
                incoming.map((e) => (
                  <EdgeChip
                    key={e.id}
                    label={jobNameById.get(e.fromJobId) ?? "Unknown job"}
                    direction="in"
                    onRemove={() => void removeEdge(e.id)}
                  />
                ))
              )}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] text-muted-foreground">
              Outgoing ({outgoing.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {outgoing.length === 0 ? (
                <p className="text-[11px] italic text-muted-foreground/70">None</p>
              ) : (
                outgoing.map((e) => (
                  <EdgeChip
                    key={e.id}
                    label={jobNameById.get(e.toJobId) ?? "Unknown job"}
                    direction="out"
                    onRemove={() => void removeEdge(e.id)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Danger zone */}
      <div className="mt-auto shrink-0 space-y-2.5 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Danger Zone
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 aria-hidden="true" />
              Delete Job
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
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel root                                                          */
/* ------------------------------------------------------------------ */

export function JobPanel() {
  const jobs = useWorkflowStore((s) => s.jobs);
  const selectedId = useWorkflowStore((s) => s.selectedId);
  const job = selectedId ? (jobs.find((j) => j.id === selectedId) ?? null) : null;

  if (!job) return <PanelEmpty />;
  return <PanelBody key={job.id} job={job} />;
}

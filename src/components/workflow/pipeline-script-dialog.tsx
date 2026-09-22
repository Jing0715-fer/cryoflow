"use client";

/**
 * CryoFlow — the project pipeline's replay script (Task 179).
 *
 * The project-level sibling of the inspector's per-job command preview:
 * ONE shell script that replays the whole workflow — steps in dependency
 * order, each step speaking the same three honest tiers the per-job
 * preview speaks (native stage comment / real argv / canonical template
 * + reason). Opened from the command palette's export family; shows the
 * script + a per-marker census BEFORE any download, so the artifact is
 * read, not just taken.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  onEscapeClose,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, Copy, Download, FileTerminal, Loader2 } from "lucide-react";
import { useWorkflowStore } from "@/lib/store";

interface PipelineStepBrief {
  jobId: string;
  name: string;
  type: string;
  status: string;
  marker: string;
  line: number;
  command: string;
  note?: string;
}

interface PipelineScriptResponse {
  projectId: string;
  projectName: string;
  generatedAt: string;
  relion: { found: boolean; path: string | null };
  stats: {
    jobs: number;
    done: number;
    idle: number;
    run: number;
    wait: number;
    fail: number;
    native: number;
  };
  steps: PipelineStepBrief[];
  script: string;
  error?: string;
}

const MARKER_TONE: Record<string, string> = {
  done: "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30",
  idle: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  run: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  wait: "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30",
  fail: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30",
  native: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30",
};

function scriptFileName(projectName: string): string {
  const slug =
    projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project";
  return `cryoflow-pipeline-${slug}.sh`;
}

export function PipelineScriptDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const projectId = useWorkflowStore((s) => s.project?.id ?? null);
  const [data, setData] = React.useState<PipelineScriptResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!open || !projectId) return;
    let alive = true;
    setLoading(true);
    setData(null);
    fetch(`/api/projects/${projectId}/pipeline-script`)
      .then((r) => r.json())
      .then((d: PipelineScriptResponse) => {
        if (alive) setData(d);
      })
      .catch(() => {
        if (alive)
          setData({
            projectId: "",
            projectName: "",
            generatedAt: "",
            relion: { found: false, path: null },
            stats: { jobs: 0, done: 0, idle: 0, run: 0, wait: 0, fail: 0, native: 0 },
            steps: [],
            script: "",
            error: "Request failed — the server did not answer the export",
          });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, projectId]);

  const copy = async () => {
    if (!data?.script) return;
    try {
      await navigator.clipboard.writeText(data.script);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — the Download button still delivers */
    }
  };

  const download = () => {
    if (!data?.script) return;
    const blob = new Blob([data.script], { type: "text/x-shellscript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = scriptFileName(data.projectName || "project");
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const stats = data?.stats;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl"
        onKeyDown={onEscapeClose(() => onOpenChange(false))}
        data-canvas-ui="pipeline-script-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileTerminal className="size-4 text-primary" aria-hidden="true" />
            Pipeline replay script · {data?.projectName ?? "…"}
          </DialogTitle>
          <DialogDescription>
            The whole workflow as one dependency-ordered shell script — every
            command&apos;s inputs are produced by the steps above it.{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[10px]">set -eu</code>{" "}
            stops the replay at the first failure. Engine-native stages (import,
            select, …) are comment-only: the app&apos;s executor performs them,
            there is no CLI to replay.
          </DialogDescription>
        </DialogHeader>

        {data?.relion.found === false ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/[0.06] p-2.5 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
            RELION is not detected on this host — CLI lines are exported as the
            canonical templates (commented out). Re-export after detection to
            get executable paths.
          </div>
        ) : null}

        <div
          className="flex flex-wrap items-center gap-1.5"
          data-canvas-ui="pipeline-script-stats"
        >
          {stats ? (
            <>
              <Badge variant="outline" className="border text-[10px]">
                {stats.jobs} steps
              </Badge>
              {(
                [
                  ["done", `${stats.done} done`],
                  ["idle", `${stats.idle} ready`],
                  ["run", `${stats.run} running`],
                  ["wait", `${stats.wait} waiting`],
                  ["fail", `${stats.fail} failed`],
                  ["native", `${stats.native} native`],
                ] as const
              ).map(([marker, label]) =>
                label.startsWith("0 ") ? null : (
                  <Badge
                    key={marker}
                    variant="outline"
                    className={`border text-[10px] ${MARKER_TONE[marker] ?? ""}`}
                  >
                    {label}
                  </Badge>
                )
              )}
            </>
          ) : null}
          <div className="flex-1" />
          <Button
            size="sm"
            variant="outline"
            onClick={() => void copy()}
            disabled={!data?.script}
            data-canvas-ui="pipeline-script-copy"
          >
            {copied ? (
              <Check className="size-3.5" aria-hidden="true" />
            ) : (
              <Copy className="size-3.5" aria-hidden="true" />
            )}
            {copied ? "Copied" : "Copy script"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={download}
            disabled={!data?.script}
            data-canvas-ui="pipeline-script-download"
          >
            <Download className="size-3.5" aria-hidden="true" />
            Download .sh
          </Button>
        </div>

        {loading ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />{" "}
            Assembling the pipeline…
          </div>
        ) : data?.error ? (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/[0.06] p-3 text-xs text-rose-700 dark:text-rose-300">
            {data.error}
          </div>
        ) : (
          <pre
            className="max-h-[55vh] overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-[10.5px] leading-relaxed"
            tabIndex={0}
            aria-label="Generated pipeline replay script"
            data-canvas-ui="pipeline-script-pre"
          >
            {data?.script ?? ""}
          </pre>
        )}
      </DialogContent>
    </Dialog>
  );
}

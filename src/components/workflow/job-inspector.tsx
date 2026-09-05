"use client";

/**
 * CryoFlow — Job Inspector (large modal for SUBMITTED jobs).
 *
 * Idle jobs open the right-side editing panel (job-panel.tsx); jobs that
 * have been submitted (running / completed / failed) open this CryoSPARC-
 * style full-page modal instead:
 *
 *   ┌ header ─ identity · status · live progress · actions (focus/rerun) ┐
 *   ├ tabs: Overview · Log · Results · Files                            ┤
 *   │   Overview  status timeline · result summary · params · inputs    │
 *   │   Log       dark live-streaming console (follow · wrap · copy)    │
 *   │   Results   intermediate & final artifacts (maps/FSC/STAR/3D)     │
 *   │   Files     complete workdir listing with filter + downloads      │
 *   └ footer ─ workdir · command line                                    ┘
 */

import * as React from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  Clock,
  Copy,
  Database,
  Download,
  FileText,
  FolderOpen,
  GitCommitHorizontal,
  Layers,
  LayoutDashboard,
  Link2,
  Locate,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  ScrollText,
  Search,
  Square,
  Table2,
  Terminal,
  WrapText,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { jobType } from "@/lib/workflow";
import { useWorkflowStore } from "@/lib/store";
import type { EdgeDTO, JobDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TypeIcon } from "./icons";
import { StatusBadge, estimateEta, formatEta } from "./job-card";
import { JobResults } from "./results/results-view";
import { ResolutionChart } from "./results/resolution-chart";
import { FscChart } from "./results/fsc-chart";
import { CtfQualityChart } from "./results/ctf-quality-chart";
import { ClassDistributionChart } from "./results/class-distribution-chart";
import { AngularDistributionChart } from "./results/angular-distribution-chart";
import { ImportGallery } from "./results/import-gallery";
import { PicksMap } from "./results/picks-map";
import { ParticleBrowser } from "./results/particle-browser";
import { GuinierChart } from "./results/guinier-chart";

/* ------------------------------------------------------------------ */
/* Types (mirrors /api/jobs/[id]/outputs)                              */
/* ------------------------------------------------------------------ */

type OutputKind = "mrc" | "star" | "text" | "image";

interface OutputFile {
  path: string;
  name: string;
  kind: OutputKind;
  size: number;
  slices?: number;
  label?: string;
  rows?: number;
}

interface OutputsResponse {
  workdir: string | null;
  engine: "relion";
  files: OutputFile[];
  inputs?: { flag: string; path: string }[];
  cmd?: string;
  note?: string;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function fmtDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}

function fmtClock(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "just now";
  return `${fmtDuration(ms)} ago`;
}

const SUBMITTED = new Set(["running", "completed", "failed"]);

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function useElapsed(startedAt: string | null, active: boolean): number {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active || !startedAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active, startedAt]);
  if (!startedAt) return 0;
  return Math.max(0, now - new Date(startedAt).getTime());
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 gap-1.5 px-2 text-[11px]"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        });
      }}
      aria-label={label ?? "Copy"}
    >
      {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
      {label ? <span>{copied ? "Copied" : label}</span> : null}
    </Button>
  );
}

/* ------------------------------------------------------------------ */
/* Log console                                                         */
/* ------------------------------------------------------------------ */

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** splits a line around case-insensitive matches of `q` and marks them. */
function Highlighted({ line, q }: { line: string; q: string }) {
  const parts = line.split(new RegExp(`(${escapeRegExp(q)})`, "ig"));
  const qLower = q.toLowerCase();
  return (
    <>
      {parts.map((p, i) =>
        p && p.toLowerCase() === qLower ? (
          <mark
            key={i}
            className="rounded-sm bg-amber-400/30 px-0.5 text-amber-200"
          >
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

/**
 * RELION log line semantics — classify one line for console colouring.
 *   milestone  teal     — "Auto-refine: Iteration= N", "Expectation iteration N"
 *   resolution teal+sem — "CurrentResolution= 13.3 Å" / "Auto-refine: Resolution="
 *   separator  dim      — pure "=====" framing blocks
 *   warning    amber    — WARNING blocks (relion prefixes "Auto-refine: WARNING:")
 *   error      rose     — errors / aborts / exceptions
 */
type LogTone = "error" | "warn" | "milestone" | "resolution" | "separator" | null;

function classifyLogLine(line: string): LogTone {
  if (/error|fail|abort|aborting|exception/i.test(line)) return "error";
  if (/warn|caution|retry/i.test(line)) return "warn";
  // pure "=====..." framing lines (RELION draws them around E/M steps)
  if (/^\s*={3,}\s*$/.test(line) || /^\s*\+{3,}\s*$/.test(line)) return "separator";
  if (/Auto-refine:\s*Resolution=|CurrentResolution=/i.test(line)) return "resolution";
  if (/Auto-refine:\s*Iteration=|Expectation iteration|Maximization iteration|^\s*it\s*\[?\d/i.test(line))
    return "milestone";
  return null;
}

function LogLine({
  line,
  index,
  highlight,
}: {
  line: string;
  index: number;
  /** raw search query — when set, matches get highlighted */
  highlight?: string | null;
}) {
  const tone = classifyLogLine(line);
  return (
    <span
      className={cn(
        "block px-1",
        index % 2 === 1 && "bg-white/[0.025]",
        tone === "error" && "bg-rose-500/10 text-rose-400",
        tone === "warn" && "bg-amber-500/10 text-amber-300",
        tone === "milestone" && "text-teal-300 font-semibold",
        tone === "resolution" && "text-teal-200 font-semibold",
        tone === "separator" && "text-zinc-600"
      )}
    >
      {highlight ? <Highlighted line={line} q={highlight} /> : line || "\u00A0"}
    </span>
  );
}

/** console footer legend — decodes the line colours for new users */
function LogLegend() {
  const items: [string, string][] = [
    ["bg-teal-400", "iteration"],
    ["bg-teal-200", "resolution"],
    ["bg-amber-400", "warning"],
    ["bg-rose-400", "error"],
  ];
  return (
    <div className="flex shrink-0 items-center gap-2.5 border-t border-zinc-800 bg-zinc-900/60 px-3 py-1">
      <span className="text-[9px] font-medium uppercase tracking-wider text-zinc-600">legend</span>
      {items.map(([dot, label]) => (
        <span key={label} className="inline-flex items-center gap-1">
          <span className={cn("size-1.5 rounded-full", dot)} aria-hidden="true" />
          <span className="text-[9.5px] text-zinc-500">{label}</span>
        </span>
      ))}
    </div>
  );
}

function LogConsole({ job }: { job: JobDTO }) {
  const [log, setLog] = React.useState<string | null>(null);
  const [noLog, setNoLog] = React.useState(false);
  const [mode, setMode] = React.useState<"tail" | "full">("tail");
  const [totalLines, setTotalLines] = React.useState(0);
  const [truncated, setTruncated] = React.useState(false);
  const [follow, setFollow] = React.useState(true);
  const [wrap, setWrap] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const atBottomRef = React.useRef(true);

  const running = job.status === "running";

  const fetchLog = React.useCallback(async () => {
    try {
      const res = await fetch(
        `/api/jobs/${job.id}/log${mode === "full" ? "?full=1" : ""}`,
        { cache: "no-store" }
      );
      if (res.status === 404) {
        setNoLog(true);
        setLog(null);
        return;
      }
      const body = (await res.json()) as {
        tail?: string;
        totalLines?: number;
        truncated?: boolean;
      };
      setNoLog(false);
      setLog(body.tail ?? "");
      setTotalLines(body.totalLines ?? 0);
      setTruncated(body.truncated ?? false);
    } catch {
      /* transient — next poll retries */
    }
  }, [job.id, mode]);

  React.useEffect(() => {
    setLog(null);
    setNoLog(false);
    void fetchLog();
  }, [fetchLog]);

  React.useEffect(() => {
    if (!running) return;
    // tail is cheap (≤96KB) — 1.5s; the full log is bigger — 5s
    const t = setInterval(() => void fetchLog(), mode === "full" ? 5000 : 1500);
    return () => clearInterval(t);
  }, [running, fetchLog, mode]);

  // auto-scroll when following (and the user hasn't scrolled up)
  React.useEffect(() => {
    if (!follow) return;
    const el = scrollRef.current;
    if (!el || !atBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [log, follow]);

  // RELION rewrites progress bars with \r — a terminal shows only the last
  // frame, so collapse each line to its post-\r segment (kills the wall of
  // bird-artefacts while keeping the authentic final state of each line)
  const lines = React.useMemo(() => {
    if (!log) return [];
    return log
      .split("\n")
      .map((line) => {
        const idx = line.lastIndexOf("\r");
        return (idx >= 0 ? line.slice(idx + 1) : line).replace(/\s+$/, "");
      })
      // (blank lines kept as-is: they group RELION log sections visually)
  }, [log]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  const lineCount = lines.length;

  // search filter — original indices keep the zebra striping stable
  const q = query.trim().toLowerCase();
  const visible = React.useMemo(() => {
    if (!q) return lines.map((line, i) => ({ line, i }));
    return lines
      .map((line, i) => ({ line, i }))
      .filter((x) => x.line.toLowerCase().includes(q));
  }, [lines, q]);
  const matchCount = q ? visible.length : null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-inner">
      {/* toolbar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 bg-zinc-900/80 px-3 py-1.5">
        <Terminal className="size-3.5 text-zinc-500" aria-hidden="true" />
        <span className="font-mono text-[11px] font-medium text-zinc-400">run.out</span>
        {running ? (
          <span className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-400">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-rose-500" />
            </span>
            live
          </span>
        ) : (
          <span className="ml-1 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            {job.status}
          </span>
        )}
        <span className="text-[10px] text-zinc-600">
          {mode === "full" ? `${totalLines.toLocaleString()} lines (full)` : `${lineCount} lines`}
        </span>
        {matchCount != null ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums",
              matchCount === 0
                ? "bg-rose-500/15 text-rose-400"
                : "bg-amber-500/15 text-amber-400"
            )}
            title={`${matchCount} of ${lineCount} lines match “${query.trim()}”`}
          >
            {matchCount.toLocaleString()} / {lineCount.toLocaleString()} match
          </span>
        ) : null}
        {mode === "tail" && truncated ? (
          <button
            type="button"
            onClick={() => setMode("full")}
            className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400 transition-colors hover:bg-amber-500/25"
            title={`Showing the last 600 of ${totalLines.toLocaleString()} lines — click to load the full log`}
          >
            +{(totalLines - lineCount).toLocaleString()} hidden — show full log
          </button>
        ) : null}
        {mode === "full" && truncated ? (
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500" title="Log exceeds the 8MB safety cap">
            log &gt; 8MB — clipped
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-0.5">
          {/* log search / filter */}
          <div className="relative mr-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-zinc-600" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="filter…"
              aria-label="Filter log lines"
              className="h-7 w-28 rounded border border-zinc-700/80 bg-zinc-800/60 pl-6 pr-2 font-mono text-[11px] text-zinc-300 transition-all placeholder:text-zinc-600 focus:w-40 focus:border-teal-500/50 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear log filter"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-500 hover:bg-zinc-700/60 hover:text-zinc-300"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          {/* tail / full segmented toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center rounded-md border border-zinc-700/80 bg-zinc-800/60 p-0.5" role="group" aria-label="Log window mode">
                {(["tail", "full"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={mode === m}
                    onClick={() => setMode(m)}
                    className={cn(
                      "rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors",
                      mode === m
                        ? "bg-teal-500/20 text-teal-300"
                        : "text-zinc-500 hover:text-zinc-300"
                    )}
                  >
                    {m === "tail" ? "Tail" : "Full"}
                  </button>
                ))}
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Tail streams the last 600 lines (fast polling); Full loads the whole log
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-pressed={follow}
                onClick={() => {
                  setFollow((f) => !f);
                  atBottomRef.current = true;
                }}
                className={cn(
                  "h-7 gap-1.5 rounded px-2 text-[11px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200",
                  follow && "bg-zinc-800 text-teal-300 hover:text-teal-200"
                )}
              >
                {follow ? <ArrowDown className="size-3.5" /> : <Pause className="size-3.5" />}
                {follow ? "Following" : "Paused"}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Auto-scroll to the newest output</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-pressed={wrap}
                onClick={() => setWrap((w) => !w)}
                className={cn(
                  "h-7 rounded px-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200",
                  wrap && "bg-zinc-800 text-teal-300"
                )}
              >
                <WrapText className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Toggle line wrapping</TooltipContent>
          </Tooltip>
          {log ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <CopyButton
                    text={q ? visible.map((v) => v.line).join("\n") : log}
                    label={q ? `${visible.length} lines` : undefined}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {q
                  ? `Copy the ${visible.length} lines matching “${query.trim()}”`
                  : "Copy the whole log"}
              </TooltipContent>
            </Tooltip>
          ) : null}
          {!noLog ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 rounded px-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  aria-label="Download full log"
                  onClick={() => {
                    window.open(`/api/jobs/${job.id}/log?format=raw`, "_blank", "noopener");
                  }}
                >
                  <Download className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Download the complete run.out</TooltipContent>
            </Tooltip>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 rounded px-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Refresh log"
            onClick={() => {
              setRefreshing(true);
              void fetchLog().finally(() => setRefreshing(false));
            }}
          >
            <RotateCcw className={cn("size-3.5", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* the console */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-[1.55] text-zinc-300"
        role="log"
        aria-label="Engine log"
      >
        {noLog ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-zinc-500">
            <ScrollText className="size-8 opacity-40" aria-hidden="true" />
            <p className="text-xs font-medium text-zinc-400">No engine log</p>
            <p className="max-w-xs text-[11px] leading-relaxed">
              This job never wrote run.out to disk (engine-native or simulated jobs log
              nothing). Check the Overview tab for its result summary.
            </p>
          </div>
        ) : log === null ? (
          <div className="flex h-full items-center justify-center gap-2 text-xs text-zinc-500">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Reading log…
          </div>
        ) : log.length === 0 ? (
          <p className="text-center text-zinc-600">(log empty — waiting for the engine to speak)</p>
        ) : (
          <pre className={cn("m-0", wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre")}>
            {visible.length === 0 ? (
              <p className="px-1 text-zinc-600">
                no lines match “{query.trim()}”
              </p>
            ) : (
              visible.map(({ line, i }) => (
                <LogLine key={i} line={line} index={i} highlight={q || null} />
              ))
            )}
          </pre>
        )}
      </div>
      <LogLegend />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overview tab                                                        */
/* ------------------------------------------------------------------ */

function Timeline({ job }: { job: JobDTO }) {
  const running = job.status === "running";
  const started = job.startedAt;
  const finished = job.status === "completed" || job.status === "failed";
  const elapsed = useElapsed(started, running);
  const duration = finished ? job.duration : running ? elapsed : 0;

  interface TimelineStep {
    icon: React.ElementType;
    label: string;
    value: string;
    sub: string;
    done: boolean;
    live?: boolean;
    tone?: "bad" | "good" | "run";
  }

  const steps: TimelineStep[] = [
    {
      icon: Database,
      label: "Created",
      value: job.createdAt ? fmtClock(job.createdAt) : "—",
      sub: job.createdAt ? fmtAgo(job.createdAt) : "",
      done: true,
    },
    {
      icon: Play,
      label: "Started",
      value: started ? fmtClock(started) : "—",
      sub: started ? fmtAgo(started) : "not yet",
      done: started != null,
      live: running,
    },
    {
      icon: job.status === "failed" ? AlertTriangle : Check,
      label: running ? "Running" : finished ? (job.status === "completed" ? "Completed" : "Failed") : "Pending",
      value: running ? `${Math.round(job.progress)}%` : finished ? fmtDuration(duration) : "—",
      sub: running ? fmtDuration(duration) + " elapsed" : finished ? "wall time" : "",
      done: finished,
      live: running,
      tone: job.status === "failed" ? "bad" : job.status === "completed" ? "good" : "run",
    },
  ] satisfies TimelineStep[];

  return (
    <ol className="relative grid grid-cols-3 items-start gap-2">
      {/* connecting line */}
      <div
        aria-hidden="true"
        className="absolute left-[16.66%] right-[16.66%] top-5 -z-0 h-0.5 rounded bg-muted"
      >
        <div
          className={cn(
            "h-full rounded transition-all duration-700",
            running ? "bg-gradient-to-r from-teal-500 to-teal-400" : finished ? "bg-emerald-500" : "bg-transparent"
          )}
          style={{ width: finished ? "100%" : running ? `${Math.max(4, job.progress)}%` : "0%" }}
        />
      </div>
      {steps.map((s) => {
        const Icon = s.icon;
        return (
          <li key={s.label} className="relative z-10 flex flex-col items-center gap-1.5 text-center">
            <span
              className={cn(
                "flex size-10 items-center justify-center rounded-full border-2 bg-card shadow-sm",
                s.done
                  ? s.tone === "bad"
                    ? "border-rose-500 text-rose-600"
                    : s.tone === "good"
                      ? "border-emerald-500 text-emerald-600"
                      : "border-teal-500 text-teal-600"
                  : "border-muted text-muted-foreground",
                s.live && "animate-pulse"
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <span className="text-[11px] font-semibold text-foreground/85">{s.label}</span>
            <span className="font-mono text-xs tabular-nums text-foreground/70">{s.value}</span>
            {s.sub ? <span className="text-[10px] text-muted-foreground">{s.sub}</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

function ResultSummary({ job }: { job: JobDTO }) {
  if (job.status === "running") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-teal-600/30 bg-teal-600/5 p-3.5">
        <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-teal-600/15 text-teal-600">
          <Loader2 className="size-4.5 animate-spin" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Refinement in progress</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground" title={job.result ?? undefined}>
            {job.result ?? "The RELION engine is crunching — live output lands in the Log tab."}
          </p>
        </div>
      </div>
    );
  }
  if (job.status === "pending") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-amber-600/30 bg-amber-600/5 p-3.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-600/15 text-amber-600">
          <Clock className="size-4.5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Waiting as pending</p>
          <p className="mt-0.5 break-words text-xs leading-relaxed text-amber-700 dark:text-amber-300">
            {job.result ?? "Waiting for an upstream job to produce its outputs."}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            The job did not fail — it will start as soon as its upstream inputs exist. Press Run to re-check.
          </p>
        </div>
      </div>
    );
  }
  if (job.status === "failed") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-rose-600/30 bg-rose-600/5 p-3.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-rose-600/15 text-rose-600">
          <AlertTriangle className="size-4.5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Job failed</p>
          <p className="mt-0.5 break-words text-xs leading-relaxed text-rose-700 dark:text-rose-300">
            {job.result ?? "The engine exited with an error — see the Log tab for details."}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 rounded-lg border border-emerald-600/30 bg-emerald-600/5 p-3.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-600/15 text-emerald-600">
        <Check className="size-4.5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">Completed{job.duration > 0 ? ` · ${fmtDuration(job.duration)}` : ""}</p>
        <p className="mt-0.5 break-words text-xs leading-relaxed text-foreground/75">
          {job.result ?? "Finished without a result summary."}
        </p>
      </div>
    </div>
  );
}

function ParamsGrid({ job }: { job: JobDTO }) {
  const spec = jobType(job.type);
  const entries = Object.entries(job.params ?? {}).filter(([, v]) => v !== "" && v != null);
  if (entries.length === 0) return null;
  const labelFor = (key: string) => spec?.params.find((p) => p.key === key)?.label ?? key;
  const unitFor = (key: string) => spec?.params.find((p) => p.key === key)?.unit ?? "";
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-lg border bg-card px-3 py-2.5">
          <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground" title={labelFor(key)}>
            {labelFor(key)}
          </p>
          <p className="mt-0.5 truncate font-mono text-xs font-semibold text-foreground/90" title={String(value)}>
            {String(value)}
            {unitFor(key) ? <span className="ml-1 font-normal text-muted-foreground">{unitFor(key)}</span> : null}
          </p>
        </div>
      ))}
    </div>
  );
}

function InputsCard({ inputs }: { inputs?: { flag: string; path: string }[] }) {
  if (!inputs || inputs.length === 0) return null;
  const flagLabel: Record<string, string> = {
    "--i": "particles",
    "--ref": "reference map",
    "--mask": "mask",
    "--f": "postprocess",
    "--coord_list": "coordinates",
    "--part_star": "particles",
  };
  return (
    <ul className="space-y-1.5">
      {inputs.map((inp) => (
        <li
          key={inp.flag + inp.path}
          className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-2 text-xs"
        >
          <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
            {flagLabel[inp.flag] ?? inp.flag}
          </span>
          <span className="truncate font-mono text-[11px] text-foreground/80" title={inp.path}>
            {inp.path.split("/").slice(-2).join("/")}
          </span>
        </li>
      ))}
    </ul>
  );
}

function OutputsSummary({ files }: { files: OutputFile[] }) {
  const byKind = files.reduce<Record<string, number>>((acc, f) => {
    acc[f.kind] = (acc[f.kind] ?? 0) + 1;
    return acc;
  }, {});
  const items = [
    { kind: "mrc", label: "maps & images", icon: Layers, color: "text-teal-600" },
    { kind: "star", label: "STAR tables", icon: Table2, color: "text-violet-600" },
    { kind: "text", label: "logs & text", icon: ScrollText, color: "text-amber-600" },
    { kind: "image", label: "plots", icon: BarChart3, color: "text-rose-600" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map(({ kind, label, icon: Icon, color }) => (
        <div key={kind} className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5">
          <Icon className={cn("size-4 shrink-0", color)} aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-lg font-semibold leading-none tabular-nums text-foreground/90">
              {byKind[kind] ?? 0}
            </p>
            <p className="mt-1 truncate text-[10px] text-muted-foreground">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
  hint,
}: {
  icon: React.ElementType;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-baseline gap-2">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-foreground/70">
          <Icon className="size-3.5 text-teal-600" aria-hidden="true" />
          {title}
        </h4>
        {hint ? <span className="text-[10px] text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

function OverviewTab({
  job,
  data,
  onOpenFiles,
}: {
  job: JobDTO;
  data: OutputsResponse | null;
  onOpenFiles: () => void;
}) {
  // refining jobs get a live per-iteration resolution chart
  const isRefineType = /class2d|class3d|initialmodel|refine3d|multibody/i.test(job.type);
  const is3dType = /initialmodel|refine3d|class3d|multibody|postprocess/i.test(job.type);
  const isClassifyType = /class2d|class3d/i.test(job.type);
  const isCtfType = /ctffind|ctf/i.test(job.type);
  const hasIterated = (job.status === "running" || job.status === "completed" || job.status === "failed") &&
    (job.progress > 4 || job.status !== "running");
  return (
    <div className="space-y-6">
      <ResultSummary job={job} />
      {/* import jobs show the raw detector frames gallery. */}
      {/^import$/i.test(job.type) && job.status !== "idle" ? (
        <ImportGallery jobId={job.id} />
      ) : null}
      {/* manualpick jobs show the picked-particle overlay map. */}
      {/manualpick/i.test(job.type) && job.status !== "idle" ? (
        <PicksMap jobId={job.id} />
      ) : null}
      {/* extract/select jobs show the particle stack browser. */}
      {/^(extract|select)/i.test(job.type) && job.status !== "idle" ? (
        <ParticleBrowser jobId={job.id} />
      ) : null}
      {isRefineType && hasIterated ? (
        <ResolutionChart jobId={job.id} running={job.status === "running"} />
      ) : null}
      {/* 3D reconstructions get the FSC curve (gold-standard report card). */}
      {is3dType ? (
        <FscChart jobId={job.id} running={job.status === "running"} />
      ) : null}
      {/* postprocess jobs add the Guinier plot (B-factor validation). */}
      {/postprocess/i.test(job.type) ? (
        <GuinierChart jobId={job.id} running={job.status === "running"} />
      ) : null}
      {/* 3D jobs also get the orientation distribution polar heatmap
          (self-hides while the API has no data star to bin). */}
      {is3dType && job.status !== "idle" ? (
        <AngularDistributionChart jobId={job.id} running={job.status === "running"} />
      ) : null}
      {/* 2D/3D classification gets class occupancy bars. */}
      {isClassifyType && job.status !== "idle" ? (
        <ClassDistributionChart jobId={job.id} />
      ) : null}
      {/* CTF estimation gets a per-micrograph fit quality panel. */}
      {isCtfType && job.status !== "idle" ? (
        <CtfQualityChart jobId={job.id} />
      ) : null}
      <Section icon={Activity} title="Timeline">
        <div className="rounded-xl border bg-card p-5 pt-4">
          <Timeline job={job} />
        </div>
      </Section>
      <Section icon={LayoutDashboard} title="Key parameters" hint={`${Object.keys(job.params ?? {}).length} total`}>
        <ParamsGrid job={job} />
      </Section>
      <div className="grid gap-6 lg:grid-cols-2">
        {data?.inputs && data.inputs.length > 0 ? (
          <Section icon={ArrowRight} title="Inputs consumed">
            <InputsCard inputs={data.inputs} />
          </Section>
        ) : null}
        {data && data.files.length > 0 ? (
          <Section icon={FolderOpen} title="Outputs at a glance">
            <div className="space-y-2.5">
              <OutputsSummary files={data.files} />
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenFiles}
                className="h-7 gap-1.5 px-2.5 text-[11px]"
              >
                <FolderOpen className="size-3.5" aria-hidden="true" />
                Browse all {data.files.length} files
              </Button>
            </div>
          </Section>
        ) : null}
      </div>
      {data?.cmd ? (
        <Section icon={Terminal} title="Command line">
          <div className="flex items-start gap-2 rounded-lg border bg-zinc-950 p-3 dark:bg-zinc-900">
            <pre className="m-0 min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[10.5px] leading-relaxed text-zinc-300">
              {data.cmd}
            </pre>
            <CopyButton text={data.cmd} />
          </div>
        </Section>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Files tab                                                           */
/* ------------------------------------------------------------------ */

const KIND_META: Record<OutputKind, { icon: React.ElementType; color: string; label: string }> = {
  mrc: { icon: Layers, color: "text-teal-600", label: "MRC" },
  star: { icon: Table2, color: "text-violet-600", label: "STAR" },
  text: { icon: ScrollText, color: "text-amber-600", label: "TEXT" },
  image: { icon: FileText, color: "text-rose-600", label: "PLOT" },
};

function FilesTab({ job, data, reload }: { job: JobDTO; data: OutputsResponse | null; reload: () => void }) {
  const [query, setQuery] = React.useState("");
  const [kindFilter, setKindFilter] = React.useState<OutputKind | "all">("all");
  const files = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = data?.files ?? [];
    if (kindFilter !== "all") list = list.filter((f) => f.kind === kindFilter);
    return q ? list.filter((f) => f.path.toLowerCase().includes(q)) : list;
  }, [data, query, kindFilter]);

  const kindCounts = React.useMemo(() => {
    const counts = new Map<OutputKind, number>();
    for (const f of data?.files ?? []) {
      counts.set(f.kind, (counts.get(f.kind) ?? 0) + 1);
    }
    return counts;
  }, [data]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <div className="relative w-64 max-w-full">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name or path…"
            className="h-8 pl-8 text-xs"
            aria-label="Filter output files"
          />
        </div>
        {/* kind quick-filters */}
        <div className="flex items-center gap-1" role="group" aria-label="Filter by file kind">
          {(["all", ...(Object.keys(KIND_META) as OutputKind[])] as const).map((k) => {
            const active = kindFilter === k;
            const count = k === "all" ? (data?.files.length ?? 0) : (kindCounts.get(k as OutputKind) ?? 0);
            if (k !== "all" && count === 0) return null;
            const meta = k === "all" ? null : KIND_META[k as OutputKind];
            const Icon = meta?.icon ?? Layers;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={active}
                onClick={() => setKindFilter(k)}
                className={cn(
                  "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[10px] font-semibold uppercase tracking-wide transition-colors",
                  active
                    ? "border-teal-600/40 bg-teal-600/15 text-teal-700 dark:text-teal-300"
                    : "border-border bg-card text-muted-foreground hover:bg-secondary/60"
                )}
              >
                <Icon className={cn("size-3", meta?.color)} aria-hidden="true" />
                {k === "all" ? "All" : meta?.label ?? k}
                <span className="tabular-nums opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {files.length} file{files.length === 1 ? "" : "s"}
          {files.length !== (data?.files.length ?? 0) ? ` of ${data?.files.length ?? 0}` : ""}
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={reload}
          className="ml-auto h-7 gap-1.5 px-2 text-[11px]"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Refresh
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border">
        {files.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
            <FolderOpen className="size-8 opacity-40" aria-hidden="true" />
            <p className="text-xs font-medium text-foreground/70">
              {data?.note ?? "No output files on disk"}
            </p>
          </div>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
                <tr className="border-b text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <th scope="col" className="px-3 py-2">File</th>
                  <th scope="col" className="w-24 px-2 py-2">Kind</th>
                  <th scope="col" className="w-32 px-2 py-2">Details</th>
                  <th scope="col" className="w-20 px-2 py-2 text-right">Size</th>
                  <th scope="col" className="w-16 px-2 py-2 text-right">Get</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => {
                  const meta = KIND_META[f.kind];
                  return (
                    <tr key={f.path} className="group border-b transition-colors last:border-0 hover:bg-muted/50">
                      <td className="px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <meta.icon className={cn("size-4 shrink-0", meta.color)} aria-hidden="true" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground/90" title={f.label ?? f.name}>
                              {f.label ?? f.name}
                            </p>
                            <p className="truncate font-mono text-[10px] text-muted-foreground" title={f.path}>
                              {f.path}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <Badge variant="outline" className="h-5 px-1.5 text-[9px] font-semibold tracking-wider">
                          {meta.label}
                        </Badge>
                      </td>
                      <td className="px-2 py-2 text-[11px] text-muted-foreground">
                        {f.kind === "mrc"
                          ? f.name.toLowerCase().endsWith(".mrcs")
                            ? `${f.slices ?? "?"} images`
                            : `${f.slices ?? "?"}³ voxels`
                          : typeof f.rows === "number"
                            ? `${f.rows.toLocaleString()} rows`
                            : "—"}
                      </td>
                      <td className="px-2 py-2 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                        {formatBytes(f.size)}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                          aria-hidden={false}
                          aria-label={`Download ${f.name}`}
                          onClick={() => {
                            window.open(
                              `/api/jobs/${job.id}/outputs/file?path=${encodeURIComponent(f.path)}&format=raw`,
                              "_blank",
                              "noopener"
                            );
                          }}
                        >
                          <Download className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Lineage breadcrumb — upstream chain of the inspected job            */
/* ------------------------------------------------------------------ */

/** Walk the upstream edge graph (post-order) and cap the chain. */
function upstreamChain(job: JobDTO, jobs: JobDTO[], edges: EdgeDTO[]): JobDTO[] {
  const byId = new Map(jobs.map((j) => [j.id, j]));
  const chain: JobDTO[] = [];
  const visited = new Set<string>([job.id]);
  const walk = (id: string) => {
    // inputs first (deterministic: edge insertion order)
    for (const e of edges) {
      if (e.toJobId === id && !visited.has(e.fromJobId)) {
        visited.add(e.fromJobId);
        walk(e.fromJobId);
      }
    }
    const j = byId.get(id);
    if (j) chain.push(j);
  };
  walk(job.id);
  return chain;
}

function LineageBreadcrumb({ job }: { job: JobDTO }) {
  const jobs = useWorkflowStore((s) => s.jobs);
  const edges = useWorkflowStore((s) => s.edges);
  const inspect = useWorkflowStore((s) => s.inspect);

  const chain = React.useMemo(() => upstreamChain(job, jobs, edges), [job, jobs, edges]);
  if (chain.length < 2) return null; // no inputs — nothing to show

  const MAX = 5; // visible chips (current job included)
  const collapsed = chain.length > MAX;
  const shown = collapsed ? [...chain.slice(0, MAX - 2), chain[chain.length - 1]] : chain;
  const hiddenCount = chain.length - shown.length;

  return (
    <nav aria-label="Job lineage" className="flex flex-wrap items-center gap-0.5">
      <GitCommitHorizontal className="mr-1 size-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />
      {shown.map((j, i) => {
        const isCurrent = j.id === job.id;
        return (
          <React.Fragment key={j.id}>
            {i > 0 ? (
              <ChevronRight className="mx-0.5 size-3 shrink-0 text-muted-foreground/50" aria-hidden="true" />
            ) : null}
            {isCurrent ? (
              <span
                className="max-w-28 truncate rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary"
                title={`${j.name} — this job`}
              >
                {j.name}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => inspect(j.id)}
                className={cn(
                  "max-w-28 truncate rounded px-1.5 py-0.5 text-[10px] font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                  j.status === "completed" ? "text-muted-foreground" : "text-amber-600 dark:text-amber-400"
                )}
                title={`${j.name} — ${j.status} · click to inspect`}
              >
                {j.name}
              </button>
            )}
          </React.Fragment>
        );
      })}
      {collapsed ? (
        <>
          <ChevronRight className="mx-0.5 size-3 shrink-0 text-muted-foreground/50" aria-hidden="true" />
          <button
            type="button"
            onClick={() => inspect(chain[chain.length - 2].id)}
            className="rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            title={`${hiddenCount} intermediate jobs — click to step one level up`}
          >
            +{hiddenCount}
          </button>
          <ChevronRight className="mx-0.5 size-3 shrink-0 text-muted-foreground/50" aria-hidden="true" />
        </>
      ) : null}
    </nav>
  );
}

function InspectorHeader({ job }: { job: JobDTO }) {
  const spec = jobType(job.type);
  const running = job.status === "running";
  const isLink = job.linkedJobId != null;
  const focusJob = useWorkflowStore((s) => s.focusJob);
  const runJob = useWorkflowStore((s) => s.runJob);
  const stopJob = useWorkflowStore((s) => s.stopJob);
  const resetJob = useWorkflowStore((s) => s.resetJob);
  const inspect = useWorkflowStore((s) => s.inspect);
  const select = useWorkflowStore((s) => s.select);
  const jobs = useWorkflowStore((s) => s.jobs);
  const workspaces = useWorkflowStore((s) => s.workspaces);
  const switchWorkspace = useWorkflowStore((s) => s.switchWorkspace);
  const [confirmRerun, setConfirmRerun] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const elapsed = useElapsed(job.startedAt, running);
  // ETA for running jobs (dialog opens client-side, no SSR concern)
  const eta = running ? estimateEta(job.id, job.startedAt, job.progress) : null;

  // linked copies: offer a jump to the ORIGINAL (switch workspace + focus)
  const original = isLink ? jobs.find((j) => j.id === job.linkedJobId) ?? null : null;
  const gotoOriginal = () => {
    if (!original) return;
    inspect(null);
    if (original.workspaceId && original.workspaceId !== useWorkflowStore.getState().activeWorkspaceId) {
      switchWorkspace(original.workspaceId);
    }
    focusJob(original.id);
  };

  return (
    <div className="space-y-3">
      {isLink && (
        <div
          role="note"
          className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/[0.06] px-3 py-2 text-xs text-foreground"
        >
          <Link2 className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            Linked copy — mirrors{" "}
            <span className="font-semibold text-primary">
              {job.linkedName ?? original?.name ?? "its original"}
            </span>
            {job.linkedWorkspaceName ? (
              <span className="text-muted-foreground"> (workspace “{job.linkedWorkspaceName}”)</span>
            ) : null}
            . This node never runs itself; downstream jobs consume the
            original&apos;s outputs.
          </span>
          {original && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 border-primary/40 px-2 text-[11px] text-primary hover:bg-primary/10"
              onClick={gotoOriginal}
              title={`Switch to “${workspaces.find((w) => w.id === original.workspaceId)?.name ?? "its workspace"}” and focus the original job`}
            >
              <Locate className="size-3" aria-hidden="true" />
              Go to original
            </Button>
          )}
        </div>
      )}
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl border shadow-sm",
            spec ? `${spec.color.soft} ${spec.color.border}` : "bg-muted"
          )}
        >
          <TypeIcon name={spec?.icon ?? "boxes"} className={cn("size-5", spec?.color.text)} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold leading-tight tracking-tight text-foreground">
              {job.name}
            </h2>
            <StatusBadge status={job.status} />
            <Badge
              variant="outline"
              className="h-5 px-1.5 text-[9px] font-semibold uppercase tracking-wider"
            >
              {spec?.label ?? job.type}
            </Badge>
          </div>
          {/* NOTE: div, not <p> — the vertical Separators render <div>s and
           * HTML forbids div-in-p (hydration error) */}
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>created {job.createdAt ? fmtAgo(job.createdAt) : "—"}</span>
            {running && job.startedAt ? (
              <>
                <Separator orientation="vertical" className="h-3" decorative />
                <span className="font-mono tabular-nums text-teal-600 dark:text-teal-400">
                  {fmtDuration(elapsed)} elapsed
                </span>
              </>
            ) : null}
            {!running && job.duration > 0 ? (
              <>
                <Separator orientation="vertical" className="h-3" decorative />
                <span className="font-mono tabular-nums">{fmtDuration(job.duration)}</span>
              </>
            ) : null}
          </div>
          {/* upstream chain — click any ancestor to hop to its inspector */}
          <LineageBreadcrumb job={job} />
        </div>

        {/* actions — the close button lives INSIDE this row (the dialog's
            floating top-right X used to collide with "Re-run" on narrower
            screens; keeping everything in one flex row removes the overlap) */}
        <div className="flex shrink-0 items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={() => focusJob(job.id)} className="h-8 gap-1.5 px-2.5 text-xs">
                <Locate className="size-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Focus</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Center this job on the canvas</TooltipContent>
          </Tooltip>
          {job.status !== "running" && !isLink ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void resetJob(job.id).then(() => {
                  inspect(null);
                  select(job.id);
                })}
                className="h-8 gap-1.5 px-2.5 text-xs"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Reset &amp; edit</span>
              </Button>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => setConfirmRerun(true)}
                className="h-8 gap-1.5 bg-teal-600 px-3 text-xs text-white hover:bg-teal-700"
              >
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                Re-run
              </Button>
            </>
          ) : running && !isLink ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void stopJob(job.id).finally(() => setBusy(false));
                  }}
                  className="h-8 gap-1.5 border-rose-300 px-2.5 text-xs text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-950/40"
                >
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Square className="size-3.5" aria-hidden="true" />}
                  <span className="hidden sm:inline">Stop</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                SIGTERM the process tree — refine-family jobs re-run from their
                last checkpoint via RELION --continue
              </TooltipContent>
            </Tooltip>
          ) : null}
          {/* close — in-row X (Esc still works) */}
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Close inspector"
              className="h-8 w-8 gap-0 rounded-md p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </DialogClose>
        </div>
      </div>

      {/* live progress */}
      {running ? (
        <div className="flex items-center gap-3">
          <Progress value={job.progress} className="h-1.5 flex-1 overflow-hidden" />
          <span className="w-10 shrink-0 text-right font-mono text-[11px] font-semibold tabular-nums text-teal-600 dark:text-teal-400">
            {Math.round(job.progress)}%
          </span>
          {eta != null && (
            <span
              className="shrink-0 rounded-full border border-teal-600/30 bg-teal-600/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-teal-700 dark:text-teal-300"
              title={`${formatEta(eta)} remaining — projected from the current pace (RELION iterations can speed up or slow down)`}
            >
              {formatEta(eta)} left
            </span>
          )}
        </div>
      ) : null}

      {/* rerun confirm */}
      <AlertDialog open={confirmRerun} onOpenChange={setConfirmRerun}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Re-run {job.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The engine will restart from scratch with the current parameters and upstream
              inputs. Existing downstream results stay on disk until those jobs re-run.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setBusy(true);
                void runJob(job.id).finally(() => setBusy(false));
              }}
            >
              Start again
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The modal                                                           */
/* ------------------------------------------------------------------ */

export function JobInspector() {
  const inspectId = useWorkflowStore((s) => s.inspectId);
  const jobs = useWorkflowStore((s) => s.jobs);
  const inspect = useWorkflowStore((s) => s.inspect);
  const job = React.useMemo(() => jobs.find((j) => j.id === inspectId) ?? null, [jobs, inspectId]);
  const open = inspectId != null && job != null;

  // outputs data (Overview + Files) — polled while the job runs
  const [data, setData] = React.useState<OutputsResponse | null>(null);
  const jobId = job?.id;
  const running = job?.status === "running";

  const loadOutputs = React.useCallback(async () => {
    if (!jobId) return;
    try {
      const res = await fetch(`/api/jobs/${jobId}/outputs`, { cache: "no-store" });
      if (res.ok) setData((await res.json()) as OutputsResponse);
    } catch {
      /* transient */
    }
  }, [jobId]);

  React.useEffect(() => {
    setData(null);
    void loadOutputs();
  }, [loadOutputs]);

  React.useEffect(() => {
    if (!running) return;
    const t = setInterval(() => void loadOutputs(), 12_000);
    return () => clearInterval(t);
  }, [running, loadOutputs]);

  // smart default tab per status: watch the log while running / after failure,
  // jump straight to the results when the job finished
  const [tab, setTab] = React.useState<string>("log");
  React.useEffect(() => {
    if (!job) return;
    setTab(job.status === "running" || job.status === "failed" ? "log" : "results");
  }, [jobId]);

  const filesCount = data?.files.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && inspect(null)}>
      <DialogContent
        showCloseButton={false}
        className="flex max-w-[min(1480px,96vw)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(1480px,96vw)] h-[min(940px,92dvh)] data-[state=open]:duration-300"
        aria-describedby={undefined}
      >
        {job ? (
          <>
            {/* status accent */}
            <div
              aria-hidden="true"
              className={cn(
                "h-1 w-full shrink-0",
                job.status === "running"
                  ? "bg-gradient-to-r from-teal-600 via-teal-400 to-teal-600"
                  : job.status === "completed"
                    ? "bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-600"
                    : "bg-gradient-to-r from-rose-600 via-rose-400 to-rose-600"
              )}
            />
            <DialogHeader className="shrink-0 space-y-0 border-b px-5 pb-4 pt-4 sm:px-6">
              <DialogTitle asChild>
                <div>
                  <span className="sr-only">{job.name} — job inspector</span>
                  <InspectorHeader job={job} />
                </div>
              </DialogTitle>
              <DialogDescription className="sr-only">
                Live log, intermediate results and output files for {job.name}
              </DialogDescription>
            </DialogHeader>

            <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col gap-0">
              <div className="shrink-0 border-b px-5 pt-2.5 sm:px-6">
                <TabsList className="h-9 bg-muted/60 p-0.5">
                  <TabsTrigger value="overview" className="h-8 gap-1.5 px-3 text-xs">
                    <LayoutDashboard className="size-3.5" aria-hidden="true" />
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="log" className="h-8 gap-1.5 px-3 text-xs">
                    <Terminal className="size-3.5" aria-hidden="true" />
                    Log
                    {job.status === "running" ? (
                      <span className="ml-0.5 size-1.5 rounded-full bg-rose-500" aria-label="live" />
                    ) : null}
                  </TabsTrigger>
                  <TabsTrigger value="results" className="h-8 gap-1.5 px-3 text-xs">
                    <BarChart3 className="size-3.5" aria-hidden="true" />
                    Results
                  </TabsTrigger>
                  <TabsTrigger value="files" className="h-8 gap-1.5 px-3 text-xs">
                    <FolderOpen className="size-3.5" aria-hidden="true" />
                    Files
                    {filesCount > 0 ? (
                      <span className="rounded-full bg-muted px-1.5 text-[9px] font-semibold tabular-nums text-muted-foreground">
                        {filesCount > 99 ? "99+" : filesCount}
                      </span>
                    ) : null}
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="overview" className="mt-0 min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                <OverviewTab job={job} data={data} onOpenFiles={() => setTab("files")} />
              </TabsContent>

              <TabsContent value="log" className="mt-0 min-h-0 flex-1 px-5 py-4 sm:px-6">
                <LogConsole job={job} />
              </TabsContent>

              <TabsContent value="results" className="mt-0 min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                <JobResultsLive job={job} />
              </TabsContent>

              <TabsContent value="files" className="mt-0 min-h-0 flex-1 px-5 py-4 sm:px-6">
                <FilesTab job={job} data={data} reload={() => void loadOutputs()} />
              </TabsContent>
            </Tabs>

            {/* footer: workdir */}
            {data?.workdir ? (
              <footer className="flex shrink-0 items-center gap-2 border-t bg-muted/30 px-5 py-2 text-[11px] text-muted-foreground sm:px-6">
                <FolderOpen className="size-3.5 shrink-0" aria-hidden="true" />
                <span className="shrink-0 font-medium">workdir</span>
                <span className="truncate font-mono" title={data.workdir}>
                  {data.workdir}
                </span>
                <span className="ml-auto shrink-0">
                  <CopyButton text={data.workdir} />
                </span>
              </footer>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Results tab — JobResults + auto-refresh while running               */
/* ------------------------------------------------------------------ */

function JobResultsLive({ job }: { job: JobDTO }) {
  const running = job.status === "running";
  const keyRef = React.useRef(0);
  const [refreshKey, setRefreshKey] = React.useState(0);
  React.useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      keyRef.current += 1;
      setRefreshKey(keyRef.current);
    }, 15_000);
    return () => clearInterval(t);
  }, [running]);
  return <JobResults job={job} refreshKey={refreshKey} />;
}

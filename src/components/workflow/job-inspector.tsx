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
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  BarChart3,
  BookmarkPlus,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  CopyPlus,
  Cpu,
  ArrowLeft,
  History,
  Bug,
  Database,
  Download,
  Eraser,
  FileText,
  FileX,
  FolderOpen,
  GitCommitHorizontal,
  HardDrive,
  Layers,
  LayoutDashboard,
  Lightbulb,
  Link2,
  Locate,
  Lock,
  Loader2,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  ScrollText,
  Search,
  SearchX,
  Server,
  Skull,
  SlidersHorizontal,
  Trash,
  Square,
  Stethoscope,
  Table2,
  Terminal,
  WrapText,
  X,
  XOctagon,
  StickyNote,
  Zap,
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
import { onEscapeClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { loadUserParamPresets, addUserParamPreset, deleteUserParamPreset, presetsForType, snapshotSpecParams, countEffectiveDiffs, reconcileUserParamPresets, USER_PARAM_PRESETS_EVENT, type UserParamPreset } from "@/lib/user-param-presets";
import { diagnoseFailureLines, diagnoseFailureLog, type LogFinding } from "@/lib/log-diagnosis";
import { fmtAgo, fmtClock, fmtDuration } from "@/lib/duration";
import { readJobJournal, type JobJournalKind } from "@/lib/job-journal";
import { JOURNAL_KIND_FACE } from "./journal-kind-face";
import { planSubtreeRun } from "@/lib/subtree-run";
import { jobType, tabsFor } from "@/lib/workflow";
import { RELION_OPTIONS } from "@/lib/relion/option-tables";
import { COMMAND_TEMPLATES } from "@/lib/relion/command-templates";
import { CopyButton } from "./copy-button";
import { RemoteStayNote } from "./remote-stay-note";
import { RemoteRunButton } from "./remote-run-button";
import { CleanupDialog } from "./cleanup-dialog";
import { GALLERY_FOCUS_TTL_MS, useWorkflowStore } from "@/lib/store";
import { jobMatchWhy, jobMatchesFind, subsequenceSpans } from "@/lib/job-match"; // t728 — the why's last mile reads the one matcher; t729 — the filter's HOW too
import { FindMarkedText, FIND_MARK_CLASS } from "./find-mark"; // t728 — the wash's own home; t729 — the filter chip's hue const

/** t617 — the inspector wave's timing words. The modal mounts on the user's
 *  own card click (a pointerup on a submitted card), so the beat is the
 *  family's USER-GESTURE beat: 90ms — the rail's pulse (t614's Workspaces
 *  tab, t616's Catalog tab), the find bar's gesture echoes (60/120) for
 *  neighbors; the dashboard's 350 page-load beat would read as lag on a
 *  click the user just made. Each face lands +24ms later in reading order;
 *  the canonical open composition (accent, header, tabs, panel) settles at
 *  162 + 240 = 402ms, and the workdir footer — DATA-GATED: it mounts only
 *  when the outputs fetch lands, usually a beat after the wave started —
 *  fills the ledger's tail (186) at its own mount, the t616 favorites
 *  precedent: the late arrival pays the tail, never the seat. */
const INSP_BASE_MS = 90;
const INSP_STEP_MS = 24;

/** " · 12.4 MB" for the staging phase line — "" when nothing staged yet. */
function formatStagedBytes(bytes?: number): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes >= 1024 ** 3) return ` · ${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return ` · ${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return ` · ${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** t269 — the time ledger's dialect: wall-clock ms spoken the way the ETA
 *  chip speaks remaining time (compact, tabular, no zero-precision noise).
 *  t270 — exported: the cluster manager's résumé card speaks the SAME
 *  dialect (one ledger language across the whole remote world). */
export function formatLedgerMs(ms?: number): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m${String(Math.round(s % 60)).padStart(2, "0")}s`;
}
import type { EdgeDTO, JobDTO } from "@/lib/types";
import { cn } from "@/lib/utils";
import { describeStaleness, findStaleJobs } from "@/lib/staleness";
import {
  describeDrift,
  formatParamValue,
  paramChanges,
} from "@/lib/params-drift";
import { TypeIcon } from "./icons";
import { StatusBadge, estimateEta, formatEta, isSlurmQueued, trackEtaBaseline } from "./job-card";
import { formatElapsed } from "@/lib/elapsed";
import { useNow } from "@/lib/use-now";
// the sibling picker became a shared module in Task 89 — the dashboard
// roster's row-level Compare is the same component, only the trigger's
// dialect differs (labeled here, icon + hover-reveal there)
import { SiblingComparePicker } from "./sibling-compare-picker";
import { ReferenceMapCard } from "./reference-map-card";
import { JobResults, KeyNumbersStrip } from "./results/results-view";
import { parseResultCounts, formatCountFull, type ResultCounts } from "@/lib/result-counts";
import type { OutputSummary } from "@/lib/relion/output-summary";
// t391 — the results family rides the lazy barrel: the charts/galleries
// are modal tab content, and their graph (recharts + browsers) no longer
// pays into the eager home compile (the 4GB-box OOM ceiling)
import {
  ResolutionChart,
  FscChart,
  CtfQualityChart,
  MotionDriftChart,
  MicrographQcBoard,
  ClassDistributionChart,
  ClassAveragesTeaser,
  AngularDistributionChart,
  CryoSparcAnglePanel,
  RebalanceReport,
  ImportGallery,
  PicksMap,
  ParticleBrowser,
  GuinierChart,
  TopazTrainingChart,
  CtfCompareEntry,
  MotionCompareEntry,
  ClassCompareEntry,
  ClassConvergenceEntry,
  ResolutionArcEntry,
  PostprocessVerdictEntry,
  ParticleFunnelEntry,
} from "./results/results-lazy";

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
  /** t289 — manifest entries still on the cluster join the listing with
   *  remote: true (the local walk doesn't contain them); t429 reads this
   *  flag for the stay-receipt's bring-home awareness. */
  remote?: boolean;
}

interface OutputsResponse {
  workdir: string | null;
  engine: "relion";
  files: OutputFile[];
  inputs?: { flag: string; path: string }[];
  cmd?: string;
  note?: string;
  /** t347 — the live-counted key numbers (the outputs route computes them;
   *  the Overview strip + header chips read this first, the run receipt's
   *  own counts as the fallback). */
  summary?: OutputSummary | null;
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

// fmtDuration / fmtClock / fmtAgo live in @/lib/duration (Task 123) —
// the pipeline timeline prints the same labels, one source serves both

const SUBMITTED = new Set(["running", "completed", "failed"]);

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function useElapsed(startedAt: string | null, active: boolean): number {
  // Task 142 — rebuilt on the canonical useNow (init 0 — Task 141's
  // doctrine: a clock reading never enters the first frame; this modal
  // only mounts client-side, but the surface is eliminated, not
  // gated). now === 0 reads as "no readout yet"; consumers gate it away
  // instead of printing a first-frame artifact.
  const now = useNow(active && startedAt != null);
  if (!startedAt || now === 0) return 0;
  return Math.max(0, now - new Date(startedAt).getTime());
}

/* CopyButton moved to ./copy-button (Task 170) — the JobPanel's command
   preview shares the exact same clipboard dialect instead of forking it. */

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
            className="rounded-sm bg-warning-400/30 px-0.5 text-warning-200"
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
        tone === "error" && "bg-danger-500/10 text-danger-400",
        tone === "warn" && "bg-warning/10 text-warning-300",
        tone === "milestone" && "text-running-300 font-semibold",
        tone === "resolution" && "text-running-200 font-semibold",
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
    ["bg-danger-400", "error"],
  ];
  return (
    /* Task 176: the legend wraps below sm — the error chip measured 33px
       past a 269px dialog (280 fold band); ≥sm never wraps. */
    <div className="flex max-sm:flex-wrap shrink-0 items-center gap-2.5 border-t border-zinc-800 bg-zinc-900/60 px-3 py-1">
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

/** Task 119: failure-signature → icon. Keyed by LogFinding.id from
 *  log-diagnosis.ts; unknown ids fall back to AlertTriangle. Task 121
 *  added mpi-abort and python-traceback to the table. */
const FINDING_ICONS: Record<string, React.ElementType> = {
  "oom-kill": Skull,
  "gpu-oom": Cpu,
  "disk-full": HardDrive,
  "missing-input": FileX,
  permission: Lock,
  segfault: Zap,
  "mpi-abort": XOctagon,
  "python-traceback": Bug,
};

/* ------------------------------------------------------------------ */
/* t347 — cross-mount log memory                                       */
/* ------------------------------------------------------------------ */
/**
 * The Log tab unmounts whenever it is not the active tab, so every return
 * used to flash "Reading log…" before the fetch landed. This module-level
 * cache remembers the last committed log text per job and seeds the next
 * mount instantly — the fetch then refreshes it within a tick. LRU-capped
 * (16 jobs) and byte-capped (256 KB from the END of the text — the newest
 * lines — so an 8 MB full log still paints something sane).
 */
const LOG_SEED_CAP_JOBS = 16;
const LOG_SEED_CAP_BYTES = 256 * 1024;
const logSeedCache = new Map<string, { text: string; totalLines: number }>();

function readLogSeed(jobId: string): { text: string; totalLines: number } | null {
  const hit = logSeedCache.get(jobId);
  if (hit) {
    // LRU bump: re-insert at the end (oldest entries sit at the front)
    logSeedCache.delete(jobId);
    logSeedCache.set(jobId, hit);
  }
  return hit ?? null;
}

function writeLogSeed(jobId: string, text: string, totalLines: number): void {
  const t = text.length > LOG_SEED_CAP_BYTES ? text.slice(-LOG_SEED_CAP_BYTES) : text;
  logSeedCache.delete(jobId);
  logSeedCache.set(jobId, { text: t, totalLines });
  while (logSeedCache.size > LOG_SEED_CAP_JOBS) {
    const oldest = logSeedCache.keys().next().value;
    if (oldest == null) break;
    logSeedCache.delete(oldest);
  }
}

function LogConsole({
  job,
  initialMode,
}: {
  job: JobDTO;
  /** Task 120: the Overview diagnosis teaser's jump lands in Full mode so
   *  the strip counts the same whole-log evidence the teaser counted —
   *  parity by construction. One-shot: any manual tab change remounts the
   *  console without it, and the tail default returns. */
  initialMode?: "tail" | "full";
}) {
  const [log, setLog] = React.useState<string | null>(null);
  const [noLog, setNoLog] = React.useState(false);
  const [mode, setMode] = React.useState<"tail" | "full">(initialMode ?? "tail");
  const [totalLines, setTotalLines] = React.useState(0);
  const [truncated, setTruncated] = React.useState(false);
  const [follow, setFollow] = React.useState(true);
  const [wrap, setWrap] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const atBottomRef = React.useRef(true);
  /** Monotonic fetch sequence — only the newest log fetch may commit. -1 marks in-flight start. */
  const logFetchSeqRef = React.useRef(0);
  const [logError, setLogError] = React.useState<string | null>(null);
  /** t347 — a pending answer's quiet hint (toolbar chip, never console text). */
  const [waitingHint, setWaitingHint] = React.useState<string | null>(null);
  /** Mirror of `log` readable inside fetch callbacks without joining deps. */
  const logRef = React.useRef<string | null>(null);
  /**
   * t391 — the last-seen log version. Rides the poll as ?since= so an
   * unmoved log answers {unchanged:true} (~40 bytes) instead of the full
   * tail — and the identical text never re-renders the 600-line console.
   * Reset on job/mode switch (a different window is a different answer).
   */
  const logVersionRef = React.useRef<string>("");
  /** Tracks which job the current log text belongs to (switch clears it). */
  const logJobRef = React.useRef<string>(job.id);
  const commitLog = React.useCallback((v: string | null) => {
    logRef.current = v;
    setLog(v);
  }, []);

  const running = job.status === "running";

  const fetchLog = React.useCallback(async () => {
    // out-of-order guard: overlapping 1.5 s ticks can commit an OLDER response
    // after a newer one — the log console then jumps backwards; the sequence
    // counter makes only the newest fetch eligible to commit
    const seq = ++logFetchSeqRef.current;
    try {
      // t391 — the version token rides every poll: an unmoved log answers
      // {unchanged:true} in ~40 bytes and the console never re-renders.
      const params = new URLSearchParams();
      if (mode === "full") params.set("full", "1");
      if (logVersionRef.current) params.set("since", logVersionRef.current);
      const qs = params.toString();
      const res = await fetch(
        `/api/jobs/${job.id}/log${qs ? `?${qs}` : ""}`,
        { cache: "no-store" }
      );
      if (seq !== logFetchSeqRef.current) return; // a newer fetch won
      if (res.status === 404) {
        // t347 — a 404 means THIS ROUTE has no record (never ran, or the
        // record vanished with an app restart). When content is already on
        // screen it stays — the text is real, only the record is gone.
        if (logRef.current == null || logRef.current.length === 0) {
          setNoLog(true);
          commitLog(null);
        } else {
          setLogError("the log record is gone (app restart?) — the text below is the last content");
        }
        return;
      }
      if (!res.ok) {
        // 500 etc: an {error} body has no .tail — silently rendering "" makes
        // a dead route look like an empty log. Keep the previous content and
        // flag it; the next tick retries.
        setLogError(`log unavailable (HTTP ${res.status})`);
        return;
      }
      const body = (await res.json()) as {
        tail?: string;
        totalLines?: number;
        truncated?: boolean;
        pending?: boolean;
        note?: string;
        unchanged?: boolean;
        version?: string;
      };
      setLogError(null);
      if (body.pending) {
        // t347 — a rate-limited window / cold heartbeat: this answer carries
        // no data. NEVER blank the console — keep the current text and let
        // the toolbar whisper the reason.
        setWaitingHint(body.note ?? "waiting for the cluster's next heartbeat…");
        return;
      }
      if (body.unchanged) {
        // t391 — the log did not move: keep EVERYTHING as-is (text, counters,
        // seed) — this tick cost ~40 bytes and zero renders, which is the
        // whole point. Clearing a stale hint is the only state change.
        setWaitingHint(null);
        return;
      }
      setWaitingHint(null);
      setNoLog(false);
      logVersionRef.current = body.version ?? "";
      const text = body.tail ?? "";
      // t391 — identical text must not re-render the console: a new string
      // with the same content used to re-mount 600 lines every 1.5s tick.
      // (setTotalLines/setTruncated with equal values bail out in React itself.)
      if (text !== logRef.current) {
        commitLog(text);
        writeLogSeed(job.id, text, body.totalLines ?? 0);
      }
      setTotalLines(body.totalLines ?? 0);
      setTruncated(body.truncated ?? false);
    } catch {
      /* transient — next poll retries */
    }
  }, [job.id, mode, commitLog]);

  React.useEffect(() => {
    // t347 — a job switch retires the old text (it belongs to another run);
    // a MODE switch does NOT: the previous window stays on screen until the
    // new one lands — the console never blanks mid-conversation. A fresh
    // mount seeds from the cross-mount memory so reopening the Log tab
    // paints instantly instead of flashing "Reading log…".
    if (logJobRef.current !== job.id) {
      logJobRef.current = job.id;
      commitLog(null);
      setNoLog(false);
      setTotalLines(0);
      setTruncated(false);
      logVersionRef.current = ""; // t391 — another run's answer is never "unchanged"
      const seed = readLogSeed(job.id);
      if (seed) {
        commitLog(seed.text);
        setTotalLines(seed.totalLines);
      }
    } else if (logRef.current == null) {
      const seed = readLogSeed(job.id);
      if (seed) {
        commitLog(seed.text);
        setTotalLines(seed.totalLines);
      }
    }
    setLogError(null);
    void fetchLog();
  }, [fetchLog, job.id, commitLog]);

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

  // Task 119: failure diagnosis — only a FAILED job diagnoses; a healthy
  // job's log mentioning "Killed" in passing must not summon the strip.
  // t323 — diagnoseFailureLines: the signature table first, then the
  // silent-death autopsy (a log that ends on a live progress frame with
  // zero signatures = an external kill, not "0 findings").
  const findings = React.useMemo(
    () => (job.status === "failed" ? diagnoseFailureLines(lines) : []),
    [job.status, lines]
  );

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
    /* data-log-console: print remap hook (globals.css Task 114) — the dark
       console re-inks to dark-on-white on paper */
    <div
      data-log-console=""
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 shadow-inner"
    >
      {/* toolbar is screen chrome (search, follow/wrap, mode) — .no-print
          keeps the paper report to the log text itself. Task 176: below
          sm the row WRAPS instead of overflowing (the Tail/Full/Follow
          cluster + search measured ~380px past a 269px dialog, clipped
          by the console's overflow-hidden — the follow state was
          unreachable on the fold band); ≥sm fits one line, wrap is
          invisible there. */}
      <div className="no-print flex flex-wrap shrink-0 items-center gap-2 border-b border-zinc-800 bg-zinc-900/80 px-3 py-1.5">
        <Terminal className="size-3.5 text-zinc-500" aria-hidden="true" />
        <span className="font-mono text-[11px] font-medium text-zinc-400">run.out</span>
        {running ? (
          <span className="ml-1 inline-flex items-center gap-1.5 rounded-full bg-danger-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-danger-400">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger-400 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-danger" />
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
                ? "bg-danger-500/15 text-danger-400"
                : "bg-warning/15 text-warning-400"
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
            className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-medium text-warning-400 transition-colors hover:bg-warning/25"
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
        {waitingHint ? (
          /* t347 — a pending answer's whisper: the console KEEPS its text,
             the toolbar says why the newest tick brought nothing */
          <span
            data-log-waiting=""
            title={waitingHint}
            className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning-400"
          >
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning-400 opacity-75" />
              <span className="relative inline-flex size-1.5 rounded-full bg-warning-500" />
            </span>
            syncing
          </span>
        ) : null}
        <div className="ml-auto flex max-sm:flex-wrap items-center gap-0.5">
          {/* log search / filter */}
          <div className="relative mr-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-zinc-600" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="filter…"
              aria-label="Filter log lines"
              className="h-7 w-28 rounded border border-zinc-700/80 bg-zinc-800/60 pl-6 pr-2 font-mono text-[11px] text-zinc-300 transition-all placeholder:text-zinc-600 focus:w-40 focus:border-running-500/50 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
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
                        ? "bg-running/20 text-running-300"
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
                  follow && "bg-zinc-800 text-running-300 hover:text-running-200"
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
                  wrap && "bg-zinc-800 text-running-300"
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

      {findings.length > 0 ? (
        /* Task 119: failure diagnosis — known failure signatures recognized
           in the log, each with provenance (line + excerpt) and a next
           step. A hint with provenance, not a verdict: the log above is
           the ground truth. Sits between toolbar and scroll area so it
           stays visible while the log scrolls beneath it. */
        <div
          data-log-diagnosis=""
          role="note"
          aria-label={`Failure diagnosis: ${findings.length} finding${findings.length === 1 ? "" : "s"}`}
          className="mx-3 mt-2 shrink-0 rounded-lg border border-danger-500/25 bg-danger/[0.06] p-3"
        >
          <div className="flex items-center gap-1.5">
            <Stethoscope className="size-3.5 shrink-0 text-danger-400" aria-hidden="true" />
            <span className="diag-head-label text-[11px] font-semibold uppercase tracking-wider text-danger-300">
              Failure diagnosis
            </span>
            <span className="diag-count rounded-full bg-danger-500/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-danger-300">
              {findings.length} {findings.length === 1 ? "finding" : "findings"}
            </span>
            <span className="diag-ml hidden truncate text-[10px] text-zinc-500 xl:inline">
              known failure signatures in run.out / run.err — the log is the ground truth
            </span>
          </div>
          {/* max-h + own scroll: five findings must not push the log out
              of view — the log is the ground truth and keeps its lane
              (paper unrolls the cap away, see globals Task 119 rules) */}
          <ul className="mt-2 max-h-52 space-y-1.5 overflow-y-auto pr-0.5">
            {findings.map((f) => {
              const Icon = FINDING_ICONS[f.id] ?? AlertTriangle;
              return (
                <li
                  key={f.id}
                  data-finding={f.id}
                  className="diag-finding rounded-md border border-danger-500/15 bg-zinc-950/50 p-2"
                >
                  <div className="flex items-center gap-1.5">
                    <Icon className="size-3.5 shrink-0 text-danger-400" aria-hidden="true" />
                    <span
                      className="diag-label truncate text-[11px] font-semibold text-danger-200"
                      title={f.label}
                    >
                      {f.label}
                    </span>
                    <span
                      className="diag-linebadge ml-auto shrink-0 font-mono text-[10px] tabular-nums text-zinc-500"
                      title="First matching line in this log window"
                    >
                      L{f.firstLine}
                      {f.count > 1 ? ` · ×${f.count}` : ""}
                    </span>
                  </div>
                  <p
                    className="diag-excerpt mt-1 truncate font-mono text-[10px] leading-relaxed text-zinc-400"
                    title={f.excerpt}
                  >
                    {f.excerpt}
                  </p>
                  <p className="diag-hint mt-1 flex items-start gap-1 text-[10px] leading-relaxed text-zinc-500">
                    <Lightbulb className="mt-px size-3 shrink-0 text-warning-400/80" aria-hidden="true" />
                    <span>{f.hint}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

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
            <p className="text-xs font-medium text-zinc-400">
              {job.runRemote?.slurmState === "PENDING" && job.status === "running"
                ? "Queued on Slurm — nothing has run yet"
                : "No engine log"}
            </p>
            <p className="max-w-xs text-[11px] leading-relaxed">
              {job.runRemote?.slurmState === "PENDING" && job.status === "running"
                ? "This job is waiting for the scheduler (Slurm says PENDING). The log appears the moment the job starts on the compute node — the queue wait is not a failure."
                : "This job never wrote run.out to disk (engine-native or simulated jobs log nothing). Check the Overview tab for its result summary."}
            </p>
          </div>
        ) : log === null ? (
          <div className="flex h-full items-center justify-center gap-2 text-xs text-zinc-500">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {waitingHint ?? "Reading log…"}
          </div>
        ) : log.length === 0 ? (
          <p className="text-center text-zinc-600">
            {job.runRemote?.slurmState === "PENDING" && job.status === "running"
              ? "(queued on Slurm — the log appears once the job starts on the node)"
              : "(log empty — waiting for the engine to speak)"}
          </p>
        ) : (
          <>
            {/* t347 — an error is a SLIM BANNER above the text, never a
                replacement: the last content stays readable underneath
                while polling retries (the old branch hid it entirely) */}
            {logError ? (
              <p
                data-log-error-banner=""
                className="mb-2 flex items-center gap-1.5 rounded border border-warning/30 bg-warning/10 px-2 py-1 text-[10px] font-medium text-warning-400"
                role="status"
              >
                <AlertCircle className="size-3 shrink-0" aria-hidden="true" />
                {logError} — polling retries automatically
              </p>
            ) : null}
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
          </>
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
  // t322 — a slurm-queued remote run is a fourth honest word: the job is
  // submitted and alive, but the scheduler holds it — "Queued" on the
  // step, "—" instead of a 0% that claims compute
  const queued = isSlurmQueued(job);
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
    tone?: "bad" | "good" | "run" | "wait";
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
      label: running
        ? queued
          ? "Queued"
          : "Running"
        : finished
          ? job.status === "completed"
            ? "Completed"
            : "Failed"
          : "Pending",
      value: running ? (queued ? "—" : `${Math.round(job.progress)}%`) : finished ? fmtDuration(duration) : "—",
      sub:
        running && duration > 0
          ? formatElapsed(duration) + (queued ? " in queue" : " elapsed")
          : finished
            ? "wall time"
            : "",
      done: finished,
      live: running,
      tone: queued ? "wait" : job.status === "failed" ? "bad" : job.status === "completed" ? "good" : "run",
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
            running ? "bg-gradient-to-r from-running-500 to-running-400" : finished ? "bg-success-500" : "bg-transparent"
          )}
          style={{ width: finished ? "100%" : running ? `${Math.max(4, job.progress)}%` : "0%" }}
        />
      </div>
      {steps.map((s) => {
        const Icon = s.icon;
        return (
          <li key={s.label} data-print-atomic="" className="relative z-10 flex flex-col items-center gap-1.5 text-center">
            <span
              className={cn(
                "flex size-10 items-center justify-center rounded-full border-2 bg-card shadow-sm",
                s.done
                  ? s.tone === "bad"
                    ? "border-danger text-danger-600"
                    : s.tone === "good"
                      ? "border-success-500 text-success-600"
                      : s.tone === "wait"
                        ? "border-warning-500 text-warning-600"
                        : "border-running-500 text-running-600"
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

/* t718 — the journal spine: what happened BETWEEN the three dots.       */
/* The strip above answers "where is this job NOW?" in milestones; this  */
/* answers "what happened along the way?" in events — the rename, the    */
/* knob-turns, the note, the dispatch, the engine's own starts and       */
/* landings. A note is what the user CONCLUDED; the journal is what      */
/* HAPPENED. Events come from lib/job-journal.ts (browser-local, capped, */
/* coalesced); the birth and the first start are SYNTHETIC anchors read  */
/* from the job row itself — the row already remembers them, so no hook  */
/* needed for full birth coverage (templates, duplicates and imports     */
/* all land here without a single extra record call). The store's jobs   */
/* slice is the change bus: every recording hook lands through a store   */
/* update, so this re-read on render is always current.                  */
/* kind → { icon, verb, tone } lives in journal-kind-face.ts — the       */
/* SINGLE source shared with the dashboard's journal digest (Task 720);  */
/* a vocabulary two faces speak must live in neither of them.            */
const JOURNAL_CAP = 7;

function JobJournal({ job }: { job: JobDTO }) {
  const [showAll, setShowAll] = React.useState(false);
  const events = readJobJournal(job.id); // a sync read of one small array — cheaper than a second subscription

  interface SpineRow {
    at: number;
    icon: React.ElementType;
    verb: string;
    detail?: string;
    tone?: "bad" | "good";
  }

  const startedMs = job.startedAt ? new Date(job.startedAt).getTime() : null;
  const createdMs = job.createdAt ? new Date(job.createdAt).getTime() : null;
  const spine: SpineRow[] = [
    ...events.map((e) => {
      const face = JOURNAL_KIND_FACE[e.kind];
      return { at: e.at, icon: face.icon, verb: face.verb, detail: e.detail, tone: face.tone };
    }),
    // the synthetic anchors — the row's own memory of its birth and its
    // first start; they sit in the sort like any other fact
    ...(startedMs != null ? [{ at: startedMs, icon: Play, verb: "Started" as const }] : []),
    ...(createdMs != null ? [{ at: createdMs, icon: Database, verb: "Created" as const }] : []),
  ].sort((a, b) => b.at - a.at);

  const shown = showAll ? spine : spine.slice(0, JOURNAL_CAP);
  const hidden = spine.length - shown.length;

  return (
    <div className="mt-3 border-t pt-3" data-testid="job-journal">
      {events.length === 0 ? (
        <p className="mb-1.5 text-[10.5px] text-muted-foreground" data-testid="job-journal-empty">
          The journal records what happens here — edits, notes and runs appear as they happen
          (history begins when this browser first saw the job).
        </p>
      ) : null}
      <ol className="ml-2 flex flex-col border-l border-muted pl-3.5">
        {shown.map((row, i) => {
          const Icon = row.icon;
          return (
            <li
              key={`${row.at}-${row.verb}-${i}`}
              data-testid="job-journal-row"
              className="relative flex min-w-0 items-baseline gap-2 py-1"
            >
              <span
                aria-hidden="true"
                className="absolute -left-[21px] top-1/2 flex size-4 -translate-y-1/2 items-center justify-center rounded-full border bg-card"
              >
                <Icon
                  className={cn(
                    "size-2.5",
                    row.tone === "bad" ? "text-danger" : row.tone === "good" ? "text-success-600" : "text-muted-foreground"
                  )}
                />
              </span>
              <span className="shrink-0 text-[11px] font-medium text-foreground/85">{row.verb}</span>
              {row.detail ? (
                <span className="min-w-0 truncate text-[11px] text-muted-foreground" title={row.detail}>
                  {row.detail}
                </span>
              ) : null}
              <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground">
                {fmtAgo(row.at)}
              </span>
            </li>
          );
        })}
        {hidden > 0 ? (
          <li>
            <button
              type="button"
              data-testid="job-journal-expand"
              onClick={() => setShowAll(true)}
              className="mt-0.5 text-[10.5px] text-muted-foreground transition-colors motion-reduce:transition-none hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              +{hidden} earlier event{hidden === 1 ? "" : "s"}
            </button>
          </li>
        ) : null}
      </ol>
    </div>
  );
}

function ResultSummary({
  job,
  diagnosis,
  onOpenDiagnosis,
}: {
  job: JobDTO;
  /** Task 120: full-log findings for the failed summary — the Overview leg
   *  of Task 119's diagnosis. Task 121 three states: null = not scanned yet
   *  or NO LOG (the card stays silent, honestly); [] = scanned the full log
   *  and no known signature matched (the negative teaser says so); non-empty
   *  = the classic teaser with count + chips. */
  diagnosis?: LogFinding[] | null;
  onOpenDiagnosis?: () => void;
}) {
  // t322 — the queue wait is NOT "Refinement in progress": the scheduler
  // holds the job (PENDING, usually on an afterok dependency). The amber
  // dialect + the upstream ids say what is actually happening.
  if (isSlurmQueued(job)) {
    const deps = job.runRemote?.slurmDependsOn ?? [];
    return (
      <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3.5" data-print-atomic="">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning-600">
          <Clock className="size-4.5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Waiting in the Slurm queue</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {deps.length
              ? `Slurm job ${job.runRemote?.slurmId ?? "?"} is held until ${deps.join(
                  ", "
                )} lands — it starts the moment the upstream completes.`
              : `Slurm job ${job.runRemote?.slurmId ?? "?"} is queued — the scheduler starts it when resources free up.`}
          </p>
        </div>
      </div>
    );
  }
  if (job.status === "running") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-running/30 bg-running/5 p-3.5" data-print-atomic="">
        <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-running/15 text-running-600">
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
      <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-3.5" data-print-atomic="">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning-600">
          <Clock className="size-4.5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Waiting as pending</p>
          <p className="mt-0.5 break-words text-xs leading-relaxed text-warning-700 dark:text-warning-300">
            {job.result ?? "Waiting for an upstream job to produce its outputs."}
          </p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            The job did not fail — it starts AUTOMATICALLY the moment its
            upstream inputs are ready. No further clicks needed.
          </p>
        </div>
      </div>
    );
  }
  if (job.status === "failed") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-danger-600/30 bg-danger-600/5 p-3.5" data-print-atomic="">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-danger-600/15 text-danger">
          <AlertTriangle className="size-4.5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Job failed</p>
          <p className="mt-0.5 break-words text-xs leading-relaxed text-danger">
            {job.result ?? "The engine exited with an error — see the Log tab for details."}
          </p>
          {diagnosis && diagnosis.length > 0 ? (
            /* Task 120: the Overview leg of the failure diagnosis — the strip
               lives in the Log console, which unmounts with its tab, so the
               failed summary carries the verdict here: count + one chip per
               signature (hint on hover), one click to the evidence. The teaser
               counts the WHOLE run.out (one ?full=1 fetch — the log is static
               once failed); the jump lands the console in Full mode so the
               strip's count agrees on arrival. A hint with provenance, not a
               verdict: the log stays the ground truth. */
            <div
              data-overview-diagnosis=""
              role="note"
              aria-label={`Failure diagnosis: ${diagnosis.length} finding${diagnosis.length === 1 ? "" : "s"} in the full log`}
              className="mt-2.5 rounded-lg border border-danger-500/20 bg-danger/[0.05] p-2.5"
            >
              <div className="flex items-center gap-1.5">
                <Stethoscope className="size-3.5 shrink-0 text-danger" aria-hidden="true" />
                <span className="ovd-head-label text-[11px] font-semibold uppercase tracking-wider text-danger">
                  Failure diagnosis
                </span>
                <span className="ovd-count rounded-full bg-danger-500/15 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-danger">
                  {diagnosis.length} {diagnosis.length === 1 ? "finding" : "findings"}
                </span>
                <span className="ovd-note hidden min-w-0 truncate text-[10px] text-muted-foreground sm:inline">
                  across the full run.out — the log is the ground truth
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {diagnosis.map((f) => {
                  const Icon = FINDING_ICONS[f.id] ?? AlertTriangle;
                  return (
                    <span
                      key={f.id}
                      data-ovd-chip={f.id}
                      title={f.hint}
                      className="inline-flex max-w-full items-center gap-1 rounded-full border border-danger-500/20 bg-zinc-950/[0.03] py-0.5 pl-1.5 pr-2 dark:bg-zinc-950/40"
                    >
                      <Icon className="size-3 shrink-0 text-danger" aria-hidden="true" />
                      <span className="ovd-chip-label min-w-0 truncate text-[10.5px] font-medium text-danger-700 dark:text-danger-200">
                        {f.label}
                      </span>
                      {f.count > 1 ? (
                        <span className="ovd-chip-count shrink-0 font-mono text-[9.5px] tabular-nums text-muted-foreground">
                          ×{f.count}
                        </span>
                      ) : null}
                    </span>
                  );
                })}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onOpenDiagnosis}
                className="mt-2 h-6 gap-1.5 border-danger-500/30 px-2 text-[10.5px] text-danger-600 hover:bg-danger-500/10 hover:text-danger-700 dark:text-danger-300 dark:hover:text-danger-200"
              >
                <ArrowRight className="size-3" aria-hidden="true" />
                Open the full diagnosis
              </Button>
            </div>
          ) : null}
          {diagnosis && diagnosis.length === 0 ? (
            /* Task 121: the negative leg — the diagnosis RAN on the full log
               and no known signature matched. Silence here would leave the
               user guessing whether the diagnosis exists at all; this card
               says "we looked, nothing known, the cause is custom". Calm
               zinc, not rose: "nothing found" is information, not alarm.
               The jump lands Full mode where the strip is absent by design
               (findings.length > 0 gate) — the log itself is the answer. */
            <div
              data-overview-diagnosis=""
              data-ovd-negative=""
              role="note"
              aria-label="No known failure signature matched the full log"
              className="mt-2.5 rounded-lg border border-zinc-500/25 bg-zinc-500/[0.04] p-2.5"
            >
              <div className="flex items-center gap-1.5">
                <SearchX className="size-3.5 shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
                <span className="ovd-head-label text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Failure diagnosis
                </span>
                <span className="ovd-count rounded-full bg-zinc-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
                  0 findings
                </span>
                <span className="ovd-note hidden min-w-0 truncate text-[10px] text-muted-foreground sm:inline">
                  scanned the full run.out — no loose matching, no crying wolf
                </span>
              </div>
              <p className="ovd-negative-note mt-1.5 text-[10.5px] leading-relaxed text-muted-foreground">
                No known failure signature matched the full log — the cause is
                custom to this job. The log is the ground truth: read it end to end.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onOpenDiagnosis}
                className="mt-2 h-6 gap-1.5 border-zinc-500/30 px-2 text-[10.5px] text-zinc-600 hover:bg-zinc-500/10 hover:text-zinc-700 dark:text-zinc-300 dark:hover:text-zinc-200"
              >
                <ArrowRight className="size-3" aria-hidden="true" />
                Read the full log
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/5 p-3.5" data-print-atomic="">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success/15 text-success-600">
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

/**
 * t386 — the COMPLETE parameter view for a submitted job. The old grid
 * rendered only the params the row happened to STORE, flat and unlabeled by
 * group; a submitted run deserves its whole effective configuration — every
 * param of the type's spec (curated + RELION's own option table merged in),
 * value = the stored value with the spec default filling any gap, grouped by
 * RELION's own GUI tab, RELION's Yes/No convention for booleans, and a subtle
 * amber dot on values that differ from the CURRENT default (an honest
 * "this run did not start from what a fresh job would start from" — old rows
 * show dots where the defaults have since moved, which is exactly the story).
 *
 * Stored keys the spec no longer owns (pre-t386 raw RELION keys like do_grad,
 * gallery class selections) render in a trailing "Additional" group, labeled
 * from RELION's own option table when it knows the key.
 */
/** total settings the complete view will show: spec params + legacy extras */
function paramSettingsCount(job: JobDTO): number {
  const spec = jobType(job.type);
  const specParams = spec?.params ?? [];
  const specKeys = new Set(specParams.map((p) => p.key));
  const legacyN = Object.keys(job.params ?? {}).filter((k) => !specKeys.has(k)).length;
  return specParams.length + legacyN;
}

function relionOptionLabel(type: string, key: string): string {
  const label = RELION_OPTIONS[type]?.options[key]?.label;
  return label ? label.replace(/[?:*\s]+$/, "").trim() : key;
}

function displayParamValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value == null) return "—";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  const s = String(value);
  return s === "" ? "—" : s;
}

interface ParamRow {
  key: string;
  label: string;
  value: unknown;
  unit?: string;
  advanced?: boolean;
  differs: boolean;
}

/** t729 — the param filter exists only when the grid has something to
 *  filter: below this many rows the whole grid fits on one screen and a
 *  filter box would be chrome, not capability (the shelf's threshold
 *  law, tuned for the grid's density). */
const PARAM_FILTER_THRESHOLD = 8;

/** t729 — why does this row answer the filter? The sixth search face's
 *  ladder, mirroring the palette's reading order exactly: all substring
 *  rungs first (label — what's visible on the row — then the option
 *  key), then the guarded in-order abbreviation rungs in the same
 *  order. Labels and keys are NAMES (option names, human labels) —
 *  never prose — so the abbreviation rung reads them both; there is no
 *  prose field on a grid row (the hover title is not a search field).
 *  A row lights for ONE reason: the first rung that hits wins, and the
 *  why's field decides the face — label hits wash their characters,
 *  key hits wear the chip (the key is not on the face). */
type ParamFilterWhy =
  | { field: "label"; spans: ReadonlyArray<readonly [number, number]> }
  | { field: "key" };

function paramFilterWhy(
  row: { key: string; label: string },
  q: string,
): ParamFilterWhy | null {
  if (!q) return null;
  const labelAt = row.label.toLowerCase().indexOf(q);
  if (labelAt !== -1) return { field: "label", spans: [[labelAt, labelAt + q.length]] };
  if (row.key.toLowerCase().includes(q)) return { field: "key" };
  if (q.length >= 2) {
    const labelSeq = subsequenceSpans(q, row.label);
    if (labelSeq) return { field: "label", spans: labelSeq };
    if (subsequenceSpans(q, row.key)) return { field: "key" };
  }
  return null;
}

function ParamRowLine({
  row,
  whyHit,
  whyTitle,
  filterWhy,
}: {
  row: ParamRow;
  whyHit?: boolean;
  whyTitle?: string;
  filterWhy?: ParamFilterWhy;
}) {
  const display = displayParamValue(row.value);
  return (
    <div
      key={row.key}
      data-print-atomic=""
      data-param-why-hit={whyHit || undefined}
      className={cn(
        "flex min-w-0 items-baseline justify-between gap-3 border-b border-dashed border-border/40 pb-1.5 last:border-0 last:pb-0",
        // t728 — the hit row wears the lens's quiet whisper
        // (border-amber-500/40 bg-amber-500/5, the class-gallery token
        // family — the find lens's amber at whisper volume, never a
        // second color language). Horizontal padding rides negative
        // margins so the tint breathes without shifting the grid's
        // rhythm. State, not arrival: no transition, no animation —
        // motion-reduce is safe by construction.
        whyHit && "rounded-md bg-amber-500/5 px-1.5 -mx-1.5",
      )}
      title={whyHit ? whyTitle : undefined}
    >
      <span
        className={cn(
          "line-clamp-2 max-w-[55%] shrink-0 text-[11px] leading-snug text-muted-foreground",
          row.advanced && "italic"
        )}
        title={`${row.label}${row.advanced ? " (expert option)" : ""}`}
      >
        {/* t729 — the filter's why rides the reading order: a label hit
            washes its characters (the same FindMarkedText the palette,
            shelf and card faces wear); a key hit renders the chip (the
            key is NOT on this row's face — chip-is-the-why, palette's
            fourth-face geometry). The value cell is never filter-washed:
            the filter matches label/key, and t728's value wash answers a
            different question (the find lens's). Two whys, two homes. */}
        {filterWhy && filterWhy.field === "label" ? (
          <FindMarkedText text={row.label} spans={filterWhy.spans} />
        ) : (
          row.label
        )}
      </span>
      {filterWhy && filterWhy.field === "key" ? (
        <span
          className={cn("shrink-0 px-1 text-[9px] leading-4", FIND_MARK_CLASS)}
          title={`Matched the parameter key "${row.key}"`}
          data-param-filter-why="key"
        >
          key
        </span>
      ) : null}
      <span className="flex min-w-0 items-baseline justify-end gap-1.5">
        {row.differs ? (
          <span
            className="size-1.5 shrink-0 translate-y-[-1px] rounded-full bg-warning-500"
            title="differs from the current default for this job type"
            aria-label="differs from the current default"
          />
        ) : null}
        <span
          className={cn(
            "truncate font-mono text-[11px] tabular-nums",
            row.differs ? "font-semibold text-foreground" : "text-foreground/80"
          )}
          title={display}
        >
          {/* t728 — the value cell IS the hit's home: when the find
              lens's param rung won on this row, the whole displayed
              value washes amber (the same FIND_MARK_CLASS the card's
              text wears). The wash covers the cell, not characters —
              the matcher matched the raw stored value whole; the
              display may format it (true → "Yes"), and washing the
              formatted cell is the honest row-level claim. */}
          <FindMarkedText
            text={display}
            spans={whyHit ? [[0, display.length]] : []}
          />
        </span>
        {row.unit ? (
          <span className="shrink-0 text-[10px] text-muted-foreground">{row.unit}</span>
        ) : null}
      </span>
    </div>
  );
}

/* Task 713 — user parameter presets row.
 *
 * The inspector face of the user-preset family (lib/user-param-presets.ts):
 * SAVE the current job's full spec-key snapshot under a name, WEAR a saved
 * snapshot on this job (one merge PATCH — spec keys replaced, legacy keys
 * untouched), DELETE what outlived its usefulness. The curated face
 * (JOB_PRESETS, command palette "Add with preset") hands a new job its
 * starting params; this face is the user's own memory — "the combination
 * that finally separated the classes".
 *
 * Detail laws inherited from the family:
 *  - the 1–60 name law mirrors renameJob's server contract, so honest
 *    typing never sees the 400;
 *  - apply runs through the store's single write well (updateJobParams),
 *    optimistic with the surgical rollback — never a second PATCH path;
 *  - the confirm dialog counts what will MOVE (countEffectiveDiffs speaks
 *    effective values — stored-else-default — not raw stored rows), so the
 *    click lands without surprise;
 *  - feedback is INLINE (the inspector's own law: a toast disappears, a
 *    line under the controls waits for you); failures still toast from
 *    the store action — the two voices never duplicate one cause.
 */
function ParamPresetsRow({ job }: { job: JobDTO }) {
  const spec = jobType(job.type);
  const updateJobParams = useWorkflowStore((s) => s.updateJobParams);
  const [presets, setPresets] = React.useState<UserParamPreset[]>([]);
  const [saveOpen, setSaveOpen] = React.useState(false);
  const [applyTarget, setApplyTarget] = React.useState<UserParamPreset | null>(null);
  const [name, setName] = React.useState("");
  const [flash, setFlash] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const refresh = React.useCallback(() => setPresets(loadUserParamPresets()), []);
  React.useEffect(() => {
    refresh();
    // t715 — adopt the server shelf (fire-and-forget): a snapshot saved on
    // another browser lands here via the changed event the reconcile
    // dispatches; offline it shrugs and the local list answers.
    void reconcileUserParamPresets();
    window.addEventListener(USER_PARAM_PRESETS_EVENT, refresh);
    return () => window.removeEventListener(USER_PARAM_PRESETS_EVENT, refresh);
  }, [refresh]);

  const specParams = spec?.params ?? [];
  const stored = (job.params ?? {}) as Record<string, unknown>;
  const mine = presetsForType(presets, job.type);
  const typeLabel = spec?.label ?? job.type;

  if (specParams.length === 0) return null;

  const doSave = () => {
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 60) return;
    const snap = snapshotSpecParams(specParams, stored);
    addUserParamPreset(job.type, trimmed, snap);
    setName("");
    setSaveOpen(false);
    setFlash(
      `Saved “${trimmed}” — a full snapshot of ${Object.keys(snap).length} params, wearable on any ${typeLabel} job.`
    );
  };

  const doApply = async (p: UserParamPreset) => {
    // diffs speak BEFORE the wire moves anything — stored is still the
    // pre-apply map here, exactly what the confirm dialog counted
    const moved = countEffectiveDiffs(p, specParams, stored);
    setApplyTarget(null);
    setBusy(true);
    const ok = await updateJobParams(job.id, p.params);
    setBusy(false);
    if (ok) {
      setFlash(
        `Applied “${p.name}” — ${Object.keys(p.params).length} params set, ${moved} moved from their previous values.`
      );
    }
    // a refusal already toasted from the store action — silence here is
    // the two-voices rule, not an omission
  };

  return (
    <div
      data-print-atomic=""
      className="insp-card-whisper rounded-xl border bg-card px-4 py-3"
      data-testid="inspector-param-presets"
    >
      <div className="flex flex-wrap items-center gap-2">
        <BookmarkPlus className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="text-xs font-semibold">Parameter presets</span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {mine.length} for {typeLabel}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 px-2.5 text-xs"
            onClick={() => {
              setName("");
              setFlash(null);
              setSaveOpen(true);
            }}
            data-testid="preset-save-open"
          >
            <BookmarkPlus className="size-3.5" aria-hidden="true" />
            Save current…
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 px-2.5 text-xs"
                disabled={busy}
                data-testid="preset-apply-menu"
              >
                <SlidersHorizontal className="size-3.5" aria-hidden="true" />
                Apply preset
                <ChevronDown className="size-3" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="text-[11px]">Wear a saved parameter set</DropdownMenuLabel>
              {mine.length === 0 ? (
                <div className="px-2 py-3 text-[11px] leading-relaxed text-muted-foreground">
                  No presets for {typeLabel} yet — tune a job's params, then save the combination here.
                </div>
              ) : (
                <>
                  {mine.map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      className="gap-2"
                      onSelect={() => {
                        setFlash(null);
                        setApplyTarget(p);
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate text-xs font-medium">{p.name}</span>
                      <span
                        className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground"
                        title={`${Object.keys(p.params).length} params in this snapshot`}
                      >
                        {Object.keys(p.params).length}p
                      </span>
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  {mine.map((p) => (
                    <DropdownMenuItem
                      key={`del-${p.id}`}
                      className="gap-2 text-danger focus:text-danger"
                      onSelect={() => {
                        deleteUserParamPreset(p.id);
                        setFlash(`Deleted “${p.name}”.`);
                      }}
                    >
                      <Trash className="size-3" aria-hidden="true" />
                      <span className="truncate text-xs">Delete “{p.name}”</span>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {flash && (
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground" role="status" data-testid="preset-flash">
          {flash}
        </p>
      )}

      {/* the naming dialog — the 1–60 law lives in the disable, not in a
          late error; Enter saves like the note textarea does */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-sm" data-testid="preset-save-dialog">
          <DialogHeader>
            <DialogTitle className="text-sm">Save current params as preset</DialogTitle>
            <DialogDescription className="text-xs">
              A full snapshot of this job's {specParams.length} {specParams.length === 1 ? "param" : "params"} for{" "}
              {typeLabel} — wear it on any sibling job later, whatever its current knobs say.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) doSave();
            }}
            placeholder="e.g. My standard pass"
            maxLength={60}
            aria-label="Preset name"
            autoFocus
            data-testid="preset-name-input"
          />
          <p className="text-[10px] text-muted-foreground">
            1–60 characters · stored in this browser (localStorage)
          </p>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                Cancel
              </Button>
            </DialogClose>
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={!name.trim() || name.trim().length > 60}
              onClick={doSave}
              data-testid="preset-save-confirm"
            >
              Save preset
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* the wear-confirm — the move count is the whole point: an apply
          that changes nothing deserves a glance, one that moves 14 knobs
          deserves a deliberate click */}
      <AlertDialog open={applyTarget !== null} onOpenChange={(o) => !o && setApplyTarget(null)}>
        <AlertDialogContent data-testid="preset-apply-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Apply “{applyTarget?.name}”?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {applyTarget && (
                <>
                  Sets all {Object.keys(applyTarget.params).length} params of this snapshot —{" "}
                  <span className="font-semibold text-foreground">
                    {countEffectiveDiffs(applyTarget, specParams, stored)}
                  </span>{" "}
                  will move from their current values. Legacy keys (gallery picks, engine flags) stay untouched.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-7 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="h-7 text-xs"
              onClick={() => applyTarget && void doApply(applyTarget)}
              data-testid="preset-apply-confirm"
            >
              Apply
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ParamsGrid({ job }: { job: JobDTO }) {
  const spec = jobType(job.type);
  const stored = (job.params ?? {}) as Record<string, unknown>;
  const specParams = spec?.params ?? [];
  const specKeys = new Set(specParams.map((p) => p.key));

  // t729 — the sixth search face: the grid filters its own rows. The
  // filter state is EPHEMERAL (inspector-local useState — a persisted
  // filter could boot a dead grid, the class-gallery law); the HOW is
  // lib's subsequenceSpans (the one matcher family), the WHAT is the
  // row's two name fields (label + option key — names, never prose).
  // This filter answers "which setting is it?" INSIDE one job — a
  // different radius from t722's global `key:value` (which job ever ran
  // this value?) and from t728's find-lens wash (which row did MY query
  // hit?): three questions, three faces, one matcher family.
  const [paramFilter, setParamFilter] = React.useState("");
  const fq = paramFilter.trim().toLowerCase();

  // t728 — the param why's last mile. t722's match why left spans empty
  // BY DESIGN: "the value lives in the params grid, the card face has no
  // words to wash." This grid is that home — when the canvas find lens
  // holds a param dialect query and THIS job is genuinely inside the
  // lens (the FULL gate, chips included — the same jobMatchesFind the
  // canvas's matched-set memo runs, so the row can never claim a match
  // the card does not ring), the winning row shows itself here: quiet
  // amber whisper + the value cell washed. Zero new storage: the lens
  // state rides the store the find bar already owns (and closeFind
  // clears the query, so a closed bar is an empty lens — the findOpen
  // gate mirrors canvas's own line-for-line). Text queries are out of
  // scope here: their why already washes the card's name/label; a
  // second wash in the grid would be a second answer to the same
  // question. The param why is different — its why badge points at the
  // dialect, but the VALUE's row had no marker anywhere until now.
  const findOpen = useWorkflowStore((s) => s.findOpen);
  const findQuery = useWorkflowStore((s) => s.findQuery);
  const findStatus = useWorkflowStore((s) => s.findStatus);
  const findCategory = useWorkflowStore((s) => s.findCategory);
  const paramWhy = React.useMemo(() => {
    if (!findOpen || !findQuery.trim()) return null;
    if (!jobMatchesFind(job, findQuery, findStatus, findCategory)) return null;
    const why = jobMatchWhy(job, findQuery);
    return why && why.source === "param" ? why : null;
  }, [job, findOpen, findQuery, findStatus, findCategory]);
  const whyKey = paramWhy?.key ?? null;
  const whyTitle = paramWhy
    ? `Matched your find query “${findQuery.trim()}” — key matches by substring, value equals exactly (the find bar's badge tells the same story)`
    : undefined;

  const groups: { tab: string; rows: ParamRow[] }[] = [];
  for (const tab of tabsFor(spec)) {
    const rows: ParamRow[] = [];
    for (const p of specParams) {
      if ((p.tab ?? "") !== tab) continue;
      const raw = stored[p.key];
      const present = raw !== undefined && raw !== null;
      rows.push({
        key: p.key,
        label: p.label,
        value: present ? raw : p.default,
        unit: p.unit,
        advanced: p.advanced,
        differs: present && String(raw) !== String(p.default),
      });
    }
    if (rows.length > 0) groups.push({ tab, rows });
  }

  // stored keys the spec no longer owns — legacy raw RELION keys (pre-t386
  // rows), gallery class selections, engine flags: still part of THIS run's
  // configuration, so still part of the complete view
  const legacyKeys = Object.keys(stored).filter((k) => !specKeys.has(k));
  if (legacyKeys.length > 0) {
    groups.push({
      tab: "Additional",
      rows: legacyKeys.map((k) => ({
        key: k,
        label: relionOptionLabel(job.type, k),
        value: stored[k],
        differs: false,
      })),
    });
  }

  const total = groups.reduce((n, g) => n + g.rows.length, 0);
  if (total === 0) return null;

  // t729 — filter before render: rows that miss the filter drop out,
  // and a tab whose rows ALL miss drops out with them (an empty group
  // header would claim params it does not show). The why ledger is
  // per-render (t616's non-persistent ledger — it lives exactly as
  // long as this render), and the count chip below is the predicate's
  // product (t627 honesty): the Section hint above stays "complete ·
  // N settings" (the capacity truth), the chip says "k of N" (the
  // current view's truth) — two numbers, each honest at its own radius.
  const filterWhys = new Map<string, ParamFilterWhy>();
  const visibleGroups = fq
    ? groups
        .map((g) => ({
          tab: g.tab,
          rows: g.rows.filter((r) => {
            const why = paramFilterWhy(r, fq);
            if (why) filterWhys.set(r.key, why);
            return why !== null;
          }),
        }))
        .filter((g) => g.rows.length > 0)
    : groups;
  const visibleTotal = fq
    ? visibleGroups.reduce((n, g) => n + g.rows.length, 0)
    : total;

  return (
    <div className="space-y-4">
      {total >= PARAM_FILTER_THRESHOLD ? (
        <div className="no-print relative">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={paramFilter}
            onChange={(e) => setParamFilter(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setParamFilter("");
            }}
            placeholder="Filter parameters by label or key…"
            aria-label="Filter parameters by label or option key"
            title="Substring first, then in-order abbreviations — matched characters highlight"
            className="h-7 pl-7 pr-16 text-[11px]"
            data-testid="inspector-param-filter"
          />
          {fq ? (
            <span
              className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1 text-[9px] tabular-nums text-muted-foreground"
              data-testid="inspector-param-filter-count"
            >
              {visibleTotal} of {total}
              <button
                type="button"
                onClick={() => setParamFilter("")}
                aria-label="Clear parameter filter"
                className="rounded-sm p-px hover:bg-muted"
                data-testid="inspector-param-filter-clear"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </span>
          ) : null}
        </div>
      ) : null}
      {fq && visibleTotal === 0 ? (
        <p
          className="rounded-lg border border-dashed bg-muted/20 px-3 py-2.5 text-[11px] leading-snug text-muted-foreground"
          data-testid="inspector-params-no-match"
        >
          No parameters match “{paramFilter.trim()}” — press Escape or click the × to clear the
          filter. Abbreviations work too — any in-order characters of a label or option key match.
        </p>
      ) : (
        visibleGroups.map((g) => (
          <div
            key={g.tab}
            data-print-atomic=""
            className="insp-card-whisper overflow-hidden rounded-xl border bg-card"
            data-testid={`inspector-params-${g.tab}`}
          >
            <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/70">
                {g.tab}
              </span>
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {g.rows.length} {g.rows.length === 1 ? "param" : "params"}
              </span>
            </div>
            <div className="grid gap-x-8 gap-y-2 px-4 py-3.5 sm:grid-cols-2">
              {g.rows.map((row) => (
                <ParamRowLine
                  key={row.key}
                  row={row}
                  whyHit={whyKey === row.key}
                  whyTitle={whyTitle}
                  filterWhy={filterWhys.get(row.key)}
                />
              ))}
            </div>
          </div>
        ))
      )}
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
          data-print-atomic=""
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
    { kind: "mrc", label: "maps & images", icon: Layers, color: "text-running-600" },
    { kind: "star", label: "STAR tables", icon: Table2, color: "text-violet-600" },
    { kind: "text", label: "logs & text", icon: ScrollText, color: "text-warning-600" },
    { kind: "image", label: "plots", icon: BarChart3, color: "text-danger-600" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map(({ kind, label, icon: Icon, color }) => (
        <div key={kind} data-print-atomic="" className="insp-card-whisper flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5">
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
          <Icon className="size-3.5 text-running-600" aria-hidden="true" />
          {title}
        </h4>
        {hint ? <span className="text-[10px] text-muted-foreground">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Job note — the scientist's margin annotation                        */
/* ------------------------------------------------------------------ */

const NOTE_MAX = 500; // must mirror the PATCH route's cap

type NoteSaveState = "idle" | "dirty" | "saving" | "saved";

/**
 * Autosaving margin note ("this is the good 3D class — feed it to
 * refine3d"). Debounced 600 ms like a document editor, with flushes on
 * blur, on job switch and on unmount (the Esc-close path included) so a
 * fast typist never loses more than one debounce window of text.
 *
 * The switch-flush reads the pending draft from a per-job map keyed by
 * the job id THIS effect run owned — not from a live ref. React runs the
 * previous effect's cleanup AFTER the re-render that changed job.id, so
 * a naive ref would already hold the NEW job's id and the old draft
 * would land on the wrong job's note. The map makes the handshake
 * impossible to cross-wire.
 *
 * saveJob() is the single write path (same PATCH as drag-commit) and its
 * response backfills the store, so the server's normalization (trim,
 * ""→null) is what lands in state — the editor, the card badge and any
 * other reader can never drift apart. Save failures stay INLINE (rose
 * line under the field): a toast disappears, a form error waits for you.
 */
function JobNoteSection({ job }: { job: JobDTO }) {
  const saveJob = useWorkflowStore((s) => s.saveJob);
  const [draft, setDraft] = React.useState(job.note ?? "");
  const [state, setState] = React.useState<NoteSaveState>("idle");
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const timerRef = React.useRef<number | null>(null);
  /** latest draft per job id (see doc comment — switch-flush safety) */
  const draftsRef = React.useRef(new Map<string, string>());
  /** last value known to be on the server, per job id (flush dedupe) */
  const savedRef = React.useRef(new Map<string, string>());

  /** write the pending draft for `id` to the server (deduped, normalized) */
  const flushNote = React.useCallback(
    async (id: string) => {
      const raw = draftsRef.current.get(id);
      if (raw == null) return;
      const normalized = raw.trim().length > 0 ? raw.trim() : "";
      if (normalized === (savedRef.current.get(id) ?? "")) {
        setState((s) => (s === "dirty" ? "idle" : s));
        return;
      }
      setState("saving");
      setError(null);
      const res = await saveJob(id, { note: normalized }, { silent: true });
      if (res.ok) {
        savedRef.current.set(id, normalized);
        draftsRef.current.set(id, normalized);
        // snap the textarea to the server-normalized text — mid-typing
        // this never fires (flush only runs after the idle window or blur)
        setDraft(normalized);
        setState("saved");
        setSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      } else {
        // draft is kept — the user's text is not lost; the next keystroke
        // or blur retries. The message is inline, not a toast.
        setState("dirty");
        setError(res.error ?? "Could not save the note");
      }
    },
    [saveJob]
  );

  const scheduleFlush = React.useCallback(
    (id: string) => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void flushNote(id);
      }, 600);
    },
    [flushNote]
  );

  // adopt the new job's note; on switch/unmount flush THIS run's pending
  // draft under the id this run captured (never the incoming job's)
  React.useEffect(() => {
    const id = job.id;
    draftsRef.current.set(id, job.note ?? "");
    if (!savedRef.current.has(id)) savedRef.current.set(id, job.note ?? "");
    setDraft(job.note ?? "");
    setState("idle");
    setError(null);
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
      const raw = draftsRef.current.get(id);
      if (raw == null) return;
      const normalized = raw.trim().length > 0 ? raw.trim() : "";
      if (normalized === (savedRef.current.get(id) ?? "")) return;
      void saveJob(id, { note: normalized }, { silent: true });
    };
  }, [job.id]);

  const counterTone =
    draft.length >= NOTE_MAX
      ? "text-danger"
      : draft.length >= NOTE_MAX - 50
        ? "text-warning"
        : "text-muted-foreground";

  return (
    <Section
      icon={StickyNote}
      title="Note"
      hint={state === "idle" && draft.length === 0 ? "autosaves as you type" : undefined}
    >
      <div
        className="rounded-xl border bg-card p-4 space-y-2.5"
        data-note-editor=""
        data-note-state={state}
        data-print-atomic=""
      >
        <Textarea
          aria-label="Job note"
          value={draft}
          maxLength={NOTE_MAX}
          placeholder="Annotate this job — why it was run, which class is the good one, what to reuse downstream…"
          className="min-h-20 resize-y border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
          onChange={(e) => {
            const text = e.target.value;
            draftsRef.current.set(job.id, text);
            setDraft(text);
            setError(null);
            setState("dirty");
            scheduleFlush(job.id);
          }}
          onBlur={() => {
            if (state === "dirty") void flushNote(job.id);
          }}
        />
        <div className="flex items-center justify-between gap-3 border-t pt-2">
          <div className="flex min-w-0 items-center gap-2 text-[11px]">
            {state === "dirty" ? (
              <span className="flex items-center gap-1.5 text-warning">
                <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                Unsaved
              </span>
            ) : state === "saving" ? (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                Saving…
              </span>
            ) : state === "saved" && savedAt ? (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Check className="size-3 text-running" aria-hidden="true" />
                <span className="tabular-nums">Saved {savedAt}</span>
              </span>
            ) : (
              <span className="text-muted-foreground/70">Stored with the job, not the browser</span>
            )}
            {error ? (
              <span className="truncate text-danger" role="alert">
                {error} — retries on your next edit
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {draft.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                aria-label="Clear note"
                onClick={() => {
                  draftsRef.current.set(job.id, "");
                  setDraft("");
                  setState("dirty");
                  void flushNote(job.id);
                }}
              >
                <X className="size-3" aria-hidden="true" />
                Clear
              </Button>
            ) : null}
            <span className={`text-[11px] tabular-nums ${counterTone}`}>
              {draft.length}/{NOTE_MAX}
            </span>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* t347 — count strips (Overview leads with the numbers)               */
/* ------------------------------------------------------------------ */

/** tone → value color: the same grammar the Results strip speaks
 * (particles teal, micrographs neutral, classes violet). */
const COUNT_TONE_CLASS: Record<string, string> = {
  particle: "text-running-600 dark:text-running-300",
  micrograph: "text-foreground",
  class: "text-violet-600 dark:text-violet-300",
};

/**
 * The fallback count strip: when the outputs summary can't be counted live
 * (remote-only files, a lost run record), the receipt's own counted numbers
 * — written by the engine at finalize, honestly counted from the output
 * star — still lead the Overview. Same card grammar as KeyNumbersStrip.
 *
 * t609 — and the same arrival manner: the numbers ride the job DTO, so
 * this face mounts with its tab panel — the tab switch is the event, and
 * the tally walks its row exactly like the live-counted strip (24ms step,
 * the receipt's surfacing word). Radix's round-trip replays it honestly:
 * every arrival deserves the same manner.
 */
function ReceiptCountStrip({ counts }: { counts: ResultCounts }) {
  const stats: { key: string; value: string; label: string; tone: string }[] = [];
  if (counts.particles != null)
    stats.push({
      key: "particles",
      value: formatCountFull(counts.particles),
      label: "particles (run receipt)",
      tone: COUNT_TONE_CLASS.particle,
    });
  if (counts.micrographs != null)
    stats.push({
      key: "micrographs",
      value: formatCountFull(counts.micrographs),
      label: "micrographs (run receipt)",
      tone: COUNT_TONE_CLASS.micrograph,
    });
  if (counts.classes != null)
    stats.push({
      key: "classes",
      value: formatCountFull(counts.classes),
      label: "classes (run receipt)",
      tone: COUNT_TONE_CLASS.class,
    });
  if (stats.length === 0) return null;
  return (
    <section
      aria-label="Key numbers (run receipt)"
      data-key-numbers=""
      data-key-arrival=""
      data-receipt-counts=""
      data-print-keep=""
      className="flex flex-wrap gap-2"
    >
      {stats.map((s, i) => (
        <div
          key={s.key}
          data-stat={s.key}
          style={{ "--kd": `${i * 24}ms` } as React.CSSProperties}
          className="insp-card-whisper min-w-28 flex-1 rounded-lg border bg-card px-3 py-2.5"
        >
          <p className={cn("text-xl font-bold leading-tight tabular-nums", s.tone)}>{s.value}</p>
          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{s.label}</p>
        </div>
      ))}
    </section>
  );
}

function OverviewTab({
  job,
  data,
  onOpenFiles,
  diagnosis,
  onOpenDiagnosis,
}: {
  job: JobDTO;
  data: OutputsResponse | null;
  onOpenFiles: () => void;
  /** Task 120: full-log diagnosis for the failed summary card. Task 121
   *  three states: null (no log / not scanned) flows through untouched. */
  diagnosis?: LogFinding[] | null;
  onOpenDiagnosis?: () => void;
}) {
  // refining jobs get a live per-iteration resolution chart
  const isRefineType = /class2d|class3d|initialmodel|refine3d|multibody/i.test(job.type);
  const is3dType = /initialmodel|refine3d|class3d|multibody|postprocess/i.test(job.type);
  // orientation jobs (symmetry expansion / rebalancing) get the SAME angular
  // views — their single particles star feeds the polar + Mollweide panels
  const isOrientationType = /symexpand|rebalance/i.test(job.type);
  const isClassifyType = /class2d|class3d/i.test(job.type);
  const isCtfType = /ctffind|ctf/i.test(job.type);
  const isMotionType = /^motioncorr$/i.test(job.type);
  const hasIterated = (job.status === "running" || job.status === "completed" || job.status === "failed") &&
    (job.progress > 4 || job.status !== "running");
  // t347 — the receipt fallback: when the live outputs summary is null
  // (remote-only files, lost run record), the finalize-time counted numbers
  // in the result line still lead the Overview
  const receiptCounts = React.useMemo(
    () => (job.status === "completed" ? parseResultCounts(job.result) : null),
    [job.status, job.result]
  );
  return (
    <div className="space-y-6">
      {/* t347 — the counts LEAD (the user's 「照片数或颗粒数需要显示得
          醒目些」): the live-counted summary when the outputs route can
          count, the run receipt's own numbers otherwise. */}
      {data?.summary ? (
        <KeyNumbersStrip summary={data.summary} />
      ) : receiptCounts ? (
        <ReceiptCountStrip counts={receiptCounts} />
      ) : null}
      <ResultSummary job={job} diagnosis={diagnosis} onOpenDiagnosis={onOpenDiagnosis} />
      <JobNoteSection job={job} />
      {/* import jobs show the raw detector frames gallery (t315: the
          particles node type imports a STAR, not detector frames — the
          result line above already speaks its truth). */}
      {/^import$/i.test(job.type) && job.status !== "idle" &&
      String(job.params?.nodeType ?? "micrographs") !== "particles" ? (
        <ImportGallery jobId={job.id} />
      ) : null}
      {/* t658 — MotionCorr gets the corrected wall: the same gallery,
          pointed at the job's own corrected_micrographs.star. The frames
          the seeder (demo) or RELION (real) leave in the workdir are the
          motion-corrected micrographs — the first thing an operator
          eyeballs after alignment, before trusting the drift chart. */}
      {isMotionType && job.status !== "idle" ? (
        <ImportGallery jobId={job.id} variant="corrected" />
      ) : null}
      {/* manualpick + autopick jobs show the picked-particle overlay map
          (t427: autopick renders the FOM-colored QA variant). */}
      {/(manualpick|autopick)/i.test(job.type) && job.status !== "idle" ? (
        <PicksMap jobId={job.id} />
      ) : null}
      {/* t433 — and the picking QC BOARD right under it: the picks-map
          answers "what do the picks look like"; this answers "WHICH
          micrographs do I look at first" (empty / over-picked / timid
          FOM), the pack's own p75/p90 quantiles on the tiles. */}
      {/(manualpick|autopick)/i.test(job.type) && job.status !== "idle" ? (
        <MicrographQcBoard kind="picking" jobId={job.id} />
      ) : null}
      {/* extract/select/orientation jobs show the particle stack browser. */}
      {/^(extract|select|symexpand|rebalance)/i.test(job.type) && job.status !== "idle" ? (
        <ParticleBrowser jobId={job.id} />
      ) : null}
      {isRefineType && hasIterated ? (
        <ResolutionChart jobId={job.id} running={job.status === "running"} />
      ) : null}
      {/* 3D reconstructions get the FSC curve (gold-standard report card). */}
      {is3dType ? (
        <FscChart jobId={job.id} running={job.status === "running"} projectId={job.projectId} />
      ) : null}
      {/* postprocess jobs add the Guinier plot (B-factor validation). */}
      {/postprocess/i.test(job.type) ? (
        <GuinierChart jobId={job.id} running={job.status === "running"} />
      ) : null}
      {/* 3D jobs also get the orientation distribution polar heatmap
          (self-hides while the API has no data star to bin). */}
      {(is3dType || isOrientationType) && job.status !== "idle" ? (
        <AngularDistributionChart jobId={job.id} running={job.status === "running"} />
      ) : null}
      {/* …plus the cryoSPARC-style Mollweide orientation view (equal-area
          Fibonacci-sphere bins + rot/tilt marginals) — the same data, the
          cryoSPARC "Orientation distribution" look. Self-hides until the
          API has angles, mirrors the chart above. */}
      {(is3dType || isOrientationType) && job.status !== "idle" ? (
        <CryoSparcAnglePanel jobId={job.id} running={job.status === "running"} />
      ) : null}
      {/* the Orientation Rebalancer adds its before/after report (stats +
          per-bin trim chart from rebalance_report.json). */}
      {/rebalance/i.test(job.type) && job.status !== "idle" ? (
        <RebalanceReport jobId={job.id} />
      ) : null}
      {/* t544 — the class IMAGES: the t539 receipt said "1 of 4 classes
          populated" — this teaser makes the two numbers visible (populated
          bright, empty a ghost). Class2d speaks slices of the classes
          stack; class3d/initialmodel speak per-class volumes; the
          self-hide contract covers the rest. */}
      {/(class2d|class3d|initialmodel)/i.test(job.type) && job.status !== "idle" ? (
        <ClassAveragesTeaser jobId={job.id} running={job.status === "running"} />
      ) : null}
      {/* 2D/3D classification gets class occupancy bars. */}
      {isClassifyType && job.status !== "idle" ? (
        <ClassDistributionChart jobId={job.id} />
      ) : null}
      {/* CTF estimation gets a per-micrograph fit quality panel. */}
      {isCtfType && job.status !== "idle" ? (
        <CtfQualityChart jobId={job.id} />
      ) : null}
      {/* t432 — and the QC BOARD right under it: one tile per micrograph,
          colored by the pack's own p75/p90 quantiles, metric-switchable
          (worst fit / astigmatism / FOM). "Which micrographs do I exclude"
          wants a shortlist, not a scatter. */}
      {isCtfType && job.status !== "idle" ? (
        <MicrographQcBoard kind="ctf" jobId={job.id} />
      ) : null}
      {/* MotionCorr gets the per-micrograph accumulated-motion panel
          (stacked early/late bars, worst-first; self-hides until the job
          carries a corrected_micrographs.star catalogue). */}
      {isMotionType && job.status !== "idle" ? (
        <MotionDriftChart jobId={job.id} />
      ) : null}
      {/* t432 — motion board: the same tiles over accumulated drift, the
          early/late split always visible on each tile. */}
      {isMotionType && job.status !== "idle" ? (
        <MicrographQcBoard kind="motion" jobId={job.id} />
      ) : null}
      {/* Topaz training gets its per-epoch loss curve (self-hides until the
          run log carries recognizable topaz progress). */}
      {/^topaztrain$/i.test(job.type) && job.status !== "idle" ? (
        <TopazTrainingChart jobId={job.id} running={job.status === "running"} />
      ) : null}
      <Section icon={Activity} title="Timeline">
        <div data-print-atomic="" className="insp-card-whisper rounded-xl border bg-card p-5 pt-4">
          <Timeline job={job} />
          <JobJournal job={job} />
        </div>
      </Section>
      <Section
        icon={LayoutDashboard}
        title="Parameters"
        hint={`complete · ${paramSettingsCount(job)} settings`}
      >
        <ParamPresetsRow job={job} />
        <ParamsGrid job={job} />
      </Section>
      {/* Task 257 — the reference wears its face: class3d/refine3d show
          WHAT map they eat (identity card read from the provider's own
          outputs) and WHERE it came from. Self-hides without a --ref
          input (fixture jobs, particles-only previews). */}
      {/^(class3d|refine3d)$/i.test(job.type) ? (
        <ReferenceMapCard
          job={job}
          refPath={data?.inputs?.find((i) => i.flag === "--ref")?.path ?? null}
        />
      ) : null}
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
        <Section icon={Terminal} title="Command line" hint="recorded at launch">
          {/* data-log-console: the same dark-console print re-ink as the Log
              tab (globals.css Task 114) — zinc-300 mono on unprinted
              bg-zinc-950 would vanish on paper */}
          <div
            data-log-console=""
            data-print-atomic=""
            data-canvas-ui="command-recorded"
            className="flex items-start gap-2 rounded-lg border bg-zinc-950 p-3 dark:bg-zinc-900"
          >
            <pre className="m-0 min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[10.5px] leading-relaxed text-zinc-300">
              {data.cmd}
            </pre>
            <CopyButton text={data.cmd} />
          </div>
        </Section>
      ) : (
        <CommandPreviewSection job={job} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Command preview — the launch contract before the first launch        */
/* ------------------------------------------------------------------ */

/** Shape of GET /api/jobs/[id]/command — the tiers arrive as mutually
 *  exclusive fields (native | command | missing | error), with the
 *  template always riding along as the fallback contract. */
interface CommandPreviewResponse {
  native?: boolean;
  argv?: string[];
  command?: string;
  missing?: string;
  wait?: string;
  error?: string;
  template?: string | null;
}

/**
 * Task 170 — the command line before the run. A never-run job's inspector
 * used to render NOTHING where a run job shows its recorded argv: the most
 * common question an idle card begs ("what will launching this actually
 * run?") had no answer anywhere. Three honest tiers, best-truth-first:
 *
 *   1. INSTANT: the canonical template (client-safe constant — the same
 *      table buildArgv's shapes were extracted from) renders on the first
 *      frame with zero latency. Honest by construction: it cannot lie
 *      about paths because it shows placeholders.
 *   2. UPGRADED: the read-only preview route (/api/jobs/[id]/command)
 *      returns the REAL argv — same builder the launch and the sbatch
 *      dry-run use — and the block swaps the template for it once fetched.
 *   3. HONEST REFUSAL: missing/waiting inputs, RELION undetected or a
 *      builder error render the ENGINE's own actionable message (the same
 *      dialect a launch failure speaks) above the template console — the
 *      contract stays visible even when the instance cannot exist yet.
 *
 * Engine-native types (import/select/…) show the template's
 * "engine-native: …" description verbatim — there is no argv to render,
 * and pretending otherwise would be the dishonest kind of preview.
 */
function CommandPreviewSection({ job }: { job: JobDTO }) {
  const template =
    COMMAND_TEMPLATES[job.type] ??
    "engine-native: this job type carries no canonical template";
  const [preview, setPreview] = React.useState<CommandPreviewResponse | null>(null);

  React.useEffect(() => {
    const ctl = new AbortController();
    setPreview(null); // switching jobs resets the stale preview immediately
    fetch(`/api/jobs/${job.id}/command`, { signal: ctl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<CommandPreviewResponse>) : null))
      .then((d) => {
        if (!ctl.signal.aborted) setPreview(d);
      })
      .catch(() => {
        /* aborted or network hiccup — the template default stands */
      });
    return () => ctl.abort();
  }, [job.id]);

  // the best truth available right now: a fetched argv command upgrades
  // the template the moment it lands; until then the template IS the
  // honest answer (placeholders, not invented paths)
  const shown = preview?.command ?? template;
  const isRealArgv = preview?.command != null;
  const isNative = preview?.native === true;
  const blocker = preview?.missing ?? preview?.error ?? null;

  const hint = isRealArgv
    ? "preview — identical builder to the launch"
    : isNative
      ? "engine-native — no CLI argv"
      : preview === null
        ? "reading the launch contract…"
        : blocker
          ? "not launched yet — template below"
          : "not launched yet";

  return (
    <Section icon={Terminal} title="Command line" hint={hint}>
      {blocker ? (
        <p
          data-canvas-ui="command-blocker"
          className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-[11px] leading-relaxed text-warning-700 dark:text-warning-300"
        >
          {blocker}
        </p>
      ) : null}
      {/* the same dark-console print re-ink as the recorded block — a
          preview that vanishes on paper is a half-truth on paper */}
      <div
        data-log-console=""
        data-print-atomic=""
        data-canvas-ui="command-preview"
        className="flex items-start gap-2 rounded-lg border bg-zinc-950 p-3 dark:bg-zinc-900"
      >
        <pre
          data-canvas-ui="command-preview-text"
          className="m-0 min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all font-mono text-[10.5px] leading-relaxed text-zinc-300"
        >
          {shown}
        </pre>
        <CopyButton text={shown} />
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Files tab                                                           */
/* ------------------------------------------------------------------ */

const KIND_META: Record<OutputKind, { icon: React.ElementType; color: string; label: string }> = {
  mrc: { icon: Layers, color: "text-running-600", label: "MRC" },
  star: { icon: Table2, color: "text-violet-600", label: "STAR" },
  text: { icon: ScrollText, color: "text-warning-600", label: "TEXT" },
  image: { icon: FileText, color: "text-danger-600", label: "PLOT" },
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
      {/* filter row hosts only screen controls — paper lists the files
          themselves, unfiltered (the whole listing IS the document) */}
      <div className="no-print flex shrink-0 flex-wrap items-center gap-2">
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
                    ? "border-running/40 bg-running/15 text-running-700 dark:text-running-300"
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
          <table data-files-table="" className="w-full border-collapse text-xs">
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
                          className="size-6 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover-none:opacity-100"
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

      {/* paper manifest summary — the count line lives in the screen filter
          row (.no-print), so paper earns its own closing record (Task 115) */}
      {data ? (
        <p className="hidden px-1 pb-1 text-[10px] tabular-nums text-muted-foreground print:block">
          {data.files.length} {data.files.length === 1 ? "file" : "files"} on disk · total{" "}
          {formatBytes(data.files.reduce((s, f) => s + (f.size ?? 0), 0))}
        </p>
      ) : null}
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
  // t391 — the ANCESTORS only: the current job closes upstreamChain, but its
  // chip just repeated the title three dozen pixels above it (the meta strip
  // is one line now — that redundancy ate the space the real names need).
  const ancestors = chain.length >= 2 ? chain.slice(0, -1) : [];
  if (ancestors.length === 0) return null; // no inputs — nothing to show

  const MAX = 5; // visible ancestor chips
  const collapsed = ancestors.length > MAX;
  const shown = collapsed
    ? [...ancestors.slice(0, MAX - 1), ancestors[ancestors.length - 1]]
    : ancestors;
  const hiddenCount = ancestors.length - shown.length;

  return (
    <nav aria-label="Job lineage" className="flex min-w-0 flex-wrap items-center gap-0.5">
      <GitCommitHorizontal className="mr-1 size-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />
      {shown.map((j, i) => (
        <button
          key={j.id}
          type="button"
          onClick={() => inspect(j.id)}
          className={cn(
            "max-w-32 truncate rounded px-1.5 py-0.5 text-[10px] font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
            j.status === "completed" ? "text-muted-foreground" : "text-warning"
          )}
          title={`${j.name} — ${j.status} · click to inspect`}
        >
          {j.name}
        </button>
      )).reduce<React.ReactNode[]>((acc, el, i) => {
        if (i > 0) acc.push(<ChevronRight key={`sep-${i}`} className="mx-0.5 size-3 shrink-0 text-muted-foreground/50" aria-hidden="true" />);
        acc.push(el);
        return acc;
      }, [])}
      {collapsed ? (
        <>
          <ChevronRight className="mx-0.5 size-3 shrink-0 text-muted-foreground/50" aria-hidden="true" />
          <button
            type="button"
            onClick={() => inspect(ancestors[ancestors.length - 2].id)}
            className="rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
            title={`${hiddenCount} intermediate jobs — click to step one level up`}
          >
            +{hiddenCount}
          </button>
        </>
      ) : null}
    </nav>
  );
}

function InspectorHeader({
  job,
  summary,
  onCleaned,
  remoteRemaining,
  /** t447 — the rename edit state, owned by the modal (JobInspector) so its
   *  Escape guards can see whether an edit is active. */
  renameEdit,
  onEditChange,
}: {
  job: JobDTO;
  /** t347 — the outputs summary (live-counted key numbers): the header's
   *  count chips read it first, falling back to the run receipt's own
   *  counted numbers when the summary couldn't be counted. */
  summary?: OutputSummary | null;
  onCleaned?: () => void;
  /** t429 — the bring-home truth for the stay-receipt: null while the
   *  listing hasn't landed (receipt stays amber, no flash), a number once
   *  it has. Undefined lets the note self-probe its own endpoint. */
  remoteRemaining?: number | null;
  renameEdit: { id: string; draft: string } | null;
  onEditChange: (edit: { id: string; draft: string } | null) => void;
}) {
  const spec = jobType(job.type);
  const running = job.status === "running";
  const isLink = job.linkedJobId != null;
  const focusJob = useWorkflowStore((s) => s.focusJob);
  const duplicateJob = useWorkflowStore((s) => s.duplicateJob);
  const runJob = useWorkflowStore((s) => s.runJob);
  const stopJob = useWorkflowStore((s) => s.stopJob);
  const resetJob = useWorkflowStore((s) => s.resetJob);
  const inspect = useWorkflowStore((s) => s.inspect);
  const select = useWorkflowStore((s) => s.select);
  const jobs = useWorkflowStore((s) => s.jobs);
  const edges = useWorkflowStore((s) => s.edges);
  const workspaces = useWorkflowStore((s) => s.workspaces);
  const switchWorkspace = useWorkflowStore((s) => s.switchWorkspace);
  // t444 — the staleness wavefront for THIS job, read from the store's
  // derived map (same channel the cards use — one derivation, one truth).
  // The inspector is where the full sentence lives.
  const staleInfo = useWorkflowStore((s) => s.staleMap.get(job.id) ?? null);
  // t445 — the drift verdict for THIS job, same derived-map channel. The
  // strip speaks the always-true sentence + names the changed settings.
  const driftInfo = useWorkflowStore((s) => s.driftMap.get(job.id) ?? null);
  // t446 — the diff face's toggle: the strip names keys, the table shows
  // the receipt (ran-with → now). Local reveal state — the evidence is
  // derived from the same driftInfo, so open/closed can never contradict
  // the verdict; when the drift clears the whole strip unmounts and the
  // toggle goes with it.
  const [diffOpen, setDiffOpen] = React.useState(false);
  const diffTableId = React.useId();
  const [confirmRerun, setConfirmRerun] = React.useState(false);
  // t447 — the rename door. The edit state LIVES HERE but is OWNED by the
  // modal (JobInspector): the modal's Escape guards must know whether an
  // edit is active, and state shared across that boundary is passed down,
  // not mirrored. The draft carries the job's id with it: when the
  // inspector switches jobs mid-edit, the stale edit simply stops matching
  // (edit.id !== job.id reads as display mode) — no effect, no echo.
  const edit = renameEdit;
  const renameJob = useWorkflowStore((s) => s.renameJob);
  // Enter and blur can both fire for one edit (Enter, then a click away
  // before the PATCH lands) — the ref makes the second call a no-op, so
  // the server never sees the same rename twice.
  const renameCommitting = React.useRef(false);
  // t569 — the return chip: openJob swaps (footer doors, palette jumps
  // over the dialog) remember the job that was showing; the header offers
  // the way back. Same-project cameFrom must still exist (the jobs array
  // is the existence proof — a deleted origin offers no door); a
  // cross-project capture trusts its own snapshot (the origin's roster
  // governs there — same contract the palette's cross-project rows have).
  const cameFrom = useWorkflowStore((s) => s.cameFromJob);
  const goBackFromInspector = useWorkflowStore((s) => s.goBackFromInspector);
  const activeProjectId = useWorkflowStore((s) => s.project?.id ?? "");
  const cameFromVisible =
    cameFrom != null &&
    cameFrom.id !== job.id &&
    (cameFrom.projectId === activeProjectId
      ? jobs.some((j) => j.id === cameFrom.id)
      : true);
  const commitRename = () => {
    if (!edit || edit.id !== job.id || renameCommitting.current) return;
    if (edit.draft.trim() === job.name) {
      onEditChange(null); // nothing changed — closing IS the whole action
      return;
    }
    renameCommitting.current = true;
    void renameJob(job.id, edit.draft).then((ok) => {
      renameCommitting.current = false;
      // a refused rename keeps the door open (the toast explains) — the
      // draft survives for fixing; Escape still walks away from it
      if (ok) onEditChange(null);
    });
  };
  /** t397 — the explicit continue target ("Continue from here:" → fn_cont):
   * the Re-run button + its confirm speak the MODE — Continue when set
   * (the engine resumes and keeps the run_it* family), the wipe-teaching
   * re-run dialog when not. */
  const continueTarget =
    typeof job.params?.fn_cont === "string" ? (job.params.fn_cont as string).trim() : "";
  /** t289/t323 — the cluster door beside the Re-run button (one dialog,
   *  two doors: the toolbar's server icon and the Re-run context both open
   *  it; the old ▾ mode menu is retired). */
  const [clusterRunOpen, setClusterRunOpen] = React.useState(false);
  // t448 — the strip's verb opens the cluster door WITH subtree intent:
  // the checkbox starts checked when the door comes from the wavefront
  // (the strip says the results predates an upstream — the natural fix is
  // this-and-everything-downstream); the plain server icon opens WITHOUT
  // it. One dialog, two intents.
  const [subtreeIntent, setSubtreeIntent] = React.useState(false);
  // the subtree plan for THIS job — the strip's verb shows the real size
  // ("Re-run subtree (N)"), the same brain the dialog's checkbox speaks
  const subtreePlan = React.useMemo(
    () => planSubtreeRun(jobs, edges, job.id),
    [jobs, edges, job.id]
  );
  /** t331 — the intermediates-cleanup door (preview + execute, local +
   *  cluster): opens from the toolbar's eraser icon. */
  const [cleanupOpen, setCleanupOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const elapsed = useElapsed(job.startedAt, running);
  // t347 — the header's count chips: up to two headline numbers (particles
  // above all), from the live outputs summary when countable, else from the
  // finalize-time receipt. One grammar with the strips below (teal
  // particles, neutral micrographs, violet classes).
  const countChips = React.useMemo(() => {
    const chips: { key: string; text: string; tone: string; title: string }[] = [];
    const live = (summary?.stats ?? []).filter((s) =>
      ["particles", "micrographs", "classes", "stacks"].includes(s.key)
    );
    for (const s of live.slice(0, 2)) {
      const tone =
        s.tone === "particle"
          ? COUNT_TONE_CLASS.particle
          : s.tone === "class"
            ? COUNT_TONE_CLASS.class
            : s.tone === "warn"
              ? "text-warning-600 dark:text-warning-300"
              : COUNT_TONE_CLASS.micrograph;
      chips.push({
        key: s.key,
        text: `${s.value} ${s.key === "stacks" ? "stacks" : s.key}`,
        tone,
        title: s.hint ?? s.label,
      });
    }
    if (chips.length === 0 && job.status === "completed") {
      const rc = parseResultCounts(job.result);
      if (rc?.particles != null)
        chips.push({
          key: "particles",
          text: `${formatCountFull(rc.particles)} particles`,
          tone: COUNT_TONE_CLASS.particle,
          title: "particles — counted at run time (the receipt)",
        });
      if (rc?.micrographs != null)
        chips.push({
          key: "micrographs",
          text: `${formatCountFull(rc.micrographs)} micrographs`,
          tone: COUNT_TONE_CLASS.micrograph,
          title: "micrographs — counted at run time (the receipt)",
        });
    }
    return chips.slice(0, 2);
  }, [summary, job.status, job.result]);
  // ETA for running jobs (dialog opens client-side, no SSR concern);
  // estimateEta is a pure read — baseline recording is an effect-side effect
  const eta = running ? estimateEta(job.id, job.startedAt, job.progress) : null;
  React.useEffect(() => {
    if (running) trackEtaBaseline(job.id, job.startedAt, job.progress);
  }, [running, job.id, job.startedAt, job.progress]);

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
    <div className="space-y-2.5">
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
      {/* t391 — the head is TWO bands, not four: identity + actions share
       * one row (the old separate toolbar strip spent most of its width on
       * empty background — the 「head 区域太拥挤」 receipt), and a single
       * meta strip below carries type · headline counts · timing with the
       * lineage breadcrumb flowing to its end. Mobile contract: the action
       * cluster wraps below the title, right-aligned, close at its end. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl border shadow-sm",
            spec ? `${spec.color.soft} ${spec.color.border}` : "bg-muted"
          )}
        >
          <TypeIcon name={spec?.icon ?? "boxes"} className={cn("size-5", spec?.color.text)} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          {/* Task 177: below sm the badge steps ASIDE instead of squeezing
              the title — flex-wrap lets a long name keep the whole line
              ("QA Refine Live" read as "Q…" at the 269px fold width) while
              short names still share the row exactly as before; ≥sm is
              untouched. title attr gives the hover reveal back. */}
          <div className="flex max-sm:flex-wrap items-center gap-2">
            {edit?.id === job.id ? (
              /* t447 — the rename door's edit face: the field sits where
                  the title was (same row, same badge beside it), Enter
                  commits, Escape walks away, clicking elsewhere commits.
                  maxLength mirrors the server's 60 so honest typing never
                  meets the 400. */
              <Input
                ref={(el) => {
                  el?.focus();
                  el?.select();
                }}
                value={edit.draft}
                maxLength={60}
                aria-label="Job name"
                className="h-8 max-w-[22rem] flex-1 text-base font-semibold"
                onChange={(e) => onEditChange({ id: job.id, draft: e.target.value })}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitRename();
                  } else if (e.key === "Escape") {
                    // walk away from the EDIT, not the modal. The modal's
                    // Radix capture listener is handled by the DialogContent
                    // onEscapeKeyDown guard; stopping React propagation here
                    // keeps the bubble-phase closer out of the way too (the
                    // panel face's Escape branch learned this same lesson
                    // earlier — its stopPropagation predates us).
                    e.preventDefault();
                    e.stopPropagation();
                    onEditChange(null);
                  }
                }}
              />
            ) : (
              <>
                <h2 className="truncate text-lg font-semibold leading-tight tracking-tight text-foreground" title={job.name}>
                  {job.name}
                </h2>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onEditChange({ id: job.id, draft: job.name })}
                      aria-label={`Rename ${job.name}`}
                      className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="size-3" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Rename this job</TooltipContent>
                </Tooltip>
              </>
            )}
            <StatusBadge status={job.status} queued={isSlurmQueued(job)} />
            {cameFromVisible && cameFrom && (
              <Chip
                size="md"
                interactive
                asChild
                className={cn(
                  // t570 — motion as wayfinding: the chip walks in from the
                  // left (the direction its own arrow points) after a door
                  // landing, the arrow leans further back on hover (where
                  // you'd GO), and a press settles the pill 3% down — a
                  // physical button, not a painted one. Transforms are
                  // motion, so every transform nudge rides motion-safe;
                  // color fades stay unguarded (the house reads fades as
                  // color, not movement). t645 — skeleton moved to the
                  // primitive (11px md row; press scale and focus ring
                  // now inherit the canonical generation).
                  "inspector-chip-enter group max-w-[16rem]",
                  "border-border/60 bg-muted/40 text-muted-foreground duration-150",
                  "hover:border-foreground/20 hover:bg-muted hover:text-foreground"
                )}
              >
                <button
                  type="button"
                  data-canvas-ui="inspector-return-link"
                  onClick={() => void goBackFromInspector()}
                  title={`You came here from "${cameFrom.name}" — click to go back`}
                >
                  <ArrowLeft
                    className="size-2.5 shrink-0 transition-transform duration-200 ease-out motion-safe:group-hover:-translate-x-px"
                    aria-hidden="true"
                  />
                  <span className="truncate">back to {cameFrom.name}</span>
                </button>
              </Chip>
            )}
          </div>
        </div>

        {/* action cluster + close — one right-aligned group on the
            identity row (pure screen chrome — the job report prints
            without it). t323's one-decision-per-control contract holds:
            Focus / compare / reset / Re-run-or-Stop, then the cluster +
            cleanup icon doors, then close. */}
        {!isLink ? (
          <div className="no-print flex max-w-full shrink-0 flex-wrap items-center justify-end gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" onClick={() => focusJob(job.id)} className="h-7 gap-1.5 px-2.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
                  <Locate className="size-3.5" aria-hidden="true" />
                  <span>Focus</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Center this job on the canvas</TooltipContent>
            </Tooltip>
            {/* third diff entry (Task 88): same-type sibling list — renders
             nothing when this run has no twin (guard mirrors the canvas) */}
            <SiblingComparePicker job={job} />
            {/* t439 — the CTF A/B door: paired per-micrograph VERDICT
             * between two completed runs (the params door answers "what
             * did I change", this one answers "what did it do"). Renders
             * nothing without a completed sibling or off the CTF face. */}
            <CtfCompareEntry job={job} />
            {/* t440 — the Motion A/B door: same verdict face, second
             * domain — "did my MotionCorr parameters actually steady
             * the alignments?" Same guard family: completed host +
             * completed sibling or no door. */}
            <MotionCompareEntry job={job} />
            {/* t453 — the Class A/B door: the third domain — occupancy.
             * Same verdict face, its own words (gained/lost/held — a
             * class that gained particles did not "improve") and its
             * own consumer verb (select the gains). Renders nothing
             * without a completed sibling or off the classification
             * faces. */}
            <ClassCompareEntry job={job} />
            {/* t454 — the convergence door: the FOURTH question — one run
             * vs its OWN iterations ("did the classification settle?").
             * Same family face, no sibling needed; the door hides unless
             * the run's round ladder holds at least two rounds. */}
            <ClassConvergenceEntry job={job} />
            {/* t456 — the resolution arc: the FIFTH question — one ML run
             * vs its OWN resolution estimates ("still sharpening?").
             * t459 — the door reads the classifications too: a model star
             * family is a model star family. It hides off the refinement
             * and classification faces and when the run wrote no
             * per-round estimates. */}
            <ResolutionArcEntry job={job} />
            {/* t457 — the final verdict: the SIXTH question — one
             * postprocess's honesty read ("is the number true — what did
             * the mask buy, what did the correction claw back?"). The
             * door hides off the postprocess faces and when the star
             * carries no corrected curve. */}
            <PostprocessVerdictEntry job={job} />
            {/* t461 — the particle funnel: the CHAIN question — "where did
             * my particles go?" Not a pair, the whole line: the door
             * walks the chain from this verb and reads every stage's
             * receipt as a ledger, with the attrition between neighbors
             * spoken. Hides off the funnel stages and when the route
             * returns no chain. */}
            <ParticleFunnelEntry job={job} />
            {/* t442 — the duplicate door: clone this run as an unstarted
             * twin with its params AND upstream wiring — the A/B loop's
             * front door (copy → tweak one knob → run → compare). */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void duplicateJob(job.id, { openInspector: true })}
                  className="h-7 gap-1.5 px-2.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <CopyPlus className="size-3.5" aria-hidden="true" />
                  <span>Duplicate</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Clone this run — params and upstream wiring come along; the twin
                starts unstarted, ready for your edits, then Re-run and compare
              </TooltipContent>
            </Tooltip>
            {job.status !== "running" ? (
              <>
                {/* t333 — the tooltip answers the file question in place:
                    reset clears STATE only (status/progress/resume
                    checkpoint); the run directory survives until the next
                    Run, which wipes and regenerates it. */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void resetJob(job.id).then(() => {
                        inspect(null);
                        select(job.id);
                      })}
                      className="h-7 gap-1.5 px-2.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <RotateCcw className="size-3.5" aria-hidden="true" />
                      <span>Reset &amp; edit</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Back to idle — clears the run state (status, progress, resume checkpoint); the
                    run directory stays until the next Run rebuilds it
                  </TooltipContent>
                </Tooltip>
                {/* t289 — Re-run + mode door. t323 — the ▾ split button is
                    RETIRED (the user's receipt: crowded text, the arrow could
                    go): the primary Re-run button speaks local re-run and the
                    Server icon right of it is the cluster door — no third
                    control repeating both.
                    t397 — the label speaks the MODE: a job with a
                    "Continue from here" checkpoint says Continue (the engine
                    resumes and KEEPS the run_it* family — asking the re-run
                    wipe question there would mislabel the action). */}
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => setConfirmRerun(true)}
                  className={cn(
                    "h-7 gap-1.5 bg-running-600 px-3 text-xs text-white hover:bg-running-700",
                    continueTarget !== "" && "bg-success-600 hover:bg-success-700"
                  )}
                >
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : continueTarget !== "" ? <History className="size-3.5" /> : <Play className="size-3.5" />}
                  {continueTarget !== "" ? "Continue" : "Re-run"}
                </Button>
              </>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      setBusy(true);
                      void stopJob(job.id).finally(() => setBusy(false));
                    }}
                    className="h-7 gap-1.5 px-2.5 text-xs text-danger-600 hover:bg-danger-50 hover:text-danger-700 dark:text-danger-400 dark:hover:bg-danger-950/40"
                  >
                    {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Square className="size-3.5" aria-hidden="true" />}
                    <span>Stop</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  SIGTERM the process tree — refine-family jobs re-run from their
                  last checkpoint via RELION --continue
                </TooltipContent>
              </Tooltip>
            )}
            {/* remote dispatch: same graph, same argv — the cluster executes it
                (module load relion/<ver>, staging in, sync-back out). t289/t323 —
                the icon opens the SAME dialog the Re-run button family uses. */}
            <Button
              variant="ghost"
              size="icon"
              className="relative size-7 shrink-0 text-muted-foreground hover:text-foreground before:absolute before:-inset-1.5 before:rounded-md before:content-['']"
              onClick={() => {
                setSubtreeIntent(false);
                setClusterRunOpen(true);
              }}
              aria-label="Run on cluster (SSH)"
              title="Run on cluster (SSH)"
            >
              <Server className="size-3.5" aria-hidden="true" />
            </Button>
            <RemoteRunButton
              job={job}
              dialogOnly
              open={clusterRunOpen}
              onOpenChange={setClusterRunOpen}
              defaultSubtree={subtreeIntent}
            />
            {/* t331 — intermediates cleanup (local + cluster): the eraser
                door. Informational like the occupancy panel, destructive
                only through its own two-step confirm. */}
            <Button
              variant="ghost"
              size="icon"
              className="relative size-7 shrink-0 text-muted-foreground hover:text-foreground before:absolute before:-inset-1.5 before:rounded-md before:content-['']"
              onClick={() => setCleanupOpen(true)}
              aria-label="Clean intermediates (local + cluster)"
              title="Clean intermediates (local + cluster)"
            >
              <Eraser className="size-3.5" aria-hidden="true" />
            </Button>
            <CleanupDialog
              job={job}
              open={cleanupOpen}
              onOpenChange={setCleanupOpen}
              onCleaned={onCleaned}
            />
            <Separator orientation="vertical" className="mx-0.5 h-5 shrink-0" decorative />
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Close inspector"
                className="h-7 w-7 shrink-0 gap-0 rounded-md p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" aria-hidden="true" />
              </Button>
            </DialogClose>
          </div>
        ) : (
          <DialogClose asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Close inspector"
              className="h-8 w-8 shrink-0 gap-0 rounded-md p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </DialogClose>
        )}
      </div>

      {/* meta strip — one calm line: job type, the t347 headline numbers
          (particles first, teal — one size up from the muted text so they
          lead the eye), timing, then the upstream lineage flowing to the
          end (click any ancestor to hop to its inspector). The old stack
          put type badge + counts + created + elapsed on one line AND the
          lineage on another — two cramped 10-11px rows. */}
      {/* NOTE: div, not <p> — the vertical Separators render <div>s and
       * HTML forbids div-in-p (hydration error) */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground/70">{spec?.label ?? job.type}</span>
        {countChips.map((c) => (
          <React.Fragment key={c.key}>
            <Separator orientation="vertical" className="h-3" decorative />
            <span
              data-header-count={c.key}
              title={c.title}
              className={cn("text-xs font-semibold tabular-nums", c.tone)}
            >
              {c.text}
            </span>
          </React.Fragment>
        ))}
        {running && job.startedAt && elapsed > 0 ? (
          <>
            <Separator orientation="vertical" className="h-3" decorative />
            <span className="font-mono tabular-nums text-running">
              {formatElapsed(elapsed)} elapsed
            </span>
          </>
        ) : null}
        {!running && job.duration > 0 ? (
          <>
            <Separator orientation="vertical" className="h-3" decorative />
            <span className="font-mono tabular-nums">{fmtDuration(job.duration)}</span>
          </>
        ) : null}
        <Separator orientation="vertical" className="h-3" decorative />
        <span>created {job.createdAt ? fmtAgo(job.createdAt) : "—"}</span>
        <span className="ml-auto pl-1">
          <LineageBreadcrumb job={job} />
        </span>
      </div>

      {/* t444 — the staleness strip: same strip grammar as the remote
          execution band, amber tone — the inspector is where the FULL
          sentence lives (the card carries only the glyph). Renders
          nothing while the result is current: silence is the default,
          the alarm is the exception. */}
      {staleInfo ? (() => {
        const d = describeStaleness(staleInfo);
        const feeds = subtreePlan.order.length > 1;
        return (
          <div
            role="note"
            data-testid="stale-strip"
            title={`${d.long}\nUpstream run started ${new Date(d.since).toLocaleString()}`}
            className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-warning/30 bg-warning/[0.07] px-2 py-1.5 text-[11px] text-muted-foreground"
          >
            <History className="size-3.5 shrink-0 text-warning" aria-hidden="true" />
            <span className="font-medium text-foreground/90">{d.short}</span>
            <span className="min-w-0">{d.long}</span>
            {feeds ? (
              /* t448 — the wavefront's verb lives where the sentence lives:
                  the strip says the results predates an upstream's latest
                  run; the button offers the fix that matches the truth —
                  this job AND everything it feeds, one lane, one receipt. */
              <button
                type="button"
                data-testid="stale-subtree-verb"
                onClick={() => {
                  setSubtreeIntent(true);
                  setClusterRunOpen(true);
                }}
                title="Re-run this job and every downstream job on the cluster — the door opens with the subtree rider checked"
                className="ml-auto inline-flex shrink-0 items-center gap-1 rounded border border-warning/30 bg-background/50 px-1.5 py-0.5 text-[10px] font-medium text-warning-700 transition-colors hover:bg-warning/15 dark:text-warning-400"
              >
                <Play className="size-3 shrink-0" aria-hidden="true" />
                Re-run subtree ({subtreePlan.order.length})
              </button>
            ) : null}
          </div>
        );
      })() : null}

      {/* t445/t446 — the drift strip + its diff face: the strip speaks the
          always-true sentence and names the keys; "Show what changed"
          expands the receipt — one row per setting, ran-with → now, from
          the SAME verdict (paramChanges derives from driftFor, so the
          table cannot contradict the strip: same keys, same order). The
          snapshot is already in the DB — showing WHAT the values were is
          the difference between an accusation and a receipt. Renders
          nothing while the recipe matches the snapshot — silence is the
          default, the alarm is the exception. */}
      {driftInfo ? (() => {
        const d = describeDrift(driftInfo);
        const changes = paramChanges(job);
        return (
          <div
            role="note"
            data-testid="drift-strip"
            title={`${d.long}${d.keys ? `\nChanged: ${d.keys}` : ""}`}
            className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-warning/30 bg-warning/[0.07] px-2 py-1.5 text-[11px] text-muted-foreground"
          >
            <SlidersHorizontal className="size-3.5 shrink-0 text-warning" aria-hidden="true" />
            <span className="font-medium text-foreground/90">{d.short}</span>
            <span className="min-w-0">{d.long}</span>
            {d.keys ? (
              <span className="rounded border bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-foreground/80">
                {d.keys}
              </span>
            ) : null}
            {changes && changes.length > 0 ? (
              <>
                <button
                  type="button"
                  onClick={() => setDiffOpen((v) => !v)}
                  aria-expanded={diffOpen}
                  aria-controls={diffTableId}
                  data-testid="drift-diff-toggle"
                  title={diffOpen ? "Collapse the per-setting receipt" : "Every changed setting, ran-with value → current value"}
                  className="ml-auto inline-flex shrink-0 items-center gap-1 rounded border border-warning/30 bg-background/50 px-1.5 py-0.5 text-[10px] font-medium text-warning-700 transition-colors hover:bg-warning/15 dark:text-warning-400"
                >
                  <ChevronDown
                    className={cn(
                      "size-3 shrink-0 transition-transform duration-150",
                      diffOpen ? "" : "-rotate-90"
                    )}
                    aria-hidden="true"
                  />
                  {diffOpen ? "Hide the receipt" : "Show what changed"}
                </button>
                {diffOpen ? (
                  <div
                    id={diffTableId}
                    data-testid="drift-diff-table"
                    className="w-full pt-1"
                  >
                    <table className="w-full border-collapse text-left text-[10px]">
                      <thead>
                        <tr className="text-muted-foreground/70">
                          <th scope="col" className="py-1 pr-2 font-medium uppercase tracking-wide">Setting</th>
                          <th scope="col" className="w-[38%] py-1 pr-2 font-medium uppercase tracking-wide">Ran with</th>
                          <th scope="col" className="w-[38%] py-1 font-medium uppercase tracking-wide">Now</th>
                        </tr>
                      </thead>
                      <tbody>
                        {changes.map((c) => (
                          <tr key={c.key} className="border-t border-warning/15">
                            <td className="py-1 pr-2 font-mono text-[10px] text-foreground/85">
                              {c.kind === "added" ? (
                                <span className="mr-1 font-bold text-running" aria-hidden="true">+</span>
                              ) : c.kind === "removed" ? (
                                <span className="mr-1 font-bold text-danger" aria-hidden="true">−</span>
                              ) : null}
                              {c.key}
                            </td>
                            <td
                              className="max-w-0 truncate py-1 pr-2 font-mono tabular-nums text-muted-foreground/80"
                              title={`ran with ${formatParamValue(c.from)}`}
                            >
                              {formatParamValue(c.from)}
                            </td>
                            <td
                              className="max-w-0 truncate py-1 font-mono tabular-nums font-medium text-foreground/90"
                              title={`now ${formatParamValue(c.to)}`}
                            >
                              {formatParamValue(c.to)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        );
      })() : null}

      {/* Remote execution strip — mirrors the run's cluster context
          (connection + module + phase) while runRemote is attached to the
          job. Compact by contract: the card chip carries the short host,
          this is where the full story lives. */}
      {job.runRemote ? (
        <div
          role="note"
          title={`${job.runRemote.remoteWorkdir} — cluster workdir`}
          className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-running/25 bg-running/[0.06] px-2 py-1.5 text-[11px] text-muted-foreground"
        >
          <Server className="size-3.5 shrink-0 text-running" aria-hidden="true" />
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
              : job.status === "completed" || job.status === "failed"
                ? // t269 — terminal: the pid is dead, so the strip stops
                  // claiming the run is "Running"; the ledger span below
                  // speaks the timing instead. t299 — when the verdict came
                  // from the scheduler's accounting (the .cf-exit never
                  // landed), the strip carries the controller's OWN terminal
                  // word instead of a bare "ran"
                  `Ran on the cluster${
                    job.runRemote.mode === "slurm" &&
                    job.runRemote.slurmState &&
                    /^(COMPLETED|FAILED|CANCELLED|TIMEOUT|NODE_FAIL|BOOT_FAIL|OUT_OF_MEMORY|PREEMPTED|DEADLINE|SPECIAL_EXIT)$/.test(
                      job.runRemote.slurmState
                    )
                      ? ` · Slurm ${job.runRemote.slurmState}`
                      : ""
                  }${
                    // t303 — the scheduler's own stopwatch + meter, when the
                    // accounting ledger served them: the ledger dialect
                    // (formatLedgerMs) keeps ONE time language across the
                    // strip; the peak memory rides formatStagedBytes' shape.
                    job.runRemote.slurmElapsedMs != null
                      ? ` · ${formatLedgerMs(job.runRemote.slurmElapsedMs)}`
                      : ""
                  }${
                    job.runRemote.slurmMaxRssBytes != null
                      ? `${formatStagedBytes(job.runRemote.slurmMaxRssBytes)} peak`
                      : ""
                }${
                  // t306 — the array split rides the terminal strip too:
                  // one scheduler job that was really N shards, merged into
                  // one run everywhere else — the strip is where it shows
                  job.runRemote.slurmArray
                    ? ` · array 1-${job.runRemote.slurmArray.total}%${job.runRemote.slurmArray.concurrency}`
                    : ""
                }`
                : job.runRemote.mode === "slurm"
                  ? // t297 — the scheduler's own vocabulary: the state word
                    // (PENDING/RUNNING/…) + the job id + the GPU width
                    `Slurm job ${job.runRemote.slurmId ?? "?"}${job.runRemote.gpusRequested ? ` · ${job.runRemote.gpusRequested} GPU(s)` : ""}${
                      job.runRemote.slurmState
                        ? job.runRemote.slurmState === "PENDING"
                          ? " · queued"
                          : ` · ${job.runRemote.slurmState.toLowerCase()}`
                        : ""
                    }${
                      // t304 — the pipeline handoff, spoken: the scheduler is
                      // holding THIS job until those upstream slurm ids land
                      job.runRemote.slurmDependsOn?.length
                        ? ` · waits on ${job.runRemote.slurmDependsOn.join(", ")}`
                        : ""
                    }${
                      // t306 — the array split, spoken: ONE scheduler job that
                      // is really N shards (the merge makes it look like one
                      // run everywhere else — the strip is where it shows)
                      job.runRemote.slurmArray
                        ? ` · array 1-${job.runRemote.slurmArray.total}%${job.runRemote.slurmArray.concurrency}`
                        : ""
                    }`
                  : `Running on the cluster${job.runRemote.pid ? ` · pid ${job.runRemote.pid}` : ""}`}
          </span>
          {job.runRemote.phase !== "staging" &&
          (job.status === "completed" || job.status === "failed") &&
          (job.runRemote.stagedMs != null || job.runRemote.syncMs != null) ? (
            <span
              data-remote-ledger=""
              title={
                // t270 leftover from t269 — the display compacts (2m05s),
                // the hover stays precise (125123ms): the exact number is
                // one tooltip away, never lost to rounding
                `exact: staged ${job.runRemote.stagedMs ?? "?"}ms · synced ${job.runRemote.syncMs ?? "?"}ms — the run's time ledger (staging = upload, sync-back = download)`
              }
              className="min-w-0 truncate rounded border border-running/20 bg-running/[0.08] px-1.5 py-px font-mono text-[9.5px] tabular-nums text-running-700 dark:text-running-300"
            >
              staged {formatLedgerMs(job.runRemote.stagedMs) ?? "—"}
              {job.runRemote.syncMs != null ? ` · synced ${formatLedgerMs(job.runRemote.syncMs)}` : ""}
              {job.runRemote.syncedFiles != null ? ` · ${job.runRemote.syncedFiles} file(s) back` : ""}
            </span>
          ) : null}
        </div>
      ) : null}
      {job.runRemote?.note ? (
        // t429 — bring-home awareness: the receipt re-judged against live
        // disk truth (the listing this inspector already polls counts the
        // manifest entries still remote — no extra fetch)
        <RemoteStayNote note={job.runRemote.note} remoteRemaining={remoteRemaining} />
      ) : null}

      {/* live progress */}
      {running ? (
        <div className="flex items-center gap-3">
          <Progress value={job.progress} className="h-1.5 flex-1 overflow-hidden" />
          <span className="w-10 shrink-0 text-right font-mono text-[11px] font-semibold tabular-nums text-running">
            {Math.round(job.progress)}%
          </span>
          {eta != null && (
            <span
              className="shrink-0 rounded-full border border-running/30 bg-running/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-running-700 dark:text-running-300"
              title={`${formatEta(eta)} remaining — projected from the current pace (RELION iterations can speed up or slow down)`}
            >
              {formatEta(eta)} left
            </span>
          )}
        </div>
      ) : null}

      {/* rerun confirm — t397: the dialog speaks the MODE. A CONTINUE
          confirms the resumption (which round, what stays); a fresh re-run
          keeps teaching the wipe (the user's fear: a continue that fires a
          re-run clears the checkpoints「导致文件被清」— the two modes now
          look, ask and behave differently). */}
      <AlertDialog open={confirmRerun} onOpenChange={setConfirmRerun}>
        {/* Escape peels ONE layer: this confirm floats on the inspector
            modal, and without the React-level consume both Radix roots
            dismiss on the same keypress (ui/dialog onEscapeClose) */}
        <AlertDialogContent onKeyDown={onEscapeClose(() => setConfirmRerun(false))}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {continueTarget !== "" ? `Continue ${job.name}?` : `Re-run ${job.name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {continueTarget !== "" ? (
                <>
                  The run picks up from the checkpoint set in "Continue from here" via RELION&apos;s{" "}
                  <span className="font-mono text-[11px]">--continue</span> — the{" "}
                  <span className="font-mono text-[11px]">run_it*</span> iteration family in this
                  job&apos;s run directory is preserved and the refinement resumes from that round.
                  The chosen path rides as-is:
                  <span className="block break-all pt-1 font-mono text-[10px] text-muted-foreground">
                    {continueTarget}
                  </span>
                </>
              ) : (
                <>
                  The engine restarts from scratch: files the previous run generated in this job&apos;s
                  run directory — on this machine and on the cluster — are cleared first, then the job
                  runs with the current parameters and upstream inputs. Existing downstream results stay
                  on disk until those jobs re-run. To resume from a checkpoint instead, cancel and set
                  "Continue from here".
                </>
              )}
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
              {continueTarget !== "" ? "Continue" : "Start again"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Paper identity (Task 114) — when the inspector prints, it IS the    */
/* document: a print-only masthead (job · type · status · active tab · */
/* printed date) opens the sheet and a position:fixed identity strip   */
/* repeats on every printed page (same mechanism as PrintDocFooter).   */
/* Screen never sees either element — `hidden` + print:* variants.     */
/* The masthead lives INSIDE the dialog so it survives the app-page    */
/* hide (globals.css print block: html:has([data-inspector-dialog]))   */
/* and the paper reads masthead → screen identity → active tab body.   */
/* ------------------------------------------------------------------ */

const INSPECTOR_PRINT_TAB: Record<string, string> = {
  overview: "Overview",
  log: "Engine log",
  results: "Results",
  files: "Files",
};

function InspectorPrintDoc({ job, tab }: { job: JobDTO; tab: string }) {
  const workspaces = useWorkflowStore((s) => s.workspaces);
  const spec = jobType(job.type);
  const ws = workspaces.find((w) => w.id === job.workspaceId)?.name ?? null;
  // rendered at masthead mount — moments before the print dialog reads the
  // DOM, so "printed <date>" is honest to the day
  const printed = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const annotated = (job.note ?? "").trim().length > 0;
  const sub = [
    spec?.label ?? job.type,
    job.status,
    ws ? `workspace “${ws}”` : null,
    `showing ${INSPECTOR_PRINT_TAB[tab] ?? tab}`,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <>
      <div
        data-inspector-print-doc
        className="hidden border-b border-foreground/15 px-5 pb-3 pt-4 print:block sm:px-6"
      >
        <div className="flex items-end justify-between gap-6">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              CryoFlow — job report
            </p>
            <h1 className="mt-1 truncate text-xl font-semibold tracking-tight">{job.name}</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
          </div>
          <p className="shrink-0 text-right text-[11px] leading-4 tabular-nums text-muted-foreground">
            printed {printed}
            {annotated ? (
              <>
                <br />
                annotated
              </>
            ) : null}
          </p>
        </div>
      </div>
      {/* per-sheet identity strip — fixed repaints at the bottom of every
          printed page (PrintDocFooter doctrine); muted so full pages at
          worst get a near-invisible overlap, never obscured content */}
      <p className="hidden px-6 text-center text-[9px] text-muted-foreground print:fixed print:bottom-1 print:left-0 print:right-0 print:block">
        {job.name} — CryoFlow job report · printed {printed}
      </p>
    </>
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
  // jump straight to the results when the job finished. Track the STATUS so a
  // running → completed transition while the dialog is OPEN also jumps to
  // results (previously the effect only ran on jobId change, so the currently
  // inspected job stayed on the Log tab forever).
  const [tab, setTab] = React.useState<string>("log");
  // manual tab choice latches PER JOB: never stomp a tab the user chose
  // while THIS job is inspected (live status transitions included), but a
  // different job starts fresh — the smart default (Log for running/failed,
  // Results otherwise) applies again.  The latch used to be a bare boolean
  // that survived across jobs, so opening job B silently landed on
  // whatever tab job A had touched (Task 68 QA finding, Task 70 fix).
  const tabTouchedForRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!job || inspectId == null) return;
    // never stomp a tab the user chose manually for THIS job (only
    // auto-switch on transitions we did not cause)
    if (tabTouchedForRef.current !== inspectId) {
      // t363 — a RUNNING classification lands on RESULTS, not Log: its live
      // iteration gallery (round sheets as the cluster writes them) is the
      // surface the user asked to watch while 2D runs — the log stays one
      // click away. Other running jobs and failures keep the Log default.
      const liveGalleryType =
        job.type === "class2d" ||
        job.type === "class3d" ||
        job.type === "refine3d" ||
        job.type === "initialmodel";
      setTab(
        job.status === "failed"
          ? "log"
          : job.status === "running" && !liveGalleryType
            ? "log"
            : "results"
      );
    }
  }, [inspectId, job, job?.status]);

  // t659 — the Frame galleries deep link's HOST leg (the Task 81
  // handshake's second heir): a palette jump to this job's frame wall
  // lands on the OVERVIEW tab, where the gallery mounts. The host only
  // clears the way — the request itself is consumed by the gallery once
  // its wall renders (fresh: lightbox opens; stale: cleared on sight, so
  // a lingering link can never surprise a later inspector open — the
  // class-note law). The jump is a manual choice, so it latches the tab
  // exactly like a user click does (onTabSelect semantics).
  const pendingGalleryFocus = useWorkflowStore((s) => s.pendingGalleryFocus);
  const consumeGalleryFocus = useWorkflowStore((s) => s.consumeGalleryFocus);
  React.useEffect(() => {
    if (inspectId == null || !job) return;
    if (!pendingGalleryFocus || pendingGalleryFocus.jobId !== job.id) return;
    if (Date.now() - pendingGalleryFocus.at < GALLERY_FOCUS_TTL_MS) {
      tabTouchedForRef.current = inspectId;
      setTab("overview");
    } else {
      consumeGalleryFocus();
    }
  }, [pendingGalleryFocus, job, inspectId, consumeGalleryFocus]);

  // t660 — the Class averages deep link's host: same landing (overview,
  // where the teaser mounts), but the arrival IS the tab — the teaser has
  // no lightbox, so there is no second consumer and the inspector
  // consumes the request the moment it clears the way (Task 81's sync
  // shape, no TTL). The jump is a manual choice, so it latches too.
  const pendingClassAveragesFocus = useWorkflowStore((s) => s.pendingClassAveragesFocus);
  const consumeClassAveragesFocus = useWorkflowStore((s) => s.consumeClassAveragesFocus);
  React.useEffect(() => {
    if (inspectId == null || !job) return;
    if (!pendingClassAveragesFocus || pendingClassAveragesFocus.jobId !== job.id) return;
    tabTouchedForRef.current = inspectId;
    setTab("overview");
    consumeClassAveragesFocus();
  }, [pendingClassAveragesFocus, job, inspectId, consumeClassAveragesFocus]);

  // t665 — the Denoise compare deep link's host: the t659 two-gate shape
  // (not t660's), because the wall is NOT the arrival itself. The results
  // tab is only the clearing of the way — the gallery consumes the request
  // once it is on screen (scroll into view + flash), so a link that
  // promises the before/after wall puts the wall in view, not just the tab
  // that contains it somewhere below the fold. Stale requests are cleared
  // on sight (the gallery's self-hide contract means its consumer may
  // never mount — the Task 81 law: a lingering link can never re-open).
  const pendingDenoiseFocus = useWorkflowStore((s) => s.pendingDenoiseFocus);
  const consumeDenoiseFocus = useWorkflowStore((s) => s.consumeDenoiseFocus);
  React.useEffect(() => {
    if (inspectId == null || !job) return;
    if (!pendingDenoiseFocus || pendingDenoiseFocus.jobId !== job.id) return;
    if (Date.now() - pendingDenoiseFocus.at < GALLERY_FOCUS_TTL_MS) {
      tabTouchedForRef.current = inspectId;
      setTab("results");
    } else {
      consumeDenoiseFocus();
    }
  }, [pendingDenoiseFocus, job, inspectId, consumeDenoiseFocus]);

  // Task 120: the Overview leg of the failure diagnosis — the strip lives in
  // the Log console, which unmounts with its tab, so the Overview summary
  // needs its own findings. A failed job's log is static: ONE ?full=1 fetch
  // answers for the whole visit, and the teaser counts the WHOLE run.out
  // while the strip counts whichever window it renders.
  const [fullFindings, setFullFindings] = React.useState<LogFinding[] | null>(null);
  const jobFailed = job?.status === "failed";
  React.useEffect(() => {
    // Task 121 three states, not two: null = not scanned yet or NO LOG
    // (job never ran — the card stays silent, honestly); [] = scanned the
    // full log and NO known signature matched (the negative teaser says
    // so); non-empty = the classic teaser. The old [] initial state made
    // "no log" and "no match" indistinguishable.
    setFullFindings(null);
    if (!jobId || !jobFailed) return;
    let alive = true;
    void (async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}/log?full=1`, { cache: "no-store" });
        if (!res.ok) return; // no log (job never ran) — stays null, silent
        const body = (await res.json()) as { tail?: string };
        // t318 — an EMPTY log is NOT "scanned and nothing matched":
        // diagnoseLog("") === [], which used to render the negative teaser's
        // "scanned the full run.out — 0 findings" over a log that never had
        // a byte (the forged-verdict ticket's receipt read exactly like
        // that). Same for the route's "(log fetch failed: …)" note — a
        // fetch that failed scanned nothing. Both keep the null state: the
        // card stays silent when there is nothing to scan.
        const text = (body.tail ?? "").trim();
        if (alive)
          setFullFindings(
            text && !text.startsWith("(log fetch failed") ? diagnoseFailureLog(text) : null
          );
      } catch {
        /* transient — the teaser is a summary, not a promise; the next open retries */
      }
    })();
    return () => {
      alive = false;
    };
  }, [jobId, jobFailed]);

  // the teaser's jump lands the console in Full mode so the strip's count
  // equals the teaser's on arrival (parity by construction). One-shot: any
  // manual tab change goes through onValueChange and clears the flag, and
  // closing the dialog clears it too — the tail default returns.
  const [logJumpFull, setLogJumpFull] = React.useState(false);
  React.useEffect(() => {
    if (inspectId == null) setLogJumpFull(false);
  }, [inspectId]);
  const openDiagnosis = React.useCallback(() => {
    if (inspectId != null) tabTouchedForRef.current = inspectId;
    setLogJumpFull(true);
    setTab("log");
  }, [inspectId]);

  // t447 — the rename edit state lives HERE (the modal owner): the Escape
  // guards below must know whether an edit is active, and state shared
  // across that boundary is lifted, not mirrored. InspectorHeader reads it
  // through props.
  const [renameEdit, setRenameEdit] = React.useState<{ id: string; draft: string } | null>(null);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && inspect(null)}>
      <DialogContent
        showCloseButton={false}
        /* data-inspector-dialog: the print opt-in (globals.css Task 114) —
           the ONLY dialog that becomes a paper document instead of
           stepping aside; the attribute also anchors the probe contract.
           t617 — data-insp-arrival scopes the modal's own wave: the faces
           inside (accent, header, tabs bar, the active tab's panel, the
           workdir footer) surface in reading order on every open. */
        data-inspector-dialog=""
        data-insp-arrival=""
        className="flex max-w-[min(1480px,96vw)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(1480px,96vw)] h-[min(940px,92dvh)] data-[state=open]:duration-300 print:[translate:none] print:[scale:none] print:[rotate:none]"
        aria-describedby={undefined}
        /* t391 — Radix auto-focuses the FIRST focusable child on open (the
           header's Focus button), and Radix tooltips open on focus — so
           every inspector open birthed a ghost "Center this job on the
           canvas" tooltip hovering over the meta line. Decline the
           auto-focus: the dialog is a VIEWING surface (nothing to type),
           Escape still closes, and the first Tab lands inside normally. */
        onOpenAutoFocus={(e) => e.preventDefault()}
        /* t447 — the rename edit's Escape must walk away from the EDIT, not
           close the modal. Radix hears Escape on document CAPTURE (before
           any bubble-phase handler can react), and dismisses unless the
           event is already default-prevented — onEscapeKeyDown is Radix's
           own hook for exactly that: it runs inside the capture handler
           BEFORE the defaultPrevented check, so preventing here keeps the
           modal up while the edit consumes the keypress. */
        onEscapeKeyDown={(e) => {
          if (renameEdit != null) e.preventDefault();
        }}
        onKeyDown={(e) => {
          // the bubble-phase closer (was onEscapeClose(() => inspect(null))).
          // While an edit is active this keypress belongs to the edit: the
          // input's own handler cancels it and stops React propagation, and
          // this guard is the second net (focus may sit elsewhere while the
          // edit is open) — Escape then closes the EDIT, not the modal.
          if (e.key === "Escape") {
            if (renameEdit != null) {
              e.preventDefault();
              e.stopPropagation();
              setRenameEdit(null);
              return;
            }
            e.preventDefault();
            e.stopPropagation();
            inspect(null);
          }
        }}
      >
        {job ? (
          <InspectorBody
            job={job}
            data={data}
            tab={tab}
            onTabSelect={(v) => {
              if (inspectId != null) tabTouchedForRef.current = inspectId;
              setLogJumpFull(false);
              setTab(v);
            }}
            /* the Overview tab's "jump to files" verb goes straight to the
               tab (no latch, no logJumpFull clear) — the exact pre-t617
               behavior, preserved verbatim through the extraction */
            onTabSet={setTab}
            logJumpFull={logJumpFull}
            diagnosis={fullFindings}
            onOpenDiagnosis={openDiagnosis}
            renameEdit={renameEdit}
            onRenameEditChange={setRenameEdit}
            onCleaned={() => void loadOutputs()}
            onReloadOutputs={() => void loadOutputs()}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* t617 — the modal's body: the wave's host AND the mount ledger's     */
/* FOURTH consumer (t613's law, after the spotlight t613, the          */
/* workspaces t614, the palette t616). The body mounts with the        */
/* dialog — Radix unmounts DialogContent on close — so the ledger      */
/* dies with it and every open re-issues fresh, the t614/t616 law      */
/* verbatim. Tickets fill on miss at JSX evaluation order = reading    */
/* order and are never rewritten.                                      */
/*                                                                     */
/* THE FOLD LAW, second consumer (t616's law, new mechanism): Radix    */
/* TabsContent NEVER unmounts its panels — it hides the inactive ones  */
/* (the hidden attribute) and strips their children — so "hanging in   */
/* the DOM but not in the composition" is the panels' PERMANENT        */
/* condition. The law answers with nomination instead of mount: only   */
/* the ACTIVE panel carries the face attribute. Switching tabs         */
/* de-nominates the old panel (the rule stops matching — the element   */
/* snaps home) and nominates the new one; the attribute appearing is   */
/* the animation's cue, so a first visit pays the ledger's tail (210)  */
/* and a RETURN replays its frozen ticket (162) — a ticket belongs to  */
/* a face, not a seat, and not to a mount either.                      */
/* ------------------------------------------------------------------ */
function InspectorBody({
  job,
  data,
  tab,
  onTabSelect,
  onTabSet,
  logJumpFull,
  diagnosis,
  onOpenDiagnosis,
  renameEdit,
  onRenameEditChange,
  onCleaned,
  onReloadOutputs,
}: {
  job: JobDTO;
  data: OutputsResponse | null;
  tab: string;
  onTabSelect: (v: string) => void;
  onTabSet: (v: string) => void;
  logJumpFull: boolean;
  diagnosis: LogFinding[] | null;
  onOpenDiagnosis: () => void;
  renameEdit: { id: string; draft: string } | null;
  onRenameEditChange: (next: { id: string; draft: string } | null) => void;
  onCleaned: () => void;
  onReloadOutputs: () => void;
}) {
  /* the ledger: useState lazy init (t614's law — react-compiler forbids
   * render-phase ref access; useState's lifecycle is identical here),
   * filled on miss at render time, never rewritten, dying with the body. */
  const [ledger] = React.useState(() => new Map<string, number>());
  const ticket = (id: string): number => {
    let t = ledger.get(id);
    if (t == null) {
      t = INSP_BASE_MS - INSP_STEP_MS;
      for (const v of ledger.values()) if (v > t) t = v;
      t += INSP_STEP_MS;
      ledger.set(id, t);
    }
    return t;
  };
  /* only the ACTIVE panel is nominated (the fold law above) — the other
   * three panels spread nothing, so their (hidden, emptied) divs never
   * match the wave rule. The face props are their own type: Radix's
   * TabsContentProps predates arbitrary data-* attributes, and its
   * required `value` must not ride the spread (the explicit value attr
   * stays the single writer). JSX spreads skip excess-property checks,
   * so the extra data attribute lands cleanly. */
  const panelFace = (value: string): { "data-insp-face"?: string; style?: React.CSSProperties } =>
    tab === value
      ? {
          "data-insp-face": `panel:${value}`,
          style: { "--insp-d": `${ticket(`panel:${value}`)}ms` } as React.CSSProperties,
        }
      : {};
  const filesCount = data?.files.length ?? 0;

  return (
    <>
      <InspectorPrintDoc job={job} tab={tab} />
      {/* status accent */}
      <div
        aria-hidden="true"
        data-insp-face="accent"
        style={{ "--insp-d": `${ticket("accent")}ms` } as React.CSSProperties}
        className={cn(
          "h-1 w-full shrink-0",
          job.status === "running"
            ? "bg-gradient-to-r from-running-600 via-running-400 to-running-600"
            : job.status === "completed"
              ? "bg-gradient-to-r from-success-600 via-success-400 to-success-600"
              : "bg-gradient-to-r from-danger-600 via-danger-400 to-danger-600"
        )}
      />
      <DialogHeader
        data-insp-face="header"
        style={{ "--insp-d": `${ticket("header")}ms` } as React.CSSProperties}
        className="shrink-0 space-y-0 border-b px-5 pb-3 pt-4 sm:px-6"
      >
        <DialogTitle asChild>
          <div>
            <span className="sr-only">{job.name} — job inspector</span>
            <InspectorHeader
              job={job}
              summary={data?.summary ?? null}
              onCleaned={onCleaned}
              remoteRemaining={data ? data.files.filter((f) => f.remote).length : null}
              renameEdit={renameEdit}
              onEditChange={onRenameEditChange}
            />
          </div>
        </DialogTitle>
        <DialogDescription className="sr-only">
          Live log, intermediate results and output files for {job.name}
        </DialogDescription>
      </DialogHeader>

      <Tabs value={tab} onValueChange={onTabSelect} className="flex min-h-0 flex-1 flex-col gap-0">
        {/* tab triggers are screen navigation — paper prints the ACTIVE
            tab and the report masthead names it ("showing Results") */}
        {/* Task 176: below sm the bar compacts to survive the foldable
            band (280px): icons park (decorative, aria-hidden — the
            labels carry the meaning), padding/gap shave one step,
            the container drops to px-3, and the list itself can
            never outgrow its parent (max-w-full). Desktop ≥sm keeps
            the exact Task 114 bar — every change is max-sm-scoped. */}
        <div
          data-insp-face="tabs"
          style={{ "--insp-d": `${ticket("tabs")}ms` } as React.CSSProperties}
          className="no-print shrink-0 border-b px-3 pt-2.5 sm:px-6"
        >
          <TabsList className="h-9 max-w-full bg-muted/60 p-0.5">
            <TabsTrigger value="overview" className="h-8 gap-1.5 px-3 text-xs max-sm:gap-1 max-sm:px-1.5">
              <LayoutDashboard className="size-3.5 max-sm:hidden" aria-hidden="true" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="log" className="h-8 gap-1.5 px-3 text-xs max-sm:gap-1 max-sm:px-1.5">
              <Terminal className="size-3.5 max-sm:hidden" aria-hidden="true" />
              Log
              {job.status === "running" ? (
                <span className="ml-0.5 size-1.5 rounded-full bg-danger" aria-label="live" />
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="results" className="h-8 gap-1.5 px-3 text-xs max-sm:gap-1 max-sm:px-1.5">
              <BarChart3 className="size-3.5 max-sm:hidden" aria-hidden="true" />
              Results
            </TabsTrigger>
            <TabsTrigger value="files" className="h-8 gap-1.5 px-3 text-xs max-sm:gap-1 max-sm:px-1.5">
              <FolderOpen className="size-3.5 max-sm:hidden" aria-hidden="true" />
              Files
              {filesCount > 0 ? (
                <span className="rounded-full bg-muted px-1.5 text-[9px] font-semibold tabular-nums text-muted-foreground">
                  {filesCount > 99 ? "99+" : filesCount}
                </span>
              ) : null}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" {...panelFace("overview")} className="mt-0 min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <OverviewTab job={job} data={data} onOpenFiles={() => onTabSet("files")} diagnosis={diagnosis} onOpenDiagnosis={onOpenDiagnosis} />
        </TabsContent>

        <TabsContent value="log" {...panelFace("log")} className="mt-0 min-h-0 flex-1 px-5 py-4 sm:px-6">
          <LogConsole job={job} initialMode={logJumpFull ? "full" : undefined} />
        </TabsContent>

        <TabsContent value="results" {...panelFace("results")} className="mt-0 min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <JobResultsLive job={job} />
        </TabsContent>

        <TabsContent value="files" {...panelFace("files")} className="mt-0 min-h-0 flex-1 px-5 py-4 sm:px-6">
          <FilesTab job={job} data={data} reload={onReloadOutputs} />
        </TabsContent>
      </Tabs>

      {/* footer: workdir — DATA-GATED: mounts when the outputs fetch
          lands, so the face attribute APPEARING is the wave's cue and
          the ledger's tail is the ticket (the t616 favorites ladder) */}
      {data?.workdir ? (
        <footer
          data-insp-face="footer"
          style={{ "--insp-d": `${ticket("footer")}ms` } as React.CSSProperties}
          className="flex shrink-0 items-center gap-2 border-t bg-muted/30 px-5 py-2 text-[11px] text-muted-foreground sm:px-6"
        >
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
    // t397 — 15s → 6s: the sub-views carry their own caches/tokens (the
    // class gallery's poll is version-guarded), so a faster nudge costs
    // little and the numbers/plots follow the run instead of lagging it
    const t = setInterval(() => {
      keyRef.current += 1;
      setRefreshKey(keyRef.current);
    }, 6_000);
    return () => clearInterval(t);
  }, [running]);
  return <JobResults job={job} refreshKey={refreshKey} />;
}

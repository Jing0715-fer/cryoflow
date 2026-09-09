"use client";

/**
 * CryoFlow — FSC comparison overlay dialog.
 *
 * One cryo-EM question, asked constantly: "which reconstruction is
 * actually better?" — postprocess vs the refine it came from, polished
 * vs unpolished, this run vs last Tuesday's. Every job's own FSC chart
 * answers it in isolation; this dialog overlays the CURVES so the
 * high-resolution falloff can be compared directly.
 *
 * Data flow (deliberately two-tier):
 *   1. /api/projects/[id]/fsc-index — parse-free discovery of FSC-bearing
 *      jobs (readdir + file-name classification only)
 *   2. /api/jobs/[id]/fsc — full shells, fetched in parallel for the
 *      SELECTED jobs only (statcache makes repeats cheap)
 *
 * Merging: jobs sample different resolution grids (postprocess grids run
 * to their own Nyquist, model stars to theirs), so shells are unioned on
 * the resolution axis and each curve bridges its own gaps (connectNulls).
 * Each job plots its OFFICIAL criterion curve — masked+corrected for
 * postprocess, raw gold-standard for refinements — the same number the
 * job card badge shows, so the overlay never contradicts the cards.
 *
 * Selection persists per project (localStorage) — reopening the dialog
 * restores last time's comparison.
 *
 * Acting on the comparison (Task 62): hovering a candidate row or legend
 * chip highlights ITS curve and dims the rest (the eye needs a tether
 * between a row and a line among six); every non-host job name is a
 * button that jumps the inspector straight to that job; rows for still-
 * running refinements carry a pulsing live badge and the header gains a
 * re-scan button — a refinement lands a new model checkpoint every few
 * minutes, so a comparison opened an hour ago is stale by definition.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  GitCompareArrows,
  Info,
  Loader2,
  RefreshCw,
  Waves,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Checkbox } from "@/components/ui/checkbox";
import { useWorkflowStore } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJsonRetry } from "@/lib/retry-fetch";
import { cn } from "@/lib/utils";
import { FscParamsDiff } from "./fsc-params-diff";

/* ------------------------------------------------------------------ */
/* Types + palette                                                     */
/* ------------------------------------------------------------------ */

interface FscIndexEntry {
  jobId: string;
  name: string;
  type: string;
  status: string;
  source: "postprocess" | "model";
  sourceFile: string;
  /** launch parameter map — rides along from the index fetch and feeds
   *  the A/B parameter diff table (no extra per-job round-trip) */
  params: Record<string, unknown>;
}

interface FscShell {
  freq: number;
  res: number;
  fsc: number;
  correctedFsc?: number;
}

interface FscResponse {
  jobId: string;
  source: "postprocess" | "model" | null;
  sourceFile: string | null;
  shells: FscShell[];
  resolutionAt143: number | null;
  resolutionAt05: number | null;
  reportedResolution: number | null;
  reportedLabel: string | null;
}

/** six-way categorical palette — teal/amber first so a 2-way postprocess
 *  vs refine comparison lands on the app's canonical FSC colors */
const PALETTE = [
  { stroke: "#14b8a6", chip: "bg-teal-500" }, // teal-500
  { stroke: "#f59e0b", chip: "bg-amber-500" }, // amber-500
  { stroke: "#8b5cf6", chip: "bg-violet-500" }, // violet-500
  { stroke: "#f43f5e", chip: "bg-rose-500" }, // rose-500
  { stroke: "#0ea5e9", chip: "bg-sky-500" }, // sky-500
  { stroke: "#84cc16", chip: "bg-lime-500" }, // lime-500
];

/** how many curves one overlay can hold before it becomes spaghetti */
export const MAX_CURVES = 6;

/** auto-refresh cadence while a PICKED job is still running — refinements
 *  land a model checkpoint every few minutes, so a 12 s poll catches new
 *  FSC estimates within one checkpoint of them appearing on disk */
export const LIVE_POLL_MS = 12_000;

const AMBER = "#f59e0b";
const NOISE = "#71717a";

/** per-job recharts series key (namespaced so it can never collide
 *  with the x-axis "res" field) */
const seriesKey = (jobId: string) => `c:${jobId}`;

/** status → legend dot treatment (mirrors the canvas status colors) */
function statusDot(status: string): string {
  switch (status) {
    case "running":
      return "bg-teal-500";
    case "completed":
      return "bg-emerald-500";
    case "failed":
      return "bg-rose-500";
    default:
      return "bg-zinc-400";
  }
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function FscCompareDialog({
  projectId,
  open,
  onOpenChange,
  currentJobId,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** the job whose FSC card launched the dialog — preselected and marked */
  currentJobId: string;
}) {
  const [index, setIndex] = useState<FscIndexEntry[] | null>(null);
  const [indexError, setIndexError] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [curves, setCurves] = useState<Map<string, FscResponse | null>>(new Map());
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  /** the job whose row/legend chip is hovered (or keyboard-focused) — its
   *  curve bolds while the others dim, tying list entries to lines */
  const [hoverId, setHoverId] = useState<string | null>(null);
  /** bumped by the header re-scan button — re-runs discovery AND curve
   *  fetches (running refinements land new checkpoints while open) */
  const [scan, setScan] = useState(0);
  const [scanning, setScanning] = useState(false);
  const restoreLatch = useRef(false);
  const inspect = useWorkflowStore((s) => s.inspect);
  /* ---------- discovery + selection restore ---------- */
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      // stale-open reset + index refetch happen after the commit yields —
      // a dialog re-opening starts discovery from scratch (the CURVE cache
      // is reset on close — see the close-time reset below — so the open
      // commit's curve-effect re-run already sees an empty cache)
      await Promise.resolve();
      if (cancelled) return;
      setIndex(null);
      setIndexError(false);
      setHidden(new Set());

      try {
        const body = await fetchJsonRetry<{ jobs: FscIndexEntry[] }>(
          `/api/projects/${projectId}/fsc-index`,
          { init: { cache: "no-store" } }
        );
        if (cancelled) return;
        const jobs = body.jobs ?? [];
        setIndex(jobs);
        setScanning(false);

        // restore the persisted selection once per mount; the launching
        // job always joins (it demonstrably has a curve — its card is
        // showing it), then persisted ids that still exist in the index
        if (!restoreLatch.current) {
          restoreLatch.current = true;
          const KEY = `cryoflow.fsc-compare:${projectId}`;
          let saved: string[] = [];
          try {
            saved = JSON.parse(localStorage.getItem(KEY) ?? "[]");
          } catch {
            /* corrupted state — start clean */
          }
          const known = new Set(jobs.map((j) => j.jobId));
          const next = new Set<string>([currentJobId]);
          for (const id of saved) {
            if (next.size >= MAX_CURVES) break;
            if (known.has(id)) next.add(id);
          }
          setPicked(next);
        }
      } catch {
        if (!cancelled) {
          setIndexError(true);
          setScanning(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // `scan` re-runs discovery on the header re-scan button; the restore
    // latch keeps the persisted selection intact across re-scans
  }, [open, projectId, currentJobId, scan]);

  /* ---------- persist selection ---------- */
  useEffect(() => {
    if (!open || !restoreLatch.current) return;
    try {
      localStorage.setItem(
        `cryoflow.fsc-compare:${projectId}`,
        JSON.stringify([...picked])
      );
    } catch {
      /* private mode / quota — persistence is best-effort */
    }
  }, [picked, open, projectId]);

  /* ---------- curve fetching for picked jobs ---------- */
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const targets = [...picked].filter((id) => !curves.has(id));
      // curves for unpicked jobs are DROPPED, not kept warm — a 6-cap
      // map is tiny and this keeps the merged grid tied to the visible set
      if (targets.length > 0) {
        const results = await Promise.all(
          targets.map(async (id) => {
            try {
              const body = await fetchJsonRetry<FscResponse>(
                `/api/jobs/${id}/fsc`,
                { init: { cache: "no-store" } }
              );
              return [id, body] as const;
            } catch {
              return [id, null] as const; // honest gap — listed but unreadable
            }
          })
        );
        if (cancelled) return;
        setCurves((prev) => {
          const next = new Map(prev);
          for (const [id, body] of results) {
            if (picked.has(id)) next.set(id, body);
            else next.delete(id);
          }
          return next;
        });
      } else {
        setCurves((prev) => {
          const next = new Map(prev);
          let changed = false;
          for (const id of prev.keys()) {
            if (!picked.has(id)) {
              next.delete(id);
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // the effect reads `curves` only to decide which targets are missing;
    // re-running on its own writes would loop — the narrower dep list is
    // deliberate (picked/open are the real triggers; `scan` joins because
    // a re-scan empties the map to force re-reads)
  }, [picked, open, scan]);

  /* ---------- merged resolution grid ---------- */
  const rows = useMemo(() => {
    const live = [...curves.entries()].filter(
      ([id, c]) => c && c.shells.length > 0 && picked.has(id) && !hidden.has(id)
    );
    if (live.length === 0) return [];
    const resSet = new Set<number>();
    for (const [, c] of live) {
      for (const s of c!.shells) {
        if (Number.isFinite(s.res) && s.res > 0 && s.res < 900) resSet.add(s.res);
      }
    }
    const grid = [...resSet].sort((a, b) => a - b); // large Å → small Å
    return grid.map((res) => {
      const row: Record<string, number | null> = { res };
      for (const [id, c] of live) {
        const hit = c!.shells.find((s) => s.res === res);
        // official criterion per job: masked+corrected when the curve
        // carries it (postprocess), raw gold-standard otherwise (refine)
        row[seriesKey(id)] = hit ? (hit.correctedFsc ?? hit.fsc) : null;
      }
      return row;
    });
  }, [curves, picked, hidden]);

  const pickedCount = picked.size;
  const loaded = [...picked].filter((id) => curves.has(id));
  const anyData = [...curves.values()].some((c) => c && c.shells.length > 0);

  /* ---------- hover highlight ---------- */
  // Hovering a row/legend bolds ITS curve and dims the others — but only
  // when the hovered job actually owns a VISIBLE curve: a hidden, unpicked
  // or still-loading curve must not dim everything into fog.
  const highlightId =
    hoverId != null &&
    picked.has(hoverId) &&
    !hidden.has(hoverId) &&
    (curves.get(hoverId)?.shells.length ?? 0) > 0
      ? hoverId
      : null;

  /* ---------- header re-scan ---------- */
  const rescan = useCallback(() => {
    setScanning(true);
    // drop every fetched curve so the curve effect re-reads the picked
    // jobs (a running refinement may have landed a newer checkpoint), then
    // bump `scan` to re-run discovery alongside
    setCurves(new Map());
    setScan((s) => s + 1);
  }, []);

  /* ---------- live auto-refresh (running picks) ---------- */
  // A refinement that is still running lands a new model checkpoint every
  // few minutes — the re-scan button covers the manual case, but a dialog
  // left open next to a live job would still drift stale. While any PICKED
  // job is running, poll the index (so status flips running→completed stop
  // the poll and flip the badge) plus each running pick's curve; the
  // interval resets on every index commit, which is exactly one cadence.
  const runningPicked = useMemo(
    () =>
      (index ?? [])
        .filter((j) => j.status === "running" && picked.has(j.jobId))
        .map((j) => j.jobId),
    [index, picked]
  );
  useEffect(() => {
    if (!open || runningPicked.length === 0) return;
    let cancelled = false;
    const tick = async () => {
      // CURVES FIRST. setIndex at the bottom of this tick replaces the
      // index state, which re-derives `runningPicked` (a fresh array),
      // which re-runs THIS effect and flips the old closure's `cancelled`.
      // The original order (index → curves) therefore cancelled the poll's
      // own curve updates one microtask after the index commit — the fetch
      // counter ticked, the UI never moved. Updating curves before the
      // index commit keeps the fresh shells inside the same synchronous
      // span as their fetch, and the re-run interval takes the next beat.
      await Promise.all(
        runningPicked.map(async (id) => {
          try {
            const c = await fetchJsonRetry<FscResponse>(
              `/api/jobs/${id}/fsc`,
              { init: { cache: "no-store" } }
            );
            if (cancelled) return;
            // merge the single job's fresh curve — other picks' curves
            // (and their hover states) stay untouched, unlike re-scan
            setCurves((prev) => {
              if (prev.get(id) === c) return prev; // referential no-op guard
              const next = new Map(prev);
              next.set(id, c);
              return next;
            });
          } catch {
            /* this tick misses the job — the next one retries */
          }
        })
      );
      if (cancelled) return;
      try {
        const body = await fetchJsonRetry<{ jobs: FscIndexEntry[] }>(
          `/api/projects/${projectId}/fsc-index`,
          { init: { cache: "no-store" } }
        );
        if (cancelled) return;
        setIndex(body.jobs ?? []);
        setScanning(false);
      } catch {
        /* silent — a failed poll must never surface as indexError */
      }
    };
    const t = setInterval(tick, LIVE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [open, projectId, runningPicked]);

  /* ---------- close-path cache reset ---------- */
  // Every dismissal (Esc, overlay click, jump-to-job) funnels through
  // onOpenChange(false) — the perfect place to wipe the curve cache: it is
  // an EVENT handler (no setState-in-effect lint cascade), fully
  // synchronous, and by the time the dialog reopens the cache is already
  // empty, so the open commit's curve-effect re-run sees zero targets and
  // refetches everything. The Task 60 placement (wipe in the open
  // effect's async body) landed one microtask AFTER the curve effect had
  // already read the stale cache — the effect computed zero targets,
  // never re-ran (curves is deliberately not its dependency), and the
  // dialog hung on "Reading curves…" forever (caught by qa62's jump path:
  // reopen on a live mount).
  const handleOpenChange = useCallback(
    (o: boolean) => {
      if (!o) {
        setCurves((prev) => (prev.size > 0 ? new Map() : prev));
      }
      onOpenChange(o);
    },
    [onOpenChange]
  );

  const toggle = useCallback((id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setHidden((h) => {
          const hn = new Set(h);
          hn.delete(id);
          return hn;
        });
      } else if (next.size < MAX_CURVES) {
        next.add(id);
      }
      return next;
    });
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-2xl flex-col gap-4 overflow-y-auto sm:max-w-2xl"
        // overflow-y-auto, NOT overflow-hidden: the Task 64 params table
        // pushed the dialog past its 85vh budget on 4-pick comparisons, and
        // the hidden overflow SILENTLY CLIPPED the legend chips + footnote —
        // qa62's legend-hover assertions caught the hover landing on nothing.
        // With a scrollable body the flex children keep their natural height
        // (the candidate list is no longer starved by the chart) and long
        // comparisons scroll like any other modal.
        onKeyDown={(e) => {
          // Escape must peel ONE layer: this dialog floats on top of the
          // job inspector modal, and each Radix Dialog root carries its own
          // dismissable-layer stack — both layers see themselves as highest
          // and BOTH would dismiss (the inspector behind dies with it).
          // Consuming Escape at the React level stops the event before the
          // document-level Radix listeners ever fire; we close ourselves
          // (through handleOpenChange so the close-path cache reset runs).
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            handleOpenChange(false);
          }
        }}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <GitCompareArrows className="h-4 w-4 text-teal-600" aria-hidden="true" />
            Compare FSC curves
            <span className="rounded-full border border-muted-foreground/25 bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
              {pickedCount}/{MAX_CURVES}
            </span>
          </DialogTitle>
          <DialogDescription>
            Overlay the official criterion curve of every selected job —
            masked + corrected for postprocess, gold-standard for refinements.
          </DialogDescription>
        </DialogHeader>

        {/* ---------- freshness strip: live status + re-scan, one unit ----------
             The two "is my comparison current?" affordances used to live in
             different worlds — a ghost icon (invisible at rest) in the header
             and a teal band that only existed while a job ran. They are the
             same concern: the index and its curves go stale as refinements
             land checkpoints. One strip, two states: teal + pulse while the
             poller is attached, quiet "N curves indexed" otherwise; the
             labeled Scan button sits at its right edge in both. */}
        <div
          data-testid="fsc-compare-freshness"
          className={cn(
            "flex shrink-0 items-center gap-2 rounded-md border py-1 pl-2.5 pr-1.5 transition-colors duration-300",
            runningPicked.length > 0
              ? "border-teal-600/20 bg-teal-500/5"
              : "border-border/60 bg-muted/20"
          )}
        >
          {runningPicked.length > 0 ? (
            <p
              data-testid="fsc-compare-autolive"
              className="flex min-w-0 flex-1 items-center gap-1.5 text-[11px] text-teal-700 dark:text-teal-300"
            >
              <span className="relative inline-flex size-1.5 shrink-0" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75 motion-reduce:animate-none" />
                <span className="relative inline-flex size-1.5 rounded-full bg-teal-500" />
              </span>
              <span className="truncate">
                Live — curves for the running job{runningPicked.length === 1 ? "" : "s"} refresh
                every {LIVE_POLL_MS / 1000} s; the badge flips when it completes.
              </span>
            </p>
          ) : (
            <p className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-[11px] text-muted-foreground">
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  scanning ? "animate-pulse bg-primary/40 motion-reduce:animate-none" : "bg-border"
                )}
                aria-hidden="true"
              />
              {index
                ? `${index.length} curve${index.length === 1 ? "" : "s"} indexed`
                : indexError
                  ? "Index unavailable"
                  : "Scanning for FSC curves…"}
            </p>
          )}
          <button
            type="button"
            onClick={rescan}
            disabled={scanning}
            data-testid="fsc-compare-rescan"
            aria-label="Re-scan the project for FSC curves"
            title="Re-scan the project for FSC curves — running refinements land a new model checkpoint every few minutes, so an index read from a minute ago is already stale"
            className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-border/70 bg-background/60 px-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:pointer-events-none disabled:opacity-60"
          >
            <RefreshCw
              className={cn("h-3 w-3", scanning && "animate-spin motion-reduce:animate-none")}
              aria-hidden="true"
            />
            {scanning ? "Scanning…" : "Scan"}
          </button>
        </div>

        {/* ---------- candidate list ---------- */}
        <div
          className="min-h-24 space-y-1 overflow-y-auto pr-1"
          role="group"
          aria-label="Select jobs to compare"
          data-testid="fsc-compare-list"
        >
          {indexError && (
            <p className="flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-2 text-xs text-destructive">
              <Info className="h-3.5 w-3.5" aria-hidden="true" />
              Could not load the project&apos;s FSC index — try again.
            </p>
          )}
          {index === null && !indexError && (
            <div className="space-y-1.5 py-1" aria-hidden="true">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          )}
          {index !== null && index.length === 0 && (
            <p className="rounded-md border border-dashed px-2.5 py-3 text-xs text-muted-foreground">
              No job in this project carries an FSC curve yet — run a
              refinement or a Post-Processing job and its curve lands here.
            </p>
          )}
          {index?.map((job) => {
            const idx = index.findIndex((e) => e.jobId === job.jobId);
            const pal = PALETTE[idx % PALETTE.length];
            const isPicked = picked.has(job.jobId);
            const atCap = !isPicked && pickedCount >= MAX_CURVES;
            const curve = curves.get(job.jobId);
            const isHost = job.jobId === currentJobId;
            const isRunning = job.status === "running";
            return (
              <label
                key={job.jobId}
                data-testid="fsc-compare-row"
                data-job-id={job.jobId}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-md border px-2.5 py-1.5 transition-colors",
                  isPicked
                    ? "border-primary/40 bg-primary/5"
                    : "border-border hover:border-primary/30 hover:bg-muted/50",
                  atCap && "cursor-not-allowed opacity-50 hover:border-border hover:bg-transparent"
                )}
                title={
                  atCap
                    ? `The overlay holds ${MAX_CURVES} curves at most — untick one first`
                    : `${job.sourceFile} — ${job.source === "postprocess" ? "masked + corrected criterion" : "gold-standard half-map curve"}`
                }
                onMouseEnter={() => setHoverId(job.jobId)}
                onMouseLeave={() => setHoverId((h) => (h === job.jobId ? null : h))}
              >
                <Checkbox
                  checked={isPicked}
                  disabled={atCap}
                  onCheckedChange={() => toggle(job.jobId)}
                  aria-label={`Compare ${job.name}`}
                />
                {isRunning ? (
                  <span
                    className="relative inline-flex size-1.5 shrink-0"
                    data-testid="fsc-compare-live"
                    role="img"
                    aria-label={`${job.name} is still running — its curve grows as iterations land`}
                  >
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75 motion-reduce:animate-none" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-teal-500" />
                  </span>
                ) : (
                  <span
                    className={cn("inline-block size-1.5 shrink-0 rounded-full", statusDot(job.status))}
                    aria-hidden="true"
                  />
                )}
                {isHost ? (
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">
                    {job.name}
                    <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                      (this job)
                    </span>
                  </span>
                ) : (
                  <button
                    type="button"
                    data-testid={`fsc-compare-jump-${job.jobId}`}
                    title={`Open ${job.name} in the inspector — its card, curves and outputs replace this one`}
                    onClick={(e) => {
                      // the row is a <label> for the checkbox — a click on
                      // the name button must NOT forward to the checkbox
                      // (preventDefault for the browsers that would, plus
                      // this is a navigation, not a selection change);
                      // handleOpenChange also wipes the curve cache before
                      // the whole subtree swaps to the jumped-to job
                      e.preventDefault();
                      e.stopPropagation();
                      handleOpenChange(false);
                      inspect(job.jobId);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-0.5 rounded-sm text-left text-xs font-medium underline-offset-2 decoration-dotted hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    <span className="truncate">{job.name}</span>
                    <ArrowUpRight
                      className="h-3 w-3 shrink-0 text-muted-foreground/50"
                      aria-hidden="true"
                    />
                  </button>
                )}
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground/70">
                  {job.type}
                </span>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-1.5 py-px text-[10px] font-semibold",
                    job.source === "postprocess"
                      ? "border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                      : "border-teal-600/30 bg-teal-500/10 text-teal-700 dark:text-teal-300"
                  )}
                >
                  {job.source === "postprocess" ? "postprocess" : "half-maps"}
                </span>
                <span
                  className="inline-block h-0.5 w-4 shrink-0 rounded"
                  style={{ backgroundColor: pal.stroke }}
                  aria-hidden="true"
                />
                {/* fetched resolution, once the curve lands */}
                <span
                  className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground"
                  data-testid={`fsc-compare-res-${job.jobId}`}
                >
                  {curve?.resolutionAt143 != null
                    ? `${curve.resolutionAt143.toFixed(2)} Å`
                    : curve
                      ? "—"
                      : ""}
                </span>
              </label>
            );
          })}
        </div>

        {/* ---------- overlay chart ---------- */}
        {pickedCount >= 1 && !anyData && loaded.length !== pickedCount && (
          <div className="flex h-56 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Reading curves…
          </div>
        )}
        {pickedCount >= 1 && !anyData && loaded.length === pickedCount && (
          <div className="flex h-56 items-center justify-center rounded-md border border-dashed px-4 text-center text-xs text-muted-foreground">
            The selected jobs list FSC files but no readable curve came back —
            the on-disk tables may still be empty (the refinement has not
            reached its first FSC estimate).
          </div>
        )}
        {anyData && rows.length > 0 && (
          // shrink-0 is load-bearing: without it the flex container starves
          // this wrapper and the legend chips OVERFLOW into the params table
          // below (they end up unclickable — qa62's legend hover caught it)
          <div className="min-h-0 shrink-0">
            <div className="h-60" data-testid="fsc-compare-chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rows} margin={{ top: 6, right: 14, bottom: 2, left: -14 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="currentColor"
                    className="text-border"
                    opacity={0.5}
                  />
                  <XAxis
                    dataKey="res"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    reversed
                    scale="log"
                    allowDataOverflow
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v: number) => v.toFixed(0)}
                    stroke="currentColor"
                    className="text-muted-foreground"
                    height={20}
                    label={{
                      value: "resolution (Å) → higher res",
                      position: "insideBottomRight",
                      offset: -2,
                      fontSize: 10,
                      fill: "currentColor",
                    }}
                  />
                  <YAxis
                    domain={[-0.1, 1]}
                    tick={{ fontSize: 10 }}
                    stroke="currentColor"
                    className="text-muted-foreground"
                    tickFormatter={(v: number) => v.toFixed(1)}
                    width={46}
                    label={{
                      value: "FSC",
                      angle: -90,
                      position: "insideLeft",
                      offset: 22,
                      fontSize: 10,
                      fill: "currentColor",
                    }}
                  />
                  <Tooltip
                    formatter={(value: number | string, name: string) => [
                      Number(value).toFixed(3),
                      name,
                    ]}
                    labelFormatter={(label: number | string) =>
                      `${Number(label).toFixed(2)} Å (1/${(1 / Math.max(Number(label), 1e-6)).toFixed(3)} Å⁻¹)`
                    }
                    contentStyle={{ fontSize: 11, borderRadius: 6, padding: "4px 8px" }}
                  />
                  <ReferenceLine
                    y={0.143}
                    stroke={AMBER}
                    strokeDasharray="5 4"
                    opacity={0.75}
                    label={{ value: "0.143", fill: AMBER, fontSize: 10, position: "insideTopLeft" }}
                  />
                  <ReferenceLine
                    y={0.5}
                    stroke={NOISE}
                    strokeDasharray="2 4"
                    opacity={0.45}
                    label={{ value: "0.5", fill: NOISE, fontSize: 10, position: "insideTopLeft" }}
                  />
                  {[...curves.entries()]
                    .filter(([id, c]) => picked.has(id) && !hidden.has(id) && c)
                    .map(([id, c], i) => {
                      const idx = index?.findIndex((e) => e.jobId === id) ?? i;
                      const pal = PALETTE[idx % PALETTE.length];
                      return (
                        <Line
                          key={id}
                          type="monotone"
                          dataKey={seriesKey(id)}
                          name={index?.find((e) => e.jobId === id)?.name ?? id}
                          stroke={pal.stroke}
                          strokeWidth={highlightId === id ? 3 : 2}
                          strokeOpacity={highlightId == null || highlightId === id ? 1 : 0.15}
                          dot={false}
                          activeDot={{ r: 4, fill: pal.stroke }}
                          connectNulls
                          isAnimationActive={false}
                        />
                      );
                    })}
                </LineChart>
              </ResponsiveContainer>
            </div>
            {/* legend chips — click to hide a curve without losing its place */}
            <div
              className="mt-2 flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label="Toggle curves"
            >
              {[...picked].map((id) => {
                const job = index?.find((e) => e.jobId === id);
                if (!job) return null;
                const idx = index!.findIndex((e) => e.jobId === id);
                const pal = PALETTE[idx % PALETTE.length];
                const isHidden = hidden.has(id);
                const c = curves.get(id);
                return (
                  <button
                    key={id}
                    type="button"
                    data-testid={`fsc-compare-legend-${id}`}
                    aria-pressed={!isHidden}
                    onClick={() =>
                      setHidden((prev) => {
                        const next = new Set(prev);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        return next;
                      })
                    }
                    onMouseEnter={() => setHoverId(id)}
                    onMouseLeave={() => setHoverId((h) => (h === id ? null : h))}
                    onFocus={() => setHoverId(id)}
                    onBlur={() => setHoverId((h) => (h === id ? null : h))}
                    title={
                      c?.sourceFile
                        ? `${c.sourceFile} — click to ${isHidden ? "show" : "hide"} this curve`
                        : `click to ${isHidden ? "show" : "hide"} this curve`
                    }
                    className={cn(
                      "inline-flex max-w-56 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                      isHidden
                        ? "border-muted-foreground/25 bg-muted text-muted-foreground/60 line-through"
                        : "border-border bg-background hover:border-primary/40",
                      highlightId === id &&
                        !isHidden &&
                        "border-primary/50 bg-primary/5 ring-1 ring-primary/30"
                    )}
                  >
                    <span
                      className="inline-block h-0.5 w-3.5 shrink-0 rounded"
                      style={{ backgroundColor: isHidden ? undefined : pal.stroke }}
                      aria-hidden="true"
                    />
                    <span className="truncate">{job.name}</span>
                    {c?.resolutionAt143 != null && (
                      <span className="shrink-0 font-mono tabular-nums text-[10px] text-muted-foreground">
                        {c.resolutionAt143.toFixed(2)} Å
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {pickedCount >= 2 && index && (
          <FscParamsDiff
            jobs={[...picked]
              .map((id) => index.find((e) => e.jobId === id))
              .filter((e): e is NonNullable<typeof e> => Boolean(e))}
            colorOf={(id) => {
              const i = index.findIndex((e) => e.jobId === id);
              return PALETTE[(i >= 0 ? i : 0) % PALETTE.length].stroke;
            }}
          />
        )}
        {pickedCount >= 2 && anyData && (
          <p className="flex shrink-0 items-start gap-1.5 text-[10px] leading-snug text-muted-foreground/80">
            <Waves className="mt-px h-3 w-3 shrink-0 text-teal-600" aria-hidden="true" />
            The curve that stays higher at the right edge resolves finer
            detail — a masked postprocess typically climbs above its raw
            refinement (that climb is the mask + B-factor sharpening doing
            its job), but an over-aggressive mask shows up as a divergence
            between the two that the phase-randomization check on the job
            page would flag.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

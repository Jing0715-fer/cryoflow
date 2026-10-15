"use client";

/**
 * CryoFlow — pipeline pace dialog (the t1009 product face).
 *
 * "How fast does this pipeline actually run?" — the project's completed
 * jobs carry the engine's REAL elapsed in their `duration` column (the
 * mock writes `Math.max(1000, elapsed)` at completion), so the pace face
 * is honest clock arithmetic, not a simulation readout: per-stage
 * aggregate bars in the chain's own first-run order, the stage table
 * (runs / median / longest / total), the wall time from the first start
 * to the last finish, and the failure band that lists its names without
 * claiming their time (a run that never started owns no minutes).
 *
 * THE DOORS: the project dashboard's per-card gauge button (the primary,
 * per-project) and the command palette's "Pipeline pace" item (the
 * active project). Both mount this dialog; both pass an id.
 *
 * THE A11Y SHAPE: the load flight speaks aria-busy (no disabled face —
 * the census's tally-pin units hold), the stage table is a real <table>
 * with th scope=col, the bars are aria-hidden pictures whose numbers are
 * always printed as text (the value never lives in the bar alone), and
 * the empty world gets an honest face ("nothing has run yet") rather
 * than a zeroed table.
 *
 * THE EXPORT FAMILY: the stage table rides ChartExportButtons (CSV /
 * TSV / PNG, the four-doors-one-truth law) with getRows() mapped from
 * the same stages array the bars render — one source, every sink.
 *
 * THE SUBCHAIN ARM (t1016): when the caller hands the WIRES alongside
 * the jobs (the canvas's internal edges — wires whose both endpoints
 * are in the selection), the face also walks the CRITICAL CHAIN within
 * the selection: the same backward walk the analytics page's fifth
 * face runs project-wide (lib/critical-path, t681), scoped to the
 * picked subgraph, drinking the same honest windows (lib/timeline-walk
 * — never raw duration). A single step is not a chain — the band stays
 * silent unless the walk found a dependency to speak of, and it
 * confesses its scope ("within the selection", the t687 law): a scoped
 * chain is a chain within the scope, not "the" one.
 */

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import {
  onEscapeClose,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChartExportButtons } from "@/components/workflow/results/chart-export-buttons";
import { fetchJsonRetry } from "@/lib/retry-fetch";
import { computePace } from "@/lib/pace";
import { criticalPath, type CriticalEdge } from "@/lib/critical-path";
import { walkTimeline } from "@/lib/timeline-walk";
import { Gauge, Loader2, Route, TriangleAlert } from "lucide-react";
import { formatElapsed } from "@/lib/elapsed";

type PaceJobInput = {
  id: string;
  name: string;
  type: string;
  status: string;
  duration: number;
  startedAt: string | null;
};
type PaceStage = {
  type: string;
  count: number;
  totalMs: number;
  medianMs: number;
  minMs: number;
  maxMs: number;
};
type PaceRow = {
  id: string;
  name: string;
  type: string;
  durationMs: number;
  startedAt: string | null;
  finishedAt: string | null;
};
type PaceTotals = {
  completed: number;
  failed: number;
  running: number;
  idle: number;
  totalMs: number;
  wallMs: number | null;
  medianMs: number | null;
};
type PaceResponse = {
  projectId: string;
  totals: PaceTotals;
  stages: PaceStage[];
  rows: PaceRow[];
  failed: { id: string; name: string; type: string }[];
};

export function PaceDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  jobs,
  edges,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  projectId: string | null;
  projectName: string | null;
  /** t1010 — the SELECTION well: when the caller already holds the job
   *  rows (the canvas toolbar's pace button), the face computes locally
   *  from the same lib — no fetch, one truth, two transports. The shape
   *  is the computePace input verbatim (the JobDTO reads as-is). */
  jobs?: PaceJobInput[];
  /** t1016 — the SELECTION's wires: the canvas's internal edges (both
   *  endpoints in the selection). Their presence arms the subchain
   *  critical walk; their absence (the project and palette doors) keeps
   *  the face exactly as it was — one prop, zero behavior change. */
  edges?: CriticalEdge[];
}) {
  const [data, setData] = React.useState<PaceResponse | null>(null);
  const [error, setError] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  // the local well — recompute when the open flips or the selection moves
  React.useEffect(() => {
    if (!open || !jobs) return;
    setError(false);
    setData({ projectId: "", ...computePace(jobs) });
  }, [open, jobs]);

  React.useEffect(() => {
    if (!open || !projectId || jobs) return;
    let cancelled = false;
    setData(null);
    setError(false);
    (async () => {
      try {
        const body = await fetchJsonRetry<PaceResponse>(
          `/api/projects/${projectId}/pace`,
          { init: { cache: "no-store" } }
        );
        if (!cancelled) setData(body);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  // t1016 — the subchain walk: the critical chain WITHIN the selection,
  // from the same honest windows the timeline drinks (a running job's
  // window stretches to the reading's now; a never-started job owns no
  // window and is walked past, never invented). The walk reads the
  // caller's own wires, so the chain can never disagree with the canvas
  // about what connects to what. A single step is not a chain.
  const subchain = React.useMemo(() => {
    if (!open || !jobs || !edges || edges.length === 0) return null;
    const walk = walkTimeline(jobs, Date.now());
    if (walk.rows.length === 0) return null;
    const crit = criticalPath(walk.rows, edges);
    return crit && crit.chain.length >= 2 ? crit : null;
  }, [open, jobs, edges]);
  const subchainRunning =
    subchain?.chain[subchain.chain.length - 1]?.job.status === "running";

  const maxStage = data?.stages.reduce((max, s) => Math.max(max, s.maxMs), 0) ?? 0;
  const hasFaces = (data?.totals.completed ?? 0) + (data?.totals.failed ?? 0) > 0;
  const titleName = jobs
    ? `selection (${jobs.length} job${jobs.length === 1 ? "" : "s"})`
    : projectName ?? "…";

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent
        className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"
        onKeyDown={onEscapeClose(() => onOpenChange(false))}
        aria-busy={open && !data && !error}
        data-canvas-ui="pipeline-pace-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gauge className="size-4 text-primary" aria-hidden="true" />
            Pipeline pace · {titleName}
          </DialogTitle>
          <DialogDescription>
            How fast this pipeline actually runs — every completed job&apos;s
            real elapsed time, aggregated per stage in the order the chain
            first ran them. Bar length is proportional to duration; the
            numbers are always printed, so a dominating stage reads as one.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/[0.06] p-2.5 text-[11px] leading-relaxed text-destructive dark:text-destructive-foreground">
            The pace face could not be loaded — the request failed. Retry by
            reopening the dialog.
          </div>
        ) : null}

        {data ? (
          !hasFaces ? (
            <div className="flex h-32 flex-col items-center justify-center gap-1.5 text-center text-muted-foreground">
              <Gauge className="size-5 opacity-50" aria-hidden="true" />
              <p className="text-xs font-medium">Nothing has run yet</p>
              <p className="max-w-sm text-[11px] leading-relaxed opacity-80">
                The pace face appears once the first job finishes — a stage
                only speaks after it has a completed run to answer for.
              </p>
            </div>
          ) : (
            <>
              {/* the totals band — the clock facts first */}
              <div
                className="flex flex-wrap items-center gap-1.5"
                data-canvas-ui="pipeline-pace-stats"
              >
                <Badge variant="outline" className="border text-[10px]">
                  {data.totals.completed} completed
                </Badge>
                <Badge variant="outline" className="border text-[10px] tabular-nums">
                  total compute {formatElapsed(data.totals.totalMs)}
                </Badge>
                {data.totals.wallMs != null ? (
                  <Badge variant="outline" className="border text-[10px] tabular-nums">
                    wall time {formatElapsed(data.totals.wallMs)}
                  </Badge>
                ) : null}
                {data.totals.medianMs != null ? (
                  <Badge variant="outline" className="border text-[10px] tabular-nums">
                    median run {formatElapsed(data.totals.medianMs)}
                  </Badge>
                ) : null}
                {data.totals.failed > 0 ? (
                  <Badge
                    variant="outline"
                    className="border border-destructive/30 text-[10px] text-destructive dark:text-destructive-foreground"
                  >
                    {data.totals.failed} failed
                  </Badge>
                ) : null}
                {data.totals.running > 0 ? (
                  <Badge variant="outline" className="border border-running/40 text-[10px] text-running">
                    {data.totals.running} running
                  </Badge>
                ) : null}
                {data.totals.idle > 0 ? (
                  <Badge variant="outline" className="border text-[10px] text-muted-foreground">
                    {data.totals.idle} ready
                  </Badge>
                ) : null}
              </div>

              {/* the subchain band — the critical chain WITHIN the selection
                  (t1016): only when the caller armed it with wires and the
                  walk found a real dependency chain. The scope is confessed
                  in the words (the t687 law), the numbers are printed (the
                  picture never carries the fact alone), and a live finisher
                  confesses its open window. */}
              {subchain ? (
                <div
                  className="rounded-lg border border-primary/25 bg-primary/[0.04] p-2.5"
                  data-canvas-ui="pipeline-pace-critical"
                  data-critical-steps={subchain.chain.length}
                  data-critical-span={subchain.spanMs}
                  data-critical-busy={subchain.busyMs}
                  data-critical-finisher={subchain.chain[subchain.chain.length - 1].job.id}
                >
                  <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-foreground/90">
                    <Route className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                    Critical chain within the selection
                    <span className="font-normal text-muted-foreground">
                      · {subchain.chain.length} step{subchain.chain.length === 1 ? "" : "s"} ·{" "}
                      {formatElapsed(subchain.spanMs)} span
                    </span>
                    <span
                      className="ml-auto rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[9.5px] font-semibold text-primary"
                      title={`The selection's finish was set by ${
                        subchain.chain[subchain.chain.length - 1].job.name
                      } — every step here is a dependency it (transitively) waited on`}
                    >
                      ends with: {subchain.chain[subchain.chain.length - 1].job.name}
                    </span>
                  </p>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                    the chain the selection&apos;s finish actually waited on · ran{" "}
                    {formatElapsed(subchain.busyMs)}
                    {subchain.gapMs > 0
                      ? ` + waited ${formatElapsed(subchain.gapMs)}`
                      : subchain.gapMs < 0
                        ? ` \u2212 overlapped ${formatElapsed(-subchain.gapMs)}`
                        : " + waited 0s"}
                    {" = "}
                    {formatElapsed(subchain.spanMs)} span
                    {subchainRunning
                      ? " — the finisher is still running, its window stretches to now"
                      : ""}
                  </p>
                </div>
              ) : null}

              {/* the chain bars — per stage, first-run order; the number is
                  always printed beside the bar (the picture never carries
                  the fact alone) */}
              <section
                aria-label="Per-stage durations, chain order"
                data-canvas-ui="pipeline-pace-bars"
                className="rounded-lg border border-border/60 bg-muted/30 p-3"
              >
                <ol className="space-y-1.5">
                  {data.stages.map((s) => (
                    <li key={s.type} className="flex items-center gap-2">
                      <span className="w-24 shrink-0 truncate font-mono text-[10px] text-muted-foreground">
                        {s.type}
                        {s.count > 1 ? ` ×${s.count}` : ""}
                      </span>
                      <span
                        aria-hidden="true"
                        className="h-2.5 shrink rounded-full bg-gradient-to-r from-primary/70 to-primary/40"
                        style={{
                          width: `${
                            maxStage > 0
                              ? Math.max(2, (s.maxMs / maxStage) * 100) * 0.55
                              : 2
                          }%`,
                        }}
                      />
                      <span className="whitespace-nowrap text-[10px] tabular-nums text-foreground/80">
                        {s.count > 1 ? `median ${formatElapsed(s.medianMs ?? 0)} · ` : ""}
                        longest {formatElapsed(s.maxMs)}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>

              {/* the stage table — the export family's rows */}
              <section
                aria-label="Stage duration table"
                data-chart-export-root
                data-canvas-ui="pipeline-pace-table"
                className="rounded-lg border border-border/60"
              >
                <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
                  <h3 className="text-[11px] font-semibold text-foreground/90">
                    Stage durations
                  </h3>
                  <ChartExportButtons
                    name="Pipeline pace"
                    getRows={() =>
                      data.stages.map((s) => ({
                        stage: s.type,
                        runs: s.count,
                        "median (s)": s.medianMs != null ? Math.round(s.medianMs / 100) / 10 : "",
                        "longest (s)": Math.round(s.maxMs / 100) / 10,
                        "total (s)": Math.round(s.totalMs / 100) / 10,
                      }))
                    }
                    className="ml-auto"
                  />
                </div>
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-border/60 text-muted-foreground">
                      <th scope="col" className="px-3 py-1.5 font-medium">Stage</th>
                      <th scope="col" className="px-3 py-1.5 font-medium">Runs</th>
                      <th scope="col" className="px-3 py-1.5 font-medium">Median</th>
                      <th scope="col" className="px-3 py-1.5 font-medium">Longest</th>
                      <th scope="col" className="px-3 py-1.5 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.stages.map((s) => (
                      <tr
                        key={s.type}
                        className="border-b border-border/40 last:border-b-0 hover:bg-muted/40"
                      >
                        <td className="px-3 py-1.5 font-mono text-[10px]">{s.type}</td>
                        <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{s.count}</td>
                        <td className="px-3 py-1.5 tabular-nums">
                          {s.medianMs != null ? formatElapsed(s.medianMs) : "—"}
                        </td>
                        <td className="px-3 py-1.5 tabular-nums">{formatElapsed(s.maxMs)}</td>
                        <td className="px-3 py-1.5 tabular-nums text-muted-foreground">
                          {formatElapsed(s.totalMs)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              {/* the live band — running jobs' elapsed (mounted-gated; the
                  clock is a client fact) */}
              {data.totals.running > 0 && mounted ? (
                <p className="text-[11px] text-muted-foreground">
                  {data.totals.running} job{data.totals.running === 1 ? "" : "s"} running
                  right now — their elapsed clocks live on the canvas cards.
                </p>
              ) : null}

              {/* the failure band — names without clock claims */}
              {data.failed.length > 0 ? (
                <div
                  className="rounded-md border border-destructive/25 bg-destructive/[0.04] p-2.5 text-[11px] leading-relaxed text-destructive dark:text-destructive-foreground"
                  data-canvas-ui="pipeline-pace-failed"
                >
                  <p className="flex items-center gap-1.5 font-medium">
                    <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
                    {data.failed.length} failed attempt{data.failed.length === 1 ? "" : "s"} — their
                    time is not claimed
                  </p>
                  <p className="mt-1 opacity-80">
                    {data.failed.map((f) => f.name).join(" · ")}
                  </p>
                </div>
              ) : null}
            </>
          )
        ) : !error ? (
          <div
            className="flex h-40 items-center justify-center text-muted-foreground"
            aria-hidden="true"
          >
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

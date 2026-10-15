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
 * the same stages array the bars render — one source, every sink. The
 * chain band carries its own face (t1019) with png={false}: a roster is
 * a LIST, no <svg> to rasterize, so it ships the two DATA doors and the
 * PNG doors stay ABSENT (never disabled — the tally law's only shape);
 * its getRows() maps the same chainWalk.chain the roster renders, and
 * the root's gap cell is empty (the i > 0 gate made law in the file).
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
import {
  criticalPath,
  summarizeCritical,
  type CriticalEdge,
  type CriticalPathSummary,
} from "@/lib/critical-path";
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
  /** t1017 — the project's critical chain, walked server-side by the
   *  same libs the selection memo runs client-side (one shape, one
   *  truth — CriticalPathSummary). null = no wired chain to speak of. */
  critical: CriticalPathSummary | null;
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
  // (critical: null here — the selection's own chain lives in the memo,
  // the two never double-speak)
  React.useEffect(() => {
    if (!open || !jobs) return;
    setError(false);
    setData({ projectId: "", critical: null, ...computePace(jobs) });
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
  // t1017 — the projection is the SAME summarizeCritical the route
  // ships, so both transports hand the band one shape.
  const subchain = React.useMemo(() => {
    if (!open || !jobs || !edges || edges.length === 0) return null;
    const walk = walkTimeline(jobs, Date.now());
    if (walk.rows.length === 0) return null;
    const crit = criticalPath(walk.rows, edges);
    return crit && crit.chain.length >= 2 ? summarizeCritical(crit) : null;
  }, [open, jobs, edges]);
  // t1017 — the two transports, one band: the selection memo (the
  // canvas door) or the route's server-side walk (the project and
  // palette doors). The scope word differs with the door; the walk,
  // the projection and the gate do not.
  const chainWalk = subchain ?? data?.critical ?? null;
  const chainIsSelection = subchain != null;
  const chainFinisher = chainWalk?.chain[chainWalk.chain.length - 1] ?? null;
  const subchainRunning = chainFinisher?.status === "running";

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

              {/* the critical-chain band — the t1016 selection arm and the
                  t1017 project arm speak through ONE renderer: only when a
                  transport armed it with a real wired chain (the ≥2 gate at
                  both ends). The scope is confessed in the words (the t687
                  law), the numbers are printed (the picture never carries
                  the fact alone), and a live finisher confesses its open
                  window. */}
              {chainWalk && chainFinisher ? (
                <div
                  className="rounded-lg border border-primary/25 bg-primary/[0.04] p-2.5"
                  data-canvas-ui="pipeline-pace-critical"
                  data-critical-steps={chainWalk.chain.length}
                  data-critical-span={chainWalk.spanMs}
                  data-critical-busy={chainWalk.busyMs}
                  data-critical-finisher={chainFinisher.id}
                >
                  <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-medium text-foreground/90">
                    <Route className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                    {chainIsSelection
                      ? "Critical chain within the selection"
                      : "Critical chain of this project"}
                    <span className="font-normal text-muted-foreground">
                      · {chainWalk.chain.length} step{chainWalk.chain.length === 1 ? "" : "s"} ·{" "}
                      {formatElapsed(chainWalk.spanMs)} span
                    </span>
                    <span
                      className="ml-auto rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[9.5px] font-semibold text-primary"
                      title={`The ${
                        chainIsSelection ? "selection's" : "project's"
                      } finish was set by ${chainFinisher.name} — every step here is a dependency it (transitively) waited on`}
                    >
                      ends with: {chainFinisher.name}
                    </span>
                  </p>
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] leading-relaxed text-muted-foreground">
                    <p className="min-w-0 flex-1">
                      the chain the {chainIsSelection ? "selection's" : "project's"} finish actually
                      waited on · ran {formatElapsed(chainWalk.busyMs)}
                      {chainWalk.gapMs > 0
                        ? ` + waited ${formatElapsed(chainWalk.gapMs)}`
                        : chainWalk.gapMs < 0
                          ? ` \u2212 overlapped ${formatElapsed(-chainWalk.gapMs)}`
                          : " + waited 0s"}
                      {" = "}
                      {formatElapsed(chainWalk.spanMs)} span
                      {subchainRunning
                        ? " — the finisher is still running, its window stretches to now"
                        : ""}
                    </p>
                    {/* the roster's data doors (t1019) — the same export
                        family at the chain's scale: a list owns no <svg>,
                        so png={false} ships the two DATA doors and the PNG
                        doors stay absent (never disabled). getRows maps the
                        SAME chainWalk.chain the roster renders — one
                        source, every sink; the root's gap cell is empty
                        (the i > 0 gate made law in the file). */}
                    <ChartExportButtons
                      name="Critical chain"
                      png={false}
                      getRows={() =>
                        chainWalk.chain.map((s, i) => ({
                          step: i + 1,
                          job: s.name,
                          status: s.status,
                          "window (s)": Math.round(s.ms / 100) / 10,
                          "gap before (s)":
                            i > 0 && s.gapBeforeMs != null
                              ? Math.round(s.gapBeforeMs / 100) / 10
                              : "",
                        }))
                      }
                      className="shrink-0"
                    />
                  </div>
                  {/* the step roster (t1018) — the chain's own order at dialog
                      scale: rank, name, the printed window (the picture never
                      carries the fact alone), and the gap this step waited
                      before starting (the analytics face's gap-row dialect;
                      the root owns no gap). A running step confesses "so
                      far" — its window stretches to the reading's now. Both
                      transports feed chainWalk.chain, so the roster speaks
                      for the selection arm and the project arm alike. */}
                  <ol
                    className="mt-1.5 space-y-0.5 border-t border-primary/15 pt-1.5"
                    data-canvas-ui="pipeline-pace-critical-roster"
                  >
                    {chainWalk.chain.map((s, i) => (
                      <li
                        key={s.id}
                        className="flex items-center gap-1.5 text-[10px]"
                        data-critical-row={s.id}
                        data-critical-index={i}
                        data-critical-gap={s.gapBeforeMs}
                      >
                        <span className="w-3.5 shrink-0 text-right font-mono text-muted-foreground/60">
                          {i + 1}.
                        </span>
                        <span className="truncate font-medium text-foreground/85">{s.name}</span>
                        {s.status === "running" ? (
                          <span className="shrink-0 text-running">so far</span>
                        ) : null}
                        <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                          {formatElapsed(s.ms)}
                        </span>
                        <span className="w-[86px] shrink-0 text-right tabular-nums text-muted-foreground/60">
                          {i > 0 && s.gapBeforeMs != null
                            ? s.gapBeforeMs > 0
                              ? `+ waited ${formatElapsed(s.gapBeforeMs)}`
                              : s.gapBeforeMs < 0
                                ? `\u2212 overlapped ${formatElapsed(-s.gapBeforeMs)}`
                                : "+ waited 0s"
                            : ""}
                        </span>
                      </li>
                    ))}
                  </ol>
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

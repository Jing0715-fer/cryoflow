"use client";

/**
 * CryoFlow — the run A/B dialog (t439, generalized t440).
 *
 * One question, two domains, ONE face: "I changed a preprocessing
 * parameter — did the output actually get better?" The FSC face has
 * had its overlay since Task 62; the params face its diff since Task
 * 88. This dialog is the per-micrograph verdict between two runs of
 * the SAME stage — CTF estimation (t439) and Motion Correction (t440)
 * — built on the shared verdict brain (lib/paired-compare.ts).
 *
 * The face's laws:
 *   - THE DOMAIN IS A SPEC, NOT A COPY: ctf/motion differ only in the
 *     row fetch, the lenses and the trust line — one dialog, one set
 *     of interaction bugs, one set of styles.
 *   - PAIRED OR SILENT (the core's law, surfaced here): unpaired
 *     micrographs show as honest amber chips ("unpaired: N in A · M in
 *     B"), never as votes.
 *   - THE IDENTITY LINE IS THE JUDGE: B above the 45° line beat A (or
 *     lost, when the lens says lower is better) — the three scatter
 *     series are pre-split by kind so the palette never lies.
 *   - THE HOST LEADS: opens with the inspecting job as run A; both runs
 *     stay switchable. NO PERSISTENCE — an A/B is a question about the
 *     CURRENT pair; reopening starts from the host again (fsc-compare's
 *     remembered pair is a curves question, not a verdict question).
 *   - THE DOOR GUARDS ITSELF: entries render nothing unless the host is
 *     a completed run of the domain's type AND a completed sibling
 *     exists (the SiblingComparePicker guard, mirrored per domain).
 */

import { useEffect, useMemo, useState } from "react";
import { ChartScatter, GitBranch, GitCompareArrows, ListX, Loader2, TriangleAlert } from "lucide-react";
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkflowStore } from "@/lib/store";
import type { JobDTO } from "@/lib/types";
import { jobType } from "@/lib/workflow";
import { planAdoption } from "@/lib/adopt-branch";
import {
  fmtDelta,
  joinByName,
  pairedDeltas,
  scatterDomain,
  topMovers,
  verdict,
  type LensSpec,
  type Pair,
} from "@/lib/paired-compare";
import { CTF_LENSES, defocusAgreement, type CtfRunRow } from "@/lib/ctf-compare";
import { MOTION_LENSES, type MotionRunRow } from "@/lib/motion-compare";

/* ------------------------------------------------------------------ */
/* The domain specs — everything that differs between the two faces.   */
/* ------------------------------------------------------------------ */

interface CompareDomainSpec<R> {
  /** Spoken in the heading ("CTF A/B — FOM", "Motion A/B — Total drift"). */
  label: string;
  /** Which job types carry this domain's data (the inspector's own gate). */
  typeGate: RegExp;
  fetchRows(jobId: string): Promise<R[]>;
  lenses: Record<string, LensSpec<R>>;
  defaultLens: string;
  /** The pairing's own health check — pre-formatted, null hides it. */
  trustLine?(pairs: Pair<R, R>[]): string | null;
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Origin: window.location.origin },
  });
  if (!res.ok) throw new Error(`route said ${res.status}`);
  return res.json();
}

const CTF_SPEC: CompareDomainSpec<CtfRunRow> = {
  label: "CTF",
  typeGate: /ctffind|ctf/i,
  fetchRows: async (id) => {
    const data = (await fetchJson(`/api/jobs/${id}/ctf`)) as {
      micrographs?: CtfRunRow[];
    };
    return data.micrographs ?? [];
  },
  lenses: CTF_LENSES,
  defaultLens: "fom",
  trustLine: (pairs) => {
    const v = defocusAgreement(pairs);
    return `Defocus agreement: median |Δ| = ${
      Number.isFinite(v) ? `${v.toFixed(3)} µm` : "—"
    } across ${pairs.length} paired micrographs — the pairing's own health check.`;
  },
};

const MOTION_SPEC: CompareDomainSpec<MotionRunRow> = {
  label: "Motion",
  typeGate: /motioncorr|motion/i,
  fetchRows: async (id) => {
    const data = (await fetchJson(`/api/jobs/${id}/motion`)) as {
      micrographs?: MotionRunRow[];
    };
    return data.micrographs ?? [];
  },
  lenses: MOTION_LENSES,
  defaultLens: "total",
  // no trust line: motion rows are computed by the same per-micrograph
  // pipeline pass — count agreement (the unpaired chips) is the pairing
  // health this domain needs
};

/* ------------------------------------------------------------------ */
/* The door — an icon button beside the params-compare one.            */
/* ------------------------------------------------------------------ */

export function RunCompareEntry<R extends { name: string }>({
  job,
  spec,
}: {
  job: JobDTO;
  spec: CompareDomainSpec<R>;
}) {
  const jobs = useWorkflowStore((s) => s.jobs);
  const [open, setOpen] = useState(false);
  const siblingCount = useMemo(
    () => siblingsOf(job, jobs, spec).length,
    [job, jobs, spec],
  );
  const eligible =
    siblingCount > 0 && job.status === "completed" && spec.typeGate.test(job.type);
  if (!eligible) return null;
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 rounded-md text-muted-foreground/70 hover:bg-muted hover:text-foreground"
        aria-label={`${spec.label} A/B — compare with another completed run (${siblingCount} sibling runs available)`}
        title={`${spec.label} A/B — paired per-micrograph verdict between two completed runs: did the output actually move?`}
        onClick={() => setOpen(true)}
      >
        <ChartScatter className="size-3.5" aria-hidden="true" />
      </Button>
      <RunCompareDialog open={open} onOpenChange={setOpen} hostJob={job} spec={spec} />
    </>
  );
}

function siblingsOf<R extends { name: string }>(
  job: JobDTO,
  jobs: JobDTO[],
  spec: CompareDomainSpec<R>,
): JobDTO[] {
  return jobs.filter(
    (j) => j.id !== job.id && j.status === "completed" && spec.typeGate.test(j.type),
  );
}

/** Back-compat doors (the inspector's imports stay stable across the
 *  t439→t440 generalization): same names, one face underneath. */
export function CtfCompareEntry({ job }: { job: JobDTO }) {
  return <RunCompareEntry job={job} spec={CTF_SPEC} />;
}
export function MotionCompareEntry({ job }: { job: JobDTO }) {
  return <RunCompareEntry job={job} spec={MOTION_SPEC} />;
}

/* ------------------------------------------------------------------ */
/* The face.                                                           */
/* ------------------------------------------------------------------ */

interface RunDialogProps<R> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hostJob: JobDTO;
  spec: CompareDomainSpec<R>;
}

function RunCompareDialog<R extends { name: string }>({
  open,
  onOpenChange,
  hostJob,
  spec,
}: RunDialogProps<R>) {
  const jobs = useWorkflowStore((s) => s.jobs);
  const workspaces = useWorkflowStore((s) => s.workspaces);
  const inspect = useWorkflowStore((s) => s.inspect);
  const edges = useWorkflowStore((s) => s.edges);
  const adoptDownstream = useWorkflowStore((s) => s.adoptDownstream);
  const adoptWithExclude = useWorkflowStore((s) => s.adoptWithExclude);
  const [adopting, setAdopting] = useState(false);
  /** t452 — the exclude combo's own flight flag: mint + wire + adopt is
   *  three round trips, and the door must not look dead while they run. */
  const [excluding, setExcluding] = useState(false);

  const [runAId, setRunAId] = useState(hostJob.id);
  const [runBId, setRunBId] = useState<string | null>(null);
  const [lensKey, setLensKey] = useState(spec.defaultLens);
  const [a, setA] = useState<R[] | null>(null);
  const [b, setB] = useState<R[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** the pair key the CURRENT a/b rows were fetched for — a mismatch
   *  with the selected pair IS the loading state (derived, no sync
   *  setState in the fetch effect). */
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  /** render-time adjust (params-diff's seenPair law): the dialog
   *  re-derives its whole pair state on each open — the host leads,
   *  nothing persists (see header: an A/B is a question about the
   *  CURRENT pair). */
  const [seenOpen, setSeenOpen] = useState(false);
  if (open !== seenOpen) {
    setSeenOpen(open);
    if (open) {
      setRunAId(hostJob.id);
      setRunBId(null);
      setLensKey(spec.defaultLens);
      setA(null);
      setB(null);
      setError(null);
      setLoadedKey(null);
    }
  }

  const wsName = (id: string | null | undefined) =>
    workspaces.find((w) => w.id === id)?.name ?? "";

  const candidates = useMemo(
    () => siblingsOf(hostJob, jobs, spec),
    [hostJob, jobs, spec],
  );
  const jobById = useMemo(() => new Map(jobs.map((j) => [j.id, j])), [jobs]);

  // run B derived: the FIRST candidate is the default — one click from a
  // verdict, zero effects (the user's explicit pick wins once made)
  const effectiveRunB = runBId ?? candidates[0]?.id ?? null;

  // the paired fetch — both runs in parallel; every setState happens in
  // the async continuation, the sync body only arms the fetch
  useEffect(() => {
    if (!open || !runAId || !effectiveRunB) return;
    let alive = true;
    const key = `${runAId}|${effectiveRunB}`;
    Promise.all([spec.fetchRows(runAId), spec.fetchRows(effectiveRunB)])
      .then(([ra, rb]) => {
        if (!alive) return;
        setA(ra);
        setB(rb);
        setError(null);
        setLoadedKey(key);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoadedKey(key); // release the spinner — the error speaks now
      });
    return () => {
      alive = false;
    };
  }, [open, runAId, effectiveRunB, spec]);

  const pairKey = `${runAId}|${effectiveRunB}`;
  const loading = Boolean(open && runAId && effectiveRunB && loadedKey !== pairKey);

  const lensSpec = spec.lenses[lensKey] ?? Object.values(spec.lenses)[0];
  const nameA = jobById.get(runAId)?.name ?? "Run A";
  const nameB = jobById.get(effectiveRunB ?? "")?.name ?? "Run B";

  const analysis = useMemo(() => {
    if (!a || !b) return null;
    const join = joinByName(a, b);
    const deltas = pairedDeltas(join.pairs, lensSpec);
    return {
      join,
      deltas,
      v: verdict(deltas),
      movers: topMovers(deltas),
      domain: scatterDomain(deltas),
    };
  }, [a, b, lensSpec]);

  const improvedSeries = analysis?.deltas.filter((d) => d.kind === "improved") ?? [];
  const regressedSeries = analysis?.deltas.filter((d) => d.kind === "regressed") ?? [];
  const tiedSeries = analysis?.deltas.filter((d) => d.kind === "tied") ?? [];
  const trustText = analysis && spec.trustLine ? spec.trustLine(analysis.join.pairs) : null;

  // t443 — the verdict's verb: what would adopting run B over run A's
  // downstream actually do? Derived from the live graph on every render
  // of the open dialog (the picker can produce A===B, A may be a leaf,
  // cycles/port mismatches are the graph's own truth) — the button's
  // honest disabled states are THIS plan, never a guess.
  const adoptionPlan = useMemo(
    () =>
      planAdoption({
        edges,
        jobs: jobs.map((j) => ({ id: j.id, type: j.type, name: j.name })),
        fromRunId: runAId,
        toRunId: effectiveRunB ?? "",
        outputPortsOf: (type) => (jobType(type)?.outputs ?? []).map((p) => p.name),
      }),
    [edges, jobs, runAId, effectiveRunB],
  );
  const adoptable =
    open &&
    !loading &&
    analysis != null &&
    !adoptionPlan.sameRun &&
    !adoptionPlan.noDownstream &&
    adoptionPlan.moves.length > 0;
  const adoptTitle = adoptionPlan.sameRun
    ? "Runs A and B are the same run — adoption needs two different runs"
    : adoptionPlan.noDownstream
      ? `${nameA} has no downstream jobs to re-wire`
      : adoptionPlan.moves.length === 0 && adoptionPlan.alreadyWired.length > 0
        ? `The downstream already consumes ${nameB} — nothing to adopt`
        : adoptionPlan.moves.length === 0 && adoptionPlan.refused.length > 0
          ? `All ${adoptionPlan.refused.length} downstream wire(s) refused — ${adoptionPlan.refused
              .map((r) => r.reason)
              .join(", ")}`
          : `Re-wires ${nameA}'s ${adoptionPlan.moves.length} downstream wire${adoptionPlan.moves.length === 1 ? "" : "s"} to ${nameB} — their current results stay until re-run`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-4 overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <GitCompareArrows className="size-4 text-primary" aria-hidden="true" />
            {spec.label} A/B — {lensSpec.label}
          </DialogTitle>
          <DialogDescription>
            Paired per-micrograph verdict between two completed runs — did the
            output actually move, and which micrographs moved it?
          </DialogDescription>
        </DialogHeader>

        {/* the pair pickers — the host leads, both stay switchable */}
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="min-w-0">
            <div className="mb-1 text-[11px] font-medium text-muted-foreground">Run A</div>
            <Select value={runAId} onValueChange={setRunAId}>
              <SelectTrigger className="h-8 w-full text-xs" aria-label="Run A">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={hostJob.id} className="text-xs">
                  {hostJob.name} (this run)
                </SelectItem>
                {candidates.map((j) => (
                  <SelectItem key={j.id} value={j.id} className="text-xs">
                    {j.name}
                    {wsName(j.workspaceId) ? ` · ${wsName(j.workspaceId)}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <div className="mb-1 text-[11px] font-medium text-muted-foreground">Run B</div>
            <Select
              value={effectiveRunB ?? ""}
              onValueChange={(v) => setRunBId(v)}
              disabled={candidates.length === 0}
            >
              <SelectTrigger className="h-8 w-full text-xs" aria-label="Run B">
                <SelectValue placeholder={candidates.length ? "Pick a run" : "No sibling runs"} />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((j) => (
                  <SelectItem key={j.id} value={j.id} className="text-xs">
                    {j.name}
                    {wsName(j.workspaceId) ? ` · ${wsName(j.workspaceId)}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {candidates.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
            No other completed {spec.label} run in this project yet — run the
            same stage again (with changed parameters or new inputs) and this
            dialog becomes the verdict.
          </div>
        ) : loading || !analysis ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
            <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
            The {spec.label.toLowerCase()} route refused: {error}
          </div>
        ) : (
          <>
            {/* lens chips */}
            <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Comparison metric">
              {Object.values(spec.lenses).map((l) => {
                const active = l.key === lensSpec.key;
                return (
                  <button
                    key={l.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setLensKey(l.key)}
                    className={
                      "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors " +
                      (active
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground")
                    }
                    title={
                      l.higherIsBetter
                        ? `${l.label} — higher is better`
                        : `${l.label} — lower is better`
                    }
                  >
                    {l.label}
                    <span className="ml-1 font-normal opacity-70">
                      {l.higherIsBetter ? "↑ better" : "↓ better"}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* the verdict chips — counts first, then the median */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-teal-600/10 px-2 py-0.5 font-medium text-teal-700 dark:text-teal-400">
                {analysis.v.improved} improved
              </span>
              <span className="rounded-full bg-rose-600/10 px-2 py-0.5 font-medium text-rose-700 dark:text-rose-400">
                {analysis.v.regressed} regressed
              </span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                {analysis.v.tied} unchanged
              </span>
              <span className="font-medium text-foreground">
                median Δ {fmtDelta(analysis.v.medianDelta, lensSpec.digits)}
                {lensSpec.unit}
              </span>
              <span className="text-muted-foreground">
                of {analysis.join.pairs.length} paired
              </span>
              {(analysis.join.onlyA.length > 0 || analysis.join.onlyB.length > 0) && (
                <span
                  className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-amber-700 dark:text-amber-400"
                  title={
                    `Only in A: ${analysis.join.onlyA.slice(0, 6).join(", ")}` +
                    (analysis.join.onlyA.length > 6 ? "…" : "") +
                    "\n" +
                    `Only in B: ${analysis.join.onlyB.slice(0, 6).join(", ")}` +
                    (analysis.join.onlyB.length > 6 ? "…" : "")
                  }
                >
                  unpaired: {analysis.join.onlyA.length} in A · {analysis.join.onlyB.length} in B
                </span>
              )}
            </div>

            {/* the identity scatter — above the 45° line, B beats A (or
                loses, when the lens says lower is better; the SERIES are
                pre-split by kind so the palette never lies) */}
            <div className="h-64 w-full rounded-lg border bg-card p-2">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis
                    type="number"
                    dataKey="a"
                    domain={analysis.domain}
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v: number) => v.toFixed(lensSpec.digits)}
                    name={`A · ${nameA}`}
                  />
                  <YAxis
                    type="number"
                    dataKey="b"
                    domain={analysis.domain}
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v: number) => v.toFixed(lensSpec.digits)}
                    width={52}
                    name={`B · ${nameB}`}
                  />
                  <ZAxis range={[36, 36]} />
                  <ReferenceLine
                    segment={[
                      { x: analysis.domain[0], y: analysis.domain[0] },
                      { x: analysis.domain[1], y: analysis.domain[1] },
                    ]}
                    stroke="currentColor"
                    strokeDasharray="4 4"
                    className="text-muted-foreground/60"
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    contentStyle={{ fontSize: 11 }}
                    formatter={(value, name) => [value, name]}
                    labelFormatter={() => ""}
                  />
                  <Scatter
                    name={`improved (${improvedSeries.length})`}
                    data={improvedSeries}
                    dataKey="b"
                    fill="#0d9488"
                    fillOpacity={0.75}
                  />
                  <Scatter
                    name={`regressed (${regressedSeries.length})`}
                    data={regressedSeries}
                    dataKey="b"
                    fill="#e11d48"
                    fillOpacity={0.75}
                  />
                  <Scatter
                    name={`unchanged (${tiedSeries.length})`}
                    data={tiedSeries}
                    dataKey="b"
                    fill="#94a3b8"
                    fillOpacity={0.6}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="-mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-teal-600" aria-hidden="true" /> improved
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-rose-600" aria-hidden="true" /> regressed
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-slate-400" aria-hidden="true" /> unchanged
              </span>
              <span>· dashed line = no change (B equals A)</span>
            </div>

            {/* the named witnesses — a verdict you can act on is names */}
            <div className="grid gap-3 sm:grid-cols-2">
              <MoverList
                title={`Biggest improvements (${lensSpec.label})`}
                deltas={analysis.movers.improvers}
                digits={lensSpec.digits}
                unit={lensSpec.unit}
                tone="teal"
              />
              <MoverList
                title={`Biggest regressions (${lensSpec.label})`}
                deltas={analysis.movers.regressors}
                digits={lensSpec.digits}
                unit={lensSpec.unit}
                tone="rose"
              />
            </div>

            {/* the trust line — the pairing's own health check */}
            {trustText ? (
              <div className="text-[11px] text-muted-foreground">{trustText}</div>
            ) : null}

            {/* the verdict's verb (left) and the doors (right) — adoption
                is a graph mutation, so it sits apart from the jumps and
                carries its own one-line contract */}
            <div className="space-y-1.5">
              {adoptable && (
                <div className="text-[11px] text-muted-foreground">
                  Adoption re-wires {nameA}&apos;s {adoptionPlan.moves.length} downstream{" "}
                  {adoptionPlan.moves.length === 1 ? "job" : "jobs"} to consume {nameB} — their
                  current results stay until re-run.
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 px-2 text-[11px]"
                    data-testid="adopt-downstream"
                    aria-label={
                      adoptable
                        ? `Continue downstream from ${nameB} — re-wires ${adoptionPlan.moves.length} of ${nameA}'s downstream jobs`
                        : `Continue downstream from run B — unavailable: ${adoptTitle}`
                    }
                    title={adoptTitle}
                    disabled={!adoptable || adopting}
                    onClick={() => {
                      if (!effectiveRunB) return;
                      setAdopting(true);
                      void adoptDownstream(runAId, effectiveRunB)
                        .catch(() => {
                          /* the store's own receipt spoke */
                        })
                        .finally(() => {
                          setAdopting(false);
                          onOpenChange(false); // the verb is done — the canvas shows the new wiring
                        });
                    }}
                  >
                    {adopting ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <GitBranch className="size-3.5 text-primary" aria-hidden="true" />
                    )}
                    Continue downstream from run B
                    {adoptionPlan.moves.length > 0 && (
                      <span className="font-semibold text-primary">({adoptionPlan.moves.length})</span>
                    )}
                  </Button>
                  {/* t452 — the verdict's consumer face: the regressed names
                      become an Exclude Micrographs filter consuming run B, and
                      run A's downstream re-parents onto the FILTER. Hidden
                      when nothing regressed (a no-op button is noise, the
                      t448 leaf-checkbox law); disabled with the adoption
                      plan's own reason when the graph can't adopt. */}
                  {regressedSeries.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 border-rose-300 px-2 text-[11px] hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950"
                      data-testid="adopt-with-exclude"
                      aria-label={
                        adoptable
                          ? `Continue downstream from ${nameB} with ${regressedSeries.length} regressed micrographs excluded — mints an Exclude Micrographs filter and re-wires ${adoptionPlan.moves.length} of ${nameA}'s downstream jobs onto it`
                          : `Continue downstream with these micrographs excluded — unavailable: ${adoptTitle}`
                      }
                      title={
                        adoptable
                          ? `Bakes the ${regressedSeries.length} regressed micrographs into an Exclude Micrographs filter consuming ${nameB} (editable in the filter's Exclusions tab), then re-wires ${nameA}'s ${adoptionPlan.moves.length} downstream wire${adoptionPlan.moves.length === 1 ? "" : "s"} onto the filter — results stay until re-run`
                          : adoptTitle
                      }
                      disabled={!adoptable || excluding}
                      onClick={() => {
                        if (!effectiveRunB) return;
                        setExcluding(true);
                        void adoptWithExclude(
                          runAId,
                          effectiveRunB,
                          regressedSeries.map((d) => d.name),
                        )
                          .catch(() => {
                            /* the store's own receipt spoke */
                          })
                          .finally(() => {
                            setExcluding(false);
                            onOpenChange(false); // the canvas shows the minted filter and the new wiring
                          });
                      }}
                    >
                      {excluding ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <ListX className="size-3.5 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                      )}
                      Continue downstream, excluding these
                      <span className="font-semibold text-rose-600 dark:text-rose-400">
                        ({regressedSeries.length})
                      </span>
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => {
                      onOpenChange(false);
                      inspect(runAId);
                    }}
                  >
                    Open run A
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => {
                      onOpenChange(false);
                      inspect(effectiveRunB);
                    }}
                    disabled={!effectiveRunB}
                  >
                    Open run B
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MoverList({
  title,
  deltas,
  digits,
  unit,
  tone,
}: {
  title: string;
  deltas: { name: string; a: number; b: number; delta: number }[];
  digits: number;
  unit: string;
  tone: "teal" | "rose";
}) {
  return (
    <div className="rounded-lg border p-2.5">
      <div
        className={
          "mb-1.5 text-[11px] font-medium " +
          (tone === "teal" ? "text-teal-700 dark:text-teal-400" : "text-rose-700 dark:text-rose-400")
        }
      >
        {title}
      </div>
      {deltas.length === 0 ? (
        <div className="text-[11px] text-muted-foreground">none — the whole pack moved the other way</div>
      ) : (
        <ul className="space-y-1">
          {deltas.map((d) => (
            <li key={d.name} className="flex items-baseline justify-between gap-2 text-[11px]">
              <span className="min-w-0 truncate text-foreground" title={d.name}>
                {d.name}
              </span>
              <span className="shrink-0 font-mono text-muted-foreground">
                {d.a.toFixed(digits)}
                {unit} → {d.b.toFixed(digits)}
                {unit}{" "}
                <span
                  className={
                    tone === "teal"
                      ? "font-medium text-teal-700 dark:text-teal-400"
                      : "font-medium text-rose-700 dark:text-rose-400"
                  }
                >
                  ({fmtDelta(d.delta, digits)}
                  {unit})
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

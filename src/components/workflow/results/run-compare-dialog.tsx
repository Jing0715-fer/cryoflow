"use client";

/**
 * CryoFlow — the run A/B dialog (t439, generalized t440).
 *
 * One question, three domains, ONE face: "I changed a preprocessing
 * parameter — did the output actually get better?" The FSC face has
 * had its overlay since Task 62; the params face its diff since Task
 * 88. This dialog is the per-row verdict between two runs of the SAME
 * stage — CTF estimation (t439), Motion Correction (t440) and 2D/3D
 * classification occupancy (t453) — built on the shared verdict brain
 * (lib/paired-compare.ts). Each domain speaks its own verdict words
 * (improved/regressed vs gained/lost/held) and owns its consumer verb
 * (exclude the regressors vs select the gains).
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
import { ChartScatter, GitBranch, GitCompareArrows, Grid2x2Check, ListX, Loader2, TriangleAlert } from "lucide-react";
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
  joinByName,
  pairedDeltas,
  scatterDomain,
  topMovers,
  verdict,
  DEFAULT_WORDS,
  type LensSpec,
  type Pair,
  type VerdictWords,
} from "@/lib/paired-compare";
import {
  IdentityScatter,
  LensChips,
  MoverList,
  VerdictChips,
} from "./compare-face";
import { CTF_LENSES, defocusAgreement, type CtfRunRow } from "@/lib/ctf-compare";
import { CLASS_LENSES, CLASS_WORDS, CLASS_DEFAULT_LENS, classRunRow, concentrationCensus, gainedClassNumbers, type ClassRunRow } from "@/lib/class-compare";
import { MOTION_LENSES, type MotionRunRow } from "@/lib/motion-compare";

/* ------------------------------------------------------------------ */
/* The domain specs — everything that differs between the two faces.   */
/* ------------------------------------------------------------------ */

interface CompareDomainSpec<R> {
  /** Spoken in the heading ("CTF A/B — FOM", "Motion A/B — Total drift",
   *  "Class A/B — Occupancy share"). */
  label: string;
  /** Which job types carry this domain's data (the inspector's own gate). */
  typeGate: RegExp;
  /** The opening line under the heading — each domain asks its own
   *  question, and the face says which one it is answering. */
  intro: string;
  /** The verdict's consumer verb this domain speaks (t452 exclude /
   *  t453 select): micrograph verdicts exclude their regressors, class
   *  verdicts select their gains. One spec, one verb. */
  verb: "exclude" | "select";
  /** The verdict's vocabulary (t453) — defaults to the micrograph
   *  domains' improved/regressed; the class domain speaks gained/lost. */
  words?: VerdictWords;
  fetchRows(jobId: string): Promise<R[]>;
  lenses: Record<string, LensSpec<R>>;
  defaultLens: string;
  /** The pairing's own health check — pre-formatted, null hides it. */
  trustLine?(pairs: Pair<R, R>[]): string | null;
  /** The select verb's payload (t453): the gained rows → the baked
   *  param's numbers. Only select domains carry it. */
  selectList?(gained: { name: string }[]): number[];
  /** The type the select/exclude verb MINTS (t453/t454): the rider's
   *  pre-click contract must be computed against the MINTED target's
   *  output ports (what downstream will actually consume), not run B's
   *  — a plan computed against B promises wires the minted target
   *  cannot feed. */
  adoptTargetType?: string;
  /** The door's own dialect (t454): the entry button's title used to
   *  hardcode "paired per-micrograph verdict" — a lie for the class
   *  domain's per-class rows. Each spec speaks its own units. */
  doorTitle: string;
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
  doorTitle: "paired per-micrograph verdict between two completed runs: did the output actually move?",
  intro:
    "Paired per-micrograph verdict between two completed runs — did the output actually move, and which micrographs moved it?",
  verb: "exclude",
  // t454 — the exclude rider's plan is computed against the MINTED
  // FILTER's ports (excludemg declares one output: micrographs), not
  // run B's. Today the names coincide for every micrograph domain, so
  // the plan is unchanged — the bench pins the equivalence; if an
  // output port ever drifts, the rider's contract stays honest.
  adoptTargetType: "excludemg",
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
  doorTitle: "paired per-micrograph verdict between two completed runs: did the output actually move?",
  intro:
    "Paired per-micrograph verdict between two completed runs — did the output actually move, and which micrographs moved it?",
  verb: "exclude",
  adoptTargetType: "excludemg",
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

/* t453 — the third domain. The classes route already answers per-class
 * occupancy for 2D AND 3D classifications; the rows rename cls → the
 * join's key. No trust line of the defocus kind — the concentration
 * census IS this domain's health check, and it speaks shares, not
 * agreements. The select verb rides on the host's OWN outputs: a host
 * that cannot feed every select2d mouth (a 3D classification has no
 * class-averages references) hides the rider instead of refusing it
 * after the click. */
const CLASS_SPEC: CompareDomainSpec<ClassRunRow> = {
  label: "Class",
  typeGate: /class2d|class3d/i,
  doorTitle: "paired per-class verdict between two completed runs: where did the particles go?",
  intro:
    "Paired per-class verdict between two completed classification runs — where did the particles go, and which classes did run B concentrate?",
  verb: "select",
  words: CLASS_WORDS,
  fetchRows: async (id) => {
    const data = (await fetchJson(`/api/jobs/${id}/classes`)) as {
      classes?: { cls: number; count: number; fraction: number }[];
    };
    return (data.classes ?? []).map(classRunRow);
  },
  lenses: CLASS_LENSES,
  defaultLens: CLASS_DEFAULT_LENS,
  trustLine: (pairs) => concentrationCensus(pairs),
  selectList: (gained) => gainedClassNumbers(gained),
  adoptTargetType: "select2d",
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
        title={`${spec.label} A/B — ${spec.doorTitle}`}
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
export function ClassCompareEntry({ job }: { job: JobDTO }) {
  return <RunCompareEntry job={job} spec={CLASS_SPEC} />;
}

/* ------------------------------------------------------------------ */
/* The face.                                                           */
/* ------------------------------------------------------------------ */

/** The adoption plan's one-line honest disabled/enabled state — shared
 *  by the plain adopt verb and the select rider (t453), each speaking
 *  about its OWN plan. */
function adoptionPlanTitle(
  plan: {
    sameRun: boolean;
    noDownstream: boolean;
    moves: unknown[];
    alreadyWired: unknown[];
    refused: { reason: string }[];
  },
  nameA: string,
  nameB: string,
): string {
  return plan.sameRun
    ? "Runs A and B are the same run — adoption needs two different runs"
    : plan.noDownstream
      ? `${nameA} has no downstream jobs to re-wire`
      : plan.moves.length === 0 && plan.alreadyWired.length > 0
        ? `The downstream already consumes ${nameB} — nothing to adopt`
        : plan.moves.length === 0 && plan.refused.length > 0
          ? `All ${plan.refused.length} downstream wire(s) refused — ${plan.refused
              .map((r) => r.reason)
              .join(", ")}`
          : `Re-wires ${nameA}'s ${plan.moves.length} downstream wire${plan.moves.length === 1 ? "" : "s"} to ${nameB} — their current results stay until re-run`;
}

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
  const adoptWithSelect = useWorkflowStore((s) => s.adoptWithSelect);
  const [adopting, setAdopting] = useState(false);
  /** t452 — the exclude combo's own flight flag: mint + wire + adopt is
   *  three round trips, and the door must not look dead while they run. */
  const [excluding, setExcluding] = useState(false);
  /** t453 — the select combo's flight flag (same three round trips,
   *  same law: the verb never looks dead mid-gesture). */
  const [selecting, setSelecting] = useState(false);

  /** The verdict's words (t453): the domain's own vocabulary, defaulted
   *  to the micrograph dialect — occupancy speaks gained/lost/held. */
  const words: VerdictWords = spec.words ?? DEFAULT_WORDS;
  /** The select rider's wiring gate (t453): the host's OWN outputs must
   *  cover every select2d mouth — a 3D classification has no class-
   *  averages references, and a rider that can only refuse after the
   *  click is noise (the t448 no-op law, port-shaped). */
  const selectWired = useMemo(() => {
    if (spec.verb !== "select") return false;
    const hostOutKinds = (jobType(hostJob.type)?.outputs ?? [])
      .map((o) => o.kind)
      .filter(Boolean) as string[];
    const selIns = jobType("select2d")?.inputs ?? [];
    return selIns.every(
      (i) => !i.accepts?.length || i.accepts.some((k) => hostOutKinds.includes(k)),
    );
  }, [spec, hostJob]);

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
  /** t453 — the select verb's payload: the domain parses its own gained
   *  rows into the baked param's numbers (sorted, deduped — a set). */
  const gainedList =
    spec.verb === "select" && spec.selectList ? spec.selectList(improvedSeries) : [];

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
  /** t453 — the SELECT rider's own plan: the verb adopts the MINTED
   *  SELECTION, not run B, so its ports are the selection's (a 2D Class
   *  Selection declares one output — particles). The plain adopt verb
   *  above keeps B's own shape; computing one plan for two targets made
   *  the rider's aria promise wires the selection refuses — caught live
   *  where the class graph's two mouths (classAverages + particles)
   *  split the difference. */
  const selectPlan = useMemo(() => {
    if (spec.verb !== "select" || !spec.adoptTargetType || !effectiveRunB) return null;
    return planAdoption({
      edges,
      jobs: jobs.map((j) => ({ id: j.id, type: j.type, name: j.name })),
      fromRunId: runAId,
      toRunId: effectiveRunB,
      outputPortsOf: (type) =>
        type === jobById.get(effectiveRunB)?.type
          ? (jobType(spec.adoptTargetType as string)?.outputs ?? []).map((p) => p.name)
          : (jobType(type)?.outputs ?? []).map((p) => p.name),
    });
  }, [spec, edges, jobs, runAId, effectiveRunB, jobById]);
  const adoptableSelect =
    selectPlan != null &&
    !selectPlan.sameRun &&
    !selectPlan.noDownstream &&
    selectPlan.moves.length > 0;
  /** t454 — the EXCLUDE rider's own plan, the select rider's law carried
   *  home to the micrograph domains: the verb adopts the MINTED FILTER
   *  (excludemg declares one output — micrographs), so the plan's ports
   *  are the filter's, not run B's. Today every micrograph domain's own
   *  output port has the same name and the two plans coincide (the bench
   *  pins the equivalence); if a port ever drifts, the rider's contract
   *  stays honest instead of over-promising. */
  const excludePlan = useMemo(() => {
    if (spec.verb !== "exclude" || !spec.adoptTargetType || !effectiveRunB) return null;
    return planAdoption({
      edges,
      jobs: jobs.map((j) => ({ id: j.id, type: j.type, name: j.name })),
      fromRunId: runAId,
      toRunId: effectiveRunB,
      outputPortsOf: (type) =>
        type === jobById.get(effectiveRunB)?.type
          ? (jobType(spec.adoptTargetType as string)?.outputs ?? []).map((p) => p.name)
          : (jobType(type)?.outputs ?? []).map((p) => p.name),
    });
  }, [spec, edges, jobs, runAId, effectiveRunB, jobById]);
  const adoptableExclude =
    excludePlan != null &&
    !excludePlan.sameRun &&
    !excludePlan.noDownstream &&
    excludePlan.moves.length > 0;
  const adoptable =
    open &&
    !loading &&
    analysis != null &&
    !adoptionPlan.sameRun &&
    !adoptionPlan.noDownstream &&
    adoptionPlan.moves.length > 0;
  const adoptTitle = adoptionPlanTitle(adoptionPlan, nameA, nameB);
  const selectTitle =
    selectPlan != null ? adoptionPlanTitle(selectPlan, nameA, nameB) : "";
  const excludeTitle =
    excludePlan != null ? adoptionPlanTitle(excludePlan, nameA, nameB) : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-4 overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <GitCompareArrows className="size-4 text-primary" aria-hidden="true" />
            {spec.label} A/B — {lensSpec.label}
          </DialogTitle>
          <DialogDescription>
            {spec.intro}
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
            {/* lens chips (the shared kit — one-lens domains hide them) */}
            <LensChips
              lenses={Object.values(spec.lenses)}
              activeKey={lensSpec.key}
              onPick={setLensKey}
            />

            {/* the verdict chips — counts first, then the median */}
            <VerdictChips
              v={analysis.v}
              words={words}
              digits={lensSpec.digits}
              unit={lensSpec.unit}
              pairsCount={analysis.join.pairs.length}
              onlyA={analysis.join.onlyA}
              onlyB={analysis.join.onlyB}
            />

            {/* the identity scatter — above the 45° line, B beats A (or
                loses, when the lens says lower is better; the SERIES are
                pre-split by kind so the palette never lies) — the shared
                kit's face, identical under both questions */}
            <IdentityScatter
              domain={analysis.domain}
              improved={improvedSeries}
              regressed={regressedSeries}
              tied={tiedSeries}
              words={words}
              nameA={nameA}
              nameB={nameB}
              digits={lensSpec.digits}
            />

            {/* the named witnesses — a verdict you can act on is names */}
            <div className="grid gap-3 sm:grid-cols-2">
              <MoverList
                title={`Biggest ${words.betterNoun} (${lensSpec.label})`}
                deltas={analysis.movers.improvers}
                digits={lensSpec.digits}
                unit={lensSpec.unit}
                tone="teal"
              />
              <MoverList
                title={`Biggest ${words.worseNoun} (${lensSpec.label})`}
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
                      plan's own reason when the graph can't adopt. Gated on
                      the domain's verb — a class verdict has no micrographs
                      to exclude (t453). */}
                  {spec.verb === "exclude" && regressedSeries.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 border-rose-300 px-2 text-[11px] hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950"
                      data-testid="adopt-with-exclude"
                      aria-label={
                        adoptableExclude
                          ? `Continue downstream from ${nameB} with ${regressedSeries.length} regressed micrographs excluded — mints an Exclude Micrographs filter and re-wires ${excludePlan?.moves.length} of ${nameA}'s downstream jobs onto it`
                          : `Continue downstream with these micrographs excluded — unavailable: ${excludeTitle}`
                      }
                      title={
                        adoptableExclude
                          ? `Bakes the ${regressedSeries.length} regressed micrographs into an Exclude Micrographs filter consuming ${nameB} (editable in the filter's Exclusions tab), then re-wires ${nameA}'s ${excludePlan?.moves.length} downstream wire${excludePlan?.moves.length === 1 ? "" : "s"} onto the filter — results stay until re-run`
                          : excludeTitle
                      }
                      disabled={!adoptableExclude || excluding}
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
                        <ListX className="size-3.5 text-danger" aria-hidden="true" />
                      )}
                      Continue downstream, excluding these
                      <span className="font-semibold text-danger">
                        ({regressedSeries.length})
                      </span>
                    </Button>
                  )}
                  {/* t453 — the class verdict's consumer face: the gained
                      classes become a 2D Class Selection consuming run B
                      (the numbers baked at birth into selectedClasses —
                      the list the dialog spoke IS the selection the
                      engine makes, one law), and run A's downstream
                      re-parents onto the SELECTION. Same laws as the
                      exclude rider: hidden when nothing gained, hidden
                      when the host can't feed every select2d mouth
                      (selectWired), disabled with the adoption plan's
                      own reason when the graph can't adopt. */}
                  {spec.verb === "select" && selectWired && improvedSeries.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 border-teal-300 px-2 text-[11px] hover:bg-teal-50 dark:border-teal-800 dark:hover:bg-teal-950"
                      data-testid="adopt-with-select"
                      aria-label={
                        adoptableSelect
                          ? `Continue downstream from ${nameB} with ${improvedSeries.length} gained classes selected — mints a 2D Class Selection consuming ${nameB} and re-wires ${selectPlan?.moves.length} of ${nameA}'s downstream jobs onto it`
                          : `Continue downstream with these classes selected — unavailable: ${selectTitle}`
                      }
                      title={
                        adoptableSelect
                          ? `Bakes the ${improvedSeries.length} gained classes into a 2D Class Selection consuming ${nameB} (editable in its Classes tab), then re-wires ${nameA}'s ${selectPlan?.moves.length} downstream wire${selectPlan?.moves.length === 1 ? "" : "s"} onto the selection — results stay until re-run`
                          : selectTitle
                      }
                      disabled={!adoptableSelect || selecting}
                      onClick={() => {
                        if (!effectiveRunB) return;
                        setSelecting(true);
                        void adoptWithSelect(runAId, effectiveRunB, gainedList)
                          .catch(() => {
                            /* the store's own receipt spoke */
                          })
                          .finally(() => {
                            setSelecting(false);
                            onOpenChange(false); // the canvas shows the minted selection and the new wiring
                          });
                      }}
                    >
                      {selecting ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Grid2x2Check className="size-3.5 text-running" aria-hidden="true" />
                      )}
                      Continue downstream, selecting these
                      <span className="font-semibold text-running">
                        ({improvedSeries.length})
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

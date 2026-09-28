"use client";

/**
 * CryoFlow — the CTF A/B dialog (t439): the preprocessing face's answer
 * to "which run actually fits better?"
 *
 * The FSC face has had its overlay since Task 62 (fsc-compare); the
 * params face has had its diff since Task 88. What sat between them —
 * "I changed a preprocessing parameter; did the FITS move?" — needed a
 * paired, per-micrograph verdict, because CTF quality is a DISTRIBUTION
 * over micrographs, not one number: run B can win on twenty micrographs
 * and quietly lose the four that matter.
 *
 * The brain is lib/ctf-compare.ts (pure, benched); this dialog is the
 * face. Its laws:
 *   - TWO FETCHES, NO NEW ROUTE: the per-job ctf route already speaks
 *     the per-micrograph truth; A and B are fetched in parallel and
 *     joined client-side on the micrograph name.
 *   - PAIRED OR SILENT: unpaired micrographs show as honest chips
 *     ("only in A — N"), never as votes.
 *   - THE IDENTITY LINE IS THE JUDGE: B above the 45° line beat A (for
 *     FOM); the two scatter series split improved/regressed so the eye
 *     reads the verdict before the tooltip.
 *   - THE HOST LEADS: the dialog opens with the inspecting job as run A
 *     — "compare THIS against something" — and both runs stay
 *     switchable (the host is a suggestion, not a cage).
 *   - NO PERSISTENCE: unlike the FSC overlay (which remembers last
 *     session's pair), a params A/B is a question about the CURRENT
 *     pair — reopening starts from the host again.
 */

import { useEffect, useMemo, useState } from "react";
import { ChartScatter, GitCompareArrows, Loader2, TriangleAlert } from "lucide-react";
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
import {
  CTF_LENSES,
  defocusAgreement,
  fmtDelta,
  joinCtfRuns,
  pairedDeltas,
  scatterDomain,
  topMovers,
  verdict,
  type CtfLens,
  type CtfRunRow,
} from "@/lib/ctf-compare";

interface CtfDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The inspecting job — run A's starting suggestion. */
  hostJob: JobDTO;
}

interface RunData {
  rows: CtfRunRow[];
}

async function fetchCtfRun(jobId: string): Promise<RunData> {
  const res = await fetch(`/api/jobs/${jobId}/ctf`, {
    headers: { Origin: window.location.origin },
  });
  if (!res.ok) throw new Error(`ctf route said ${res.status}`);
  const data = (await res.json()) as { micrographs?: CtfRunRow[] };
  return { rows: data.micrographs ?? [] };
}

/** run options: every COMPLETED CTF-bearing job in the project — the
 *  same type gate the inspector's CTF face uses (isCtfType). */
function ctfCandidates(jobs: JobDTO[], hostId: string): JobDTO[] {
  return jobs.filter(
    (j) => j.id !== hostId && j.status === "completed" && /ctffind|ctf/i.test(j.type),
  );
}

/** The inspector's door: an icon button beside the params-compare one,
 *  rendered ONLY when the host is a completed CTF run AND a sibling
 *  exists (the guard mirrors SiblingComparePicker's "renders nothing
 *  when this run has no twin"). The scatter icon vs the params door's
 *  GitCompareArrows: params door answers "what did I change", this door
 *  answers "what did it do". */
export function CtfCompareEntry({ job }: { job: JobDTO }) {
  const jobs = useWorkflowStore((s) => s.jobs);
  const [open, setOpen] = useState(false);
  const siblingCount = useMemo(
    () => ctfCandidates(jobs, job.id).length,
    [jobs, job.id],
  );
  const eligible =
    siblingCount > 0 && job.status === "completed" && /ctffind|ctf/i.test(job.type);
  if (!eligible) return null;
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 rounded-md text-muted-foreground/70 hover:bg-muted hover:text-foreground"
        aria-label={`Compare CTF fit quality with another completed run (${siblingCount} sibling runs available)`}
        title="CTF A/B — paired per-micrograph verdict between two CTF runs: did the fits actually move?"
        onClick={() => setOpen(true)}
      >
        <ChartScatter className="size-3.5" aria-hidden="true" />
      </Button>
      <CtfCompareDialog open={open} onOpenChange={setOpen} hostJob={job} />
    </>
  );
}

export function CtfCompareDialog({ open, onOpenChange, hostJob }: CtfDialogProps) {
  const jobs = useWorkflowStore((s) => s.jobs);
  const workspaces = useWorkflowStore((s) => s.workspaces);
  const inspect = useWorkflowStore((s) => s.inspect);

  const [runAId, setRunAId] = useState(hostJob.id);
  const [runBId, setRunBId] = useState<string | null>(null);
  const [lens, setLens] = useState<CtfLens>("fom");
  const [a, setA] = useState<CtfRunRow[] | null>(null);
  const [b, setB] = useState<CtfRunRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** the pair key the CURRENT a/b rows were fetched for — a mismatch
   *  with the selected pair IS the loading state (derived, no sync
   *  setState in the fetch effect). */
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  /** render-time adjust (params-diff's seenPair law): the dialog
   *  re-derives its whole pair state on each open→closed→open — the
   *  host leads, nothing persists (see header: an A/B is a question
   *  about the CURRENT pair). */
  const [seenOpen, setSeenOpen] = useState(false);
  if (open !== seenOpen) {
    setSeenOpen(open);
    if (open) {
      setRunAId(hostJob.id);
      setRunBId(null);
      setLens("fom");
      setA(null);
      setB(null);
      setError(null);
      setLoadedKey(null);
    }
  }

  const wsName = (id: string | null | undefined) =>
    workspaces.find((w) => w.id === id)?.name ?? "";

  const candidates = useMemo(
    () => ctfCandidates(jobs, hostJob.id),
    [jobs, hostJob.id],
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
    Promise.all([fetchCtfRun(runAId), fetchCtfRun(effectiveRunB)])
      .then(([ra, rb]) => {
        if (!alive) return;
        setA(ra.rows);
        setB(rb.rows);
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
  }, [open, runAId, effectiveRunB]);

  const pairKey = `${runAId}|${effectiveRunB}`;
  const loading = Boolean(open && runAId && effectiveRunB && loadedKey !== pairKey);

  const lensSpec = CTF_LENSES[lens];
  const nameA = jobById.get(runAId)?.name ?? "Run A";
  const nameB = jobById.get(effectiveRunB ?? "")?.name ?? "Run B";

  const analysis = useMemo(() => {
    if (!a || !b) return null;
    const join = joinCtfRuns(a, b);
    const deltas = pairedDeltas(join.pairs, lensSpec);
    return {
      join,
      deltas,
      v: verdict(deltas),
      movers: topMovers(deltas),
      agreement: defocusAgreement(join.pairs),
      domain: scatterDomain(deltas),
    };
  }, [a, b, lensSpec]);

  const improvedSeries = analysis?.deltas.filter((d) => d.kind === "improved") ?? [];
  const regressedSeries = analysis?.deltas.filter((d) => d.kind === "regressed") ?? [];
  const tiedSeries = analysis?.deltas.filter((d) => d.kind === "tied") ?? [];

  const deltaColor =
    lensSpec.higherIsBetter
      ? { improved: "#0d9488", regressed: "#e11d48" }
      : { improved: "#0d9488", regressed: "#e11d48" };
  // ↑ both directions share the palette — "improved" is always teal here
  //   because the LENS already knows which direction that is; the split
  //   is by kind, not by sign.

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-4 overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <GitCompareArrows className="size-4 text-primary" aria-hidden="true" />
            CTF A/B — {lensSpec.label}
          </DialogTitle>
          <DialogDescription>
            Paired per-micrograph verdict between two CTF estimation runs — did
            the fits actually move, and which micrographs moved them?
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
            No other completed CTF run in this project yet — run the same
            estimator again (with changed parameters or new inputs) and this
            dialog becomes the verdict.
          </div>
        ) : loading || !analysis ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
            <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
            The CTF route refused: {error}
          </div>
        ) : (
          <>
            {/* lens chips */}
            <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Comparison metric">
              {(Object.keys(CTF_LENSES) as CtfLens[]).map((k) => {
                const spec = CTF_LENSES[k];
                const active = k === lens;
                return (
                  <button
                    key={k}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setLens(k)}
                    className={
                      "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors " +
                      (active
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "text-muted-foreground hover:text-foreground")
                    }
                    title={
                      spec.higherIsBetter
                        ? `${spec.label} — higher is better`
                        : `${spec.label} — lower is better`
                    }
                  >
                    {spec.label}
                    <span className="ml-1 font-normal opacity-70">
                      {spec.higherIsBetter ? "↑ better" : "↓ better"}
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
                    fill={deltaColor.improved}
                    fillOpacity={0.75}
                  />
                  <Scatter
                    name={`regressed (${regressedSeries.length})`}
                    data={regressedSeries}
                    dataKey="b"
                    fill={deltaColor.regressed}
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

            {/* the trust line — defocus is physics, not verdict */}
            <div className="text-[11px] text-muted-foreground">
              Defocus agreement: median |Δ| ={" "}
              {Number.isFinite(analysis.agreement)
                ? `${analysis.agreement.toFixed(3)} µm`
                : "—"}{" "}
              across {analysis.join.pairs.length} paired micrographs — the
              pairing's own health check.
            </div>

            {/* the door — jump into either run's inspector */}
            <div className="flex justify-end gap-2">
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

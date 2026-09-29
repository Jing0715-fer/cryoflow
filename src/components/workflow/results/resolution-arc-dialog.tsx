"use client";

/**
 * CryoFlow — the resolution arc dialog (t456).
 *
 * The compare family's FIFTH question — the second that pairs one run
 * with ITSELF. t454 asked a classification "did you settle"; this one
 * asks a refinement "are you still sharpening?" The data plane is the
 * run's own model stars: every round's data_model_general carries
 * _rlnCurrentResolution (the FSC 0.143 crossing of that iteration — the
 * mock's t456 fidelity wrote it; a real RELION always did).
 *
 * The face's laws (family-inherited + domain-local):
 *   - THE FACE IS THE ARC: a line, not a scatter — the estimate per
 *     round IS the story, and its slope is the verdict. Lower is better;
 *     the descending curve is the sharpening.
 *   - THE PLATEAU LAW SPEAKS: when the last moves are all under the
 *     threshold, the verdict says "more iterations will not sharpen it"
 *     out loud — RELION's manual dialect has no convergence criterion of
 *     its own, so the reading supplies one (the honest anti-pattern to
 *     burning hours on a finished refinement).
 *   - THE VERDICT READS; THE VERB CONTINUES: the shared continue verb
 *     row (t455's, one presentation for two verdicts) extends a still-
 *     improving manual refinement — and for an auto-refine row it says
 *     why it stays absent (RELION owns that convergence).
 *   - THE DOOR GUARDS ITSELF: nothing renders unless the host is a
 *     completed 3D refinement AND its arc holds at least two rounds
 *     with estimates (a run that wrote no model stars has no arc).
 *   - NO PERSISTENCE: like every sibling, the reading restarts from the
 *     whole arc on reopen.
 */

import { useEffect, useState } from "react";
import { Loader2, Ruler, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { JobDTO } from "@/lib/types";
import {
  arcSummary,
  arcVerdict,
  biggestJump,
  PLATEAU_ANGSTROM,
  type ResolutionPoint,
} from "@/lib/resolution-arc";
import { roundLabel } from "@/lib/convergence";
import { ContinueVerbRow } from "./continue-verb-row";

/** The arc — the run's own estimates, ascending by round. */
async function fetchArc(jobId: string): Promise<ResolutionPoint[]> {
  const res = await fetch(`/api/jobs/${jobId}/resolution-arc`, {
    headers: { Origin: window.location.origin },
  });
  if (!res.ok) throw new Error(`route said ${res.status}`);
  const data = (await res.json()) as { rounds?: ResolutionPoint[] };
  return data.rounds ?? [];
}

/* ------------------------------------------------------------------ */
/* The door — beside the convergence one, the family's fifth question. */
/* ------------------------------------------------------------------ */

export function ResolutionArcEntry({ job }: { job: JobDTO }) {
  const [rounds, setRounds] = useState<ResolutionPoint[] | null>(null);
  const [open, setOpen] = useState(false);

  // One cheap cached GET per inspector mount of a refinement face — the
  // door cannot know whether an arc exists without asking (data fetching,
  // not state syncing).
  useEffect(() => {
    if (job.status !== "completed" || job.type !== "refine3d") {
      return;
    }
    let alive = true;
    fetchArc(job.id)
      .then((r) => {
        if (alive) setRounds(r);
      })
      .catch(() => {
        /* the door hides when the arc cannot be read */
      });
    return () => {
      alive = false;
    };
  }, [job.id, job.status, job.type]);

  if (!rounds || rounds.length < 2) return null; // no arc — no door, no noise
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 rounded-md text-muted-foreground/70 hover:bg-muted hover:text-foreground"
        aria-label={`Resolution arc — read this refinement's own FSC estimate across its ${rounds.length} iterations`}
        title="Resolution arc — one refinement, its own iterations: is the map still sharpening, or has the estimate plateaued?"
        onClick={() => setOpen(true)}
      >
        <Ruler className="size-3.5" aria-hidden="true" />
      </Button>
      <ResolutionArcDialog
        open={open}
        onOpenChange={setOpen}
        job={job}
        rounds={rounds}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* The face.                                                           */
/* ------------------------------------------------------------------ */

function ResolutionArcDialog({
  open,
  onOpenChange,
  job,
  rounds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: JobDTO;
  rounds: ResolutionPoint[];
}) {
  const data = rounds.map((p) => ({
    round: p.iteration,
    label: roundLabel(p.iteration),
    angstrom: p.resolution,
  }));
  const verdict = arcVerdict(rounds);
  const jump = biggestJump(rounds);
  const summary = arcSummary(rounds);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-4 overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Ruler className="size-4 text-primary" aria-hidden="true" />
            Resolution arc — {job.name}
          </DialogTitle>
          <DialogDescription>
            One refinement&apos;s own arc — the FSC 0.143 estimate each iteration
            wrote into its model star. The descending curve is the map
            sharpening; a flat tail is a refinement that has stopped improving.
          </DialogDescription>
        </DialogHeader>

        {/* the arc — one line, the whole story */}
        <div className="h-64 w-full rounded-lg border bg-card p-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
              <XAxis
                dataKey="round"
                tick={{ fontSize: 10 }}
                tickFormatter={(v: number) => `it${String(v).padStart(3, "0")}`}
                name="Iteration"
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={(v: number) => `${v.toFixed(0)} Å`}
                width={52}
                name="FSC 0.143 estimate"
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{ fontSize: 11 }}
                formatter={(value: number | string) => [
                  `${Number(value).toFixed(1)} Å`,
                  "estimate",
                ]}
                labelFormatter={(l: string) => l}
              />
              <Line
                type="monotone"
                dataKey="angstrom"
                stroke="#0d9488"
                strokeWidth={2}
                dot={{ r: 2.5, fill: "#0d9488" }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="-mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span>· x = the run&apos;s own iterations, y = the FSC 0.143 estimate (Å)</span>
          <span>· lower is better</span>
        </div>

        {/* the headline + the verdict — evidence first, word second */}
        {summary ? (
          <div className="text-xs text-foreground">{summary}</div>
        ) : null}
        {jump && jump.delta > 0 ? (
          <div className="text-[11px] text-muted-foreground">
            Biggest jump: {roundLabel(jump.from.iteration)} →{" "}
            {roundLabel(jump.to.iteration)} gained {jump.delta.toFixed(1)} Å.
          </div>
        ) : null}
        {verdict ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={
                "rounded-full px-2 py-0.5 font-medium " +
                (verdict.word === "plateaued"
                  ? "border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  : verdict.word === "still improving"
                    ? "bg-teal-600/10 text-teal-700 dark:text-teal-400"
                    : "bg-muted text-muted-foreground")
              }
            >
              {verdict.word}
            </span>
            <span className="text-muted-foreground">{verdict.detail}</span>
          </div>
        ) : (
          <div className="text-[11px] text-muted-foreground">
            Fewer than three estimates — the plateau law needs at least two
            moves before it says anything.
          </div>
        )}

        {/* the plateau census — the reading's own honesty about the threshold */}
        <div className="text-[11px] text-muted-foreground">
          The plateau law: moves under {PLATEAU_ANGSTROM} Å count as noise —
          RELION&apos;s manual dialect has no convergence criterion of its own, so
          this reading supplies one.
        </div>

        {/* the verb — one row, two verdicts (t455's, now the arc's too) */}
        <ContinueVerbRow job={job} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

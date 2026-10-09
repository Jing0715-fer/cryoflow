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
 *     completed ML run the dialect table knows (refine3d since t456;
 *     class2d/class3d since t459 — a model star family is a model star
 *     family, MlModel::write writes _rlnCurrentResolution for every ML
 *     model) AND its arc holds at least two rounds with estimates (a
 *     run that wrote no model stars has no arc).
 *   - THE DIALECT SPEAKS ITS OWN NAME (t459): the gold refinement's
 *     axis says "FSC 0.143 estimate" — the crossing between random
 *     halves; the serial classification's axis says "the model's own
 *     estimate" — no random halves ride a 2D/3D classification, and
 *     borrowing the gold-standard's name would be a lie about the
 *     evidence.
 *   - NO PERSISTENCE: like every sibling, the reading restarts from the
 *     whole arc on reopen.
 */

import { useEffect, useMemo, useState } from "react";
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
  arcPresentationOf,
  arcSummary,
  arcVerdict,
  biggestJump,
  PLATEAU_ANGSTROM,
  type ArcPresentation,
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
  // t459 — the dialect table gates the door: refine3d (gold) and the
  // classifications (serial) fetch; every other type never asks.
  // t533 — the table's object must be STABLE: arcPresentationOf mints a
  // fresh object per call, and this value sits in the fetch effect's deps
  // below. Identity-per-render meant every setRounds re-render minted a
  // new "presentation", refired the effect, and the door polled ITSELF at
  // network speed (a ~6ms fetch loop for as long as the inspector stayed
  // open — and a 404 console error whenever the job was deleted under it).
  // The house pattern is continue-verb-row's: useMemo on the true inputs.
  const presentation = useMemo(() => arcPresentationOf(job.type), [job.type]);

  // One cheap cached GET per inspector mount of an ML face — the
  // door cannot know whether an arc exists without asking (data
  // fetching, not state syncing).
  useEffect(() => {
    if (job.status !== "completed" || !presentation) {
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
  }, [job.id, job.status, presentation]);

  if (!presentation || !rounds || rounds.length < 2) return null; // no arc — no door, no noise
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 rounded-md text-muted-foreground/70 hover:bg-muted hover:text-foreground"
        aria-label={`Resolution arc — read this ${presentation.noun}'s own resolution estimate across its ${rounds.length} iterations`}
        title={`Resolution arc — one ${presentation.noun}, its own iterations: is the estimate still sharpening, or has it plateaued?`}
        onClick={() => setOpen(true)}
      >
        <Ruler className="size-3.5" aria-hidden="true" />
      </Button>
      <ResolutionArcDialog
        open={open}
        onOpenChange={setOpen}
        job={job}
        rounds={rounds}
        presentation={presentation}
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
  presentation,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: JobDTO;
  rounds: ResolutionPoint[];
  presentation: ArcPresentation;
}) {
  const data = rounds.map((p) => ({
    round: p.iteration,
    label: roundLabel(p.iteration),
    angstrom: p.resolution,
  }));
  const verdict = arcVerdict(rounds);
  const jump = biggestJump(rounds);
  const summary = arcSummary(rounds);
  const isGold = presentation.dialect === "gold";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b px-6 pb-4 pt-6">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Ruler className="size-4 text-primary" aria-hidden="true" />
            Resolution arc — {job.name}
          </DialogTitle>
          <DialogDescription>
            One {presentation.noun}&apos;s own arc — the resolution estimate each
            iteration wrote into its model star. The descending curve is the
            {isGold ? " map" : " classes"} sharpening; a flat tail is a{" "}
            {presentation.noun} that has stopped improving.
          </DialogDescription>
        </DialogHeader>

        {/* t804 — the content-node census's house cure, the t802 dialect at
            family scale: this DialogContent WAS the scroll surface (the old
            override spoke "flex ... flex-col gap-4 overflow-y-auto"), Radix's
            modal parks tabIndex=-1 on the content node itself, and everything
            below the header — the arc, the plateau census, the verb — was
            keyboard-unreachable scroll. The house shape (flex col + gap-0 +
            pinned header + overflow-hidden) hands the scroll to this inner
            region — tabIndex + role=region + its own name + the family's
            inset ring (the region runs edge-to-edge; an outward ring would
            clip against the dialog's own border). role=dialog stays — a stop
            and a role are not rivals (t799's law, third home). space-y-4
            keeps the old gap-4 rhythm inside the region; the six faces
            recorded in t803's J arm are all cured this window. */}
        <div
          tabIndex={0}
          role="region"
          aria-label="Resolution arc reading — the estimate curve and the plateau law"
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-6 pt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50"
        >
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
                name={presentation.estimateLabel}
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
                isAnimationActive={false /* the curve doesn't dance — the t610 mute law (fsc-chart.tsx header) */}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="-mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span>· x = the run&apos;s own iterations, y = {presentation.estimateLabel} (Å)</span>
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
                  ? "border border-warning/40 bg-warning/10 text-warning-700 dark:text-warning-400"
                  : verdict.word === "still improving"
                    ? "bg-running/10 text-running-700 dark:text-running-400"
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
          this reading supplies one{isGold
            ? "."
            : " — a classification stops on its written iteration count, not on its estimate."}
        </div>

        {/* the verb — one row, two verdicts (t455's, now the arc's too) */}
        <ContinueVerbRow job={job} onDone={() => onOpenChange(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

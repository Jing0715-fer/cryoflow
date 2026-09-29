"use client";

/**
 * CryoFlow — the class convergence dialog (t454).
 *
 * The compare family's fourth question — and the first that does NOT
 * pair two runs. One classification run, two of its OWN iterations:
 * "did my classification converge, or are classes still re-shuffling
 * particles?" The classes route answers per-round occupancy (?iter=N,
 * in the route since the gallery needed round-filtered counts); the
 * iterations route lists the rounds; the face reuses the shared verdict
 * kit (compare-face.tsx) so the family stays one face under two
 * questions.
 *
 * The face's laws (family-inherited + domain-local):
 *   - THE FACE IS SHARED, THE QUESTION IS NEW: same verdict chips, same
 *     identity scatter (a class hugging the 45° line held its share —
 *     settled; off the line, it moved particles), same mover lists.
 *   - THE DEFAULT PAIR IS THE RUN'S WHOLE ARC: earliest round vs latest
 *     (defaultRoundPair); the pickers let the user ask of any two
 *     rounds, including last-two-rounds ("is it STILL moving?").
 *   - THE VERDICT READS, IT NEVER WIRES: convergence has no consumer
 *     verb — selecting "settled" classes would conflate settled with
 *     good, and re-running with more iterations is not this app's verb
 *     yet. The footer says so out loud instead of leaving the rider's
 *     absence silent.
 *   - THE DOOR GUARDS ITSELF: nothing renders unless the host is a
 *     completed 2D/3D classification AND its round ladder holds at
 *     least two distinct rounds (a one-round run has no arc to read).
 *   - NO PERSISTENCE: like the sibling A/B, a convergence reading is a
 *     question about the CURRENT run — reopening starts from the whole
 *     arc again.
 */

import { useEffect, useMemo, useState } from "react";
import { History, Loader2, TriangleAlert } from "lucide-react";
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
import type { JobDTO } from "@/lib/types";
import {
  CLASS_LENSES,
  CLASS_WORDS,
  classRunRow,
  type ClassRunRow,
} from "@/lib/class-compare";
import {
  joinByName,
  pairedDeltas,
  scatterDomain,
  topMovers,
  verdict,
} from "@/lib/paired-compare";
import {
  defaultRoundPair,
  movingCensus,
  roundLabel,
} from "@/lib/convergence";
import {
  CompareNotice,
  IdentityScatter,
  MoverList,
  VerdictChips,
} from "./compare-face";

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Origin: window.location.origin },
  });
  if (!res.ok) throw new Error(`route said ${res.status}`);
  return res.json();
}

/** The round ladder — the iterations route's ascending list. */
async function fetchRounds(jobId: string): Promise<number[]> {
  const data = (await fetchJson(`/api/jobs/${jobId}/iterations`)) as {
    iterations?: number[];
  };
  return data.iterations ?? [];
}

/** One round's occupancy — the classes route with an explicit ?iter=. */
async function fetchRoundRows(
  jobId: string,
  round: number,
): Promise<ClassRunRow[]> {
  const data = (await fetchJson(
    `/api/jobs/${jobId}/classes?iter=${round}`,
  )) as {
    classes?: { cls: number; count: number; fraction: number }[];
  };
  return (data.classes ?? []).map(classRunRow);
}

/* ------------------------------------------------------------------ */
/* The door — beside the sibling A/B one, its own question.            */
/* ------------------------------------------------------------------ */

export function ClassConvergenceEntry({ job }: { job: JobDTO }) {
  const [rounds, setRounds] = useState<number[] | null>(null);
  const [open, setOpen] = useState(false);

  // The ladder is one cheap cached GET per inspector mount of a
  // classification face — the door cannot know whether an arc exists
  // without asking (data fetching, not state syncing).
  useEffect(() => {
    if (job.status !== "completed" || !/class2d|class3d/i.test(job.type)) {
      return;
    }
    let alive = true;
    fetchRounds(job.id)
      .then((r) => {
        if (alive) setRounds(r);
      })
      .catch(() => {
        /* the door hides when the ladder cannot be read */
      });
    return () => {
      alive = false;
    };
  }, [job.id, job.status, job.type]);

  const pair = useMemo(
    () => (rounds ? defaultRoundPair(rounds) : null),
    [rounds],
  );
  if (!pair) return null; // no arc (or no ladder) — no door, no noise
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 rounded-md text-muted-foreground/70 hover:bg-muted hover:text-foreground"
        aria-label={`Class convergence — read this run's occupancy across its own ${rounds?.length ?? 0} iterations`}
        title="Class convergence — one run, two of its own iterations: did the classification settle, or are classes still moving particles?"
        onClick={() => setOpen(true)}
      >
        <History className="size-3.5" aria-hidden="true" />
      </Button>
      <ClassConvergenceDialog
        open={open}
        onOpenChange={setOpen}
        job={job}
        rounds={rounds ?? []}
        initialPair={pair}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* The face.                                                           */
/* ------------------------------------------------------------------ */

function ClassConvergenceDialog({
  open,
  onOpenChange,
  job,
  rounds,
  initialPair,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: JobDTO;
  rounds: number[];
  initialPair: { a: number; b: number };
}) {
  const [roundA, setRoundA] = useState(initialPair.a);
  const [roundB, setRoundB] = useState(initialPair.b);
  const [a, setA] = useState<ClassRunRow[] | null>(null);
  const [b, setB] = useState<ClassRunRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** the pair key the CURRENT rows were fetched for — a mismatch with
   *  the selected pair IS the loading state (derived, the sibling
   *  face's law). */
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  /** render-time adjust: the dialog re-derives its pair state on each
   *  open — the whole arc leads, nothing persists. */
  const [seenOpen, setSeenOpen] = useState(false);
  if (open !== seenOpen) {
    setSeenOpen(open);
    if (open) {
      setRoundA(initialPair.a);
      setRoundB(initialPair.b);
      setA(null);
      setB(null);
      setError(null);
      setLoadedKey(null);
    }
  }

  const sortedRounds = useMemo(
    () => [...new Set(rounds)].sort((x, y) => x - y),
    [rounds],
  );

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const key = `${roundA}|${roundB}`;
    Promise.all([fetchRoundRows(job.id, roundA), fetchRoundRows(job.id, roundB)])
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
  }, [open, roundA, roundB, job.id]);

  const lensSpec = CLASS_LENSES.share;
  const nameA = roundLabel(roundA);
  const nameB = roundLabel(roundB);

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
  const trustText =
    analysis && rounds.length >= 2
      ? movingCensus(analysis.deltas, { aRound: roundA, bRound: roundB })
      : null;
  const pairKey = `${roundA}|${roundB}`;
  const loading = Boolean(open && loadedKey !== pairKey);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-4 overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <History className="size-4 text-primary" aria-hidden="true" />
            Class convergence — {lensSpec.label}
          </DialogTitle>
          <DialogDescription>
            One run&apos;s own arc — the same classes&apos; occupancy at an
            earlier and a later iteration of {job.name}. Classes hugging the
            diagonal have settled; classes off it are still moving particles.
          </DialogDescription>
        </DialogHeader>

        {/* the round pickers — the whole arc leads, both stay switchable */}
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="min-w-0">
            <div className="mb-1 text-[11px] font-medium text-muted-foreground">Round A (earlier)</div>
            <Select
              value={String(roundA)}
              onValueChange={(v) => setRoundA(Number(v))}
            >
              <SelectTrigger className="h-8 w-full text-xs" aria-label="Round A">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortedRounds.map((r) => (
                  <SelectItem key={r} value={String(r)} className="text-xs">
                    {roundLabel(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <div className="mb-1 text-[11px] font-medium text-muted-foreground">Round B (later)</div>
            <Select
              value={String(roundB)}
              onValueChange={(v) => setRoundB(Number(v))}
            >
              <SelectTrigger className="h-8 w-full text-xs" aria-label="Round B">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortedRounds.map((r) => (
                  <SelectItem key={r} value={String(r)} className="text-xs">
                    {roundLabel(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {sortedRounds.length < 2 ? (
          <CompareNotice>
            This run has only one settled round — a convergence reading needs
            at least two iterations to compare.
          </CompareNotice>
        ) : loading || !analysis ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
            <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
            The classes route refused: {error}
          </div>
        ) : (
          <>
            <VerdictChips
              v={analysis.v}
              words={CLASS_WORDS}
              digits={lensSpec.digits}
              unit={lensSpec.unit}
              pairsCount={analysis.join.pairs.length}
              onlyA={analysis.join.onlyA}
              onlyB={analysis.join.onlyB}
            />

            <IdentityScatter
              domain={analysis.domain}
              improved={improvedSeries}
              regressed={regressedSeries}
              tied={tiedSeries}
              words={CLASS_WORDS}
              nameA={nameA}
              nameB={nameB}
              digits={lensSpec.digits}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <MoverList
                title={`Biggest ${CLASS_WORDS.betterNoun} (${lensSpec.label})`}
                deltas={analysis.movers.improvers}
                digits={lensSpec.digits}
                unit={lensSpec.unit}
                tone="teal"
              />
              <MoverList
                title={`Biggest ${CLASS_WORDS.worseNoun} (${lensSpec.label})`}
                deltas={analysis.movers.regressors}
                digits={lensSpec.digits}
                unit={lensSpec.unit}
                tone="rose"
              />
            </div>

            {/* the convergence census — the reading's own health check */}
            {trustText ? (
              <div className="text-[11px] text-muted-foreground">{trustText}</div>
            ) : null}

            {/* the verbless footer — the convergence verdict reads, it
                never wires: the family's other faces carry consumer verbs
                (exclude / select); this one says out loud why it has none */}
            <div className="text-[11px] text-muted-foreground">
              The verdict reads this run&apos;s own arc — nothing is re-wired;
              convergence is a reading, not a mutation.
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

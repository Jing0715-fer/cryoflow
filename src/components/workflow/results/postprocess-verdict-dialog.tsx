"use client";

/**
 * CryoFlow — the final verdict dialog (t457).
 *
 * The compare family's SIXTH question — the third that pairs one run
 * with ITSELF. t454 asked a classification "did you settle", t456 asked
 * a refinement "are you still sharpening"; this one asks a postprocess
 * the honesty question: "is the final number TRUE — what did the mask
 * buy, and did the phase-randomization correction claw the flattery
 * back?"
 *
 * The face's laws (family-inherited + domain-local):
 *   - THE FACE IS THE LADDER: not a chart this time — a resolution axis
 *     with three crossing markers (unmasked → official → raw masked)
 *     and the box edge drawn as the wall it is. The spacing IS the
 *     story: the gift, the claw, and who claims what.
 *   - THE NUMBER WEARS WORDS: honest / modest gift / generous gift /
 *     mask-carried / beyond the box — the gift's size picks the word,
 *     and "generous" is a caution, not a compliment (over-tight masks
 *     inflate the correlation they then report).
 *   - THE B-FACTOR GETS A WEATHER REPORT: gentle / strong / aggressive
 *     — the sharpening dial's magnitude in words.
 *   - THE VERDICT READS; IT DOES NOT MUTATE: no verb row — a different
 *     answer comes from a different mask (the mask-create job's dial)
 *     and a Re-run; the footer says so instead of pretending a click
 *     exists.
 *   - THE DOOR GUARDS ITSELF: nothing renders unless the host is a
 *     completed postprocess AND its FSC table carries the corrected
 *     curve on at least two shells (a model-star FSC has no verdict).
 *   - NO PERSISTENCE: like every sibling, the reading restarts from the
 *     whole table on reopen.
 */

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { JobDTO } from "@/lib/types";
import {
  postprocessVerdictOf,
  FSC_CRITERION,
  GIFT_MODEST_ANGSTROM,
  GIFT_GENEROUS_ANGSTROM,
  BFACTOR_GENTLE,
  BFACTOR_STRONG,
  type PostprocessGeneral,
  type VerdictShell,
} from "@/lib/postprocess-verdict";

interface FscPayload {
  source: "postprocess" | "model" | null;
  shells: VerdictShell[];
  postprocessGeneral?: PostprocessGeneral | null;
}

/** The verdict's data plane — the same cached GET the FSC chart uses. */
async function fetchFsc(jobId: string): Promise<FscPayload | null> {
  const res = await fetch(`/api/jobs/${jobId}/fsc`, {
    headers: { Origin: window.location.origin },
  });
  if (!res.ok) throw new Error(`route said ${res.status}`);
  const data = (await res.json()) as FscPayload;
  return data.source === "postprocess" ? data : null;
}

/* ------------------------------------------------------------------ */
/* The door — beside the arc one, the family's sixth question.         */
/* ------------------------------------------------------------------ */

export function PostprocessVerdictEntry({ job }: { job: JobDTO }) {
  const [payload, setPayload] = useState<FscPayload | null>(null);
  const [open, setOpen] = useState(false);

  // One cheap cached GET per inspector mount of the postprocess face —
  // the door cannot know whether the star carries the corrected curve
  // without asking (data fetching, not state syncing).
  useEffect(() => {
    if (job.status !== "completed" || job.type !== "postprocess") {
      return;
    }
    let alive = true;
    fetchFsc(job.id)
      .then((p) => {
        if (alive) setPayload(p);
      })
      .catch(() => {
        /* the door hides when the table cannot be read */
      });
    return () => {
      alive = false;
    };
  }, [job.id, job.status, job.type]);

  const verdict = payload ? postprocessVerdictOf(payload) : null;
  if (!payload || !verdict) return null; // no corrected curve — no door, no noise
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 rounded-md text-muted-foreground/70 hover:bg-muted hover:text-foreground"
        aria-label={`Final verdict — read what the mask bought across ${payload.shells.length} shells`}
        title="Final verdict — one postprocess, its own honesty check: what did the mask buy, and did the correction keep the number honest?"
        onClick={() => setOpen(true)}
      >
        <ShieldCheck className="size-3.5" aria-hidden="true" />
      </Button>
      <FinalVerdictDialog
        open={open}
        onOpenChange={setOpen}
        job={job}
        shells={payload.shells.length}
        verdict={verdict}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* The face — the ladder, the words, the weather.                      */
/* ------------------------------------------------------------------ */

const WORD_STYLES: Record<string, string> = {
  honest: "bg-teal-600/10 text-teal-700 dark:text-teal-400",
  "modest gift": "bg-teal-600/10 text-teal-700 dark:text-teal-400",
  "generous gift":
    "border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  "mask-carried":
    "border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  "beyond the box":
    "border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400",
};

function FinalVerdictDialog({
  open,
  onOpenChange,
  job,
  shells,
  verdict,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: JobDTO;
  shells: number;
  verdict: NonNullable<ReturnType<typeof postprocessVerdictOf>>;
}) {
  const { unmasked, official, rawMasked, nyquist } = {
    unmasked: verdict.unmasked,
    official: verdict.official,
    rawMasked: verdict.rawMasked,
    nyquist: verdict.nyquist,
  };

  // the ladder's domain: every marker plus headroom, coarse → fine
  const marks = [unmasked, official, rawMasked, nyquist].filter(
    (v): v is number => v != null && Number.isFinite(v)
  );
  const maxA = marks.length > 0 ? Math.max(...marks) : official;
  const minA = marks.length > 0 ? Math.min(...marks) : official;
  const span = Math.max(maxA - minA, 0.5);
  const lo = maxA + span * 0.18; // coarse end (left)
  const hi = Math.max(minA - span * 0.18, 0); // fine end (right)
  const pos = (v: number) => ((lo - v) / (lo - hi)) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-4 overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            Final verdict — {job.name}
          </DialogTitle>
          <DialogDescription>
            One postprocess&apos;s honesty read — three curves, three crossings,
            one box edge. The mask flatters the correlation; the
            phase-randomization correction exists to claw that flattery back.
            This face reads who claims what, and whether the official number
            stays the honest one.
          </DialogDescription>
        </DialogHeader>

        {/* the headline — evidence first */}
        <div className="text-xs font-medium text-foreground">{verdict.headline}</div>

        {/* the ladder — the family's face for this domain */}
        <div className="rounded-lg border bg-card px-4 pb-2 pt-9">
          <div className="relative">
            {unmasked != null ? (
              <LadderMark
                pct={pos(unmasked)}
                label="unmasked"
                value={`${unmasked.toFixed(1)} Å`}
                tone="text-slate-600 dark:text-slate-300"
                dot="bg-slate-400"
                above
              />
            ) : null}
            <LadderMark
              pct={pos(official)}
              label="official (corrected)"
              value={`${official.toFixed(1)} Å`}
              tone="font-semibold text-teal-700 dark:text-teal-400"
              dot="bg-teal-500 ring-2 ring-teal-500/30"
              above={!unmasked}
            />
            {rawMasked != null ? (
              <LadderMark
                pct={pos(rawMasked)}
                label="raw mask (uncorrected)"
                value={`${rawMasked.toFixed(1)} Å`}
                tone="text-amber-700 dark:text-amber-400"
                dot="bg-amber-500"
                above={false}
              />
            ) : null}
            {nyquist != null ? (
              <div
                className="absolute -top-7 bottom-[-0.75rem] border-l-2 border-dashed border-red-400/60"
                style={{ left: `${Math.min(Math.max(pos(nyquist), 0), 100)}%` }}
                aria-hidden="true"
              />
            ) : null}
            {nyquist != null ? (
              <div
                className="absolute top-full mt-1.5 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-red-600 dark:text-red-400"
                style={{ left: `${Math.min(Math.max(pos(nyquist), 0), 100)}%` }}
              >
                box edge {nyquist.toFixed(1)} Å
              </div>
            ) : null}
            {/* the axis */}
            <div className="mt-6 h-px w-full bg-border" />
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>coarse</span>
              <span>
                {FSC_CRITERION} crossing · Å — lower (finer) is to the right
              </span>
              <span>fine</span>
            </div>
          </div>
        </div>

        {/* the word + the evidence */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={
              "rounded-full px-2 py-0.5 font-medium " +
              (WORD_STYLES[verdict.word] ?? "bg-muted text-muted-foreground")
            }
          >
            {verdict.word}
          </span>
          <span className="text-muted-foreground">{verdict.detail}</span>
        </div>

        {/* the sharpening dial's weather */}
        {verdict.sharpening ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground">
              B-factor {verdict.sharpening.word}
            </span>
            <span className="text-muted-foreground">{verdict.sharpening.detail}</span>
          </div>
        ) : null}

        {/* the bands' census — the reading's own honesty about its thresholds */}
        <div className="text-[11px] text-muted-foreground">
          The gift law: a gift up to {GIFT_MODEST_ANGSTROM} Å is noise-level
          honesty, up to {GIFT_GENEROUS_ANGSTROM} Å is a well-fit mask&apos;s
          earning, beyond it the mask deserves a second look. The B-factor&apos;s
          bands: &lt;{BFACTOR_GENTLE} gentle · {BFACTOR_GENTLE}–{BFACTOR_STRONG}{" "}
          strong · &gt;{BFACTOR_STRONG} aggressive.
        </div>

        {/* the honest verbless footer — the reading points at the dial */}
        <div className="text-[11px] text-muted-foreground">
          The verdict reads; it does not mutate. A different answer comes from a
          different mask (the mask-create job&apos;s dial) and a Re-run — the four
          curves themselves live on the FSC chart in the results below.
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* One ladder marker: a dot on the axis with a two-line label. Alternating
 * above/below keeps the labels from colliding when crossings bunch up. */
function LadderMark({
  pct,
  label,
  value,
  tone,
  dot,
  above,
}: {
  pct: number;
  label: string;
  value: string;
  tone: string;
  dot: string;
  above: boolean;
}) {
  const clamped = Math.min(Math.max(pct, 0), 100);
  return (
    <div
      className="absolute -translate-x-1/2 whitespace-nowrap text-center"
      style={
        above
          ? { left: `${clamped}%`, bottom: "calc(100% - 0.25rem)" }
          : { left: `${clamped}%`, top: "calc(100% + 0.9rem)" }
      }
    >
      <div className={`text-[10px] leading-tight ${tone}`}>
        {value}
        <span className="block font-normal text-muted-foreground">{label}</span>
      </div>
      <div
        className={`absolute left-1/2 size-2 -translate-x-1/2 rounded-full ${dot} ${
          above ? "top-full mt-1" : "bottom-full mb-1"
        }`}
      />
    </div>
  );
}

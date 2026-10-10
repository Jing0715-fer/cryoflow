"use client";

/**
 * CryoFlow — the dashboard's journal digest (Task 720): the activity
 * family's fourth face.
 *
 * The family already owns three readings of activity, and each speaks a
 * different tense of the same world: the KPI sparkline speaks the
 * cumulative TREND, the heatmap (t711) speaks the SHAPE OF TIME, the
 * recent feed speaks the JOBS' present tense — where things stand and
 * which jobs were last touched. This face speaks the FINGERS' past
 * tense: the individual actions themselves — a rename, five knob-turns,
 * a note, a dispatch, the engine's own starts, a landing — merged
 * across every job and every project into one newest-first stream.
 *
 * The division of labor in one sentence: a job can absorb twenty touches
 * and still be ONE row in the feed; the digest unrolls those twenty
 * touches into twenty rows. Both read the same world; neither repeats
 * the other. The digest reads lib/job-journal.ts — the SAME store the
 * inspector's Timeline spine reads (readRecentJobEvents, zero second
 * truth, zero new hooks, zero new storage).
 *
 * THE SHOPWINDOW LAW — the digest shows the latest DIGEST_CAP navigable
 * actions and stops; it is a shopwindow, not the archive (the archive
 * is each job's Timeline, one click away through the row itself). No
 * cross-job expander here: an expander over this stream would BE a
 * second archive, and the shelf's honest-overflow law only fits when
 * the overflow is the same kind of thing as what's shown.
 *
 * DORMANT ROWS — a journal event whose job no longer resolves in the
 * roster (the job was deleted; the DORMANT law keeps its history) is
 * skipped, not shown dead: a shopwindow row that cannot navigate is a
 * dead link, and the entry still lives in the per-job spine should
 * Ctrl+Z bring the job back. The lib returns dormant events (filtering
 * needs the roster, which is this component's business); the shopwindow
 * simply won't display what it can't link.
 *
 * FRESHNESS — the store's jobs slice is the change bus (the t718 law):
 * every recording hook lands through a store update, so the render-time
 * read is always current without a custom event. The id→name roster
 * snapshot refetches on mount and whenever the roster's SIZE moves —
 * a touch that doesn't move the count (progress sweeps) can't miss its
 * name (the job was already in the snapshot), and a job created into
 * the world always moves the count. The recent-API covers every job
 * young enough to own a digest row: journal events are bounded by the
 * job's touch time, so a job outside the snapshot's window only owns
 * older events than the shopwindow shows.
 *
 * HONEST STATES — a world with zero journaled actions renders nothing
 * (the t716 law: a decorative empty state pretending to be a feature);
 * a fetch failure renders nothing (convenience, not dependency — the
 * feed's law); a world whose top events all belong to removed jobs
 * renders nothing rather than a card of dead ends.
 */

import * as React from "react";
import { History } from "lucide-react";
import { useWorkflowStore } from "@/lib/store";
import { readRecentJobEvents, type JobJournalEvent } from "@/lib/job-journal";
import { JOURNAL_KIND_FACE } from "./journal-kind-face";
import { fmtAgo } from "@/lib/duration";
import { cn } from "@/lib/utils";

/** shopwindow depth — a glance, not the archive */
export const DIGEST_CAP = 12;

interface RosterJob {
  id: string;
  name: string;
  projectId: string | null;
}

interface DigestRow {
  event: JobJournalEvent;
  job: RosterJob;
}

export function JournalDigest() {
  // t569 — the store's shared deep-link action owns the landing, the
  // same dialect the recent feed and the failed strip speak
  const openJob = useWorkflowStore((s) => s.openJob);
  // the change bus — a fresh jobs array lands on every recording hook,
  // so re-rendering on it re-reads the journal for free
  const jobs = useWorkflowStore((s) => s.jobs);
  const [roster, setRoster] = React.useState<Map<string, RosterJob> | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetch("/api/activity/recent?limit=200")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { jobs?: RosterJob[] }) => {
        if (alive) {
          const list = Array.isArray(d.jobs) ? d.jobs : [];
          setRoster(new Map(list.map((j) => [j.id, j])));
        }
      })
      .catch(() => {
        /* the digest is a convenience, not a dependency — render nothing */
        if (alive) setRoster(null);
      });
    return () => {
      alive = false;
    };
  }, [jobs.length]);

  const rows = React.useMemo<DigestRow[] | null>(() => {
    if (roster === null) return null;
    // headroom ×3: the lib's cap applies to RAW events; dormant skips
    // happen here, so read deeper than the shopwindow needs and stop
    // at the first DIGEST_CAP navigable rows
    const events = readRecentJobEvents(DIGEST_CAP * 3);
    const out: DigestRow[] = [];
    for (const event of events) {
      const job = roster.get(event.jobId);
      if (!job) continue; // dormant behind a removed job — skip the dead link
      out.push({ event, job });
      if (out.length >= DIGEST_CAP) break;
    }
    return out;
    // `jobs` is the journal's change bus (see header) — its reference
    // moving is the signal to re-read, alongside the roster snapshot
  }, [roster, jobs]);

  if (roster === null || rows === null || rows.length === 0) return null;

  return (
    <section
      aria-label="Journal digest — recent actions across all projects"
      data-testid="journal-digest"
      className="card-lift rounded-xl border bg-card px-4 py-3.5 sm:px-5"
    >
      <div className="mb-2 flex items-center gap-2">
        <History className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-sm font-semibold tracking-tight">Recent actions</h2>
        <span className="text-[11px] text-muted-foreground">across all projects</span>
      </div>
      <div className="flex flex-col">
        {rows.map(({ event, job }) => {
          const face = JOURNAL_KIND_FACE[event.kind];
          const Icon = face.icon;
          return (
            <button
              key={`${event.jobId}-${event.at}-${event.kind}`}
              type="button"
              data-testid="journal-digest-row"
              onClick={() => void openJob(event.jobId, { projectId: job.projectId })}
              aria-label={`${face.verb} on ${job.name}${event.detail ? ` — ${event.detail}` : ""} — open the job to read its full story`}
              title={`Open ${job.name} — the full story lives in its Timeline`}
              className="group/row flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1.5 text-left transition-colors motion-reduce:transition-none hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
                  face.tone === "good"
                    ? "bg-success-600/10 text-success-600 ring-success-600/20"
                    : face.tone === "bad"
                      ? "bg-danger/10 text-danger ring-danger/20"
                      : "bg-muted text-muted-foreground ring-border"
                )}
              >
                <Icon className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate text-[11px]">
                <span className="font-medium text-foreground/85">{face.verb}</span>
                <span className="text-muted-foreground"> on </span>
                <span className="font-semibold text-foreground">{job.name}</span>
                {event.detail ? (
                  <span className="text-muted-foreground"> · {event.detail}</span>
                ) : null}
              </span>
              <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground">
                {fmtAgo(event.at)}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[10.5px] text-muted-foreground" data-testid="journal-digest-footer">
        The latest {DIGEST_CAP} actions — every job&rsquo;s full story lives in its own Timeline.
      </p>
    </section>
  );
}

"use client";

/**
 * CryoFlow — the dashboard's notes wall (Task 721): the notebook face.
 *
 * The activity family speaks four tenses of the same world (the KPI
 * sparkline's cumulative trend, the heatmap's shape of time, the feed's
 * jobs-now, the digest's fingers-did), but none of them speaks the
 * CONCLUSIONS. The journal records what the fingers DID; the margin notes
 * (Task 73) and class notes (Task 80) record what the mind DECIDED — and
 * a note lives in exactly one place: the inspector's JobNoteSection, one
 * job at a time. The spotlight's Noted filter can point at noted jobs but
 * cannot read them out. This wall is the reading surface: every judgment
 * in the active project, quoted in one place, newest-touched first. One
 * sentence: the inspector's margin is where a note is WRITTEN; the wall
 * is where notes are READ.
 *
 * SCOPE — this project, not all projects. Notes are server facts on the
 * job row (the PATCH route normalizes empty to null); the active
 * project's roster is already in the store's jobs slice, so the wall
 * rides it with ZERO fetch, ZERO effects, ZERO new storage, ZERO new
 * routes. The digest's cross-project stream is browser-local (the t718
 * law — the journal is a per-browser lens); the wall's content is server
 * truth. Different scopes because different truths. Every note PATCH
 * lands through saveJob → the jobs slice reference moves → this render
 * re-reads (the change-bus law; no custom event, no refetch).
 *
 * SINGLE SOURCE — "noted" means hasJudgment (lib/class-notes.ts, Task
 * 83): a job-level note OR any class note inside select2d params. The
 * Noted chip, the 5-key filter, the canvas lens and the header count all
 * read that predicate; a wall that invented its own "noted" would
 * eventually disagree with the filter that points at it. The wall reads
 * the same function — and quotes class notes through parseClassNotes,
 * the same tolerant parse (a corrupted param degrades to "no notes",
 * never takes the wall down).
 *
 * THE HONESTY LAW — no timestamps. A wall of conclusions wants to say
 * "when", but every clock it could quote would lie: the job's updatedAt
 * moves on ANY touch (a rename, a run, a progress sweep), so dating the
 * note by it claims the note is newer than it is; the journal's note
 * events DO carry real times but are browser-local (t718), so a wall
 * dated from the journal would show times on this browser and none on
 * the next — lying differently depending on where you stand. So the row
 * speaks text, name and status only; the age of a conclusion is the
 * reader's business, and the inspector's Timeline holds the true times
 * for those who want them.
 *
 * SHOWCASE LAW — cap 8. A reading wall, not the archive: the archive is
 * each job's full margin in its inspector (one click through the row)
 * and the index is the spotlight's Noted slice. No expander — an
 * expander over the notes stream would BE a second archive, the digest's
 * shopwindow law verbatim.
 *
 * HONEST NULL — zero noted jobs renders nothing (the t716 law: an empty
 * state without a live function is decoration). t717's amendment grants
 * an empty state a mouth only where one EXISTS — an empty wall has none
 * (notes are written in the inspector, never here), so the wall appears
 * with the first note and is absent before it.
 */

import * as React from "react";
import { NotebookPen, StickyNote } from "lucide-react";
import { useWorkflowStore } from "@/lib/store";
import { hasJudgment, parseClassNotes } from "@/lib/class-notes";
import { STATUS_DOT, statusWord } from "@/lib/status-style";
import { cn } from "@/lib/utils";

/** reading depth — a wall of quotes, not the archive */
export const NOTEBOOK_CAP = 8;

export function NotesWall() {
  // t569 — the store's shared deep-link action owns the landing, the
  // same dialect the feed, the failed strip and the digest speak
  const openJob = useWorkflowStore((s) => s.openJob);
  // the data IS the slice — the change bus and the payload in one
  const jobs = useWorkflowStore((s) => s.jobs);

  const { shown, total } = React.useMemo(() => {
    const noted = jobs.filter(hasJudgment);
    // newest-touched first — the dashboard's everywhere-else ordering
    // dialect (feed, digest). ISO strings compare as their instants.
    noted.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
    return { shown: noted.slice(0, NOTEBOOK_CAP), total: noted.length };
    // `jobs` moving is the whole world this face reads — no other dep
  }, [jobs]);

  // honest null — an empty notebook has no mouth (see header)
  if (total === 0) return null;

  return (
    <section
      aria-label="Field notes — margin notes across this project's jobs"
      data-testid="notes-wall"
      className="card-lift rounded-xl border bg-card px-4 py-3.5 sm:px-5"
    >
      <div className="mb-2 flex items-center gap-2">
        <NotebookPen className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-sm font-semibold tracking-tight">Field notes</h2>
        <span className="text-[11px] text-muted-foreground">in this project</span>
      </div>
      <div className="flex flex-col">
        {shown.map((job) => {
          const note = job.note?.trim() || null;
          const classCount = Object.keys(parseClassNotes(job.params?.classNotes)).length;
          // class-only rows quote the count (one class's note out of
          // context would mislead); rows with a written note quote it and
          // carry the class tally in the byline so nothing is hidden
          const classOnly = !note && classCount > 0;
          return (
            <button
              key={job.id}
              type="button"
              data-testid="notes-wall-row"
              data-note-kind={note ? "note" : "class"}
              onClick={() => void openJob(job.id)}
              aria-label={`${note ? "Field note" : "Class notes"} on ${job.name} — open the job to read and edit its margin`}
              title={`Open ${job.name} — the full margin lives in its inspector`}
              className="group/row flex min-w-0 flex-col gap-0.5 rounded-lg px-1.5 py-2 text-left transition-colors motion-reduce:transition-none hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              {note ? (
                <span
                  className="line-clamp-2 text-xs leading-relaxed text-foreground/85"
                  data-testid="notes-wall-quote"
                >
                  {note}
                </span>
              ) : (
                <span
                  className="flex items-center gap-1.5 text-xs leading-relaxed text-warning"
                  data-testid="notes-wall-quote"
                >
                  <StickyNote className="size-3 shrink-0" aria-hidden="true" />
                  {classCount} class note{classCount === 1 ? "" : "s"} on this run&rsquo;s decisions
                </span>
              )}
              <span className="flex min-w-0 items-center gap-1.5 text-[11px]">
                <span
                  aria-hidden="true"
                  className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[statusWord(job)])}
                />
                <span className="truncate font-semibold text-foreground">{job.name}</span>
                {note && classCount > 0 ? (
                  <span
                    className="flex h-4 shrink-0 items-center gap-0.5 rounded-full border border-warning/30 bg-warning/10 px-1.5 text-[9px] font-semibold tabular-nums text-warning"
                    title="This run's classes also carry margin notes"
                  >
                    <StickyNote className="size-2.5" aria-hidden="true" />+{classCount}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[10.5px] text-muted-foreground" data-testid="notes-wall-footer">
        {total > NOTEBOOK_CAP
          ? `${NOTEBOOK_CAP} of ${total} notes in this project — every job's full margin lives in its inspector.`
          : `Every job's full margin lives in its inspector.`}
      </p>
    </section>
  );
}

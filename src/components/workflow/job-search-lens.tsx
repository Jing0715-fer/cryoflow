"use client";

/**
 * CryoFlow — the dashboard search lens's JOB radius (t635).
 *
 * The dashboard's search box has always filtered the PROJECT grid by name
 * only — the "which project ever ran Topaz" question required clicking into
 * every card. This lens rides under that same input and answers it: while
 * the query is non-empty, a debounced fetch asks /api/activity/recent?q=…
 * (the t415 cross-project feed, now with a text lens) for jobs whose name
 * or type match, across ALL projects.
 *
 * Division of labor with the grid below (both stay honest):
 *   - the grid keeps filtering projects by NAME (t627's cascade contract is
 *     untouched — same predicate, same chips, same counts);
 *   - the lens shows JOB matches the grid cannot show, each with its home
 *     project, status badge and relative age;
 *   - an empty lens means "no JOB matches anywhere" — it does not dim or
 *     duplicate the grid's own empty state.
 *
 * Keyboard: ↑/↓ move, Enter opens the highlighted row, Esc closes the
 * lens. Esc belongs to the lens (the find bar's law, t578): it closes the
 * panel WITHOUT stealing the query — the grid below is still filtering by
 * the same word, and silently clearing the user's input would be a second,
 * invisible undo. Dismissal is lens-local state: refocusing the input or
 * editing the query reopens it.
 *
 * A row's click goes through the store's openJob(id, { projectId })
 * deep-link — the same cross-project switch the Needs-attention strip
 * (t415) already rides, so landing on a foreign project's canvas is a
 * solved problem, not a new one.
 *
 * Style: mount is arrival (t572's law — replay = re-entrance, no close-flip
 * machinery; the lens-rise keyframes in globals.css play once per mount);
 * dark-mode via tokens only; .no-print keeps the paper channel clean.
 *
 * t636 — the type-ahead emphasis: each row now shows WHERE the query
 * landed. The first case-insensitive occurrence in the job name (and in
 * the type label) wears a token-styled mark — plain indexOf, no regex
 * (the query is user bytes, not a pattern), first hit only (the scanning
 * convention). The row also carries data-lens-hit="name"|"type" — the
 * honest answer to "why is this row here": the API matches name OR raw
 * type, and when the match lives in the raw type but the humanized label
 * doesn't carry it (q="ctffind" vs "CTF Estimation"), the label segment
 * swaps to the raw type token so the highlighted substring is always
 * visible on the row that earned it.
 */

import * as React from "react";
import { CornerDownLeft, Loader2, SearchX } from "lucide-react";
import { TypeIcon } from "./icons";
import { StatusBadge, isSlurmQueued } from "./job-card";
import { useWorkflowStore } from "@/lib/store";
import { jobType } from "@/lib/workflow";
import { fmtAgo } from "@/lib/duration";
import { cn } from "@/lib/utils";

/** Shape of one row on the wire — the t415 feed's slim select. */
interface LensJob {
  id: string;
  name: string;
  type: string;
  status: string;
  updatedAt: string;
  projectId: string | null;
  projectName: string | null;
  runRemote?: { mode?: string; slurmState?: string; slurmDependsOn?: string[] } | null;
}

const LENS_LIMIT = 6;
const DEBOUNCE_MS = 250;

const ci = (s: string) => s.toLowerCase();

/** the type-ahead mark: first case-insensitive occurrence of q in text.
 * No regex (query text is user bytes), first hit only (scanning
 * convention), token classes only (the dark-mode law). */
function Emph({ text, q }: { text: string; q: string }) {
  const i = q ? ci(text).indexOf(ci(q)) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span className="rounded-[3px] bg-primary/15 px-0.5 font-semibold text-foreground">
        {text.slice(i, i + q.length)}
      </span>
      {text.slice(i + q.length)}
    </>
  );
}

export function JobSearchLens({
  query,
  inputRef,
}: {
  query: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const openJob = useWorkflowStore((s) => s.openJob);
  const [jobs, setJobs] = React.useState<LensJob[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const [dismissed, setDismissed] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement | null>(null);

  const q = query.trim();
  const open = q !== "" && !dismissed;

  // editing the query or coming back to the input reopens a dismissed lens
  React.useEffect(() => {
    setDismissed(false);
  }, [q]);

  // refocus reopens: the user came back for the results (dismissal is
  // lens-local, so the input's own focus is the reopen verb)
  React.useEffect(() => {
    const inp = inputRef?.current;
    if (!inp) return;
    const on_focus = () => setDismissed(false);
    inp.addEventListener("focus", on_focus);
    return () => inp.removeEventListener("focus", on_focus);
  }, [inputRef]);

  // debounced fetch — every frame of typing re-asks the feed; the abort
  // controller makes a stale response unable to overwrite a fresh one
  // (the feed's own arrival-guard dialect: a stale request can never
  // re-open later)
  React.useEffect(() => {
    if (!open) {
      setJobs(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = window.setTimeout(() => {
      fetch(`/api/activity/recent?limit=${LENS_LIMIT}&q=${encodeURIComponent(q)}`, {
        signal: ctrl.signal,
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((d: { jobs?: LensJob[] }) => {
          setJobs(Array.isArray(d.jobs) ? d.jobs : []);
          setActive(0);
          setLoading(false);
        })
        .catch(() => {
          if (!ctrl.signal.aborted) {
            setJobs(null);
            setLoading(false);
          }
        });
    }, DEBOUNCE_MS);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [q, open]);

  const pick = React.useCallback(
    (job: LensJob) => {
      void openJob(job.id, { projectId: job.projectId });
    },
    [openJob]
  );

  // keyboard — capture phase, so the lens beats the page-level shortcut
  // ladder while its panel exists (the find bar's registration order)
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const n = jobs?.length ?? 0;
        if (n === 0) return;
        e.preventDefault();
        setActive((i) => (e.key === "ArrowDown" ? (i + 1) % n : (i - 1 + n) % n));
      } else if (e.key === "Enter") {
        const job = jobs?.[active];
        if (!job) return;
        e.preventDefault();
        pick(job);
      } else if (e.key === "Escape") {
        // the find bar's law: preventDefault makes the page-level Escape
        // ladder stand down — closing the lens never also collapses
        // whatever sits beneath it
        e.preventDefault();
        e.stopPropagation();
        setDismissed(true);
        inputRef?.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, jobs, active, pick, inputRef]);

  // keep the highlighted row in view while arrowing
  React.useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [active, jobs]);

  if (!open) return null;

  return (
    <div
      id="dashboard-job-lens"
      data-job-lens=""
      role="listbox"
      aria-label="Job matches across all projects"
      className={cn(
        "no-print absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden",
        "rounded-xl border bg-popover text-popover-foreground shadow-lg"
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Job matches <span className="normal-case tracking-normal">· all projects</span>
        </span>
        {loading ? (
          <Loader2 className="size-3 animate-spin text-muted-foreground" aria-label="Searching jobs" />
        ) : (
          jobs != null && (
            <span data-lens-count="" className="font-mono text-[10px] tabular-nums text-muted-foreground">
              {jobs.length === LENS_LIMIT ? `${LENS_LIMIT}+` : jobs.length}
            </span>
          )
        )}
      </div>

      {jobs != null && jobs.length === 0 ? (
        <div
          data-lens-empty=""
          className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground"
        >
          <SearchX className="size-3.5 shrink-0" aria-hidden="true" />
          No jobs match “{q}” across any project — the grid above filters project
          names only.
        </div>
      ) : (
        <div ref={listRef} className="max-h-64 overflow-y-auto nice-scroll p-1">
          {(jobs ?? []).map((job, i) => {
            const spec = jobType(job.type);
            // where the API's match lives — name first (the human's token),
            // then the raw type; rows the query reached through neither
            // surface stay honest as "none" instead of faking a hit
            const hit = ci(job.name).includes(ci(q))
              ? "name"
              : ci(job.type).includes(ci(q))
                ? "type"
                : "none";
            const label = spec?.label ?? job.type;
            // the label is a humanized string that may not carry the raw
            // token the API matched ("ctffind" → "CTF Estimation") — swap
            // to the raw type so the highlighted substring is visible
            const showRawType = hit === "type" && !ci(label).includes(ci(q));
            return (
              <button
                key={job.id}
                type="button"
                role="option"
                aria-selected={i === active}
                data-active={i === active ? "true" : undefined}
                data-lens-row=""
                data-lens-hit={hit}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(job)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                  i === active ? "bg-accent" : "hover:bg-secondary/60"
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
                    spec?.color.soft,
                    spec?.color.border
                  )}
                  aria-hidden="true"
                >
                  <TypeIcon name={spec?.icon ?? "Boxes"} className={cn("size-3.5", spec?.color.text)} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-xs font-semibold">
                      <Emph text={job.name} q={q} />
                    </span>
                    <StatusBadge status={job.status} queued={isSlurmQueued(job)} />
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="truncate">
                      {showRawType ? <Emph text={job.type} q={q} /> : <Emph text={label} q={q} />}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate font-medium">{job.projectName ?? "Unknown project"}</span>
                    <span aria-hidden="true">·</span>
                    <span className="shrink-0 tabular-nums">{fmtAgo(job.updatedAt)}</span>
                  </span>
                </span>
                <CornerDownLeft
                  className={cn(
                    "size-3 shrink-0 text-muted-foreground/40",
                    i === active && "text-muted-foreground"
                  )}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

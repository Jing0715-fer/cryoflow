"use client";

/**
 * CryoFlow — canvas find bar (Task 134, Ctrl/⌘+F; Task 135 status lens).
 *
 * The command palette can jump to a job, but jumping is modal and
 * one-at-a-time: it answers "take me to X", not "where is everything
 * named motion?". The find bar is the ambient lens — type a fragment,
 * every matching card rings amber while the rest recede with the SAME
 * dim the note spotlight uses, and Enter/Shift+Enter cycle the viewport
 * through the matches (arrival flash included, via focusJob).
 *
 * Task 135 adds the STATUS half of the lens: a chip row under the input
 * (running / completed / failed / idle / pending). The two halves are
 * orthogonal — with a query the status chip narrows those matches
 * ("motion, but only what's still running"); with no query the chip IS
 * the lens ("show me every failed job") — and radio semantics: one
 * active status at a time, clicking it again clears it.
 *
 * Dialect notes:
 *  • One matcher, two consumers — canvas.tsx derives the same match set
 *    to dim/ring cards; both call jobMatchesFind so the predicate can
 *    never drift (same law as edge-geom's shared drag math).
 *  • Count is honest about what is CENTERED: fresh query reads "N
 *    matches", first Enter reads "1 of N". The number never claims a
 *    viewport you are not looking at.
 *  • The lens is ephemeral: closing clears the query AND the status
 *    chip; nothing enters the undo history; the browser's own Ctrl+Find
 *    is suppressed only while the bar is the active surface (the
 *    page-level Escape ladder sees defaultPrevented and stands down).
 *  • Matching covers the card's own name AND its type label — "motion"
 *    finds "Motion Correction 2" and a renamed "My motion pass" alike.
 *  • Chip colors reuse the status dialect the cards/minimap already
 *    speak (teal running, emerald completed, rose failed) — the lens
 *    must not invent a second color language for the same concept.
 */

import * as React from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveWorkspaceJobs, useWorkflowStore } from "@/lib/store";
import { jobType } from "@/lib/workflow";
import type { JobDTO, JobStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Case-insensitive substring match against the job's own name and its
 *  type label. Exported so canvas.tsx dims/rings with the same
 *  predicate this bar counts with — one matcher, two consumers. */
export function jobMatchesQuery(job: JobDTO, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  if (job.name.toLowerCase().includes(q)) return true;
  return (jobType(job.type)?.label ?? job.type).toLowerCase().includes(q);
}

/** The status chips the lens can filter by, in the order a working
 *  scientist asks for them: what's moving now, what just landed, what
 *  broke, what's waiting. */
export const FIND_STATUSES: { value: JobStatus; label: string }[] = [
  { value: "running", label: "Running" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
  { value: "idle", label: "Idle" },
  { value: "pending", label: "Pending" },
];

/** Chip dialect — the SAME hue family the status badges and minimap
 *  fills already use for each state (teal/emerald/rose/slate/amber); a
 *  filter chip that recolored "running" purple would be a lie. */
const STATUS_CHIP: Record<string, { dot: string; active: string }> = {
  running: {
    dot: "bg-teal-500",
    active:
      "border-teal-400/70 bg-teal-500/10 text-teal-700 dark:border-teal-500/60 dark:text-teal-300",
  },
  completed: {
    dot: "bg-emerald-500",
    active:
      "border-emerald-400/70 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/60 dark:text-emerald-300",
  },
  failed: {
    dot: "bg-rose-500",
    active:
      "border-rose-400/70 bg-rose-500/10 text-rose-700 dark:border-rose-500/60 dark:text-rose-300",
  },
  idle: {
    dot: "bg-slate-400",
    active:
      "border-slate-400/70 bg-slate-500/10 text-slate-600 dark:border-slate-500/60 dark:text-slate-300",
  },
  pending: {
    dot: "bg-amber-500",
    active:
      "border-amber-400/70 bg-amber-500/10 text-amber-700 dark:border-amber-500/60 dark:text-amber-300",
  },
};

/** The FULL find predicate — status gate first, then the text gate.
 *  With a status chip active and an empty query every job of that
 *  status matches (the chip alone is a lens); with no chip the empty
 *  query matches nothing (Task 134's contract, unchanged). Exported
 *  next to jobMatchesQuery so the bar and the canvas share ONE
 *  definition of "is a match". */
export function jobMatchesFind(job: JobDTO, query: string, status: JobStatus | "all"): boolean {
  if (status !== "all" && job.status !== status) return false;
  if (!query.trim()) return status !== "all";
  return jobMatchesQuery(job, query);
}

export function CanvasFindBar() {
  const findOpen = useWorkflowStore((s) => s.findOpen);
  const findQuery = useWorkflowStore((s) => s.findQuery);
  const findStatus = useWorkflowStore((s) => s.findStatus);
  const closeFind = useWorkflowStore((s) => s.closeFind);
  const setFindQuery = useWorkflowStore((s) => s.setFindQuery);
  const setFindStatus = useWorkflowStore((s) => s.setFindStatus);
  const focusJob = useWorkflowStore((s) => s.focusJob);
  const pendingFrom = useWorkflowStore((s) => s.pendingFrom);
  // The SAME workspace-scoped list the canvas renders — counting matches
  // across every workspace would claim cards the viewport can never show.
  const jobs = useActiveWorkspaceJobs();

  const inputRef = React.useRef<HTMLInputElement>(null);
  /** Index of the match the viewport is CURRENTLY centered on — null
   *  until the first Enter/arrow so the count stays honest ("N matches"
 *  → "1 of N" only once something is actually centered). */
  const [cur, setCur] = React.useState<number | null>(null);

  const matches = React.useMemo(() => {
    if (!findOpen) return [] as JobDTO[];
    return jobs.filter((j) => jobMatchesFind(j, findQuery, findStatus));
  }, [findOpen, findQuery, findStatus, jobs]);

  const n = matches.length;

  // A new query or a new status chip is a new world — the centered index
  // resets (and if jobs changed underneath a live index, the guard in
  // go() folds it back).
  React.useEffect(() => {
    setCur(null);
  }, [findQuery, findStatus]);

  // Opening arms the input: focus + preselect whatever was typed so a
  // second Ctrl+F overtypes instead of appending.
  React.useEffect(() => {
    if (!findOpen) return;
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [findOpen]);

  const go = React.useCallback(
    (dir: 1 | -1) => {
      if (n === 0) return;
      setCur((prev) => {
        const base = prev != null && prev < n ? prev : dir === 1 ? -1 : 0;
        const next = (base + dir + n) % n;
        focusJob(matches[next].id);
        return next;
      });
    },
    [n, matches, focusJob],
  );

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      go(e.shiftKey ? -1 : 1);
    } else if (e.key === "Escape") {
      // This Escape belongs to the find bar, not the canvas ladder —
      // preventDefault makes the page-level Escape handler stand down
      // (it checks e.defaultPrevented first), so closing the find never
      // also collapses the selection beneath it.
      e.preventDefault();
      closeFind();
    }
  };

  // Ctrl/⌘+F from anywhere on the canvas view opens the bar. Guards
  // mirror the page-level shortcut ladder: never hijack typing in
  // another input, never fight an open dialog/menu, and never summon
  // the browser's native find (preventDefault).
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      if (e.key.toLowerCase() !== "f") return;
      const t = e.target;
      if (
        t instanceof HTMLElement &&
        t.closest("input, textarea, select, [contenteditable='true']") != null &&
        !t.closest("[data-canvas-find-bar]")
      ) {
        return;
      }
      if (document.querySelector('[role="dialog"][data-state="open"], [role="menu"][data-state="open"]')) {
        return;
      }
      e.preventDefault();
      useWorkflowStore.getState().openFind();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!findOpen || pendingFrom) return null;

  // Honest zero: with no query AND no chip the bar simply isn't looking
  // for anything (no count); but an active chip with zero hits must say
  // so — the lens is armed, the canvas has nothing of that status.
  const countLabel =
    n === 0
      ? findQuery.trim() || findStatus !== "all"
        ? "no matches"
        : ""
      : cur == null
        ? `${n} ${n === 1 ? "match" : "matches"}`
        : `${cur + 1} of ${n}`;

  return (
    <div
      data-canvas-ui="find-bar"
      data-canvas-find-bar=""
      data-testid="canvas-find-bar"
      className="no-print card-lift absolute left-1/2 top-3 z-30 flex -translate-x-1/2 flex-col items-center gap-1.5"
      role="search"
      aria-label="Find jobs on canvas"
    >
      <div className="flex items-center gap-1 rounded-full border bg-card/95 py-1 pl-2.5 pr-1 shadow-md backdrop-blur">
      <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <input
        ref={inputRef}
        data-testid="canvas-find-input"
        value={findQuery}
        onChange={(e) => setFindQuery(e.target.value)}
        onKeyDown={onInputKeyDown}
        placeholder="Find by name or type…"
        aria-label="Find jobs by name or type"
        autoComplete="off"
        spellCheck={false}
        className="w-48 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/60 sm:w-60"
      />
      <span
        data-testid="canvas-find-count"
        className={`shrink-0 whitespace-nowrap text-[11px] font-medium tabular-nums ${
          n === 0 && findQuery.trim() ? "text-destructive" : "text-muted-foreground"
        }`}
      >
        {countLabel}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-6"
        aria-label="Previous match"
        title="Previous match (Shift+Enter)"
        data-testid="canvas-find-prev"
        disabled={n === 0}
        onClick={() => go(-1)}
      >
        <ChevronUp className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-6"
        aria-label="Next match"
        title="Next match (Enter)"
        data-testid="canvas-find-next"
        disabled={n === 0}
        onClick={() => go(1)}
      >
        <ChevronDown className="size-3.5" />
      </Button>
      <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
      <Button
        variant="ghost"
        size="icon"
        className="size-6 text-muted-foreground hover:text-foreground"
        aria-label="Close find"
        title="Close find (Esc)"
        data-testid="canvas-find-close"
        onClick={closeFind}
      >
        <X className="size-3.5" />
      </Button>
      </div>
      {/* Task 135 — the status half of the lens. Always visible while the
          bar is open: a filter you can't see can't be trusted to be off,
          and the chips ARE the discovery surface (no funnel detour). */}
      <div
        data-testid="canvas-find-status-row"
        role="group"
        aria-label="Filter matches by status"
        className="flex items-center gap-0.5 rounded-full border bg-card/95 px-1.5 py-1 shadow-md backdrop-blur"
      >
        {FIND_STATUSES.map(({ value, label }) => {
          const active = findStatus === value;
          const chip = STATUS_CHIP[value];
          return (
            <button
              key={value}
              type="button"
              data-testid={`canvas-find-status-${value}`}
              aria-pressed={active}
              title={active ? `Clear the ${label.toLowerCase()} filter` : `Only ${label.toLowerCase()} jobs`}
              onClick={() => setFindStatus(active ? "all" : value)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                active
                  ? chip.active
                  : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-1.5 rounded-full",
                  chip.dot,
                  value === "running" && active && "animate-soft-pulse",
                )}
              />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

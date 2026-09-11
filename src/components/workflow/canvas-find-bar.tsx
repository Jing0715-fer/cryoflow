"use client";

/**
 * CryoFlow — canvas find bar (Task 134, Ctrl/⌘+F).
 *
 * The command palette can jump to a job, but jumping is modal and
 * one-at-a-time: it answers "take me to X", not "where is everything
 * named motion?". The find bar is the ambient lens — type a fragment,
 * every matching card rings amber while the rest recede with the SAME
 * dim the note spotlight uses, and Enter/Shift+Enter cycle the viewport
 * through the matches (arrival flash included, via focusJob).
 *
 * Dialect notes:
 *  • One matcher, two consumers — canvas.tsx derives the same match set
 *    to dim/ring cards; both call jobMatchesQuery so the predicate can
 *    never drift (same law as edge-geom's shared drag math).
 *  • Count is honest about what is CENTERED: fresh query reads "N
 *    matches", first Enter reads "1 of N". The number never claims a
 *    viewport you are not looking at.
 *  • The lens is ephemeral: closing clears the query; nothing enters
 *    the undo history; the browser's own Ctrl+Find is suppressed only
 *    while the bar is the active surface (the page-level Escape ladder
 *    sees defaultPrevented and stands down).
 *  • Matching covers the card's own name AND its type label — "motion"
 *    finds "Motion Correction 2" and a renamed "My motion pass" alike.
 */

import * as React from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveWorkspaceJobs, useWorkflowStore } from "@/lib/store";
import { jobType } from "@/lib/workflow";
import type { JobDTO } from "@/lib/types";

/** Case-insensitive substring match against the job's own name and its
 *  type label. Exported so canvas.tsx dims/rings with the same
 *  predicate this bar counts with — one matcher, two consumers. */
export function jobMatchesQuery(job: JobDTO, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  if (job.name.toLowerCase().includes(q)) return true;
  return (jobType(job.type)?.label ?? job.type).toLowerCase().includes(q);
}

export function CanvasFindBar() {
  const findOpen = useWorkflowStore((s) => s.findOpen);
  const findQuery = useWorkflowStore((s) => s.findQuery);
  const closeFind = useWorkflowStore((s) => s.closeFind);
  const setFindQuery = useWorkflowStore((s) => s.setFindQuery);
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
    return jobs.filter((j) => jobMatchesQuery(j, findQuery));
  }, [findOpen, findQuery, jobs]);

  const n = matches.length;

  // A new query is a new world — the centered index resets (and if jobs
  // changed underneath a live index, the guard in go() folds it back).
  React.useEffect(() => {
    setCur(null);
  }, [findQuery]);

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

  const countLabel =
    n === 0
      ? findQuery.trim()
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
      className="no-print card-lift absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-card/95 py-1 pl-2.5 pr-1 shadow-md backdrop-blur"
      role="search"
      aria-label="Find jobs on canvas"
    >
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
  );
}

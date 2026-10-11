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
 *  • Task 137 — the lens leads: the count label with matches on hand is
 *    a button that advances the cycle (one cursor, three triggers:
 *    Enter, next-arrow, count click), and the minimap's amber match
 *    chips jump to their job on a clean click (drag stays pan).
 *  • Task 138 — the TYPE half: a third chip row surfaces the palette's
 *    own workflow stages (RELION job-browser categories) that are
 *    actually present in the workspace. Three orthogonal dimensions —
 *    text ∧ status ∧ stage — combine in one exported predicate; a stage
 *    that doesn't exist can't be a filter, and a single-category
 *    workspace hides the row entirely.
 *  • Task 578 — the lens language. The bar now ENTERS like a lens
 *    lowering over the work (the t572 palette / t576 dashboard cascade
 *    grammar, third floating surface): input pill first, chip rows
 *    60/120ms behind, settle disarms, re-open remounts and replays.
 *    Two motion-semantics debts come due with it: (a) a wire drag used
 *    to UNMOUNT the bar — the stand-down is now opacity/pointer-events
 *    only, so a return is visibly NOT an arrival and the cascade never
 *    replays on a drag end; (b) the count is a polite live region and
 *    flashes the find dialect's amber when the cycle advances — the
 *    same hue the matched cards ring with.
 *  • t722 — the PARAM dialect. An explicit `key:value` query turns the
 *    lens into a parameter lookup ("which jobs ever ran mask = 20?"):
 *    the ring set is the matcher's param rung, cards ring WITHOUT any
 *    character wash (a value in the params grid has no surface text to
 *    claim), and an amber `params` badge says what kind of question is
 *    being answered. The badge arms from the SAME parse the matcher
 *    runs (parseParamQuery), so the marker and the meaning cannot
 *    disagree — one dialect, one parser, three consumers and a badge.
 *  • t782 — the NOTED half: a fourth chip row (StickyNote + "Noted")
 *    arms the judgment gate — the SAME hasJudgment the palette's Notes
 *    group, the header's count chip and the note spotlight read (one
 *    predicate, no second copy). Toggle semantics (not radio): judged
 *    or not is yes/no. Alone with an empty query it rings every judged
 *    job ("which steps did I have opinions about?"); combined it
 *    narrows any other dimension ("motion, but only the judged ones").
 *    The spotlight (N) is the ambient dim of the same predicate — the
 *    chip is its queryable ring, coexisting not competing. Active hue
 *    is the note family's amber (the color the app already speaks for
 *    judgments — canvas badge, palette capsule, spotlight icon).
 */

import * as React from "react";
import { ChevronDown, ChevronUp, Search, StickyNote, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { useActiveWorkspaceJobs, useWorkflowStore } from "@/lib/store";
import { jobMatchesFind } from "@/lib/job-match"; // t653 — the meaning lives in lib; t722 — the param rung rides the same lib
import { ParamDialectBadge } from "./param-dialect-badge"; // t724 — the dialect marker is one face for both search surfaces
import { JOB_CATEGORIES, jobType } from "@/lib/workflow";
import type { JobDTO, JobStatus } from "@/lib/types";
import { STATUS_CHIP } from "@/lib/status-style"; // t647 — the chip family lives with the word law
import { cn } from "@/lib/utils";

// t653 — the matcher itself (jobMatchesQuery, jobMatchesFind) moved to
// lib/job-match.ts: three consumers share it and lib is where shared
// meaning lives. This file keeps the UI — the bar, its chips, its
// parade — and imports the meaning from its new home.

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

/** Chip dialect — t647 moved it to lib/status-style (STATUS_CHIP),
 *  where the {dot, active} pair is composed from the same STATUS_TEXT
 *  ink the badges speak; the footer's status census borrows it from
 *  there directly. */

/** t584 — the chip cascade's timing words. The rows land first
 *  (find-drop: --find-d 0/60/120ms over a 220ms travel); then each chip
 *  lights at its row's LANDING + index × step — "the sentence lands,
 *  then its words are spoken in reading order". The step is 24ms
 *  (t579's ripple step): chips are small, their parade must stay
 *  snappy. The settle window (720ms in the arming effect below) is
 *  budgeted from these numbers: the type row lands at 340ms and the
 *  widest real-world chip row (~8 categories) finishes at
 *  340 + 7×24 + 160 = 668ms < 720ms — the disarm never cuts a chip
 *  mid-flight. Rung 0 (input pill, count, arrows, close) is the ANCHOR
 *  and never cascades — t572's law: the input is what everything else
 *  arrives to. If you retune the rows, retune these. */
const ROW_TRAVEL_MS = 220;
const CHIP_STEP_MS = 24;
const STATUS_CHIP_BASE_MS = 60 + ROW_TRAVEL_MS;
const TYPE_CHIP_BASE_MS = 120 + ROW_TRAVEL_MS;
// t782 — the noted rung stair: one rung past the type row (180ms base),
// same step clock — a fourth row keeps the cascade's grammar intact.
const NOTE_CHIP_BASE_MS = 180 + ROW_TRAVEL_MS;

/** The FULL find predicate — status gate first, then the text gate —
 *  lives in lib/job-match.ts (t653, next to the query matcher). */

export function CanvasFindBar() {
  const findOpen = useWorkflowStore((s) => s.findOpen);
  const findQuery = useWorkflowStore((s) => s.findQuery);
  const findStatus = useWorkflowStore((s) => s.findStatus);
  const findCategory = useWorkflowStore((s) => s.findCategory);
  // t782 — the noted half of the lens (fourth dimension)
  const findNoted = useWorkflowStore((s) => s.findNoted);
  const closeFind = useWorkflowStore((s) => s.closeFind);
  const setFindQuery = useWorkflowStore((s) => s.setFindQuery);
  const setFindStatus = useWorkflowStore((s) => s.setFindStatus);
  const setFindCategory = useWorkflowStore((s) => s.setFindCategory);
  const setFindNoted = useWorkflowStore((s) => s.setFindNoted);
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

  // Task 578 — the entrance cascade is a ONE-SHOT per open. TRAP: this
  // component does NOT mount on open — the early return sits after the
  // hooks, so the instance exists from page load (rendering null). An
  // arming state initialized at mount would be disarmed by its own settle
  // timer before the FIRST Ctrl+F ever landed (the live-fire caught this
  // dead on arrival). So arming follows the findOpen TRANSITION instead:
  // false → true arms the cascade and starts the settle window (the
  // budget is now two-phase: the type row lands at 120 + 220 = 340ms,
  // then its chips stair in — the widest row finishes ~668ms, so 720ms
  // is the first round number that never cuts a chip mid-flight);
  // true → false (a close) resets the edge so the next open replays. A
  // wire-drag stand-down never touches findOpen — the attribute stays
  // disarmed through it, so a drag return cannot replay the entrance
  // (a return is not an arrival).
  const [enterArmed, setEnterArmed] = React.useState(false);
  // t585 — the toggle answer's key set: which chips have earned a
  // click-settle THIS session. Populated only by post-arm activating
  // clicks (a click inside the entrance window is answered by color
  // alone — the cascade owns the chips' animation channel while armed),
  // and cleared on every open below: a fresh lens owns a fresh voice,
  // and a stale key from last session would ghost-pop at THIS
  // session's disarm (the CSS rule newly-matches the moment
  // data-find-enter leaves the root — the disarm must never become an
  // event). The set never shrinks while the lens is open: a
  // deactivation's silence comes from aria-pressed flipping back, not
  // from revoking the key — so a quick off→on replays the settle.
  const [chipSetKeys, setChipSetKeys] = React.useState<ReadonlySet<string>>(new Set());
  const findOpenEdge = React.useRef(false);
  React.useEffect(() => {
    if (findOpen && !findOpenEdge.current) {
      findOpenEdge.current = true;
      setEnterArmed(true);
      setChipSetKeys(new Set());
      const id = setTimeout(() => setEnterArmed(false), 720);
      return () => clearTimeout(id);
    }
    if (!findOpen) findOpenEdge.current = false;
  }, [findOpen]);

  const matches = React.useMemo(() => {
    if (!findOpen) return [] as JobDTO[];
    return jobs.filter((j) => jobMatchesFind(j, findQuery, findStatus, findCategory, findNoted));
  }, [findOpen, findQuery, findStatus, findCategory, findNoted, jobs]);

  const n = matches.length;

  // Categories actually PRESENT in the workspace, in the palette's own
  // order — a stage that doesn't exist can't be a filter, and the row
  // stays hidden entirely while every job shares one category (a lens
  // with nothing to separate promises nothing).
  const presentCategories = React.useMemo(() => {
    const present = new Set(jobs.map((j) => jobType(j.type)?.category));
    return JOB_CATEGORIES.filter((c) => present.has(c.key));
  }, [jobs]);

  // A new query, status chip, or type chip is a new world — the centered
  // index resets (and if jobs changed underneath a live index, the guard
  // in go() folds it back).
  React.useEffect(() => {
    setCur(null);
  }, [findQuery, findStatus, findCategory]);

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
      // t653 — the side effect leaves the updater. An updater must be a
      // pure computation: React runs it during the render phase (and
      // Strict Mode runs it TWICE), so the focusJob that used to live
      // inside was a hidden double-dispatch of the focus epoch AND the
      // source of React's setState-in-render warning. Compute from the
      // closure (every go() call is a discrete user event — no same-tick
      // re-entry), set, then focus: one dispatch, one arrival.
      const base = cur != null && cur < n ? cur : dir === 1 ? -1 : 0;
      const next = (base + dir + n) % n;
      focusJob(matches[next].id);
      setCur(next);
    },
    [cur, n, matches, focusJob],
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

  // The stand-down: a wire drag (pendingFrom) used to unmount the bar
  // entirely — which would have made any entrance choreography replay
  // on every drag end. Now the bar lowers its voice instead of leaving:
  // opacity 0, pointer-events none, aria-hidden — still mounted, still
  // disarmed, invisible to the drag and to assistive tech alike. A
  // return is not an arrival; the cascade agrees.
  if (!findOpen) return null;

  // Honest zero: with no query AND no chip the bar simply isn't looking
  // for anything (no count); but an armed lens with zero hits must say
  // so — the lens is on, the canvas has nothing that matches it.
  const countLabel =
    n === 0
      ? findQuery.trim() || findStatus !== "all" || findCategory !== "all" || findNoted
        ? "no matches"
        : ""
      : cur == null
        ? `${n} ${n === 1 ? "match" : "matches"}`
        : `${cur + 1} of ${n}`;

  // t724 — the dialect badge moved into its own component (the roster
  // search speaks the same dialect and imports the same marker); the
  // arming parse lives inside ParamDialectBadge, still the SAME parser
  // the matcher runs — the marker and the meaning cannot disagree.

  return (
    <div
      data-canvas-ui="find-bar"
      data-canvas-find-bar=""
      data-testid="canvas-find-bar"
      data-find-enter={enterArmed ? "true" : undefined}
      className={cn(
        "no-print card-lift absolute left-1/2 top-3 z-30 flex -translate-x-1/2 flex-col items-center gap-1.5 transition-opacity duration-150",
        pendingFrom && "pointer-events-none opacity-0",
      )}
      role="search"
      aria-label="Find jobs on canvas"
      aria-hidden={pendingFrom ? true : undefined}
    >
      <div
        data-find-rung="0"
        style={{ "--find-d": "0ms" } as React.CSSProperties}
        className="flex items-center gap-1 rounded-full border bg-card/95 py-1 pl-2.5 pr-1 shadow-md backdrop-blur"
      >
      <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <input
        ref={inputRef}
        data-testid="canvas-find-input"
        value={findQuery}
        onChange={(e) => setFindQuery(e.target.value)}
        onKeyDown={onInputKeyDown}
        placeholder="Find by name, type, or key:value…"
        aria-label="Find jobs by name, type, or key:value parameter query"
        autoComplete="off"
        spellCheck={false}
        className="w-48 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/60 sm:w-60"
      />
      {/* t722/t724 — the dialect badge: one shared face (same parser as
          the matcher, find amber, full law on hover) for both search
          surfaces. Rendered only while the dialect is armed. */}
      <ParamDialectBadge query={findQuery} testid="canvas-find-param-badge" />
      {/* Task 137 — the count is a DOOR: with matches on hand, clicking it
          advances the cycle (same go(1) as Enter/next — one cursor, three
          triggers). Rendered as a span only in the honest-zero state where
          there is nothing to cycle into. */}
      {n > 0 ? (
        <button
          type="button"
          data-testid="canvas-find-count"
          aria-live="polite"
          onClick={() => {
            go(1);
            // keyboard continuity: focus returns to the input so typing
            // keeps editing the query (plain focus — no select, appends
            // are honest; the opening effect owns the overtype-select)
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          title="Jump to next match"
          className="shrink-0 cursor-pointer whitespace-nowrap rounded px-0.5 text-[11px] font-medium tabular-nums text-muted-foreground transition-all motion-safe:active:scale-[0.96] hover:bg-muted/60 hover:text-foreground"
        >
          {/* keyed remount per label: the amber tick is a one-shot per
              change (t578), not a blinking ornament */}
          <span key={countLabel} data-find-tick="">{countLabel}</span>
        </button>
      ) : (
        <span
          data-testid="canvas-find-count"
          aria-live="polite"
          className={`shrink-0 whitespace-nowrap px-0.5 text-[11px] font-medium tabular-nums ${
            findQuery.trim() ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          <span key={countLabel} data-find-tick="">{countLabel}</span>
        </span>
      )}
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
        data-find-rung="1"
        style={{ "--find-d": "60ms" } as React.CSSProperties}
        role="group"
        aria-label="Filter matches by status"
        className="flex items-center gap-0.5 rounded-full border bg-card/95 px-1.5 py-1 shadow-md backdrop-blur"
      >
        {FIND_STATUSES.map(({ value, label }, chipIdx) => {
          const active = findStatus === value;
          const chip = STATUS_CHIP[value];
          return (
            <Chip
              key={value}
              size="md"
              interactive
              asChild
              className="flex gap-1.5"
            >
              <button
                type="button"
                data-testid={`canvas-find-status-${value}`}
                data-find-chip=""
                data-chip-set={chipSetKeys.has(`status:${value}`) ? "" : undefined}
                style={{ "--find-cd": `${STATUS_CHIP_BASE_MS + chipIdx * CHIP_STEP_MS}ms` } as React.CSSProperties}
                aria-pressed={active}
                title={active ? `Clear the ${label.toLowerCase()} filter` : `Only ${label.toLowerCase()} jobs`}
                onClick={() => {
                  const next = active ? "all" : value;
                  setFindStatus(next);
                  // t585 — the settle is an ACTIVATION answer and a POST-ARM
                  // one: a click inside the entrance window is answered by
                  // color alone, and the disarm itself never plays anything
                  // (a rule keyed only on aria-pressed would ghost-pop every
                  // still-active chip when data-find-enter is removed — the
                  // rule cannot tell the disarm from a click). The key set
                  // starts empty every open, so only genuine post-arm
                  // activations carry a voice.
                  if (!enterArmed && next !== "all") {
                    setChipSetKeys((prev) => new Set(prev).add(`status:${value}`));
                  }
                }}
                className={cn(
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
            </Chip>
          );
        })}
      </div>
      {/* Task 138 — the TYPE half of the lens: the palette's own workflow
          stages (RELION job-browser tree), surfaced only when present in
          the workspace and hidden entirely while every job shares one
          category. Radio semantics like the status chips; neutral active
          hue — a category spans several job types with several colors, so
          no single hue could speak for it without lying for the others. */}
      {presentCategories.length > 1 && (
        <div
          data-testid="canvas-find-type-row"
          data-find-rung="2"
          style={{ "--find-d": "120ms" } as React.CSSProperties}
          role="group"
          aria-label="Filter matches by type"
          className="flex max-w-[min(92vw,560px)] flex-wrap items-center justify-center gap-0.5 rounded-full border bg-card/95 px-1.5 py-1 shadow-md backdrop-blur"
        >
          {presentCategories.map(({ key, label, hint }, chipIdx) => {
            const active = findCategory === key;
            return (
              <Chip
                key={key}
                size="md"
                interactive
                asChild
                className={
                  active
                    ? "border-primary/60 bg-primary/10 text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }
              >
                <button
                  type="button"
                  data-testid={`canvas-find-type-${key}`}
                  data-find-chip=""
                  data-chip-set={chipSetKeys.has(`type:${key}`) ? "" : undefined}
                  style={{ "--find-cd": `${TYPE_CHIP_BASE_MS + chipIdx * CHIP_STEP_MS}ms` } as React.CSSProperties}
                  aria-pressed={active}
                  title={active ? `Clear the ${label} filter` : `Only ${hint.toLowerCase()}`}
                  onClick={() => {
                    const next = active ? "all" : key;
                    setFindCategory(next);
                    // t585 — same voice as the status chips: activation
                    // answers post-arm only; the release (next === "all")
                    // is quiet (dismissive actions get no ceremony).
                    if (!enterArmed && next !== "all") {
                      setChipSetKeys((prev) => new Set(prev).add(`type:${key}`));
                    }
                  }}
                >
                  {label}
                </button>
              </Chip>
            );
          })}
        </div>
      )}
      {/* t782 — the NOTED half of the lens: the fourth orthogonal
          dimension. hasJudgment is the ONE predicate the palette's Notes
          group, the header's count chip and the note spotlight already
          read — the chip is its QUERYABLE ring ("which steps did I have
          opinions about?" with an empty query; "motion, but only the
          judged ones" with text armed), while the spotlight (N) stays
          the ambient dim of the same predicate — coexisting, not
          competing. Toggle semantics (not radio: judged/not-judged is a
          yes/no, the lens has no third state). Active hue is the note
          family's own amber — the one color the app already speaks for
          judgments (the canvas badge, the palette capsule, the spotlight
          icon); the type row's neutral law doesn't apply here because a
          hue CAN speak for this row without lying for anyone. */}
      <div
        data-testid="canvas-find-note-row"
        data-find-rung="3"
        style={{ "--find-d": "180ms" } as React.CSSProperties}
        role="group"
        aria-label="Filter matches by note"
        className="flex items-center gap-0.5 rounded-full border bg-card/95 px-1.5 py-1 shadow-md backdrop-blur"
      >
        <Chip
          size="md"
          interactive
          asChild
          className={
            findNoted
              // the t728 whisper volume: the find stack's amber is a WASH
              // (the 5% fill + the 40% border, the LINE_EXEMPT signature) —
              // the text-color pair is the t647 ink residue the codemod
              // migrated away, and the chip borrows the judged wash, never
              // a second dialect
              ? "border-amber-500/40 bg-amber-500/5 text-foreground"
              : "border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          }
        >
          <button
            type="button"
            data-testid="canvas-find-noted"
            data-find-chip=""
            data-chip-set={chipSetKeys.has("note:noted") ? "" : undefined}
            style={{ "--find-cd": `${NOTE_CHIP_BASE_MS}ms` } as React.CSSProperties}
            aria-pressed={findNoted}
            title={findNoted ? "Clear the noted filter" : "Only jobs that carry a note or class judgment"}
            onClick={() => {
              const next = !findNoted;
              setFindNoted(next);
              // t585 — the same voice as the status/type chips: activation
              // answers post-arm only; the release is quiet.
              if (!enterArmed && next) {
                setChipSetKeys((prev) => new Set(prev).add("note:noted"));
              }
            }}
          >
            <StickyNote className="size-3" aria-hidden="true" />
            Noted
          </button>
        </Chip>
      </div>
    </div>
  );
}

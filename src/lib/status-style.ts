/**
 * t646 — the status→style single source.
 *
 * Before this file the status semantic lived in three uncoordinated
 * dialects: the minimap's hex map (SVG attrs can't take Tailwind classes),
 * the components' hand-paired `text-danger` ladders,
 * and the shadcn destructive token. t646 legislated the token layer in
 * globals.css (--danger / --success / --warning / --running, each with a
 * .dark ink rung) and this module is the CLASS layer on top: one map per
 * presentation role, keyed by the display word the whole app already
 * speaks (t322/t606: a Slurm-held remote run SAYS "pending" everywhere).
 *
 * The hex map is verbatim from canvas-minimap (t606-era) and stays the
 * SVG twin: SVG presentation attributes can't carry Tailwind classes, and
 * the minimap paints on the always-dark canvas, so its failed fill remains
 * rose-500 rather than flipping with the class-land token. Class
 * consumers get the token vocabulary; SVG consumers get the twin. One
 * semantic, two media, zero drift.
 *
 * Status surfaces that need a full entry (dot + ink + wash) consume the
 * three maps together; the per-status map triplets still scattered in
 * components (canvas-find-bar, project-dashboard, sibling-compare-picker)
 * are the documented next collection wave — their rose/red sites were
 * tokenized in place by the t646 codemod, so the pixels already agree.
 *
 * t647 — the "documented next collection wave" landed: the four
 * component-local maps (job-card STATUS_STYLES/STATUS_FLOOR,
 * canvas-find-bar STATUS_CHIP, project-dashboard + sibling-compare-picker
 * STATUS_DOT) moved here, and the maps below obey a THREE-RUNG LAW that
 * t646's rose pass implied but never had to state:
 *
 *   1. INK (text) — deep rung SEMANTIC tokens (t648), EXCEPT failed.
 *      The 600 rungs of the t646 tokens are 3.2:1 (amber), 3.8:1
 *      (emerald), and 3.8:1 (teal) against white — below the 4.5:1 a
 *      10px semibold badge word needs. rose-600 measures ≈4.5:1, which
 *      is why the t646 codemod could retire the whole rose ink ladder
 *      into `text-danger` without a readability regression. t648 kept
 *      this verdict and legislated what it predicted: the semantic RUNG
 *      tokens (--color-warning-700 dark-side twin comes from the use-site
 *      dark: prefix, values verbatim from the palette), so the field's
 *      700/300 pairs renamed hue→semantic with zero pixels moved. Deep
 *      ink tokens live HERE and in the non-exempt components; the
 *      literal hue names survive only in the identity-exempt files
 *      (t647's list) and this head note's history.
 *   2. WASH / BORDER (α classes) — token vocabulary (bg-success/10,
 *      border-running/25 …). An α wash reads as "the hue, diluted"; the
 *      500→600 base shift underneath it is the same verdict the t646
 *      codemod already passed for rose washes.
 *   3. SOLID (dots, floors) — 400/500-runge literals, the t646 tail
 *      verdict: a solid swatch IS the rung, re-basing it to 600 would
 *      visibly darken every dot on every surface.
 *
 *   Plus two neutral laws: idle's grey is the world's zinc (slate was a
 *   job-card private dialect; the minimap's idle hex #a1a1aa IS
 *   zinc-400), and MOTION STAYS AT THE CALL SITE — the maps hold color
 *   only, a surface that wants its dot breathing adds
 *   animate-soft-pulse next to it (the "primitive holds the skeleton,
 *   the site holds the layout" split, t642/t645).
 */

/** t322 — a Slurm-queued remote run is NOT "running": the scheduler holds
 * the job (PENDING, often waiting on an upstream afterok dependency — the
 * user's autopick-while-ctffind-runs report). The DB status stays
 * "running" (the sweep's honest ladder owns the lifecycle), but every
 * STATUS SURFACE renders the scheduler's own word instead. Relocated from
 * job-card (t646): the word law is lib-level, not a component's shared
 * bit — job-card re-exports it so its five importers keep their paths. */
export function isSlurmQueued(job: {
  status: string;
  runRemote?: { mode?: string; slurmState?: string } | null;
}): boolean {
  return (
    job.status === "running" &&
    job.runRemote?.mode === "slurm" &&
    job.runRemote?.slurmState === "PENDING"
  );
}

/** status → minimap/SVG fill (hex twin; see head note). */
export const STATUS_HEX = {
  idle: "#a1a1aa",
  pending: "#f59e0b",
  running: "#14b8a6",
  completed: "#10b981",
  failed: "#f43f5e",
} as const;

export type StatusWord = keyof typeof STATUS_HEX;

/** The display word every status surface renders (minimap floor, cards,
 * badges). The single copy of the t322 dialect chain. */
export function statusWord(job: {
  status: string;
  runRemote?: { mode?: string; slurmState?: string } | null;
}): StatusWord {
  return (isSlurmQueued(job) ? "pending" : job.status || "idle") as StatusWord;
}

/** status → ink (text). t648: semantic RUNG tokens (warning-700/
 * running-700/success-700 + dark: 300 twins) — the t647 deep literals
 * with the hue name retired, pixels identical (the t648 tokens carry
 * the palette's own oklch). The 600 token rungs still miss 4.5:1 on
 * white — see head note; failed rides the token because rose-600
 * passes where they don't; idle is zinc (was zinc here but slate in
 * job-card — zinc won). */
export const STATUS_TEXT: Record<StatusWord, string> = {
  idle: "text-zinc-600 dark:text-zinc-400",
  pending: "text-warning-700 dark:text-warning-300",
  running: "text-running-700 dark:text-running-300",
  completed: "text-success-700 dark:text-success-300",
  failed: "text-danger",
};

/** status → outline border. Token washes for α borders (t647 rung 2);
 * idle's zinc replaces job-card's private slate dialect. */
export const STATUS_BORDER: Record<StatusWord, string> = {
  idle: "border-zinc-300 dark:border-zinc-600",
  pending: "border-amber-400/60 dark:border-amber-500/50",
  running: "border-teal-400/60 dark:border-teal-500/50",
  completed: "border-emerald-400/60 dark:border-emerald-500/50",
  failed: "border-danger/60",
};

/** status → the outline-badge pair (t350 StatusBadge + details panel).
 * Composed from the two maps above so the ink rung has ONE home —
 * the t647 shape: border here is arrangement, STATUS_TEXT is law. */
export const STATUS_BADGE: Record<StatusWord, string> = Object.fromEntries(
  (Object.keys(STATUS_TEXT) as StatusWord[]).map((w) => [
    w,
    `${STATUS_BORDER[w]} ${STATUS_TEXT[w]}`,
  ]),
) as Record<StatusWord, string>;

/** status → presence dot (bg). SOLID rung — literals on purpose (t647
 * rung 3); motion belongs to the call site (animate-soft-pulse). */
export const STATUS_DOT: Record<StatusWord, string> = {
  idle: "bg-zinc-400 dark:bg-zinc-500",
  pending: "bg-amber-500",
  running: "bg-teal-500",
  completed: "bg-emerald-500",
  failed: "bg-danger",
};

/** status → soft wash (bg/α), for chips and band fills. */
export const STATUS_SOFT: Record<StatusWord, string> = {
  idle: "bg-zinc-500/10",
  pending: "bg-warning/10",
  running: "bg-running/10",
  completed: "bg-success/10",
  failed: "bg-danger/10",
};

/** status → the canvas floor strip (t350): a 3px accent across the
 * card's bottom edge that reads as a bar chart at canvas distance
 * before any text is legible. Idle gets a zinc whisper, not nothing:
 * "not yet run" is a different floor than "no floor" (slate → zinc,
 * t647 neutral law). 400-runge solids — literal rung on purpose. */
export const STATUS_FLOOR: Record<StatusWord, string> = {
  idle: "bg-zinc-400/25 dark:bg-zinc-500/30",
  pending: "bg-amber-400/80 dark:bg-amber-400/75",
  running: "bg-teal-400/85 dark:bg-teal-400/80",
  completed: "bg-emerald-400/75 dark:bg-emerald-400/70",
  failed: "bg-rose-500/85 dark:bg-rose-500/80",
};

/** status → find-bar filter chip ({dot, active pair}). Migrated from
 * canvas-find-bar (t647): the dot is the SOLID rung, the active face is
 * wash+border (token) under the STATUS_TEXT ink. Exported for footer's
 * status census — every surface that speaks "status" uses the world's
 * own vocabulary, borrowed not reinvented. */
export const STATUS_CHIP: Record<StatusWord, { dot: string; active: string }> = {
  idle: {
    dot: "bg-zinc-400",
    active: `border-zinc-400/70 bg-zinc-500/10 ${STATUS_TEXT.idle}`,
  },
  pending: {
    dot: "bg-amber-500",
    active: `border-warning/70 bg-warning/10 ${STATUS_TEXT.pending}`,
  },
  running: {
    dot: "bg-teal-500",
    active: `border-running/70 bg-running/10 ${STATUS_TEXT.running}`,
  },
  completed: {
    dot: "bg-emerald-500",
    active: `border-success/70 bg-success/10 ${STATUS_TEXT.completed}`,
  },
  failed: {
    dot: "bg-danger",
    active: `border-danger/70 bg-danger/10 ${STATUS_TEXT.failed}`,
  },
};

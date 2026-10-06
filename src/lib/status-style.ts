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

/** status → ink (text). Token vocabulary; the .dark rung rides the token. */
export const STATUS_TEXT: Record<StatusWord, string> = {
  idle: "text-zinc-600 dark:text-zinc-400",
  pending: "text-warning",
  running: "text-running",
  completed: "text-success",
  failed: "text-danger",
};

/** status → presence dot (bg). */
export const STATUS_DOT: Record<StatusWord, string> = {
  idle: "bg-zinc-400 dark:bg-zinc-500",
  pending: "bg-warning",
  running: "bg-running",
  completed: "bg-success",
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

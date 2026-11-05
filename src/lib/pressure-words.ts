/**
 * t880 — the pressure face's client-safe word birthplace.
 *
 * diagnostics.ts owns the READER (the dmesg spawn, /proc reads — node
 * only); this module owns the WORDS the browser speaks about them. The
 * t1165 precedent (world-durability-words.ts): one father per word, a
 * lane the dialog and the AI presenter share, zero node imports — the
 * client mirror and the server's payload compose the same clause from
 * the same arithmetic, so a kills-count and its tempo can never drift
 * apart between the card and the locator line.
 */

export interface OomTempoInput {
  oomKills: number | null;
  uptimeHours: number | null;
}

/**
 * The tempo word: the war's tempo, not just its count. Nine kills mean
 * nothing without the boot's length — nine kills in 90 minutes is a
 * violent box (the t879 witness campaign), nine kills in a month is
 * weather. One father, one precision: kills-per-day at one decimal
 * below ten, integer above. Null when either input is absent — the
 * caller's own sentence already speaks the count, never a guessed rate.
 */
export function oomTempoWord(oomKills: number | null, uptimeHours: number | null): string | null {
  if (oomKills == null || oomKills <= 0 || uptimeHours == null) return null;
  if (uptimeHours < 1) {
    return oomKills === 1 ? "a kill within the first hour up" : `${oomKills} kills within the first hour up`;
  }
  const perDay = (oomKills / uptimeHours) * 24;
  const word = perDay >= 10 ? Math.round(perDay).toString() : perDay.toFixed(1);
  return `≈${word}/day over ${uptimeHours < 10 ? uptimeHours.toFixed(1) : Math.round(uptimeHours)}h up`;
}

/**
 * t882 — the thread-dialect LAW: the kernel kills a task-group and names
 * the TASK it chose, and some tasks wear thread titles, not process names.
 * `MainThread` is chromium's title for a process's main thread (browser +
 * every renderer); our own lane's main thread wears process.title
 * ("next-server (v1") — so a MainThread death in the ring is the BROWSER's,
 * never the pipeline's. The set holds only witnessed dialects (the
 * fixture-truth law: names the machine actually wrote, t881's cure in
 * word form) — grow it when the ring writes a new one, never before.
 * ONE birthplace: the parser's fixtures, the combatants word and the
 * dialog's note all speak this law from here (the t1165 precedent).
 */
const THREAD_TITLES: readonly string[] = ["MainThread"];

export function isThreadComm(comm: string | null | undefined): boolean {
  return comm != null && THREAD_TITLES.includes(comm);
}

export interface OomCombatantInput {
  comm: string;
  kills: number;
}

/**
 * t881 — the combatants word: the war's histogram, not just its last
 * victim. The tempo says how fast the war runs; this says who fights in
 * it — the kernel's dead, tallied by comm, in the parser's own order
 * (kills-desc, recency tiebreak — the word renders what it is given, no
 * re-sort). Caps at the top three with an honest "+N more" tail: a
 * locator line is a locator, not the full ledger. Null when there is
 * nothing to tally — no victims, or a tally of nobody (non-positive
 * counts are garbage the kernel never writes; filtered, the A6
 * tolerance precedent).
 */
export function oomCombatantsWord(victims: OomCombatantInput[] | null | undefined): string | null {
  const alive = (victims ?? []).filter((v) => v && typeof v.comm === "string" && v.comm.length > 0 && Number.isFinite(v.kills) && v.kills > 0);
  if (alive.length === 0) return null;
  // t882 — the thread-dialect law rides the word itself: a combatant that
  // wears a thread's title is NAMED so on both faces (the locator line and
  // the dialog row compose the same clause from the same father — no drift).
  const top = alive
    .slice(0, 3)
    .map((v) => (isThreadComm(v.comm) ? `${v.comm} ×${v.kills} (thread)` : `${v.comm} ×${v.kills}`));
  const more = alive.length - top.length;
  return more > 0 ? `${top.join(" · ")} +${more} more` : top.join(" · ");
}

export interface OomInvokerInput {
  comm: string;
  invocations: number;
}

/**
 * t882 — the invokers word: the rope's holders, not just the last one.
 * The last-victim clause names who held the allocator's rope AT the last
 * kill; this tallies EVERY invocation the ring wrote — the war has
 * regulars on the ROPE side too, and the t881 window's own tail showed
 * the whale invoking its own execution ("next-server (v1 invoked
 * oom-killer"). Same shape as the combatants word: the parser's order
 * rendered verbatim (invocations-desc, recency tiebreak), top three,
 * the honest "+N more" tail, the A6 garbage filter. Null when nobody
 * held the rope (a quiet ring).
 */
export function oomInvokersWord(invokers: OomInvokerInput[] | null | undefined): string | null {
  const alive = (invokers ?? []).filter(
    (v) => v && typeof v.comm === "string" && v.comm.length > 0 && Number.isFinite(v.invocations) && v.invocations > 0,
  );
  if (alive.length === 0) return null;
  const top = alive.slice(0, 3).map((v) => `${v.comm} ×${v.invocations}`);
  const more = alive.length - top.length;
  return more > 0 ? `${top.join(" · ")} +${more} more` : top.join(" · ");
}

export interface OomTrendInput {
  comm: string;
  /** the combatant's last deaths, chronological (ring order), MB */
  sizes: number[];
}

/**
 * t882 — the leak word: the whale's growth curve, not just its last size.
 * A combatant whose recent deaths keep growing is not having bad luck —
 * it is a LEAK (the t881 window watched the whale's three most recent
 * deaths go 2770→2845→2951MB while it died 70 times). The word fires
 * only when the parser's trend is present (the LAST THREE deaths of the
 * war's top combatant, each strictly greater than its predecessor — the
 * machine wrote a rising sequence; anything else is weather and stays
 * silent, never a guessed curve). One father: the locator line and the
 * dialog's danger row compose the same clause.
 */
export function oomLeakWord(trend: OomTrendInput | null | undefined): string | null {
  if (!trend || typeof trend.comm !== "string" || trend.comm.length === 0) return null;
  const sizes = trend.sizes ?? [];
  if (sizes.length < 3) return null;
  const rising = sizes[sizes.length - 3] < sizes[sizes.length - 2] && sizes[sizes.length - 2] < sizes[sizes.length - 1];
  if (!rising) return null;
  const seq = sizes.slice(-3).join("→");
  return `${trend.comm} grows at every death — ${seq}MB: a leak signature`;
}

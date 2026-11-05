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

export interface OomPairingInput {
  invoker: string;
  victim: string;
  count: number;
}

/**
 * t883 — the pairings word: whose hand tripped WHICH death. The holders
 * word says who holds the rope; this says whose deaths the rope tripped —
 * `chrome→next-server (v1 ×17` reads "chrome's hand, next-server's death,
 * seventeen times". Same shape as its siblings: the parser's order verbatim
 * (count-desc, recency tiebreak — no re-sort), top three, the honest
 * "+N more" tail, the A6 garbage filter (non-positive counts, empty comms).
 * Null when nothing paired — a quiet ring, or a ring whose only ropes are
 * the kernel stewards' (their kills are nobody's war crime).
 */
export function oomPairingsWord(pairings: OomPairingInput[] | null | undefined): string | null {
  const alive = (pairings ?? []).filter(
    (p) =>
      p &&
      typeof p.invoker === "string" &&
      p.invoker.length > 0 &&
      typeof p.victim === "string" &&
      p.victim.length > 0 &&
      Number.isFinite(p.count) &&
      p.count > 0,
  );
  if (alive.length === 0) return null;
  // t884 — the thread-dialect law rides the pairing's VICTIM side too: a rope
  // killing a THREAD is the war's crossfire (`libuv-worker→MainThread ×4
  // (thread)` — the combatants word named the dead, the pairing names the
  // crossfire, both faces mark the thread dialect from the ONE law).
  const top = alive
    .slice(0, 3)
    .map((p) => (isThreadComm(p.victim) ? `${p.invoker}→${p.victim} ×${p.count} (thread)` : `${p.invoker}→${p.victim} ×${p.count}`));
  const more = alive.length - top.length;
  return more > 0 ? `${top.join(" · ")} +${more} more` : top.join(" · ");
}

export interface OomCadenceInput {
  /** the current boot's rope leader (the ring's top invoker at the last observation) */
  topInvoker: string | null;
  /** its invocation count this boot */
  topInvokerCount: number | null;
  /** how many of the ledger's leader-named boots this same comm led (incl. current) */
  ledBoots: number | null;
  /** boots on record with a named leader at all */
  bootsWithLeader: number;
}

/**
 * t885 — the persistence predicate BEHIND the cadence word: the SAME hand
 * led two or more of the ledger's boots. Exported because the verdict has
 * TWO mouths — the word's text and the dialog row's tone — and both must
 * read the SAME law from ONE birthplace (the t1165 one-father law, applied
 * to a color — the t884 predicate's own precedent).
 */
export function oomCadencePersistent(input: OomCadenceInput | null | undefined): boolean {
  if (!input) return false;
  return Number.isFinite(input.ledBoots) && (input.ledBoots ?? 0) >= 2;
}

/**
 * t885 — the cadence word: who DROVE the war, boot over boot. The holders
 * word (t882) tallies one boot's ropes; the pairings (t883) name whose hand
 * tripped which death; this word asks the LEDGER's question — is one invoker
 * the boot's engine, and does that dominance persist across boots (tokio ×19
 * in one boot: is the whale's own worker pool the war's engine, or one bad
 * afternoon?). Three faces, each speaking only what the ledger holds:
 *  - the QUIET share (one leader-named boot): "N of this boot's K kills rode
 *    X's rope" — the holders row lists ×N; the word adds the denominator;
 *  - the WEATHER face (≥2 leader-named boots, the leader changed): "X led a
 *    of the last b boots — the rope changes hands" — no verdict over history;
 *  - the LOUD verdict (every leader-named boot led by the same hand,
 *    oomCadencePersistent): "the same hand drives the war" — a repeated
 *    dominance is an engine, not an afternoon.
 * A boot with no named rope (or a lone invocation — lastInvoker's own news)
 * rests; one boot with a leader speaks only the share. The denominator is
 * the caller's oomKills (the ring's own count — never a guessed total).
 */
export function oomCadenceWord(
  input: OomCadenceInput | null | undefined,
  oomKills: number | null | undefined,
): string | null {
  if (!input || typeof input.topInvoker !== "string" || input.topInvoker.length === 0) return null;
  const count = input.topInvokerCount;
  if (!Number.isFinite(count) || (count ?? 0) < 2) return null; // a lone invocation is the invoked-by clause's news
  const boots = input.bootsWithLeader;
  if (!Number.isFinite(boots) || (boots ?? 0) < 1) return null;
  if (oomCadencePersistent(input)) {
    if (input.ledBoots === boots) {
      return `${input.topInvoker} led every boot on record (${boots}) — the same hand drives the war`;
    }
    return `${input.topInvoker} led ${input.ledBoots ?? 1} of the last ${boots} boots — the rope changes hands`;
  }
  if (boots > 1) {
    return `${input.topInvoker} led 1 of the last ${boots} boots — the rope changes hands`;
  }
  // the quiet share: one leader-named boot, the denominator the ring owns
  if (!Number.isFinite(oomKills) || (oomKills ?? 0) <= 0) return null;
  return `${count} of this boot's ${oomKills} kills rode ${input.topInvoker}'s rope`;
}

export interface OomBootLedgerInput {
  /** the distinct boots on record (rows in the ledger, whatever their ring access) */
  boots: number;
  /** the most recent whale's comm (the current boot's top combatant) */
  whaleComm: string | null;
  /** the whale's per-boot last-death sizes, chronological, MB — only boots
   *  whose top combatant matches the current whale (the whale-run guard) */
  whaleSizesMb: number[];
}

/**
 * t884 — the rising predicate BEHIND the boot word: the whale's per-boot
 * last-death sizes, strictly rising across the last three DISTINCT boots.
 * The predicate is exported because the verdict has TWO mouths — the word's
 * text and the dialog row's tone — and both must read the SAME law from ONE
 * birthplace (the t1165 one-father law, applied to a color).
 */
export function oomBootLedgerRising(input: OomBootLedgerInput | null | undefined): boolean {
  const sizes = input?.whaleSizesMb ?? [];
  if (sizes.length < 3) return false;
  const tail = sizes.slice(-3);
  return tail[0] < tail[1] && tail[1] < tail[2];
}

/**
 * t884 — the boot word: the whale's growth ACROSS boots, not just within one.
 * The kernel ring is a per-boot buffer — it rotates on reboot and the leak
 * word (t882) sees only the current boot's curve, while the REAL leak is the
 * per-boot growth the worklog watched across windows (2770→3204→3077MB). The
 * boot ledger (db/boot-ledger.json, one row per boot_id) remembers what the
 * ring forgets; this word is its mouth. Two faces:
 *  - the QUIET fact (boots ≥ 2, no rising claim): "N boots on record — a→b→cMB
 *    across boots" — the ledger's own numbers, verbatim, no verdict;
 *  - the LOUD verdict (≥3 boots, strictly rising — oomBootLedgerRising): the
 *    leak crosses boots.
 * One boot is what the ring already says — the word rests. Non-rising is
 * weather — the verdict stays home (the t882 law: never a guessed curve).
 */
export function oomBootLedgerWord(input: OomBootLedgerInput | null | undefined): string | null {
  if (!input || !Number.isFinite(input.boots) || input.boots <= 1) return null;
  const comm = input.whaleComm;
  const sizes = (input.whaleSizesMb ?? []).filter((n) => Number.isFinite(n) && n > 0);
  if (!comm || sizes.length === 0) return null;
  const seq = sizes.join("→");
  if (oomBootLedgerRising(input)) {
    return `${comm} grows across boots — ${seq}MB over ${input.boots} boots: the leak crosses boots`;
  }
  return `${input.boots} boots on record — ${seq}MB across boots`;
}

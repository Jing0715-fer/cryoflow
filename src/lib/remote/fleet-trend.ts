/**
 * CryoFlow — the fleet trend's ONE VOICE (t1056).
 *
 * The trend ring (t1055) found its first mouth in the storage dialog's
 * strip — and its arithmetic (bar heights, per-bar titles, the delta's
 * four voices) was written INLINE there. The dashboard's fleet card is
 * the ring's third mouth; three mouths drawing the same ring must not
 * carry three copies of the arithmetic (twins fork, imports don't —
 * the one-well law's third face). This module is the well: PURE in,
 * spec out — bars (oldest → newest, the current closing the line),
 * each bar's own title, and the paragraph's voice — with the caller
 * injecting fmtBytes and the stamp so the voice speaks the mouth's own
 * dialect (the dialog's graveAge words; the card's identical words).
 *
 * Self-contained by design: NO imports (not even type-only from the
 * ledger lib — a client mouth must never drag the server module into
 * the bundle; structural typing does the coupling: any {at, bytes}
 * ring and any {at: string, bytes: number|null} point drinks here).
 *
 * t1058 — the well deepens twice. ONE: the DELTA'S ARITHMETIC (which
 * of the five kinds, the magnitude) leaves the voice's lap and lives
 * in its own pure export (fleetTrendDelta) — the AI's server breath
 * (tools.ts) drinks the same arithmetic without dragging bars along,
 * and the voice below is a dialect spoken OVER the kinds. TWO: the
 * spec carries ringCount (the remembered measures, past only) so
 * every mouth speaks the ring's length from ONE home — the count
 * nobody sees is a count that isn't there.
 */

/** the strip's tallest bar, in px (the dialog's 24px line, kept) */
export const FLEET_TREND_BAR_PX = 24;

/** a bar's floor, in px — a small-but-nonzero measure still shows */
export const FLEET_TREND_BAR_MIN_PX = 4;

/** the ring's cap — the ledger remembers the last 12 measures; older
 *  ones roll off. Lives HERE (the client-safe well) so the client
 *  mouths can speak it without dragging the server ledger module into
 *  the bundle; fleet-ledger.ts imports it back (the arrow points the
 *  safe way — server drinks client-safe, never the reverse). */
export const FLEET_TREND_RING_CAP = 12;

/** the family bell — dispatched by ANY measure seat that just bought a
 *  successful live measure (the dialog's, the card's), heard by every
 *  mouth that serves the ring from a cached read (the KPI band's
 *  sparkline). One ring, many mouths: when one mouth re-measures, the
 *  others re-pour — nobody drinks a stale cup in silence. */
export const FLEET_MEASURED_EVENT = "cryoflow:fleet-measured";

/** t1061 — the loop-closer's bell: dispatched by any ring chip seat
 *  (the storage dialog's, the dashboard card's), heard by the header —
 *  the diagnostics door's owner — which closes whichever dialog holds
 *  the seat and opens System diagnostics AT the fleet memory section
 *  (the focus/scroll/pulse handshake lives there; this event only
 *  names the door). Same reverse-hop handshake as the report/storage
 *  doors: the seat never mounts a second panel, it only rings. */
export const FLEET_DIAG_FOCUS_EVENT = "cryoflow:focus-fleet-diagnostics";

/** one remembered measurement — structurally the ledger's
 * FleetHistoryPoint (at + bytes, bytes null = that measure heard
 * nothing from the cluster: an honest hole, never a fake zero). */
export interface FleetTrendPoint {
  at: string;
  bytes: number | null;
  /** t1095 — the SECOND CHANNEL: the local mirrors' own total at that
   *  measurement, remembered beside the cluster bytes. Two states beyond
   *  a number, both honest, both SILENT: undefined = the point predates
   *  the channel (the sidecar's old generation — the key is absent on
   *  disk, never a fake null); null = the measure's mirror walk didn't
   *  speak. An end without a word never speaks — the span's mirror
   *  clause waits until BOTH ends remember. */
  mirrorBytes?: number | null;
}

export interface FleetTrendBar {
  /** "past" = a ring point (answered or hole); "current" = the row's
   *  own numbers closing the line. */
  kind: "past" | "hole" | "current";
  at: string;
  bytes: number | null;
  /** computed height, ready for style.height */
  heightPx: string;
  /** the bar's own voice (the title) — spoken per bar, not per strip */
  title: string;
  /** t1062 — the HOP that landed on this bar, in the delta's own
   *  vocabulary: the comparison against the bar BEFORE it in draw order
   *  (oldest → newest). The first drawn bar says "begins"; a hop that
   *  crosses a hole (either end) says "hole" — never an up/down against
   *  air. The mouths choose their dialect over the kinds (the OPS
   *  spark paints them; the strips may follow); the ARITHMETIC lives
   *  here once. */
  hopKind?: FleetTrendDeltaKind;
  /** t1064 — the hole's POSITION story: true only for a hole that is
   *  the RING's newest point (the ring dialect's end — the air is
   *  NOW). The mouths draw the trailing stub with a denser edge; the
   *  mid-ring holes keep their muted dash. Never a color from the hop
   *  vocabulary — the air speaks no up/down. */
  trailing?: true;
  /** t1067 — the hole ENTRY EDGE: set only when the hole's LEFT
   *  neighbor (draw order) answered and its own hop carried a COLOR
   *  (up or down) — the climb or the cleanup ran INTO the silence, and
   *  the mouths paint that dialect on the boundary edge (the stub's
   *  left border) so the story stays visible without hover. The edge
   *  is the NEIGHBOR's earned color, never the hole's own verdict —
   *  the stub keeps its muted dash (the air speaks no up/down); after
   *  a flat hop there is no color to carry, after another hole the air
   *  speaks nothing, and the first bar has no left neighbor at all. */
  edgeInto?: "up" | "down";
  /** t1070 — the GAP marker: true only for a hole whose LEFT neighbor
   *  in draw order ANSWERED — the boundary where the answers stopped
   *  (the gap between the last answered bar and the first stub). The
   *  mouths compose the boundary stub's hover title with the memory's
   *  whole silence story (fleetTrendGapTitle's one law). Not a color,
   *  not a verdict — the stub face stays muted and dashed; the
   *  edgeInto colors keep their own law beside it. */
  runFirst?: true;
}

export interface FleetTrendSpec {
  /** oldest → newest left → right; the current measurement is last. */
  bars: FleetTrendBar[];
  /** the scale the heights were computed against (≥1, never 0) */
  maxBytes: number;
  /** the ring's newest PAST point (null = the trend begins here) */
  prev: FleetTrendPoint | null;
  /** the paragraph's voice — the four+one delta dialect */
  voice: string;
  /** t1058 — the ring's length from its ONE home: the PAST measures
   *  the mouth was handed (the current closes the line but only joins
   *  the ring on the next push, server-side). Every mouth that speaks
   *  "ring N/12" reads THIS number — no mouth counts twice. */
  ringCount: number;
}

/** the delta's five kinds — the ARITHMETIC's whole vocabulary. The
 *  voices (the spec's paragraph, the AI's mid-breath chip) are dialects
 *  spoken over these kinds; the comparison itself lives once. */
export type FleetTrendDeltaKind = "begins" | "hole" | "up" | "down" | "same";

export interface FleetTrendDelta {
  kind: FleetTrendDeltaKind;
  /** |current − prev| — 0 for begins / hole / same (nothing to speak) */
  deltaBytes: number;
  /** the ring's newest PAST point the delta spoke against (null only
   *  for "begins" — the ledger remembers no measure before this one) */
  prev: FleetTrendPoint | null;
}

/**
 * t1058 — the delta's arithmetic, ONE copy (the one-well law's server
 * face: tools.ts drinks this from Node; the browser mouths drink it
 * from the bundle; the module has no imports, so the arrow points the
 * safe way on both sides).
 *
 * @param history the PAST measurements, NEWEST FIRST (the ledger's
 *   dialect); the current row's numbers are NOT in it.
 * @param currentBytes the present: the connection's current measured
 *   total (answered probes only).
 */
export function fleetTrendDelta(args: {
  history: FleetTrendPoint[];
  currentBytes: number;
}): FleetTrendDelta {
  const prev = args.history[0] ?? null;
  if (!prev) return { kind: "begins", deltaBytes: 0, prev: null };
  if (prev.bytes == null) return { kind: "hole", deltaBytes: 0, prev };
  const d = args.currentBytes - prev.bytes;
  return {
    kind: d > 0 ? "up" : d < 0 ? "down" : "same",
    deltaBytes: Math.abs(d),
    prev,
  };
}

/** t1062 — the hop walk, ONE copy: every bar learns the delta that
 *  landed on it (vs the bar before it in draw order). The first drawn
 *  bar says "begins"; a hop crossing a hole (either end) says "hole"
 *  — no up/down against air. PURE, self-contained. */
function withHopKinds(bars: FleetTrendBar[]): FleetTrendBar[] {
  return bars.map((bar, i) => {
    if (i === 0) return { ...bar, hopKind: "begins" as const };
    const prev = bars[i - 1];
    if (prev.bytes == null || bar.bytes == null) {
      return { ...bar, hopKind: "hole" as const };
    }
    const d = bar.bytes - prev.bytes;
    return {
      ...bar,
      hopKind: d > 0 ? ("up" as const) : d < 0 ? ("down" as const) : ("same" as const),
    };
  });
}

/**
 * t1062 — the ring's REACH as one sentence: how far back the memory
 * goes, and what changed across that reach. The client face of the
 * span story (the AI's drill speaks its own server dialect over the
 * same kinds); any mouth that can show a ring can show this — one
 * arithmetic, one home. Honest guards: a one-point ring says nothing
 * (its "begins" already spoke); a newest end that is a hole silences
 * the span (no delta against air); a far end that is a hole is NAMED.
 *
 * @param history the ring as the sidecar holds it, NEWEST FIRST.
 * @returns the sentence, or null when the ring's reach says nothing.
 */
export function fleetTrendSpanVoice(args: {
  history: FleetTrendPoint[];
  fmtBytes: (n: number) => string;
  stampAgo: (iso: string) => string;
}): string | null {
  const { history, fmtBytes, stampAgo } = args;
  if (history.length < 2) return null;
  const newest = history[0];
  const oldest = history[history.length - 1];
  if (newest.bytes == null) return null;
  // t1095 — the SECOND CHANNEL's own voice: when BOTH ends of the reach
  // remember the mirror total, the span speaks the mirrors' arc beside
  // the cluster's — same three branches, the local domain named ("here",
  // beside the cluster's "on the cluster then"). An end without a word
  // (undefined = channel-young, null = the walk didn't speak) silences
  // the clause — the channel's youth is paid in measures, and silence
  // is the honest word for not-yet. The clause RIDES every span
  // sentence (it never speaks alone): the newest-is-hole guard above
  // keeps the whole voice quiet, and this append never resurrects it —
  // and the CLUSTER channel's own silence at the far end does NOT
  // silence the mirror's word (two channels, two words — a cluster
  // hole at the far measure says nothing about what the mirrors held).
  // t1098 — the walk itself moved to fleetMirrorArc (ONE home): the
  // ceiling's temporal face drinks the same arc, the span keeps its
  // sentence — twins fork, maps don't. The output is byte-for-byte
  // the shape this clause has spoken since t1095.
  const arc = fleetMirrorArc({ history });
  let mirror = "";
  if (arc) {
    mirror =
      arc.kind === "up"
        ? ` The mirrors held ${fmtBytes(arc.oldest)} here then, up ${fmtBytes(arc.deltaBytes)} across the reach.`
        : arc.kind === "down"
          ? ` The mirrors held ${fmtBytes(arc.oldest)} here then, down ${fmtBytes(Math.abs(arc.deltaBytes))} across the reach.`
          : ` The mirrors held ${fmtBytes(arc.oldest)} here then, unchanged across the reach.`;
  }
  if (oldest.bytes == null) {
    return `The ring reaches back ${stampAgo(oldest.at)} — but the far end is an honest hole.${mirror}`;
  }
  // t1063 — the words are the AI drill's dialect (t1060's richer shape:
  // "on the cluster then" names the domain, "the ring's reach" names
  // the subject) — the drill now drinks THIS sentence (the one-voice
  // move), so the enrichment rides every mouth at once.
  const delta = fleetTrendDelta({ history: [oldest], currentBytes: newest.bytes });
  const cluster =
    delta.kind === "up"
      ? `The ring reaches back ${stampAgo(oldest.at)} — ${fmtBytes(oldest.bytes)} on the cluster then, up ${fmtBytes(delta.deltaBytes)} across the ring's reach.`
      : delta.kind === "down"
        ? `The ring reaches back ${stampAgo(oldest.at)} — ${fmtBytes(oldest.bytes)} on the cluster then, down ${fmtBytes(delta.deltaBytes)} across the ring's reach.`
        : `The ring reaches back ${stampAgo(oldest.at)} — flat across the ring's reach (${fmtBytes(oldest.bytes)} then and now).`;
  return cluster + mirror;
}

/** t1098 — the mirror channel's ARC, ONE home: the ring's two ends'
 *  mirror words and the direction between them — the walk the span
 *  voice's mirror clause has spoken inline since t1095, lifted here so
 *  a second mouth can drink the same walk (twins fork, maps don't).
 *  Silence laws: a ring of one, a channel-young end (the key absent on
 *  disk), a walk-silent end (null) each return null — an arc needs
 *  BOTH words, and an end without a word never speaks. */
export function fleetMirrorArc(args: {
  history: FleetTrendPoint[];
}): { kind: "up" | "down" | "same"; deltaBytes: number; oldest: number; newest: number } | null {
  if (args.history.length < 2) return null;
  const newest = args.history[0];
  const oldest = args.history[args.history.length - 1];
  if (newest.mirrorBytes == null || oldest.mirrorBytes == null) return null;
  const d = newest.mirrorBytes - oldest.mirrorBytes;
  return {
    kind: d > 0 ? "up" : d < 0 ? "down" : "same",
    deltaBytes: Math.abs(d),
    oldest: oldest.mirrorBytes,
    newest: newest.mirrorBytes,
  };
}

/** t1098 — THE SYNC-CEILING'S TEMPORAL FACE: the ceiling bar borrows
 *  the mirror channel's arc and speaks it in the share's OWN dialect —
 *  the ceiling is a policy constant, so the share moves exactly as the
 *  mirrors move: an arc up is a share climbing across the reach, down
 *  is easing, unchanged is holding. The walk is ONE (fleetMirrorArc —
 *  the span voice's own); the clause names its window ("across the
 *  reach") so the present's share ("at X% of the Y ceiling") and the
 *  reach's shape ride one line, each naming its time. The silence laws
 *  ride the arc's own guards — the bar keeps its t1084 face when the
 *  channel is silent (never a fake weather report). */
export function fleetTrendCeilingFace(args: { history: FleetTrendPoint[] }): string | null {
  const arc = fleetMirrorArc({ history: args.history });
  if (!arc) return null;
  if (arc.kind === "up") return "the share climbing across the reach";
  if (arc.kind === "down") return "the share easing across the reach";
  return "the share holding across the reach";
}

/** t1095 — the OUTGOING point's ONE builder (the push law's SHAPE,
 *  lifted out of the ledger's measure loop so the unit band can pin it;
 *  the sum stays the ledger's own — this home pours, it never adds).
 *  A never-measured outgoing state pushes nothing (null — the trend
 *  begins with the fresh numbers); a measured one pushes {at, bytes}
 *  and carries the mirror channel EXACTLY when the outgoing snapshot
 *  carries it — undefined stays undefined (JSON.stringify drops the
 *  key, the channel-young shape survives byte-for-byte on disk), null
 *  and numbers ride as they fell. The outgoing-stamp law (the point
 *  remembers the PREVIOUS measure's stamp) lives here now — one home,
 *  pinned once, drunk by the loop. */
export function fleetHistoryOutgoingPoint(args: {
  measuredAt: string | null;
  bytes: number | null;
  mirrorBytesTotal?: number | null;
}): FleetTrendPoint | null {
  if (args.measuredAt == null) return null;
  const point: FleetTrendPoint = { at: args.measuredAt, bytes: args.bytes };
  if (args.mirrorBytesTotal !== undefined) point.mirrorBytes = args.mirrorBytesTotal;
  return point;
}

/** t1095 — the SECOND CHANNEL's ONE arithmetic: the connection's own
 *  mirror total, spoken only when the walk spoke. A failed walk is a
 *  null — never a zero wearing the walk's clothes; a walk that spoke
 *  sums its rows' words, and a row absent from the map is the walk's
 *  own "no mirror dir" zero (computeStorageReport's contract), so the
 *  fallback is the disk's word, not a guess. The unit band pins the
 *  three faces (spoke+sum / didn't-speak null / absent-row zero). */
export function mirrorBytesTotalFor(
  jobIds: string[],
  localByJob: Map<string, { bytes: number; exists: boolean }>,
  walkSpoke: boolean
): number | null {
  if (!walkSpoke) return null;
  let sum = 0;
  for (const id of jobIds) sum += localByJob.get(id)?.bytes ?? 0;
  return sum;
}

/** t1100 — THE UNMIRRORED NAMING, the count's ONE home: how many of the
 *  connection's runs have NO local mirror directory (localExists false —
 *  the walk spoke and the dir is absent). The mouths fork their faces on
 *  this number (the some-absent clause, the all-absent "no mirrors yet"
 *  face, the connection badge); the WALK'S SPOKENNESS is the ledger row's
 *  own field (mirrorWalkSpoke) and every mouth checks that FIRST — the
 *  count of an unspoken walk is unverified, never named. Pure: rows in,
 *  count out; a row's absence from the map is not this helper's concern
 *  (the ledger's own default wears that case). */
export function fleetUnmirroredRuns(jobs: { localExists: boolean }[]): number {
  let n = 0;
  for (const j of jobs) if (!j.localExists) n += 1;
  return n;
}

/** t1096 — the SECOND CHANNEL'S HOP, the arithmetic half: the mirror
 *  channel's own per-measure delta, computed over the SAME
 *  fleetTrendDelta the cluster's hop drinks — the channel's newest
 *  remembered word maps into the point shape and the one arithmetic
 *  does the work (twins fork, maps don't). Silence laws: no remembered
 *  state (begins), a channel-young newest point (the key absent), a
 *  walk-silent newest point (null), or a silent present (the walk
 *  didn't speak now) each return null — a hop needs BOTH words, and
 *  an end without a word never speaks. The answered shape returns the
 *  standard delta (up/down/same with the magnitude; the hole/begins
 *  kinds are unreachable through this door — the guards above already
 *  spoke their silence). */
export function fleetTrendMirrorDelta(args: {
  history: FleetTrendPoint[];
  currentMirrorBytes: number | null;
}): FleetTrendDelta | null {
  const prev = args.history[0] ?? null;
  if (!prev || prev.mirrorBytes == null || args.currentMirrorBytes == null) return null;
  return fleetTrendDelta({
    history: [{ at: prev.at, bytes: prev.mirrorBytes }],
    currentBytes: args.currentMirrorBytes,
  });
}

/** t1096 — the hop's STRIPS' sentence (the card and the dialog's
 *  paragraph join it after the reach clause — the same two-case join
 *  every third voice rides). The subject is NAMED (two channels, two
 *  words — "unchanged" alone already belongs to the cluster's voice);
 *  the stamp is the ring's newest remembered measure, the delta the
 *  present's own walk word against it. null rides through from the
 *  delta's silence laws — a paragraph with no hop to speak adds
 *  nothing. */
export function fleetTrendMirrorHop(args: {
  history: FleetTrendPoint[];
  currentMirrorBytes: number | null;
  fmtBytes: (n: number) => string;
  stampAgo: (iso: string) => string;
  /** t1100 — THE PRESENCE GUARD: the caller's own knowledge that NO run
   *  on this connection has a mirror directory right now. A hop between
   *  two zeros says "The mirrors are unchanged" — a subject with no
   *  referent; with no mirrors present the ONLY honest hop is a DOWN
   *  (a real vanishing is news). "unchanged" and "up" against an empty
   *  mirror side each return null — the naming's own words carry the
   *  face instead. */
  allMirrorsAbsent?: boolean;
}): string | null {
  const delta = fleetTrendMirrorDelta(args);
  if (!delta) return null;
  if (args.allMirrorsAbsent && delta.kind !== "down") return null;
  const ago = args.stampAgo(delta.prev!.at);
  if (delta.kind === "up") return `The mirrors are up ${args.fmtBytes(delta.deltaBytes)} since the measure ${ago}.`;
  if (delta.kind === "down") return `The mirrors are down ${args.fmtBytes(delta.deltaBytes)} since the measure ${ago}.`;
  return `The mirrors are unchanged since the measure ${ago}.`;
}

/** t1065 — the hole READING PAIR, ONE home: when the measures on BOTH
 *  sides of a hole answered, this sentence hands the user the two
 *  facts — a READING, never a verdict (no up/down is spoken against
 *  air — the hop walk law holds; the listener judges). The stubs
 *  drink it through holeTitle; the AI drill drinks it for its trend
 *  breath when the measure before the newest was the hole — one
 *  voice for the same situation across every mouth. Older → newer
 *  is the orientation the sentence speaks (the callers own their
 *  neighbor lookup; the null guard and the words live here). Returns
 *  null when either side is air — and carries NO trailing period, so
 *  each mouth lands its own punctuation (holeTitle adds the stop;
 *  the drill lets the band close the clause). */
export function fleetTrendHolePair(args: {
  olderBytes: number | null;
  newerBytes: number | null;
  fmtBytes: (n: number) => string;
}): string | null {
  if (args.olderBytes == null || args.newerBytes == null) return null;
  return `The measures on either side read ${args.fmtBytes(args.olderBytes)} → ${args.fmtBytes(args.newerBytes)}`;
}

/**
 * t1068 — the hole SUMMARY, ONE home: the paragraph is the strip's
 * semantics carrier (the aria law — the bars are decoration, the stubs'
 * hover titles never reach a screen reader), so the silences that sit
 * in the ring's memory must be NAMED in visible text, not just drawn.
 * The sentence speaks the COUNT of qualifying holes (a hole with
 * answered measures on BOTH sides, in the strip's draw order with the
 * current closing the line) — and when exactly ONE silence sits there,
 * the pair rides with it (fleetTrendHolePair's own words, one home).
 * With several silences the bytes stay in the stub titles: the count
 * plus "every one between answered measures" is the story the
 * paragraph can afford. t1069 — the plural also names the NEWEST
 * silence's age (the stamps the hover knows, the paragraph can afford
 * one — "the newest 2h ago"); the singular keeps the pair instead (two
 * readings already sit in its sentence — the age would bloat a cup
 * that is full). Returns null when no hole qualifies — a
 * paragraph that has nothing to say about silences says nothing.
 * A hole whose newer side is the UNANSWERED present does not qualify
 * (no reading against air — the same law the hop walk speaks). PURE,
 * self-contained.
 *
 * @param history the PAST measurements, NEWEST FIRST (the ledger's
 *   dialect); the current row's numbers are NOT in it.
 * @param currentBytes the present (null = the row itself is air).
 * @param stampAgo the age dialect (the caller's own — kpiStampAgo,
 *   fleetStampAgo, diagStampAgo — one arithmetic, each mouth's stamp).
 */
export function fleetTrendHoleSummary(args: {
  history: FleetTrendPoint[];
  currentBytes: number | null;
  fmtBytes: (n: number) => string;
  stampAgo: (iso: string) => string;
}): string | null {
  const past = [...args.history].reverse(); // oldest → newest (draw order)
  const seq =
    args.currentBytes == null
      ? past
      : [...past, { at: "", bytes: args.currentBytes }];
  const { count, newest, oldest } = walkQualifyingHoles(seq);
  if (count === 0) return null;
  const head =
    count === 1
      ? "An honest silence sits in the ring's memory"
      : `${count} honest silences sit in the ring's memory`;
  if (count === 1 && newest) {
    const pair = fleetTrendHolePair({
      olderBytes: newest.older,
      newerBytes: newest.newer,
      fmtBytes: args.fmtBytes,
    });
    if (pair) return `${head} — ${pair}.`;
  }
  if (newest) {
    // t1069 — the plural names the WHEN (the newest silence's age);
    // unreachable when count === 1 without a pair (the guard above
    // returns first), the plain tail stays the type-safe floor.
    // t1073 — the SECOND AGE (the split shape): the plural's reader
    // knows HOW MANY and WHEN THE NEWEST, but not the REACH — when
    // the walk's two ends are DIFFERENT silences, the deepest's age
    // joins ("the newest 1h ago, the deepest 2h ago" — the one shape
    // where two ages say more than one; the economy law judged). The
    // guard is the walks' own ends over the RAW stamps — no count
    // arithmetic: when the ends coincide (the singular's floor, the
    // type-safe tail) the second age would repeat the first and the
    // economy withholds it. The gap-title hover drinks the grown
    // summary through its ONE composition — the stub's tooltip then
    // carries the three facts no single stub knows (the count, the
    // newest's age, the deepest's age).
    const deepestClause =
      oldest && newest && oldest !== newest.at ? `, the deepest ${args.stampAgo(oldest)}` : "";
    return `${head}, the newest ${args.stampAgo(newest.at)}${deepestClause}, every one between answered measures.`;
  }
  return `${head}, every one between answered measures.`;
}

/** t1069 — the hole COUNT, the summary's own arithmetic as a NUMBER,
 *  ONE home: the row's stamp ("· 4 holes" — the memory's silences
 *  named at a glance, the sixth mouth) and the AI drill's per-ring
 *  band ("4 honest holes in the memory") drink the count where the
 *  full sentence would be byte spam. The SAME walk fleetTrendHoleSummary
 *  drinks (walkQualifyingHoles — the qualifying arithmetic: answered
 *  measures on BOTH sides), so the stamp, the band and the paragraph
 *  can never disagree about how many silences sit in the ring. For the
 *  ring-ONLY mouths (the diagnostics row, the drill — the ring's newest
 *  point IS the last known state) pass currentBytes: null: a hole at
 *  the ring's newest end has no newer reading and does not qualify —
 *  the trailing hole is the trend clause's / the stamp's own word.
 *  PURE, self-contained.
 *
 * @param history the ring as the sidecar holds it, NEWEST FIRST.
 * @param currentBytes the present when one exists OUTSIDE the ring
 *   (the strips' dialect); null when the ring is the whole story.
 */
export function fleetTrendHoleCount(args: {
  history: FleetTrendPoint[];
  currentBytes: number | null;
}): number {
  const past = [...args.history].reverse(); // oldest → newest (draw order)
  const seq =
    args.currentBytes == null
      ? past
      : [...past, { at: "", bytes: args.currentBytes }];
  return walkQualifyingHoles(seq).count;
}

/**
 * t1070 — the GAP's title, ONE home: the boundary stub's hover title
 * grows the memory's WHOLE silence story — whichever gap you touch,
 * the memory answers with its full count (the summary's own words in
 * the mouth's own dialect — the stubs' per-hole pairs stay where they
 * live). THE GUARDS, each reasoned:
 * · the BOUNDARY only — a stub without runFirst keeps its own voice
 *   (the mid-run dashes and their pairs are that run's own story);
 * · the PLURAL only — the singular summary's pair is the SAME pair
 *   the boundary stub's own title already speaks (fleetTrendHolePair's
 *   one home serves both): composing it would say the pair twice in
 *   one tooltip. The plural speaks the COUNT and the NEWEST silence's
 *   age — the two facts no single stub knows;
 * · a null summary (no qualifying hole) composes nothing — a stub
 *   that has its own words needs no borrowed ones.
 * The join is the two-case lesson: the hole title lands its own stop,
 * the summary lands its own stop — t1074 grows the SERVE: a NEWLINE
 * joins the two sentences (the tooltip's own paragraph shape — the
 * bar's pair story is one paragraph, the memory's whole silence story
 * is the next; the native tooltip renders the break, the sentence
 * bounds are the paragraph's bounds, and the accessible description
 * keeps every word). PURE.
 *
 * @param bar the mouth's own bar (the walk's runFirst mark rides it).
 * @param holeCount the qualifying count (the caller's own walk — the
 *   SAME dialect the summary was computed in: the strips' present
 *   closes the line, the ring-only mouths pass the null).
 * @param summary the caller's own summary string (its stampAgo
 *   dialect — the card's, the dialog's, the spark's).
 */
export function fleetTrendGapTitle(args: {
  bar: Pick<FleetTrendBar, "runFirst" | "title">;
  holeCount: number;
  summary: string | null;
}): string | null {
  if (!args.bar.runFirst || args.holeCount < 2 || args.summary == null) return null;
  // t1074 — the tooltip's own paragraph shape: the two sentences
  // stand as two paragraphs (the stub's pair story, then the memory's
  // whole silence story — three facts no single stub knows). The
  // newline is the break the native tooltip renders; the accessible
  // description keeps every word either way.
  return `${args.bar.title}\n${args.summary}`;
}

/**
 * t1071 — the DEEPEST silence, the count's eighth mouth, ONE home:
 * the qualifying walk's OLDEST end (symmetric to the summary's newest
 * — the same ONE walk reads both ends in draw order). The drill's
 * locator breath already speaks the memory's depth (the oldest
 * ANSWERED measure); the deepest silence beside it names how far back
 * the BURIED silences reach — a hole with answered measures on BOTH
 * sides (the qualifying law, the same arithmetic the bands' count and
 * the strips' summary speak). The ring's edge air is excluded BY the
 * law: a trailing hole is the newest end (no depth — it has no newer
 * reading), adjacent silences qualify nothing, a ring whose silences
 * never sat between answered measures holds no depth. RAW FACT, like
 * the count: the stamp goes out unformatted — the mouths speak their
 * own age dialects over it. PURE, self-contained.
 *
 * @param history the ring as the sidecar holds it, NEWEST FIRST.
 * @param currentBytes the present when one exists OUTSIDE the ring
 *   (the strips' dialect); null when the ring is the whole story.
 * @returns the OLDEST qualifying silence's stamp (ISO), or null.
 */
export function fleetTrendHoleDeepest(args: {
  history: FleetTrendPoint[];
  currentBytes: number | null;
}): string | null {
  const past = [...args.history].reverse(); // oldest → newest (draw order)
  const seq =
    args.currentBytes == null
      ? past
      : [...past, { at: "", bytes: args.currentBytes }];
  return walkQualifyingHoles(seq).oldest;
}

/** t1069 — the qualifying walk, ONE copy: counts the holes with
 *  answered measures on both sides (draw order) and remembers the
 *  NEWEST qualifier (its stamp for the summary's age clause, its
 *  readings for the pair). t1071 — the walk reads BOTH ENDS now: the
 *  OLDEST qualifier's stamp rides beside the newest (the deepest
 *  buried silence — fleetTrendHoleDeepest's fact, the locator's
 *  second breath). The adjacent-silence law lives here: two
 *  silences side by side qualify NOTHING (no answered reading between
 *  them). PURE. */
function walkQualifyingHoles(seq: FleetTrendPoint[]): {
  count: number;
  newest: { at: string; older: number; newer: number } | null;
  oldest: string | null;
} {
  let count = 0;
  let newest: { at: string; older: number; newer: number } | null = null;
  let oldest: string | null = null;
  for (let i = 0; i < seq.length; i++) {
    if (seq[i].bytes != null) continue;
    const older = i > 0 ? seq[i - 1].bytes : null;
    const newer = i < seq.length - 1 ? seq[i + 1].bytes : null;
    if (older != null && newer != null) {
      count += 1;
      oldest ??= seq[i].at; // draw order — the FIRST qualifier is the deepest
      newest = { at: seq[i].at, older, newer }; // draw order — the LAST qualifier is the newest
    }
  }
  return { count, newest, oldest };
}

/**
 * t1068 — the honest COUNT's third voice, ONE home: "some workdirs
 * unanswered" was never the word for a measure where NOTHING answered
 * (the stopped-cluster mint put that wording on camera next to a
 * headline that read the honest dash — the two sentences disagreed
 * about the same pause). The scale has three honest steps: EVERY
 * workdir went unanswered, SOME workdirs went unanswered, and silence
 * (all answered — the caller drops the clause entirely). One
 * arithmetic, many mouths: the card's header chip and the KPI item's
 * title drink it; the storage dialog's band already speaks the precise
 * "N of M unanswered" and needs no summary word. PURE.
 *
 * @param measured how many workdirs answered at the last measure.
 * @param total how many workdirs the measure asked (0 → silence).
 */
export function fleetUnansweredVoice(measured: number, total: number): string {
  if (total <= 0 || measured >= total) return "";
  return measured === 0
    ? "every workdir went unanswered"
    : "some workdirs went unanswered";
}

/** t1064 — the hole stub's voice, ONE home (both builders' hole bars
 *  return through it): the honest hole's own words, plus — when the
 *  measures on EITHER SIDE answered — what they read. The pair is a
 *  READING, never a verdict: no up/down is spoken against air (the
 *  hop walk's law holds — the stub's color stays muted; the sentence
 *  hands the user the two facts and lets them judge). A TRAILING
 *  hole (the ring's newest point, the ring dialect's end) speaks the
 *  AI drill's own words instead — the newest measure heard nothing —
 *  one voice for the same situation across every mouth.
 *  t1065 — the pair sentence itself moved to the ONE home
 *  (fleetTrendHolePair): the drill drinks the same words now, and
 *  this builder assembles the stop around it — byte-identical
 *  output, one fewer sentence owned here. */
function holeTitle(args: {
  at: string;
  stampAgo: (iso: string) => string;
  prevBytes: number | null;
  nextBytes: number | null;
  fmtBytes: (n: number) => string;
  trailing?: boolean;
}): string {
  if (args.trailing) {
    return `Measured ${args.stampAgo(args.at)} — the newest measure heard nothing from the cluster (an honest hole)`;
  }
  const base = `Measured ${args.stampAgo(args.at)} — the cluster never answered (an honest hole)`;
  const pair = fleetTrendHolePair({
    olderBytes: args.prevBytes,
    newerBytes: args.nextBytes,
    fmtBytes: args.fmtBytes,
  });
  return pair ? `${base}. ${pair}.` : `${base}.`;
}

/** t1067 — the hole ENTRY EDGE's arithmetic, ONE copy (both builders
 *  pass through it after the hop walk): a hole whose LEFT neighbor in
 *  draw order answered with a COLORED hop (up/down) carries that
 *  dialect as edgeInto — the boundary where the answers stopped keeps
 *  the story visible without hover. The hop walk owns the verdicts;
 *  this walk only echoes what the ANSWERED neighbor already earned.
 *  Runs AFTER withHopKinds (it reads the neighbor's hopKind). PURE,
 *  self-contained. */
function withHopEdges(bars: FleetTrendBar[]): FleetTrendBar[] {
  return bars.map((bar, i) => {
    if (bar.kind !== "hole") return bar;
    const prev = i > 0 ? bars[i - 1] : null;
    if (prev && prev.bytes != null && (prev.hopKind === "up" || prev.hopKind === "down")) {
      return { ...bar, edgeInto: prev.hopKind };
    }
    return bar;
  });
}

/** t1070 — the GAP's walk, ONE copy (both builders pass through it
 *  after the hop walks): a hole whose LEFT neighbor in draw order
 *  answered is the boundary where the answers stopped — the gap
 *  between the last answered bar and the first stub. The walk only
 *  MARKS the boundary (runFirst); the mouths compose the hover title
 *  over it (fleetTrendGapTitle's law — the plural's whole story, the
 *  singular's pair already spoken). A leading hole (the strip's first
 *  bar) has no left neighbor — the gap has no answered side to stop
 *  FROM; the reach caption names that far end already. PURE,
 *  self-contained. */
function withRunFirsts(bars: FleetTrendBar[]): FleetTrendBar[] {
  return bars.map((bar, i) => {
    if (bar.kind !== "hole") return bar;
    const prev = i > 0 ? bars[i - 1] : null;
    return prev && prev.bytes != null ? { ...bar, runFirst: true as const } : bar;
  });
}

/**
 * t1061 — the ring's OWN shape, for memory-only mouths: the OPS row's
 *  micro-spark (the seventh mouth) reads the sidecar's ring, where the
 *  newest point IS the present — no current is appended (that dialect
 *  belongs to mouths holding a live row beside the ring), no delta is
 *  spoken (the row's chip and stamp carry the numbers). Every point
 *  draws — an answered newest point speaks "current" (the full-primary
 *  seat), a hole stays a dashed stub. The height arithmetic is the
 *  spec's own law (max over what draws, the 4px floor, the rounding)
 *  with the scale injected — one arithmetic, many mouths, no forked
 *  math. SELF-CONTAINED like the rest of the well (no imports).
 *
 * @param history the ring as the sidecar holds it, NEWEST FIRST.
 * @param scalePx the mouth's height dialect (the OPS row passes 12;
 *   default FLEET_TREND_BAR_PX = 24, the strips' line).
 */
export function fleetTrendRingBars(args: {
  history: FleetTrendPoint[];
  fmtBytes: (n: number) => string;
  stampAgo: (iso: string) => string;
  scalePx?: number;
}): { bars: FleetTrendBar[]; maxBytes: number } {
  const scalePx = args.scalePx ?? FLEET_TREND_BAR_PX;
  const past = [...args.history].reverse(); // oldest → newest (the draw order)
  const maxBytes = Math.max(...past.map((p) => p.bytes ?? 0), 1);
  const height = (bytes: number) =>
    `${Math.max(Math.round((bytes / maxBytes) * scalePx), FLEET_TREND_BAR_MIN_PX)}px`;
  const bars: FleetTrendBar[] = past.map((p, i) => {
    const newest = i === past.length - 1;
    if (p.bytes == null) {
      return {
        kind: "hole" as const,
        at: p.at,
        bytes: null,
        heightPx: `${FLEET_TREND_BAR_MIN_PX}px`,
        title: holeTitle({
          at: p.at,
          stampAgo: args.stampAgo,
          prevBytes: i > 0 ? past[i - 1].bytes : null,
          nextBytes: newest ? null : past[i + 1].bytes,
          fmtBytes: args.fmtBytes,
          trailing: newest,
        }),
        ...(newest ? { trailing: true as const } : {}),
      };
    }
    return {
      kind: newest ? ("current" as const) : ("past" as const),
      at: p.at,
      bytes: p.bytes,
      heightPx: height(p.bytes),
      title: newest
        ? `Newest measure, ${args.stampAgo(p.at)}: ${args.fmtBytes(p.bytes)} on the cluster`
        : `Measured ${args.stampAgo(p.at)}: ${args.fmtBytes(p.bytes)} on the cluster`,
    };
  });
  return { bars: withRunFirsts(withHopEdges(withHopKinds(bars))), maxBytes };
}

/**
 * The ring's arithmetic, computed once for every mouth.
 *
 * @param history the PAST measurements, NEWEST FIRST (the ledger's
 *   dialect); the current row's numbers are NOT in it — they arrive
 *   as currentBytes/currentAt and close the line.
 * @param currentBytes the present: the connection's current measured
 *   total (answered probes only — the caller's totalMeasuredBytes law).
 *   t1067 — NULL means the last measure heard NOTHING (every workdir
 *   went unanswered — a stopped cluster, a dead route): the present is
 *   AIR, never a zero. The strip draws the trailing stub (the denser
 *   edge, the drill's own words) and the delta silences — no up/down
 *   is spoken against an unanswered present (the hop walk's law now
 *   covers the row itself, not just the ring's points).
 * @param currentAt the present's stamp; a null/absent stamp means the
 *   connection was never measured — the caller gates on that and never
 *   calls (nothing to draw, nothing to speak).
 * @param fmtBytes the mouth's bytes dialect (the dialog's fmtBytes).
 * @param stampAgo the mouth's age dialect (the dialog's graveAge words).
 * @param scalePx the mouth's height dialect — the strip's tallest bar
 *   in px (default FLEET_TREND_BAR_PX = 24; the KPI band's compact
 *   sparkline passes 12). The SCALE is injected; the arithmetic
 *   (the max, the 4px floor, the rounding) never forks.
 */
export function fleetTrendSpec(args: {
  history: FleetTrendPoint[];
  currentBytes: number | null;
  currentAt: string;
  fmtBytes: (n: number) => string;
  stampAgo: (iso: string) => string;
  scalePx?: number;
}): FleetTrendSpec {
  const { history, currentBytes, currentAt, fmtBytes, stampAgo } = args;
  const scalePx = args.scalePx ?? FLEET_TREND_BAR_PX;

  const past = [...history].reverse(); // oldest → newest (the draw order)
  const prev = history[0] ?? null; // the ring's newest PAST point
  const maxBytes = Math.max(...past.map((p) => p.bytes ?? 0), currentBytes ?? 0, 1);
  const height = (bytes: number) =>
    `${Math.max(Math.round((bytes / maxBytes) * scalePx), FLEET_TREND_BAR_MIN_PX)}px`;

  const bars: FleetTrendBar[] = past.map((p, i) =>
    p.bytes == null
      ? {
          kind: "hole",
          at: p.at,
          bytes: null,
          heightPx: `${FLEET_TREND_BAR_MIN_PX}px`,
          title: holeTitle({
            at: p.at,
            stampAgo,
            // the strip's hole sees the CURRENT closing the line on its
            // newer side — the row's own numbers are a real measurement
            prevBytes: i > 0 ? past[i - 1].bytes : null,
            nextBytes: i < past.length - 1 ? past[i + 1].bytes : currentBytes,
            fmtBytes,
          }),
        }
      : {
          kind: "past",
          at: p.at,
          bytes: p.bytes,
          heightPx: height(p.bytes),
          title: `Measured ${stampAgo(p.at)}: ${fmtBytes(p.bytes)} on the cluster`,
        }
  );
  bars.push(
    currentBytes == null
      ? {
          // t1067 — the UNANSWERED present is the trailing state at the
          // strip's level: the row's own walk heard nothing, so the
          // closing bar is the honest stub (the denser edge, the AI
          // drill's own words — the same sentence the ring's trailing
          // point speaks through holeTitle). No "0 B", no fake delta —
          // an honest hole, never a zero.
          kind: "hole" as const,
          at: currentAt,
          bytes: null,
          heightPx: `${FLEET_TREND_BAR_MIN_PX}px`,
          // t1067 — the denser edge rides the BAR too (the mouths read
          // bar.trailing for the class; holeTitle only owns the words)
          trailing: true as const,
          title: holeTitle({
            at: currentAt,
            stampAgo,
            prevBytes: null,
            nextBytes: null,
            fmtBytes,
            trailing: true,
          }),
        }
      : {
          kind: "current" as const,
          at: currentAt,
          bytes: currentBytes,
          heightPx: height(currentBytes),
          title: `This measurement: ${fmtBytes(currentBytes)} on the cluster${
            stampAgo(currentAt) === "just now"
              ? " (just now)"
              : `, measured ${stampAgo(currentAt)}`
          }`,
        }
  );

  // t1058 — the voice is a dialect spoken OVER the delta's kinds (the
  // comparison itself lives in fleetTrendDelta — one arithmetic, many
  // mouths, and the AI's server breath drinks the same kinds)
  // t1067 — the UNANSWERED present silences the delta BEFORE the well's
  // arithmetic runs (null - answered would speak a false down — the lie
  // the stopped-cluster intermediate caught on camera). The sentence is
  // the drill's own trailing words with the well's hole tail — one
  // voice family for "the newest measure heard nothing".
  const delta =
    currentBytes == null
      ? ({ kind: "hole", deltaBytes: 0, prev } as const)
      : fleetTrendDelta({ history, currentBytes });
  const voice =
    currentBytes == null
      ? "The newest measure heard nothing from the cluster (an honest hole) — no delta is spoken until it answers."
      : delta.kind === "begins"
      ? "The ledger remembers no measure before this one — the trend begins here; the next Measure now speaks the delta."
      : delta.kind === "hole"
        ? "The previous measure heard nothing from the cluster (an honest hole) — no delta is spoken until it answers."
        : delta.kind === "up"
          ? `Up ${fmtBytes(delta.deltaBytes)} since the measure ${stampAgo(delta.prev!.at)} — the workdirs grew.`
          : delta.kind === "down"
            ? `Down ${fmtBytes(delta.deltaBytes)} since the measure ${stampAgo(delta.prev!.at)} — something was cleaned up there.`
            : `Unchanged since the measure ${stampAgo(delta.prev!.at)}.`;

  return {
    bars: withRunFirsts(withHopEdges(withHopKinds(bars))),
    maxBytes,
    prev,
    voice,
    ringCount: history.length,
  };
}

/** t1116 — the failure's own shape (the card's two scarred faces cured
 *  by arithmetic): the word a failed read leaves behind, TYPED so the
 *  two faces can never blur again. "unanswered" — the fetch itself
 *  threw (the server never spoke); "server" — the server answered with
 *  an error word (its own sentence, or the HTTP status when the body
 *  was unreadable). The t1116 scar this type buries: the card used to
 *  carry the unanswered face as a full SENTENCE in the same string
 *  state the server's raw word used — the courtesy line then wrapped
 *  that sentence inside its own template (THE DOUBLED WORD, filmed
 *  live: the line spoke its opening clause a second time inside the
 *  parens). A shape, not a string, is the only honest home for two
 *  faces. */
export type FleetFailure =
  | { kind: "unanswered" }
  | { kind: "server"; raw: string };

/** t1116 — the failure word's attribution clause, ONE home: which face
 *  failed, said so the user can act. The server's word is attributed
 *  verbatim (never re-wrapped — the doubled word's grave); the
 *  unanswered face keeps the family's question (the catch's own voice,
 *  kept where it belongs — inside the attribution, never as a bare
 *  sentence wearing the server's clothes). */
export function fleetFailureAttribution(failure: FleetFailure): string {
  return failure.kind === "server"
    ? `the server answered: ${failure.raw}`
    : "the server never answered — is it reachable?";
}

/** t1116 — the read-failure courtesy line's ONE composer (the card's
 *  first-read face). The sentence is owned ONCE, here; the attribution
 *  is spoken once, inside the parens. THE DOUBLED WORD IS IMPOSSIBLE
 *  BY SHAPE — the template wraps the attribution clause, and the
 *  attribution clause is never a sentence. */
export function fleetReadFailureLine(failure: FleetFailure): string {
  return `The fleet ledger could not be read (${fleetFailureAttribution(failure)}) — the storage overview's Cluster ledger keeps the full band.`;
}

/** t1117 — the DIALOG's read-failure line's ONE composer. The card's
 *  fleetReadFailureLine points AT the dialog ("the storage overview's
 *  Cluster ledger keeps the full band") — but the dialog IS the storage
 *  overview, and a door never points at itself: the dialog's read face
 *  keeps the family's opening clause and the attribution, and drops the
 *  pointer. The last wording fork is dead — the dialog's catch no longer
 *  carries its own sentence ("is the server reachable?"), the family's
 *  question is the only voice, and the seat speaks even when the band
 *  dissolved (the read face lives OUTSIDE the fleet guard now — a failed
 *  first read used to dissolve the section AND the error with it). */
export function fleetDialogReadFailureLine(failure: FleetFailure): string {
  return `The fleet ledger could not be read (${fleetFailureAttribution(failure)}).`;
}

/** t1116 — the measure-failure note's ONE composer (the card's second
 *  face — the SILENCE cured): a failed Measure now SPEAKS — what was
 *  attempted, why it died, and what the band keeps showing. The band's
 *  remembered numbers are the last HONEST numbers (the t1109 law's UI
 *  face: the ledger never pretends a measure that did not land — and
 *  from this window forward it never pretends the attempt didn't
 *  happen either; silence was the lie both films caught). */
export function fleetMeasureFailureLine(failure: FleetFailure): string {
  return `Measure now could not buy a live read (${fleetFailureAttribution(failure)}) — the band keeps the last honest numbers.`;
}

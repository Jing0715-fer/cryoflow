/**
 * CryoFlow — the particle funnel (t461).
 *
 * The chain question the compare family never asked, because it is not
 * about a PAIR — it is about the whole line: "where did my particles
 * go?" A cryo-EM project is a funnel: hundreds of micrographs go in at
 * the top, a few thousand particles come out the bottom, and every verb
 * between them either sheds, carries, or multiplies. The per-job numbers
 * already exist — the engine writes an honest counted receipt into each
 * job's result (t347's dialect, parsed by result-counts) — but they live
 * on fifteen separate cards. This module reads the receipts AS A CHAIN:
 * stage by stage, with the attrition (or the expansion) between every
 * neighboring pair spoken out loud.
 *
 * Laws:
 *   - THE RECEIPT IS THE LEDGER: a number appears only when the engine
 *     wrote one. The funnel re-reads no star files and re-counts no
 *     rows — per-job disk truth remains the per-job routes' business
 *     (particles/ctf/motion); the funnel is the receipts' chain view.
 *     A verb whose receipt is silent (mask-create) speaks amber.
 *   - THE CHAIN IS WALKED, NOT GUESSED: mainline = upstream to the root
 *     and downstream to the terminus, following real edges; when a node
 *     branches, the canonical stage order decides (import before
 *     motioncorr before … before postprocess). Jobs left off the
 *     mainline are not hidden — they speak in the census line.
 *   - EVERY EDGE SPEAKS: equal counts carry, a drop sheds (with the
 *     percentage), a growth gains (with the factor), a unit change
 *     transforms (picks-per-micrograph, not a fake percentage).
 *   - BARS ARE THE SHAPE, NUMBERS ARE THE TRUTH: counts span orders of
 *     magnitude (24 micrographs vs 5,760 particles) — linear bars would
 *     make the top of the funnel invisible. Widths are square-root
 *     scaled, and the face says so.
 *   - VERBLESS: the funnel reads; it does not mutate. A different chain
 *     comes from re-running a verb, and the footer says so.
 */

import { parseResultCounts } from "./result-counts";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface FunnelJobIn {
  id: string;
  type: string;
  name: string;
  status: string;
  result: string | null;
}

export interface FunnelEdgeIn {
  fromJobId: string;
  toJobId: string;
}

export type FunnelUnit = "micrographs" | "picks" | "particles";

export type FunnelDeltaKind = "carry" | "shed" | "gain" | "transform";

export interface FunnelRow {
  jobId: string;
  type: string;
  name: string;
  /** null = the receipt said nothing countable — an amber row */
  count: number | null;
  unit: FunnelUnit | null;
  /** class2d's receipt class count — the row's second number */
  classes: number | null;
  /** a quiet domain note (symexpand's factor, rebalance's anisotropy) */
  subnote: string | null;
  kind: "ok" | "amber";
  /** sqrt-scaled 0..1 against the widest ok row; amber rows are 0 */
  width: number;
  /** autopick only: picks per input micrograph */
  perMic: number | null;
  /** the line BETWEEN the previous row and this one — owned by this row */
  delta: { line: string; kind: FunnelDeltaKind } | null;
}

export interface FunnelLedger {
  rows: FunnelRow[];
  /** completed chain members the mainline walk left out (a branch) */
  offMainline: { id: string; type: string; name: string }[];
  /** the chain's postprocess receipt, when one ends the mainline */
  closing: { jobId: string; resolution: string } | null;
  headline: string;
  note: string;
}

/* ------------------------------------------------------------------ */
/* The canonical stage order — the mainline's tiebreak law             */
/* ------------------------------------------------------------------ */

export const FUNNEL_STAGE_RANK: Record<string, number> = {
  import: 10,
  motioncorr: 20,
  ctffind: 30,
  autopick: 40,
  manualpick: 40,
  extract: 50,
  class2d: 60,
  select2d: 65,
  select: 70,
  initialmodel: 80,
  class3d: 90,
  symexpand: 100,
  rebalance: 110,
  refine3d: 120,
  polish: 125,
  ctfrefine: 126,
  maskcreate: 130,
  postprocess: 140,
};

/** Unknown verbs sit mid-chain: they never win a tie against a known
 * mainline verb, but a forced path through them still works. */
const UNKNOWN_RANK = 75;

/** The faces the funnel door opens on — every stage the chain view can
 * start from (the walk finds the rest). */
export const FUNNEL_ENTRY_TYPES: ReadonlySet<string> = new Set([
  "import",
  "motioncorr",
  "ctffind",
  "autopick",
  "manualpick",
  "extract",
  "class2d",
  "select2d",
  "select",
  "initialmodel",
  "class3d",
  "symexpand",
  "rebalance",
  "refine3d",
  "postprocess",
]);

/* ------------------------------------------------------------------ */
/* Receipt reading — one verb, one count, one unit                     */
/* ------------------------------------------------------------------ */

interface StageCount {
  count: number;
  unit: FunnelUnit;
}

function stageCountOf(type: string, result: string | null): StageCount | null {
  const c = parseResultCounts(result);
  if (!c) return null;
  if (type === "import" || type === "motioncorr" || type === "ctffind") {
    if (c.micrographs != null) return { count: c.micrographs, unit: "micrographs" };
    return null;
  }
  if (type === "autopick" || type === "manualpick") {
    if (c.particles != null) return { count: c.particles, unit: "picks" };
    return null;
  }
  // the particle verbs — extract through refine3d (and their kin)
  if (c.particles != null) return { count: c.particles, unit: "particles" };
  return null;
}

/** class2d's receipt carries its class census as a second number. */
function classesOf(type: string, result: string | null): number | null {
  if (type !== "class2d" && type !== "class3d") return null;
  const c = parseResultCounts(result);
  return c?.classes ?? null;
}

/** Quiet domain notes — parsed, never guessed, silent when absent. */
function subnoteOf(type: string, result: string | null): string | null {
  if (!result) return null;
  if (type === "symexpand") {
    const m = result.match(/×\s*([\d,]+)\s*=/);
    if (m) return `the symmetry deck ×${Number(m[1].replace(/,/g, "")).toLocaleString("en-US")}`;
  }
  if (type === "rebalance") {
    const m = result.match(/anisotropy\s+([\d.]+)\s*→\s*([\d.]+)/);
    if (m) return `anisotropy ${m[1]}→${m[2]}`;
  }
  if (type === "class2d") {
    const m = result.match(/top:\s*class\s+(\d+)\s+([\d.]+)%/);
    if (m) return `top: class ${m[1]} at ${m[2]}%`;
  }
  return null;
}

/** The chain's closing number — a postprocess receipt's FSC verdict. */
function closingOf(jobId: string, type: string, result: string | null) {
  if (type !== "postprocess" || !result) return null;
  const m = result.match(/FSC\(0\.143\)\s*=\s*([\d.]+)\s*Å/);
  if (!m) return null;
  return { jobId, resolution: `${m[1]} Å` };
}

/* ------------------------------------------------------------------ */
/* Copy — every edge speaks                                            */
/* ------------------------------------------------------------------ */

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function pctWord(lost: number, from: number): string {
  const p = (lost / from) * 100;
  return p >= 10 ? `${Math.round(p)}%` : `${Number(p.toFixed(1))}%`;
}

function deltaOf(
  prev: { count: number; unit: FunnelUnit; type: string },
  cur: { count: number; unit: FunnelUnit; type: string },
  gainFactor: number | null
): { line: string; kind: FunnelDeltaKind } | null {
  if (prev.unit === cur.unit) {
    if (cur.count > prev.count) {
      const gained = cur.count - prev.count;
      const factor =
        gainFactor ?? (prev.count > 0 ? Number((cur.count / prev.count).toFixed(1)) : null);
      return {
        line: `+${fmt(gained)} · ×${factor ?? "?"} at ${cur.type}`,
        kind: "gain",
      };
    }
    if (cur.count === prev.count) {
      return { line: `all ${fmt(cur.count)} carried through`, kind: "carry" };
    }
    const lost = prev.count - cur.count;
    return {
      line: `−${fmt(lost)} · ${pctWord(lost, prev.count)} lost at ${cur.type}`,
      kind: "shed",
    };
  }
  // unit change — a transformation, never a fake percentage
  if (prev.unit === "micrographs" && cur.unit === "picks") {
    const rate = prev.count > 0 ? cur.count / prev.count : 0;
    return {
      line: `${fmt(cur.count)} picks across ${fmt(prev.count)} micrographs — ${rate.toFixed(1)} per micrograph`,
      kind: "transform",
    };
  }
  if (prev.unit === "picks" && cur.unit === "particles") {
    if (cur.count < prev.count) {
      const lost = prev.count - cur.count;
      return {
        line: `−${fmt(lost)} · ${pctWord(lost, prev.count)} of the picks never became particles`,
        kind: "shed",
      };
    }
    return { line: `${fmt(cur.count)} particles boxed from the picks`, kind: "transform" };
  }
  return { line: `${fmt(cur.count)} ${cur.unit} from ${fmt(prev.count)} ${prev.unit}`, kind: "transform" };
}

/** The end-of-chain verb — the headline's last clause picks its word. */
function exitVerbOf(type: string): string {
  switch (type) {
    case "refine3d":
    case "polish":
      return "refined";
    case "class3d":
    case "class2d":
      return "classified";
    case "select":
    case "select2d":
      return "selected";
    case "extract":
      return "extracted";
    case "symexpand":
      return "expanded";
    case "rebalance":
      return "rebalanced";
    default:
      return "carried";
  }
}

export const FUNNEL_NOTE =
  "Bars are square-root scaled — a stack of millions next to a rack of micrographs would otherwise vanish. The numbers are the ledger; the bars are only the shape.";

/* ------------------------------------------------------------------ */
/* The chain walk — mainline + census                                  */
/* ------------------------------------------------------------------ */

function rankOf(type: string): number {
  return FUNNEL_STAGE_RANK[type] ?? UNKNOWN_RANK;
}

/** All ancestors (upstream closure) and descendants, breadth-first. */
function closure(
  start: string,
  next: Map<string, string[]>
): string[] {
  const seen = new Set<string>([start]);
  const queue = [start];
  const out: string[] = [];
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    for (const n of next.get(cur) ?? []) {
      if (!seen.has(n)) {
        seen.add(n);
        out.push(n);
        queue.push(n);
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* The assembler                                                       */
/* ------------------------------------------------------------------ */

export function funnelLedgerOf(input: {
  jobs: FunnelJobIn[];
  edges: FunnelEdgeIn[];
  enteredId: string;
}): FunnelLedger | null {
  const byId = new Map(input.jobs.map((j) => [j.id, j]));
  const entered = byId.get(input.enteredId);
  if (!entered) return null;

  const parents = new Map<string, string[]>();
  const children = new Map<string, string[]>();
  for (const e of input.edges) {
    if (!byId.has(e.fromJobId) || !byId.has(e.toJobId)) continue;
    if (!parents.has(e.toJobId)) parents.set(e.toJobId, []);
    if (!children.has(e.fromJobId)) children.set(e.fromJobId, []);
    parents.get(e.toJobId)!.push(e.fromJobId);
    children.get(e.fromJobId)!.push(e.toJobId);
  }

  // upstream: at each branch the LOWEST canonical rank wins (the root
  // is the earliest verb); downstream: the highest (the terminus is the
  // latest verb). Cycle-guarded by a visited set on both walks.
  const upPath: string[] = [];
  {
    const seen = new Set<string>([entered.id]);
    let cur = entered.id;
    for (;;) {
      const list = (parents.get(cur) ?? [])
        .filter((p) => !seen.has(p))
        .sort((a, b) => {
          const d = rankOf(byId.get(a)!.type) - rankOf(byId.get(b)!.type);
          return d !== 0 ? d : byId.get(a)!.name.localeCompare(byId.get(b)!.name);
        });
      if (list.length === 0) break;
      cur = list[0];
      seen.add(cur);
      upPath.push(cur);
    }
  }
  const downPath: string[] = [];
  {
    // the down walk inherits the up walk's line as already-seen: the
    // mainline is ONE line — a cycle that doubles back through the
    // upstream side must stop, not re-read the line behind us
    const seen = new Set<string>([entered.id, ...upPath]);
    let cur = entered.id;
    for (;;) {
      const list = (children.get(cur) ?? [])
        .filter((c) => !seen.has(c))
        .sort((a, b) => {
          const d = rankOf(byId.get(b)!.type) - rankOf(byId.get(a)!.type);
          return d !== 0 ? d : byId.get(a)!.name.localeCompare(byId.get(b)!.name);
        });
      if (list.length === 0) break;
      cur = list[0];
      seen.add(cur);
      downPath.push(cur);
    }
  }

  const mainlineIds = [...upPath.reverse(), entered.id, ...downPath];
  const mainlineSet = new Set(mainlineIds);

  // the census — completed chain members the mainline left out
  const reachIds = new Set<string>([
    entered.id,
    ...closure(entered.id, parents),
    ...closure(entered.id, children),
  ]);
  const offMainline = [...reachIds]
    .filter((id) => !mainlineSet.has(id))
    .map((id) => byId.get(id)!)
    .filter((j) => j.status === "completed")
    .sort((a, b) => rankOf(a.type) - rankOf(b.type))
    .map((j) => ({ id: j.id, type: j.type, name: j.name }));

  // the chain's own postprocess — the closing number, never a row
  const lastId = mainlineIds[mainlineIds.length - 1];
  const lastJob = byId.get(lastId)!;
  const closing =
    lastJob.type === "postprocess"
      ? closingOf(lastJob.id, lastJob.type, lastJob.result)
      : null;

  // resolve the rows
  const resolved = mainlineIds
    .filter((id) => byId.get(id)!.type !== "postprocess")
    .map((id) => {
      const job = byId.get(id)!;
      const sc = stageCountOf(job.type, job.result);
      const ok = sc != null && job.status === "completed";
      return { job, sc, ok };
    });

  const maxCount = Math.max(
    ...resolved.filter((r) => r.ok).map((r) => r.sc!.count),
    1
  );

  const rows: FunnelRow[] = [];
  let prev: { count: number; unit: FunnelUnit; type: string } | null = null;
  for (const { job, sc, ok } of resolved) {
    const cur = ok ? { count: sc!.count, unit: sc!.unit, type: job.type } : null;
    const gainFactor =
      job.type === "symexpand" && job.result
        ? (Number((job.result.match(/×\s*([\d,]+)\s*=/)?.[1] ?? "").replace(/,/g, "")) || null)
        : null;
    const delta =
      prev && cur
        ? deltaOf(prev, cur, gainFactor)
        : null;
    const perMic =
      cur && cur.unit === "picks" && prev && prev.unit === "micrographs" && prev.count > 0
        ? Number((cur.count / prev.count).toFixed(1))
        : null;
    rows.push({
      jobId: job.id,
      type: job.type,
      name: job.name,
      count: cur ? cur.count : null,
      unit: cur ? cur.unit : null,
      classes: classesOf(job.type, job.result),
      subnote: ok ? subnoteOf(job.type, job.result) : job.status !== "completed" ? `status: ${job.status}` : null,
      kind: ok ? "ok" : "amber",
      width: ok ? Math.max(Math.sqrt(cur!.count / maxCount), 0.02) : 0,
      perMic,
      delta,
    });
    if (cur) prev = cur;
  }

  // the headline — first stage in, last particle stage out, closing Å
  const firstOk = rows.find((r) => r.kind === "ok");
  const lastOk = [...rows].reverse().find((r) => r.kind === "ok" && r.unit === "particles");
  const parts: string[] = [];
  if (firstOk) parts.push(`${fmt(firstOk.count!)} ${firstOk.unit} went in`);
  if (lastOk) parts.push(`${fmt(lastOk.count!)} particles came out ${exitVerbOf(lastOk.type)}`);
  const headline = parts.join(" · ") + (closing ? ` · the map closes at ${closing.resolution}` : "");

  return { rows, offMainline, closing, headline, note: FUNNEL_NOTE };
}

/* ------------------------------------------------------------------ */
/* The canvas door (t462) — which chain does the plain-sight funnel    */
/* open?                                                               */
/* ------------------------------------------------------------------ */

/**
 * The door's decision. The canvas toolbar door (t462) faces a world the
 * inspector never sees: NO host job — the button floats beside the
 * minimap and find toggles, so something must decide which chain the
 * funnel opens, and the honest answer is a law, not a guess.
 *
 * The laws, in the order they are consulted:
 *   - SELECTION IS THE QUESTION: one selected verb on a funnel stage is
 *     what the user is looking at — its chain wins over any global pick.
 *   - AN UNFINISHED SELECTION BLOCKS HONESTLY: a running verb has no
 *     receipt, so its chain cannot be read. The door disables and says
 *     so — it never silently swaps in another run's funnel.
 *   - A CROWDED SELECTION BLOCKS HONESTLY: the chain question reads one
 *     line; two fingers on the canvas means a compare gesture, not a
 *     funnel gesture. The compare toolbar owns that world.
 *   - OTHERWISE THE CROWN SPEAKS: the deepest finished verb by the same
 *     canonical order the walk uses (postprocess before refine3d before
 *     … before import), ties broken by most-recently-touched then id —
 *     deterministic, so the same world always opens the same chain.
 *   - NO RECEIPTS, NO DOOR: with no finished funnel-stage verb on the
 *     canvas the button is disabled with an honest line — the funnel
 *     reads receipts, and there are none.
 */

export type FunnelDoorJob = {
  id: string;
  name: string;
  type: string;
  status: string;
  updatedAt?: string | null;
};

export type FunnelDoorReason =
  | "no-receipts"
  | "selection-unfinished"
  | "selection-crowded";

export type FunnelDoorDecision =
  | { kind: "ready"; job: FunnelDoorJob; picked: "selection" | "crown" }
  | { kind: "blocked"; reason: FunnelDoorReason; line: string };

export const FUNNEL_DOOR_BLOCK_LINES: Record<FunnelDoorReason, string> = {
  "no-receipts":
    "The funnel reads receipts — no finished verbs yet. Complete a verb and the chain question opens here.",
  "selection-unfinished":
    "The selected verb hasn't finished — its receipt isn't written yet, so its chain can't be read.",
  "selection-crowded":
    "The chain question reads one line — select a single verb on the canvas.",
};

export function funnelDoorCandidate(
  jobs: readonly FunnelDoorJob[],
  selectedIds: readonly string[],
): FunnelDoorDecision {
  // the crown — deepest finished entry verb, deterministic tie-breaks
  const crown = jobs
    .filter((j) => j.status === "completed" && FUNNEL_ENTRY_TYPES.has(j.type))
    .sort(
      (a, b) =>
        (FUNNEL_STAGE_RANK[b.type] ?? 75) - (FUNNEL_STAGE_RANK[a.type] ?? 75) ||
        (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "") ||
        a.id.localeCompare(b.id),
    )[0];

  // SELECTION IS THE QUESTION — one finger beats the crown
  if (selectedIds.length === 1) {
    const picked = jobs.find((j) => j.id === selectedIds[0]);
    if (picked && FUNNEL_ENTRY_TYPES.has(picked.type)) {
      if (picked.status === "completed") {
        return { kind: "ready", job: picked, picked: "selection" };
      }
      // never swap in another run's funnel behind the user's back
      return {
        kind: "blocked",
        reason: "selection-unfinished",
        line: FUNNEL_DOOR_BLOCK_LINES["selection-unfinished"],
      };
    }
    // selection on a non-stage verb (or a dangling id): the selection
    // says nothing about chains — the crown keeps the door useful
  } else if (selectedIds.length >= 2) {
    return {
      kind: "blocked",
      reason: "selection-crowded",
      line: FUNNEL_DOOR_BLOCK_LINES["selection-crowded"],
    };
  }

  if (!crown) {
    return {
      kind: "blocked",
      reason: "no-receipts",
      line: FUNNEL_DOOR_BLOCK_LINES["no-receipts"],
    };
  }
  return { kind: "ready", job: crown, picked: "crown" };
}

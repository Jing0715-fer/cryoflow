/**
 * t1133 — the world vitals: the ONE father behind the health board.
 *
 * The footer's three numbers (jobs · edges · completed) have been the
 * world gate since the early tasks — the census reads them after every
 * ride. This lib gives those numbers a MEMORY (the transition ledger),
 * a FACE (the timeline bars), and a VERDICT (the health rows). Every
 * derived fact the board speaks is computed HERE, once:
 *
 *   • worldVitalsOf      — the status census over a workspace's jobs
 *   • snapshotOf         — the five health-bearing numbers, stamped
 *   • sameWorld          — "unchanged" (a snapshot is a TRANSITION, not
 *                          a heartbeat: an unchanged world writes nothing)
 *   • appendWorldSnapshot — the pure rolling reducer (cap-bounded,
 *                          identity-stable when nothing changed — the
 *                          store's high-frequency setState storms must
 *                          not re-render the footer through this door)
 *   • worldTimelineBars  — the SVG layout (bars, floor ticks, titles)
 *   • worldHealthRows    — the engine/pipeline verdicts (ok | warn only —
 *                          the board is a dashboard, not an alarm; zeros
 *                          that are GOOD news say so, loudly)
 *   • worldLedgerText    — the copy ledger (one father: the clipboard
 *                          text is the strip's own words, the t1132 law)
 *
 * Pure module — no React, no store, no I/O. The dialog binds it; the
 * unit (scripts/t1133-world-vitals-unit.mjs) pins it.
 */

import { formatElapsed } from "./elapsed";
import type { SystemStatusClient } from "./types";

/** The ledger's memory: 240 transitions ≈ a long working session; the
 * oldest sample steps off the front when the cap is exceeded (a ledger
 * that grows without bound is itself a health bug). */
export const WORLD_LEDGER_CAP = 240;

export interface WorldVitals {
  jobs: number;
  edges: number;
  running: number;
  completed: number;
  failed: number;
  pending: number;
  idle: number;
}

export interface WorldSnapshot {
  /** The transition's wall-clock (client Date.now()). */
  t: number;
  jobs: number;
  edges: number;
  running: number;
  completed: number;
  failed: number;
}

/** The status census over the workspace's jobs — the same five words
 * the find bar and the footer census speak. A job whose status falls
 * outside the five (a future word) still counts toward `jobs` — the
 * total is the universe, the five are its known divisions. */
export function worldVitalsOf(
  jobs: { status: string }[],
  edges: { id: string }[],
): WorldVitals {
  let running = 0;
  let completed = 0;
  let failed = 0;
  let pending = 0;
  let idle = 0;
  for (const j of jobs) {
    if (j.status === "running") running += 1;
    else if (j.status === "completed") completed += 1;
    else if (j.status === "failed") failed += 1;
    else if (j.status === "pending") pending += 1;
    else if (j.status === "idle") idle += 1;
  }
  return { jobs: jobs.length, edges: edges.length, running, completed, failed, pending, idle };
}

/** Stamp the five health-bearing numbers. Pending/idle ride the census
 * but not the snapshot — the ledger tracks the world's MOVEMENT, and
 * pending→idle flips are the queue's breathing, not the pipeline's. */
export function snapshotOf(v: WorldVitals, t: number): WorldSnapshot {
  return { t, jobs: v.jobs, edges: v.edges, running: v.running, completed: v.completed, failed: v.failed };
}

/** Unchanged iff all five numbers agree. Deliberately NOT comparing t —
 * the ledger records WHAT changed, and when it changed it gets a fresh
 * stamp from the caller. */
export function sameWorld(a: WorldSnapshot, b: WorldSnapshot): boolean {
  return (
    a.jobs === b.jobs &&
    a.edges === b.edges &&
    a.running === b.running &&
    a.completed === b.completed &&
    a.failed === b.failed
  );
}

/** The pure reducer. Unchanged world → the SAME array reference (the
 * store's subscribe fires on every setState — including viewport pans
 * and hover echoes — and a new array each time would re-render the
 * board for nothing). Changed world → a new array, capped. */
export function appendWorldSnapshot(
  history: WorldSnapshot[],
  snap: WorldSnapshot,
  cap: number = WORLD_LEDGER_CAP,
): WorldSnapshot[] {
  const last = history[history.length - 1];
  if (last && sameWorld(last, snap)) return history;
  const next = [...history, snap];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

export interface TimelineBar {
  x: number;
  w: number;
  h: number;
  title: string;
}

export interface TimelineLayout {
  bars: TimelineBar[];
  max: number;
  /** True when fewer than two DISTINCT worlds exist — the strip draws
   * its honest "no movement yet" face instead of a one-bar lie. */
  flat: boolean;
}

/** "14:05:32" — 24h clock words, local to the reader. Pure: the caller
 * supplies the Date; tests construct fixed ones. */
export function clockWordsOf(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  if (
    !Number.isFinite(t) ||
    Number.isNaN(d.getHours()) ||
    Number.isNaN(d.getMinutes()) ||
    Number.isNaN(d.getSeconds())
  )
    return "--:--:--";
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** The strip's layout. `width`×`band` is the SVG's viewBox; bars spread
 * across it with a 1-unit gap, height scaled 3..band (a zero-jobs world
 * still draws its floor tick — an empty canvas is a world too). Titles
 * carry the full five-number sentence so a hover reads like the ledger. */
export function worldTimelineBars(
  history: WorldSnapshot[],
  width: number = 100,
  band: number = 28,
): TimelineLayout {
  const n = history.length;
  if (n === 0) return { bars: [], max: 0, flat: true };
  const max = Math.max(...history.map((s) => s.jobs));
  const slot = width / n;
  const w = Math.max(1.5, slot - 1);
  const bars = history.map((s, i) => {
    const h = max > 0 ? 3 + (s.jobs / max) * (band - 3) : 3;
    return {
      x: i * slot,
      w,
      h,
      title: `${clockWordsOf(s.t)} · ${s.jobs} jobs · ${s.edges} edges · ${s.completed} completed · ${s.running} running · ${s.failed} failed`,
    };
  });
  return { bars, max, flat: n < 2 };
}

export interface HealthRow {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
}

/** The verdicts. `system` is the store's SystemStatusClient (null while
 * the page is still reading it — the honest "hasn't arrived" face, never
 * a fabricated green). Zeros that are good news are ok rows: a health
 * board that hides its clean bills is a board nobody trusts. */
export function worldHealthRows(
  v: WorldVitals,
  system: SystemStatusClient | null,
): HealthRow[] {
  const rows: HealthRow[] = [];

  if (!system) {
    rows.push({
      key: "engine",
      label: "Engine",
      ok: false,
      detail: "the engine status hasn't arrived yet — the page is still reading it",
    });
  } else if (!system.found) {
    rows.push({
      key: "engine",
      label: "Engine",
      ok: false,
      detail: "no RELION install detected — open Settings to point the engine",
    });
  } else {
    const bridge = system.execution === "wsl" ? "WSL bridge" : "native";
    rows.push({
      key: "engine",
      label: "Engine",
      ok: true,
      detail: `RELION ${system.version ?? "?"} · ${bridge}${system.fromCache ? " · cached probe (re-verifying)" : ""}`,
    });
  }

  const toolRow = (
    key: string,
    label: string,
    tools: { name: string; present: boolean }[] | undefined,
  ): void => {
    if (!tools || tools.length === 0) return; // the word is absent — the row stays silent, never invented
    const present = tools.filter((b) => b.present).length;
    if (present === tools.length) {
      rows.push({ key, label, ok: true, detail: `all ${tools.length} present` });
    } else {
      const missing = tools.filter((b) => !b.present).map((b) => b.name).slice(0, 3).join(", ");
      rows.push({
        key,
        label,
        ok: false,
        detail: `${present}/${tools.length} present — missing: ${missing}${tools.length - present > 3 ? "…" : ""}`,
      });
    }
  };
  toolRow("binaries", "Binaries", system?.binaries);
  toolRow("externals", "Externals", system?.externals);

  if (v.failed === 0) {
    rows.push({ key: "failures", label: "Failures", ok: true, detail: "no failed jobs in this workspace" });
  } else {
    rows.push({
      key: "failures",
      label: "Failures",
      ok: false,
      detail: `${v.failed} failed job${v.failed === 1 ? "" : "s"} — the footer's red chip filters them in one click`,
    });
  }

  if (v.jobs === 0) {
    rows.push({ key: "pipeline", label: "Pipeline", ok: true, detail: "an empty canvas — nothing to wire yet" });
  } else if (v.jobs === 1 && v.edges === 0) {
    rows.push({ key: "pipeline", label: "Pipeline", ok: true, detail: "a single job needs no wires" });
  } else if (v.edges === 0) {
    rows.push({
      key: "pipeline",
      label: "Pipeline",
      ok: false,
      detail: `${v.jobs} jobs but no connections — draw an edge to start the pipeline`,
    });
  } else {
    rows.push({ key: "pipeline", label: "Pipeline", ok: true, detail: `${v.edges} edges wire ${v.jobs} jobs` });
  }

  return rows;
}

/* ---------------------------------------------------------------------- */
/* t1143 — the completions' own words (the verdicts' NEXT half): the        */
/* census COUNTS a finished run; the row DATES it and WEIGHS it. The        */
/* newest completion speaks Fresh; the longest run speaks Marathon; and     */
/* the completions' own median duration is the world's OWN pace — the       */
/* oldest run is judged against IT (never an invented constant). The        */
/* judgment errs late, never early: a median from fewer than three          */
/* completions is a rumor (the row keeps the honest fact shape), the even   */
/* count takes the lower middle, and the line is crossed only STRICTLY.     */
/* The waiting row stays an honest fact — JobClock cannot reconstruct a     */
/* time-to-start, and a verdict without evidence is a lie wearing a badge.  */
/* ---------------------------------------------------------------------- */

/* ---------------------------------------------------------------------- */
/* t1140 — the jobs' own health face: the board's verdicts above are the    */
/* ENGINE's and the PIPELINE's; the JOBS' own facts speak here.             */
/*                                                                          */
/* Facts, not verdicts: a row exists only when its fact exists — silence    */
/* is the honest absence, never a "nothing to see" filler (the failures     */
/* row above already speaks the clean bill; this face NAMES the story).     */
/* Durations ride the ONE father (worldAgeWords), stamps ride the ONE       */
/* clock (clockWordsOf) — no second formatter is born here. An unreadable   */
/* stamp is an absent fact (the row stays silent), never a NaN lie; a       */
/* stamp in the future is clock skew — the age row steps aside rather       */
/* than speak a negative duration.                                          */
/* ---------------------------------------------------------------------- */

/** The narrow clock face the rows need — STRUCTURAL: the store's JobDTO
 * satisfies it, the tests construct fakes, the lib imports nothing.
 * t1143 — `duration` is the engine's real elapsed ms (JobDTO carries it;
 * a fake may omit it — the row derives from the stamps instead, never
 * invents). */
export interface JobClock {
  name: string;
  status: string;
  result: string | null;
  startedAt: string | null;
  updatedAt: string;
  duration?: number | null;
}

/** An ISO stamp → its ms, or null when the stamp is absent or unreadable
 * (the row's honest absence — never NaN wearing a sentence). */
function clockMsOf(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

/** A completed run's own length — the engine's real elapsed ms when the
 * DTO carries it, else the stamps' own span; unreadable → null (never a
 * guessed duration wearing a sentence). */
function durationMsOf(j: JobClock): number | null {
  const d = j.duration;
  if (d != null && Number.isFinite(d) && d > 0) return d;
  const a = clockMsOf(j.startedAt);
  const b = clockMsOf(j.updatedAt);
  return a != null && b != null && b > a ? b - a : null;
}

/** The judgment's floor — a median from fewer than three completions is
 * a rumor, not a pace. */
const PACE_MEDIAN_FLOOR = 3;
/** The judgment's line — twice the world's own median pace. */
const PACE_JUDGE_FACTOR = 2;

/** The failure words' clip — a long result speaks its first breath, not
 * its whole body (the row is a nameplate, not a log). */
const FAILURE_WORDS_CLIP = 80;

export function worldJobRows(jobs: JobClock[], now: number): HealthRow[] {
  const rows: HealthRow[] = [];

  // the LAST failure — the failures row above COUNTS; this row NAMES:
  // who broke, in the run's own first words, and when the world learned.
  let lastFail: JobClock | null = null;
  let lastFailMs = 0;
  for (const j of jobs) {
    if (j.status !== "failed") continue;
    const t = clockMsOf(j.updatedAt);
    if (t != null && t >= lastFailMs) { lastFailMs = t; lastFail = j; }
  }

  // t1143 — the completions' own scan (BEFORE the verdicts: the pace
  // judgment rides the durations this scan collects). Ties fall to the
  // array's last — the >= law, the same determinism the failure scan
  // speaks.
  let fresh: JobClock | null = null;
  let freshMs = 0;
  let marathon: JobClock | null = null;
  let marathonMs = 0;
  const durations: number[] = [];
  for (const j of jobs) {
    if (j.status !== "completed") continue;
    const t = clockMsOf(j.updatedAt);
    if (t != null && t >= freshMs) { freshMs = t; fresh = j; }
    const d = durationMsOf(j);
    if (d != null) {
      durations.push(d);
      if (d >= marathonMs) { marathonMs = d; marathon = j; }
    }
  }

  if (lastFail) {
    const words = (lastFail.result ?? "").replace(/\s+/g, " ").trim();
    rows.push({
      key: "last-failure",
      label: "Last failure",
      ok: false,
      detail: `${lastFail.name}${words ? ` — ${words.slice(0, FAILURE_WORDS_CLIP)}${words.length > FAILURE_WORDS_CLIP ? "…" : ""}` : ""} · ${clockWordsOf(lastFailMs)}`,
    });
  }

  // the OLDEST running — work moving is good news; its age is the fact
  // the chips cannot speak (a count says HOW MANY, not HOW LONG).
  let oldestRunMs: number | null = null;
  let runningCount = 0;
  for (const j of jobs) {
    if (j.status !== "running") continue;
    runningCount += 1;
    const t = clockMsOf(j.startedAt);
    if (t != null && (oldestRunMs == null || t < oldestRunMs)) oldestRunMs = t;
  }
  if (oldestRunMs != null && now > oldestRunMs) {
    // t1143 — the verdicts' NEXT half: the completions' own median is
    // the world's own pace; a run that strictly outlasts twice the
    // median has earned the board's warn face (a verdict the count
    // alone could not speak). Fewer than three completions is a rumor
    // — the row keeps the honest fact shape; the even count takes the
    // lower middle (the judgment errs late, never early).
    let pace = "";
    let judged = false;
    if (durations.length >= PACE_MEDIAN_FLOOR) {
      const sorted = [...durations].sort((a, b) => a - b);
      const median = sorted[Math.floor((sorted.length - 1) / 2)];
      if (now - oldestRunMs > PACE_JUDGE_FACTOR * median) {
        judged = true;
        pace = `; outlasted the usual run (median ${worldAgeWords(median)})`;
      }
    }
    rows.push({
      key: "oldest-running",
      label: "Working now",
      ok: !judged,
      detail: `${runningCount} running — the oldest started ${worldAgeWords(now - oldestRunMs)} ago${pace}`,
    });
  }

  // the OLDEST waiting — a pending job's silence has a length; the
  // queue's own patience is a health fact. (Pending never started —
  // startedAt is null — so the wait rides updatedAt, the world's last
  // touch of that row.)
  let oldestWaitMs: number | null = null;
  let pendingCount = 0;
  for (const j of jobs) {
    if (j.status !== "pending") continue;
    pendingCount += 1;
    const t = clockMsOf(j.updatedAt);
    if (t != null && (oldestWaitMs == null || t < oldestWaitMs)) oldestWaitMs = t;
  }
  if (oldestWaitMs != null && now > oldestWaitMs) {
    rows.push({
      key: "oldest-pending",
      label: "Waiting",
      ok: true,
      detail: `${pendingCount} pending — the oldest waited ${worldAgeWords(now - oldestWaitMs)}`,
    });
  }

  // t1143 — the completions' own words (the achievements speak LAST:
  // the failure first, the work now, the queue's patience, then the
  // finished runs' own dated and weighed story).
  if (fresh && now > freshMs) {
    const d = durationMsOf(fresh);
    rows.push({
      key: "fresh-completion",
      label: "Fresh",
      ok: true,
      detail: `${fresh.name} finished ${worldAgeWords(now - freshMs)} ago${d != null ? ` · ran ${worldAgeWords(d)}` : ""}`,
    });
  }
  if (marathon) {
    rows.push({
      key: "marathon",
      label: "Marathon",
      ok: true,
      detail: `${marathon.name} ran the longest — ${worldAgeWords(marathonMs)}`,
    });
  }

  return rows;
}

/** The clipboard's words — the ledger's own sentences, not a second
 * formatter (the t1132 one-father law, the ⧉ chip's sibling). */
export function worldLedgerText(history: WorldSnapshot[]): string {
  if (history.length < 2) {
    return "world ledger — no transitions since this page loaded (the ledger writes only real changes: a job created, a status flip, an edge drawn)";
  }
  const lines = [
    `world ledger — ${history.length - 1} transition${history.length - 1 === 1 ? "" : "s"} (oldest first)`,
    ...history.map(
      (s) =>
        `${clockWordsOf(s.t)}  jobs=${s.jobs} edges=${s.edges} completed=${s.completed} running=${s.running} failed=${s.failed}`,
    ),
  ];
  return lines.join("\n");
}

/** The board's age words — the last movement's age rides the SAME
 * formatter as the running readout (one father for durations). */
export function worldAgeWords(ms: number): string {
  return formatElapsed(ms);
}

/* ---------------------------------------------------------------------- */
/* t1139 — the transition inspector: what MOVED at each step, and the       */
/* ledger's download door.                                                  */
/*                                                                          */
/* The ledger records transitions; the delta is the transition's own        */
/* story — a bar that only says "16 jobs" makes the reader do the           */
/* subtraction the lib already knows. Only the movers speak: a world        */
/* where two numbers moved is a two-word sentence, not a five-field          */
/* dump. The download door rides the SAME versioned envelope the            */
/* storage write uses (one father: a future import door reads both          */
/* with one reader) and the family's stamp grammar (the funnel ledger's     */
/* ISO stamp, the cryoflow- prefix the presets shelf speaks).               */
/* ---------------------------------------------------------------------- */

const DELTA_FIELDS: {
  key: "jobs" | "edges" | "running" | "completed" | "failed";
  one: string;
  many: string;
}[] = [
  { key: "jobs", one: "job", many: "jobs" },
  { key: "edges", one: "edge", many: "edges" },
  { key: "running", one: "running", many: "running" },
  { key: "completed", one: "completed", many: "completed" },
  { key: "failed", one: "failed", many: "failed" },
];

/** The transition's own words — only the fields that MOVED speak, in
 * the vitals' speaking order, signed (+ arrived / − left). The ledger's
 * first world has no prev: it introduces itself instead of lying about
 * a delta that never happened. Pure — one string. */
export function transitionWords(prev: WorldSnapshot | null, cur: WorldSnapshot): string {
  if (!prev) {
    return `the ledger's first world: ${cur.jobs} job${cur.jobs === 1 ? "" : "s"} · ${cur.edges} edge${cur.edges === 1 ? "" : "s"}`;
  }
  const words: string[] = [];
  for (const f of DELTA_FIELDS) {
    const d = cur[f.key] - prev[f.key];
    if (d === 0) continue;
    const n = Math.abs(d);
    words.push(`${d > 0 ? "+" : "−"}${n} ${n === 1 ? f.one : f.many}`);
  }
  return words.length > 0 ? words.join(" · ") : "no visible change";
}

/** The download door's filename — the family's grammar: the cryoflow-
 * prefix, the ledger's own word, the funnel ledger's ISO stamp (a
 * downloads folder full of anonymous "ledger.json" copies is how
 * export features get distrusted — the preset shelf's law). Pure —
 * the stamp rides the caller's Date so tests construct fixed ones. */
export function worldLedgerFilename(now: Date = new Date()): string {
  return `cryoflow-world-ledger-${now.toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`;
}

/** The download door's body — EXACTLY the storage envelope (the v1
 * shape law): the same writer could read it back. One father means one
 * envelope — a forked export shape is a second contract wearing the
 * first's name. Pure — one string. */
export function worldLedgerJson(history: WorldSnapshot[]): string {
  return JSON.stringify({ v: WORLD_LEDGER_STORAGE_VERSION, rows: history }, null, 2);
}

/* ---------------------------------------------------------------------- */
/* t1135 — the ledger's persistence layer: the world's memory outlives      */
/* the page.                                                                */
/*                                                                          */
/* sessionStorage — the TAB's own memory: a new session opens a new world   */
/* memory (the ledger is a session's story, not an eternal one), and a      */
/* tab crash loses only the tab. The envelope is versioned (a shape the     */
/* reader cannot trust is dropped, never guessed) and quota-guarded (a      */
/* storage refusal keeps the memory-only ledger — the board degrades, it    */
/* never lies). The lib stays pure: the STORAGE is a parameter, the SSR     */
/* caller passes null, the tests construct a fake.                          */
/* ---------------------------------------------------------------------- */

export const WORLD_LEDGER_STORAGE_KEY = "cryoflow.world-ledger.v1";
export const WORLD_LEDGER_STORAGE_VERSION = 1;

/** The one-row shape law: the five health-bearing numbers and a finite
 * stamp, each non-negative and finite. The census words beyond the five
 * (pending/idle) ride the live census, not the ledger — the snapshot
 * contract is the memory's contract. */
export function isWorldSnapshotShape(x: unknown): x is WorldSnapshot {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  const nums = [r.t, r.jobs, r.edges, r.running, r.completed, r.failed];
  return nums.every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0);
}

/** Read a persisted ledger. EVERY refusal is a whole-ledger refusal —
 * a half-trusted memory is a lie with a footnote:
 *   no store / no raw / bad JSON / wrong version / rows not an array /
 *   any row off-shape / more rows than the cap — all restore nothing.
 * The empty restore is an HONEST absence (the board starts its own
 * story), not an error face. t1142 — the read rides the ONE parse
 * father (the same reader reads every tier that carries the envelope:
 * the storage getter and the server GET body land in the same trust
 * decision), so a tier can never grow a private dialect of "trusted". */
export function readWorldLedgerStorage(store: Pick<Storage, "getItem"> | null): WorldSnapshot[] {
  if (!store) return [];
  let raw: string | null = null;
  try {
    raw = store.getItem(WORLD_LEDGER_STORAGE_KEY);
  } catch {
    return [];
  }
  return parseWorldLedgerEnvelope(raw);
}

/** Write a persisted ledger. Returns the write's receipt — a quota or
 * serialization refusal is FALSE, never a throw (the caller keeps the
 * memory-only ledger and the world never sees the wound). t1142 — the
 * write rides the ONE envelope father: the storage face and the server
 * push body are the SAME bytes (JSON.stringify is deterministic), so
 * no tier can drift into a second contract wearing the first's name. */
export function writeWorldLedgerStorage(
  store: Pick<Storage, "setItem"> | null,
  history: WorldSnapshot[],
): boolean {
  if (!store) return false;
  try {
    store.setItem(WORLD_LEDGER_STORAGE_KEY, worldLedgerEnvelope(history));
    return true;
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------------------- */
/* t1141 — the ledger's DEEPER tier: the machine's memory beside the        */
/* tab's.                                                                   */
/*                                                                          */
/* The t1135 slice made the ledger sessionStorage — the TAB's own memory.   */
/* The survey (scripts/t1141-ledger-storage-survey.mjs, 10/10) measured     */
/* the deeper tier BEFORE it was wired: the envelope at cap weighs 18,976 B  */
/* against a 10 GiB origin quota (0.0002% — the tier's space cost is nil;   */
/* a refusal is privacy-mode territory, not arithmetic), BOTH storages take */
/* the envelope whole on the live origin, and localStorage holds zero       */
/* cryoflow keys today (no collision). So the deeper tier is localStorage — */
/* the MACHINE's memory: it outlives the tab, and a new tab's empty         */
/* session tier fills from it.                                              */
/*                                                                          */
/* The tier laws:                                                           */
/*   • ONE reader, ONE writer, ONE envelope — each tier composes the        */
/*     t1135 fathers; a second envelope would be a second contract          */
/*     wearing the first's name.                                            */
/*   • The TAB's story wins: the session tier is the live story (its        */
/*     writes are the newest); the local tier fills only an empty tab.      */
/*   • A REFUSED TIER IS THAT TIER'S ABSENCE — a foreign version or a       */
/*     half shape in either tier drops that tier whole (the same reader's   */
/*     law) and never blinds the other tier's restore.                      */
/*   • Write-through BOTH: every commit lands on both tiers; each tier      */
/*     keeps its OWN receipt — a refusing tier degrades alone (the board    */
/*     never sees the wound; the other tier keeps the memory).              */
/*   • The machine tier is SHARED: two tabs of one origin are two writers   */
/*     on one key — last commit wins, named honestly here and guarded by    */
/*     the version law (an untrusted shape is dropped, never guessed).      */
/* ---------------------------------------------------------------------- */

export type WorldLedgerTier = "session" | "local" | "none";

export interface WorldLedgerRestore {
  rows: WorldSnapshot[];
  tier: WorldLedgerTier;
}

/** The restore across the two tiers — the tab's own story wins; the
 * machine's story fills an empty tab. Each tier rides the SAME reader
 * (one father): a refusal in one tier is that tier's absence, not the
 * restore's death. Pure — the stores are parameters; the SSR caller
 * passes nulls; the tests construct fakes. */
export function readWorldLedgerTiers(
  session: Pick<Storage, "getItem"> | null,
  local: Pick<Storage, "getItem"> | null,
): WorldLedgerRestore {
  const fromSession = readWorldLedgerStorage(session);
  if (fromSession.length > 0) return { rows: fromSession, tier: "session" };
  const fromLocal = readWorldLedgerStorage(local);
  if (fromLocal.length > 0) return { rows: fromLocal, tier: "local" };
  return { rows: [], tier: "none" };
}

export interface WorldLedgerWriteReceipt {
  session: boolean;
  local: boolean;
}

/** The write-through — every commit lands on BOTH tiers through the
 * SAME writer (one father, one envelope: JSON.stringify is
 * deterministic, so both tiers hold byte-equal memories). Each tier
 * keeps its OWN receipt; a refusal (quota, privacy mode) degrades that
 * tier alone and is never a throw. Pure — the stores are parameters. */
export function writeWorldLedgerTiers(
  session: Pick<Storage, "setItem"> | null,
  local: Pick<Storage, "setItem"> | null,
  history: WorldSnapshot[],
): WorldLedgerWriteReceipt {
  return {
    session: writeWorldLedgerStorage(session, history),
    local: writeWorldLedgerStorage(local, history),
  };
}

/* ---------------------------------------------------------------------- */
/* t1142 — the ledger's SERVER tier: the world's memory outlives the         */
/* machine.                                                                 */
/*                                                                          */
/* The t1135 slice made the ledger sessionStorage (the TAB's memory); the   */
/* t1141 slice added localStorage (the MACHINE's memory) after its survey   */
/* measured the tier BEFORE it was wired. That survey named this third      */
/* tier's cost up front — an API + DB row — and its law: the ENVELOPE       */
/* RIDES UNCHANGED, the same reader reads it. So the tier adds no second    */
/* contract; the fathers below are the t1135 family's own words:            */
/*   • worldLedgerEnvelope — the ONE envelope-text father (the compact      */
/*     JSON the tiers writer stores; the server push body is the SAME       */
/*     bytes). The pretty download face (worldLedgerJson) stays             */
/*     shape-equal — each door keeps its own face (the t1139 law).          */
/*   • validateWorldLedgerEnvelope — the ONE trust decision: { ok, rows }   */
/*     or { ok: false, reason } — a refusal NAMES its reason (the route's   */
/*     400 speaks it verbatim; the reader's face turns it into the honest   */
/*     empty restore).                                                      */
/*   • parseWorldLedgerEnvelope — the ONE read father: the storage getter   */
/*     and the server GET body both land here. A refused tier is that       */
/*     tier's ABSENCE — never the restore's death (the t1141 per-tier       */
/*     law, now shared by the network tier).                                */
/* The fetch is INJECTED (the lib stays pure — the SSR caller never asks,   */
/* the tests construct a fake). The tier precedence at the door: the TAB's  */
/* story wins, the MACHINE's story fills an empty tab, the SERVER's story   */
/* fills an empty machine — a project-scoped row (the API family's          */
/* grammar: the world's memory under its own project's name, the phantom    */
/* door refusing a foreign id). Each tier keeps its own receipt; the        */
/* server's push is fire-and-forget — a refusal degrades that tier alone    */
/* and the board never waits on the network.                                */
/* ---------------------------------------------------------------------- */

/** The envelope's byte bound — the t1141 unit's tooth made law: the
 * envelope at cap (240 rows) weighs 18,976 B, so 64 KiB leaves ~3.4×
 * headroom; a fatter row shape REDs the tooth and the survey re-runs.
 * The rows are five numbers and a finite stamp — pure ASCII — so the
 * JS string length IS the byte count (the route guards with it). */
export const WORLD_LEDGER_ENVELOPE_MAX_BYTES = 65536;

export type WorldLedgerEnvelopeVerdict =
  | { ok: true; rows: WorldSnapshot[] }
  | {
      ok: false;
      reason: "bad-json" | "bad-version" | "bad-rows" | "over-cap" | "bad-row-shape";
    };

/** The ONE trust decision for an envelope text — the version law's
 * mouth. Absent/empty is NOT a refusal: it is the honest absence (an
 * empty restore, { ok: true, rows: [] }) — the same face the storage
 * getter has spoken since t1135. Every real refusal names its reason
 * (the route speaks it; the reader's face drops it whole). */
export function validateWorldLedgerEnvelope(
  raw: string | null | undefined,
): WorldLedgerEnvelopeVerdict {
  if (!raw) return { ok: true, rows: [] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "bad-json" };
  }
  if (!parsed || typeof parsed !== "object") return { ok: false, reason: "bad-json" };
  const env = parsed as { v?: unknown; rows?: unknown };
  if (env.v !== WORLD_LEDGER_STORAGE_VERSION) return { ok: false, reason: "bad-version" };
  if (!Array.isArray(env.rows)) return { ok: false, reason: "bad-rows" };
  if (env.rows.length > WORLD_LEDGER_CAP) return { ok: false, reason: "over-cap" };
  if (!env.rows.every((r) => isWorldSnapshotShape(r))) return {
    ok: false,
    reason: "bad-row-shape",
  };
  return {
    ok: true,
    rows: env.rows.map((r) => {
      const s = r as WorldSnapshot;
      return {
        t: s.t,
        jobs: s.jobs,
        edges: s.edges,
        running: s.running,
        completed: s.completed,
        failed: s.failed,
      };
    }),
  };
}

/** The reader's face — every refusal is the honest empty restore (the
 * t1135 whole-ledger law, now the ONE reader for every tier that
 * carries the envelope: the storage getter and the server GET body). */
export function parseWorldLedgerEnvelope(raw: string | null | undefined): WorldSnapshot[] {
  const verdict = validateWorldLedgerEnvelope(raw);
  return verdict.ok ? verdict.rows : [];
}

/** The ONE envelope-text father — the compact JSON the tiers writer
 * stores and the server push carries (byte-equal: JSON.stringify is
 * deterministic). One envelope, one contract, every tier's face. */
export function worldLedgerEnvelope(history: WorldSnapshot[]): string {
  return JSON.stringify({ v: WORLD_LEDGER_STORAGE_VERSION, rows: history });
}

/** The fetch shape the lib rides — injected, the lib stays pure. */
type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<Response>;

export interface WorldLedgerServerRead {
  rows: WorldSnapshot[];
  /** false = the transport refused (non-200, network) — the tier's
   * ABSENCE; true with zero rows = the server's honest "no memory yet"
   * (a live row that spoke null). */
  reachable: boolean;
}

/** The server tier's READ — GET the project's ledger row; the body's
 * envelope rides into the ONE parse father. A refusal (non-200,
 * network, half body) is that tier's ABSENCE — [] — and never a
 * throw: the board keeps whatever story it already holds. */
export async function fetchWorldLedgerServer(
  fetcher: FetchLike,
  projectId: string,
): Promise<WorldLedgerServerRead> {
  try {
    const res = await fetcher(`/api/projects/${projectId}/world-ledger`, { method: "GET" });
    if (!res.ok) return { rows: [], reachable: false };
    const body = (await res.json()) as { envelope?: string | null };
    return { rows: parseWorldLedgerEnvelope(body?.envelope ?? null), reachable: true };
  } catch {
    return { rows: [], reachable: false };
  }
}

/** The server tier's WRITE — PUT the envelope through the ONE envelope
 * father (the transport frame carries it; the envelope field is the
 * exact bytes the tiers writer stores). The receipt is the promise's
 * boolean; a refusal is FALSE and never a throw — the caller keeps
 * the tier-degraded ledger the board already was. */
export async function pushWorldLedgerServer(
  fetcher: FetchLike,
  projectId: string,
  history: WorldSnapshot[],
): Promise<boolean> {
  try {
    const res = await fetcher(`/api/projects/${projectId}/world-ledger`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ envelope: worldLedgerEnvelope(history) }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

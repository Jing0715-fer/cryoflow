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
 * story), not an error face. */
export function readWorldLedgerStorage(store: Pick<Storage, "getItem"> | null): WorldSnapshot[] {
  if (!store) return [];
  let raw: string | null = null;
  try {
    raw = store.getItem(WORLD_LEDGER_STORAGE_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object") return [];
  const env = parsed as { v?: unknown; rows?: unknown };
  if (env.v !== WORLD_LEDGER_STORAGE_VERSION || !Array.isArray(env.rows)) return [];
  if (env.rows.length > WORLD_LEDGER_CAP) return [];
  if (!env.rows.every((r) => isWorldSnapshotShape(r))) return [];
  return env.rows.map((r) => {
    const s = r as WorldSnapshot;
    return {
      t: s.t,
      jobs: s.jobs,
      edges: s.edges,
      running: s.running,
      completed: s.completed,
      failed: s.failed,
    };
  });
}

/** Write a persisted ledger. Returns the write's receipt — a quota or
 * serialization refusal is FALSE, never a throw (the caller keeps the
 * memory-only ledger and the world never sees the wound). */
export function writeWorldLedgerStorage(
  store: Pick<Storage, "setItem"> | null,
  history: WorldSnapshot[],
): boolean {
  if (!store) return false;
  try {
    store.setItem(
      WORLD_LEDGER_STORAGE_KEY,
      JSON.stringify({ v: WORLD_LEDGER_STORAGE_VERSION, rows: history }),
    );
    return true;
  } catch {
    return false;
  }
}

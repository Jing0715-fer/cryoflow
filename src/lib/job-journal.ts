/**
 * CryoFlow — the job journal (Task 718): the event spine between the
 * lifecycle dots.
 *
 * The inspector's Timeline section already answers "where is this job
 * now?" with three milestone dots (Created → Started → Completed, the
 * t340-era strip). This lib records everything that happened BETWEEN
 * those dots: the rename, the five knob-turns, the note saved, the run
 * dispatched, the auto-start the engine gave, the landing. A note is
 * what the user CONCLUDED; the journal is what HAPPENED — together the
 * inspector tells the whole story of a job.
 *
 * STORAGE LAYER — the t712 law says ask first. The journal is a
 * per-browser LENS on local activity, not a server fact: it rides
 * localStorage (`cryoflow.job-journal:v1`), the same layer as the
 * canvas viewport bookmarks. Status facts themselves already live on
 * the server (the job row); the journal adds the HUMAN-scale events the
 * row can't remember (two renames, the preset worn at 14:02). Like
 * every browser-local asset it is honestly single-browser.
 *
 * THE DORMANT LAW — the journal outlives the job QUIETLY. Deleting a
 * job does not purge its journal (no prune hook in the delete path):
 * the entries go dormant behind an id nothing looks up, age out through
 * the caps, and a Ctrl+Z restore finds its history intact. Pruning on
 * delete would trade real history for a few hundred dormant bytes.
 *
 * COALESCING — two laws, both in the lib so no call site can forget:
 *   - IDENTICAL NEIGHBOR (1.5s): same job + same kind + same detail
 *     within 1.5s of the last event is one fact, not two (the note
 *     autosave's unmount flush racing its timer flush).
 *   - KICKED-AFTER-RUN (30s): the poll's pending→running sweep fires
 *     for manual dispatches too, so a "kicked" arriving within 30s of a
 *     recorded "run" for the same job is the SAME start seen twice —
 *     the dispatch's record wins (it knows the finger; the poll only
 *     knows the state). Kicks beyond the window are the engine's own
 *     auto-starts and sibling-tab runs, and are recorded.
 *
 * CAPS — 20 events per job (a job's story is a spine, not a log),
 * 200 jobs (LRU by last append; dormant journals age out here). Silent
 * on quota refusal (the session's in-memory read stays the truth),
 * corruption degrades to an empty journal (a convenience store must
 * not take the inspector down — the loadUserParamPresets law).
 *
 * PURITY — no fetch, no store import, no React. The store's five hook
 * sites call recordJobEvent; the inspector reads readJobJournal. The
 * store's jobs slice is the change bus: every hook lands through a
 * store update, so the mounted section re-reads without a custom event.
 *
 * THE SECOND READING (Task 720) — readRecentJobEvents is the journal's
 * cross-job read: every job's spine merged into one newest-first stream,
 * the data behind the dashboard's journal digest (the activity family's
 * fourth face). Still zero new storage and zero new hooks — the same map
 * the five hook sites append to, just read ACROSS jobs instead of within
 * one. The digest is a shopwindow over this stream; the archive remains
 * the per-job spine (readJobJournal).
 */

export const JOB_JOURNAL_KEY = "cryoflow.job-journal:v1";

export type JobJournalKind =
  | "run" // dispatched (manual finger or orchestration walk)
  | "kicked" // the engine gave it a start (auto-start / sibling tab)
  | "completed"
  | "failed"
  | "params" // spec params changed (detail: N knobs)
  | "note" // the margin note was saved (detail: excerpt)
  | "renamed"; // detail: the new name

export interface JobJournalEvent {
  jobId: string;
  kind: JobJournalKind;
  at: number;
  /** short human clause — the verb row's middle slot */
  detail?: string;
}

const MAX_PER_JOB = 20;
const MAX_JOBS = 200;
const IDENTICAL_NEIGHBOR_MS = 1_500;
const KICKED_AFTER_RUN_MS = 30_000;
const MAX_DETAIL_CHARS = 120;

type JournalMap = Record<string, JobJournalEvent[]>;

function readMap(): JournalMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(JOB_JOURNAL_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: JournalMap = {};
    for (const [id, list] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(list)) continue;
      const events = list.filter(
        (e): e is JobJournalEvent =>
          e != null &&
          typeof e === "object" &&
          typeof (e as JobJournalEvent).jobId === "string" &&
          typeof (e as JobJournalEvent).kind === "string" &&
          Number.isFinite((e as JobJournalEvent).at)
      );
      if (events.length > 0) out[id] = events;
    }
    return out;
  } catch {
    return {};
  }
}

function writeMap(map: JournalMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(JOB_JOURNAL_KEY, JSON.stringify(map));
  } catch {
    // quota/privacy refusal — the session keeps recording in memory;
    // nothing to escalate (the shelf's persist shrug, third reuse)
  }
}

function lastEvent(map: JournalMap, jobId: string): JobJournalEvent | undefined {
  const list = map[jobId];
  return list && list.length > 0 ? list[list.length - 1] : undefined;
}

/** Append one event. Laws: the two coalescing windows above, per-job
 *  and per-shelf caps (oldest drops, least-recently-appended jobs evict),
 *  silent on storage refusal. Returns nothing — the store's jobs slice
 *  is the change bus, not this lib. */
export function recordJobEvent(
  jobId: string,
  kind: JobJournalKind,
  detail?: string,
  opts: { now?: number } = {}
): void {
  if (typeof window === "undefined") return;
  const now = opts.now ?? Date.now();
  const map = readMap();
  const list = map[jobId] ?? [];

  const prev = list.length > 0 ? list[list.length - 1] : undefined;
  const trimmed = detail != null && detail !== "" ? detail.slice(0, MAX_DETAIL_CHARS) : undefined;
  if (prev) {
    // IDENTICAL NEIGHBOR — one fact, not two (the unmount flush racing
    // the timer flush; the poll tick re-seeing a landing)
    if (
      prev.kind === kind &&
      (prev.detail ?? undefined) === trimmed &&
      now - prev.at <= IDENTICAL_NEIGHBOR_MS
    ) {
      return;
    }
    // KICKED-AFTER-RUN — the poll re-witnessing a dispatch it never saw
    if (kind === "kicked" && prev.kind === "run" && now - prev.at <= KICKED_AFTER_RUN_MS) {
      return;
    }
  }

  // the map entry's EXISTENCE is the LRU clock — a fresh append moves
  // the job to the end of the object's insertion order
  delete map[jobId];
  map[jobId] = [...list, { jobId, kind, at: now, ...(trimmed !== undefined ? { detail: trimmed } : {}) }];

  // per-job cap: the spine stays a spine
  if (map[jobId].length > MAX_PER_JOB) map[jobId] = map[jobId].slice(map[jobId].length - MAX_PER_JOB);

  // per-shelf cap: evict the LEAST-RECENTLY-APPENDED jobs (insertion
  // order = recency order after the delete/re-append dance above)
  const ids = Object.keys(map);
  if (ids.length > MAX_JOBS) {
    for (const stale of ids.slice(0, ids.length - MAX_JOBS)) delete map[stale];
  }

  writeMap(map);
}

/** One job's spine, newest first. Never throws; an unknown or corrupted
 *  journal reads as an empty one (the synthetic birth lines are the
 *  component's business — they come from the job row, not from here). */
export function readJobJournal(jobId: string): JobJournalEvent[] {
  const list = readMap()[jobId] ?? [];
  return [...list].sort((a, b) => b.at - a.at);
}

/** The journal's cross-job read (Task 720): every job's spine merged
 *  into one newest-first stream, capped. The dashboard's journal digest
 *  renders this; nothing writes through here — a pure lens over the
 *  same map recordJobEvent maintains. Dormant journals (deleted jobs)
 *  are included: filtering them needs the roster, which is the
 *  component's business (it owns the id→name lookup), not the lib's. */
export function readRecentJobEvents(cap = 24): JobJournalEvent[] {
  const all: JobJournalEvent[] = [];
  for (const list of Object.values(readMap())) all.push(...list);
  return all.sort((a, b) => b.at - a.at).slice(0, Math.max(0, cap));
}

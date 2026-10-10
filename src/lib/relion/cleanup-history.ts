/**
 * t522 — the cleanup LEDGER: who cleaned what, when, through which door.
 *
 * The field report that convicted the gap: this box hosts real deletions
 * from TWO doors (the Storage/cleanup dialog's POST and the agent's
 * cleanup_job_files verb — t518's "two doors, one shovel") and a third
 * historic writer besides (the seeder/test surgeries that rm mirror
 * trees), yet nothing remembers them. The dialog closes, the agent's
 * card scrolls away, and "what was deleted here last week?" has no face.
 * The storage report maps the PRESENT disk; the plan previews the
 * FUTURE; the receipt speaks ONE execution — the ledger is the PAST.
 *
 * Laws:
 *   - Every verdict is journaled, refusals included (an attempt that was
 *     refused with its reason is exactly what an audit wants to see).
 *   - The journal ride must never break the run: a ledger write failure
 *     is swallowed (the ledger is a witness, not a participant).
 *   - The ledger keeps a cap (CLEANUP_HISTORY_MAX — the t464 cap law:
 *     a ledger that grows forever is its own disk-eater).
 *   - Writes are atomic (temp + rename) — readers never see a torn line.
 *   - Raw digits ride the detail annex by reference; the summary speaks
 *     through fmtBytes only (the t518 voice law).
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "fs";
import path from "path";
import { DATA_DIR } from "@/lib/paths";

/** The ledger's length cap (oldest entries fall off the front). */
export const CLEANUP_HISTORY_MAX = 50;

/** How many entries a read face serves by default (newest first). */
export const CLEANUP_HISTORY_FACE = 20;

/** Which door knocked: the dialog's Clean button or the agent's verb. */
export type CleanupDoor = "dialog" | "agent";

/** One side's outcome, failure COUNT only — the per-file strings stay in
 *  the execution's own receipt (they name paths; the ledger names acts). */
export interface CleanupHistorySide {
  deleted: number;
  freedBytes: number;
  failures: number;
}

export interface CleanupHistoryEntry {
  /** ISO timestamp of the verdict (when the shovel finished, not started). */
  at: string;
  jobId: string;
  jobName: string;
  projectId: string;
  door: CleanupDoor;
  scopes: { local: boolean; remote: boolean };
  /** The tiers as requested, verbatim (["safe"] | ["safe","bulk"] | …). */
  tiers: string[];
  /** false = the attempt was refused; `error` carries the refusal verbatim. */
  ok: boolean;
  error?: string;
  local?: CleanupHistorySide;
  remote?: CleanupHistorySide & { manifestRewritten: boolean };
}

const HISTORY_FILE = path.join(DATA_DIR, "cleanup-history.json");

interface Ledger {
  version: 1;
  entries: CleanupHistoryEntry[];
}

/** t522 self-caught (bench T3/T4g convicted it before any ship): never
 *  hand out a module-level EMPTY singleton — the first append's `push`
 *  poisoned the shared array FOREVER (the entry haunted every later
 *  "file missing → empty" read, and the first append after a rm double-
 *  wrote it into the fresh file). Every empty answer is a FRESH object;
 *  every append works on a copy. Family law: a default-shaped singleton
 *  must never escape a getter that a mutator also reads through. */
function freshLedger(): Ledger {
  return { version: 1, entries: [] };
}

function readLedger(): Ledger {
  try {
    if (!existsSync(HISTORY_FILE)) return freshLedger();
    const parsed = JSON.parse(readFileSync(HISTORY_FILE, "utf8")) as Ledger;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.entries)) return freshLedger();
    return { version: 1, entries: [...parsed.entries] };
  } catch {
    /* a torn or foreign file answers empty — the ledger never lies by crashing */
    return freshLedger();
  }
}

function writeLedger(ledger: Ledger): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${HISTORY_FILE}.tmp`;
    writeFileSync(tmp, JSON.stringify(ledger, null, 1));
    renameSync(tmp, HISTORY_FILE);
  } catch {
    /* best-effort — the cleanup's verdict already reached its caller */
  }
}

/** Journal one verdict (ok or refused). Cap-enforcing, atomic, silent on
 *  its own failures — call it fire-and-forget from the shovel. */
export function appendCleanupExecution(entry: CleanupHistoryEntry): void {
  const ledger = readLedger();
  const entries = [...ledger.entries, entry];
  writeLedger({
    version: 1,
    entries:
      entries.length > CLEANUP_HISTORY_MAX ? entries.slice(-CLEANUP_HISTORY_MAX) : entries,
  });
}

/** The read face's data: newest first, at most `limit` entries. */
export function readCleanupHistory(limit: number = CLEANUP_HISTORY_FACE): CleanupHistoryEntry[] {
  return readLedger()
    .entries.slice(-Math.max(1, limit))
    .reverse();
}

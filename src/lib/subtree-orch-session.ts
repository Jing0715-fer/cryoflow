/**
 * t450 — the walk's second breath: the session record.
 * t451 — the walk's inheritance: the record moves house.
 *
 * The subtree orchestration's loop lives in a tab (the store's async
 * closure). t450 made the plan survive a reload: the record persisted
 * in sessionStorage (same-tab semantics) and the boot resurrected the
 * walk by scanning the LIVE world against it (lib/subtree-run.ts
 * resumeScan — the world is the truth, the record is just the plan).
 *
 * t451 removes the remaining boundary: the record now lives in
 * localStorage — the WORKSPACE's memory, not one tab's. A closed tab
 * no longer kills the walk: a sibling tab adopts it, or the next tab
 * to open does. The record therefore carries an OWNER (a tab id, lib/
 * tab-identity.ts), a HEARTBEAT (the owner pings it while it walks)
 * and an EPOCH (the claim count). The claim law — one walk, one heir:
 *
 *   no record            → nothing to inherit;
 *   owner === self       → this tab's own walk (a reload reclaims it
 *                          instantly — no heartbeat wait);
 *   heartbeat fresh      → another LIVE tab owns the walk — stay out
 *                          (two walkers would fight over the landing
 *                          law; the second dispatch would die on the
 *                          per-job 409 door);
 *   heartbeat stale      → the owner is dead or gone: CLAIM the walk
 *                          (owner := self, epoch + 1) and let the
 *                          boot's world-truth scan do the resurrecting
 *                          — adoption is just resurrection by another
 *                          hand.
 *
 * Owner-conditional writes: heartbeats, mirror saves and clears only
 * land when the writer still owns the record — a dispossessed walker
 * (it slept, a sibling claimed) must never fight the new owner's
 * record back, and its exit must never erase the heir's claim.
 *
 * Consume-once survives in spirit: every TERMINAL decision (root gone,
 * degenerate plan, armed stop, all landed, failed frontier) retires the
 * record — a refused or finished resume never retry-loops; only the
 * "elsewhere" verdict leaves it, because it is not ours to take.
 *
 * The v1 session record (the pre-inheritance build) imports once as
 * this tab's own walk — the reload it was saved for may have already
 * happened; after this boot the record lives in v2.
 *
 * Every access is guarded (typeof window, try/catch): SSR renders the
 * shell before any window exists, and a private-mode storage that
 * throws on write must never take the walk down with it.
 */

import type { RemoteRunTarget } from "@/lib/remote/types";
import type { SubtreeOrchState } from "@/lib/subtree-run";
import { getTabId } from "@/lib/tab-identity";

export const ORCH_RECORD_KEY = "cryoflow.subtreeOrch.v2";

const LEGACY_ORCH_KEY = "cryoflow.subtreeOrch.v1";

/** The owner pings the record every ORCH_HB_MS while its walk lives. */
export const ORCH_HB_MS = 3000;

/** A heartbeat older than ORCH_STALE_MS means the owner is gone —
 *  (a little more than two missed beats: one throttled timer must
 *  never hand a LIVE walk to a stranger). */
export const ORCH_STALE_MS = 10_000;

export interface StoredSubtreeOrch {
  orch: SubtreeOrchState;
  target: RemoteRunTarget | null;
  /** Which tab owns the walk right now (lib/tab-identity.ts). */
  owner: string;
  /** The owner's last heartbeat (Date.now() while walking). */
  hb: number;
  /** How many times the walk changed hands (claims). Fresh walk = 1. */
  epoch: number;
  /** t451 — the walk's first breath (the first save's instant). The
   *  boot scan reads it to tell a walk's own landing from a result
   *  that predates the walk (a previous run's completed output must
   *  NOT count as landed — the walk has to re-run it). Preserved
   *  across claims: the walk's age is the WALK's, not the heir's. */
  walkStart?: number;
}

/** Shape guard: a hand-edited or half-written record must never
 *  resurrect a walk — an invalid record is read as no record. */
function isPlausible(v: unknown): v is StoredSubtreeOrch {
  if (typeof v !== "object" || v === null) return false;
  const o = v as StoredSubtreeOrch;
  if (typeof o.owner !== "string" || o.owner.length === 0) return false;
  if (typeof o.hb !== "number" || !Number.isFinite(o.hb)) return false;
  if (typeof o.epoch !== "number" || !Number.isFinite(o.epoch) || o.epoch < 1) return false;
  if (o.walkStart !== undefined && (typeof o.walkStart !== "number" || !Number.isFinite(o.walkStart))) {
    return false;
  }
  if (typeof o.orch !== "object" || o.orch === null) return false;
  const orch = o.orch;
  return (
    typeof orch.rootId === "string" &&
    typeof orch.rootName === "string" &&
    typeof orch.index === "number" &&
    typeof orch.stopRequested === "boolean" &&
    Array.isArray(orch.order) &&
    orch.order.every(
      (n) =>
        typeof n === "object" &&
        n !== null &&
        typeof (n as { id?: unknown }).id === "string" &&
        typeof (n as { name?: unknown }).name === "string"
    ) &&
    (o.target === null || typeof o.target === "object")
  );
}

function readRaw(): StoredSubtreeOrch | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ORCH_RECORD_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPlausible(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Read the shared record (shape-guarded) — the loop's abdication
 *  checkpoint and the stop verb's owner check read through this. */
export function readSubtreeOrch(): StoredSubtreeOrch | null {
  return readRaw();
}

function writeRaw(record: StoredSubtreeOrch): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ORCH_RECORD_KEY, JSON.stringify(record));
  } catch {
    /* private mode / quota — the walk keeps its in-memory face */
  }
}

/** Save (or mirror-save) the walk's record. Claims ownership when the
 *  walk is new (fresh epoch), preserves it on the loop's mirror saves.
 *  This is the OWNER's write — the loop's index bumps go through
 *  saveSubtreeOrchIfOwner, which refuses when ownership moved. */
export function saveSubtreeOrch(
  orch: SubtreeOrchState,
  target: RemoteRunTarget | null
): void {
  const existing = readRaw();
  const self = getTabId();
  const ours = existing && existing.owner === self;
  writeRaw({
    orch,
    target,
    owner: self,
    hb: Date.now(),
    epoch: ours ? existing.epoch : 1,
    // the walk's first breath is the WALK's — preserved on mirror
    // saves and across adoptions, fresh only for a new gesture
    walkStart: ours && existing.walkStart ? existing.walkStart : Date.now(),
  });
}

/** The loop's mirror save — lands only while this tab still owns the
 *  walk. A dispossessed walker (a sibling claimed while it slept)
 *  must never write its older progress over the heir's record. */
export function saveSubtreeOrchIfOwner(
  orch: SubtreeOrchState,
  target: RemoteRunTarget | null
): boolean {
  const existing = readRaw();
  if (!existing || existing.owner !== getTabId()) return false;
  writeRaw({ ...existing, orch, target, hb: Date.now() });
  return true;
}

/** The owner's heartbeat — one ping, nothing else moves. Refused when
 *  ownership moved: a zombie beat must never freshen a stranger's
 *  claim. */
export function heartbeatSubtreeOrch(): boolean {
  const existing = readRaw();
  if (!existing || existing.owner !== getTabId()) return false;
  writeRaw({ ...existing, hb: Date.now() });
  return true;
}

/** Retire the record — but only the owner's exit may retire it. A
 *  dispossessed walker's finally-block must never erase the heir's
 *  fresh claim (the walk continues on the new owner's face). */
export function clearSubtreeOrch(): boolean {
  const existing = readRaw();
  if (existing && existing.owner !== getTabId()) return false;
  if (typeof window === "undefined") return true;
  try {
    window.localStorage.removeItem(ORCH_RECORD_KEY);
    return true;
  } catch {
    return false;
  }
}

export type ClaimMode = "none" | "own" | "elsewhere" | "adopted";

export interface ClaimResult {
  mode: ClaimMode;
  /** The record the resumer walks from (present for own/adopted). */
  saved: StoredSubtreeOrch | null;
}

/** The claim law — one walk, one heir. Reads the shared record and
 *  decides what this tab may do with it (see module doc). An adoption
 *  WRITES the claim before returning: from that instant this tab is
 *  the owner, its heartbeats land, and a second claimant's own claim
 *  will overwrite it only to take the same responsibility — the
 *  per-job 409 door remains the world's backstop either way. */
export function claimSubtreeOrch(now: number = Date.now()): ClaimResult {
  const existing = readRaw();
  if (!existing) return { mode: "none", saved: null };
  const self = getTabId();
  if (existing.owner === self) return { mode: "own", saved: existing };
  if (now - existing.hb < ORCH_STALE_MS) {
    return { mode: "elsewhere", saved: existing };
  }
  const claimed: StoredSubtreeOrch = {
    ...existing,
    owner: self,
    hb: now,
    epoch: existing.epoch + 1,
  };
  writeRaw(claimed);
  return { mode: "adopted", saved: claimed };
}

/** One-shot legacy upgrade: a v1 session record (the pre-inheritance
 *  build's sessionStorage dialect) imports as this tab's OWN v2 walk —
 *  the reload it was saved for may have already happened, and after
 *  this boot the v1 key is gone. Garbage v1 is cleared, not read. */
export function importLegacySubtreeOrch(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.sessionStorage.getItem(LEGACY_ORCH_KEY);
    if (!raw) return;
    window.sessionStorage.removeItem(LEGACY_ORCH_KEY);
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return;
    const o = parsed as { orch?: unknown; target?: unknown };
    if (typeof o.orch !== "object" || o.orch === null) return;
    const orch = o.orch as SubtreeOrchState;
    if (
      typeof orch.rootId !== "string" ||
      typeof orch.rootName !== "string" ||
      typeof orch.index !== "number" ||
      typeof orch.stopRequested !== "boolean" ||
      !Array.isArray(orch.order)
    ) {
      return;
    }
    writeRaw({
      orch,
      target: (o.target as RemoteRunTarget | null) ?? null,
      owner: getTabId(),
      hb: Date.now(),
      epoch: 1,
      walkStart: Date.now(),
    });
  } catch {
    /* a half-written legacy record is no walk at all — leave it dead */
  }
}

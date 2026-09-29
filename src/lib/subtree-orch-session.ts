/**
 * t450 — the walk's second breath: the session record.
 *
 * The subtree orchestration's loop lives in the tab (the store's async
 * closure). A reload kills the closure — but not the PLAN. This module
 * persists the walk's smallest survivable truth into sessionStorage:
 * the order, the progress counter, the stop flag, and the cluster
 * target (a plain scalars object — connectionId/module/mode/gpus/… —
 * JSON-safe by construction). On boot, after the store's full pull
 * lands, the walk is resurrected by scanning the LIVE world against
 * the record (lib/subtree-run.ts resumeScan — the world is the truth,
 * the record is just the plan).
 *
 * Dialect: sessionStorage, the viewport-memory precedent (Task 99) —
 * same-tab semantics. A NEW tab never sees the record (two tabs must
 * never both resume the same walk), and closing the tab IS the walk's
 * death — the honest half of the tab law that survives this feature.
 *
 * Consume-once: the boot's first read clears the record BEFORE any
 * resume decision — a failed or refused resume must never retry-loop
 * on every subsequent load/project switch.
 *
 * Every access is guarded (typeof window, try/catch): SSR renders the
 * shell before any window exists, and a private-mode storage that
 * throws on write must never take the walk down with it.
 */

import type { RemoteRunTarget } from "@/lib/remote/types";
import type { SubtreeOrchState } from "@/lib/subtree-run";

const SUBTREE_ORCH_KEY = "cryoflow.subtreeOrch.v1";

interface StoredSubtreeOrch {
  orch: SubtreeOrchState;
  target: RemoteRunTarget | null;
  savedAt: number;
}

/** Shape guard: a hand-edited or half-written record must never
 *  resurrect a walk — an invalid record is read as no record. */
function isPlausible(v: unknown): v is StoredSubtreeOrch {
  if (typeof v !== "object" || v === null) return false;
  const o = v as StoredSubtreeOrch;
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

export function saveSubtreeOrch(
  orch: SubtreeOrchState,
  target: RemoteRunTarget | null
): void {
  if (typeof window === "undefined") return;
  try {
    const record: StoredSubtreeOrch = { orch, target, savedAt: Date.now() };
    window.sessionStorage.setItem(SUBTREE_ORCH_KEY, JSON.stringify(record));
  } catch {
    /* private mode / quota — the walk keeps its in-memory face */
  }
}

export function readSubtreeOrch(): StoredSubtreeOrch | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SUBTREE_ORCH_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPlausible(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearSubtreeOrch(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(SUBTREE_ORCH_KEY);
  } catch {
    /* nothing to clear, nothing to fail */
  }
}

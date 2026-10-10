/**
 * t451 — the walk's inheritance: the tab's name.
 *
 * The orchestration record (lib/subtree-orch-session.ts) moved house
 * from sessionStorage to localStorage — from a tab's private memory to
 * the workspace's shared memory. Sharing means the record must say WHO
 * owns the walk right now, and a claim decision must compare that
 * owner against the reader. This module is that "who": a small, stable
 * per-tab identity.
 *
 * Laws:
 *  - the id lives in sessionStorage (the viewport-memory dialect, Task
 *    99): it survives a reload (the SAME tab reclaims its own walk
 *    instantly, no heartbeat wait) and differs across tabs (a sibling
 *    tab is a stranger, arbitration applies);
 *  - a missing id is created on first read — one line, one random;
 *  - every access is guarded: a private-mode storage that throws must
 *    never take a walk down with it. When storage is unusable the tab
 *    falls back to a per-pageload random id — records cannot persist
 *    without storage anyway, so the fallback only needs to be honest
 *    within one page (it is never the same across reloads, which is
 *    exactly right: without storage there is nothing to reclaim).
 *
 * No module-level cache on the storage path: the bench simulates a
 * second tab by swapping the sessionStorage shim, and a cached id
 * would lie about whose tab is asking. A sessionStorage read is
 * nanoseconds — correctness wins.
 */

const TAB_ID_KEY = "cryoflow.tabId.v1";

/** Per-pageload fallback for the storageless world — unique per load. */
let storagelessId: string | null = null;

function makeTabId(): string {
  const rand =
    typeof crypto !== "undefined" && "getRandomValues" in crypto
      ? Array.from(crypto.getRandomValues(new Uint8Array(6)))
          .map((b) => b.toString(36))
          .join("")
      : Math.random().toString(36).slice(2);
  return `t-${Date.now().toString(36)}-${rand}`;
}

/** This tab's identity — stable across reloads, unique across tabs. */
export function getTabId(): string {
  if (typeof window === "undefined") {
    if (!storagelessId) storagelessId = makeTabId();
    return storagelessId;
  }
  try {
    const existing = window.sessionStorage.getItem(TAB_ID_KEY);
    if (existing) return existing;
    const id = makeTabId();
    window.sessionStorage.setItem(TAB_ID_KEY, id);
    return id;
  } catch {
    if (!storagelessId) storagelessId = makeTabId();
    return storagelessId;
  }
}

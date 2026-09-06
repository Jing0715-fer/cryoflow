/**
 * CryoFlow — mtime-keyed file compute cache (SERVER ONLY).
 *
 * The chart API routes (guinier / resolution / angdist / fsc) are polled
 * every 1–2 s while a job runs, and each poll used to re-read + re-parse
 * + re-aggregate the source STAR/Guinier files from scratch — megabytes of
 * text parsed per second per open chart. RELION writes these files in
 * discrete steps (once per iteration), so the computed aggregate only
 * changes when the file's (size, mtime) pair changes.
 *
 * cachedFileCompute() wraps a read+compute pass with that check: repeated
 * calls between writes are a single statSync (~µs) instead of a full
 * parse (~ms–tens of ms on the 13k-particle stars). The cache is capped
 * with insertion-order eviction — chart sources are a handful of files
 * per job; 24 entries covers every chart of the inspected job plus a full
 * refine's per-iteration model files riding in the same budget (entries
 * are KB-scale at most).
 */

import { existsSync, readFileSync, statSync } from "fs";

const MAX_ENTRIES = 24;

interface CacheSlot {
  key: string;
  value: unknown;
}

const store = new Map<string, CacheSlot>();

/**
 * Compute (or fetch cached) `compute(readFileSync(file))` for `file`.
 * Returns null when the file does not exist. Compute exceptions propagate
 * to the caller (routes already guard their bodies with try/catch).
 *
 * `computeId` MUST uniquely identify the call site (e.g. "fsc:pp-star"):
 * the cache key is (file, computeId) — one file can feed several consumers
 * with different parsers (postprocess.star feeds both the FSC and Guinier
 * routes), and keying on the path alone would serve consumer A's parsed
 * shape to consumer B.
 */
export function cachedFileCompute<T>(
  file: string,
  computeId: string,
  compute: (text: string) => T
): T | null {
  if (!existsSync(file)) return null;
  const st = statSync(file);
  const key = `${st.size}:${st.mtimeMs}`;
  const slot = `${file}\u0000${computeId}`;
  const hit = store.get(slot);
  if (hit && hit.key === key) {
    // refresh recency (Map preserves insertion order → LRU via re-insert)
    store.delete(slot);
    store.set(slot, hit);
    return hit.value as T;
  }
  const value = compute(readFileSync(file, "utf8"));
  if (store.size >= MAX_ENTRIES && !store.has(slot)) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(slot, { key, value });
  return value;
}

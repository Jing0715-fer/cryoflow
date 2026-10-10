/**
 * t573 — 3D class volume discovery for the 3D judge.
 *
 * RELION's class3d writes one volume PER CLASS PER ITERATION
 * (`run_itNNN_classMMM.mrc`), plus the final copies without the
 * iteration tag. The judge reads the LATEST iteration's set: the run's
 * last word about its classes. Kept alias-free (node:fs only) so the
 * unit suite can import it bare (the t562 pattern — node 24 runs TS).
 */

import { readdirSync } from "fs";
import * as path from "path";

export interface DiscoveredClassVolumes {
  /** the latest iteration tag found (null = no per-class volumes) */
  iteration: number | null;
  /** the latest iteration's volumes, class number ascending */
  volumes: { cls: number; file: string }[];
}

/**
 * Discover per-class volumes in a class3d workdir. Returns the LATEST
 * iteration's volumes sorted by class number; empty when the workdir is
 * unreadable or carries no per-class volume. The final no-tag copies
 * (`run_class001.mrc`) are deliberately ignored — a completed run's
 * `run_itNNN_*` files are its last word, and mixing the two dialects in
 * one listing would double-count every class.
 */
export function discoverClassVolumes(workdir: string): DiscoveredClassVolumes {
  let names: string[] = [];
  try {
    names = readdirSync(workdir);
  } catch {
    return { iteration: null, volumes: [] };
  }
  let bestIter = -1;
  const byIter = new Map<number, Map<number, string>>();
  for (const n of names) {
    // both stack dialects apply to volumes too: run_it / _it prefixes
    const m = n.match(/^(?:run_it|_it)(\d+)_class(\d+)\.mrc$/i);
    if (!m) continue;
    const it = Number(m[1]);
    const cls = Number(m[2]);
    if (cls <= 0) continue;
    bestIter = Math.max(bestIter, it);
    const bucket = byIter.get(it) ?? new Map<number, string>();
    bucket.set(cls, n);
    byIter.set(it, bucket);
  }
  if (bestIter < 0) return { iteration: null, volumes: [] };
  const bucket = byIter.get(bestIter);
  if (!bucket) return { iteration: null, volumes: [] };
  const volumes = [...bucket.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([cls, file]) => ({ cls, file: path.join(workdir, file) }));
  return { iteration: bestIter, volumes };
}

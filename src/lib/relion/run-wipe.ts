/**
 * CryoFlow — the fresh-start wipe legs (SERVER ONLY, t333).
 *
 * 「reset&，re-run或者delete任务时会先清除之前已生成的文件吗？」 — the
 * field answer was a crash: a re-run of an extraction job (changed box
 * size) died inside relion_preprocess at image.h:1534,
 *   "write: target and source objects have different size",
 * because the previous run's .mrcs particle stacks still sat in the
 * STABLE run workdir (<root>/<type>_<jobid8>) and RELION writes into
 * whatever sits at its output paths. A NEW job (empty workdir) sailed —
 * the user's own A/B evidence. The doctrine: **a fresh start is a fresh
 * directory** (RELION GUI's "Overwrite", answered automatically).
 *
 * WHAT DIES / WHAT SURVIVES is decided by the shared pure classifier
 * (classifyRerunWipe in hpc/cleanup) — this module only walks, deletes
 * and prunes. Callers:
 *   - the LOCAL engine lane (runRealJob, after the workdir mkdir, before
 *     buildArgv — the --continue resume branch and the engine-native
 *     jobs return ABOVE the call site, so they never wipe);
 *   - the REMOTE dispatch (the local MIRROR of a cluster run at dispatch
 *     time — synced-back products + stale logs — and the CLUSTER workdir
 *     itself, pre-submit, in remote-run.ts).
 *
 * Inputs are never at risk by construction: input files never live in
 * the workdir (absolute paths, project tree, _staged/ or in-place twins)
 * and symlinked doors are keep-set members.
 */

import { existsSync, readdirSync, rmSync, statSync } from "fs";
import path from "path";
import { classifyRerunWipe, type CleanupFileEntry } from "@/lib/hpc/cleanup";

/** Same walk budget as the cleanup route (display-scale trees). */
const WALK_MAX_ENTRIES = 20_000;
/** Same depth budget as the cleanup route / the SSH find. */
const WALK_MAX_DEPTH = 4;

/**
 * Walk a workdir into planner entries: real files with sizes, symlinks
 * listed as links (input-data doors — never followed, never wiped). The
 * cleanup route's walker dialect, verbatim, so both features see the
 * same tree.
 */
export function walkWorkdirFiles(workdir: string): CleanupFileEntry[] {
  const entries: CleanupFileEntry[] = [];
  const visit = (dir: string, rel: string, depth: number) => {
    if (depth > WALK_MAX_DEPTH || entries.length >= WALK_MAX_ENTRIES) return;
    let dirents;
    try {
      dirents = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    dirents.sort((a, b) => (a.name < b.name ? -1 : 1));
    for (const d of dirents) {
      if (entries.length >= WALK_MAX_ENTRIES) return;
      const childRel = rel ? `${rel}/${d.name}` : d.name;
      const childAbs = path.join(dir, d.name);
      if (d.isSymbolicLink()) {
        entries.push({ path: childRel, size: 0, link: true });
        continue;
      }
      if (d.isDirectory()) {
        visit(childAbs, childRel, depth + 1);
        continue;
      }
      if (!d.isFile()) continue;
      let size = 0;
      try {
        size = statSync(childAbs).size;
      } catch {
        continue; // vanished mid-walk — not a deletion candidate
      }
      entries.push({ path: childRel, size });
    }
  };
  visit(workdir, "", 0);
  return entries;
}

/**
 * Depth-first empty-dir prune (never the workdir root — the record, the
 * poll and the outputs walk still point at it). A dir holding a symlink
 * is NOT empty (readdirSync sees the link) — the input-data doors stay.
 * rmSync needs recursive:true even for an EMPTY directory (the t331
 * ERR_FS_EISDIR lesson).
 */
export function pruneWorkdirEmptyDirs(workdir: string): void {
  let roots: string[];
  try {
    roots = readdirSync(workdir).map((name) => path.join(workdir, name));
  } catch {
    return;
  }
  const tryPrune = (abs: string): boolean => {
    let names: string[];
    try {
      names = readdirSync(abs);
    } catch {
      return false;
    }
    for (const name of names) {
      const child = path.join(abs, name);
      try {
        if (statSync(child).isDirectory() && tryPrune(child)) {
          rmSync(child, { recursive: true, force: true });
        }
      } catch {
        /* vanished — nothing to prune */
      }
    }
    try {
      return readdirSync(abs).length === 0;
    } catch {
      return false;
    }
  };
  for (const abs of roots) {
    try {
      if (statSync(abs).isDirectory() && tryPrune(abs)) {
        rmSync(abs, { recursive: true, force: true });
      }
    } catch {
      /* best-effort prune */
    }
  }
}

export interface WipeOutcome {
  /** workdir-relative posix paths that were deleted. */
  wiped: string[];
  /** how many files survived (doors, the ledger, notes, unknowns). */
  keptCount: number;
}

/**
 * Wipe the PREVIOUS run's recognized products from a LOCAL workdir
 * (the engine lane's own workdir, or the local mirror of a cluster
 * run). Idempotent: an absent workdir answers null, an empty one wipes
 * nothing. A per-file rm failure is a skip (a vanished file is the
 * common case mid-walk), never a caller refusal — the pre-t333 behavior
 * is the degradation, and the run itself will surface anything real.
 *
 * t394 — opts.keepIterations rides the shared classifier: a re-run
 * carrying an explicit --continue whose target lives INSIDE this
 * workdir keeps the run_it###_* family (the state the continue resumes
 * from); everything else the classifier wipes still dies.
 */
export function wipeLocalRunProducts(
  workdir: string,
  opts: { keepIterations?: boolean } = {}
): WipeOutcome | null {
  if (!existsSync(workdir)) return null;
  const entries = walkWorkdirFiles(workdir);
  const { wipe, kept } = classifyRerunWipe(entries, opts);
  for (const rel of wipe) {
    const abs = path.join(workdir, rel.split("/").join(path.sep));
    try {
      const st = statSync(abs); // follows links — links are never wipe
      if (st.isDirectory()) continue; // members (the classifier keeps them)
      rmSync(abs, { force: true });
    } catch {
      /* vanished between walk and rm — a skip, not an error */
    }
  }
  if (wipe.length > 0) pruneWorkdirEmptyDirs(workdir);
  return { wiped: wipe, keptCount: kept.count };
}

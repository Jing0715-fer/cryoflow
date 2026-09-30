/**
 * The cleanup verb's EXECUTE face, lifted whole (t518) — t511's one-well
 * doctrine's fourth verse. The route's POST held the shovel and its
 * per-job lock; now the dialog's POST and the agent's cleanup verb are
 * two doors into the SAME shovel: this lib owns the execution and the
 * in-flight lock, so the shovel is per-job serial whatever door knocks
 * (two interleaved rm passes must never race — and the second caller's
 * verdict is the first's, whose re-plan saw the post-cleanup tree).
 *
 * Laws carried verbatim from the route:
 *   - The body NEVER carries a file list. The server re-walks/re-lists
 *     LIVE and deletes what the planner says (TOCTOU-safe: the preview
 *     and the deletion share one brain, but the deletion trusts only
 *     the tree).
 *   - The liveness guards run inside executeCleanup against the LIVE
 *     record — a job that went running between plan and POST is refused
 *     there (the caller maps it to 409), never silently cleaned.
 *   - A vanished file between walk and rm is a skip, not an error; a
 *     per-file failure rides the side's errors verbatim.
 */

import { readdirSync, rmSync, statSync } from "fs";
import path from "path";
import { classifyCleanup, type CleanupExecuteResult, type CleanupTierId } from "@/lib/hpc/cleanup";
import {
  deleteRemoteFiles,
  listRemoteWorkdir,
  pruneRemoteEmptyDirs,
  remoteWorkdirBytes,
  resolveConnectionForRecord,
  rewriteManifestAfterCleanup,
} from "@/lib/remote/remote-cleanup";
import {
  classifyContextFor,
  resolveCleanupJob,
  toRelSet,
  walkLocalRunFiles,
} from "@/lib/relion/cleanup-plan";

/** Depth-first empty-dir prune (never the workdir root — the record, the
 *  poll and the outputs walk still point at it). A dir holding a symlink
 *  is NOT empty (readdirSync sees the link) — the input-data doors stay.
 *  rmSync needs recursive:true even for an EMPTY directory (plain rm on a
 *  dir throws ERR_FS_EISDIR); the emptiness check above is the safety
 *  gate, the flag is just how Node removes directories at all. */
function pruneLocalEmptyDirs(workdir: string): void {
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

async function executeCleanup(
  jobId: string,
  scopes: { local: boolean; remote: boolean },
  tiers: CleanupTierId[]
): Promise<CleanupExecuteResult> {
  const resolved = await resolveCleanupJob(jobId);
  if (!resolved) return { ok: false, error: "Job not found" };
  const { record, runnable, reason } = resolved;
  if (!record?.workdir) {
    return { ok: false, error: "This job has not run yet — nothing to clean." };
  }
  if (!runnable) return { ok: false, error: reason ?? "the run is still live" };

  const tierSet = new Set<CleanupTierId>(tiers);
  const wanted = (groups: Array<{ tier: CleanupTierId; paths?: string[] }>) =>
    groups.filter((g) => tierSet.has(g.tier));

  // ---- local side (re-walk LIVE — the plan is a preview, not a mandate) -
  let localSide: CleanupExecuteResult["local"];
  if (scopes.local) {
    const { entries } = walkLocalRunFiles(record.workdir);
    const { groups } = classifyCleanup(entries, classifyContextFor(record), { fullPaths: true });
    let deleted = 0;
    let freedBytes = 0;
    const errors: string[] = [];
    for (const g of wanted(groups)) {
      for (const rel of g.paths ?? []) {
        const abs = path.join(record.workdir, rel.split("/").join(path.sep));
        try {
          const st = statSync(abs); // follows links — but links are never
          if (st.isDirectory()) continue; // tier members (the planner keeps them)
          rmSync(abs, { force: true });
          deleted++;
          freedBytes += st.size;
        } catch {
          /* vanished between walk and rm — a skip, not an error */
        }
      }
    }
    if (deleted > 0) pruneLocalEmptyDirs(record.workdir);
    localSide = { deleted, freedBytes, errors };
  }

  // ---- remote side (re-list LIVE, bypass the cache) --------------------
  let remoteSide: CleanupExecuteResult["remote"] = null;
  if (scopes.remote && record.remote) {
    const conn = resolveConnectionForRecord(record);
    if (!conn) {
      remoteSide = {
        deleted: 0,
        freedBytes: 0,
        errors: [
          `The connection (${record.remote.connectionName ?? record.remote.connectionId}) is gone and no same-host connection exists — reconnect the cluster to clean it.`,
        ],
        manifestRewritten: false,
      };
    } else {
      const workdir = record.remote.remoteWorkdir;
      // t341 — publish:false: this re-list photographs the workdir right
      // before the DELETEs below mutate it; caching the snapshot would
      // mute the next plan GET for a whole TTL (the review's cache-
      // pollution finding)
      const listing = await listRemoteWorkdir(conn, workdir, { bypassCache: true, publish: false });
      if (!listing.ok) {
        remoteSide = {
          deleted: 0,
          freedBytes: 0,
          errors: [listing.error ?? "the cluster listing failed"],
          manifestRewritten: false,
        };
      } else {
        const before =
          listing.totalBytes > 0 ? listing.totalBytes : ((await remoteWorkdirBytes(conn, workdir)) ?? 0);
        const twins = toRelSet(
          Object.values(record.remote.remoteOutputs ?? {}),
          workdir
        );
        const { groups } = classifyCleanup(
          listing.entries,
          { ...classifyContextFor(record), twinsRel: twins },
          { fullPaths: true }
        );
        const planned = wanted(groups).flatMap((g) => g.paths ?? []);
        let deleted = 0;
        let freedBytes = 0;
        let manifestRewritten = false;
        const errors: string[] = [];
        if (planned.length > 0) {
          // t344 — the same budget the dispatch wipe rides: a slow rm on a
          // loaded login node is not a broken one (the field report timed
          // out at 30s while the listing had just answered), so the
          // interactive cleanup waits out 2 minutes per batch and retries
          // once on a fresh connection before reporting the failure
          const rm = await deleteRemoteFiles(conn, workdir, planned, {
            timeoutMs: 120_000,
            retries: 1,
          });
          deleted = rm.deleted;
          errors.push(...rm.errors);
          if (rm.deleted > 0) {
            const after = (await remoteWorkdirBytes(conn, workdir)) ?? 0;
            freedBytes = Math.max(0, before - after);
            await pruneRemoteEmptyDirs(conn, workdir);
            manifestRewritten = rewriteManifestAfterCleanup(record.workdir, planned);
          }
        }
        remoteSide = { deleted, freedBytes, errors, manifestRewritten };
      }
    }
  }

  return { ok: true, ...(localSide ? { local: localSide } : {}), ...(remoteSide ? { remote: remoteSide } : {}) };
}

/* ------------------------------------------------------------------ */
/* The shared per-job lock — two doors, one shovel                      */
/* ------------------------------------------------------------------ */

/** One cleanup at a time per job: the second concurrent caller AWAITS
 *  the first's verdict (the route used to map a failed shared verdict
 *  to 409 and a successful one to 200 — callers keep that mapping; the
 *  lock itself is lib-level so the dialog's POST and the agent's verb
 *  can never interleave). */
const inFlight = new Map<string, Promise<CleanupExecuteResult>>();

export function runCleanupExclusive(
  jobId: string,
  scopes: { local: boolean; remote: boolean },
  tiers: CleanupTierId[]
): Promise<CleanupExecuteResult> {
  const running = inFlight.get(jobId);
  if (running) return running;
  const task = executeCleanup(jobId, scopes, tiers);
  inFlight.set(jobId, task);
  task.finally(() => {
    inFlight.delete(jobId);
  }).catch(() => {
    /* the caller owns the verdict; this chain only retires the lock */
  });
  return task;
}

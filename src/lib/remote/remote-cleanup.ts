/**
 * CryoFlow — remote cleanup legs (SERVER ONLY).
 *
 * t331 — the cluster half of 「清理中间过程文件」: one SSH round to LIST
 * the run's cluster workdir (sizes + types, the find -printf dialect the
 * browser already speaks), the pure hpc/cleanup classifier to tier it,
 * batched `rm -f --` to execute, and the manifest rewrite that keeps the
 * Files tab honest afterward (the t289 doctrine: the ledger is what the
 * UI shows — a cleanup that leaves a stale ledger lies by omission).
 *
 * Cluster identity is the t325 doctrine: (connectionId, host). A record
 * whose connection was deleted resolves through a same-host re-creation
 * before anyone calls the run unreachable — cleanup follows the wire, not
 * the id.
 *
 * Honesty contract (the usage route's own dialect, t327): a cluster that
 * cannot answer is NOT an error for the whole plan — the local side still
 * cleans, the remote side says exactly what failed. Destructive actions
 * never ride a cached listing: the POST re-lists live (TOCTOU guard — the
 * server owns the file list, the client only owns the choice of tiers).
 */

import type { RemoteConnection } from "./types";
import { getConnection, loadConnections } from "./connections";
import { exec, loginShellScript, shSingleQuote } from "./ssh";
import { normalizeClusterHost } from "@/lib/relion/engine";
import type { RunRecord } from "@/lib/relion/engine";
import type { CleanupFileEntry } from "@/lib/hpc/cleanup";
import { readRemoteManifest, writeRemoteManifest } from "./remote-files";

/* ------------------------------------------------------------------ */
/* Connection resolution (t325 drift-aware)                             */
/* ------------------------------------------------------------------ */

/**
 * The connection a record's CLUSTER workdir answers through today:
 * the recorded id first, then a same-host re-creation (case / trailing
 * FQDN dot normalized; an alias still fails closed — same semantics as
 * sameClusterTarget, which is engine-side and fs-bound, so this mirror
 * lives here for the cleanup legs).
 */
export function resolveConnectionForRecord(rec: RunRecord): RemoteConnection | null {
  if (!rec.remote) return null;
  const byId = getConnection(rec.remote.connectionId);
  if (byId) return byId;
  const wanted = normalizeClusterHost(rec.remote.host);
  if (!wanted) return null;
  return (
    loadConnections().find(
      (c) => normalizeClusterHost(`${c.host}:${c.port}`) === wanted
    ) ?? null
  );
}

/* ------------------------------------------------------------------ */
/* Listing — one SSH find, the t300 dialect                             */
/* ------------------------------------------------------------------ */

/** How long a plan's listing stays fresh: the dialog re-opening (and the
 * 30s auto-refresh family) must not re-dial the login node; the POST and
 * the manual refresh button bypass (destructive truth is LIVE truth). */
const LIST_TTL_MS = 10_000;

interface CacheEntry {
  at: number;
  value: RemoteListing;
}

const listCache = new Map<string, CacheEntry>();

export interface RemoteListing {
  ok: boolean;
  entries: CleanupFileEntry[];
  /** cluster-side byte total of the workdir's FILES (before any cleanup) */
  totalBytes: number;
  error?: string;
}

/**
 * List every file + symlink under the cluster workdir (depth ≤ 4), with
 * sizes — `find -printf '%y|%s|%P\n'` (type|size|path-relative), the same
 * line protocol the import browser rides (t300). A workdir that cannot be
 * entered is exit 3 — an honest "unreachable", never an empty success (a
 * permissions failure is not "zero files to clean", the t324-a lesson).
 */
export async function listRemoteWorkdir(
  conn: RemoteConnection,
  workdir: string,
  opts: { maxEntries?: number; bypassCache?: boolean; publish?: boolean } = {}
): Promise<RemoteListing> {
  const cacheKey = `${conn.id}|${workdir}`;
  if (!opts.bypassCache) {
    const hit = listCache.get(cacheKey);
    if (hit && Date.now() - hit.at < LIST_TTL_MS) return hit.value;
  }
  const maxEntries = Math.max(200, Math.min(50_000, opts.maxEntries ?? 20_000));
  const q = shSingleQuote(workdir);
  // total bytes rides the same pass (awk END marker, t311's "the count is
  // the cluster's own" doctrine — no second find over the same tree)
  const script = [
    `if ! test -d ${q}; then echo __CF_NOTDIR__; exit 0; fi`,
    `find ${q} -mindepth 1 -maxdepth 4 \\( -type f -o -type l \\) -printf '%y|%s|%P\\n' 2>/dev/null | awk -v cap=${maxEntries} 'NR<=cap {print; s+=$2} END {print "__CF_TOTAL__" s}'`,
    `if ! find -L / -maxdepth 0 -printf 'd|0|/\\n' 2>/dev/null | head -1 | grep -q '^d|'; then echo __CF_NO_PRINTF__; fi`,
    `exit 0`,
  ].join("\n");
  let result: RemoteListing;
  try {
    const r = await exec(conn, loginShellScript(script), { timeoutMs: 25_000 });
    if (r.error) {
      result = { ok: false, entries: [], totalBytes: 0, error: `SSH to ${conn.host} failed (${r.error})` };
    } else {
      const out = r.stdout ?? "";
      if (out.includes("__CF_NOTDIR__")) {
        // the workdir is genuinely gone — that IS an answer (an empty,
        // successful one: nothing to clean there)
        result = { ok: true, entries: [], totalBytes: 0 };
      } else if (out.includes("__CF_NO_PRINTF__")) {
        result = {
          ok: false,
          entries: [],
          totalBytes: 0,
          error: `${conn.host}'s find lacks -printf (BSD findutils?) — cluster cleanup needs GNU find`,
        };
      } else {
        const entries: CleanupFileEntry[] = [];
        let totalBytes = 0;
        let truncated = false;
        for (const raw of out.split("\n")) {
          const line = raw.replace(/\r$/, "");
          if (!line) continue;
          const m = /^__CF_TOTAL__(\d+)$/.exec(line);
          if (m) {
            totalBytes = Number(m[1]) || 0;
            continue;
          }
          const s1 = line.indexOf("|");
          if (s1 < 0) continue;
          const s2 = line.indexOf("|", s1 + 1);
          if (s2 < 0) continue;
          const y = line.slice(0, s1);
          if (y !== "f" && y !== "l") continue;
          const size = Number(line.slice(s1 + 1, s2)) || 0;
          const rel = line.slice(s2 + 1);
          if (!rel || rel.split("/").includes("..")) continue;
          if (entries.length >= maxEntries) {
            truncated = true;
            break;
          }
          entries.push(y === "l" ? { path: rel, size: 0, link: true } : { path: rel, size });
        }
        result = {
          ok: true,
          entries,
          totalBytes,
          ...(truncated ? { error: `listing capped at ${maxEntries} files — counts below the cap are partial` } : {}),
        };
      }
    }
  } catch (e) {
    result = {
      ok: false,
      entries: [],
      totalBytes: 0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
  if (opts.publish === false) {
    // t341 — a bypassing caller reading at a MUTATION point (the
    // dispatch's pre-wipe listing, the POST execution re-list) must not
    // publish its snapshot into the shared cache: the tree is about to
    // change under it, and a TTL-fresh-but-stale entry would answer the
    // next plan GET with a world that no longer exists (the review's
    // "plan is empty for 10s" finding — a fresh dispatch's listing
    // used to mute the plan for a whole TTL). Drop the entry instead:
    // the next normal read re-dials live. The manual refresh button
    // (GET ?refresh=1) still publishes — refresh means "everyone sees
    // fresh", not "the mutator's snapshot".
    listCache.delete(cacheKey);
  } else {
    listCache.set(cacheKey, { at: Date.now(), value: result });
  }
  return result;
}

/**
 * t333 — drop a workdir's cached listing (the dispatch's pre-run wipe
 * re-lists with bypassCache and then DELETES files; the cache entry it
 * just wrote now describes a pre-wipe tree, and a cleanup plan read
 * within the TTL would offer files that are gone). The next listRemoteWorkdir
 * re-dials live.
 */
export function dropRemoteListingCache(connId: string, workdir: string): void {
  listCache.delete(`${connId}|${workdir}`);
}

/* ------------------------------------------------------------------ */
/* Execution                                                            */
/* ------------------------------------------------------------------ */

/** rm batching: argv sanity per exec (long picks never exceed the login
 * shell's arg space; 200 quoted paths ≈ tens of KB — comfortably inside). */
const RM_BATCH = 200;

/**
 * Delete workdir-RELATIVE paths on the cluster. Batched `rm -f --`
 * (single-quoted, `--` guarded); a vanished file is a skip, not an error
 * (rm -f's own semantics). Returns per-batch failures verbatim.
 */
export async function deleteRemoteFiles(
  conn: RemoteConnection,
  workdir: string,
  relPaths: string[]
): Promise<{ deleted: number; errors: string[] }> {
  const errors: string[] = [];
  let deleted = 0;
  for (let base = 0; base < relPaths.length; base += RM_BATCH) {
    const batch = relPaths.slice(base, base + RM_BATCH);
    const script = [
      `cd ${shSingleQuote(workdir)} 2>/dev/null || exit 3`,
      `rm -f -- ${batch.map((p) => shSingleQuote(p)).join(" ")}`,
    ].join("\n");
    try {
      const r = await exec(conn, loginShellScript(script), { timeoutMs: 30_000 });
      if (r.error) {
        errors.push(`batch ${base / RM_BATCH + 1}: SSH failed (${r.error})`);
      } else if (r.code === 3) {
        errors.push(`batch ${base / RM_BATCH + 1}: workdir unreachable on ${conn.host}`);
        break;
      } else if (r.code !== 0) {
        const line = (r.stderr || "").split("\n").map((l) => l.trim()).find(Boolean);
        errors.push(`batch ${base / RM_BATCH + 1}: ${line ?? `rm exited ${r.code}`}`);
      } else {
        deleted += batch.length;
      }
    } catch (e) {
      errors.push(`batch ${base / RM_BATCH + 1}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { deleted, errors };
}

/** Cluster-side byte total of the workdir's files (the before/after
 *  accounting's both ends — freed = before − after, honest by
 *  construction: it counts what the CLUSTER says, not what we planned). */
export async function remoteWorkdirBytes(
  conn: RemoteConnection,
  workdir: string
): Promise<number | null> {
  const q = shSingleQuote(workdir);
  const r = await exec(
    conn,
    loginShellScript(
      `test -d ${q} || { echo -1; exit 0; }\nfind ${q} -type f -printf '%s\\n' 2>/dev/null | awk '{s+=$1} END {print s+0}'`
    ),
    { timeoutMs: 25_000 }
  );
  if (r.error || r.code !== 0) return null;
  const n = Number((r.stdout ?? "").trim().split("\n").pop());
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Prune directories the deletions left empty (never the workdir root —
 *  the record + the poll still point at it). */
export async function pruneRemoteEmptyDirs(
  conn: RemoteConnection,
  workdir: string
): Promise<boolean> {
  const q = shSingleQuote(workdir);
  const r = await exec(
    conn,
    loginShellScript(`find ${q} -mindepth 1 -maxdepth 4 -type d -empty -delete 2>/dev/null; exit 0`),
    { timeoutMs: 25_000 }
  );
  return !r.error;
}

/**
 * The ledger stays honest (t289): after a cluster cleanup, every deleted
 * relative path leaves the LOCAL manifest — the Files tab lists what the
 * cluster HOLDS, not what it held. The rewrite is best-effort bookkeeping
 * (a manifest failure never fails a cleanup that already freed bytes),
 * and its verdict is reported so the route can say it happened.
 */
export function rewriteManifestAfterCleanup(
  workdir: string,
  deletedRel: string[]
): boolean {
  const manifest = readRemoteManifest(workdir);
  if (!manifest) return false;
  const gone = new Set(deletedRel);
  const kept = manifest.files.filter((f) => !gone.has(f.path));
  if (kept.length === manifest.files.length) return false;
  writeRemoteManifest(workdir, {
    connectionId: manifest.connectionId,
    remoteWorkdir: manifest.remoteWorkdir,
    writtenAt: new Date().toISOString(),
    files: kept,
  });
  return true;
}

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
import { dropConnection, exec, loginShellScript, shSingleQuote } from "./ssh";
import { normalizeClusterHost } from "@/lib/relion/engine";
import type { RunRecord } from "@/lib/relion/engine";
import type { CleanupFileEntry } from "@/lib/hpc/cleanup";
import { RUN_ARCHIVE_DIRNAME } from "@/lib/hpc/cleanup";
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

export interface DeleteRemoteFilesOpts {
  /** Per-batch SSH budget. Callers keep their own pace: the interactive
   * cleanup dialog inherits the historic 30s default; the dispatch's
   * pre-run wipe passes a far longer one (t344) — a loaded login node
   * unlinking hundreds of stacks on network storage is a legitimately SLOW
   * rm, not a broken one (the field report: "batch 1: SSH failed (timeout
   * after 30000ms)" while the listing one round earlier had answered
   * inside 25s — the wire was fine, the deletion was just not instant). */
  timeoutMs?: number;
  /** Extra attempts per batch when the WIRE itself fails (timeout, a
   * channel that died mid-command, a wedged pooled connection). `rm -f`
   * is idempotent — a re-run on a fresh connection re-deletes nothing
   * that is already gone. rm's OWN exit codes are never retried: a real
   * filesystem complaint (permissions, arg limits) does not heal with a
   * redial. */
  retries?: number;
}

/**
 * Delete workdir-RELATIVE paths on the cluster. Batched `rm -f --`
 * (single-quoted, `--` guarded); a vanished file is a skip, not an error
 * (rm -f's own semantics). Returns per-batch failures verbatim.
 *
 * t344 — the retry ladder: an SSH-level failure gets `retries` more
 * attempts, each on a FRESH wire (dropConnection → the next exec re-dials):
 * a half-dead pooled TCP connection is the field shape after a GPU storm
 * buries the login node, and the first thing a fresh SSH session fixes is
 * exactly that. Exit 3 (workdir gone) ends the whole pass — nothing is
 * left to delete. When a batch exhausts its wire attempts the REMAINING
 * batches are not attempted: a wire that cannot carry one rm cannot carry
 * the next, and one honest refusal now beats ten serial three-minute
 * timeouts (the old loop ground through every batch's 30s individually;
 * with a 180s budget that grind becomes an hour).
 */
export async function deleteRemoteFiles(
  conn: RemoteConnection,
  workdir: string,
  relPaths: string[],
  opts: DeleteRemoteFilesOpts = {}
): Promise<{ deleted: number; errors: string[] }> {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const retries = Math.max(0, Math.min(3, opts.retries ?? 0));
  const errors: string[] = [];
  let deleted = 0;
  for (let base = 0; base < relPaths.length; base += RM_BATCH) {
    const batchNo = base / RM_BATCH + 1;
    const batch = relPaths.slice(base, base + RM_BATCH);
    const script = [
      `cd ${shSingleQuote(workdir)} 2>/dev/null || exit 3`,
      `rm -f -- ${batch.map((p) => shSingleQuote(p)).join(" ")}`,
    ].join("\n");
    let wireError: string | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) {
        // fresh wire first: the timeout/channel death usually means the
        // POOLED connection is half-gone — re-dial before re-running, or
        // the retry queues behind the same dead socket and dies identically
        dropConnection(conn.id);
        await new Promise((r) => setTimeout(r, 400));
      }
      try {
        const r = await exec(conn, loginShellScript(script), { timeoutMs });
        if (r.error) {
          wireError = `SSH failed (${r.error})`;
          continue; // the wire's own word — try again on a fresh connection
        }
        if (r.code === 3) {
          errors.push(`batch ${batchNo}: workdir unreachable on ${conn.host}`);
          return { deleted, errors }; // the workdir is GONE — nothing left to delete
        }
        if (r.code !== 0) {
          const line = (r.stderr || "").split("\n").map((l) => l.trim()).find(Boolean);
          errors.push(`batch ${batchNo}: ${line ?? `rm exited ${r.code}`}`);
          wireError = null; // rm's own word — recorded once, never retried
          break;
        }
        deleted += batch.length;
        wireError = null;
        break;
      } catch (e) {
        wireError = e instanceof Error ? e.message : String(e);
        continue;
      }
    }
    if (wireError != null) {
      errors.push(
        `batch ${batchNo}: ${wireError}` +
          (retries > 0 ? ` — after ${retries + 1} attempt(s), the last on a fresh connection` : "")
      );
      // the wire is not answering: do not grind the remaining batches
      // through the same dead socket — refuse with the count named
      const skipped = Math.ceil((relPaths.length - base - batch.length) / RM_BATCH);
      if (skipped > 0) {
        errors.push(
          `the remaining ${skipped} batch(es) were not attempted (the connection is not answering)`
        );
      }
      break;
    }
  }
  return { deleted, errors };
}

/* ------------------------------------------------------------------ */
/* The re-run stash — rename-aside, not unlink (t385)                  */
/* ------------------------------------------------------------------ */

/**
 * t385 — the dispatch wipe's new mechanism, after the field killed the
 * old one twice: "batch 1: SSH failed (timeout after 180000ms) — after 2
 * attempt(s), the last on a fresh connection)". A synchronous batched
 * `rm -f` puts an UNLINK STORM on the dispatch's critical path — NFS
 * REMOVE is a synchronous RPC per file, and a loaded login node can
 * take >1s per op; hundreds of stale products (a class2d's 50 iterations
 * × five files, an extraction's thousand+ stacks — plus, before t385,
 * the t370 archive itself being re-caught by the next listing: the slow
 * death compounded with every re-run) blow ANY per-batch budget. The
 * timed-out attempts leave zombie login shells still grinding the same
 * directory server-side, and the fresh-wire retry races them.
 *
 * The doctrine survives ("a fresh start is a fresh directory" — RELION
 * writes into whatever sits at its output paths), but the MECHANISM
 * changes: the stale products don't have to DIE before the submit, they
 * only have to be OUT OF THE WAY. `mv` inside the one filesystem is a
 * rename — a metadata op, ~1000x cheaper than an unlink storm — so the
 * wipe moves the previous generation into
 *   <workdir>/.cryoflow_prev/<epoch-ms>/
 * (the t370 hygiene's own archive — root-level iteration globs never see
 * into it, and the classifier keeps the tree out of every future wipe
 * set), verifies with a shell-builtin survivor loop that NOTHING of the
 * wipe set still sits at a live position, and refuses the dispatch only
 * when that is true. The bytes themselves are reclaimed by a DETACHED
 * background rm (reclaimRemoteArchiveGens) — never on the dispatch's
 * path, never a refusal.
 *
 * The extract shape's thousand files under extra/ ride ONE whole-tree
 * rename (one RPC) instead of a thousand — but only after the cluster's
 * own find COUNT matches the listing's count under that tree (an
 * unlisted entry — deeper than the listing's depth, past its cap, an
 * empty subdir — demotes the tree to per-file moves: the "unknown =
 * keep" contract is never stretched to cover what the listing never
 * saw). Root-level files (the class2d shape) move per-file — a rename
 * each, still metadata-only.
 */

/** Move-units per script: with quoted paths ≈ tens of KB, comfortably
 * inside the login shell's arg space (and the bash -lc single argument
 * that carries the script). */
const STASH_BATCH = 180;

/** Top-level segments of the wipe paths that hold NO kept entry (per
 * the same listing) — candidates for the one-rename whole-tree move.
 * PURE. */
export function wholeTreeCandidates(
  relPaths: string[],
  allEntries: CleanupFileEntry[]
): string[] {
  const wipeSet = new Set(relPaths);
  const keptSegs = new Set<string>();
  for (const e of allEntries) {
    if (wipeSet.has(e.path)) continue;
    const i = e.path.indexOf("/");
    if (i > 0) keptSegs.add(e.path.slice(0, i));
  }
  const segs: string[] = [];
  for (const p of relPaths) {
    const i = p.indexOf("/");
    if (i <= 0) continue; // a root-level file moves per-file
    const seg = p.slice(0, i);
    if (!keptSegs.has(seg) && !segs.includes(seg)) segs.push(seg);
  }
  return segs;
}

export interface StashPlan {
  /** top-level subtrees to move WHOLE (segment names — one rename each). */
  wholeTrees: string[];
  /** file paths to move individually (root-level + demoted segments). */
  files: string[];
  /** candidates the count round demoted to per-file (diagnostics). */
  demotedTrees: string[];
}

/**
 * Split the wipe set into whole-trees + per-file moves. PURE — the
 * cluster's own find counts are injected, so the bench can play every
 * verdict (match / mismatch / count round dead).
 */
export function planStashUnits(
  relPaths: string[],
  allEntries: CleanupFileEntry[],
  findCounts: Map<string, number> | null
): StashPlan {
  const cand = new Set(wholeTreeCandidates(relPaths, allEntries));
  const segCounts = new Map<string, number>();
  for (const p of relPaths) {
    const i = p.indexOf("/");
    if (i <= 0) continue;
    const seg = p.slice(0, i);
    segCounts.set(seg, (segCounts.get(seg) ?? 0) + 1);
  }
  const wholeTrees: string[] = [];
  const files: string[] = [];
  const demoted: string[] = [];
  for (const p of relPaths) {
    const i = p.indexOf("/");
    if (i <= 0) {
      files.push(p);
      continue;
    }
    const seg = p.slice(0, i);
    if (cand.has(seg)) {
      // the whole-tree ride is EARNED: the cluster counted exactly what
      // the listing saw under this segment — no unlisted entry (a deeper
      // unknown, a past-cap file, an empty subdir) travels inside the
      // moved tree. No count round (the wire refused) → per-file, always.
      const live = findCounts?.get(seg);
      if (live != null && live === segCounts.get(seg)) {
        if (!wholeTrees.includes(seg)) wholeTrees.push(seg);
        continue;
      }
      if (live != null && !demoted.includes(seg)) demoted.push(seg);
    }
    files.push(p);
  }
  return { wholeTrees, files, demotedTrees: demoted };
}

/** Parse the count round's `<seg> <n>` lines (a segment may hold spaces —
 * the number is the LAST field). MISSING means the tree vanished since
 * the listing — its paths then die as per-file no-ops (mv diagnoses,
 * the survivor loop confirms absent). Exported for the bench (the t385
 * doctrine: the bench plays the login node against the exact bytes). */
export function parseTreeCounts(stdout: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const raw of stdout.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.endsWith(" MISSING")) continue;
    const sp = line.lastIndexOf(" ");
    if (sp <= 0) continue;
    const n = Number(line.slice(sp + 1));
    if (!Number.isInteger(n) || n < 0) continue;
    out.set(line.slice(0, sp), n);
  }
  return out;
}

export interface StashRemoteRunProductsOpts {
  /** Per-round SSH budget. The rounds are rename-only — fast even on a
   * loaded head — so this guards a truly wedged login node, not a
   * legitimate deletion pace (the t344 problem is structurally gone). */
  timeoutMs?: number;
  /** Fresh-wire retries per round (SSH-level deaths only — a rename
   * batch is idempotent: a unit already moved is absent, mv diagnoses
   * it, and the survivor loop still speaks the truth). */
  retries?: number;
}

export interface StashOutcome {
  /** file units that moved off their live positions. */
  movedFiles: number;
  /** top-level subtrees that moved whole (one rename each). */
  movedTrees: string[];
  /** wipe paths/trees STILL sitting at live positions after the move —
   * a non-empty list must refuse the dispatch (the t333 doctrine: a
   * re-run into stale outputs is the image.h:1534 crash). */
  survivors: string[];
  /** SSH-level failures, verbatim (already retried when retries > 0). */
  errors: string[];
  /** workdir-relative archive dir (null when nothing moved). */
  archiveDir: string | null;
}

/** The count round's script — one find per whole-tree candidate, the
 * cluster's own count of everything living under it (dirs included). */
export function treeCountScript(workdir: string, candidates: string[]): string {
  return [
    `cd ${shSingleQuote(workdir)} 2>/dev/null || exit 3`,
    `for d in ${candidates.map((c) => shSingleQuote(c)).join(" ")}; do`,
    `  if [ -d "$d" ]; then`,
    `    printf '%s %s\\n' "$d" "$(find "$d" -mindepth 1 2>/dev/null | wc -l | tr -d ' ')"`,
    `  else`,
    `    printf '%s MISSING\\n' "$d"`,
    `  fi`,
    `done`,
    `exit 0`,
  ].join("\n");
}

/** One move batch — the exact bytes the login node runs. One `mv`
 * process for N renames; a missing unit (an earlier attempt's, a
 * concurrent hand-clean) is a diagnostic, never a failure — the
 * shell-builtin survivor loop after it is the only verdict that
 * matters: nothing of this batch may still sit at a live position. */
export function stashBatchScript(workdir: string, archiveRel: string, units: string[]): string {
  return [
    `cd ${shSingleQuote(workdir)} 2>/dev/null || exit 3`,
    `A=${shSingleQuote(archiveRel)}`,
    `mkdir -p -- "$A"`,
    `set -- ${units.map((u) => shSingleQuote(u)).join(" ")}`,
    `mv -f -- "$@" "$A/"`,
    `s=0`,
    `for p in "$@"; do`,
    `  if [ -e "$p" ] || [ -L "$p" ]; then`,
    `    printf 'CF_STASH_SURVIVOR %s\\n' "$p"`,
    `    s=$((s+1))`,
    `  fi`,
    `done`,
    `printf 'CF_STASH_SURV %s\\n' "$s"`,
    `exit 0`,
  ].join("\n");
}

/**
 * Move the previous run's recognized products ASIDE (rename-only), by
 * the listing the caller just took. Every batch script is
 * idempotent-restartable and ends in a shell-builtin survivor loop whose
 * verdict is the ONLY truth that matters: nothing of the wipe set may
 * remain at a live position when the fresh sbatch lands.
 */
export async function stashRemoteRunProducts(
  conn: RemoteConnection,
  workdir: string,
  relPaths: string[],
  allEntries: CleanupFileEntry[],
  opts: StashRemoteRunProductsOpts = {}
): Promise<StashOutcome> {
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const retries = Math.max(0, Math.min(3, opts.retries ?? 0));
  const out: StashOutcome = {
    movedFiles: 0,
    movedTrees: [],
    survivors: [],
    errors: [],
    archiveDir: null,
  };
  if (relPaths.length === 0) return out;

  // ---- the count round: earn the whole-tree rides -------------------
  let counts: Map<string, number> | null = null;
  const candidates = wholeTreeCandidates(relPaths, allEntries);
  if (candidates.length > 0) {
    const countScript = treeCountScript(workdir, candidates);
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) {
        dropConnection(conn.id);
        await new Promise((r) => setTimeout(r, 400));
      }
      try {
        const r = await exec(conn, loginShellScript(countScript), { timeoutMs });
        if (!r.error && r.code === 0) {
          counts = parseTreeCounts(r.stdout ?? "");
          break;
        }
        if (!r.error) break; // an honest exit ≠ 0 — don't retry the verdict
        if (attempt === retries) {
          out.errors.push(`count round: SSH failed (${r.error})`);
        }
      } catch (e) {
        if (attempt === retries) {
          out.errors.push(`count round: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
    // counts === null → planStashUnits demotes everything to per-file —
    // slower but exactly as honest as the old rm batches
  }

  const plan = planStashUnits(relPaths, allEntries, counts);
  if (plan.wholeTrees.length === 0 && plan.files.length === 0) return out;

  const archiveRel = `${RUN_ARCHIVE_DIRNAME}/${Date.now()}`;
  out.archiveDir = archiveRel;
  const treeSet = new Set(plan.wholeTrees);
  // units: the trees ride as their segment name (one rename), the rest
  // as workdir-relative file paths
  const units: string[] = [...plan.wholeTrees, ...plan.files];

  for (let base = 0; base < units.length; base += STASH_BATCH) {
    const batch = units.slice(base, base + STASH_BATCH);
    const batchNo = Math.floor(base / STASH_BATCH) + 1;
    const script = stashBatchScript(workdir, archiveRel, batch);
    let wireError: string | null = null;
    let stdout = "";
    let stderr = "";
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) {
        // fresh wire first — the timeout usually means the pooled
        // connection is half-gone (the deleteRemoteFiles ladder's own
        // lesson); a rename batch re-runs cleanly: moved units are
        // already absent, the survivors speak for themselves
        dropConnection(conn.id);
        await new Promise((r) => setTimeout(r, 400));
      }
      try {
        const r = await exec(conn, loginShellScript(script), { timeoutMs });
        if (r.error) {
          wireError = `SSH failed (${r.error})`;
          continue; // the wire's own word — try again on a fresh connection
        }
        if (r.code === 3) {
          out.errors.push(`batch ${batchNo}: workdir unreachable on ${conn.host}`);
          out.survivors.push(...plan.files); // everything is still live there
          return out;
        }
        stdout = r.stdout ?? "";
        stderr = r.stderr ?? "";
        wireError = null;
        break;
      } catch (e) {
        wireError = e instanceof Error ? e.message : String(e);
        continue;
      }
    }
    if (wireError != null) {
      out.errors.push(
        `batch ${batchNo}: ${wireError}` +
          (retries > 0 ? ` — after ${retries + 1} attempt(s), the last on a fresh connection` : "")
      );
      // the wire is not answering: every unit from THIS batch on is
      // unproven, and unproven means STILL LIVE at its position — say
      // so in the survivors, refuse the dispatch, and never grind the
      // remaining batches through a dead socket
      out.survivors.push(...units.slice(base).filter((u) => !treeSet.has(u)));
      break;
    }
    // the survivor verdict — shell builtins, zero forks
    for (const line of stdout.split(/\r?\n/)) {
      const m = /^CF_STASH_SURVIVOR (.+)$/.exec(line);
      if (m) out.survivors.push(m[1]);
    }
    if (!/^CF_STASH_SURV \d+$/m.test(stdout)) {
      // no verdict line at all — the script died mid-flight (a channel
      // close, an OOM'd shell): every unit of this batch is unproven,
      // and unproven means STILL THERE (the t333 refusal doctrine)
      out.survivors.push(...batch.filter((u) => !treeSet.has(u)));
      out.errors.push(
        `batch ${batchNo}: no survivor verdict${stderr ? ` (mv said: ${stderr.split("\n").map((l) => l.trim()).find(Boolean) ?? "nothing"})` : ""}`
      );
      continue;
    }
    for (const u of batch) {
      if (treeSet.has(u)) {
        if (!out.survivors.includes(u)) out.movedTrees.push(u);
      } else if (!out.survivors.includes(u)) {
        out.movedFiles++;
      }
    }
  }
  return out;
}

/** The detached reaper's script — built here so the bench runs the
 * EXACT bytes the login node will (the t384 doctrine: the bench plays
 * the login node against real local files). */
export function reclaimScript(workdir: string, keep = 2): string {
  const inner = [
    `find ${shSingleQuote(RUN_ARCHIVE_DIRNAME)} -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\\n' 2>/dev/null`,
    `| sort -rn | tail -n +${keep + 1} | cut -d' ' -f2-`,
    `| while IFS= read -r g; do rm -rf -- "$g"; done`,
  ].join(" ");
  return [
    `cd ${shSingleQuote(workdir)} 2>/dev/null || exit 0`,
    `[ -d ${shSingleQuote(RUN_ARCHIVE_DIRNAME)} ] || exit 0`,
    // SIGHUP-proof (the channel closes the instant the dispatch moves
    // on), stdin fed from /dev/null, output buried — the reaper is fire
    // and forget BY DESIGN
    `nohup sh -c ${shSingleQuote(inner)} >/dev/null 2>&1 </dev/null &`,
    `echo CF_RECLAIM_BG`,
  ].join("\n");
}

/**
 * Reclaim OLD archive generations DETACHED — one nohup'd login-node
 * process, serial `rm -rf` over everything but the newest `keep`
 * generations (epoch-ms names, mtime-ordered — same thing). It never
 * blocks a dispatch and never refuses one: a dead reaper costs only
 * bytes until the next re-run spawns the next one. Needs GNU find's
 * -printf (already the listing dialect's own requirement); a find
 * without it no-ops silently — best-effort by contract.
 */
export async function reclaimRemoteArchiveGens(
  conn: RemoteConnection,
  workdir: string,
  keep = 2
): Promise<boolean> {
  try {
    const r = await exec(conn, loginShellScript(reclaimScript(workdir, keep)), { timeoutMs: 25_000 });
    return !r.error && (r.stdout ?? "").includes("CF_RECLAIM_BG");
  } catch {
    return false;
  }
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

import { NextRequest, NextResponse } from "next/server";
import { existsSync, readdirSync, rmSync, statSync } from "fs";
import path from "path";
import { db } from "@/lib/db";
import { findEffectiveJob } from "@/lib/link";
import {
  getRun,
  isRunAlive,
  REMOTE_OUTPUT_CANDIDATES,
  type RunRecord,
} from "@/lib/relion/engine";
import {
  classifyCleanup,
  type CleanupCandidates,
  type CleanupDownstream,
  type CleanupExecuteResult,
  type CleanupFileEntry,
  type CleanupPlan,
  type CleanupSidePlan,
  type CleanupTierId,
} from "@/lib/hpc/cleanup";
import {
  deleteRemoteFiles,
  listRemoteWorkdir,
  pruneRemoteEmptyDirs,
  remoteWorkdirBytes,
  resolveConnectionForRecord,
  rewriteManifestAfterCleanup,
} from "@/lib/remote/remote-cleanup";
import { isLocalRequest } from "@/lib/http-guard";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * t331 — intermediate-file cleanup, both sides of the wire
 * (「增加清理中间过程文件的功能，包括本地和cluster」).
 *
 *   GET  /api/jobs/[id]/cleanup   the PLAN (free preview, no deletion):
 *                                 a walked local listing + one SSH find of
 *                                 the cluster workdir, both classified by
 *                                 the SAME pure planner (hpc/cleanup) into
 *                                 tiers with honest consequences. The
 *                                 remote listing rides a 10s cache so the
 *                                 dialog re-opening never re-dials the
 *                                 login node; ?refresh=1 is the manual
 *                                 button's bypass.
 *   POST /api/jobs/[id]/cleanup   the EXECUTION. The body carries ONLY
 *                                 scopes + tiers — NEVER a file list. The
 *                                 server re-walks/re-lists LIVE and deletes
 *                                 what the planner says (TOCTOU-safe: the
 *                                 preview and the deletion share one brain,
 *                                 but the deletion trusts only the tree).
 *
 * Guards: cross-site 403 (the write door — a blind cross-site POST is
 * exactly the drive-by deletion this pin exists for), unknown job 404,
 * run-liveness 409 (a running job's iteration files are being written —
 * deleting them corrupts the run; the t318 ghost family taught the sweep
 * to respect a run's own artifacts, this route returns the same respect),
 * and the in-flight lock (two concurrent POSTs never interleave rm passes).
 */

const VALID_TIERS: CleanupTierId[] = ["safe", "diagnostics", "bulk"];
const WALK_MAX_ENTRIES = 20_000;

/* ------------------------------------------------------------------ */
/* Local walk                                                           */
/* ------------------------------------------------------------------ */

/**
 * Walk the run's LOCAL workdir into planner entries: real files with
 * sizes, symlinks listed as links (input-data doors — the planner keeps
 * them), symlinked DIRECTORIES not followed (loop safety, the outputs
 * walk's own rule — the import job's `micrographs` link is data, not a
 * tree to clean). Dotfiles included: the .cf-* scratch is exactly what
 * the safe tier exists for.
 */
function walkLocalRunFiles(workdir: string): {
  entries: CleanupFileEntry[];
  exists: boolean;
  truncated: boolean;
} {
  if (!existsSync(workdir)) return { entries: [], exists: false, truncated: false };
  const entries: CleanupFileEntry[] = [];
  let truncated = false;
  const visit = (dir: string, rel: string, depth: number) => {
    if (truncated || depth > 4) return;
    let dirents;
    try {
      dirents = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    dirents.sort((a, b) => (a.name < b.name ? -1 : 1));
    for (const d of dirents) {
      if (truncated) return;
      const childRel = rel ? `${rel}/${d.name}` : d.name;
      const childAbs = path.join(dir, d.name);
      if (d.isSymbolicLink()) {
        // a link is a door, not a file — listed, never followed, never
        // deleted (file links and dir links both ride this branch)
        entries.push({ path: childRel, size: 0, link: true });
        continue;
      }
      if (d.isDirectory()) {
        visit(childAbs, childRel, depth + 1);
        continue;
      }
      if (!d.isFile()) continue;
      if (entries.length >= WALK_MAX_ENTRIES) {
        truncated = true;
        return;
      }
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
  return { entries, exists: true, truncated };
}

/* ------------------------------------------------------------------ */
/* Shared helpers                                                       */
/* ------------------------------------------------------------------ */

interface ResolvedJob {
  job: { id: string; name: string; type: string; status: string };
  record: RunRecord | null;
  runnable: boolean;
  reason?: string;
}

async function resolveCleanupJob(id: string): Promise<ResolvedJob | null> {
  const job = await findEffectiveJob(id);
  if (!job) return null;
  const record = getRun(job.id) ?? null;
  const shell = {
    job: { id: job.id, name: job.name, type: job.type, status: job.status },
    record,
  };
  if (!record?.workdir) {
    return {
      ...shell,
      runnable: false,
      reason: "This job has not run yet — there is no run directory to clean.",
    };
  }
  let runnable = true;
  let reason: string | undefined;
  if (job.status === "running" || job.status === "pending") {
    runnable = false;
    reason =
      job.status === "running"
        ? "The job is running — its intermediate files are being written. Stop it first, then clean."
        : "The job is queued to run — clean it after it lands.";
  } else if (!record.done && isRunAlive(job.id)) {
    runnable = false;
    reason = "The run record is still live (a process owns these files) — clean it after it finishes.";
  }
  return { ...shell, runnable, reason };
}

/** record.outputs / remote twins → workdir-relative posix paths (values
 *  outside the workdir are not this walk's business — they never match a
 *  walked entry). */
function toRelSet(values: Array<string | undefined>, workdir: string): string[] {
  const out: string[] = [];
  for (const v of values) {
    if (!v) continue;
    const rel = path.relative(workdir, v).split(path.sep).join("/");
    if (rel && !rel.startsWith("..")) out.push(rel);
  }
  return out;
}

function classifyContextFor(record: RunRecord, extra: { twinsRel?: string[] } = {}) {
  return {
    type: record.type,
    outputsRel: toRelSet(Object.values(record.outputs ?? {}), record.workdir),
    ...(extra.twinsRel ? { twinsRel: extra.twinsRel } : {}),
    candidates: (REMOTE_OUTPUT_CANDIDATES[record.type] ?? []) as CleanupCandidates[],
  };
}

async function downstreamOf(jobId: string): Promise<CleanupDownstream[]> {
  const edges = await db.edge.findMany({ where: { fromJobId: jobId } });
  if (edges.length === 0) return [];
  const jobs = await db.job.findMany({
    where: { id: { in: edges.map((e) => e.toJobId) } },
  });
  return jobs.map((j) => ({ id: j.id, name: j.name, type: j.type, status: j.status }));
}

/* ------------------------------------------------------------------ */
/* GET — the plan                                                       */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    if (!isLocalRequest(request)) {
      return NextResponse.json({ error: "Cross-site access is not allowed" }, { status: 403 });
    }
    const { id } = await context.params;
    const resolved = await resolveCleanupJob(id);
    if (!resolved) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    const { job, record, runnable, reason } = resolved;

    const refresh = request.nextUrl.searchParams.get("refresh") === "1";

    // ---- local side ---------------------------------------------------
    let local: CleanupSidePlan;
    let remote: CleanupPlan["remote"] = null;
    if (!record?.workdir) {
      local = { exists: false, workdir: null, groups: [], kept: { count: 0, bytes: 0 } };
    } else {
      const { entries, exists, truncated } = walkLocalRunFiles(record.workdir);
      if (!exists) {
        local = {
          exists: false,
          workdir: record.workdir,
          groups: [],
          kept: { count: 0, bytes: 0 },
          note: "Run directory no longer exists on disk",
        };
      } else {
        const { groups, kept } = classifyCleanup(entries, classifyContextFor(record));
        local = {
          exists: true,
          workdir: record.workdir,
          groups,
          kept,
          ...(truncated
            ? { note: `listing capped at ${WALK_MAX_ENTRIES} files — counts are partial` }
            : {}),
        };
      }

      // ---- remote side (the cluster workdir, live) ----------------------
      if (record.remote) {
        const conn = resolveConnectionForRecord(record);
        const base = {
          known: true,
          workdir: record.remote.remoteWorkdir,
          connection: conn
            ? { id: conn.id, name: conn.name, host: conn.host, user: conn.username }
            : null,
        };
        if (!conn) {
          remote = {
            ...base,
            exists: false,
            groups: [],
            kept: { count: 0, bytes: 0 },
            error: `The connection (${record.remote.connectionName ?? record.remote.connectionId}) is gone and no same-host connection exists — reconnect the cluster to clean it.`,
          };
        } else {
          const listing = await listRemoteWorkdir(conn, record.remote.remoteWorkdir, {
            bypassCache: refresh,
          });
          if (!listing.ok) {
            remote = {
              ...base,
              exists: false,
              groups: [],
              kept: { count: 0, bytes: 0 },
              error: listing.error ?? "the cluster listing failed",
            };
          } else {
            const twins = toRelSet(
              Object.values(record.remote.remoteOutputs ?? {}),
              record.remote.remoteWorkdir
            );
            const { groups, kept } = classifyCleanup(listing.entries, {
              ...classifyContextFor(record),
              twinsRel: twins,
            });
            remote = {
              ...base,
              exists: true,
              groups,
              kept,
              ...(listing.error ? { note: listing.error } : {}),
            };
          }
        }
      }
    }

    const plan: CleanupPlan = {
      ok: true,
      runnable,
      ...(reason ? { reason } : {}),
      job,
      local,
      remote,
      downstream: await downstreamOf(job.id),
      checkedAt: new Date().toISOString(),
    };
    return NextResponse.json(plan);
  } catch (error) {
    console.error("GET /api/jobs/[id]/cleanup failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/* ------------------------------------------------------------------ */
/* POST — the execution                                                 */
/* ------------------------------------------------------------------ */

/** One cleanup at a time per job: the second concurrent POST awaits the
 *  first's verdict (two interleaved rm passes must never race — and the
 *  second's re-plan sees the post-cleanup tree, so its answer is honest). */
const inFlight = new Map<string, Promise<CleanupExecuteResult>>();

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

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    if (!isLocalRequest(request)) {
      return NextResponse.json(
        { error: "Cross-site job actions are not allowed" },
        { status: 403 }
      );
    }
    const { id } = await context.params;
    let body: { local?: boolean; remote?: boolean; tiers?: string[] };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const scopes = { local: body.local === true, remote: body.remote === true };
    const tiers = (Array.isArray(body.tiers) ? body.tiers : []).filter(
      (t): t is CleanupTierId => (VALID_TIERS as string[]).includes(t)
    );
    if (!scopes.local && !scopes.remote) {
      return NextResponse.json(
        { error: "Nothing selected — choose at least one side (local or cluster)" },
        { status: 400 }
      );
    }
    if (tiers.length === 0) {
      return NextResponse.json(
        { error: "No tiers selected — pick what to clean" },
        { status: 400 }
      );
    }

    // the liveness guards run inside executeCleanup against the LIVE
    // record — a job that went running between plan and POST is refused
    // there (409 below), never silently cleaned
    const running = inFlight.get(id);
    if (running) {
      const shared = await running;
      return shared.ok
        ? NextResponse.json(shared)
        : NextResponse.json({ error: shared.error }, { status: 409 });
    }

    const task = executeCleanup(id, scopes, tiers);
    inFlight.set(id, task);
    try {
      const result = await task;
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 409 });
      }
      return NextResponse.json(result);
    } finally {
      inFlight.delete(id);
    }
  } catch (error) {
    console.error("POST /api/jobs/[id]/cleanup failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

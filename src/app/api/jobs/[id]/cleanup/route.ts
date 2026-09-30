import { NextRequest, NextResponse } from "next/server";
import { readdirSync, rmSync, statSync } from "fs";
import path from "path";
import {
  classifyCleanup,
  type CleanupExecuteResult,
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
import {
  classifyContextFor,
  computeCleanupPlan,
  resolveCleanupJob,
  toRelSet,
  walkLocalRunFiles,
} from "@/lib/relion/cleanup-plan";
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
 *                                 t517 — the assembly lives in the well
 *                                 (lib/relion/cleanup-plan, one-well
 *                                 doctrine's third verse): the route is
 *                                 the plan face's protocol shell (403 /
 *                                 404 / 500 + the refresh flag), and the
 *                                 agent's get_cleanup_plan drinks the
 *                                 same cup.
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

/* ------------------------------------------------------------------ */
/* GET — the plan (the route is the protocol shell only, t517)          */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    if (!isLocalRequest(request)) {
      return NextResponse.json({ error: "Cross-site access is not allowed" }, { status: 403 });
    }
    const { id } = await context.params;
    const refresh = request.nextUrl.searchParams.get("refresh") === "1";
    const plan = await computeCleanupPlan(id, { refresh });
    if (!plan) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
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

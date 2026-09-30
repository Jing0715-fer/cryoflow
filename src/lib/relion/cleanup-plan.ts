/**
 * The cleanup verb's own brain, lifted whole (t517) — t511's one-well
 * doctrine's third verse. The per-job cleanup route (t331) is TWO faces
 * of one verb: a GET that previews the plan and a POST that executes it,
 * TOCTOU-safe because both share one brain (the live re-walk, never the
 * payload). This lib is that brain: the run's resolution + liveness
 * verdict, the local walk, the classifier context, the downstream
 * census, and the plan assembly — verbatim from the route's GET body —
 * so the dialog (route), the cleanup dialog's own guards (the POST's
 * executeCleanup) and the agent's read face (get_cleanup_plan) all
 * drink from the same cup. The write face stays in the route: deletion
 * keeps its cross-site door, its in-flight lock and its liveness 409 —
 * this well only ever READS.
 *
 * Laws carried verbatim from the route:
 *   - A run that is alive (running / pending / a live run record) is
 *     not runnable: the plan still answers (the dialog shows the
 *     reason), the POST refuses (409). Iteration files being written
 *     are exactly what the tiers must never see mid-flight.
 *   - The walk lists symlinks as links and never follows them (input-
 *     data doors are data, not trees), includes dotfiles (the .cf-*
 *     scratch is the safe tier's stock in trade), and caps at
 *     WALK_MAX_ENTRIES with an honest note.
 *   - A remote side that cannot be reached is an honest degradation on
 *     THAT side alone (its error rides the plan; the other side still
 *     speaks) — never a thrown failure for the whole plan.
 */

import { existsSync, readdirSync, statSync } from "fs";
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
  type CleanupFileEntry,
  type CleanupPlan,
  type CleanupSidePlan,
} from "@/lib/hpc/cleanup";
import { listRemoteWorkdir, resolveConnectionForRecord } from "@/lib/remote/remote-cleanup";

const WALK_MAX_ENTRIES = 20_000;

/**
 * Walk the run's LOCAL workdir into planner entries: real files with
 * sizes, symlinks listed as links (input-data doors — the planner keeps
 * them), symlinked DIRECTORIES not followed (loop safety, the outputs
 * walk's own rule — the import job's `micrographs` link is data, not a
 * tree to clean). Dotfiles included: the .cf-* scratch is exactly what
 * the safe tier exists for.
 */
export function walkLocalRunFiles(workdir: string): {
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
/* Shared resolution (the plan face and the execute face drink alike)  */
/* ------------------------------------------------------------------ */

export interface ResolvedJob {
  job: { id: string; name: string; type: string; status: string };
  record: RunRecord | null;
  runnable: boolean;
  reason?: string;
}

export async function resolveCleanupJob(id: string): Promise<ResolvedJob | null> {
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
export function toRelSet(values: Array<string | undefined>, workdir: string): string[] {
  const out: string[] = [];
  for (const v of values) {
    if (!v) continue;
    const rel = path.relative(workdir, v).split(path.sep).join("/");
    if (rel && !rel.startsWith("..")) out.push(rel);
  }
  return out;
}

export function classifyContextFor(record: RunRecord, extra: { twinsRel?: string[] } = {}) {
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
/* The plan face — the GET's assembly, verbatim                        */
/* ------------------------------------------------------------------ */

/**
 * One job's cleanup plan: the exact assembly the cleanup route's GET
 * has always served (the dialog's own payload). Null = no such job
 * (the callers speak their own 404s); a real walk failure throws (the
 * route's 500 catch stays); an unreachable cluster side degrades onto
 * that side's error field alone.
 */
export async function computeCleanupPlan(
  jobId: string,
  opts: { refresh?: boolean } = {}
): Promise<CleanupPlan | null> {
  const resolved = await resolveCleanupJob(jobId);
  if (!resolved) return null;
  const { job, record, runnable, reason } = resolved;

  const refresh = opts.refresh === true;

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

  return {
    ok: true,
    runnable,
    ...(reason ? { reason } : {}),
    job,
    local,
    remote,
    downstream: await downstreamOf(job.id),
    checkedAt: new Date().toISOString(),
  };
}

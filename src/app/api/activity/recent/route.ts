import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { remoteInfoFor } from "@/lib/remote/remote-run";
import { isLocalRequest } from "@/lib/http-guard";

export const dynamic = "force-dynamic";

/**
 * GET /api/activity/recent?limit=8 — the most recently touched jobs across
 * ALL projects, feeding the Dashboard "Recent activity" feed.
 *
 * updatedAt is the honest touch-time: status flips, progress sweeps and
 * param edits all count, so a job the user is actively shepherding stays
 * visible instead of sinking behind its creation date. Slim select (no
 * params/results blobs) keeps the read cheap even as the job table grows.
 * `progress` rides along for free (one Float column) so the feed can draw
 * live bars for running jobs without a second request.
 *
 * SCALE CONTRACT: progress is the DB column's app-wide 0–100 scale — the
 * same number every other progress-bearing surface shows (canvas chips,
 * inspector header, JobRow). Consumers must not re-scale it; the feed's
 * fraction-native internals normalize once at the fetch boundary (the
 * dashboard's toFractionFrame). The 4200% lesson (Task 181): a percent
 * label that multiplies a 0–100 value by 100 renders confidently and
 * wrongly — and the probe missed it because it fed a mocked 42% FRACTION
 * instead of the wire's real scale. A mocked contract is not the wire's
 * contract.
 */
export async function GET(request: NextRequest) {
  // t709 — the reader door: the feed's slim select keeps the read cheap,
  // which is exactly why a blind probe should not get to run it for free
  // (execution behind an opaque response — doctrine in http-guard.ts;
  // the nine-readers ledger in the t707 census addendum).
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "Cross-site activity reads are not allowed" }, { status: 403 });
  }
  try {
    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(20, Number.parseInt(url.searchParams.get("limit") ?? "8", 10) || 8));
    // t415 — the status lens: the dashboard's "Needs attention" strip reads
    // the SAME feed with ?status=failed (failed jobs across all projects,
    // recency-ordered). The DB status column's own vocabulary is the only
    // accepted lens — anything else is ignored, never guessed.
    const statusParam = url.searchParams.get("status");
    const STATUSES = ["idle", "pending", "running", "completed", "failed"] as const;
    const statusFilter = (STATUSES as readonly string[]).includes(statusParam ?? "")
      ? (statusParam as (typeof STATUSES)[number])
      : null;

    // t635 — the text lens: the dashboard's search box asks the SAME feed
    // for jobs whose name or type contain the query, across ALL projects —
    // the "which project ever ran Topaz" question the project-name-only
    // grid filter cannot answer without clicking into every card. The
    // haystack is name + type only (the roster's own two content columns —
    // status has its dedicated lens above, workspace names are per-project
    // scaffolding that means nothing in a cross-project result). SQLite has
    // no Prisma `mode: "insensitive"` (a Postgres-only argument — it 500s
    // here), but SQLite's LIKE is case-insensitive for ASCII by default,
    // so plain `contains` IS the case-insensitive match on this engine;
    // an empty/whitespace query is the no-lens rest state, byte-identical
    // to the pre-t635 wire.
    const qParam = (url.searchParams.get("q") ?? "").trim();
    const textFilter = qParam
      ? {
          OR: [{ name: { contains: qParam } }, { type: { contains: qParam } }],
        }
      : null;

    const jobs = await db.job.findMany({
      where:
        statusFilter || textFilter
          ? { ...(statusFilter ? { status: statusFilter } : {}), ...(textFilter ?? {}) }
          : undefined,
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        progress: true,
        updatedAt: true,
        project: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      jobs: jobs.map((j) => {
        // t322 — the feed's badge must speak the SCHEDULER's word too: a
        // slurm-queued run is "Queued", not "Running". The slim select
        // stays slim — the runs store is an in-memory read, and only the
        // three fields the queue dialect needs ride the wire.
        const info = remoteInfoFor(j.id);
        return {
          id: j.id,
          name: j.name,
          type: j.type,
          status: j.status,
          progress: j.progress,
          updatedAt: j.updatedAt,
          projectId: j.project?.id ?? null,
          projectName: j.project?.name ?? null,
          ...(info
            ? {
                runRemote: {
                  mode: info.mode,
                  ...(info.slurmState ? { slurmState: info.slurmState } : {}),
                  ...(info.slurmDependsOn?.length ? { slurmDependsOn: info.slurmDependsOn } : {}),
                },
              }
            : {}),
        };
      }),
    });
  } catch (err) {
    console.error("GET /api/activity/recent failed:", err);
    return NextResponse.json({ error: "Failed to load recent activity" }, { status: 500 });
  }
}

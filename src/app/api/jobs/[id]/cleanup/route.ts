import { NextRequest, NextResponse } from "next/server";
import { type CleanupTierId } from "@/lib/hpc/cleanup";
import { computeCleanupPlan } from "@/lib/relion/cleanup-plan";
import { runCleanupExclusive } from "@/lib/relion/cleanup-execute";
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
 *                                 t518 — the shovel and its per-job lock
 *                                 live in the well (lib/relion/cleanup-
 *                                 execute): the dialog's POST and the
 *                                 agent's cleanup_job_files are two doors
 *                                 into the same per-job-serial shovel.
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
/* POST — the execution (the route is the protocol shell only, t518)    */
/* ------------------------------------------------------------------ */

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

    // the liveness guards run inside the well against the LIVE record — a
    // job that went running between plan and POST is refused there (409
    // below), never silently cleaned; the per-job in-flight lock rides in
    // the well too, so the dialog's POST and the agent's cleanup verb are
    // two doors into the same per-job-serial shovel (t518)
    const result = await runCleanupExclusive(id, scopes, tiers, "dialog");
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/jobs/[id]/cleanup failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

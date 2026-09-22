import { NextRequest, NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";
import { findEffectiveJob } from "@/lib/link";
import { getRun } from "@/lib/relion/engine";
import {
  remoteLiveIterations,
  localIterations,
  LIVE_ITERATION_TYPES,
  type IterationsPayload,
} from "@/lib/remote/iteration-live";

export const dynamic = "force-dynamic";

/**
 * GET /api/jobs/[id]/iterations — the per-iteration view of a
 * classification job (t350, the user's live-results ask):
 *
 *   · RUNNING remote job → ONE SSH round: the iteration file list + the
 *     newest data star's class occupancy, counted ON THE CLUSTER by awk
 *     (zero star bytes cross the wire). 12s TTL cache in-process.
 *   · otherwise (finished / synced) → the same shape answered from the
 *     LOCAL mirror, mtime-cached.
 *
 * The images live at /api/jobs/[id]/iterations/image (one PNG per class
 * slice). Never a 500 on cluster trouble — 200 with { error } so the
 * gallery degrades to an honest note (the usage-route dialect).
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isLocalRequest(request)) {
    return NextResponse.json({ error: "Cross-site access to job data is not allowed" }, { status: 403 });
  }
  try {
    const { id } = await context.params;
    const job = await findEffectiveJob(id);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    if (!LIVE_ITERATION_TYPES.has(job.type)) {
      return NextResponse.json({
        iterations: [],
        latest: null,
        classes: [],
        total: 0,
        classesFile: null,
        classesSlices: null,
        remote: false,
        error: `${job.type} jobs do not write per-iteration class snapshots`,
      } satisfies IterationsPayload);
    }
    const run = getRun(job.id);
    // live leg: a REMOTE run that has not finalized yet
    if (run?.remote && !run.done && (job.status === "running" || job.status === "pending")) {
      const force = new URL(request.url).searchParams.get("refresh") === "1";
      const payload = await remoteLiveIterations(job.id, { force });
      return NextResponse.json(payload, {
        headers: { "Cache-Control": "no-store" },
      });
    }
    // local leg: the mirror (finished job, or a local run)
    const workdir = run?.workdir;
    if (!workdir) {
      return NextResponse.json({
        iterations: [],
        latest: null,
        classes: [],
        total: 0,
        classesFile: null,
        classesSlices: null,
        remote: false,
      } satisfies IterationsPayload);
    }
    return NextResponse.json(localIterations(workdir), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("GET /api/jobs/[id]/iterations failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "fs";
import { findEffectiveJob } from "@/lib/link";
import { getRun } from "@/lib/relion/engine";
import { isLocalRequest } from "@/lib/http-guard";
import { remainingFromWorkdir } from "@/lib/remote/remote-remaining";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/jobs/[id]/outputs/remote-remaining — the stay-note's truth probe
 * (t429).
 *
 * The sync receipt stored in `runRemote.note` describes the state AT SYNC
 * TIME ("24 image file(s) stayed on the cluster — fetch on demand"). After
 * a bring-home (the t289 lazy leg, the t424 batch leg) that story goes
 * stale while the receipt keeps its amber urgency. This endpoint is the
 * one number the UI needs to re-judge the receipt honestly: how many
 * manifest entries are STILL absent from the local workdir.
 *
 * The same computation the sync route uses for its honest `remaining`
 * (manifest × existsSync — no SSH, the ledger names sizes and the disk
 * tells presence), surfaced as a read-only GET so any surface rendering
 * the receipt can afford to consult it.
 *
 * Security posture: isLocalRequest (drive-by door + Host pin) — job-scoped
 * metadata only, but the family gate is not optional.
 *
 * Response: { ok: true, jobId, remaining, total }
 *   - no remote run / no manifest → { remaining: 0, total: 0 } (vacuously
 *     all-home; the note component only probes stay-receipts anyway)
 *   - no local workdir → 400 (a workdir-less job has no presence truth)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    if (!isLocalRequest(request)) {
      return NextResponse.json(
        { error: "Cross-site access to job data is not allowed" },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const job = await findEffectiveJob(id);
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const run = getRun(job.id);
    if (!run?.workdir || !existsSync(run.workdir)) {
      return NextResponse.json({ error: "No local workdir for this job" }, { status: 400 });
    }
    if (!run.remote) {
      return NextResponse.json({ ok: true, jobId: id, remaining: 0, total: 0 });
    }

    // t431 — the count loop lives in lib/remote/remote-remaining.ts, shared
    // with the jobs-list annotation (one arithmetic, two consumers).
    const { remaining, total } = remainingFromWorkdir(run.workdir);

    return NextResponse.json({
      ok: true,
      jobId: id,
      remaining,
      total,
    });
  } catch (error) {
    console.error("GET /api/jobs/[id]/outputs/remote-remaining failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

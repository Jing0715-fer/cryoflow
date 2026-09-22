import { NextRequest, NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";
import { db } from "@/lib/db";
import { clearRunRecord, getRun } from "@/lib/relion/engine";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ jobId: string }> };

/**
 * DELETE /api/remote/records/[jobId] — forget ONE dead résumé entry.
 *
 * t294. The résumé (t270) is GLOBAL: it aggregates the run records in
 * engine-state.json, and since t272 every rendered entry honestly reports
 * whether its job still exists. A record whose job is gone everywhere
 * (exists === false) is kept as history — but history the user cannot act
 * on is a ledger that only grows: pre-t272 projects were swept by the
 * governance passes, yet any record outliving its job (a manual cleanup, a
 * db rebuilt from an older snapshot, a canvas deleted before t272's sweep
 * existed) sat in the résumé forever with no door out.
 *
 * The door is deliberately NARROW — three refusals, each honest:
 *   404  no record for this jobId (nothing to forget);
 *   409  the record is not a remote run (this is the résumé's door — local
 *        run records belong to the job lifecycle, not to a connection card);
 *   409  the job STILL EXISTS on some canvas — its record is live history
 *        that canvas can open; delete the job (or its project) instead, and
 *        the t272 sweep takes the record with it ("records live only for
 *        jobs that exist" cuts both ways: a live job keeps its record).
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    if (!isLocalRequest(request)) {
      return NextResponse.json({ error: "Cross-site access is not allowed" }, { status: 403 });
    }
    const { jobId } = await context.params;
    const rec = getRun(jobId);
    if (!rec) {
      return NextResponse.json({ error: "No run record for this job" }, { status: 404 });
    }
    if (!rec.remote) {
      return NextResponse.json(
        { error: "Not a remote run record — only cluster-run entries can be forgotten here" },
        { status: 409 }
      );
    }
    const alive = await db.job.findUnique({
      where: { id: jobId },
      select: { id: true },
    });
    if (alive) {
      return NextResponse.json(
        {
          error:
            "The job still exists on a canvas — its record is live history there; delete the job (or its project) and the record follows",
        },
        { status: 409 }
      );
    }
    clearRunRecord(jobId);
    return NextResponse.json({ ok: true, connectionId: rec.remote.connectionId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "record forget failed" },
      { status: 500 }
    );
  }
}

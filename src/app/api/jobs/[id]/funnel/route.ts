import { NextRequest, NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";
import { funnelLedgerOf, type FunnelLedger } from "@/lib/particle-funnel";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/jobs/[id]/funnel — the particle funnel of the chain that
 * contains this job (t461).
 *
 * The data plane is deliberately the CHEAPEST in the family: the ledger
 * is the receipts the engine already wrote (t347's honest counted
 * numbers, parsed by result-counts). No star re-reading, no workdir
 * walks — one jobs query + one edges query, and the pure brain does the
 * chain walk, the deltas, and the copy. Per-job disk truth stays where
 * it belongs: the per-job routes (particles/ctf/motion) this face sits
 * beside.
 *
 * 404 when the job does not exist; an honest empty-ish ledger (a chain
 * of one) when the door opens on a solitary verb.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const local = isLocalRequest(request);
  if (!local) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const { id } = await context.params;
    const job = await db.job.findUnique({
      where: { id },
      select: { projectId: true },
    });
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    const [jobs, edges] = await Promise.all([
      db.job.findMany({
        where: { projectId: job.projectId },
        select: { id: true, type: true, name: true, status: true, result: true },
      }),
      db.edge.findMany({
        where: { projectId: job.projectId },
        select: { fromJobId: true, toJobId: true },
      }),
    ]);
    const ledger: FunnelLedger | null = funnelLedgerOf({
      jobs,
      edges,
      enteredId: id,
    });
    if (!ledger) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    return NextResponse.json({ jobId: id, ...ledger });
  } catch (error) {
    console.error("GET /api/jobs/[id]/funnel failed:", error);
    return NextResponse.json({ error: "Failed to read the funnel" }, { status: 500 });
  }
}

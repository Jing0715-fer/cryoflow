import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toJobDTO } from "@/lib/seed";
import { startJob } from "@/lib/relion/dispatch";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/jobs/[id]/run — start (or restart) a job on the REAL RELION
 * engine (the only engine — the simulation was retired). Honest failures are
 * surfaced through the job result + an {error} field with HTTP 200.
 * A live process for this job → HTTP 409, nothing is spawned.
 */
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const existing = await db.job.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // linked copies are read-only mirrors: running them would double-write
    // the original's workdir. Downstream jobs consume the original's outputs
    // through the link — that is the supported way to continue from a copy.
    if (existing.linkedJobId) {
      const original = await db.job.findUnique({
        where: { id: existing.linkedJobId },
        select: { name: true },
      });
      return NextResponse.json(
        {
          error: `This is a linked copy${original ? ` of "${original.name}"` : ""} — it mirrors the original's outputs. Run the ORIGINAL job instead; downstream jobs wired to this link already consume its results.`,
        },
        { status: 400 }
      );
    }

    const { job, error, busy, waiting } = await startJob(existing);

    if (busy) {
      // the job is already running — do NOT fail it, just refuse the spawn
      return NextResponse.json({ job: toJobDTO(job), error: busy }, { status: 409 });
    }

    return NextResponse.json({
      job: toJobDTO(job),
      ...(error ? { error } : {}),
      ...(waiting ? { waiting } : {}),
    });
  } catch (error) {
    console.error("POST /api/jobs/[id]/run failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toJobDTO } from "@/lib/seed";
import { getProjectMeta } from "@/lib/projects";
import { startJob } from "@/lib/relion/dispatch";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/jobs/[id]/run — start (or restart) a job.
 * Real-engine projects dispatch to the RELION engine (honest failures are
 * surfaced through the job result + an {error} field with HTTP 200);
 * sim projects keep the legacy time-based simulation.
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

    const meta = getProjectMeta(existing.projectId);
    const engineKind = meta?.engine === "relion" ? "relion" : "sim";
    const { job, error, busy } = await startJob(existing, engineKind);

    if (busy) {
      // the job is already running — do NOT fail it, just refuse the spawn
      return NextResponse.json({ job: toJobDTO(job), error: busy }, { status: 409 });
    }

    return NextResponse.json({
      job: toJobDTO(job),
      ...(error ? { error } : {}),
    });
  } catch (error) {
    console.error("POST /api/jobs/[id]/run failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

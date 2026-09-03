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
 */
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const existing = await db.job.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const meta = getProjectMeta(existing.projectId);
    const engineKind = meta?.engine === "relion" ? "relion" : "sim";
    const { job, error } = await startJob(existing, engineKind);

    return NextResponse.json({
      job: toJobDTO(job),
      ...(error ? { error } : {}),
    });
  } catch (error) {
    console.error("POST /api/jobs/[id]/run failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toJobDTO, jitteredDuration } from "@/lib/seed";
import { jobType } from "@/lib/workflow";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** POST /api/jobs/[id]/run — start (or restart) the simulated run. */
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const existing = await db.job.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const base = jobType(existing.type)?.duration ?? existing.duration;
    const job = await db.job.update({
      where: { id },
      data: {
        status: "running",
        startedAt: new Date(),
        progress: 0,
        result: null,
        duration: jitteredDuration(base),
      },
    });

    return NextResponse.json({ job: toJobDTO(job) });
  } catch (error) {
    console.error("POST /api/jobs/[id]/run failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

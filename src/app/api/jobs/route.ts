import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureProject, toJobDTO, reconcileRunning, jitteredDuration } from "@/lib/seed";
import { defaultParams, jobType } from "@/lib/workflow";

export const dynamic = "force-dynamic";

/** GET /api/jobs — all jobs of the demo project, running jobs reconciled. */
export async function GET() {
  try {
    const project = await ensureProject();
    const jobs = await db.job.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "asc" },
    });
    const reconciled = await reconcileRunning(jobs);
    return NextResponse.json({ jobs: reconciled.map(toJobDTO) });
  } catch (error) {
    console.error("GET /api/jobs failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** POST /api/jobs — body: { type, x?, y? } */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      type?: unknown;
      x?: unknown;
      y?: unknown;
    };

    const type = typeof body.type === "string" ? body.type : "";
    const spec = jobType(type);
    if (!spec) {
      return NextResponse.json({ error: `Unknown job type: ${type}` }, { status: 400 });
    }

    const project = await ensureProject();
    const count = await db.job.count({
      where: { projectId: project.id, type },
    });

    const x =
      typeof body.x === "number" && Number.isFinite(body.x)
        ? body.x
        : 140 + Math.random() * 60;
    const y =
      typeof body.y === "number" && Number.isFinite(body.y)
        ? body.y
        : 200 + Math.random() * 60;

    const job = await db.job.create({
      data: {
        projectId: project.id,
        type,
        name: `${spec.label} ${count + 1}`,
        x,
        y,
        params: JSON.stringify(defaultParams(type)),
        duration: jitteredDuration(spec.duration),
      },
    });

    return NextResponse.json({ job: toJobDTO(job) }, { status: 201 });
  } catch (error) {
    console.error("POST /api/jobs failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

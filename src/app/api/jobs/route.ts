import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "fs";
import { db } from "@/lib/db";
import { ensureActiveProject, toJobDTO, reconcileRunning, jitteredDuration } from "@/lib/seed";
import { defaultParams, jobType } from "@/lib/workflow";
import { readRuns, reconcileRealJobs } from "@/lib/relion/engine";

export const dynamic = "force-dynamic";

/** GET /api/jobs — jobs of the ACTIVE project; real engine reconciled first, then sim. */
export async function GET() {
  try {
    const active = await ensureActiveProject();
    if (!active) {
      return NextResponse.json({ jobs: [] });
    }
    const jobs = await db.job.findMany({
      where: { projectId: active.project.id },
      orderBy: { createdAt: "asc" },
    });
    const reconciled = await reconcileRealJobs(jobs); // REAL engine first
    const final = await reconcileRunning(reconciled); // then time-based sim

    const runs = readRuns();
    const projectIsRelion = active.meta.engine === "relion";
    const jobsOut = final.map((j) => {
      const dto = toJobDTO(j);
      const state = runs[j.id];
      dto.engine = state || projectIsRelion ? "relion" : "sim";
      dto.hasLog = state ? existsSync(state.logFile) : false;
      return dto;
    });
    return NextResponse.json({ jobs: jobsOut });
  } catch (error) {
    console.error("GET /api/jobs failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** POST /api/jobs — body: { type, x?, y? } → created in the ACTIVE project. */
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

    const active = await ensureActiveProject();
    if (!active) {
      return NextResponse.json({ error: "No project available" }, { status: 500 });
    }
    const count = await db.job.count({
      where: { projectId: active.project.id, type },
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
        projectId: active.project.id,
        type,
        name: `${spec.label} ${count + 1}`,
        x,
        y,
        params: JSON.stringify(defaultParams(type)),
        duration: jitteredDuration(spec.duration),
      },
    });

    const dto = toJobDTO(job);
    dto.engine = active.meta.engine === "relion" ? "relion" : "sim";
    return NextResponse.json({ job: dto }, { status: 201 });
  } catch (error) {
    console.error("POST /api/jobs failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

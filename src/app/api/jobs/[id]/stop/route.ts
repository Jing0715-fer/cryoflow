import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toJobDTO } from "@/lib/seed";
import { getProjectMeta } from "@/lib/projects";
import { stopRun, isRunAlive } from "@/lib/relion/engine";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/jobs/[id]/stop — gracefully stop a running job.
 *
 * SIGTERM → 5s grace → SIGKILL for the whole process tree (mpirun, hydra
 * proxy and every MPI rank — killing only mpirun would orphan the ranks).
 * Stopped refine-family runs keep their checkpoints: the next POST /run
 * auto-resumes via RELION --continue. Sim-engine jobs just get marked
 * stopped (time-based simulation has nothing to kill).
 */
export async function POST(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const existing = await db.job.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    if (existing.status !== "running") {
      return NextResponse.json(
        { error: `Job is not running (status: ${existing.status})` },
        { status: 409 }
      );
    }

    const meta = getProjectMeta(existing.projectId);
    if (meta?.engine !== "relion") {
      // sim engine: no process, just freeze the state
      const job = await db.job.update({
        where: { id },
        data: {
          status: "failed",
          progress: 0,
          result: "stopped by user",
        },
      });
      return NextResponse.json({ job: toJobDTO(job), stopped: false, message: "sim job marked stopped" });
    }

    const wasAlive = isRunAlive(id);
    const outcome = await stopRun(id);

    // The exit handler usually wins the DB write (child SIGTERM → exit
    // event → status failed, exit −1). Give it a moment, then reflect
    // whatever the DB says; if nothing landed (restart-orphaned tree),
    // mark it ourselves.
    await new Promise((r) => setTimeout(r, 400));
    let job = await db.job.findUnique({ where: { id } });
    if (job && job.status === "running") {
      job = await db.job.update({
        where: { id },
        data: {
          status: "failed",
          progress: 0,
          result: wasAlive ? "stopped by user — re-run resumes from checkpoint" : "stopped by user",
        },
      });
    }

    return NextResponse.json({
      job: toJobDTO(job ?? existing),
      stopped: outcome.stopped,
      message: outcome.message,
    });
  } catch (error) {
    console.error("POST /api/jobs/[id]/stop failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toJobDTO } from "@/lib/seed";
import { stopRun, isRunAlive, getRun, updateRun } from "@/lib/relion/engine";
import { remoteInfoFor, remoteStopRun } from "@/lib/remote/remote-run";
import { isLocalRequest } from "@/lib/http-guard";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/jobs/[id]/stop — gracefully stop a running job.
 *
 * LOCAL runs: SIGTERM → 5s grace → SIGKILL for the whole process tree
 * (mpirun, hydra proxy and every MPI rank — killing only mpirun would orphan
 * the ranks). Stopped refine-family runs keep their checkpoints: the next
 * POST /run auto-resumes via RELION --continue.
 *
 * REMOTE runs (record.remote): kill the cluster-side SESSION (process group
 * leader from .cf-pid) over SSH — same semantics, distant tree. Checkpoints
 * stay on the cluster and sync back; re-run resumes from them.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    // Write door (t252): bodyless action — form-firable blind cross-site.
    // Same drive-by door + Host pin pair as the read routes (http-guard).
    if (!isLocalRequest(request)) {
      return NextResponse.json(
        { error: "Cross-site job actions are not allowed" },
        { status: 403 }
      );
    }
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

    // ---- remote branch: the process tree lives on the cluster ----------
    const rec = getRun(id);
    if (rec?.remote) {
      const outcome = await remoteStopRun(id);
      // finalize the record now — a SIGKILL'd wrapper never writes its exit
      // file, and a !done record would ghost-block re-runs (isRunAlive)
      updateRun(
        id,
        (cur) =>
          cur.remote && !cur.done
            ? { ...cur, done: true, exitCode: cur.exitCode ?? 137, result: cur.result ?? "stopped by user" }
            : null
      );
      // give the cluster a beat to write the exit status, then reflect the
      // DB (the remote poll sweep finalizes + syncs checkpoints on its next
      // tick — typically ≤5s)
      await new Promise((r) => setTimeout(r, 800));
      let job = await db.job.findUnique({ where: { id } });
      if (job && job.status === "running") {
        job = await db.job.update({
          where: { id },
          data: {
            status: "failed",
            progress: 0,
            result: `stopped by user (cluster-side session killed) — re-run resumes from the last synced checkpoint`,
          },
        });
      }
      const dto = toJobDTO(job ?? existing);
      const rinfo = remoteInfoFor(id);
      if (rinfo) dto.runRemote = rinfo;
      return NextResponse.json({
        job: dto,
        stopped: outcome.stopped,
        message: outcome.message,
      });
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

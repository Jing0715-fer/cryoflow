import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isLocalRequest } from "@/lib/http-guard";
import { serverErrorReply } from "@/lib/server-error";
import { computePace } from "@/lib/pace";
import { walkTimeline } from "@/lib/timeline-walk";
import { criticalPath, summarizeCritical } from "@/lib/critical-path";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/projects/[id]/pace — the project's pipeline-pace face: the
 * per-stage duration aggregates, the chain's wall time, the honest
 * failure list. The t1009 product face (the t1008 tombstone's "new
 * product direction" lead candidate).
 *
 * DOOR LAW (the fsc-index sibling): a DB read of project-scoped rows —
 * the same drive-by door + Host pin pair guards it. Deliberately
 * FS-FREE: the pace face reads the DB's clock facts only (completed
 * jobs carry the engine's real elapsed in `duration`); it never walks
 * workdirs, so it is cheap on any project size.
 *
 * Unknown project → the honest empty face (totals zeroed), not a 404 —
 * the dialog fetches its own project's id and an empty face is a true
 * statement about an empty project.
 *
 * THE PROJECT'S CHAIN (t1017): the face also walks the project's
 * critical chain server-side — the SAME walk the selection's pace face
 * runs client-side (lib/timeline-walk's honest windows over
 * lib/critical-path's backward walk, the ≥2 gate identical), so both
 * transports speak one truth from one lib and the project door no
 * longer trails the selection door on the chain question. Still
 * FS-FREE: the walk reads the DB's clock facts and the DB's edges —
 * never a workdir. A single step is not a chain: an unwired project
 * ships `critical: null` and the dialog stays silent.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  if (!isLocalRequest(request)) {
    return NextResponse.json(
      { error: "Cross-site access to project data is not allowed" },
      { status: 403 }
    );
  }
  try {
    const { id } = await context.params;
    const jobs = await db.job.findMany({
      where: { projectId: id },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        duration: true,
        startedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
    const mapped = jobs.map((j) => ({
      id: j.id,
      name: j.name,
      type: j.type,
      status: j.status,
      duration: j.duration,
      startedAt: j.startedAt ? j.startedAt.toISOString() : null,
    }));
    const face = computePace(mapped);
    // the project's chain (t1017): the same walk the selection face
    // runs, server-side — the honest windows, the project's own edges,
    // the same ≥2 gate (a single step is not a chain)
    const edges = await db.edge.findMany({
      where: { projectId: id },
      select: { id: true, fromJobId: true, toJobId: true },
    });
    const walk = walkTimeline(mapped, Date.now());
    const crit = walk.rows.length > 0 ? criticalPath(walk.rows, edges) : null;
    const critical =
      crit && crit.chain.length >= 2 ? summarizeCritical(crit) : null;
    return NextResponse.json({ projectId: id, ...face, critical });
  } catch (error) {
    return serverErrorReply("GET /api/projects/[id]/pace", error);
  }
}

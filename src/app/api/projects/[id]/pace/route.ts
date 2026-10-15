import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isLocalRequest } from "@/lib/http-guard";
import { serverErrorReply } from "@/lib/server-error";
import { computePace } from "@/lib/pace";

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
    const face = computePace(
      jobs.map((j) => ({
        id: j.id,
        name: j.name,
        type: j.type,
        status: j.status,
        duration: j.duration,
        startedAt: j.startedAt ? j.startedAt.toISOString() : null,
      }))
    );
    return NextResponse.json({ projectId: id, ...face });
  } catch (error) {
    return serverErrorReply("GET /api/projects/[id]/pace", error);
  }
}

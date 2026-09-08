import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/activity/recent?limit=8 — the most recently touched jobs across
 * ALL projects, feeding the Dashboard "Recent activity" feed.
 *
 * updatedAt is the honest touch-time: status flips, progress sweeps and
 * param edits all count, so a job the user is actively shepherding stays
 * visible instead of sinking behind its creation date. Slim select (no
 * params/results blobs) keeps the read cheap even as the job table grows.
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(20, Number.parseInt(url.searchParams.get("limit") ?? "8", 10) || 8));

    const jobs = await db.job.findMany({
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        updatedAt: true,
        project: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      jobs: jobs.map((j) => ({
        id: j.id,
        name: j.name,
        type: j.type,
        status: j.status,
        updatedAt: j.updatedAt,
        projectId: j.project?.id ?? null,
        projectName: j.project?.name ?? null,
      })),
    });
  } catch (err) {
    console.error("GET /api/activity/recent failed:", err);
    return NextResponse.json({ error: "Failed to load recent activity" }, { status: 500 });
  }
}

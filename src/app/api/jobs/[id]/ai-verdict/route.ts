import { NextRequest, NextResponse } from "next/server";
import { isLocalRequest } from "@/lib/http-guard";
import { findEffectiveJob } from "@/lib/link";
import { getVerdictStamp } from "@/lib/ai/verdict-stamps";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/jobs/[id]/ai-verdict — the judge's stamped verdict (t565).
 *
 * judge_2d_classes writes its verdict onto the job's record at judge
 * time (data/ai-verdicts.json, one per job, newest wins); this route
 * hands that stamp back for the Results tab's verdict card. The stamp
 * is a notebook entry, NOT engine output — it never claims to be a
 * receipt, and the card that renders it names the model and the
 * two-pass summary beside it.
 *
 * 403 cross-site (the job-derived-data hardening pair), 404 when the
 * job does not exist, and an honest { available:false, note } when no
 * judge has ever spoken about this job. No type gate: the stamp is
 * keyed by job id, and a future judge extension (3D classes) rides the
 * same door without a route migration.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  // Hardening (t251 family): job-derived data, same as the log, outputs
  // and selection-receipt routes.
  if (!isLocalRequest(request)) {
    return NextResponse.json(
      { error: "Cross-site access to job data is not allowed" },
      { status: 403 }
    );
  }

  try {
    const { id } = await context.params;
    // soft links: the verdict is about the original job
    const effective = await findEffectiveJob(id);
    if (!effective) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const stamp = getVerdictStamp(effective.id);
    if (!stamp) {
      return NextResponse.json({
        jobId: id,
        type: effective.type,
        available: false,
        note:
          effective.type === "class2d"
            ? "No AI verdict yet — ask the assistant to judge this job's classes"
            : "AI verdicts are stamped by the judge (class2d jobs)",
      });
    }

    return NextResponse.json({
      jobId: id,
      type: effective.type,
      available: true,
      status: effective.status,
      stamp,
    });
  } catch (error) {
    console.error("GET /api/jobs/[id]/ai-verdict failed:", error);
    return NextResponse.json(
      { error: "Failed to read the AI verdict stamp" },
      { status: 500 }
    );
  }
}

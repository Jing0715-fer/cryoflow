import { NextRequest, NextResponse } from "next/server";
import { loadMotion, ChartJobNotFound } from "@/lib/chart-data";
import { isLocalRequest } from "@/lib/http-guard";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// t469 moved the row shape and its block-aware parse to
// lib/compare-rows.ts (ONE grammar under the route, the dialog and the
// agent's compare_jobs); t487 moved the loading half — the summary math
// and the early/late split — to lib/chart-data.ts (loadMotion), so this
// route and the agent's get_job_curves drink from the same well. Types
// re-exported for compat. t488: the response carries the interpretation
// (driftTriage + worst three) built by interpretMotion in that well —
// this shell passes it through untouched; the panel's strip renders it.
export type { MotionMicrograph } from "@/lib/compare-rows";
export type { MotionSummary, MotionResponse } from "@/lib/chart-rows";

/**
 * GET /api/jobs/[id]/motion — per-micrograph accumulated motion of a
 * MotionCorr job.
 *
 * Source: corrected_micrographs.star — the job's own catalogue, where
 * MotionCorr/RELION record _rlnAccumulatedMotionTotal / Early / Late per
 * micrograph (Å). Early drift (first frames, before the stage settles)
 * and late drift (dose-weighting window) split the total into the two
 * halves a user actually triages: a movie with a big EARLY component
 * settles late; a big LATE component kept drifting to the end. Both are
 * reasons to drop the movie — the chart's job is to make the outliers
 * unmissable.
 *
 * The source hunt, the worst-offender pick and the summary aggregates
 * live in loadMotion (chart-data.ts) — this shell keeps only the door
 * laws: the same-origin guard (t251) and the 404/500 translations.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  // Hardening (t251, the #5 sibling closure): workdir-derived data —
  // same drive-by door + Host pin pair as the outputs/file route
  // (see http-guard for the threat model). Parsed or rendered, the
  // bytes come from the job workdir — the door rides along.
  if (!isLocalRequest(request)) {
    return NextResponse.json(
      { error: "Cross-site access to job data is not allowed" },
      { status: 403 }
    );
  }
  const { id } = await context.params;
  try {
    return NextResponse.json(await loadMotion(id));
  } catch (error) {
    if (error instanceof ChartJobNotFound) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    console.error("GET /api/jobs/[id]/motion failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

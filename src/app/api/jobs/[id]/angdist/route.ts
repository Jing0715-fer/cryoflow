import { NextRequest, NextResponse } from "next/server";
import { loadAngDist, ChartJobNotFound } from "@/lib/chart-data";
import { isLocalRequest } from "@/lib/http-guard";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// t486 — the loading half moved to chart-data.ts (one loader shared by
// this route and the agent's get_job_curves tool). Types re-exported.
export type { AngDistData as AngDistResponse } from "@/lib/chart-data";

/**
 * GET /api/jobs/[id]/angdist — angular distribution of a 3D job: the
 * polar heatmap grid, the concentration factor and the Fibonacci-sphere
 * marginal view. File selection (run_data.star once converged, else the
 * highest run_itXXX_data.star, else engine-native particles stars), the
 * binning and the symmetry chip live in loadAngDist (chart-data.ts) —
 * this shell keeps only the door laws: the same-origin guard (t251) and
 * the 404/500 translations.
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
    return NextResponse.json(await loadAngDist(id));
  } catch (error) {
    if (error instanceof ChartJobNotFound) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    console.error("GET /api/jobs/[id]/angdist failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

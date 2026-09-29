import { NextRequest, NextResponse } from "next/server";
import { loadGuinier, ChartJobNotFound } from "@/lib/chart-data";
import { isLocalRequest } from "@/lib/http-guard";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// t486 — the loading half moved to chart-data.ts (one loader shared by
// this route and the agent's get_job_curves tool). Types re-exported.
export type {
  GuinierResponse,
  GuinierPoint,
} from "@/lib/chart-rows";

/**
 * GET /api/jobs/[id]/guinier — Guinier plot of a PostProcess job.
 * Source priority (star table → EPS recovery → legacy table) and the
 * two-road B-factor read live in loadGuinier (chart-data.ts) — this shell
 * keeps only the door laws: the same-origin guard (t251) and the 404/500
 * translations.
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
    return NextResponse.json(await loadGuinier(id));
  } catch (error) {
    if (error instanceof ChartJobNotFound) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    console.error("GET /api/jobs/[id]/guinier failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

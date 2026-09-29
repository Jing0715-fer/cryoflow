import { NextRequest, NextResponse } from "next/server";
import { loadTopazTraining, ChartJobNotFound } from "@/lib/chart-data";
import { isLocalRequest } from "@/lib/http-guard";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// t487 — the loading half moved to chart-data.ts (loadTopazTraining): the
// run.out-first source hunt, the 4 MB dump ceiling, the statcache key and
// the run.out-wins merge now live in ONE loader shared by this route and
// the agent's get_job_curves tool, so the answer the model quotes IS the
// data this route serves. t488: the response also carries the
// interpretation (first/last epoch + loss direction) built by
// interpretTopaz — passed through untouched; the panel's strip renders it.

/**
 * GET /api/jobs/[id]/topaz-training — per-epoch Topaz training progress.
 *
 * Sources, merged in order (later files only fill epochs the earlier ones
 * left blank — run.out is authoritative because RELION pipes topaz's own
 * stdout there): the run's logFile first, then any *training*.txt /
 * *loss*.txt / topaz*.log in the workdir. Tolerant parser
 * (topaz-training.ts) — a log with no recognizable progress returns []
 * and the chart self-hides.
 *
 * This shell keeps only the door laws: the same-origin guard (t266, the
 * t251-class sibling sweep — the parsed epochs LEAK the training log's
 * contents cross-site) and the 404/500 translations.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  if (!isLocalRequest(request)) {
    return NextResponse.json(
      { error: "Cross-site access to job data is not allowed" },
      { status: 403 }
    );
  }
  const { id } = await context.params;
  try {
    return NextResponse.json(await loadTopazTraining(id));
  } catch (error) {
    if (error instanceof ChartJobNotFound) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    console.error("GET /api/jobs/[id]/topaz-training failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

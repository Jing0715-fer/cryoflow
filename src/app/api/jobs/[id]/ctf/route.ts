import { NextRequest, NextResponse } from "next/server";
import { loadCtf, ChartJobNotFound } from "@/lib/chart-data";
import { isLocalRequest } from "@/lib/http-guard";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// t469 moved the row shape and its block-aware parse to
// lib/compare-rows.ts (ONE grammar under the route, the dialog and the
// agent's compare_jobs); t487 moved the loading half — the sort and the
// summary math — to lib/chart-data.ts (loadCtf), so this route and the
// agent's get_job_curves drink from the same well. Types re-exported
// for compat. t488: the response carries the interpretation (the worst
// three fits) built by interpretCtf in that well — this shell passes it
// through untouched; the panel's strip renders it.
export type { CtfMicrograph } from "@/lib/compare-rows";
export type { CtfSummary, CtfResponse } from "@/lib/chart-rows";

/**
 * GET /api/jobs/[id]/ctf — per-micrograph CTF fit quality of a CtfFind job
 * (defocus / astigmatism / figure-of-merit / fit resolution), straight from
 * the micrographs_ctf.star RELION writes into the job workdir.
 * Source hunt, ordering and the summary aggregates live in loadCtf
 * (chart-data.ts) — this shell keeps only the door laws: the same-origin
 * guard (t251) and the 404/500 translations.
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
    return NextResponse.json(await loadCtf(id));
  } catch (error) {
    if (error instanceof ChartJobNotFound) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    console.error("GET /api/jobs/[id]/ctf failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

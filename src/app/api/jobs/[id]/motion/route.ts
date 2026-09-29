import { NextRequest, NextResponse } from "next/server";
import { findEffectiveJob } from "@/lib/link";
import { getRun } from "@/lib/relion/engine";
import { motionCatalogueRows, type MotionMicrograph } from "@/lib/compare-rows";
import { isLocalRequest } from "@/lib/http-guard";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

// t469 — the row shape and its block-aware parse moved to
// lib/compare-rows.ts (ONE grammar under the route, the dialog and the
// agent's compare_jobs); the route re-exports the shape for its readers.
export type { MotionMicrograph };

export interface MotionSummary {
  count: number;
  meanTotal: number;
  maxTotal: number;
  /** name of the worst-drifting micrograph (the first offender) */
  worstName: string | null;
  meanEarly: number;
  meanLate: number;
}

export interface MotionResponse {
  jobId: string;
  sourceFile: string | null;
  micrographs: MotionMicrograph[];
  summary: MotionSummary | null;
}

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
 * Block-aware: the optics block shares the file and must not leak its
 * rows into the data loop (the ctf endpoint's freeze-on-first-row rule).
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
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
    const job = await findEffectiveJob(id); // resolves soft links to the original
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    const run = getRun(job.id);
    const empty: MotionResponse = {
      jobId: id,
      sourceFile: null,
      micrographs: [],
      summary: null,
    };
    // t469 — the catalogue read lives in lib/compare-rows.ts (ONE grammar
    // under the route, the dialog and the agent's compare_jobs tool)
    const { sourceFile, micrographs } = motionCatalogueRows(run?.workdir ?? "");
    if (!sourceFile || micrographs.length === 0) {
      return NextResponse.json(empty);
    }

    const n = micrographs.length;
    const sum = (sel: (m: MotionMicrograph) => number) =>
      micrographs.reduce((acc, m) => acc + sel(m), 0);
    const worst = micrographs.reduce((a, b) => (b.total > a.total ? b : a));
    const summary: MotionSummary = {
      count: n,
      meanTotal: sum((m) => m.total) / n,
      maxTotal: worst.total,
      worstName: worst.name,
      meanEarly: sum((m) => m.early) / n,
      meanLate: sum((m) => m.late) / n,
    };

    return NextResponse.json({
      jobId: id,
      sourceFile: "corrected_micrographs.star",
      micrographs,
      summary,
    } satisfies MotionResponse);
  } catch (error) {
    console.error("GET /api/jobs/[id]/motion failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

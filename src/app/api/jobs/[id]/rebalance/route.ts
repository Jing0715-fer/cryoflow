import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "fs";
import path from "path";
import { findEffectiveJob } from "@/lib/link";
import { getRun } from "@/lib/relion/engine";
import { cachedFileCompute } from "@/lib/relion/statcache";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Report payload (keptIndices stripped — the panel never needs row ids). */
export interface RebalanceReportResponse {
  jobId: string;
  found: true;
  params: {
    numBins: number;
    percentile: number;
    exclusionCriterion: string;
    mode: string;
    resolutionWeight: number;
    seed: number;
  };
  criterion: string;
  stats: {
    totalBefore: number;
    totalAfter: number;
    removed: number;
    removedPercent: number;
    binsTrimmed: number;
    effectiveBins: number;
    anisotropyBefore: number;
    anisotropyAfter: number;
    meanResolutionBefore: number;
    meanResolutionAfter: number;
    medianResolutionBefore: number;
    medianResolutionAfter: number;
    resolutionCVBefore: number;
    resolutionCVAfter: number;
    countUniformityBefore: number;
    countUniformityAfter: number;
  };
  /** per-bin view: only bins that held particles, sorted by countBefore desc,
   *  capped at 60 rows for the panel's before/after bar chart. */
  bins: Array<{
    index: number;
    countBefore: number;
    countAfter: number;
    threshold: number;
    removed: number;
    resolutionBefore: number;
    resolutionAfter: number;
    /** direction on the unit sphere (Mollweide cross-check) */
    cx: number;
    cy: number;
    cz: number;
  }>;
  reportFile: string;
}

/**
 * GET /api/jobs/[id]/rebalance — the Orientation Rebalancer's run report
 * (rebalance_report.json written by the engine-native rebalance job).
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const job = await findEffectiveJob(id); // resolves soft links to the original
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    const run = getRun(job.id);
    if (!run?.workdir || !existsSync(run.workdir)) {
      return NextResponse.json(
        { error: "not-run", jobId: id, detail: "This job has not produced output yet" },
        { status: 404 }
      );
    }
    const reportFile = path.join(run.workdir, "rebalance_report.json");
    if (!existsSync(reportFile)) {
      return NextResponse.json(
        { error: "no-report", jobId: id, detail: "No rebalance_report.json in the job directory" },
        { status: 404 }
      );
    }

    // mtime-cached parse — the report only changes when the file is rewritten
    const raw = cachedFileCompute(reportFile, "rebalance:report", (text) =>
      JSON.parse(text) as {
        params: RebalanceReportResponse["params"];
        criterion: string;
        stats: RebalanceReportResponse["stats"];
        bins: Array<RebalanceReportResponse["bins"][number]>;
      }
    );
    if (!raw) {
      return NextResponse.json(
        { error: "no-report", jobId: id, detail: "rebalance_report.json became unreadable" },
        { status: 404 }
      );
    }

    const bins = raw.bins
      .filter((b) => b.countBefore > 0)
      .sort((a, b) => b.countBefore - a.countBefore)
      .slice(0, 60)
      .map((b) => ({
        index: b.index,
        countBefore: b.countBefore,
        countAfter: b.countAfter,
        threshold: b.threshold,
        removed: b.removed,
        resolutionBefore: b.resolutionBefore,
        resolutionAfter: b.resolutionAfter,
        cx: b.cx,
        cy: b.cy,
        cz: b.cz,
      }));

    const body: RebalanceReportResponse = {
      jobId: id,
      found: true,
      params: raw.params,
      criterion: raw.criterion,
      stats: raw.stats,
      bins,
      reportFile,
    };
    return NextResponse.json(body);
  } catch (error) {
    console.error("GET /api/jobs/[id]/rebalance failed:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
